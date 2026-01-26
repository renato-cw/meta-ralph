'use client';

import { ProcessingModel, MODEL_INFO } from '@/lib/types';

interface ModelSelectorProps {
  model: ProcessingModel;
  onModelChange: (model: ProcessingModel) => void;
  suggestedModel?: ProcessingModel;
  disabled?: boolean;
}

/**
 * Selector component for choosing between Sonnet and Opus models.
 * Shows cost, speed, and capability information for each model.
 */
export function ModelSelector({
  model,
  onModelChange,
  suggestedModel,
  disabled = false,
}: ModelSelectorProps) {
  const models: ProcessingModel[] = ['sonnet', 'opus'];

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-[var(--color-text-secondary)]">
        Claude Model
      </label>
      <div className="grid grid-cols-2 gap-2">
        {models.map(modelKey => {
          const info = MODEL_INFO[modelKey];
          const isSelected = model === modelKey;
          const isRecommended = suggestedModel === modelKey;

          return (
            <button
              key={modelKey}
              type="button"
              disabled={disabled}
              onClick={() => onModelChange(modelKey)}
              className={`
                relative flex flex-col p-4 rounded-lg border-2 transition-all text-left
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--color-accent)]'}
                ${isSelected
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10'
                  : 'border-[var(--color-border)] bg-[var(--color-bg-secondary)]'
                }
              `}
              aria-pressed={isSelected}
              aria-label={`${info.name}: ${info.description}`}
            >
              {isRecommended && (
                <span className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-medium bg-green-600 text-white rounded-full">
                  Recommended
                </span>
              )}
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-[var(--color-text-primary)]">
                  {info.name}
                </span>
                <span className="text-lg" role="img" aria-hidden="true">
                  {info.speed === 'fast' ? '⚡' : '🐢'}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                {info.description}
              </p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--color-text-secondary)]">
                  Cost: ${info.costPer1kTokens.toFixed(3)}/1K tokens
                </span>
                <span className={info.capability === 'advanced' ? 'text-purple-400' : 'text-blue-400'}>
                  {info.capability === 'advanced' ? '🧠🧠🧠' : '🧠'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
