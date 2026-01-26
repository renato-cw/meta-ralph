#!/bin/bash
# lib/issue-parser.sh
# Issue parser for multi-repo support (PRD-10)
#
# Uses Claude to extract repository references from issues written in
# natural language. Enables processing issues that reference external
# repositories.
#
# Why this exists:
# - Linear/GitHub issues often reference repos in natural language
#   (e.g., "Register shylock-agent in Capidex")
# - We need to identify which repo to clone and work in
# - Claude can understand context and extract structured data

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/config.sh" 2>/dev/null || true

# ============================================================================
# CONFIGURATION
# ============================================================================

# Default organization for repos without explicit org
DEFAULT_ORG="${DEFAULT_ORG:-cloudwalk}"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Log info message
log_info() {
    echo -e "${BLUE}[issue-parser]${NC} $*" >&2
}

# Log success message
log_success() {
    echo -e "${GREEN}[issue-parser]${NC} $*" >&2
}

# Log warning message
log_warn() {
    echo -e "${YELLOW}[issue-parser]${NC} $*" >&2
}

# Log error message
log_error() {
    echo -e "${RED}[issue-parser]${NC} $*" >&2
}

# Validate JSON using jq
validate_json() {
    local json="$1"
    echo "$json" | jq -e '.' > /dev/null 2>&1
}

# ============================================================================
# CORE FUNCTIONS
# ============================================================================

# Parse an issue to extract repository information using Claude
# Args: issue_json (JSON string with title, description fields)
# Returns: JSON object with target_repo, context_repos, action
parse_issue_repos() {
    local issue_json="$1"

    # Extract title and description from issue
    local title
    title=$(echo "$issue_json" | jq -r '.title // ""')
    local description
    description=$(echo "$issue_json" | jq -r '.description // ""')

    # Combine for analysis
    local issue_text="Title: $title

Description:
$description"

    log_info "Analyzing issue for repository references..."

    # Use Claude to extract repository information
    local prompt="Analyze this issue and extract information about repositories mentioned.

ISSUE:
$issue_text

Return ONLY a valid JSON object (no markdown, no explanation):
{
  \"target_repo\": \"org/repo\" or null,
  \"context_repos\": [\"org/repo\"] or [],
  \"action\": {
    \"type\": \"register\" | \"fix\" | \"update\" | \"create\" | \"migrate\" | \"unknown\",
    \"description\": \"brief description of the action\"
  }
}

Rules:
1. target_repo = the repository where changes need to be made (where to commit)
2. context_repos = repositories mentioned for reference but not modified
3. If no external repository is mentioned, return target_repo: null
4. Use \"$DEFAULT_ORG\" as default org if only repo name is mentioned
5. Common patterns:
   - \"register X in Y\" -> target_repo: Y, context_repos: [X], action.type: register
   - \"fix bug in X\" -> target_repo: X, action.type: fix
   - \"add X to Y\" -> target_repo: Y, context_repos: [X], action.type: update

Return ONLY the JSON, nothing else."

    local result
    if command -v claude >/dev/null 2>&1; then
        result=$(echo "$prompt" | claude --print 2>/dev/null)
    else
        log_warn "Claude CLI not available, returning empty result"
        result='{"target_repo": null, "context_repos": [], "action": null}'
    fi

    # Clean up the result (remove any markdown code blocks if present)
    result=$(echo "$result" | sed 's/```json//g' | sed 's/```//g' | tr -d '\n' | sed 's/.*{/{/' | sed 's/}.*/}/')

    # Validate JSON
    if validate_json "$result"; then
        log_success "Repository analysis complete"
        echo "$result"
    else
        log_warn "Invalid JSON from Claude, returning fallback"
        echo '{"target_repo": null, "context_repos": [], "action": null}'
    fi
}

# Enrich an issue with repository information
# Args: issue_json (JSON string)
# Returns: Enhanced issue JSON with target_repo, context_repos, parsed_action fields
enrich_issue_with_repos() {
    local issue_json="$1"

    # Parse repos from issue
    local repos_info
    repos_info=$(parse_issue_repos "$issue_json")

    # Merge into issue
    local target_repo
    target_repo=$(echo "$repos_info" | jq -r '.target_repo // empty')
    local context_repos
    context_repos=$(echo "$repos_info" | jq '.context_repos // []')
    local action
    action=$(echo "$repos_info" | jq '.action // null')

    # Build enhanced issue
    if [[ -n "$target_repo" ]]; then
        # Parse org/repo
        local org repo
        org=$(echo "$target_repo" | cut -d'/' -f1)
        repo=$(echo "$target_repo" | cut -d'/' -f2)

        echo "$issue_json" | jq --arg org "$org" --arg repo "$repo" --arg full "$target_repo" \
            --argjson ctx "$context_repos" --argjson act "$action" '
            . + {
                target_repo: {
                    org: $org,
                    name: $repo,
                    full_name: $full
                },
                context_repos: ($ctx | map({
                    org: (. | split("/") | .[0]),
                    name: (. | split("/") | .[1]),
                    full_name: .
                })),
                parsed_action: $act
            }'
    else
        # No target repo, just add empty fields
        echo "$issue_json" | jq --argjson ctx "$context_repos" --argjson act "$action" '
            . + {
                target_repo: null,
                context_repos: ($ctx | map({
                    org: (. | split("/") | .[0]),
                    name: (. | split("/") | .[1]),
                    full_name: .
                })),
                parsed_action: $act
            }'
    fi
}

# Quick check if an issue mentions external repositories
# Args: issue_json (JSON string)
# Returns: "yes" or "no"
has_external_repos() {
    local issue_json="$1"

    local text
    text=$(echo "$issue_json" | jq -r '(.title // "") + " " + (.description // "")')

    # Quick pattern matching for common repo references
    # Look for patterns like: org/repo, "in X", "to Y", "from Z"
    if echo "$text" | grep -qiE '([a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+|register .+ in|add .+ to|from .+ repo|clone .+)'; then
        echo "yes"
    else
        echo "no"
    fi
}

# Extract all repository names mentioned in text using regex
# Args: text (plain text)
# Returns: newline-separated list of repo references
extract_repo_mentions() {
    local text="$1"

    # Look for org/repo patterns
    echo "$text" | grep -oE '[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+' | sort -u
}

# ============================================================================
# MAIN (for CLI usage)
# ============================================================================

# If run directly (not sourced), handle CLI commands
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        parse)
            if [[ -z "${2:-}" ]]; then
                # Read from stdin
                issue_json=$(cat)
            else
                issue_json="$2"
            fi
            parse_issue_repos "$issue_json"
            ;;
        enrich)
            if [[ -z "${2:-}" ]]; then
                # Read from stdin
                issue_json=$(cat)
            else
                issue_json="$2"
            fi
            enrich_issue_with_repos "$issue_json"
            ;;
        check)
            if [[ -z "${2:-}" ]]; then
                # Read from stdin
                issue_json=$(cat)
            else
                issue_json="$2"
            fi
            has_external_repos "$issue_json"
            ;;
        mentions)
            if [[ -z "${2:-}" ]]; then
                # Read from stdin
                text=$(cat)
            else
                text="$2"
            fi
            extract_repo_mentions "$text"
            ;;
        help|--help|-h)
            cat <<EOF
Usage: $0 <command> [args]

Commands:
  parse [json]     Parse issue JSON to extract repository info (uses Claude)
  enrich [json]    Enrich issue JSON with repository info
  check [json]     Quick check if issue mentions external repos
  mentions [text]  Extract repo name patterns from text

Input can be provided as argument or via stdin.

Examples:
  echo '{"title": "Register shylock in Capidex"}' | $0 parse
  echo '{"title": "Fix bug"}' | $0 check
  $0 mentions "Add cloudwalk/api to cloudwalk/app"

Environment Variables:
  DEFAULT_ORG   Default organization for repos (default: cloudwalk)
EOF
            ;;
        *)
            echo "Unknown command: ${1:-}" >&2
            echo "Run '$0 help' for usage information" >&2
            exit 1
            ;;
    esac
fi
