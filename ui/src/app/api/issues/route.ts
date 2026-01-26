import { NextResponse } from 'next/server';
import { fetchIssues, processIssues } from '@/lib/meta-ralph';
import { getActiveSessions } from '@/lib/session-manager';
import type { ProcessingOptions } from '@/lib/types';

// In-memory store for processing state (legacy support)
// Note: Session-manager is now the primary state source for streaming
let processingState = {
  isProcessing: false,
  currentIssueId: null as string | null,
  logs: [] as string[],
  completed: [] as string[],
  failed: [] as string[],
};

// Active process handle for cancellation
let activeProcess: (() => void) | null = null;

// GET /api/issues - Fetch all issues
export async function GET() {
  try {
    const issues = await fetchIssues();

    // Get current processing state from session-manager
    const sessions = getActiveSessions();
    const isProcessing = sessions.some(s => s.status === 'processing');
    const currentSession = sessions.find(s => s.status === 'processing');

    return NextResponse.json({
      issues,
      processing: {
        ...processingState,
        isProcessing,
        currentIssueId: currentSession?.issueId || processingState.currentIssueId,
        // Include session info for streaming-aware clients
        sessions: sessions.map(s => ({
          issueId: s.issueId,
          status: s.status,
          startedAt: s.startedAt,
          completedAt: s.completedAt,
        })),
      },
    });
  } catch (error) {
    console.error('Failed to fetch issues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch issues', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/issues - Process selected issues
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ids, options } = body as {
      ids: string[];
      options?: Partial<ProcessingOptions>;
    };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No issue IDs provided' },
        { status: 400 }
      );
    }

    // Check if any of the requested issues are already processing
    const sessions = getActiveSessions();
    const processingIds = sessions
      .filter(s => s.status === 'processing')
      .map(s => s.issueId);

    const alreadyProcessing = ids.filter(id => processingIds.includes(id));
    if (alreadyProcessing.length > 0) {
      return NextResponse.json(
        {
          error: 'Some issues are already being processed',
          alreadyProcessing,
        },
        { status: 409 }
      );
    }

    // Reset and start processing
    processingState = {
      isProcessing: true,
      currentIssueId: ids[0],
      logs: [`Starting processing of ${ids.length} issue(s)...`],
      completed: [],
      failed: [],
    };

    // Start processing in background with options
    activeProcess = processIssues(
      ids,
      (log) => {
        processingState.logs.push(log);
        // Keep only last 1000 log lines
        if (processingState.logs.length > 1000) {
          processingState.logs = processingState.logs.slice(-1000);
        }
      },
      (success) => {
        processingState.isProcessing = false;
        processingState.currentIssueId = null;
        activeProcess = null;

        if (success) {
          processingState.completed.push(...ids);
          processingState.logs.push('Processing completed successfully!');
        } else {
          processingState.failed.push(...ids);
          processingState.logs.push('Processing failed.');
        }
      },
      options
    );

    return NextResponse.json({
      message: 'Processing started',
      processing: processingState,
      // Return session info for streaming clients
      streamUrl: `/api/process/stream?ids=${ids.join(',')}`,
    });
  } catch (error) {
    console.error('Failed to start processing:', error);
    return NextResponse.json(
      { error: 'Failed to start processing', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/issues - Cancel processing
export async function DELETE() {
  try {
    if (activeProcess) {
      activeProcess();
      activeProcess = null;
      processingState.isProcessing = false;
      processingState.logs.push('Processing cancelled by user.');
    }

    return NextResponse.json({
      message: 'Processing cancelled',
      processing: processingState,
    });
  } catch (error) {
    console.error('Failed to cancel processing:', error);
    return NextResponse.json(
      { error: 'Failed to cancel processing', details: String(error) },
      { status: 500 }
    );
  }
}
