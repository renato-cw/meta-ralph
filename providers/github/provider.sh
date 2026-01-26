#!/bin/bash
# providers/github/provider.sh
# GitHub Issues provider for Meta-Ralph (PRD-10)
#
# Fetches issues from GitHub Issues API and normalizes them
# to the common Meta-Ralph format. Supports label-based prioritization.
#
# Why this exists:
# - GitHub Issues is a widely used issue tracking system
# - Many teams use GitHub Issues for bug tracking and feature requests
# - Integration enables processing GitHub issues with meta-ralph

PROVIDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_DIR="$(cd "$PROVIDER_DIR/../.." && pwd)"

source "$RALPH_DIR/config.sh"
source "$RALPH_DIR/lib/priority.sh"
source "$RALPH_DIR/lib/issue-parser.sh" 2>/dev/null || true

# ============================================================================
# CONFIGURATION
# ============================================================================

# GitHub API endpoint
GITHUB_API_URL="${GITHUB_API_URL:-https://api.github.com}"

# Repository to fetch issues from (can be overridden)
GITHUB_REPO="${GITHUB_REPO:-}"
GITHUB_OWNER="${GITHUB_OWNER:-}"

# Default labels to filter by (comma-separated, empty = all)
GITHUB_LABELS="${GITHUB_LABELS:-}"

# Issue state filter
GITHUB_STATE="${GITHUB_STATE:-open}"

# Priority mapping based on labels
PRIORITY_GITHUB_SECURITY="${PRIORITY_GITHUB_SECURITY:-95}"
PRIORITY_GITHUB_CRITICAL="${PRIORITY_GITHUB_CRITICAL:-90}"
PRIORITY_GITHUB_BUG="${PRIORITY_GITHUB_BUG:-60}"
PRIORITY_GITHUB_HIGH="${PRIORITY_GITHUB_HIGH:-70}"
PRIORITY_GITHUB_MEDIUM="${PRIORITY_GITHUB_MEDIUM:-50}"
PRIORITY_GITHUB_LOW="${PRIORITY_GITHUB_LOW:-30}"
PRIORITY_GITHUB_ENHANCEMENT="${PRIORITY_GITHUB_ENHANCEMENT:-20}"
PRIORITY_GITHUB_DEFAULT="${PRIORITY_GITHUB_DEFAULT:-25}"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

# Calculate priority from issue labels
# Args: labels (JSON array of label names)
calculate_priority() {
    local labels="$1"

    # Check for security-related labels first (highest priority)
    if echo "$labels" | jq -e 'map(ascii_downcase) | any(. | contains("security") or contains("vulnerability") or contains("cve"))' >/dev/null 2>&1; then
        echo "$PRIORITY_GITHUB_SECURITY"
        return
    fi

    # Check for critical/urgent labels
    if echo "$labels" | jq -e 'map(ascii_downcase) | any(. | contains("critical") or contains("urgent") or contains("p0"))' >/dev/null 2>&1; then
        echo "$PRIORITY_GITHUB_CRITICAL"
        return
    fi

    # Check for high priority
    if echo "$labels" | jq -e 'map(ascii_downcase) | any(. | contains("high") or contains("p1") or contains("priority:high"))' >/dev/null 2>&1; then
        echo "$PRIORITY_GITHUB_HIGH"
        return
    fi

    # Check for bug labels
    if echo "$labels" | jq -e 'map(ascii_downcase) | any(. | contains("bug") or contains("defect") or contains("error"))' >/dev/null 2>&1; then
        echo "$PRIORITY_GITHUB_BUG"
        return
    fi

    # Check for medium priority
    if echo "$labels" | jq -e 'map(ascii_downcase) | any(. | contains("medium") or contains("p2") or contains("priority:medium"))' >/dev/null 2>&1; then
        echo "$PRIORITY_GITHUB_MEDIUM"
        return
    fi

    # Check for low priority
    if echo "$labels" | jq -e 'map(ascii_downcase) | any(. | contains("low") or contains("p3") or contains("priority:low"))' >/dev/null 2>&1; then
        echo "$PRIORITY_GITHUB_LOW"
        return
    fi

    # Check for enhancement labels (lower priority)
    if echo "$labels" | jq -e 'map(ascii_downcase) | any(. | contains("enhancement") or contains("feature") or contains("improvement"))' >/dev/null 2>&1; then
        echo "$PRIORITY_GITHUB_ENHANCEMENT"
        return
    fi

    # Default priority
    echo "$PRIORITY_GITHUB_DEFAULT"
}

# Get severity label from priority
get_severity() {
    local priority="$1"

    if [[ $priority -ge 90 ]]; then
        echo "CRITICAL"
    elif [[ $priority -ge 70 ]]; then
        echo "HIGH"
    elif [[ $priority -ge 50 ]]; then
        echo "MEDIUM"
    elif [[ $priority -ge 30 ]]; then
        echo "LOW"
    else
        echo "INFO"
    fi
}

# ============================================================================
# PROVIDER INTERFACE IMPLEMENTATION
# ============================================================================

provider_name() {
    echo "github"
}

provider_fetch() {
    # Get auth token (try GITHUB_TOKEN first, then GH_TOKEN)
    local auth_token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"

    # Validate required configuration
    if [[ -z "$auth_token" ]]; then
        echo "Error: GITHUB_TOKEN or GH_TOKEN not set" >&2
        echo "[]"
        return 1
    fi

    if [[ -z "$GITHUB_OWNER" ]] || [[ -z "$GITHUB_REPO" ]]; then
        echo "Error: GITHUB_OWNER and GITHUB_REPO must be set" >&2
        echo "[]"
        return 1
    fi

    # Build API URL
    local api_url="$GITHUB_API_URL/repos/$GITHUB_OWNER/$GITHUB_REPO/issues"

    # Add query parameters
    local params="state=$GITHUB_STATE&per_page=100"
    if [[ -n "$GITHUB_LABELS" ]]; then
        params="$params&labels=$GITHUB_LABELS"
    fi

    api_url="$api_url?$params"

    # Make API request
    local response
    response=$(curl -s -H "Authorization: Bearer $auth_token" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "$api_url")

    # Check for errors
    if echo "$response" | jq -e '.message' > /dev/null 2>&1; then
        local error_msg
        error_msg=$(echo "$response" | jq -r '.message')
        echo "GitHub API error: $error_msg" >&2
        echo "[]"
        return 1
    fi

    # Filter out pull requests (GitHub API returns both issues and PRs)
    local issues
    issues=$(echo "$response" | jq '[.[] | select(.pull_request == null)]')

    # Normalize to common format
    echo "$issues" | jq --arg provider "github" --arg owner "$GITHUB_OWNER" --arg repo "$GITHUB_REPO" '
        [.[] | {
            id: .id | tostring,
            short_id: ("#" + (.number | tostring)),
            provider: $provider,
            title: .title,
            description: (.body // ""),
            location: ($owner + "/" + $repo),
            labels_raw: [.labels[].name],
            permalink: .html_url,
            metadata: {
                number: .number,
                state: .state,
                labels: [.labels[].name],
                assignee: (.assignee.login // null),
                assignees: [.assignees[].login],
                milestone: (.milestone.title // null),
                createdAt: .created_at,
                updatedAt: .updated_at,
                comments: .comments,
                author: .user.login
            }
        }]
    ' | jq 'map(
        . + {
            raw_severity: (.labels_raw | join(",")),
            count: (.metadata.comments + 1)
        } | del(.labels_raw)
    )' | while IFS= read -r line; do
        # Process each issue to add priority and severity
        echo "$line" | jq -c '.[]' | while read -r issue; do
            local labels
            labels=$(echo "$issue" | jq '.metadata.labels')
            local priority
            priority=$(calculate_priority "$labels")
            local severity
            severity=$(get_severity "$priority")

            echo "$issue" | jq --arg priority "$priority" --arg severity "$severity" '
                . + {priority: ($priority | tonumber), severity: $severity}
            '
        done | jq -s '.'
    done
}

provider_gen_prd() {
    local issue_json="$1"

    local issue_id=$(echo "$issue_json" | jq -r '.short_id // .id')
    local title=$(echo "$issue_json" | jq -r '.title')
    local description=$(echo "$issue_json" | jq -r '.description // ""')
    local severity=$(echo "$issue_json" | jq -r '.severity')
    local location=$(echo "$issue_json" | jq -r '.location // ""')
    local labels=$(echo "$issue_json" | jq -r '.metadata.labels | join(", ") // ""')
    local milestone=$(echo "$issue_json" | jq -r '.metadata.milestone // "None"')
    local permalink=$(echo "$issue_json" | jq -r '.permalink // ""')
    local author=$(echo "$issue_json" | jq -r '.metadata.author // "Unknown"')

    # Multi-repo fields
    local target_repo=$(echo "$issue_json" | jq -r '.target_repo.full_name // "current"')
    local context_repos=$(echo "$issue_json" | jq -r '.context_repos[]?.full_name // empty' | tr '\n' ', ' | sed 's/,$//')
    local action_type=$(echo "$issue_json" | jq -r '.parsed_action.type // "fix"')

    cat << EOF
# Issue PRD - $issue_id

## Overview
**Issue ID:** $issue_id
**Provider:** GitHub Issues
**Repository:** $location
**Priority:** $severity
**Labels:** ${labels:-None}
**Milestone:** $milestone
**Author:** $author
**Link:** $permalink

EOF

    # Add multi-repo context if present
    if [[ "$target_repo" != "current" && -n "$target_repo" ]]; then
        cat << EOF
## Multi-Repository Context
**Target Repository:** $target_repo (where changes will be made)
**Context Repositories:** ${context_repos:-None}
**Action Type:** $action_type

EOF
    fi

    cat << EOF
## Issue Description
$title

## Details
$description

## Requirements

### Must Have
- [ ] Address the issue as described
- [ ] Ensure no regression in existing functionality
- [ ] Code must pass linting and tests
- [ ] Commit with descriptive message referencing the issue

### Should Have
- [ ] Add tests for the fix/feature
- [ ] Update documentation if needed

### Must NOT Do
- [ ] Do NOT make unrelated changes
- [ ] Do NOT introduce breaking changes without discussion
- [ ] Do NOT modify unrelated files

## Success Criteria
1. The issue is resolved
2. Build and tests pass
3. Changes are clean and follow project conventions

## Instructions for AI Agent
1. Read and understand the issue
2. Locate the relevant code
3. Implement the fix or feature
4. Run tests and linting
5. Commit: \`${action_type}($issue_id): ${title:0:40}\`
6. When complete, output: <promise>COMPLETE</promise>
EOF
}

provider_branch_name() {
    local issue_json="$1"
    local number=$(echo "$issue_json" | jq -r '.metadata.number // .id')
    local labels=$(echo "$issue_json" | jq -r '.metadata.labels | join(",") | ascii_downcase')

    # Determine branch prefix based on labels
    local prefix="issue"
    if echo "$labels" | grep -q "bug"; then
        prefix="fix"
    elif echo "$labels" | grep -q "security"; then
        prefix="sec"
    elif echo "$labels" | grep -q "enhancement\|feature"; then
        prefix="feat"
    elif echo "$labels" | grep -q "docs\|documentation"; then
        prefix="docs"
    fi

    echo "$prefix/gh-$number"
}

provider_pr_body() {
    local issue_json="$1"

    local issue_id=$(echo "$issue_json" | jq -r '.short_id // .id')
    local issue_number=$(echo "$issue_json" | jq -r '.metadata.number')
    local title=$(echo "$issue_json" | jq -r '.title')
    local severity=$(echo "$issue_json" | jq -r '.severity')
    local permalink=$(echo "$issue_json" | jq -r '.permalink // ""')
    local labels=$(echo "$issue_json" | jq -r '.metadata.labels | join(", ") // ""')

    cat << EOF
## Fix - GitHub Issue $issue_id

**Issue:** $permalink
**Priority:** $severity
**Labels:** ${labels:-None}

### Description
$title

### Changes
This PR addresses GitHub Issue $issue_id.

Closes #$issue_number

### Testing
- [ ] Changes reviewed
- [ ] Build passes
- [ ] Tests pass
- [ ] Manual verification complete

---
*This PR was automatically generated by Meta-Ralph (GitHub provider)*
EOF
}
