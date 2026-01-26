import { render, screen, fireEvent } from '@testing-library/react';
import { ViewToggle } from '../ViewToggle';
import type { GroupBy } from '@/lib/types';

describe('ViewToggle', () => {
  const defaultProps = {
    groupBy: null as GroupBy,
    onGroupByChange: jest.fn(),
    hasCollapsedGroups: false,
    onCollapseAll: jest.fn(),
    onExpandAll: jest.fn(),
    groupCount: 0,
    collapsedCount: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the group by selector', () => {
      render(<ViewToggle {...defaultProps} />);

      expect(screen.getByLabelText(/group by/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('shows all grouping options', () => {
      render(<ViewToggle {...defaultProps} />);

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();

      // Check options
      expect(screen.getByRole('option', { name: 'None' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Provider' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Severity' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Date' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Location' })).toBeInTheDocument();
    });

    it('selects the current groupBy value', () => {
      render(<ViewToggle {...defaultProps} groupBy="provider" />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('provider');
    });

    it('shows null as "None" option', () => {
      render(<ViewToggle {...defaultProps} groupBy={null} />);

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('null');
    });
  });

  describe('interactions', () => {
    it('calls onGroupByChange when selection changes', () => {
      const onGroupByChange = jest.fn();
      render(<ViewToggle {...defaultProps} onGroupByChange={onGroupByChange} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'severity' } });

      expect(onGroupByChange).toHaveBeenCalledWith('severity');
    });

    it('calls onGroupByChange with null when None is selected', () => {
      const onGroupByChange = jest.fn();
      render(<ViewToggle {...defaultProps} groupBy="provider" onGroupByChange={onGroupByChange} />);

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'null' } });

      expect(onGroupByChange).toHaveBeenCalledWith(null);
    });
  });

  describe('collapse/expand buttons', () => {
    it('does not show collapse/expand buttons when not grouped', () => {
      render(<ViewToggle {...defaultProps} groupBy={null} groupCount={3} />);

      expect(screen.queryByText(/collapse/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/expand/i)).not.toBeInTheDocument();
    });

    it('does not show collapse/expand buttons when grouped but no groups', () => {
      render(<ViewToggle {...defaultProps} groupBy="provider" groupCount={0} />);

      expect(screen.queryByText(/collapse/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/expand/i)).not.toBeInTheDocument();
    });

    it('shows collapse/expand buttons when grouped with groups', () => {
      render(<ViewToggle {...defaultProps} groupBy="provider" groupCount={3} />);

      expect(screen.getByTitle(/collapse all groups/i)).toBeInTheDocument();
      expect(screen.getByTitle(/expand all groups/i)).toBeInTheDocument();
    });

    it('calls onCollapseAll when collapse button is clicked', () => {
      const onCollapseAll = jest.fn();
      render(
        <ViewToggle
          {...defaultProps}
          groupBy="provider"
          groupCount={3}
          onCollapseAll={onCollapseAll}
        />
      );

      fireEvent.click(screen.getByTitle(/collapse all groups/i));
      expect(onCollapseAll).toHaveBeenCalled();
    });

    it('calls onExpandAll when expand button is clicked', () => {
      const onExpandAll = jest.fn();
      render(
        <ViewToggle
          {...defaultProps}
          groupBy="provider"
          groupCount={3}
          collapsedCount={2}
          onExpandAll={onExpandAll}
        />
      );

      fireEvent.click(screen.getByTitle(/expand all groups/i));
      expect(onExpandAll).toHaveBeenCalled();
    });

    it('disables collapse button when all groups are collapsed', () => {
      render(
        <ViewToggle
          {...defaultProps}
          groupBy="provider"
          groupCount={3}
          collapsedCount={3}
        />
      );

      const collapseButton = screen.getByTitle(/collapse all groups/i);
      expect(collapseButton).toBeDisabled();
    });

    it('disables expand button when no groups are collapsed', () => {
      render(
        <ViewToggle
          {...defaultProps}
          groupBy="provider"
          groupCount={3}
          collapsedCount={0}
        />
      );

      const expandButton = screen.getByTitle(/expand all groups/i);
      expect(expandButton).toBeDisabled();
    });

    it('shows collapsed count indicator', () => {
      render(
        <ViewToggle
          {...defaultProps}
          groupBy="provider"
          groupCount={5}
          collapsedCount={2}
        />
      );

      expect(screen.getByText('(2/5 collapsed)')).toBeInTheDocument();
    });
  });
});
