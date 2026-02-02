#!/bin/bash
# lib/interactive/wizard.sh - State machine wizard with bidirectional navigation
# Provides step-by-step wizard flow with back/forward navigation

# Source UI utilities
INTERACTIVE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$INTERACTIVE_DIR/ui.sh"

# Source estimator for cost/time estimates (optional)
source "$INTERACTIVE_DIR/estimator.sh" 2>/dev/null || true

# ============================================================================
# WIZARD STATE (bash 3.x compatible - no associative arrays)
# ============================================================================

# Step definitions (indexed array works in bash 3.x)
WIZARD_STEPS="profile provider issues mode model iterations verbose confirm"
WIZARD_STEPS_COUNT=8

# Current step index (0-based)
WIZARD_CURRENT_STEP=0

# State storage using prefixed variables (bash 3.x compatible)
# Instead of WIZARD_STATE["key"]="value", we use WIZARD_STATE_key="value"

# ============================================================================
# STATE MANAGEMENT (bash 3.x compatible)
# ============================================================================

# Set wizard state value
# Usage: wizard_set "key" "value"
wizard_set() {
    local key="$1"
    local value="$2"
    eval "WIZARD_STATE_${key}=\"\$value\""
}

# Get wizard state value
# Usage: wizard_get "key"
wizard_get() {
    local key="$1"
    eval "echo \"\${WIZARD_STATE_${key}:-}\""
}

# Check if state exists
# Usage: wizard_has "key"
wizard_has() {
    local key="$1"
    local value
    eval "value=\"\${WIZARD_STATE_${key}:-}\""
    [[ -n "$value" ]]
}

# Clear all state
wizard_clear() {
    # Clear known state variables
    unset WIZARD_STATE_profile WIZARD_STATE_profile_name
    unset WIZARD_STATE_provider WIZARD_STATE_provider_args
    unset WIZARD_STATE_issues_json WIZARD_STATE_selected_ids WIZARD_STATE_selected_count
    unset WIZARD_STATE_mode WIZARD_STATE_model
    unset WIZARD_STATE_plan_iterations WIZARD_STATE_build_iterations WIZARD_STATE_max_iterations
    unset WIZARD_STATE_stream_mode
    WIZARD_CURRENT_STEP=0
}

# ============================================================================
# NAVIGATION (bash 3.x compatible)
# ============================================================================

# Get step name by index
_wizard_get_step() {
    local idx="$1"
    local i=0
    for step in $WIZARD_STEPS; do
        if [[ $i -eq $idx ]]; then
            echo "$step"
            return 0
        fi
        i=$((i + 1))
    done
    echo ""
}

# Get current step name
wizard_current_step_name() {
    _wizard_get_step "$WIZARD_CURRENT_STEP"
}

# Get current step number (1-based for display)
wizard_current_step_number() {
    echo $((WIZARD_CURRENT_STEP + 1))
}

# Get total steps
wizard_total_steps() {
    echo "$WIZARD_STEPS_COUNT"
}

# Go to next step
wizard_next() {
    if [[ $WIZARD_CURRENT_STEP -lt $((WIZARD_STEPS_COUNT - 1)) ]]; then
        WIZARD_CURRENT_STEP=$((WIZARD_CURRENT_STEP + 1))
        return 0
    fi
    return 1
}

# Go to previous step
wizard_back() {
    if [[ $WIZARD_CURRENT_STEP -gt 0 ]]; then
        WIZARD_CURRENT_STEP=$((WIZARD_CURRENT_STEP - 1))
        return 0
    fi
    return 1
}

# Go to specific step by name
# Usage: wizard_goto "provider"
wizard_goto() {
    local target="$1"
    local i=0
    for step in $WIZARD_STEPS; do
        if [[ "$step" == "$target" ]]; then
            WIZARD_CURRENT_STEP=$i
            return 0
        fi
        i=$((i + 1))
    done
    return 1
}

# Check if can go back
wizard_can_back() {
    [[ $WIZARD_CURRENT_STEP -gt 0 ]]
}

# Check if can go forward
wizard_can_next() {
    [[ $WIZARD_CURRENT_STEP -lt $((${#WIZARD_STEPS[@]} - 1)) ]]
}

# ============================================================================
# STEP EXECUTION
# ============================================================================

# Run current step
# Returns: 0 = continue to next, 1 = go back, 2 = quit
wizard_run_step() {
    local step_name=$(wizard_current_step_name)
    local step_num=$(wizard_current_step_number)
    local result

    # Clear screen for fresh display (optional)
    # clear

    case "$step_name" in
        profile)    wizard_step_profile ;;
        provider)   wizard_step_provider ;;
        issues)     wizard_step_issues ;;
        mode)       wizard_step_mode ;;
        model)      wizard_step_model ;;
        iterations) wizard_step_iterations ;;
        verbose)    wizard_step_verbose ;;
        confirm)    wizard_step_confirm ;;
        *)
            print_error "Unknown step: $step_name"
            return 2
            ;;
    esac
    return $?
}

# Main wizard loop
# Usage: wizard_run
wizard_run() {
    while true; do
        local result
        wizard_run_step
        result=$?

        case $result in
            0)  # Next
                if ! wizard_next; then
                    # Last step completed successfully
                    return 0
                fi
                ;;
            1)  # Back
                if ! wizard_back; then
                    print_warning "Already at first step"
                fi
                ;;
            2)  # Quit
                echo ""
                echo "Bye!"
                return 1
                ;;
            *)
                print_error "Unexpected result: $result"
                return 1
                ;;
        esac
    done
}

# ============================================================================
# STEP IMPLEMENTATIONS
# ============================================================================

# Step 1: Profile Selection
wizard_step_profile() {
    print_step_nav 1 "Select Project" false

    # Check if profiles exist
    local profiles_file=$(find_profiles_file 2>/dev/null || true)

    if [[ -n "$profiles_file" ]]; then
        # Build profile list (bash 3.x compatible - use newline-separated string)
        local profile_names_str=""
        local profile_count=0
        while IFS= read -r p; do
            if [[ -n "$profile_names_str" ]]; then
                profile_names_str="$profile_names_str
$p"
            else
                profile_names_str="$p"
            fi
            profile_count=$((profile_count + 1))
        done < <(list_profiles)

        # Display menu
        print_menu_start

        local idx=1
        echo "$profile_names_str" | while IFS= read -r profile; do
            local gh=$(get_profile_setting "$profile" "github" 2>/dev/null)
            local ln=$(get_profile_setting "$profile" "linear" 2>/dev/null)
            local st=$(get_profile_setting "$profile" "sentry" 2>/dev/null)
            local zp=$(get_profile_setting "$profile" "zeropath" 2>/dev/null)

            # Provider indicators
            local providers=""
            [[ -n "$ln" ]] && providers+=" ${BLUE}◆${NC}"
            [[ -n "$st" ]] && providers+=" ${MAGENTA}◆${NC}"
            [[ -n "$zp" ]] && providers+=" ${RED}◆${NC}"
            [[ -n "$gh" ]] && providers+=" ${WHITE}◆${NC}"

            print_menu_item "$idx" "$profile" "${gh:-}" "$providers"
            idx=$((idx + 1))
        done
        idx=$((profile_count + 1))

        print_menu_separator

        # Special options
        print_menu_item "$idx" "Use .env defaults" ""
        local env_option=$idx
        ((idx++))
        print_menu_item "$idx" "Create new profile" ""
        local create_option=$idx

        print_menu_end
        echo ""
        echo -e "  ${GRAY}Providers: ${BLUE}◆${NC}Linear ${MAGENTA}◆${NC}Sentry ${RED}◆${NC}Zeropath ${WHITE}◆${NC}GitHub${NC}"
        echo ""

        # Get selection
        local total_options=$idx
        while true; do
            printf "  Select project ${CYAN}(1-%d)${NC} or ${GRAY}[q]uit${NC}: " "$total_options"
            read -r selection

            case "$selection" in
                q|Q|quit) return 2 ;;
            esac

            if [[ "$selection" =~ ^[0-9]+$ ]] && [[ "$selection" -ge 1 ]] && [[ "$selection" -le "$total_options" ]]; then
                if [[ "$selection" -eq "$env_option" ]]; then
                    wizard_set "profile" ""
                    wizard_set "profile_name" ".env defaults"
                    print_success "Using current .env settings"
                    return 0
                elif [[ "$selection" -eq "$create_option" ]]; then
                    echo ""
                    create_profile_interactive
                    echo ""
                    print_warning "Please restart to use the new profile"
                    return 2
                else
                    # Get profile name by line number (bash 3.x compatible)
                    local selected_profile=$(echo "$profile_names_str" | sed -n "${selection}p")
                    load_profile "$selected_profile"
                    wizard_set "profile" "$selected_profile"
                    wizard_set "profile_name" "$selected_profile"
                    print_success "Project: ${WHITE}$selected_profile${NC}"
                    return 0
                fi
            else
                print_error "Invalid selection. Enter a number 1-$total_options"
            fi
        done
    else
        print_warning "No profiles.conf found. Using .env settings."
        echo -e "  ${GRAY}Tip: Copy profiles.example.conf to ~/.meta-ralph/profiles.conf${NC}"
        wizard_set "profile" ""
        wizard_set "profile_name" ".env defaults"
        return 0
    fi
}

# Step 2: Provider Selection
wizard_step_provider() {
    print_step_nav 2 "Select Provider"

    local providers=("linear" "sentry" "codecov" "zeropath" "github" "all")

    echo -e "  ${GRAY}Select which provider to fetch issues from:${NC}"
    echo ""

    local idx=1
    for p in "${providers[@]}"; do
        local color=$(get_provider_color "$p")
        printf "  ${CYAN}%d)${NC} ${color}%s${NC}\n" "$idx" "$p"
        ((idx++))
    done
    echo ""

    while true; do
        printf "  Select provider ${CYAN}(1-%d)${NC}, ${GRAY}[b]ack, [q]uit${NC}: " "${#providers[@]}"
        read -r selection

        case "$selection" in
            b|B|back) return 1 ;;
            q|Q|quit) return 2 ;;
        esac

        if [[ "$selection" =~ ^[0-9]+$ ]] && [[ "$selection" -ge 1 ]] && [[ "$selection" -le "${#providers[@]}" ]]; then
            local provider="${providers[$((selection - 1))]}"
            wizard_set "provider" "$provider"

            if [[ "$provider" == "all" ]]; then
                wizard_set "provider_args" ""
            else
                wizard_set "provider_args" "--providers $provider"
            fi

            print_success "Provider: $provider"
            return 0
        else
            print_error "Invalid selection"
        fi
    done
}

# Step 3: Issue Selection
wizard_step_issues() {
    print_step_nav 3 "Select Issues"

    echo -e "${YELLOW}Fetching issues...${NC}"

    # Build provider args
    local provider_args_str=$(wizard_get "provider_args")
    local -a provider_args=()
    if [[ -n "$provider_args_str" ]]; then
        read -ra provider_args <<< "$provider_args_str"
    fi

    # Fetch issues
    local issues_json
    issues_json=$(./meta-ralph.sh --dry-run --json "${provider_args[@]}" 2>/dev/null)

    if [[ -z "$issues_json" ]] || [[ "$issues_json" == "[]" ]]; then
        print_error "No issues found!"
        echo ""
        echo -e "  ${GRAY}Try selecting a different provider or check your configuration.${NC}"
        echo ""
        printf "  Press ${GRAY}[b]ack${NC} to change provider or ${GRAY}[q]uit${NC}: "
        read -r input
        case "$input" in
            b|B|back) return 1 ;;
            *) return 2 ;;
        esac
    fi

    # Store issues for later
    wizard_set "issues_json" "$issues_json"

    local issue_count=$(echo "$issues_json" | jq 'length')
    print_success "Found $issue_count issues"
    echo ""

    # Display issues table
    echo -e "${WHITE}#    ID             PROVIDER   PRIORITY     TITLE${NC}"
    draw_line 78 "─" "$GRAY"

    # Build issue IDs list (bash 3.x compatible - newline separated)
    local issue_ids_str=""
    local idx=0

    while IFS=$'\t' read -r id short_id provider priority severity title; do
        idx=$((idx + 1))

        # Append to issue IDs string (1-indexed, so line 1 = issue 1)
        if [[ -n "$issue_ids_str" ]]; then
            issue_ids_str="$issue_ids_str
$id"
        else
            issue_ids_str="$id"
        fi

        # Handle null short_id
        local display_id
        if [[ "$short_id" == "null" ]] || [[ -z "$short_id" ]]; then
            display_id="${id:0:12}"
        else
            display_id="$short_id"
        fi

        # Get priority info
        local priority_info=$(get_priority_info "$priority" "$severity")
        local priority_label=$(echo "$priority_info" | cut -d'|' -f1)
        local color=$(echo "$priority_info" | cut -d'|' -f2)

        local provider_color=$(get_provider_color "$provider")

        # Add emoji based on priority
        local emoji=""
        case "$priority_label" in
            CRITICAL) emoji="🔴" ;;
            HIGH)     emoji="🟠" ;;
            MEDIUM)   emoji="🟡" ;;
            LOW)      emoji="🟢" ;;
        esac

        printf "%-4s %-14s ${provider_color}%-10s${NC} ${color}%-12s${NC} %.40s\n" \
            "$idx" "$display_id" "$provider" "$emoji $priority_label" "$title"
    done < <(echo "$issues_json" | jq -r '.[] | [.id, (.short_id // "null"), .provider, (.priority | tostring), (.severity // "null"), (.title // "No title")] | @tsv')

    # Store issue IDs for selection
    wizard_set "issue_ids_str" "$issue_ids_str"
    wizard_set "issue_count" "$idx"

    echo ""
    echo -e "${CYAN}Enter issue numbers (comma-separated, e.g., 1,3,5)${NC}"
    echo -e "${CYAN}Or 'all' to process all:${NC}"
    echo ""

    while true; do
        printf "  Selection, ${GRAY}[b]ack, [q]uit${NC}: "
        read -r selection

        case "$selection" in
            b|B|back) return 1 ;;
            q|Q|quit) return 2 ;;
        esac

        # Parse selection
        local selected_ids=""
        if [[ "$selection" == "all" ]]; then
            # Select all issues
            selected_ids=$(echo "$issue_ids_str" | tr '\n' ',' | sed 's/,$//')
        else
            # Parse comma-separated numbers
            local nums=$(echo "$selection" | tr ',' ' ')
            for num in $nums; do
                num=$(echo "$num" | tr -d ' ')
                if [[ "$num" =~ ^[0-9]+$ ]] && [[ "$num" -ge 1 ]] && [[ "$num" -le "$idx" ]]; then
                    # Get issue ID by line number
                    local issue_id=$(echo "$issue_ids_str" | sed -n "${num}p")
                    if [[ -n "$issue_id" ]]; then
                        if [[ -n "$selected_ids" ]]; then
                            selected_ids="$selected_ids,$issue_id"
                        else
                            selected_ids="$issue_id"
                        fi
                    fi
                fi
            done
        fi

        if [[ -z "$selected_ids" ]]; then
            print_error "No valid issues selected!"
        else
            wizard_set "selected_ids" "$selected_ids"
            local selected_count=$(echo "$selected_ids" | tr ',' '\n' | wc -l | tr -d ' ')
            wizard_set "selected_count" "$selected_count"
            print_success "Selected $selected_count issue(s)"
            return 0
        fi
    done
}

# Step 4: Mode Selection
wizard_step_mode() {
    print_step_nav 4 "Select Mode"

    local modes=("plan" "build" "plan+build")
    local descriptions=(
        "Analyze and create IMPLEMENTATION_PLAN.md only"
        "Implement the fix directly"
        "First plan, then build (recommended)"
    )

    echo -e "  ${GRAY}Choose how to process the selected issues:${NC}"
    echo ""

    local idx=1
    for mode in "${modes[@]}"; do
        printf "  ${CYAN}%d)${NC} ${WHITE}%-12s${NC} ${GRAY}- %s${NC}\n" "$idx" "$mode" "${descriptions[$((idx-1))]}"
        ((idx++))
    done
    echo ""

    while true; do
        printf "  Select mode ${CYAN}(1-%d)${NC}, ${GRAY}[b]ack, [q]uit${NC}: " "${#modes[@]}"
        read -r selection

        case "$selection" in
            b|B|back) return 1 ;;
            q|Q|quit) return 2 ;;
        esac

        if [[ "$selection" =~ ^[0-9]+$ ]] && [[ "$selection" -ge 1 ]] && [[ "$selection" -le "${#modes[@]}" ]]; then
            local mode="${modes[$((selection - 1))]}"
            wizard_set "mode" "$mode"
            print_success "Mode: $mode"
            return 0
        else
            print_error "Invalid selection"
        fi
    done
}

# Step 5: Model Selection
wizard_step_model() {
    print_step_nav 5 "Select Model"

    local models=("sonnet" "opus")
    local descriptions=(
        "Fast, efficient, recommended for most tasks"
        "More powerful, slower, for complex analysis"
    )

    echo -e "  ${GRAY}Choose the Claude model to use:${NC}"
    echo ""

    local idx=1
    for model in "${models[@]}"; do
        local suffix=""
        [[ "$idx" -eq 1 ]] && suffix=" ${GREEN}(recommended)${NC}"
        printf "  ${CYAN}%d)${NC} ${WHITE}%-8s${NC} ${GRAY}- %s${NC}%b\n" "$idx" "$model" "${descriptions[$((idx-1))]}" "$suffix"
        ((idx++))
    done
    echo ""

    while true; do
        printf "  Select model ${CYAN}(1-%d)${NC}, ${GRAY}[b]ack, [q]uit${NC}: " "${#models[@]}"
        read -r selection

        case "$selection" in
            b|B|back) return 1 ;;
            q|Q|quit) return 2 ;;
        esac

        if [[ "$selection" =~ ^[0-9]+$ ]] && [[ "$selection" -ge 1 ]] && [[ "$selection" -le "${#models[@]}" ]]; then
            local model="${models[$((selection - 1))]}"
            wizard_set "model" "$model"
            print_success "Model: $model"
            return 0
        else
            print_error "Invalid selection"
        fi
    done
}

# Step 6: Iterations Configuration
wizard_step_iterations() {
    print_step_nav 6 "Max Iterations"

    local mode=$(wizard_get "mode")

    if [[ "$mode" == "plan+build" ]]; then
        echo -e "  ${GRAY}Configure iterations for each phase:${NC}"
        echo ""

        # Plan iterations
        echo -e "  ${CYAN}Plan phase:${NC} ${GRAY}refines IMPLEMENTATION_PLAN.md${NC}"
        echo -e "  ${GRAY}  1-2: Quick outline | 3-5: Detailed plan (recommended)${NC}"
        echo ""

        local plan_iters
        read_number "Plan iterations" 1 20 3
        case $? in
            1) return 1 ;;
            2) return 2 ;;
        esac
        plan_iters="$INPUT_VALUE"
        wizard_set "plan_iterations" "$plan_iters"
        print_success "Plan: $plan_iters iterations"

        echo ""

        # Build iterations
        echo -e "  ${CYAN}Build phase:${NC} ${GRAY}implements the plan${NC}"
        echo -e "  ${GRAY}  5-10: Simple fixes | 10-15: Standard | 15-20: Complex${NC}"
        echo ""

        local build_iters
        read_number "Build iterations" 1 20 10
        case $? in
            1) return 1 ;;
            2) return 2 ;;
        esac
        build_iters="$INPUT_VALUE"
        wizard_set "build_iterations" "$build_iters"
        wizard_set "max_iterations" "$((plan_iters + build_iters))"
        print_success "Build: $build_iters iterations"

    else
        echo -e "  ${GRAY}How many iterations should the model run?${NC}"
        echo ""
        echo -e "  ${GRAY}  1-3:   Quick analysis${NC}"
        echo -e "  ${GRAY}  4-5:   Simple fixes${NC}"
        echo -e "  ${GRAY}  6-10:  Standard (default)${NC}"
        echo -e "  ${GRAY}  11-15: Complex issues${NC}"
        echo -e "  ${GRAY}  16-20: Thorough debugging${NC}"
        echo ""

        local max_iters
        read_number "Max iterations" 1 20 10
        case $? in
            1) return 1 ;;
            2) return 2 ;;
        esac
        max_iters="$INPUT_VALUE"
        wizard_set "max_iterations" "$max_iters"
        wizard_set "plan_iterations" "$max_iters"
        wizard_set "build_iterations" "$max_iters"
        print_success "Max Iterations: $max_iters"
    fi

    return 0
}

# Step 7: Verbose Output
wizard_step_verbose() {
    print_step_nav 7 "Verbose Output"

    echo -e "  ${GRAY}Show real-time progress of what the model is doing?${NC}"
    echo -e "  ${GRAY}(Recommended for monitoring progress)${NC}"
    echo ""

    read_yes_no "Enable verbose output?" true
    local result=$?

    case $result in
        0)
            wizard_set "stream_mode" "true"
            print_success "Verbose: Enabled"
            ;;
        1) return 1 ;;
        2) return 2 ;;
        *)
            wizard_set "stream_mode" "false"
            print_success "Verbose: Disabled"
            ;;
    esac

    return 0
}

# Step 8: Confirm and Execute
wizard_step_confirm() {
    print_step_nav 8 "Confirm"

    # Display summary
    echo -e "${BLUE}$(draw_line 62 "$BOX2_H")${NC}"
    echo -e "${WHITE}Summary:${NC}"

    local profile_name=$(wizard_get "profile_name")
    [[ -n "$profile_name" ]] && echo -e "  Project:    ${CYAN}$profile_name${NC}"

    echo -e "  Provider:   $(wizard_get "provider")"
    echo -e "  Issues:     $(wizard_get "selected_count") selected"
    echo -e "  Mode:       $(wizard_get "mode")"
    echo -e "  Model:      $(wizard_get "model")"

    local mode=$(wizard_get "mode")
    if [[ "$mode" == "plan+build" ]]; then
        echo -e "  Iterations: Plan=$(wizard_get "plan_iterations"), Build=$(wizard_get "build_iterations")"
    else
        echo -e "  Iterations: $(wizard_get "max_iterations") max"
    fi

    local stream_mode=$(wizard_get "stream_mode")
    echo -e "  Verbose:    $([[ "$stream_mode" == "true" ]] && echo "Yes" || echo "No")"

    echo -e "${BLUE}$(draw_line 62 "$BOX2_H")${NC}"

    # Display cost/time estimate if estimator is available
    if declare -f estimator_display_estimate >/dev/null 2>&1; then
        local issue_count=$(wizard_get "selected_count")
        local model=$(wizard_get "model")
        local mode=$(wizard_get "mode")
        local iterations

        if [[ "$mode" == "plan+build" ]]; then
            # Combined iterations for plan+build
            local plan_iters=$(wizard_get "plan_iterations")
            local build_iters=$(wizard_get "build_iterations")
            iterations=$((plan_iters + build_iters))
        else
            iterations=$(wizard_get "max_iterations")
        fi

        estimator_display_estimate "$issue_count" "$mode" "$model" "$iterations"
    fi
    echo ""

    while true; do
        printf "  ${WHITE}Proceed?${NC} ${GRAY}[y]es, [b]ack, [q]uit${NC}: "
        read -r confirm

        case "$confirm" in
            y|Y|yes) return 0 ;;
            b|B|back) return 1 ;;
            n|N|no|q|Q|quit) return 2 ;;
            *)
                print_error "Please enter y, b, or q"
                ;;
        esac
    done
}

# ============================================================================
# EXECUTION
# ============================================================================

# Execute the configured processing
wizard_execute() {
    local mode=$(wizard_get "mode")
    local model=$(wizard_get "model")
    local stream_mode=$(wizard_get "stream_mode")
    local selected_ids=$(wizard_get "selected_ids")
    local plan_iters=$(wizard_get "plan_iterations")
    local build_iters=$(wizard_get "build_iterations")

    # Build provider args
    local provider_args_str=$(wizard_get "provider_args")
    local -a provider_args=()
    if [[ -n "$provider_args_str" ]]; then
        read -ra provider_args <<< "$provider_args_str"
    fi

    echo ""
    echo -e "${YELLOW}Starting processing...${NC}"
    echo ""

    run_ralph() {
        local run_mode=$1
        local iterations=$2

        echo -e "${BLUE}$(draw_line 40 "─")${NC}"
        echo -e "${WHITE}Running in $run_mode mode ($iterations iterations)...${NC}"
        echo -e "${BLUE}$(draw_line 40 "─")${NC}"

        RALPH_MODE="$run_mode" \
        RALPH_MODEL="$model" \
        RALPH_STREAM_MODE="$stream_mode" \
            ./meta-ralph.sh --max-iterations "$iterations" --only-ids "$selected_ids" "${provider_args[@]}"
    }

    case "$mode" in
        "plan")
            run_ralph "plan" "$plan_iters"
            ;;
        "build")
            run_ralph "build" "$build_iters"
            ;;
        "plan+build")
            run_ralph "plan" "$plan_iters"
            echo ""
            echo -e "${YELLOW}$(draw_line 40 "═")${NC}"
            echo -e "${YELLOW}   Plan complete. Starting build...${NC}"
            echo -e "${YELLOW}$(draw_line 40 "═")${NC}"
            echo ""
            run_ralph "build" "$build_iters"
            ;;
    esac

    echo ""
    echo -e "${GREEN}$(draw_line 40 "═")${NC}"
    echo -e "${GREEN}   Processing Complete!${NC}"
    echo -e "${GREEN}$(draw_line 40 "═")${NC}"
}
