'use client';

interface IssueMetadataProps {
  metadata: Record<string, unknown>;
  provider: string;
}

/**
 * Display provider-specific metadata in a formatted way.
 */
export function IssueMetadata({ metadata, provider }: IssueMetadataProps) {
  // Skip certain internal fields
  const skipFields = new Set(['codeSnippet', 'stackTrace']);

  // Format a metadata value for display
  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '-';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
      // Format dates
      try {
        return new Date(value).toLocaleString();
      } catch {
        return value;
      }
    }
    return String(value);
  };

  // Format field names for display
  const formatFieldName = (field: string): string => {
    return field
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  const entries = Object.entries(metadata).filter(([key]) => !skipFields.has(key));

  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)] italic">No additional metadata available</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 py-2 border-b border-[var(--border)] last:border-0"
        >
          <dt className="text-sm text-[var(--muted)] sm:w-32 shrink-0">
            {formatFieldName(key)}
          </dt>
          <dd className="text-sm font-mono break-all">
            {typeof value === 'object' ? (
              <pre className="bg-[var(--background)] rounded p-2 text-xs overflow-x-auto">
                {formatValue(value)}
              </pre>
            ) : (
              formatValue(value)
            )}
          </dd>
        </div>
      ))}

      {/* Provider badge */}
      <div className="pt-2 text-xs text-[var(--muted)]">
        Data from <span className="font-medium">{provider}</span>
      </div>
    </div>
  );
}
