import type { Issue } from './types';

export type ExportFormat = 'csv' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  fields?: (keyof Issue)[];
  filename?: string;
}

const DEFAULT_FIELDS: (keyof Issue)[] = [
  'id',
  'provider',
  'title',
  'severity',
  'priority',
  'count',
  'location',
  'permalink',
];

/**
 * Generate a filename for export with current date.
 */
function generateFilename(format: ExportFormat): string {
  const date = new Date().toISOString().split('T')[0];
  return `meta-ralph-issues-${date}.${format}`;
}

/**
 * Escape a value for CSV format.
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert issues to CSV format.
 */
function issuesToCsv(issues: Issue[], fields: (keyof Issue)[]): string {
  // Header row
  const header = fields.join(',');

  // Data rows
  const rows = issues.map((issue) =>
    fields.map((field) => escapeCsvValue(issue[field])).join(',')
  );

  return [header, ...rows].join('\n');
}

/**
 * Convert issues to JSON format.
 */
function issuesToJson(issues: Issue[], fields: (keyof Issue)[]): string {
  const data = issues.map((issue) => {
    const obj: Record<string, unknown> = {};
    for (const field of fields) {
      obj[field] = issue[field];
    }
    return obj;
  });
  return JSON.stringify(data, null, 2);
}

/**
 * Export issues to a file.
 * Creates a download link and triggers the download.
 */
export function exportIssues(issues: Issue[], options: ExportOptions): void {
  const { format, fields = DEFAULT_FIELDS, filename } = options;

  // Generate content based on format
  const content = format === 'csv'
    ? issuesToCsv(issues, fields)
    : issuesToJson(issues, fields);

  // Create blob
  const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
  const blob = new Blob([content], { type: mimeType });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || generateFilename(format);

  // Trigger download
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Cleanup
  URL.revokeObjectURL(url);
}

/**
 * Get the list of exportable fields.
 */
export function getExportableFields(): { field: keyof Issue; label: string }[] {
  return [
    { field: 'id', label: 'ID' },
    { field: 'provider', label: 'Provider' },
    { field: 'title', label: 'Title' },
    { field: 'description', label: 'Description' },
    { field: 'severity', label: 'Severity' },
    { field: 'priority', label: 'Priority' },
    { field: 'count', label: 'Count' },
    { field: 'location', label: 'Location' },
    { field: 'permalink', label: 'Permalink' },
    { field: 'raw_severity', label: 'Raw Severity' },
  ];
}
