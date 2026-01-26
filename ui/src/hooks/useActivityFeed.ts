/**
 * useActivityFeed Hook
 *
 * Manages activity state for the processing feed, including adding,
 * deduplicating, and limiting stored activities. Also tracks execution metrics.
 *
 * @see PRD-03-JSON-STREAMING.md for specification
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { Activity, ExecutionMetrics } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

export interface UseActivityFeedOptions {
  /** Maximum number of activities to store per issue */
  maxActivities?: number;
  /** Whether to auto-scroll enabled initially */
  autoScrollDefault?: boolean;
}

export interface UseActivityFeedReturn {
  /** All activities for the current feed */
  activities: Activity[];
  /** Current execution metrics */
  metrics: ExecutionMetrics | null;
  /** Whether auto-scroll is enabled */
  autoScroll: boolean;
  /** Toggle auto-scroll */
  toggleAutoScroll: () => void;
  /** Set auto-scroll state */
  setAutoScroll: (enabled: boolean) => void;
  /** Add a single activity */
  addActivity: (activity: Activity) => void;
  /** Add multiple activities */
  addActivities: (activities: Activity[]) => void;
  /** Update an existing activity by ID */
  updateActivity: (id: string, updates: Partial<Activity>) => void;
  /** Set metrics */
  setMetrics: (metrics: ExecutionMetrics | null) => void;
  /** Clear all activities and metrics */
  clear: () => void;
  /** Get activities for a specific issue */
  getActivitiesForIssue: (issueId: string) => Activity[];
  /** Container ref for auto-scroll */
  containerRef: React.RefObject<HTMLDivElement>;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useActivityFeed({
  maxActivities = 500,
  autoScrollDefault = true,
}: UseActivityFeedOptions = {}): UseActivityFeedReturn {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [metrics, setMetricsState] = useState<ExecutionMetrics | null>(null);
  const [autoScroll, setAutoScrollState] = useState(autoScrollDefault);

  // Ref for auto-scrolling container
  const containerRef = useRef<HTMLDivElement>(null);

  // Track activity IDs for deduplication
  const activityIds = useRef<Set<string>>(new Set());

  /**
   * Scroll to bottom of container.
   */
  const scrollToBottom = useCallback(() => {
    if (containerRef.current && autoScroll) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [autoScroll]);

  /**
   * Add a single activity with deduplication.
   */
  const addActivity = useCallback(
    (activity: Activity) => {
      setActivities((prev) => {
        // Check for duplicate
        const existingIndex = prev.findIndex((a) => a.id === activity.id);

        if (existingIndex >= 0) {
          // Update existing activity
          const updated = [...prev];
          updated[existingIndex] = activity;
          return updated;
        }

        // Add new activity
        activityIds.current.add(activity.id);
        const next = [...prev, activity];

        // Limit stored activities
        if (next.length > maxActivities) {
          // Remove oldest activities and their IDs
          const removed = next.slice(0, next.length - maxActivities);
          removed.forEach((a) => activityIds.current.delete(a.id));
          return next.slice(-maxActivities);
        }

        return next;
      });

      // Schedule scroll
      requestAnimationFrame(scrollToBottom);
    },
    [maxActivities, scrollToBottom]
  );

  /**
   * Add multiple activities at once.
   */
  const addActivities = useCallback(
    (newActivities: Activity[]) => {
      if (newActivities.length === 0) return;

      setActivities((prev) => {
        let result = [...prev];

        for (const activity of newActivities) {
          const existingIndex = result.findIndex((a) => a.id === activity.id);

          if (existingIndex >= 0) {
            // Update existing
            result[existingIndex] = activity;
          } else {
            // Add new
            activityIds.current.add(activity.id);
            result.push(activity);
          }
        }

        // Limit stored activities
        if (result.length > maxActivities) {
          const removed = result.slice(0, result.length - maxActivities);
          removed.forEach((a) => activityIds.current.delete(a.id));
          result = result.slice(-maxActivities);
        }

        return result;
      });

      // Schedule scroll
      requestAnimationFrame(scrollToBottom);
    },
    [maxActivities, scrollToBottom]
  );

  /**
   * Update an existing activity by ID.
   */
  const updateActivity = useCallback((id: string, updates: Partial<Activity>) => {
    setActivities((prev) => {
      const index = prev.findIndex((a) => a.id === id);
      if (index < 0) return prev;

      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  }, []);

  /**
   * Set metrics state.
   */
  const setMetrics = useCallback((newMetrics: ExecutionMetrics | null) => {
    setMetricsState(newMetrics);
  }, []);

  /**
   * Clear all activities and metrics.
   */
  const clear = useCallback(() => {
    setActivities([]);
    setMetricsState(null);
    activityIds.current.clear();
  }, []);

  /**
   * Toggle auto-scroll.
   */
  const toggleAutoScroll = useCallback(() => {
    setAutoScrollState((prev) => !prev);
  }, []);

  /**
   * Set auto-scroll state.
   */
  const setAutoScroll = useCallback((enabled: boolean) => {
    setAutoScrollState(enabled);
    if (enabled) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [scrollToBottom]);

  /**
   * Get activities for a specific issue (filters by issueId in metadata if available).
   * Note: Activities don't have issueId directly, so this filters by checking
   * if the activity was added for that issue. In practice, activities are often
   * managed per-issue already.
   */
  const getActivitiesForIssue = useCallback(
    (_issueId: string): Activity[] => {
      // For now, return all activities since we don't track issueId per activity
      // In a real implementation, you might add issueId to Activity or manage
      // separate activity lists per issue
      return activities;
    },
    [activities]
  );

  // Auto-scroll when activities change and autoScroll is enabled
  useEffect(() => {
    if (autoScroll && activities.length > 0) {
      scrollToBottom();
    }
  }, [activities, autoScroll, scrollToBottom]);

  return {
    activities,
    metrics,
    autoScroll,
    toggleAutoScroll,
    setAutoScroll,
    addActivity,
    addActivities,
    updateActivity,
    setMetrics,
    clear,
    getActivitiesForIssue,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
  };
}

export default useActivityFeed;
