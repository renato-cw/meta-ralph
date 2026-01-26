// ============================================================================
// Core Types
// ============================================================================

/**
 * Severity levels for issues - standardized across all providers.
 */
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

/**
 * Status of an issue in the processing pipeline.
 */
export type IssueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'ignored';

/**
 * Base issue interface - the normalized format from all providers.
 */
export interface Issue {
  id: string;
  provider: string;
  title: string;
  description: string;
  location: string;
  severity: Severity;
  raw_severity: string;
  count: number;
  priority: number;
  permalink: string;
  metadata: Record<string, unknown>;
}

/**
 * Extended issue with UI-specific fields for state management.
 */
export interface ExtendedIssue extends Issue {
  tags: string[];
  status: IssueStatus;
  processedAt?: string;
  prUrl?: string;
  firstSeen?: string;
  lastSeen?: string;
}

// ============================================================================
// Processing Types
// ============================================================================

/**
 * Current state of the processing engine.
 */
export interface ProcessingStatus {
  isProcessing: boolean;
  currentIssueId: string | null;
  logs: string[];
  completed: string[];
  failed: string[];
}

/**
 * Item in the processing queue.
 */
export interface QueueItem {
  issueId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  prUrl?: string;
  error?: string;
}

// ============================================================================
// Processing Options Types (PRD-04, PRD-05, PRD-06, PRD-09)
// ============================================================================

/**
 * Processing mode: plan (analysis only) or build (implement fix).
 */
export type ProcessingMode = 'plan' | 'build';

/**
 * Claude model selection.
 */
export type ProcessingModel = 'sonnet' | 'opus';

/**
 * Complete processing options configuration.
 */
export interface ProcessingOptions {
  mode: ProcessingMode;
  model: ProcessingModel;
  maxIterations: number;
  autoPush: boolean;
  ciAwareness: boolean;
  autoFixCi: boolean;
}

/**
 * Default processing options.
 */
export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  mode: 'build',
  model: 'sonnet',
  maxIterations: 10,
  autoPush: true,
  ciAwareness: false,
  autoFixCi: false,
};

/**
 * A preset configuration for common use cases.
 */
export interface ProcessingPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  options: ProcessingOptions;
  isCustom?: boolean;
}

/**
 * Cost estimate for processing.
 */
export interface CostEstimate {
  min: number;
  max: number;
  currency: 'USD';
}

/**
 * Model cost information for display.
 */
export interface ModelInfo {
  name: string;
  description: string;
  costPer1kTokens: number;
  speed: 'fast' | 'slow';
  capability: 'standard' | 'advanced';
}

/**
 * Model information for UI display.
 */
export const MODEL_INFO: Record<ProcessingModel, ModelInfo> = {
  sonnet: {
    name: 'Sonnet',
    description: 'Fast and cost-effective for most issues',
    costPer1kTokens: 0.003,
    speed: 'fast',
    capability: 'standard',
  },
  opus: {
    name: 'Opus',
    description: 'Advanced reasoning for complex issues',
    costPer1kTokens: 0.015,
    speed: 'slow',
    capability: 'advanced',
  },
};

/**
 * Pre-configured processing presets.
 */
export const PROCESSING_PRESETS: ProcessingPreset[] = [
  {
    id: 'quick-fix',
    name: 'Quick Fix',
    description: 'Fast fix with Sonnet',
    icon: '⚡',
    options: {
      mode: 'build',
      model: 'sonnet',
      maxIterations: 5,
      autoPush: true,
      ciAwareness: false,
      autoFixCi: false,
    },
  },
  {
    id: 'careful-fix',
    name: 'Careful Fix',
    description: 'Plan first, then build',
    icon: '🎯',
    options: {
      mode: 'plan',
      model: 'sonnet',
      maxIterations: 10,
      autoPush: true,
      ciAwareness: true,
      autoFixCi: false,
    },
  },
  {
    id: 'complex-issue',
    name: 'Complex Issue',
    description: 'Full analysis with Opus',
    icon: '🧠',
    options: {
      mode: 'build',
      model: 'opus',
      maxIterations: 15,
      autoPush: true,
      ciAwareness: true,
      autoFixCi: true,
    },
  },
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Analysis only, no changes',
    icon: '🔒',
    options: {
      mode: 'plan',
      model: 'opus',
      maxIterations: 3,
      autoPush: false,
      ciAwareness: false,
      autoFixCi: false,
    },
  },
];

// ============================================================================
// Filter & Sort Types
// ============================================================================

/**
 * Fields that can be used for sorting.
 */
export type SortField = 'priority' | 'severity' | 'count' | 'date' | 'title' | 'provider';

/**
 * Sort direction.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Current sort state for the issue list.
 */
export interface SortState {
  field: SortField;
  direction: SortDirection;
}

/**
 * Complete filter state for the issue list.
 */
export interface FilterState {
  providers: string[];
  severities: Severity[];
  priorityRange: [number, number];
  dateRange: {
    start: string | null;
    end: string | null;
  };
  countRange: {
    min: number | null;
    max: number | null;
  };
  status: IssueStatus[];
  tags: string[];
  search: string;
}

/**
 * Default filter state with all filters cleared.
 */
export const DEFAULT_FILTER_STATE: FilterState = {
  providers: [],
  severities: [],
  priorityRange: [0, 100],
  dateRange: { start: null, end: null },
  countRange: { min: null, max: null },
  status: [],
  tags: [],
  search: '',
};

/**
 * Default sort state - priority descending (most important first).
 */
export const DEFAULT_SORT_STATE: SortState = {
  field: 'priority',
  direction: 'desc',
};

// ============================================================================
// View Types
// ============================================================================

/**
 * Options for grouping issues.
 */
export type GroupBy = 'provider' | 'severity' | 'date' | 'location' | null;

/**
 * A saved view configuration with filters, sort, and grouping.
 */
export interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  sort: SortState;
  groupBy: GroupBy;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Tag Types
// ============================================================================

/**
 * User-defined tag for categorizing issues.
 */
export interface Tag {
  id: string;
  name: string;
  color: string;
}

/**
 * Predefined tag colors for selection.
 */
export const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6b7280', // gray
] as const;

// ============================================================================
// History Types
// ============================================================================

/**
 * A processing history entry with complete metadata.
 */
export interface HistoryEntry {
  id: string;
  issueId: string;
  issueTitle: string;
  provider: string;
  severity: Severity;
  status: 'completed' | 'failed';
  startedAt: string;
  completedAt: string;
  duration: number; // milliseconds
  prUrl?: string;
  error?: string;
}

/**
 * A processing session grouping multiple history entries.
 */
export interface HistorySession {
  id: string;
  startedAt: string;
  completedAt?: string;
  entries: HistoryEntry[];
  totalCount: number;
  completedCount: number;
  failedCount: number;
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * Statistics for the dashboard display.
 */
export interface DashboardStats {
  totalIssues: number;
  byProvider: Record<string, number>;
  bySeverity: Record<Severity, number>;
  byStatus: Record<IssueStatus, number>;
  priorityDistribution: { range: string; count: number }[];
  processingSuccessRate: number;
  topFilesByIssues: { file: string; count: number }[];
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Response from GET /api/issues endpoint.
 */
export interface IssuesApiResponse {
  issues: Issue[];
  processing: ProcessingStatus;
}

/**
 * Request body for POST /api/issues/bulk endpoint.
 */
export interface BulkActionRequest {
  action: 'export' | 'tag' | 'untag' | 'priority' | 'ignore' | 'restore' | 'process';
  ids: string[];
  payload?: {
    tags?: string[];
    priority?: number;
    format?: 'csv' | 'json';
  };
}

/**
 * Response from POST /api/issues/bulk endpoint.
 */
export interface BulkActionResponse {
  success: boolean;
  message: string;
  affected: number;
  data?: unknown;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Severity order for sorting (lower index = more severe).
 */
export const SEVERITY_ORDER: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

/**
 * Provider display names.
 */
export const PROVIDER_NAMES: Record<string, string> = {
  zeropath: 'Zeropath',
  sentry: 'Sentry',
  codecov: 'Codecov',
  github: 'GitHub',
  jira: 'Jira',
  linear: 'Linear',
};

/**
 * Severity badge colors for styling.
 */
export const SEVERITY_COLORS: Record<Severity, { bg: string; text: string }> = {
  CRITICAL: { bg: 'bg-red-900/50', text: 'text-red-300' },
  HIGH: { bg: 'bg-orange-900/50', text: 'text-orange-300' },
  MEDIUM: { bg: 'bg-yellow-900/50', text: 'text-yellow-300' },
  LOW: { bg: 'bg-green-900/50', text: 'text-green-300' },
  INFO: { bg: 'bg-blue-900/50', text: 'text-blue-300' },
};
