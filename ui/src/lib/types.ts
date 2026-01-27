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
// Filter & Sort Types
// ============================================================================

/**
 * Fields that can be used for sorting.
 */
export type SortField = 'priority' | 'severity' | 'count' | 'date' | 'title' | 'provider' | 'repo';

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
// Processing Options & Modes (PRD-04, PRD-05, PRD-09)
// ============================================================================

/**
 * Processing mode - Plan (analysis only) or Build (implementation).
 */
export type ProcessingMode = 'plan' | 'build';

/**
 * Claude model selection.
 */
export type ModelType = 'sonnet' | 'opus';

/**
 * Complete processing configuration for starting issue processing.
 */
export interface ProcessingOptions {
  mode: ProcessingMode;
  model: ModelType;
  maxIterations: number;
  autoPush: boolean;
  ciAwareness: boolean;
  autoFixCi: boolean;
}

/**
 * Default processing options for new sessions.
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
 * Processing configuration preset for quick selection.
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
 * Default presets for quick configuration.
 */
export const DEFAULT_PRESETS: ProcessingPreset[] = [
  {
    id: 'quick-fix',
    name: 'Quick Fix',
    description: 'Fast fixes for simple issues',
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
    description: 'Plan first, then implement',
    icon: '📋',
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
    description: 'For difficult bugs and security issues',
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
    description: 'Deep analysis without code changes',
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
// Activity & Streaming Types (PRD-03)
// ============================================================================

/**
 * Tool names used by Claude during processing.
 */
export type ToolName =
  | 'Read'
  | 'Write'
  | 'Edit'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'Task'
  | 'TodoWrite'
  | 'WebFetch'
  | 'WebSearch';

/**
 * Activity types for the real-time streaming feed.
 */
export type ActivityType = 'tool' | 'message' | 'result' | 'error' | 'push' | 'ci';

/**
 * Activity status for progress tracking.
 */
export type ActivityStatus = 'pending' | 'running' | 'success' | 'error';

/**
 * Real-time activity from processing stream.
 */
export interface Activity {
  id: string;
  timestamp: string;
  type: ActivityType;
  tool?: ToolName;
  details?: string;
  status?: ActivityStatus;
  duration?: number;
}

/**
 * Execution metrics for current iteration.
 */
export interface ExecutionMetrics {
  iteration: number;
  maxIterations: number;
  costUsd: number;
  durationMs: number;
  totalCostUsd: number;
  totalDurationMs: number;
}

/**
 * Claude event types from stream-json output.
 */
export type ClaudeEventType =
  | 'assistant'
  | 'content_block_start'
  | 'content_block_delta'
  | 'result'
  | 'error'
  | 'system';

/**
 * SSE event payload for streaming updates.
 */
export interface StreamEvent {
  type: 'activity' | 'metrics' | 'complete' | 'error';
  issueId: string;
  payload: Activity | ExecutionMetrics | { message: string } | { error: string };
}

/**
 * Connection state for SSE stream.
 */
export type StreamConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

// ============================================================================
// CI/CD Types (PRD-07)
// ============================================================================

/**
 * CI check status from GitHub checks API.
 */
export type CIStatus = 'pending' | 'running' | 'success' | 'failure' | 'cancelled' | 'skipped';

/**
 * Individual CI check run.
 */
export interface CICheck {
  id: string;
  name: string;
  status: CIStatus;
  conclusion: string | null;
  detailsUrl: string;
  startedAt: string;
  completedAt?: string;
}

/**
 * Failed CI check details with error information.
 */
export interface CIFailure {
  checkName: string;
  error: string;
  logs?: string;
}

/**
 * Complete CI status response for a PR.
 */
export interface CIStatusResponse {
  prUrl: string;
  sha: string;
  checks: CICheck[];
  overallStatus: CIStatus;
  failures: CIFailure[];
  lastUpdated: string;
}

/**
 * CI configuration settings.
 */
export interface CIConfig {
  enabled: boolean;
  autoFix: boolean;
  pollInterval: number; // milliseconds
  maxRetries: number;
}

/**
 * Default CI configuration.
 */
export const DEFAULT_CI_CONFIG: CIConfig = {
  enabled: false,
  autoFix: false,
  pollInterval: 30000, // 30 seconds
  maxRetries: 3,
};

// ============================================================================
// Implementation Plan Types (PRD-08)
// ============================================================================

/**
 * Risk level for implementation plan items.
 */
export type RiskLevel = 'low' | 'medium' | 'high';

/**
 * Plan task/step with completion tracking.
 */
export interface PlanStep {
  id: string;
  content: string;
  completed: boolean;
  line: number;
}

/**
 * File affected by implementation plan.
 */
export interface PlanFile {
  path: string;
  action: 'create' | 'modify' | 'delete';
  completed: boolean;
}

/**
 * Risk identified in implementation plan.
 */
export interface PlanRisk {
  level: RiskLevel;
  description: string;
  mitigation?: string;
}

/**
 * Parsed implementation plan document.
 */
export interface ImplementationPlan {
  issueId: string;
  title: string;
  summary: string;
  steps: PlanStep[];
  files: PlanFile[];
  risks: PlanRisk[];
  estimatedDuration?: string;
  progress: number; // 0-100 percentage
  createdAt: string;
  updatedAt: string;
}

/**
 * Progress update entry for tracking changes.
 */
export interface ProgressEntry {
  stepId: string;
  completedAt: string;
  iteration: number;
  notes?: string;
}

// ============================================================================
// Multi-Repo Types (PRD-10)
// ============================================================================

/**
 * Repository reference for multi-repo support.
 */
export interface RepoReference {
  owner: string;
  repo: string;
  fullName: string; // "owner/repo"
  clonePath?: string;
}

/**
 * Parsed action extracted from issue description.
 */
export interface ParsedAction {
  type: 'fix' | 'refactor' | 'feature' | 'test' | 'docs';
  targetRepo?: RepoReference;
  contextRepos?: RepoReference[];
  confidence: number; // 0-1 confidence in parsing
}

/**
 * Extended issue with multi-repo support.
 */
export interface MultiRepoIssue extends ExtendedIssue {
  target_repo?: RepoReference;
  context_repos?: RepoReference[];
  parsed_action?: ParsedAction;
}

/**
 * Workspace status for cloned repositories.
 */
export interface WorkspaceStatus {
  path: string;
  repos: {
    fullName: string;
    path: string;
    lastUsed: string;
    branch: string;
  }[];
  totalSizeMb: number;
}

// ============================================================================
// Cost & Model Types (PRD-09)
// ============================================================================

/**
 * Cost breakdown for processing estimation.
 */
export interface CostEstimate {
  min: number;
  max: number;
  average: number;
  currency: 'USD';
  breakdown: {
    perIssue: number;
    perIteration: number;
  };
}

/**
 * Model information for selection UI.
 */
export interface ModelInfo {
  id: ModelType;
  name: string;
  description: string;
  speed: 'fast' | 'medium' | 'slow';
  costPer1kTokens: number;
  bestFor: string[];
  icon: string;
}

/**
 * Model details mapping.
 */
export const MODEL_INFO: Record<ModelType, ModelInfo> = {
  sonnet: {
    id: 'sonnet',
    name: 'Claude Sonnet',
    description: 'Fast and cost-effective',
    speed: 'fast',
    costPer1kTokens: 0.003,
    bestFor: ['Simple bugs', 'Refactoring', 'Coverage tasks'],
    icon: '⚡',
  },
  opus: {
    id: 'opus',
    name: 'Claude Opus',
    description: 'Most capable for complex tasks',
    speed: 'slow',
    costPer1kTokens: 0.015,
    bestFor: ['Security issues', 'Architecture', 'Complex debugging'],
    icon: '🧠',
  },
};

/**
 * Estimate processing cost based on options and issue count.
 */
export function estimateCost(
  options: ProcessingOptions,
  issueCount: number,
  avgTokensPerIteration = 5000
): CostEstimate {
  const modelInfo = MODEL_INFO[options.model];
  const costPerIteration = (avgTokensPerIteration / 1000) * modelInfo.costPer1kTokens;
  const costPerIssue = costPerIteration * options.maxIterations;
  const totalCost = costPerIssue * issueCount;

  return {
    min: totalCost * 0.3, // Best case: few iterations needed
    max: totalCost * 1.0, // Worst case: all iterations used
    average: totalCost * 0.6,
    currency: 'USD',
    breakdown: {
      perIssue: costPerIssue,
      perIteration: costPerIteration,
    },
  };
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
