#!/bin/bash
# lib/interactive/estimator.sh - Cost and time estimation
# Provides estimates based on historical session data

# Source UI utilities
INTERACTIVE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$INTERACTIVE_DIR/ui.sh"

# ============================================================================
# CONFIGURATION
# ============================================================================

RALPH_DATA_DIR="$HOME/.ralph"
COST_FILE="$RALPH_DATA_DIR/costs.json"

# Default estimates when no history available
DEFAULT_COST_PER_ISSUE=0.40
DEFAULT_TIME_PER_ISSUE_SEC=240  # 4 minutes

# ============================================================================
# HISTORY ANALYSIS
# ============================================================================

# Get historical average cost per issue
# Returns: cost in USD (float)
estimator_avg_cost_per_issue() {
    if [[ ! -f "$COST_FILE" ]]; then
        echo "$DEFAULT_COST_PER_ISSUE"
        return
    fi

    local total_cost=$(jq -r '.total_cost_usd // 0' "$COST_FILE" 2>/dev/null || echo "0")
    local total_sessions=$(jq -r '.sessions | length' "$COST_FILE" 2>/dev/null || echo "0")

    if [[ "$total_sessions" -eq 0 ]]; then
        echo "$DEFAULT_COST_PER_ISSUE"
        return
    fi

    # Estimate issues per session (assume 1 issue per session as baseline)
    # In reality, we'd track issues per session in the cost file
    local avg=$(echo "scale=4; $total_cost / $total_sessions" | bc -l 2>/dev/null || echo "$DEFAULT_COST_PER_ISSUE")
    echo "$avg"
}

# Get historical average time per issue
# Returns: time in seconds
estimator_avg_time_per_issue() {
    if [[ ! -f "$COST_FILE" ]]; then
        echo "$DEFAULT_TIME_PER_ISSUE_SEC"
        return
    fi

    local total_duration=$(jq -r '.total_duration_ms // 0' "$COST_FILE" 2>/dev/null || echo "0")
    local total_sessions=$(jq -r '.sessions | length' "$COST_FILE" 2>/dev/null || echo "0")

    if [[ "$total_sessions" -eq 0 ]]; then
        echo "$DEFAULT_TIME_PER_ISSUE_SEC"
        return
    fi

    # Convert ms to seconds and calculate average
    local avg_ms=$(echo "scale=0; $total_duration / $total_sessions" | bc -l 2>/dev/null || echo "$((DEFAULT_TIME_PER_ISSUE_SEC * 1000))")
    local avg_sec=$(echo "scale=0; $avg_ms / 1000" | bc -l 2>/dev/null || echo "$DEFAULT_TIME_PER_ISSUE_SEC")
    echo "$avg_sec"
}

# Get total historical stats
# Returns: JSON with stats
estimator_get_history_stats() {
    if [[ ! -f "$COST_FILE" ]]; then
        echo '{"total_cost":0,"total_duration_ms":0,"sessions":0}'
        return
    fi

    local total_cost=$(jq -r '.total_cost_usd // 0' "$COST_FILE" 2>/dev/null || echo "0")
    local total_duration=$(jq -r '.total_duration_ms // 0' "$COST_FILE" 2>/dev/null || echo "0")
    local sessions=$(jq -r '.sessions | length' "$COST_FILE" 2>/dev/null || echo "0")

    echo "{\"total_cost\":$total_cost,\"total_duration_ms\":$total_duration,\"sessions\":$sessions}"
}

# ============================================================================
# ESTIMATION
# ============================================================================

# Estimate cost for a number of issues
# Args: issue_count, mode (plan/build/plan+build), model (sonnet/opus)
# Returns: "min|max" cost estimate
estimator_estimate_cost() {
    local issue_count="${1:-1}"
    local mode="${2:-build}"
    local model="${3:-sonnet}"

    local base_cost=$(estimator_avg_cost_per_issue)

    # Mode multipliers
    local mode_mult=1.0
    case "$mode" in
        plan)       mode_mult=0.5 ;;
        build)      mode_mult=1.0 ;;
        plan+build) mode_mult=1.5 ;;
    esac

    # Model multipliers (Opus is ~5x more expensive)
    local model_mult=1.0
    [[ "$model" == "opus" ]] && model_mult=5.0

    # Calculate base estimate
    local estimate=$(echo "scale=4; $base_cost * $issue_count * $mode_mult * $model_mult" | bc -l 2>/dev/null || echo "0")

    # Return min-max range (±50%)
    local min=$(echo "scale=2; $estimate * 0.5" | bc -l 2>/dev/null || echo "0")
    local max=$(echo "scale=2; $estimate * 1.5" | bc -l 2>/dev/null || echo "0")

    echo "$min|$max"
}

# Estimate time for a number of issues
# Args: issue_count, iterations, mode
# Returns: "min|max" time in seconds (integers)
estimator_estimate_time() {
    local issue_count="${1:-1}"
    local iterations="${2:-10}"
    local mode="${3:-build}"

    local base_time=$(estimator_avg_time_per_issue)

    # Iterations factor (more iterations = more time)
    local iter_factor=$(echo "scale=2; $iterations / 10" | bc -l 2>/dev/null || echo "1")

    # Mode multipliers
    local mode_mult=1.0
    case "$mode" in
        plan)       mode_mult=0.5 ;;
        build)      mode_mult=1.0 ;;
        plan+build) mode_mult=1.5 ;;
    esac

    # Calculate estimate and convert to integer (remove decimal part)
    local estimate=$(echo "scale=0; ($base_time * $issue_count * $iter_factor * $mode_mult) / 1" | bc 2>/dev/null || echo "0")

    # Return min-max range (±50%) as integers
    local min=$(echo "scale=0; ($estimate * 0.5) / 1" | bc 2>/dev/null || echo "0")
    local max=$(echo "scale=0; ($estimate * 2.0) / 1" | bc 2>/dev/null || echo "0")

    # Ensure we return clean integers (strip any remaining decimals)
    min="${min%.*}"
    max="${max%.*}"

    echo "${min:-0}|${max:-0}"
}

# ============================================================================
# DISPLAY
# ============================================================================

# Format time range for display
# Args: min_seconds max_seconds
format_time_range() {
    local min_sec="$1"
    local max_sec="$2"

    # Ensure we have integers (strip decimal part if any)
    min_sec="${min_sec%.*}"
    max_sec="${max_sec%.*}"

    # Default to 0 if empty
    min_sec="${min_sec:-0}"
    max_sec="${max_sec:-0}"

    # Use bc for division to avoid bash arithmetic issues
    local min_min=$(echo "$min_sec / 60" | bc 2>/dev/null || echo "0")
    local max_min=$(echo "$max_sec / 60" | bc 2>/dev/null || echo "0")

    if [[ "$max_min" -lt 1 ]]; then
        echo "<1 minute"
    elif [[ "$min_min" -eq "$max_min" ]]; then
        echo "~${min_min} minutes"
    else
        echo "${min_min}-${max_min} minutes"
    fi
}

# Display cost/time estimate
# Args: issue_count, mode, model, iterations
estimator_display_estimate() {
    local issue_count="${1:-1}"
    local mode="${2:-build}"
    local model="${3:-sonnet}"
    local iterations="${4:-10}"

    # Get estimates
    local cost_range=$(estimator_estimate_cost "$issue_count" "$mode" "$model")
    local cost_min=$(echo "$cost_range" | cut -d'|' -f1)
    local cost_max=$(echo "$cost_range" | cut -d'|' -f2)

    local time_range=$(estimator_estimate_time "$issue_count" "$iterations" "$mode")
    local time_min=$(echo "$time_range" | cut -d'|' -f1)
    local time_max=$(echo "$time_range" | cut -d'|' -f2)

    # Get historical averages
    local avg_cost=$(estimator_avg_cost_per_issue)
    local avg_time=$(estimator_avg_time_per_issue)
    local avg_time_min=$((avg_time / 60))

    # Display
    echo ""
    echo -e "${BLUE}${BOX2_TL}$(printf '%*s' 62 '' | tr ' ' "$BOX2_H")${BOX2_TR}${NC}"
    echo -e "${BLUE}${BOX2_V}${NC}                 ${WHITE}ESTIMATED COST & TIME${NC}                     ${BLUE}${BOX2_V}${NC}"
    echo -e "${BLUE}${BOX2_V}$(printf '%*s' 62 '' | tr ' ' "$BOX_H")${BOX2_V}${NC}"

    printf "${BLUE}${BOX2_V}${NC}  ${WHITE}Issues:${NC}     %-50s ${BLUE}${BOX2_V}${NC}\n" "$issue_count selected"
    printf "${BLUE}${BOX2_V}${NC}  ${WHITE}Est. Cost:${NC}  ${YELLOW}~\$%.2f - \$%.2f${NC} %-27s ${BLUE}${BOX2_V}${NC}\n" "$cost_min" "$cost_max" "(based on similar issues)"
    printf "${BLUE}${BOX2_V}${NC}  ${WHITE}Est. Time:${NC}  ${YELLOW}%s${NC}%-28s ${BLUE}${BOX2_V}${NC}\n" "$(format_time_range "$time_min" "$time_max")" ""

    echo -e "${BLUE}${BOX2_V}${NC}                                                              ${BLUE}${BOX2_V}${NC}"
    printf "${BLUE}${BOX2_V}${NC}  ${GRAY}Historical avg: \$%.2f/issue, %dm/issue${NC}%-18s ${BLUE}${BOX2_V}${NC}\n" "$avg_cost" "$avg_time_min" ""

    echo -e "${BLUE}${BOX2_BL}$(printf '%*s' 62 '' | tr ' ' "$BOX2_H")${BOX2_BR}${NC}"
    echo ""
}

# Display compact estimate (one line)
# Args: issue_count, mode, model, iterations
estimator_display_compact() {
    local issue_count="${1:-1}"
    local mode="${2:-build}"
    local model="${3:-sonnet}"
    local iterations="${4:-10}"

    local cost_range=$(estimator_estimate_cost "$issue_count" "$mode" "$model")
    local cost_min=$(echo "$cost_range" | cut -d'|' -f1)
    local cost_max=$(echo "$cost_range" | cut -d'|' -f2)

    local time_range=$(estimator_estimate_time "$issue_count" "$iterations" "$mode")
    local time_min=$(echo "$time_range" | cut -d'|' -f1)
    local time_max=$(echo "$time_range" | cut -d'|' -f2)

    echo -e "  ${GRAY}Estimate: ${YELLOW}~\$${cost_min}-\$${cost_max}${NC} | ${YELLOW}$(format_time_range "$time_min" "$time_max")${NC}${GRAY} (based on history)${NC}"
}
