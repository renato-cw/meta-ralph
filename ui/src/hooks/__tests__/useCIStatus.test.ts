import { renderHook, act, waitFor } from '@testing-library/react';
import { useCIStatus, computeOverallStatus } from '../useCIStatus';
import { CICheck, CIStatus, CIOverallStatus } from '@/lib/types';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('computeOverallStatus', () => {
  it('returns pending when no checks exist', () => {
    expect(computeOverallStatus([])).toBe('pending');
  });

  it('returns running when any check is in_progress', () => {
    const checks: CICheck[] = [
      createCheck({ status: 'completed', conclusion: 'success' }),
      createCheck({ status: 'in_progress' }),
    ];
    expect(computeOverallStatus(checks)).toBe('running');
  });

  it('returns pending when any check is queued', () => {
    const checks: CICheck[] = [
      createCheck({ status: 'completed', conclusion: 'success' }),
      createCheck({ status: 'queued' }),
    ];
    expect(computeOverallStatus(checks)).toBe('pending');
  });

  it('returns success when all checks pass', () => {
    const checks: CICheck[] = [
      createCheck({ status: 'completed', conclusion: 'success' }),
      createCheck({ status: 'completed', conclusion: 'success' }),
    ];
    expect(computeOverallStatus(checks)).toBe('success');
  });

  it('returns failure when all completed checks fail', () => {
    const checks: CICheck[] = [
      createCheck({ status: 'completed', conclusion: 'failure' }),
      createCheck({ status: 'completed', conclusion: 'failure' }),
    ];
    expect(computeOverallStatus(checks)).toBe('failure');
  });

  it('returns mixed when some pass and some fail', () => {
    const checks: CICheck[] = [
      createCheck({ status: 'completed', conclusion: 'success' }),
      createCheck({ status: 'completed', conclusion: 'failure' }),
    ];
    expect(computeOverallStatus(checks)).toBe('mixed');
  });

  it('treats skipped as non-failure', () => {
    const checks: CICheck[] = [
      createCheck({ status: 'completed', conclusion: 'success' }),
      createCheck({ status: 'completed', conclusion: 'skipped' }),
    ];
    expect(computeOverallStatus(checks)).toBe('success');
  });
});

describe('useCIStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes with idle state', () => {
    const { result } = renderHook(() =>
      useCIStatus({
        branch: 'main',
        sha: 'abc123',
        enabled: false,
      })
    );

    expect(result.current.status).toBeNull();
    expect(result.current.pollingState).toBe('idle');
    expect(result.current.error).toBeNull();
    expect(result.current.pollCount).toBe(0);
  });

  it('provides startPolling and stopPolling functions', () => {
    const { result } = renderHook(() =>
      useCIStatus({
        branch: 'main',
        sha: 'abc123',
      })
    );

    expect(typeof result.current.startPolling).toBe('function');
    expect(typeof result.current.stopPolling).toBe('function');
    expect(typeof result.current.refresh).toBe('function');
    expect(typeof result.current.triggerAutoFix).toBe('function');
    expect(typeof result.current.getFailedChecks).toBe('function');
  });

  it('fetches CI status when startPolling is called', async () => {
    const mockStatus: CIStatus = {
      sha: 'abc123',
      branch: 'main',
      checks: [createCheck({ status: 'in_progress' })],
      overallStatus: 'running',
      lastPolledAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    });

    const { result } = renderHook(() =>
      useCIStatus({
        branch: 'main',
        sha: 'abc123',
      })
    );

    act(() => {
      result.current.startPolling();
    });

    await waitFor(() => {
      expect(result.current.pollCount).toBe(1);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/ci/status')
    );
  });

  it('stops polling when stopPolling is called', async () => {
    const mockStatus: CIStatus = {
      sha: 'abc123',
      branch: 'main',
      checks: [createCheck({ status: 'in_progress' })],
      overallStatus: 'running',
      lastPolledAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockStatus,
    });

    const { result } = renderHook(() =>
      useCIStatus({
        branch: 'main',
        sha: 'abc123',
      })
    );

    act(() => {
      result.current.startPolling();
    });

    await waitFor(() => {
      expect(result.current.pollCount).toBeGreaterThan(0);
    });

    act(() => {
      result.current.stopPolling();
    });

    expect(result.current.pollingState).toBe('idle');
  });

  it('calls onComplete when CI finishes successfully', async () => {
    const mockStatus: CIStatus = {
      sha: 'abc123',
      branch: 'main',
      checks: [createCheck({ status: 'completed', conclusion: 'success' })],
      overallStatus: 'success',
      lastPolledAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    });

    const onComplete = jest.fn();

    const { result } = renderHook(() =>
      useCIStatus({
        branch: 'main',
        sha: 'abc123',
        onComplete,
      })
    );

    act(() => {
      result.current.startPolling();
    });

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith('success', mockStatus.checks);
    });
  });

  it('calls onAutoFix when CI fails', async () => {
    const failedCheck = createCheck({ status: 'completed', conclusion: 'failure' });
    const mockStatus: CIStatus = {
      sha: 'abc123',
      branch: 'main',
      checks: [failedCheck],
      overallStatus: 'failure',
      lastPolledAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    });

    const onAutoFix = jest.fn();

    const { result } = renderHook(() =>
      useCIStatus({
        branch: 'main',
        sha: 'abc123',
        onAutoFix,
      })
    );

    act(() => {
      result.current.startPolling();
    });

    await waitFor(() => {
      expect(onAutoFix).toHaveBeenCalledWith([failedCheck]);
    });
  });

  it('handles fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      useCIStatus({
        branch: 'main',
        sha: 'abc123',
      })
    );

    act(() => {
      result.current.startPolling();
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });

  it('getFailedChecks returns only failed checks', async () => {
    const successCheck = createCheck({ id: '1', status: 'completed', conclusion: 'success' });
    const failedCheck = createCheck({ id: '2', status: 'completed', conclusion: 'failure' });

    const mockStatus: CIStatus = {
      sha: 'abc123',
      branch: 'main',
      checks: [successCheck, failedCheck],
      overallStatus: 'mixed',
      lastPolledAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    });

    const { result } = renderHook(() =>
      useCIStatus({
        branch: 'main',
        sha: 'abc123',
      })
    );

    act(() => {
      result.current.startPolling();
    });

    await waitFor(() => {
      expect(result.current.status).not.toBeNull();
    });

    const failedChecks = result.current.getFailedChecks();
    expect(failedChecks).toHaveLength(1);
    expect(failedChecks[0].id).toBe('2');
  });

  it('resets state when branch/sha changes', async () => {
    const { result, rerender } = renderHook(
      ({ branch, sha }) => useCIStatus({ branch, sha }),
      { initialProps: { branch: 'main', sha: 'abc123' } }
    );

    const mockStatus: CIStatus = {
      sha: 'abc123',
      branch: 'main',
      checks: [createCheck({ status: 'completed', conclusion: 'success' })],
      overallStatus: 'success',
      lastPolledAt: new Date().toISOString(),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    });

    act(() => {
      result.current.startPolling();
    });

    await waitFor(() => {
      expect(result.current.status).not.toBeNull();
    });

    // Change branch/sha
    rerender({ branch: 'feature', sha: 'def456' });

    expect(result.current.status).toBeNull();
    expect(result.current.pollCount).toBe(0);
  });

  it('triggerAutoFix sends request to API', async () => {
    const mockStatus: CIStatus = {
      sha: 'abc123',
      branch: 'main',
      checks: [createCheck({ status: 'completed', conclusion: 'failure', name: 'test' })],
      overallStatus: 'failure',
      lastPolledAt: new Date().toISOString(),
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockStatus,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          message: 'Fix initiated',
          fixAttempted: true,
        }),
      });

    const { result } = renderHook(() =>
      useCIStatus({
        branch: 'main',
        sha: 'abc123',
      })
    );

    act(() => {
      result.current.startPolling();
    });

    await waitFor(() => {
      expect(result.current.status).not.toBeNull();
    });

    let fixResponse;
    await act(async () => {
      fixResponse = await result.current.triggerAutoFix('issue-123');
    });

    expect(fixResponse).toEqual({
      success: true,
      message: 'Fix initiated',
      fixAttempted: true,
    });

    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/ci/fix',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    );
  });

  it('triggerAutoFix returns error when no status available', async () => {
    const { result } = renderHook(() =>
      useCIStatus({
        branch: 'main',
        sha: 'abc123',
      })
    );

    let fixResponse;
    await act(async () => {
      fixResponse = await result.current.triggerAutoFix('issue-123');
    });

    expect(fixResponse).toEqual({
      success: false,
      message: 'No CI status available',
      fixAttempted: false,
    });
  });
});

// Helper to create a CICheck with defaults
function createCheck(overrides: Partial<CICheck> = {}): CICheck {
  return {
    id: 'check-' + Math.random().toString(36).slice(2),
    name: 'Test Check',
    status: 'queued',
    conclusion: null,
    startedAt: null,
    completedAt: null,
    detailsUrl: 'https://github.com/test/repo/actions/runs/1',
    ...overrides,
  };
}
