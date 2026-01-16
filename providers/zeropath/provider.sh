#!/bin/bash
# providers/zeropath/provider.sh
# Zeropath security scanner provider for Meta-Ralph

PROVIDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_DIR="$(cd "$PROVIDER_DIR/../.." && pwd)"

source "$RALPH_DIR/config.sh"
source "$RALPH_DIR/lib/priority.sh"

# ============================================================================
# PROVIDER INTERFACE IMPLEMENTATION
# ============================================================================

provider_name() {
    echo "zeropath"
}

provider_fetch() {
    local page_size=100
    local all_issues="[]"
    local current_page=1
    local has_more=true

    while [[ "$has_more" == "true" ]]; do
        local response=$(curl -s -X POST "$ZEROPATH_API_URL/issues/search" \
            -H "Content-Type: application/json" \
            -H "X-ZeroPath-API-Token-Id: $ZEROPATH_API_TOKEN_ID" \
            -H "X-ZeroPath-API-Token-Secret: $ZEROPATH_API_TOKEN_SECRET" \
            -d "{
                \"organizationId\": \"$ZEROPATH_ORGANIZATION_ID\",
                \"repositoryIds\": [\"$ZEROPATH_REPOSITORY_ID\"],
                \"page\": $current_page,
                \"pageSize\": $page_size,
                \"severities\": {\"min\": 0, \"max\": 10},
                \"sortBy\": \"score\",
                \"sortOrder\": \"desc\",
                \"types\": [\"open\"],
                \"getCounts\": true,
                \"returnAll\": false
            }")

        # Check for error
        if echo "$response" | jq -e '.error' > /dev/null 2>&1; then
            echo "Zeropath API error: $(echo "$response" | jq -r '.error')" >&2
            break
        fi

        # Extract issues
        local page_issues=$(echo "$response" | jq '.issues // []')
        local issue_count=$(echo "$page_issues" | jq 'length')

        if [[ "$issue_count" -gt 0 ]]; then
            all_issues=$(echo "$all_issues" "$page_issues" | jq -s 'add')

            local total_count=$(echo "$response" | jq '.totalCount // 0')
            local total_pages=$(( (total_count + page_size - 1) / page_size ))

            if [[ "$current_page" -lt "$total_pages" ]]; then
                current_page=$((current_page + 1))
                sleep 0.5
            else
                has_more=false
            fi
        else
            has_more=false
        fi
    done

    # Normalize to common format
    echo "$all_issues" | jq --arg provider "zeropath" '[.[] | {
        id: .id,
        provider: $provider,
        title: .generatedTitle,
        description: .generatedDescription,
        location: .affectedFile,
        severity: (
            if .severity >= 9 then "CRITICAL"
            elif .severity >= 7 then "HIGH"
            elif .severity >= 4 then "MEDIUM"
            else "LOW"
            end
        ),
        raw_severity: .severity,
        count: 1,
        priority: (
            if .severity >= 9 then 100
            elif .severity >= 7 then 90
            elif .severity >= 4 then 70
            else 20
            end
        ),
        permalink: "https://zeropath.com",
        metadata: {
            vulnClass: .vulnClass,
            codeSnippet: .codeSnippet,
            fixRecommendation: .fixRecommendation,
            createdAt: .createdAt
        }
    }]'
}

provider_gen_prd() {
    local issue_json="$1"

    local issue_id=$(echo "$issue_json" | jq -r '.id')
    local title=$(echo "$issue_json" | jq -r '.title')
    local description=$(echo "$issue_json" | jq -r '.description // "No description"')
    local severity=$(echo "$issue_json" | jq -r '.severity')
    local raw_severity=$(echo "$issue_json" | jq -r '.raw_severity')
    local location=$(echo "$issue_json" | jq -r '.location // "Unknown"')
    local vuln_class=$(echo "$issue_json" | jq -r '.metadata.vulnClass // "Unknown"')
    local code_snippet=$(echo "$issue_json" | jq -r '.metadata.codeSnippet // ""')
    local fix_recommendation=$(echo "$issue_json" | jq -r '.metadata.fixRecommendation // ""')

    cat << EOF
# Security Fix PRD - $issue_id

## Overview
**Issue ID:** $issue_id
**Provider:** Zeropath Security Scanner
**Severity:** $severity (Score: $raw_severity)
**Vulnerability Class:** $vuln_class
**Affected File:** $location

## Problem Statement
$title

## Detailed Description
$description

EOF

    if [[ -n "$code_snippet" && "$code_snippet" != "null" ]]; then
        cat << EOF
## Vulnerable Code
\`\`\`
$code_snippet
\`\`\`

EOF
    fi

    if [[ -n "$fix_recommendation" && "$fix_recommendation" != "null" ]]; then
        cat << EOF
## Suggested Fix
$fix_recommendation

EOF
    fi

    cat << EOF
## Requirements

### Must Have
- [ ] Fix the security vulnerability in \`$location\`
- [ ] Ensure no regression in existing functionality
- [ ] Code must pass \`cargo clippy -- -D warnings\`
- [ ] Code must compile with \`cargo build\`

### Should Have
- [ ] Add appropriate test coverage for the fix
- [ ] Follow secure coding best practices

### Must NOT Do
- [ ] Do NOT introduce new dependencies unless absolutely necessary
- [ ] Do NOT refactor unrelated code
- [ ] Do NOT change public APIs unless required for the fix

## Success Criteria
1. The vulnerability is remediated
2. Clippy passes without warnings
3. The fix follows project conventions (see CLAUDE.md)

## Technical Context
This is a Rust project (infinitepay-scfi) - a critical financial system.
Security and data integrity are paramount.

## Instructions for AI Agent
1. Read and understand the vulnerability
2. Locate the affected file: \`$location\`
3. Analyze the vulnerable code pattern
4. Implement a secure fix following OWASP guidelines
5. Run \`cargo clippy -- -D warnings\`
6. Run \`cargo build\`
7. Run \`cargo test\` if applicable
8. Commit: \`fix(security): resolve $vuln_class vulnerability\`
9. When complete, output: <promise>COMPLETE</promise>
EOF
}

provider_branch_name() {
    local issue_json="$1"
    local issue_id=$(echo "$issue_json" | jq -r '.id')
    echo "sec/zeropath-${issue_id:0:12}"
}

provider_pr_body() {
    local issue_json="$1"

    local issue_id=$(echo "$issue_json" | jq -r '.id')
    local title=$(echo "$issue_json" | jq -r '.title')
    local severity=$(echo "$issue_json" | jq -r '.severity')
    local raw_severity=$(echo "$issue_json" | jq -r '.raw_severity')
    local vuln_class=$(echo "$issue_json" | jq -r '.metadata.vulnClass // "Security Issue"')

    cat << EOF
## Security Fix - Zeropath Issue

**Issue ID:** $issue_id
**Vulnerability:** $vuln_class
**Severity:** $severity ($raw_severity)

### Description
$title

### Changes
This PR fixes the security vulnerability identified by Zeropath scanner.

### Testing
- [ ] cargo clippy passes
- [ ] cargo build succeeds
- [ ] Manual review of the fix

---
*This PR was automatically generated by Meta-Ralph (Zeropath provider)*
EOF
}
