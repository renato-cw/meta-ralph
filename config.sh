#!/bin/bash
# config.sh
# Centralized configuration for Meta-Ralph
# Loads credentials from .env file

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# ============================================================================
# LOAD .env FILE
# ============================================================================

if [[ -f "$ENV_FILE" ]]; then
    # Export all variables from .env (ignoring comments and empty lines)
    set -a
    source "$ENV_FILE"
    set +a
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
# RALPH SETTINGS
# ============================================================================
export RALPH_MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-10}"
export RALPH_BASE_BRANCH="${RALPH_BASE_BRANCH:-main}"
export RALPH_LOG_DIR="${RALPH_LOG_DIR:-.ralph-logs}"
export RALPH_PARALLEL="${RALPH_PARALLEL:-1}"

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

    return $errors
}

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

config_loaded() {
    echo "Meta-Ralph config loaded from: $ENV_FILE"
    echo "  Zeropath: ${ZEROPATH_ORGANIZATION_ID:-(not configured)}"
    echo "  Sentry: ${SENTRY_ORGANIZATION:-}/${SENTRY_PROJECT:-(not configured)}"
    echo "  Max iterations: $RALPH_MAX_ITERATIONS"
    echo "  Base branch: $RALPH_BASE_BRANCH"
}

# Show config if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    config_loaded
fi
