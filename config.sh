#!/bin/bash
# config.sh
# Centralized configuration for Meta-Ralph
# Loads credentials from .env file

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# ============================================================================
# LOAD .env FILE (without overwriting existing environment variables)
# ============================================================================

if [[ -f "$ENV_FILE" ]]; then
    # Load .env but DON'T overwrite variables already set in environment
    # This allows profiles to override .env values
    while IFS='=' read -r key value || [[ -n "$key" ]]; do
        # Skip comments and empty lines
        [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue
        # Remove leading/trailing whitespace from key
        key=$(echo "$key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
        # Skip if empty after trimming
        [[ -z "$key" ]] && continue
        # Only set if not already defined in environment
        if [[ -z "${!key+x}" ]]; then
            # Remove quotes from value if present
            value=$(echo "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//;s/^["'"'"']//;s/["'"'"']$//')
            export "$key=$value"
        fi
    done < "$ENV_FILE"
else
    echo "WARNING: .env file not found at $ENV_FILE" >&2
    echo "Copy .env.example to .env and fill in your credentials" >&2
fi

# ============================================================================
# ZEROPATH CONFIGURATION
# ============================================================================
export ZEROPATH_API_TOKEN_ID="${ZEROPATH_API_TOKEN_ID:-}"
export ZEROPATH_API_TOKEN_SECRET="${ZEROPATH_API_TOKEN_SECRET:-}"
export ZEROPATH_ORGANIZATION_ID="${ZEROPATH_ORGANIZATION_ID:-}"
export ZEROPATH_REPOSITORY_ID="${ZEROPATH_REPOSITORY_ID:-}"
export ZEROPATH_API_URL="${ZEROPATH_API_URL:-https://zeropath.com/api/v1}"

# ============================================================================
# SENTRY CONFIGURATION
# ============================================================================
export SENTRY_AUTH_TOKEN="${SENTRY_AUTH_TOKEN:-}"
export SENTRY_ORGANIZATION="${SENTRY_ORGANIZATION:-}"
export SENTRY_PROJECT="${SENTRY_PROJECT:-}"
export SENTRY_API_URL="${SENTRY_API_URL:-https://sentry.io/api/0}"

# ============================================================================
# GITHUB CONFIGURATION
# ============================================================================
export GITHUB_TOKEN="${GITHUB_TOKEN:-}"
export GITHUB_OWNER="${GITHUB_OWNER:-}"
export GITHUB_REPO="${GITHUB_REPO:-}"

# ============================================================================
# LINEAR CONFIGURATION (for multi-repo support)
# ============================================================================
export LINEAR_API_KEY="${LINEAR_API_KEY:-}"
export LINEAR_TEAM_ID="${LINEAR_TEAM_ID:-}"
export LINEAR_STATES="${LINEAR_STATES:-Todo,In Progress}"
export LINEAR_API_URL="${LINEAR_API_URL:-https://api.linear.app/graphql}"

# ============================================================================
# CODECOV CONFIGURATION
# ============================================================================
# API Configuration
export CODECOV_API_URL="${CODECOV_API_URL:-https://api.codecov.io}"
export CODECOV_API_TOKEN="${CODECOV_API_TOKEN:-}"

# Repository Identification
export CODECOV_SERVICE="${CODECOV_SERVICE:-github}"  # github, gitlab, bitbucket
export CODECOV_OWNER="${CODECOV_OWNER:-}"
export CODECOV_REPO="${CODECOV_REPO:-}"

# Thresholds
export CODECOV_MIN_COVERAGE="${CODECOV_MIN_COVERAGE:-50}"        # Only fetch files below this %
export CODECOV_TARGET_COVERAGE="${CODECOV_TARGET_COVERAGE:-80}"  # Target coverage in PRD
export CODECOV_MAX_FILES="${CODECOV_MAX_FILES:-20}"              # Max files to process

# Paths and Exclusions (comma-separated patterns)
export CODECOV_CRITICAL_PATHS="${CODECOV_CRITICAL_PATHS:-src/core,src/lib}"
export CODECOV_EXCLUDE_PATTERNS="${CODECOV_EXCLUDE_PATTERNS:-*.test.*,*.spec.*,__tests__,__mocks__,node_modules,vendor,*.d.ts}"

# ============================================================================
# RALPH SETTINGS
# ============================================================================
export RALPH_MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-10}"
export RALPH_BASE_BRANCH="${RALPH_BASE_BRANCH:-main}"
export RALPH_LOG_DIR="${RALPH_LOG_DIR:-.ralph-logs}"
export RALPH_PARALLEL="${RALPH_PARALLEL:-1}"

# ============================================================================
# TARGET REPOSITORY (optional - for working on a different repo)
# ============================================================================
# If set, Ralph will cd to this directory before processing issues
export TARGET_REPO="${TARGET_REPO:-}"

# Force new branch with timestamp for each issue (avoids branch conflicts)
export RALPH_FORCE_NEW_BRANCH="${RALPH_FORCE_NEW_BRANCH:-true}"

# ============================================================================
# WORKSPACE MANAGEMENT (for multi-repo support)
# ============================================================================
# Root directory for cloned repositories
export META_RALPH_WORKSPACE="${META_RALPH_WORKSPACE:-$HOME/.meta-ralph/workspaces}"

# Days before cleaning up unused repos
export WORKSPACE_CLEANUP_DAYS="${WORKSPACE_CLEANUP_DAYS:-30}"

# ============================================================================
# DEFAULT PROCESSING OPTIONS
# ============================================================================
# Default processing mode: 'plan' (analysis only) or 'build' (implementation)
export DEFAULT_PROCESSING_MODE="${DEFAULT_PROCESSING_MODE:-build}"

# Default Claude model: 'sonnet' (fast) or 'opus' (capable)
export DEFAULT_MODEL="${DEFAULT_MODEL:-sonnet}"

# ============================================================================
# PRIORITY WEIGHTS (0-100)
# ============================================================================
export PRIORITY_ZEROPATH_CRITICAL="${PRIORITY_ZEROPATH_CRITICAL:-100}"
export PRIORITY_ZEROPATH_HIGH="${PRIORITY_ZEROPATH_HIGH:-90}"
export PRIORITY_ZEROPATH_MEDIUM="${PRIORITY_ZEROPATH_MEDIUM:-70}"
export PRIORITY_ZEROPATH_LOW="${PRIORITY_ZEROPATH_LOW:-20}"

export PRIORITY_SENTRY_FATAL="${PRIORITY_SENTRY_FATAL:-85}"
export PRIORITY_SENTRY_ERROR_HIGH="${PRIORITY_SENTRY_ERROR_HIGH:-65}"
export PRIORITY_SENTRY_ERROR="${PRIORITY_SENTRY_ERROR:-50}"
export PRIORITY_SENTRY_WARNING="${PRIORITY_SENTRY_WARNING:-30}"

export PRIORITY_GITHUB_SECURITY="${PRIORITY_GITHUB_SECURITY:-95}"
export PRIORITY_GITHUB_BUG="${PRIORITY_GITHUB_BUG:-40}"
export PRIORITY_GITHUB_ENHANCEMENT="${PRIORITY_GITHUB_ENHANCEMENT:-10}"

export PRIORITY_CODECOV_CRITICAL="${PRIORITY_CODECOV_CRITICAL:-100}"   # 0-20% coverage
export PRIORITY_CODECOV_HIGH="${PRIORITY_CODECOV_HIGH:-80}"            # 21-40% coverage
export PRIORITY_CODECOV_MEDIUM="${PRIORITY_CODECOV_MEDIUM:-60}"        # 41-60% coverage
export PRIORITY_CODECOV_LOW="${PRIORITY_CODECOV_LOW:-40}"              # 61-80% coverage

# Linear priorities (1=urgent, 2=high, 3=medium, 4=low)
export PRIORITY_LINEAR_URGENT="${PRIORITY_LINEAR_URGENT:-95}"
export PRIORITY_LINEAR_HIGH="${PRIORITY_LINEAR_HIGH:-75}"
export PRIORITY_LINEAR_MEDIUM="${PRIORITY_LINEAR_MEDIUM:-50}"
export PRIORITY_LINEAR_LOW="${PRIORITY_LINEAR_LOW:-25}"

# ============================================================================
# VALIDATION
# ============================================================================

validate_config() {
    local errors=0

    if [[ -z "$ZEROPATH_API_TOKEN_ID" ]] && [[ " $* " =~ " zeropath " ]]; then
        echo "ERROR: ZEROPATH_API_TOKEN_ID not set" >&2
        errors=$((errors + 1))
    fi

    if [[ -z "$SENTRY_AUTH_TOKEN" ]] && [[ " $* " =~ " sentry " ]]; then
        echo "ERROR: SENTRY_AUTH_TOKEN not set" >&2
        errors=$((errors + 1))
    fi

    if [[ " $* " =~ " codecov " ]]; then
        if [[ -z "$CODECOV_API_TOKEN" ]]; then
            echo "ERROR: CODECOV_API_TOKEN not set" >&2
            errors=$((errors + 1))
        fi
        if [[ -z "$CODECOV_OWNER" ]]; then
            echo "ERROR: CODECOV_OWNER not set" >&2
            errors=$((errors + 1))
        fi
        if [[ -z "$CODECOV_REPO" ]]; then
            echo "ERROR: CODECOV_REPO not set" >&2
            errors=$((errors + 1))
        fi
    fi

    if [[ " $* " =~ " linear " ]]; then
        if [[ -z "$LINEAR_API_KEY" ]]; then
            echo "ERROR: LINEAR_API_KEY not set" >&2
            errors=$((errors + 1))
        fi
        if [[ -z "$LINEAR_TEAM_ID" ]]; then
            echo "ERROR: LINEAR_TEAM_ID not set" >&2
            errors=$((errors + 1))
        fi
    fi

    return $errors
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

config_loaded() {
    echo "Meta-Ralph config loaded from: $ENV_FILE"
    if [[ -n "${RALPH_CURRENT_PROFILE:-}" ]]; then
        echo "  Profile: $RALPH_CURRENT_PROFILE"
    fi
    echo "  GitHub: ${GITHUB_OWNER:-}/${GITHUB_REPO:-(not configured)}"
    echo "  Zeropath: ${ZEROPATH_ORGANIZATION_ID:-(not configured)}"
    echo "  Sentry: ${SENTRY_ORGANIZATION:-}/${SENTRY_PROJECT:-(not configured)}"
    echo "  Codecov: ${CODECOV_OWNER:-}/${CODECOV_REPO:-(not configured)}"
    echo "  Linear: ${LINEAR_TEAM_ID:-(not configured)}"
    echo "  Max iterations: $RALPH_MAX_ITERATIONS"
    echo "  Base branch: $RALPH_BASE_BRANCH"
    echo "  Default mode: $DEFAULT_PROCESSING_MODE"
    echo "  Default model: $DEFAULT_MODEL"
    echo "  Target repo: ${TARGET_REPO:-(current directory)}"
}

# Show config if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    config_loaded
fi
