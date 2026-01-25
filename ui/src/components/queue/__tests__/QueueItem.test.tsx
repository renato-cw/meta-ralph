import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueueItem } from '../QueueItem';
import type { Issue } from '@/lib/types';

const mockIssue: Issue = {
  id: 'test-issue-1',
  provider: 'zeropath',
  title: 'Test Security Issue',
  description: 'A test security vulnerability',
  location: 'src/api/auth.ts:42',
  severity: 'HIGH',
  raw_severity: '8.5',
  count: 3,
  priority: 85,
  permalink: 'https://example.com/issue/1',
  metadata: {},
};

describe('QueueItem', () => {
  it('renders issue title and provider', () => {
    render(<QueueItem issue={mockIssue} status="pending" />);

    expect(screen.getByText('Test Security Issue')).toBeInTheDocument();
    expect(screen.getByText('zeropath')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
  });

  it('renders pending status with clock icon', () => {
    render(<QueueItem issue={mockIssue} status="pending" />);

    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('renders processing status with spinner', () => {
    render(<QueueItem issue={mockIssue} status="processing" />);

    expect(screen.getByText('processing')).toBeInTheDocument();
  });

  it('renders completed status with check icon', () => {
    render(<QueueItem issue={mockIssue} status="completed" />);

    expect(screen.getByText('completed')).toBeInTheDocument();
  });

  it('renders failed status with x icon', () => {
    render(<QueueItem issue={mockIssue} status="failed" />);

    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('displays error message when failed', () => {
    render(
      <QueueItem
        issue={mockIssue}
        status="failed"
        error="Processing failed: timeout"
      />
    );

    expect(screen.getByText('Processing failed: timeout')).toBeInTheDocument();
  });

  it('displays PR link when completed with prUrl', () => {
    render(
      <QueueItem
        issue={mockIssue}
        status="completed"
        prUrl="https://github.com/org/repo/pull/123"
      />
    );

    const prLink = screen.getByText('View PR');
    expect(prLink).toBeInTheDocument();
    expect(prLink.closest('a')).toHaveAttribute(
      'href',
      'https://github.com/org/repo/pull/123'
    );
  });

  it('shows cancel button for pending items when onCancel is provided', () => {
    const onCancel = jest.fn();
    render(
      <QueueItem issue={mockIssue} status="pending" onCancel={onCancel} />
    );

    const cancelButton = screen.getByTitle('Remove from queue');
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not show cancel button for non-pending items', () => {
    const onCancel = jest.fn();
    render(
      <QueueItem issue={mockIssue} status="processing" onCancel={onCancel} />
    );

    expect(screen.queryByTitle('Remove from queue')).not.toBeInTheDocument();
  });

  it('shows retry button for failed items when onRetry is provided', () => {
    const onRetry = jest.fn();
    render(<QueueItem issue={mockIssue} status="failed" onRetry={onRetry} />);

    const retryButton = screen.getByTitle('Retry');
    expect(retryButton).toBeInTheDocument();

    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show retry button for non-failed items', () => {
    const onRetry = jest.fn();
    render(
      <QueueItem issue={mockIssue} status="completed" onRetry={onRetry} />
    );

    expect(screen.queryByTitle('Retry')).not.toBeInTheDocument();
  });

  it('displays duration for processing items with startedAt', () => {
    const startedAt = new Date(Date.now() - 65000).toISOString(); // 65 seconds ago
    render(
      <QueueItem issue={mockIssue} status="processing" startedAt={startedAt} />
    );

    // Should show duration like "1m 5s"
    expect(screen.getByText(/1m/)).toBeInTheDocument();
  });
});
