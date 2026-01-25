'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  value: [number, number];
  onChange: (value: [number, number]) => void;
  step?: number;
  className?: string;
}

/**
 * Dual-handle range slider for numeric ranges.
 */
export function RangeSlider({
  min,
  max,
  value,
  onChange,
  step = 1,
  className = '',
}: RangeSliderProps) {
  const [localValue, setLocalValue] = useState(value);
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Sync local value with prop
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const getPercentage = (val: number) => ((val - min) / (max - min)) * 100;

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const rawValue = min + percentage * (max - min);
      return Math.round(rawValue / step) * step;
    },
    [min, max, step]
  );

  const handleMouseDown = (handle: 'min' | 'max') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(handle);
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const newValue = getValueFromPosition(e.clientX);
      setLocalValue((prev) => {
        if (isDragging === 'min') {
          return [Math.min(newValue, prev[1] - step), prev[1]];
        } else {
          return [prev[0], Math.max(newValue, prev[0] + step)];
        }
      });
    },
    [isDragging, getValueFromPosition, step]
  );

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      onChange(localValue);
    }
    setIsDragging(null);
  }, [isDragging, localValue, onChange]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleMinInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= min && val < localValue[1]) {
      const newValue: [number, number] = [val, localValue[1]];
      setLocalValue(newValue);
      onChange(newValue);
    }
  };

  const handleMaxInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val <= max && val > localValue[0]) {
      const newValue: [number, number] = [localValue[0], val];
      setLocalValue(newValue);
      onChange(newValue);
    }
  };

  const minPercent = getPercentage(localValue[0]);
  const maxPercent = getPercentage(localValue[1]);

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Slider track */}
      <div ref={trackRef} className="relative h-2 bg-[var(--border)] rounded-full">
        {/* Active range */}
        <div
          className="absolute h-full bg-[var(--primary)] rounded-full"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />

        {/* Min handle */}
        <button
          type="button"
          onMouseDown={handleMouseDown('min')}
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[var(--primary)] rounded-full cursor-grab shadow-sm transition-transform hover:scale-110 ${
            isDragging === 'min' ? 'cursor-grabbing scale-110' : ''
          }`}
          style={{ left: `calc(${minPercent}% - 8px)` }}
          aria-label="Minimum value"
        />

        {/* Max handle */}
        <button
          type="button"
          onMouseDown={handleMouseDown('max')}
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[var(--primary)] rounded-full cursor-grab shadow-sm transition-transform hover:scale-110 ${
            isDragging === 'max' ? 'cursor-grabbing scale-110' : ''
          }`}
          style={{ left: `calc(${maxPercent}% - 8px)` }}
          aria-label="Maximum value"
        />
      </div>

      {/* Number inputs */}
      <div className="flex items-center gap-2 text-xs">
        <input
          type="number"
          value={localValue[0]}
          onChange={handleMinInput}
          min={min}
          max={localValue[1] - step}
          step={step}
          className="w-16 px-2 py-1 text-center border border-[var(--border)] rounded bg-[var(--background)] focus:border-[var(--primary)] focus:outline-none"
        />
        <span className="text-[var(--muted)]">to</span>
        <input
          type="number"
          value={localValue[1]}
          onChange={handleMaxInput}
          min={localValue[0] + step}
          max={max}
          step={step}
          className="w-16 px-2 py-1 text-center border border-[var(--border)] rounded bg-[var(--background)] focus:border-[var(--primary)] focus:outline-none"
        />
      </div>
    </div>
  );
}
