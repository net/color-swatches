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
    const sampleIndices: number[] = [];
    for (let i = 0; i < colors.length; i += JUMP) {
      sampleIndices.push(i);
    }
    // Include last index to catch trailing colors
    if (sampleIndices[sampleIndices.length - 1] !== colors.length - 1) {
      sampleIndices.push(colors.length - 1);
    }
    const sampleNames = await Promise.all(
      sampleIndices.map((i) => fetchColorName(colors[i])),
    );

    if (signal?.aborted) return;

    // Cache sampled indices to avoid duplicate API calls
    const indexNameCache = new Map<number, Promise<string>>();
    for (let i = 0; i < sampleIndices.length; i++) {
      indexNameCache.set(sampleIndices[i], Promise.resolve(sampleNames[i]));
    }
    const getName = (i: number) => {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      let p = indexNameCache.get(i);
      if (!p) {
        p = fetchColorName(colors[i]);
        indexNameCache.set(i, p);
      }
      return p;
    };

    // Phase 2: Binary search windows in parallel to find all boundaries
    const windowPromises: Promise<Array<{ index: number; name: string }>>[] = [];

    for (let i = 0; i < sampleIndices.length - 1; i++) {
      const startIndex = sampleIndices[i];
      const endIndex = sampleIndices[i + 1];
      const startName = sampleNames[i];
      const endName = sampleNames[i + 1];

      if (startName !== endName) {
        windowPromises.push(
          findBoundariesInRange(
            startIndex,
            endIndex,
            startName,
            endName,
            getName,
            signal,
          ),
        );
      } else {
        windowPromises.push(Promise.resolve([]));
      }
    }

    // Phase 3: Yield in order as scans complete
    // Window scans run in parallel, but we emit results sequentially to maintain order
    const emittedNames = new Set<string>();

    const emit = (index: number, name: string) => {
      if (emittedNames.has(name)) return;
      emittedNames.add(name);

      const hsl = colors[index];
      const color = new Color('hsl', [hsl[0], hsl[1], hsl[2]]);
      const rgb = color.to('srgb');

      return {
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
    };

    // Emit first color
    const first = emit(0, sampleNames[0]);
    if (first) yield first;

    // Emit boundaries from each window in order
    for (const windowPromise of windowPromises) {
      if (signal?.aborted) return;
      const boundaries = await windowPromise;
      for (const boundary of boundaries) {
        const result = emit(boundary.index, boundary.name);
        if (result) yield result;
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }
    throw error;
  }
}

async function findBoundariesInRange(
  startIndex: number,
  endIndex: number,
  startName: string,
  endName: string,
  getName: (i: number) => Promise<string>,
  signal?: AbortSignal,
): Promise<Array<{ index: number; name: string }>> {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // Safety: no boundary if endpoints equal
  if (startIndex >= endIndex || startName === endName) return [];

  // Base: adjacent indices => boundary is at endIndex with endName
  if (endIndex - startIndex === 1) {
    return [{ index: endIndex, name: endName }];
  }

  const mid = Math.floor((startIndex + endIndex) / 2);
  const midName = await getName(mid);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  if (midName === startName) {
    // Entire change is in the right half [mid, endIndex]
    return findBoundariesInRange(mid, endIndex, midName, endName, getName, signal);
  }
  if (midName === endName) {
    // Entire change is in the left half [startIndex, mid]
    return findBoundariesInRange(startIndex, mid, startName, midName, getName, signal);
  }

  // mid differs from both ends -> there are boundaries on both sides
  const left = await findBoundariesInRange(
    startIndex,
    mid,
    startName,
    midName,
    getName,
    signal,
  );
  const right = await findBoundariesInRange(
    mid,
    endIndex,
    midName,
    endName,
    getName,
    signal,
  );
  // left indices < right indices by construction
  return left.concat(right);
}
