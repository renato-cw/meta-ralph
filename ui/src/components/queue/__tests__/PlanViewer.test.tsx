/**
 * Tests for PlanViewer Component (PRD-08)
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanViewer } from '../PlanViewer';
import type { ImplementationPlan } from '@/lib/types';

// ============================================================================
// Helper Functions
// ============================================================================

function createPlan(overrides: Partial<ImplementationPlan> = {}): ImplementationPlan {
  return {
    issueId: 'test-issue-123',
    issueTitle: 'Fix Authentication Bypass',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T11:00:00Z',
    analysis: {
      filesIdentified: [
        { path: 'src/auth.ts', description: 'Main auth logic', completed: true },
        { path: 'src/middleware.ts', description: 'Auth middleware', completed: false },
      ],
      rootCause: 'Missing token validation in middleware.',
      proposedSolution: 'Add JWT validation before processing requests.',
    },
    steps: [
      { number: 1, description: 'Update auth.ts', completed: true },
      { number: 2, description: 'Update middleware', completed: false },
      { number: 3, description: 'Add tests', completed: false },
    ],
    risks: [
      { risk: 'Breaking existing auth', mitigation: 'Add regression tests' },
    ],
    testStrategy: 'Unit tests for auth logic, integration tests for flow.',
    progressLog: [
      {
        iteration: 1,
        timestamp: '2024-01-15 10:30',
        notes: ['Started analysis', 'Found vulnerable endpoint'],
      },
    ],
    rawMarkdown: '# Implementation Plan\n\nContent...',
    ...overrides,
  };
}

// ============================================================================
// PlanViewer Tests
// ============================================================================

describe('PlanViewer', () => {
  describe('Loading State', () => {
    it('should show loading indicator when isLoading is true', () => {
      render(<PlanViewer plan={null} isLoading />);

      expect(screen.getByText('Loading implementation plan...')).toBeInTheDocument();
    });

    it('should show loading spinner', () => {
      render(<PlanViewer plan={null} isLoading />);

      expect(screen.getByText(/⏳/)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when error is provided', () => {
      render(<PlanViewer plan={null} error="Failed to load plan" />);

      expect(screen.getByText('Failed to load plan')).toBeInTheDocument();
    });

    it('should show warning icon for errors', () => {
      render(<PlanViewer plan={null} error="Error" />);

      expect(screen.getByText(/⚠️/)).toBeInTheDocument();
    });

    it('should show Try Again button when onRefresh is provided', () => {
      const onRefresh = jest.fn();
      render(<PlanViewer plan={null} error="Error" onRefresh={onRefresh} />);

      const button = screen.getByText('Try Again');
      expect(button).toBeInTheDocument();

      fireEvent.click(button);
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  describe('Empty State', () => {
    it('should show no plan message when plan is null', () => {
      render(<PlanViewer plan={null} />);

      expect(screen.getByText('No implementation plan available.')).toBeInTheDocument();
    });

    it('should show hint about plan generation', () => {
      render(<PlanViewer plan={null} />);

      expect(screen.getByText(/Plans are generated in Plan mode/)).toBeInTheDocument();
    });
  });

  describe('Plan Display', () => {
    it('should show plan title', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText('Fix Authentication Bypass')).toBeInTheDocument();
    });

    it('should show last updated time', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    });

    it('should show manually modified badge when plan was modified', () => {
      render(<PlanViewer plan={createPlan()} modifiedByUser />);

      expect(screen.getByText('Manually Modified')).toBeInTheDocument();
    });
  });

  describe('Analysis Section', () => {
    it('should show Analysis section', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText('Analysis')).toBeInTheDocument();
    });

    it('should show files identified', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText('Files Identified (2)')).toBeInTheDocument();
      expect(screen.getByText('src/auth.ts')).toBeInTheDocument();
      expect(screen.getByText('src/middleware.ts')).toBeInTheDocument();
    });

    it('should show completed checkboxes for completed files', () => {
      render(<PlanViewer plan={createPlan()} />);

      // Find the checked checkbox for completed file
      const checkedBoxes = screen.getAllByText('☑');
      expect(checkedBoxes.length).toBeGreaterThan(0);
    });

    it('should show uncompleted checkboxes for pending files', () => {
      render(<PlanViewer plan={createPlan()} />);

      // Find the unchecked checkbox for pending file
      const uncheckedBoxes = screen.getAllByText('☐');
      expect(uncheckedBoxes.length).toBeGreaterThan(0);
    });

    it('should show root cause', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText('Root Cause')).toBeInTheDocument();
      expect(screen.getByText('Missing token validation in middleware.')).toBeInTheDocument();
    });

    it('should show proposed solution', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText('Proposed Solution')).toBeInTheDocument();
      expect(screen.getByText('Add JWT validation before processing requests.')).toBeInTheDocument();
    });
  });

  describe('Implementation Steps Section', () => {
    it('should show Implementation Steps section', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText('Implementation Steps')).toBeInTheDocument();
    });

    it('should show all steps', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText('Update auth.ts')).toBeInTheDocument();
      expect(screen.getByText('Update middleware')).toBeInTheDocument();
      expect(screen.getByText('Add tests')).toBeInTheDocument();
    });

    it('should show step numbers', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText('1.')).toBeInTheDocument();
      expect(screen.getByText('2.')).toBeInTheDocument();
      expect(screen.getByText('3.')).toBeInTheDocument();
    });

    it('should show no steps message when empty', () => {
      const plan = createPlan({ steps: [] });
      render(<PlanViewer plan={plan} />);

      expect(screen.getByText('No steps documented yet.')).toBeInTheDocument();
    });
  });

  describe('Risks Section', () => {
    it('should show Risks & Mitigations section', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText('Risks & Mitigations')).toBeInTheDocument();
    });

    it('should show risk table headers', () => {
      render(<PlanViewer plan={createPlan()} />);

      // Need to expand section first
      fireEvent.click(screen.getByText('Risks & Mitigations'));

      expect(screen.getByText('Risk')).toBeInTheDocument();
      expect(screen.getByText('Mitigation')).toBeInTheDocument();
    });

    it('should show risk data', () => {
      render(<PlanViewer plan={createPlan()} />);

      fireEvent.click(screen.getByText('Risks & Mitigations'));

      expect(screen.getByText('Breaking existing auth')).toBeInTheDocument();
      expect(screen.getByText('Add regression tests')).toBeInTheDocument();
    });

    it('should show no risks message when empty', () => {
      const plan = createPlan({ risks: [] });
      render(<PlanViewer plan={plan} />);

      fireEvent.click(screen.getByText('Risks & Mitigations'));

      expect(screen.getByText('No risks documented.')).toBeInTheDocument();
    });
  });

  describe('Progress Log Section', () => {
    it('should show Progress Log section', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText('Progress Log')).toBeInTheDocument();
    });

    it('should show iteration entries', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.getByText('Iteration 1')).toBeInTheDocument();
      expect(screen.getByText('Started analysis')).toBeInTheDocument();
    });

    it('should show no progress message when empty', () => {
      const plan = createPlan({ progressLog: [] });
      render(<PlanViewer plan={plan} />);

      expect(screen.getByText('No progress logged yet.')).toBeInTheDocument();
    });
  });

  describe('Progress Indicator', () => {
    it('should show progress component', () => {
      render(<PlanViewer plan={createPlan()} />);

      // The plan has 3 steps (1 completed) and 2 files (1 completed) = 2/5 = 40%
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Section Collapsing', () => {
    it('should toggle section expansion on click', async () => {
      render(<PlanViewer plan={createPlan()} />);

      const analysisHeader = screen.getByText('Analysis');

      // Initially expanded
      expect(screen.getByText('src/auth.ts')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(analysisHeader);

      // Content should be hidden
      await waitFor(() => {
        expect(screen.queryByText('src/auth.ts')).not.toBeInTheDocument();
      });

      // Click to expand
      fireEvent.click(analysisHeader);

      // Content should be visible again
      await waitFor(() => {
        expect(screen.getByText('src/auth.ts')).toBeInTheDocument();
      });
    });
  });

  describe('Edit Mode', () => {
    it('should show Edit button when onUpdate is provided', () => {
      const onUpdate = jest.fn();
      render(<PlanViewer plan={createPlan()} onUpdate={onUpdate} />);

      expect(screen.getByText(/Edit/)).toBeInTheDocument();
    });

    it('should not show Edit button when onUpdate is not provided', () => {
      render(<PlanViewer plan={createPlan()} />);

      expect(screen.queryByText(/Edit/)).not.toBeInTheDocument();
    });

    it('should enter edit mode on Edit click', async () => {
      const user = userEvent.setup();
      const onUpdate = jest.fn();
      render(<PlanViewer plan={createPlan()} onUpdate={onUpdate} />);

      await user.click(screen.getByText(/Edit/));

      // Should show textarea in edit mode
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByText('Save Changes')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should cancel edit mode', async () => {
      const user = userEvent.setup();
      const onUpdate = jest.fn();
      render(<PlanViewer plan={createPlan()} onUpdate={onUpdate} />);

      await user.click(screen.getByText(/Edit/));
      await user.click(screen.getByText('Cancel'));

      // Should exit edit mode
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('should call onUpdate on save', async () => {
      const user = userEvent.setup();
      const onUpdate = jest.fn();
      render(<PlanViewer plan={createPlan()} onUpdate={onUpdate} />);

      await user.click(screen.getByText(/Edit/));

      const textarea = screen.getByRole('textbox');
      await user.clear(textarea);
      await user.type(textarea, '# Updated Plan');

      await user.click(screen.getByText('Save Changes'));

      expect(onUpdate).toHaveBeenCalledWith('# Updated Plan');
    });
  });

  describe('Header Actions', () => {
    it('should show Refresh button when onRefresh is provided', () => {
      const onRefresh = jest.fn();
      render(<PlanViewer plan={createPlan()} onRefresh={onRefresh} />);

      expect(screen.getByText(/Refresh/)).toBeInTheDocument();
    });

    it('should call onRefresh on Refresh click', async () => {
      const user = userEvent.setup();
      const onRefresh = jest.fn();
      render(<PlanViewer plan={createPlan()} onRefresh={onRefresh} />);

      await user.click(screen.getByText(/Refresh/));

      expect(onRefresh).toHaveBeenCalled();
    });

    it('should show Close button when onClose is provided', () => {
      const onClose = jest.fn();
      render(<PlanViewer plan={createPlan()} onClose={onClose} />);

      expect(screen.getByText(/Close/)).toBeInTheDocument();
    });

    it('should call onClose on Close click', async () => {
      const user = userEvent.setup();
      const onClose = jest.fn();
      render(<PlanViewer plan={createPlan()} onClose={onClose} />);

      await user.click(screen.getByText(/Close/));

      expect(onClose).toHaveBeenCalled();
    });
  });
});
