import { render, screen } from '@testing-library/react';
import { ActivityItem } from '../ActivityItem';
import type { Activity } from '@/lib/types';

describe('ActivityItem', () => {
  const createActivity = (overrides: Partial<Activity> = {}): Activity => ({
    id: 'test-activity-1',
    timestamp: '2024-01-15T10:30:00.000Z',
    type: 'tool',
    tool: 'Read',
    details: 'src/components/Button.tsx',
    status: 'success',
    ...overrides,
  });

  it('renders a tool activity with correct icon and label', () => {
    const activity = createActivity({ tool: 'Read', details: 'src/file.ts' });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByText('src/file.ts')).toBeInTheDocument();
    expect(screen.getByTestId('activity-item')).toBeInTheDocument();
  });

  it('renders Edit tool activity correctly', () => {
    const activity = createActivity({ tool: 'Edit', details: 'src/utils.ts' });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('src/utils.ts')).toBeInTheDocument();
  });

  it('renders Bash tool activity correctly', () => {
    const activity = createActivity({ tool: 'Bash', details: 'npm run test' });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('Bash')).toBeInTheDocument();
    expect(screen.getByText('npm run test')).toBeInTheDocument();
  });

  it('renders Grep tool activity correctly', () => {
    const activity = createActivity({ tool: 'Grep', details: 'searchPattern' });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('Grep')).toBeInTheDocument();
    expect(screen.getByText('searchPattern')).toBeInTheDocument();
  });

  it('renders message type activity correctly', () => {
    const activity = createActivity({
      type: 'message',
      tool: undefined,
      details: 'I found the issue in the code.',
    });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('I found the issue in the code.')).toBeInTheDocument();
  });

  it('renders error type activity correctly', () => {
    const activity = createActivity({
      type: 'error',
      tool: undefined,
      details: 'Failed to read file',
      status: 'error',
    });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Failed to read file')).toBeInTheDocument();
  });

  it('renders result type activity correctly', () => {
    const activity = createActivity({
      type: 'result',
      tool: undefined,
      details: 'Loop 1 complete - $0.0023 / 5.2s',
      status: 'success',
    });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('Result')).toBeInTheDocument();
    expect(screen.getByText('Loop 1 complete - $0.0023 / 5.2s')).toBeInTheDocument();
  });

  it('renders system type activity correctly', () => {
    const activity = createActivity({
      type: 'system',
      tool: undefined,
      details: 'System message',
    });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('displays timestamp correctly', () => {
    const activity = createActivity({ timestamp: '2024-01-15T14:30:45.000Z' });
    render(<ActivityItem activity={activity} />);

    // The timestamp should be formatted
    expect(screen.getByTestId('activity-item')).toHaveTextContent(/\d{2}:\d{2}:\d{2}/);
  });

  it('shows pending status indicator for pending activities', () => {
    const activity = createActivity({ status: 'pending' });
    render(<ActivityItem activity={activity} />);

    // Should have a pulsing indicator
    const item = screen.getByTestId('activity-item');
    expect(item.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('shows check icon for success status', () => {
    const activity = createActivity({ status: 'success' });
    render(<ActivityItem activity={activity} />);

    // Should have a success indicator (check icon)
    const item = screen.getByTestId('activity-item');
    expect(item.querySelector('svg')).toBeInTheDocument();
  });

  it('shows x icon for error status', () => {
    const activity = createActivity({ status: 'error' });
    render(<ActivityItem activity={activity} />);

    // Should have an error indicator (x icon)
    const item = screen.getByTestId('activity-item');
    expect(item.querySelector('svg')).toBeInTheDocument();
  });

  it('applies special styling when isLast is true', () => {
    const activity = createActivity();
    render(<ActivityItem activity={activity} isLast={true} />);

    const item = screen.getByTestId('activity-item');
    expect(item).toHaveClass('ring-1');
  });

  it('does not apply special styling when isLast is false', () => {
    const activity = createActivity();
    render(<ActivityItem activity={activity} isLast={false} />);

    const item = screen.getByTestId('activity-item');
    expect(item).not.toHaveClass('ring-1');
  });

  it('truncates long details text', () => {
    const longDetails = 'a'.repeat(200);
    const activity = createActivity({ details: longDetails });
    render(<ActivityItem activity={activity} />);

    // The details should be present with title attribute for full text
    const detailsElement = screen.getByText(longDetails);
    expect(detailsElement).toHaveAttribute('title', longDetails);
  });

  it('handles activity without details', () => {
    const activity = createActivity({ details: undefined });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByTestId('activity-item')).toBeInTheDocument();
    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('handles Write tool activity', () => {
    const activity = createActivity({ tool: 'Write', details: 'new-file.ts' });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('Write')).toBeInTheDocument();
    expect(screen.getByText('new-file.ts')).toBeInTheDocument();
  });

  it('handles Task tool activity', () => {
    const activity = createActivity({ tool: 'Task', details: 'Running tests' });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('Task')).toBeInTheDocument();
    expect(screen.getByText('Running tests')).toBeInTheDocument();
  });

  it('handles TodoWrite tool activity', () => {
    const activity = createActivity({ tool: 'TodoWrite', details: 'todo list' });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('TodoWrite')).toBeInTheDocument();
  });

  it('handles Glob tool activity', () => {
    const activity = createActivity({ tool: 'Glob', details: '**/*.ts' });
    render(<ActivityItem activity={activity} />);

    expect(screen.getByText('Glob')).toBeInTheDocument();
    expect(screen.getByText('**/*.ts')).toBeInTheDocument();
  });
});
