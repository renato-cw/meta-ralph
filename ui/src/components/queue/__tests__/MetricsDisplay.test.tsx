import { render, screen } from '@testing-library/react';
import { MetricsDisplay } from '../MetricsDisplay';
import type { ExecutionMetrics } from '@/lib/types';

describe('MetricsDisplay', () => {
  const createMetrics = (overrides: Partial<ExecutionMetrics> = {}): ExecutionMetrics => ({
    iteration: 3,
    maxIterations: 10,
    costUsd: 0.0045,
    durationMs: 12500,
    totalCostUsd: 0.0135,
    totalDurationMs: 37500,
    ...overrides,
  });

  it('renders metrics correctly', () => {
    const metrics = createMetrics();
    render(<MetricsDisplay metrics={metrics} />);

    expect(screen.getByTestId('metrics-display')).toBeInTheDocument();
    expect(screen.getByText(/Loop 3 of 10/)).toBeInTheDocument();
  });

  it('displays placeholder when no metrics', () => {
    render(<MetricsDisplay metrics={null} />);

    expect(screen.getByText('No processing data')).toBeInTheDocument();
  });

  it('displays waiting message when processing but no metrics yet', () => {
    render(<MetricsDisplay metrics={null} isProcessing={true} />);

    expect(screen.getByText('Waiting for metrics...')).toBeInTheDocument();
  });

  it('shows running indicator when processing', () => {
    const metrics = createMetrics();
    render(<MetricsDisplay metrics={metrics} isProcessing={true} />);

    expect(screen.getByText('running')).toBeInTheDocument();
    expect(screen.getByTestId('metrics-display').querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('does not show running indicator when not processing', () => {
    const metrics = createMetrics();
    render(<MetricsDisplay metrics={metrics} isProcessing={false} />);

    expect(screen.queryByText('running')).not.toBeInTheDocument();
  });

  it('displays cost in USD format', () => {
    const metrics = createMetrics({ costUsd: 0.0123 });
    render(<MetricsDisplay metrics={metrics} />);

    // Should show cost formatted as currency
    expect(screen.getByText('$0.0123')).toBeInTheDocument();
  });

  it('displays duration in human readable format for seconds', () => {
    const metrics = createMetrics({ durationMs: 45000 }); // 45 seconds
    render(<MetricsDisplay metrics={metrics} />);

    expect(screen.getByText('45.0s')).toBeInTheDocument();
  });

  it('displays duration in human readable format for minutes', () => {
    const metrics = createMetrics({ durationMs: 125000 }); // 2m 5s
    render(<MetricsDisplay metrics={metrics} />);

    expect(screen.getByText('2m 5s')).toBeInTheDocument();
  });

  it('displays duration in milliseconds for short durations', () => {
    const metrics = createMetrics({ durationMs: 500 });
    render(<MetricsDisplay metrics={metrics} />);

    expect(screen.getByText('500ms')).toBeInTheDocument();
  });

  it('calculates and displays progress percentage', () => {
    const metrics = createMetrics({ iteration: 5, maxIterations: 10 });
    render(<MetricsDisplay metrics={metrics} />);

    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('displays 100% for completed processing', () => {
    const metrics = createMetrics({ iteration: 10, maxIterations: 10 });
    render(<MetricsDisplay metrics={metrics} />);

    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('displays session totals', () => {
    const metrics = createMetrics({
      totalCostUsd: 0.05,
      totalDurationMs: 120000, // 2 minutes
    });
    render(<MetricsDisplay metrics={metrics} />);

    expect(screen.getByText('Session Total')).toBeInTheDocument();
    expect(screen.getByText('$0.0500')).toBeInTheDocument();
    expect(screen.getByText('2m 0s')).toBeInTheDocument();
  });

  it('renders progress bar with correct width', () => {
    const metrics = createMetrics({ iteration: 3, maxIterations: 10 });
    render(<MetricsDisplay metrics={metrics} />);

    const progressBar = screen.getByTestId('metrics-display').querySelector('[style*="width"]');
    expect(progressBar).toHaveStyle({ width: '30%' });
  });

  it('uses blue color for progress bar when processing', () => {
    const metrics = createMetrics();
    render(<MetricsDisplay metrics={metrics} isProcessing={true} />);

    const progressBar = screen.getByTestId('metrics-display').querySelector('[style*="width"]');
    expect(progressBar).toHaveClass('bg-blue-500');
  });

  it('uses green color for progress bar when not processing', () => {
    const metrics = createMetrics();
    render(<MetricsDisplay metrics={metrics} isProcessing={false} />);

    const progressBar = screen.getByTestId('metrics-display').querySelector('[style*="width"]');
    expect(progressBar).toHaveClass('bg-green-500');
  });

  it('handles iteration 1 of 1', () => {
    const metrics = createMetrics({ iteration: 1, maxIterations: 1 });
    render(<MetricsDisplay metrics={metrics} />);

    expect(screen.getByText(/Loop 1 of 1/)).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('handles large iteration counts', () => {
    const metrics = createMetrics({ iteration: 15, maxIterations: 20 });
    render(<MetricsDisplay metrics={metrics} />);

    expect(screen.getByText(/Loop 15 of 20/)).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('handles very small costs', () => {
    const metrics = createMetrics({ costUsd: 0.0001 });
    render(<MetricsDisplay metrics={metrics} />);

    expect(screen.getByText('$0.0001')).toBeInTheDocument();
  });

  it('handles zero cost', () => {
    const metrics = createMetrics({ costUsd: 0 });
    render(<MetricsDisplay metrics={metrics} />);

    expect(screen.getByText('$0.0000')).toBeInTheDocument();
  });
});
