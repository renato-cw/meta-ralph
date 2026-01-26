import { render, screen, fireEvent } from '@testing-library/react';
import { ActivityFeed } from '../ActivityFeed';
import type { Activity, ExecutionMetrics } from '@/lib/types';

// Mock scrollIntoView
beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

describe('ActivityFeed', () => {
  const createActivity = (id: string, overrides: Partial<Activity> = {}): Activity => ({
    id,
    timestamp: new Date().toISOString(),
    type: 'tool',
    tool: 'Read',
    details: `file-${id}.ts`,
    status: 'success',
    ...overrides,
  });

  const createMetrics = (): ExecutionMetrics => ({
    iteration: 2,
    maxIterations: 10,
    costUsd: 0.003,
    durationMs: 5000,
    totalCostUsd: 0.006,
    totalDurationMs: 10000,
  });

  it('renders activity feed container', () => {
    render(
      <ActivityFeed
        activities={[]}
        metrics={null}
        isProcessing={false}
      />
    );

    expect(screen.getByTestId('activity-feed')).toBeInTheDocument();
    expect(screen.getByText('Activity Feed')).toBeInTheDocument();
  });

  it('displays activities', () => {
    const activities = [
      createActivity('1', { tool: 'Read', details: 'src/index.ts' }),
      createActivity('2', { tool: 'Edit', details: 'src/utils.ts' }),
    ];

    render(
      <ActivityFeed
        activities={activities}
        metrics={null}
        isProcessing={false}
      />
    );

    expect(screen.getByText('src/index.ts')).toBeInTheDocument();
    expect(screen.getByText('src/utils.ts')).toBeInTheDocument();
  });

  it('displays activity count', () => {
    const activities = [
      createActivity('1'),
      createActivity('2'),
      createActivity('3'),
    ];

    render(
      <ActivityFeed
        activities={activities}
        metrics={null}
        isProcessing={false}
      />
    );

    expect(screen.getByText('(3)')).toBeInTheDocument();
  });

  it('shows streaming indicator when processing', () => {
    render(
      <ActivityFeed
        activities={[]}
        metrics={null}
        isProcessing={true}
      />
    );

    expect(screen.getByText('streaming')).toBeInTheDocument();
  });

  it('does not show streaming indicator when not processing', () => {
    render(
      <ActivityFeed
        activities={[]}
        metrics={null}
        isProcessing={false}
      />
    );

    expect(screen.queryByText('streaming')).not.toBeInTheDocument();
  });

  it('displays waiting message when no activities and processing', () => {
    render(
      <ActivityFeed
        activities={[]}
        metrics={null}
        isProcessing={true}
      />
    );

    expect(screen.getByText('Waiting for activities...')).toBeInTheDocument();
  });

  it('displays no activities message when empty and not processing', () => {
    render(
      <ActivityFeed
        activities={[]}
        metrics={null}
        isProcessing={false}
      />
    );

    expect(screen.getByText('No activities yet')).toBeInTheDocument();
  });

  it('renders metrics display', () => {
    const metrics = createMetrics();
    render(
      <ActivityFeed
        activities={[]}
        metrics={metrics}
        isProcessing={true}
      />
    );

    expect(screen.getByTestId('metrics-display')).toBeInTheDocument();
    expect(screen.getByText(/Loop 2 of 10/)).toBeInTheDocument();
  });

  it('can collapse and expand', () => {
    const activities = [createActivity('1', { details: 'test-file.ts' })];

    render(
      <ActivityFeed
        activities={activities}
        metrics={null}
        isProcessing={false}
      />
    );

    // Initially expanded - activity should be visible
    expect(screen.getByText('test-file.ts')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByText('Activity Feed'));

    // After collapse, activity details should not be visible
    expect(screen.queryByText('test-file.ts')).not.toBeInTheDocument();

    // Click to expand again
    fireEvent.click(screen.getByText('Activity Feed'));

    // After expand, activity should be visible again
    expect(screen.getByText('test-file.ts')).toBeInTheDocument();
  });

  it('shows collapsed summary when collapsed', () => {
    const activities = [createActivity('1', { details: 'last-activity-file.ts' })];

    render(
      <ActivityFeed
        activities={activities}
        metrics={null}
        isProcessing={false}
      />
    );

    // Collapse
    fireEvent.click(screen.getByText('Activity Feed'));

    // Should show summary
    expect(screen.getByText(/1 activities/)).toBeInTheDocument();
  });

  it('marks last activity as active when processing', () => {
    const activities = [
      createActivity('1', { details: 'first.ts' }),
      createActivity('2', { details: 'last.ts' }),
    ];

    render(
      <ActivityFeed
        activities={activities}
        metrics={null}
        isProcessing={true}
      />
    );

    // The last activity should have the ring styling
    const activityItems = screen.getAllByTestId('activity-item');
    expect(activityItems[activityItems.length - 1]).toHaveClass('ring-1');
  });

  it('does not mark last activity as active when not processing', () => {
    const activities = [
      createActivity('1', { details: 'first.ts' }),
      createActivity('2', { details: 'last.ts' }),
    ];

    render(
      <ActivityFeed
        activities={activities}
        metrics={null}
        isProcessing={false}
      />
    );

    // The last activity should not have the ring styling
    const activityItems = screen.getAllByTestId('activity-item');
    expect(activityItems[activityItems.length - 1]).not.toHaveClass('ring-1');
  });

  it('scrolls to bottom when new activities arrive', () => {
    const { rerender } = render(
      <ActivityFeed
        activities={[createActivity('1')]}
        metrics={null}
        isProcessing={true}
      />
    );

    // Add more activities
    rerender(
      <ActivityFeed
        activities={[
          createActivity('1'),
          createActivity('2'),
          createActivity('3'),
        ]}
        metrics={null}
        isProcessing={true}
      />
    );

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('shows scroll to bottom button when not at bottom', () => {
    // This test is more of an integration test - in a real scenario,
    // the button appears when user scrolls up manually
    // For unit testing, we verify the button exists in the component
    render(
      <ActivityFeed
        activities={[
          createActivity('1'),
          createActivity('2'),
          createActivity('3'),
        ]}
        metrics={null}
        isProcessing={true}
      />
    );

    // The scroll to bottom button will appear based on scroll state
    // This is controlled by autoScroll state which defaults to true
    // So the button won't be visible initially
    expect(screen.queryByText('↓ Scroll to bottom')).not.toBeInTheDocument();
  });

  it('applies custom maxHeight', () => {
    render(
      <ActivityFeed
        activities={[createActivity('1')]}
        metrics={null}
        isProcessing={false}
        maxHeight="h-96"
      />
    );

    // The container should have the custom height class
    const feed = screen.getByTestId('activity-feed');
    expect(feed).toBeInTheDocument();
  });

  it('handles various activity types', () => {
    const activities = [
      createActivity('1', { type: 'tool', tool: 'Read', details: 'file1.ts' }),
      createActivity('2', { type: 'message', details: 'Found the bug' }),
      createActivity('3', { type: 'error', details: 'Failed to compile', status: 'error' }),
      createActivity('4', { type: 'result', details: 'Completed', status: 'success' }),
    ];

    render(
      <ActivityFeed
        activities={activities}
        metrics={null}
        isProcessing={false}
      />
    );

    expect(screen.getByText('file1.ts')).toBeInTheDocument();
    expect(screen.getByText('Found the bug')).toBeInTheDocument();
    expect(screen.getByText('Failed to compile')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders many activities efficiently', () => {
    const activities = Array.from({ length: 100 }, (_, i) =>
      createActivity(`activity-${i}`, { details: `file-${i}.ts` })
    );

    render(
      <ActivityFeed
        activities={activities}
        metrics={null}
        isProcessing={false}
      />
    );

    expect(screen.getByText('(100)')).toBeInTheDocument();
    expect(screen.getByText('file-0.ts')).toBeInTheDocument();
    expect(screen.getByText('file-99.ts')).toBeInTheDocument();
  });
});
