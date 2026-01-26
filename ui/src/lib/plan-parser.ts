/**
 * Plan Parser Library (PRD-08)
 *
 * Parses IMPLEMENTATION_PLAN.md markdown files into structured data.
 * Enables real-time progress tracking and plan visualization in the UI.
 *
 * Why this exists:
 * - Claude generates IMPLEMENTATION_PLAN.md during Plan mode with checkboxes
 * - The UI needs to display progress (% complete) and highlight current tasks
 * - This parser extracts structured data from markdown for the PlanViewer component
 */

import type {
  ImplementationPlan,
  PlanStep,
  PlanFile,
  PlanRisk,
  RiskLevel,
} from './types';

// ============================================================================
// Regex Patterns
// ============================================================================

/**
 * Matches markdown checkboxes: - [ ] or - [x]
 * Groups: [1] = x or space, [2] = content
 */
const CHECKBOX_REGEX = /^[-*]\s*\[(x| )\]\s*(.+)$/i;

/**
 * Matches file references with checkboxes: - [ ] `path/to/file.ts` - description
 * Groups: [1] = x or space, [2] = file path, [3] = description (optional)
 */
const FILE_REGEX = /^[-*]\s*\[(x| )\]\s*`([^`]+)`(?:\s*[-:]\s*(.+))?$/i;

/**
 * Matches section headers: ## Section Name or ### Subsection
 * Groups: [1] = # characters, [2] = section name
 */
const HEADER_REGEX = /^(#{1,6})\s+(.+)$/;

/**
 * Matches risk table rows: | Risk Level | Description | Mitigation |
 * Groups: [1] = risk, [2] = description, [3] = mitigation (optional)
 */
const RISK_TABLE_REGEX = /^\|\s*([^|]+)\s*\|\s*([^|]+)\s*(?:\|\s*([^|]*)\s*)?/;

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parses a line to extract a PlanStep if it contains a checkbox.
 *
 * @param line - The markdown line to parse
 * @param lineNumber - The line number in the original file
 * @returns PlanStep or null if not a checkbox line
 */
export function parseCheckboxLine(line: string, lineNumber: number): PlanStep | null {
  const trimmed = line.trim();
  const match = trimmed.match(CHECKBOX_REGEX);

  if (!match) return null;

  return {
    id: `step-${lineNumber}`,
    content: match[2].trim(),
    completed: match[1].toLowerCase() === 'x',
    line: lineNumber,
  };
}

/**
 * Parses a line to extract a PlanFile if it contains a file checkbox.
 *
 * @param line - The markdown line to parse
 * @returns PlanFile or null if not a file checkbox line
 */
export function parseFileLine(line: string): PlanFile | null {
  const trimmed = line.trim();
  const match = trimmed.match(FILE_REGEX);

  if (!match) return null;

  // Determine action from description keywords
  const description = (match[3] || '').toLowerCase();
  let action: 'create' | 'modify' | 'delete' = 'modify';
  if (description.includes('create') || description.includes('new') || description.includes('add')) {
    action = 'create';
  } else if (description.includes('delete') || description.includes('remove')) {
    action = 'delete';
  }

  return {
    path: match[2].trim(),
    action,
    completed: match[1].toLowerCase() === 'x',
  };
}

/**
 * Parses a risk level string into the RiskLevel enum.
 *
 * @param text - The risk level text (e.g., "High", "Medium", "Low")
 * @returns The parsed RiskLevel
 */
export function parseRiskLevel(text: string): RiskLevel {
  const lower = text.toLowerCase().trim();
  if (lower.includes('high') || lower.includes('critical')) return 'high';
  if (lower.includes('medium') || lower.includes('moderate')) return 'medium';
  return 'low';
}

/**
 * Parses a table row to extract a PlanRisk.
 *
 * @param line - The markdown table row to parse
 * @returns PlanRisk or null if not a valid risk row
 */
export function parseRiskRow(line: string): PlanRisk | null {
  const match = line.match(RISK_TABLE_REGEX);
  if (!match) return null;

  const riskText = match[1].trim();
  const description = match[2].trim();
  const mitigation = match[3]?.trim();

  // Skip header rows
  if (
    riskText.toLowerCase().includes('risk') ||
    riskText.includes('---') ||
    description.includes('---')
  ) {
    return null;
  }

  return {
    level: parseRiskLevel(riskText),
    description,
    mitigation: mitigation || undefined,
  };
}

/**
 * Extracts the title from a markdown plan.
 *
 * @param lines - Array of markdown lines
 * @returns The extracted title
 */
export function extractTitle(lines: string[]): string {
  for (const line of lines) {
    const match = line.match(/^#\s+(?:Implementation Plan[:\s]*)?(.+)/i);
    if (match) {
      return match[1].trim();
    }
  }
  return 'Implementation Plan';
}

/**
 * Extracts the summary from the markdown plan.
 * Looks for content after "## Summary" or "## Overview" headers.
 *
 * @param lines - Array of markdown lines
 * @returns The extracted summary
 */
export function extractSummary(lines: string[]): string {
  let inSummarySection = false;
  const summaryLines: string[] = [];

  for (const line of lines) {
    const headerMatch = line.match(HEADER_REGEX);

    if (headerMatch) {
      const headerName = headerMatch[2].toLowerCase();
      if (
        headerName.includes('summary') ||
        headerName.includes('overview') ||
        headerName.includes('issue summary')
      ) {
        inSummarySection = true;
        continue;
      } else if (inSummarySection) {
        // Hit next section, stop collecting
        break;
      }
    }

    if (inSummarySection && line.trim()) {
      summaryLines.push(line.trim());
    }
  }

  return summaryLines.join(' ').slice(0, 500) || 'No summary available';
}

/**
 * Parses the entire IMPLEMENTATION_PLAN.md content into a structured plan.
 *
 * @param content - The raw markdown content
 * @param issueId - The issue ID this plan belongs to
 * @returns The parsed ImplementationPlan
 */
export function parsePlanMarkdown(content: string, issueId: string): ImplementationPlan {
  const lines = content.split('\n');
  const steps: PlanStep[] = [];
  const files: PlanFile[] = [];
  const risks: PlanRisk[] = [];

  let currentSection = '';
  let inRiskSection = false;
  let inFilesSection = false;
  let inStepsSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    const headerMatch = line.match(HEADER_REGEX);

    // Track current section
    if (headerMatch) {
      currentSection = headerMatch[2].toLowerCase();
      inRiskSection = currentSection.includes('risk');
      inFilesSection =
        currentSection.includes('file') ||
        currentSection.includes('affected') ||
        currentSection.includes('identified');
      inStepsSection =
        currentSection.includes('step') ||
        currentSection.includes('task') ||
        currentSection.includes('implementation') ||
        currentSection.includes('todo');
      continue;
    }

    // Parse risks from table rows
    if (inRiskSection) {
      const risk = parseRiskRow(line);
      if (risk) {
        risks.push(risk);
      }
    }

    // Parse files section
    if (inFilesSection) {
      const file = parseFileLine(line);
      if (file) {
        files.push(file);
      }
    }

    // Parse steps/tasks from anywhere with checkboxes
    const step = parseCheckboxLine(line, lineNumber);
    if (step) {
      // Don't duplicate file items as steps
      if (!parseFileLine(line)) {
        steps.push(step);
      } else if (inStepsSection) {
        // In steps section, include even file-like items
        steps.push(step);
      }
    }
  }

  // Calculate progress
  const completedSteps = steps.filter((s) => s.completed).length;
  const totalSteps = steps.length;
  const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const now = new Date().toISOString();

  return {
    issueId,
    title: extractTitle(lines),
    summary: extractSummary(lines),
    steps,
    files,
    risks,
    progress,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Calculates progress percentage from steps.
 *
 * @param steps - Array of PlanSteps
 * @returns Progress percentage (0-100)
 */
export function calculateProgress(steps: PlanStep[]): number {
  if (steps.length === 0) return 0;
  const completed = steps.filter((s) => s.completed).length;
  return Math.round((completed / steps.length) * 100);
}

/**
 * Finds the current (first incomplete) step.
 *
 * @param steps - Array of PlanSteps
 * @returns The current step or null if all complete
 */
export function getCurrentStep(steps: PlanStep[]): PlanStep | null {
  return steps.find((s) => !s.completed) || null;
}

/**
 * Updates a step's completion status in the markdown content.
 *
 * @param content - The original markdown content
 * @param lineNumber - The line number of the step to update
 * @param completed - The new completion status
 * @returns The updated markdown content
 */
export function updateStepCompletion(
  content: string,
  lineNumber: number,
  completed: boolean
): string {
  const lines = content.split('\n');
  const index = lineNumber - 1;

  if (index < 0 || index >= lines.length) {
    return content;
  }

  const line = lines[index];
  const checkMark = completed ? 'x' : ' ';

  // Replace checkbox state
  lines[index] = line.replace(/\[(x| )\]/i, `[${checkMark}]`);

  return lines.join('\n');
}

/**
 * Generates a summary stats object for display.
 *
 * @param plan - The parsed ImplementationPlan
 * @returns Summary statistics
 */
export function getPlanStats(plan: ImplementationPlan): {
  totalSteps: number;
  completedSteps: number;
  totalFiles: number;
  completedFiles: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
} {
  return {
    totalSteps: plan.steps.length,
    completedSteps: plan.steps.filter((s) => s.completed).length,
    totalFiles: plan.files.length,
    completedFiles: plan.files.filter((f) => f.completed).length,
    highRisks: plan.risks.filter((r) => r.level === 'high').length,
    mediumRisks: plan.risks.filter((r) => r.level === 'medium').length,
    lowRisks: plan.risks.filter((r) => r.level === 'low').length,
  };
}

/**
 * Validates that a string appears to be a valid implementation plan.
 *
 * @param content - The content to validate
 * @returns True if content looks like a valid plan
 */
export function isValidPlanContent(content: string): boolean {
  if (!content || typeof content !== 'string') return false;

  // Use multiline versions of the regex patterns
  const multilineHeaderRegex = /^#{1,6}\s+.+$/m;
  const multilineCheckboxRegex = /^[-*]\s*\[(x| )\]\s*.+$/im;

  // Must have at least one header
  if (!multilineHeaderRegex.test(content)) return false;

  // Should have at least one checkbox to be useful
  return multilineCheckboxRegex.test(content);
}
