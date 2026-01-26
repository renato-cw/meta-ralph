import { spawn } from 'child_process';
import path from 'path';
import type { Issue, ProcessingOptions } from './types';
import { DEFAULT_PROCESSING_OPTIONS } from './types';

const META_RALPH_PATH = path.resolve(process.cwd(), '..', 'meta-ralph.sh');
const META_RALPH_DIR = path.dirname(META_RALPH_PATH);

// Target repository where meta-ralph will work (can be configured via env)
const TARGET_REPO = process.env.TARGET_REPO || META_RALPH_DIR;

// Providers to fetch issues from (can be configured via env)
const PROVIDERS = process.env.PROVIDERS || 'zeropath,sentry,codecov';

// Re-export DEFAULT_PROCESSING_OPTIONS for convenience
export { DEFAULT_PROCESSING_OPTIONS };

export async function fetchIssues(): Promise<Issue[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', [META_RALPH_PATH, '--dry-run', '--json', '--providers', PROVIDERS], {
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
        // Find JSON array in output (skip any text before it)
        const jsonMatch = stdout.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const issues = JSON.parse(jsonMatch[0]) as Issue[];
          resolve(issues);
        } else {
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
 * Process issues with configurable options.
 *
 * @param issueIds - Array of issue IDs to process
 * @param options - Processing configuration (mode, model, iterations, etc.)
 * @param onLog - Callback for log output
 * @param onComplete - Callback when processing completes
 * @returns Cleanup function to abort processing
 */
export function processIssues(
  issueIds: string[],
  options: ProcessingOptions,
  onLog: (log: string) => void,
  onComplete: (success: boolean) => void
): () => void {
  // Build CLI arguments with processing options
  const args = [
    META_RALPH_PATH,
    '--only-ids', issueIds.join(','),
    '--providers', PROVIDERS,
    '--mode', options.mode,
    '--model', options.model,
    '--auto-push', String(options.autoPush),
    '--max-iterations', String(options.maxIterations),
  ];

  const proc = spawn('bash', args, {
    cwd: META_RALPH_DIR,
    env: { ...process.env, REPO_ROOT: TARGET_REPO },
  });

  proc.stdout.on('data', (data) => {
    onLog(data.toString());
  });

  proc.stderr.on('data', (data) => {
    onLog(`[stderr] ${data.toString()}`);
  });

  proc.on('close', (code) => {
    onComplete(code === 0);
  });

  proc.on('error', (err) => {
    onLog(`[error] ${err.message}`);
    onComplete(false);
  });

  // Return a function to kill the process
  return () => {
    proc.kill('SIGTERM');
  };
}
