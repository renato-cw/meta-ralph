import { NextRequest } from 'next/server';
import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';
import { ProcessingOptions, DEFAULT_PROCESSING_OPTIONS, Activity, ExecutionMetrics } from '@/lib/types';

/**
 * Get the meta-ralph directory path.
 */
const META_RALPH_DIR = resolve(process.cwd(), '..');
const META_RALPH_PATH = resolve(META_RALPH_DIR, 'meta-ralph.sh');
const TARGET_REPO = process.env.TARGET_REPO || process.cwd();
const PROVIDERS = process.env.PROVIDERS || 'zeropath,sentry,codecov';

/**
 * Active streaming processes.
 */
const activeProcesses = new Map<string, ChildProcess>();

/**
 * Generate a unique stream ID.
 */
function generateStreamId(): string {
  return `stream-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parse a JSON event from Claude's stream-json output.
 */
function parseClaudeEvent(
  line: string
): { activity?: Activity; metrics?: ExecutionMetrics } | null {
  if (!line.trim()) return null;

  try {
    const event = JSON.parse(line);
    const timestamp = new Date().toISOString();
    const id = `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    switch (event.type) {
      case 'assistant': {
        const text = event.message?.content?.[0]?.text;
        if (text) {
          return {
            activity: {
              id,
              timestamp,
              type: 'message',
              details: text.length > 200 ? text.slice(0, 200) + '...' : text,
              status: 'success',
            },
          };
        }
        break;
      }

      case 'content_block_start': {
        if (event.content_block?.type === 'tool_use' && event.content_block.name) {
          return {
            activity: {
              id,
              timestamp,
              type: 'tool',
              tool: event.content_block.name,
              details: `Starting ${event.content_block.name}...`,
              status: 'pending',
            },
          };
        }
        break;
      }

      case 'result': {
        const costUsd = event.result?.cost_usd || 0;
        const durationMs = event.result?.duration_ms || 0;
        return {
          activity: {
            id,
            timestamp,
            type: 'result',
            details: `Complete - $${costUsd.toFixed(4)} / ${(durationMs / 1000).toFixed(1)}s`,
            status: event.result?.is_error ? 'error' : 'success',
          },
          metrics: {
            iteration: event.result?.num_turns || 1,
            maxIterations: 10,
            costUsd,
            durationMs,
            totalCostUsd: event.result?.total_cost_usd || costUsd,
            totalDurationMs: event.result?.total_duration_ms || durationMs,
          },
        };
      }

      case 'error':
        return {
          activity: {
            id,
            timestamp,
            type: 'error',
            details: event.error?.message || 'Unknown error',
            status: 'error',
          },
        };
    }
  } catch {
    // Not JSON - return as log
    return {
      activity: {
        id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date().toISOString(),
        type: 'message',
        details: line,
        status: 'success',
      },
    };
  }

  return null;
}

/**
 * SSE streaming endpoint for processing issues.
 * Streams JSON events from meta-ralph.sh execution in real-time.
 *
 * Query Parameters:
 * - ids: Comma-separated issue IDs to process
 * - mode: Processing mode (plan/build)
 * - model: Model to use (sonnet/opus)
 * - maxIterations: Maximum iterations
 * - autoPush: Auto-push after completion
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const idsParam = searchParams.get('ids');

  if (!idsParam) {
    return new Response(JSON.stringify({ error: 'No issue IDs provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ids = idsParam.split(',').filter(Boolean);
  if (ids.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid issue IDs provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Parse options from query params
  const options: ProcessingOptions = {
    mode: (searchParams.get('mode') as 'plan' | 'build') || DEFAULT_PROCESSING_OPTIONS.mode,
    model: (searchParams.get('model') as 'sonnet' | 'opus') || DEFAULT_PROCESSING_OPTIONS.model,
    maxIterations: parseInt(searchParams.get('maxIterations') || String(DEFAULT_PROCESSING_OPTIONS.maxIterations), 10),
    autoPush: searchParams.get('autoPush') !== 'false',
    ciAwareness: searchParams.get('ciAwareness') === 'true',
    autoFixCi: searchParams.get('autoFixCi') === 'true',
  };

  const streamId = generateStreamId();

  // Create the SSE stream
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Helper to send SSE event
      const sendEvent = (type: string, payload: unknown) => {
        const data = JSON.stringify({ type, payload });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      // Send initial connected event
      sendEvent('log', `Starting processing of ${ids.length} issue(s)...`);
      sendEvent('log', `Mode: ${options.mode} | Model: ${options.model} | Max iterations: ${options.maxIterations}`);
      sendEvent('log', `Auto-push: ${options.autoPush} | CI awareness: ${options.ciAwareness}`);

      // Build command arguments
      const args = [
        META_RALPH_PATH,
        '--only-ids', ids.join(','),
        '--providers', PROVIDERS,
        '--mode', options.mode,
        '--model', options.model,
        '--auto-push', String(options.autoPush),
        '--max-iterations', String(options.maxIterations),
      ];

      // Spawn the process
      const proc = spawn('bash', args, {
        cwd: META_RALPH_DIR,
        env: { ...process.env, REPO_ROOT: TARGET_REPO },
      });

      activeProcesses.set(streamId, proc);

      // Process stdout
      proc.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;

          const parsed = parseClaudeEvent(line);
          if (parsed) {
            if (parsed.activity) {
              sendEvent('activity', parsed.activity);
            }
            if (parsed.metrics) {
              sendEvent('metrics', parsed.metrics);
            }
          } else {
            // Raw log line
            sendEvent('log', line);
          }
        }
      });

      // Process stderr
      proc.stderr.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          sendEvent('log', `[stderr] ${line}`);
        }
      });

      // Handle process completion
      proc.on('close', (code: number | null) => {
        sendEvent('complete', {
          success: code === 0,
          message: code === 0 ? 'Processing completed successfully' : `Process exited with code ${code}`,
        });
        activeProcesses.delete(streamId);
        controller.close();
      });

      // Handle process error
      proc.on('error', (err: Error) => {
        sendEvent('error', { message: err.message });
        activeProcesses.delete(streamId);
        controller.close();
      });
    },

    cancel() {
      // Kill the process if the connection is closed
      const proc = activeProcesses.get(streamId);
      if (proc) {
        proc.kill('SIGTERM');
        activeProcesses.delete(streamId);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Stream-Id': streamId,
    },
  });
}

/**
 * DELETE endpoint to cancel an active stream.
 */
export async function DELETE(request: NextRequest) {
  const streamId = request.nextUrl.searchParams.get('streamId');

  if (!streamId) {
    return new Response(JSON.stringify({ error: 'No stream ID provided' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const proc = activeProcesses.get(streamId);
  if (proc) {
    proc.kill('SIGTERM');
    activeProcesses.delete(streamId);
    return new Response(JSON.stringify({ success: true, message: 'Stream cancelled' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Stream not found' }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}
