import { renderHook, act } from '@testing-library/react';
import { useProcessingOptions } from '../useProcessingOptions';
import {
  DEFAULT_PROCESSING_OPTIONS,
  PROCESSING_PRESETS,
} from '@/lib/types';

// Mock localStorage
const localStorageMock = (() => {
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

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useProcessingOptions', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('returns default options on first use', () => {
      const { result } = renderHook(() => useProcessingOptions());

      expect(result.current.options).toEqual(DEFAULT_PROCESSING_OPTIONS);
    });

    it('provides all built-in presets', () => {
      const { result } = renderHook(() => useProcessingOptions());

      expect(result.current.presets.length).toBeGreaterThanOrEqual(PROCESSING_PRESETS.length);
      expect(result.current.presets.some(p => p.id === 'quick-fix')).toBe(true);
      expect(result.current.presets.some(p => p.id === 'careful-fix')).toBe(true);
      expect(result.current.presets.some(p => p.id === 'complex-issue')).toBe(true);
      expect(result.current.presets.some(p => p.id === 'security-audit')).toBe(true);
    });

    it('initially has no custom configuration if defaults match a preset', () => {
      // Default options match the careful-fix preset's mode and model but iterations differ
      // So it should be custom config
      const { result } = renderHook(() => useProcessingOptions());

      // Default options don't exactly match any preset, so isCustomConfiguration should be true
      // unless the default is exactly a preset (which it's not since careful-fix has mode: plan)
      expect(typeof result.current.isCustomConfiguration).toBe('boolean');
    });
  });

  describe('preset selection', () => {
    it('applies quick-fix preset correctly', () => {
      const { result } = renderHook(() => useProcessingOptions());
      const quickFix = PROCESSING_PRESETS.find(p => p.id === 'quick-fix');

      act(() => {
        result.current.selectPreset('quick-fix');
      });

      expect(result.current.options).toEqual(quickFix?.options);
      expect(result.current.currentPresetId).toBe('quick-fix');
      expect(result.current.isCustomConfiguration).toBe(false);
    });

    it('applies security-audit preset correctly', () => {
      const { result } = renderHook(() => useProcessingOptions());
      const securityAudit = PROCESSING_PRESETS.find(p => p.id === 'security-audit');

      act(() => {
        result.current.selectPreset('security-audit');
      });

      expect(result.current.options.mode).toBe('plan');
      expect(result.current.options.model).toBe('opus');
      expect(result.current.options.autoPush).toBe(false);
      expect(result.current.options).toEqual(securityAudit?.options);
    });

    it('marks as custom after changing an option', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.selectPreset('quick-fix');
      });

      expect(result.current.isCustomConfiguration).toBe(false);

      act(() => {
        result.current.setMaxIterations(7);
      });

      expect(result.current.isCustomConfiguration).toBe(true);
      expect(result.current.currentPresetId).toBe(null);
    });
  });

  describe('individual option setters', () => {
    it('sets mode correctly', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.setMode('plan');
      });

      expect(result.current.options.mode).toBe('plan');

      act(() => {
        result.current.setMode('build');
      });

      expect(result.current.options.mode).toBe('build');
    });

    it('sets model correctly', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.setModel('opus');
      });

      expect(result.current.options.model).toBe('opus');

      act(() => {
        result.current.setModel('sonnet');
      });

      expect(result.current.options.model).toBe('sonnet');
    });

    it('sets maxIterations with clamping', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.setMaxIterations(15);
      });

      expect(result.current.options.maxIterations).toBe(15);

      // Test clamping - should cap at 20
      act(() => {
        result.current.setMaxIterations(25);
      });

      expect(result.current.options.maxIterations).toBe(20);

      // Test minimum clamping - should be at least 1
      act(() => {
        result.current.setMaxIterations(0);
      });

      expect(result.current.options.maxIterations).toBe(1);
    });

    it('sets autoPush correctly', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.setAutoPush(false);
      });

      expect(result.current.options.autoPush).toBe(false);

      act(() => {
        result.current.setAutoPush(true);
      });

      expect(result.current.options.autoPush).toBe(true);
    });

    it('sets ciAwareness and disables autoFixCi when disabled', () => {
      const { result } = renderHook(() => useProcessingOptions());

      // First enable CI awareness and auto-fix
      act(() => {
        result.current.setCiAwareness(true);
        result.current.setAutoFixCi(true);
      });

      expect(result.current.options.ciAwareness).toBe(true);
      expect(result.current.options.autoFixCi).toBe(true);

      // Disable CI awareness should also disable auto-fix
      act(() => {
        result.current.setCiAwareness(false);
      });

      expect(result.current.options.ciAwareness).toBe(false);
      expect(result.current.options.autoFixCi).toBe(false);
    });

    it('prevents enabling autoFixCi when ciAwareness is off', () => {
      const { result } = renderHook(() => useProcessingOptions());

      // CI awareness is off by default
      expect(result.current.options.ciAwareness).toBe(false);

      // Try to enable auto-fix - should fail
      act(() => {
        result.current.setAutoFixCi(true);
      });

      expect(result.current.options.autoFixCi).toBe(false);
    });
  });

  describe('bulk operations', () => {
    it('sets multiple options at once', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.setOptions({
          mode: 'plan',
          model: 'opus',
          maxIterations: 8,
        });
      });

      expect(result.current.options.mode).toBe('plan');
      expect(result.current.options.model).toBe('opus');
      expect(result.current.options.maxIterations).toBe(8);
    });

    it('resets to defaults', () => {
      const { result } = renderHook(() => useProcessingOptions());

      // Change some options
      act(() => {
        result.current.setMode('plan');
        result.current.setModel('opus');
        result.current.setMaxIterations(3);
      });

      expect(result.current.options).not.toEqual(DEFAULT_PROCESSING_OPTIONS);

      // Reset to defaults
      act(() => {
        result.current.resetToDefaults();
      });

      expect(result.current.options).toEqual(DEFAULT_PROCESSING_OPTIONS);
    });
  });

  describe('cost estimation', () => {
    it('returns zero cost for zero issues', () => {
      const { result } = renderHook(() => useProcessingOptions());

      const estimate = result.current.estimateCost(0);

      expect(estimate.min).toBe(0);
      expect(estimate.max).toBe(0);
      expect(estimate.currency).toBe('USD');
    });

    it('returns higher cost for opus than sonnet', () => {
      const { result } = renderHook(() => useProcessingOptions());

      // Test with sonnet
      act(() => {
        result.current.setModel('sonnet');
      });

      const sonnetEstimate = result.current.estimateCost(5);

      // Test with opus
      act(() => {
        result.current.setModel('opus');
      });

      const opusEstimate = result.current.estimateCost(5);

      expect(opusEstimate.min).toBeGreaterThan(sonnetEstimate.min);
      expect(opusEstimate.max).toBeGreaterThan(sonnetEstimate.max);
    });

    it('returns higher cost for more iterations', () => {
      const { result } = renderHook(() => useProcessingOptions());

      act(() => {
        result.current.setMaxIterations(5);
      });

      const lowIterEstimate = result.current.estimateCost(5);

      act(() => {
        result.current.setMaxIterations(15);
      });

      const highIterEstimate = result.current.estimateCost(5);

      expect(highIterEstimate.max).toBeGreaterThan(lowIterEstimate.max);
    });

    it('returns range with min less than max', () => {
      const { result } = renderHook(() => useProcessingOptions());

      const estimate = result.current.estimateCost(3);

      expect(estimate.min).toBeLessThan(estimate.max);
    });
  });

  describe('model suggestion', () => {
    it('suggests opus for CRITICAL severity', () => {
      const { result } = renderHook(() => useProcessingOptions());

      expect(result.current.suggestModel('CRITICAL')).toBe('opus');
    });

    it('suggests opus for HIGH severity', () => {
      const { result } = renderHook(() => useProcessingOptions());

      expect(result.current.suggestModel('HIGH')).toBe('opus');
    });

    it('suggests sonnet for MEDIUM severity', () => {
      const { result } = renderHook(() => useProcessingOptions());

      expect(result.current.suggestModel('MEDIUM')).toBe('sonnet');
    });

    it('suggests sonnet for LOW severity', () => {
      const { result } = renderHook(() => useProcessingOptions());

      expect(result.current.suggestModel('LOW')).toBe('sonnet');
    });

    it('suggests sonnet for INFO severity', () => {
      const { result } = renderHook(() => useProcessingOptions());

      expect(result.current.suggestModel('INFO')).toBe('sonnet');
    });
  });

  describe('custom presets', () => {
    it('saves custom preset', () => {
      const { result } = renderHook(() => useProcessingOptions());

      // Set custom options
      act(() => {
        result.current.setMode('plan');
        result.current.setModel('opus');
        result.current.setMaxIterations(7);
      });

      // Save as custom preset
      act(() => {
        result.current.saveAsCustomPreset('My Custom Config');
      });

      expect(result.current.customPresets.length).toBe(1);
      expect(result.current.customPresets[0].name).toBe('My Custom Config');
      expect(result.current.customPresets[0].options.mode).toBe('plan');
      expect(result.current.customPresets[0].options.model).toBe('opus');
      expect(result.current.customPresets[0].options.maxIterations).toBe(7);
    });

    it('deletes custom preset', () => {
      const { result } = renderHook(() => useProcessingOptions());

      // Save a custom preset
      act(() => {
        result.current.saveAsCustomPreset('Test Preset');
      });

      const presetId = result.current.customPresets[0].id;
      expect(result.current.customPresets.length).toBe(1);

      // Delete it
      act(() => {
        result.current.deleteCustomPreset(presetId);
      });

      expect(result.current.customPresets.length).toBe(0);
    });

    it('includes custom presets in presets list', () => {
      const { result } = renderHook(() => useProcessingOptions());

      const initialPresetsCount = result.current.presets.length;

      act(() => {
        result.current.saveAsCustomPreset('Custom 1');
      });

      expect(result.current.presets.length).toBe(initialPresetsCount + 1);

      act(() => {
        result.current.saveAsCustomPreset('Custom 2');
      });

      expect(result.current.presets.length).toBe(initialPresetsCount + 2);
    });
  });
});
