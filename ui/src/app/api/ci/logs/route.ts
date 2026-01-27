/**
 * CI Logs API Endpoint
 *
 * Fetches logs for a specific GitHub check run.
 *
 * GET /api/ci/logs?checkId={checkId}&owner={owner}&repo={repo}
 *
 * @see PRD-07-CICD-AWARENESS.md for specification
 */

import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// Types
// ============================================================================

interface CILogsResponse {
  checkId: string;
  name: string;
  logs: string;
  downloadUrl?: string;
}

// ============================================================================
// API Handler
// ============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const checkId = searchParams.get('checkId');
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');

  // Validate required parameters
  if (!checkId || !owner || !repo) {
    return NextResponse.json(
      { error: 'Missing required parameters: checkId, owner, repo' },
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
    // First, get the check run details to find the workflow run
    const checkRunUrl = `https://api.github.com/repos/${owner}/${repo}/check-runs/${checkId}`;
    const checkRunResponse = await fetch(checkRunUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!checkRunResponse.ok) {
      if (checkRunResponse.status === 404) {
        return NextResponse.json(
          { error: `Check run ${checkId} not found` },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `GitHub API error: ${checkRunResponse.status}` },
        { status: checkRunResponse.status }
      );
    }

    const checkRun = await checkRunResponse.json();

    // Try to get annotations (which contain error details)
    const annotationsUrl = `https://api.github.com/repos/${owner}/${repo}/check-runs/${checkId}/annotations`;
    const annotationsResponse = await fetch(annotationsUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    let annotations: Array<{
      path: string;
      start_line: number;
      end_line: number;
      annotation_level: string;
      message: string;
      title: string;
    }> = [];

    if (annotationsResponse.ok) {
      annotations = await annotationsResponse.json();
    }

    // Build logs from available data
    let logs = '';

    // Add output summary if available
    if (checkRun.output?.title) {
      logs += `=== ${checkRun.output.title} ===\n\n`;
    }

    if (checkRun.output?.summary) {
      logs += `${checkRun.output.summary}\n\n`;
    }

    if (checkRun.output?.text) {
      logs += `${checkRun.output.text}\n\n`;
    }

    // Add annotations as error details
    if (annotations.length > 0) {
      logs += '=== Annotations ===\n\n';
      for (const annotation of annotations) {
        logs += `[${annotation.annotation_level.toUpperCase()}] ${annotation.path}:${annotation.start_line}`;
        if (annotation.start_line !== annotation.end_line) {
          logs += `-${annotation.end_line}`;
        }
        logs += '\n';
        if (annotation.title) {
          logs += `  ${annotation.title}\n`;
        }
        logs += `  ${annotation.message}\n\n`;
      }
    }

    // If no logs available, provide a helpful message
    if (!logs.trim()) {
      logs = 'No detailed logs available. Check the GitHub UI for full logs.';
    }

    const result: CILogsResponse = {
      checkId,
      name: checkRun.name,
      logs,
      downloadUrl: checkRun.html_url,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching CI logs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
