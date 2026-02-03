#!/bin/bash
# lib/interactive/history.sh - Execution history management
# Tracks and displays execution history with re-run capabilities

# Source UI utilities
INTERACTIVE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$INTERACTIVE_DIR/ui.sh"

# ============================================================================
# CONFIGURATION
# ============================================================================

RALPH_DATA_DIR="$HOME/.ralph"
HISTORY_FILE="$RALPH_DATA_DIR/history.json"
HISTORY_MAX_ENTRIES=50

# ============================================================================
# HISTORY INITIALIZATION
# ============================================================================

# Initialize history file
history_init() {
    mkdir -p "$RALPH_DATA_DIR"
    if [[ ! -f "$HISTORY_FILE" ]]; then
        echo '{"executions":[]}' > "$HISTORY_FILE"
    fi
}

# ============================================================================
# HISTORY MANAGEMENT
# ============================================================================

# Add execution to history
# Args: session_id, provider, issues_json, mode, model, iterations, status, cost, duration, prs_json
history_add() {
    local session_id="$1"
    local provider="$2"
    local issues_json="$3"
    local mode="$4"
    local model="$5"
    local iterations="$6"
    local status="$7"       # "success", "partial", "failed"
    local cost="${8:-0}"
    local duration="${9:-0}"
    local prs_json="${10:-[]}"

    history_init

    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local relative_time="just now"

    # Count fixed/failed
    local total_issues=$(echo "$issues_json" | jq 'length' 2>/dev/null || echo "0")
    local fixed_count=$(echo "$issues_json" | jq '[.[] | select(.status == "fixed")] | length' 2>/dev/null || echo "0")
    local failed_count=$(echo "$issues_json" | jq '[.[] | select(.status == "failed")] | length' 2>/dev/null || echo "0")

    # Create execution entry
    local execution=$(jq -n \
        --arg id "$session_id" \
        --arg ts "$timestamp" \
        --arg prov "$provider" \
        --arg mode "$mode" \
        --arg model "$model" \
        --argjson iter "$iterations" \
        --arg status "$status" \
        --argjson cost "$cost" \
        --argjson duration "$duration" \
        --argjson total "$total_issues" \
        --argjson fixed "$fixed_count" \
        --argjson failed "$failed_count" \
        --argjson issues "$issues_json" \
        --argjson prs "$prs_json" \
        '{
            id: $id,
            timestamp: $ts,
            provider: $prov,
            mode: $mode,
            model: $model,
            iterations: $iter,
            status: $status,
            cost_usd: $cost,
            duration_ms: $duration,
            total_issues: $total,
            fixed_issues: $fixed,
            failed_issues: $failed,
            issues: $issues,
            prs: $prs
        }')

    # Add to history and keep only last N entries
    local updated=$(jq --argjson exec "$execution" --argjson max "$HISTORY_MAX_ENTRIES" \
        '.executions = ([$exec] + .executions) | .executions = .executions[:$max]' \
        "$HISTORY_FILE" 2>/dev/null)

    if [[ -n "$updated" ]]; then
        echo "$updated" > "$HISTORY_FILE"
    fi
}

# Get recent executions
# Args: limit (default: 10)
# Returns: JSON array of executions
history_get_recent() {
    local limit="${1:-10}"

    history_init

    jq --argjson limit "$limit" '.executions[:$limit]' "$HISTORY_FILE" 2>/dev/null || echo "[]"
}

# Get execution by ID
# Args: session_id
# Returns: JSON object or empty
history_get_by_id() {
    local session_id="$1"

    history_init

    jq --arg id "$session_id" '.executions[] | select(.id == $id)' "$HISTORY_FILE" 2>/dev/null || echo ""
}

# Get failed issues from recent executions
# Args: limit (default: 10)
# Returns: JSON array of failed issues with execution context
history_get_failed() {
    local limit="${1:-10}"

    history_init

    jq --argjson limit "$limit" '
        [.executions[:$limit][] |
            .issues[] |
            select(.status == "failed") |
            {id, title, provider, execution_id: .execution_id}
        ]' "$HISTORY_FILE" 2>/dev/null || echo "[]"
}

# ============================================================================
# HISTORY DISPLAY
# ============================================================================

# Format relative time
_format_relative_time() {
    local timestamp="$1"

    # Convert timestamp to seconds since epoch
    local exec_time
    if date --version &>/dev/null 2>&1; then
        # GNU date
        exec_time=$(date -d "$timestamp" +%s 2>/dev/null || echo "0")
    else
        # BSD date (macOS)
        exec_time=$(date -jf "%Y-%m-%dT%H:%M:%SZ" "$timestamp" +%s 2>/dev/null || echo "0")
    fi

    local now=$(date +%s)
    local diff=$((now - exec_time))

    if [[ $diff -lt 60 ]]; then
        echo "just now"
    elif [[ $diff -lt 3600 ]]; then
        echo "$((diff / 60))m ago"
    elif [[ $diff -lt 86400 ]]; then
        echo "$((diff / 3600))h ago"
    elif [[ $diff -lt 604800 ]]; then
        echo "$((diff / 86400))d ago"
    else
        echo "$((diff / 604800))w ago"
    fi
}

# Display execution history
# Args: limit (default: 5)
history_display() {
    local limit="${1:-5}"

    history_init

    local executions=$(history_get_recent "$limit")
    local count=$(echo "$executions" | jq 'length' 2>/dev/null || echo "0")

    if [[ "$count" -eq 0 ]]; then
        echo -e "  ${GRAY}No execution history yet${NC}"
        return
    fi

    echo ""
    echo -e "${BLUE}$(draw_line 62 "$BOX2_H")${NC}"
    echo -e "${WHITE}Recent Executions:${NC}"
    echo ""

    local i=0
    while [[ $i -lt $count ]]; do
        local exec=$(echo "$executions" | jq ".[$i]" 2>/dev/null)

        local id=$(echo "$exec" | jq -r '.id')
        local timestamp=$(echo "$exec" | jq -r '.timestamp')
        local provider=$(echo "$exec" | jq -r '.provider')
        local total=$(echo "$exec" | jq -r '.total_issues')
        local fixed=$(echo "$exec" | jq -r '.fixed_issues')
        local failed=$(echo "$exec" | jq -r '.failed_issues')
        local cost=$(echo "$exec" | jq -r '.cost_usd')
        local status=$(echo "$exec" | jq -r '.status')

        local relative=$(_format_relative_time "$timestamp")

        # Status indicator
        local status_icon status_color
        case "$status" in
            success) status_icon="✓"; status_color="$GREEN" ;;
            partial) status_icon="◐"; status_color="$YELLOW" ;;
            failed)  status_icon="✗"; status_color="$RED" ;;
            *)       status_icon="?"; status_color="$GRAY" ;;
        esac

        # Provider color
        local prov_color=$(get_provider_color "$provider" 2>/dev/null || echo "$CYAN")

        local num=$((i + 1))
        printf "  ${WHITE}%d)${NC} ${GRAY}%-8s${NC} - %d issues ${prov_color}(%s)${NC} - ${status_color}%s${NC} %d fixed" \
            "$num" "$relative" "$total" "$provider" "$status_icon" "$fixed"

        if [[ "$failed" -gt 0 ]]; then
            printf ", ${RED}%d failed${NC}" "$failed"
        fi
        echo ""

        i=$((i + 1))
    done

    echo ""
    echo -e "${BLUE}$(draw_line 62 "$BOX2_H")${NC}"
}

# Display execution details
# Args: session_id
history_display_details() {
    local session_id="$1"

    local exec=$(history_get_by_id "$session_id")

    if [[ -z "$exec" || "$exec" == "null" ]]; then
        print_error "Execution not found: $session_id"
        return 1
    fi

    local timestamp=$(echo "$exec" | jq -r '.timestamp')
    local provider=$(echo "$exec" | jq -r '.provider')
    local mode=$(echo "$exec" | jq -r '.mode')
    local model=$(echo "$exec" | jq -r '.model')
    local iterations=$(echo "$exec" | jq -r '.iterations')
    local total=$(echo "$exec" | jq -r '.total_issues')
    local fixed=$(echo "$exec" | jq -r '.fixed_issues')
    local failed=$(echo "$exec" | jq -r '.failed_issues')
    local cost=$(echo "$exec" | jq -r '.cost_usd')
    local duration=$(echo "$exec" | jq -r '.duration_ms')

    local duration_min=$(echo "scale=1; $duration / 60000" | bc 2>/dev/null || echo "0")

    echo ""
    echo -e "${BLUE}$(draw_line 62 "$BOX2_H")${NC}"
    echo -e "${WHITE}Execution Details: ${CYAN}$session_id${NC}"
    echo -e "${BLUE}$(draw_line 62 "$BOX_H")${NC}"
    echo ""

    printf "  ${WHITE}%-14s${NC} %s\n" "Timestamp:" "$timestamp"
    printf "  ${WHITE}%-14s${NC} %s\n" "Provider:" "$provider"
    printf "  ${WHITE}%-14s${NC} %s\n" "Mode:" "$mode"
    printf "  ${WHITE}%-14s${NC} %s\n" "Model:" "$model"
    printf "  ${WHITE}%-14s${NC} %d\n" "Iterations:" "$iterations"
    printf "  ${WHITE}%-14s${NC} %d total, ${GREEN}%d fixed${NC}, ${RED}%d failed${NC}\n" "Issues:" "$total" "$fixed" "$failed"
    printf "  ${WHITE}%-14s${NC} \$%.4f\n" "Cost:" "$cost"
    printf "  ${WHITE}%-14s${NC} %s min\n" "Duration:" "$duration_min"

    echo ""

    # Show issues
    local issues=$(echo "$exec" | jq -c '.issues // []')
    local issue_count=$(echo "$issues" | jq 'length')

    if [[ "$issue_count" -gt 0 ]]; then
        echo -e "${WHITE}Issues:${NC}"
        echo "$issues" | jq -c '.[]' | while read -r issue; do
            local issue_id=$(echo "$issue" | jq -r '.id')
            local issue_title=$(echo "$issue" | jq -r '.title // "untitled"')
            local issue_status=$(echo "$issue" | jq -r '.status // "unknown"')

            local status_icon status_color
            case "$issue_status" in
                fixed) status_icon="✓"; status_color="$GREEN" ;;
                failed) status_icon="✗"; status_color="$RED" ;;
                *) status_icon="?"; status_color="$GRAY" ;;
            esac

            printf "  ${status_color}%s${NC} %-15s %s\n" "$status_icon" "$issue_id" "${issue_title:0:40}"
        done
        echo ""
    fi

    # Show PRs
    local prs=$(echo "$exec" | jq -c '.prs // []')
    local pr_count=$(echo "$prs" | jq 'length')

    if [[ "$pr_count" -gt 0 ]]; then
        echo -e "${WHITE}Pull Requests:${NC}"
        echo "$prs" | jq -r '.[]' | while read -r pr_url; do
            echo -e "  ${CYAN}$pr_url${NC}"
        done
        echo ""
    fi

    echo -e "${BLUE}$(draw_line 62 "$BOX2_H")${NC}"
}

# ============================================================================
# INTERACTIVE HISTORY UI
# ============================================================================

# Interactive history menu
# Returns: 0 if selection made, 1 if cancelled, 2 if continue without selection
history_interactive() {
    history_init

    local executions=$(history_get_recent 10)
    local count=$(echo "$executions" | jq 'length' 2>/dev/null || echo "0")

    if [[ "$count" -eq 0 ]]; then
        echo -e "  ${GRAY}No execution history available${NC}"
        echo ""
        return 2
    fi

    history_display 5

    echo ""
    echo -e "  ${GRAY}Options:${NC}"
    echo -e "    ${CYAN}[r]${NC} Re-run failed issues from last execution"
    echo -e "    ${CYAN}[v]${NC} View details of an execution"
    echo -e "    ${CYAN}[c]${NC} Continue to new execution"
    echo ""

    while true; do
        printf "  ${WHITE}Select option:${NC} "
        read -r choice

        case "$choice" in
            r|R|rerun)
                # Get failed issues from most recent execution
                local last_exec=$(echo "$executions" | jq '.[0]')
                local failed_issues=$(echo "$last_exec" | jq '[.issues[] | select(.status == "failed")]')
                local failed_count=$(echo "$failed_issues" | jq 'length')

                if [[ "$failed_count" -eq 0 ]]; then
                    echo -e "  ${YELLOW}No failed issues in last execution${NC}"
                else
                    echo -e "  ${GREEN}Found $failed_count failed issue(s) to re-run${NC}"
                    # Export for use by wizard
                    HISTORY_RERUN_ISSUES="$failed_issues"
                    return 0
                fi
                ;;
            v|V|view)
                printf "  ${WHITE}Enter execution number (1-$count):${NC} "
                read -r exec_num

                if [[ "$exec_num" =~ ^[0-9]+$ ]] && [[ "$exec_num" -ge 1 ]] && [[ "$exec_num" -le "$count" ]]; then
                    local exec_id=$(echo "$executions" | jq -r ".[$((exec_num - 1))].id")
                    history_display_details "$exec_id"
                else
                    print_error "Invalid selection"
                fi
                ;;
            c|C|continue|"")
                return 2
                ;;
            b|B|back)
                return 1
                ;;
            *)
                print_error "Invalid option"
                ;;
        esac
    done
}

# Get issues for re-run (after history_interactive returns 0)
history_get_rerun_issues() {
    echo "${HISTORY_RERUN_ISSUES:-[]}"
}

# ============================================================================
# LOG MANAGEMENT
# ============================================================================

# Get log directory for a session
# Args: session_id
history_get_log_dir() {
    local session_id="$1"
    local date_prefix=$(echo "$session_id" | cut -d'-' -f1)

    echo "$RALPH_DATA_DIR/logs/$date_prefix/$session_id"
}

# List available log files for a session
# Args: session_id
history_list_logs() {
    local session_id="$1"
    local log_dir=$(history_get_log_dir "$session_id")

    if [[ -d "$log_dir" ]]; then
        find "$log_dir" -type f -name "*.log" -o -name "*.md" -o -name "*.txt" 2>/dev/null
    else
        echo ""
    fi
}

# ============================================================================
# CLEANUP
# ============================================================================

# Clean old history entries
# Args: days_to_keep (default: 30)
history_cleanup() {
    local days="${1:-30}"

    history_init

    local cutoff_date=$(date -d "$days days ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
        date -v-${days}d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "")

    if [[ -n "$cutoff_date" ]]; then
        local updated=$(jq --arg cutoff "$cutoff_date" \
            '.executions = [.executions[] | select(.timestamp >= $cutoff)]' \
            "$HISTORY_FILE" 2>/dev/null)

        if [[ -n "$updated" ]]; then
            echo "$updated" > "$HISTORY_FILE"
        fi
    fi
}
