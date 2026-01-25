'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { FilterState, Issue, Severity, IssueStatus } from '@/lib/types';
import { DEFAULT_FILTER_STATE } from '@/lib/types';

interface UseFiltersOptions {
  /** Key for localStorage persistence */
  storageKey?: string;
  /** Whether to sync with URL query params */
  syncUrl?: boolean;
}

/**
 * Filters hook with localStorage persistence and optional URL sync.
 *
 * @param options - Configuration options
 * @returns Object with filter state, handlers, and filtered issues function
 *
 * @example
 * const { filters, setFilters, filterIssues, clearFilters } = useFilters();
 * const filteredIssues = filterIssues(issues);
 */
export function useFilters(options: UseFiltersOptions = {}) {
  const { storageKey = 'meta-ralph-filters', syncUrl = false } = options;

  const [filters, setFiltersState] = useLocalStorage<FilterState>(storageKey, DEFAULT_FILTER_STATE);

  // Parse URL params on mount if syncUrl is enabled
  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const urlFilters: Partial<FilterState> = {};

    // Parse providers
    const providers = params.get('providers');
    if (providers) {
      urlFilters.providers = providers.split(',');
    }

    // Parse severities
    const severities = params.get('severity');
    if (severities) {
      urlFilters.severities = severities.split(',') as Severity[];
    }

    // Parse priority range
    const priorityMin = params.get('priority_min');
    const priorityMax = params.get('priority_max');
    if (priorityMin || priorityMax) {
      urlFilters.priorityRange = [
        priorityMin ? parseInt(priorityMin, 10) : 0,
        priorityMax ? parseInt(priorityMax, 10) : 100,
      ];
    }

    // Parse search
    const search = params.get('search');
    if (search) {
      urlFilters.search = search;
    }

    // Merge URL filters with stored filters
    if (Object.keys(urlFilters).length > 0) {
      setFiltersState((prev) => ({ ...prev, ...urlFilters }));
    }
  }, [syncUrl, setFiltersState]);

  // Sync to URL when filters change
  useEffect(() => {
    if (!syncUrl || typeof window === 'undefined') return;

    const params = new URLSearchParams();

    if (filters.providers.length > 0) {
      params.set('providers', filters.providers.join(','));
    }
    if (filters.severities.length > 0) {
      params.set('severity', filters.severities.join(','));
    }
    if (filters.priorityRange[0] !== 0 || filters.priorityRange[1] !== 100) {
      params.set('priority_min', filters.priorityRange[0].toString());
      params.set('priority_max', filters.priorityRange[1].toString());
    }
    if (filters.search) {
      params.set('search', filters.search);
    }

    const newUrl = params.toString()
      ? `${window.location.pathname}?${params.toString()}`
      : window.location.pathname;

    window.history.replaceState({}, '', newUrl);
  }, [filters, syncUrl]);

  /**
   * Update specific filter fields.
   */
  const setFilters = useCallback((updates: Partial<FilterState>) => {
    setFiltersState((prev) => ({ ...prev, ...updates }));
  }, [setFiltersState]);

  /**
   * Reset all filters to default state.
   */
  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTER_STATE);
  }, [setFiltersState]);

  /**
   * Toggle a provider in the filter.
   */
  const toggleProvider = useCallback((provider: string) => {
    setFiltersState((prev) => ({
      ...prev,
      providers: prev.providers.includes(provider)
        ? prev.providers.filter((p) => p !== provider)
        : [...prev.providers, provider],
    }));
  }, [setFiltersState]);

  /**
   * Toggle a severity in the filter.
   */
  const toggleSeverity = useCallback((severity: Severity) => {
    setFiltersState((prev) => ({
      ...prev,
      severities: prev.severities.includes(severity)
        ? prev.severities.filter((s) => s !== severity)
        : [...prev.severities, severity],
    }));
  }, [setFiltersState]);

  /**
   * Toggle a status in the filter.
   */
  const toggleStatus = useCallback((status: IssueStatus) => {
    setFiltersState((prev) => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter((s) => s !== status)
        : [...prev.status, status],
    }));
  }, [setFiltersState]);

  /**
   * Toggle a tag in the filter.
   */
  const toggleTag = useCallback((tag: string) => {
    setFiltersState((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  }, [setFiltersState]);

  /**
   * Set priority range.
   */
  const setPriorityRange = useCallback((min: number, max: number) => {
    setFiltersState((prev) => ({
      ...prev,
      priorityRange: [min, max],
    }));
  }, [setFiltersState]);

  /**
   * Set date range.
   */
  const setDateRange = useCallback((start: string | null, end: string | null) => {
    setFiltersState((prev) => ({
      ...prev,
      dateRange: { start, end },
    }));
  }, [setFiltersState]);

  /**
   * Set count range.
   */
  const setCountRange = useCallback((min: number | null, max: number | null) => {
    setFiltersState((prev) => ({
      ...prev,
      countRange: { min, max },
    }));
  }, [setFiltersState]);

  /**
   * Set search query.
   */
  const setSearch = useCallback((search: string) => {
    setFiltersState((prev) => ({ ...prev, search }));
  }, [setFiltersState]);

  /**
   * Check if any filter is active.
   */
  const hasActiveFilters = useMemo(() => {
    return (
      filters.providers.length > 0 ||
      filters.severities.length > 0 ||
      filters.priorityRange[0] !== 0 ||
      filters.priorityRange[1] !== 100 ||
      filters.dateRange.start !== null ||
      filters.dateRange.end !== null ||
      filters.countRange.min !== null ||
      filters.countRange.max !== null ||
      filters.status.length > 0 ||
      filters.tags.length > 0 ||
      filters.search.length > 0
    );
  }, [filters]);

  /**
   * Count of active filter categories.
   */
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.providers.length > 0) count++;
    if (filters.severities.length > 0) count++;
    if (filters.priorityRange[0] !== 0 || filters.priorityRange[1] !== 100) count++;
    if (filters.dateRange.start !== null || filters.dateRange.end !== null) count++;
    if (filters.countRange.min !== null || filters.countRange.max !== null) count++;
    if (filters.status.length > 0) count++;
    if (filters.tags.length > 0) count++;
    if (filters.search.length > 0) count++;
    return count;
  }, [filters]);

  /**
   * Filter issues based on current filter state.
   * Note: Search is typically handled separately by useSearch for debouncing.
   */
  const filterIssues = useCallback((issues: Issue[]): Issue[] => {
    return issues.filter((issue) => {
      // Provider filter
      if (filters.providers.length > 0 && !filters.providers.includes(issue.provider)) {
        return false;
      }

      // Severity filter
      if (filters.severities.length > 0 && !filters.severities.includes(issue.severity)) {
        return false;
      }

      // Priority range filter
      if (issue.priority < filters.priorityRange[0] || issue.priority > filters.priorityRange[1]) {
        return false;
      }

      // Count range filter
      if (filters.countRange.min !== null && issue.count < filters.countRange.min) {
        return false;
      }
      if (filters.countRange.max !== null && issue.count > filters.countRange.max) {
        return false;
      }

      // Date range filter (uses metadata.firstSeen or metadata.lastSeen)
      if (filters.dateRange.start !== null || filters.dateRange.end !== null) {
        const issueDate = (issue.metadata?.firstSeen as string) || (issue.metadata?.lastSeen as string);
        if (issueDate) {
          if (filters.dateRange.start && issueDate < filters.dateRange.start) {
            return false;
          }
          if (filters.dateRange.end && issueDate > filters.dateRange.end) {
            return false;
          }
        }
      }

      // Search filter (basic - useSearch handles debouncing)
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matches =
          issue.title.toLowerCase().includes(query) ||
          issue.description.toLowerCase().includes(query) ||
          issue.location.toLowerCase().includes(query) ||
          issue.id.toLowerCase() === query;
        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }, [filters]);

  return {
    // State
    filters,

    // Setters
    setFilters,
    clearFilters,

    // Toggle helpers
    toggleProvider,
    toggleSeverity,
    toggleStatus,
    toggleTag,

    // Range setters
    setPriorityRange,
    setDateRange,
    setCountRange,
    setSearch,

    // Utilities
    filterIssues,

    // Computed
    hasActiveFilters,
    activeFilterCount,
  };
}
