'use client';

import type { ModelType, ModelInfo } from '@/lib/types';
import { MODEL_INFO } from '@/lib/types';

interface ModelSelectorProps {
  model: ModelType;
  onChange: (model: ModelType) => void;
  suggestedModel?: ModelType;
  disabled?: boolean;
}

/**
 * Selector for choosing between Claude Sonnet and Opus models.
 * Shows cost and capability information for each model.
 */
export function ModelSelector({
  model,
  onChange,
  suggestedModel,
  disabled = false,
}: ModelSelectorProps) {
  const models: Array<{ type: ModelType; info: ModelInfo }> = [
    { type: 'sonnet', info: MODEL_INFO.sonnet },
    { type: 'opus', info: MODEL_INFO.opus },
  ];

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[var(--foreground)]">
        Model
      </label>
      <div className="grid grid-cols-2 gap-3">
        {models.map(({ type, info }) => (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type)}
            className={`
              relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${
                model === type
                  ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                  : 'border-[var(--border)] hover:border-[var(--muted)] bg-[var(--card)]'
              }
            `}
          >
            {model === type && (
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
            {suggestedModel === type && model !== type && (
              <span className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">
                Suggested
              </span>
            )}
            <span className="text-2xl mb-1">{info.icon}</span>
            <span className="font-medium text-[var(--foreground)]">{info.name}</span>
            <span className="text-xs text-[var(--muted)]">{info.description}</span>
            <span className="text-xs text-[var(--muted)] mt-1">
              ${info.costPer1kTokens}/1K tokens
            </span>
          </button>
        ))}
      </div>
      {/* Best for hints */}
      <div className="text-xs text-[var(--muted)] mt-2">
        <strong>{model === 'sonnet' ? 'Sonnet' : 'Opus'}</strong> is best for:{' '}
        {MODEL_INFO[model].bestFor.join(', ')}
      </div>
    </div>
  );
}
