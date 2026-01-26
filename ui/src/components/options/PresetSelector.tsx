'use client';

import { ProcessingPreset } from '@/lib/types';

interface PresetSelectorProps {
  presets: ProcessingPreset[];
  currentPresetId: string | null;
  isCustomConfiguration: boolean;
  onSelectPreset: (presetId: string) => void;
  disabled?: boolean;
}

/**
 * Dropdown selector for processing presets.
 * Shows built-in presets and custom saved configurations.
 */
export function PresetSelector({
  presets,
  currentPresetId,
  isCustomConfiguration,
  onSelectPreset,
  disabled = false,
}: PresetSelectorProps) {
  const builtInPresets = presets.filter(p => !p.isCustom);
  const customPresets = presets.filter(p => p.isCustom);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value && value !== 'custom') {
      onSelectPreset(value);
    }
  };

  return (
    <div className="space-y-2">
      <label
        htmlFor="preset-selector"
        className="text-sm font-medium text-[var(--color-text-secondary)]"
      >
        Quick Presets
      </label>
      <select
        id="preset-selector"
        value={isCustomConfiguration ? 'custom' : currentPresetId || ''}
        onChange={handleChange}
        disabled={disabled}
        className={`
          w-full px-3 py-2 rounded-lg border transition-colors
          bg-[var(--color-bg-secondary)] border-[var(--color-border)]
          text-[var(--color-text-primary)]
          focus:outline-none focus:border-[var(--color-accent)]
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <optgroup label="Built-in Presets">
          {builtInPresets.map(preset => (
            <option key={preset.id} value={preset.id}>
              {preset.icon} {preset.name} - {preset.description}
            </option>
          ))}
        </optgroup>
        {customPresets.length > 0 && (
          <optgroup label="Custom Presets">
            {customPresets.map(preset => (
              <option key={preset.id} value={preset.id}>
                {preset.icon} {preset.name}
              </option>
            ))}
          </optgroup>
        )}
        {isCustomConfiguration && (
          <option value="custom" disabled>
            ⚙️ Custom Configuration
          </option>
        )}
      </select>
      {isCustomConfiguration && (
        <p className="text-xs text-[var(--color-text-secondary)]">
          Current settings don&apos;t match any preset
        </p>
      )}
    </div>
  );
}

/**
 * Grid-based preset selector for larger screens.
 */
export function PresetGrid({
  presets,
  currentPresetId,
  onSelectPreset,
  disabled = false,
}: Omit<PresetSelectorProps, 'isCustomConfiguration'>) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[var(--color-text-secondary)]">
        Quick Presets
      </label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {presets.filter(p => !p.isCustom).map(preset => (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPreset(preset.id)}
            className={`
              flex flex-col items-center p-3 rounded-lg border transition-all
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--color-accent)]'}
              ${currentPresetId === preset.id
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
              }
            `}
            aria-pressed={currentPresetId === preset.id}
          >
            <span className="text-xl mb-1" role="img" aria-hidden="true">
              {preset.icon}
            </span>
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {preset.name}
            </span>
            <span className="text-xs text-[var(--color-text-secondary)] text-center">
              {preset.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
