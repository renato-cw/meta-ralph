/**
 * Client-side parser for Claude JSON events.
 * Matches the parsing logic in ralph-engine.sh parse_claude_events function.
 */

import { Activity, ExecutionMetrics, ClaudeToolType, ClaudeEventType } from './types';

/**
 * Raw Claude event structure from stream-json output.
 */
interface ClaudeRawEvent {
  type: ClaudeEventType;
  content_block?: {
    type: string;
    name?: string;
  };
  delta?: {
    type: string;
    partial_json?: string;
  };
  result?: {
    cost_usd?: number;
    duration_ms?: number;
    is_error?: boolean;
    num_turns?: number;
    session_id?: string;
    total_cost_usd?: number;
    total_duration_ms?: number;
  };
  message?: {
    content?: Array<{ text?: string }>;
  };
  error?: {
    message?: string;
  };
}

/**
 * Parse state to track current tool and accumulated input.
 */
export interface ParseState {
  currentTool: ClaudeToolType | null;
  currentToolInput: string;
  iteration: number;
  maxIterations: number;
  totalCostUsd: number;
  totalDurationMs: number;
}

/**
 * Create initial parse state.
 */
export function createParseState(maxIterations: number = 10): ParseState {
  return {
    currentTool: null,
    currentToolInput: '',
    iteration: 0,
    maxIterations,
    totalCostUsd: 0,
    totalDurationMs: 0,
  };
}

/**
 * Known tool names from Claude.
 */
const KNOWN_TOOLS: ClaudeToolType[] = [
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

/**
 * Check if a string is a known tool type.
 */
function isKnownTool(name: string): name is ClaudeToolType {
  return KNOWN_TOOLS.includes(name as ClaudeToolType);
}

/**
 * Generate a unique activity ID.
 */
function generateActivityId(): string {
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extract details from tool input JSON.
 */
function extractToolDetails(toolName: ClaudeToolType, inputJson: string): string {
  try {
    const input = JSON.parse(inputJson);

    switch (toolName) {
      case 'Read':
        return input.file_path || input.path || 'file';
      case 'Write':
        return input.file_path || input.path || 'file';
      case 'Edit':
        return input.file_path || input.path || 'file';
      case 'Bash': {
        // Truncate long commands
        const cmd = input.command || '';
        return cmd.length > 60 ? cmd.slice(0, 60) + '...' : cmd;
      }
      case 'Glob':
        return input.pattern || 'pattern';
      case 'Grep':
        return input.pattern || 'pattern';
      case 'Task':
        return input.description || 'task';
      case 'TodoWrite':
        return 'todo list';
      case 'WebFetch':
        return input.url || 'url';
      case 'WebSearch':
        return input.query || 'query';
      default:
        return '';
    }
  } catch {
    // If JSON parsing fails, return the raw input (truncated)
    return inputJson.length > 60 ? inputJson.slice(0, 60) + '...' : inputJson;
  }
}

/**
 * Parse a single line of JSON event output.
 * Returns an Activity if one should be created, null otherwise.
 */
export function parseClaudeEvent(
  line: string,
  state: ParseState
): { activity: Activity | null; metrics: ExecutionMetrics | null; state: ParseState } {
  // Skip empty lines
  if (!line.trim()) {
    return { activity: null, metrics: null, state };
  }

  // Try to parse as JSON
  let event: ClaudeRawEvent;
  try {
    event = JSON.parse(line);
  } catch {
    // Not JSON - create a log activity
    return {
      activity: {
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        type: 'message',
        details: line,
        status: 'success',
      },
      metrics: null,
      state,
    };
  }

  const newState = { ...state };
  let activity: Activity | null = null;
  let metrics: ExecutionMetrics | null = null;

  switch (event.type) {
    case 'assistant': {
      // Assistant text message
      const text = event.message?.content?.[0]?.text;
      if (text) {
        activity = {
          id: generateActivityId(),
          timestamp: new Date().toISOString(),
          type: 'message',
          details: text.length > 200 ? text.slice(0, 200) + '...' : text,
          status: 'success',
        };
      }
      break;
    }

    case 'content_block_start':
      // Tool use started
      if (event.content_block?.type === 'tool_use' && event.content_block.name) {
        const toolName = event.content_block.name;
        if (isKnownTool(toolName)) {
          newState.currentTool = toolName;
          newState.currentToolInput = '';
          activity = {
            id: generateActivityId(),
            timestamp: new Date().toISOString(),
            type: 'tool',
            tool: toolName,
            details: `Starting ${toolName}...`,
            status: 'pending',
          };
        }
      }
      break;

    case 'content_block_delta':
      // Tool input streaming
      if (event.delta?.type === 'input_json_delta' && event.delta.partial_json) {
        newState.currentToolInput += event.delta.partial_json;
        // Don't create activity for partial updates - wait for completion
      }
      break;

    case 'result': {
      // Iteration complete
      newState.iteration++;
      const costUsd = event.result?.cost_usd || 0;
      const durationMs = event.result?.duration_ms || 0;
      newState.totalCostUsd += costUsd;
      newState.totalDurationMs += durationMs;

      // Create result activity
      activity = {
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        type: 'result',
        details: `Loop ${newState.iteration} complete - $${costUsd.toFixed(4)} / ${(durationMs / 1000).toFixed(1)}s`,
        status: event.result?.is_error ? 'error' : 'success',
      };

      // Create metrics update
      metrics = {
        iteration: newState.iteration,
        maxIterations: newState.maxIterations,
        costUsd,
        durationMs,
        totalCostUsd: newState.totalCostUsd,
        totalDurationMs: newState.totalDurationMs,
      };

      // Clear current tool state
      newState.currentTool = null;
      newState.currentToolInput = '';
      break;
    }

    case 'error':
      // Error event
      activity = {
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        type: 'error',
        details: event.error?.message || 'Unknown error',
        status: 'error',
      };
      break;

    case 'system':
      // System message
      activity = {
        id: generateActivityId(),
        timestamp: new Date().toISOString(),
        type: 'system',
        details: 'System message',
        status: 'success',
      };
      break;
  }

  // If we have a current tool and accumulated input, create a detailed activity
  if (
    newState.currentTool &&
    newState.currentToolInput &&
    event.type !== 'content_block_delta'
  ) {
    const details = extractToolDetails(newState.currentTool, newState.currentToolInput);
    activity = {
      id: generateActivityId(),
      timestamp: new Date().toISOString(),
      type: 'tool',
      tool: newState.currentTool,
      details,
      status: 'success',
    };
    newState.currentToolInput = '';
  }

  return { activity, metrics, state: newState };
}

/**
 * Parse multiple lines of log output.
 * Useful for batch processing accumulated logs.
 */
export function parseLogs(
  logs: string[],
  maxIterations: number = 10
): { activities: Activity[]; metrics: ExecutionMetrics | null } {
  let state = createParseState(maxIterations);
  const activities: Activity[] = [];
  let latestMetrics: ExecutionMetrics | null = null;

  for (const log of logs) {
    // Handle multi-line logs
    const lines = log.split('\n');
    for (const line of lines) {
      const result = parseClaudeEvent(line, state);
      state = result.state;
      if (result.activity) {
        activities.push(result.activity);
      }
      if (result.metrics) {
        latestMetrics = result.metrics;
      }
    }
  }

  return { activities, metrics: latestMetrics };
}

/**
 * Create an activity from a simple log line.
 * Used for legacy plain-text logs.
 */
export function createLogActivity(log: string): Activity {
  // Determine type based on content
  let type: Activity['type'] = 'message';
  let status: Activity['status'] = 'success';

  if (log.includes('[error]') || log.includes('Error') || log.includes('ERROR')) {
    type = 'error';
    status = 'error';
  } else if (log.includes('[stderr]') || log.includes('warning') || log.includes('WARN')) {
    status = 'pending'; // Use pending for warnings
  } else if (log.includes('success') || log.includes('complete') || log.includes('COMPLETE')) {
    type = 'result';
  } else if (log.includes('>>>') || log.includes('===')) {
    type = 'system';
  }

  return {
    id: generateActivityId(),
    timestamp: new Date().toISOString(),
    type,
    details: log,
    status,
  };
}
