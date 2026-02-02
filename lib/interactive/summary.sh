#!/bin/bash
# lib/interactive/summary.sh - Execution summary generation
# Generates structured summary reports after processing completes

# Source UI utilities
INTERACTIVE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$INTERACTIVE_DIR/ui.sh"

# ============================================================================
# SUMMARY DATA COLLECTION (bash 3.x compatible)
# ============================================================================

# Summary state using prefixed variables (bash 3.x compatible)
SUMMARY_ISSUES_LIST=""  # Pipe-delimited list of issues
SUMMARY_ISSUES_COUNT=0

# Initialize summary tracking
# Usage: summary_init
summary_init() {
    SUMMARY_ISSUES_LIST=""
    SUMMARY_ISSUES_COUNT=0
    SUMMARY_start_time=$(date +%s)
    SUMMARY_total_issues=0
    SUMMARY_fixed_issues=0
    SUMMARY_failed_issues=0
    SUMMARY_total_cost=0
    SUMMARY_total_iterations=0
    SUMMARY_files_modified=0
    SUMMARY_lines_added=0
    SUMMARY_lines_removed=0
    SUMMARY_prs_created=0
    SUMMARY_duration=0
}

# Add issue result to summary
# Usage: summary_add_issue "issue_id" "title" "provider" "status" "pr_url" "cost" "iterations"
summary_add_issue() {
    local issue_id="$1"
    local title="$2"
    local provider="$3"
    local status="$4"  # "fixed" or "failed"
    local pr_url="${5:-}"
    local cost="${6:-0}"
    local iterations="${7:-0}"

    # Add to issues list (newline separated)
    if [[ -n "$SUMMARY_ISSUES_LIST" ]]; then
        SUMMARY_ISSUES_LIST="$SUMMARY_ISSUES_LIST
$issue_id|$title|$provider|$status|$pr_url|$cost|$iterations"
    else
        SUMMARY_ISSUES_LIST="$issue_id|$title|$provider|$status|$pr_url|$cost|$iterations"
    fi
    SUMMARY_ISSUES_COUNT=$((SUMMARY_ISSUES_COUNT + 1))

    SUMMARY_total_issues=$((SUMMARY_total_issues + 1))

    if [[ "$status" == "fixed" ]]; then
        SUMMARY_fixed_issues=$((SUMMARY_fixed_issues + 1))
        [[ -n "$pr_url" ]] && SUMMARY_prs_created=$((SUMMARY_prs_created + 1))
    else
        SUMMARY_failed_issues=$((SUMMARY_failed_issues + 1))
    fi

    # Accumulate cost (using bc for float arithmetic)
    if command -v bc &>/dev/null; then
        SUMMARY_total_cost=$(echo "$SUMMARY_total_cost + $cost" | bc -l 2>/dev/null || echo "$SUMMARY_total_cost")
    fi

    SUMMARY_total_iterations=$((SUMMARY_total_iterations + iterations))
}

# Set file statistics
# Usage: summary_set_file_stats modified added removed
summary_set_file_stats() {
    SUMMARY_files_modified="${1:-0}"
    SUMMARY_lines_added="${2:-0}"
    SUMMARY_lines_removed="${3:-0}"
}

# Finalize summary timing
summary_finalize() {
    local end_time=$(date +%s)
    SUMMARY_duration=$((end_time - SUMMARY_start_time))
}

# ============================================================================
# SUMMARY DISPLAY
# ============================================================================

# Format duration as human readable
format_duration() {
    local seconds=$1
    local minutes=$((seconds / 60))
    local remaining_seconds=$((seconds % 60))

    if [[ $minutes -gt 0 ]]; then
        echo "${minutes}m ${remaining_seconds}s"
    else
        echo "${seconds}s"
    fi
}

# Format cost as currency
format_cost() {
    local cost="$1"
    printf "$%.2f" "$cost"
}

# Display execution summary
# Usage: summary_display
summary_display() {
    summary_finalize

    local total=$SUMMARY_total_issues
    local fixed=$SUMMARY_fixed_issues
    local failed=$SUMMARY_failed_issues
    local duration=$SUMMARY_duration
    local cost=$SUMMARY_total_cost
    local prs=$SUMMARY_prs_created
    local files=$SUMMARY_files_modified
    local added=$SUMMARY_lines_added
    local removed=$SUMMARY_lines_removed
    local iterations=$SUMMARY_total_iterations

    echo ""
    echo -e "${BLUE}${BOX2_TL}$(printf '%*s' 63 '' | tr ' ' "$BOX2_H")${BOX2_TR}${NC}"
    echo -e "${BLUE}${BOX2_V}${NC}                      ${WHITE}EXECUTION SUMMARY${NC}                       ${BLUE}${BOX2_V}${NC}"
    echo -e "${BLUE}${BOX2_BL}$(printf '%*s' 63 '' | tr ' ' "$BOX2_H")${BOX2_BR}${NC}"
    echo ""

    # Issues processed
    echo -e "${WHITE}Issues Processed:${NC} $total"

    # Issue details (iterate over newline-separated list)
    if [[ -n "$SUMMARY_ISSUES_LIST" ]]; then
        echo "$SUMMARY_ISSUES_LIST" | while IFS='|' read -r id title provider status pr_url issue_cost issue_iters; do
            local status_icon status_color status_text
            if [[ "$status" == "fixed" ]]; then
                status_icon="✓"
                status_color="$GREEN"
                if [[ -n "$pr_url" ]]; then
                    status_text="FIXED - $pr_url"
                else
                    status_text="FIXED"
                fi
            else
                status_icon="✗"
                status_color="$RED"
                status_text="FAILED - see logs"
            fi

            local provider_color=$(get_provider_color "$provider")
            printf "  ${status_color}%s${NC} ${provider_color}%-10s${NC} %-25s ${GRAY}[%s]${NC}\n" \
                "$status_icon" "[$provider]" "${title:0:25}" "$status_text"
        done
    fi

    echo ""
    draw_line 63 "─" "$GRAY"
    echo ""

    # Statistics
    printf "${WHITE}%-16s${NC} %s\n" "Total Time:" "$(format_duration $duration)"
    printf "${WHITE}%-16s${NC} \$%.4f\n" "Total Cost:" "$cost"

    if [[ $total -gt 0 ]]; then
        local avg_time=$((duration / total))
        local avg_cost=$(echo "scale=4; $cost / $total" | bc -l 2>/dev/null || echo "0")
        printf "${WHITE}%-16s${NC} %s / \$%.4f\n" "Avg per issue:" "$(format_duration $avg_time)" "$avg_cost"
    fi

    echo ""

    # File changes (if available)
    if [[ "$files" -gt 0 || "$added" -gt 0 || "$removed" -gt 0 ]]; then
        printf "${WHITE}%-16s${NC} %d\n" "Files Modified:" "$files"
        printf "${WHITE}%-16s${NC} ${GREEN}+%d${NC} / ${RED}-%d${NC}\n" "Lines Changed:" "$added" "$removed"
        echo ""
    fi

    # PRs created
    if [[ "$prs" -gt 0 ]]; then
        printf "${WHITE}%-16s${NC} %d\n" "PRs Created:" "$prs"
        echo ""
    fi

    # Success rate
    if [[ $total -gt 0 ]]; then
        local success_rate=$((fixed * 100 / total))
        local rate_color="$GREEN"
        [[ $success_rate -lt 50 ]] && rate_color="$RED"
        [[ $success_rate -ge 50 && $success_rate -lt 80 ]] && rate_color="$YELLOW"

        printf "${WHITE}%-16s${NC} ${rate_color}%d%%${NC} (%d/%d)\n" "Success Rate:" "$success_rate" "$fixed" "$total"
    fi

    echo ""

    # Log location
    local log_dir="${RALPH_LOG_DIR:-.ralph-logs}"
    local session_id=$(date +%Y%m%d-%H%M%S)
    echo -e "${GRAY}Logs saved to: $log_dir/session-$session_id/${NC}"

    echo ""
    draw_line 63 "$BOX2_H" "$BLUE"
}

# ============================================================================
# QUICK SUMMARY (inline during processing)
# ============================================================================

# Show quick status line
# Usage: summary_status_line "Processing issue 2/5..."
summary_status_line() {
    local message="$1"
    local fixed=${SUMMARY_fixed_issues:-0}
    local failed=${SUMMARY_failed_issues:-0}
    local cost=${SUMMARY_total_cost:-0}

    printf "\r${CYAN}%s${NC} | ${GREEN}✓%d${NC} ${RED}✗%d${NC} | ${YELLOW}\$%.2f${NC}  " \
        "$message" "$fixed" "$failed" "$cost"
}

# ============================================================================
# JSON EXPORT (for programmatic analysis)
# ============================================================================

# Export summary as JSON
# Usage: summary_to_json > summary.json
summary_to_json() {
    summary_finalize

    local issues_json="["
    local first=true

    if [[ -n "$SUMMARY_ISSUES_LIST" ]]; then
        echo "$SUMMARY_ISSUES_LIST" | while IFS='|' read -r id title provider status pr_url cost iterations; do
            [[ "$first" == "true" ]] && first=false || issues_json+=","
            issues_json+="{\"id\":\"$id\",\"title\":\"$title\",\"provider\":\"$provider\",\"status\":\"$status\",\"pr_url\":\"$pr_url\",\"cost\":$cost,\"iterations\":$iterations}"
        done
    fi
    issues_json+="]"

    cat <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "duration_seconds": $SUMMARY_duration,
    "total_issues": $SUMMARY_total_issues,
    "fixed_issues": $SUMMARY_fixed_issues,
    "failed_issues": $SUMMARY_failed_issues,
    "total_cost_usd": $SUMMARY_total_cost,
    "total_iterations": $SUMMARY_total_iterations,
    "files_modified": $SUMMARY_files_modified,
    "lines_added": $SUMMARY_lines_added,
    "lines_removed": $SUMMARY_lines_removed,
    "prs_created": $SUMMARY_prs_created,
    "issues": $issues_json
}
EOF
}

# ============================================================================
# FAILURE ANALYSIS
# ============================================================================

# Display failure analysis for an issue
# Usage: summary_failure_analysis "issue_id" "last_error" "attempts" "progress_pct" "suggestion1" "suggestion2" ...
summary_failure_analysis() {
    local issue_id="$1"
    local last_error="$2"
    local attempts="$3"
    local progress="$4"
    shift 4

    echo ""
    echo -e "${RED}${BOX2_TL}$(printf '%*s' 63 '' | tr ' ' "$BOX2_H")${BOX2_TR}${NC}"
    echo -e "${RED}${BOX2_V}${NC}  ${YELLOW}⚠️  ISSUE NOT RESOLVED - FAILURE ANALYSIS${NC}                   ${RED}${BOX2_V}${NC}"
    echo -e "${RED}${BOX2_V}$(printf '%*s' 63 '' | tr ' ' "$BOX_H")${BOX2_V}${NC}"

    printf "${RED}${BOX2_V}${NC}  ${WHITE}Issue:${NC}     %-52s ${RED}${BOX2_V}${NC}\n" "$issue_id"
    printf "${RED}${BOX2_V}${NC}  ${WHITE}Attempts:${NC}  %-52s ${RED}${BOX2_V}${NC}\n" "$attempts iterations"
    printf "${RED}${BOX2_V}${NC}  ${WHITE}Progress:${NC}  %-52s ${RED}${BOX2_V}${NC}\n" "$progress%"

    if [[ -n "$last_error" ]]; then
        echo -e "${RED}${BOX2_V}${NC}                                                               ${RED}${BOX2_V}${NC}"
        printf "${RED}${BOX2_V}${NC}  ${WHITE}Last Error:${NC}                                                  ${RED}${BOX2_V}${NC}\n"
        # Wrap long error message
        local wrapped=$(echo "$last_error" | fold -w 54)
        while IFS= read -r line; do
            printf "${RED}${BOX2_V}${NC}    ${GRAY}%-56s${NC}   ${RED}${BOX2_V}${NC}\n" "$line"
        done <<< "$wrapped"
    fi

    if [[ $# -gt 0 ]]; then
        echo -e "${RED}${BOX2_V}${NC}                                                               ${RED}${BOX2_V}${NC}"
        printf "${RED}${BOX2_V}${NC}  ${WHITE}Suggestions:${NC}                                                 ${RED}${BOX2_V}${NC}\n"
        for suggestion in "$@"; do
            printf "${RED}${BOX2_V}${NC}    ${CYAN}•${NC} %-54s ${RED}${BOX2_V}${NC}\n" "$suggestion"
        done
    fi

    echo -e "${RED}${BOX2_BL}$(printf '%*s' 63 '' | tr ' ' "$BOX2_H")${BOX2_BR}${NC}"
    echo ""
}
