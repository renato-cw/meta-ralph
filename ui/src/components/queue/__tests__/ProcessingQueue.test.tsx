import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProcessingQueue } from '../ProcessingQueue';
import type { Issue, ProcessingStatus } from '@/lib/types';

const mockIssues: Issue[] = [
  {
    id: 'issue-1',
    provider: 'zeropath',
    title: 'SQL Injection Vulnerability',
    description: 'Potential SQL injection in query handler',
    location: 'src/api/queries.ts:156',
    severity: 'CRITICAL',
    raw_severity: '9.8',
    count: 5,
    priority: 95,
    permalink: 'https://example.com/issue/1',
    metadata: {},
  },
  {
    id: 'issue-2',
    provider: 'sentry',
    title: 'Unhandled Promise Rejection',
    description: 'Promise rejection not caught',
    location: 'src/services/api.ts:42',
    severity: 'MEDIUM',
    raw_severity: '5.0',
    count: 12,
    priority: 60,
    permalink: 'https://example.com/issue/2',
    metadata: {},
  },
  {
    id: 'issue-3',
    provider: 'zeropath',
    title: 'XSS Vulnerability',
    description: 'Cross-site scripting in user input',
    location: 'src/components/Form.tsx:89',
    severity: 'HIGH',
    raw_severity: '7.5',
    count: 2,
    priority: 80,
    permalink: 'https://example.com/issue/3',
    metadata: {},
  },
];

const defaultProcessing: ProcessingStatus = {
  isProcessing: false,
  currentIssueId: null,
  logs: [],
  completed: [],
  failed: [],
};

describe('ProcessingQueue', () => {
  it('renders nothing when closed', () => {
    render(
      <ProcessingQueue
        isOpen={false}
        onClose={() => {}}
        processing={defaultProcessing}
        issues={mockIssues}
        queuedIds={['issue-1']}
        logs={[]}
      />
    );

    expect(screen.queryByText('Processing Queue')).not.toBeInTheDocument();
  });

  it('renders queue panel when open', () => {
    render(
      <ProcessingQueue
        isOpen={true}
        onClose={() => {}}
        processing={defaultProcessing}
        issues={mockIssues}
        queuedIds={['issue-1']}
        logs={[]}
      />
    );

    expect(screen.getByText('Processing Queue')).toBeInTheDocument();
  });

  it('shows empty state when no items in queue', () => {
    render(
      <ProcessingQueue
        isOpen={true}
        onClose={() => {}}
        processing={defaultProcessing}
        issues={mockIssues}
        queuedIds={[]}
        logs={[]}
      />
    );

    expect(screen.getByText('No items in queue.')).toBeInTheDocument();
    expect(
      screen.getByText('Select issues and click Process to start.')
    ).toBeInTheDocument();
  });

  it('displays queued items', () => {
    render(
      <ProcessingQueue
        isOpen={true}
        onClose={() => {}}
        processing={defaultProcessing}
        issues={mockIssues}
        queuedIds={['issue-1', 'issue-2']}
        logs={[]}
      />
    );

    expect(screen.getByText('SQL Injection Vulnerability')).toBeInTheDocument();
    expect(screen.getByText('Unhandled Promise Rejection')).toBeInTheDocument();
  });

  it('shows Active indicator when processing', () => {
    const processingStatus: ProcessingStatus = {
      isProcessing: true,
      currentIssueId: 'issue-1',
      logs: [],
      completed: [],
      failed: [],
    };

    render(
      <ProcessingQueue
        isOpen={true}
        onClose={() => {}}
        processing={processingStatus}
        issues={mockIssues}
        queuedIds={['issue-1', 'issue-2']}
        logs={[]}
      />
    );

    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows completed items in separate section', () => {
    const processingStatus: ProcessingStatus = {
      isProcessing: false,
      currentIssueId: null,
      logs: [],
      completed: ['issue-1'],
      failed: [],
    };

    render(
      <ProcessingQueue
        isOpen={true}
        onClose={() => {}}
        processing={processingStatus}
        issues={mockIssues}
        queuedIds={['issue-1', 'issue-2']}
        logs={[]}
      />
    );

    expect(screen.getByText('Completed (1)')).toBeInTheDocument();
  });

  it('shows failed items in separate section', () => {
    const processingStatus: ProcessingStatus = {
      isProcessing: false,
      currentIssueId: null,
      logs: [],
      completed: [],
      failed: ['issue-2'],
    };

    render(
      <ProcessingQueue
        isOpen={true}
        onClose={() => {}}
        processing={processingStatus}
        issues={mockIssues}
        queuedIds={['issue-1', 'issue-2']}
        logs={[]}
      />
    );

    expect(screen.getByText('Failed (1)')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = jest.fn();
    render(
      <ProcessingQueue
        isOpen={true}
        onClose={onClose}
        processing={defaultProcessing}
        issues={mockIssues}
        queuedIds={['issue-1']}
        logs={[]}
      />
    );

    const closeButton = screen.getByLabelText('Close queue panel');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = jest.fn();
    render(
      <ProcessingQueue
        isOpen={true}
        onClose={onClose}
        processing={defaultProcessing}
        issues={mockIssues}
        queuedIds={['issue-1']}
        logs={[]}
      />
    );

    const backdrop = screen.getByRole('dialog').previousElementSibling!;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows logs section when logs are present', () => {
    render(
      <ProcessingQueue
        isOpen={true}
        onClose={() => {}}
        processing={defaultProcessing}
        issues={mockIssues}
        queuedIds={['issue-1']}
        logs={['Starting processing...', 'Analyzing issue-1']}
      />
    );

    expect(screen.getByText('Processing Logs (2 lines)')).toBeInTheDocument();
  });

  it('expands logs section when clicked', () => {
    render(
      <ProcessingQueue
        isOpen={true}
        onClose={() => {}}
        processing={defaultProcessing}
        issues={mockIssues}
        queuedIds={['issue-1']}
        logs={['Starting processing...', 'Analyzing issue-1']}
      />
    );

    const logsButton = screen.getByText('Processing Logs (2 lines)');
    fireEvent.click(logsButton);

    expect(screen.getByText('Starting processing...')).toBeInTheDocument();
    expect(screen.getByText('Analyzing issue-1')).toBeInTheDocument();
  });

  it('calls onRetryItem when retry button is clicked', () => {
    const onRetryItem = jest.fn();
    const processingStatus: ProcessingStatus = {
      isProcessing: false,
      currentIssueId: null,
      logs: [],
      completed: [],
      failed: ['issue-1'],
    };

    render(
      <ProcessingQueue
        isOpen={true}
        onClose={() => {}}
        processing={processingStatus}
        issues={mockIssues}
        queuedIds={['issue-1']}
        logs={[]}
        onRetryItem={onRetryItem}
      />
    );

    const retryButton = screen.getByTitle('Retry');
    fireEvent.click(retryButton);

    expect(onRetryItem).toHaveBeenCalledWith('issue-1');
  });

  it('shows progress bar when there are items', () => {
    const processingStatus: ProcessingStatus = {
      isProcessing: true,
      currentIssueId: 'issue-1',
      logs: [],
      completed: [],
      failed: [],
    };

    render(
      <ProcessingQueue
        isOpen={true}
        onClose={() => {}}
        processing={processingStatus}
        issues={mockIssues}
        queuedIds={['issue-1', 'issue-2', 'issue-3']}
        logs={[]}
      />
    );

    // Progress stats should be visible
    expect(screen.getByText(/complete/)).toBeInTheDocument();
  });
});
