import { NextRequest, NextResponse } from 'next/server';
import { CIStatus, CICheck, CIOverallStatus } from '@/lib/types';

/**
 * Compute overall CI status from individual checks.
 */
function computeOverallStatus(checks: CICheck[]): CIOverallStatus {
  if (checks.length === 0) return 'pending';

  const hasRunning = checks.some(c => c.status === 'in_progress');
  const hasPending = checks.some(c => c.status === 'queued');
  const allCompleted = checks.every(c => c.status === 'completed');

  if (hasRunning) return 'running';
  if (hasPending) return 'pending';

  if (allCompleted) {
    const hasFailure = checks.some(c => c.conclusion === 'failure');
    const hasSuccess = checks.some(c => c.conclusion === 'success');

    if (hasFailure && hasSuccess) return 'mixed';
    if (hasFailure) return 'failure';
    return 'success';
  }

  return 'pending';
}

/**
 * GET /api/ci/status
 *
 * Fetch CI check runs from GitHub for a specific commit.
 * Uses the GitHub API to get check runs for the given SHA.
 *
 * Query parameters:
 * - sha: The commit SHA to check
 * - branch: The branch name (optional, for display)
 *
 * Environment variables required:
 * - GITHUB_TOKEN: GitHub personal access token
 * - GITHUB_REPO: Repository in owner/repo format (e.g., "user/repo")
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sha = searchParams.get('sha');
  const branch = searchParams.get('branch') || 'unknown';

  if (!sha) {
    return NextResponse.json(
      { error: 'Missing required parameter: sha' },
      { status: 400 }
    );
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;

  if (!githubToken) {
    return NextResponse.json(
      { error: 'GitHub token not configured. Set GITHUB_TOKEN environment variable.' },
      { status: 500 }
    );
  }

  if (!githubRepo) {
    return NextResponse.json(
      { error: 'GitHub repository not configured. Set GITHUB_REPO environment variable (owner/repo format).' },
      { status: 500 }
    );
  }

  try {
    // Fetch check runs from GitHub API
    const response = await fetch(
      `https://api.github.com/repos/${githubRepo}/commits/${sha}/check-runs`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        // Don't cache - we want fresh data
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('GitHub API error:', response.status, errorText);

      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Commit not found or no check runs available yet' },
          { status: 404 }
        );
      }

      if (response.status === 401) {
        return NextResponse.json(
          { error: 'GitHub authentication failed. Check GITHUB_TOKEN.' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: `GitHub API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform GitHub check runs to our format
    const checks: CICheck[] = (data.check_runs || []).map((run: Record<string, unknown>) => ({
      id: String(run.id),
      name: run.name as string,
      status: run.status as CICheck['status'],
      conclusion: run.conclusion as CICheck['conclusion'],
      startedAt: run.started_at as string | null,
      completedAt: run.completed_at as string | null,
      detailsUrl: run.html_url as string || run.details_url as string || '',
      output: run.output ? {
        title: (run.output as Record<string, unknown>).title as string | null,
        summary: (run.output as Record<string, unknown>).summary as string | null,
        text: (run.output as Record<string, unknown>).text as string | null,
      } : undefined,
    }));

    // Compute overall status
    const overallStatus = computeOverallStatus(checks);

    const ciStatus: CIStatus = {
      sha,
      branch,
      checks,
      overallStatus,
      lastPolledAt: new Date().toISOString(),
    };

    return NextResponse.json(ciStatus);
  } catch (error) {
    console.error('Error fetching CI status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch CI status' },
      { status: 500 }
    );
  }
}
