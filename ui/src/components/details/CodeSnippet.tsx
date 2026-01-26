'use client';

import { useState } from 'react';

interface CodeSnippetProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
}

/**
 * Code snippet display with copy functionality.
 * Basic syntax highlighting based on common patterns.
 */
export function CodeSnippet({
  code,
  language,
  showLineNumbers = true,
  className = '',
}: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const lines = code.split('\n');

  return (
    <div className={`relative group ${className}`}>
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-[var(--card)] border border-[var(--border)] rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--border)]"
      >
        {copied ? (
          <span className="flex items-center gap-1 text-[var(--success)]">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Copied
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </span>
        )}
      </button>

      {/* Language badge */}
      {language && (
        <div className="absolute top-2 left-2 px-2 py-0.5 text-xs bg-[var(--border)] rounded">
          {language}
        </div>
      )}

      {/* Code block */}
      <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden">
        <div className="overflow-x-auto">
          <pre className="p-4 text-sm font-mono">
            <code>
              {lines.map((line, index) => (
                <div key={index} className="flex">
                  {showLineNumbers && (
                    <span className="select-none text-[var(--muted)] w-8 text-right pr-4 shrink-0">
                      {index + 1}
                    </span>
                  )}
                  <span className="flex-1 whitespace-pre-wrap break-all">{line}</span>
                </div>
              ))}
            </code>
          </pre>
        </div>
      </div>
    </div>
  );
}
