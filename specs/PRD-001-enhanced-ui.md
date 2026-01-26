# PRD-001: Enhanced UI for Issue Selection

## Executive Summary

Expand the existing Meta-Ralph Next.js UI with comprehensive filtering, grouping, search, and bulk action capabilities to enable power users to efficiently manage large issue queues from multiple providers.

## Background

The current UI provides basic issue display with checkboxes, select all/deselect all, and real-time log viewing. This PRD extends functionality to support advanced workflows for teams managing hundreds of issues across providers.

### Current State
- **Framework**: Next.js 15.1.0 + React 19.0.0
- **Features**: Issue table with checkboxes, real-time log viewer, basic selection
- **Components**: `IssueTable`, `IssueRow`, `ProcessButton`, `LogViewer`
- **API**: GET/POST `/api/issues` for fetch and process

## Goals

1. Enable efficient issue discovery through advanced filtering and search
2. Support bulk operations for high-volume workflows
3. Provide analytics and insights via dashboard
4. Improve user experience with keyboard shortcuts and saved views
5. Maintain compatibility with existing CLI workflow

## Non-Goals

- Mobile-first design (desktop power user focus)
- Offline support
- Multi-user collaboration features (single user dashboard)
- Real-time collaborative editing

---

## Feature Specifications

### 1. Advanced Filtering System
**Priority: P0**

#### 1.1 Filter Types

| Filter | Type | Values |
|--------|------|--------|
| Provider | Multi-select | zeropath, sentry, codecov, github, jira |
| Severity | Multi-select | CRITICAL, HIGH, MEDIUM, LOW, INFO |
| Priority Range | Range slider | 0-100 |
| Date Range | Date picker | First seen, Last seen |
| Count Range | Number inputs | Min/Max occurrences |
| Status | Multi-select | New, In Progress, Completed, Failed, Ignored |
| Tags | Multi-select | User-defined labels |

#### 1.2 Filter UI Components

```
ui/src/components/filters/
├── FilterBar.tsx           # Collapsible filter panel below header
├── FilterChip.tsx          # Active filter badges with remove button
├── FilterPreset.tsx        # Quick filter buttons (Critical Only, Security Only)
├── RangeSlider.tsx         # Dual-handle range input
├── DateRangePicker.tsx     # Date range selection
└── index.ts                # Exports
```

#### 1.3 State Management

```typescript
interface FilterState {
  providers: string[];
  severities: Severity[];
  priorityRange: [number, number];
  dateRange: { start: Date | null; end: Date | null };
  countRange: { min: number | null; max: number | null };
  status: ProcessingStatus[];
  tags: string[];
}
```

#### 1.4 Implementation Details

- Client-side filtering for instant feedback
- URL query param sync for shareable filtered views
- Debounced filter changes (300ms)
- Filter presets: "Critical Only", "Security Issues", "High Volume", "Recent"

---

### 2. Grouping & Categorization Views
**Priority: P0**

#### 2.1 Group By Options

| Option | Description |
|--------|-------------|
| Provider | Sections per provider (Zeropath, Sentry, etc.) |
| Severity | Collapsible sections by severity level |
| Date | Today, This Week, This Month, Older |
| Location | Group by file path or directory |
| None | Flat table view (default) |

#### 2.2 Components

```
ui/src/components/views/
├── GroupedView.tsx         # Container for grouped sections
├── GroupHeader.tsx         # Collapsible header with count badge
├── ViewToggle.tsx          # Switch between table/grouped/kanban
└── index.ts
```

#### 2.3 Collapse State

- Store collapsed groups in localStorage
- Default: all groups expanded
- Keyboard shortcuts: `c` collapse all, `e` expand all
- Individual group toggle on click

---

### 3. Search Functionality
**Priority: P0**

#### 3.1 Search Scope

| Field | Match Type |
|-------|------------|
| Title | Full-text, case-insensitive |
| Description | Full-text, case-insensitive |
| ID | Exact match |
| Location/File | Partial match, path-aware |

#### 3.2 Components

```
ui/src/components/search/
├── SearchBar.tsx           # Input with clear button and scope selector
├── SearchHighlight.tsx     # Highlight matching text in results
└── index.ts
```

#### 3.3 Features

- Instant search as you type (debounced 200ms)
- Highlight matching terms in results
- Search history (last 10 searches)
- Keyboard shortcut: `/` to focus search

---

### 4. Sorting Options
**Priority: P1**

#### 4.1 Sort Fields

| Field | Default Direction |
|-------|-------------------|
| Priority | Descending |
| Severity | Descending (CRITICAL first) |
| Count | Descending |
| Date (First Seen) | Descending (newest first) |
| Date (Last Seen) | Descending |
| Title | Ascending (A-Z) |
| Provider | Ascending |

#### 4.2 Implementation

- Clickable table headers with sort indicators
- Multi-level sort (shift+click for secondary sort)
- Persist sort preference in localStorage
- URL param: `?sort=priority&dir=desc`

---

### 5. Bulk Actions
**Priority: P0**

#### 5.1 Available Actions

| Action | Description | Confirmation |
|--------|-------------|--------------|
| Select by Filter | Select all issues matching current filter | No |
| Process Selected | Start processing (existing) | No |
| Export Selected | Download as CSV/JSON | No |
| Set Priority | Override priority for selected | No |
| Add Tags | Apply labels to selected | No |
| Remove Tags | Remove labels from selected | No |
| Ignore | Soft delete / hide from queue | Yes |
| Restore | Unhide ignored issues | No |

#### 5.2 Components

```
ui/src/components/actions/
├── BulkActionBar.tsx       # Sticky bar when items selected
├── ActionConfirmDialog.tsx # Confirmation modal for destructive actions
├── ExportDialog.tsx        # Format and field selection for export
└── index.ts
```

#### 5.3 API Endpoints

```typescript
// POST /api/issues/bulk
interface BulkActionRequest {
  action: 'export' | 'tag' | 'untag' | 'priority' | 'ignore' | 'restore';
  ids: string[];
  payload?: {
    tags?: string[];
    priority?: number;
    format?: 'csv' | 'json';
  };
}
```

---

### 6. Issue Preview/Details Panel
**Priority: P1**

#### 6.1 Panel Layout

- Slide-out panel from right (40% width, max 600px)
- Full issue details with metadata
- Provider-specific information display
- Quick actions (Process, View in Provider, Copy ID)

#### 6.2 Components

```
ui/src/components/details/
├── IssueDetailPanel.tsx    # Slide-out container with animation
├── IssueMetadata.tsx       # Provider-specific metadata display
├── CodeSnippet.tsx         # Syntax-highlighted code preview
├── ActionButtons.tsx       # Quick action buttons
└── index.ts
```

#### 6.3 Information Displayed

| Section | Content |
|---------|---------|
| Header | Title, ID, Provider badge, Severity badge |
| Metrics | Priority score, Count, First/Last seen |
| Description | Full description text |
| Location | File path with link to source |
| Metadata | Provider-specific data (stack traces, vuln class, etc.) |
| Actions | Process, View Original, Copy Link, Add Tags |

#### 6.4 Interaction

- Click row to open panel
- Keyboard: `Space` to toggle, `Escape` to close
- Arrow keys to navigate while panel open
- Panel persists during navigation

---

### 7. Keyboard Shortcuts
**Priority: P1**

#### 7.1 Shortcut Map

| Key | Action |
|-----|--------|
| `j` / `↓` | Navigate down |
| `k` / `↑` | Navigate up |
| `x` | Toggle selection on focused row |
| `Space` | Open/close detail panel |
| `Enter` | Process selected issues |
| `Escape` | Close panel / Clear selection |
| `/` | Focus search bar |
| `?` | Show shortcuts help modal |
| `Ctrl+A` / `Cmd+A` | Select all (filtered) |
| `Ctrl+Shift+A` | Deselect all |
| `f` | Focus filter bar |
| `r` | Refresh issues |
| `c` | Collapse all groups |
| `e` | Expand all groups |
| `1-5` | Quick filter by severity |
| `g p` | Go to provider filter |

#### 7.2 Components

```
ui/src/components/common/
├── KeyboardShortcuts.tsx   # Event listener wrapper
├── ShortcutsModal.tsx      # Help dialog with all shortcuts
└── index.ts
```

---

### 8. Saved Filters/Views
**Priority: P2**

#### 8.1 Features

- Save current filter + sort + grouping as named view
- Quick access dropdown in header
- Local storage persistence
- Set default view
- Share view via URL

#### 8.2 Components

```
ui/src/components/views/
├── SavedViews.tsx          # Dropdown with saved views
├── SaveViewDialog.tsx      # Name and save modal
└── ViewManager.tsx         # List/edit/delete saved views
```

#### 8.3 Data Structure

```typescript
interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  sort: SortState;
  groupBy: GroupByOption | null;
  isDefault: boolean;
  createdAt: string;
}
```

---

### 9. Dashboard with Statistics
**Priority: P1**

#### 9.1 Metrics

| Metric | Visualization |
|--------|---------------|
| Total issues by provider | Pie chart |
| Issues by severity | Horizontal bar chart |
| Priority distribution | Histogram |
| Processing success rate | Percentage card |
| Issues over time | Line chart (7d/30d/90d) |
| Top 5 files by issues | Table |

#### 9.2 Components

```
ui/src/components/dashboard/
├── Dashboard.tsx           # Main dashboard page/section
├── StatCard.tsx            # Individual metric card
├── MiniChart.tsx           # Compact inline charts
├── ProviderPieChart.tsx    # Issues by provider
├── SeverityBarChart.tsx    # Issues by severity
└── index.ts
```

#### 9.3 Implementation

- Use Recharts library (lightweight, React-native)
- Dashboard as collapsible section above table
- Toggle: show/hide dashboard
- Real-time updates when data changes

---

### 10. Theme Toggle (Dark/Light)
**Priority: P2**

#### 10.1 Implementation

- Extend existing CSS variables in `globals.css`
- Add light theme color palette
- Persist preference in localStorage
- System preference detection with `prefers-color-scheme`

#### 10.2 Color Schemes

**Dark Theme (Current)**
```css
--background: #0a0a0a;
--foreground: #ededed;
--card: #18181b;
--border: #27272a;
```

**Light Theme**
```css
--background: #ffffff;
--foreground: #171717;
--card: #f4f4f5;
--border: #e4e4e7;
```

---

### 11. Processing Queue Visualization
**Priority: P1**

#### 11.1 Features

- Visual queue showing processing order
- Current issue highlight with spinner
- Progress indicator (X of Y completed)
- Estimated time remaining (based on avg processing time)
- Cancel button for pending items
- Pause/resume queue

#### 11.2 Components

```
ui/src/components/queue/
├── ProcessingQueue.tsx     # Queue visualization sidebar
├── QueueItem.tsx           # Individual item in queue
├── QueueProgress.tsx       # Overall progress bar
└── index.ts
```

---

### 12. History of Processed Issues
**Priority: P2**

#### 12.1 Features

- List of past processing attempts
- Success/failure status with timestamps
- PR links for successful fixes
- Retry capability for failed issues
- Filter by date range and status

#### 12.2 Data Source

- Parse `.ralph-logs/` directory
- Read progress.txt and PRD.md files
- Extract PR URLs from git history

---

### 13. Pagination & Virtualization
**Priority: P1**

#### 13.1 Options

- Virtualized list for 100+ items (scroll performance)
- Page size selector: 25, 50, 100, All
- Keyboard navigation works across pages
- "Load more" button option

#### 13.2 Implementation

- Use `@tanstack/react-virtual` for virtualization
- Virtual window size: 50 items visible
- Smooth scrolling with overscan

---

### 14. Export Functionality
**Priority: P1**

#### 14.1 Formats

| Format | Content |
|--------|---------|
| CSV | Configurable columns, default: id, provider, title, severity, priority |
| JSON | Full issue objects with metadata |

#### 14.2 Options

- Export all issues or selected only
- Include/exclude specific fields
- Client-side generation (no server round-trip)
- Filename: `meta-ralph-issues-{date}.{format}`

---

### 15. Real-time Updates
**Priority: P2**

#### 15.1 Events

| Event | Action |
|-------|--------|
| New issues from providers | Add to list, show notification |
| Processing status update | Update status badge, log viewer |
| Processing complete | Show success/failure toast |

#### 15.2 Implementation

- Server-Sent Events (SSE) for push updates
- Fallback to polling (current behavior)
- Endpoint: `GET /api/issues/stream`

---

### 16. Issue Tagging/Labeling
**Priority: P2**

#### 16.1 Features

- User-defined tags with custom colors
- Multiple tags per issue
- Filter by tags
- Bulk tag assignment
- Tag autocomplete

#### 16.2 Components

```
ui/src/components/tags/
├── TagInput.tsx            # Autocomplete tag input
├── TagBadge.tsx            # Colored tag display
├── TagManager.tsx          # CRUD for tags
└── index.ts
```

#### 16.3 Storage

- Tags stored in localStorage initially
- Future: backend persistence

---

### 17. Drag-and-Drop Reordering
**Priority: P3**

#### 17.1 Features

- Manual priority override via drag
- Visual drag handles on rows
- Drop zones with visual feedback
- Persist order in session

#### 17.2 Implementation

- Use `@dnd-kit/core` library
- Accessible drag-and-drop

---

### 18. Undo/Redo for Selections
**Priority: P3**

#### 18.1 Implementation

- Selection history stack (last 10 states)
- Keyboard: `Ctrl+Z` undo, `Ctrl+Shift+Z` redo
- Undo toast with "Redo" button

---

## Technical Architecture

### New Dependencies

```json
{
  "dependencies": {
    "recharts": "^2.12.0",
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@tanstack/react-virtual": "^3.5.0",
    "date-fns": "^3.3.0"
  }
}
```

### Extended Types

```typescript
// lib/types.ts

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type IssueStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'ignored';

export interface ExtendedIssue extends Issue {
  tags: string[];
  status: IssueStatus;
  processedAt?: string;
  prUrl?: string;
}

export interface FilterState {
  providers: string[];
  severities: Severity[];
  priorityRange: [number, number];
  dateRange: { start: string | null; end: string | null };
  countRange: { min: number | null; max: number | null };
  status: IssueStatus[];
  tags: string[];
  search: string;
}

export interface SortState {
  field: 'priority' | 'severity' | 'count' | 'date' | 'title' | 'provider';
  direction: 'asc' | 'desc';
}

export interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  sort: SortState;
  groupBy: 'provider' | 'severity' | 'date' | 'location' | null;
  isDefault: boolean;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface QueueItem {
  issueId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  prUrl?: string;
  error?: string;
}
```

### New Hooks

```
ui/src/hooks/
├── useFilters.ts           # Filter state management
├── useSearch.ts            # Search with debouncing
├── useSort.ts              # Sorting logic
├── useKeyboardShortcuts.ts # Keyboard event handling
├── useSavedViews.ts        # Saved views CRUD
├── useLocalStorage.ts      # Typed localStorage hook
├── useVirtualList.ts       # Virtualization wrapper
└── useSSE.ts               # Server-Sent Events connection
```

### File Structure

```
ui/src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Refactor to use new components
│   ├── globals.css                 # Add light theme variables
│   ├── dashboard/
│   │   └── page.tsx                # Standalone dashboard page
│   └── api/
│       └── issues/
│           ├── route.ts            # Extend with filter params
│           ├── bulk/
│           │   └── route.ts        # Bulk actions endpoint
│           └── stream/
│               └── route.ts        # SSE endpoint
├── components/
│   ├── filters/
│   ├── search/
│   ├── views/
│   ├── actions/
│   ├── details/
│   ├── dashboard/
│   ├── queue/
│   ├── tags/
│   └── common/
├── hooks/
├── lib/
│   ├── types.ts
│   ├── filters.ts
│   ├── export.ts
│   └── shortcuts.ts
└── contexts/
    ├── AppContext.tsx              # Global app state
    └── ThemeContext.tsx            # Theme management
```

---

## Implementation Phases

### Phase 1: Core Filtering & Search
- FilterBar component with all filter types
- SearchBar component with highlighting
- Sort functionality on table headers
- URL query param sync

### Phase 2: Bulk Actions & Details
- BulkActionBar with selection actions
- IssueDetailPanel slide-out
- Export functionality (CSV/JSON)
- Keyboard shortcuts system

### Phase 3: Dashboard & Visualization
- Dashboard section with stat cards
- Charts (Recharts integration)
- ProcessingQueue visualization
- Real-time log improvements

### Phase 4: Polish & Advanced Features
- Theme toggle (dark/light)
- Saved views persistence
- History view for processed issues
- SSE for real-time updates
- Virtualization for large lists

### Phase 5: Optional Enhancements
- Drag-and-drop reordering
- Undo/redo for selections
- Advanced tagging system

---

## Success Metrics

1. **Filter Usage**: > 60% of sessions use at least one filter
2. **Time to Find Issue**: Average < 10 seconds
3. **Bulk Action Adoption**: 50%+ of processing uses bulk select
4. **User Satisfaction**: > 4/5 rating

---

## API Changes Summary

### Extended GET /api/issues

```
GET /api/issues?providers=zeropath,sentry&severity=CRITICAL,HIGH&priority_min=50&search=auth
```

### New POST /api/issues/bulk

```typescript
POST /api/issues/bulk
{
  action: 'export' | 'tag' | 'priority' | 'ignore',
  ids: ['issue-1', 'issue-2'],
  payload: { tags: ['urgent'], format: 'csv' }
}
```

### New GET /api/issues/stream (SSE)

```
GET /api/issues/stream
// Returns: Server-Sent Events stream
```

---

## Appendix A: Component Mockups

```
+------------------------------------------------------------------+
| Meta-Ralph                                    [Dashboard] [Theme] |
+------------------------------------------------------------------+
| [Provider ▼] [Severity ▼] [Priority: 0-100] [Date ▼] [/Search...] |
| Active: Provider: zeropath [x]  Severity: CRITICAL [x]            |
+------------------------------------------------------------------+
| □ | Provider  | Pri | Sev      | Count | Title           | Link  |
|---|-----------|-----|----------|-------|-----------------|-------|
| ☑ | zeropath  | 95  | CRITICAL |   1   | SQL Injection   | View  |
| ☑ | sentry    | 75  | HIGH     | 247   | API Timeout     | View  |
| □ | codecov   | 65  | MEDIUM   |  45   | Low coverage... | View  |
+------------------------------------------------------------------+
| [3 selected] [Process Selected] [Export ▼] [More Actions ▼]      |
+------------------------------------------------------------------+
```

---

## Appendix B: Keyboard Shortcuts Reference

| Category | Key | Action |
|----------|-----|--------|
| Navigation | `j` / `k` | Move down/up |
| Selection | `x` | Toggle select |
| Selection | `Ctrl+A` | Select all |
| Actions | `Enter` | Process selected |
| Actions | `Space` | Open details |
| UI | `/` | Focus search |
| UI | `?` | Show help |
| UI | `Escape` | Close/clear |
