import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueueProgress } from '../QueueProgress';

describe('QueueProgress', () => {
  it('renders progress bar and stats', () => {
    render(
      <QueueProgress
        total={10}
        completed={3}
        failed={1}
        processing={1}
      />
    );

    // Should show percentage
    expect(screen.getByText('40%')).toBeInTheDocument();
    // The "% complete" text is in a span, check it exists
    const percentText = screen.getByText('40%');
    expect(percentText.parentElement?.textContent).toContain('complete');
  });

  it('displays correct counts for each status', () => {
    render(
      <QueueProgress
        total={10}
        completed={5}
        failed={2}
        processing={1}
      />
    );

    // Check for status indicators
    expect(screen.getByText('2 pending')).toBeInTheDocument();
    expect(screen.getByText('1 processing')).toBeInTheDocument();
    expect(screen.getByText('5 completed')).toBeInTheDocument();
    expect(screen.getByText('2 failed')).toBeInTheDocument();
  });

  it('shows elapsed time when startedAt is provided', () => {
    const startedAt = new Date(Date.now() - 125000).toISOString(); // 125 seconds ago
    render(
      <QueueProgress
        total={10}
        completed={3}
        failed={0}
        processing={1}
        startedAt={startedAt}
      />
    );

    // Should show elapsed time like "2m 5s elapsed"
    expect(screen.getByText(/2m.*elapsed/)).toBeInTheDocument();
  });

  it('shows ETA when some items are completed', () => {
    const startedAt = new Date(Date.now() - 60000).toISOString(); // 60 seconds ago
    render(
      <QueueProgress
        total={10}
        completed={2}
        failed={0}
        processing={1}
        startedAt={startedAt}
      />
    );

    // Should show remaining estimate
    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });

  it('does not show pending when all items are done or processing', () => {
    render(
      <QueueProgress
        total={10}
        completed={8}
        failed={1}
        processing={1}
      />
    );

    expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
  });

  it('does not show processing indicator when nothing is processing', () => {
    render(
      <QueueProgress
        total={10}
        completed={10}
        failed={0}
        processing={0}
      />
    );

    expect(screen.queryByText(/processing$/)).not.toBeInTheDocument();
  });

  it('handles zero total gracefully', () => {
    render(
      <QueueProgress
        total={0}
        completed={0}
        failed={0}
        processing={0}
      />
    );

    // Should show 0% complete without errors
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it('shows 100% when all items are complete', () => {
    render(
      <QueueProgress
        total={5}
        completed={5}
        failed={0}
        processing={0}
      />
    );

    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });

  it('includes failed items in percentage calculation', () => {
    render(
      <QueueProgress
        total={10}
        completed={3}
        failed={7}
        processing={0}
      />
    );

    // 3 completed + 7 failed = 10 done = 100%
    expect(screen.getByText(/100%/)).toBeInTheDocument();
  });
});
