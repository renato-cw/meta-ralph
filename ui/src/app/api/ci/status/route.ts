/**
 * CI Status API Endpoint
 *
 * Fetches GitHub check run status for a commit SHA.
 *
 * GET /api/ci/status?sha={sha}&owner={owner}&repo={repo}
 *
 * @see PRD-07-CICD-AWARENESS.md for specification
 */

import { NextRequest, NextResponse } from 'next/server';
import { CICheck, CIStatus, CIStatusResponse, CIFailure } from '@/lib/types';

// ============================================================================
// Types for GitHub API Response
// ============================================================================

interface GitHubCheckRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  started_at: string;
  completed_at: string | null;
  html_url: string;
  output: {
    title: string | null;
    summary: string | null;
    text: string | null;
  };
}

interface GitHubCheckRunsResponse {
  total_count: number;
  check_runs: GitHubCheckRun[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map GitHub check run status to our CIStatus type.
 */
function mapGitHubStatus(ghRun: GitHubCheckRun): CIStatus {
  if (ghRun.status === 'queued') {
    return 'pending';
  }
  if (ghRun.status === 'in_progress') {
    return 'running';
  }
  // status === 'completed'
  switch (ghRun.conclusion) {
    case 'success':
    case 'neutral':
      return 'success';
    case 'failure':
    case 'timed_out':
    case 'action_required':
      return 'failure';
    case 'cancelled':
      return 'cancelled';
    case 'skipped':
      return 'skipped';
    default:
      return 'pending';
  }
}

/**
 * Calculate overall status from individual check statuses.
 */
function calculateOverallStatus(checks: CICheck[]): CIStatus {
  if (checks.length === 0) {
    return 'pending';
  }

  const hasFailure = checks.some((c) => c.status === 'failure');
  const hasCancelled = checks.some((c) => c.status === 'cancelled');
  const hasRunning = checks.some((c) => c.status === 'running');
  const hasPending = checks.some((c) => c.status === 'pending');
  const allSuccess = checks.every((c) => c.status === 'success' || c.status === 'skipped');

  if (hasFailure) return 'failure';
  if (hasCancelled) return 'cancelled';
  if (hasRunning) return 'running';
  if (hasPending) return 'pending';
  if (allSuccess) return 'success';

  return 'pending';
}

/**
 * Extract failure details from check runs.
 */
function extractFailures(checks: CICheck[], ghRuns: GitHubCheckRun[]): CIFailure[] {
  return checks
    .filter((c) => c.status === 'failure')
    .map((check) => {
      const ghRun = ghRuns.find((r) => r.id.toString() === check.id);
      const errorSummary =
        ghRun?.output?.summary ||
        ghRun?.output?.title ||
        `Check "${check.name}" failed`;

      return {
        checkName: check.name,
        error: errorSummary,
        logs: ghRun?.output?.text || undefined,
      };
    });
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sha = searchParams.get('sha');
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');

  // Validate required parameters
  if (!sha || !owner || !repo) {
    return NextResponse.json(
      { error: 'Missing required parameters: sha, owner, repo' },
      { status: 400 }
    );
  }

  // Get GitHub token from environment
  const githubToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!githubToken) {
    return NextResponse.json(
      { error: 'GitHub token not configured. Set GITHUB_TOKEN or GH_TOKEN environment variable.' },
      { status: 500 }
    );
  }

  try {
    // Fetch check runs from GitHub API
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs`;
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      // Cache for 10 seconds to avoid rate limiting
      next: { revalidate: 10 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', response.status, errorText);

      if (response.status === 404) {
        return NextResponse.json(
          { error: `Commit ${sha} not found in ${owner}/${repo}` },
          { status: 404 }
        );
      }
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: 'GitHub authentication failed. Check your token permissions.' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: `GitHub API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data: GitHubCheckRunsResponse = await response.json();

    // Transform GitHub response to our format
    const checks: CICheck[] = data.check_runs.map((run) => ({
      id: run.id.toString(),
      name: run.name,
      status: mapGitHubStatus(run),
      conclusion: run.conclusion,
      detailsUrl: run.html_url,
      startedAt: run.started_at,
      completedAt: run.completed_at || undefined,
    }));

    const overallStatus = calculateOverallStatus(checks);
    const failures = extractFailures(checks, data.check_runs);

    const result: CIStatusResponse = {
      prUrl: `https://github.com/${owner}/${repo}/commit/${sha}`,
      sha,
      checks,
      overallStatus,
      failures,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching CI status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
