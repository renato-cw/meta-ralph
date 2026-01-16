#!/bin/bash
# lib/priority.sh
# Cross-platform priority normalization
# Converts different severity systems to a unified 0-100 score

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$SCRIPT_DIR/config.sh" 2>/dev/null || true

# ============================================================================
# PRIORITY CALCULATION
# ============================================================================

# Calculate priority for a Zeropath issue
# Args: severity (0-10 float)
calculate_zeropath_priority() {
    local severity="$1"
    local severity_int=${severity%.*}
    severity_int=${severity_int:-0}

    if [[ $severity_int -ge 9 ]]; then
        echo "${PRIORITY_ZEROPATH_CRITICAL:-100}"
    elif [[ $severity_int -ge 7 ]]; then
        echo "${PRIORITY_ZEROPATH_HIGH:-90}"
    elif [[ $severity_int -ge 4 ]]; then
        echo "${PRIORITY_ZEROPATH_MEDIUM:-70}"
    else
        echo "${PRIORITY_ZEROPATH_LOW:-20}"
    fi
}

# Calculate priority for a Sentry issue
# Args: level (fatal/error/warning/info), count
calculate_sentry_priority() {
    local level="$1"
    local count="${2:-0}"

    case "$level" in
        fatal)
            echo "${PRIORITY_SENTRY_FATAL:-85}"
            ;;
        error)
            if [[ $count -gt 100 ]]; then
                echo "${PRIORITY_SENTRY_ERROR_HIGH:-65}"
            else
                echo "${PRIORITY_SENTRY_ERROR:-50}"
            fi
            ;;
        warning)
            echo "${PRIORITY_SENTRY_WARNING:-30}"
            ;;
        *)
            echo "10"
            ;;
    esac
}

# Calculate priority for a GitHub issue
# Args: labels (comma-separated)
calculate_github_priority() {
    local labels="$1"

    if echo "$labels" | grep -qi "security"; then
        echo "${PRIORITY_GITHUB_SECURITY:-95}"
    elif echo "$labels" | grep -qi "bug"; then
        echo "${PRIORITY_GITHUB_BUG:-40}"
    elif echo "$labels" | grep -qi "enhancement"; then
        echo "${PRIORITY_GITHUB_ENHANCEMENT:-10}"
    else
        echo "25"
    fi
}

# Sort issues by priority (descending)
# Reads JSON array from stdin, outputs sorted array
sort_by_priority() {
    jq 'sort_by(-.priority)'
}

# Get priority label from score
priority_label() {
    local score="$1"

    if [[ $score -ge 90 ]]; then
        echo "CRITICAL"
    elif [[ $score -ge 70 ]]; then
        echo "HIGH"
    elif [[ $score -ge 40 ]]; then
        echo "MEDIUM"
    elif [[ $score -ge 20 ]]; then
        echo "LOW"
    else
        echo "INFO"
    fi
}

# Get color for priority
priority_color() {
    local score="$1"

    if [[ $score -ge 90 ]]; then
        echo "\033[0;31m"  # Red
    elif [[ $score -ge 70 ]]; then
        echo "\033[1;33m"  # Yellow
    elif [[ $score -ge 40 ]]; then
        echo "\033[0;36m"  # Cyan
    else
        echo "\033[0;32m"  # Green
    fi
}

# Merge and sort issues from multiple providers
# Reads newline-separated JSON arrays, merges and sorts by priority
merge_and_sort_issues() {
    jq -s 'add | sort_by(-.priority)'
}
