'use client';

interface ProcessButtonProps {
  selectedCount: number;
  isProcessing: boolean;
  onProcess: () => void;
}

export function ProcessButton({
  selectedCount,
  isProcessing,
  onProcess,
}: ProcessButtonProps) {
  const disabled = selectedCount === 0 || isProcessing;

  return (
    <button
      onClick={onProcess}
      disabled={disabled}
      className={`
        px-6 py-3 rounded-lg font-medium text-white transition-all
        ${disabled
          ? 'bg-[var(--muted)] cursor-not-allowed opacity-50'
          : 'bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer'
        }
      `}
    >
      {isProcessing ? (
        <span className="flex items-center gap-2">
          <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
          Processing...
        </span>
      ) : (
        `Process ${selectedCount} Issue${selectedCount !== 1 ? 's' : ''}`
      )}
    </button>
  );
}
