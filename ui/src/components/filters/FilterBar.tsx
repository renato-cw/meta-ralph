'use client';

import { useState } from 'react';
import type { FilterState, Severity, IssueStatus } from '@/lib/types';
import { FilterChip } from './FilterChip';
import { FilterPreset } from './FilterPreset';
import { RangeSlider } from './RangeSlider';

interface FilterBarProps {
  filters: FilterState;
  availableProviders: string[];
  availableTags?: string[];
  onFilterChange: (updates: Partial<FilterState>) => void;
  onClearFilters: () => void;
  onToggleProvider: (provider: string) => void;
  onToggleSeverity: (severity: Severity) => void;
  onToggleStatus?: (status: IssueStatus) => void;
  onToggleTag?: (tag: string) => void;
  onPriorityRangeChange: (min: number, max: number) => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  /** Controlled expanded state (optional) */
  expanded?: boolean;
  /** Callback when expand state changes (optional, for controlled mode) */
  onToggleExpanded?: () => void;
  className?: string;
}

const SEVERITIES: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];
const STATUSES: IssueStatus[] = ['pending', 'processing', 'completed', 'failed', 'ignored'];

const SEVERITY_COLORS: Record<Severity, string> = {
  CRITICAL: 'bg-red-900/50 text-red-300 border-red-700',
  HIGH: 'bg-orange-900/50 text-orange-300 border-orange-700',
  MEDIUM: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  LOW: 'bg-green-900/50 text-green-300 border-green-700',
  INFO: 'bg-blue-900/50 text-blue-300 border-blue-700',
};

const STATUS_COLORS: Record<IssueStatus, string> = {
  pending: 'bg-gray-900/50 text-gray-300 border-gray-700',
  processing: 'bg-blue-900/50 text-blue-300 border-blue-700',
  completed: 'bg-green-900/50 text-green-300 border-green-700',
  failed: 'bg-red-900/50 text-red-300 border-red-700',
  ignored: 'bg-zinc-900/50 text-zinc-400 border-zinc-700',
};

/**
 * Collapsible filter bar with multi-select filters, range sliders, and presets.
 */
export function FilterBar({
  filters,
  availableProviders,
  availableTags = [],
  onFilterChange,
  onClearFilters,
  onToggleProvider,
  onToggleSeverity,
  onToggleStatus,
  onToggleTag,
  onPriorityRangeChange,
  hasActiveFilters,
  activeFilterCount,
  expanded,
  onToggleExpanded,
  className = '',
}: FilterBarProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);

  // Support both controlled and uncontrolled modes
  const isExpanded = expanded !== undefined ? expanded : internalExpanded;
  const handleToggleExpanded = onToggleExpanded || (() => setInternalExpanded((prev) => !prev));

  return (
    <div className={`border border-[var(--border)] rounded-lg bg-[var(--card)] ${className}`}>
      {/* Filter bar header - always visible */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={handleToggleExpanded}
          className="flex items-center gap-2 text-sm hover:text-[var(--primary)] transition-colors"
        >
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          <span className="font-medium">Filters</span>
          {activeFilterCount > 0 && (
            <span className="px-2 py-0.5 text-xs bg-[var(--primary)] text-white rounded-full">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Active filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          {filters.providers.map((provider) => (
            <FilterChip
              key={provider}
              label={provider}
              onRemove={() => onToggleProvider(provider)}
            />
          ))}
          {filters.severities.map((severity) => (
            <FilterChip
              key={severity}
              label={severity}
              className={SEVERITY_COLORS[severity]}
              onRemove={() => onToggleSeverity(severity)}
            />
          ))}
          {(filters.priorityRange[0] !== 0 || filters.priorityRange[1] !== 100) && (
            <FilterChip
              label={`Priority: ${filters.priorityRange[0]}-${filters.priorityRange[1]}`}
              onRemove={() => onPriorityRangeChange(0, 100)}
            />
          )}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-xs text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* Expandable filter panel */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-4 space-y-4">
          {/* Quick filter presets */}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-2">Quick Filters</label>
            <div className="flex flex-wrap gap-2">
              <FilterPreset
                label="Critical Only"
                isActive={filters.severities.length === 1 && filters.severities[0] === 'CRITICAL'}
                onClick={() => {
                  onFilterChange({
                    severities: filters.severities.length === 1 && filters.severities[0] === 'CRITICAL'
                      ? []
                      : ['CRITICAL'],
                  });
                }}
              />
              <FilterPreset
                label="Security (High Priority)"
                isActive={filters.priorityRange[0] >= 80}
                onClick={() => {
                  onPriorityRangeChange(
                    filters.priorityRange[0] >= 80 ? 0 : 80,
                    100
                  );
                }}
              />
              <FilterPreset
                label="High Volume (100+)"
                isActive={filters.countRange.min !== null && filters.countRange.min >= 100}
                onClick={() => {
                  onFilterChange({
                    countRange: {
                      min: filters.countRange.min !== null && filters.countRange.min >= 100 ? null : 100,
                      max: null,
                    },
                  });
                }}
              />
            </div>
          </div>

          {/* Provider filter */}
          {availableProviders.length > 0 && (
            <div>
              <label className="block text-xs text-[var(--muted)] mb-2">Provider</label>
              <div className="flex flex-wrap gap-2">
                {availableProviders.map((provider) => (
                  <button
                    key={provider}
                    onClick={() => onToggleProvider(provider)}
                    className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                      filters.providers.includes(provider)
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                        : 'border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                    }`}
                  >
                    {provider}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Severity filter */}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-2">Severity</label>
            <div className="flex flex-wrap gap-2">
              {SEVERITIES.map((severity) => (
                <button
                  key={severity}
                  onClick={() => onToggleSeverity(severity)}
                  className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                    filters.severities.includes(severity)
                      ? SEVERITY_COLORS[severity]
                      : 'border-[var(--border)] hover:border-[var(--muted)]'
                  }`}
                >
                  {severity}
                </button>
              ))}
            </div>
          </div>

          {/* Priority range */}
          <div>
            <label className="block text-xs text-[var(--muted)] mb-2">
              Priority Range: {filters.priorityRange[0]} - {filters.priorityRange[1]}
            </label>
            <RangeSlider
              min={0}
              max={100}
              value={filters.priorityRange}
              onChange={(range) => onPriorityRangeChange(range[0], range[1])}
            />
          </div>

          {/* Status filter */}
          {onToggleStatus && (
            <div>
              <label className="block text-xs text-[var(--muted)] mb-2">Status</label>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((status) => (
                  <button
                    key={status}
                    onClick={() => onToggleStatus(status)}
                    className={`px-3 py-1.5 text-sm border rounded-lg transition-colors capitalize ${
                      filters.status.includes(status)
                        ? STATUS_COLORS[status]
                        : 'border-[var(--border)] hover:border-[var(--muted)]'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags filter */}
          {availableTags.length > 0 && onToggleTag && (
            <div>
              <label className="block text-xs text-[var(--muted)] mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => onToggleTag(tag)}
                    className={`px-3 py-1.5 text-sm border rounded-lg transition-colors ${
                      filters.tags.includes(tag)
                        ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                        : 'border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
