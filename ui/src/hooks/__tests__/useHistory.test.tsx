import { renderHook, act } from '@testing-library/react';
import { useHistory } from '../useHistory';
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

describe('useHistory', () => {
  const mockIssue: Issue = {
    id: 'test-issue-1',
    provider: 'zeropath',
    title: 'Test Issue',
    description: 'Test description',
    severity: 'HIGH',
    priority: 75,
    count: 5,
    location: 'src/test.ts:10',
    external_url: 'https://example.com/issue/1',
  };

  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with empty entries array', () => {
      const { result } = renderHook(() => useHistory());

      expect(result.current.entries).toEqual([]);
      expect(result.current.stats.total).toBe(0);
      expect(result.current.stats.completed).toBe(0);
      expect(result.current.stats.failed).toBe(0);
    });

    it('should load entries from localStorage', () => {
      const existingEntries = [
        {
          id: 'entry-1',
          issueId: 'issue-1',
          issueTitle: 'Existing Issue',
          provider: 'sentry',
          severity: 'CRITICAL',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:01:00Z',
          duration: 60000,
        },
      ];

      localStorageMock._setStore({
        'meta-ralph-processing-history': JSON.stringify(existingEntries),
      });

      const { result } = renderHook(() => useHistory());

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0].issueTitle).toBe('Existing Issue');
    });
  });

  describe('recordCompletion', () => {
    it('should record a completed issue', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.recordCompletion(mockIssue, 'https://github.com/pr/1');
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0].issueId).toBe('test-issue-1');
      expect(result.current.entries[0].issueTitle).toBe('Test Issue');
      expect(result.current.entries[0].status).toBe('completed');
      expect(result.current.entries[0].prUrl).toBe('https://github.com/pr/1');
    });

    it('should update stats after recording completion', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.recordCompletion(mockIssue);
      });

      expect(result.current.stats.total).toBe(1);
      expect(result.current.stats.completed).toBe(1);
      expect(result.current.stats.failed).toBe(0);
      expect(result.current.stats.successRate).toBe(100);
    });

    it('should persist to localStorage', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.recordCompletion(mockIssue);
      });

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'meta-ralph-processing-history',
        expect.stringContaining('test-issue-1')
      );
    });
  });

  describe('recordFailure', () => {
    it('should record a failed issue', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.recordFailure(mockIssue, 'Processing timeout');
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0].issueId).toBe('test-issue-1');
      expect(result.current.entries[0].status).toBe('failed');
      expect(result.current.entries[0].error).toBe('Processing timeout');
    });

    it('should use default error message when none provided', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.recordFailure(mockIssue);
      });

      expect(result.current.entries[0].error).toBe('Processing failed');
    });

    it('should update stats after recording failure', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.recordFailure(mockIssue);
      });

      expect(result.current.stats.total).toBe(1);
      expect(result.current.stats.completed).toBe(0);
      expect(result.current.stats.failed).toBe(1);
      expect(result.current.stats.successRate).toBe(0);
    });
  });

  describe('removeEntry', () => {
    it('should remove an entry by id', () => {
      const { result } = renderHook(() => useHistory());

      let entryId = '';
      act(() => {
        const entry = result.current.recordCompletion(mockIssue);
        entryId = entry.id;
      });

      expect(result.current.entries).toHaveLength(1);

      act(() => {
        result.current.removeEntry(entryId);
      });

      expect(result.current.entries).toHaveLength(0);
    });
  });

  describe('clearHistory', () => {
    it('should clear all entries', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.recordCompletion(mockIssue);
        result.current.recordFailure({ ...mockIssue, id: 'issue-2' });
      });

      expect(result.current.entries).toHaveLength(2);

      act(() => {
        result.current.clearHistory();
      });

      expect(result.current.entries).toHaveLength(0);
    });
  });

  describe('clearFailed', () => {
    it('should clear only failed entries', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.recordCompletion(mockIssue);
        result.current.recordFailure({ ...mockIssue, id: 'issue-2' });
      });

      expect(result.current.entries).toHaveLength(2);

      act(() => {
        result.current.clearFailed();
      });

      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0].status).toBe('completed');
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      const entries = [
        {
          id: 'entry-1',
          issueId: 'issue-1',
          issueTitle: 'Zeropath Issue',
          provider: 'zeropath',
          severity: 'HIGH',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:01:00Z',
          duration: 60000,
        },
        {
          id: 'entry-2',
          issueId: 'issue-2',
          issueTitle: 'Sentry Issue',
          provider: 'sentry',
          severity: 'CRITICAL',
          status: 'failed',
          startedAt: '2024-01-02T00:00:00Z',
          completedAt: '2024-01-02T00:01:00Z',
          duration: 60000,
          error: 'Timeout',
        },
      ];

      localStorageMock._setStore({
        'meta-ralph-processing-history': JSON.stringify(entries),
      });
    });

    it('should filter by status', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.setFilter({ status: 'completed' });
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].status).toBe('completed');

      act(() => {
        result.current.setFilter({ status: 'failed' });
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].status).toBe('failed');
    });

    it('should filter by provider', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.setFilter({ provider: 'zeropath' });
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].provider).toBe('zeropath');
    });

    it('should filter by search term', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.setFilter({ search: 'Sentry' });
      });

      expect(result.current.filteredEntries).toHaveLength(1);
      expect(result.current.filteredEntries[0].issueTitle).toBe('Sentry Issue');
    });

    it('should combine filters', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.setFilter({ status: 'completed', provider: 'zeropath' });
      });

      expect(result.current.filteredEntries).toHaveLength(1);

      act(() => {
        result.current.setFilter({ status: 'failed', provider: 'zeropath' });
      });

      expect(result.current.filteredEntries).toHaveLength(0);
    });

    it('should clear filters', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.setFilter({ status: 'completed', provider: 'zeropath' });
      });

      expect(result.current.filteredEntries).toHaveLength(1);

      act(() => {
        result.current.clearFilter();
      });

      expect(result.current.filteredEntries).toHaveLength(2);
    });
  });

  describe('getEntry', () => {
    it('should return entry by id', () => {
      const { result } = renderHook(() => useHistory());

      let entryId = '';
      act(() => {
        const entry = result.current.recordCompletion(mockIssue);
        entryId = entry.id;
      });

      const foundEntry = result.current.getEntry(entryId);
      expect(foundEntry).toBeDefined();
      expect(foundEntry?.issueId).toBe('test-issue-1');
    });

    it('should return undefined for non-existent id', () => {
      const { result } = renderHook(() => useHistory());

      const foundEntry = result.current.getEntry('non-existent');
      expect(foundEntry).toBeUndefined();
    });
  });

  describe('getEntriesForIssue', () => {
    it('should return all entries for a specific issue', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.recordCompletion(mockIssue);
        result.current.recordFailure(mockIssue); // Same issue, failed retry
        result.current.recordCompletion({ ...mockIssue, id: 'other-issue' });
      });

      const issueEntries = result.current.getEntriesForIssue('test-issue-1');
      expect(issueEntries).toHaveLength(2);
    });
  });

  describe('exportHistory', () => {
    it('should export history as JSON string', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.recordCompletion(mockIssue);
        result.current.recordFailure({ ...mockIssue, id: 'issue-2' });
      });

      const exported = result.current.exportHistory();
      const parsed = JSON.parse(exported);

      expect(parsed).toHaveLength(2);
    });
  });

  describe('importHistory', () => {
    it('should import history from JSON string', () => {
      const { result } = renderHook(() => useHistory());

      const entriesToImport = [
        {
          id: 'old-id',
          issueId: 'imported-issue',
          issueTitle: 'Imported Issue',
          provider: 'codecov',
          severity: 'MEDIUM',
          status: 'completed',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T00:01:00Z',
          duration: 60000,
        },
      ];

      let count = 0;
      act(() => {
        count = result.current.importHistory(JSON.stringify(entriesToImport));
      });

      expect(count).toBe(1);
      expect(result.current.entries).toHaveLength(1);
      expect(result.current.entries[0].issueTitle).toBe('Imported Issue');
      expect(result.current.entries[0].id).not.toBe('old-id'); // New ID assigned
    });

    it('should throw error for invalid JSON', () => {
      const { result } = renderHook(() => useHistory());

      expect(() => {
        act(() => {
          result.current.importHistory('invalid json');
        });
      }).toThrow();
    });

    it('should throw error for non-array JSON', () => {
      const { result } = renderHook(() => useHistory());

      expect(() => {
        act(() => {
          result.current.importHistory('{"name": "not an array"}');
        });
      }).toThrow('Failed to parse history JSON');
    });
  });

  describe('max entries limit', () => {
    it('should limit entries to maxEntries option', () => {
      const { result } = renderHook(() => useHistory({ maxEntries: 3 }));

      act(() => {
        result.current.recordCompletion({ ...mockIssue, id: 'issue-1' });
        result.current.recordCompletion({ ...mockIssue, id: 'issue-2' });
        result.current.recordCompletion({ ...mockIssue, id: 'issue-3' });
        result.current.recordCompletion({ ...mockIssue, id: 'issue-4' });
        result.current.recordCompletion({ ...mockIssue, id: 'issue-5' });
      });

      expect(result.current.entries).toHaveLength(3);
      // Most recent entries should be kept (first in array)
      expect(result.current.entries[0].issueId).toBe('issue-5');
      expect(result.current.entries[1].issueId).toBe('issue-4');
      expect(result.current.entries[2].issueId).toBe('issue-3');
    });
  });

  describe('success rate calculation', () => {
    it('should calculate correct success rate', () => {
      const { result } = renderHook(() => useHistory());

      act(() => {
        result.current.recordCompletion({ ...mockIssue, id: 'issue-1' });
        result.current.recordCompletion({ ...mockIssue, id: 'issue-2' });
        result.current.recordCompletion({ ...mockIssue, id: 'issue-3' });
        result.current.recordFailure({ ...mockIssue, id: 'issue-4' });
      });

      expect(result.current.stats.successRate).toBe(75); // 3 out of 4 = 75%
    });

    it('should handle empty history', () => {
      const { result } = renderHook(() => useHistory());

      expect(result.current.stats.successRate).toBe(0);
    });
  });
});
