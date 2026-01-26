'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  ImplementationPlan,
  PlanProgress,
  PlanApiResponse,
} from '@/lib/types';

/**
 * State for plan loading/error handling.
 */
export interface UsePlanState {
  /** The loaded plan */
  plan: ImplementationPlan | null;
  /** Progress statistics */
  progress: PlanProgress | null;
  /** Whether the plan is loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error: string | null;
  /** Whether the plan was manually modified */
  modifiedByUser: boolean;
  /** Whether the plan exists */
  exists: boolean;
}

/**
 * Return type for usePlan hook.
 */
export interface UsePlanReturn extends UsePlanState {
  /** Fetch the plan for an issue */
  fetchPlan: (issueId: string) => Promise<void>;
  /** Update the plan content */
  updatePlan: (issueId: string, rawMarkdown: string) => Promise<boolean>;
  /** Delete the plan */
  deletePlan: (issueId: string) => Promise<boolean>;
  /** Clear the current plan state */
  clearPlan: () => void;
  /** Refresh the current plan */
  refreshPlan: () => Promise<void>;
}

/**
 * Options for usePlan hook.
 */
export interface UsePlanOptions {
  /** Initial issue ID to fetch plan for */
  initialIssueId?: string;
  /** Auto-refresh interval in ms (0 to disable) */
  autoRefreshMs?: number;
}

const initialState: UsePlanState = {
  plan: null,
  progress: null,
  isLoading: false,
  error: null,
  modifiedByUser: false,
  exists: false,
};

/**
 * Hook for managing implementation plan state.
 * Handles fetching, updating, and deleting plans via the API.
 *
 * @param options - Configuration options
 * @returns Plan state and actions
 */
export function usePlan(options: UsePlanOptions = {}): UsePlanReturn {
  const { initialIssueId, autoRefreshMs = 0 } = options;

  const [state, setState] = useState<UsePlanState>(initialState);
  const [currentIssueId, setCurrentIssueId] = useState<string | null>(
    initialIssueId || null
  );

  /**
   * Fetch plan for a specific issue.
   */
  const fetchPlan = useCallback(async (issueId: string): Promise<void> => {
    setCurrentIssueId(issueId);
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/plan/${encodeURIComponent(issueId)}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data: PlanApiResponse = await response.json();

      setState({
        plan: data.plan,
        progress: data.progress,
        isLoading: false,
        error: null,
        modifiedByUser: data.modifiedByUser,
        exists: data.exists,
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch plan',
      }));
    }
  }, []);

  /**
   * Update the plan content.
   */
  const updatePlan = useCallback(
    async (issueId: string, rawMarkdown: string): Promise<boolean> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(`/api/plan/${encodeURIComponent(issueId)}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ rawMarkdown }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `HTTP error ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.plan) {
          setState((prev) => ({
            ...prev,
            plan: data.plan,
            isLoading: false,
            modifiedByUser: true,
            exists: true,
          }));
          return true;
        }

        throw new Error(data.message || 'Update failed');
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to update plan',
        }));
        return false;
      }
    },
    []
  );

  /**
   * Delete the plan.
   */
  const deletePlan = useCallback(async (issueId: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`/api/plan/${encodeURIComponent(issueId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      setState({
        ...initialState,
      });

      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to delete plan',
      }));
      return false;
    }
  }, []);

  /**
   * Clear the current plan state.
   */
  const clearPlan = useCallback(() => {
    setCurrentIssueId(null);
    setState(initialState);
  }, []);

  /**
   * Refresh the current plan.
   */
  const refreshPlan = useCallback(async (): Promise<void> => {
    if (currentIssueId) {
      await fetchPlan(currentIssueId);
    }
  }, [currentIssueId, fetchPlan]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefreshMs > 0 && currentIssueId) {
      const interval = setInterval(() => {
        fetchPlan(currentIssueId);
      }, autoRefreshMs);

      return () => clearInterval(interval);
    }
  }, [autoRefreshMs, currentIssueId, fetchPlan]);

  // Fetch initial plan if issueId provided
  useEffect(() => {
    if (initialIssueId) {
      fetchPlan(initialIssueId);
    }
  }, [initialIssueId, fetchPlan]);

  return {
    ...state,
    fetchPlan,
    updatePlan,
    deletePlan,
    clearPlan,
    refreshPlan,
  };
}

export default usePlan;
