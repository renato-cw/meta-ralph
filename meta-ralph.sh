#!/bin/bash
# meta-ralph.sh
# Meta-Ralph: Unified orchestrator for multi-platform issue resolution
#
# Usage:
#   ./meta-ralph.sh                              # Process all providers
#   ./meta-ralph.sh --providers zeropath,sentry  # Specific providers
#   ./meta-ralph.sh --dry-run                    # List issues only
#   ./meta-ralph.sh --max-issues 5               # Limit total issues
#   ./meta-ralph.sh --parallel 3                 # Process 3 issues in parallel

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# REPO_ROOT can be overridden via environment variable, defaults to current directory
REPO_ROOT="${REPO_ROOT:-$(pwd)}"

# Load configuration
source "$SCRIPT_DIR/config.sh"
source "$SCRIPT_DIR/lib/provider.sh"
source "$SCRIPT_DIR/lib/priority.sh"
source "$SCRIPT_DIR/lib/ralph-engine.sh"

# Defaults
PROVIDERS="zeropath,sentry,codecov"
MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-10}"
MAX_ISSUES=0
OFFSET=0
SINGLE_ISSUE=""
DRY_RUN=false
JSON_OUTPUT=false
ONLY_IDS=""
BASE_BRANCH="${RALPH_BASE_BRANCH:-main}"
PARALLEL=1
VERBOSE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --providers|-p)
            PROVIDERS="$2"
            shift 2
            ;;
        --max-iterations)
            MAX_ITERATIONS="$2"
            shift 2
            ;;
        --max-issues)
            MAX_ISSUES="$2"
            shift 2
            ;;
        --offset)
            OFFSET="$2"
            shift 2
            ;;
        --single)
            SINGLE_ISSUE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --json)
            JSON_OUTPUT=true
            shift
            ;;
        --only-ids)
            ONLY_IDS="$2"
            shift 2
            ;;
        --base-branch)
            BASE_BRANCH="$2"
            shift 2
            ;;
        --parallel)
            PARALLEL="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --list-providers)
            echo "Available providers:"
            list_providers | while read p; do echo "  - $p"; done
            exit 0
            ;;
        --help|-h)
            cat << EOF
Meta-Ralph: Unified Multi-Platform Issue Resolution Agent

Usage: $0 [options]

Options:
  --providers, -p LIST   Comma-separated list of providers (default: zeropath,sentry)
  --max-iterations N     Max iterations per issue (default: 10)
  --max-issues N         Max total issues to process (default: unlimited)
  --offset N             Skip first N issues (default: 0)
  --single ISSUE_ID      Process only a specific issue
  --dry-run              List issues without processing
  --json                 Output issues as JSON (use with --dry-run)
  --only-ids ID1,ID2     Process only specific issue IDs (comma-separated)
  --base-branch BRANCH   Base branch for PRs (default: main)
  --parallel N           Process N issues in parallel (default: 1)
  --verbose, -v          Verbose output
  --list-providers       List available providers
  --help, -h             Show this help

Examples:
  $0 --dry-run                           # Preview all issues
  $0 --providers zeropath                # Security issues only
  $0 --providers sentry --max-issues 5   # Top 5 Sentry errors
  $0 --parallel 2 --max-issues 10        # Process 10 issues, 2 at a time

Provider-specific environment variables:
  SENTRY_QUERY    Sentry search query (default: is:unresolved)
  SENTRY_LIMIT    Max Sentry issues to fetch (default: 100)

EOF
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $1${NC}"
            exit 1
            ;;
    esac
done

# Banner
echo -e "${MAGENTA}"
cat << 'EOF'
╔══════════════════════════════════════════════════════════════════════╗
║                                                                      ║
║   ███╗   ███╗███████╗████████╗ █████╗       ██████╗  █████╗ ██╗     ║
║   ████╗ ████║██╔════╝╚══██╔══╝██╔══██╗      ██╔══██╗██╔══██╗██║     ║
║   ██╔████╔██║█████╗     ██║   ███████║█████╗██████╔╝███████║██║     ║
║   ██║╚██╔╝██║██╔══╝     ██║   ██╔══██║╚════╝██╔══██╗██╔══██║██║     ║
║   ██║ ╚═╝ ██║███████╗   ██║   ██║  ██║      ██║  ██║██║  ██║███████╗║
║   ╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝      ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝║
║                                                                      ║
║          Unified Multi-Platform Issue Resolution Agent               ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${CYAN}Configuration:${NC}"
echo -e "  Providers: $PROVIDERS"
echo -e "  Max Iterations: $MAX_ITERATIONS"
echo -e "  Max Issues: $([ "$MAX_ISSUES" -eq 0 ] && echo "unlimited" || echo "$MAX_ISSUES")"
echo -e "  Offset: $OFFSET"
echo -e "  Parallel: $PARALLEL"
echo -e "  Dry Run: $DRY_RUN"
echo -e "  Base Branch: $BASE_BRANCH"
echo ""

# Change to repo root
cd "$REPO_ROOT"

# Verify git repo
if [[ ! -d ".git" ]]; then
    echo -e "${RED}Error: Not in a git repository${NC}"
    exit 1
fi

# ============================================================================
# FETCH ISSUES FROM ALL PROVIDERS
# ============================================================================

echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Phase 1: Fetching issues from providers${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""

all_issues="[]"
IFS=',' read -ra PROVIDER_LIST <<< "$PROVIDERS"

for provider_name in "${PROVIDER_LIST[@]}"; do
    provider_name=$(echo "$provider_name" | xargs)  # Trim whitespace

    echo -e "${CYAN}📡 Fetching from $provider_name...${NC}"

    if ! load_provider "$provider_name"; then
        echo -e "${YELLOW}⚠️  Provider '$provider_name' not available, skipping${NC}"
        continue
    fi

    provider_issues=$(provider_fetch 2>/dev/null || echo "[]")
    issue_count=$(echo "$provider_issues" | jq 'length')

    echo -e "${GREEN}   Found $issue_count issues${NC}"

    if [[ "$issue_count" -gt 0 ]]; then
        all_issues=$(echo "$all_issues" "$provider_issues" | jq -s 'add')
    fi
done

# Sort all issues by priority
all_issues=$(echo "$all_issues" | sort_by_priority)

total_issues=$(echo "$all_issues" | jq 'length')
echo ""
echo -e "${WHITE}Total issues found: $total_issues${NC}"
echo ""

# Apply offset
if [[ "$OFFSET" -gt 0 ]]; then
    all_issues=$(echo "$all_issues" | jq ".[$OFFSET:]")
    echo -e "${CYAN}Skipping first $OFFSET issues${NC}"
fi

# Apply limit
if [[ "$MAX_ISSUES" -gt 0 ]]; then
    all_issues=$(echo "$all_issues" | jq ".[:$MAX_ISSUES]")
    echo -e "${CYAN}Limiting to $MAX_ISSUES issues${NC}"
fi

# Filter single issue if specified
if [[ -n "$SINGLE_ISSUE" ]]; then
    all_issues=$(echo "$all_issues" | jq "[.[] | select(.id == \"$SINGLE_ISSUE\" or .short_id == \"$SINGLE_ISSUE\")]")
    if [[ "$(echo "$all_issues" | jq 'length')" -eq 0 ]]; then
        echo -e "${RED}Issue $SINGLE_ISSUE not found${NC}"
        exit 1
    fi
    echo -e "${YELLOW}Processing single issue: $SINGLE_ISSUE${NC}"
fi

# Filter by specific IDs if --only-ids specified
if [[ -n "$ONLY_IDS" ]]; then
    IFS=',' read -ra ID_LIST <<< "$ONLY_IDS"
    id_filter=$(printf '%s\n' "${ID_LIST[@]}" | jq -R . | jq -s .)
    all_issues=$(echo "$all_issues" | jq --argjson ids "$id_filter" '[.[] | select(.id as $id | $ids | any(. == $id))]')
    echo -e "${YELLOW}Filtering to ${#ID_LIST[@]} specific issue(s)${NC}"
fi

issue_count=$(echo "$all_issues" | jq 'length')

# ============================================================================
# DRY RUN - LIST ISSUES
# ============================================================================

if [[ "$DRY_RUN" == "true" ]]; then
    # JSON output mode
    if [[ "$JSON_OUTPUT" == "true" ]]; then
        echo "$all_issues"
        exit 0
    fi

    echo ""
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  DRY RUN - Issue Queue (sorted by priority)${NC}"
    echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo ""

    printf "${WHITE}%-4s %-10s %-8s %-8s %-6s %s${NC}\n" "#" "PROVIDER" "PRIORITY" "SEVERITY" "COUNT" "TITLE"
    echo "────────────────────────────────────────────────────────────────────────────────"

    echo "$all_issues" | jq -r '.[] | [.provider, (.priority | tostring), .severity, (.count | tostring), .title] | @tsv' | \
    while IFS=$'\t' read -r provider priority severity count title; do
        # Color based on priority
        if [[ "$priority" -ge 90 ]]; then
            color="$RED"
        elif [[ "$priority" -ge 70 ]]; then
            color="$YELLOW"
        elif [[ "$priority" -ge 40 ]]; then
            color="$CYAN"
        else
            color="$GREEN"
        fi

        idx=$((${idx:-0} + 1))
        printf "${color}%-4s %-10s %-8s %-8s %-6s %.50s${NC}\n" "$idx" "$provider" "$priority" "$severity" "$count" "$title"
    done

    echo ""
    echo -e "${WHITE}Total: $issue_count issues queued${NC}"
    echo ""
    echo -e "${YELLOW}Run without --dry-run to process these issues${NC}"
    exit 0
fi

# ============================================================================
# PROCESS ISSUES
# ============================================================================

echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Phase 2: Processing $issue_count issues${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""

# Create log directory
LOG_DIR="$REPO_ROOT/${RALPH_LOG_DIR:-.ralph-logs}"
mkdir -p "$LOG_DIR"

# Counters
processed=0
fixed=0
failed=0

# Process each issue
for (( idx=0; idx<issue_count; idx++ )); do
    issue=$(echo "$all_issues" | jq -c ".[$idx]")
    issue_id=$(echo "$issue" | jq -r '.id')
    issue_title=$(echo "$issue" | jq -r '.title')
    provider=$(echo "$issue" | jq -r '.provider')
    priority=$(echo "$issue" | jq -r '.priority')
    severity=$(echo "$issue" | jq -r '.severity')
    count=$(echo "$issue" | jq -r '.count // 1')
    location=$(echo "$issue" | jq -r '.location // "Unknown"')

    # Color based on priority
    if [[ "$priority" -ge 90 ]]; then
        pcolor="$RED"
    elif [[ "$priority" -ge 70 ]]; then
        pcolor="$YELLOW"
    elif [[ "$priority" -ge 40 ]]; then
        pcolor="$CYAN"
    else
        pcolor="$GREEN"
    fi

    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Issue $((idx+1)) of $issue_count${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
    echo -e "${WHITE}ID:${NC}       ${issue_id:0:20}"
    echo -e "${WHITE}Provider:${NC} $provider"
    echo -e "${WHITE}Priority:${NC} ${pcolor}$priority ($severity)${NC}"
    echo -e "${WHITE}Count:${NC}    $count"
    echo -e "${WHITE}Location:${NC} $location"
    echo -e "${WHITE}Title:${NC}    ${issue_title:0:60}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"

    # Work directory for this issue
    WORK_DIR="$LOG_DIR/$provider-$issue_id"
    mkdir -p "$WORK_DIR"

    # Read processing options from environment variables (set by UI)
    local mode="${RALPH_MODE:-build}"
    local model="${RALPH_MODEL:-sonnet}"
    local auto_push="${RALPH_AUTO_PUSH:-true}"

    # Process the issue with all options
    if process_issue "$issue" "$provider" "$WORK_DIR" "$BASE_BRANCH" "$MAX_ITERATIONS" "$mode" "$model" "$auto_push"; then
        ((fixed++)) || true
    else
        ((failed++)) || true
    fi

    ((processed++)) || true

    # Return to base branch
    git checkout "$BASE_BRANCH" 2>/dev/null || true

    echo ""
done

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo -e "${MAGENTA}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${MAGENTA}║                       FINAL SUMMARY                          ║${NC}"
echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Issues processed:${NC} $processed"
echo -e "  ${GREEN}Issues fixed:${NC}     $fixed"
echo -e "  ${RED}Issues failed:${NC}    $failed"
echo ""

# Per-provider breakdown
echo -e "${WHITE}By Provider:${NC}"
for provider_name in "${PROVIDER_LIST[@]}"; do
    provider_name=$(echo "$provider_name" | xargs)
    provider_count=$(echo "$all_issues" | jq "[.[] | select(.provider == \"$provider_name\")] | length")
    echo -e "  $provider_name: $provider_count issues"
done

echo ""
echo -e "${BLUE}Logs available at: $LOG_DIR${NC}"
echo ""
echo -e "${GREEN}🎉 Meta-Ralph complete!${NC}"
