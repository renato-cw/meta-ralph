import { render, screen } from '@testing-library/react';
import { TopFilesTable } from '../TopFilesTable';

describe('TopFilesTable', () => {
  const mockData = [
    { file: 'src/lib/utils.ts', count: 15 },
    { file: 'src/components/App.tsx', count: 10 },
    { file: 'src/api/routes.ts', count: 8 },
    { file: 'src/hooks/useData.ts', count: 5 },
    { file: 'src/types/index.ts', count: 3 },
  ];

  describe('rendering', () => {
    it('renders all files with their counts', () => {
      render(<TopFilesTable data={mockData} />);

      expect(screen.getByTestId('top-files-table')).toBeInTheDocument();
      expect(screen.getByText('src/lib/utils.ts')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('src/components/App.tsx')).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });

    it('renders numbered list', () => {
      render(<TopFilesTable data={mockData} />);

      expect(screen.getByText('1.')).toBeInTheDocument();
      expect(screen.getByText('2.')).toBeInTheDocument();
      expect(screen.getByText('3.')).toBeInTheDocument();
      expect(screen.getByText('4.')).toBeInTheDocument();
      expect(screen.getByText('5.')).toBeInTheDocument();
    });

    it('respects maxItems prop', () => {
      render(<TopFilesTable data={mockData} maxItems={3} />);

      expect(screen.getByText('src/lib/utils.ts')).toBeInTheDocument();
      expect(screen.getByText('src/components/App.tsx')).toBeInTheDocument();
      expect(screen.getByText('src/api/routes.ts')).toBeInTheDocument();
      expect(screen.queryByText('src/hooks/useData.ts')).not.toBeInTheDocument();
      expect(screen.queryByText('src/types/index.ts')).not.toBeInTheDocument();
    });

    it('defaults to 5 items when maxItems not provided', () => {
      const largeData = [
        ...mockData,
        { file: 'extra1.ts', count: 2 },
        { file: 'extra2.ts', count: 1 },
      ];
      render(<TopFilesTable data={largeData} />);

      expect(screen.getByText('src/lib/utils.ts')).toBeInTheDocument();
      expect(screen.getByText('src/types/index.ts')).toBeInTheDocument();
      expect(screen.queryByText('extra1.ts')).not.toBeInTheDocument();
      expect(screen.queryByText('extra2.ts')).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('renders empty message when no data', () => {
      render(<TopFilesTable data={[]} />);

      expect(screen.getByTestId('top-files-table-empty')).toBeInTheDocument();
      expect(screen.getByText('No files with issues')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('renders loading skeleton when loading', () => {
      render(<TopFilesTable data={mockData} loading />);

      expect(screen.getByTestId('top-files-table-loading')).toBeInTheDocument();
      expect(screen.queryByText('src/lib/utils.ts')).not.toBeInTheDocument();
    });

    it('renders correct number of skeleton items based on maxItems', () => {
      render(<TopFilesTable data={[]} loading maxItems={3} />);

      const loadingContainer = screen.getByTestId('top-files-table-loading');
      // Should have 3 skeleton items
      expect(loadingContainer.children).toHaveLength(3);
    });
  });

  describe('file path display', () => {
    it('shows full file path', () => {
      const longPath = [
        { file: 'src/very/long/nested/path/to/file.ts', count: 5 },
      ];
      render(<TopFilesTable data={longPath} />);

      expect(
        screen.getByText('src/very/long/nested/path/to/file.ts')
      ).toBeInTheDocument();
    });

    it('sets title attribute for truncated paths', () => {
      const longPath = [
        { file: 'src/very/long/nested/path/to/file.ts', count: 5 },
      ];
      render(<TopFilesTable data={longPath} />);

      const fileElement = screen.getByText(
        'src/very/long/nested/path/to/file.ts'
      );
      expect(fileElement).toHaveAttribute(
        'title',
        'src/very/long/nested/path/to/file.ts'
      );
    });
  });
});
