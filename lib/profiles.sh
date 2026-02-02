#!/bin/bash
# lib/profiles.sh
# Profile management for Meta-Ralph
# Allows configuring multiple projects with different provider mappings

PROFILES_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILES_ROOT_DIR="$(cd "$PROFILES_SCRIPT_DIR/.." && pwd)"

# NOTE: workspace-manager.sh is loaded on-demand in load_profile() to avoid
# loading config.sh too early (which would override profile settings)

# Profile locations (in order of priority)
PROFILES_PATHS=(
    "$PROFILES_ROOT_DIR/profiles.conf"       # Local to meta-ralph
    "$HOME/.meta-ralph/profiles.conf"        # User config
    "$HOME/.config/meta-ralph/profiles.conf" # XDG config
)

# Find the profiles file
find_profiles_file() {
    for path in "${PROFILES_PATHS[@]}"; do
        if [[ -f "$path" ]]; then
            echo "$path"
            return 0
        fi
    done
    return 1
}

# List all available profiles
# Returns: profile names, one per line
list_profiles() {
    local profiles_file
    profiles_file=$(find_profiles_file) || return 1

    grep -E '^\[.+\]$' "$profiles_file" | sed 's/\[\(.*\)\]/\1/'
}

# Get a specific setting from a profile
# Usage: get_profile_setting <profile_name> <setting_name>
get_profile_setting() {
    local profile="$1"
    local setting="$2"
    local profiles_file

    profiles_file=$(find_profiles_file) || return 1

    # Parse INI-style config
    awk -v profile="$profile" -v setting="$setting" '
        /^\[/ {
            current_profile = substr($0, 2, length($0)-2)
        }
        current_profile == profile && /^[^#\[]/ {
            split($0, parts, "=")
            key = parts[1]
            gsub(/^[ \t]+|[ \t]+$/, "", key)
            if (key == setting) {
                value = parts[2]
                for (i=3; i<=length(parts); i++) {
                    value = value "=" parts[i]
                }
                gsub(/^[ \t]+|[ \t]+$/, "", value)
                print value
                exit
            }
        }
    ' "$profiles_file"
}

# Get all settings for a profile as KEY=VALUE lines
# Usage: get_profile_settings <profile_name>
get_profile_settings() {
    local profile="$1"
    local profiles_file

    profiles_file=$(find_profiles_file) || return 1

    awk -v profile="$profile" '
        /^\[/ {
            current_profile = substr($0, 2, length($0)-2)
        }
        current_profile == profile && /^[^#\[]/ && /=/ {
            print $0
        }
    ' "$profiles_file"
}

# Load a profile and export its settings
# Usage: load_profile <profile_name>
load_profile() {
    local profile="$1"

    if [[ -z "$profile" ]]; then
        echo "Error: No profile specified" >&2
        return 1
    fi

    local profiles_file
    profiles_file=$(find_profiles_file)
    if [[ $? -ne 0 ]]; then
        echo "Error: No profiles.conf found. Create one at ~/.meta-ralph/profiles.conf" >&2
        return 1
    fi

    # Check if profile exists
    if ! list_profiles | grep -qx "$profile"; then
        echo "Error: Profile '$profile' not found" >&2
        echo "Available profiles:" >&2
        list_profiles | sed 's/^/  /' >&2
        return 1
    fi

    # Export current profile name
    export RALPH_CURRENT_PROFILE="$profile"

    # Map profile settings to provider environment variables
    local github_repo linear_team sentry_project codecov_repo zeropath_repo target_repo

    github_repo=$(get_profile_setting "$profile" "github")
    linear_team=$(get_profile_setting "$profile" "linear")
    sentry_project=$(get_profile_setting "$profile" "sentry")
    codecov_repo=$(get_profile_setting "$profile" "codecov")
    zeropath_repo=$(get_profile_setting "$profile" "zeropath")
    target_repo=$(get_profile_setting "$profile" "target_repo")

    # GitHub: owner/repo format
    if [[ -n "$github_repo" ]]; then
        export GITHUB_OWNER="${github_repo%/*}"
        export GITHUB_REPO="${github_repo#*/}"
    fi

    # Linear: team key (e.g., INF, CHK)
    if [[ -n "$linear_team" ]]; then
        export LINEAR_TEAM_ID="$linear_team"
    fi

    # Sentry: org/project or just project
    if [[ -n "$sentry_project" ]]; then
        if [[ "$sentry_project" == *"/"* ]]; then
            export SENTRY_ORGANIZATION="${sentry_project%/*}"
            export SENTRY_PROJECT="${sentry_project#*/}"
        else
            export SENTRY_PROJECT="$sentry_project"
        fi
    fi

    # Codecov: owner/repo format
    if [[ -n "$codecov_repo" ]]; then
        export CODECOV_OWNER="${codecov_repo%/*}"
        export CODECOV_REPO="${codecov_repo#*/}"
    fi

    # Zeropath: repository ID
    if [[ -n "$zeropath_repo" ]]; then
        export ZEROPATH_REPOSITORY_ID="$zeropath_repo"
    fi

    # Target repo path - with auto-clone support
    if [[ -n "$target_repo" ]]; then
        # Expand ~ to home directory
        target_repo="${target_repo/#\~/$HOME}"
        export TARGET_REPO="$target_repo"
    elif [[ -n "$github_repo" ]]; then
        # No target_repo defined, but we have github - auto-clone to workspace
        # Load workspace-manager on demand (after profile vars are set)
        if [[ ! "$(type -t ensure_repo)" == "function" ]]; then
            source "$PROFILES_SCRIPT_DIR/workspace-manager.sh" 2>/dev/null || true
        fi
        if type ensure_repo &>/dev/null; then
            echo "Auto-cloning $github_repo to workspace..." >&2
            local workspace_path
            workspace_path=$(ensure_repo "$github_repo")
            if [[ $? -eq 0 && -n "$workspace_path" ]]; then
                export TARGET_REPO="$workspace_path"
                echo "Using workspace: $TARGET_REPO" >&2
            fi
        fi
    fi

    return 0
}

# Get profile display info (for interactive selection)
# Usage: get_profile_info <profile_name>
get_profile_info() {
    local profile="$1"
    local github linear sentry target

    github=$(get_profile_setting "$profile" "github")
    linear=$(get_profile_setting "$profile" "linear")
    sentry=$(get_profile_setting "$profile" "sentry")
    target=$(get_profile_setting "$profile" "target_repo")

    local info=""
    [[ -n "$github" ]] && info+="GH:$github "
    [[ -n "$linear" ]] && info+="LN:$linear "
    [[ -n "$sentry" ]] && info+="ST:$sentry "

    if [[ -n "$target" ]]; then
        # Show just the last part of the path
        info+="→ $(basename "$target")"
    fi

    echo "$info"
}

# Interactive profile selector using select
# Returns: selected profile name (or exits if cancelled)
select_profile_interactive() {
    local profiles_file
    profiles_file=$(find_profiles_file)

    if [[ $? -ne 0 ]]; then
        echo "No profiles.conf found." >&2
        echo "Would you like to use current .env settings? (y/n)" >&2
        read -r response
        if [[ "$response" == "y" || "$response" == "Y" ]]; then
            echo "__USE_ENV__"
            return 0
        fi
        return 1
    fi

    local -a profile_names
    local -a profile_display

    while IFS= read -r profile; do
        profile_names+=("$profile")
        local info
        info=$(get_profile_info "$profile")
        profile_display+=("$profile  ${info}")
    done < <(list_profiles)

    if [[ ${#profile_names[@]} -eq 0 ]]; then
        echo "No profiles defined in $profiles_file" >&2
        return 1
    fi

    # Add option to use .env settings
    profile_names+=("__USE_ENV__")
    profile_display+=("(Use current .env settings)")

    echo "Select project:" >&2
    PS3=$'\n'"Project number: "
    select choice in "${profile_display[@]}"; do
        if [[ -n "$choice" ]]; then
            local idx=$((REPLY - 1))
            echo "${profile_names[$idx]}"
            return 0
        fi
    done

    return 1
}

# Create a new profile interactively
create_profile_interactive() {
    local profile_name
    local profiles_file="$HOME/.meta-ralph/profiles.conf"

    echo "Create new project profile"
    echo "=========================="
    echo ""

    read -p "Profile name (e.g., infinitepay-scfi): " profile_name

    if [[ -z "$profile_name" ]]; then
        echo "Profile name cannot be empty" >&2
        return 1
    fi

    # Create directory if needed
    mkdir -p "$(dirname "$profiles_file")"

    echo ""
    echo "Enter provider mappings (leave empty to skip):"
    echo ""

    read -p "GitHub (owner/repo): " github_repo
    read -p "Linear (team key, e.g., INF): " linear_team
    read -p "Sentry (project name): " sentry_project
    read -p "Codecov (owner/repo): " codecov_repo
    read -p "Zeropath (repository ID): " zeropath_repo
    read -p "Target repo path: " target_repo

    # Append to profiles file
    {
        echo ""
        echo "[$profile_name]"
        [[ -n "$github_repo" ]] && echo "github = $github_repo"
        [[ -n "$linear_team" ]] && echo "linear = $linear_team"
        [[ -n "$sentry_project" ]] && echo "sentry = $sentry_project"
        [[ -n "$codecov_repo" ]] && echo "codecov = $codecov_repo"
        [[ -n "$zeropath_repo" ]] && echo "zeropath = $zeropath_repo"
        [[ -n "$target_repo" ]] && echo "target_repo = $target_repo"
    } >> "$profiles_file"

    echo ""
    echo "Profile '$profile_name' created in $profiles_file"
}

# Show help
profiles_help() {
    cat <<'EOF'
Meta-Ralph Profile System
=========================

Profiles allow you to configure multiple projects with different
provider mappings (GitHub, Linear, Sentry, etc.).

PROFILE FILE LOCATIONS (checked in order):
  1. ./profiles.conf           (in meta-ralph directory)
  2. ~/.meta-ralph/profiles.conf
  3. ~/.config/meta-ralph/profiles.conf

PROFILE FORMAT:
  [profile-name]
  github = owner/repo
  linear = TEAM_KEY
  sentry = project-name
  codecov = owner/repo
  zeropath = repository-id
  target_repo = /path/to/local/repo

EXAMPLE:
  [infinitepay-scfi]
  github = cloudwalk/infinitepay-scfi
  linear = INF
  sentry = infinitepay-scfi-api
  codecov = cloudwalk/infinitepay-scfi
  target_repo = /Users/me/projects/infinitepay-scfi

USAGE:
  # Load in script
  source lib/profiles.sh
  load_profile "infinitepay-scfi"

  # List profiles
  list_profiles

  # Get specific setting
  get_profile_setting "infinitepay-scfi" "github"

EOF
}

# CLI interface when run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        list)
            list_profiles
            ;;
        get)
            if [[ -n "$2" && -n "$3" ]]; then
                get_profile_setting "$2" "$3"
            else
                echo "Usage: $0 get <profile> <setting>" >&2
                exit 1
            fi
            ;;
        info)
            if [[ -n "$2" ]]; then
                get_profile_info "$2"
            else
                echo "Usage: $0 info <profile>" >&2
                exit 1
            fi
            ;;
        create)
            create_profile_interactive
            ;;
        help|--help|-h)
            profiles_help
            ;;
        *)
            echo "Usage: $0 {list|get|info|create|help}" >&2
            exit 1
            ;;
    esac
fi
