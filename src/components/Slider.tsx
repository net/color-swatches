import React from 'react';

import ColorSpaceVisualization from './ColorSpaceVisualizationGL';

function Slider(props: {
  label: string;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  colorSpace?: 'hsl' | 'oklch';
  axis?: 'saturation' | 'lightness';
  saturation?: number;
  lightness?: number;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleInteraction = (clientX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));

    const min = props.min ?? 0;
    const max = props.max ?? 100;
    const step = props.step ?? 1;

    let newValue = min + percentage * (max - min);

    // Snap to step
    if (step) {
      newValue = Math.round(newValue / step) * step;
    }

    props.onChange(newValue);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleInteraction(e.clientX);

    const handleMouseMove = (e: MouseEvent) => {
      handleInteraction(e.clientX);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    handleInteraction(e.touches[0].clientX);

    const handleTouchMove = (e: TouchEvent) => {
      handleInteraction(e.touches[0].clientX);
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Calculate position for the indicator line
  const min = props.min ?? 0;
  const max = props.max ?? 100;
  const percentage = ((props.value - min) / (max - min)) * 100;

  // Determine decimal places based on step
  const getDecimalPlaces = () => {
    if (!props.step || props.step >= 1) return 0;
    const stepStr = props.step.toString();
    const decimalPart = stepStr.split('.')[1];
    return decimalPart ? decimalPart.length : 0;
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    if (!isNaN(newValue)) {
      const min = props.min ?? 0;
      const max = props.max ?? 100;
      const clampedValue = Math.max(min, Math.min(max, newValue));
      props.onChange(clampedValue);
    }
  };

  return (
    <div>
      <label className="mb-3 block border-b-1 border-b-black pb-1 font-medium">
        {props.label}
      </label>

      <div className="flex items-center gap-[10px]">
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          className="relative box-content w-[300px] cursor-pointer overflow-clip border border-black select-none"
        >
          {props.colorSpace &&
            props.axis &&
            props.saturation !== undefined &&
            props.lightness !== undefined && (
              <ColorSpaceVisualization
                colorSpace={props.colorSpace}
                axis={props.axis}
                saturation={props.saturation}
                lightness={props.lightness}
                min={props.min ?? 0}
                max={props.max ?? 100}
              />
            )}

          {/* Indicator line */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 -my-1 w-[6px] -translate-x-[3px] border border-black bg-white"
            style={{ left: `${percentage}%` }}
          />
        </div>

        <input
          type="number"
          value={props.value.toFixed(getDecimalPlaces())}
          onChange={handleNumberChange}
          min={props.min ?? 0}
          max={props.max ?? 100}
          step={props.step ?? 1}
          className="h-[42px] w-[62px] [appearance:textfield] border border-black px-2 py-1 outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    </div>
  );
}

export default Slider;
