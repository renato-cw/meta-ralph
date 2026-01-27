'use client';

interface OptionsToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  indent?: boolean;
}

/**
 * Toggle switch for boolean processing options.
 */
export function OptionsToggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  indent = false,
}: OptionsToggleProps) {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div
      className={`
        flex items-start gap-3 py-2
        ${indent ? 'ml-6 pl-3 border-l-2 border-[var(--border)]' : ''}
      `}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleToggle}
        className={`
          relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${checked ? 'bg-[var(--primary)]' : 'bg-[var(--border)]'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform
            ${checked ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </button>
      <div className="flex-1">
        <span
          className={`
            text-sm font-medium cursor-pointer
            ${disabled ? 'text-[var(--muted)]' : 'text-[var(--foreground)]'}
          `}
          onClick={handleToggle}
        >
          {label}
        </span>
        {description && (
          <p className="text-xs text-[var(--muted)] mt-0.5">{description}</p>
        )}
      </div>
    </div>
  );
}
