#!/bin/bash
# lib/provider.sh
# Base interface for Ralph providers
# Each provider must implement these functions

# ============================================================================
# PROVIDER INTERFACE
# ============================================================================
# Each provider must implement:
#
# provider_name()
#   Returns the provider name (e.g., "zeropath", "sentry")
#
# provider_fetch()
#   Fetches issues and returns JSON array with normalized format:
#   [
#     {
#       "id": "unique-id",
#       "provider": "provider-name",
#       "title": "Issue title",
#       "description": "Detailed description",
#       "location": "file/function affected",
#       "severity": "CRITICAL|HIGH|MEDIUM|LOW|INFO",
#       "raw_severity": <number or string>,
#       "count": <occurrence count>,
#       "priority": <0-100>,
#       "permalink": "url to issue",
#       "metadata": { ... provider-specific data ... }
#     }
#   ]
#
# provider_gen_prd(issue_json)
#   Generates a PRD markdown for the given issue
#
# provider_branch_name(issue_json)
#   Returns the branch name for this issue (e.g., "sec/zeropath-xxx")
#
# provider_pr_body(issue_json)
#   Returns the PR body template for this issue
# ============================================================================

# Validate that a provider implements required functions
validate_provider() {
    local provider_dir="$1"
    local provider_script="$provider_dir/provider.sh"

    if [[ ! -f "$provider_script" ]]; then
        echo "ERROR: Provider script not found: $provider_script" >&2
        return 1
    fi

    # Source the provider
    source "$provider_script"

    # Check required functions
    local required_functions=("provider_name" "provider_fetch" "provider_gen_prd" "provider_branch_name")

    for func in "${required_functions[@]}"; do
        if ! declare -f "$func" > /dev/null; then
            echo "ERROR: Provider missing required function: $func" >&2
            return 1
        fi
    done

    return 0
}

# Load a provider
load_provider() {
    local provider_name="$1"
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    local provider_dir="$script_dir/providers/$provider_name"

    if validate_provider "$provider_dir"; then
        source "$provider_dir/provider.sh"
        return 0
    fi

    return 1
}

# List available providers
list_providers() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
    local providers_dir="$script_dir/providers"

    for provider_dir in "$providers_dir"/*/; do
        if [[ -f "$provider_dir/provider.sh" ]]; then
            basename "$provider_dir"
        fi
    done
}

# Normalize severity string
normalize_severity() {
    local severity="$1"

    case "$severity" in
        CRITICAL|critical|FATAL|fatal)
            echo "CRITICAL"
            ;;
        HIGH|high|ERROR|error)
            echo "HIGH"
            ;;
        MEDIUM|medium|WARNING|warning)
            echo "MEDIUM"
            ;;
        LOW|low|INFO|info)
            echo "LOW"
            ;;
        *)
            # Try to parse as number
            if [[ "$severity" =~ ^[0-9]+\.?[0-9]*$ ]]; then
                local num=${severity%.*}
                if [[ $num -ge 9 ]]; then
                    echo "CRITICAL"
                elif [[ $num -ge 7 ]]; then
                    echo "HIGH"
                elif [[ $num -ge 4 ]]; then
                    echo "MEDIUM"
                else
                    echo "LOW"
                fi
            else
                echo "INFO"
            fi
            ;;
    esac
}
