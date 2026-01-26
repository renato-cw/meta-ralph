import { renderHook, act } from '@testing-library/react';
import { useProcessingOptions } from '../useProcessingOptions';
import type { Issue, ProcessingOptions, Severity } from '@/lib/types';
import { DEFAULT_PROCESSING_OPTIONS, DEFAULT_PRESETS } from '@/lib/types';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Helper to create mock issues
const createMockIssue = (severity: Severity, provider = 'test'): Issue => ({
  id: `issue-${Math.random().toString(36).substr(2, 9)}`,
  provider,
  title: `Test Issue - ${severity}`,
  description: 'Test description',
  location: 'test/file.ts:10',
  severity,
  raw_severity: severity.toLowerCase(),
  count: 1,
  priority: severity === 'CRITICAL' ? 95 : severity === 'HIGH' ? 70 : 50,
  permalink: 'https://test.com/issue/1',
  metadata: {},
});

describe('useProcessingOptions', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should return default options on first load', () => {
      const { result } = renderHook(() => useProcessingOptions());
      expect(result.current.options).toEqual(DEFAULT_PROCESSING_OPTIONS);
    });

    it('should load saved options from localStorage', () => {
      const savedOptions: ProcessingOptions = {
        mode: 'plan',
        model: 'opus',
        maxIterations: 15,
        autoPush: false,
        ciAwareness: true,
        autoFixCi: true,
      };
      mockLocalStorage.setItem(
        'meta-ralph-processing-options',
        JSON.stringify(savedOptions)
      );

      const { result } = renderHook(() => useProcessingOptions());
      expect(result.current.options).toEqual(savedOptions);
    });

    it('should accept custom default options', () => {
      const customDefaults: ProcessingOptions = {
        mode: 'plan',
        model: 'opus',
        maxIterations: 20,
        autoPush: false,
        ciAwareness: false,
        autoFixCi: false,
      };
      const { result } = renderHook(() =>
        useProcessingOptions({ defaultOptions: customDefaults })
      );
      expect(result.current.options).toEqual(customDefaults);
    });

    it('should accept custom storage key', () => {
      const customKey = 'custom-options-key';
      const { result } = renderHook(() =>
        useProcessingOptions({ storageKey: customKey })
      );

      act(() => {
        result.current.updateOption('model', 'opus');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        customKey,
        expect.any(String)
      );
    });
  });

  describe('setOptions', () => {
    it('should update all options at once', () => {
      const { result } = renderHook(() => useProcessingOptions());

      const newOptions: ProcessingOptions = {
        mode: 'plan',
        model: 'opus',
        maxIterations: 3,
        autoPush: false,
        ciAwareness: true,
        autoFixCi: false,
      };

      act(() => {
        result.current.setOptions(newOptions);
      });

      expect(result.current.options).toEqual(newOptions);
    });

    it('should persist options to localStorage', () => {
      const { result } = renderHook(() => useProcessingOptions());

      const newOptions: ProcessingOptions = {
        mode: 'build',
        model: 'sonnet',
        maxIterations: 10,
        autoPush: true,
        ciAwareness: false,
        autoFixCi: false,
      };

      act(() => {
        result.current.setOptions(newOptions);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });
  });

  describe('updateOption', () => {
    it('should update mode option', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('mode', 'plan');
      });

      expect(result.current.options.mode).toBe('plan');
    });

    it('should update model option', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('model', 'opus');
      });

      expect(result.current.options.model).toBe('opus');
    });

    it('should update maxIterations option', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('maxIterations', 15);
      });

      expect(result.current.options.maxIterations).toBe(15);
    });

    it('should update autoPush option', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('autoPush', false);
      });

      expect(result.current.options.autoPush).toBe(false);
    });

    it('should update ciAwareness option', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('ciAwareness', true);
      });

      expect(result.current.options.ciAwareness).toBe(true);
    });

    it('should update autoFixCi option', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('autoFixCi', true);
      });

      expect(result.current.options.autoFixCi).toBe(true);
    });

    it('should preserve other options when updating one', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('model', 'opus');
      });

      expect(result.current.options.mode).toBe(DEFAULT_PROCESSING_OPTIONS.mode);
      expect(result.current.options.maxIterations).toBe(
        DEFAULT_PROCESSING_OPTIONS.maxIterations
      );
    });
  });

  describe('resetOptions', () => {
    it('should reset to default options', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('model', 'opus');
        result.current.updateOption('maxIterations', 20);
        result.current.updateOption('mode', 'plan');
      });

      act(() => {
        result.current.resetOptions();
      });

      expect(result.current.options).toEqual(DEFAULT_PROCESSING_OPTIONS);
    });
  });

  describe('applyPreset', () => {
    it('should apply quick-fix preset', () => {
      const { result } = renderHook(() => useProcessingOptions());
      const quickFix = DEFAULT_PRESETS.find((p) => p.id === 'quick-fix')!;

      act(() => {
        result.current.applyPreset('quick-fix');
      });

      expect(result.current.options).toEqual(quickFix.options);
    });

    it('should apply careful-fix preset', () => {
      const { result } = renderHook(() => useProcessingOptions());
      const carefulFix = DEFAULT_PRESETS.find((p) => p.id === 'careful-fix')!;

      act(() => {
        result.current.applyPreset('careful-fix');
      });

      expect(result.current.options).toEqual(carefulFix.options);
    });

    it('should apply complex-issue preset', () => {
      const { result } = renderHook(() => useProcessingOptions());
      const complexIssue = DEFAULT_PRESETS.find((p) => p.id === 'complex-issue')!;

      act(() => {
        result.current.applyPreset('complex-issue');
      });

      expect(result.current.options).toEqual(complexIssue.options);
    });

    it('should apply security-audit preset', () => {
      const { result } = renderHook(() => useProcessingOptions());
      const securityAudit = DEFAULT_PRESETS.find((p) => p.id === 'security-audit')!;

      act(() => {
        result.current.applyPreset('security-audit');
      });

      expect(result.current.options).toEqual(securityAudit.options);
    });

    it('should ignore invalid preset ID', () => {
      const { result } = renderHook(() => useProcessingOptions());
      const originalOptions = { ...result.current.options };

      act(() => {
        result.current.applyPreset('invalid-preset');
      });

      expect(result.current.options).toEqual(originalOptions);
    });
  });

  describe('currentPresetId', () => {
    it('should return quick-fix when options match', () => {
      const { result } = renderHook(() => useProcessingOptions());
      const quickFix = DEFAULT_PRESETS.find((p) => p.id === 'quick-fix')!;

      act(() => {
        result.current.applyPreset('quick-fix');
      });

      expect(result.current.currentPresetId).toBe('quick-fix');
      expect(result.current.options).toEqual(quickFix.options);
    });

    it('should return null for custom options', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('maxIterations', 7); // Not matching any preset
      });

      expect(result.current.currentPresetId).toBe(null);
    });

    it('should update when options change to match a preset', () => {
      const { result } = renderHook(() => useProcessingOptions());

      // Start with custom options
      act(() => {
        result.current.updateOption('maxIterations', 7);
      });
      expect(result.current.currentPresetId).toBe(null);

      // Change to match security-audit preset
      act(() => {
        result.current.applyPreset('security-audit');
      });
      expect(result.current.currentPresetId).toBe('security-audit');
    });
  });

  describe('getCostEstimate', () => {
    it('should calculate cost for sonnet model', () => {
      const { result } = renderHook(() => useProcessingOptions());

      const estimate = result.current.getCostEstimate(5);

      expect(estimate.currency).toBe('USD');
      expect(estimate.min).toBeGreaterThan(0);
      expect(estimate.max).toBeGreaterThan(estimate.min);
      expect(estimate.breakdown.perIssue).toBeGreaterThan(0);
      expect(estimate.breakdown.perIteration).toBeGreaterThan(0);
    });

    it('should calculate higher cost for opus model', () => {
      const { result } = renderHook(() => useProcessingOptions());

      const sonnetEstimate = result.current.getCostEstimate(5);

      act(() => {
        result.current.updateOption('model', 'opus');
      });

      const opusEstimate = result.current.getCostEstimate(5);

      expect(opusEstimate.max).toBeGreaterThan(sonnetEstimate.max);
    });

    it('should scale cost with issue count', () => {
      const { result } = renderHook(() => useProcessingOptions());

      const estimateFor1 = result.current.getCostEstimate(1);
      const estimateFor5 = result.current.getCostEstimate(5);

      expect(estimateFor5.max).toBeGreaterThan(estimateFor1.max);
    });

    it('should scale cost with iterations', () => {
      const { result } = renderHook(() => useProcessingOptions());

      const estimateWith5 = result.current.getCostEstimate(3);

      act(() => {
        result.current.updateOption('maxIterations', 15);
      });

      const estimateWith15 = result.current.getCostEstimate(3);

      expect(estimateWith15.max).toBeGreaterThan(estimateWith5.max);
    });
  });

  describe('getValidationWarnings', () => {
    it('should warn about using Opus for many issues', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('model', 'opus');
      });

      const issues = Array(6).fill(null).map(() => createMockIssue('HIGH'));
      const warnings = result.current.getValidationWarnings(issues);

      expect(warnings.some((w) => w.includes('Opus') && w.includes('6 issues'))).toBe(
        true
      );
    });

    it('should warn about using Opus for simple issues', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('model', 'opus');
      });

      const issues = [createMockIssue('LOW'), createMockIssue('INFO')];
      const warnings = result.current.getValidationWarnings(issues);

      expect(warnings.some((w) => w.includes('LOW/INFO'))).toBe(true);
    });

    it('should warn about high iterations with many issues', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('maxIterations', 15);
      });

      const issues = Array(4).fill(null).map(() => createMockIssue('MEDIUM'));
      const warnings = result.current.getValidationWarnings(issues);

      expect(warnings.some((w) => w.includes('High iteration count'))).toBe(true);
    });

    it('should warn about auto-fix CI without CI awareness', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.updateOption('autoFixCi', true);
        result.current.updateOption('ciAwareness', false);
      });

      const issues = [createMockIssue('MEDIUM')];
      const warnings = result.current.getValidationWarnings(issues);

      expect(warnings.some((w) => w.includes('CI awareness'))).toBe(true);
    });

    it('should warn about processing many issues at once', () => {
      const { result } = renderHook(() => useProcessingOptions());

      const issues = Array(11).fill(null).map(() => createMockIssue('MEDIUM'));
      const warnings = result.current.getValidationWarnings(issues);

      expect(warnings.some((w) => w.includes('11 issues'))).toBe(true);
    });

    it('should return no warnings for standard configuration', () => {
      const { result } = renderHook(() => useProcessingOptions());

      const issues = [createMockIssue('HIGH'), createMockIssue('MEDIUM')];
      const warnings = result.current.getValidationWarnings(issues);

      expect(warnings.length).toBe(0);
    });
  });

  describe('presets', () => {
    it('should provide access to all default presets', () => {
      const { result } = renderHook(() => useProcessingOptions());

      expect(result.current.presets).toEqual(DEFAULT_PRESETS);
      expect(result.current.presets.length).toBe(4);
    });

    it('should have presets with required fields', () => {
      const { result } = renderHook(() => useProcessingOptions());

      result.current.presets.forEach((preset) => {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(preset.icon).toBeDefined();
        expect(preset.options).toBeDefined();
      });
    });
  });

  describe('modelInfo', () => {
    it('should provide model information', () => {
      const { result } = renderHook(() => useProcessingOptions());

      expect(result.current.modelInfo.sonnet).toBeDefined();
      expect(result.current.modelInfo.opus).toBeDefined();
      expect(result.current.modelInfo.sonnet.name).toBe('Claude Sonnet');
      expect(result.current.modelInfo.opus.name).toBe('Claude Opus');
    });
  });
});
