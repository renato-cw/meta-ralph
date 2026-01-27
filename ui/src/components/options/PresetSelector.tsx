'use client';

import type { ProcessingPreset } from '@/lib/types';

interface PresetSelectorProps {
  presets: ProcessingPreset[];
  selectedId: string | null;
  onSelect: (preset: ProcessingPreset) => void;
  disabled?: boolean;
}

/**
 * Horizontal preset buttons for quick configuration selection.
 */
export function PresetSelector({
  presets,
  selectedId,
  onSelect,
  disabled = false,
}: PresetSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--foreground)]">
        Preset
      </label>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(preset)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-sm
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${
                selectedId === preset.id
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)]'
                  : 'border-[var(--border)] hover:border-[var(--muted)] text-[var(--muted)] hover:text-[var(--foreground)]'
              }
            `}
            title={preset.description}
          >
            <span>{preset.icon}</span>
            <span>{preset.name}</span>
          </button>
        ))}
        {/* Custom indicator when no preset matches */}
        {selectedId === null && (
          <button
            type="button"
            disabled
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--foreground)] text-sm"
          >
            <span>⚙️</span>
            <span>Custom</span>
          </button>
        )}
      </div>
    </div>
  );
}
