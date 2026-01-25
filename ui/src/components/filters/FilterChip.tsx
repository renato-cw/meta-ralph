'use client';

interface FilterChipProps {
  label: string;
  onRemove: () => void;
  className?: string;
}

/**
 * Small badge showing an active filter with remove button.
 */
export function FilterChip({ label, onRemove, className = '' }: FilterChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full border ${
        className || 'bg-[var(--card)] border-[var(--border)]'
      }`}
    >
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="p-0.5 hover:bg-black/20 rounded-full transition-colors"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
