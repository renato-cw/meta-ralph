import { spawn } from 'child_process';
import path from 'path';
import type { Issue, ProcessingOptions, StreamEvent, Activity, ExecutionMetrics } from './types';
import { emitEvent, startProcessing, completeProcessing } from './session-manager';

const META_RALPH_PATH = path.resolve(process.cwd(), '..', 'meta-ralph.sh');
const META_RALPH_DIR = path.dirname(META_RALPH_PATH);

// Target repository where meta-ralph will work (can be configured via env)
const TARGET_REPO = process.env.TARGET_REPO || META_RALPH_DIR;

// Event prefix for streaming mode
const RALPH_EVENT_PREFIX = 'RALPH_EVENT:';

/**
 * Parse a RALPH_EVENT line from the CLI output.
 * Returns the parsed StreamEvent or null if not a valid event line.
 */
function parseRalphEventLine(line: string): StreamEvent | null {
  if (!line.startsWith(RALPH_EVENT_PREFIX)) {
    return null;
  }

  const jsonStr = line.slice(RALPH_EVENT_PREFIX.length);
  try {
    return JSON.parse(jsonStr) as StreamEvent;
  } catch {
    console.error('Failed to parse RALPH_EVENT:', jsonStr);
    return null;
  }
}

/**
 * Emit a stream event to the session manager.
 */
function emitStreamEvent(event: StreamEvent): void {
  emitEvent(event.issueId, event);
}

export async function fetchIssues(): Promise<Issue[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', [META_RALPH_PATH, '--dry-run', '--json'], {
      cwd: META_RALPH_DIR,
      env: { ...process.env, REPO_ROOT: TARGET_REPO },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        // If --json flag is not yet implemented, return mock data for now
        if (stderr.includes('unrecognized option') || stderr.includes('--json')) {
          console.warn('--json flag not implemented, using fallback');
          resolve([]);
          return;
        }
        reject(new Error(`meta-ralph exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Strip ANSI escape codes before parsing
        // eslint-disable-next-line no-control-regex
        const cleanOutput = stdout.replace(/\x1b\[[0-9;]*m/g, '');

        // Find JSON array in output (skip any text before it)
        // Use a more specific pattern that starts with [ followed by { for an array of objects
        const jsonMatch = cleanOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          const issues = JSON.parse(jsonMatch[0]) as Issue[];
          resolve(issues);
        } else {
          // No JSON array found, return empty
          resolve([]);
        }
      } catch (e) {
        reject(new Error(`Failed to parse issues JSON: ${e}`));
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn meta-ralph: ${err.message}`));
    });
  });
}

/**
 * Default processing options.
 */
const DEFAULT_OPTIONS: ProcessingOptions = {
  mode: 'build',
  model: 'sonnet',
  maxIterations: 10,
  autoPush: true,
  ciAwareness: false,
  autoFixCi: false,
};

/**
 * Process issues with streaming support.
 *
 * @param issueIds - Array of issue IDs to process
 * @param onLog - Callback for log messages (legacy support)
 * @param onComplete - Callback when processing completes
 * @param options - Processing options (mode, model, iterations, etc.)
 * @returns Function to cancel processing
 */
export function processIssues(
  issueIds: string[],
  onLog: (log: string) => void,
  onComplete: (success: boolean) => void,
  options: Partial<ProcessingOptions> = {}
): () => void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Initialize sessions for all issues
  for (const issueId of issueIds) {
    startProcessing(issueId, opts);
  }

  // Build CLI arguments
  const args = [
    META_RALPH_PATH,
    '--only-ids', issueIds.join(','),
  ];

  // Add options as environment variables for the CLI
  const env = {
    ...process.env,
    REPO_ROOT: TARGET_REPO,
    RALPH_STREAM_MODE: 'true',  // Enable streaming events
    RALPH_MODE: opts.mode,
    RALPH_MODEL: opts.model,
    RALPH_MAX_ITERATIONS: String(opts.maxIterations),
    RALPH_AUTO_PUSH: opts.autoPush ? 'true' : 'false',
  };

  const proc = spawn('bash', args, { cwd: META_RALPH_DIR, env });

  // Track current issue being processed
  let currentIssueId = issueIds[0];
  let lineBuffer = '';

  proc.stdout.on('data', (data) => {
    const chunk = data.toString();
    lineBuffer += chunk;

    // Process complete lines
    const lines = lineBuffer.split('\n');
    lineBuffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      if (!line.trim()) continue;

      // Try to parse as RALPH_EVENT
      const event = parseRalphEventLine(line);
      if (event) {
        emitStreamEvent(event);

        // Track current issue from events
        if (event.issueId && event.issueId !== 'system') {
          currentIssueId = event.issueId;
        }

        // Also emit to legacy log callback
        if (event.type === 'activity') {
          const activity = event.payload as Activity;
          onLog(`[${activity.type}] ${activity.details || ''}`);
        } else if (event.type === 'metrics') {
          const metrics = event.payload as ExecutionMetrics;
          onLog(`[metrics] Iteration ${metrics.iteration}/${metrics.maxIterations}, cost: $${metrics.costUsd?.toFixed(4) || '0'}`);
        } else if (event.type === 'complete') {
          onLog(`[complete] ${(event.payload as { message: string }).message}`);
        } else if (event.type === 'error') {
          onLog(`[error] ${(event.payload as { error: string }).error}`);
        }
      } else {
        // Not an event line - just a regular log
        onLog(line);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const message = data.toString();
    onLog(`[stderr] ${message}`);

    // Emit as error activity if we have a current issue
    if (currentIssueId) {
      emitEvent(currentIssueId, {
        type: 'activity',
        issueId: currentIssueId,
        payload: {
          id: `stderr-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'error',
          details: message.trim(),
          status: 'error',
        } as Activity,
      });
    }
  });

  proc.on('close', (code) => {
    // Process any remaining buffered data
    if (lineBuffer.trim()) {
      const event = parseRalphEventLine(lineBuffer);
      if (event) {
        emitStreamEvent(event);
      } else {
        onLog(lineBuffer);
      }
    }

    const success = code === 0;

    // Complete all sessions
    for (const issueId of issueIds) {
      completeProcessing(
        issueId,
        success,
        success ? 'Processing completed' : `Processing failed with code ${code}`
      );
    }

    onComplete(success);
  });

  proc.on('error', (err) => {
    onLog(`[error] ${err.message}`);

    // Complete all sessions with error
    for (const issueId of issueIds) {
      completeProcessing(issueId, false, err.message);
    }

    onComplete(false);
  });

  // Return a function to kill the process
  return () => {
    proc.kill('SIGTERM');

    // Mark all sessions as failed
    for (const issueId of issueIds) {
      completeProcessing(issueId, false, 'Processing cancelled');
    }
  };
}
