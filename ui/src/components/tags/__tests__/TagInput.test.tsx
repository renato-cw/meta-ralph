import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagInput } from '../TagInput';
import type { Tag } from '@/lib/types';

describe('TagInput', () => {
  const mockTags: Tag[] = [
    { id: 'tag-1', name: 'security', color: '#ef4444' },
    { id: 'tag-2', name: 'bug', color: '#3b82f6' },
    { id: 'tag-3', name: 'enhancement', color: '#22c55e' },
  ];

  const mockOnAddTag = jest.fn();
  const mockOnRemoveTag = jest.fn();
  const mockOnCreateTag = jest.fn((name: string, color: string) => ({
    id: `new-${Date.now()}`,
    name,
    color,
  }));

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render input field', () => {
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
      />
    );

    expect(screen.getByRole('textbox', { name: /add tag/i })).toBeInTheDocument();
  });

  it('should render placeholder when no tags selected', () => {
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
        placeholder="Add tags..."
      />
    );

    expect(screen.getByPlaceholderText('Add tags...')).toBeInTheDocument();
  });

  it('should render selected tags', () => {
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[mockTags[0]]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
      />
    );

    expect(screen.getByText('security')).toBeInTheDocument();
  });

  it('should show dropdown on focus', async () => {
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
      />
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });
  });

  it('should filter tags based on input', async () => {
    const user = userEvent.setup();
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
      />
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    await user.type(input, 'sec');

    await waitFor(() => {
      expect(screen.getByText('security')).toBeInTheDocument();
      expect(screen.queryByText('bug')).not.toBeInTheDocument();
    });
  });

  it('should exclude already selected tags from dropdown', async () => {
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[mockTags[0]]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
      />
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    fireEvent.focus(input);

    await waitFor(() => {
      const listbox = screen.getByRole('listbox');
      expect(listbox).toBeInTheDocument();
      // Should show bug and enhancement, but not security (already selected)
      expect(screen.getByRole('option', { name: /bug/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /enhancement/i })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /security/i })).not.toBeInTheDocument();
    });
  });

  it('should call onAddTag when tag is selected', async () => {
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
      />
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    fireEvent.focus(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    const option = screen.getByRole('option', { name: /security/i });
    fireEvent.click(option);

    expect(mockOnAddTag).toHaveBeenCalledWith(mockTags[0]);
  });

  it('should call onRemoveTag when remove button is clicked on selected tag', () => {
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[mockTags[0]]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
      />
    );

    const removeButton = screen.getByRole('button', { name: /remove tag security/i });
    fireEvent.click(removeButton);

    expect(mockOnRemoveTag).toHaveBeenCalledWith('tag-1');
  });

  it('should show create option when query does not match existing tag', async () => {
    const user = userEvent.setup();
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
        onCreateTag={mockOnCreateTag}
      />
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    await user.type(input, 'newtagname');

    await waitFor(() => {
      expect(screen.getByText(/create "newtagname"/i)).toBeInTheDocument();
    });
  });

  it('should navigate dropdown with arrow keys', async () => {
    const user = userEvent.setup();
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
      />
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    await user.keyboard('{ArrowDown}');

    const options = screen.getAllByRole('option');
    expect(options[1]).toHaveClass('bg-blue-50');
  });

  it('should select tag with Enter key', async () => {
    const user = userEvent.setup();
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
      />
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    await user.keyboard('{Enter}');

    expect(mockOnAddTag).toHaveBeenCalledWith(mockTags[0]);
  });

  it('should close dropdown with Escape key', async () => {
    const user = userEvent.setup();
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
      />
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  it('should remove last selected tag with Backspace when input is empty', async () => {
    const user = userEvent.setup();
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[mockTags[0], mockTags[1]]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
      />
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(mockOnRemoveTag).toHaveBeenCalledWith('tag-2'); // Last selected tag
  });

  it('should be disabled when disabled prop is true', () => {
    render(
      <TagInput
        availableTags={mockTags}
        selectedTags={[]}
        onAddTag={mockOnAddTag}
        onRemoveTag={mockOnRemoveTag}
        disabled
      />
    );

    const input = screen.getByRole('textbox', { name: /add tag/i });
    expect(input).toBeDisabled();
  });
});
