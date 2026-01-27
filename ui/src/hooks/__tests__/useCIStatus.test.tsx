/**
 * Tests for useCIStatus hook
 *
 * @see PRD-07-CICD-AWARENESS.md for specification
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useCIStatus, getCIStatusIcon, getCIStatusColor } from '../useCIStatus';
import type { CIStatusResponse } from '@/lib/types';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('useCIStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const defaultOptions = {
    owner: 'test-owner',
    repo: 'test-repo',
    sha: 'abc1234',
    config: {
      enabled: true,
      pollInterval: 5000,
      maxRetries: 3,
    },
  };

  const mockSuccessResponse: CIStatusResponse = {
    prUrl: 'https://github.com/test-owner/test-repo/pull/1',
    sha: 'abc1234',
    checks: [
      {
        id: '1',
        name: 'lint-and-test',
        status: 'success',
        conclusion: 'success',
        detailsUrl: 'https://github.com/test-owner/test-repo/actions/runs/1',
        startedAt: '2026-01-26T10:00:00Z',
        completedAt: '2026-01-26T10:05:00Z',
      },
    ],
    overallStatus: 'success',
    failures: [],
    lastUpdated: '2026-01-26T10:05:00Z',
  };

  const mockFailureResponse: CIStatusResponse = {
    prUrl: 'https://github.com/test-owner/test-repo/pull/1',
    sha: 'abc1234',
    checks: [
      {
        id: '1',
        name: 'lint-and-test',
        status: 'failure',
        conclusion: 'failure',
        detailsUrl: 'https://github.com/test-owner/test-repo/actions/runs/1',
        startedAt: '2026-01-26T10:00:00Z',
        completedAt: '2026-01-26T10:05:00Z',
      },
    ],
    overallStatus: 'failure',
    failures: [
      {
        checkName: 'lint-and-test',
        error: 'Type error in src/auth.ts:42',
        logs: 'Error: Type error...',
      },
    ],
    lastUpdated: '2026-01-26T10:05:00Z',
  };

  describe('initial state', () => {
    it('should have null status initially', () => {
      const { result } = renderHook(() => useCIStatus(defaultOptions));

      expect(result.current.status).toBeNull();
      expect(result.current.isPolling).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.overallStatus).toBeNull();
      expect(result.current.failures).toEqual([]);
    });
  });

  describe('refresh', () => {
    it('should fetch CI status on refresh', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useCIStatus(defaultOptions));

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ci/status?sha=abc1234&owner=test-owner&repo=test-repo')
      );
      expect(result.current.status).toEqual(mockSuccessResponse);
      expect(result.current.overallStatus).toBe('success');
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Commit not found' }),
      });

      const { result } = renderHook(() => useCIStatus(defaultOptions));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toContain('Commit not found');
      expect(result.current.status).toBeNull();
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useCIStatus(defaultOptions));

      await act(async () => {
        await result.current.refresh();
      });

      expect(result.current.error).toContain('Network error');
    });
  });

  describe('polling', () => {
    it('should start polling when startPolling is called', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useCIStatus(defaultOptions));

      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(true);

      // Wait for initial fetch
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it('should stop polling when stopPolling is called', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useCIStatus(defaultOptions));

      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(true);

      act(() => {
        result.current.stopPolling();
      });

      expect(result.current.isPolling).toBe(false);
    });

    it('should stop polling on success status', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() => useCIStatus(defaultOptions));

      act(() => {
        result.current.startPolling();
      });

      // Wait for status to be updated
      await waitFor(() => {
        expect(result.current.status?.overallStatus).toBe('success');
      });

      // Polling should stop on success
      await waitFor(() => {
        expect(result.current.isPolling).toBe(false);
      });
    });

    it('should not start polling when disabled', () => {
      const { result } = renderHook(() =>
        useCIStatus({
          ...defaultOptions,
          config: { ...defaultOptions.config, enabled: false },
        })
      );

      act(() => {
        result.current.startPolling();
      });

      expect(result.current.isPolling).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('should call onSuccess when checks pass', async () => {
      const onSuccess = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() =>
        useCIStatus({
          ...defaultOptions,
          onSuccess,
        })
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(onSuccess).toHaveBeenCalledWith(mockSuccessResponse);
    });

    it('should call onFailure when checks fail', async () => {
      const onFailure = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFailureResponse,
      });

      const { result } = renderHook(() =>
        useCIStatus({
          ...defaultOptions,
          onFailure,
        })
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(onFailure).toHaveBeenCalledWith(
        mockFailureResponse,
        mockFailureResponse.failures
      );
    });

    it('should call onUpdate on each status update', async () => {
      const onUpdate = jest.fn();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuccessResponse,
      });

      const { result } = renderHook(() =>
        useCIStatus({
          ...defaultOptions,
          onUpdate,
        })
      );

      await act(async () => {
        await result.current.refresh();
      });

      expect(onUpdate).toHaveBeenCalledWith(mockSuccessResponse);
    });
  });

  describe('triggerAutoFix', () => {
    it('should POST to /api/ci/fix with failure details', async () => {
      // First set up a failure status
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFailureResponse,
      });

      const { result } = renderHook(() => useCIStatus(defaultOptions));

      await act(async () => {
        await result.current.refresh();
      });

      // Then trigger auto-fix
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Fix queued' }),
      });

      let fixResult: boolean = false;
      await act(async () => {
        fixResult = await result.current.triggerAutoFix();
      });

      expect(fixResult).toBe(true);
      expect(mockFetch).toHaveBeenLastCalledWith(
        '/api/ci/fix',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('lint-and-test'),
        })
      );
    });

    it('should return false when no failures exist', async () => {
      const { result } = renderHook(() => useCIStatus(defaultOptions));

      let fixResult: boolean = false;
      await act(async () => {
        fixResult = await result.current.triggerAutoFix();
      });

      expect(fixResult).toBe(false);
    });

    it('should handle fix API errors', async () => {
      // First set up a failure status
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockFailureResponse,
      });

      const { result } = renderHook(() => useCIStatus(defaultOptions));

      await act(async () => {
        await result.current.refresh();
      });

      // Then trigger auto-fix with error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Fix failed' }),
      });

      let fixResult: boolean = false;
      await act(async () => {
        fixResult = await result.current.triggerAutoFix();
      });

      expect(fixResult).toBe(false);
      expect(result.current.error).toContain('Auto-fix failed');
    });
  });
});

describe('getCIStatusIcon', () => {
  it('should return correct icons for each status', () => {
    expect(getCIStatusIcon('pending')).toBe('🟡');
    expect(getCIStatusIcon('running')).toBe('⏳');
    expect(getCIStatusIcon('success')).toBe('✅');
    expect(getCIStatusIcon('failure')).toBe('❌');
    expect(getCIStatusIcon('cancelled')).toBe('⚪');
    expect(getCIStatusIcon('skipped')).toBe('⏭️');
    expect(getCIStatusIcon(null)).toBe('❓');
  });
});

describe('getCIStatusColor', () => {
  it('should return correct color classes for each status', () => {
    expect(getCIStatusColor('pending')).toBe('text-yellow-500');
    expect(getCIStatusColor('running')).toBe('text-blue-500');
    expect(getCIStatusColor('success')).toBe('text-green-500');
    expect(getCIStatusColor('failure')).toBe('text-red-500');
    expect(getCIStatusColor('cancelled')).toBe('text-gray-500');
    expect(getCIStatusColor('skipped')).toBe('text-gray-400');
    expect(getCIStatusColor(null)).toBe('text-gray-500');
  });
});
