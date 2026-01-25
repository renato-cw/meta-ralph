import { render, screen, fireEvent } from '@testing-library/react';
import { GroupHeader } from '../GroupHeader';
import type { GroupBy } from '@/lib/types';

describe('GroupHeader', () => {
  const defaultProps = {
    groupKey: 'test-group',
    label: 'Test Group',
    count: 5,
    isCollapsed: false,
    onToggle: jest.fn(),
    groupBy: 'provider' as GroupBy,
    selectedCount: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the group label', () => {
      render(<GroupHeader {...defaultProps} />);
      expect(screen.getByText('Test Group')).toBeInTheDocument();
    });

    it('renders the issue count', () => {
      render(<GroupHeader {...defaultProps} count={5} />);
      expect(screen.getByText('5 issues')).toBeInTheDocument();
    });

    it('renders singular "issue" for count of 1', () => {
      render(<GroupHeader {...defaultProps} count={1} />);
      expect(screen.getByText('1 issue')).toBeInTheDocument();
    });

    it('renders the group icon', () => {
      render(<GroupHeader {...defaultProps} label="Zeropath" />);
      expect(screen.getByText('Z')).toBeInTheDocument();
    });

    it('shows selection count when items are selected', () => {
      render(<GroupHeader {...defaultProps} selectedCount={3} />);
      expect(screen.getByText('3 selected')).toBeInTheDocument();
    });

    it('does not show selection count when none selected', () => {
      render(<GroupHeader {...defaultProps} selectedCount={0} />);
      expect(screen.queryByText(/selected/i)).not.toBeInTheDocument();
    });
  });

  describe('collapse/expand state', () => {
    it('shows expanded state visually when not collapsed', () => {
      render(<GroupHeader {...defaultProps} isCollapsed={false} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('shows collapsed state visually when collapsed', () => {
      render(<GroupHeader {...defaultProps} isCollapsed={true} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('interactions', () => {
    it('calls onToggle when clicked', () => {
      const onToggle = jest.fn();
      render(<GroupHeader {...defaultProps} onToggle={onToggle} />);

      fireEvent.click(screen.getByRole('button'));
      expect(onToggle).toHaveBeenCalledWith('test-group');
    });

    it('calls onToggle when Enter key is pressed', () => {
      const onToggle = jest.fn();
      render(<GroupHeader {...defaultProps} onToggle={onToggle} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      expect(onToggle).toHaveBeenCalledWith('test-group');
    });

    it('calls onToggle when Space key is pressed', () => {
      const onToggle = jest.fn();
      render(<GroupHeader {...defaultProps} onToggle={onToggle} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
      expect(onToggle).toHaveBeenCalledWith('test-group');
    });

    it('does not call onToggle for other keys', () => {
      const onToggle = jest.fn();
      render(<GroupHeader {...defaultProps} onToggle={onToggle} />);

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' });
      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  describe('severity grouping', () => {
    it('applies CRITICAL styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="severity" label="CRITICAL" />);
      const icon = screen.getByText('C');
      expect(icon).toHaveClass('bg-red-900/50');
    });

    it('applies HIGH styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="severity" label="HIGH" />);
      const icon = screen.getByText('H');
      expect(icon).toHaveClass('bg-orange-900/50');
    });

    it('applies MEDIUM styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="severity" label="MEDIUM" />);
      const icon = screen.getByText('M');
      expect(icon).toHaveClass('bg-yellow-900/50');
    });

    it('applies LOW styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="severity" label="LOW" />);
      const icon = screen.getByText('L');
      expect(icon).toHaveClass('bg-green-900/50');
    });

    it('applies INFO styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="severity" label="INFO" />);
      const icon = screen.getByText('I');
      expect(icon).toHaveClass('bg-blue-900/50');
    });
  });

  describe('provider grouping', () => {
    it('applies Zeropath styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="provider" label="Zeropath" />);
      const icon = screen.getByText('Z');
      expect(icon).toHaveClass('bg-purple-900/50');
    });

    it('applies Sentry styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="provider" label="Sentry" />);
      const icon = screen.getByText('S');
      expect(icon).toHaveClass('bg-orange-900/50');
    });

    it('applies Codecov styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="provider" label="Codecov" />);
      const icon = screen.getByText('C');
      expect(icon).toHaveClass('bg-green-900/50');
    });

    it('applies GitHub styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="provider" label="GitHub" />);
      const icon = screen.getByText('G');
      expect(icon).toHaveClass('bg-gray-700');
    });
  });

  describe('date grouping', () => {
    it('applies Today styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="date" label="Today" />);
      const icon = screen.getByText('T');
      expect(icon).toHaveClass('bg-blue-900/50');
    });

    it('applies Yesterday styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="date" label="Yesterday" />);
      const icon = screen.getByText('Y');
      expect(icon).toHaveClass('bg-cyan-900/50');
    });

    it('applies This Week styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="date" label="This Week" />);
      const icon = screen.getByText('T');
      expect(icon).toHaveClass('bg-teal-900/50');
    });

    it('applies Older styling', () => {
      render(<GroupHeader {...defaultProps} groupBy="date" label="Older" />);
      const icon = screen.getByText('O');
      expect(icon).toHaveClass('bg-gray-700');
    });
  });

  describe('accessibility', () => {
    it('has correct aria-controls attribute', () => {
      render(<GroupHeader {...defaultProps} groupKey="my-group" />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-controls', 'group-content-my-group');
    });

    it('is focusable', () => {
      render(<GroupHeader {...defaultProps} />);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('tabIndex', '0');
    });
  });
});
