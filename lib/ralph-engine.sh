#!/bin/bash
# lib/ralph-engine.sh
# The Ralph Wiggum fix loop engine
# Refactored from the original ralph-fix.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source workspace manager for multi-repo support (optional)
# This enables processing issues that target external repositories
source "$SCRIPT_DIR/lib/workspace-manager.sh" 2>/dev/null || true

# Source interactive UI utilities for spinner (optional)
# This enables loading animation while waiting for Claude response
source "$SCRIPT_DIR/lib/interactive/ui.sh" 2>/dev/null || true

# Source interactive summary for failure analysis (optional)
source "$SCRIPT_DIR/lib/interactive/summary.sh" 2>/dev/null || true

# ============================================================================
# LOADING SPINNER
# ============================================================================

# Spinner state
_SPINNER_PID=""
_SPINNER_ACTIVE=false

# Spinner characters (Braille pattern animation)
_SPINNER_CHARS=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')

# Start the thinking spinner
# Usage: start_thinking_spinner
start_thinking_spinner() {
    # Don't start if already running or not in stream mode
    [[ "$_SPINNER_ACTIVE" == "true" ]] && return
    [[ "${RALPH_STREAM_MODE:-false}" != "true" ]] && return

    _SPINNER_ACTIVE=true

    (
        local i=0
        while true; do
            printf "\r  ${YELLOW}${_SPINNER_CHARS[$i]}${NC} ${GRAY}Thinking...${NC}  "
            i=$(( (i + 1) % ${#_SPINNER_CHARS[@]} ))
            sleep 0.1
        done
    ) &
    _SPINNER_PID=$!
    disown $_SPINNER_PID 2>/dev/null
}

# Stop the thinking spinner and clear the line
# Usage: stop_thinking_spinner
stop_thinking_spinner() {
    if [[ -n "$_SPINNER_PID" ]] && [[ "$_SPINNER_ACTIVE" == "true" ]]; then
        kill $_SPINNER_PID 2>/dev/null
        wait $_SPINNER_PID 2>/dev/null
        _SPINNER_PID=""
        _SPINNER_ACTIVE=false
        printf "\r%*s\r" 40 ""  # Clear the spinner line
    fi
}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m'

# ============================================================================
# COST TRACKING (imported from cwralph)
# ============================================================================

RALPH_DATA_DIR="$HOME/.ralph"
COST_FILE="$RALPH_DATA_DIR/costs.json"
ITERATION_COST_FILE=""
SESSION_COST=0
SESSION_DURATION=0
ALLTIME_COST=0
ALLTIME_DURATION=0
CURRENT_ITERATION=0

# Initialize cost tracking
init_cost_tracking() {
    mkdir -p "$RALPH_DATA_DIR"
    if [ ! -f "$COST_FILE" ]; then
        echo '{"total_cost_usd":0,"total_duration_ms":0,"sessions":[]}' > "$COST_FILE"
    fi

    # Create temp file for iteration costs
    ITERATION_COST_FILE=$(mktemp)

    # Load all-time totals
    ALLTIME_COST=$(jq -r '.total_cost_usd // 0' "$COST_FILE" 2>/dev/null || echo "0")
    ALLTIME_DURATION=$(jq -r '.total_duration_ms // 0' "$COST_FILE" 2>/dev/null || echo "0")
}

# Cleanup temp files
cleanup_cost_tracking() {
    [ -n "$ITERATION_COST_FILE" ] && rm -f "$ITERATION_COST_FILE"
}

# Save session costs to persistent file
save_session_costs() {
    if [ "$(echo "$SESSION_COST > 0" | bc 2>/dev/null || echo "0")" -eq 1 ]; then
        local session_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
        local mode="${RALPH_MODE:-build}"
        local updated=$(jq --arg date "$session_date" \
            --arg mode "$mode" \
            --argjson cost "$SESSION_COST" \
            --argjson duration "$SESSION_DURATION" \
            --argjson iterations "$CURRENT_ITERATION" \
            '.total_cost_usd = (.total_cost_usd + $cost) |
             .total_duration_ms = (.total_duration_ms + $duration) |
             .sessions += [{"date": $date, "mode": $mode, "cost_usd": $cost, "duration_ms": $duration, "iterations": $iterations}]' \
            "$COST_FILE" 2>/dev/null)
        if [ -n "$updated" ]; then
            echo "$updated" > "$COST_FILE"
        fi
    fi
}

# Display cost summary
show_cost_summary() {
    local new_alltime_cost=$(jq -r '.total_cost_usd // 0' "$COST_FILE" 2>/dev/null || echo "0")
    local new_alltime_duration=$(jq -r '.total_duration_ms // 0' "$COST_FILE" 2>/dev/null || echo "0")
    local alltime_duration_hrs=$(echo "scale=2; $new_alltime_duration / 3600000" | bc 2>/dev/null || echo "0")
    local session_duration_min=$(echo "scale=1; $SESSION_DURATION / 60000" | bc 2>/dev/null || echo "0")

    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}💰 Cost Summary${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    printf "  ${YELLOW}This session:${NC}  \$%.4f (%s min)\n" "$SESSION_COST" "$session_duration_min"
    printf "  ${YELLOW}All-time:${NC}      \$%.4f (%s hrs)\n" "$new_alltime_cost" "$alltime_duration_hrs"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Accumulate costs from iteration
accumulate_iteration_cost() {
    if [ -f "$ITERATION_COST_FILE" ] && [ -s "$ITERATION_COST_FILE" ]; then
        while read -r iter_cost iter_duration; do
            if [ -n "$iter_cost" ] && [ -n "$iter_duration" ]; then
                SESSION_COST=$(echo "$SESSION_COST + $iter_cost" | bc 2>/dev/null || echo "$SESSION_COST")
                SESSION_DURATION=$(echo "$SESSION_DURATION + $iter_duration" | bc 2>/dev/null || echo "$SESSION_DURATION")
            fi
        done < "$ITERATION_COST_FILE"
        # Clear the temp file for next iteration
        > "$ITERATION_COST_FILE"
    fi
}

# ============================================================================
# FAILURE ANALYSIS
# ============================================================================

# Analyze failure and extract useful information
# Args: progress_file, iterations_done, max_iterations
analyze_failure() {
    local progress_file="$1"
    local iterations="$2"
    local max_iterations="$3"
    local issue_id="${4:-unknown}"

    # Try to extract last error from progress file
    local last_error=""
    if [[ -f "$progress_file" ]]; then
        # Look for error patterns in progress file
        last_error=$(grep -iE "(error|fail|exception|panic|crash|rejected)" "$progress_file" 2>/dev/null | tail -1 || echo "")
        if [[ -z "$last_error" ]]; then
            # Get last substantive line
            last_error=$(grep -v "^$\|^#\|^===" "$progress_file" 2>/dev/null | tail -1 || echo "No error captured")
        fi
    fi

    # Calculate rough progress percentage based on iterations
    local progress_pct=0
    if [[ "$max_iterations" -gt 0 ]]; then
        progress_pct=$((iterations * 100 / max_iterations))
    fi

    # Generate suggestions based on context
    local suggestions=()

    # Analyze error type and suggest accordingly
    if echo "$last_error" | grep -qi "test"; then
        suggestions+=("Review test expectations vs actual behavior")
        suggestions+=("Check if mock data or fixtures need updating")
    fi

    if echo "$last_error" | grep -qi "build\|compile\|lint"; then
        suggestions+=("Check for syntax errors in modified files")
        suggestions+=("Verify import statements are correct")
    fi

    if echo "$last_error" | grep -qi "permission\|denied\|auth"; then
        suggestions+=("Verify authentication tokens are valid")
        suggestions+=("Check repository access permissions")
    fi

    # Always add generic suggestions
    if [[ $iterations -lt $((max_iterations / 2)) ]]; then
        suggestions+=("Try running with more iterations (current: $iterations)")
    fi

    suggestions+=("Review logs in progress file for detailed error trace")
    suggestions+=("Consider simplifying the issue scope")

    # Display failure analysis using summary module if available
    if declare -f summary_failure_analysis >/dev/null 2>&1; then
        summary_failure_analysis "$issue_id" "$last_error" "$iterations" "$progress_pct" "${suggestions[@]}"
    else
        # Fallback: simple failure display
        echo ""
        echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║${NC}  ${YELLOW}⚠️  ISSUE NOT RESOLVED - FAILURE ANALYSIS${NC}                   ${RED}║${NC}"
        echo -e "${RED}╠══════════════════════════════════════════════════════════════╣${NC}"
        printf "${RED}║${NC}  ${WHITE}Issue:${NC}     %-50s ${RED}║${NC}\n" "$issue_id"
        printf "${RED}║${NC}  ${WHITE}Attempts:${NC}  %-50s ${RED}║${NC}\n" "$iterations iterations"
        printf "${RED}║${NC}  ${WHITE}Progress:${NC}  %-50s ${RED}║${NC}\n" "${progress_pct}%"
        echo -e "${RED}║${NC}                                                              ${RED}║${NC}"
        printf "${RED}║${NC}  ${WHITE}Last Error:${NC}                                                ${RED}║${NC}\n"
        # Truncate error to fit in box
        local truncated_error="${last_error:0:54}"
        printf "${RED}║${NC}    ${GRAY}%-56s${NC} ${RED}║${NC}\n" "$truncated_error"
        echo -e "${RED}║${NC}                                                              ${RED}║${NC}"
        printf "${RED}║${NC}  ${WHITE}Suggestions:${NC}                                               ${RED}║${NC}\n"
        for suggestion in "${suggestions[@]}"; do
            local truncated_sug="${suggestion:0:54}"
            printf "${RED}║${NC}    ${CYAN}•${NC} %-54s ${RED}║${NC}\n" "$truncated_sug"
        done
        echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
        echo ""
    fi
}

# ============================================================================
# STREAMING SUPPORT
# ============================================================================

# Emit a JSON event for streaming mode
# Args: issue_id, event_type, payload_json
emit_ralph_event() {
    local issue_id="$1"
    local event_type="$2"
    local payload="$3"

    # RALPH_JSON_EVENTS controls whether to emit JSON events (for web UI)
    # RALPH_STREAM_MODE controls verbose CLI output (human-readable)
    # When running from CLI with verbose, we want human output but not JSON spam
    if [[ "${RALPH_JSON_EVENTS:-false}" == "true" ]]; then
        echo "RALPH_EVENT:{\"type\":\"$event_type\",\"issueId\":\"$issue_id\",\"payload\":$payload}"
    fi
}

# Emit an activity event
# Args: issue_id, activity_type, tool, details, status
emit_activity() {
    local issue_id="$1"
    local activity_type="$2"  # tool, message, result, error, push, ci
    local tool="${3:-}"
    local details="${4:-}"
    local status="${5:-running}"
    local duration="${6:-}"

    local id="activity-$(date +%s%N | cut -c1-13)"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    local payload="{\"id\":\"$id\",\"timestamp\":\"$timestamp\",\"type\":\"$activity_type\""
    [[ -n "$tool" ]] && payload="$payload,\"tool\":\"$tool\""
    [[ -n "$details" ]] && payload="$payload,\"details\":$(echo "$details" | jq -Rs .)"
    [[ -n "$status" ]] && payload="$payload,\"status\":\"$status\""
    [[ -n "$duration" ]] && payload="$payload,\"duration\":$duration"
    payload="$payload}"

    emit_ralph_event "$issue_id" "activity" "$payload"
}

# Emit metrics event
# Args: issue_id, iteration, max_iterations, cost_usd, duration_ms, total_cost, total_duration
emit_metrics() {
    local issue_id="$1"
    local iteration="$2"
    local max_iterations="$3"
    local cost_usd="${4:-0}"
    local duration_ms="${5:-0}"
    local total_cost="${6:-0}"
    local total_duration="${7:-0}"

    local payload="{\"iteration\":$iteration,\"maxIterations\":$max_iterations,\"costUsd\":$cost_usd,\"durationMs\":$duration_ms,\"totalCostUsd\":$total_cost,\"totalDurationMs\":$total_duration}"

    emit_ralph_event "$issue_id" "metrics" "$payload"
}

# Emit complete event
# Args: issue_id, message
emit_complete() {
    local issue_id="$1"
    local message="${2:-Processing completed}"

    emit_ralph_event "$issue_id" "complete" "{\"message\":$(echo "$message" | jq -Rs .)}"
}

# Emit error event
# Args: issue_id, error_message
emit_error() {
    local issue_id="$1"
    local error="${2:-Processing failed}"

    emit_ralph_event "$issue_id" "error" "{\"error\":$(echo "$error" | jq -Rs .)}"
}

# Parse Claude stream-json event and emit as activity
# Args: issue_id, json_line
parse_claude_event() {
    local issue_id="$1"
    local json_line="$2"

    # Skip empty lines
    [[ -z "$json_line" ]] && return

    # Try to parse as JSON
    local event_type=$(echo "$json_line" | jq -r '.type // empty' 2>/dev/null)
    [[ -z "$event_type" ]] && return

    case "$event_type" in
        "content_block_start")
            local content_type=$(echo "$json_line" | jq -r '.content_block.type // empty')
            if [[ "$content_type" == "tool_use" ]]; then
                local tool_name=$(echo "$json_line" | jq -r '.content_block.name // "unknown"')
                emit_activity "$issue_id" "tool" "$tool_name" "Starting $tool_name" "running"
                # Human-readable output for CLI
                case "$tool_name" in
                    "Read"|"Glob"|"Grep")
                        echo -e "  ${BLUE}🔍 $tool_name${NC}" ;;
                    "Write"|"Edit")
                        echo -e "  ${YELLOW}✏️  $tool_name${NC}" ;;
                    "Bash")
                        echo -e "  ${MAGENTA}⚡ Bash${NC}" ;;
                    "Task")
                        echo -e "  ${CYAN}🚀 Spawning subagent${NC}" ;;
                    "TodoWrite")
                        echo -e "  ${GREEN}📝 Updating todos${NC}" ;;
                    *)
                        echo -e "  ${GRAY}🔧 $tool_name${NC}" ;;
                esac
            fi
            ;;
        "content_block_stop")
            # Tool completed - could track tool completion here
            ;;
        "content_block_delta")
            local delta_type=$(echo "$json_line" | jq -r '.delta.type // empty')
            if [[ "$delta_type" == "text_delta" ]]; then
                # Claude's thinking/explanations - show streaming text
                local text=$(echo "$json_line" | jq -r '.delta.text // empty')
                if [[ -n "$text" ]]; then
                    # Print without newline to show streaming effect
                    echo -ne "${GREEN}$text${NC}"
                fi
            elif [[ "$delta_type" == "input_json_delta" ]]; then
                # Tool input details (file paths, commands, etc.)
                local partial=$(echo "$json_line" | jq -r '.delta.partial_json // empty')
                if [[ -n "$partial" ]]; then
                    local file_path=$(echo "$partial" | jq -r '.file_path // .path // empty' 2>/dev/null)
                    local command=$(echo "$partial" | jq -r '.command // empty' 2>/dev/null)
                    local pattern=$(echo "$partial" | jq -r '.pattern // empty' 2>/dev/null)
                    [[ -n "$file_path" ]] && echo -e "     ${GRAY}→ $file_path${NC}"
                    [[ -n "$command" ]] && echo -e "     ${GRAY}→ $command${NC}"
                    [[ -n "$pattern" ]] && echo -e "     ${GRAY}→ $pattern${NC}"
                fi
            fi
            ;;
        "assistant")
            # Assistant completed message - show summary
            local content=$(echo "$json_line" | jq -r '.message.content[]? | select(.type == "text") | .text // empty' 2>/dev/null)
            if [[ -n "$content" ]]; then
                echo ""
                echo -e "  ${GREEN}💬 $content${NC}"
            fi
            ;;
        "system")
            # System messages from Claude
            local system_msg=$(echo "$json_line" | jq -r '.message // empty')
            [[ -n "$system_msg" ]] && echo -e "  ${CYAN}ℹ️  $system_msg${NC}"
            ;;
        "error")
            # Error messages
            local error_msg=$(echo "$json_line" | jq -r '.error.message // .message // "Unknown error"')
            echo -e "  ${RED}❌ $error_msg${NC}"
            ;;
        "message_start")
            local model=$(echo "$json_line" | jq -r '.message.model // "claude"')
            emit_activity "$issue_id" "message" "" "Claude ($model) started processing" "running"
            echo -e "  ${CYAN}🤖 Claude ($model) processing...${NC}"
            ;;
        "message_stop"|"message_delta")
            # Message completed
            local stop_reason=$(echo "$json_line" | jq -r '.delta.stop_reason // empty')
            if [[ -n "$stop_reason" ]]; then
                emit_activity "$issue_id" "message" "" "Completed: $stop_reason" "success"
            fi
            ;;
        "result")
            # Final result with usage info
            local input_tokens=$(echo "$json_line" | jq -r '.usage.input_tokens // 0')
            local output_tokens=$(echo "$json_line" | jq -r '.usage.output_tokens // 0')
            local duration_ms=$(echo "$json_line" | jq -r '.duration_ms // 0')
            local total_cost_usd=$(echo "$json_line" | jq -r '.total_cost_usd // empty')

            # Use actual cost from result if available, otherwise estimate
            local cost
            if [ -n "$total_cost_usd" ] && [ "$total_cost_usd" != "null" ]; then
                cost="$total_cost_usd"
            else
                # Estimate cost (Sonnet: $3/$15 per 1M tokens)
                cost=$(echo "scale=6; ($input_tokens * 0.000003) + ($output_tokens * 0.000015)" | bc 2>/dev/null || echo "0")
            fi

            emit_activity "$issue_id" "result" "" "Tokens: $input_tokens in, $output_tokens out (cost: \$$cost)" "success"

            local duration_sec=$(echo "scale=1; $duration_ms/1000" | bc 2>/dev/null || echo "$duration_ms")
            echo -e "  ${GRAY}💰 Iteration: \$$cost | ⏱️  ${duration_sec}s${NC}"

            # Write cost to temp file for accumulation
            if [ -n "$ITERATION_COST_FILE" ]; then
                echo "$cost $duration_ms" >> "$ITERATION_COST_FILE"
            fi
            ;;
        "error")
            local error_msg=$(echo "$json_line" | jq -r '.error.message // "Unknown error"')
            emit_activity "$issue_id" "error" "" "$error_msg" "error"
            echo -e "  ${RED}❌ Error: $error_msg${NC}"
            ;;
    esac
}

# ============================================================================
# RALPH ENGINE
# ============================================================================

# Run the Ralph fix loop for a single issue
# Args: max_iterations, prd_file, progress_file, issue_id, mode, model, branch_name
ralph_fix_loop() {
    local max_iterations="${1:-10}"
    local prd_file="${2:-PRD.md}"
    local progress_file="${3:-progress.txt}"
    local issue_id="${4:-unknown}"
    local mode="${5:-build}"  # plan or build
    local model="${6:-sonnet}"  # sonnet or opus
    local branch_name="${7:-}"  # branch for pushing

    # Derive work_dir from prd_file location
    local work_dir
    work_dir="$(dirname "$prd_file")"

    # Define implementation plan file path (unique per issue)
    local impl_plan_file="$work_dir/IMPLEMENTATION_PLAN.md"

    local iteration_start_time

    # Initialize cost tracking
    init_cost_tracking

    # Setup signal handlers for clean exit
    trap 'stop_thinking_spinner; save_session_costs; cleanup_cost_tracking; echo -e "\n${YELLOW}⚠️  Interrupted by user${NC}"; show_cost_summary; exit 130' INT TERM
    trap 'stop_thinking_spinner; cleanup_cost_tracking' EXIT

    # Get current branch if not provided
    if [ -z "$branch_name" ]; then
        branch_name=$(git branch --show-current 2>/dev/null || echo "")
    fi

    # Session header (cwralph style)
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${MAGENTA}🤖 Ralph Fix Loop${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${YELLOW}📋 Mode:${NC}     $mode"
    echo -e "  ${YELLOW}📄 PRD:${NC}      $(basename "$prd_file")"
    echo -e "  ${YELLOW}🌿 Branch:${NC}   ${branch_name:-"(no git)"}"
    [ "$max_iterations" -gt 0 ] && echo -e "  ${YELLOW}🔄 Max:${NC}      $max_iterations iterations"
    printf "  ${YELLOW}💰 All-time:${NC} \$%.4f\n" "$ALLTIME_COST"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""

    # Emit start activity
    emit_activity "$issue_id" "message" "" "Starting Ralph fix loop (mode: $mode, model: $model)" "running"

    # Verify PRD exists
    if [[ ! -f "$prd_file" ]]; then
        echo -e "${RED}ERROR: PRD file not found: $prd_file${NC}"
        emit_error "$issue_id" "PRD file not found: $prd_file"
        return 1
    fi

    # Initialize progress file
    if [[ ! -f "$progress_file" ]]; then
        echo "# Progress Log - $(date)" > "$progress_file"
        echo "" >> "$progress_file"
    fi

    # Build mode-specific prompt (simplified - no completion markers)
    local mode_instructions=""

    if [[ "$mode" == "plan" ]]; then
        mode_instructions="You are analyzing an issue to create and refine an implementation plan. DO NOT make code changes.

## IMPORTANT: Plan File Location

The implementation plan for THIS SPECIFIC ISSUE must be stored at:
\`$impl_plan_file\`

This is a unique file for this issue - do NOT create IMPLEMENTATION_PLAN.md in any other location.

## Your Task

If the plan file exists (it will be provided in context), READ IT FIRST. Your job is to REFINE and IMPROVE the existing plan, not start from scratch.

## Iteration Strategy

Each iteration should go DEEPER:
- Iteration 1: High-level analysis, identify obvious files and approach
- Iteration 2: Search for edge cases, validate assumptions with code search
- Iteration 3+: Drill into complex areas, refine estimates, find hidden dependencies

## Instructions

1. Read the PRD to understand the issue
2. If the plan file exists in context:
   - Review what was already discovered
   - Identify GAPS or UNCERTAINTIES in the current plan
   - Search code to validate/invalidate assumptions
   - Add newly discovered files or considerations
3. If the plan file doesn't exist, create it at: \`$impl_plan_file\`
4. Use parallel subagents (up to 100) to search the codebase thoroughly
5. Look for:
   - Files that need modification (use Grep/Glob extensively)
   - Related tests that need updating
   - Similar patterns in the codebase to follow
   - Potential side effects or breaking changes
   - TODOs, FIXMEs, or existing workarounds related to this issue

## Plan File Structure

\`\`\`markdown
# Implementation Plan: [Issue Title]

## Summary
[1-2 sentence summary of the issue and proposed solution]

## Analysis Status
- [x] Initial codebase scan
- [ ] Edge cases identified
- [ ] Test coverage analyzed
- [ ] Dependencies mapped

## Files to Modify
- [ ] \`path/to/file.ts\` - [what needs to change]
- [ ] \`path/to/test.ts\` - [tests to add/update]

## Implementation Steps
1. [ ] Step 1 description
2. [ ] Step 2 description

## Open Questions
- [ ] Question that needs investigation
- [x] Resolved: [answer found]

## Risks & Mitigations
| Risk | Likelihood | Mitigation |
|------|------------|------------|
| ... | ... | ... |

## Test Strategy
- Unit tests: ...
- Integration tests: ...

## Discoveries This Iteration
[What you learned/found in THIS iteration - append, don't overwrite]
\`\`\`

## CRITICAL RULES

1. DO NOT modify any code files - only the plan file at \`$impl_plan_file\`
2. DO NOT create IMPLEMENTATION_PLAN.md anywhere else - use ONLY the path above
3. DO NOT assume something exists - SEARCH and confirm
4. DO NOT repeat previous discoveries - BUILD ON THEM
5. Each iteration MUST add new information or mark something as validated"
    else
        mode_instructions="You are a senior engineer implementing a fix. Your goal is COMPLETE, WORKING code - no stubs or placeholders.

## IMPORTANT: Plan File Location

If an implementation plan exists for this issue, it will be at:
\`$impl_plan_file\`

This is the unique plan file for THIS SPECIFIC ISSUE. Update it as you make progress.

## Pre-Implementation (CRITICAL)

Before writing ANY code:
1. Use up to 100 parallel subagents to search the codebase
2. NEVER assume something doesn't exist - SEARCH FIRST
3. Look for similar patterns, existing utilities, related tests
4. Check if someone already implemented what you need

## Implementation Strategy

1. Read the PRD to understand the issue
2. Read progress.txt to see what was already tried
3. If the plan file exists (provided in context):
   - Find the next unchecked item
   - Implement it COMPLETELY (no TODOs, no placeholders)
   - Mark as complete: \`- [ ]\` → \`- [x]\` in the plan file
   - Document discoveries in the plan file
4. If no plan exists, analyze and fix directly

## Quality Standards

### Code Quality
- Implement functionality COMPLETELY - stubs waste future iterations
- Follow existing patterns in the codebase
- Add logging/observability for critical paths
- Single source of truth - no adapters or migrations unless necessary

### Testing (MANDATORY)
- Run unit tests for modified code
- Add/update integration tests
- E2E tests for user-facing changes
- ALL tests must pass before committing

### After Each Change
1. Run build/lint - fix all errors
2. Run tests - fix all failures
3. git add -A && git commit with meaningful message
4. git push (NEVER to main/master, NEVER force push)

## Commit Guidelines

- Use conventional commits: fix(scope): description
- Reference the issue ID in commit body
- One logical change per commit
- Commit message should explain WHY, not just WHAT

## Self-Review Checklist

Before finishing, verify:
- [ ] No duplicate code introduced (search for similar functions)
- [ ] Following naming patterns of existing code
- [ ] No hardcoded values that should be configurable
- [ ] Error handling is complete
- [ ] Tests cover the changes

## When You Discover Issues

- Document in the plan file at \`$impl_plan_file\` immediately
- Fix unrelated bugs you notice (don't ignore them)
- Update progress.txt with learnings
- If blocked, try alternative approach before giving up

## IMPORTANT RULES

1. NEVER commit to main/master
2. NEVER push --force
3. NEVER leave placeholders/TODOs in new code
4. ALWAYS search before implementing
5. ALWAYS run tests before committing
6. ALWAYS use the specific plan file path above, NOT a generic IMPLEMENTATION_PLAN.md"
    fi

    # Determine Claude output format
    local claude_opts="--dangerously-skip-permissions"
    if [[ "${RALPH_STREAM_MODE:-false}" == "true" ]]; then
        claude_opts="$claude_opts --output-format=stream-json --verbose"
    else
        claude_opts="$claude_opts --print"
    fi

    # Add model flag if specified and not default
    if [[ "$model" == "opus" ]]; then
        claude_opts="$claude_opts --model claude-opus-4-5-20251101"
    fi

    # Main loop (cwralph style - while true with max check)
    CURRENT_ITERATION=0
    while true; do
        # Check max iterations at start (like cwralph)
        if [ "$max_iterations" -gt 0 ] && [ "$CURRENT_ITERATION" -ge "$max_iterations" ]; then
            echo -e "\n${YELLOW}🏁 Reached max iterations: $max_iterations${NC}"
            break
        fi

        CURRENT_ITERATION=$((CURRENT_ITERATION + 1))

        # Iteration header (cwralph style)
        echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${MAGENTA}🔄 ITERATION $CURRENT_ITERATION${NC}$( [ "$max_iterations" -gt 0 ] && echo " of $max_iterations" )"
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

        # Track iteration timing
        iteration_start_time=$(date +%s%N | cut -c1-13)

        # Emit iteration start
        emit_activity "$issue_id" "message" "" "Starting iteration $CURRENT_ITERATION" "running"
        emit_metrics "$issue_id" "$CURRENT_ITERATION" "$max_iterations" "0" "0" "$SESSION_COST" "$SESSION_DURATION"

        # Record attempt
        echo "## Iteration $CURRENT_ITERATION - $(date)" >> "$progress_file"

        local result=""
        local claude_exit=0

        # Build context files list
        local context_files="@$prd_file
@$progress_file"

        # For plan mode, include IMPLEMENTATION_PLAN.md if it exists
        # Note: impl_plan_file is defined at the start of ralph_fix_loop
        if [[ "$mode" == "plan" && -f "$impl_plan_file" ]]; then
            context_files="$context_files
@$impl_plan_file"
            echo -e "  ${GRAY}📋 Including existing IMPLEMENTATION_PLAN.md${NC}"
        fi

        # For build mode, also include IMPLEMENTATION_PLAN.md if it exists
        if [[ "$mode" == "build" && -f "$impl_plan_file" ]]; then
            context_files="$context_files
@$impl_plan_file"
            echo -e "  ${GRAY}📋 Following IMPLEMENTATION_PLAN.md${NC}"
        fi

        # Execute Claude with context
        if [[ "${RALPH_STREAM_MODE:-false}" == "true" ]]; then
            # Streaming mode: use process substitution to avoid subshell issues
            local temp_output=$(mktemp)
            local first_event=true

            emit_activity "$issue_id" "message" "" "Starting Claude (streaming mode)" "running"

            # Start the thinking spinner while waiting for first response
            start_thinking_spinner

            # Use process substitution - while runs in main shell, Claude output streams through
            while IFS= read -r line; do
                # Stop spinner on first event
                if [[ "$first_event" == "true" ]]; then
                    stop_thinking_spinner
                    first_event=false
                fi
                # Parse and emit the event to UI
                parse_claude_event "$issue_id" "$line"
                # Also save to temp file for result processing
                echo "$line" >> "$temp_output"
            done < <(claude $claude_opts \
                "$mode_instructions

$context_files
" 2>&1)
            claude_exit=$?

            # Ensure spinner is stopped
            stop_thinking_spinner

            result=$(cat "$temp_output" 2>/dev/null || echo "")
            rm -f "$temp_output"
        else
            # Non-streaming mode: use --print
            result=$(claude $claude_opts \
                "$mode_instructions

$context_files
" 2>&1) || claude_exit=$?
        fi

        if [ $claude_exit -ne 0 ]; then
            echo -e "\n${RED}❌ Claude exited with code $claude_exit${NC}"
        fi

        # Calculate iteration duration
        local iteration_end_time=$(date +%s%N | cut -c1-13)
        local iteration_duration=$((iteration_end_time - iteration_start_time))

        # Save result to progress
        if [[ "${RALPH_STREAM_MODE:-false}" == "true" ]]; then
            local extracted_text=""
            extracted_text=$(echo "$result" | jq -r '
                if .type == "result" and .result then .result
                elif .type == "assistant" and .message.content then
                    .message.content[] | select(.type == "text") | .text
                else empty
                end
            ' 2>/dev/null | head -100)
            if [[ -n "$extracted_text" ]]; then
                echo "$extracted_text" | tail -20 >> "$progress_file"
            fi
        else
            echo "$result" | tail -20 >> "$progress_file"
        fi
        echo "" >> "$progress_file"

        # Accumulate costs from this iteration
        accumulate_iteration_cost
        printf "  ${CYAN}💵 Total spent: \$%.4f${NC}\n" "$SESSION_COST"

        # Emit iteration metrics
        emit_metrics "$issue_id" "$CURRENT_ITERATION" "$max_iterations" "0" "$iteration_duration" "$SESSION_COST" "$SESSION_DURATION"

        # Git push after each iteration (like cwralph)
        if [ -n "$branch_name" ] && [ "$mode" != "plan" ]; then
            echo -e "\n${BLUE}📤 Pushing changes...${NC}"
            if git push origin "$branch_name" 2>/dev/null; then
                echo -e "${GREEN}✅ Pushed to $branch_name${NC}"
            else
                if git push -u origin "$branch_name" 2>/dev/null; then
                    echo -e "${GREEN}✅ Created and pushed to $branch_name${NC}"
                else
                    echo -e "${YELLOW}⚠️  Push failed (may have no changes)${NC}"
                fi
            fi
        fi

        # Small delay between iterations
        sleep 2
    done

    # Save session costs and show summary
    save_session_costs
    echo -e "\n${GREEN}🎉 Loop finished after $CURRENT_ITERATION iteration(s)${NC}"
    show_cost_summary

    return 0
}

# Process a single issue with full workflow
# Args: issue_json, provider_name, work_dir, base_branch, max_iterations, mode, model, auto_push
process_issue() {
    local issue_json="$1"
    local provider_name="$2"
    local work_dir="$3"
    local base_branch="${4:-main}"
    local max_iterations="${5:-10}"
    local mode="${6:-build}"
    local model="${7:-sonnet}"
    local auto_push="${8:-true}"

    local issue_id=$(echo "$issue_json" | jq -r '.id')
    local issue_title=$(echo "$issue_json" | jq -r '.title')

    # Emit start activity
    emit_activity "$issue_id" "message" "" "Starting to process issue: $issue_title" "running"

    # ========================================================================
    # MULTI-REPO SUPPORT (PRD-10)
    # Enrich issue with repo info at processing time (not at listing time)
    # ========================================================================

    # Check if issue needs enrichment (no target_repo yet, but might reference external repos)
    local has_target_repo=$(echo "$issue_json" | jq -r '.target_repo.full_name // empty')
    if [[ -z "$has_target_repo" ]] && [[ -x "$SCRIPT_DIR/lib/issue-parser.sh" ]]; then
        # Quick check if issue might reference repos
        if echo "$issue_json" | "$SCRIPT_DIR/lib/issue-parser.sh" check 2>/dev/null | grep -q "yes"; then
            emit_activity "$issue_id" "message" "" "Analyzing issue for repository references..." "running"
            local enriched
            enriched=$(echo "$issue_json" | "$SCRIPT_DIR/lib/issue-parser.sh" enrich 2>/dev/null)
            if [[ -n "$enriched" ]] && echo "$enriched" | jq -e '.' >/dev/null 2>&1; then
                issue_json="$enriched"
                emit_activity "$issue_id" "message" "" "Issue enriched with repository info" "success"
            fi
        fi
    fi

    # Extract multi-repo fields from issue JSON (now potentially enriched)
    local target_repo_full=$(echo "$issue_json" | jq -r '.target_repo.full_name // empty')
    local context_repos_json=$(echo "$issue_json" | jq -c '.context_repos // []')

    # If target_repo is specified and workspace-manager is available, set up the workspace
    if [[ -n "$target_repo_full" && "$target_repo_full" != "null" ]] && declare -f ensure_repo >/dev/null 2>&1; then
        echo -e "${YELLOW}Multi-repo mode detected: target_repo=$target_repo_full${NC}"
        emit_activity "$issue_id" "message" "" "Multi-repo mode: target=$target_repo_full" "running"

        # Ensure target repository is cloned/updated
        echo -e "${YELLOW}Ensuring target repository is available...${NC}"
        emit_activity "$issue_id" "tool" "workspace-manager" "Cloning/updating $target_repo_full" "running"

        if ensure_repo "$target_repo_full"; then
            # Get the local path for the target repo
            local target_repo_path
            target_repo_path=$(get_repo_path "$target_repo_full")

            if [[ -d "$target_repo_path" ]]; then
                # Override TARGET_REPO with the cloned repository path
                TARGET_REPO="$target_repo_path"
                echo -e "${GREEN}Target repository ready: $TARGET_REPO${NC}"
                emit_activity "$issue_id" "tool" "workspace-manager" "Target repository ready: $target_repo_full" "success"
            else
                echo -e "${RED}ERROR: Target repo path not found: $target_repo_path${NC}"
                emit_error "$issue_id" "Target repo path not found: $target_repo_path"
                return 1
            fi
        else
            echo -e "${RED}ERROR: Failed to clone/update target repository: $target_repo_full${NC}"
            emit_error "$issue_id" "Failed to clone/update target repository: $target_repo_full"
            return 1
        fi

        # Clone context repositories (for reference, not for modification)
        if [[ "$context_repos_json" != "[]" ]]; then
            echo -e "${YELLOW}Cloning context repositories for reference...${NC}"

            for context_repo in $(echo "$context_repos_json" | jq -r '.[].full_name // empty'); do
                if [[ -n "$context_repo" ]]; then
                    echo -e "${YELLOW}  - $context_repo${NC}"
                    emit_activity "$issue_id" "tool" "workspace-manager" "Cloning context repo: $context_repo" "running"

                    if ensure_repo "$context_repo"; then
                        local context_path
                        context_path=$(get_repo_path "$context_repo")
                        echo -e "${GREEN}    Ready at: $context_path${NC}"
                        emit_activity "$issue_id" "tool" "workspace-manager" "Context repo ready: $context_repo" "success"
                    else
                        echo -e "${YELLOW}    Warning: Failed to clone context repo (continuing anyway)${NC}"
                        emit_activity "$issue_id" "tool" "workspace-manager" "Warning: Failed to clone context repo $context_repo" "warning"
                    fi
                fi
            done
        fi
    fi

    # Change to TARGET_REPO if set
    if [[ -n "$TARGET_REPO" ]]; then
        echo -e "${YELLOW}Changing to target repository: $TARGET_REPO${NC}"
        cd "$TARGET_REPO" || {
            echo -e "${RED}ERROR: Could not change to TARGET_REPO: $TARGET_REPO${NC}"
            return 1
        }
    fi

    # Load provider
    source "$SCRIPT_DIR/providers/$provider_name/provider.sh"

    # Get branch name from provider
    local branch_name=$(provider_branch_name "$issue_json")

    # Add timestamp suffix if RALPH_FORCE_NEW_BRANCH is true (default)
    if [[ "${RALPH_FORCE_NEW_BRANCH:-true}" == "true" ]]; then
        local timestamp=$(date +%H%M%S)
        branch_name="${branch_name}-${timestamp}"
    fi

    echo -e "${YELLOW}Preparing branch: $branch_name${NC}"

    # Ensure we're on updated base branch
    git checkout "$base_branch" 2>/dev/null || true
    git pull origin "$base_branch" 2>/dev/null || true

    # Create or checkout branch
    # With RALPH_FORCE_NEW_BRANCH=true, branch should always be new
    if git show-ref --verify --quiet "refs/heads/$branch_name"; then
        echo -e "${YELLOW}Branch exists, checking out...${NC}"
        git checkout "$branch_name"
    else
        git checkout -b "$branch_name"
    fi

    # Create work directory
    mkdir -p "$work_dir"

    # Generate PRD
    local prd_file="$work_dir/PRD.md"
    local progress_file="$work_dir/progress.txt"

    echo -e "${YELLOW}Generating PRD...${NC}"
    provider_gen_prd "$issue_json" > "$prd_file"

    # Initialize progress
    echo "# Progress Log - $issue_id" > "$progress_file"
    echo "Provider: $provider_name" >> "$progress_file"
    echo "Started: $(date)" >> "$progress_file"
    echo "" >> "$progress_file"

    # Run Ralph loop (pass branch_name for per-iteration push)
    echo -e "${YELLOW}Starting Ralph fix loop...${NC}"
    echo ""

    if ralph_fix_loop "$max_iterations" "$prd_file" "$progress_file" "$issue_id" "$mode" "$model" "$branch_name"; then
        echo ""
        echo -e "${GREEN}Issue $issue_id RESOLVED!${NC}"
        emit_activity "$issue_id" "result" "" "Issue processing completed successfully" "success"

        # Skip push for plan mode
        if [[ "$mode" == "plan" ]]; then
            echo -e "${YELLOW}Plan mode: skipping push${NC}"
            emit_activity "$issue_id" "message" "" "Plan mode complete - skipping push" "success"
            emit_complete "$issue_id" "Plan completed successfully"
            rm -f .ralph-complete
            return 0
        fi

        # Check for commits to push
        if git diff --quiet origin/"$base_branch"..HEAD 2>/dev/null; then
            echo -e "${YELLOW}No new commits to push${NC}"
            emit_activity "$issue_id" "message" "" "No new commits to push" "success"
            emit_complete "$issue_id" "Issue resolved (no changes needed)"
        elif [[ "$auto_push" != "true" ]]; then
            echo -e "${YELLOW}Auto-push disabled, skipping push${NC}"
            emit_activity "$issue_id" "message" "" "Auto-push disabled - changes ready to push manually" "success"
            emit_complete "$issue_id" "Issue resolved (push disabled)"
        else
            # Push branch
            echo -e "${YELLOW}Pushing branch...${NC}"
            emit_activity "$issue_id" "push" "" "Pushing branch $branch_name to origin" "running"

            local push_result
            if push_result=$(git push -u origin "$branch_name" 2>&1); then
                echo -e "${GREEN}Branch pushed successfully${NC}"
                emit_activity "$issue_id" "push" "" "Branch pushed to origin/$branch_name" "success"
            else
                echo -e "${RED}Push failed: $push_result${NC}"
                emit_activity "$issue_id" "push" "" "Push failed: $push_result" "error"
            fi

            # Create PR
            echo -e "${YELLOW}Creating Pull Request...${NC}"
            emit_activity "$issue_id" "push" "" "Creating Pull Request" "running"

            local pr_title=$(provider_pr_title "$issue_json" 2>/dev/null || echo "fix($issue_id): ${issue_title:0:50}")
            local pr_body=$(provider_pr_body "$issue_json" 2>/dev/null || echo "Fix for issue $issue_id")

            local pr_url
            pr_url=$(gh pr create \
                --title "$pr_title" \
                --body "$pr_body" \
                --base "$base_branch" 2>&1) && {
                    echo -e "${GREEN}PR created: $pr_url${NC}"
                    emit_activity "$issue_id" "push" "" "PR created: $pr_url" "success"
                    emit_complete "$issue_id" "Issue resolved - PR: $pr_url"
                } || {
                    if echo "$pr_url" | grep -q "already exists"; then
                        echo -e "${YELLOW}PR already exists for this branch${NC}"
                        emit_activity "$issue_id" "push" "" "PR already exists for this branch" "success"
                        emit_complete "$issue_id" "Issue resolved - PR already exists"
                    else
                        echo -e "${RED}PR creation failed: $pr_url${NC}"
                        emit_activity "$issue_id" "push" "" "PR creation failed: $pr_url" "error"
                        # Still complete successfully since the fix was made
                        emit_complete "$issue_id" "Issue resolved (PR creation failed)"
                    fi
                }
        fi

        rm -f .ralph-complete
        return 0
    else
        echo ""
        echo -e "${RED}Issue $issue_id NOT resolved after $max_iterations attempts${NC}"

        # Display failure analysis
        analyze_failure "$progress_file" "$CURRENT_ITERATION" "$max_iterations" "$issue_id"

        emit_error "$issue_id" "Issue not resolved after $max_iterations attempts"
        return 1
    fi
}
