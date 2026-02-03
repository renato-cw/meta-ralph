#!/bin/bash
# ralph-interactive.sh - Interactive mode for Meta-Ralph v2
# Allows selecting issues, mode, and model interactively
# Features: bidirectional navigation, spinners, execution summary

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load profile management
source "$SCRIPT_DIR/lib/profiles.sh"

# Load interactive modules
source "$SCRIPT_DIR/lib/interactive/ui.sh"
source "$SCRIPT_DIR/lib/interactive/wizard.sh"
source "$SCRIPT_DIR/lib/interactive/summary.sh"

# ============================================================================
# MAIN
# ============================================================================

main() {
    # Clear screen and show header
    clear
    print_header "Meta-Ralph Interactive Mode"

    # Initialize summary tracking
    summary_init

    # Run the wizard
    if wizard_run; then
        # Wizard completed successfully, execute the processing
        wizard_execute

        # Show execution summary
        # Note: Full summary integration requires capturing output from meta-ralph.sh
        # For now, show basic completion message
        echo ""
        echo -e "${GREEN}$(draw_line 40 "═")${NC}"
        echo -e "${GREEN}   Processing Complete!${NC}"
        echo -e "${GREEN}$(draw_line 40 "═")${NC}"
    else
        # Wizard was cancelled
        exit 0
    fi
}

# Run main
main "$@"
