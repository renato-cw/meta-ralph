import { NextResponse } from 'next/server';
import { fetchIssues, processIssues } from '@/lib/meta-ralph';

// In-memory store for processing state
let processingState = {
  isProcessing: false,
  currentIssueId: null as string | null,
  logs: [] as string[],
  completed: [] as string[],
  failed: [] as string[],
};

// GET /api/issues - Fetch all issues
export async function GET() {
  try {
    const issues = await fetchIssues();
    return NextResponse.json({
      issues,
      processing: processingState,
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
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'No issue IDs provided' },
        { status: 400 }
      );
    }

    if (processingState.isProcessing) {
      return NextResponse.json(
        { error: 'Already processing issues' },
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

    // Start processing in background
    processIssues(
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
        processingState.logs.push(
          success ? 'Processing completed successfully!' : 'Processing failed.'
        );
      }
    );

    return NextResponse.json({
      message: 'Processing started',
      processing: processingState,
    });
  } catch (error) {
    console.error('Failed to start processing:', error);
    return NextResponse.json(
      { error: 'Failed to start processing', details: String(error) },
      { status: 500 }
    );
  }
}
