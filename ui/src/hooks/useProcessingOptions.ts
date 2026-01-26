'use client';

import { useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type {
  ProcessingOptions,
  ProcessingPreset,
  CostEstimate,
  Issue,
} from '@/lib/types';
import {
  DEFAULT_PROCESSING_OPTIONS,
  DEFAULT_PRESETS,
  estimateCost,
  MODEL_INFO,
} from '@/lib/types';

/**
 * Options for the useProcessingOptions hook.
 */
export interface UseProcessingOptionsOptions {
  /** Default options to use if none are saved */
  defaultOptions?: ProcessingOptions;
  /** localStorage key for persisting options */
  storageKey?: string;
}

/**
 * Return type for the useProcessingOptions hook.
 */
export interface UseProcessingOptionsReturn {
  /** Current processing options */
  options: ProcessingOptions;
  /** Update all options at once */
  setOptions: (options: ProcessingOptions) => void;
  /** Update a single option */
  updateOption: <K extends keyof ProcessingOptions>(
    key: K,
    value: ProcessingOptions[K]
  ) => void;
  /** Reset to default options */
  resetOptions: () => void;
  /** Apply a preset */
  applyPreset: (presetId: string) => void;
  /** Get the currently matching preset ID (or null if custom) */
  currentPresetId: string | null;
  /** Available presets */
  presets: ProcessingPreset[];
  /** Estimate cost for given issues */
  getCostEstimate: (issueCount: number) => CostEstimate;
  /** Get validation warnings for current options and selected issues */
  getValidationWarnings: (selectedIssues: Issue[]) => string[];
  /** Model information for UI display */
  modelInfo: typeof MODEL_INFO;
}

/**
 * Hook for managing processing options with localStorage persistence.
 * Handles presets, validation, and cost estimation.
 */
export function useProcessingOptions(
  hookOptions: UseProcessingOptionsOptions = {}
): UseProcessingOptionsReturn {
  const {
    defaultOptions = DEFAULT_PROCESSING_OPTIONS,
    storageKey = 'meta-ralph-processing-options',
  } = hookOptions;

  const [options, setOptionsStorage] = useLocalStorage<ProcessingOptions>(
    storageKey,
    defaultOptions
  );

  /**
   * Update all options at once.
   */
  const setOptions = useCallback(
    (newOptions: ProcessingOptions) => {
      setOptionsStorage(newOptions);
    },
    [setOptionsStorage]
  );

  /**
   * Update a single option.
   */
  const updateOption = useCallback(
    <K extends keyof ProcessingOptions>(key: K, value: ProcessingOptions[K]) => {
      setOptionsStorage((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    [setOptionsStorage]
  );

  /**
   * Reset to default options.
   */
  const resetOptions = useCallback(() => {
    setOptionsStorage(defaultOptions);
  }, [setOptionsStorage, defaultOptions]);

  /**
   * Apply a preset by ID.
   */
  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = DEFAULT_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        setOptionsStorage(preset.options);
      }
    },
    [setOptionsStorage]
  );

  /**
   * Determine if current options match a preset.
   */
  const currentPresetId = useMemo(() => {
    for (const preset of DEFAULT_PRESETS) {
      const { options: presetOptions } = preset;
      if (
        options.mode === presetOptions.mode &&
        options.model === presetOptions.model &&
        options.maxIterations === presetOptions.maxIterations &&
        options.autoPush === presetOptions.autoPush &&
        options.ciAwareness === presetOptions.ciAwareness &&
        options.autoFixCi === presetOptions.autoFixCi
      ) {
        return preset.id;
      }
    }
    return null;
  }, [options]);

  /**
   * Calculate cost estimate for given number of issues.
   */
  const getCostEstimate = useCallback(
    (issueCount: number): CostEstimate => {
      return estimateCost(options, issueCount);
    },
    [options]
  );

  /**
   * Get validation warnings based on current options and selected issues.
   */
  const getValidationWarnings = useCallback(
    (selectedIssues: Issue[]): string[] => {
      const warnings: string[] = [];
      const issueCount = selectedIssues.length;

      // Warning: Using Opus on many issues
      if (options.model === 'opus' && issueCount > 5) {
        const estimate = estimateCost(options, issueCount);
        warnings.push(
          `Using Opus for ${issueCount} issues may cost ~$${estimate.average.toFixed(2)}`
        );
      }

      // Warning: Using Opus on simple issues (LOW/INFO severity)
      if (options.model === 'opus') {
        const simpleIssues = selectedIssues.filter(
          (i) => i.severity === 'LOW' || i.severity === 'INFO'
        );
        if (simpleIssues.length > 0) {
          warnings.push(
            `${simpleIssues.length} issue(s) are LOW/INFO severity - Sonnet may be sufficient`
          );
        }
      }

      // Warning: High iteration count with many issues
      if (options.maxIterations > 10 && issueCount > 3) {
        warnings.push(
          `High iteration count (${options.maxIterations}) with ${issueCount} issues may take a long time`
        );
      }

      // Warning: Auto-fix CI enabled without CI awareness
      if (options.autoFixCi && !options.ciAwareness) {
        warnings.push('Auto-fix CI requires CI awareness to be enabled');
      }

      // Warning: Processing many issues
      if (issueCount > 10) {
        warnings.push(
          `Processing ${issueCount} issues at once - consider smaller batches`
        );
      }

      return warnings;
    },
    [options]
  );

  return {
    options,
    setOptions,
    updateOption,
    resetOptions,
    applyPreset,
    currentPresetId,
    presets: DEFAULT_PRESETS,
    getCostEstimate,
    getValidationWarnings,
    modelInfo: MODEL_INFO,
  };
}
