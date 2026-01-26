import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { parsePlanMarkdown, isValidPlanContent } from '@/lib/plan-parser';

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

    // Plan can be in repo root or work directory
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

    // Parse the plan to return structured data alongside raw content
    const parsedPlan = parsePlanMarkdown(planContent, issueId);

    return NextResponse.json({
      issueId,
      content: planContent,
      path: foundPath,
      timestamp: new Date().toISOString(),
      plan: parsedPlan,
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plan', message: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/plan/[issueId]
 * Updates the IMPLEMENTATION_PLAN.md content.
 * Used for marking steps as complete or editing the plan.
 *
 * Request body:
 * {
 *   content: string;  // The updated markdown content
 * }
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { issueId } = await params;

    if (!issueId) {
      return NextResponse.json({ error: 'Issue ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: 'Content is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate that the content is a valid plan
    if (!isValidPlanContent(content)) {
      return NextResponse.json(
        {
          error: 'Invalid plan content',
          message: 'Content must contain at least one header and one checkbox',
        },
        { status: 400 }
      );
    }

    // Find the existing plan file location
    let planPath: string | null = null;

    // Try repo root first
    const repoRootPlan = path.join(TARGET_REPO, 'IMPLEMENTATION_PLAN.md');
    try {
      await fs.access(repoRootPlan);
      planPath = repoRootPlan;
    } catch {
      // File not in repo root, try work directories
    }

    // If not found in repo root, search work directories
    if (!planPath) {
      try {
        const logDirEntries = await fs.readdir(LOG_DIR);
        for (const entry of logDirEntries) {
          if (entry.includes(issueId)) {
            const workDirPlan = path.join(LOG_DIR, entry, 'IMPLEMENTATION_PLAN.md');
            try {
              await fs.access(workDirPlan);
              planPath = workDirPlan;
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

    // If no existing plan found, create in repo root
    if (!planPath) {
      planPath = repoRootPlan;
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(planPath), { recursive: true });
    }

    // Write the updated content
    await fs.writeFile(planPath, content, 'utf-8');

    // Parse and return the updated plan
    const parsedPlan = parsePlanMarkdown(content, issueId);

    return NextResponse.json({
      issueId,
      content,
      path: planPath,
      timestamp: new Date().toISOString(),
      plan: parsedPlan,
      message: 'Plan updated successfully',
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      { error: 'Failed to update plan', message: String(error) },
      { status: 500 }
    );
  }
}
