#!/bin/bash
# ralph-interactive.sh - Interactive mode for Meta-Ralph
# Allows selecting issues, mode, and model interactively

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load profile management
source "$SCRIPT_DIR/lib/profiles.sh"

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

# Step 1: Select Project Profile
echo -e "${WHITE}Step 1: Select Project${NC}"
echo ""

# Check if profiles exist
profiles_file=$(find_profiles_file 2>/dev/null || true)

if [[ -n "$profiles_file" ]]; then
    # Build profile list (compatible with bash 3.x)
    declare -a profile_names=()
    while IFS= read -r p; do
        profile_names+=("$p")
    done < <(list_profiles)

    # Display formatted menu
    echo -e "  ${GRAY}┌───────────────────────────────────────────────────────────┐${NC}"

    idx=1
    for profile in "${profile_names[@]}"; do
        # Get settings for display
        gh=$(get_profile_setting "$profile" "github" 2>/dev/null)
        ln=$(get_profile_setting "$profile" "linear" 2>/dev/null)
        st=$(get_profile_setting "$profile" "sentry" 2>/dev/null)
        zp=$(get_profile_setting "$profile" "zeropath" 2>/dev/null)

        # Build provider indicators (colored diamonds for configured providers)
        providers=""
        [[ -n "$ln" ]] && providers+=" ${BLUE}◆${NC}"
        [[ -n "$st" ]] && providers+=" ${MAGENTA}◆${NC}"
        [[ -n "$zp" ]] && providers+=" ${RED}◆${NC}"
        [[ -n "$gh" ]] && providers+=" ${WHITE}◆${NC}"

        # Format: number, profile name, github repo, provider indicators
        printf "  ${GRAY}│${NC}  ${CYAN}%d)${NC}  ${WHITE}%-20s${NC}  ${GRAY}%-22s${NC}%b  ${GRAY}│${NC}\n" \
            "$idx" "$profile" "${gh:-}" "$providers"
        ((idx++))
    done

    # Add special options with separator
    echo -e "  ${GRAY}├───────────────────────────────────────────────────────────┤${NC}"
    printf "  ${GRAY}│${NC}  ${CYAN}%d)${NC}  ${YELLOW}%-20s${NC}  ${GRAY}%-22s${NC}      ${GRAY}│${NC}\n" \
        "$idx" "Use .env defaults" ""
    ((idx++))
    printf "  ${GRAY}│${NC}  ${CYAN}%d)${NC}  ${YELLOW}%-20s${NC}  ${GRAY}%-22s${NC}      ${GRAY}│${NC}\n" \
        "$idx" "Create new profile" ""

    echo -e "  ${GRAY}└───────────────────────────────────────────────────────────┘${NC}"
    echo ""
    echo -e "  ${GRAY}Providers: ${BLUE}◆${NC}Linear ${MAGENTA}◆${NC}Sentry ${RED}◆${NC}Zeropath ${WHITE}◆${NC}GitHub${NC}"
    echo ""

    # Get user selection
    total_options=$((${#profile_names[@]} + 2))
    while true; do
        printf "  Select project ${CYAN}(1-%d)${NC}: " "$total_options"
        read -r selection

        if [[ "$selection" =~ ^[0-9]+$ ]] && [[ "$selection" -ge 1 ]] && [[ "$selection" -le "$total_options" ]]; then
            if [[ "$selection" -eq "$((total_options - 1))" ]]; then
                # Use .env defaults
                echo -e "  ${GREEN}✓${NC} Using current .env settings"
                break
            elif [[ "$selection" -eq "$total_options" ]]; then
                # Create new profile
                echo ""
                create_profile_interactive
                echo ""
                echo -e "  ${YELLOW}Please restart to use the new profile${NC}"
                exit 0
            else
                # Load selected profile
                selected_profile="${profile_names[$((selection - 1))]}"
                load_profile "$selected_profile"
                echo -e "  ${GREEN}✓${NC} Project: ${WHITE}$selected_profile${NC}"
                break
            fi
        else
            echo -e "  ${RED}Invalid selection. Enter a number 1-$total_options${NC}"
        fi
    done
else
    echo -e "  ${YELLOW}No profiles.conf found. Using .env settings.${NC}"
    echo -e "  ${GRAY}Tip: Copy profiles.example.conf to ~/.meta-ralph/profiles.conf${NC}"
fi

echo ""

# Step 2: Select Provider
echo -e "${WHITE}Step 2: Select Provider${NC}"
echo ""
PS3=$'\n'"Select provider (number): "
providers=("linear" "sentry" "codecov" "zeropath" "github" "all")
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

# Fetch and display issues
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
echo -e "${WHITE}Step 3: Select Issues${NC}"
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

# Step 4: Select Mode
echo ""
echo -e "${WHITE}Step 4: Select Mode${NC}"
echo ""
PS3=$'\n'"Select mode (number): "
modes=("plan" "build" "plan+build")
select mode_choice in "${modes[@]}"; do
    if [[ -n "$mode_choice" ]]; then
        echo -e "${GREEN}✓ Mode: $mode_choice${NC}"
        break
    fi
done

# Step 5: Select Model
echo ""
echo -e "${WHITE}Step 5: Select Model${NC}"
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

# Step 6: Max Iterations
echo ""
echo -e "${WHITE}Step 6: Max Iterations${NC}"
echo ""

# Helper function to get iterations input
get_iterations() {
    local label="$1"
    local default="$2"
    local result

    read -p "  $label iterations [1-20, default=$default]: " iter_input
    if [[ -z "$iter_input" ]]; then
        result=$default
    elif [[ "$iter_input" =~ ^[0-9]+$ ]] && [ "$iter_input" -ge 1 ] && [ "$iter_input" -le 20 ]; then
        result=$iter_input
    else
        echo -e "  ${YELLOW}Invalid input, using default ($default)${NC}"
        result=$default
    fi
    echo "$result"
}

if [[ "$mode_choice" == "plan+build" ]]; then
    # Separate iterations for plan and build
    echo -e "${GRAY}  Configure iterations for each phase:${NC}"
    echo ""
    echo -e "${GRAY}  ${CYAN}Plan phase:${NC} refines IMPLEMENTATION_PLAN.md${NC}"
    echo -e "${GRAY}    1-2: Quick outline | 3-5: Detailed plan (recommended)${NC}"
    echo ""
    PLAN_ITERATIONS=$(get_iterations "Plan" 3)
    echo -e "  ${GREEN}✓ Plan: $PLAN_ITERATIONS iterations${NC}"
    echo ""
    echo -e "${GRAY}  ${CYAN}Build phase:${NC} implements the plan${NC}"
    echo -e "${GRAY}    5-10: Simple fixes | 10-15: Standard | 15-20: Complex${NC}"
    echo ""
    BUILD_ITERATIONS=$(get_iterations "Build" 10)
    echo -e "  ${GREEN}✓ Build: $BUILD_ITERATIONS iterations${NC}"
    MAX_ITERATIONS="$PLAN_ITERATIONS + $BUILD_ITERATIONS"
else
    # Single mode - use standard iteration selector
    echo -e "${GRAY}  1-3:   Quick analysis${NC}"
    echo -e "${GRAY}  4-5:   Simple fixes${NC}"
    echo -e "${GRAY}  6-10:  Standard (default)${NC}"
    echo -e "${GRAY}  11-15: Complex issues${NC}"
    echo -e "${GRAY}  16-20: Thorough debugging${NC}"
    echo ""
    MAX_ITERATIONS=$(get_iterations "Max" 10)
    PLAN_ITERATIONS=$MAX_ITERATIONS
    BUILD_ITERATIONS=$MAX_ITERATIONS
    echo -e "${GREEN}✓ Max Iterations: $MAX_ITERATIONS${NC}"
fi

# Step 7: Verbose Output (show model activity)
echo ""
echo -e "${WHITE}Step 7: Verbose Output${NC}"
echo ""
echo -e "${GRAY}  Show real-time progress of what the model is doing?${NC}"
echo -e "${GRAY}  (Recommended for monitoring progress)${NC}"
echo ""
read -p "Enable verbose output? [Y/n]: " verbose_input
if [[ -z "$verbose_input" ]] || [[ "$verbose_input" == "y" ]] || [[ "$verbose_input" == "Y" ]]; then
    STREAM_MODE=true
    echo -e "${GREEN}✓ Verbose: Enabled${NC}"
else
    STREAM_MODE=false
    echo -e "${GREEN}✓ Verbose: Disabled${NC}"
fi

# Step 8: Confirm and execute
echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${WHITE}Summary:${NC}"
if [[ -n "${RALPH_CURRENT_PROFILE:-}" ]]; then
    echo -e "  Project:    ${CYAN}$RALPH_CURRENT_PROFILE${NC}"
fi
echo -e "  Issues:     $selected_count selected"
echo -e "  Mode:       $mode_choice"
echo -e "  Model:      $MODEL"
if [[ "$mode_choice" == "plan+build" ]]; then
    echo -e "  Iterations: Plan=$PLAN_ITERATIONS, Build=$BUILD_ITERATIONS"
else
    echo -e "  Iterations: $MAX_ITERATIONS max"
fi
echo -e "  Verbose:    $([[ "$STREAM_MODE" == "true" ]] && echo "Yes" || echo "No")"
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
    local iterations=$2
    echo -e "${BLUE}────────────────────────────────────────${NC}"
    echo -e "${WHITE}Running in $mode mode ($iterations iterations)...${NC}"
    echo -e "${BLUE}────────────────────────────────────────${NC}"

    RALPH_MODE="$mode" RALPH_MODEL="$MODEL" RALPH_STREAM_MODE="$STREAM_MODE" ./meta-ralph.sh --max-iterations "$iterations" --only-ids "$selected_ids" "${PROVIDER_ARGS[@]}"
}

case "$mode_choice" in
    "plan")
        run_ralph "plan" "$PLAN_ITERATIONS"
        ;;
    "build")
        run_ralph "build" "$BUILD_ITERATIONS"
        ;;
    "plan+build")
        run_ralph "plan" "$PLAN_ITERATIONS"
        echo ""
        echo -e "${YELLOW}════════════════════════════════════════${NC}"
        echo -e "${YELLOW}   Plan complete. Starting build...${NC}"
        echo -e "${YELLOW}════════════════════════════════════════${NC}"
        echo ""
        run_ralph "build" "$BUILD_ITERATIONS"
        ;;
esac

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}   Processing Complete!${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
