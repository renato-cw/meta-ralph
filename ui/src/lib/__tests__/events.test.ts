import {
  parseClaudeEvent,
  parseLogs,
  createParseState,
  createLogActivity,
  ParseState,
} from '../events';

describe('events parser', () => {
  describe('createParseState', () => {
    it('creates initial parse state with default maxIterations', () => {
      const state = createParseState();
      expect(state).toEqual({
        currentTool: null,
        currentToolInput: '',
        iteration: 0,
        maxIterations: 10,
        totalCostUsd: 0,
        totalDurationMs: 0,
      });
    });

    it('creates parse state with custom maxIterations', () => {
      const state = createParseState(20);
      expect(state.maxIterations).toBe(20);
    });
  });

  describe('parseClaudeEvent', () => {
    let state: ParseState;

    beforeEach(() => {
      state = createParseState();
    });

    it('returns null activity for empty lines', () => {
      const result = parseClaudeEvent('', state);
      expect(result.activity).toBeNull();
      expect(result.metrics).toBeNull();
    });

    it('returns null activity for whitespace-only lines', () => {
      const result = parseClaudeEvent('   \t  ', state);
      expect(result.activity).toBeNull();
      expect(result.metrics).toBeNull();
    });

    it('parses assistant message event', () => {
      const event = JSON.stringify({
        type: 'assistant',
        message: {
          content: [{ text: 'I found the issue' }],
        },
      });

      const result = parseClaudeEvent(event, state);

      expect(result.activity).not.toBeNull();
      expect(result.activity?.type).toBe('message');
      expect(result.activity?.details).toBe('I found the issue');
      expect(result.activity?.status).toBe('success');
    });

    it('truncates long assistant messages', () => {
      const longText = 'a'.repeat(300);
      const event = JSON.stringify({
        type: 'assistant',
        message: {
          content: [{ text: longText }],
        },
      });

      const result = parseClaudeEvent(event, state);

      expect(result.activity?.details?.length).toBeLessThanOrEqual(203); // 200 + '...'
      expect(result.activity?.details?.endsWith('...')).toBe(true);
    });

    it('parses content_block_start event for Read tool', () => {
      const event = JSON.stringify({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          name: 'Read',
        },
      });

      const result = parseClaudeEvent(event, state);

      expect(result.activity).not.toBeNull();
      expect(result.activity?.type).toBe('tool');
      expect(result.activity?.tool).toBe('Read');
      expect(result.activity?.status).toBe('pending');
      expect(result.state.currentTool).toBe('Read');
    });

    it('parses content_block_start event for Bash tool', () => {
      const event = JSON.stringify({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          name: 'Bash',
        },
      });

      const result = parseClaudeEvent(event, state);

      expect(result.activity?.tool).toBe('Bash');
      expect(result.state.currentTool).toBe('Bash');
    });

    it('parses content_block_start event for Edit tool', () => {
      const event = JSON.stringify({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          name: 'Edit',
        },
      });

      const result = parseClaudeEvent(event, state);

      expect(result.activity?.tool).toBe('Edit');
    });

    it('parses content_block_start event for Write tool', () => {
      const event = JSON.stringify({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          name: 'Write',
        },
      });

      const result = parseClaudeEvent(event, state);

      expect(result.activity?.tool).toBe('Write');
    });

    it('accumulates content_block_delta input', () => {
      // First, start the tool
      let result = parseClaudeEvent(
        JSON.stringify({
          type: 'content_block_start',
          content_block: { type: 'tool_use', name: 'Read' },
        }),
        state
      );

      // Then send delta
      result = parseClaudeEvent(
        JSON.stringify({
          type: 'content_block_delta',
          delta: {
            type: 'input_json_delta',
            partial_json: '{"file_path": "src/',
          },
        }),
        result.state
      );

      expect(result.state.currentToolInput).toBe('{"file_path": "src/');
      expect(result.activity).toBeNull(); // No activity for partial deltas
    });

    it('parses result event and updates metrics', () => {
      const event = JSON.stringify({
        type: 'result',
        result: {
          cost_usd: 0.0045,
          duration_ms: 12500,
          total_cost_usd: 0.0090,
          total_duration_ms: 25000,
          num_turns: 2,
          is_error: false,
        },
      });

      const result = parseClaudeEvent(event, state);

      expect(result.activity).not.toBeNull();
      expect(result.activity?.type).toBe('result');
      expect(result.activity?.status).toBe('success');
      expect(result.activity?.details).toContain('$0.0045');
      expect(result.activity?.details).toContain('12.5s');

      expect(result.metrics).not.toBeNull();
      expect(result.metrics?.iteration).toBe(1);
      expect(result.metrics?.costUsd).toBe(0.0045);
      expect(result.metrics?.durationMs).toBe(12500);
      expect(result.state.totalCostUsd).toBe(0.0045);
      expect(result.state.totalDurationMs).toBe(12500);
    });

    it('parses result event with error status', () => {
      const event = JSON.stringify({
        type: 'result',
        result: {
          cost_usd: 0.002,
          duration_ms: 5000,
          is_error: true,
        },
      });

      const result = parseClaudeEvent(event, state);

      expect(result.activity?.status).toBe('error');
    });

    it('parses error event', () => {
      const event = JSON.stringify({
        type: 'error',
        error: {
          message: 'Rate limit exceeded',
        },
      });

      const result = parseClaudeEvent(event, state);

      expect(result.activity).not.toBeNull();
      expect(result.activity?.type).toBe('error');
      expect(result.activity?.details).toBe('Rate limit exceeded');
      expect(result.activity?.status).toBe('error');
    });

    it('parses system event', () => {
      const event = JSON.stringify({
        type: 'system',
      });

      const result = parseClaudeEvent(event, state);

      expect(result.activity?.type).toBe('system');
      expect(result.activity?.status).toBe('success');
    });

    it('creates log activity for non-JSON lines', () => {
      const result = parseClaudeEvent('Starting processing...', state);

      expect(result.activity).not.toBeNull();
      expect(result.activity?.type).toBe('message');
      expect(result.activity?.details).toBe('Starting processing...');
    });

    it('creates log activity for invalid JSON', () => {
      const result = parseClaudeEvent('{ invalid json }', state);

      expect(result.activity).not.toBeNull();
      expect(result.activity?.type).toBe('message');
      expect(result.activity?.details).toBe('{ invalid json }');
    });

    it('ignores unknown tool names', () => {
      const event = JSON.stringify({
        type: 'content_block_start',
        content_block: {
          type: 'tool_use',
          name: 'UnknownTool',
        },
      });

      const result = parseClaudeEvent(event, state);

      expect(result.activity).toBeNull();
      expect(result.state.currentTool).toBeNull();
    });

    it('accumulates iteration count across multiple results', () => {
      let currentState = state;

      // First result
      let result = parseClaudeEvent(
        JSON.stringify({
          type: 'result',
          result: { cost_usd: 0.001, duration_ms: 1000 },
        }),
        currentState
      );
      currentState = result.state;
      expect(currentState.iteration).toBe(1);

      // Second result
      result = parseClaudeEvent(
        JSON.stringify({
          type: 'result',
          result: { cost_usd: 0.002, duration_ms: 2000 },
        }),
        currentState
      );
      currentState = result.state;
      expect(currentState.iteration).toBe(2);
      expect(currentState.totalCostUsd).toBe(0.003);
      expect(currentState.totalDurationMs).toBe(3000);
    });
  });

  describe('parseLogs', () => {
    it('parses empty logs array', () => {
      const result = parseLogs([]);
      expect(result.activities).toHaveLength(0);
      expect(result.metrics).toBeNull();
    });

    it('parses plain text logs', () => {
      const logs = ['Starting processing...', 'Loading files...', 'Done'];
      const result = parseLogs(logs);

      expect(result.activities).toHaveLength(3);
      expect(result.activities[0].details).toBe('Starting processing...');
    });

    it('parses mixed JSON and plain text logs', () => {
      const logs = [
        'Starting...',
        JSON.stringify({
          type: 'content_block_start',
          content_block: { type: 'tool_use', name: 'Read' },
        }),
        'Processing...',
        JSON.stringify({
          type: 'result',
          result: { cost_usd: 0.005, duration_ms: 3000 },
        }),
      ];

      const result = parseLogs(logs);

      expect(result.activities.length).toBeGreaterThan(2);
      expect(result.metrics).not.toBeNull();
      expect(result.metrics?.costUsd).toBe(0.005);
    });

    it('handles multi-line log entries', () => {
      const logs = ['Line 1\nLine 2\nLine 3'];
      const result = parseLogs(logs);

      expect(result.activities.length).toBe(3);
    });

    it('uses custom maxIterations', () => {
      const logs = [
        JSON.stringify({
          type: 'result',
          result: { cost_usd: 0.001, duration_ms: 1000 },
        }),
      ];

      const result = parseLogs(logs, 20);
      expect(result.metrics?.maxIterations).toBe(20);
    });
  });

  describe('createLogActivity', () => {
    it('creates activity from plain log', () => {
      const activity = createLogActivity('Some log message');

      expect(activity.type).toBe('message');
      expect(activity.details).toBe('Some log message');
      expect(activity.status).toBe('success');
    });

    it('detects error logs', () => {
      const activity = createLogActivity('[error] Something went wrong');

      expect(activity.type).toBe('error');
      expect(activity.status).toBe('error');
    });

    it('detects Error keyword', () => {
      const activity = createLogActivity('Error: File not found');

      expect(activity.type).toBe('error');
      expect(activity.status).toBe('error');
    });

    it('detects ERROR keyword', () => {
      const activity = createLogActivity('ERROR occurred');

      expect(activity.type).toBe('error');
    });

    it('detects warning logs with pending status', () => {
      const activity = createLogActivity('[stderr] warning: deprecated');

      expect(activity.status).toBe('pending');
    });

    it('detects WARN keyword', () => {
      const activity = createLogActivity('WARN: Low memory');

      expect(activity.status).toBe('pending');
    });

    it('detects success logs', () => {
      const activity = createLogActivity('Test passed successfully');

      expect(activity.type).toBe('result');
    });

    it('detects complete logs', () => {
      const activity = createLogActivity('Processing complete');

      expect(activity.type).toBe('result');
    });

    it('detects COMPLETE keyword', () => {
      const activity = createLogActivity('Build COMPLETE');

      expect(activity.type).toBe('result');
    });

    it('detects system markers', () => {
      const activity = createLogActivity('>>> Starting new section');

      expect(activity.type).toBe('system');
    });

    it('detects === markers', () => {
      const activity = createLogActivity('=== Process Output ===');

      expect(activity.type).toBe('system');
    });

    it('generates unique IDs', () => {
      const activity1 = createLogActivity('Log 1');
      const activity2 = createLogActivity('Log 2');

      expect(activity1.id).not.toBe(activity2.id);
    });

    it('sets timestamp to current time', () => {
      const before = new Date().toISOString();
      const activity = createLogActivity('Test');
      const after = new Date().toISOString();

      expect(activity.timestamp >= before).toBe(true);
      expect(activity.timestamp <= after).toBe(true);
    });
  });
});
