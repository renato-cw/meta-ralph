#!/bin/bash
# providers/codecov/priority.sh
# Priority calculation for Codecov provider

# Calculate priority based on coverage and other factors
# Priority formula:
#   base_priority = 100 - coverage_percent
#   weighted_priority = base_priority * factor_multipliers
#   final_priority = min(100, weighted_priority)
#
# Weight factors:
#   - Critical Path: 1.5x if file is in CODECOV_CRITICAL_PATHS
#   - Large File: 1.2x if > 100 lines
#   - Recent Changes: 1.3x if modified in last 30 days
#   - High Complexity: 1.2x if cyclomatic complexity > 10
#   - Many Importers: 1.1x if imported by > 5 files
calculate_codecov_priority() {
    local coverage="${1:-0}"
    local is_critical="${2:-false}"
    local lines="${3:-0}"
    local days_since_modified="${4:-999}"
    local complexity="${5:-0}"
    local import_count="${6:-0}"

    # Base priority: inverse of coverage (100% coverage = 0 priority)
    # Use awk for floating point math
    local base=$(awk "BEGIN {print 100 - $coverage}")
    local priority="$base"

    # Critical path multiplier (1.5x)
    if [[ "$is_critical" == "true" ]]; then
        priority=$(awk "BEGIN {print $priority * 1.5}")
    fi

    # Large file multiplier (1.2x) - larger files have more potential for bugs
    if [[ "$lines" -gt 100 ]]; then
        priority=$(awk "BEGIN {print $priority * 1.2}")
    fi

    # Recently modified multiplier (1.3x) - recent changes need fresh tests
    if [[ "$days_since_modified" -lt 30 ]]; then
        priority=$(awk "BEGIN {print $priority * 1.3}")
    fi

    # High complexity multiplier (1.2x) - complex code needs more testing
    if [[ "$complexity" -gt 10 ]]; then
        priority=$(awk "BEGIN {print $priority * 1.2}")
    fi

    # Many importers multiplier (1.1x) - widely used code is more impactful
    if [[ "$import_count" -gt 5 ]]; then
        priority=$(awk "BEGIN {print $priority * 1.1}")
    fi

    # Cap at 100
    local capped=$(awk "BEGIN {if ($priority > 100) print 100; else print $priority}")

    # Return integer (floor)
    printf "%.0f" "$capped"
}

# Map coverage percentage to severity level
# Coverage -> Severity mapping:
#   0-20%   -> CRITICAL (highest risk)
#   21-40%  -> HIGH
#   41-60%  -> MEDIUM
#   61-80%  -> LOW
#   81-100% -> INFO (lowest risk)
coverage_to_severity() {
    local coverage="${1:-0}"

    if (( $(echo "$coverage <= 20" | bc -l) )); then
        echo "CRITICAL"
    elif (( $(echo "$coverage <= 40" | bc -l) )); then
        echo "HIGH"
    elif (( $(echo "$coverage <= 60" | bc -l) )); then
        echo "MEDIUM"
    elif (( $(echo "$coverage <= 80" | bc -l) )); then
        echo "LOW"
    else
        echo "INFO"
    fi
}

# Check if a file path matches any of the critical path patterns
is_critical_path() {
    local filepath="$1"
    local critical_paths="${CODECOV_CRITICAL_PATHS:-}"

    if [[ -z "$critical_paths" ]]; then
        echo "false"
        return
    fi

    # Convert comma-separated patterns to pipe-separated regex
    local pattern=$(echo "$critical_paths" | tr ',' '|')

    if echo "$filepath" | grep -qE "$pattern"; then
        echo "true"
    else
        echo "false"
    fi
}

# Calculate days since a date
days_since() {
    local date_str="$1"

    if [[ -z "$date_str" || "$date_str" == "null" ]]; then
        echo "999"
        return
    fi

    # Try to parse the date (works on macOS and Linux)
    local then_timestamp
    local now_timestamp

    # Try GNU date first (Linux)
    if date --version >/dev/null 2>&1; then
        then_timestamp=$(date -d "$date_str" +%s 2>/dev/null || echo "0")
        now_timestamp=$(date +%s)
    else
        # macOS date
        then_timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$date_str" +%s 2>/dev/null || \
                         date -j -f "%Y-%m-%d" "$date_str" +%s 2>/dev/null || echo "0")
        now_timestamp=$(date +%s)
    fi

    if [[ "$then_timestamp" == "0" ]]; then
        echo "999"
        return
    fi

    local diff=$((now_timestamp - then_timestamp))
    local days=$((diff / 86400))
    echo "$days"
}
