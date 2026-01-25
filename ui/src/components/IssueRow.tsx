'use client';

import type { Issue } from '@/lib/types';

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
}

export function IssueRow({
  issue,
  index,
  selected,
  onToggle,
  onRowClick,
  hideProvider = false,
  hideSeverity = false,
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

  return (
    <tr
      className={`border-b border-[var(--border)] hover:bg-[var(--card)] cursor-pointer transition-colors ${
        selected ? 'bg-[var(--card)]' : ''
      }`}
      onClick={handleRowClick}
    >
      <td className="p-3">
        <input
          type="checkbox"
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
