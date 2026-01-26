/**
 * Processing Session Manager
 *
 * Manages active processing sessions and event subscriptions for SSE streaming.
 * Provides state management for issue processing with real-time updates.
 *
 * @see PRD-03-JSON-STREAMING.md for specification
 */

import {
  Activity,
  ExecutionMetrics,
  ProcessingOptions,
  StreamEvent,
  DEFAULT_PROCESSING_OPTIONS,
} from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Active processing session state.
 */
export interface ProcessingSession {
  issueId: string;
  options: ProcessingOptions;
  activities: Activity[];
  metrics: ExecutionMetrics | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  startedAt: string;
  completedAt?: string;
}

// ============================================================================
// State Management
// ============================================================================

// In-memory store for active processing sessions
// In production, this would be Redis or similar
const sessions = new Map<string, ProcessingSession>();

// Event subscribers by issue ID
const subscribers = new Map<string, Set<(event: StreamEvent) => void>>();

// ============================================================================
// Session Management
// ============================================================================

/**
 * Get an existing processing session.
 */
export function getSession(issueId: string): ProcessingSession | undefined {
  return sessions.get(issueId);
}

/**
 * Create a new processing session.
 */
export function createSession(
  issueId: string,
  options: ProcessingOptions = DEFAULT_PROCESSING_OPTIONS
): ProcessingSession {
  const session: ProcessingSession = {
    issueId,
    options,
    activities: [],
    metrics: null,
    status: 'pending',
    startedAt: new Date().toISOString(),
  };
  sessions.set(issueId, session);
  return session;
}

/**
 * Delete a processing session.
 */
export function deleteSession(issueId: string): boolean {
  subscribers.delete(issueId);
  return sessions.delete(issueId);
}

/**
 * Get all active sessions.
 */
export function getActiveSessions(): ProcessingSession[] {
  return Array.from(sessions.values());
}

// ============================================================================
// Event Management
// ============================================================================

/**
 * Emit an event to all subscribers for an issue.
 */
export function emitEvent(issueId: string, event: StreamEvent): void {
  const subs = subscribers.get(issueId);
  if (subs) {
    subs.forEach((callback) => {
      try {
        callback(event);
      } catch (e) {
        console.error('Error in SSE subscriber callback:', e);
      }
    });
  }

  // Also update session state
  const session = sessions.get(issueId);
  if (session) {
    if (event.type === 'activity') {
      session.activities.push(event.payload as Activity);
      // Keep only last 500 activities
      if (session.activities.length > 500) {
        session.activities = session.activities.slice(-500);
      }
    } else if (event.type === 'metrics') {
      session.metrics = event.payload as ExecutionMetrics;
    } else if (event.type === 'complete') {
      session.status = 'completed';
      session.completedAt = new Date().toISOString();
    } else if (event.type === 'error') {
      session.status = 'failed';
      session.error = (event.payload as { error: string }).error;
      session.completedAt = new Date().toISOString();
    }
  }
}

/**
 * Subscribe to events for an issue.
 */
export function subscribe(
  issueId: string,
  callback: (event: StreamEvent) => void
): () => void {
  if (!subscribers.has(issueId)) {
    subscribers.set(issueId, new Set());
  }
  subscribers.get(issueId)!.add(callback);

  // Return unsubscribe function
  return () => {
    const subs = subscribers.get(issueId);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        subscribers.delete(issueId);
      }
    }
  };
}

// ============================================================================
// Processing Control
// ============================================================================

/**
 * Start processing for an issue.
 */
export function startProcessing(
  issueId: string,
  options: ProcessingOptions = DEFAULT_PROCESSING_OPTIONS
): ProcessingSession {
  const session = createSession(issueId, options);
  session.status = 'processing';

  // Emit start activity
  const startActivity: Activity = {
    id: `start-${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: 'message',
    details: `Starting processing in ${options.mode} mode with ${options.model}`,
    status: 'success',
  };

  emitEvent(issueId, {
    type: 'activity',
    issueId,
    payload: startActivity,
  });

  return session;
}

/**
 * Complete processing for an issue.
 */
export function completeProcessing(
  issueId: string,
  success: boolean,
  message?: string
): void {
  const session = sessions.get(issueId);
  if (session) {
    session.status = success ? 'completed' : 'failed';
    session.completedAt = new Date().toISOString();
    if (!success) {
      session.error = message;
    }
  }

  if (success) {
    emitEvent(issueId, {
      type: 'complete',
      issueId,
      payload: { message: message || 'Processing completed successfully' },
    });
  } else {
    emitEvent(issueId, {
      type: 'error',
      issueId,
      payload: { error: message || 'Processing failed' },
    });
  }

  // Schedule cleanup after 5 minutes
  scheduleCleanup(issueId, 300000);
}

/**
 * Clean up completed sessions after a delay.
 */
export function scheduleCleanup(issueId: string, delayMs = 300000): void {
  setTimeout(() => {
    const session = sessions.get(issueId);
    if (session && (session.status === 'completed' || session.status === 'failed')) {
      deleteSession(issueId);
    }
  }, delayMs);
}
