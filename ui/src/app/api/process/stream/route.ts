/**
 * SSE API Endpoint for Processing Stream
 *
 * Streams real-time activity and metrics events to the client during
 * issue processing via Server-Sent Events (SSE).
 *
 * @see PRD-03-JSON-STREAMING.md for specification
 */

import { NextRequest } from 'next/server';
import { StreamEvent } from '@/lib/types';
import { formatSSE } from '@/lib/events';
import { getSession, subscribe } from '@/lib/session-manager';

// ============================================================================
// SSE Endpoint Handler
// ============================================================================

/**
 * GET /api/process/stream
 *
 * Stream processing events via Server-Sent Events.
 *
 * Query params:
 * - ids: Comma-separated issue IDs to subscribe to (required)
 *
 * Response: text/event-stream with events:
 * - data: {"type": "activity", "issueId": "...", "payload": {...}}
 * - data: {"type": "metrics", "issueId": "...", "payload": {...}}
 * - data: {"type": "complete", "issueId": "...", "payload": {"message": "..."}}
 * - data: {"type": "error", "issueId": "...", "payload": {"error": "..."}}
 */
export async function GET(request: NextRequest): Promise<Response> {
  const searchParams = request.nextUrl.searchParams;
  const idsParam = searchParams.get('ids');

  if (!idsParam) {
    return new Response(JSON.stringify({ error: 'Missing ids parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const issueIds = idsParam.split(',').filter(Boolean);

  if (issueIds.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid issue IDs provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let isActive = true;
  const unsubscribeFns: Array<() => void> = [];

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent: StreamEvent = {
        type: 'activity',
        issueId: 'system',
        payload: {
          id: `connect-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'message',
          details: `Connected to stream for ${issueIds.length} issue(s)`,
          status: 'success',
        },
      };
      controller.enqueue(encoder.encode(formatSSE(connectEvent)));

      // Send any existing activities for each issue
      for (const issueId of issueIds) {
        const session = getSession(issueId);
        if (session) {
          // Send existing activities
          for (const activity of session.activities) {
            const event: StreamEvent = {
              type: 'activity',
              issueId,
              payload: activity,
            };
            controller.enqueue(encoder.encode(formatSSE(event)));
          }

          // Send current metrics if available
          if (session.metrics) {
            const metricsEvent: StreamEvent = {
              type: 'metrics',
              issueId,
              payload: session.metrics,
            };
            controller.enqueue(encoder.encode(formatSSE(metricsEvent)));
          }

          // If already completed, send completion event
          if (session.status === 'completed') {
            const completeEvent: StreamEvent = {
              type: 'complete',
              issueId,
              payload: { message: 'Processing completed' },
            };
            controller.enqueue(encoder.encode(formatSSE(completeEvent)));
          } else if (session.status === 'failed') {
            const errorEvent: StreamEvent = {
              type: 'error',
              issueId,
              payload: { error: session.error || 'Processing failed' },
            };
            controller.enqueue(encoder.encode(formatSSE(errorEvent)));
          }
        }

        // Subscribe to new events
        const unsubscribe = subscribe(issueId, (event) => {
          if (isActive) {
            try {
              controller.enqueue(encoder.encode(formatSSE(event)));
            } catch {
              // Stream closed
              isActive = false;
            }
          }
        });
        unsubscribeFns.push(unsubscribe);
      }

      // Send heartbeat every 30 seconds to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (isActive) {
          try {
            const heartbeat = `:heartbeat ${new Date().toISOString()}\n\n`;
            controller.enqueue(encoder.encode(heartbeat));
          } catch {
            isActive = false;
            clearInterval(heartbeatInterval);
          }
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000);
    },

    cancel() {
      isActive = false;
      // Clean up subscriptions
      unsubscribeFns.forEach((fn) => fn());
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
