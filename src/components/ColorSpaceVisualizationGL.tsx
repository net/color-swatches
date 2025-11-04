import React from 'react';

interface ColorSpaceVisualizationProps {
  colorSpace: 'hsl' | 'oklch';
  axis: 'saturation' | 'lightness';
  saturation: number;
  lightness: number;
  min: number;
  max: number;
}

const vertexShaderSource = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 u_resolution;
uniform float u_min;
uniform float u_max;
uniform float u_saturation;
uniform float u_lightness;
uniform int u_axis;
uniform int u_colorSpace;

// Oklab -> linear sRGB
vec3 oklab_to_linear_srgb(vec3 lab) {
  float L = lab.x, a = lab.y, b = lab.z;
  float l = L + 0.3963377774*a + 0.2158037573*b;
  float m = L - 0.1055613458*a - 0.0638541728*b;
  float s = L - 0.0894841775*a - 1.2914855480*b;

  float l3 = l*l*l;
  float m3 = m*m*m;
  float s3 = s*s*s;

  return vec3(
    +4.0767416621*l3 - 3.3077115913*m3 + 0.2309699292*s3,
    -1.2684380046*l3 + 2.6097574011*m3 - 0.3413193965*s3,
    -0.0041960863*l3 - 0.7034186147*m3 + 1.7076147010*s3
  );
}

bool in_gamut_linear_srgb(vec3 rgb) {
  return all(greaterThanEqual(rgb, vec3(0.0))) &&
         all(lessThanEqual(rgb, vec3(1.0)));
}

// Encode linear -> display sRGB
vec3 linear_to_srgb(vec3 x) {
  vec3 a = 12.92 * x;
  vec3 b = 1.055 * pow(max(x, vec3(0.0)), vec3(1.0/2.4)) - vec3(0.055);
  return mix(a, b, step(vec3(0.0031308), x));
}

// Check if OKLCH color should be shown (with tolerance)
// Returns sRGB if acceptable, or vec3(-1) to signal "hide this pixel"
vec3 oklch_to_srgb_with_tolerance(float L, float C, float h_deg) {
  const float CHROMA_TOL = 0.025;
  const float LIGHTNESS_TOL = 0.2;
  
  float hRad = radians(h_deg);
  float ch = cos(hRad);
  float sh = sin(hRad);

  // Try original chroma
  vec3 lab = vec3(L, C * ch, C * sh);
  vec3 rgb_lin = oklab_to_linear_srgb(lab);

  if (in_gamut_linear_srgb(rgb_lin)) {
    // In gamut - show it
    return linear_to_srgb(rgb_lin);
  }

  // Out-of-gamut: binary search for gamut-mapped chroma
  float lo = 0.0;
  float hi = C;

  const int STEPS = 8;
  for (int i = 0; i < STEPS; ++i) {
    float mid = 0.5 * (lo + hi);
    vec3 labMid = vec3(L, mid * ch, mid * sh);
    vec3 rgbMid = oklab_to_linear_srgb(labMid);

    if (in_gamut_linear_srgb(rgbMid)) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  // Check tolerance: does the gamut-mapped color differ too much?
  float C_mapped = lo;
  // L stays the same in our mapping, so L_mapped = L
  
  float C_diff = abs(C_mapped - C);
  // L_diff would be 0 since we don't change L
  
  if (C_diff > CHROMA_TOL) {
    // Too far out of gamut - hide this pixel
    return vec3(-1.0);
  }

  // Within tolerance - show the gamut-mapped color
  vec3 labMapped = vec3(L, C_mapped * ch, C_mapped * sh);
  vec3 rgb_lin_mapped = oklab_to_linear_srgb(labMapped);
  return linear_to_srgb(clamp(rgb_lin_mapped, 0.0, 1.0));
}

vec3 hsl_to_srgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0*l - 1.0)) * s;
  float hp = h / 60.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  vec3 rgb1 =
    hp < 1.0 ? vec3(c, x, 0.0) :
    hp < 2.0 ? vec3(x, c, 0.0) :
    hp < 3.0 ? vec3(0.0, c, x) :
    hp < 4.0 ? vec3(0.0, x, c) :
    hp < 5.0 ? vec3(x, 0.0, c) :
               vec3(c, 0.0, x);
  float m = l - 0.5*c;
  return clamp(rgb1 + vec3(m), 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float hue = (1.0 - uv.y) * 360.0; // Invert Y so red (hue 0) is at top
  float axisVal = u_min + uv.x * (u_max - u_min);

  vec3 srgb;
  if (u_colorSpace == 1) {
    // OKLCH with tolerance check
    float L = (u_axis == 1) ? axisVal : u_lightness;
    float C = (u_axis == 0) ? axisVal : u_saturation;
    srgb = oklch_to_srgb_with_tolerance(L, C, hue);
    
    // Check if we should hide this pixel
    if (srgb.r < 0.0) {
      discard; // Don't draw this pixel
    }
  } else {
    // HSL: normalize saturation and lightness to 0-1
    float S = (u_axis == 0) ? axisVal / 100.0 : u_saturation / 100.0;
    float L = (u_axis == 1) ? axisVal / 100.0 : u_lightness / 100.0;
    srgb = hsl_to_srgb(hue, S, L);
  }

  gl_FragColor = vec4(srgb, 1.0);
}
`;

const ColorSpaceVisualization: React.FC<ColorSpaceVisualizationProps> = ({
  colorSpace,
  axis,
  saturation,
  lightness,
  min,
  max,
}) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const glRef = React.useRef<WebGLRenderingContext | null>(null);
  const programRef = React.useRef<WebGLProgram | null>(null);

  const cssWidth = 300;
  const cssHeight = 40;

  // Initialize WebGL
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }
    glRef.current = gl;

    // Compile shaders
    const vertShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertShader, vertexShaderSource);
    gl.compileShader(vertShader);

    const fragShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragShader, fragmentShaderSource);
    gl.compileShader(fragShader);

    // Create program
    const program = gl.createProgram()!;
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);
    programRef.current = program;

    // Create full-screen quad
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      gl.deleteBuffer(buffer);
    };
  }, []);

  // Render
  React.useEffect(() => {
    const canvas = canvasRef.current;
    const gl = glRef.current;
    const program = programRef.current;
    if (!canvas || !gl || !program) return;

    // Update canvas size for retina
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.round(cssWidth * dpr);
    const height = Math.round(cssHeight * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
    }

    gl.viewport(0, 0, width, height);
    gl.useProgram(program);

    // Set uniforms
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), width, height);
    gl.uniform1f(gl.getUniformLocation(program, 'u_min'), min);
    gl.uniform1f(gl.getUniformLocation(program, 'u_max'), max);
    gl.uniform1f(gl.getUniformLocation(program, 'u_saturation'), saturation);
    gl.uniform1f(gl.getUniformLocation(program, 'u_lightness'), lightness);
    gl.uniform1i(
      gl.getUniformLocation(program, 'u_axis'),
      axis === 'saturation' ? 0 : 1,
    );
    gl.uniform1i(
      gl.getUniformLocation(program, 'u_colorSpace'),
      colorSpace === 'oklch' ? 1 : 0,
    );

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }, [colorSpace, axis, saturation, lightness, min, max]);

  return (
    <canvas
      ref={canvasRef}
      className="block"
      style={{ width: `${cssWidth}px`, height: `${cssHeight}px` }}
    />
  );
};

export default ColorSpaceVisualization;
