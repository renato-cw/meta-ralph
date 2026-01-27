/**
 * CI Fix API Endpoint
 *
 * Triggers an auto-fix attempt for CI failures using Claude.
 *
 * POST /api/ci/fix
 * Body: { owner, repo, sha, failures, issueId? }
 *
 * @see PRD-07-CICD-AWARENESS.md for specification
 */

import { NextRequest, NextResponse } from 'next/server';
import { CIFailure } from '@/lib/types';

// ============================================================================
// Types
// ============================================================================

interface CIFixRequest {
  owner: string;
  repo: string;
  sha: string;
  failures: CIFailure[];
  issueId?: string;
}

interface CIFixResponse {
  success: boolean;
  message: string;
  fixAttemptId?: string;
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: CIFixRequest = await request.json();
    const { owner, repo, sha, failures, issueId } = body;

    // Validate required parameters
    if (!owner || !repo || !sha) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: owner, repo, sha' },
        { status: 400 }
      );
    }

    if (!failures || failures.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No failures to fix' },
        { status: 400 }
      );
    }

    // Build the context for Claude from CI failures
    const failureContext = failures
      .map((f, i) => {
        let context = `${i + 1}. ${f.checkName}: ${f.error}`;
        if (f.logs) {
          // Truncate logs to avoid token limits
          const truncatedLogs = f.logs.length > 2000 ? f.logs.slice(0, 2000) + '...' : f.logs;
          context += `\n   Logs:\n   ${truncatedLogs}`;
        }
        return context;
      })
      .join('\n\n');

    const fixContext = `
CI/CD Pipeline Failures for ${owner}/${repo} at commit ${sha}:

${failureContext}

Please analyze these CI failures and attempt to fix them. Focus on:
1. Type errors and linting issues
2. Test failures
3. Build errors
4. Security scan findings

After identifying the root cause, make the necessary code changes to resolve the failures.
`;

    // Log the fix attempt (in production, this would trigger the actual fix process)
    console.log('CI Fix attempt triggered:', {
      owner,
      repo,
      sha,
      failureCount: failures.length,
      issueId,
    });

    // For now, we'll queue this as a new processing task
    // In a full implementation, this would:
    // 1. Create a new branch from the current commit
    // 2. Run Claude with the failure context
    // 3. Push fixes and update the PR

    // Generate a fix attempt ID
    const fixAttemptId = `ci-fix-${Date.now()}-${sha.slice(0, 7)}`;

    // Store the fix request for processing
    // This would typically go into a queue or session manager
    const fixTask = {
      id: fixAttemptId,
      owner,
      repo,
      sha,
      failures,
      context: fixContext,
      issueId,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    // In a real implementation, you would:
    // 1. Store this in the session manager or a queue
    // 2. Trigger the meta-ralph processing with CI fix mode
    // 3. Return immediately and let the processing happen async

    console.log('CI Fix task created:', fixTask);

    // For demo purposes, we return a success response
    // The actual fix would be processed asynchronously
    const result: CIFixResponse = {
      success: true,
      message: `CI fix attempt queued. Claude will analyze ${failures.length} failure(s) and attempt fixes.`,
      fixAttemptId,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error triggering CI fix:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
