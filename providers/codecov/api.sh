#!/bin/bash
# providers/codecov/api.sh
# Codecov API helper functions

CODECOV_API_URL="${CODECOV_API_URL:-https://api.codecov.io}"

# Make an authenticated request to the Codecov API
# Usage: codecov_api_request "endpoint" [method]
codecov_api_request() {
    local endpoint="$1"
    local method="${2:-GET}"

    if [[ -z "$CODECOV_API_TOKEN" ]]; then
        echo '{"error": "CODECOV_API_TOKEN not set"}' >&2
        return 1
    fi

    local response
    response=$(curl -s -X "$method" \
        -H "Authorization: Bearer $CODECOV_API_TOKEN" \
        -H "Accept: application/json" \
        -H "Content-Type: application/json" \
        "${CODECOV_API_URL}${endpoint}")

    echo "$response"
}

# Get the coverage report for a repository
# Returns the full report with file-level coverage data
codecov_get_report() {
    local service="${CODECOV_SERVICE:-github}"
    local owner="${CODECOV_OWNER:-}"
    local repo="${CODECOV_REPO:-}"

    if [[ -z "$owner" || -z "$repo" ]]; then
        echo '{"error": "CODECOV_OWNER and CODECOV_REPO must be set"}' >&2
        return 1
    fi

    codecov_api_request "/api/v2/repos/${service}/${owner}/${repo}/report"
}

# Get detailed coverage for a specific file
# Usage: codecov_get_file_report "src/lib/utils.ts"
codecov_get_file_report() {
    local filepath="$1"
    local service="${CODECOV_SERVICE:-github}"
    local owner="${CODECOV_OWNER:-}"
    local repo="${CODECOV_REPO:-}"

    if [[ -z "$filepath" ]]; then
        echo '{"error": "filepath required"}' >&2
        return 1
    fi

    # URL encode the filepath
    local encoded_path
    encoded_path=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$filepath', safe=''))" 2>/dev/null || \
                   echo "$filepath" | sed 's|/|%2F|g')

    codecov_api_request "/api/v2/repos/${service}/${owner}/${repo}/file_report/${encoded_path}"
}

# Get recent commits with coverage information
# Usage: codecov_get_commits [limit]
codecov_get_commits() {
    local limit="${1:-10}"
    local service="${CODECOV_SERVICE:-github}"
    local owner="${CODECOV_OWNER:-}"
    local repo="${CODECOV_REPO:-}"

    codecov_api_request "/api/v2/repos/${service}/${owner}/${repo}/commits?page_size=${limit}"
}

# Check if the API token is valid
codecov_validate_token() {
    local response
    response=$(codecov_get_report 2>&1)

    # Check for common error responses
    if echo "$response" | jq -e '.detail' > /dev/null 2>&1; then
        local detail
        detail=$(echo "$response" | jq -r '.detail')
        echo "Codecov API error: $detail" >&2
        return 1
    fi

    # Check if we got a valid response with totals
    if echo "$response" | jq -e '.totals' > /dev/null 2>&1; then
        return 0
    fi

    echo "Unexpected Codecov API response" >&2
    return 1
}

# Get the Codecov permalink for a file
codecov_file_permalink() {
    local filepath="$1"
    local branch="${2:-main}"
    local service="${CODECOV_SERVICE:-github}"
    local owner="${CODECOV_OWNER:-}"
    local repo="${CODECOV_REPO:-}"

    echo "https://app.codecov.io/${service}/${owner}/${repo}/blob/${branch}/${filepath}"
}

# Parse API error response
codecov_parse_error() {
    local response="$1"

    # Check for detail field (standard Codecov error format)
    if echo "$response" | jq -e '.detail' > /dev/null 2>&1; then
        echo "$response" | jq -r '.detail'
        return
    fi

    # Check for error field
    if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
        echo "$response" | jq -r '.error'
        return
    fi

    # Check for message field
    if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
        echo "$response" | jq -r '.message'
        return
    fi

    echo "Unknown error"
}

# Rate limiting helper - wait if we're being rate limited
codecov_handle_rate_limit() {
    local response="$1"

    if echo "$response" | jq -e '.detail' 2>/dev/null | grep -qi "rate limit"; then
        echo "Rate limited by Codecov API, waiting 60 seconds..." >&2
        sleep 60
        return 0  # Indicate we should retry
    fi

    return 1  # No rate limiting
}
