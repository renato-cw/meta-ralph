'use client';

import type { Issue } from '@/lib/types';

/**
 * Extract repository full name from issue (supports both MultiRepoIssue and metadata).
 */
function getRepoFullName(issue: Issue): string | null {
  // Check for target_repo directly on extended issue (MultiRepoIssue)
  const extendedIssue = issue as Issue & { target_repo?: { fullName?: string; repo?: string } };
  if (extendedIssue.target_repo?.fullName) {
    return extendedIssue.target_repo.fullName;
  }
  if (extendedIssue.target_repo?.repo) {
    return extendedIssue.target_repo.repo;
  }
  // Check metadata for target_repo (fallback for normalized issues)
  if (issue.metadata?.target_repo) {
    const targetRepo = issue.metadata.target_repo as { fullName?: string; full_name?: string; repo?: string };
    return targetRepo.fullName || targetRepo.full_name || targetRepo.repo || null;
  }
  return null;
}

interface IssueRowProps {
  issue: Issue;
  index: number;
  selected: boolean;
  onToggle: (id: string) => void;
  onRowClick?: (issue: Issue) => void;
  /** Hide the provider column (used when grouped by provider) */
  hideProvider?: boolean;
  /** Hide the severity column (used when grouped by severity) */
  hideSeverity?: boolean;
  /** Show the repo column (only when multi-repo issues exist) */
  showRepoColumn?: boolean;
}

export function IssueRow({
  issue,
  index,
  selected,
  onToggle,
  onRowClick,
  hideProvider = false,
  hideSeverity = false,
  showRepoColumn = false,
}: IssueRowProps) {
  const severityClass = `badge-${issue.severity.toLowerCase()}`;

  const priorityColor =
    issue.priority >= 90 ? 'text-red-400' :
    issue.priority >= 70 ? 'text-yellow-400' :
    issue.priority >= 40 ? 'text-cyan-400' :
    'text-green-400';

  const handleRowClick = () => {
    if (onRowClick) {
      onRowClick(issue);
    } else {
      onToggle(issue.id);
    }
  };

  const repoName = showRepoColumn ? getRepoFullName(issue) : null;

  return (
    <tr
      data-testid={`issue-row-${issue.id}`}
      className={`border-b border-[var(--border)] hover:bg-[var(--card)] cursor-pointer transition-colors ${
        selected ? 'bg-[var(--card)]' : ''
      }`}
      onClick={handleRowClick}
    >
      <td className="p-3">
        <input
          type="checkbox"
          data-testid={`issue-checkbox-${issue.id}`}
          checked={selected}
          onChange={() => onToggle(issue.id)}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-[var(--border)] bg-[var(--background)] cursor-pointer"
        />
      </td>
      <td className="p-3 text-[var(--muted)]">{index + 1}</td>
      {!hideProvider && (
        <td className="p-3">
          <span className="px-2 py-1 text-xs rounded bg-[var(--card)] text-[var(--foreground)]">
            {issue.provider}
          </span>
        </td>
      )}
      {showRepoColumn && (
        <td className="p-3">
          {repoName ? (
            <span className="px-2 py-1 text-xs rounded bg-purple-900/50 text-purple-300 flex items-center gap-1 w-fit">
              <span>📦</span>
              <span className="truncate max-w-[120px]" title={repoName}>
                {repoName.split('/').pop()}
              </span>
            </span>
          ) : (
            <span className="text-[var(--muted)] text-xs">—</span>
          )}
        </td>
      )}
      <td className="p-3">
        <span className={`font-mono font-bold ${priorityColor}`}>
          {issue.priority}
        </span>
      </td>
      {!hideSeverity && (
        <td className="p-3">
          <span className={`px-2 py-1 text-xs rounded ${severityClass}`}>
            {issue.severity}
          </span>
        </td>
      )}
      <td className="p-3 text-center">{issue.count}</td>
      <td className="p-3 max-w-md truncate" title={issue.title}>
        {issue.title}
      </td>
      <td className="p-3">
        {issue.permalink && (
          <a
            href={issue.permalink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--primary)] hover:text-[var(--primary-hover)] text-sm"
          >
            View
          </a>
        )}
      </td>
    </tr>
  );
}
