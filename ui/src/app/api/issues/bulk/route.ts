import { NextResponse } from 'next/server';
import { fetchIssues, processIssues } from '@/lib/meta-ralph';
import { getActiveSessions } from '@/lib/session-manager';
import type { BulkActionRequest, BulkActionResponse, Issue, ProcessingOptions } from '@/lib/types';

/**
 * POST /api/issues/bulk - Handle bulk actions on issues
 *
 * Supports actions: export, tag, untag, priority, ignore, restore, process
 *
 * Why this endpoint exists:
 * - Provides a unified API for all bulk operations on issues
 * - Enables server-side validation and coordination
 * - Allows for future server-side state management
 */
export async function POST(request: Request): Promise<NextResponse<BulkActionResponse>> {
  try {
    const body = await request.json() as BulkActionRequest;
    const { action, ids, payload } = body;

    // Validate request
    if (!action) {
      return NextResponse.json(
        {
          success: false,
          message: 'Action is required',
          affected: 0,
        },
        { status: 400 }
      );
    }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'No issue IDs provided',
          affected: 0,
        },
        { status: 400 }
      );
    }

    // Validate action type
    const validActions = ['export', 'tag', 'untag', 'priority', 'ignore', 'restore', 'process'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        {
          success: false,
          message: `Invalid action: ${action}. Valid actions: ${validActions.join(', ')}`,
          affected: 0,
        },
        { status: 400 }
      );
    }

    // Handle each action type
    switch (action) {
      case 'export': {
        return await handleExport(ids, payload?.format);
      }

      case 'tag': {
        return handleTag(ids, payload?.tags, 'add');
      }

      case 'untag': {
        return handleTag(ids, payload?.tags, 'remove');
      }

      case 'priority': {
        return handlePriority(ids, payload?.priority);
      }

      case 'ignore': {
        return handleIgnore(ids, true);
      }

      case 'restore': {
        return handleIgnore(ids, false);
      }

      case 'process': {
        return await handleProcess(ids, payload);
      }

      default: {
        return NextResponse.json(
          {
            success: false,
            message: `Unhandled action: ${action}`,
            affected: 0,
          },
          { status: 400 }
        );
      }
    }
  } catch (error) {
    console.error('Bulk action failed:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Bulk action failed: ${String(error)}`,
        affected: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle export action - returns issue data for client-side download
 */
async function handleExport(
  ids: string[],
  format?: 'csv' | 'json'
): Promise<NextResponse<BulkActionResponse>> {
  try {
    const allIssues = await fetchIssues();

    // Filter to requested IDs
    const selectedIssues = allIssues.filter((issue: Issue) => ids.includes(issue.id));

    if (selectedIssues.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No matching issues found',
        affected: 0,
      });
    }

    // Return data for client-side formatting
    return NextResponse.json({
      success: true,
      message: `Exported ${selectedIssues.length} issue(s)`,
      affected: selectedIssues.length,
      data: {
        format: format || 'json',
        issues: selectedIssues,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: `Export failed: ${String(error)}`,
        affected: 0,
      },
      { status: 500 }
    );
  }
}

/**
 * Handle tag/untag action
 * Note: Tags are currently stored client-side (localStorage).
 * This endpoint validates the request and returns success for UI to update local state.
 */
function handleTag(
  ids: string[],
  tags?: string[],
  operation?: 'add' | 'remove'
): NextResponse<BulkActionResponse> {
  if (!tags || tags.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: 'No tags provided',
        affected: 0,
      },
      { status: 400 }
    );
  }

  // Tags are stored client-side, so we just acknowledge the operation
  // The client will update localStorage accordingly
  return NextResponse.json({
    success: true,
    message: `${operation === 'add' ? 'Added' : 'Removed'} ${tags.length} tag(s) ${operation === 'add' ? 'to' : 'from'} ${ids.length} issue(s)`,
    affected: ids.length,
    data: {
      issueIds: ids,
      tags,
      operation,
    },
  });
}

/**
 * Handle priority change action
 * Note: Priority is currently determined by providers and is read-only.
 * This endpoint returns an acknowledgment for future server-side implementation.
 */
function handlePriority(
  ids: string[],
  priority?: number
): NextResponse<BulkActionResponse> {
  if (priority === undefined || priority < 0 || priority > 100) {
    return NextResponse.json(
      {
        success: false,
        message: 'Priority must be a number between 0 and 100',
        affected: 0,
      },
      { status: 400 }
    );
  }

  // Priority override is a potential future feature
  // For now, acknowledge the request
  return NextResponse.json({
    success: true,
    message: `Priority update acknowledged for ${ids.length} issue(s) (priority: ${priority})`,
    affected: ids.length,
    data: {
      issueIds: ids,
      priority,
      note: 'Priority override is not yet implemented server-side',
    },
  });
}

/**
 * Handle ignore/restore action
 * Note: Ignored state is currently stored client-side.
 * This endpoint validates and acknowledges for UI to update local state.
 */
function handleIgnore(
  ids: string[],
  ignore: boolean
): NextResponse<BulkActionResponse> {
  return NextResponse.json({
    success: true,
    message: `${ignore ? 'Ignored' : 'Restored'} ${ids.length} issue(s)`,
    affected: ids.length,
    data: {
      issueIds: ids,
      ignored: ignore,
    },
  });
}

/**
 * Handle process action - starts processing selected issues
 */
async function handleProcess(
  ids: string[],
  _payload?: BulkActionRequest['payload']
): Promise<NextResponse<BulkActionResponse>> {
  // Check for already processing issues
  const sessions = getActiveSessions();
  const processingIds = sessions
    .filter(s => s.status === 'processing')
    .map(s => s.issueId);

  const alreadyProcessing = ids.filter(id => processingIds.includes(id));
  if (alreadyProcessing.length > 0) {
    return NextResponse.json(
      {
        success: false,
        message: `Some issues are already being processed: ${alreadyProcessing.join(', ')}`,
        affected: 0,
        data: { alreadyProcessing },
      },
      { status: 409 }
    );
  }

  // Build processing options from payload (reserved for future use)
  // _payload could contain processing options in an extended BulkActionRequest
  const options: Partial<ProcessingOptions> = {};

  // Options could be passed via an extended payload in the future
  // For now, use defaults

  // Start processing
  processIssues(
    ids,
    (log) => {
      console.log('[Bulk Process]', log);
    },
    (success) => {
      console.log(`[Bulk Process] Completed: ${success ? 'success' : 'failure'}`);
    },
    options
  );

  return NextResponse.json({
    success: true,
    message: `Started processing ${ids.length} issue(s)`,
    affected: ids.length,
    data: {
      issueIds: ids,
      streamUrl: `/api/process/stream?ids=${ids.join(',')}`,
    },
  });
}
