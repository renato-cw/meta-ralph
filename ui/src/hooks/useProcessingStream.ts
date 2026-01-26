/**
 * useProcessingStream Hook
 *
 * Manages EventSource connection to the SSE processing stream endpoint.
 * Handles connection state, auto-reconnect, and event throttling.
 *
 * @see PRD-03-JSON-STREAMING.md for specification
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StreamEvent,
  Activity,
  ExecutionMetrics,
  StreamConnectionState,
} from '@/lib/types';
import { parseSSE } from '@/lib/events';

// ============================================================================
// Types
// ============================================================================

export interface UseProcessingStreamOptions {
  /** Issue IDs to subscribe to */
  issueIds: string[];
  /** Whether to automatically connect when issueIds change */
  autoConnect?: boolean;
  /** Reconnect delay in milliseconds */
  reconnectDelay?: number;
  /** Maximum reconnection attempts */
  maxReconnectAttempts?: number;
  /** Throttle rate for updates (max updates per second) */
  throttleRate?: number;
}

export interface UseProcessingStreamReturn {
  /** Current connection state */
  connectionState: StreamConnectionState;
  /** Most recent activity events by issue ID */
  activities: Map<string, Activity[]>;
  /** Current metrics by issue ID */
  metrics: Map<string, ExecutionMetrics>;
  /** Error message if connection failed */
  error: string | null;
  /** Completed issue IDs */
  completedIssues: Set<string>;
  /** Failed issue IDs with error messages */
  failedIssues: Map<string, string>;
  /** Connect to the stream */
  connect: () => void;
  /** Disconnect from the stream */
  disconnect: () => void;
  /** Clear all activities and metrics */
  clear: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useProcessingStream({
  issueIds,
  autoConnect = true,
  reconnectDelay = 3000,
  maxReconnectAttempts = 5,
  throttleRate = 10,
}: UseProcessingStreamOptions): UseProcessingStreamReturn {
  // Connection state
  const [connectionState, setConnectionState] = useState<StreamConnectionState>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // Event data
  const [activities, setActivities] = useState<Map<string, Activity[]>>(new Map());
  const [metrics, setMetrics] = useState<Map<string, ExecutionMetrics>>(new Map());
  const [completedIssues, setCompletedIssues] = useState<Set<string>>(new Set());
  const [failedIssues, setFailedIssues] = useState<Map<string, string>>(new Map());

  // Refs for cleanup and reconnection
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Throttling state
  const pendingActivities = useRef<Map<string, Activity[]>>(new Map());
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTime = useRef<number>(0);

  // Calculate minimum time between updates
  const minUpdateInterval = 1000 / throttleRate;

  /**
   * Flush pending activities to state.
   */
  const flushActivities = useCallback(() => {
    const pending = pendingActivities.current;
    if (pending.size === 0) return;

    setActivities((prev) => {
      const next = new Map(prev);
      pending.forEach((newActivities, issueId) => {
        const existing = next.get(issueId) || [];
        // Deduplicate by ID and merge
        const merged = [...existing];
        for (const activity of newActivities) {
          const existingIndex = merged.findIndex((a) => a.id === activity.id);
          if (existingIndex >= 0) {
            // Update existing activity
            merged[existingIndex] = activity;
          } else {
            merged.push(activity);
          }
        }
        // Keep only last 500 activities per issue
        next.set(issueId, merged.slice(-500));
      });
      return next;
    });

    pendingActivities.current.clear();
    lastUpdateTime.current = Date.now();
  }, []);

  /**
   * Add activity with throttling.
   */
  const addActivity = useCallback(
    (issueId: string, activity: Activity) => {
      // Add to pending
      const pending = pendingActivities.current.get(issueId) || [];
      pending.push(activity);
      pendingActivities.current.set(issueId, pending);

      // Check if we should flush immediately or schedule
      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTime.current;

      if (timeSinceLastUpdate >= minUpdateInterval) {
        // Enough time has passed, flush immediately
        flushActivities();
      } else if (!throttleTimeoutRef.current) {
        // Schedule a flush
        throttleTimeoutRef.current = setTimeout(() => {
          throttleTimeoutRef.current = null;
          flushActivities();
        }, minUpdateInterval - timeSinceLastUpdate);
      }
    },
    [flushActivities, minUpdateInterval]
  );

  /**
   * Handle incoming SSE event.
   */
  const handleEvent = useCallback(
    (event: StreamEvent) => {
      const { issueId, type, payload } = event;

      switch (type) {
        case 'activity':
          addActivity(issueId, payload as Activity);
          break;

        case 'metrics':
          setMetrics((prev) => {
            const next = new Map(prev);
            next.set(issueId, payload as ExecutionMetrics);
            return next;
          });
          break;

        case 'complete':
          setCompletedIssues((prev) => {
            const next = new Set(prev);
            next.add(issueId);
            return next;
          });
          // Add completion activity
          addActivity(issueId, {
            id: `complete-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'result',
            details: (payload as { message: string }).message,
            status: 'success',
          });
          break;

        case 'error':
          setFailedIssues((prev) => {
            const next = new Map(prev);
            next.set(issueId, (payload as { error: string }).error);
            return next;
          });
          // Add error activity
          addActivity(issueId, {
            id: `error-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'error',
            details: (payload as { error: string }).error,
            status: 'error',
          });
          break;
      }
    },
    [addActivity]
  );

  /**
   * Connect to the SSE stream.
   */
  const connect = useCallback(() => {
    // Don't connect if no issue IDs
    if (issueIds.length === 0) {
      return;
    }

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionState('connecting');
    setError(null);

    // Build URL with issue IDs
    const url = `/api/process/stream?ids=${issueIds.join(',')}`;

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setConnectionState('connected');
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        const parsed = parseSSE(`data: ${event.data}`);
        if (parsed) {
          handleEvent(parsed);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;
        setConnectionState('error');

        // Attempt reconnection
        if (reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          setError(`Connection lost. Reconnecting... (${reconnectAttempts.current}/${maxReconnectAttempts})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        } else {
          setError('Connection failed. Max reconnection attempts reached.');
          setConnectionState('disconnected');
        }
      };
    } catch (e) {
      setConnectionState('error');
      setError(`Failed to connect: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [issueIds, handleEvent, maxReconnectAttempts, reconnectDelay]);

  /**
   * Disconnect from the SSE stream.
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionState('disconnected');
    reconnectAttempts.current = 0;
  }, []);

  /**
   * Clear all activities and metrics.
   */
  const clear = useCallback(() => {
    setActivities(new Map());
    setMetrics(new Map());
    setCompletedIssues(new Set());
    setFailedIssues(new Map());
    pendingActivities.current.clear();
  }, []);

  // Auto-connect when issueIds change
  useEffect(() => {
    if (autoConnect && issueIds.length > 0) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, issueIds, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    activities,
    metrics,
    error,
    completedIssues,
    failedIssues,
    connect,
    disconnect,
    clear,
  };
}

export default useProcessingStream;
