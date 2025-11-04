## Running

I also deployed this app at https://color-swatches-ekqe.onrender.com so you can try it without running locally.

```bash
npm install
npm run dev
```

## Stack

- [Vite](https://vitejs.dev/)
- [TanStack Router](https://tanstack.com/router)
- [Tailwind](https://tailwindcss.com/)
- [Color.js](https://colorjs.io/)

## Decisions

### thecolorapi.com API

I started by just fetching all 360 hues from thecolorapi.com in parallel, but pretty quickly hit rate limits. So I switched
to this naive algorithm:

1. Fetch every 10th hue (36 in total) in parallel
2. In parallel, for each of these hues, binary search backwards to find the edge(s) of the preceding named color block(s)
3. Yield named color blocks in order as we find them

This last part is important, as I wanted the colors to appear in sequence to the user, rather than having new colors pop in
in the middle of the ordering causing the grid to reshuffle.

I implemented this as a generator function that yields named colors as they're found in order,
and used an AbortController to cancel fetches when the user changes the hue slider to further avoid
unnecessary API calls.

I also added a very short 30ms debounce to the slider so we don't constantly fetch. I deliberately kept it
short because I wanted the interface to feel snappy, and the improved fetching algorithm seemed to fix the rate limit issues.

### HSL vs OKLCH

The RGB color space, of which standard HSL is a translation, is not perceptually uniform. This can
be trivially seen by looking at the difference in perceptual brightness between Electric Lime and Blue when the
[saturation slider is set to 100 and lightness to 50](https://color-swatches-ekqe.onrender.com/?colorspace=hsl&saturation=100&lightness=50).
This can make for some unaesthetic palettes when algorithmically picking colors.

The [CIELAB color space](https://en.wikipedia.org/wiki/CIELAB_color_space) is designed specifically to be perceptually
uniform. LCH—Lightness, Chroma, Hue—is a cylindrical HSL-like translation of CIELAB. LCH still [has some issues](https://atmos.style/blog/lch-vs-oklch)
which OKLCH attempts to fix.

I wanted to offer OKLCH as an option to generate more aesthetically pleasing palettes. I did
this by using Color.js to draw a line of colors through the OKLCH color space, then convert
them to HSL to be fetched from thecolorapi.com.

Note that many LCH colors cannot be represented on standard RGB screens, which is why the palettes generated
in OKLCH mode appear more limited. To compensate somewhat for this, I allowed for a slight deviation in chroma
and lightness when searching for colors in OKLCH mode.

### Saturation and Lightness Sliders

I wanted the saturation and lightness sliders to visually represent their values. This was especially important
for OKLCH mode so that the user can see the limits of the sRGB color gamut and how their chosen values affect
each other.

I first had Claude build a naive visualization using canvas. This was laggy, so I had Claude rewrite it using
WebGL shaders to run on the GPU. This required re-implementing the OKLCH color space conversions in GLSL, including
the CSS 4 gamut mapping algorithm to show my allowed deviations in chroma and lightness. The result was
extremely performant.

### Loading States

With the improved API fetching algorithm above, loading states were unnecessary for me. However, for users on
slower connections, I added a simple "Loading..." message that appears after 300ms of no results being available.

The ideal loading state is more complex than this, but since it was so fast for me I didn't want to spend much
time on that.

## LLM Usage

LLMs were used extensively, especially towards the end. There was no single one-shot prompt, I used many precise
instructions to get my desired result. (This README was written by hand.)
