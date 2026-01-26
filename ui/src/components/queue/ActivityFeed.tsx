'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Activity, ExecutionMetrics } from '@/lib/types';
import { ActivityItem } from './ActivityItem';
import { MetricsDisplay } from './MetricsDisplay';

/**
 * Props for the ActivityFeed component.
 */
export interface ActivityFeedProps {
  activities: Activity[];
  metrics: ExecutionMetrics | null;
  isProcessing: boolean;
  maxHeight?: string;
}

/**
 * ActivityFeed displays real-time activities during processing.
 * Shows tool usage, messages, and execution metrics with auto-scroll.
 */
export function ActivityFeed({
  activities,
  metrics,
  isProcessing,
  maxHeight = 'h-64',
}: ActivityFeedProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  // Track scroll position to determine if user has scrolled up
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    // Consider "at bottom" if within 50px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // Auto-scroll to bottom when new activities arrive (if autoScroll is enabled)
  useEffect(() => {
    if (autoScroll && bottomRef.current && isExpanded) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activities, autoScroll, isExpanded]);

  // Scroll to bottom button
  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      setAutoScroll(true);
    }
  }, []);

  return (
    <div className="space-y-3" data-testid="activity-feed">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-gray-200 hover:text-white transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Activity Feed
          {activities.length > 0 && (
            <span className="text-xs text-gray-500">({activities.length})</span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {isProcessing && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              streaming
            </span>
          )}
          {!autoScroll && isExpanded && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              ↓ Scroll to bottom
            </button>
          )}
        </div>
      </div>

      {/* Metrics Display */}
      <MetricsDisplay metrics={metrics} isProcessing={isProcessing} />

      {/* Activities List */}
      {isExpanded && (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className={`${maxHeight} overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent`}
        >
          {activities.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
              {isProcessing ? 'Waiting for activities...' : 'No activities yet'}
            </div>
          ) : (
            <>
              {activities.map((activity, index) => (
                <ActivityItem
                  key={activity.id}
                  activity={activity}
                  isLast={index === activities.length - 1 && isProcessing}
                />
              ))}
            </>
          )}
          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Collapsed summary */}
      {!isExpanded && activities.length > 0 && (
        <div className="text-xs text-gray-500 px-2">
          {activities.length} activities • Last:{' '}
          {activities[activities.length - 1]?.details?.slice(0, 50) || 'N/A'}
        </div>
      )}
    </div>
  );
}
