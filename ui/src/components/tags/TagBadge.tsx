'use client';

import type { Tag } from '@/lib/types';

interface TagBadgeProps {
  tag: Tag;
  onClick?: () => void;
  onRemove?: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Displays a colored tag badge with optional remove button.
 *
 * @example
 * <TagBadge tag={{ id: '1', name: 'security', color: '#ef4444' }} />
 * <TagBadge tag={tag} onRemove={() => handleRemove(tag.id)} />
 */
export function TagBadge({
  tag,
  onClick,
  onRemove,
  size = 'sm',
  className = '',
}: TagBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
  };

  // Calculate text color based on background brightness
  const getTextColor = (bgColor: string) => {
    // Convert hex to RGB
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  const textColor = getTextColor(tag.color);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]} ${
        onClick ? 'cursor-pointer hover:opacity-80' : ''
      } ${className}`}
      style={{
        backgroundColor: tag.color,
        color: textColor,
      }}
      onClick={onClick}
    >
      {tag.name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full hover:bg-black/10 focus:outline-none"
          aria-label={`Remove tag ${tag.name}`}
        >
          <svg
            className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
}
