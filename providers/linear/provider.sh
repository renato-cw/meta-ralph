#!/bin/bash
# providers/linear/provider.sh
# Linear project management provider for Meta-Ralph (PRD-10)
#
# Fetches issues from Linear via GraphQL API and normalizes them
# to the common Meta-Ralph format. Supports multi-repo features.
#
# Why this exists:
# - Linear is a popular project management tool for engineering teams
# - Linear issues often reference multiple repositories
# - Integration enables processing Linear tasks with meta-ralph

PROVIDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_DIR="$(cd "$PROVIDER_DIR/../.." && pwd)"

source "$RALPH_DIR/config.sh"
source "$RALPH_DIR/lib/priority.sh"
source "$RALPH_DIR/lib/issue-parser.sh" 2>/dev/null || true

# ============================================================================
# CONFIGURATION
# ============================================================================

# Linear API endpoint
LINEAR_API_URL="${LINEAR_API_URL:-https://api.linear.app/graphql}"

# Default states to fetch (can be overridden in .env)
LINEAR_STATES="${LINEAR_STATES:-Todo,In Progress}"

# Priority mapping (Linear uses 1-4: 1=urgent, 2=high, 3=medium, 4=low)
PRIORITY_LINEAR_URGENT="${PRIORITY_LINEAR_URGENT:-95}"
PRIORITY_LINEAR_HIGH="${PRIORITY_LINEAR_HIGH:-75}"
PRIORITY_LINEAR_MEDIUM="${PRIORITY_LINEAR_MEDIUM:-50}"
PRIORITY_LINEAR_LOW="${PRIORITY_LINEAR_LOW:-25}"

# ============================================================================
# PROVIDER INTERFACE IMPLEMENTATION
# ============================================================================

provider_name() {
    echo "linear"
}

provider_fetch() {
    # Validate required configuration
    if [[ -z "$LINEAR_API_KEY" ]]; then
        echo "Error: LINEAR_API_KEY not set" >&2
        echo "[]"
        return 1
    fi

    if [[ -z "$LINEAR_TEAM_ID" ]]; then
        echo "Error: LINEAR_TEAM_ID not set" >&2
        echo "[]"
        return 1
    fi

    # Build state filter array for GraphQL
    local states_filter
    states_filter=$(echo "$LINEAR_STATES" | tr ',' '\n' | jq -R . | jq -s . | tr -d '\n')

    # GraphQL query to fetch issues
    local query='
    query($teamId: String!, $states: [String!]) {
      team(id: $teamId) {
        issues(
          filter: {
            state: { name: { in: $states } }
          }
          first: 100
          orderBy: updatedAt
        ) {
          nodes {
            id
            identifier
            title
            description
            priority
            priorityLabel
            url
            state {
              name
              type
            }
            labels {
              nodes {
                name
                color
              }
            }
            assignee {
              name
              email
            }
            project {
              name
            }
            createdAt
            updatedAt
          }
        }
      }
    }'

    # Clean up query (remove newlines for JSON)
    query=$(echo "$query" | tr '\n' ' ' | sed 's/  */ /g')

    # Build request payload
    local payload
    payload=$(jq -n \
        --arg query "$query" \
        --arg teamId "$LINEAR_TEAM_ID" \
        --argjson states "$states_filter" \
        '{query: $query, variables: {teamId: $teamId, states: $states}}')

    # Make API request
    local response
    response=$(curl -s -X POST "$LINEAR_API_URL" \
        -H "Content-Type: application/json" \
        -H "Authorization: $LINEAR_API_KEY" \
        -d "$payload")

    # Check for errors
    if echo "$response" | jq -e '.errors' > /dev/null 2>&1; then
        echo "Linear API error: $(echo "$response" | jq -r '.errors[0].message // "Unknown error"')" >&2
        echo "[]"
        return 1
    fi

    # Extract and normalize issues
    local issues
    issues=$(echo "$response" | jq --arg provider "linear" '
        [.data.team.issues.nodes[] | {
            id: .id,
            short_id: .identifier,
            provider: $provider,
            title: .title,
            description: (.description // ""),
            location: (.state.name // "Unknown"),
            severity: (
                if .priority == 1 then "CRITICAL"
                elif .priority == 2 then "HIGH"
                elif .priority == 3 then "MEDIUM"
                else "LOW"
                end
            ),
            raw_severity: (.priority | tostring),
            count: 1,
            priority: (
                if .priority == 1 then 95
                elif .priority == 2 then 75
                elif .priority == 3 then 50
                else 25
                end
            ),
            permalink: .url,
            metadata: {
                state: .state.name,
                stateType: .state.type,
                priorityLabel: .priorityLabel,
                labels: [.labels.nodes[].name],
                assignee: .assignee.name,
                project: .project.name,
                createdAt: .createdAt,
                updatedAt: .updatedAt
            }
        }]
    ')

    # Optionally enrich with multi-repo info (if issue-parser is available)
    if declare -f enrich_issue_with_repos >/dev/null 2>&1; then
        # Process each issue through the parser for multi-repo detection
        echo "$issues" | jq -c '.[]' | while read -r issue; do
            # Quick check if issue might reference repos
            if echo "$issue" | "$RALPH_DIR/lib/issue-parser.sh" check 2>/dev/null | grep -q "yes"; then
                # Enrich with repo info
                echo "$issue" | "$RALPH_DIR/lib/issue-parser.sh" enrich 2>/dev/null
            else
                echo "$issue"
            fi
        done | jq -s '.'
    else
        echo "$issues"
    fi
}

provider_gen_prd() {
    local issue_json="$1"

    local issue_id=$(echo "$issue_json" | jq -r '.short_id // .id')
    local title=$(echo "$issue_json" | jq -r '.title')
    local description=$(echo "$issue_json" | jq -r '.description // ""')
    local severity=$(echo "$issue_json" | jq -r '.severity')
    local state=$(echo "$issue_json" | jq -r '.metadata.state // "Unknown"')
    local project=$(echo "$issue_json" | jq -r '.metadata.project // "Unknown"')
    local labels=$(echo "$issue_json" | jq -r '.metadata.labels | join(", ") // ""')
    local permalink=$(echo "$issue_json" | jq -r '.permalink // ""')

    # Multi-repo fields
    local target_repo=$(echo "$issue_json" | jq -r '.target_repo.full_name // "current"')
    local context_repos=$(echo "$issue_json" | jq -r '.context_repos[]?.full_name // empty' | tr '\n' ', ' | sed 's/,$//')
    local action_type=$(echo "$issue_json" | jq -r '.parsed_action.type // "fix"')
    local action_desc=$(echo "$issue_json" | jq -r '.parsed_action.description // ""')

    cat << EOF
# Task PRD - $issue_id

## Overview
**Issue ID:** $issue_id
**Provider:** Linear
**Project:** $project
**State:** $state
**Priority:** $severity
**Labels:** ${labels:-None}
**Linear Link:** $permalink

EOF

    # Add multi-repo context if present
    if [[ "$target_repo" != "current" && -n "$target_repo" ]]; then
        cat << EOF
## Multi-Repository Context
**Target Repository:** $target_repo (where changes will be made)
**Context Repositories:** ${context_repos:-None}
**Action Type:** $action_type
${action_desc:+**Action:** $action_desc}

EOF
    fi

    cat << EOF
## Task Description
$title

## Details
$description

## Requirements

### Must Have
- [ ] Complete the task as described
- [ ] Ensure changes are correct and complete
- [ ] Code must pass linting/build checks
- [ ] Commit with descriptive message

### Should Have
- [ ] Add tests if applicable
- [ ] Update documentation if needed

### Must NOT Do
- [ ] Do NOT make unrelated changes
- [ ] Do NOT break existing functionality
- [ ] Do NOT modify files outside the scope of this task

## Success Criteria
1. The task is fully completed
2. Build/lint checks pass
3. Changes are committed with clear message

## Instructions for AI Agent
1. Read and understand the task
EOF

    if [[ "$target_repo" != "current" && -n "$target_repo" ]]; then
        cat << EOF
2. You are working in repository: $target_repo
3. If context repos exist, use them for reference data only
EOF
    fi

    cat << EOF
4. Implement the required changes
5. Run appropriate build/lint commands for the project type
6. Commit: \`${action_type}: ${title:0:50}\`
7. When complete, output: <promise>COMPLETE</promise>
EOF
}

provider_branch_name() {
    local issue_json="$1"
    local short_id=$(echo "$issue_json" | jq -r '.short_id // .id')

    # Sanitize ID for branch name (lowercase, alphanumeric and hyphens only)
    local safe_id
    safe_id=$(echo "$short_id" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')

    echo "task/linear-$safe_id"
}

provider_pr_body() {
    local issue_json="$1"

    local issue_id=$(echo "$issue_json" | jq -r '.short_id // .id')
    local title=$(echo "$issue_json" | jq -r '.title')
    local severity=$(echo "$issue_json" | jq -r '.severity')
    local permalink=$(echo "$issue_json" | jq -r '.permalink // ""')
    local action_type=$(echo "$issue_json" | jq -r '.parsed_action.type // "task"')
    local target_repo=$(echo "$issue_json" | jq -r '.target_repo.full_name // ""')

    cat << EOF
## $action_type - Linear Issue

**Issue ID:** $issue_id
**Linear:** $permalink
**Priority:** $severity
EOF

    if [[ -n "$target_repo" ]]; then
        cat << EOF
**Target Repository:** $target_repo
EOF
    fi

    cat << EOF

### Description
$title

### Changes
This PR addresses the task from Linear.

### Testing
- [ ] Changes reviewed
- [ ] Build passes
- [ ] Manual verification complete

---
*This PR was automatically generated by Meta-Ralph (Linear provider)*
EOF
}
