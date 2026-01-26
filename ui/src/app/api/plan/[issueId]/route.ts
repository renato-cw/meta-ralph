import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type {
  PlanApiResponse,
  PlanUpdateRequest,
  PlanUpdateResponse,
  ImplementationPlan,
} from '@/lib/types';
import {
  parsePlanMarkdown,
  calculateProgress,
  isValidPlanMarkdown,
  detectManualModification,
} from '@/lib/plan-parser';

/**
 * Get the path to the plan file for an issue.
 *
 * Plan files are stored in the .ralph-work directory for each issue.
 */
function getPlanPath(issueId: string): string {
  // Sanitize issueId to prevent path traversal
  const safeId = issueId.replace(/[^a-zA-Z0-9-_]/g, '');

  // Default work directory - can be configured via environment variable
  const workDir = process.env.RALPH_WORK_DIR || '.ralph-work';

  return path.join(process.cwd(), workDir, safeId, 'IMPLEMENTATION_PLAN.md');
}

/**
 * Check if a plan file exists.
 */
async function planExists(planPath: string): Promise<boolean> {
  try {
    await fs.access(planPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read a plan file.
 */
async function readPlanFile(planPath: string): Promise<string> {
  return fs.readFile(planPath, 'utf-8');
}

/**
 * Write a plan file.
 */
async function writePlanFile(planPath: string, content: string): Promise<void> {
  // Ensure directory exists
  const dir = path.dirname(planPath);
  await fs.mkdir(dir, { recursive: true });

  // Write file
  await fs.writeFile(planPath, content, 'utf-8');
}

/**
 * Add manual modification marker to content if not present.
 */
function addModificationMarker(content: string): string {
  if (detectManualModification(content)) {
    return content;
  }
  return `<!-- user-modified -->\n${content}`;
}

/**
 * GET /api/plan/[issueId]
 *
 * Retrieve the implementation plan for a specific issue.
 *
 * Returns:
 * - 200: Plan found and parsed successfully
 * - 404: Plan does not exist
 * - 500: Error reading or parsing plan
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await context.params;

  if (!issueId) {
    return NextResponse.json(
      { error: 'Missing required parameter: issueId' },
      { status: 400 }
    );
  }

  const planPath = getPlanPath(issueId);

  try {
    // Check if plan exists
    const exists = await planExists(planPath);

    if (!exists) {
      const response: PlanApiResponse = {
        issueId,
        exists: false,
        plan: null,
        progress: null,
        modifiedByUser: false,
      };
      return NextResponse.json(response);
    }

    // Read plan file
    const content = await readPlanFile(planPath);

    // Parse plan
    const plan = parsePlanMarkdown(content, issueId);
    const progress = calculateProgress(plan);
    const modifiedByUser = detectManualModification(content);

    const response: PlanApiResponse = {
      issueId,
      exists: true,
      plan,
      progress,
      modifiedByUser,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error reading plan:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read plan' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/plan/[issueId]
 *
 * Update the implementation plan for a specific issue.
 *
 * Request body:
 * - rawMarkdown: The updated markdown content
 *
 * Returns:
 * - 200: Plan updated successfully
 * - 400: Invalid request or markdown
 * - 500: Error writing plan
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await context.params;

  if (!issueId) {
    return NextResponse.json(
      { error: 'Missing required parameter: issueId' },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as PlanUpdateRequest;
    const { rawMarkdown } = body;

    if (!rawMarkdown || typeof rawMarkdown !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: rawMarkdown' },
        { status: 400 }
      );
    }

    // Validate markdown structure
    if (!isValidPlanMarkdown(rawMarkdown)) {
      return NextResponse.json(
        {
          error:
            'Invalid plan markdown. Must contain at least a title and one section.',
        },
        { status: 400 }
      );
    }

    const planPath = getPlanPath(issueId);

    // Add modification marker for manually edited plans
    const contentWithMarker = addModificationMarker(rawMarkdown);

    // Write plan file
    await writePlanFile(planPath, contentWithMarker);

    // Parse updated plan for response
    const plan: ImplementationPlan = parsePlanMarkdown(contentWithMarker, issueId);

    const response: PlanUpdateResponse = {
      success: true,
      message: 'Plan updated successfully',
      plan,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to update plan',
      } as PlanUpdateResponse,
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/plan/[issueId]
 *
 * Delete the implementation plan for a specific issue.
 *
 * Returns:
 * - 200: Plan deleted successfully
 * - 404: Plan does not exist
 * - 500: Error deleting plan
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await context.params;

  if (!issueId) {
    return NextResponse.json(
      { error: 'Missing required parameter: issueId' },
      { status: 400 }
    );
  }

  const planPath = getPlanPath(issueId);

  try {
    // Check if plan exists
    const exists = await planExists(planPath);

    if (!exists) {
      return NextResponse.json(
        { error: 'Plan does not exist' },
        { status: 404 }
      );
    }

    // Delete plan file
    await fs.unlink(planPath);

    return NextResponse.json({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete plan' },
      { status: 500 }
    );
  }
}
