#!/bin/bash
# lib/ralph-engine.sh
# The Ralph Wiggum fix loop engine
# Refactored from the original ralph-fix.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Source workspace manager for multi-repo support (optional)
# This enables processing issues that target external repositories
source "$SCRIPT_DIR/lib/workspace-manager.sh" 2>/dev/null || true

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# STREAMING SUPPORT
# ============================================================================

# Emit a JSON event for streaming mode
# Args: issue_id, event_type, payload_json
emit_ralph_event() {
    local issue_id="$1"
    local event_type="$2"
    local payload="$3"

    if [[ "${RALPH_STREAM_MODE:-false}" == "true" ]]; then
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
            fi
            ;;
        "content_block_stop")
            # Tool completed - could track tool completion here
            ;;
        "message_start")
            local model=$(echo "$json_line" | jq -r '.message.model // "claude"')
            emit_activity "$issue_id" "message" "" "Claude ($model) started processing" "running"
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
            # Estimate cost (Sonnet: $3/$15 per 1M tokens)
            local cost=$(echo "scale=6; ($input_tokens * 0.000003) + ($output_tokens * 0.000015)" | bc 2>/dev/null || echo "0")
            emit_activity "$issue_id" "result" "" "Tokens: $input_tokens in, $output_tokens out (cost: \$$cost)" "success"
            ;;
        "error")
            local error_msg=$(echo "$json_line" | jq -r '.error.message // "Unknown error"')
            emit_activity "$issue_id" "error" "" "$error_msg" "error"
            ;;
    esac
}

# ============================================================================
# RALPH ENGINE
# ============================================================================

# Run the Ralph fix loop for a single issue
# Args: max_iterations, prd_file, progress_file, issue_id, mode, model
ralph_fix_loop() {
    local max_iterations="${1:-10}"
    local prd_file="${2:-PRD.md}"
    local progress_file="${3:-progress.txt}"
    local issue_id="${4:-unknown}"
    local mode="${5:-build}"  # plan or build
    local model="${6:-sonnet}"  # sonnet or opus

    local iteration_start_time
    local total_cost=0
    local total_duration=0

    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   Ralph Wiggum Fix Loop Engine${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}PRD File:${NC} $prd_file"
    echo -e "${YELLOW}Max Iterations:${NC} $max_iterations"
    echo -e "${YELLOW}Mode:${NC} $mode"
    echo -e "${YELLOW}Model:${NC} $model"
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

    # Build mode-specific prompt
    local completion_marker="<promise>COMPLETE</promise>"
    local mode_instructions=""

    if [[ "$mode" == "plan" ]]; then
        completion_marker="<promise>PLAN_COMPLETE</promise>"
        mode_instructions="You are analyzing the issue to create an implementation plan. DO NOT make code changes.

Instructions:
1. Read the PRD carefully
2. Analyze the codebase to understand the issue
3. Identify all files that need to be modified
4. Document the root cause
5. Create an IMPLEMENTATION_PLAN.md with:
   - Files to modify (with checkboxes)
   - Step-by-step implementation steps
   - Risks and mitigations
   - Test strategy
6. When the plan is complete, output exactly: $completion_marker

DO NOT modify any code files - only create the plan."
    else
        mode_instructions="You are a senior engineer fixing an issue.

Instructions:
1. Read the PRD carefully
2. Read the progress file to understand what has been tried
3. If IMPLEMENTATION_PLAN.md exists, follow it and check off completed items
4. Locate and fix the issue
5. Run 'cargo clippy -- -D warnings' to check for issues (if Rust project)
6. Run the appropriate build command to ensure it compiles
7. If tests exist for the affected code, run them
8. Commit your changes with an appropriate message
9. Update the progress file with what you did
10. If the fix is COMPLETE and verified, output exactly: $completion_marker
11. If you encounter blockers, document them in progress.txt and try a different approach

IMPORTANT: Only output $completion_marker when:
- The issue is actually fixed
- Build/lint passes without errors
- You have committed the fix

DO NOT output COMPLETE if there are still errors or the fix is partial."
    fi

    # Determine Claude output format
    local claude_opts="--dangerously-skip-permissions"
    if [[ "${RALPH_STREAM_MODE:-false}" == "true" ]]; then
        claude_opts="$claude_opts --output-format=stream-json"
    else
        claude_opts="$claude_opts --print"
    fi

    # Add model flag if specified and not default
    if [[ "$model" == "opus" ]]; then
        claude_opts="$claude_opts --model claude-opus-4-5-20250514"
    fi

    # Main loop
    for i in $(seq 1 "$max_iterations"); do
        echo -e "${BLUE}────────────────────────────────────────${NC}"
        echo -e "${YELLOW}Iteration $i of $max_iterations${NC}"
        echo -e "${BLUE}────────────────────────────────────────${NC}"
        echo ""

        # Track iteration timing
        iteration_start_time=$(date +%s%N | cut -c1-13)

        # Emit iteration start
        emit_activity "$issue_id" "message" "" "Starting iteration $i of $max_iterations" "running"
        emit_metrics "$issue_id" "$i" "$max_iterations" "0" "0" "$total_cost" "$total_duration"

        # Record attempt
        echo "## Iteration $i - $(date)" >> "$progress_file"

        local result=""
        local iteration_cost=0

        # Execute Claude with PRD
        if [[ "${RALPH_STREAM_MODE:-false}" == "true" ]]; then
            # Streaming mode: parse events as they come
            local temp_output=$(mktemp)
            local accumulated_text=""

            # Run Claude and process stream
            claude $claude_opts \
                "$mode_instructions

@$prd_file
@$progress_file
" 2>&1 | while IFS= read -r line; do
                # Parse and emit the event
                parse_claude_event "$issue_id" "$line"

                # Accumulate for completion detection
                echo "$line" >> "$temp_output"

                # Extract text content for completion check
                local content=$(echo "$line" | jq -r '.delta.text // .content // empty' 2>/dev/null)
                if [[ -n "$content" ]]; then
                    accumulated_text="$accumulated_text$content"
                fi
            done

            # Read accumulated output
            result=$(cat "$temp_output" 2>/dev/null || echo "")
            rm -f "$temp_output"
        else
            # Non-streaming mode: use --print
            result=$(claude $claude_opts \
                "$mode_instructions

@$prd_file
@$progress_file
" 2>&1) || true
        fi

        # Calculate iteration duration
        local iteration_end_time=$(date +%s%N | cut -c1-13)
        local iteration_duration=$((iteration_end_time - iteration_start_time))
        total_duration=$((total_duration + iteration_duration))

        # Save result to progress
        if [[ "${RALPH_STREAM_MODE:-false}" == "true" ]]; then
            # In streaming mode, extract text content from JSON
            echo "$result" | jq -r '.delta.text // .content // empty' 2>/dev/null | tail -20 >> "$progress_file"
        else
            echo "$result" | tail -20 >> "$progress_file"
        fi
        echo "" >> "$progress_file"

        # Check if completed
        local check_text="$result"
        if [[ "${RALPH_STREAM_MODE:-false}" == "true" ]]; then
            # In streaming mode, need to extract text content for marker check
            check_text=$(echo "$result" | jq -r '.delta.text // .content // .message // empty' 2>/dev/null | tr -d '\n')
        fi

        if echo "$check_text" | grep -q "$completion_marker"; then
            echo ""
            echo -e "${GREEN}========================================${NC}"
            echo -e "${GREEN}   SUCCESS! ${mode^} complete at iteration $i${NC}"
            echo -e "${GREEN}========================================${NC}"

            # Emit final metrics
            emit_metrics "$issue_id" "$i" "$max_iterations" "$iteration_cost" "$iteration_duration" "$total_cost" "$total_duration"
            emit_activity "$issue_id" "result" "" "SUCCESS: ${mode^} completed at iteration $i" "success" "$total_duration"

            # Create success flag
            touch .ralph-complete

            # Record success
            echo "### SUCCESS - ${mode^} completed at iteration $i" >> "$progress_file"
            echo "" >> "$progress_file"

            return 0
        fi

        # Emit iteration metrics
        emit_metrics "$issue_id" "$i" "$max_iterations" "$iteration_cost" "$iteration_duration" "$total_cost" "$total_duration"

        echo ""
        echo -e "${YELLOW}${mode^} not complete, trying again...${NC}"
        echo ""

        # Small delay between iterations
        sleep 2
    done

    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}   Max iterations reached without success${NC}"
    echo -e "${RED}========================================${NC}"

    # Record failure
    echo "### FAILED - Max iterations ($max_iterations) reached" >> "$progress_file"

    # Emit error
    emit_error "$issue_id" "Max iterations ($max_iterations) reached without completion"

    return 1
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
    # Detect and clone target/context repositories from enriched issue JSON
    # ========================================================================

    # Extract multi-repo fields from issue JSON (set by providers like Linear)
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

    # Run Ralph loop
    echo -e "${YELLOW}Starting Ralph fix loop...${NC}"
    echo ""

    if ralph_fix_loop "$max_iterations" "$prd_file" "$progress_file" "$issue_id" "$mode" "$model"; then
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

            local pr_body=$(provider_pr_body "$issue_json" 2>/dev/null || echo "Fix for issue $issue_id")

            local pr_url
            pr_url=$(gh pr create \
                --title "fix: ${issue_title:0:60}" \
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
        emit_error "$issue_id" "Issue not resolved after $max_iterations attempts"
        return 1
    fi
}
