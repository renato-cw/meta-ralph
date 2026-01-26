import { render, screen } from '@testing-library/react';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  describe('rendering', () => {
    it('renders with title and value', () => {
      render(<StatCard title="Total Issues" value={42} />);

      expect(screen.getByText('Total Issues')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders string value', () => {
      render(<StatCard title="Success Rate" value="85%" />);

      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('formats large numbers with locale', () => {
      render(<StatCard title="Count" value={1234567} />);

      // Number.toLocaleString() formats numbers with commas
      expect(screen.getByText('1,234,567')).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
      render(
        <StatCard
          title="Success Rate"
          value="85%"
          subtitle="10 of 12 processed"
        />
      );

      expect(screen.getByText('10 of 12 processed')).toBeInTheDocument();
    });

    it('renders icon when provided', () => {
      render(
        <StatCard
          title="Total"
          value={10}
          icon={<span data-testid="test-icon">Icon</span>}
        />
      );

      expect(screen.getByTestId('test-icon')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('renders loading skeleton when loading', () => {
      render(<StatCard title="Total" value={10} loading />);

      expect(screen.getByTestId('stat-card-loading')).toBeInTheDocument();
      expect(screen.queryByText('Total')).not.toBeInTheDocument();
      expect(screen.queryByText('10')).not.toBeInTheDocument();
    });
  });

  describe('trend indicator', () => {
    it('renders positive trend with up arrow', () => {
      render(<StatCard title="Issues" value={50} trend={12.5} />);

      expect(screen.getByText(/↑/)).toBeInTheDocument();
      expect(screen.getByText(/12.5%/)).toBeInTheDocument();
    });

    it('renders negative trend with down arrow', () => {
      render(<StatCard title="Issues" value={50} trend={-8.3} />);

      expect(screen.getByText(/↓/)).toBeInTheDocument();
      expect(screen.getByText(/8.3%/)).toBeInTheDocument();
    });

    it('renders zero trend as positive', () => {
      render(<StatCard title="Issues" value={50} trend={0} />);

      expect(screen.getByText(/↑/)).toBeInTheDocument();
      expect(screen.getByText(/0.0%/)).toBeInTheDocument();
    });

    it('does not render trend when not provided', () => {
      render(<StatCard title="Issues" value={50} />);

      expect(screen.queryByText(/vs. last period/)).not.toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('renders with default variant', () => {
      render(<StatCard title="Test" value={1} variant="default" />);

      const card = screen.getByTestId('stat-card');
      expect(card).toHaveClass('border-zinc-700');
    });

    it('renders with success variant', () => {
      render(<StatCard title="Test" value={1} variant="success" />);

      const card = screen.getByTestId('stat-card');
      expect(card).toHaveClass('border-green-800');
    });

    it('renders with warning variant', () => {
      render(<StatCard title="Test" value={1} variant="warning" />);

      const card = screen.getByTestId('stat-card');
      expect(card).toHaveClass('border-yellow-800');
    });

    it('renders with error variant', () => {
      render(<StatCard title="Test" value={1} variant="error" />);

      const card = screen.getByTestId('stat-card');
      expect(card).toHaveClass('border-red-800');
    });

    it('renders with info variant', () => {
      render(<StatCard title="Test" value={1} variant="info" />);

      const card = screen.getByTestId('stat-card');
      expect(card).toHaveClass('border-blue-800');
    });
  });
});
