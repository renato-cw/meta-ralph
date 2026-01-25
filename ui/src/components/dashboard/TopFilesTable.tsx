'use client';

interface TopFilesTableProps {
  /** Top files with issue counts */
  data: { file: string; count: number }[];
  /** Maximum number of files to display */
  maxItems?: number;
  /** Whether the table is loading */
  loading?: boolean;
}

/**
 * TopFilesTable displays the files with the most issues.
 * Used in the dashboard to identify hotspots in the codebase.
 */
export function TopFilesTable({
  data,
  maxItems = 5,
  loading = false,
}: TopFilesTableProps) {
  if (loading) {
    return (
      <div
        className="space-y-2 animate-pulse"
        data-testid="top-files-table-loading"
      >
        {[...Array(maxItems)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="h-4 bg-zinc-700 rounded w-2/3" />
            <div className="h-4 bg-zinc-700 rounded w-8" />
          </div>
        ))}
      </div>
    );
  }

  const items = data.slice(0, maxItems);

  if (items.length === 0) {
    return (
      <div
        className="text-center text-zinc-500 py-4"
        data-testid="top-files-table-empty"
      >
        No files with issues
      </div>
    );
  }

  const maxCount = Math.max(...items.map((item) => item.count));

  return (
    <div className="space-y-2" data-testid="top-files-table">
      {items.map((item, index) => (
        <div
          key={item.file}
          className="relative"
        >
          {/* Background bar showing relative count */}
          <div
            className="absolute inset-y-0 left-0 bg-zinc-700/30 rounded"
            style={{ width: `${(item.count / maxCount) * 100}%` }}
          />
          <div className="relative flex items-center justify-between py-1.5 px-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-zinc-500 text-sm w-4">{index + 1}.</span>
              <span
                className="text-zinc-300 text-sm truncate"
                title={item.file}
              >
                {item.file}
              </span>
            </div>
            <span className="text-zinc-400 text-sm font-medium ml-2">
              {item.count}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TopFilesTable;
