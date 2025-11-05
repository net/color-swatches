import Color from 'colorjs.io';

import type { HSL, NamedColor } from 'src/utils/types';

const colorNames: Record<string, Promise<string>> = {};

export function fetchColorName(hsl: HSL): Promise<string> {
  const key = hsl.join(',');

  if (!colorNames[key]) {
    colorNames[key] = (async () => {
      const response = await fetch(
        `https://www.thecolorapi.com/id?format=json&hsl=${hsl[0]},${hsl[1]},${hsl[2]}`,
      );
      const data = await response.json();
      return data.name.value;
    })();
  }

  return colorNames[key];
}

export async function* namedColorsGenerator(
  colors: HSL[],
  signal?: AbortSignal,
) {
  if (colors.length === 0) {
    return;
  }

  try {
    const JUMP = 10;

    // Phase 1: Fetch samples in parallel
    const sampleIndices = Array.from(
      { length: Math.floor(colors.length / JUMP) },
      (_, i) => i * JUMP,
    );
    const sampleNames = await Promise.all(
      sampleIndices.map((i) => fetchColorName(colors[i])),
    );

    if (signal?.aborted) return;

    // Phase 2: Identify boundaries and launch binary searches in parallel
    const colorPromises: Promise<{ index: number; name: string }>[] = [];

    // First color is always at index 0
    colorPromises.push(Promise.resolve({ index: 0, name: sampleNames[0] }));

    for (let i = 0; i < sampleIndices.length - 1; i++) {
      const currentName = sampleNames[i];
      const nextName = sampleNames[i + 1];

      // Boundary detected: binary search for exact first index of next color
      if (currentName !== nextName) {
        colorPromises.push(
          binarySearchBoundary(
            sampleIndices[i],
            sampleIndices[i + 1],
            currentName,
            colors,
            signal,
          ).then(async (index) => ({
            index,
            name: await fetchColorName(colors[index]),
          })),
        );
      }
    }

    // Phase 3: Yield in order as searches complete
    // Binary searches run in parallel, but we await them sequentially to maintain order
    const emittedNames = new Set<string>();
    for (const promise of colorPromises) {
      if (signal?.aborted) return;
      const { index, name } = await promise;
      if (emittedNames.has(name)) continue;
      emittedNames.add(name);

      const hsl = colors[index];
      const color = new Color('hsl', [hsl[0], hsl[1], hsl[2]]);
      const rgb = color.to('srgb');

      yield {
        name,
        color: {
          hsl,
          rgb: [
            Math.round(rgb.r * 255),
            Math.round(rgb.g * 255),
            Math.round(rgb.b * 255),
          ],
          hex: color.to('srgb').toString({ format: 'hex' }),
        },
      } as NamedColor;
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    throw error;
  }
}

async function binarySearchBoundary(
  startIndex: number,
  endIndex: number,
  startName: string,
  colors: HSL[],
  signal?: AbortSignal,
): Promise<number> {
  let left = startIndex + 1;
  let right = endIndex;

  while (left < right) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const mid = Math.floor((left + right) / 2);
    const name = await fetchColorName(colors[mid]);

    if (name === startName) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}
