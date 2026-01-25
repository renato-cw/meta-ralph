import { renderHook, act } from '@testing-library/react';
import { useFilters } from '../useFilters';
import type { Issue, Severity } from '@/lib/types';
import { DEFAULT_FILTER_STATE } from '@/lib/types';

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
    _getStore: () => store,
    _setStore: (newStore: Record<string, string>) => {
      store = newStore;
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.location and window.history for URL sync tests
const mockLocation = {
  pathname: '/',
  search: '',
};

const mockHistory = {
  replaceState: jest.fn(),
};

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

Object.defineProperty(window, 'history', {
  value: mockHistory,
});

// Sample issues for testing
const createMockIssue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'issue-1',
  provider: 'zeropath',
  title: 'Test Issue',
  description: 'A test issue description',
  location: 'src/test.ts',
  severity: 'HIGH',
  raw_severity: 'high',
  priority: 75,
  count: 5,
  permalink: 'https://example.com/issue/1',
  metadata: {
    firstSeen: '2024-01-01',
    lastSeen: '2024-01-15',
  },
  ...overrides,
});

describe('useFilters', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    mockLocation.search = '';
  });

  describe('initialization', () => {
    it('should initialize with default filter state', () => {
      const { result } = renderHook(() => useFilters());

      expect(result.current.filters).toEqual(DEFAULT_FILTER_STATE);
    });

    it('should load filters from localStorage', () => {
      const savedFilters = {
        ...DEFAULT_FILTER_STATE,
        providers: ['zeropath'],
        severities: ['CRITICAL', 'HIGH'] as Severity[],
      };
      localStorageMock._setStore({
        'meta-ralph-filters': JSON.stringify(savedFilters),
      });

      const { result } = renderHook(() => useFilters());

      expect(result.current.filters.providers).toEqual(['zeropath']);
      expect(result.current.filters.severities).toEqual(['CRITICAL', 'HIGH']);
    });

    it('should use custom storage key', () => {
      const { result } = renderHook(() =>
        useFilters({ storageKey: 'custom-filters' })
      );

      act(() => {
        result.current.toggleProvider('sentry');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'custom-filters',
        expect.any(String)
      );
    });
  });

  describe('setFilters', () => {
    it('should update multiple filter fields at once', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.setFilters({
          providers: ['zeropath', 'sentry'],
          severities: ['CRITICAL'],
        });
      });

      expect(result.current.filters.providers).toEqual(['zeropath', 'sentry']);
      expect(result.current.filters.severities).toEqual(['CRITICAL']);
    });

    it('should preserve other filter fields when updating', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.setFilters({ providers: ['zeropath'] });
      });

      act(() => {
        result.current.setFilters({ severities: ['HIGH'] });
      });

      expect(result.current.filters.providers).toEqual(['zeropath']);
      expect(result.current.filters.severities).toEqual(['HIGH']);
    });
  });

  describe('clearFilters', () => {
    it('should reset all filters to default state', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.setFilters({
          providers: ['zeropath'],
          severities: ['CRITICAL'],
          search: 'test',
        });
      });

      expect(result.current.hasActiveFilters).toBe(true);

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual(DEFAULT_FILTER_STATE);
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  describe('toggleProvider', () => {
    it('should add provider when not in list', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleProvider('zeropath');
      });

      expect(result.current.filters.providers).toEqual(['zeropath']);
    });

    it('should remove provider when already in list', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleProvider('zeropath');
      });

      act(() => {
        result.current.toggleProvider('zeropath');
      });

      expect(result.current.filters.providers).toEqual([]);
    });

    it('should handle multiple providers', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleProvider('zeropath');
      });

      act(() => {
        result.current.toggleProvider('sentry');
      });

      expect(result.current.filters.providers).toEqual(['zeropath', 'sentry']);

      act(() => {
        result.current.toggleProvider('zeropath');
      });

      expect(result.current.filters.providers).toEqual(['sentry']);
    });
  });

  describe('toggleSeverity', () => {
    it('should add severity when not in list', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleSeverity('CRITICAL');
      });

      expect(result.current.filters.severities).toEqual(['CRITICAL']);
    });

    it('should remove severity when already in list', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleSeverity('CRITICAL');
      });

      act(() => {
        result.current.toggleSeverity('CRITICAL');
      });

      expect(result.current.filters.severities).toEqual([]);
    });
  });

  describe('toggleStatus', () => {
    it('should add status when not in list', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleStatus('pending');
      });

      expect(result.current.filters.status).toEqual(['pending']);
    });

    it('should remove status when already in list', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleStatus('pending');
      });

      act(() => {
        result.current.toggleStatus('pending');
      });

      expect(result.current.filters.status).toEqual([]);
    });
  });

  describe('toggleTag', () => {
    it('should add tag when not in list', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleTag('security');
      });

      expect(result.current.filters.tags).toEqual(['security']);
    });

    it('should remove tag when already in list', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleTag('security');
      });

      act(() => {
        result.current.toggleTag('security');
      });

      expect(result.current.filters.tags).toEqual([]);
    });
  });

  describe('setPriorityRange', () => {
    it('should set priority range', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.setPriorityRange(25, 75);
      });

      expect(result.current.filters.priorityRange).toEqual([25, 75]);
    });
  });

  describe('setDateRange', () => {
    it('should set date range', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.setDateRange('2024-01-01', '2024-01-31');
      });

      expect(result.current.filters.dateRange).toEqual({
        start: '2024-01-01',
        end: '2024-01-31',
      });
    });

    it('should allow null values', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.setDateRange('2024-01-01', null);
      });

      expect(result.current.filters.dateRange).toEqual({
        start: '2024-01-01',
        end: null,
      });
    });
  });

  describe('setCountRange', () => {
    it('should set count range', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.setCountRange(5, 100);
      });

      expect(result.current.filters.countRange).toEqual({
        min: 5,
        max: 100,
      });
    });

    it('should allow null values', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.setCountRange(null, 50);
      });

      expect(result.current.filters.countRange).toEqual({
        min: null,
        max: 50,
      });
    });
  });

  describe('setSearch', () => {
    it('should set search query', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.setSearch('test query');
      });

      expect(result.current.filters.search).toBe('test query');
    });
  });

  describe('hasActiveFilters', () => {
    it('should return false when no filters are active', () => {
      const { result } = renderHook(() => useFilters());

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should return true when providers filter is active', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleProvider('zeropath');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should return true when severities filter is active', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleSeverity('CRITICAL');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should return true when priority range is not default', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.setPriorityRange(25, 75);
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should return true when search is active', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.setSearch('test');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  describe('activeFilterCount', () => {
    it('should return 0 when no filters are active', () => {
      const { result } = renderHook(() => useFilters());

      expect(result.current.activeFilterCount).toBe(0);
    });

    it('should count each filter category once', () => {
      const { result } = renderHook(() => useFilters());

      act(() => {
        result.current.toggleProvider('zeropath');
        result.current.toggleProvider('sentry');
      });

      expect(result.current.activeFilterCount).toBe(1); // Multiple providers count as 1

      act(() => {
        result.current.toggleSeverity('CRITICAL');
      });

      expect(result.current.activeFilterCount).toBe(2);

      act(() => {
        result.current.setSearch('test');
      });

      expect(result.current.activeFilterCount).toBe(3);
    });
  });

  describe('filterIssues', () => {
    it('should return all issues when no filters are active', () => {
      const { result } = renderHook(() => useFilters());

      const issues = [
        createMockIssue({ id: '1', provider: 'zeropath' }),
        createMockIssue({ id: '2', provider: 'sentry' }),
      ];

      const filtered = result.current.filterIssues(issues);

      expect(filtered).toHaveLength(2);
    });

    it('should filter by provider', () => {
      const { result } = renderHook(() => useFilters());

      const issues = [
        createMockIssue({ id: '1', provider: 'zeropath' }),
        createMockIssue({ id: '2', provider: 'sentry' }),
        createMockIssue({ id: '3', provider: 'zeropath' }),
      ];

      act(() => {
        result.current.toggleProvider('zeropath');
      });

      const filtered = result.current.filterIssues(issues);

      expect(filtered).toHaveLength(2);
      expect(filtered.every((i) => i.provider === 'zeropath')).toBe(true);
    });

    it('should filter by severity', () => {
      const { result } = renderHook(() => useFilters());

      const issues = [
        createMockIssue({ id: '1', severity: 'CRITICAL' }),
        createMockIssue({ id: '2', severity: 'HIGH' }),
        createMockIssue({ id: '3', severity: 'LOW' }),
      ];

      act(() => {
        result.current.toggleSeverity('CRITICAL');
        result.current.toggleSeverity('HIGH');
      });

      const filtered = result.current.filterIssues(issues);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((i) => i.severity)).toEqual(['CRITICAL', 'HIGH']);
    });

    it('should filter by priority range', () => {
      const { result } = renderHook(() => useFilters());

      const issues = [
        createMockIssue({ id: '1', priority: 90 }),
        createMockIssue({ id: '2', priority: 50 }),
        createMockIssue({ id: '3', priority: 20 }),
      ];

      act(() => {
        result.current.setPriorityRange(40, 100);
      });

      const filtered = result.current.filterIssues(issues);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((i) => i.priority)).toEqual([90, 50]);
    });

    it('should filter by count range', () => {
      const { result } = renderHook(() => useFilters());

      const issues = [
        createMockIssue({ id: '1', count: 10 }),
        createMockIssue({ id: '2', count: 5 }),
        createMockIssue({ id: '3', count: 1 }),
      ];

      act(() => {
        result.current.setCountRange(3, 8);
      });

      const filtered = result.current.filterIssues(issues);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].count).toBe(5);
    });

    it('should filter by search query', () => {
      const { result } = renderHook(() => useFilters());

      const issues = [
        createMockIssue({ id: '1', title: 'SQL Injection vulnerability' }),
        createMockIssue({ id: '2', title: 'XSS vulnerability' }),
        createMockIssue({ id: '3', title: 'Authentication bypass' }),
      ];

      act(() => {
        result.current.setSearch('vulnerability');
      });

      const filtered = result.current.filterIssues(issues);

      expect(filtered).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const { result } = renderHook(() => useFilters());

      const issues = [
        createMockIssue({ id: '1', provider: 'zeropath', severity: 'CRITICAL', priority: 90 }),
        createMockIssue({ id: '2', provider: 'zeropath', severity: 'HIGH', priority: 70 }),
        createMockIssue({ id: '3', provider: 'sentry', severity: 'CRITICAL', priority: 85 }),
        createMockIssue({ id: '4', provider: 'zeropath', severity: 'CRITICAL', priority: 40 }),
      ];

      act(() => {
        result.current.toggleProvider('zeropath');
        result.current.toggleSeverity('CRITICAL');
        result.current.setPriorityRange(50, 100);
      });

      const filtered = result.current.filterIssues(issues);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should search in description', () => {
      const { result } = renderHook(() => useFilters());

      const issues = [
        createMockIssue({ id: '1', description: 'Found in production environment' }),
        createMockIssue({ id: '2', description: 'Found in staging environment' }),
      ];

      act(() => {
        result.current.setSearch('production');
      });

      const filtered = result.current.filterIssues(issues);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should search in location', () => {
      const { result } = renderHook(() => useFilters());

      const issues = [
        createMockIssue({ id: '1', location: 'src/auth/login.ts' }),
        createMockIssue({ id: '2', location: 'src/utils/helper.ts' }),
      ];

      act(() => {
        result.current.setSearch('auth');
      });

      const filtered = result.current.filterIssues(issues);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should match exact ID', () => {
      const { result } = renderHook(() => useFilters());

      const issues = [
        createMockIssue({ id: 'issue-123' }),
        createMockIssue({ id: 'issue-456' }),
      ];

      act(() => {
        result.current.setSearch('issue-123');
      });

      const filtered = result.current.filterIssues(issues);

      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('issue-123');
    });
  });

  describe('URL sync', () => {
    it('should sync filters to URL when syncUrl is enabled', () => {
      const { result } = renderHook(() => useFilters({ syncUrl: true }));

      act(() => {
        result.current.toggleProvider('zeropath');
      });

      expect(mockHistory.replaceState).toHaveBeenCalled();
    });

    it('should not sync to URL when syncUrl is disabled', () => {
      const { result } = renderHook(() => useFilters({ syncUrl: false }));

      act(() => {
        result.current.toggleProvider('zeropath');
      });

      expect(mockHistory.replaceState).not.toHaveBeenCalled();
    });
  });
});
