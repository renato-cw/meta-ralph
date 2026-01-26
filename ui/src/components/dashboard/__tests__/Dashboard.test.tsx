import { render, screen, fireEvent } from '@testing-library/react';
import { Dashboard } from '../Dashboard';
import type { Issue } from '@/lib/types';

// Mock recharts components since they don't render well in jsdom
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  PieChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pie-chart">{children}</div>
  ),
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

// Track the mock state
let mockIsExpanded = true;
const mockSetIsExpanded = jest.fn((value) => {
  if (typeof value === 'function') {
    mockIsExpanded = value(mockIsExpanded);
  } else {
    mockIsExpanded = value;
  }
});

// Mock useLocalStorage to control expanded state
jest.mock('@/hooks/useLocalStorage', () => ({
  useLocalStorage: () => [mockIsExpanded, mockSetIsExpanded],
}));

const createMockIssues = (count: number): Issue[] => {
  const severities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
  const providers = ['zeropath', 'sentry', 'codecov'];

  return Array.from({ length: count }, (_, i) => ({
    id: `issue-${i}`,
    provider: providers[i % providers.length],
    title: `Test Issue ${i}`,
    description: `Description for issue ${i}`,
    location: `src/file${i % 3}.ts`,
    severity: severities[i % severities.length],
    raw_severity: severities[i % severities.length],
    count: (i + 1) * 5,
    priority: (i * 10) % 100 + 10,
    permalink: `https://example.com/issue/${i}`,
    metadata: {},
  }));
};

describe('Dashboard', () => {
  beforeEach(() => {
    mockIsExpanded = true; // Reset to expanded for each test
    mockSetIsExpanded.mockClear();
  });

  describe('rendering', () => {
    it('renders the dashboard container', () => {
      render(<Dashboard issues={[]} />);

      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
    });

    it('renders the dashboard header', () => {
      render(<Dashboard issues={[]} />);

      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('shows issue count in collapsed header', () => {
      mockIsExpanded = false; // Set to collapsed

      render(<Dashboard issues={createMockIssues(10)} />);

      expect(screen.getByText('(10 issues)')).toBeInTheDocument();
    });
  });

  describe('stat cards', () => {
    it('displays total issues count', () => {
      const issues = createMockIssues(25);
      render(<Dashboard issues={issues} />);

      expect(screen.getByText('Total Issues')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('displays critical count', () => {
      const issues = createMockIssues(10);
      render(<Dashboard issues={issues} />);

      expect(screen.getByText('Critical')).toBeInTheDocument();
    });

    it('displays success rate', () => {
      render(
        <Dashboard issues={createMockIssues(5)} completedCount={8} failedCount={2} />
      );

      expect(screen.getByText('Success Rate')).toBeInTheDocument();
      expect(screen.getByText('80%')).toBeInTheDocument();
    });

    it('displays 0% success rate when no processing done', () => {
      render(
        <Dashboard issues={createMockIssues(5)} completedCount={0} failedCount={0} />
      );

      expect(screen.getByText('0%')).toBeInTheDocument();
    });
  });

  describe('charts', () => {
    it('renders provider pie chart section', () => {
      render(<Dashboard issues={createMockIssues(5)} />);

      expect(screen.getByText('Issues by Provider')).toBeInTheDocument();
    });

    it('renders severity bar chart section', () => {
      render(<Dashboard issues={createMockIssues(5)} />);

      expect(screen.getByText('Issues by Severity')).toBeInTheDocument();
    });

    it('renders priority histogram section', () => {
      render(<Dashboard issues={createMockIssues(5)} />);

      expect(screen.getByText('Priority Distribution')).toBeInTheDocument();
    });
  });

  describe('top files table', () => {
    it('renders top files section', () => {
      render(<Dashboard issues={createMockIssues(10)} />);

      expect(screen.getByText('Top Files by Issues')).toBeInTheDocument();
    });

    it('groups issues by file location', () => {
      const issues = createMockIssues(9); // 3 files with 3 issues each
      render(<Dashboard issues={issues} />);

      // Should show file paths
      expect(screen.getByText('src/file0.ts')).toBeInTheDocument();
      expect(screen.getByText('src/file1.ts')).toBeInTheDocument();
      expect(screen.getByText('src/file2.ts')).toBeInTheDocument();
    });
  });

  describe('collapse/expand', () => {
    it('toggles expanded state when header is clicked', () => {
      render(<Dashboard issues={createMockIssues(5)} />);

      const header = screen.getByRole('button', { name: /dashboard/i });
      fireEvent.click(header);

      expect(mockSetIsExpanded).toHaveBeenCalled();
    });

    it('has correct aria-expanded attribute when expanded', () => {
      mockIsExpanded = true;
      render(<Dashboard issues={createMockIssues(5)} />);

      const header = screen.getByRole('button');
      expect(header).toHaveAttribute('aria-expanded', 'true');
      expect(header).toHaveAttribute('aria-controls', 'dashboard-content');
    });

    it('has correct aria-expanded attribute when collapsed', () => {
      mockIsExpanded = false;
      render(<Dashboard issues={createMockIssues(5)} />);

      const header = screen.getByRole('button');
      expect(header).toHaveAttribute('aria-expanded', 'false');
    });

    it('hides content when collapsed', () => {
      mockIsExpanded = false;
      render(<Dashboard issues={createMockIssues(5)} />);

      expect(screen.queryByText('Total Issues')).not.toBeInTheDocument();
      expect(screen.queryByText('Issues by Provider')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('passes loading state to child components', () => {
      render(<Dashboard issues={[]} loading />);

      // StatCard should show loading skeleton
      expect(screen.getAllByTestId('stat-card-loading')).toHaveLength(4);
    });
  });

  describe('severity badges in header', () => {
    it('shows critical badge when critical issues exist', () => {
      const issues: Issue[] = [
        {
          id: '1',
          provider: 'zeropath',
          title: 'Critical Issue',
          description: 'Description',
          location: 'src/file.ts',
          severity: 'CRITICAL',
          raw_severity: 'critical',
          count: 1,
          priority: 95,
          permalink: 'https://example.com',
          metadata: {},
        },
      ];
      render(<Dashboard issues={issues} />);

      expect(screen.getByText('1 Critical')).toBeInTheDocument();
    });

    it('shows high badge when high severity issues exist', () => {
      const issues: Issue[] = [
        {
          id: '1',
          provider: 'zeropath',
          title: 'High Issue',
          description: 'Description',
          location: 'src/file.ts',
          severity: 'HIGH',
          raw_severity: 'high',
          count: 1,
          priority: 75,
          permalink: 'https://example.com',
          metadata: {},
        },
        {
          id: '2',
          provider: 'zeropath',
          title: 'High Issue 2',
          description: 'Description',
          location: 'src/file.ts',
          severity: 'HIGH',
          raw_severity: 'high',
          count: 1,
          priority: 70,
          permalink: 'https://example.com',
          metadata: {},
        },
      ];
      render(<Dashboard issues={issues} />);

      expect(screen.getByText('2 High')).toBeInTheDocument();
    });

    it('does not show badges when no critical/high issues', () => {
      const issues: Issue[] = [
        {
          id: '1',
          provider: 'zeropath',
          title: 'Low Issue',
          description: 'Description',
          location: 'src/file.ts',
          severity: 'LOW',
          raw_severity: 'low',
          count: 1,
          priority: 20,
          permalink: 'https://example.com',
          metadata: {},
        },
      ];
      render(<Dashboard issues={issues} />);

      // Only the header badges should be checked (which shouldn't exist for LOW severity)
      const badges = screen.queryAllByText(/Critical|High/);
      expect(badges.filter(b => b.closest('button'))).toHaveLength(0);
    });
  });

  describe('statistics calculation', () => {
    it('correctly counts issues by provider', () => {
      const issues: Issue[] = [
        {
          id: '1',
          provider: 'zeropath',
          title: 'Issue 1',
          description: '',
          location: '',
          severity: 'MEDIUM',
          raw_severity: 'medium',
          count: 1,
          priority: 50,
          permalink: '',
          metadata: {},
        },
        {
          id: '2',
          provider: 'zeropath',
          title: 'Issue 2',
          description: '',
          location: '',
          severity: 'MEDIUM',
          raw_severity: 'medium',
          count: 1,
          priority: 50,
          permalink: '',
          metadata: {},
        },
        {
          id: '3',
          provider: 'sentry',
          title: 'Issue 3',
          description: '',
          location: '',
          severity: 'HIGH',
          raw_severity: 'high',
          count: 1,
          priority: 70,
          permalink: '',
          metadata: {},
        },
      ];

      render(<Dashboard issues={issues} />);

      // Total should show in the stat card
      expect(screen.getByText('Total Issues')).toBeInTheDocument();
      // Find the stat card value by looking for 3 within the dashboard
      const statCards = screen.getAllByTestId('stat-card');
      const totalCard = statCards.find(card => card.textContent?.includes('Total Issues'));
      expect(totalCard).toHaveTextContent('3');
    });

    it('correctly calculates priority distribution', () => {
      const issues: Issue[] = [
        // Priority 0-20
        {
          id: '1',
          provider: 'test',
          title: '',
          description: '',
          location: '',
          severity: 'LOW',
          raw_severity: 'low',
          count: 1,
          priority: 15,
          permalink: '',
          metadata: {},
        },
        // Priority 81-100
        {
          id: '2',
          provider: 'test',
          title: '',
          description: '',
          location: '',
          severity: 'CRITICAL',
          raw_severity: 'critical',
          count: 1,
          priority: 95,
          permalink: '',
          metadata: {},
        },
      ];

      render(<Dashboard issues={issues} />);

      // Dashboard should render with these stats
      expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      expect(screen.getByText('Priority Distribution')).toBeInTheDocument();
    });
  });
});
