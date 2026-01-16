#!/bin/bash
# lib/ralph-engine.sh
# The Ralph Wiggum fix loop engine
# Refactored from the original ralph-fix.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# RALPH ENGINE
# ============================================================================

# Run the Ralph fix loop for a single issue
# Args: max_iterations, prd_file, progress_file
ralph_fix_loop() {
    local max_iterations="${1:-10}"
    local prd_file="${2:-PRD.md}"
    local progress_file="${3:-progress.txt}"

    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   Ralph Wiggum Fix Loop Engine${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "${YELLOW}PRD File:${NC} $prd_file"
    echo -e "${YELLOW}Max Iterations:${NC} $max_iterations"
    echo ""

    # Verify PRD exists
    if [[ ! -f "$prd_file" ]]; then
        echo -e "${RED}ERROR: PRD file not found: $prd_file${NC}"
        return 1
    fi

    # Initialize progress file
    if [[ ! -f "$progress_file" ]]; then
        echo "# Progress Log - $(date)" > "$progress_file"
        echo "" >> "$progress_file"
    fi

    # Main loop
    for i in $(seq 1 "$max_iterations"); do
        echo -e "${BLUE}────────────────────────────────────────${NC}"
        echo -e "${YELLOW}Iteration $i of $max_iterations${NC}"
        echo -e "${BLUE}────────────────────────────────────────${NC}"
        echo ""

        # Record attempt
        echo "## Iteration $i - $(date)" >> "$progress_file"

        # Execute Claude with PRD
        result=$(claude --dangerously-skip-permissions --print \
            "You are a senior engineer fixing an issue.

@$prd_file
@$progress_file

Instructions:
1. Read the PRD carefully
2. Read the progress file to understand what has been tried
3. Locate and fix the issue
4. Run 'cargo clippy -- -D warnings' to check for issues
5. Run 'cargo build' to ensure it compiles
6. If tests exist for the affected code, run them
7. Commit your changes with an appropriate message
8. Update the progress file with what you did
9. If the fix is COMPLETE and verified, output exactly: <promise>COMPLETE</promise>
10. If you encounter blockers, document them in progress.txt and try a different approach

IMPORTANT: Only output <promise>COMPLETE</promise> when:
- The issue is actually fixed
- cargo clippy passes without warnings
- cargo build succeeds
- You have committed the fix

DO NOT output COMPLETE if there are still errors or the fix is partial.
" 2>&1) || true

        # Save result to progress
        echo "$result" | tail -20 >> "$progress_file"
        echo "" >> "$progress_file"

        # Check if completed
        if echo "$result" | grep -q "<promise>COMPLETE</promise>"; then
            echo ""
            echo -e "${GREEN}========================================${NC}"
            echo -e "${GREEN}   SUCCESS! Fix complete at iteration $i${NC}"
            echo -e "${GREEN}========================================${NC}"

            # Create success flag
            touch .ralph-complete

            # Record success
            echo "### SUCCESS - Fix completed at iteration $i" >> "$progress_file"
            echo "" >> "$progress_file"

            return 0
        fi

        echo ""
        echo -e "${YELLOW}Fix not complete, trying again...${NC}"
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

    return 1
}

# Process a single issue with full workflow
# Args: issue_json, provider_name, work_dir, base_branch, max_iterations
process_issue() {
    local issue_json="$1"
    local provider_name="$2"
    local work_dir="$3"
    local base_branch="${4:-main}"
    local max_iterations="${5:-10}"

    local issue_id=$(echo "$issue_json" | jq -r '.id')
    local issue_title=$(echo "$issue_json" | jq -r '.title')

    # Load provider
    source "$SCRIPT_DIR/providers/$provider_name/provider.sh"

    # Get branch name from provider
    local branch_name=$(provider_branch_name "$issue_json")

    echo -e "${YELLOW}Preparing branch: $branch_name${NC}"

    # Ensure we're on updated base branch
    git checkout "$base_branch" 2>/dev/null || true
    git pull origin "$base_branch" 2>/dev/null || true

    # Create or checkout branch
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

    if ralph_fix_loop "$max_iterations" "$prd_file" "$progress_file"; then
        echo ""
        echo -e "${GREEN}Issue $issue_id RESOLVED!${NC}"

        # Check for commits to push
        if git diff --quiet origin/"$base_branch"..HEAD 2>/dev/null; then
            echo -e "${YELLOW}No new commits to push${NC}"
        else
            # Push branch
            echo -e "${YELLOW}Pushing branch...${NC}"
            git push -u origin "$branch_name" 2>/dev/null || {
                echo -e "${RED}Push failed, continuing...${NC}"
            }

            # Create PR
            echo -e "${YELLOW}Creating Pull Request...${NC}"

            local pr_body=$(provider_pr_body "$issue_json" 2>/dev/null || echo "Fix for issue $issue_id")

            pr_url=$(gh pr create \
                --title "fix: ${issue_title:0:60}" \
                --body "$pr_body" \
                --base "$base_branch" 2>&1) && {
                    echo -e "${GREEN}PR created: $pr_url${NC}"
                } || {
                    if echo "$pr_url" | grep -q "already exists"; then
                        echo -e "${YELLOW}PR already exists for this branch${NC}"
                    else
                        echo -e "${RED}PR creation failed: $pr_url${NC}"
                    fi
                }
        fi

        rm -f .ralph-complete
        return 0
    else
        echo ""
        echo -e "${RED}Issue $issue_id NOT resolved after $max_iterations attempts${NC}"
        return 1
    fi
}
