import React from 'react';

import { debounce } from 'src/utils/functions';

import Slider from './Slider';

function Sliders(props: {
  colorSpace: 'hsl' | 'oklch';
  saturation: number;
  lightness: number;
  onSaturationChange: (value: number) => void;
  onLightnessChange: (value: number) => void;
}) {
  const [saturation, setSaturation] = React.useState(props.saturation);
  const [lightness, setLightness] = React.useState(props.lightness);

  React.useEffect(() => {
    setSaturation(props.saturation);
  }, [props.saturation]);

  React.useEffect(() => {
    setLightness(props.lightness);
  }, [props.lightness]);

  const debouncedSaturationChange = React.useMemo(
    () => debounce(props.onSaturationChange, 30),
    [props.onSaturationChange],
  );

  const debouncedLightnessChange = React.useMemo(
    () => debounce(props.onLightnessChange, 30),
    [props.onLightnessChange],
  );

  const handleSaturationChange = (value: number) => {
    setSaturation(value);
    debouncedSaturationChange(value);
  };

  const handleLightnessChange = (value: number) => {
    setLightness(value);
    debouncedLightnessChange(value);
  };

  return (
    <div>
      <div className="mb-4">
        <Slider
          label={props.colorSpace === 'hsl' ? 'Saturation' : 'Chroma'}
          onChange={handleSaturationChange}
          min={0}
          max={props.colorSpace === 'hsl' ? 100 : 0.37}
          step={props.colorSpace === 'hsl' ? 1 : 0.001}
          value={saturation}
          colorSpace={props.colorSpace}
          axis="saturation"
          saturation={saturation}
          lightness={lightness}
        />
      </div>

      <Slider
        label="Lightness"
        onChange={handleLightnessChange}
        min={0}
        max={props.colorSpace === 'hsl' ? 100 : 1}
        step={props.colorSpace === 'hsl' ? 1 : 0.01}
        value={lightness}
        colorSpace={props.colorSpace}
        axis="lightness"
        saturation={saturation}
        lightness={lightness}
      />
    </div>
  );
}

export default Sliders;
