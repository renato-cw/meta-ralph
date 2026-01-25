import { render, screen, fireEvent } from '@testing-library/react';
import { TagBadge } from '../TagBadge';
import type { Tag } from '@/lib/types';

describe('TagBadge', () => {
  const mockTag: Tag = {
    id: 'tag-1',
    name: 'security',
    color: '#ef4444',
  };

  it('should render tag name', () => {
    render(<TagBadge tag={mockTag} />);

    expect(screen.getByText('security')).toBeInTheDocument();
  });

  it('should apply tag color as background', () => {
    render(<TagBadge tag={mockTag} />);

    const badge = screen.getByText('security').closest('span');
    expect(badge).toHaveStyle({ backgroundColor: '#ef4444' });
  });

  it('should render in small size by default', () => {
    render(<TagBadge tag={mockTag} />);

    const badge = screen.getByText('security').closest('span');
    expect(badge).toHaveClass('text-xs');
  });

  it('should render in medium size when specified', () => {
    render(<TagBadge tag={mockTag} size="md" />);

    const badge = screen.getByText('security').closest('span');
    expect(badge).toHaveClass('text-sm');
  });

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<TagBadge tag={mockTag} onClick={handleClick} />);

    fireEvent.click(screen.getByText('security'));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should render remove button when onRemove is provided', () => {
    const handleRemove = jest.fn();
    render(<TagBadge tag={mockTag} onRemove={handleRemove} />);

    const removeButton = screen.getByRole('button', { name: /remove tag security/i });
    expect(removeButton).toBeInTheDocument();
  });

  it('should not render remove button when onRemove is not provided', () => {
    render(<TagBadge tag={mockTag} />);

    const removeButton = screen.queryByRole('button', { name: /remove tag/i });
    expect(removeButton).not.toBeInTheDocument();
  });

  it('should call onRemove when remove button is clicked', () => {
    const handleRemove = jest.fn();
    render(<TagBadge tag={mockTag} onRemove={handleRemove} />);

    const removeButton = screen.getByRole('button', { name: /remove tag security/i });
    fireEvent.click(removeButton);

    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it('should stop propagation when remove button is clicked', () => {
    const handleClick = jest.fn();
    const handleRemove = jest.fn();
    render(<TagBadge tag={mockTag} onClick={handleClick} onRemove={handleRemove} />);

    const removeButton = screen.getByRole('button', { name: /remove tag security/i });
    fireEvent.click(removeButton);

    expect(handleRemove).toHaveBeenCalledTimes(1);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<TagBadge tag={mockTag} className="custom-class" />);

    const badge = screen.getByText('security').closest('span');
    expect(badge).toHaveClass('custom-class');
  });

  describe('text color contrast', () => {
    it('should use white text on dark background', () => {
      const darkTag = { ...mockTag, color: '#1f2937' }; // Dark gray
      render(<TagBadge tag={darkTag} />);

      const badge = screen.getByText('security').closest('span');
      expect(badge).toHaveStyle({ color: '#ffffff' });
    });

    it('should use black text on light background', () => {
      const lightTag = { ...mockTag, color: '#fef9c3' }; // Light yellow
      render(<TagBadge tag={lightTag} />);

      const badge = screen.getByText('security').closest('span');
      expect(badge).toHaveStyle({ color: '#000000' });
    });
  });
});
