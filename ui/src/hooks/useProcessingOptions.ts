'use client';

import { useState, useCallback, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import {
  ProcessingOptions,
  ProcessingPreset,
  ProcessingMode,
  ProcessingModel,
  CostEstimate,
  DEFAULT_PROCESSING_OPTIONS,
  PROCESSING_PRESETS,
  MODEL_INFO,
  Severity,
} from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

export interface UseProcessingOptionsReturn {
  // Current options
  options: ProcessingOptions;

  // Preset management
  currentPresetId: string | null;
  presets: ProcessingPreset[];
  selectPreset: (presetId: string) => void;
  isCustomConfiguration: boolean;

  // Individual option setters
  setMode: (mode: ProcessingMode) => void;
  setModel: (model: ProcessingModel) => void;
  setMaxIterations: (iterations: number) => void;
  setAutoPush: (enabled: boolean) => void;
  setCiAwareness: (enabled: boolean) => void;
  setAutoFixCi: (enabled: boolean) => void;

  // Bulk operations
  setOptions: (options: Partial<ProcessingOptions>) => void;
  resetToDefaults: () => void;

  // Cost estimation
  estimateCost: (issueCount: number) => CostEstimate;

  // Model suggestion
  suggestModel: (severity: Severity) => ProcessingModel;

  // Persistence
  saveAsCustomPreset: (name: string) => void;
  customPresets: ProcessingPreset[];
  deleteCustomPreset: (presetId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'meta-ralph-processing-options';
const CUSTOM_PRESETS_KEY = 'meta-ralph-custom-presets';

// Assumed average tokens per iteration (from PRD-09)
const TOKENS_PER_ITERATION = 5000;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useProcessingOptions(): UseProcessingOptionsReturn {
  // Core options state with localStorage persistence
  const [options, setOptionsState] = useLocalStorage<ProcessingOptions>(
    STORAGE_KEY,
    DEFAULT_PROCESSING_OPTIONS
  );

  // Custom presets storage
  const [customPresets, setCustomPresets] = useLocalStorage<ProcessingPreset[]>(
    CUSTOM_PRESETS_KEY,
    []
  );

  // Track currently selected preset (null if custom configuration)
  const [currentPresetId, setCurrentPresetId] = useState<string | null>(() => {
    // On init, check if current options match any preset
    const allPresets = [...PROCESSING_PRESETS, ...customPresets];
    const matchingPreset = allPresets.find(preset =>
      isOptionsEqual(preset.options, options)
    );
    return matchingPreset?.id ?? null;
  });

  // Combine built-in and custom presets
  const presets = useMemo(() => {
    return [...PROCESSING_PRESETS, ...customPresets];
  }, [customPresets]);

  // Check if current config matches any preset
  const isCustomConfiguration = useMemo(() => {
    return !presets.some(preset => isOptionsEqual(preset.options, options));
  }, [presets, options]);

  // Select a preset
  const selectPreset = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setOptionsState(preset.options);
      setCurrentPresetId(presetId);
    }
  }, [presets, setOptionsState]);

  // Individual option setters
  const setMode = useCallback((mode: ProcessingMode) => {
    setOptionsState(prev => ({ ...prev, mode }));
    setCurrentPresetId(null);
  }, [setOptionsState]);

  const setModel = useCallback((model: ProcessingModel) => {
    setOptionsState(prev => ({ ...prev, model }));
    setCurrentPresetId(null);
  }, [setOptionsState]);

  const setMaxIterations = useCallback((maxIterations: number) => {
    const clamped = Math.max(1, Math.min(20, maxIterations));
    setOptionsState(prev => ({ ...prev, maxIterations: clamped }));
    setCurrentPresetId(null);
  }, [setOptionsState]);

  const setAutoPush = useCallback((autoPush: boolean) => {
    setOptionsState(prev => ({ ...prev, autoPush }));
    setCurrentPresetId(null);
  }, [setOptionsState]);

  const setCiAwareness = useCallback((ciAwareness: boolean) => {
    setOptionsState(prev => {
      // If disabling CI awareness, also disable auto-fix CI
      const autoFixCi = ciAwareness ? prev.autoFixCi : false;
      return { ...prev, ciAwareness, autoFixCi };
    });
    setCurrentPresetId(null);
  }, [setOptionsState]);

  const setAutoFixCi = useCallback((autoFixCi: boolean) => {
    setOptionsState(prev => {
      // Can only enable auto-fix CI if CI awareness is on
      const newAutoFixCi = prev.ciAwareness ? autoFixCi : false;
      return { ...prev, autoFixCi: newAutoFixCi };
    });
    setCurrentPresetId(null);
  }, [setOptionsState]);

  // Bulk update options
  const setOptions = useCallback((partialOptions: Partial<ProcessingOptions>) => {
    setOptionsState(prev => ({ ...prev, ...partialOptions }));
    setCurrentPresetId(null);
  }, [setOptionsState]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setOptionsState(DEFAULT_PROCESSING_OPTIONS);
    setCurrentPresetId(null);
  }, [setOptionsState]);

  // Calculate cost estimate (based on PRD-09 formula)
  const estimateCost = useCallback((issueCount: number): CostEstimate => {
    if (issueCount === 0) {
      return { min: 0, max: 0, currency: 'USD' };
    }

    const modelCost = MODEL_INFO[options.model].costPer1kTokens;

    // Estimate average iterations as half of max (typical case)
    const avgIterations = options.maxIterations / 2;

    // Base cost: issues * iterations * tokens * cost per 1k tokens
    const tokensPerIssue = avgIterations * TOKENS_PER_ITERATION;
    const baseCost = (issueCount * tokensPerIssue * modelCost) / 1000;

    // Return range with 50% variance
    return {
      min: Math.max(0.01, baseCost * 0.5),
      max: baseCost * 1.5,
      currency: 'USD',
    };
  }, [options.model, options.maxIterations]);

  // Suggest model based on issue severity (PRD-05)
  const suggestModel = useCallback((severity: Severity): ProcessingModel => {
    // For critical/high security issues, suggest Opus
    if (severity === 'CRITICAL' || severity === 'HIGH') {
      return 'opus';
    }
    // For everything else, Sonnet is sufficient
    return 'sonnet';
  }, []);

  // Save current config as custom preset
  const saveAsCustomPreset = useCallback((name: string) => {
    const newPreset: ProcessingPreset = {
      id: `custom-${Date.now()}`,
      name,
      description: 'Custom configuration',
      icon: '⭐',
      options: { ...options },
      isCustom: true,
    };
    setCustomPresets(prev => [...prev, newPreset]);
    setCurrentPresetId(newPreset.id);
  }, [options, setCustomPresets]);

  // Delete custom preset
  const deleteCustomPreset = useCallback((presetId: string) => {
    setCustomPresets(prev => prev.filter(p => p.id !== presetId));
    if (currentPresetId === presetId) {
      setCurrentPresetId(null);
    }
  }, [setCustomPresets, currentPresetId]);

  return {
    options,
    currentPresetId,
    presets,
    selectPreset,
    isCustomConfiguration,
    setMode,
    setModel,
    setMaxIterations,
    setAutoPush,
    setCiAwareness,
    setAutoFixCi,
    setOptions,
    resetToDefaults,
    estimateCost,
    suggestModel,
    saveAsCustomPreset,
    customPresets,
    deleteCustomPreset,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if two ProcessingOptions objects are equal.
 */
function isOptionsEqual(a: ProcessingOptions, b: ProcessingOptions): boolean {
  return (
    a.mode === b.mode &&
    a.model === b.model &&
    a.maxIterations === b.maxIterations &&
    a.autoPush === b.autoPush &&
    a.ciAwareness === b.ciAwareness &&
    a.autoFixCi === b.autoFixCi
  );
}
