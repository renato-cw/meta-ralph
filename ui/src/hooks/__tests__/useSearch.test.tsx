import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearch } from '../useSearch';
import type { Issue } from '@/lib/types';

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

describe('useSearch', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with empty query', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.query).toBe('');
      expect(result.current.debouncedQuery).toBe('');
      expect(result.current.hasQuery).toBe(false);
    });

    it('should initialize with default scope', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.scope).toBe('all');
    });

    it('should initialize with custom scope', () => {
      const { result } = renderHook(() => useSearch({ searchFields: 'title' }));

      expect(result.current.scope).toBe('title');
    });

    it('should load history from localStorage', () => {
      localStorageMock._setStore({
        'meta-ralph-search-history': JSON.stringify(['previous', 'searches']),
      });

      const { result } = renderHook(() => useSearch());

      expect(result.current.history).toEqual(['previous', 'searches']);
    });
  });

  describe('setQuery', () => {
    it('should update query immediately', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test query');
      });

      expect(result.current.query).toBe('test query');
    });

    it('should update debounced query after delay', () => {
      const { result } = renderHook(() => useSearch({ debounceMs: 200 }));

      act(() => {
        result.current.setQuery('test query');
      });

      expect(result.current.debouncedQuery).toBe('');

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(result.current.debouncedQuery).toBe('test query');
    });

    it('should respect custom debounce delay', () => {
      const { result } = renderHook(() => useSearch({ debounceMs: 500 }));

      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(result.current.debouncedQuery).toBe('');

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(result.current.debouncedQuery).toBe('test');
    });

    it('should reset debounce timer on new input', () => {
      const { result } = renderHook(() => useSearch({ debounceMs: 200 }));

      act(() => {
        result.current.setQuery('first');
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      act(() => {
        result.current.setQuery('second');
      });

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current.debouncedQuery).toBe('');

      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(result.current.debouncedQuery).toBe('second');
    });
  });

  describe('setScope', () => {
    it('should update scope', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setScope('title');
      });

      expect(result.current.scope).toBe('title');
    });
  });

  describe('clearQuery', () => {
    it('should clear both query and debounced query', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(result.current.debouncedQuery).toBe('test');

      act(() => {
        result.current.clearQuery();
      });

      expect(result.current.query).toBe('');
      expect(result.current.debouncedQuery).toBe('');
    });
  });

  describe('history management', () => {
    it('should add query to history on submitSearch', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test search');
      });

      // Wait for state to update
      act(() => {
        result.current.submitSearch();
      });

      expect(result.current.history).toContain('test search');
    });

    it('should not add empty query to history', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('');
      });

      act(() => {
        result.current.submitSearch();
      });

      expect(result.current.history).toHaveLength(0);
    });

    it('should not add whitespace-only query to history', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('   ');
      });

      act(() => {
        result.current.submitSearch();
      });

      expect(result.current.history).toHaveLength(0);
    });

    it('should move duplicate to front instead of adding again', () => {
      const { result } = renderHook(() => useSearch());

      // Add 'first' to history
      act(() => {
        result.current.setQuery('first');
      });
      act(() => {
        result.current.submitSearch();
      });

      // Add 'second' to history
      act(() => {
        result.current.setQuery('second');
      });
      act(() => {
        result.current.submitSearch();
      });

      // Add 'first' again - should move to front
      act(() => {
        result.current.setQuery('first');
      });
      act(() => {
        result.current.submitSearch();
      });

      // History should be ['first', 'second'] with 'first' at front
      expect(result.current.history).toEqual(['first', 'second']);
    });

    it('should limit history to 10 items', () => {
      const { result } = renderHook(() => useSearch());

      for (let i = 0; i < 15; i++) {
        act(() => {
          result.current.setQuery(`query-${i}`);
        });
        act(() => {
          result.current.submitSearch();
        });
      }

      expect(result.current.history).toHaveLength(10);
      expect(result.current.history[0]).toBe('query-14');
    });

    it('should clear history', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });
      act(() => {
        result.current.submitSearch();
      });

      expect(result.current.history).toHaveLength(1);

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.history).toHaveLength(0);
    });

    it('should remove specific item from history', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('one');
      });
      act(() => {
        result.current.submitSearch();
      });

      act(() => {
        result.current.setQuery('two');
      });
      act(() => {
        result.current.submitSearch();
      });

      act(() => {
        result.current.removeFromHistory('one');
      });

      expect(result.current.history).toEqual(['two']);
    });

    it('should select from history', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('previous');
      });
      act(() => {
        result.current.submitSearch();
      });

      act(() => {
        result.current.clearQuery();
      });

      act(() => {
        result.current.selectFromHistory('previous');
      });

      expect(result.current.query).toBe('previous');
      expect(result.current.debouncedQuery).toBe('previous');
    });
  });

  describe('matchesSearch', () => {
    it('should return true for empty query', () => {
      const { result } = renderHook(() => useSearch());

      const issue = createMockIssue();
      expect(result.current.matchesSearch(issue, '')).toBe(true);
      expect(result.current.matchesSearch(issue, '   ')).toBe(true);
    });

    it('should match title (scope: all)', () => {
      const { result } = renderHook(() => useSearch());

      const issue = createMockIssue({ title: 'SQL Injection vulnerability' });

      expect(result.current.matchesSearch(issue, 'sql')).toBe(true);
      expect(result.current.matchesSearch(issue, 'injection')).toBe(true);
      expect(result.current.matchesSearch(issue, 'xss')).toBe(false);
    });

    it('should match description (scope: all)', () => {
      const { result } = renderHook(() => useSearch());

      const issue = createMockIssue({ description: 'Found in production database' });

      expect(result.current.matchesSearch(issue, 'production')).toBe(true);
      expect(result.current.matchesSearch(issue, 'database')).toBe(true);
    });

    it('should match location (scope: all)', () => {
      const { result } = renderHook(() => useSearch());

      const issue = createMockIssue({ location: 'src/auth/login.ts' });

      expect(result.current.matchesSearch(issue, 'auth')).toBe(true);
      expect(result.current.matchesSearch(issue, 'login')).toBe(true);
    });

    it('should match exact ID (scope: all)', () => {
      const { result } = renderHook(() => useSearch());

      const issue = createMockIssue({ id: 'issue-12345' });

      expect(result.current.matchesSearch(issue, 'issue-12345')).toBe(true);
      expect(result.current.matchesSearch(issue, 'issue-123')).toBe(false); // Not partial
    });

    it('should respect scope: title', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setScope('title');
      });

      const issue = createMockIssue({
        title: 'SQL Injection',
        description: 'Found XSS vulnerability',
      });

      expect(result.current.matchesSearch(issue, 'sql')).toBe(true);
      expect(result.current.matchesSearch(issue, 'xss')).toBe(false);
    });

    it('should respect scope: description', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setScope('description');
      });

      const issue = createMockIssue({
        title: 'SQL Injection',
        description: 'Found XSS vulnerability',
      });

      expect(result.current.matchesSearch(issue, 'xss')).toBe(true);
      expect(result.current.matchesSearch(issue, 'sql')).toBe(false);
    });

    it('should respect scope: location', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setScope('location');
      });

      const issue = createMockIssue({
        title: 'SQL in auth module',
        location: 'src/utils/helper.ts',
      });

      expect(result.current.matchesSearch(issue, 'utils')).toBe(true);
      expect(result.current.matchesSearch(issue, 'auth')).toBe(false);
    });

    it('should respect scope: id', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setScope('id');
      });

      const issue = createMockIssue({
        id: 'issue-123',
        title: 'issue-456',
      });

      expect(result.current.matchesSearch(issue, 'issue-123')).toBe(true);
      expect(result.current.matchesSearch(issue, 'issue-456')).toBe(false);
    });

    it('should be case insensitive', () => {
      const { result } = renderHook(() => useSearch());

      const issue = createMockIssue({ title: 'SQL Injection' });

      expect(result.current.matchesSearch(issue, 'SQL')).toBe(true);
      expect(result.current.matchesSearch(issue, 'sql')).toBe(true);
      expect(result.current.matchesSearch(issue, 'Sql')).toBe(true);
    });
  });

  describe('searchIssues', () => {
    it('should return all issues when no query', () => {
      const { result } = renderHook(() => useSearch());

      const issues = [
        createMockIssue({ id: '1' }),
        createMockIssue({ id: '2' }),
      ];

      expect(result.current.searchIssues(issues)).toHaveLength(2);
    });

    it('should filter issues based on debounced query', () => {
      const { result } = renderHook(() => useSearch());

      const issues = [
        createMockIssue({ id: '1', title: 'SQL Injection' }),
        createMockIssue({ id: '2', title: 'XSS vulnerability' }),
        createMockIssue({ id: '3', title: 'SQL Truncation' }),
      ];

      act(() => {
        result.current.setQuery('sql');
      });

      // Before debounce, should return all
      expect(result.current.searchIssues(issues)).toHaveLength(3);

      act(() => {
        jest.advanceTimersByTime(200);
      });

      // After debounce, should filter
      expect(result.current.searchIssues(issues)).toHaveLength(2);
    });
  });

  describe('highlightMatch', () => {
    it('should return null for empty query', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.highlightMatch('test text', '')).toBeNull();
      expect(result.current.highlightMatch('test text', '   ')).toBeNull();
    });

    it('should return null when no match', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.highlightMatch('hello world', 'xyz')).toBeNull();
    });

    it('should return match segments', () => {
      const { result } = renderHook(() => useSearch());

      const match = result.current.highlightMatch('hello world', 'world');

      expect(match).toEqual({
        before: 'hello ',
        match: 'world',
        after: '',
      });
    });

    it('should preserve original case in match', () => {
      const { result } = renderHook(() => useSearch());

      const match = result.current.highlightMatch('Hello World', 'world');

      expect(match).toEqual({
        before: 'Hello ',
        match: 'World',
        after: '',
      });
    });

    it('should handle match at start', () => {
      const { result } = renderHook(() => useSearch());

      const match = result.current.highlightMatch('hello world', 'hello');

      expect(match).toEqual({
        before: '',
        match: 'hello',
        after: ' world',
      });
    });

    it('should handle match in middle', () => {
      const { result } = renderHook(() => useSearch());

      const match = result.current.highlightMatch('the quick brown fox', 'quick');

      expect(match).toEqual({
        before: 'the ',
        match: 'quick',
        after: ' brown fox',
      });
    });
  });

  describe('hasQuery', () => {
    it('should return false when debounced query is empty', () => {
      const { result } = renderHook(() => useSearch());

      expect(result.current.hasQuery).toBe(false);
    });

    it('should return true when debounced query has content', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(result.current.hasQuery).toBe(true);
    });

    it('should return false for whitespace-only debounced query', () => {
      const { result } = renderHook(() => useSearch());

      act(() => {
        result.current.setQuery('   ');
      });

      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(result.current.hasQuery).toBe(false);
    });
  });
});
