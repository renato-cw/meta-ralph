'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useSort } from '@/hooks/useSort';
import { useSearch, type SearchScope } from '@/hooks/useSearch';
import { useFilters } from '@/hooks/useFilters';
import type {
  Issue,
  ProcessingStatus,
  FilterState,
  SortState,
  SortField,
  Severity,
  IssueStatus,
} from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

interface AppContextType {
  // Issues data
  issues: Issue[];
  processedIssues: Issue[];
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  fetchIssues: () => Promise<void>;
  availableProviders: string[];

  // Selection state
  selectedIds: Set<string>;
  handleToggle: (id: string) => void;
  handleSelectAll: () => void;
  handleDeselectAll: () => void;

  // Detail panel state
  detailIssue: Issue | null;
  isDetailOpen: boolean;
  openDetailPanel: (issue: Issue) => void;
  closeDetailPanel: () => void;

  // Processing state
  processing: ProcessingStatus;
  processIssues: (ids: string[]) => Promise<void>;
  processSingleIssue: (issueId: string) => Promise<void>;

  // Sort state (from useSort)
  sort: SortState;
  toggleSort: (field: SortField) => void;
  sortIssues: (issues: Issue[]) => Issue[];

  // Search state (from useSearch)
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearSearchQuery: () => void;
  submitSearch: () => void;
  searchScope: SearchScope;
  setSearchScope: (scope: SearchScope) => void;
  searchHistory: string[];
  selectFromHistory: (item: string) => void;
  removeFromHistory: (item: string) => void;
  searchIssues: (issues: Issue[]) => Issue[];

  // Filter state (from useFilters)
  filters: FilterState;
  setFilters: (updates: Partial<FilterState>) => void;
  clearFilters: () => void;
  toggleProvider: (provider: string) => void;
  toggleSeverity: (severity: Severity) => void;
  toggleStatus: (status: IssueStatus) => void;
  setPriorityRange: (min: number, max: number) => void;
  filterIssues: (issues: Issue[]) => Issue[];
  hasActiveFilters: boolean;
  activeFilterCount: number;
}

const defaultProcessingStatus: ProcessingStatus = {
  isProcessing: false,
  currentIssueId: null,
  logs: [],
  completed: [],
  failed: [],
};

// ============================================================================
// Context
// ============================================================================

const AppContext = createContext<AppContextType | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  // Core data state
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Detail panel state
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Processing state
  const [processing, setProcessing] = useState<ProcessingStatus>(defaultProcessingStatus);

  // Use custom hooks
  const {
    sort,
    toggleSort,
    sortIssues,
  } = useSort();

  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    clearQuery: clearSearchQuery,
    searchIssues,
    submitSearch,
    history: searchHistory,
    selectFromHistory,
    removeFromHistory,
    scope: searchScope,
    setScope: setSearchScope,
  } = useSearch();

  const {
    filters,
    setFilters,
    clearFilters,
    toggleProvider,
    toggleSeverity,
    toggleStatus,
    setPriorityRange,
    filterIssues,
    hasActiveFilters,
    activeFilterCount,
  } = useFilters({ syncUrl: true });

  // Derived state: available providers from issues
  const availableProviders = useMemo(
    () => [...new Set(issues.map((i) => i.provider))],
    [issues]
  );

  // Derived state: processed issues (filtered, searched, sorted)
  const processedIssues = useMemo(() => {
    let result = issues;
    result = filterIssues(result);
    result = searchIssues(result);
    result = sortIssues(result);
    return result;
  }, [issues, filterIssues, searchIssues, sortIssues]);

  // Fetch issues from API
  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/issues');
      if (!response.ok) {
        throw new Error(`Failed to fetch issues: ${response.statusText}`);
      }
      const data = await response.json();
      setIssues(data.issues || []);
      setProcessing(data.processing || defaultProcessingStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Poll for processing status when processing
  useEffect(() => {
    if (!processing.isProcessing) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/issues');
        if (response.ok) {
          const data = await response.json();
          setProcessing(data.processing || defaultProcessingStatus);
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [processing.isProcessing]);

  // Selection handlers
  const handleToggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(processedIssues.map((i) => i.id)));
  }, [processedIssues]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Detail panel handlers
  const openDetailPanel = useCallback((issue: Issue) => {
    setDetailIssue(issue);
    setIsDetailOpen(true);
  }, []);

  const closeDetailPanel = useCallback(() => {
    setIsDetailOpen(false);
  }, []);

  // Process issues
  const processIssues = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start processing');
      }

      const data = await response.json();
      setProcessing(data.processing);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing');
    }
  }, []);

  const processSingleIssue = useCallback(async (issueId: string) => {
    try {
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [issueId] }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start processing');
      }

      const data = await response.json();
      setProcessing(data.processing);
      setIsDetailOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing');
    }
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AppContextType>(() => ({
    // Issues data
    issues,
    processedIssues,
    loading,
    error,
    setError,
    fetchIssues,
    availableProviders,

    // Selection state
    selectedIds,
    handleToggle,
    handleSelectAll,
    handleDeselectAll,

    // Detail panel state
    detailIssue,
    isDetailOpen,
    openDetailPanel,
    closeDetailPanel,

    // Processing state
    processing,
    processIssues,
    processSingleIssue,

    // Sort state
    sort,
    toggleSort,
    sortIssues,

    // Search state
    searchQuery,
    setSearchQuery,
    clearSearchQuery,
    submitSearch,
    searchScope,
    setSearchScope,
    searchHistory,
    selectFromHistory,
    removeFromHistory,
    searchIssues,

    // Filter state
    filters,
    setFilters,
    clearFilters,
    toggleProvider,
    toggleSeverity,
    toggleStatus,
    setPriorityRange,
    filterIssues,
    hasActiveFilters,
    activeFilterCount,
  }), [
    issues,
    processedIssues,
    loading,
    error,
    fetchIssues,
    availableProviders,
    selectedIds,
    handleToggle,
    handleSelectAll,
    handleDeselectAll,
    detailIssue,
    isDetailOpen,
    openDetailPanel,
    closeDetailPanel,
    processing,
    processIssues,
    processSingleIssue,
    sort,
    toggleSort,
    sortIssues,
    searchQuery,
    setSearchQuery,
    clearSearchQuery,
    submitSearch,
    searchScope,
    setSearchScope,
    searchHistory,
    selectFromHistory,
    removeFromHistory,
    searchIssues,
    filters,
    setFilters,
    clearFilters,
    toggleProvider,
    toggleSeverity,
    toggleStatus,
    setPriorityRange,
    filterIssues,
    hasActiveFilters,
    activeFilterCount,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access the AppContext.
 * Must be used within an AppProvider.
 *
 * @throws Error if used outside of AppProvider
 *
 * @example
 * const { issues, selectedIds, handleToggle } = useApp();
 */
export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// ============================================================================
// Selector Hooks (for optimized re-renders)
// ============================================================================

/**
 * Hook for accessing only issues-related state.
 */
export function useAppIssues() {
  const { issues, processedIssues, loading, error, fetchIssues, availableProviders } = useApp();
  return { issues, processedIssues, loading, error, fetchIssues, availableProviders };
}

/**
 * Hook for accessing only selection state.
 */
export function useAppSelection() {
  const { selectedIds, handleToggle, handleSelectAll, handleDeselectAll } = useApp();
  return { selectedIds, handleToggle, handleSelectAll, handleDeselectAll };
}

/**
 * Hook for accessing only detail panel state.
 */
export function useAppDetailPanel() {
  const { detailIssue, isDetailOpen, openDetailPanel, closeDetailPanel } = useApp();
  return { detailIssue, isDetailOpen, openDetailPanel, closeDetailPanel };
}

/**
 * Hook for accessing only processing state.
 */
export function useAppProcessing() {
  const { processing, processIssues, processSingleIssue } = useApp();
  return { processing, processIssues, processSingleIssue };
}

/**
 * Hook for accessing only sort state.
 */
export function useAppSort() {
  const { sort, toggleSort, sortIssues } = useApp();
  return { sort, toggleSort, sortIssues };
}

/**
 * Hook for accessing only search state.
 */
export function useAppSearch() {
  const {
    searchQuery,
    setSearchQuery,
    clearSearchQuery,
    submitSearch,
    searchScope,
    setSearchScope,
    searchHistory,
    selectFromHistory,
    removeFromHistory,
    searchIssues,
  } = useApp();
  return {
    searchQuery,
    setSearchQuery,
    clearSearchQuery,
    submitSearch,
    searchScope,
    setSearchScope,
    searchHistory,
    selectFromHistory,
    removeFromHistory,
    searchIssues,
  };
}

/**
 * Hook for accessing only filter state.
 */
export function useAppFilters() {
  const {
    filters,
    setFilters,
    clearFilters,
    toggleProvider,
    toggleSeverity,
    toggleStatus,
    setPriorityRange,
    filterIssues,
    hasActiveFilters,
    activeFilterCount,
  } = useApp();
  return {
    filters,
    setFilters,
    clearFilters,
    toggleProvider,
    toggleSeverity,
    toggleStatus,
    setPriorityRange,
    filterIssues,
    hasActiveFilters,
    activeFilterCount,
  };
}

export default AppContext;
