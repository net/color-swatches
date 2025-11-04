export type HSL = [number, number, number];
export type RGB = [number, number, number];

export type Color = {
  hsl: HSL;
  rgb: RGB;
  hex: string;
};

export type NamedColor = {
  name: string;
  color: Color;
};
