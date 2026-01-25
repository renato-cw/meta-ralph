'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { Issue } from '@/lib/types';

const MAX_SEARCH_HISTORY = 10;
const DEFAULT_DEBOUNCE_MS = 200;

export type SearchScope = 'all' | 'title' | 'description' | 'location' | 'id';

interface UseSearchOptions {
  /** Debounce delay in milliseconds (default: 200) */
  debounceMs?: number;
  /** Fields to search in (default: ['title', 'description', 'location']) */
  searchFields?: SearchScope;
  /** Storage key for search history */
  historyKey?: string;
}

/**
 * Search hook with debouncing, history, and multi-field search.
 *
 * @param options - Configuration options
 * @returns Object with search state, handlers, and filtered issues function
 *
 * @example
 * const { query, setQuery, searchIssues, history, clearHistory } = useSearch();
 * const filteredIssues = searchIssues(issues);
 */
export function useSearch(options: UseSearchOptions = {}) {
  const {
    debounceMs = DEFAULT_DEBOUNCE_MS,
    searchFields = 'all',
    historyKey = 'meta-ralph-search-history',
  } = options;

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>(searchFields);
  const [history, setHistory] = useLocalStorage<string[]>(historyKey, []);

  // Track if we should add to history (only on Enter or explicit save)
  const shouldSaveToHistoryRef = useRef(false);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  /**
   * Add current query to search history.
   */
  const addToHistory = useCallback(() => {
    if (!query.trim()) return;

    setHistory((prev) => {
      // Remove duplicate if exists
      const filtered = prev.filter((item) => item.toLowerCase() !== query.toLowerCase());
      // Add to front and limit to max items
      return [query, ...filtered].slice(0, MAX_SEARCH_HISTORY);
    });
  }, [query, setHistory]);

  /**
   * Clear search query.
   */
  const clearQuery = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
  }, []);

  /**
   * Clear search history.
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, [setHistory]);

  /**
   * Remove specific item from history.
   */
  const removeFromHistory = useCallback((item: string) => {
    setHistory((prev) => prev.filter((h) => h !== item));
  }, [setHistory]);

  /**
   * Select a history item as the current query.
   */
  const selectFromHistory = useCallback((item: string) => {
    setQuery(item);
    setDebouncedQuery(item);
  }, []);

  /**
   * Handle search submission (e.g., on Enter).
   * Adds query to history.
   */
  const submitSearch = useCallback(() => {
    addToHistory();
  }, [addToHistory]);

  /**
   * Check if an issue matches the search query.
   */
  const matchesSearch = useCallback((issue: Issue, searchQuery: string): boolean => {
    if (!searchQuery.trim()) return true;

    const normalizedQuery = searchQuery.toLowerCase();

    // ID exact match
    if (scope === 'id' || scope === 'all') {
      if (issue.id.toLowerCase() === normalizedQuery) {
        return true;
      }
    }

    // Title match
    if (scope === 'title' || scope === 'all') {
      if (issue.title.toLowerCase().includes(normalizedQuery)) {
        return true;
      }
    }

    // Description match
    if (scope === 'description' || scope === 'all') {
      if (issue.description.toLowerCase().includes(normalizedQuery)) {
        return true;
      }
    }

    // Location match (path-aware partial match)
    if (scope === 'location' || scope === 'all') {
      if (issue.location.toLowerCase().includes(normalizedQuery)) {
        return true;
      }
    }

    return false;
  }, [scope]);

  /**
   * Filter issues based on current search query.
   */
  const searchIssues = useCallback((issues: Issue[]): Issue[] => {
    if (!debouncedQuery.trim()) return issues;
    return issues.filter((issue) => matchesSearch(issue, debouncedQuery));
  }, [debouncedQuery, matchesSearch]);

  /**
   * Get highlighted text with matching portions wrapped.
   */
  const highlightMatch = useCallback((text: string, query: string): { before: string; match: string; after: string } | null => {
    if (!query.trim()) return null;

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) return null;

    return {
      before: text.slice(0, index),
      match: text.slice(index, index + query.length),
      after: text.slice(index + query.length),
    };
  }, []);

  return {
    // State
    query,
    debouncedQuery,
    scope,
    history,

    // Setters
    setQuery,
    setScope,

    // Actions
    clearQuery,
    clearHistory,
    removeFromHistory,
    selectFromHistory,
    submitSearch,

    // Utilities
    searchIssues,
    matchesSearch,
    highlightMatch,

    // Computed
    hasQuery: debouncedQuery.trim().length > 0,
  };
}
