import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/ci/logs
 *
 * Fetch CI failure logs from GitHub Actions.
 * This endpoint retrieves the logs for a specific workflow run/job
 * to help diagnose failures.
 *
 * Query parameters:
 * - checkId: The check run ID to fetch logs for
 *
 * Environment variables required:
 * - GITHUB_TOKEN: GitHub personal access token
 * - GITHUB_REPO: Repository in owner/repo format
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const checkId = searchParams.get('checkId');

  if (!checkId) {
    return NextResponse.json(
      { error: 'Missing required parameter: checkId' },
      { status: 400 }
    );
  }

  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO;

  if (!githubToken) {
    return NextResponse.json(
      { error: 'GitHub token not configured' },
      { status: 500 }
    );
  }

  if (!githubRepo) {
    return NextResponse.json(
      { error: 'GitHub repository not configured' },
      { status: 500 }
    );
  }

  try {
    // First, get the check run details to find the job ID
    const checkRunResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/check-runs/${checkId}`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        cache: 'no-store',
      }
    );

    if (!checkRunResponse.ok) {
      if (checkRunResponse.status === 404) {
        return NextResponse.json(
          { error: 'Check run not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: `Failed to fetch check run: ${checkRunResponse.status}` },
        { status: checkRunResponse.status }
      );
    }

    const checkRun = await checkRunResponse.json();

    // Get the workflow run ID from the check run
    // The external_id or we need to get it from the check_suite
    const checkSuiteId = checkRun.check_suite?.id;

    if (!checkSuiteId) {
      // If no check suite, try to get output directly
      const output = checkRun.output || {};
      return NextResponse.json({
        checkId,
        name: checkRun.name,
        status: checkRun.status,
        conclusion: checkRun.conclusion,
        output: {
          title: output.title || null,
          summary: output.summary || null,
          text: output.text || null,
          annotations_count: output.annotations_count || 0,
        },
        logs: null,
        message: 'Logs are available through the output field or GitHub web interface',
      });
    }

    // Get the workflow run associated with the check suite
    const checkSuiteResponse = await fetch(
      `https://api.github.com/repos/${githubRepo}/check-suites/${checkSuiteId}`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        cache: 'no-store',
      }
    );

    if (!checkSuiteResponse.ok) {
      // Return what we have
      const output = checkRun.output || {};
      return NextResponse.json({
        checkId,
        name: checkRun.name,
        status: checkRun.status,
        conclusion: checkRun.conclusion,
        output: {
          title: output.title || null,
          summary: output.summary || null,
          text: output.text || null,
        },
        logs: null,
      });
    }

    // Try to get workflow run logs
    // Note: GitHub API doesn't directly expose check run logs,
    // but we can get annotations and output which contain failure info
    const annotations: Array<{ path: string; message: string; line: number }> = [];

    // Fetch annotations if available
    const annotationsUrl = `https://api.github.com/repos/${githubRepo}/check-runs/${checkId}/annotations`;
    const annotationsResponse = await fetch(annotationsUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    });

    if (annotationsResponse.ok) {
      const annotationsData = await annotationsResponse.json();
      for (const ann of annotationsData) {
        annotations.push({
          path: ann.path || '',
          message: ann.message || '',
          line: ann.start_line || 0,
        });
      }
    }

    const output = checkRun.output || {};

    return NextResponse.json({
      checkId,
      name: checkRun.name,
      status: checkRun.status,
      conclusion: checkRun.conclusion,
      detailsUrl: checkRun.html_url || checkRun.details_url || '',
      output: {
        title: output.title || null,
        summary: output.summary || null,
        text: output.text || null,
      },
      annotations,
      // Include a link to view full logs in browser
      logsUrl: `https://github.com/${githubRepo}/runs/${checkId}?check_suite_focus=true`,
    });
  } catch (error) {
    console.error('Error fetching CI logs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch CI logs' },
      { status: 500 }
    );
  }
}
