#!/bin/bash
# ralph-interactive.sh - Interactive mode for Meta-Ralph
# Allows selecting issues, mode, and model interactively

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m'

# Provider color function
get_provider_color() {
    case "$1" in
        linear)   echo "$BLUE" ;;
        sentry)   echo "$MAGENTA" ;;
        codecov)  echo "$GREEN" ;;
        zeropath) echo "$RED" ;;
        github)   echo "$WHITE" ;;
        *)        echo "$GRAY" ;;
    esac
}

# Clear screen and show header
clear
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║           Meta-Ralph Interactive Mode                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Step 1: Select Provider
echo -e "${WHITE}Step 1: Select Provider${NC}"
echo ""
PS3=$'\n'"Select provider (number): "
providers=("linear" "sentry" "codecov" "zeropath" "all")
select provider in "${providers[@]}"; do
    if [[ -n "$provider" ]]; then
        if [[ "$provider" == "all" ]]; then
            PROVIDER_ARGS=()
        else
            PROVIDER_ARGS=(--providers "$provider")
        fi
        echo -e "${GREEN}✓ Provider: $provider${NC}"
        break
    fi
done

# Step 2: Fetch and display issues
echo ""
echo -e "${YELLOW}Fetching issues...${NC}"
issues_json=$(./meta-ralph.sh --dry-run --json "${PROVIDER_ARGS[@]}" 2>/dev/null)

if [[ -z "$issues_json" ]] || [[ "$issues_json" == "[]" ]]; then
    echo -e "${RED}No issues found!${NC}"
    exit 1
fi

# Parse issues into arrays
issue_count=$(echo "$issues_json" | jq 'length')
echo -e "${GREEN}Found $issue_count issues${NC}"
echo ""

# Display issues in a table
echo -e "${WHITE}Step 2: Select Issues${NC}"
echo ""
echo -e "${WHITE}#    ID             PROVIDER   PRIORITY     TITLE${NC}"
echo "──────────────────────────────────────────────────────────────────────────────"

declare -a issue_ids
declare -a issue_titles
idx=0

while IFS=$'\t' read -r id short_id provider priority severity title; do
    idx=$((idx + 1))
    issue_ids[$idx]="$id"

    # Handle null short_id
    if [[ "$short_id" == "null" ]] || [[ -z "$short_id" ]]; then
        display_id="${id:0:12}"
    else
        display_id="$short_id"
    fi

    # Determine priority label and color based on priority score and severity
    priority_label=""
    color="$GREEN"

    if [[ "$priority" =~ ^[0-9]+$ ]]; then
        if [[ "$priority" -ge 90 ]]; then
            priority_label="🔴 CRITICAL"
            color="$RED"
        elif [[ "$priority" -ge 70 ]]; then
            priority_label="🟠 HIGH"
            color="$YELLOW"
        elif [[ "$priority" -ge 40 ]]; then
            priority_label="🟡 MEDIUM"
            color="$CYAN"
        else
            priority_label="🟢 LOW"
            color="$GREEN"
        fi
    else
        # Use severity field if priority is not numeric
        # Use tr for lowercase (macOS bash doesn't support ${var,,})
        severity_lower=$(echo "$severity" | tr '[:upper:]' '[:lower:]')
        case "$severity_lower" in
            critical|urgent) priority_label="🔴 CRITICAL"; color="$RED" ;;
            high)            priority_label="🟠 HIGH"; color="$YELLOW" ;;
            medium)          priority_label="🟡 MEDIUM"; color="$CYAN" ;;
            *)               priority_label="🟢 LOW"; color="$GREEN" ;;
        esac
    fi

    provider_color=$(get_provider_color "$provider")
    printf "%-4s %-14s ${provider_color}%-10s${NC} ${color}%-12s${NC} %.40s\n" "$idx" "$display_id" "$provider" "$priority_label" "$title"
done < <(echo "$issues_json" | jq -r '.[] | [.id, (.short_id // "null"), .provider, (.priority | tostring), (.severity // "null"), (.title // "No title")] | @tsv')

echo ""
echo -e "${CYAN}Enter issue numbers to process (comma-separated, e.g., 1,3,5)${NC}"
echo -e "${CYAN}Or 'all' to process all, or 'q' to quit:${NC}"
read -p "> " selection

if [[ "$selection" == "q" ]]; then
    echo "Bye!"
    exit 0
fi

# Parse selection
selected_ids=""
if [[ "$selection" == "all" ]]; then
    for i in $(seq 1 $idx); do
        if [[ -n "$selected_ids" ]]; then
            selected_ids="$selected_ids,${issue_ids[$i]}"
        else
            selected_ids="${issue_ids[$i]}"
        fi
    done
else
    IFS=',' read -ra nums <<< "$selection"
    for num in "${nums[@]}"; do
        num=$(echo "$num" | tr -d ' ')
        if [[ -n "${issue_ids[$num]}" ]]; then
            if [[ -n "$selected_ids" ]]; then
                selected_ids="$selected_ids,${issue_ids[$num]}"
            else
                selected_ids="${issue_ids[$num]}"
            fi
        fi
    done
fi

if [[ -z "$selected_ids" ]]; then
    echo -e "${RED}No valid issues selected!${NC}"
    exit 1
fi

selected_count=$(echo "$selected_ids" | tr ',' '\n' | wc -l | tr -d ' ')
echo -e "${GREEN}✓ Selected $selected_count issue(s)${NC}"

# Step 3: Select Mode
echo ""
echo -e "${WHITE}Step 3: Select Mode${NC}"
echo ""
PS3=$'\n'"Select mode (number): "
modes=("plan" "build" "plan+build")
select mode_choice in "${modes[@]}"; do
    if [[ -n "$mode_choice" ]]; then
        echo -e "${GREEN}✓ Mode: $mode_choice${NC}"
        break
    fi
done

# Step 4: Select Model
echo ""
echo -e "${WHITE}Step 4: Select Model${NC}"
echo ""
PS3=$'\n'"Select model (number): "
models=("sonnet (fast, recommended)" "opus (powerful, slower)")
select model_choice in "${models[@]}"; do
    case $REPLY in
        1) MODEL="sonnet"; break ;;
        2) MODEL="opus"; break ;;
    esac
done
echo -e "${GREEN}✓ Model: $MODEL${NC}"

# Step 5: Confirm and execute
echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}Summary:${NC}"
echo -e "  Issues: $selected_count selected"
echo -e "  Mode:   $mode_choice"
echo -e "  Model:  $MODEL"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""
read -p "Proceed? (y/n): " confirm

if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    echo "Cancelled."
    exit 0
fi

# Execute
echo ""
echo -e "${YELLOW}Starting processing...${NC}"
echo ""

run_ralph() {
    local mode=$1
    echo -e "${BLUE}────────────────────────────────────────${NC}"
    echo -e "${WHITE}Running in $mode mode...${NC}"
    echo -e "${BLUE}────────────────────────────────────────${NC}"

    RALPH_MODE="$mode" RALPH_MODEL="$MODEL" ./meta-ralph.sh --only-ids "$selected_ids" "${PROVIDER_ARGS[@]}"
}

case "$mode_choice" in
    "plan")
        run_ralph "plan"
        ;;
    "build")
        run_ralph "build"
        ;;
    "plan+build")
        run_ralph "plan"
        echo ""
        echo -e "${YELLOW}Plan complete. Starting build phase...${NC}"
        echo ""
        run_ralph "build"
        ;;
esac

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}   Processing Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
