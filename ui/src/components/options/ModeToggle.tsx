'use client';

import type { ProcessingMode } from '@/lib/types';

interface ModeToggleProps {
  mode: ProcessingMode;
  onChange: (mode: ProcessingMode) => void;
  disabled?: boolean;
}

/**
 * Toggle between Plan and Build processing modes.
 * Plan mode analyzes without implementing, Build mode implements fixes.
 */
export function ModeToggle({ mode, onChange, disabled = false }: ModeToggleProps) {
  const modes: Array<{
    value: ProcessingMode;
    label: string;
    description: string;
    icon: string;
  }> = [
    {
      value: 'plan',
      label: 'Plan',
      description: 'Analyze only',
      icon: '📋',
    },
    {
      value: 'build',
      label: 'Build',
      description: 'Implement fix',
      icon: '🔨',
    },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--foreground)]">
        Mode
      </label>
      <div className="grid grid-cols-2 gap-3">
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m.value)}
            className={`
              relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${
                mode === m.value
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                  : 'border-[var(--border)] hover:border-[var(--muted)] bg-[var(--card)]'
              }
            `}
          >
            {mode === m.value && (
              <span className="absolute top-2 right-2 text-[var(--primary)]">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            )}
            <span className="text-2xl mb-1">{m.icon}</span>
            <span className="font-medium text-[var(--foreground)]">{m.label}</span>
            <span className="text-xs text-[var(--muted)]">{m.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
