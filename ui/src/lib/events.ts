/**
 * Events Parser Library for Claude JSON Streaming
 *
 * Parses Claude's --output-format=stream-json events and converts them
 * to normalized Activity objects for the UI activity feed.
 *
 * @see PRD-03-JSON-STREAMING.md for specification
 */

import {
  Activity,
  ActivityType,
  ActivityStatus,
  ToolName,
  ClaudeEventType,
  StreamEvent,
  ExecutionMetrics,
} from './types';

// ============================================================================
// Raw Event Types from Claude Stream
// ============================================================================

/**
 * Raw event from Claude's stream-json output.
 */
export interface ClaudeRawEvent {
  type: ClaudeEventType;
  index?: number;
  content_block?: {
    type: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
  };
  delta?: {
    type: string;
    partial_json?: string;
    text?: string;
  };
  content?: string;
  message?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  stop_reason?: string;
  cost_usd?: number;
  duration_ms?: number;
  error?: string;
}

/**
 * Internal state for tracking in-progress tool executions.
 */
interface ToolExecutionState {
  id: string;
  activityId: string;
  toolName: ToolName | string;
  partialJson: string;
  startTime: number;
}

// ============================================================================
// Event Parser Class
// ============================================================================

/**
 * Parser for Claude stream-json events.
 *
 * Maintains state for partial JSON accumulation and tracks tool executions.
 */
export class EventParser {
  private toolExecutions: Map<number, ToolExecutionState> = new Map();
  private currentIteration = 1;
  private totalCostUsd = 0;
  private totalDurationMs = 0;
  private maxIterations: number;

  constructor(maxIterations = 10) {
    this.maxIterations = maxIterations;
  }

  /**
   * Parse a raw Claude event and return Activity/Metrics if applicable.
   */
  parseEvent(raw: ClaudeRawEvent): {
    activity?: Activity;
    metrics?: ExecutionMetrics;
    complete?: boolean;
    error?: string;
  } {
    switch (raw.type) {
      case 'content_block_start':
        return this.handleContentBlockStart(raw);

      case 'content_block_delta':
        return this.handleContentBlockDelta(raw);

      case 'assistant':
        return this.handleAssistant(raw);

      case 'result':
        return this.handleResult(raw);

      case 'error':
        return this.handleError(raw);

      case 'system':
        // System events are typically ignored
        return {};

      default:
        // Unknown event type - log but don't fail
        console.warn(`Unknown Claude event type: ${raw.type}`);
        return {};
    }
  }

  /**
   * Handle content_block_start - tool execution begins.
   */
  private handleContentBlockStart(raw: ClaudeRawEvent): { activity?: Activity } {
    if (!raw.content_block || raw.content_block.type !== 'tool_use') {
      return {};
    }

    const index = raw.index ?? 0;
    const toolId = raw.content_block.id ?? `tool-${Date.now()}`;
    const toolName = raw.content_block.name ?? 'Unknown';
    const activityId = generateActivityId();

    // Store execution state for partial JSON accumulation
    this.toolExecutions.set(index, {
      id: toolId,
      activityId,
      toolName,
      partialJson: '',
      startTime: Date.now(),
    });

    const activity: Activity = {
      id: activityId,
      timestamp: new Date().toISOString(),
      type: 'tool',
      tool: this.normalizeToolName(toolName),
      details: `Starting ${toolName}...`,
      status: 'pending',
    };

    return { activity };
  }

  /**
   * Handle content_block_delta - accumulate tool parameters.
   */
  private handleContentBlockDelta(raw: ClaudeRawEvent): { activity?: Activity } {
    const index = raw.index ?? 0;
    const execution = this.toolExecutions.get(index);

    if (!execution) {
      return {};
    }

    // Accumulate partial JSON
    if (raw.delta?.partial_json) {
      execution.partialJson += raw.delta.partial_json;
    }

    // Try to parse accumulated JSON to extract details
    const details = this.extractToolDetails(execution.toolName, execution.partialJson);

    if (details) {
      const activity: Activity = {
        id: execution.activityId,
        timestamp: new Date().toISOString(),
        type: 'tool',
        tool: this.normalizeToolName(execution.toolName),
        details,
        status: 'running',
      };
      return { activity };
    }

    return {};
  }

  /**
   * Handle assistant message.
   */
  private handleAssistant(raw: ClaudeRawEvent): { activity?: Activity } {
    const content = raw.content || raw.delta?.text || '';

    if (!content.trim()) {
      return {};
    }

    // Truncate long messages for display
    const truncated = content.length > 200 ? content.substring(0, 200) + '...' : content;

    const activity: Activity = {
      id: generateActivityId(),
      timestamp: new Date().toISOString(),
      type: 'message',
      details: truncated,
      status: 'success',
    };

    return { activity };
  }

  /**
   * Handle result event - contains metrics.
   */
  private handleResult(raw: ClaudeRawEvent): {
    activity?: Activity;
    metrics?: ExecutionMetrics;
    complete?: boolean;
  } {
    const costUsd = raw.cost_usd ?? 0;
    const durationMs = raw.duration_ms ?? 0;

    // Update totals
    this.totalCostUsd += costUsd;
    this.totalDurationMs += durationMs;

    const metrics: ExecutionMetrics = {
      iteration: this.currentIteration,
      maxIterations: this.maxIterations,
      costUsd,
      durationMs,
      totalCostUsd: this.totalCostUsd,
      totalDurationMs: this.totalDurationMs,
    };

    const activity: Activity = {
      id: generateActivityId(),
      timestamp: new Date().toISOString(),
      type: 'result',
      details: `Iteration ${this.currentIteration} complete ($${costUsd.toFixed(4)}, ${formatDuration(durationMs)})`,
      status: 'success',
      duration: durationMs,
    };

    // Check for completion based on stop_reason
    const complete = raw.stop_reason === 'end_turn';

    return { activity, metrics, complete };
  }

  /**
   * Handle error event.
   */
  private handleError(raw: ClaudeRawEvent): { activity?: Activity; error?: string } {
    const errorMessage = raw.error || raw.message || 'Unknown error';

    const activity: Activity = {
      id: generateActivityId(),
      timestamp: new Date().toISOString(),
      type: 'error',
      details: errorMessage,
      status: 'error',
    };

    return { activity, error: errorMessage };
  }

  /**
   * Mark a tool execution as complete.
   */
  completeToolExecution(index: number, success: boolean): Activity | undefined {
    const execution = this.toolExecutions.get(index);
    if (!execution) return undefined;

    const duration = Date.now() - execution.startTime;
    const details = this.extractToolDetails(execution.toolName, execution.partialJson);

    this.toolExecutions.delete(index);

    return {
      id: execution.activityId,
      timestamp: new Date().toISOString(),
      type: 'tool',
      tool: this.normalizeToolName(execution.toolName),
      details: details || `${execution.toolName} complete`,
      status: success ? 'success' : 'error',
      duration,
    };
  }

  /**
   * Increment iteration counter (called at start of each loop).
   */
  nextIteration(): void {
    this.currentIteration++;
  }

  /**
   * Reset parser state for new session.
   */
  reset(): void {
    this.toolExecutions.clear();
    this.currentIteration = 1;
    this.totalCostUsd = 0;
    this.totalDurationMs = 0;
  }

  /**
   * Get current metrics snapshot.
   */
  getMetrics(): ExecutionMetrics {
    return {
      iteration: this.currentIteration,
      maxIterations: this.maxIterations,
      costUsd: 0, // Current iteration cost not known until result
      durationMs: 0,
      totalCostUsd: this.totalCostUsd,
      totalDurationMs: this.totalDurationMs,
    };
  }

  /**
   * Normalize tool name to known ToolName type.
   */
  private normalizeToolName(name: string): ToolName | undefined {
    const knownTools: ToolName[] = [
      'Read',
      'Write',
      'Edit',
      'Bash',
      'Glob',
      'Grep',
      'Task',
      'TodoWrite',
      'WebFetch',
      'WebSearch',
    ];

    const normalized = knownTools.find((t) => t.toLowerCase() === name.toLowerCase());
    return normalized;
  }

  /**
   * Extract human-readable details from tool parameters.
   */
  private extractToolDetails(toolName: string, partialJson: string): string | undefined {
    if (!partialJson) return undefined;

    try {
      // Try to parse as complete JSON first
      const params = JSON.parse(partialJson);
      return this.formatToolDetails(toolName, params);
    } catch {
      // JSON is incomplete - try to extract key fields with regex
      return this.extractPartialDetails(toolName, partialJson);
    }
  }

  /**
   * Format tool details from complete parameters.
   */
  private formatToolDetails(toolName: string, params: Record<string, unknown>): string {
    switch (toolName.toLowerCase()) {
      case 'read':
        return `Reading ${formatPath(params.file_path as string)}`;

      case 'write':
        return `Writing ${formatPath(params.file_path as string)}`;

      case 'edit':
        return `Editing ${formatPath(params.file_path as string)}`;

      case 'bash':
        return `Running: ${truncateCommand(params.command as string)}`;

      case 'glob':
        return `Searching: ${params.pattern as string}`;

      case 'grep':
        return `Searching for: ${params.pattern as string}`;

      case 'task':
        return `Task: ${truncate(params.description as string, 50)}`;

      case 'todowrite':
        return 'Updating todo list';

      case 'webfetch':
        return `Fetching: ${truncate(params.url as string, 50)}`;

      case 'websearch':
        return `Searching: ${truncate(params.query as string, 50)}`;

      default:
        return `${toolName}: ${JSON.stringify(params).substring(0, 50)}`;
    }
  }

  /**
   * Extract details from partial/incomplete JSON.
   */
  private extractPartialDetails(toolName: string, partialJson: string): string | undefined {
    // Extract file_path
    const filePathMatch = partialJson.match(/"file_path"\s*:\s*"([^"]+)/);
    if (filePathMatch) {
      const action =
        toolName.toLowerCase() === 'read'
          ? 'Reading'
          : toolName.toLowerCase() === 'write'
            ? 'Writing'
            : 'Editing';
      return `${action} ${formatPath(filePathMatch[1])}`;
    }

    // Extract command
    const commandMatch = partialJson.match(/"command"\s*:\s*"([^"]+)/);
    if (commandMatch) {
      return `Running: ${truncateCommand(commandMatch[1])}`;
    }

    // Extract pattern
    const patternMatch = partialJson.match(/"pattern"\s*:\s*"([^"]+)/);
    if (patternMatch) {
      return `Searching: ${patternMatch[1]}`;
    }

    // Extract query
    const queryMatch = partialJson.match(/"query"\s*:\s*"([^"]+)/);
    if (queryMatch) {
      return `Searching: ${queryMatch[1]}`;
    }

    return undefined;
  }
}

// ============================================================================
// Stream Event Converter
// ============================================================================

/**
 * Convert Activity to StreamEvent format for SSE.
 */
export function activityToStreamEvent(activity: Activity, issueId: string): StreamEvent {
  return {
    type: 'activity',
    issueId,
    payload: activity,
  };
}

/**
 * Convert ExecutionMetrics to StreamEvent format for SSE.
 */
export function metricsToStreamEvent(metrics: ExecutionMetrics, issueId: string): StreamEvent {
  return {
    type: 'metrics',
    issueId,
    payload: metrics,
  };
}

/**
 * Create complete StreamEvent.
 */
export function completeStreamEvent(issueId: string, message: string): StreamEvent {
  return {
    type: 'complete',
    issueId,
    payload: { message },
  };
}

/**
 * Create error StreamEvent.
 */
export function errorStreamEvent(issueId: string, error: string): StreamEvent {
  return {
    type: 'error',
    issueId,
    payload: { error },
  };
}

// ============================================================================
// SSE Formatting
// ============================================================================

/**
 * Format StreamEvent for Server-Sent Events output.
 */
export function formatSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * Parse SSE data line to StreamEvent.
 */
export function parseSSE(line: string): StreamEvent | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  try {
    const json = line.slice(6); // Remove 'data: ' prefix
    return JSON.parse(json) as StreamEvent;
  } catch {
    console.error('Failed to parse SSE event:', line);
    return null;
  }
}

// ============================================================================
// Line Parser for NDJSON
// ============================================================================

/**
 * Parse newline-delimited JSON stream.
 * Returns parsed events and any remaining incomplete line.
 */
export function parseNDJSON(
  buffer: string
): { events: ClaudeRawEvent[]; remaining: string } {
  const lines = buffer.split('\n');
  const events: ClaudeRawEvent[] = [];

  // Process all complete lines except the last (which may be incomplete)
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const event = JSON.parse(line) as ClaudeRawEvent;
      events.push(event);
    } catch (e) {
      console.warn('Failed to parse NDJSON line:', line, e);
    }
  }

  // Return any remaining incomplete data
  return {
    events,
    remaining: lines[lines.length - 1],
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique activity ID.
 */
function generateActivityId(): string {
  return `act-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Format file path for display (show basename or last 2 segments).
 */
function formatPath(path: string | undefined): string {
  if (!path) return 'file';

  const segments = path.split('/').filter(Boolean);
  if (segments.length <= 2) {
    return path;
  }

  return '.../' + segments.slice(-2).join('/');
}

/**
 * Truncate command for display.
 */
function truncateCommand(command: string | undefined): string {
  if (!command) return 'command';
  // Remove newlines and truncate
  const clean = command.replace(/\n/g, ' ').trim();
  return truncate(clean, 60);
}

/**
 * Truncate string to max length with ellipsis.
 */
function truncate(str: string | undefined, maxLength: number): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Format duration in human-readable format.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

// ============================================================================
// Activity Icon Mapping
// ============================================================================

/**
 * Get icon for activity type/tool.
 */
export function getActivityIcon(activity: Activity): string {
  if (activity.type === 'tool' && activity.tool) {
    return TOOL_ICONS[activity.tool] ?? '🔧';
  }
  return ACTIVITY_TYPE_ICONS[activity.type] ?? '📌';
}

/**
 * Icons for each tool type.
 */
export const TOOL_ICONS: Record<ToolName, string> = {
  Read: '📖',
  Write: '✍️',
  Edit: '✏️',
  Bash: '⚡',
  Glob: '🔍',
  Grep: '🔎',
  Task: '📋',
  TodoWrite: '✅',
  WebFetch: '🌐',
  WebSearch: '🔍',
};

/**
 * Icons for each activity type.
 */
export const ACTIVITY_TYPE_ICONS: Record<ActivityType, string> = {
  tool: '🔧',
  message: '💬',
  result: '✅',
  error: '❌',
  push: '🚀',
  ci: '🔄',
};

// ============================================================================
// Activity Color Mapping
// ============================================================================

/**
 * Get Tailwind CSS classes for activity status.
 */
export function getActivityStatusClasses(status: ActivityStatus | undefined): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'pending':
      return {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-400',
        border: 'border-yellow-500/20',
      };
    case 'running':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/20',
      };
    case 'success':
      return {
        bg: 'bg-green-500/10',
        text: 'text-green-400',
        border: 'border-green-500/20',
      };
    case 'error':
      return {
        bg: 'bg-red-500/10',
        text: 'text-red-400',
        border: 'border-red-500/20',
      };
    default:
      return {
        bg: 'bg-gray-500/10',
        text: 'text-gray-400',
        border: 'border-gray-500/20',
      };
  }
}
