import { createFileRoute, useNavigate } from '@tanstack/react-router';
import Color from 'colorjs.io';
import React from 'react';

import Card from 'src/components/Card';
import Sliders from 'src/components/Sliders';
import { namedColorsGenerator } from 'src/utils/thecolorapi';
import type { HSL, NamedColor } from 'src/utils/types';

type SearchParams = {
  colorspace?: 'hsl' | 'oklch';
  saturation?: number;
  lightness?: number;
};

export const Route = createFileRoute('/')({
  component: App,
  validateSearch: (search: Record<string, unknown>): SearchParams => {
    return {
      colorspace:
        search.colorspace === 'oklch'
          ? 'oklch'
          : search.colorspace === 'hsl'
            ? 'hsl'
            : undefined,
      saturation:
        typeof search.saturation === 'number'
          ? search.saturation
          : typeof search.saturation === 'string'
            ? parseFloat(search.saturation)
            : undefined,
      lightness:
        typeof search.lightness === 'number'
          ? search.lightness
          : typeof search.lightness === 'string'
            ? parseFloat(search.lightness)
            : undefined,
    };
  },
});

function App() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [colorSpace, setColorSpace] = React.useState<'hsl' | 'oklch'>(
    search.colorspace || 'hsl',
  );
  const [saturation, setSaturation] = React.useState(
    search.saturation ??
      (search.colorspace === 'oklch'
        ? 0.15
        : search.colorspace === 'hsl'
          ? 50
          : 100),
  );
  const [lightness, setLightness] = React.useState(
    search.lightness ??
      (search.colorspace === 'oklch'
        ? 0.76
        : search.colorspace === 'hsl'
          ? 50
          : 50),
  );

  const [namedColors, setNamedColors] = React.useState<NamedColor[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Update URL when values change
  React.useEffect(() => {
    navigate({
      to: '/',
      search: {
        colorspace: colorSpace,
        saturation,
        lightness,
      },
      replace: true,
    });
  }, [colorSpace, saturation, lightness, navigate]);

  const handleColorSpaceChange = (newColorSpace: 'hsl' | 'oklch') => {
    setColorSpace(newColorSpace);
    if (newColorSpace === 'oklch') {
      setSaturation(0.15);
      setLightness(0.76);
    } else {
      setSaturation(50);
      setLightness(50);
    }
  };

  React.useEffect(() => {
    const tempNamedColors: NamedColor[] = [];
    const controller = new AbortController();

    setLoading(true);

    let colors: HSL[];

    if (colorSpace === 'hsl') {
      colors = Array.from({ length: 360 }, (_, hue) => [
        hue,
        saturation,
        lightness,
      ]);
    } else {
      // OKLCH: lightness 0-1, chroma 0-0.37, hue 0-360
      colors = Array.from({ length: 360 }, (_, hue) => {
        const oklch = new Color('oklch', [lightness, saturation, hue]);
        const hsl = oklch.to('hsl').toGamut();

        const oklchClamped = hsl.to('oklch');

        if (
          Math.abs(oklchClamped.c - saturation) > 0.025 ||
          Math.abs(oklchClamped.l - lightness) > 0.2
        ) {
          return undefined;
        }

        return [Math.floor(hsl.h), Math.floor(hsl.s), Math.floor(hsl.l)] as HSL;
      }).filter((c): c is HSL => c !== undefined);
    }

    (async () => {
      for await (const namedColor of namedColorsGenerator(
        colors,
        controller.signal,
      )) {
        if (controller.signal.aborted) return;

        tempNamedColors.push(namedColor);
        setNamedColors([...tempNamedColors]);
      }

      if (controller.signal.aborted) return;
      setLoading(false);
    })();

    return () => {
      controller.abort();
      setNamedColors([]);
      setLoading(true);
    };
  }, [saturation, lightness, colorSpace]);

  return (
    <div className="px-4 py-5 lg:px-24 lg:py-16">
      <div className="mb-14 flex flex-wrap gap-x-10 gap-y-8">
        <fieldset aria-label="Color Space">
          <label className="mb-4 block border-b-1 border-b-black pb-1 font-medium">
            Color Space
          </label>

          <div className="space-y-2">
            {[
              {
                id: 'hsl',
                name: 'HSL',
                description: 'Standard HSL color space.',
              },
              {
                id: 'oklch',
                name: 'OKLCH',
                description:
                  'OKLCH is a perceptually uniform color space. This will generate more aesthetic yet limited palettes',
              },
            ].map((space) => (
              <div key={space.id} className="relative flex items-start">
                <div className="flex h-6 items-center">
                  <input
                    defaultChecked={space.id === colorSpace}
                    onChange={() =>
                      handleColorSpaceChange(space.id as 'hsl' | 'oklch')
                    }
                    id={space.id}
                    name="plan"
                    type="radio"
                    aria-describedby={`${space.id}-description`}
                    className="relative size-4 appearance-none rounded-full border border-gray-300 bg-white before:absolute before:inset-1 before:rounded-full before:bg-white not-checked:before:hidden checked:border-black checked:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:border-gray-300 disabled:bg-gray-100 disabled:before:bg-gray-400 forced-colors:appearance-auto forced-colors:before:hidden"
                  />
                </div>
                <div className="ml-3 text-sm/6">
                  <label htmlFor={space.id} className="font-medium text-black">
                    {space.name}

                    <p
                      id={`${space.id}-description`}
                      className="max-w-85 text-gray-500"
                    >
                      {space.description}
                    </p>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="flex">
          <Sliders
            colorSpace={colorSpace}
            saturation={saturation}
            lightness={lightness}
            onSaturationChange={setSaturation}
            onLightnessChange={setLightness}
          />
        </div>

        <div className="flex flex-col">
          <label className="mb-3 block border-b-1 border-b-black pb-1 font-medium">
            Share
          </label>

          <input
            type="text"
            readOnly
            value={`${window.location.origin}/?colorspace=${colorSpace}&saturation=${saturation}&lightness=${lightness}`}
            className="h-[42px] w-[350px] border border-black bg-white px-2 py-1 outline-none"
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
          />
        </div>
      </div>

      <div
        className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-[16px] lg:gap-[25px]"
        key={`${saturation}-${lightness}`}
      >
        {namedColors.map((namedColor) => (
          <Card key={namedColor.name} namedColor={namedColor} />
        ))}

        {namedColors.length === 0 && (
          <div className="col-span-full">
            {loading ? (
              <div className="inline-block animate-[fadeIn_0s_0.3s_forwards] bg-gray-500 px-2 py-1 text-white opacity-0">
                Loading colors...
              </div>
            ) : (
              <div className="inline-block bg-gray-900 px-2 py-1 text-white">
                No colors for this{' '}
                {colorSpace === 'oklch' ? 'chroma' : 'saturation'} and
                lightness.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
