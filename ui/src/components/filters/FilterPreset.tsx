'use client';

interface FilterPresetProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

/**
 * Quick filter preset button.
 */
export function FilterPreset({ label, isActive, onClick, className = '' }: FilterPresetProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${className} ${
        isActive
          ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
          : 'border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
      }`}
    >
      {label}
    </button>
  );
}
