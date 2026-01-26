import { renderHook, act } from '@testing-library/react';
import { useSort } from '../useSort';
import type { Issue } from '@/lib/types';
import { DEFAULT_SORT_STATE } from '@/lib/types';

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
  metadata: {},
  ...overrides,
});

describe('useSort', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default sort state', () => {
      const { result } = renderHook(() => useSort());

      expect(result.current.sort).toEqual(DEFAULT_SORT_STATE);
      expect(result.current.sort.field).toBe('priority');
      expect(result.current.sort.direction).toBe('desc');
    });

    it('should load sort state from localStorage', () => {
      const savedSort = { field: 'severity', direction: 'asc' };
      localStorageMock._setStore({
        'meta-ralph-sort': JSON.stringify(savedSort),
      });

      const { result } = renderHook(() => useSort());

      expect(result.current.sort.field).toBe('severity');
      expect(result.current.sort.direction).toBe('asc');
    });

    it('should use custom storage key', () => {
      const { result } = renderHook(() => useSort('custom-sort-key'));

      act(() => {
        result.current.toggleSort('count');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'custom-sort-key',
        expect.any(String)
      );
    });
  });

  describe('toggleSort', () => {
    it('should set field to descending when clicking different field', () => {
      const { result } = renderHook(() => useSort());

      act(() => {
        result.current.toggleSort('severity');
      });

      expect(result.current.sort.field).toBe('severity');
      expect(result.current.sort.direction).toBe('desc');
    });

    it('should toggle to ascending when clicking same field (currently desc)', () => {
      const { result } = renderHook(() => useSort());

      // Default is priority desc
      act(() => {
        result.current.toggleSort('priority');
      });

      expect(result.current.sort.field).toBe('priority');
      expect(result.current.sort.direction).toBe('asc');
    });

    it('should toggle to descending when clicking same field (currently asc)', () => {
      const { result } = renderHook(() => useSort());

      act(() => {
        result.current.toggleSort('priority'); // desc -> asc
      });

      act(() => {
        result.current.toggleSort('priority'); // asc -> desc
      });

      expect(result.current.sort.field).toBe('priority');
      expect(result.current.sort.direction).toBe('desc');
    });

    it('should persist to localStorage', () => {
      const { result } = renderHook(() => useSort());

      act(() => {
        result.current.toggleSort('count');
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'meta-ralph-sort',
        JSON.stringify({ field: 'count', direction: 'desc' })
      );
    });
  });

  describe('setSortField', () => {
    it('should set specific field and direction', () => {
      const { result } = renderHook(() => useSort());

      act(() => {
        result.current.setSortField('title', 'asc');
      });

      expect(result.current.sort.field).toBe('title');
      expect(result.current.sort.direction).toBe('asc');
    });
  });

  describe('resetSort', () => {
    it('should reset to default sort state', () => {
      const { result } = renderHook(() => useSort());

      act(() => {
        result.current.setSortField('title', 'asc');
      });

      expect(result.current.sort.field).toBe('title');

      act(() => {
        result.current.resetSort();
      });

      expect(result.current.sort).toEqual(DEFAULT_SORT_STATE);
    });
  });

  describe('sortIssues', () => {
    describe('by priority', () => {
      it('should sort by priority descending', () => {
        const { result } = renderHook(() => useSort());

        const issues = [
          createMockIssue({ id: '1', priority: 50 }),
          createMockIssue({ id: '2', priority: 90 }),
          createMockIssue({ id: '3', priority: 30 }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => i.priority)).toEqual([90, 50, 30]);
      });

      it('should sort by priority ascending', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('priority', 'asc');
        });

        const issues = [
          createMockIssue({ id: '1', priority: 50 }),
          createMockIssue({ id: '2', priority: 90 }),
          createMockIssue({ id: '3', priority: 30 }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => i.priority)).toEqual([30, 50, 90]);
      });
    });

    describe('by severity', () => {
      it('should sort by severity descending (CRITICAL first)', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('severity', 'desc');
        });

        const issues = [
          createMockIssue({ id: '1', severity: 'HIGH' }),
          createMockIssue({ id: '2', severity: 'CRITICAL' }),
          createMockIssue({ id: '3', severity: 'LOW' }),
          createMockIssue({ id: '4', severity: 'MEDIUM' }),
          createMockIssue({ id: '5', severity: 'INFO' }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => i.severity)).toEqual([
          'INFO',
          'LOW',
          'MEDIUM',
          'HIGH',
          'CRITICAL',
        ]);
      });

      it('should sort by severity ascending (INFO first)', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('severity', 'asc');
        });

        const issues = [
          createMockIssue({ id: '1', severity: 'HIGH' }),
          createMockIssue({ id: '2', severity: 'CRITICAL' }),
          createMockIssue({ id: '3', severity: 'LOW' }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => i.severity)).toEqual(['CRITICAL', 'HIGH', 'LOW']);
      });
    });

    describe('by count', () => {
      it('should sort by count descending', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('count', 'desc');
        });

        const issues = [
          createMockIssue({ id: '1', count: 5 }),
          createMockIssue({ id: '2', count: 100 }),
          createMockIssue({ id: '3', count: 10 }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => i.count)).toEqual([100, 10, 5]);
      });

      it('should sort by count ascending', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('count', 'asc');
        });

        const issues = [
          createMockIssue({ id: '1', count: 5 }),
          createMockIssue({ id: '2', count: 100 }),
          createMockIssue({ id: '3', count: 10 }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => i.count)).toEqual([5, 10, 100]);
      });
    });

    describe('by title', () => {
      it('should sort by title descending (Z first)', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('title', 'desc');
        });

        const issues = [
          createMockIssue({ id: '1', title: 'Authentication bypass' }),
          createMockIssue({ id: '2', title: 'SQL Injection' }),
          createMockIssue({ id: '3', title: 'XSS vulnerability' }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => i.title)).toEqual([
          'XSS vulnerability',
          'SQL Injection',
          'Authentication bypass',
        ]);
      });

      it('should sort by title ascending (A first)', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('title', 'asc');
        });

        const issues = [
          createMockIssue({ id: '1', title: 'Authentication bypass' }),
          createMockIssue({ id: '2', title: 'SQL Injection' }),
          createMockIssue({ id: '3', title: 'XSS vulnerability' }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => i.title)).toEqual([
          'Authentication bypass',
          'SQL Injection',
          'XSS vulnerability',
        ]);
      });
    });

    describe('by provider', () => {
      it('should sort by provider descending', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('provider', 'desc');
        });

        const issues = [
          createMockIssue({ id: '1', provider: 'sentry' }),
          createMockIssue({ id: '2', provider: 'zeropath' }),
          createMockIssue({ id: '3', provider: 'codecov' }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => i.provider)).toEqual(['zeropath', 'sentry', 'codecov']);
      });

      it('should sort by provider ascending', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('provider', 'asc');
        });

        const issues = [
          createMockIssue({ id: '1', provider: 'sentry' }),
          createMockIssue({ id: '2', provider: 'zeropath' }),
          createMockIssue({ id: '3', provider: 'codecov' }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => i.provider)).toEqual(['codecov', 'sentry', 'zeropath']);
      });
    });

    describe('by date', () => {
      it('should sort by date descending (newest first)', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('date', 'desc');
        });

        const issues = [
          createMockIssue({ id: '1', metadata: { firstSeen: '2024-01-15' } }),
          createMockIssue({ id: '2', metadata: { firstSeen: '2024-01-01' } }),
          createMockIssue({ id: '3', metadata: { firstSeen: '2024-01-10' } }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => (i.metadata?.firstSeen as string))).toEqual([
          '2024-01-15',
          '2024-01-10',
          '2024-01-01',
        ]);
      });

      it('should sort by date ascending (oldest first)', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('date', 'asc');
        });

        const issues = [
          createMockIssue({ id: '1', metadata: { firstSeen: '2024-01-15' } }),
          createMockIssue({ id: '2', metadata: { firstSeen: '2024-01-01' } }),
          createMockIssue({ id: '3', metadata: { firstSeen: '2024-01-10' } }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => (i.metadata?.firstSeen as string))).toEqual([
          '2024-01-01',
          '2024-01-10',
          '2024-01-15',
        ]);
      });

      it('should fallback to lastSeen when firstSeen is not available', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('date', 'desc');
        });

        const issues = [
          createMockIssue({ id: '1', metadata: { lastSeen: '2024-01-15' } }),
          createMockIssue({ id: '2', metadata: { lastSeen: '2024-01-01' } }),
        ];

        const sorted = result.current.sortIssues(issues);

        expect(sorted.map((i) => (i.metadata?.lastSeen as string))).toEqual([
          '2024-01-15',
          '2024-01-01',
        ]);
      });

      it('should fallback to priority when no dates are available', () => {
        const { result } = renderHook(() => useSort());

        act(() => {
          result.current.setSortField('date', 'desc');
        });

        const issues = [
          createMockIssue({ id: '1', priority: 50, metadata: {} }),
          createMockIssue({ id: '2', priority: 90, metadata: {} }),
          createMockIssue({ id: '3', priority: 30, metadata: {} }),
        ];

        const sorted = result.current.sortIssues(issues);

        // Fallback to priority descending
        expect(sorted.map((i) => i.priority)).toEqual([90, 50, 30]);
      });
    });

    it('should not mutate the original array', () => {
      const { result } = renderHook(() => useSort());

      const issues = [
        createMockIssue({ id: '1', priority: 50 }),
        createMockIssue({ id: '2', priority: 90 }),
        createMockIssue({ id: '3', priority: 30 }),
      ];

      const originalOrder = issues.map((i) => i.id);
      result.current.sortIssues(issues);

      expect(issues.map((i) => i.id)).toEqual(originalOrder);
    });
  });

  describe('all sort fields', () => {
    const sortFields = ['priority', 'severity', 'count', 'title', 'provider', 'date'] as const;

    it.each(sortFields)('should handle %s field', (field) => {
      const { result } = renderHook(() => useSort());

      act(() => {
        result.current.toggleSort(field);
      });

      expect(result.current.sort.field).toBe(field);
    });
  });
});
