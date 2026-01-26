#!/bin/bash
# lib/workspace-manager.sh
# Multi-repo workspace management for meta-ralph (PRD-10)
#
# Manages a centralized workspace directory for cloning and managing
# external repositories. Enables processing issues that require work
# in repositories other than the current one.
#
# Why this exists:
# - Linear issues may reference other repos (e.g., "register repo X in Capidex")
# - Claude needs local access to target repos to make changes
# - Centralized workspace allows consistent path handling and cleanup

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/config.sh" 2>/dev/null || true

# ============================================================================
# CONFIGURATION
# ============================================================================

# Workspace root directory (default: ~/.meta-ralph/workspaces)
WORKSPACE_ROOT="${META_RALPH_WORKSPACE:-$HOME/.meta-ralph/workspaces}"

# Cleanup threshold in days (default: 30)
CLEANUP_DAYS="${WORKSPACE_CLEANUP_DAYS:-30}"

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
    echo -e "${BLUE}[workspace]${NC} $*" >&2
}

# Log success message
log_success() {
    echo -e "${GREEN}[workspace]${NC} $*" >&2
}

# Log warning message
log_warn() {
    echo -e "${YELLOW}[workspace]${NC} $*" >&2
}

# Log error message
log_error() {
    echo -e "${RED}[workspace]${NC} $*" >&2
}

# Convert full repo name (org/repo) to local path format (org_repo)
# Args: full_name (e.g., "cloudwalk/capidex")
# Returns: sanitized name (e.g., "cloudwalk_capidex")
sanitize_repo_name() {
    local full_name="$1"
    echo "${full_name//\//_}"
}

# Convert sanitized name back to full repo name
# Args: sanitized_name (e.g., "cloudwalk_capidex")
# Returns: full_name (e.g., "cloudwalk/capidex")
unsanitize_repo_name() {
    local sanitized="$1"
    # Replace first underscore with slash (org_repo -> org/repo)
    echo "${sanitized/_//}"
}

# Ensure workspace root directory exists
ensure_workspace_root() {
    if [[ ! -d "$WORKSPACE_ROOT" ]]; then
        log_info "Creating workspace directory: $WORKSPACE_ROOT"
        mkdir -p "$WORKSPACE_ROOT"
    fi
}

# Get the default branch name for a repo
# Args: repo_path
get_default_branch() {
    local repo_path="$1"

    # Try to get the default branch from remote
    local default_branch
    default_branch=$(git -C "$repo_path" symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@')

    if [[ -z "$default_branch" ]]; then
        # Fallback: try main, then master
        if git -C "$repo_path" show-ref --verify --quiet refs/heads/main 2>/dev/null; then
            default_branch="main"
        elif git -C "$repo_path" show-ref --verify --quiet refs/heads/master 2>/dev/null; then
            default_branch="master"
        else
            default_branch="main"
        fi
    fi

    echo "$default_branch"
}

# ============================================================================
# CORE FUNCTIONS
# ============================================================================

# Check if a repository exists in the workspace
# Args: full_name (e.g., "cloudwalk/capidex")
# Returns: 0 if exists, 1 if not
repo_exists() {
    local full_name="$1"
    local repo_path
    repo_path=$(get_repo_path "$full_name")

    [[ -d "$repo_path/.git" ]]
}

# Get the local path for a repository
# Args: full_name (e.g., "cloudwalk/capidex")
# Returns: local path (e.g., ~/.meta-ralph/workspaces/cloudwalk_capidex)
get_repo_path() {
    local full_name="$1"
    local sanitized
    sanitized=$(sanitize_repo_name "$full_name")
    echo "$WORKSPACE_ROOT/$sanitized"
}

# Ensure a repository is cloned and up-to-date
# Clones if not present, fetches and updates if already cloned
# Args: full_name (e.g., "cloudwalk/capidex")
# Returns: local path to the repository
ensure_repo() {
    local full_name="$1"
    local clone_url="${2:-}"

    # Validate input
    if [[ -z "$full_name" ]] || [[ ! "$full_name" =~ ^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$ ]]; then
        log_error "Invalid repository name: $full_name"
        log_error "Expected format: owner/repo (e.g., cloudwalk/capidex)"
        return 1
    fi

    ensure_workspace_root

    local repo_path
    repo_path=$(get_repo_path "$full_name")

    # Default clone URL if not provided
    if [[ -z "$clone_url" ]]; then
        clone_url="git@github.com:${full_name}.git"
    fi

    if [[ -d "$repo_path/.git" ]]; then
        log_info "Updating repository: $full_name"

        # Fetch latest changes
        if ! git -C "$repo_path" fetch origin 2>&1 | while read -r line; do log_info "  $line"; done; then
            log_warn "Failed to fetch, continuing with existing state"
        fi

        # Get default branch and checkout
        local default_branch
        default_branch=$(get_default_branch "$repo_path")

        # Checkout default branch and pull
        if ! git -C "$repo_path" checkout "$default_branch" 2>/dev/null; then
            log_warn "Could not checkout $default_branch"
        fi

        # Reset any local changes and pull latest
        git -C "$repo_path" reset --hard "origin/$default_branch" 2>/dev/null || true

        log_success "Repository updated: $full_name"
    else
        log_info "Cloning repository: $full_name"
        log_info "  URL: $clone_url"

        # Clone the repository
        if ! git clone "$clone_url" "$repo_path" 2>&1 | while read -r line; do log_info "  $line"; done; then
            log_error "Failed to clone repository: $full_name"
            log_error "Make sure you have access to: $clone_url"
            return 1
        fi

        log_success "Repository cloned: $full_name"
    fi

    # Touch the directory to update mtime (for cleanup tracking)
    touch "$repo_path"

    # Return the path
    echo "$repo_path"
}

# List all repositories in the workspace
# Returns: newline-separated list of full repo names (org/repo)
list_workspace_repos() {
    ensure_workspace_root

    # List directories in workspace and convert back to repo format
    if [[ -d "$WORKSPACE_ROOT" ]]; then
        find "$WORKSPACE_ROOT" -maxdepth 1 -mindepth 1 -type d -exec basename {} \; 2>/dev/null | \
            while read -r dir; do
                # Only include if it's a git repo
                if [[ -d "$WORKSPACE_ROOT/$dir/.git" ]]; then
                    unsanitize_repo_name "$dir"
                fi
            done
    fi
}

# Get detailed information about a repository in the workspace
# Args: full_name (e.g., "cloudwalk/capidex")
# Returns: JSON object with repo details
get_repo_info() {
    local full_name="$1"
    local repo_path
    repo_path=$(get_repo_path "$full_name")

    if [[ ! -d "$repo_path/.git" ]]; then
        echo '{"error": "Repository not found in workspace"}'
        return 1
    fi

    local branch
    branch=$(git -C "$repo_path" branch --show-current 2>/dev/null || echo "unknown")

    local last_commit
    last_commit=$(git -C "$repo_path" log -1 --format='%H' 2>/dev/null || echo "unknown")

    local last_modified
    last_modified=$(stat -f '%m' "$repo_path" 2>/dev/null || stat -c '%Y' "$repo_path" 2>/dev/null || echo "0")

    local size_mb
    size_mb=$(du -sm "$repo_path" 2>/dev/null | cut -f1 || echo "0")

    # Output JSON
    cat <<EOF
{
    "full_name": "$full_name",
    "path": "$repo_path",
    "branch": "$branch",
    "last_commit": "$last_commit",
    "last_modified": $last_modified,
    "size_mb": $size_mb
}
EOF
}

# Clean up repositories not used in N days
# Args: days (optional, defaults to CLEANUP_DAYS)
# Returns: number of repos cleaned up
cleanup_workspace() {
    local days="${1:-$CLEANUP_DAYS}"
    local cleaned=0

    ensure_workspace_root

    log_info "Cleaning up repos not used in $days days..."

    # Find and remove old directories
    while IFS= read -r -d '' repo_dir; do
        local repo_name
        repo_name=$(basename "$repo_dir")
        local full_name
        full_name=$(unsanitize_repo_name "$repo_name")

        log_info "Removing unused repository: $full_name"
        rm -rf "$repo_dir"
        ((cleaned++))
    done < <(find "$WORKSPACE_ROOT" -maxdepth 1 -mindepth 1 -type d -mtime "+$days" -print0 2>/dev/null)

    if [[ $cleaned -gt 0 ]]; then
        log_success "Cleaned up $cleaned repositories"
    else
        log_info "No repositories to clean up"
    fi

    echo "$cleaned"
}

# Get workspace statistics
# Returns: JSON object with workspace stats
get_workspace_stats() {
    ensure_workspace_root

    local repo_count=0
    local total_size_mb=0

    while IFS= read -r full_name; do
        if [[ -n "$full_name" ]]; then
            ((repo_count++))
            local repo_path
            repo_path=$(get_repo_path "$full_name")
            local size
            size=$(du -sm "$repo_path" 2>/dev/null | cut -f1 || echo "0")
            ((total_size_mb += size))
        fi
    done < <(list_workspace_repos)

    cat <<EOF
{
    "workspace_root": "$WORKSPACE_ROOT",
    "repo_count": $repo_count,
    "total_size_mb": $total_size_mb,
    "cleanup_days": $CLEANUP_DAYS
}
EOF
}

# Verify access to a repository before cloning
# Args: full_name (e.g., "cloudwalk/capidex")
# Returns: 0 if accessible, 1 if not
verify_repo_access() {
    local full_name="$1"

    log_info "Verifying access to: $full_name"

    # Use git ls-remote to check access without cloning
    if git ls-remote "git@github.com:${full_name}.git" HEAD >/dev/null 2>&1; then
        log_success "Access verified: $full_name"
        return 0
    else
        log_error "Cannot access repository: $full_name"
        log_error "Check your SSH keys and repository permissions"
        return 1
    fi
}

# ============================================================================
# MAIN (for CLI usage)
# ============================================================================

# If run directly (not sourced), handle CLI commands
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        ensure)
            if [[ -z "${2:-}" ]]; then
                echo "Usage: $0 ensure <org/repo>" >&2
                exit 1
            fi
            ensure_repo "$2"
            ;;
        path)
            if [[ -z "${2:-}" ]]; then
                echo "Usage: $0 path <org/repo>" >&2
                exit 1
            fi
            get_repo_path "$2"
            ;;
        exists)
            if [[ -z "${2:-}" ]]; then
                echo "Usage: $0 exists <org/repo>" >&2
                exit 1
            fi
            if repo_exists "$2"; then
                echo "yes"
                exit 0
            else
                echo "no"
                exit 1
            fi
            ;;
        list)
            list_workspace_repos
            ;;
        info)
            if [[ -z "${2:-}" ]]; then
                echo "Usage: $0 info <org/repo>" >&2
                exit 1
            fi
            get_repo_info "$2"
            ;;
        cleanup)
            cleanup_workspace "${2:-}"
            ;;
        stats)
            get_workspace_stats
            ;;
        verify)
            if [[ -z "${2:-}" ]]; then
                echo "Usage: $0 verify <org/repo>" >&2
                exit 1
            fi
            verify_repo_access "$2"
            ;;
        help|--help|-h)
            cat <<EOF
Usage: $0 <command> [args]

Commands:
  ensure <org/repo>   Clone or update a repository
  path <org/repo>     Get local path for a repository
  exists <org/repo>   Check if repository exists in workspace
  list                List all repositories in workspace
  info <org/repo>     Get detailed info about a repository
  cleanup [days]      Remove repos not used in N days (default: $CLEANUP_DAYS)
  stats               Get workspace statistics
  verify <org/repo>   Verify access to a repository

Environment Variables:
  META_RALPH_WORKSPACE     Workspace root (default: ~/.meta-ralph/workspaces)
  WORKSPACE_CLEANUP_DAYS   Cleanup threshold in days (default: 30)

Examples:
  $0 ensure cloudwalk/capidex
  $0 list
  $0 cleanup 7
EOF
            ;;
        *)
            echo "Unknown command: ${1:-}" >&2
            echo "Run '$0 help' for usage information" >&2
            exit 1
            ;;
    esac
fi
