#!/bin/bash
# lib/interactive/ui.sh - UI utilities for Meta-Ralph Interactive Mode
# Provides colors, box drawing, spinner animation, and common UI elements

# ============================================================================
# COLORS (keeping existing color scheme)
# ============================================================================
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export MAGENTA='\033[0;35m'
export WHITE='\033[1;37m'
export GRAY='\033[0;90m'
export NC='\033[0m'  # No Color

# Bold variants
export BOLD='\033[1m'
export DIM='\033[2m'

# ============================================================================
# PROVIDER COLORS
# ============================================================================
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

# ============================================================================
# PRIORITY COLORS AND LABELS
# ============================================================================
get_priority_info() {
    local priority="$1"
    local severity="$2"
    local label color

    if [[ "$priority" =~ ^[0-9]+$ ]]; then
        if [[ "$priority" -ge 90 ]]; then
            label="CRITICAL"
            color="$RED"
        elif [[ "$priority" -ge 70 ]]; then
            label="HIGH"
            color="$YELLOW"
        elif [[ "$priority" -ge 40 ]]; then
            label="MEDIUM"
            color="$CYAN"
        else
            label="LOW"
            color="$GREEN"
        fi
    else
        local severity_lower=$(echo "$severity" | tr '[:upper:]' '[:lower:]')
        case "$severity_lower" in
            critical|urgent) label="CRITICAL"; color="$RED" ;;
            high)            label="HIGH"; color="$YELLOW" ;;
            medium)          label="MEDIUM"; color="$CYAN" ;;
            *)               label="LOW"; color="$GREEN" ;;
        esac
    fi

    echo "$label|$color"
}

# ============================================================================
# BOX DRAWING CHARACTERS
# ============================================================================
# Single line
BOX_TL="┌"
BOX_TR="┐"
BOX_BL="└"
BOX_BR="┘"
BOX_H="─"
BOX_V="│"
BOX_LT="├"
BOX_RT="┤"
BOX_TT="┬"
BOX_BT="┴"
BOX_X="┼"

# Double line
BOX2_TL="╔"
BOX2_TR="╗"
BOX2_BL="╚"
BOX2_BR="╝"
BOX2_H="═"
BOX2_V="║"

# ============================================================================
# BOX DRAWING FUNCTIONS
# ============================================================================

# Draw a horizontal line
# Usage: draw_line [width] [char] [color]
draw_line() {
    local width="${1:-60}"
    local char="${2:-$BOX_H}"
    local color="${3:-$GRAY}"

    printf "${color}"
    for ((i=0; i<width; i++)); do
        printf "%s" "$char"
    done
    printf "${NC}\n"
}

# Draw a double line
# Usage: draw_double_line [width] [color]
draw_double_line() {
    local width="${1:-60}"
    local color="${2:-$BLUE}"
    draw_line "$width" "$BOX2_H" "$color"
}

# Draw a box header
# Usage: draw_header "Title" [width] [color]
draw_header() {
    local title="$1"
    local width="${2:-62}"
    local color="${3:-$BLUE}"

    local title_len=${#title}
    local padding=$(( (width - title_len - 4) / 2 ))

    echo -e "${color}${BOX2_TL}$(printf '%*s' "$width" '' | tr ' ' "$BOX2_H")${BOX2_TR}${NC}"
    printf "${color}${BOX2_V}${NC}"
    printf "%*s" "$padding" ""
    printf "${WHITE}%s${NC}" "$title"
    printf "%*s" "$((width - padding - title_len))" ""
    printf "${color}${BOX2_V}${NC}\n"
    echo -e "${color}${BOX2_BL}$(printf '%*s' "$width" '' | tr ' ' "$BOX2_H")${BOX2_BR}${NC}"
}

# Draw a simple header with title
# Usage: print_header "Title"
print_header() {
    local title="$1"
    echo ""
    echo -e "${BLUE}"
    echo "${BOX2_TL}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_TR}"
    printf "${BOX2_V}           ${WHITE}%-40s${BLUE}           ${BOX2_V}\n" "$title"
    echo "${BOX2_BL}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_H}${BOX2_BR}"
    echo -e "${NC}"
}

# ============================================================================
# SPINNER ANIMATION
# ============================================================================

# Spinner characters (Braille pattern animation)
SPINNER_CHARS=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
SPINNER_PID=""

# Start spinner with message
# Usage: start_spinner "Loading..."
start_spinner() {
    local message="${1:-Thinking...}"

    # Don't start if already running
    [[ -n "$SPINNER_PID" ]] && return

    (
        local i=0
        while true; do
            printf "\r  ${YELLOW}${SPINNER_CHARS[$i]}${NC} ${GRAY}%s${NC}  " "$message"
            i=$(( (i + 1) % ${#SPINNER_CHARS[@]} ))
            sleep 0.1
        done
    ) &
    SPINNER_PID=$!
    disown $SPINNER_PID 2>/dev/null
}

# Stop spinner and clear line
# Usage: stop_spinner
stop_spinner() {
    if [[ -n "$SPINNER_PID" ]]; then
        kill $SPINNER_PID 2>/dev/null
        wait $SPINNER_PID 2>/dev/null
        SPINNER_PID=""
        printf "\r%*s\r" 80 ""  # Clear line
    fi
}

# Show spinner for a command
# Usage: with_spinner "message" command args...
with_spinner() {
    local message="$1"
    shift

    start_spinner "$message"
    "$@"
    local exit_code=$?
    stop_spinner

    return $exit_code
}

# ============================================================================
# STATUS INDICATORS
# ============================================================================

# Print success message
# Usage: print_success "Message"
print_success() {
    echo -e "  ${GREEN}✓${NC} $1"
}

# Print error message
# Usage: print_error "Message"
print_error() {
    echo -e "  ${RED}✗${NC} $1"
}

# Print warning message
# Usage: print_warning "Message"
print_warning() {
    echo -e "  ${YELLOW}⚠${NC} $1"
}

# Print info message
# Usage: print_info "Message"
print_info() {
    echo -e "  ${CYAN}ℹ${NC} $1"
}

# ============================================================================
# STEP INDICATORS
# ============================================================================

# Print step header
# Usage: print_step 1 "Step Title"
print_step() {
    local step_num="$1"
    local step_title="$2"
    echo ""
    echo -e "${WHITE}Step $step_num: $step_title${NC}"
    echo ""
}

# Print step with navigation hint
# Usage: print_step_nav 2 "Step Title" [can_go_back]
print_step_nav() {
    local step_num="$1"
    local step_title="$2"
    local can_go_back="${3:-true}"

    echo ""
    if [[ "$can_go_back" == "true" && "$step_num" -gt 1 ]]; then
        echo -e "${WHITE}Step $step_num: $step_title${NC}  ${GRAY}([b] back)${NC}"
    else
        echo -e "${WHITE}Step $step_num: $step_title${NC}"
    fi
    echo ""
}

# ============================================================================
# INPUT HELPERS
# ============================================================================

# Read input with prompt and validation
# Usage: read_input "prompt" "default" "validator_function"
# Returns: 0 for valid input, 1 for back, 2 for quit
read_input() {
    local prompt="$1"
    local default="$2"
    local validator="$3"
    local input

    while true; do
        if [[ -n "$default" ]]; then
            printf "  %s ${GRAY}[default: %s]${NC}: " "$prompt" "$default"
        else
            printf "  %s: " "$prompt"
        fi
        read -r input

        # Check for navigation
        case "$input" in
            b|B|back)
                return 1
                ;;
            q|Q|quit)
                return 2
                ;;
            "")
                if [[ -n "$default" ]]; then
                    INPUT_VALUE="$default"
                    return 0
                fi
                ;;
            *)
                if [[ -z "$validator" ]] || $validator "$input"; then
                    INPUT_VALUE="$input"
                    return 0
                fi
                ;;
        esac

        print_error "Invalid input. Try again or type 'b' to go back."
    done
}

# Read numeric input in range
# Usage: read_number "prompt" min max default
read_number() {
    local prompt="$1"
    local min="$2"
    local max="$3"
    local default="$4"
    local input

    while true; do
        printf "  %s ${GRAY}[%d-%d, default=%d]${NC}: " "$prompt" "$min" "$max" "$default"
        read -r input

        case "$input" in
            b|B|back) return 1 ;;
            q|Q|quit) return 2 ;;
            "")
                INPUT_VALUE="$default"
                return 0
                ;;
            *)
                if [[ "$input" =~ ^[0-9]+$ ]] && [[ "$input" -ge "$min" ]] && [[ "$input" -le "$max" ]]; then
                    INPUT_VALUE="$input"
                    return 0
                fi
                print_error "Enter a number between $min and $max"
                ;;
        esac
    done
}

# Read yes/no input
# Usage: read_yes_no "prompt" default_yes
read_yes_no() {
    local prompt="$1"
    local default_yes="${2:-true}"
    local input
    local hint

    if [[ "$default_yes" == "true" ]]; then
        hint="[Y/n]"
    else
        hint="[y/N]"
    fi

    printf "  %s %s: " "$prompt" "$hint"
    read -r input

    case "$input" in
        b|B|back) return 1 ;;
        q|Q|quit) return 2 ;;
        "")
            [[ "$default_yes" == "true" ]] && return 0 || return 3
            ;;
        y|Y|yes|Yes|YES) return 0 ;;
        n|N|no|No|NO) return 3 ;;
        *)
            [[ "$default_yes" == "true" ]] && return 0 || return 3
            ;;
    esac
}

# ============================================================================
# MENU HELPERS
# ============================================================================

# Print menu box start
print_menu_start() {
    echo -e "  ${GRAY}${BOX_TL}$(printf '%*s' 59 '' | tr ' ' "$BOX_H")${BOX_TR}${NC}"
}

# Print menu item
# Usage: print_menu_item index label extra_info [indicators]
print_menu_item() {
    local idx="$1"
    local label="$2"
    local extra="${3:-}"
    local indicators="${4:-}"

    printf "  ${GRAY}${BOX_V}${NC}  ${CYAN}%d)${NC}  ${WHITE}%-20s${NC}  ${GRAY}%-22s${NC}%b  ${GRAY}${BOX_V}${NC}\n" \
        "$idx" "$label" "$extra" "$indicators"
}

# Print menu separator
print_menu_separator() {
    echo -e "  ${GRAY}${BOX_LT}$(printf '%*s' 59 '' | tr ' ' "$BOX_H")${BOX_RT}${NC}"
}

# Print menu box end
print_menu_end() {
    echo -e "  ${GRAY}${BOX_BL}$(printf '%*s' 59 '' | tr ' ' "$BOX_H")${BOX_BR}${NC}"
}

# ============================================================================
# CLEANUP
# ============================================================================

# Cleanup function for graceful exit
ui_cleanup() {
    stop_spinner
    printf "\033[?25h"  # Show cursor
}

# Setup cleanup trap
trap ui_cleanup EXIT INT TERM
