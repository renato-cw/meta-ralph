/**
 * Plan Parser Library (PRD-08)
 *
 * Parses IMPLEMENTATION_PLAN.md markdown content into structured data.
 * Supports checkbox parsing, section extraction, and progress calculation.
 */

import type {
  ImplementationPlan,
  PlanFile,
  PlanStep,
  PlanRisk,
  ProgressEntry,
  PlanProgress,
  PlanAnalysis,
} from './types';

// ============================================================================
// Regex Patterns
// ============================================================================

/**
 * Match checkbox items: - [x] text or - [ ] text
 */
const CHECKBOX_REGEX = /^[-*]\s*\[(x| )\]\s*(.+)$/i;

/**
 * Match file entries: - [x] `path` - description
 */
const FILE_REGEX = /^[-*]\s*\[(x| )\]\s*`([^`]+)`\s*[-–]\s*(.+)$/i;

/**
 * Match numbered steps: 1. [ ] Step description
 */
const NUMBERED_STEP_REGEX = /^(\d+)\.\s*\[(x| )\]\s*(.+)$/i;

/**
 * Match iteration headers: ### Iteration N - timestamp
 */
const ITERATION_HEADER_REGEX = /^###?\s*Iteration\s+(\d+)\s*[-–]\s*(.+)$/i;

/**
 * Match risk table rows: | Risk | Mitigation |
 */
const RISK_ROW_REGEX = /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/;

/**
 * Match section headers: ## Section Name or ### Subsection
 */
const SECTION_HEADER_REGEX = /^(#{1,4})\s+(.+)$/;

// ============================================================================
// Section Parsing
// ============================================================================

interface ParsedSection {
  name: string;
  level: number;
  content: string[];
  startLine: number;
  endLine: number;
}

/**
 * Split markdown content into sections based on headers.
 */
export function splitIntoSections(content: string): ParsedSection[] {
  const lines = content.split('\n');
  const sections: ParsedSection[] = [];
  let currentSection: ParsedSection | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const headerMatch = line.match(SECTION_HEADER_REGEX);

    if (headerMatch) {
      // Save previous section
      if (currentSection !== null) {
        currentSection.endLine = index - 1;
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        name: headerMatch[2].trim(),
        level: headerMatch[1].length,
        content: [],
        startLine: index,
        endLine: -1,
      };
    } else if (currentSection !== null) {
      currentSection.content.push(line);
    }
  }

  // Save last section
  if (currentSection !== null) {
    currentSection.endLine = lines.length - 1;
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Find a section by name (case-insensitive partial match).
 */
export function findSection(
  sections: ParsedSection[],
  name: string
): ParsedSection | undefined {
  const normalizedName = name.toLowerCase();
  return sections.find((s) => s.name.toLowerCase().includes(normalizedName));
}

// ============================================================================
// Component Parsers
// ============================================================================

/**
 * Parse file entries from content lines.
 */
export function parseFiles(lines: string[]): PlanFile[] {
  const files: PlanFile[] = [];

  for (const line of lines) {
    const match = line.match(FILE_REGEX);
    if (match) {
      files.push({
        path: match[2].trim(),
        description: match[3].trim(),
        completed: match[1].toLowerCase() === 'x',
      });
    }
  }

  return files;
}

/**
 * Parse numbered implementation steps.
 */
export function parseSteps(lines: string[]): PlanStep[] {
  const steps: PlanStep[] = [];

  for (const line of lines) {
    // Try numbered format first: 1. [ ] Step
    let match = line.match(NUMBERED_STEP_REGEX);
    if (match) {
      steps.push({
        number: parseInt(match[1], 10),
        description: match[3].trim(),
        completed: match[2].toLowerCase() === 'x',
      });
      continue;
    }

    // Also try bullet checkbox format: - [ ] Step
    match = line.match(CHECKBOX_REGEX);
    if (match) {
      steps.push({
        number: steps.length + 1,
        description: match[2].trim(),
        completed: match[1].toLowerCase() === 'x',
      });
    }
  }

  return steps;
}

/**
 * Parse risk table rows.
 */
export function parseRisks(lines: string[]): PlanRisk[] {
  const risks: PlanRisk[] = [];
  let inTable = false;

  for (const line of lines) {
    const match = line.match(RISK_ROW_REGEX);
    if (match) {
      const risk = match[1].trim();
      const mitigation = match[2].trim();

      // Skip header row and separator
      if (
        risk.toLowerCase() === 'risk' ||
        risk.includes('---') ||
        mitigation.includes('---')
      ) {
        inTable = true;
        continue;
      }

      if (inTable && risk && mitigation) {
        risks.push({ risk, mitigation });
      }
    }
  }

  return risks;
}

/**
 * Parse progress log entries.
 */
export function parseProgressLog(lines: string[]): ProgressEntry[] {
  const entries: ProgressEntry[] = [];
  let currentEntry: ProgressEntry | null = null;

  for (const line of lines) {
    const headerMatch = line.match(ITERATION_HEADER_REGEX);

    if (headerMatch) {
      // Save previous entry
      if (currentEntry) {
        entries.push(currentEntry);
      }

      // Start new entry
      currentEntry = {
        iteration: parseInt(headerMatch[1], 10),
        timestamp: headerMatch[2].trim(),
        notes: [],
      };
    } else if (currentEntry) {
      // Parse note bullet points
      const trimmed = line.trim();
      if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        currentEntry.notes.push(trimmed.replace(/^[-*]\s*/, ''));
      } else if (trimmed && !trimmed.startsWith('#')) {
        // Include non-empty, non-header lines as notes
        currentEntry.notes.push(trimmed);
      }
    }
  }

  // Save last entry
  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entries;
}

/**
 * Extract plain text from section content (non-list items).
 */
export function extractPlainText(lines: string[]): string {
  return lines
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('-') &&
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('|') &&
        !trimmed.match(/^\d+\./)
      );
    })
    .join('\n')
    .trim();
}

/**
 * Extract the issue title from the first H1 header.
 */
export function extractIssueTitle(content: string): string {
  const match = content.match(/^#\s+(?:Implementation Plan:?\s*)?(.+)$/im);
  return match ? match[1].trim() : 'Unknown Issue';
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse IMPLEMENTATION_PLAN.md content into a structured ImplementationPlan object.
 *
 * @param content - Raw markdown content
 * @param issueId - ID of the issue this plan is for
 * @returns Parsed implementation plan
 */
export function parsePlanMarkdown(
  content: string,
  issueId: string
): ImplementationPlan {
  const sections = splitIntoSections(content);
  const now = new Date().toISOString();

  // Extract issue title from header
  const issueTitle = extractIssueTitle(content);

  // Find and parse each section
  const summarySection = findSection(sections, 'summary');
  const filesSection =
    findSection(sections, 'files identified') ||
    findSection(sections, 'files');
  const rootCauseSection = findSection(sections, 'root cause');
  const solutionSection =
    findSection(sections, 'proposed solution') ||
    findSection(sections, 'solution');
  const stepsSection =
    findSection(sections, 'implementation steps') ||
    findSection(sections, 'steps');
  const risksSection =
    findSection(sections, 'risks') || findSection(sections, 'mitigations');
  const testSection =
    findSection(sections, 'test strategy') || findSection(sections, 'test');
  const progressSection =
    findSection(sections, 'progress log') || findSection(sections, 'progress');

  // Build analysis
  const analysis: PlanAnalysis = {
    filesIdentified: filesSection ? parseFiles(filesSection.content) : [],
    rootCause: rootCauseSection
      ? extractPlainText(rootCauseSection.content)
      : '',
    proposedSolution: solutionSection
      ? extractPlainText(solutionSection.content)
      : '',
  };

  // Parse steps - also check summary if steps section not found
  let steps = stepsSection ? parseSteps(stepsSection.content) : [];
  if (steps.length === 0 && summarySection) {
    steps = parseSteps(summarySection.content);
  }

  // Parse other sections
  const risks = risksSection ? parseRisks(risksSection.content) : [];
  const testStrategy = testSection
    ? extractPlainText(testSection.content)
    : '';

  // Parse progress log - collect iteration sections that come after Progress Log
  let progressLog: ProgressEntry[] = [];
  if (progressSection) {
    // First try parsing from section content
    progressLog = parseProgressLog(progressSection.content);

    // If empty, look for iteration subsections that come after Progress Log
    if (progressLog.length === 0) {
      const progressIdx = sections.findIndex(
        (s) => s.name.toLowerCase().includes('progress log') || s.name.toLowerCase().includes('progress')
      );
      if (progressIdx !== -1) {
        // Collect all iteration sections that follow
        const iterationSections = sections
          .slice(progressIdx + 1)
          .filter((s) => s.name.toLowerCase().startsWith('iteration'));

        for (const iterSection of iterationSections) {
          const match = iterSection.name.match(/^iteration\s+(\d+)\s*[-–]?\s*(.*)$/i);
          if (match) {
            const notes = iterSection.content
              .filter((line) => {
                const trimmed = line.trim();
                return (trimmed.startsWith('-') || trimmed.startsWith('*'));
              })
              .map((line) => line.trim().replace(/^[-*]\s*/, ''));

            progressLog.push({
              iteration: parseInt(match[1], 10),
              timestamp: match[2].trim() || new Date().toISOString(),
              notes,
            });
          }
        }
      }
    }
  }

  return {
    issueId,
    issueTitle,
    createdAt: now,
    updatedAt: now,
    analysis,
    steps,
    risks,
    testStrategy,
    progressLog,
    rawMarkdown: content,
  };
}

// ============================================================================
// Progress Calculation
// ============================================================================

/**
 * Calculate progress statistics from an implementation plan.
 */
export function calculateProgress(plan: ImplementationPlan): PlanProgress {
  const totalSteps = plan.steps.length;
  const completedSteps = plan.steps.filter((s) => s.completed).length;
  const totalFiles = plan.analysis.filesIdentified.length;
  const completedFiles = plan.analysis.filesIdentified.filter(
    (f) => f.completed
  ).length;

  const totalItems = totalSteps + totalFiles;
  const completedItems = completedSteps + completedFiles;

  const percentage =
    totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return {
    totalSteps,
    completedSteps,
    totalFiles,
    completedFiles,
    percentage,
  };
}

// ============================================================================
// Markdown Generation
// ============================================================================

/**
 * Generate checkbox markdown from a boolean.
 */
export function checkbox(completed: boolean): string {
  return completed ? '[x]' : '[ ]';
}

/**
 * Generate a progress log entry in markdown format.
 */
export function generateProgressEntry(
  iteration: number,
  notes: string[]
): string {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const noteLines = notes.map((n) => `- ${n}`).join('\n');
  return `### Iteration ${iteration} - ${timestamp}\n${noteLines}`;
}

/**
 * Update checkbox status in raw markdown content.
 */
export function updateCheckboxInMarkdown(
  content: string,
  itemDescription: string,
  completed: boolean
): string {
  const escapedDesc = itemDescription.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(^[-*]\\s*\\[)[x ]?(\\]\\s*${escapedDesc})`,
    'im'
  );
  const replacement = `$1${completed ? 'x' : ' '}$2`;
  return content.replace(pattern, replacement);
}

/**
 * Append a progress log entry to the markdown content.
 */
export function appendProgressLog(
  content: string,
  iteration: number,
  notes: string[]
): string {
  const entry = generateProgressEntry(iteration, notes);

  // Find the Progress Log section and append
  const progressMatch = content.match(/^##\s*Progress Log\s*$/im);
  if (progressMatch) {
    const insertPosition = content.indexOf(progressMatch[0]) + progressMatch[0].length;
    return (
      content.substring(0, insertPosition) +
      '\n\n' +
      entry +
      content.substring(insertPosition)
    );
  }

  // If no Progress Log section, append at the end
  return content + '\n\n## Progress Log\n\n' + entry;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate that content appears to be a valid implementation plan.
 */
export function isValidPlanMarkdown(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Must have a header
  if (!content.match(/^#\s+.+$/m)) {
    return false;
  }

  // Should have at least one section
  const sections = splitIntoSections(content);
  return sections.length > 0;
}

/**
 * Detect if markdown was manually modified (has user marker).
 */
export function detectManualModification(content: string): boolean {
  // Check for common manual modification markers
  const markers = [
    '<!-- user-modified -->',
    '<!-- manually edited -->',
    '[MANUAL EDIT]',
    'Modified by user',
  ];

  return markers.some((marker) =>
    content.toLowerCase().includes(marker.toLowerCase())
  );
}
