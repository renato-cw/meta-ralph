#!/bin/bash
# providers/sentry/provider.sh
# Sentry error monitoring provider for Meta-Ralph

PROVIDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_DIR="$(cd "$PROVIDER_DIR/../.." && pwd)"

source "$RALPH_DIR/config.sh"
source "$RALPH_DIR/lib/priority.sh"

# ============================================================================
# PROVIDER INTERFACE IMPLEMENTATION
# ============================================================================

provider_name() {
    echo "sentry"
}

provider_fetch() {
    local query="${SENTRY_QUERY:-is:unresolved environment:production}"
    local limit="${SENTRY_LIMIT:-100}"

    # URL-encode the query
    local encoded_query=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query', safe=''))")

    local response=$(curl -s \
        -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
        "$SENTRY_API_URL/projects/$SENTRY_ORGANIZATION/$SENTRY_PROJECT/issues/?query=$encoded_query&limit=$limit")

    # Check for valid response
    if ! echo "$response" | jq -e 'type == "array"' > /dev/null 2>&1; then
        echo "Sentry API error: $response" >&2
        echo "[]"
        return
    fi

    # Normalize to common format
    echo "$response" | jq --arg provider "sentry" '[.[] | {
        id: .id,
        short_id: .shortId,
        provider: $provider,
        title: .title,
        description: (.metadata.value // .title),
        location: .culprit,
        severity: (
            if .level == "fatal" then "CRITICAL"
            elif .level == "error" then "HIGH"
            elif .level == "warning" then "MEDIUM"
            else "LOW"
            end
        ),
        raw_severity: .level,
        count: (.count | tonumber),
        priority: (
            if .level == "fatal" then 85
            elif .level == "error" and (.count | tonumber) > 100 then 65
            elif .level == "error" then 50
            elif .level == "warning" then 30
            else 10
            end
        ),
        permalink: .permalink,
        metadata: {
            level: .level,
            firstSeen: .firstSeen,
            lastSeen: .lastSeen,
            userCount: .userCount,
            errorType: .metadata.type,
            filename: .metadata.filename,
            function: .metadata.function
        }
    }]'
}

provider_gen_prd() {
    local issue_json="$1"

    local issue_id=$(echo "$issue_json" | jq -r '.id')
    local short_id=$(echo "$issue_json" | jq -r '.short_id // .id')
    local title=$(echo "$issue_json" | jq -r '.title')
    local description=$(echo "$issue_json" | jq -r '.description // ""')
    local severity=$(echo "$issue_json" | jq -r '.severity')
    local level=$(echo "$issue_json" | jq -r '.raw_severity // "error"')
    local location=$(echo "$issue_json" | jq -r '.location // "Unknown"')
    local count=$(echo "$issue_json" | jq -r '.count // 0')
    local permalink=$(echo "$issue_json" | jq -r '.permalink // ""')
    local first_seen=$(echo "$issue_json" | jq -r '.metadata.firstSeen // "Unknown"')
    local last_seen=$(echo "$issue_json" | jq -r '.metadata.lastSeen // "Unknown"')
    local user_count=$(echo "$issue_json" | jq -r '.metadata.userCount // 0')

    # Try to fetch stacktrace from latest event
    local stacktrace=""
    if [[ -n "$issue_id" && "$issue_id" != "null" ]]; then
        local event_response=$(curl -s \
            -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
            "$SENTRY_API_URL/issues/$issue_id/events/latest/" 2>/dev/null || echo "{}")

        if echo "$event_response" | jq -e '.eventID' > /dev/null 2>&1; then
            stacktrace=$(echo "$event_response" | jq -r '
                .entries[]? |
                select(.type == "exception") |
                .data.values[]? |
                .stacktrace.frames[]? |
                select(.inApp == true) |
                "  \(.filename // "?"):\(.lineNo // "?") in \(.function // "?")"
            ' 2>/dev/null | head -20 || echo "")
        fi
    fi

    cat << EOF
# Error Fix PRD - $short_id

## Overview
**Issue ID:** $issue_id
**Short ID:** $short_id
**Provider:** Sentry Error Monitoring
**Severity:** $severity
**Level:** $level
**Occurrences:** $count
**Users Affected:** $user_count
**First Seen:** $first_seen
**Last Seen:** $last_seen
**Sentry Link:** $permalink

## Problem Statement
$title

## Error Details
$description

**Location:** $location

EOF

    if [[ -n "$stacktrace" ]]; then
        cat << EOF
## Stack Trace (App Frames)
\`\`\`
$stacktrace
\`\`\`

EOF
    fi

    cat << EOF
## Requirements

### Must Have
- [ ] Fix the error in the identified location
- [ ] Ensure no regression in existing functionality
- [ ] Code must pass \`cargo clippy -- -D warnings\`
- [ ] Code must compile with \`cargo build\`

### Should Have
- [ ] Add appropriate error handling if missing
- [ ] Add logging for debugging similar issues
- [ ] Consider adding tests for the fix

### Must NOT Do
- [ ] Do NOT suppress errors without proper handling
- [ ] Do NOT introduce new dependencies unless necessary
- [ ] Do NOT refactor unrelated code

## Success Criteria
1. The error no longer occurs
2. Clippy passes without warnings
3. The fix follows project conventions (see CLAUDE.md)
4. Proper error handling is in place

## Technical Context
This is a Rust project (infinitepay-scfi) - a critical financial system.
Proper error handling is essential.

## Instructions for AI Agent
1. Read and understand the error
2. Locate the affected file: \`$location\`
3. Analyze the error pattern and root cause
4. Implement a proper fix with error handling
5. Run \`cargo clippy -- -D warnings\`
6. Run \`cargo build\`
7. Run \`cargo test\` if applicable
8. Commit: \`fix: resolve $short_id - ${title:0:40}\`
9. When complete, output: <promise>COMPLETE</promise>
EOF
}

provider_branch_name() {
    local issue_json="$1"
    local short_id=$(echo "$issue_json" | jq -r '.short_id // .id')

    # Sanitize for branch name
    local safe_id=$(echo "$short_id" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')
    echo "fix/sentry-$safe_id"
}

provider_pr_body() {
    local issue_json="$1"

    local issue_id=$(echo "$issue_json" | jq -r '.id')
    local short_id=$(echo "$issue_json" | jq -r '.short_id // .id')
    local title=$(echo "$issue_json" | jq -r '.title')
    local level=$(echo "$issue_json" | jq -r '.raw_severity // "error"')
    local count=$(echo "$issue_json" | jq -r '.count // 0')
    local location=$(echo "$issue_json" | jq -r '.location // "Unknown"')
    local permalink=$(echo "$issue_json" | jq -r '.permalink // ""')

    cat << EOF
## Error Fix - Sentry Issue

**Issue ID:** $short_id
**Level:** $level
**Occurrences:** $count
**Location:** $location

### Description
$title

### Changes
This PR fixes the error identified by Sentry monitoring.

### Testing
- [ ] cargo clippy passes
- [ ] cargo build succeeds
- [ ] Manual review of the fix

### Sentry Link
$permalink

---
*This PR was automatically generated by Meta-Ralph (Sentry provider)*
EOF
}
