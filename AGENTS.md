## Build & Run

### CLI (Bash)
- Run: `./meta-ralph.sh --help` for usage
- Dry run: `./meta-ralph.sh --dry-run --providers zeropath --max-issues 3`

### UI (Next.js)
- Dev: `cd ui && npm run dev` (port 3001)
- Build: `cd ui && npm run build`
- Start prod: `cd ui && npm start`

## Validation

Run these after implementing to get immediate feedback:

- Tests: `cd ui && npm test`
- Test watch: `cd ui && npm run test:watch`
- Coverage: `cd ui && npm run test:coverage`
- Typecheck: `cd ui && npx tsc --noEmit`
- Build (includes typecheck): `cd ui && npm run build`

## Operational Notes

### Key Directories
- `ui/src/contexts/` - AppContext global state management
- `ui/src/hooks/` - Reusable React hooks (useSort, useSearch, useFilters, useLocalStorage)
- `ui/src/components/` - React components organized by feature (filters/, search/, actions/, details/)
- `providers/` - Issue provider implementations (zeropath/, sentry/)
- `lib/` - Shared bash utilities (provider.sh, priority.sh, ralph-engine.sh)

### Codebase Patterns
- UI state managed via AppContext (ui/src/contexts/AppContext.tsx)
- Hooks in ui/src/hooks/ are composable and use useLocalStorage for persistence
- Components receive state via useApp() hook from AppContext
- All issue processing goes through /api/issues endpoint (GET/POST)

### Codebase Architecture
- CLI: Bash orchestrator (meta-ralph.sh) with pluggable providers
- UI: Next.js 15 App Router with React 19
- State: React Context + custom hooks (no external state library)
- Styling: Tailwind CSS v4 with CSS variables for theming
