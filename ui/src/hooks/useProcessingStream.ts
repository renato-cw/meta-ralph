'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, ExecutionMetrics, StreamStatus } from '@/lib/types';
import { parseClaudeEvent, createParseState, createLogActivity, ParseState } from '@/lib/events';

/**
 * Options for the useProcessingStream hook.
 */
export interface UseProcessingStreamOptions {
  /** Issue IDs being processed */
  issueIds: string[];
  /** Maximum iterations for metrics tracking */
  maxIterations?: number;
  /** Maximum activities to keep in memory */
  maxActivities?: number;
  /** Throttle UI updates (ms) */
  throttleMs?: number;
  /** Whether to use SSE streaming vs polling */
  useSSE?: boolean;
}

/**
 * Return value from the useProcessingStream hook.
 */
export interface UseProcessingStreamReturn {
  /** Array of parsed activities */
  activities: Activity[];
  /** Current execution metrics */
  metrics: ExecutionMetrics | null;
  /** Connection status */
  status: StreamStatus;
  /** Error message if any */
  error: string | null;
  /** Clear all activities */
  clearActivities: () => void;
  /** Add activities from plain text logs */
  addLogsAsActivities: (logs: string[]) => void;
}

/**
 * Hook for processing Claude streaming output.
 * Parses JSON events from the processing stream and maintains activity/metrics state.
 *
 * Can work in two modes:
 * 1. SSE mode (useSSE=true): Connects to /api/process/stream for real-time events
 * 2. Polling mode (useSSE=false): Receives logs via addLogsAsActivities callback
 */
export function useProcessingStream({
  issueIds,
  maxIterations = 10,
  maxActivities = 500,
  throttleMs = 100,
  useSSE = false,
}: UseProcessingStreamOptions): UseProcessingStreamReturn {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [metrics, setMetrics] = useState<ExecutionMetrics | null>(null);
  const [status, setStatus] = useState<StreamStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // Refs for throttling and state management
  const parseStateRef = useRef<ParseState>(createParseState(maxIterations));
  const pendingActivitiesRef = useRef<Activity[]>([]);
  const lastUpdateRef = useRef<number>(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Reset parse state when maxIterations changes
  useEffect(() => {
    parseStateRef.current = createParseState(maxIterations);
  }, [maxIterations]);

  // Clear activities
  const clearActivities = useCallback(() => {
    setActivities([]);
    setMetrics(null);
    setError(null);
    parseStateRef.current = createParseState(maxIterations);
    pendingActivitiesRef.current = [];
  }, [maxIterations]);

  // Flush pending activities (throttled)
  const flushPendingActivities = useCallback(() => {
    if (pendingActivitiesRef.current.length === 0) return;

    setActivities(prev => {
      const newActivities = [...prev, ...pendingActivitiesRef.current];
      // Keep only last maxActivities
      if (newActivities.length > maxActivities) {
        return newActivities.slice(-maxActivities);
      }
      return newActivities;
    });

    pendingActivitiesRef.current = [];
    lastUpdateRef.current = Date.now();
  }, [maxActivities]);

  // Add a single activity with throttling
  const addActivity = useCallback(
    (activity: Activity, metricsUpdate: ExecutionMetrics | null) => {
      pendingActivitiesRef.current.push(activity);

      if (metricsUpdate) {
        setMetrics(metricsUpdate);
      }

      const now = Date.now();
      if (now - lastUpdateRef.current >= throttleMs) {
        flushPendingActivities();
      }
    },
    [throttleMs, flushPendingActivities]
  );

  // Add logs as activities (for polling mode)
  const addLogsAsActivities = useCallback(
    (logs: string[]) => {
      for (const log of logs) {
        // Try to parse as JSON event first
        const result = parseClaudeEvent(log, parseStateRef.current);
        parseStateRef.current = result.state;

        if (result.activity) {
          addActivity(result.activity, result.metrics);
        } else if (log.trim()) {
          // Fall back to plain text log
          const activity = createLogActivity(log);
          addActivity(activity, null);
        }
      }

      // Ensure pending activities are flushed
      flushPendingActivities();
    },
    [addActivity, flushPendingActivities]
  );

  // SSE connection management
  useEffect(() => {
    if (!useSSE || issueIds.length === 0) {
      return;
    }

    const url = `/api/process/stream?ids=${issueIds.join(',')}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    setStatus('connecting');
    setError(null);

    eventSource.onopen = () => {
      setStatus('connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'activity' && data.payload) {
          addActivity(data.payload as Activity, null);
        } else if (data.type === 'metrics' && data.payload) {
          setMetrics(data.payload as ExecutionMetrics);
        } else if (data.type === 'log' && data.payload) {
          const activity = createLogActivity(data.payload as string);
          addActivity(activity, null);
        } else if (data.type === 'complete') {
          setStatus('disconnected');
          flushPendingActivities();
        } else if (data.type === 'error') {
          setError(data.payload?.message || 'Unknown error');
          setStatus('error');
        }
      } catch {
        // If not JSON, treat as plain log
        const activity = createLogActivity(event.data);
        addActivity(activity, null);
      }
    };

    eventSource.onerror = () => {
      setStatus('error');
      setError('Connection lost');
      eventSource.close();
    };

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      setStatus('disconnected');
    };
  }, [useSSE, issueIds, addActivity, flushPendingActivities]);

  // Periodic flush for pending activities
  useEffect(() => {
    const interval = setInterval(() => {
      flushPendingActivities();
    }, throttleMs);

    return () => clearInterval(interval);
  }, [throttleMs, flushPendingActivities]);

  return {
    activities,
    metrics,
    status,
    error,
    clearActivities,
    addLogsAsActivities,
  };
}

// Re-export ParseState for external use
export type { ParseState };
