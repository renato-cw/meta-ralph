#!/bin/bash
# providers/codecov/provider.sh
# Codecov coverage provider for Meta-Ralph
# Identifies files with low test coverage and generates PRDs for improving coverage

PROVIDER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_DIR="$(cd "$PROVIDER_DIR/../.." && pwd)"

# Source dependencies
source "$RALPH_DIR/config.sh"
source "$RALPH_DIR/lib/priority.sh"
source "$PROVIDER_DIR/api.sh"
source "$PROVIDER_DIR/priority.sh"
source "$PROVIDER_DIR/test-detection.sh"

# ============================================================================
# PROVIDER INTERFACE IMPLEMENTATION
# ============================================================================

provider_name() {
    echo "codecov"
}

provider_fetch() {
    local min_coverage="${CODECOV_MIN_COVERAGE:-50}"
    local max_files="${CODECOV_MAX_FILES:-20}"
    local exclude_pattern="${CODECOV_EXCLUDE_PATTERNS:-}"
    local critical_paths="${CODECOV_CRITICAL_PATHS:-}"

    # Validate required config - return 0 with empty array to avoid double [] from fallback
    if [[ -z "$CODECOV_API_TOKEN" ]]; then
        echo "Error: CODECOV_API_TOKEN not set" >&2
        echo "[]"
        return 0
    fi

    if [[ -z "$CODECOV_OWNER" || -z "$CODECOV_REPO" ]]; then
        echo "Error: CODECOV_OWNER and CODECOV_REPO must be set" >&2
        echo "[]"
        return 0
    fi

    # Fetch coverage report from Codecov API
    local report
    report=$(codecov_get_report)

    # Check for API error - return 0 with empty array to avoid double [] from fallback
    if echo "$report" | jq -e '.detail' > /dev/null 2>&1; then
        local error_msg
        error_msg=$(codecov_parse_error "$report")
        echo "Codecov API error: $error_msg" >&2
        echo "[]"
        return 0
    fi

    # Check if we have files in the response
    if ! echo "$report" | jq -e '.files' > /dev/null 2>&1; then
        echo "No coverage data found in Codecov response" >&2
        echo "[]"
        return 0
    fi

    # Convert exclude patterns from comma-separated to regex OR pattern
    local exclude_regex=""
    if [[ -n "$exclude_pattern" ]]; then
        # Convert glob patterns to regex and join with |
        exclude_regex=$(echo "$exclude_pattern" | \
            sed 's/\./\\./g' | \
            sed 's/\*/[^/]*/g' | \
            tr ',' '|')
    fi

    # Convert critical paths to regex pattern
    local critical_regex=""
    if [[ -n "$critical_paths" ]]; then
        critical_regex=$(echo "$critical_paths" | tr ',' '|')
    fi

    local service="${CODECOV_SERVICE:-github}"
    local owner="${CODECOV_OWNER}"
    local repo="${CODECOV_REPO}"
    local base_url="https://app.codecov.io/${service}/${owner}/${repo}"

    # Filter and transform files using jq
    echo "$report" | jq --arg provider "codecov" \
        --argjson min "$min_coverage" \
        --argjson max "$max_files" \
        --arg exclude "$exclude_regex" \
        --arg critical "$critical_regex" \
        --arg base_url "$base_url" \
    '[
        .files[]
        | select(.totals != null)
        | select(.totals.coverage != null)
        | select(.totals.coverage < $min)
        | select(if $exclude != "" then (.name | test($exclude; "i") | not) else true end)
        | {
            id: ("codecov-" + (.name | gsub("/"; "-") | gsub("\\."; "-") | gsub("[^a-zA-Z0-9-]"; ""))),
            provider: $provider,
            title: ("Low coverage: " + .name + " (" + ((.totals.coverage | floor | tostring)) + "%)"),
            description: ("File has " + ((.totals.coverage | floor | tostring)) + "% line coverage. " + ((.totals.misses // 0) | tostring) + " of " + ((.totals.lines // 0) | tostring) + " lines uncovered."),
            location: .name,
            severity: (
                if .totals.coverage <= 20 then "CRITICAL"
                elif .totals.coverage <= 40 then "HIGH"
                elif .totals.coverage <= 60 then "MEDIUM"
                elif .totals.coverage <= 80 then "LOW"
                else "INFO"
                end
            ),
            raw_severity: .totals.coverage,
            count: (.totals.misses // 0),
            priority: ((100 - .totals.coverage) | floor),
            permalink: ($base_url + "/blob/main/" + .name),
            metadata: {
                coverage_percent: .totals.coverage,
                lines_covered: (.totals.hits // 0),
                lines_missed: (.totals.misses // 0),
                lines_total: (.totals.lines // 0),
                branches_covered: (if .totals.branches then (.totals.branches.covered // 0) else 0 end),
                branches_missed: (if .totals.branches then (.totals.branches.missed // 0) else 0 end),
                is_critical_path: (if $critical != "" then (.name | test($critical; "i")) else false end),
                partials: (.totals.partials // 0)
            }
        }
    ]
    | sort_by(-.priority)
    | .[:$max]'
}

provider_gen_prd() {
    local issue_json="$1"

    local issue_id=$(echo "$issue_json" | jq -r '.id')
    local location=$(echo "$issue_json" | jq -r '.location')
    local coverage=$(echo "$issue_json" | jq -r '.metadata.coverage_percent // 0')
    local coverage_int=$(printf "%.0f" "$coverage")
    local lines_missed=$(echo "$issue_json" | jq -r '.metadata.lines_missed // 0')
    local lines_total=$(echo "$issue_json" | jq -r '.metadata.lines_total // 0')
    local lines_covered=$(echo "$issue_json" | jq -r '.metadata.lines_covered // 0')
    local is_critical=$(echo "$issue_json" | jq -r '.metadata.is_critical_path // false')
    local permalink=$(echo "$issue_json" | jq -r '.permalink // ""')
    local target="${CODECOV_TARGET_COVERAGE:-80}"
    local test_framework=$(detect_test_framework)
    local test_command=$(get_test_command "$test_framework")

    # Calculate lines needed to reach target
    local lines_needed=0
    if [[ "$lines_total" -gt 0 ]]; then
        local target_lines=$((lines_total * target / 100))
        lines_needed=$((target_lines - lines_covered))
        if [[ "$lines_needed" -lt 0 ]]; then
            lines_needed=0
        fi
    fi

    cat << EOF
# Test Coverage PRD - $(basename "$location")

## Overview

| Metric | Value |
|--------|-------|
| **Issue ID** | \`$issue_id\` |
| **File** | \`$location\` |
| **Current Coverage** | ${coverage_int}% |
| **Lines Covered** | $lines_covered of $lines_total |
| **Lines Missed** | $lines_missed |
| **Target Coverage** | ${target}% |
| **Lines to Cover** | ~$lines_needed more lines |
| **Test Framework** | $test_framework |
| **Critical Path** | $is_critical |
| **Codecov Link** | $permalink |

## Problem Statement

The file \`$location\` has insufficient test coverage at ${coverage_int}%.
This PR should add tests to increase coverage to at least ${target}%.

## Requirements

### Must Have
- [ ] Add tests for uncovered lines in \`$location\`
- [ ] Achieve minimum ${target}% coverage for this file
- [ ] All tests must pass
- [ ] Tests must be meaningful (not just coverage farming)

### Should Have
- [ ] Test edge cases and error conditions
- [ ] Test boundary conditions
- [ ] Mock external dependencies appropriately
- [ ] Follow existing test patterns in codebase

### Must NOT Do
- [ ] Do NOT modify the source file (only add tests)
- [ ] Do NOT delete existing tests
- [ ] Do NOT add tests that always pass without assertions
- [ ] Do NOT add unnecessary dependencies

## Test Framework Guidelines

$(get_framework_guidelines "$test_framework")

## Instructions for AI Agent

1. **Read the source file**: \`$location\`
2. **Find existing test file** or determine where to create new one
   $(get_test_file_pattern "$test_framework" "$location" | head -2 | sed 's/^/   - /')
3. **Analyze the uncovered code paths** - focus on:
   - Branches and conditionals
   - Error handling paths
   - Edge cases
4. **Write comprehensive tests** following project conventions
5. **Run test suite**: \`$test_command\`
6. **Verify coverage increased** (if coverage tool available)
7. **Commit changes**: \`test($(dirname "$location" | xargs basename)): add coverage for $(basename "$location")\`
8. When complete, output: \`<promise>COMPLETE</promise>\`

## Success Criteria

1. File coverage increases to >= ${target}%
2. All tests pass
3. Tests are readable and maintainable
4. No linting errors
5. Tests actually exercise the previously uncovered code

## Technical Notes

- The current coverage is ${coverage_int}%, meaning approximately $lines_missed lines are not covered
- Focus on testing the most impactful uncovered code first
- If ${target}% is not achievable, aim for the maximum reasonable coverage
- Consider whether some uncovered lines are unreachable/dead code that could be removed
EOF
}

provider_branch_name() {
    local issue_json="$1"
    local location=$(echo "$issue_json" | jq -r '.location')

    # Extract filename without extension, sanitize for branch name
    local filename=$(basename "$location" | sed 's/\.[^.]*$//')
    local sanitized=$(echo "$filename" | \
        tr '[:upper:]' '[:lower:]' | \
        sed 's/[^a-z0-9]/-/g' | \
        sed 's/-\+/-/g' | \
        sed 's/^-//' | \
        sed 's/-$//')

    # Truncate to reasonable length
    sanitized="${sanitized:0:40}"

    echo "test/coverage-$sanitized"
}

provider_pr_body() {
    local issue_json="$1"

    local issue_id=$(echo "$issue_json" | jq -r '.id')
    local location=$(echo "$issue_json" | jq -r '.location')
    local coverage=$(echo "$issue_json" | jq -r '.metadata.coverage_percent // 0')
    local coverage_int=$(printf "%.0f" "$coverage")
    local lines_missed=$(echo "$issue_json" | jq -r '.metadata.lines_missed // 0')
    local lines_total=$(echo "$issue_json" | jq -r '.metadata.lines_total // 0')
    local permalink=$(echo "$issue_json" | jq -r '.permalink // ""')
    local target="${CODECOV_TARGET_COVERAGE:-80}"
    local severity=$(echo "$issue_json" | jq -r '.severity // "MEDIUM"')

    cat << EOF
## Test Coverage Improvement

| Metric | Before | Target |
|--------|--------|--------|
| **File** | \`$location\` | - |
| **Coverage** | ${coverage_int}% | ${target}% |
| **Uncovered Lines** | $lines_missed | - |
| **Severity** | $severity | - |

### Summary

This PR adds tests to improve coverage for \`$location\`.

### Changes

- Added test cases for previously uncovered code paths
- Focused on edge cases and error handling
- Followed existing test patterns in the codebase

### Verification

- [ ] All new tests pass
- [ ] Coverage increased (check Codecov report after merge)
- [ ] No existing tests broken
- [ ] Code follows project conventions

### Codecov Report

Coverage will be automatically reported by Codecov after merge.

**Original File**: [$location]($permalink)

### Issue Reference

Codecov Issue ID: \`$issue_id\`

---
*This PR was automatically generated by Meta-Ralph (Codecov provider)*
EOF
}

# ============================================================================
# OPTIONAL: Additional helper functions
# ============================================================================

# Validate that the provider is properly configured
provider_validate() {
    local errors=0

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

    if [[ $errors -gt 0 ]]; then
        return 1
    fi

    # Try to validate the token
    if ! codecov_validate_token; then
        return 1
    fi

    return 0
}
