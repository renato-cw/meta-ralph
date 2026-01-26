import { spawn } from 'child_process';
import path from 'path';
import type { Issue } from './types';

const META_RALPH_PATH = path.resolve(process.cwd(), '..', 'meta-ralph.sh');
const META_RALPH_DIR = path.dirname(META_RALPH_PATH);

// Target repository where meta-ralph will work (can be configured via env)
const TARGET_REPO = process.env.TARGET_REPO || META_RALPH_DIR;

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

export function processIssues(
  issueIds: string[],
  onLog: (log: string) => void,
  onComplete: (success: boolean) => void
): () => void {
  const proc = spawn(
    'bash',
    [META_RALPH_PATH, '--only-ids', issueIds.join(',')],
    {
      cwd: META_RALPH_DIR,
      env: { ...process.env, REPO_ROOT: TARGET_REPO },
    }
  );

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
