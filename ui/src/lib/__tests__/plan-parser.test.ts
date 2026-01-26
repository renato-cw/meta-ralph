/**
 * Tests for Plan Parser Library (PRD-08)
 *
 * These tests ensure the parser correctly extracts structured data from
 * IMPLEMENTATION_PLAN.md files, enabling real-time progress tracking.
 */

import {
  parseCheckboxLine,
  parseFileLine,
  parseRiskLevel,
  parseRiskRow,
  extractTitle,
  extractSummary,
  parsePlanMarkdown,
  calculateProgress,
  getCurrentStep,
  updateStepCompletion,
  getPlanStats,
  isValidPlanContent,
} from '../plan-parser';

describe('plan-parser', () => {
  // ============================================================================
  // parseCheckboxLine Tests
  // ============================================================================

  describe('parseCheckboxLine', () => {
    it('parses unchecked checkbox', () => {
      const result = parseCheckboxLine('- [ ] Fix the authentication bug', 10);
      expect(result).toEqual({
        id: 'step-10',
        content: 'Fix the authentication bug',
        completed: false,
        line: 10,
      });
    });

    it('parses checked checkbox', () => {
      const result = parseCheckboxLine('- [x] Fix the authentication bug', 5);
      expect(result).toEqual({
        id: 'step-5',
        content: 'Fix the authentication bug',
        completed: true,
        line: 5,
      });
    });

    it('parses checkbox with uppercase X', () => {
      const result = parseCheckboxLine('- [X] Completed task', 1);
      expect(result).toEqual({
        id: 'step-1',
        content: 'Completed task',
        completed: true,
        line: 1,
      });
    });

    it('parses checkbox with asterisk bullet', () => {
      const result = parseCheckboxLine('* [ ] Task with asterisk', 3);
      expect(result).toEqual({
        id: 'step-3',
        content: 'Task with asterisk',
        completed: false,
        line: 3,
      });
    });

    it('returns null for non-checkbox lines', () => {
      expect(parseCheckboxLine('Regular line', 1)).toBeNull();
      expect(parseCheckboxLine('- No checkbox here', 1)).toBeNull();
      expect(parseCheckboxLine('## Header', 1)).toBeNull();
      expect(parseCheckboxLine('', 1)).toBeNull();
    });

    it('handles indented checkboxes', () => {
      const result = parseCheckboxLine('  - [ ] Indented task', 1);
      expect(result).toEqual({
        id: 'step-1',
        content: 'Indented task',
        completed: false,
        line: 1,
      });
    });
  });

  // ============================================================================
  // parseFileLine Tests
  // ============================================================================

  describe('parseFileLine', () => {
    it('parses file checkbox with description', () => {
      const result = parseFileLine('- [ ] `src/auth.ts` - Main authentication logic');
      expect(result).toEqual({
        path: 'src/auth.ts',
        action: 'modify',
        completed: false,
      });
    });

    it('parses completed file checkbox', () => {
      const result = parseFileLine('- [x] `src/config.ts` - Configuration');
      expect(result).toEqual({
        path: 'src/config.ts',
        action: 'modify',
        completed: true,
      });
    });

    it('detects create action from description', () => {
      const result = parseFileLine('- [ ] `src/new-feature.ts` - Create new feature');
      expect(result?.action).toBe('create');
    });

    it('detects delete action from description', () => {
      const result = parseFileLine('- [ ] `src/deprecated.ts` - Delete deprecated code');
      expect(result?.action).toBe('delete');
    });

    it('handles file without description', () => {
      const result = parseFileLine('- [ ] `src/utils.ts`');
      expect(result).toEqual({
        path: 'src/utils.ts',
        action: 'modify',
        completed: false,
      });
    });

    it('returns null for non-file lines', () => {
      expect(parseFileLine('- [ ] Regular task')).toBeNull();
      expect(parseFileLine('Just text')).toBeNull();
    });
  });

  // ============================================================================
  // parseRiskLevel Tests
  // ============================================================================

  describe('parseRiskLevel', () => {
    it('parses high risk', () => {
      expect(parseRiskLevel('High')).toBe('high');
      expect(parseRiskLevel('CRITICAL')).toBe('high');
      expect(parseRiskLevel('high risk')).toBe('high');
    });

    it('parses medium risk', () => {
      expect(parseRiskLevel('Medium')).toBe('medium');
      expect(parseRiskLevel('Moderate')).toBe('medium');
    });

    it('defaults to low for unknown', () => {
      expect(parseRiskLevel('Low')).toBe('low');
      expect(parseRiskLevel('Minor')).toBe('low');
      expect(parseRiskLevel('Unknown')).toBe('low');
    });
  });

  // ============================================================================
  // parseRiskRow Tests
  // ============================================================================

  describe('parseRiskRow', () => {
    it('parses risk table row with mitigation', () => {
      const result = parseRiskRow('| High | Breaking changes | Add tests |');
      expect(result).toEqual({
        level: 'high',
        description: 'Breaking changes',
        mitigation: 'Add tests',
      });
    });

    it('parses risk table row without mitigation', () => {
      const result = parseRiskRow('| Medium | Performance impact |');
      expect(result).toEqual({
        level: 'medium',
        description: 'Performance impact',
        mitigation: undefined,
      });
    });

    it('skips header rows', () => {
      expect(parseRiskRow('| Risk | Description | Mitigation |')).toBeNull();
      expect(parseRiskRow('| --- | --- | --- |')).toBeNull();
    });

    it('returns null for non-table lines', () => {
      expect(parseRiskRow('Not a table row')).toBeNull();
    });
  });

  // ============================================================================
  // extractTitle Tests
  // ============================================================================

  describe('extractTitle', () => {
    it('extracts title from standard format', () => {
      const lines = ['# Implementation Plan: Fix Auth Bug', '## Summary'];
      expect(extractTitle(lines)).toBe('Fix Auth Bug');
    });

    it('extracts title without prefix', () => {
      const lines = ['# Fix Authentication Bypass', '## Summary'];
      expect(extractTitle(lines)).toBe('Fix Authentication Bypass');
    });

    it('returns default when no title found', () => {
      const lines = ['## Summary', 'Some content'];
      expect(extractTitle(lines)).toBe('Implementation Plan');
    });
  });

  // ============================================================================
  // extractSummary Tests
  // ============================================================================

  describe('extractSummary', () => {
    it('extracts summary section content', () => {
      const lines = [
        '# Title',
        '## Summary',
        'This is the summary.',
        'More summary text.',
        '## Steps',
        'Step content',
      ];
      expect(extractSummary(lines)).toBe('This is the summary. More summary text.');
    });

    it('extracts from Overview section', () => {
      const lines = ['# Title', '## Overview', 'Overview content here.', '## Details'];
      expect(extractSummary(lines)).toBe('Overview content here.');
    });

    it('returns default when no summary', () => {
      const lines = ['# Title', '## Steps'];
      expect(extractSummary(lines)).toBe('No summary available');
    });
  });

  // ============================================================================
  // parsePlanMarkdown Tests
  // ============================================================================

  describe('parsePlanMarkdown', () => {
    const samplePlan = `# Implementation Plan: Fix Auth Bug

## Summary
Fix authentication bypass vulnerability.

## Files Identified
- [x] \`src/auth.ts\` - Main auth logic
- [ ] \`src/middleware.ts\` - Auth middleware

## Implementation Steps
- [x] Analyze the vulnerability
- [ ] Fix the authentication check
- [ ] Add unit tests
- [ ] Run security scan

## Risks & Mitigations
| Risk | Description | Mitigation |
| --- | --- | --- |
| High | Breaking existing auth | Add regression tests |
| Medium | Performance impact | Profile after changes |
`;

    it('parses complete plan correctly', () => {
      const plan = parsePlanMarkdown(samplePlan, 'issue-123');

      expect(plan.issueId).toBe('issue-123');
      expect(plan.title).toBe('Fix Auth Bug');
      expect(plan.summary).toContain('authentication bypass');
    });

    it('extracts files correctly', () => {
      const plan = parsePlanMarkdown(samplePlan, 'issue-123');

      expect(plan.files).toHaveLength(2);
      expect(plan.files[0].path).toBe('src/auth.ts');
      expect(plan.files[0].completed).toBe(true);
      expect(plan.files[1].path).toBe('src/middleware.ts');
      expect(plan.files[1].completed).toBe(false);
    });

    it('extracts steps correctly', () => {
      const plan = parsePlanMarkdown(samplePlan, 'issue-123');

      // Steps should include all checkboxes not already captured as files
      expect(plan.steps.length).toBeGreaterThanOrEqual(4);

      const analyzeStep = plan.steps.find((s) => s.content.includes('Analyze'));
      expect(analyzeStep?.completed).toBe(true);

      const fixStep = plan.steps.find((s) => s.content.includes('Fix the authentication'));
      expect(fixStep?.completed).toBe(false);
    });

    it('extracts risks correctly', () => {
      const plan = parsePlanMarkdown(samplePlan, 'issue-123');

      expect(plan.risks).toHaveLength(2);
      expect(plan.risks[0].level).toBe('high');
      expect(plan.risks[0].description).toBe('Breaking existing auth');
      expect(plan.risks[0].mitigation).toBe('Add regression tests');
    });

    it('calculates progress correctly', () => {
      const plan = parsePlanMarkdown(samplePlan, 'issue-123');

      // Progress should be based on completed/total steps
      expect(plan.progress).toBeGreaterThanOrEqual(0);
      expect(plan.progress).toBeLessThanOrEqual(100);
    });

    it('handles empty content', () => {
      const plan = parsePlanMarkdown('', 'issue-123');

      expect(plan.issueId).toBe('issue-123');
      expect(plan.steps).toHaveLength(0);
      expect(plan.progress).toBe(0);
    });
  });

  // ============================================================================
  // calculateProgress Tests
  // ============================================================================

  describe('calculateProgress', () => {
    it('calculates 0% for no steps', () => {
      expect(calculateProgress([])).toBe(0);
    });

    it('calculates 0% for no completed steps', () => {
      const steps = [
        { id: '1', content: 'Task 1', completed: false, line: 1 },
        { id: '2', content: 'Task 2', completed: false, line: 2 },
      ];
      expect(calculateProgress(steps)).toBe(0);
    });

    it('calculates 100% for all completed', () => {
      const steps = [
        { id: '1', content: 'Task 1', completed: true, line: 1 },
        { id: '2', content: 'Task 2', completed: true, line: 2 },
      ];
      expect(calculateProgress(steps)).toBe(100);
    });

    it('calculates partial progress correctly', () => {
      const steps = [
        { id: '1', content: 'Task 1', completed: true, line: 1 },
        { id: '2', content: 'Task 2', completed: false, line: 2 },
        { id: '3', content: 'Task 3', completed: true, line: 3 },
        { id: '4', content: 'Task 4', completed: false, line: 4 },
      ];
      expect(calculateProgress(steps)).toBe(50);
    });
  });

  // ============================================================================
  // getCurrentStep Tests
  // ============================================================================

  describe('getCurrentStep', () => {
    it('returns first incomplete step', () => {
      const steps = [
        { id: '1', content: 'Task 1', completed: true, line: 1 },
        { id: '2', content: 'Task 2', completed: false, line: 2 },
        { id: '3', content: 'Task 3', completed: false, line: 3 },
      ];
      expect(getCurrentStep(steps)?.id).toBe('2');
    });

    it('returns null when all complete', () => {
      const steps = [
        { id: '1', content: 'Task 1', completed: true, line: 1 },
        { id: '2', content: 'Task 2', completed: true, line: 2 },
      ];
      expect(getCurrentStep(steps)).toBeNull();
    });

    it('returns null for empty array', () => {
      expect(getCurrentStep([])).toBeNull();
    });
  });

  // ============================================================================
  // updateStepCompletion Tests
  // ============================================================================

  describe('updateStepCompletion', () => {
    it('marks step as complete', () => {
      const content = '- [ ] Task 1\n- [ ] Task 2';
      const updated = updateStepCompletion(content, 1, true);
      expect(updated).toBe('- [x] Task 1\n- [ ] Task 2');
    });

    it('marks step as incomplete', () => {
      const content = '- [x] Task 1\n- [ ] Task 2';
      const updated = updateStepCompletion(content, 1, false);
      expect(updated).toBe('- [ ] Task 1\n- [ ] Task 2');
    });

    it('handles invalid line number', () => {
      const content = '- [ ] Task 1';
      expect(updateStepCompletion(content, 0, true)).toBe(content);
      expect(updateStepCompletion(content, 100, true)).toBe(content);
    });
  });

  // ============================================================================
  // getPlanStats Tests
  // ============================================================================

  describe('getPlanStats', () => {
    it('calculates stats correctly', () => {
      const plan = {
        issueId: '123',
        title: 'Test',
        summary: 'Summary',
        steps: [
          { id: '1', content: 'Task', completed: true, line: 1 },
          { id: '2', content: 'Task', completed: false, line: 2 },
        ],
        files: [
          { path: 'a.ts', action: 'modify' as const, completed: true },
          { path: 'b.ts', action: 'modify' as const, completed: false },
        ],
        risks: [
          { level: 'high' as const, description: 'Risk 1' },
          { level: 'medium' as const, description: 'Risk 2' },
          { level: 'low' as const, description: 'Risk 3' },
        ],
        progress: 50,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };

      const stats = getPlanStats(plan);

      expect(stats.totalSteps).toBe(2);
      expect(stats.completedSteps).toBe(1);
      expect(stats.totalFiles).toBe(2);
      expect(stats.completedFiles).toBe(1);
      expect(stats.highRisks).toBe(1);
      expect(stats.mediumRisks).toBe(1);
      expect(stats.lowRisks).toBe(1);
    });
  });

  // ============================================================================
  // isValidPlanContent Tests
  // ============================================================================

  describe('isValidPlanContent', () => {
    it('returns true for valid plan', () => {
      const content = '# Plan\n- [ ] Task';
      expect(isValidPlanContent(content)).toBe(true);
    });

    it('returns false for empty content', () => {
      expect(isValidPlanContent('')).toBe(false);
      expect(isValidPlanContent(null as unknown as string)).toBe(false);
    });

    it('returns false for content without headers', () => {
      expect(isValidPlanContent('- [ ] Task')).toBe(false);
    });

    it('returns false for content without checkboxes', () => {
      expect(isValidPlanContent('# Plan\nNo tasks')).toBe(false);
    });
  });
});
