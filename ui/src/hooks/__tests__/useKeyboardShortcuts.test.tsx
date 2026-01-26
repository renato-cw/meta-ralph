import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

// Test component that uses the hook
function TestComponent({
  onNavigateDown,
  onNavigateUp,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  onToggleDetailPanel,
  onProcessSelected,
  onEscape,
  onFocusSearch,
  onShowHelp,
  onToggleFilters,
  onRefresh,
  onFilterBySeverity,
  enabled = true,
}: {
  onNavigateDown?: () => void;
  onNavigateUp?: () => void;
  onToggleSelection?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  onToggleDetailPanel?: () => void;
  onProcessSelected?: () => void;
  onEscape?: () => void;
  onFocusSearch?: () => void;
  onShowHelp?: () => void;
  onToggleFilters?: () => void;
  onRefresh?: () => void;
  onFilterBySeverity?: (severity: string) => void;
  enabled?: boolean;
}) {
  useKeyboardShortcuts({
    onNavigateDown,
    onNavigateUp,
    onToggleSelection,
    onSelectAll,
    onDeselectAll,
    onToggleDetailPanel,
    onProcessSelected,
    onEscape,
    onFocusSearch,
    onShowHelp,
    onToggleFilters,
    onRefresh,
    onFilterBySeverity: onFilterBySeverity as any,
    enabled,
  });

  return <div data-testid="test">Test Component</div>;
}

describe('useKeyboardShortcuts', () => {
  describe('Navigation shortcuts', () => {
    it('calls onNavigateDown when j is pressed', () => {
      const onNavigateDown = jest.fn();
      render(<TestComponent onNavigateDown={onNavigateDown} />);

      fireEvent.keyDown(document, { key: 'j' });
      expect(onNavigateDown).toHaveBeenCalledTimes(1);
    });

    it('calls onNavigateDown when ArrowDown is pressed', () => {
      const onNavigateDown = jest.fn();
      render(<TestComponent onNavigateDown={onNavigateDown} />);

      fireEvent.keyDown(document, { key: 'ArrowDown' });
      expect(onNavigateDown).toHaveBeenCalledTimes(1);
    });

    it('calls onNavigateUp when k is pressed', () => {
      const onNavigateUp = jest.fn();
      render(<TestComponent onNavigateUp={onNavigateUp} />);

      fireEvent.keyDown(document, { key: 'k' });
      expect(onNavigateUp).toHaveBeenCalledTimes(1);
    });

    it('calls onNavigateUp when ArrowUp is pressed', () => {
      const onNavigateUp = jest.fn();
      render(<TestComponent onNavigateUp={onNavigateUp} />);

      fireEvent.keyDown(document, { key: 'ArrowUp' });
      expect(onNavigateUp).toHaveBeenCalledTimes(1);
    });
  });

  describe('Selection shortcuts', () => {
    it('calls onToggleSelection when x is pressed', () => {
      const onToggleSelection = jest.fn();
      render(<TestComponent onToggleSelection={onToggleSelection} />);

      fireEvent.keyDown(document, { key: 'x' });
      expect(onToggleSelection).toHaveBeenCalledTimes(1);
    });

    it('calls onSelectAll when Ctrl+A is pressed', () => {
      const onSelectAll = jest.fn();
      render(<TestComponent onSelectAll={onSelectAll} />);

      fireEvent.keyDown(document, { key: 'a', ctrlKey: true });
      expect(onSelectAll).toHaveBeenCalledTimes(1);
    });

    it('calls onSelectAll when Cmd+A is pressed (Mac)', () => {
      const onSelectAll = jest.fn();
      render(<TestComponent onSelectAll={onSelectAll} />);

      fireEvent.keyDown(document, { key: 'a', metaKey: true });
      expect(onSelectAll).toHaveBeenCalledTimes(1);
    });

    it('calls onDeselectAll when Ctrl+Shift+A is pressed', () => {
      const onDeselectAll = jest.fn();
      render(<TestComponent onDeselectAll={onDeselectAll} />);

      fireEvent.keyDown(document, { key: 'A', ctrlKey: true, shiftKey: true });
      expect(onDeselectAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('Action shortcuts', () => {
    it('calls onToggleDetailPanel when Space is pressed', () => {
      const onToggleDetailPanel = jest.fn();
      render(<TestComponent onToggleDetailPanel={onToggleDetailPanel} />);

      fireEvent.keyDown(document, { key: ' ' });
      expect(onToggleDetailPanel).toHaveBeenCalledTimes(1);
    });

    it('calls onProcessSelected when Enter is pressed', () => {
      const onProcessSelected = jest.fn();
      render(<TestComponent onProcessSelected={onProcessSelected} />);

      fireEvent.keyDown(document, { key: 'Enter' });
      expect(onProcessSelected).toHaveBeenCalledTimes(1);
    });

    it('calls onEscape when Escape is pressed', () => {
      const onEscape = jest.fn();
      render(<TestComponent onEscape={onEscape} />);

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onEscape).toHaveBeenCalledTimes(1);
    });
  });

  describe('UI shortcuts', () => {
    it('calls onFocusSearch when / is pressed', () => {
      const onFocusSearch = jest.fn();
      render(<TestComponent onFocusSearch={onFocusSearch} />);

      fireEvent.keyDown(document, { key: '/' });
      expect(onFocusSearch).toHaveBeenCalledTimes(1);
    });

    it('calls onShowHelp when ? is pressed', () => {
      const onShowHelp = jest.fn();
      render(<TestComponent onShowHelp={onShowHelp} />);

      fireEvent.keyDown(document, { key: '?', shiftKey: true });
      expect(onShowHelp).toHaveBeenCalledTimes(1);
    });

    it('calls onToggleFilters when f is pressed', () => {
      const onToggleFilters = jest.fn();
      render(<TestComponent onToggleFilters={onToggleFilters} />);

      fireEvent.keyDown(document, { key: 'f' });
      expect(onToggleFilters).toHaveBeenCalledTimes(1);
    });

    it('calls onRefresh when r is pressed', () => {
      const onRefresh = jest.fn();
      render(<TestComponent onRefresh={onRefresh} />);

      fireEvent.keyDown(document, { key: 'r' });
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('Quick filter shortcuts', () => {
    it('calls onFilterBySeverity with CRITICAL when 1 is pressed', () => {
      const onFilterBySeverity = jest.fn();
      render(<TestComponent onFilterBySeverity={onFilterBySeverity} />);

      fireEvent.keyDown(document, { key: '1' });
      expect(onFilterBySeverity).toHaveBeenCalledWith('CRITICAL');
    });

    it('calls onFilterBySeverity with HIGH when 2 is pressed', () => {
      const onFilterBySeverity = jest.fn();
      render(<TestComponent onFilterBySeverity={onFilterBySeverity} />);

      fireEvent.keyDown(document, { key: '2' });
      expect(onFilterBySeverity).toHaveBeenCalledWith('HIGH');
    });

    it('calls onFilterBySeverity with MEDIUM when 3 is pressed', () => {
      const onFilterBySeverity = jest.fn();
      render(<TestComponent onFilterBySeverity={onFilterBySeverity} />);

      fireEvent.keyDown(document, { key: '3' });
      expect(onFilterBySeverity).toHaveBeenCalledWith('MEDIUM');
    });

    it('calls onFilterBySeverity with LOW when 4 is pressed', () => {
      const onFilterBySeverity = jest.fn();
      render(<TestComponent onFilterBySeverity={onFilterBySeverity} />);

      fireEvent.keyDown(document, { key: '4' });
      expect(onFilterBySeverity).toHaveBeenCalledWith('LOW');
    });

    it('calls onFilterBySeverity with INFO when 5 is pressed', () => {
      const onFilterBySeverity = jest.fn();
      render(<TestComponent onFilterBySeverity={onFilterBySeverity} />);

      fireEvent.keyDown(document, { key: '5' });
      expect(onFilterBySeverity).toHaveBeenCalledWith('INFO');
    });
  });

  describe('Disabled state', () => {
    it('does not call callbacks when disabled', () => {
      const onNavigateDown = jest.fn();
      const onToggleSelection = jest.fn();
      render(
        <TestComponent
          onNavigateDown={onNavigateDown}
          onToggleSelection={onToggleSelection}
          enabled={false}
        />
      );

      fireEvent.keyDown(document, { key: 'j' });
      fireEvent.keyDown(document, { key: 'x' });

      expect(onNavigateDown).not.toHaveBeenCalled();
      expect(onToggleSelection).not.toHaveBeenCalled();
    });
  });

  describe('Input field behavior', () => {
    it('ignores shortcuts when typing in an input (except Escape)', () => {
      const onNavigateDown = jest.fn();
      const onEscape = jest.fn();

      function InputTestComponent() {
        useKeyboardShortcuts({
          onNavigateDown,
          onEscape,
        });

        return (
          <div>
            <input data-testid="input" type="text" />
          </div>
        );
      }

      render(<InputTestComponent />);

      const input = screen.getByTestId('input');
      input.focus();

      // Regular shortcuts should be ignored in input
      fireEvent.keyDown(input, { key: 'j' });
      expect(onNavigateDown).not.toHaveBeenCalled();

      // Escape should still work and blur the input
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onEscape).toHaveBeenCalledTimes(1);
    });
  });
});
