/**
 * Tests for Plan Parser Library (PRD-08)
 */

import {
  splitIntoSections,
  findSection,
  parseFiles,
  parseSteps,
  parseRisks,
  parseProgressLog,
  extractPlainText,
  extractIssueTitle,
  parsePlanMarkdown,
  calculateProgress,
  checkbox,
  generateProgressEntry,
  updateCheckboxInMarkdown,
  appendProgressLog,
  isValidPlanMarkdown,
  detectManualModification,
} from '../plan-parser';

// ============================================================================
// splitIntoSections Tests
// ============================================================================

describe('splitIntoSections', () => {
  it('should split content into sections by headers', () => {
    const content = `# Title
Some intro text

## Section 1
Content 1

### Subsection 1.1
Content 1.1

## Section 2
Content 2`;

    const sections = splitIntoSections(content);

    expect(sections).toHaveLength(4);
    expect(sections[0].name).toBe('Title');
    expect(sections[0].level).toBe(1);
    expect(sections[1].name).toBe('Section 1');
    expect(sections[1].level).toBe(2);
    expect(sections[2].name).toBe('Subsection 1.1');
    expect(sections[2].level).toBe(3);
    expect(sections[3].name).toBe('Section 2');
    expect(sections[3].level).toBe(2);
  });

  it('should handle empty content', () => {
    const sections = splitIntoSections('');
    expect(sections).toHaveLength(0);
  });

  it('should handle content without headers', () => {
    const content = 'Just some plain text\nwithout any headers';
    const sections = splitIntoSections(content);
    expect(sections).toHaveLength(0);
  });

  it('should capture section content correctly', () => {
    const content = `## Section
Line 1
Line 2
Line 3`;

    const sections = splitIntoSections(content);

    expect(sections).toHaveLength(1);
    expect(sections[0].content).toContain('Line 1');
    expect(sections[0].content).toContain('Line 2');
    expect(sections[0].content).toContain('Line 3');
  });

  it('should track line numbers correctly', () => {
    const content = `# Header
Content
## Second
More content`;

    const sections = splitIntoSections(content);

    expect(sections[0].startLine).toBe(0);
    expect(sections[1].startLine).toBe(2);
  });
});

// ============================================================================
// findSection Tests
// ============================================================================

describe('findSection', () => {
  const sections = [
    { name: 'Files Identified', level: 2, content: [], startLine: 0, endLine: 5 },
    { name: 'Root Cause', level: 2, content: [], startLine: 6, endLine: 10 },
    { name: 'Implementation Steps', level: 2, content: [], startLine: 11, endLine: 20 },
  ];

  it('should find section by exact name', () => {
    const section = findSection(sections, 'Root Cause');
    expect(section?.name).toBe('Root Cause');
  });

  it('should find section by partial name (case-insensitive)', () => {
    const section = findSection(sections, 'files');
    expect(section?.name).toBe('Files Identified');
  });

  it('should return undefined for non-existent section', () => {
    const section = findSection(sections, 'Non Existent');
    expect(section).toBeUndefined();
  });
});

// ============================================================================
// parseFiles Tests
// ============================================================================

describe('parseFiles', () => {
  it('should parse completed file entries', () => {
    const lines = [
      '- [x] `src/auth.ts` - Authentication logic',
      '- [x] `src/middleware.ts` - Middleware',
    ];

    const files = parseFiles(lines);

    expect(files).toHaveLength(2);
    expect(files[0].path).toBe('src/auth.ts');
    expect(files[0].description).toBe('Authentication logic');
    expect(files[0].completed).toBe(true);
    expect(files[1].path).toBe('src/middleware.ts');
    expect(files[1].completed).toBe(true);
  });

  it('should parse uncompleted file entries', () => {
    const lines = ['- [ ] `src/utils.ts` - Utility functions'];

    const files = parseFiles(lines);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('src/utils.ts');
    expect(files[0].completed).toBe(false);
  });

  it('should handle mixed completion status', () => {
    const lines = [
      '- [x] `done.ts` - Done',
      '- [ ] `pending.ts` - Pending',
    ];

    const files = parseFiles(lines);

    expect(files[0].completed).toBe(true);
    expect(files[1].completed).toBe(false);
  });

  it('should ignore non-file lines', () => {
    const lines = [
      'Some random text',
      '- [x] `file.ts` - A file',
      '- Regular list item',
    ];

    const files = parseFiles(lines);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('file.ts');
  });

  it('should handle asterisk bullet points', () => {
    const lines = ['* [x] `file.ts` - Description'];

    const files = parseFiles(lines);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('file.ts');
  });
});

// ============================================================================
// parseSteps Tests
// ============================================================================

describe('parseSteps', () => {
  it('should parse numbered steps', () => {
    const lines = [
      '1. [x] First step',
      '2. [ ] Second step',
      '3. [ ] Third step',
    ];

    const steps = parseSteps(lines);

    expect(steps).toHaveLength(3);
    expect(steps[0].number).toBe(1);
    expect(steps[0].description).toBe('First step');
    expect(steps[0].completed).toBe(true);
    expect(steps[1].number).toBe(2);
    expect(steps[1].completed).toBe(false);
  });

  it('should parse bullet point steps', () => {
    const lines = [
      '- [x] First step',
      '- [ ] Second step',
    ];

    const steps = parseSteps(lines);

    expect(steps).toHaveLength(2);
    expect(steps[0].number).toBe(1);
    expect(steps[0].description).toBe('First step');
    expect(steps[1].number).toBe(2);
  });

  it('should handle mixed formats', () => {
    const lines = [
      '1. [x] Numbered step',
      '- [ ] Bullet step',
    ];

    const steps = parseSteps(lines);

    expect(steps).toHaveLength(2);
    expect(steps[0].number).toBe(1);
    expect(steps[1].number).toBe(2); // Auto-incremented
  });

  it('should ignore non-step lines', () => {
    const lines = [
      'Some text',
      '1. [x] A step',
      'More text',
    ];

    const steps = parseSteps(lines);

    expect(steps).toHaveLength(1);
  });
});

// ============================================================================
// parseRisks Tests
// ============================================================================

describe('parseRisks', () => {
  it('should parse risk table rows', () => {
    const lines = [
      '| Risk | Mitigation |',
      '|------|------------|',
      '| Breaking changes | Add tests |',
      '| Security issue | Code review |',
    ];

    const risks = parseRisks(lines);

    expect(risks).toHaveLength(2);
    expect(risks[0].risk).toBe('Breaking changes');
    expect(risks[0].mitigation).toBe('Add tests');
    expect(risks[1].risk).toBe('Security issue');
    expect(risks[1].mitigation).toBe('Code review');
  });

  it('should skip header and separator rows', () => {
    const lines = [
      '| Risk | Mitigation |',
      '| --- | --- |',
      '| Actual risk | Actual mitigation |',
    ];

    const risks = parseRisks(lines);

    expect(risks).toHaveLength(1);
    expect(risks[0].risk).toBe('Actual risk');
  });

  it('should handle empty table', () => {
    const lines = [
      '| Risk | Mitigation |',
      '|------|------------|',
    ];

    const risks = parseRisks(lines);

    expect(risks).toHaveLength(0);
  });
});

// ============================================================================
// parseProgressLog Tests
// ============================================================================

describe('parseProgressLog', () => {
  it('should parse progress log entries', () => {
    const lines = [
      '### Iteration 1 - 2024-01-15 10:30',
      '- Analyzed codebase',
      '- Found issue',
      '',
      '### Iteration 2 - 2024-01-15 10:45',
      '- Fixed the bug',
      '- Added tests',
    ];

    const entries = parseProgressLog(lines);

    expect(entries).toHaveLength(2);
    expect(entries[0].iteration).toBe(1);
    expect(entries[0].timestamp).toBe('2024-01-15 10:30');
    expect(entries[0].notes).toContain('Analyzed codebase');
    expect(entries[0].notes).toContain('Found issue');
    expect(entries[1].iteration).toBe(2);
    expect(entries[1].notes).toContain('Fixed the bug');
  });

  it('should handle single iteration', () => {
    const lines = [
      '### Iteration 1 - Today',
      '- Started work',
    ];

    const entries = parseProgressLog(lines);

    expect(entries).toHaveLength(1);
    expect(entries[0].notes).toContain('Started work');
  });

  it('should handle asterisk bullets', () => {
    const lines = [
      '### Iteration 1 - Now',
      '* Note with asterisk',
    ];

    const entries = parseProgressLog(lines);

    expect(entries[0].notes).toContain('Note with asterisk');
  });

  it('should handle empty content', () => {
    const entries = parseProgressLog([]);
    expect(entries).toHaveLength(0);
  });
});

// ============================================================================
// extractPlainText Tests
// ============================================================================

describe('extractPlainText', () => {
  it('should extract plain text from lines', () => {
    const lines = [
      'First paragraph.',
      '',
      'Second paragraph.',
    ];

    const text = extractPlainText(lines);

    expect(text).toBe('First paragraph.\nSecond paragraph.');
  });

  it('should filter out list items', () => {
    const lines = [
      '- List item',
      'Plain text',
      '* Another list',
    ];

    const text = extractPlainText(lines);

    expect(text).toBe('Plain text');
  });

  it('should filter out table rows', () => {
    const lines = [
      '| Cell | Cell |',
      'Normal text',
    ];

    const text = extractPlainText(lines);

    expect(text).toBe('Normal text');
  });

  it('should filter out headers', () => {
    const lines = [
      '# Header',
      'Content',
      '## Subheader',
    ];

    const text = extractPlainText(lines);

    expect(text).toBe('Content');
  });
});

// ============================================================================
// extractIssueTitle Tests
// ============================================================================

describe('extractIssueTitle', () => {
  it('should extract title from standard format', () => {
    const content = '# Implementation Plan: Fix Auth Bypass\n\nContent';
    expect(extractIssueTitle(content)).toBe('Fix Auth Bypass');
  });

  it('should extract title without prefix', () => {
    const content = '# My Issue Title\n\nContent';
    expect(extractIssueTitle(content)).toBe('My Issue Title');
  });

  it('should return default for missing title', () => {
    const content = 'No header here';
    expect(extractIssueTitle(content)).toBe('Unknown Issue');
  });

  it('should handle colon without space', () => {
    const content = '# Implementation Plan:Fix Something';
    expect(extractIssueTitle(content)).toBe('Fix Something');
  });
});

// ============================================================================
// parsePlanMarkdown Tests
// ============================================================================

describe('parsePlanMarkdown', () => {
  const samplePlan = `# Implementation Plan: Fix Auth Bypass

## Issue Summary
This issue involves fixing an authentication bypass vulnerability.

## Analysis

### Files Identified
- [x] \`src/auth.ts\` - Main auth logic
- [ ] \`src/middleware.ts\` - Auth middleware

### Root Cause
Missing validation in auth middleware.

### Proposed Solution
Add proper token validation.

## Implementation Steps
1. [x] Update auth.ts
2. [ ] Update middleware
3. [ ] Add tests

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Breaking existing auth | Add regression tests |

## Test Strategy
Unit tests for auth logic.

## Progress Log
### Iteration 1 - 2024-01-15
- Started analysis
`;

  it('should parse complete plan markdown', () => {
    const plan = parsePlanMarkdown(samplePlan, 'issue-123');

    expect(plan.issueId).toBe('issue-123');
    expect(plan.issueTitle).toBe('Fix Auth Bypass');
    expect(plan.analysis.filesIdentified).toHaveLength(2);
    expect(plan.analysis.rootCause).toBe('Missing validation in auth middleware.');
    expect(plan.steps).toHaveLength(3);
    expect(plan.risks).toHaveLength(1);
    expect(plan.testStrategy).toBe('Unit tests for auth logic.');
    expect(plan.progressLog).toHaveLength(1);
    expect(plan.rawMarkdown).toBe(samplePlan);
  });

  it('should handle minimal plan', () => {
    const minimal = `# Plan

## Steps
1. [ ] Do something`;

    const plan = parsePlanMarkdown(minimal, 'minimal-123');

    expect(plan.issueId).toBe('minimal-123');
    expect(plan.steps).toHaveLength(1);
  });

  it('should set timestamps', () => {
    const plan = parsePlanMarkdown('# Plan', 'test');

    expect(plan.createdAt).toBeDefined();
    expect(plan.updatedAt).toBeDefined();
  });
});

// ============================================================================
// calculateProgress Tests
// ============================================================================

describe('calculateProgress', () => {
  it('should calculate progress correctly', () => {
    const plan = {
      issueId: 'test',
      issueTitle: 'Test',
      createdAt: '',
      updatedAt: '',
      analysis: {
        filesIdentified: [
          { path: 'a.ts', description: '', completed: true },
          { path: 'b.ts', description: '', completed: false },
        ],
        rootCause: '',
        proposedSolution: '',
      },
      steps: [
        { number: 1, description: '', completed: true },
        { number: 2, description: '', completed: true },
        { number: 3, description: '', completed: false },
      ],
      risks: [],
      testStrategy: '',
      progressLog: [],
      rawMarkdown: '',
    };

    const progress = calculateProgress(plan);

    expect(progress.totalSteps).toBe(3);
    expect(progress.completedSteps).toBe(2);
    expect(progress.totalFiles).toBe(2);
    expect(progress.completedFiles).toBe(1);
    expect(progress.percentage).toBe(60); // 3/5 = 60%
  });

  it('should handle empty plan', () => {
    const plan = {
      issueId: 'test',
      issueTitle: 'Test',
      createdAt: '',
      updatedAt: '',
      analysis: {
        filesIdentified: [],
        rootCause: '',
        proposedSolution: '',
      },
      steps: [],
      risks: [],
      testStrategy: '',
      progressLog: [],
      rawMarkdown: '',
    };

    const progress = calculateProgress(plan);

    expect(progress.percentage).toBe(0);
  });

  it('should handle 100% completion', () => {
    const plan = {
      issueId: 'test',
      issueTitle: 'Test',
      createdAt: '',
      updatedAt: '',
      analysis: {
        filesIdentified: [{ path: 'a.ts', description: '', completed: true }],
        rootCause: '',
        proposedSolution: '',
      },
      steps: [{ number: 1, description: '', completed: true }],
      risks: [],
      testStrategy: '',
      progressLog: [],
      rawMarkdown: '',
    };

    const progress = calculateProgress(plan);

    expect(progress.percentage).toBe(100);
  });
});

// ============================================================================
// Markdown Generation Tests
// ============================================================================

describe('checkbox', () => {
  it('should generate checked checkbox', () => {
    expect(checkbox(true)).toBe('[x]');
  });

  it('should generate unchecked checkbox', () => {
    expect(checkbox(false)).toBe('[ ]');
  });
});

describe('generateProgressEntry', () => {
  it('should generate progress entry markdown', () => {
    const entry = generateProgressEntry(1, ['First note', 'Second note']);

    expect(entry).toContain('### Iteration 1');
    expect(entry).toContain('- First note');
    expect(entry).toContain('- Second note');
  });

  it('should include timestamp', () => {
    const entry = generateProgressEntry(1, ['Note']);
    // Should match ISO-like timestamp pattern
    expect(entry).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('updateCheckboxInMarkdown', () => {
  it('should update unchecked to checked', () => {
    const content = '- [ ] Fix the bug';
    const updated = updateCheckboxInMarkdown(content, 'Fix the bug', true);
    expect(updated).toBe('- [x] Fix the bug');
  });

  it('should update checked to unchecked', () => {
    const content = '- [x] Fix the bug';
    const updated = updateCheckboxInMarkdown(content, 'Fix the bug', false);
    expect(updated).toBe('- [ ] Fix the bug');
  });

  it('should not affect other checkboxes', () => {
    const content = '- [ ] First\n- [ ] Second';
    const updated = updateCheckboxInMarkdown(content, 'First', true);
    expect(updated).toBe('- [x] First\n- [ ] Second');
  });
});

describe('appendProgressLog', () => {
  it('should append to existing progress log section', () => {
    const content = `# Plan

## Progress Log
### Iteration 1 - Old
- Old note`;

    const updated = appendProgressLog(content, 2, ['New note']);

    expect(updated).toContain('### Iteration 1');
    expect(updated).toContain('### Iteration 2');
    expect(updated).toContain('- New note');
  });

  it('should add progress log section if missing', () => {
    const content = '# Plan\n\n## Steps\n1. [ ] Step';

    const updated = appendProgressLog(content, 1, ['Started']);

    expect(updated).toContain('## Progress Log');
    expect(updated).toContain('### Iteration 1');
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('isValidPlanMarkdown', () => {
  it('should return true for valid plan', () => {
    expect(isValidPlanMarkdown('# Title\n\n## Section\nContent')).toBe(true);
  });

  it('should return false for empty content', () => {
    expect(isValidPlanMarkdown('')).toBe(false);
  });

  it('should return false for null', () => {
    expect(isValidPlanMarkdown(null as unknown as string)).toBe(false);
  });

  it('should return false for content without headers', () => {
    expect(isValidPlanMarkdown('Just text')).toBe(false);
  });
});

describe('detectManualModification', () => {
  it('should detect user-modified marker', () => {
    const content = '<!-- user-modified -->\n# Plan';
    expect(detectManualModification(content)).toBe(true);
  });

  it('should detect manually edited marker', () => {
    const content = '<!-- manually edited -->\n# Plan';
    expect(detectManualModification(content)).toBe(true);
  });

  it('should detect MANUAL EDIT marker', () => {
    const content = '[MANUAL EDIT]\n# Plan';
    expect(detectManualModification(content)).toBe(true);
  });

  it('should return false for unmodified content', () => {
    const content = '# Plan\n\nContent';
    expect(detectManualModification(content)).toBe(false);
  });
});
