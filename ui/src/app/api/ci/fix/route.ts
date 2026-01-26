import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { CIFixRequest, CIFixResponse } from '@/lib/types';

// Path to the meta-ralph script
const META_RALPH_PATH = path.resolve(process.cwd(), '..', 'meta-ralph.sh');
const WORK_DIR = path.resolve(process.cwd(), '..');

/**
 * POST /api/ci/fix
 *
 * Trigger an auto-fix attempt for CI failures.
 * This endpoint will:
 * 1. Fetch the CI failure logs
 * 2. Pass them to Claude for analysis
 * 3. Apply suggested fixes
 * 4. Commit and push the changes
 *
 * Request body:
 * - issueId: The original issue ID being fixed
 * - sha: The commit SHA that failed
 * - branch: The branch to fix
 * - failedChecks: Array of failed check names
 *
 * Environment variables required:
 * - GITHUB_TOKEN: GitHub personal access token
 * - GITHUB_REPO: Repository in owner/repo format
 */
export async function POST(request: NextRequest) {
  let body: CIFixRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { issueId, sha, branch, failedChecks } = body;

  // Validate required fields
  if (!issueId || !sha || !branch) {
    return NextResponse.json(
      { error: 'Missing required fields: issueId, sha, branch' },
      { status: 400 }
    );
  }

  if (!failedChecks || failedChecks.length === 0) {
    const response: CIFixResponse = {
      success: false,
      message: 'No failed checks specified',
      fixAttempted: false,
    };
    return NextResponse.json(response);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;

  if (!githubToken || !githubRepo) {
    const response: CIFixResponse = {
      success: false,
      message: 'GitHub configuration missing',
      fixAttempted: false,
    };
    return NextResponse.json(response, { status: 500 });
  }

  try {
    // First, fetch logs for each failed check to build context
    const failureLogs: string[] = [];

    for (const checkName of failedChecks.slice(0, 3)) { // Limit to 3 checks
      try {
        const logsUrl = new URL('/api/ci/logs', request.url);
        // We need the check ID, but we only have the name
        // For now, just include the check name in the context
        failureLogs.push(`\n=== Failed Check: ${checkName} ===\n`);
      } catch {
        failureLogs.push(`\n=== Failed Check: ${checkName} (logs unavailable) ===\n`);
      }
    }

    // Build the CI fix prompt for Claude
    const ciFixPrompt = `
CI FAILURE AUTO-FIX ATTEMPT

The following CI checks have failed on branch "${branch}" (commit ${sha}):
${failedChecks.map(c => `- ${c}`).join('\n')}

Your task:
1. Identify the root cause of the CI failures
2. Apply minimal fixes to make the checks pass
3. Do NOT change functionality - only fix CI issues (tests, types, lint)
4. Focus on the most likely causes based on the check names

Common CI failure patterns:
- "typecheck" or "tsc": TypeScript errors - check for type mismatches
- "lint" or "eslint": Linting errors - fix formatting/style issues
- "test" or "jest": Test failures - fix broken tests or update snapshots
- "build": Build errors - check imports and dependencies

After fixing, commit with message: "fix(ci): resolve CI failures for ${issueId}"
`;

    // Spawn meta-ralph.sh with CI fix mode
    // The script will use Claude to analyze and fix the issues
    const args = [
      META_RALPH_PATH,
      '--ci-fix',
      '--issue-id', issueId,
      '--branch', branch,
      '--sha', sha,
      '--fix-prompt', ciFixPrompt,
      '--auto-push', 'true',
    ];

    // Note: In a real implementation, we would spawn the process
    // and track its progress. For now, we return a placeholder
    // indicating the fix was triggered.

    // Check if meta-ralph.sh exists
    const fs = await import('fs/promises');
    try {
      await fs.access(META_RALPH_PATH);
    } catch {
      // Script doesn't exist - this is expected in development
      // Return a mock response indicating manual fix is needed
      const response: CIFixResponse = {
        success: false,
        message: `CI fix triggered but meta-ralph.sh not found at ${META_RALPH_PATH}. Manual intervention required.`,
        fixAttempted: true,
      };
      return NextResponse.json(response);
    }

    // Spawn the child process asynchronously
    return new Promise((resolve) => {
      const childProcess = spawn('bash', args, {
        cwd: WORK_DIR,
        env: {
          ...globalThis.process.env,
          GITHUB_TOKEN: githubToken,
          CI_FIX_MODE: 'true',
        },
        detached: true,
        stdio: 'ignore',
      });

      childProcess.unref();

      // Return immediately - the fix will run in the background
      const response: CIFixResponse = {
        success: true,
        message: `CI fix initiated for ${failedChecks.length} failed check(s). Monitor progress in the activity feed.`,
        fixAttempted: true,
      };
      resolve(NextResponse.json(response));
    });
  } catch (error) {
    console.error('Error triggering CI fix:', error);
    const response: CIFixResponse = {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to trigger CI fix',
      fixAttempted: false,
    };
    return NextResponse.json(response, { status: 500 });
  }
}
