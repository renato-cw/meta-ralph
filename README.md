# Meta-Ralph

**Unified Multi-Platform Issue Resolution Agent**

Meta-Ralph is an autonomous agent that fetches issues from multiple platforms (Zeropath, Sentry, GitHub, etc.), normalizes them into a unified priority queue, and uses [Claude Code](https://github.com/anthropics/claude-code) to fix them iteratively using the [Ralph Wiggum technique](https://www.anthropic.com/engineering/claude-code-best-practices).

> *"I'm gonna wreck it!"* - Wreck-It Ralph (but for bugs)

## What is the Ralph Wiggum Technique?

The Ralph Wiggum technique is an iterative AI development methodology. In its purest form, it's a simple while loop that repeatedly feeds an AI agent a prompt until completion. Named after The Simpsons character, it embodies the philosophy of persistent iteration despite setbacks.

## Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/meta-ralph.git
   cd meta-ralph
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and fill in your credentials:
   ```bash
   # Zeropath - get from https://zeropath.com/settings/api-tokens
   ZEROPATH_API_TOKEN_ID=your-token-id
   ZEROPATH_API_TOKEN_SECRET=your-token-secret
   ZEROPATH_ORGANIZATION_ID=your-org-id
   ZEROPATH_REPOSITORY_ID=your-repo-id

   # Sentry - create at https://sentry.io/settings/account/api/auth-tokens/
   SENTRY_AUTH_TOKEN=your-sentry-token
   SENTRY_ORGANIZATION=your-org
   SENTRY_PROJECT=your-project
   ```

4. Run meta-ralph from your target repository:
   ```bash
   cd /path/to/your/project
   /path/to/meta-ralph/meta-ralph.sh --dry-run
   ```

> **Note:** The `.env` file is gitignored and will not be committed.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                           META-RALPH                                │
│                    Unified Orchestrator                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│  │  Zeropath   │  │   Sentry    │  │   GitHub    │  │   Jira    │  │
│  │  Provider   │  │  Provider   │  │  Provider   │  │  Provider │  │
│  │  (security) │  │  (errors)   │  │  (issues)   │  │  (tasks)  │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │
│         │                │                │               │         │
│         └────────────────┴────────────────┴───────────────┘         │
│                                 │                                    │
│                    ┌────────────▼────────────┐                      │
│                    │   Priority Normalizer   │                      │
│                    │   (0-100 score)         │                      │
│                    └────────────┬────────────┘                      │
│                                 │                                    │
│                    ┌────────────▼────────────┐                      │
│                    │     Unified Queue       │                      │
│                    │  (sorted by priority)   │                      │
│                    └────────────┬────────────┘                      │
│                                 │                                    │
│                    ┌────────────▼────────────┐                      │
│                    │     Ralph Engine        │                      │
│                    │  (Claude Code loop)     │                      │
│                    └────────────┬────────────┘                      │
│                                 │                                    │
│                    ┌────────────▼────────────┐                      │
│                    │     Git Operations      │                      │
│                    │  (branch, commit, PR)   │                      │
│                    └─────────────────────────┘                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Preview all issues (dry run)
./meta-ralph.sh --dry-run

# Process all issues from all providers
./meta-ralph.sh

# Process only security issues
./meta-ralph.sh --providers zeropath

# Process top 5 most critical issues
./meta-ralph.sh --max-issues 5

# Process a single issue
./meta-ralph.sh --single SCFI-ABC
```

## Usage

```bash
./meta-ralph.sh [options]

Options:
  --providers, -p LIST   Comma-separated providers (default: zeropath,sentry)
  --max-iterations N     Max iterations per issue (default: 10)
  --max-issues N         Max total issues to process (default: unlimited)
  --offset N             Skip first N issues (default: 0)
  --single ISSUE_ID      Process only a specific issue
  --dry-run              List issues without processing
  --base-branch BRANCH   Base branch for PRs (default: main)
  --parallel N           Process N issues in parallel (default: 1)
  --verbose, -v          Verbose output
  --list-providers       List available providers
  --help, -h             Show help
```

## Priority System

Issues from different providers are normalized to a 0-100 priority score:

| Priority | Score | Sources |
|----------|-------|---------|
| CRITICAL | 90-100 | Zeropath CRITICAL (9-10), GitHub security label |
| HIGH | 70-89 | Zeropath HIGH (7-8), Sentry fatal |
| MEDIUM | 40-69 | Zeropath MEDIUM (4-6), Sentry error (>100x), Sentry error |
| LOW | 20-39 | Zeropath LOW (1-3), Sentry warning, GitHub bug |
| INFO | 0-19 | GitHub enhancement, Sentry info |

## Directory Structure

```
meta-ralph/
├── meta-ralph.sh           # Main orchestrator
├── config.sh               # Loads .env configuration
├── .env.example            # Template for credentials
├── .env                    # Your credentials (gitignored)
├── lib/
│   ├── provider.sh         # Provider interface
│   ├── priority.sh         # Priority normalization
│   └── ralph-engine.sh     # Fix loop engine
└── providers/
    ├── zeropath/
    │   └── provider.sh     # Zeropath security scanner
    ├── sentry/
    │   └── provider.sh     # Sentry error monitoring
    └── github/
        └── provider.sh     # GitHub Issues (TODO)
```

## Configuration

All credentials are loaded from `.env` file (see Setup section above).

The `config.sh` script loads the `.env` file and exports all variables. You can also override any setting via environment variables.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SENTRY_QUERY` | Sentry search query | `is:unresolved` |
| `SENTRY_LIMIT` | Max Sentry issues to fetch | `100` |
| `RALPH_MAX_ITERATIONS` | Max fix attempts per issue | `10` |
| `RALPH_BASE_BRANCH` | Base branch for PRs | `main` |
| `RALPH_LOG_DIR` | Directory for logs | `.ralph-logs` |

## Creating a New Provider

1. Create directory: `providers/myplatform/`
2. Create `provider.sh` implementing:

```bash
# Required functions
provider_name()         # Return provider name
provider_fetch()        # Return JSON array of normalized issues
provider_gen_prd()      # Generate PRD markdown
provider_branch_name()  # Return branch name for issue

# Optional
provider_pr_body()      # Return PR body template
```

### Normalized Issue Format

```json
{
  "id": "unique-id",
  "provider": "provider-name",
  "title": "Issue title",
  "description": "Detailed description",
  "location": "file/function affected",
  "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
  "raw_severity": "original value",
  "count": 1,
  "priority": 75,
  "permalink": "https://...",
  "metadata": { }
}
```

## Examples

### Preview Mode

```bash
$ ./meta-ralph.sh --dry-run

╔══════════════════════════════════════════════════════════════════════╗
║          Unified Multi-Platform Issue Resolution Agent               ║
╚══════════════════════════════════════════════════════════════════════╝

📡 Fetching from zeropath...
   Found 3 issues
📡 Fetching from sentry...
   Found 12 issues

Total issues found: 15

══════════════════════════════════════════════════════════════
  DRY RUN - Issue Queue (sorted by priority)
══════════════════════════════════════════════════════════════

#    PROVIDER   PRIORITY SEVERITY COUNT  TITLE
────────────────────────────────────────────────────────────────
1    zeropath   100      CRITICAL 1      SQL Injection in user query
2    zeropath   90       HIGH     1      XSS in comment field
3    sentry     85       CRITICAL 1      PanicInfo: unwrap on Err
4    sentry     65       HIGH     247    Failed to get positions
5    sentry     50       HIGH     12     Timeout connecting to CETIP
...

Total: 15 issues queued
```

### Process Security Issues Only

```bash
$ ./meta-ralph.sh --providers zeropath --max-issues 3
```

### Process Most Frequent Errors

```bash
$ ./meta-ralph.sh --providers sentry --max-issues 5
```

## Output

- **Branches**: `sec/zeropath-xxx` for security, `fix/sentry-xxx` for errors
- **PRs**: Automatically created with description and testing checklist
- **Logs**: `.ralph-logs/{provider}-{issue_id}/`
  - `PRD.md` - Generated requirements document
  - `progress.txt` - Iteration logs

## Requirements

- [Claude Code CLI](https://github.com/anthropics/claude-code) (`claude`)
- [GitHub CLI](https://cli.github.com/) (`gh`)
- `jq` for JSON processing
- `curl` for API calls
- `python3` for URL encoding
- Git with push access to your repository

## Tips

1. **Start with `--dry-run`** to understand the issue queue
2. **Use `--single`** to test with one issue first
3. **Prioritize security** with `--providers zeropath`
4. **Review PRs** before merging - AI fixes should be validated
5. **Monitor logs** for debugging

## Comparison with Individual Ralphs

| Feature | Individual Ralph | Meta-Ralph |
|---------|-----------------|------------|
| Configuration | Per-script | Centralized |
| Priority | Per-provider | Cross-platform |
| Queue | Single source | Unified |
| Extensibility | Copy & modify | Plugin system |
| Maintenance | Multiple scripts | Single entry point |

## Roadmap

- [ ] GitHub Issues provider
- [ ] Jira provider
- [ ] Linear provider
- [ ] Parallel processing (multiple issues at once)
- [ ] Slack notifications
- [ ] Dashboard/web UI
- [ ] Issue deduplication across providers

## License

MIT

## Contributing

Contributions welcome! Feel free to:
- Add new providers (Jira, Linear, PagerDuty, etc.)
- Improve priority scoring algorithms
- Enhance PRD generation templates
- Add parallel processing support
- Create a web dashboard
