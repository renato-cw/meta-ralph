'use client';

import { useState, useCallback, useMemo } from 'react';
import type {
  ImplementationPlan,
  PlanFile,
  PlanStep,
  PlanRisk,
  ProgressEntry,
} from '@/lib/types';
import { calculateProgress } from '@/lib/plan-parser';
import { PlanProgress } from './PlanProgress';

/**
 * Props for PlanViewer component.
 */
export interface PlanViewerProps {
  /** The implementation plan to display */
  plan: ImplementationPlan | null;
  /** Whether the plan is currently loading */
  isLoading?: boolean;
  /** Error message if loading failed */
  error?: string | null;
  /** Whether the plan was manually modified */
  modifiedByUser?: boolean;
  /** Callback when plan is updated (edit mode) */
  onUpdate?: (rawMarkdown: string) => void;
  /** Callback to close the viewer */
  onClose?: () => void;
  /** Callback to refresh the plan */
  onRefresh?: () => void;
}

/**
 * Display a single file entry with checkbox.
 */
function FileItem({ file }: { file: PlanFile }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`text-lg ${file.completed ? 'text-green-400' : 'text-gray-500'}`}>
        {file.completed ? '☑' : '☐'}
      </span>
      <div className="min-w-0 flex-1">
        <code className="text-sm font-mono text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded">
          {file.path}
        </code>
        <span className="text-sm text-gray-400 ml-2">{file.description}</span>
      </div>
    </div>
  );
}

/**
 * Display a single implementation step with checkbox.
 */
function StepItem({ step }: { step: PlanStep }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`text-lg ${step.completed ? 'text-green-400' : 'text-gray-500'}`}>
        {step.completed ? '☑' : '☐'}
      </span>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-medium text-gray-300 mr-2">
          {step.number}.
        </span>
        <span className={`text-sm ${step.completed ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
          {step.description}
        </span>
      </div>
    </div>
  );
}

/**
 * Display the risks table.
 */
function RisksTable({ risks }: { risks: PlanRisk[] }) {
  if (risks.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic">No risks documented.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="text-left py-2 px-3 text-gray-400 font-medium">
              Risk
            </th>
            <th className="text-left py-2 px-3 text-gray-400 font-medium">
              Mitigation
            </th>
          </tr>
        </thead>
        <tbody>
          {risks.map((risk, index) => (
            <tr
              key={index}
              className="border-b border-gray-800 hover:bg-gray-800/30"
            >
              <td className="py-2 px-3 text-gray-300">{risk.risk}</td>
              <td className="py-2 px-3 text-gray-300">{risk.mitigation}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Display a progress log entry.
 */
function ProgressLogEntry({ entry }: { entry: ProgressEntry }) {
  return (
    <div className="border-l-2 border-gray-700 pl-4 py-2">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-blue-400">
          Iteration {entry.iteration}
        </span>
        <span className="text-xs text-gray-500">{entry.timestamp}</span>
      </div>
      <ul className="space-y-0.5">
        {entry.notes.map((note, index) => (
          <li key={index} className="text-sm text-gray-400 flex items-start gap-2">
            <span className="text-gray-600">•</span>
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Section wrapper with collapsible functionality.
 */
function Section({
  title,
  icon,
  children,
  defaultExpanded = true,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-800/50 hover:bg-gray-800/70 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="font-medium text-gray-200">{title}</span>
        </div>
        <span className="text-gray-500">{isExpanded ? '▼' : '▶'}</span>
      </button>
      {isExpanded && <div className="p-4 bg-gray-900/30">{children}</div>}
    </div>
  );
}

/**
 * Raw markdown editor component.
 */
function MarkdownEditor({
  content,
  onChange,
  onSave,
  onCancel,
}: {
  content: string;
  onChange: (content: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-96 bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm font-mono text-gray-300 focus:outline-none focus:border-blue-500 resize-y"
        placeholder="# Implementation Plan..."
        spellCheck={false}
      />
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          Save Changes
        </button>
      </div>
    </div>
  );
}

/**
 * Main Plan Viewer component.
 * Displays an implementation plan with structured sections and progress tracking.
 */
export function PlanViewer({
  plan,
  isLoading = false,
  error = null,
  modifiedByUser = false,
  onUpdate,
  onClose,
  onRefresh,
}: PlanViewerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  // Calculate progress from plan
  const progress = useMemo(() => {
    if (!plan) return null;
    return calculateProgress(plan);
  }, [plan]);

  // Start editing
  const handleEdit = useCallback(() => {
    if (plan) {
      setEditContent(plan.rawMarkdown);
      setIsEditing(true);
    }
  }, [plan]);

  // Save edits
  const handleSave = useCallback(() => {
    if (onUpdate && editContent) {
      onUpdate(editContent);
      setIsEditing(false);
    }
  }, [onUpdate, editContent]);

  // Cancel editing
  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditContent('');
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <div className="animate-spin text-3xl mb-3">⏳</div>
        <p>Loading implementation plan...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <p className="text-red-400 mb-3">{error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-sm bg-red-900/50 hover:bg-red-900/70 text-red-300 rounded-lg transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  // No plan state
  if (!plan) {
    return (
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-6 text-center">
        <div className="text-3xl mb-3">📋</div>
        <p className="text-gray-400 mb-2">No implementation plan available.</p>
        <p className="text-sm text-gray-500">
          Plans are generated in Plan mode or during Build mode iterations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>📋</span>
            <span>{plan.issueTitle}</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {new Date(plan.updatedAt).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {modifiedByUser && (
            <span className="px-2 py-1 text-xs bg-yellow-900/30 text-yellow-400 rounded">
              Manually Modified
            </span>
          )}
          {onUpdate && !isEditing && (
            <button
              onClick={handleEdit}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              ✏️ Edit
            </button>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              ↻ Refresh
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              ✕ Close
            </button>
          )}
        </div>
      </div>

      {/* Edit mode */}
      {isEditing ? (
        <MarkdownEditor
          content={editContent}
          onChange={setEditContent}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <>
          {/* Progress indicator */}
          {progress && (
            <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
              <PlanProgress progress={progress} showFiles={true} />
            </div>
          )}

          {/* Analysis Section */}
          <Section title="Analysis" icon="🔍">
            <div className="space-y-4">
              {/* Files Identified */}
              {plan.analysis.filesIdentified.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">
                    Files Identified ({plan.analysis.filesIdentified.length})
                  </h4>
                  <div className="space-y-1 bg-gray-800/30 rounded-lg p-3">
                    {plan.analysis.filesIdentified.map((file, index) => (
                      <FileItem key={index} file={file} />
                    ))}
                  </div>
                </div>
              )}

              {/* Root Cause */}
              {plan.analysis.rootCause && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">
                    Root Cause
                  </h4>
                  <p className="text-sm text-gray-300 bg-gray-800/30 rounded-lg p-3">
                    {plan.analysis.rootCause}
                  </p>
                </div>
              )}

              {/* Proposed Solution */}
              {plan.analysis.proposedSolution && (
                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">
                    Proposed Solution
                  </h4>
                  <p className="text-sm text-gray-300 bg-gray-800/30 rounded-lg p-3">
                    {plan.analysis.proposedSolution}
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Implementation Steps */}
          <Section title="Implementation Steps" icon="📝">
            {plan.steps.length > 0 ? (
              <div className="space-y-1 bg-gray-800/30 rounded-lg p-3">
                {plan.steps.map((step) => (
                  <StepItem key={step.number} step={step} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No steps documented yet.
              </p>
            )}
          </Section>

          {/* Risks & Mitigations */}
          <Section title="Risks & Mitigations" icon="⚠️" defaultExpanded={false}>
            <RisksTable risks={plan.risks} />
          </Section>

          {/* Test Strategy */}
          {plan.testStrategy && (
            <Section title="Test Strategy" icon="🧪" defaultExpanded={false}>
              <p className="text-sm text-gray-300">{plan.testStrategy}</p>
            </Section>
          )}

          {/* Progress Log */}
          <Section title="Progress Log" icon="📊">
            {plan.progressLog.length > 0 ? (
              <div className="space-y-3">
                {plan.progressLog.map((entry, index) => (
                  <ProgressLogEntry key={index} entry={entry} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No progress logged yet.
              </p>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

export default PlanViewer;
