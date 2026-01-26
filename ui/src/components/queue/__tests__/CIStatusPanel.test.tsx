import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CIStatusPanel, CIStatusPanelProps } from '../CIStatusPanel';
import { CIStatus, CICheck } from '@/lib/types';

// Helper to create default props
const createDefaultProps = (overrides?: Partial<CIStatusPanelProps>): CIStatusPanelProps => ({
  status: null,
  pollingState: 'idle',
  error: null,
  nextPollIn: 0,
  pollCount: 0,
  isEnabled: true,
  autoFixEnabled: false,
  onRefresh: jest.fn(),
  onAutoFix: undefined,
  onViewDetails: undefined,
  ...overrides,
});

// Helper to create a CICheck
const createCheck = (overrides?: Partial<CICheck>): CICheck => ({
  id: 'check-' + Math.random().toString(36).slice(2),
  name: 'Test Check',
  status: 'queued',
  conclusion: null,
  startedAt: null,
  completedAt: null,
  detailsUrl: 'https://github.com/test/repo/actions/runs/1',
  ...overrides,
});

// Helper to create a CIStatus
const createStatus = (overrides?: Partial<CIStatus>): CIStatus => ({
  sha: 'abc123',
  branch: 'main',
  checks: [createCheck({ status: 'completed', conclusion: 'success' })],
  overallStatus: 'success',
  lastPolledAt: new Date().toISOString(),
  ...overrides,
});

describe('CIStatusPanel', () => {
  describe('disabled state', () => {
    it('shows disabled message when CI awareness is disabled', () => {
      render(<CIStatusPanel {...createDefaultProps({ isEnabled: false })} />);

      expect(screen.getByText('CI/CD Awareness is disabled')).toBeInTheDocument();
    });
  });

  describe('loading states', () => {
    it('shows waiting message when idle with no status', () => {
      render(<CIStatusPanel {...createDefaultProps()} />);

      expect(screen.getByText(/Waiting for push/)).toBeInTheDocument();
    });

    it('shows fetching message when polling', () => {
      render(<CIStatusPanel {...createDefaultProps({ pollingState: 'polling' })} />);

      expect(screen.getByText('Fetching CI status...')).toBeInTheDocument();
    });

    it('shows error with retry button', () => {
      const onRefresh = jest.fn();
      render(
        <CIStatusPanel
          {...createDefaultProps({
            pollingState: 'waiting',
            error: 'Failed to fetch',
            onRefresh,
          })}
        />
      );

      expect(screen.getByText('Failed to fetch')).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  describe('status display', () => {
    it('shows success status correctly', () => {
      const status = createStatus({ overallStatus: 'success' });
      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      expect(screen.getByText('CI Passed')).toBeInTheDocument();
    });

    it('shows failure status correctly', () => {
      const status = createStatus({
        overallStatus: 'failure',
        checks: [createCheck({ status: 'completed', conclusion: 'failure' })],
      });
      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      expect(screen.getByText('CI Failed')).toBeInTheDocument();
    });

    it('shows running status correctly', () => {
      const status = createStatus({
        overallStatus: 'running',
        checks: [createCheck({ status: 'in_progress' })],
      });
      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      expect(screen.getByText('CI Running')).toBeInTheDocument();
    });

    it('shows pending status correctly', () => {
      const status = createStatus({
        overallStatus: 'pending',
        checks: [createCheck({ status: 'queued' })],
      });
      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      expect(screen.getByText('CI Checks Pending')).toBeInTheDocument();
    });

    it('shows mixed status correctly', () => {
      const status = createStatus({
        overallStatus: 'mixed',
        checks: [
          createCheck({ status: 'completed', conclusion: 'success' }),
          createCheck({ status: 'completed', conclusion: 'failure' }),
        ],
      });
      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      expect(screen.getByText('CI Partial Failure')).toBeInTheDocument();
    });
  });

  describe('check list', () => {
    it('displays all checks', () => {
      const status = createStatus({
        checks: [
          createCheck({ name: 'Build', status: 'completed', conclusion: 'success' }),
          createCheck({ name: 'Test', status: 'completed', conclusion: 'failure' }),
          createCheck({ name: 'Lint', status: 'in_progress' }),
        ],
      });
      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      expect(screen.getByText('Build')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('Lint')).toBeInTheDocument();
    });

    it('groups checks by status', () => {
      const status = createStatus({
        checks: [
          createCheck({ name: 'Failed Check', status: 'completed', conclusion: 'failure' }),
          createCheck({ name: 'Running Check', status: 'in_progress' }),
          createCheck({ name: 'Passed Check', status: 'completed', conclusion: 'success' }),
        ],
      });
      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      expect(screen.getByText('Failed (1)')).toBeInTheDocument();
      expect(screen.getByText('Running (1)')).toBeInTheDocument();
      expect(screen.getByText('Passed (1)')).toBeInTheDocument();
    });

    it('shows empty state when no checks', () => {
      const status = createStatus({ checks: [] });
      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      expect(screen.getByText('No CI checks found')).toBeInTheDocument();
    });
  });

  describe('check item interactions', () => {
    it('calls onViewDetails when check is clicked', () => {
      const onViewDetails = jest.fn();
      const check = createCheck({ name: 'Build' });
      const status = createStatus({ checks: [check] });

      render(
        <CIStatusPanel
          {...createDefaultProps({ status, onViewDetails })}
        />
      );

      fireEvent.click(screen.getByText('Build'));
      expect(onViewDetails).toHaveBeenCalledWith(check);
    });

    it('opens details URL when no onViewDetails handler', () => {
      const windowOpen = jest.spyOn(window, 'open').mockImplementation();
      const check = createCheck({
        name: 'Build',
        detailsUrl: 'https://github.com/test/repo/actions/runs/1',
      });
      const status = createStatus({ checks: [check] });

      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      fireEvent.click(screen.getByText('Build'));
      expect(windowOpen).toHaveBeenCalledWith(
        'https://github.com/test/repo/actions/runs/1',
        '_blank',
        'noopener,noreferrer'
      );

      windowOpen.mockRestore();
    });
  });

  describe('auto-fix button', () => {
    it('shows auto-fix button when failures exist and enabled', () => {
      const onAutoFix = jest.fn();
      const status = createStatus({
        overallStatus: 'failure',
        checks: [createCheck({ status: 'completed', conclusion: 'failure' })],
      });

      render(
        <CIStatusPanel
          {...createDefaultProps({
            status,
            autoFixEnabled: true,
            onAutoFix,
          })}
        />
      );

      expect(screen.getByText(/Auto-Fix CI/)).toBeInTheDocument();
    });

    it('does not show auto-fix button when no failures', () => {
      const onAutoFix = jest.fn();
      const status = createStatus({ overallStatus: 'success' });

      render(
        <CIStatusPanel
          {...createDefaultProps({
            status,
            autoFixEnabled: true,
            onAutoFix,
          })}
        />
      );

      expect(screen.queryByText(/Auto-Fix CI/)).not.toBeInTheDocument();
    });

    it('does not show auto-fix button when disabled', () => {
      const onAutoFix = jest.fn();
      const status = createStatus({
        overallStatus: 'failure',
        checks: [createCheck({ status: 'completed', conclusion: 'failure' })],
      });

      render(
        <CIStatusPanel
          {...createDefaultProps({
            status,
            autoFixEnabled: false,
            onAutoFix,
          })}
        />
      );

      expect(screen.queryByText(/Auto-Fix CI/)).not.toBeInTheDocument();
    });

    it('calls onAutoFix when button clicked', () => {
      const onAutoFix = jest.fn();
      const status = createStatus({
        overallStatus: 'failure',
        checks: [createCheck({ status: 'completed', conclusion: 'failure' })],
      });

      render(
        <CIStatusPanel
          {...createDefaultProps({
            status,
            autoFixEnabled: true,
            onAutoFix,
          })}
        />
      );

      fireEvent.click(screen.getByText(/Auto-Fix CI/));
      expect(onAutoFix).toHaveBeenCalled();
    });
  });

  describe('refresh button', () => {
    it('shows refresh button', () => {
      const status = createStatus();
      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      expect(screen.getByText('↻ Refresh')).toBeInTheDocument();
    });

    it('calls onRefresh when clicked', () => {
      const onRefresh = jest.fn();
      const status = createStatus();

      render(<CIStatusPanel {...createDefaultProps({ status, onRefresh })} />);

      fireEvent.click(screen.getByText('↻ Refresh'));
      expect(onRefresh).toHaveBeenCalled();
    });

    it('disables refresh button when polling', () => {
      const status = createStatus();
      render(
        <CIStatusPanel
          {...createDefaultProps({ status, pollingState: 'polling' })}
        />
      );

      const refreshButton = screen.getByText('↻ Refresh').closest('button');
      expect(refreshButton).toBeDisabled();
    });
  });

  describe('footer information', () => {
    it('shows branch and SHA', () => {
      const status = createStatus({ branch: 'feature/test', sha: 'abc123456789' });
      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      expect(screen.getByText('Branch: feature/test')).toBeInTheDocument();
      expect(screen.getByText('abc1234')).toBeInTheDocument(); // Truncated SHA
    });

    it('shows poll count when greater than 0', () => {
      const status = createStatus();
      render(<CIStatusPanel {...createDefaultProps({ status, pollCount: 5 })} />);

      expect(screen.getByText('5 polls')).toBeInTheDocument();
    });
  });

  describe('polling indicators', () => {
    it('shows checking message when polling', () => {
      const status = createStatus({ overallStatus: 'running' });
      render(
        <CIStatusPanel
          {...createDefaultProps({ status, pollingState: 'polling' })}
        />
      );

      expect(screen.getByText('Checking...')).toBeInTheDocument();
    });

    it('shows next check countdown when waiting', () => {
      const status = createStatus({ overallStatus: 'running' });
      render(
        <CIStatusPanel
          {...createDefaultProps({
            status,
            pollingState: 'waiting',
            nextPollIn: 15000,
          })}
        />
      );

      expect(screen.getByText('Next check in 15s')).toBeInTheDocument();
    });
  });

  describe('duration formatting', () => {
    it('shows duration for completed checks', () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000);

      const status = createStatus({
        checks: [
          createCheck({
            name: 'Build',
            status: 'completed',
            conclusion: 'success',
            startedAt: oneMinuteAgo.toISOString(),
            completedAt: now.toISOString(),
          }),
        ],
      });

      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      expect(screen.getByText('1m')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible check items', () => {
      const status = createStatus({
        checks: [createCheck({ name: 'Build', status: 'completed', conclusion: 'success' })],
      });

      render(<CIStatusPanel {...createDefaultProps({ status })} />);

      const checkItem = screen.getByRole('button', { name: /Build: Passed/i });
      expect(checkItem).toBeInTheDocument();
    });

    it('supports keyboard navigation on check items', () => {
      const onViewDetails = jest.fn();
      const check = createCheck({ name: 'Build' });
      const status = createStatus({ checks: [check] });

      render(
        <CIStatusPanel
          {...createDefaultProps({ status, onViewDetails })}
        />
      );

      const checkItem = screen.getByRole('button', { name: /Build/i });
      fireEvent.keyDown(checkItem, { key: 'Enter' });
      expect(onViewDetails).toHaveBeenCalledWith(check);
    });
  });
});
