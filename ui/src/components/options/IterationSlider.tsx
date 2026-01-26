'use client';

interface IterationSliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

/**
 * Slider component for selecting the maximum number of iterations.
 * Range: 1-20 iterations.
 */
export function IterationSlider({
  value,
  onChange,
  min = 1,
  max = 20,
  disabled = false,
}: IterationSliderProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(e.target.value, 10));
  };

  // Calculate percentage for gradient styling
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label
          htmlFor="iterations-slider"
          className="text-sm font-medium text-[var(--color-text-secondary)]"
        >
          Max Iterations
        </label>
        <span className="text-sm font-mono font-semibold text-[var(--color-text-primary)] bg-[var(--color-bg-tertiary)] px-2 py-1 rounded">
          {value}
        </span>
      </div>
      <input
        id="iterations-slider"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        className={`
          w-full h-2 rounded-lg appearance-none cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        style={{
          background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${percentage}%, var(--color-bg-tertiary) ${percentage}%, var(--color-bg-tertiary) 100%)`,
        }}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={`${value} iterations`}
      />
      <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
        <span>{min} (quick)</span>
        <span>{max} (thorough)</span>
      </div>
    </div>
  );
}
