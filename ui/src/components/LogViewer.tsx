'use client';

import { useEffect, useRef } from 'react';

interface LogViewerProps {
  logs: string[];
  isVisible: boolean;
}

export function LogViewer({ logs, isVisible }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  if (!isVisible) return null;

  return (
    <div className="mt-6 border border-[var(--border)] rounded-lg overflow-hidden">
      <div className="bg-[var(--card)] px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <span className="font-medium">Processing Logs</span>
        <span className="text-sm text-[var(--muted)]">{logs.length} lines</span>
      </div>
      <div
        ref={containerRef}
        className="bg-black p-4 h-80 overflow-y-auto font-mono text-sm"
      >
        {logs.length === 0 ? (
          <span className="text-[var(--muted)]">Waiting for output...</span>
        ) : (
          logs.map((log, i) => (
            <div
              key={i}
              className={`whitespace-pre-wrap break-all ${
                log.includes('[error]') || log.includes('Error')
                  ? 'text-red-400'
                  : log.includes('[stderr]')
                  ? 'text-yellow-400'
                  : log.includes('success') || log.includes('complete')
                  ? 'text-green-400'
                  : 'text-gray-300'
              }`}
            >
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
