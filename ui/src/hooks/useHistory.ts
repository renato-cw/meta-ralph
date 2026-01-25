'use client';

import { useState, useCallback, useEffect } from 'react';
import type { HistoryEntry, Issue, Severity } from '@/lib/types';

const STORAGE_KEY = 'meta-ralph-processing-history';
const MAX_HISTORY_ENTRIES = 500;

export interface HistoryFilter {
  status?: 'completed' | 'failed' | 'all';
  provider?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface UseHistoryOptions {
  maxEntries?: number;
}

export interface UseHistoryReturn {
  /** All history entries (unfiltered) */
  entries: HistoryEntry[];
  /** Filtered history entries based on current filter */
  filteredEntries: HistoryEntry[];
  /** Current filter state */
  filter: HistoryFilter;
  /** Set filter state */
  setFilter: (filter: HistoryFilter) => void;
  /** Clear all filters */
  clearFilter: () => void;
  /** Add a new history entry */
  addEntry: (entry: Omit<HistoryEntry, 'id'>) => HistoryEntry;
  /** Add entry from issue completion */
  recordCompletion: (issue: Issue, prUrl?: string) => HistoryEntry;
  /** Add entry from issue failure */
  recordFailure: (issue: Issue, error?: string) => HistoryEntry;
  /** Remove a history entry by ID */
  removeEntry: (id: string) => void;
  /** Clear all history */
  clearHistory: () => void;
  /** Clear failed entries only */
  clearFailed: () => void;
  /** Get entry by ID */
  getEntry: (id: string) => HistoryEntry | undefined;
  /** Get entries for a specific issue */
  getEntriesForIssue: (issueId: string) => HistoryEntry[];
  /** Statistics */
  stats: {
    total: number;
    completed: number;
    failed: number;
    successRate: number;
  };
  /** Export history as JSON */
  exportHistory: () => string;
  /** Import history from JSON */
  importHistory: (json: string) => number;
}

function generateId(): string {
  return `history-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function loadFromStorage(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveToStorage(entries: HistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or unavailable
  }
}

function applyFilter(entries: HistoryEntry[], filter: HistoryFilter): HistoryEntry[] {
  return entries.filter((entry) => {
    // Status filter
    if (filter.status && filter.status !== 'all' && entry.status !== filter.status) {
      return false;
    }

    // Provider filter
    if (filter.provider && entry.provider !== filter.provider) {
      return false;
    }

    // Date range filter
    if (filter.dateFrom) {
      const entryDate = new Date(entry.completedAt);
      const fromDate = new Date(filter.dateFrom);
      if (entryDate < fromDate) return false;
    }

    if (filter.dateTo) {
      const entryDate = new Date(entry.completedAt);
      const toDate = new Date(filter.dateTo);
      toDate.setHours(23, 59, 59, 999);
      if (entryDate > toDate) return false;
    }

    // Search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const matchesTitle = entry.issueTitle.toLowerCase().includes(searchLower);
      const matchesId = entry.issueId.toLowerCase().includes(searchLower);
      const matchesProvider = entry.provider.toLowerCase().includes(searchLower);
      const matchesError = entry.error?.toLowerCase().includes(searchLower);
      if (!matchesTitle && !matchesId && !matchesProvider && !matchesError) {
        return false;
      }
    }

    return true;
  });
}

export function useHistory(options: UseHistoryOptions = {}): UseHistoryReturn {
  const maxEntries = options.maxEntries ?? MAX_HISTORY_ENTRIES;

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>({ status: 'all' });
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadFromStorage();
    setEntries(loaded);
    setIsInitialized(true);
  }, []);

  // Save to localStorage when entries change
  useEffect(() => {
    if (isInitialized) {
      saveToStorage(entries);
    }
  }, [entries, isInitialized]);

  const addEntry = useCallback((entry: Omit<HistoryEntry, 'id'>): HistoryEntry => {
    const newEntry: HistoryEntry = {
      ...entry,
      id: generateId(),
    };

    setEntries((prev) => {
      // Add to beginning (most recent first) and limit size
      const updated = [newEntry, ...prev].slice(0, maxEntries);
      return updated;
    });

    return newEntry;
  }, [maxEntries]);

  const recordCompletion = useCallback((issue: Issue, prUrl?: string): HistoryEntry => {
    const now = new Date().toISOString();
    return addEntry({
      issueId: issue.id,
      issueTitle: issue.title,
      provider: issue.provider,
      severity: issue.severity as Severity,
      status: 'completed',
      startedAt: now, // Approximation - we don't have actual start time
      completedAt: now,
      duration: 0, // Will be updated if we track actual duration
      prUrl,
    });
  }, [addEntry]);

  const recordFailure = useCallback((issue: Issue, error?: string): HistoryEntry => {
    const now = new Date().toISOString();
    return addEntry({
      issueId: issue.id,
      issueTitle: issue.title,
      provider: issue.provider,
      severity: issue.severity as Severity,
      status: 'failed',
      startedAt: now,
      completedAt: now,
      duration: 0,
      error: error || 'Processing failed',
    });
  }, [addEntry]);

  const removeEntry = useCallback((id: string): void => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clearHistory = useCallback((): void => {
    setEntries([]);
  }, []);

  const clearFailed = useCallback((): void => {
    setEntries((prev) => prev.filter((e) => e.status !== 'failed'));
  }, []);

  const clearFilter = useCallback((): void => {
    setFilter({ status: 'all' });
  }, []);

  const getEntry = useCallback((id: string): HistoryEntry | undefined => {
    return entries.find((e) => e.id === id);
  }, [entries]);

  const getEntriesForIssue = useCallback((issueId: string): HistoryEntry[] => {
    return entries.filter((e) => e.issueId === issueId);
  }, [entries]);

  const exportHistory = useCallback((): string => {
    return JSON.stringify(entries, null, 2);
  }, [entries]);

  const importHistory = useCallback((json: string): number => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        throw new Error('Invalid format: expected array');
      }

      // Validate and transform entries
      const validEntries: HistoryEntry[] = parsed
        .filter((item): item is HistoryEntry =>
          item &&
          typeof item.issueId === 'string' &&
          typeof item.issueTitle === 'string' &&
          typeof item.provider === 'string' &&
          typeof item.status === 'string'
        )
        .map((item) => ({
          ...item,
          id: generateId(), // Generate new IDs to avoid conflicts
        }));

      setEntries((prev) => {
        // Merge with existing, avoiding duplicates by issueId+completedAt
        const existingKeys = new Set(prev.map((e) => `${e.issueId}-${e.completedAt}`));
        const newEntries = validEntries.filter(
          (e) => !existingKeys.has(`${e.issueId}-${e.completedAt}`)
        );
        return [...newEntries, ...prev].slice(0, maxEntries);
      });

      return validEntries.length;
    } catch {
      throw new Error('Failed to parse history JSON');
    }
  }, [maxEntries]);

  // Calculate filtered entries
  const filteredEntries = applyFilter(entries, filter);

  // Calculate stats
  const stats = {
    total: entries.length,
    completed: entries.filter((e) => e.status === 'completed').length,
    failed: entries.filter((e) => e.status === 'failed').length,
    successRate: entries.length > 0
      ? Math.round((entries.filter((e) => e.status === 'completed').length / entries.length) * 100)
      : 0,
  };

  return {
    entries,
    filteredEntries,
    filter,
    setFilter,
    clearFilter,
    addEntry,
    recordCompletion,
    recordFailure,
    removeEntry,
    clearHistory,
    clearFailed,
    getEntry,
    getEntriesForIssue,
    stats,
    exportHistory,
    importHistory,
  };
}
