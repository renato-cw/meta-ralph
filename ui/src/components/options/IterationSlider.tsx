'use client';

interface IterationSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

/**
 * Slider for configuring maximum iterations for the fix loop.
 */
export function IterationSlider({
  value,
  onChange,
  min = 1,
  max = 20,
  disabled = false,
}: IterationSliderProps) {
  const getIterationHint = (iterations: number): string => {
    if (iterations <= 3) return 'Quick analysis';
    if (iterations <= 5) return 'Simple fixes';
    if (iterations <= 10) return 'Standard fixes';
    if (iterations <= 15) return 'Complex issues';
    return 'Thorough debugging';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-[var(--foreground)]">
          Max Iterations
        </label>
        <span className="text-sm font-mono bg-[var(--card)] px-2 py-0.5 rounded border border-[var(--border)]">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        disabled={disabled}
        className={`
          w-full h-2 rounded-lg appearance-none cursor-pointer
          bg-[var(--border)]
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-4
          [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-[var(--primary)]
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-white
          [&::-webkit-slider-thumb]:shadow-md
          [&::-moz-range-thumb]:w-4
          [&::-moz-range-thumb]:h-4
          [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-[var(--primary)]
          [&::-moz-range-thumb]:cursor-pointer
          [&::-moz-range-thumb]:border-2
          [&::-moz-range-thumb]:border-white
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      />
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>{min}</span>
        <span className="text-[var(--foreground)]">{getIterationHint(value)}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
