'use client';

interface QueueProgressProps {
  total: number;
  completed: number;
  failed: number;
  processing: number;
  startedAt?: string;
}

function formatETA(completed: number, total: number, startedAt?: string): string {
  if (!startedAt || completed === 0 || completed >= total) return '';

  const elapsed = Date.now() - new Date(startedAt).getTime();
  const avgTimePerItem = elapsed / completed;
  const remaining = total - completed;
  const eta = Math.round((remaining * avgTimePerItem) / 1000);

  if (eta < 60) return `~${eta}s remaining`;
  if (eta < 3600) return `~${Math.floor(eta / 60)}m remaining`;
  return `~${Math.floor(eta / 3600)}h ${Math.floor((eta % 3600) / 60)}m remaining`;
}

function formatElapsed(startedAt?: string): string {
  if (!startedAt) return '';

  const elapsed = Math.round((Date.now() - new Date(startedAt).getTime()) / 1000);

  if (elapsed < 60) return `${elapsed}s`;
  if (elapsed < 3600) return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  return `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;
}

/**
 * Progress bar and statistics for the processing queue.
 * Shows completion percentage, counts, and estimated time remaining.
 */
export function QueueProgress({
  total,
  completed,
  failed,
  processing,
  startedAt,
}: QueueProgressProps) {
  const successCount = completed;
  const doneCount = completed + failed;
  const percentage = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const pending = total - doneCount - processing;
  const eta = formatETA(doneCount, total, startedAt);
  const elapsed = formatElapsed(startedAt);

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="relative h-3 bg-[var(--background)] rounded-full overflow-hidden">
        {/* Success portion */}
        <div
          className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300"
          style={{ width: `${(successCount / total) * 100}%` }}
        />
        {/* Failed portion */}
        <div
          className="absolute top-0 h-full bg-red-500 transition-all duration-300"
          style={{
            left: `${(successCount / total) * 100}%`,
            width: `${(failed / total) * 100}%`
          }}
        />
        {/* Processing indicator (animated) */}
        {processing > 0 && (
          <div
            className="absolute top-0 h-full bg-blue-500 transition-all duration-300 animate-pulse"
            style={{
              left: `${(doneCount / total) * 100}%`,
              width: `${(processing / total) * 100}%`
            }}
          />
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          <span className="text-[var(--foreground)]">
            <span className="font-medium">{percentage}%</span> complete
          </span>
          {elapsed && (
            <span className="text-[var(--muted)]">{elapsed} elapsed</span>
          )}
          {eta && (
            <span className="text-[var(--muted)]">{eta}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <span className="text-gray-400">
              <span className="inline-block w-2 h-2 bg-gray-500 rounded-full mr-1" />
              {pending} pending
            </span>
          )}
          {processing > 0 && (
            <span className="text-blue-400">
              <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse" />
              {processing} processing
            </span>
          )}
          {successCount > 0 && (
            <span className="text-green-400">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1" />
              {successCount} completed
            </span>
          )}
          {failed > 0 && (
            <span className="text-red-400">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1" />
              {failed} failed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
