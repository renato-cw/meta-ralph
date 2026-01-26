'use client';

import { useEffect, useCallback, useState } from 'react';
import { ProcessingOptions, Severity } from '@/lib/types';
import { UseProcessingOptionsReturn } from '@/hooks/useProcessingOptions';
import { ModeToggle } from './ModeToggle';
import { ModelSelector } from './ModelSelector';
import { IterationSlider } from './IterationSlider';
import { PresetGrid } from './PresetSelector';
import { CostEstimateDisplay } from './CostEstimateDisplay';

interface ProcessingOptionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onStartProcessing: (options: ProcessingOptions) => void;
  issueCount: number;
  issueSeverities?: Severity[];
  processingOptions: UseProcessingOptionsReturn;
}

/**
 * Modal panel for configuring processing options before starting.
 * Provides presets, mode selection, model selection, and iteration control.
 */
export function ProcessingOptionsPanel({
  isOpen,
  onClose,
  onStartProcessing,
  issueCount,
  issueSeverities = [],
  processingOptions,
}: ProcessingOptionsPanelProps) {
  const {
    options,
    presets,
    currentPresetId,
    isCustomConfiguration,
    selectPreset,
    setMode,
    setModel,
    setMaxIterations,
    setAutoPush,
    setCiAwareness,
    setAutoFixCi,
    estimateCost,
    suggestModel,
  } = processingOptions;

  // Track if we should show model suggestion
  const [showModelSuggestion, setShowModelSuggestion] = useState(false);

  // Calculate suggested model based on highest severity issue
  const highestSeverity = issueSeverities.length > 0
    ? issueSeverities.reduce((highest, current) => {
        const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };
        return order[current] < order[highest] ? current : highest;
      })
    : 'MEDIUM';
  const suggestedModel = suggestModel(highestSeverity as Severity);

  // Show suggestion if we have high-severity issues and user has sonnet selected
  useEffect(() => {
    const hasHighSeverity = issueSeverities.some(s => s === 'CRITICAL' || s === 'HIGH');
    setShowModelSuggestion(hasHighSeverity && options.model === 'sonnet');
  }, [issueSeverities, options.model]);

  // Calculate cost estimate
  const costEstimate = estimateCost(issueCount);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleStartProcessing = useCallback(() => {
    onStartProcessing(options);
  }, [onStartProcessing, options]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="processing-options-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <div>
            <h2
              id="processing-options-title"
              className="text-lg font-semibold text-[var(--color-text-primary)]"
            >
              Processing Options
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Configure how {issueCount} issue{issueCount > 1 ? 's' : ''} will be processed
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[var(--color-bg-secondary)] transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Presets */}
          <PresetGrid
            presets={presets}
            currentPresetId={currentPresetId}
            onSelectPreset={selectPreset}
          />

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-[var(--color-border)]" />
            <span className="text-xs text-[var(--color-text-secondary)]">or customize</span>
            <div className="flex-1 h-px bg-[var(--color-border)]" />
          </div>

          {/* Mode Toggle */}
          <ModeToggle
            mode={options.mode}
            onModeChange={setMode}
          />

          {/* Model Selector */}
          <div className="space-y-2">
            <ModelSelector
              model={options.model}
              onModelChange={setModel}
              suggestedModel={showModelSuggestion ? suggestedModel : undefined}
            />
            {showModelSuggestion && (
              <p className="text-xs text-blue-400 flex items-center gap-1">
                <span role="img" aria-label="tip">💡</span>
                Opus is recommended for {highestSeverity.toLowerCase()} severity issues.
              </p>
            )}
          </div>

          {/* Iteration Slider */}
          <IterationSlider
            value={options.maxIterations}
            onChange={setMaxIterations}
          />

          {/* Options Checkboxes */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              Additional Options
            </label>

            {/* Auto-push */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={options.autoPush}
                onChange={(e) => setAutoPush(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] focus:ring-offset-0"
              />
              <div>
                <span className="text-sm text-[var(--color-text-primary)]">
                  Auto-push after commit
                </span>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Automatically push changes to remote after successful commits
                </p>
              </div>
            </label>

            {/* CI Awareness */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={options.ciAwareness}
                onChange={(e) => setCiAwareness(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] focus:ring-offset-0"
              />
              <div>
                <span className="text-sm text-[var(--color-text-primary)]">
                  CI/CD Awareness
                </span>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Monitor CI status and show build results
                </p>
              </div>
            </label>

            {/* Auto-fix CI (nested under CI Awareness) */}
            {options.ciAwareness && (
              <label className="flex items-center gap-3 cursor-pointer ml-7">
                <input
                  type="checkbox"
                  checked={options.autoFixCi}
                  onChange={(e) => setAutoFixCi(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-accent)] focus:ring-[var(--color-accent)] focus:ring-offset-0"
                />
                <div>
                  <span className="text-sm text-[var(--color-text-primary)]">
                    Auto-fix CI failures
                  </span>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Automatically attempt to fix CI failures
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Cost Estimate */}
          <CostEstimateDisplay
            estimate={costEstimate}
            issueCount={issueCount}
            model={options.model}
          />

          {/* Current Configuration Summary */}
          {isCustomConfiguration && (
            <div className="p-3 rounded-lg bg-[var(--color-bg-tertiary)] text-xs text-[var(--color-text-secondary)]">
              <strong>Current:</strong>{' '}
              {options.mode === 'plan' ? '📋' : '🔨'} {options.mode.charAt(0).toUpperCase() + options.mode.slice(1)} |{' '}
              {options.model === 'sonnet' ? '⚡' : '🧠'} {options.model.charAt(0).toUpperCase() + options.model.slice(1)} |{' '}
              {options.maxIterations} iter |{' '}
              Auto-push {options.autoPush ? '✓' : '✗'}
              {options.ciAwareness && ' | CI aware'}
              {options.autoFixCi && ' | Auto-fix CI'}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-between gap-4 p-4 border-t border-[var(--color-border)] bg-[var(--color-bg-primary)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStartProcessing}
            disabled={issueCount === 0}
            className={`
              px-6 py-2 rounded-lg font-medium text-sm transition-colors
              ${issueCount === 0
                ? 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] cursor-not-allowed'
                : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
              }
            `}
          >
            Start Processing ({issueCount} issue{issueCount > 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact summary of current processing options.
 * Can be used inline when options panel is not open.
 */
export function ProcessingOptionsSummary({
  options,
  onClick,
}: {
  options: ProcessingOptions;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
    >
      <span>{options.mode === 'plan' ? '📋' : '🔨'}</span>
      <span className="capitalize">{options.mode}</span>
      <span className="text-[var(--color-text-secondary)]">+</span>
      <span>{options.model === 'sonnet' ? '⚡' : '🧠'}</span>
      <span className="capitalize">{options.model}</span>
      <span className="text-[var(--color-text-secondary)]">|</span>
      <span>{options.maxIterations} iter</span>
      {options.autoPush && <span className="text-green-400">✓</span>}
      <span className="text-[var(--color-text-secondary)] ml-1">[Change]</span>
    </button>
  );
}
