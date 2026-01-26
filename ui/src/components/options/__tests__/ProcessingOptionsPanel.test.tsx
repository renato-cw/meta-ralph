import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProcessingOptionsPanel, ProcessingOptionsSummary } from '../ProcessingOptionsPanel';
import { DEFAULT_PROCESSING_OPTIONS, PROCESSING_PRESETS, Severity } from '@/lib/types';
import type { UseProcessingOptionsReturn } from '@/hooks/useProcessingOptions';

// Create a mock processing options return value
const createMockProcessingOptions = (overrides?: Partial<UseProcessingOptionsReturn>): UseProcessingOptionsReturn => ({
  options: DEFAULT_PROCESSING_OPTIONS,
  currentPresetId: null,
  presets: PROCESSING_PRESETS,
  selectPreset: jest.fn(),
  isCustomConfiguration: true,
  setMode: jest.fn(),
  setModel: jest.fn(),
  setMaxIterations: jest.fn(),
  setAutoPush: jest.fn(),
  setCiAwareness: jest.fn(),
  setAutoFixCi: jest.fn(),
  setOptions: jest.fn(),
  resetToDefaults: jest.fn(),
  estimateCost: jest.fn().mockReturnValue({ min: 0.15, max: 0.45, currency: 'USD' }),
  suggestModel: jest.fn().mockReturnValue('sonnet'),
  saveAsCustomPreset: jest.fn(),
  customPresets: [],
  deleteCustomPreset: jest.fn(),
  ...overrides,
});

describe('ProcessingOptionsPanel', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onStartProcessing: jest.fn(),
    issueCount: 3,
    issueSeverities: ['HIGH', 'MEDIUM', 'LOW'] as Severity[],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders when open', () => {
      const mockOptions = createMockProcessingOptions();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      expect(screen.getByText('Processing Options')).toBeInTheDocument();
      expect(screen.getByText(/Configure how 3 issues will be processed/)).toBeInTheDocument();
    });

    it('does not render when closed', () => {
      const mockOptions = createMockProcessingOptions();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          isOpen={false}
          processingOptions={mockOptions}
        />
      );

      expect(screen.queryByText('Processing Options')).not.toBeInTheDocument();
    });

    it('renders preset grid', () => {
      const mockOptions = createMockProcessingOptions();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      expect(screen.getByText('Quick Fix')).toBeInTheDocument();
      expect(screen.getByText('Careful Fix')).toBeInTheDocument();
      expect(screen.getByText('Complex Issue')).toBeInTheDocument();
      expect(screen.getByText('Security Audit')).toBeInTheDocument();
    });

    it('renders mode toggle', () => {
      const mockOptions = createMockProcessingOptions();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      expect(screen.getByText('Processing Mode')).toBeInTheDocument();
      expect(screen.getByText('Plan')).toBeInTheDocument();
      expect(screen.getByText('Build')).toBeInTheDocument();
    });

    it('renders model selector', () => {
      const mockOptions = createMockProcessingOptions();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      expect(screen.getByText('Claude Model')).toBeInTheDocument();
      expect(screen.getByText('Sonnet')).toBeInTheDocument();
      expect(screen.getByText('Opus')).toBeInTheDocument();
    });

    it('renders iteration slider', () => {
      const mockOptions = createMockProcessingOptions();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      expect(screen.getByText('Max Iterations')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
    });

    it('renders option checkboxes', () => {
      const mockOptions = createMockProcessingOptions();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      expect(screen.getByText('Auto-push after commit')).toBeInTheDocument();
      expect(screen.getByText('CI/CD Awareness')).toBeInTheDocument();
    });

    it('renders cost estimate', () => {
      const mockOptions = createMockProcessingOptions();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      expect(screen.getByText('Estimated Cost')).toBeInTheDocument();
    });

    it('renders action buttons', () => {
      const mockOptions = createMockProcessingOptions();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText(/Start Processing/)).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClose when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const mockOptions = createMockProcessingOptions();
      const onClose = jest.fn();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          onClose={onClose}
          processingOptions={mockOptions}
        />
      );

      await user.click(screen.getByText('Cancel'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      const mockOptions = createMockProcessingOptions();
      const onClose = jest.fn();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          onClose={onClose}
          processingOptions={mockOptions}
        />
      );

      // Click the backdrop (the first element with the backdrop class)
      const backdrop = document.querySelector('.bg-black\\/60');
      if (backdrop) {
        await user.click(backdrop);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('calls onClose when escape key is pressed', () => {
      const mockOptions = createMockProcessingOptions();
      const onClose = jest.fn();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          onClose={onClose}
          processingOptions={mockOptions}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onStartProcessing with options when start button is clicked', async () => {
      const user = userEvent.setup();
      const mockOptions = createMockProcessingOptions();
      const onStartProcessing = jest.fn();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          onStartProcessing={onStartProcessing}
          processingOptions={mockOptions}
        />
      );

      await user.click(screen.getByText(/Start Processing/));

      expect(onStartProcessing).toHaveBeenCalledWith(DEFAULT_PROCESSING_OPTIONS);
    });

    it('disables start button when issueCount is 0', () => {
      const mockOptions = createMockProcessingOptions();

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          issueCount={0}
          processingOptions={mockOptions}
        />
      );

      const startButton = screen.getByText(/Start Processing/);
      expect(startButton).toBeDisabled();
    });

    it('calls selectPreset when a preset is clicked', async () => {
      const user = userEvent.setup();
      const selectPreset = jest.fn();
      const mockOptions = createMockProcessingOptions({ selectPreset });

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      await user.click(screen.getByText('Quick Fix'));

      expect(selectPreset).toHaveBeenCalledWith('quick-fix');
    });

    it('calls setMode when mode toggle is clicked', async () => {
      const user = userEvent.setup();
      const setMode = jest.fn();
      const mockOptions = createMockProcessingOptions({ setMode });

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      await user.click(screen.getByText('Plan'));

      expect(setMode).toHaveBeenCalledWith('plan');
    });

    it('calls setModel when model is selected', async () => {
      const user = userEvent.setup();
      const setModel = jest.fn();
      const mockOptions = createMockProcessingOptions({ setModel });

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      await user.click(screen.getByText('Opus'));

      expect(setModel).toHaveBeenCalledWith('opus');
    });

    it('calls setAutoPush when checkbox is toggled', async () => {
      const user = userEvent.setup();
      const setAutoPush = jest.fn();
      const mockOptions = createMockProcessingOptions({ setAutoPush });

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      const checkbox = screen.getAllByRole('checkbox')[0]; // Auto-push checkbox
      await user.click(checkbox);

      expect(setAutoPush).toHaveBeenCalled();
    });

    it('calls setCiAwareness when checkbox is toggled', async () => {
      const user = userEvent.setup();
      const setCiAwareness = jest.fn();
      const mockOptions = createMockProcessingOptions({ setCiAwareness });

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      const checkbox = screen.getAllByRole('checkbox')[1]; // CI awareness checkbox
      await user.click(checkbox);

      expect(setCiAwareness).toHaveBeenCalledWith(true);
    });
  });

  describe('conditional rendering', () => {
    it('shows auto-fix CI option when ciAwareness is enabled', () => {
      const mockOptions = createMockProcessingOptions({
        options: { ...DEFAULT_PROCESSING_OPTIONS, ciAwareness: true },
      });

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      expect(screen.getByText('Auto-fix CI failures')).toBeInTheDocument();
    });

    it('hides auto-fix CI option when ciAwareness is disabled', () => {
      const mockOptions = createMockProcessingOptions({
        options: { ...DEFAULT_PROCESSING_OPTIONS, ciAwareness: false },
      });

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      expect(screen.queryByText('Auto-fix CI failures')).not.toBeInTheDocument();
    });

    it('shows configuration summary when custom configuration', () => {
      const mockOptions = createMockProcessingOptions({
        isCustomConfiguration: true,
      });

      render(
        <ProcessingOptionsPanel
          {...defaultProps}
          processingOptions={mockOptions}
        />
      );

      expect(screen.getByText(/Current:/)).toBeInTheDocument();
    });
  });
});

describe('ProcessingOptionsSummary', () => {
  it('renders options summary', () => {
    render(
      <ProcessingOptionsSummary
        options={DEFAULT_PROCESSING_OPTIONS}
      />
    );

    expect(screen.getByText(/Build/i)).toBeInTheDocument();
    expect(screen.getByText(/Sonnet/i)).toBeInTheDocument();
    expect(screen.getByText(/10 iter/)).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();

    render(
      <ProcessingOptionsSummary
        options={DEFAULT_PROCESSING_OPTIONS}
        onClick={onClick}
      />
    );

    await user.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows correct icons for plan mode', () => {
    render(
      <ProcessingOptionsSummary
        options={{ ...DEFAULT_PROCESSING_OPTIONS, mode: 'plan' }}
      />
    );

    expect(screen.getByText('📋')).toBeInTheDocument();
    expect(screen.getByText(/Plan/i)).toBeInTheDocument();
  });

  it('shows correct icons for opus model', () => {
    render(
      <ProcessingOptionsSummary
        options={{ ...DEFAULT_PROCESSING_OPTIONS, model: 'opus' }}
      />
    );

    expect(screen.getByText('🧠')).toBeInTheDocument();
    expect(screen.getByText(/Opus/i)).toBeInTheDocument();
  });
});
