'use client';

import { ProcessingMode } from '@/lib/types';

interface ModeToggleProps {
  mode: ProcessingMode;
  onModeChange: (mode: ProcessingMode) => void;
  disabled?: boolean;
}

/**
 * Toggle component for selecting Plan vs Build mode.
 * Plan mode: Analysis only, no code changes
 * Build mode: Implement the fix
 */
export function ModeToggle({ mode, onModeChange, disabled = false }: ModeToggleProps) {
  const modes: { value: ProcessingMode; label: string; icon: string; description: string }[] = [
    {
      value: 'plan',
      label: 'Plan',
      icon: '📋',
      description: 'Analyze and create implementation plan',
    },
    {
      value: 'build',
      label: 'Build',
      icon: '🔨',
      description: 'Implement the fix and commit changes',
    },
  ];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[var(--color-text-secondary)]">
        Processing Mode
      </label>
      <div className="grid grid-cols-2 gap-2">
        {modes.map(({ value, label, icon, description }) => (
          <button
            key={value}
            type="button"
            disabled={disabled}
            onClick={() => onModeChange(value)}
            className={`
              flex flex-col items-center p-4 rounded-lg border-2 transition-all
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--color-accent)]'}
              ${mode === value
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
              }
            `}
            aria-pressed={mode === value}
            aria-label={`${label} mode: ${description}`}
          >
            <span className="text-2xl mb-2" role="img" aria-hidden="true">
              {icon}
            </span>
            <span className="font-medium text-[var(--color-text-primary)]">
              {label}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)] text-center mt-1">
              {description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
