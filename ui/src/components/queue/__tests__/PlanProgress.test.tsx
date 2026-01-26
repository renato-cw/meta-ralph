/**
 * Tests for PlanProgress Component (PRD-08)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlanProgress } from '../PlanProgress';
import type { PlanProgress as PlanProgressType } from '@/lib/types';

// ============================================================================
// Helper Functions
// ============================================================================

function createProgress(overrides: Partial<PlanProgressType> = {}): PlanProgressType {
  return {
    totalSteps: 10,
    completedSteps: 5,
    totalFiles: 4,
    completedFiles: 2,
    percentage: 50,
    ...overrides,
  };
}

// ============================================================================
// PlanProgress Tests
// ============================================================================

describe('PlanProgress', () => {
  describe('Compact Mode', () => {
    it('should render compact progress badge', () => {
      const progress = createProgress({ percentage: 75 });
      render(<PlanProgress progress={progress} compact />);

      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('should show total items in compact mode', () => {
      const progress = createProgress({
        totalSteps: 10,
        completedSteps: 7,
        totalFiles: 4,
        completedFiles: 3,
        percentage: 71,
      });
      render(<PlanProgress progress={progress} compact />);

      // 10 + 3 = 13 completed out of 10 + 4 = 14 total
      expect(screen.getByText(/\(10\/14\)/)).toBeInTheDocument();
    });

    it('should have progressbar role', () => {
      render(<PlanProgress progress={createProgress()} compact />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toBeInTheDocument();
      expect(progressbar).toHaveAttribute('aria-valuenow', '50');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });
  });

  describe('Full Mode', () => {
    it('should render Plan Progress label', () => {
      render(<PlanProgress progress={createProgress()} />);

      expect(screen.getByText('Plan Progress')).toBeInTheDocument();
    });

    it('should show percentage', () => {
      render(<PlanProgress progress={createProgress({ percentage: 60 })} />);

      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('should show steps breakdown', () => {
      const progress = createProgress({
        totalSteps: 8,
        completedSteps: 3,
      });
      render(<PlanProgress progress={progress} />);

      expect(screen.getByText('Steps')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('/ 8')).toBeInTheDocument();
    });

    it('should show files breakdown when showFiles is true', () => {
      const progress = createProgress({
        totalFiles: 5,
        completedFiles: 2,
      });
      render(<PlanProgress progress={progress} showFiles />);

      expect(screen.getByText('Files')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('/ 5')).toBeInTheDocument();
    });

    it('should hide files when showFiles is false', () => {
      const progress = createProgress({
        totalFiles: 5,
        completedFiles: 2,
      });
      render(<PlanProgress progress={progress} showFiles={false} />);

      expect(screen.queryByText('Files')).not.toBeInTheDocument();
    });

    it('should hide files when totalFiles is 0', () => {
      const progress = createProgress({
        totalFiles: 0,
        completedFiles: 0,
      });
      render(<PlanProgress progress={progress} showFiles />);

      expect(screen.queryByText('Files')).not.toBeInTheDocument();
    });
  });

  describe('Progress Colors', () => {
    it('should use green color for 100% completion', () => {
      render(<PlanProgress progress={createProgress({ percentage: 100 })} compact />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar.className).toContain('bg-green');
    });

    it('should use blue color for 70-99% completion', () => {
      render(<PlanProgress progress={createProgress({ percentage: 80 })} compact />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar.className).toContain('bg-blue');
    });

    it('should use yellow color for 30-69% completion', () => {
      render(<PlanProgress progress={createProgress({ percentage: 50 })} compact />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar.className).toContain('bg-yellow');
    });

    it('should use gray color for <30% completion', () => {
      render(<PlanProgress progress={createProgress({ percentage: 20 })} compact />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar.className).toContain('bg-gray');
    });
  });

  describe('Edge Cases', () => {
    it('should render nothing for invalid progress', () => {
      // @ts-expect-error Testing invalid input
      const { container } = render(<PlanProgress progress={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('should handle 0% progress', () => {
      const progress = createProgress({
        totalSteps: 10,
        completedSteps: 0,
        totalFiles: 5,
        completedFiles: 0,
        percentage: 0,
      });
      render(<PlanProgress progress={progress} />);

      expect(screen.getByText('0%')).toBeInTheDocument();
    });

    it('should accept custom className', () => {
      const { container } = render(
        <PlanProgress progress={createProgress()} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Progress Bar Visual', () => {
    it('should show block characters in text representation', () => {
      render(<PlanProgress progress={createProgress({ percentage: 50 })} />);

      // The text representation should contain block characters
      expect(screen.getByText(/[█░]/)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label for compact mode', () => {
      render(<PlanProgress progress={createProgress({ percentage: 75 })} compact />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute(
        'aria-label',
        'Plan progress: 75% complete'
      );
    });
  });
});
