'use client';

import { useEffect, useMemo } from 'react';
import { ModeToggle } from './ModeToggle';
import { ModelSelector } from './ModelSelector';
import { IterationSlider } from './IterationSlider';
import { CostEstimateDisplay } from './CostEstimateDisplay';
import { PresetSelector } from './PresetSelector';
import { OptionsToggle } from './OptionsToggle';
import { useProcessingOptions } from '@/hooks/useProcessingOptions';
import type { Issue, ProcessingOptions, Severity } from '@/lib/types';

interface ProcessingOptionsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIssues: Issue[];
  onStart: (options: ProcessingOptions) => void;
}

/**
 * Modal panel for configuring processing options before starting.
 * Includes presets, mode toggle, model selector, iteration slider, and toggles.
 */
export function ProcessingOptionsPanel({
  isOpen,
  onClose,
  selectedIssues,
  onStart,
}: ProcessingOptionsPanelProps) {
  const {
    options,
    updateOption,
    applyPreset,
    currentPresetId,
    presets,
    getCostEstimate,
    getValidationWarnings,
  } = useProcessingOptions();

  const issueCount = selectedIssues.length;
  const costEstimate = useMemo(
    () => getCostEstimate(issueCount),
    [getCostEstimate, issueCount]
  );
  const warnings = useMemo(
    () => getValidationWarnings(selectedIssues),
    [getValidationWarnings, selectedIssues]
  );

  // Determine suggested model based on issue severity
  const suggestedModel = useMemo(() => {
    const hasSecurityOrCritical = selectedIssues.some(
      (i) => i.severity === 'CRITICAL' || i.provider === 'zeropath'
    );
    return hasSecurityOrCritical ? 'opus' : 'sonnet';
  }, [selectedIssues]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Get severity distribution for display
  const severityDistribution = useMemo(() => {
    const dist: Partial<Record<Severity, number>> = {};
    selectedIssues.forEach((i) => {
      dist[i.severity] = (dist[i.severity] || 0) + 1;
    });
    return dist;
  }, [selectedIssues]);

  if (!isOpen) return null;

  const handleStart = () => {
    onStart(options);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div
          className="relative bg-[var(--background)] border border-[var(--border)] rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-[var(--background)] border-b border-[var(--border)] px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xl">⚙️</span>
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  Processing Options
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  {issueCount} issue{issueCount !== 1 ? 's' : ''} selected
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--card)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Issue summary */}
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <div className="text-sm text-[var(--muted)] mb-2">Selected Issues</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(severityDistribution).map(([severity, count]) => (
                  <span
                    key={severity}
                    className={`
                      px-2 py-1 rounded text-xs font-medium
                      ${severity === 'CRITICAL' ? 'bg-red-900/50 text-red-300' : ''}
                      ${severity === 'HIGH' ? 'bg-orange-900/50 text-orange-300' : ''}
                      ${severity === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-300' : ''}
                      ${severity === 'LOW' ? 'bg-green-900/50 text-green-300' : ''}
                      ${severity === 'INFO' ? 'bg-blue-900/50 text-blue-300' : ''}
                    `}
                  >
                    {count} {severity}
                  </span>
                ))}
              </div>
            </div>

            {/* Presets */}
            <PresetSelector
              presets={presets}
              selectedId={currentPresetId}
              onSelect={(preset) => applyPreset(preset.id)}
            />

            <hr className="border-[var(--border)]" />

            {/* Mode Toggle */}
            <ModeToggle
              mode={options.mode}
              onChange={(mode) => updateOption('mode', mode)}
            />

            {/* Model Selector */}
            <ModelSelector
              model={options.model}
              onChange={(model) => updateOption('model', model)}
              suggestedModel={suggestedModel}
            />

            {/* Iteration Slider */}
            <IterationSlider
              value={options.maxIterations}
              onChange={(value) => updateOption('maxIterations', value)}
            />

            <hr className="border-[var(--border)]" />

            {/* Options toggles */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Options
              </label>
              <OptionsToggle
                label="Auto-push commits"
                description="Automatically push commits to remote after each fix"
                checked={options.autoPush}
                onChange={(checked) => updateOption('autoPush', checked)}
              />
              <OptionsToggle
                label="CI/CD awareness"
                description="Monitor CI status after pushing"
                checked={options.ciAwareness}
                onChange={(checked) => {
                  updateOption('ciAwareness', checked);
                  // Disable auto-fix if CI awareness is disabled
                  if (!checked && options.autoFixCi) {
                    updateOption('autoFixCi', false);
                  }
                }}
              />
              <OptionsToggle
                label="Auto-fix CI failures"
                description="Automatically attempt to fix CI failures"
                checked={options.autoFixCi}
                onChange={(checked) => updateOption('autoFixCi', checked)}
                disabled={!options.ciAwareness}
                indent
              />
            </div>

            <hr className="border-[var(--border)]" />

            {/* Cost Estimate */}
            <CostEstimateDisplay estimate={costEstimate} issueCount={issueCount} />

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-500">⚠️</span>
                  <div className="space-y-1">
                    {warnings.map((warning, index) => (
                      <p key={index} className="text-sm text-yellow-300">
                        {warning}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[var(--background)] border-t border-[var(--border)] px-6 py-4 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--card)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleStart}
              className="px-6 py-2 rounded-lg bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] transition-colors flex items-center gap-2"
            >
              <span>🚀</span>
              Start Processing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
