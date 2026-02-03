#!/bin/bash
# lib/interactive/filters.sh - Inline issue filtering
# Provides filtering capabilities before issue selection

# Source UI utilities
INTERACTIVE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$INTERACTIVE_DIR/ui.sh"

# ============================================================================
# FILTER STATE (bash 3.x compatible)
# ============================================================================

# Filter values stored as prefixed variables
FILTER_provider=""
FILTER_severity=""
FILTER_date=""
FILTER_text=""

# ============================================================================
# FILTER MANAGEMENT
# ============================================================================

# Set filter value
# Usage: filter_set "key" "value"
filter_set() {
    local key="$1"
    local value="$2"
    case "$key" in
        provider) FILTER_provider="$value" ;;
        severity) FILTER_severity="$value" ;;
        date)     FILTER_date="$value" ;;
        text)     FILTER_text="$value" ;;
    esac
}

# Get filter value
# Usage: filter_get "key"
filter_get() {
    local key="$1"
    case "$key" in
        provider) echo "$FILTER_provider" ;;
        severity) echo "$FILTER_severity" ;;
        date)     echo "$FILTER_date" ;;
        text)     echo "$FILTER_text" ;;
    esac
}

# Clear all filters
filter_clear() {
    FILTER_provider=""
    FILTER_severity=""
    FILTER_date=""
    FILTER_text=""
}

# Check if any filter is active
filter_active() {
    [[ -n "$FILTER_provider" || -n "$FILTER_severity" || -n "$FILTER_date" || -n "$FILTER_text" ]]
}

# ============================================================================
# FILTER DISPLAY
# ============================================================================

# Show current filter status (compact)
# Usage: filter_show_status
filter_show_status() {
    local filters=""

    [[ -n "$FILTER_provider" ]] && filters="${filters}p=${FILTER_provider} "
    [[ -n "$FILTER_severity" ]] && filters="${filters}s=${FILTER_severity} "
    [[ -n "$FILTER_date" ]] && filters="${filters}d=${FILTER_date} "
    [[ -n "$FILTER_text" ]] && filters="${filters}/${FILTER_text}/ "

    if [[ -n "$filters" ]]; then
        echo -e "  ${GRAY}Active filters: ${YELLOW}${filters}${NC}"
    else
        echo -e "  ${GRAY}No filters active${NC}"
    fi
}

# Show filter prompt with options
# Usage: filter_show_prompt
filter_show_prompt() {
    echo ""
    echo -e "${BLUE}$(draw_line 62 "$BOX_H")${NC}"
    echo -e "${WHITE}Filter Options:${NC}"
    echo -e "  ${GRAY}[p]rovider:${NC} ${FILTER_provider:-all}  ${GRAY}[s]everity:${NC} ${FILTER_severity:-all}"
    echo -e "  ${GRAY}[d]ate:${NC}     ${FILTER_date:-all}  ${GRAY}[/]search:${NC}  ${FILTER_text:-none}"
    echo -e "${BLUE}$(draw_line 62 "$BOX_H")${NC}"
}

# ============================================================================
# FILTER PARSING
# ============================================================================

# Parse filter expression
# Args: filter_string (e.g., "p=sentry s=critical" or "/payment error/")
# Returns: 0 if valid, 1 if invalid
filter_parse() {
    local input="$1"

    # Check for text search (starts/ends with /)
    if [[ "$input" =~ ^/(.+)/$ ]]; then
        FILTER_text="${BASH_REMATCH[1]}"
        return 0
    fi

    # Parse key=value pairs
    local found=false
    for token in $input; do
        case "$token" in
            p=*|provider=*)
                FILTER_provider="${token#*=}"
                found=true
                ;;
            s=*|severity=*)
                FILTER_severity="${token#*=}"
                found=true
                ;;
            d=*|date=*)
                FILTER_date="${token#*=}"
                found=true
                ;;
            t=*|text=*)
                FILTER_text="${token#*=}"
                found=true
                ;;
            clear|reset)
                filter_clear
                found=true
                ;;
            *)
                # Unknown token - could be search text
                if [[ -n "$token" && "$token" != "all" ]]; then
                    FILTER_text="$token"
                    found=true
                fi
                ;;
        esac
    done

    if [[ "$found" == "true" ]]; then
        return 0
    else
        return 1
    fi
}

# ============================================================================
# ISSUE FILTERING
# ============================================================================

# Apply filters to issues JSON array
# Args: issues_json (JSON array of issues)
# Returns: filtered JSON array
filter_apply() {
    local issues_json="$1"

    # Start with all issues
    local filtered="$issues_json"

    # Filter by provider
    if [[ -n "$FILTER_provider" && "$FILTER_provider" != "all" ]]; then
        filtered=$(echo "$filtered" | jq --arg p "$FILTER_provider" \
            '[.[] | select(.provider | ascii_downcase | contains($p | ascii_downcase))]' 2>/dev/null || echo "$filtered")
    fi

    # Filter by severity
    if [[ -n "$FILTER_severity" && "$FILTER_severity" != "all" ]]; then
        local severity_filter=""
        case "$FILTER_severity" in
            critical|crit|c) severity_filter="critical" ;;
            high|h)          severity_filter="high" ;;
            medium|med|m)    severity_filter="medium" ;;
            low|l)           severity_filter="low" ;;
            *)               severity_filter="$FILTER_severity" ;;
        esac
        filtered=$(echo "$filtered" | jq --arg s "$severity_filter" \
            '[.[] | select(.severity // "unknown" | ascii_downcase | contains($s | ascii_downcase))]' 2>/dev/null || echo "$filtered")
    fi

    # Filter by date
    if [[ -n "$FILTER_date" && "$FILTER_date" != "all" ]]; then
        local date_filter=""
        local now=$(date +%s)
        case "$FILTER_date" in
            today|1d)     date_filter=$((now - 86400)) ;;
            week|7d)      date_filter=$((now - 604800)) ;;
            month|30d)    date_filter=$((now - 2592000)) ;;
            *)
                # Try to parse as date
                if date -d "$FILTER_date" +%s &>/dev/null; then
                    date_filter=$(date -d "$FILTER_date" +%s)
                fi
                ;;
        esac

        if [[ -n "$date_filter" ]]; then
            filtered=$(echo "$filtered" | jq --arg d "$date_filter" \
                '[.[] | select((.created_at // .firstSeen // "1970-01-01" | fromdateiso8601 // 0) >= ($d | tonumber))]' 2>/dev/null || echo "$filtered")
        fi
    fi

    # Filter by text search
    if [[ -n "$FILTER_text" ]]; then
        local search_lower=$(echo "$FILTER_text" | tr '[:upper:]' '[:lower:]')
        filtered=$(echo "$filtered" | jq --arg t "$search_lower" \
            '[.[] | select(
                (.title // "" | ascii_downcase | contains($t)) or
                (.id // "" | ascii_downcase | contains($t)) or
                (.description // "" | ascii_downcase | contains($t)) or
                (.metadata // "" | tostring | ascii_downcase | contains($t))
            )]' 2>/dev/null || echo "$filtered")
    fi

    echo "$filtered"
}

# Get count of issues after filtering
# Args: issues_json
# Returns: count
filter_count() {
    local issues_json="$1"
    local filtered=$(filter_apply "$issues_json")
    echo "$filtered" | jq 'length' 2>/dev/null || echo "0"
}

# ============================================================================
# INTERACTIVE FILTER UI
# ============================================================================

# Interactive filter prompt
# Args: issues_json
# Returns: 0 if filter applied, 1 if cancelled, 2 if skip filters
filter_interactive() {
    local issues_json="$1"
    local total=$(echo "$issues_json" | jq 'length' 2>/dev/null || echo "0")

    echo ""
    echo -e "${WHITE}Filter issues before selection?${NC}"
    echo -e "  ${GRAY}Total available: ${WHITE}$total${NC} issues"
    echo ""

    filter_show_status

    echo ""
    echo -e "  ${GRAY}Examples:${NC}"
    echo -e "    ${CYAN}p=sentry${NC}       - Filter by provider"
    echo -e "    ${CYAN}s=critical${NC}     - Filter by severity"
    echo -e "    ${CYAN}d=week${NC}         - Issues from last week"
    echo -e "    ${CYAN}/payment/${NC}      - Search text"
    echo -e "    ${CYAN}clear${NC}          - Clear all filters"
    echo ""

    while true; do
        local current_count=$(filter_count "$issues_json")
        printf "  ${WHITE}Filter${NC} ${GRAY}(${current_count}/${total})${NC} ${GRAY}or [Enter] to continue:${NC} "
        read -r filter_input

        # Empty input = continue with current filters
        if [[ -z "$filter_input" ]]; then
            return 0
        fi

        # Back command
        if [[ "$filter_input" == "b" || "$filter_input" == "back" ]]; then
            return 1
        fi

        # Parse and apply filter
        if filter_parse "$filter_input"; then
            filter_show_status
            local new_count=$(filter_count "$issues_json")
            echo -e "  ${GREEN}Showing $new_count of $total issues${NC}"
        else
            print_error "Invalid filter expression"
        fi
    done
}

# ============================================================================
# QUICK FILTERS (presets)
# ============================================================================

# Apply a quick filter preset
# Args: preset_name
filter_preset() {
    local preset="$1"

    case "$preset" in
        critical)
            filter_clear
            FILTER_severity="critical"
            ;;
        recent)
            filter_clear
            FILTER_date="week"
            ;;
        today)
            filter_clear
            FILTER_date="today"
            ;;
        sentry)
            filter_clear
            FILTER_provider="sentry"
            ;;
        linear)
            filter_clear
            FILTER_provider="linear"
            ;;
        codecov)
            filter_clear
            FILTER_provider="codecov"
            ;;
        *)
            return 1
            ;;
    esac

    return 0
}

# Show quick filter options
filter_show_presets() {
    echo ""
    echo -e "${WHITE}Quick Filters:${NC}"
    echo -e "  ${CYAN}1)${NC} Critical only     ${CYAN}4)${NC} Sentry issues"
    echo -e "  ${CYAN}2)${NC} Last 7 days       ${CYAN}5)${NC} Linear issues"
    echo -e "  ${CYAN}3)${NC} Today only        ${CYAN}6)${NC} Codecov issues"
    echo ""
}
