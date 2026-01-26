import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

// Directory where meta-ralph stores work files
const LOG_DIR = process.env.RALPH_LOG_DIR || '/tmp/meta-ralph-logs';
// Target repo where IMPLEMENTATION_PLAN.md is created
const TARGET_REPO = process.env.REPO_ROOT || process.cwd();

interface RouteParams {
  params: Promise<{ issueId: string }>;
}

/**
 * GET /api/plan/[issueId]
 * Fetches the IMPLEMENTATION_PLAN.md content for a completed plan mode issue.
 *
 * The plan file can be in two locations:
 * 1. The target repo root (where Claude creates it)
 * 2. The work directory (as a backup location)
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { issueId } = await params;

    if (!issueId) {
      return NextResponse.json({ error: 'Issue ID is required' }, { status: 400 });
    }

    // Try multiple locations for the plan file
    const possiblePaths = [
      // Primary: repo root
      path.join(TARGET_REPO, 'IMPLEMENTATION_PLAN.md'),
      // Secondary: work directory specific to issue
      path.join(LOG_DIR, `*-${issueId}`, 'IMPLEMENTATION_PLAN.md'),
    ];

    let planContent: string | null = null;
    let foundPath: string | null = null;

    // Try repo root first
    try {
      const repoRootPlan = path.join(TARGET_REPO, 'IMPLEMENTATION_PLAN.md');
      planContent = await fs.readFile(repoRootPlan, 'utf-8');
      foundPath = repoRootPlan;
    } catch {
      // File not in repo root, try work directories
    }

    // If not found in repo root, search work directories
    if (!planContent) {
      try {
        const logDirEntries = await fs.readdir(LOG_DIR);
        for (const entry of logDirEntries) {
          if (entry.includes(issueId)) {
            const workDirPlan = path.join(LOG_DIR, entry, 'IMPLEMENTATION_PLAN.md');
            try {
              planContent = await fs.readFile(workDirPlan, 'utf-8');
              foundPath = workDirPlan;
              break;
            } catch {
              // Continue searching
            }
          }
        }
      } catch {
        // LOG_DIR might not exist
      }
    }

    if (!planContent) {
      return NextResponse.json(
        {
          error: 'Plan not found',
          message: `No IMPLEMENTATION_PLAN.md found for issue ${issueId}. The plan may not have been generated yet, or plan mode was not used.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      issueId,
      content: planContent,
      path: foundPath,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plan', message: String(error) },
      { status: 500 }
    );
  }
}
