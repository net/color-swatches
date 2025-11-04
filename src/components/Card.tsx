import Color from 'colorjs.io';
import React from 'react';

import type { NamedColor } from 'src/utils/types';

const whiteColor = new Color('white');
const blackColor = new Color('black');

function Card(props: { namedColor: NamedColor }) {
  const { namedColor } = props;

  const contrastColor = React.useMemo(() => {
    const bg = new Color('hsl', namedColor.color.hsl);
    const whiteContrast = Math.abs(bg.contrast(whiteColor, 'APCA'));
    const blackContrast = Math.abs(bg.contrast(blackColor, 'APCA'));
    return whiteContrast > blackContrast ? 'white' : 'black';
  }, [namedColor]);

  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(namedColor.color.hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group aspect-square" style={{ color: contrastColor }}>
      <div
        className="relative flex h-full flex-col p-2"
        style={{
          backgroundColor: `hsl(${namedColor.color.hsl[0]}, ${namedColor.color.hsl[1]}%, ${namedColor.color.hsl[2]}%)`,
        }}
      >
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 border bg-transparent px-2 py-1.5 text-xs leading-none font-bold uppercase opacity-100 hover-capable:opacity-0 hover-capable:group-hover:opacity-100"
          style={{
            borderColor: contrastColor,
            color: contrastColor,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = contrastColor;
            e.currentTarget.style.color =
              contrastColor === 'white' ? 'black' : 'white';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = contrastColor;
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>

        <div className="-mb-[3px] text-xs/snug font-medium">
          <div>
            <span className="inline-block w-[10px]">R</span>{' '}
            {namedColor.color.rgb[0]}
          </div>
          <div>
            <span className="inline-block w-[10px]">G</span>{' '}
            {namedColor.color.rgb[1]}
          </div>
          <div>
            <span className="inline-block w-[10px]">B</span>{' '}
            {namedColor.color.rgb[2]}
          </div>
        </div>

        <div className="grow"></div>

        <div className="-mb-[3px] text-sm/snug font-extrabold tracking-wide uppercase">
          {namedColor.name}
        </div>
      </div>
    </div>
  );
}

export default Card;
