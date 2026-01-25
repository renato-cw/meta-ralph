# PRD-002: Codecov Integration Provider

## Executive Summary

Create a new provider for Meta-Ralph that integrates with Codecov to identify files with low/no test coverage and automatically generate PRs with improved test coverage using Claude Code.

## Background

Test coverage is critical for code quality but often neglected due to time constraints. Codecov provides detailed coverage reports, but teams lack automated tooling to systematically improve coverage. This provider bridges that gap by automatically:

1. Identifying files below coverage threshold
2. Prioritizing based on importance and risk
3. Generating meaningful tests via Claude Code
4. Creating PRs with clear coverage metrics

## Goals

1. Automatically identify files needing test coverage improvement
2. Prioritize files based on coverage %, importance, and recency
3. Generate meaningful tests via Claude Code
4. Create PRs with clear coverage improvement metrics
5. Support configurable thresholds and exclusions

## Non-Goals

- Supporting coverage tools other than Codecov (future consideration)
- Achieving 100% coverage (target configurable goals)
- Modifying existing tests (only adding new tests)
- Refactoring source code for testability

---

## Provider Interface Implementation

### File Structure

```
providers/codecov/
├── provider.sh          # Main provider implementation
├── api.sh               # Codecov API helpers
├── priority.sh          # Priority calculation logic
└── test-detection.sh    # Test framework detection
```

### 1. provider_name()

```bash
provider_name() {
    echo "codecov"
}
```

### 2. provider_fetch()

Fetches files below coverage threshold and normalizes to Meta-Ralph issue format.

#### Codecov API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v2/repos/{service}/{owner}/{repo}/report` | Coverage report summary |
| `GET /api/v2/repos/{service}/{owner}/{repo}/file_report/{path}` | File-level details |
| `GET /api/v2/repos/{service}/{owner}/{repo}/commits` | Recent commit coverage |

#### Normalized Issue Output

```json
{
  "id": "codecov-{file-hash}",
  "provider": "codecov",
  "title": "Low coverage: src/lib/utils.ts (23%)",
  "description": "File has 23% line coverage. 45 of 58 lines uncovered.",
  "location": "src/lib/utils.ts",
  "severity": "MEDIUM",
  "raw_severity": 23,
  "count": 45,
  "priority": 65,
  "permalink": "https://app.codecov.io/gh/owner/repo/blob/main/src/lib/utils.ts",
  "metadata": {
    "coverage_percent": 23,
    "lines_covered": 13,
    "lines_missed": 45,
    "lines_total": 58,
    "branches_covered": 5,
    "branches_missed": 12,
    "complexity": 15,
    "last_modified": "2024-01-15T10:30:00Z",
    "import_count": 8,
    "is_critical_path": true,
    "uncovered_lines": [15, 16, 17, 23, 24, 45, 46, 47, 48, 49]
  }
}
```

#### Implementation

```bash
provider_fetch() {
    local min_coverage="${CODECOV_MIN_COVERAGE:-50}"
    local max_files="${CODECOV_MAX_FILES:-20}"
    local exclude_pattern=$(echo "$CODECOV_EXCLUDE_PATTERNS" | tr ',' '|')
    local critical_paths="$CODECOV_CRITICAL_PATHS"

    # Validate required config
    if [[ -z "$CODECOV_API_TOKEN" ]]; then
        echo "Error: CODECOV_API_TOKEN not set" >&2
        echo "[]"
        return 1
    fi

    # Fetch coverage report
    local report=$(curl -s \
        -H "Authorization: Bearer $CODECOV_API_TOKEN" \
        -H "Accept: application/json" \
        "$CODECOV_API_URL/api/v2/repos/$CODECOV_SERVICE/$CODECOV_OWNER/$CODECOV_REPO/report")

    # Check for API error
    if echo "$report" | jq -e '.detail' > /dev/null 2>&1; then
        echo "Codecov API error: $(echo "$report" | jq -r '.detail')" >&2
        echo "[]"
        return 1
    fi

    # Filter and transform files
    echo "$report" | jq --arg provider "codecov" \
        --argjson min "$min_coverage" \
        --argjson max "$max_files" \
        --arg exclude "$exclude_pattern" \
        --arg critical "$critical_paths" \
        --arg base_url "https://app.codecov.io/$CODECOV_SERVICE/$CODECOV_OWNER/$CODECOV_REPO" \
    '[
        .files[]
        | select(.totals.coverage != null)
        | select(.totals.coverage < $min)
        | select(if $exclude != "" then (.name | test($exclude) | not) else true end)
        | {
            id: ("codecov-" + (.name | @uri | gsub("%"; ""))),
            provider: $provider,
            title: ("Low coverage: " + .name + " (" + ((.totals.coverage | floor | tostring) + "%)")),
            description: ("File has " + ((.totals.coverage | floor | tostring)) + "% line coverage. " + ((.totals.misses // 0) | tostring) + " of " + ((.totals.lines // 0) | tostring) + " lines uncovered."),
            location: .name,
            severity: (
                if .totals.coverage <= 20 then "CRITICAL"
                elif .totals.coverage <= 40 then "HIGH"
                elif .totals.coverage <= 60 then "MEDIUM"
                elif .totals.coverage <= 80 then "LOW"
                else "INFO"
                end
            ),
            raw_severity: .totals.coverage,
            count: (.totals.misses // 0),
            priority: ((100 - .totals.coverage) | floor),
            permalink: ($base_url + "/blob/main/" + .name),
            metadata: {
                coverage_percent: .totals.coverage,
                lines_covered: (.totals.hits // 0),
                lines_missed: (.totals.misses // 0),
                lines_total: (.totals.lines // 0),
                branches_covered: (.totals.branches.covered // 0),
                branches_missed: (.totals.branches.missed // 0),
                is_critical_path: (if $critical != "" then (.name | test($critical)) else false end)
            }
        }
    ]
    | sort_by(-.priority)
    | .[:$max]'
}
```

### 3. provider_gen_prd()

Generates a test-focused PRD for Claude Code to create tests.

```bash
provider_gen_prd() {
    local issue_json="$1"
    local location=$(echo "$issue_json" | jq -r '.location')
    local coverage=$(echo "$issue_json" | jq -r '.metadata.coverage_percent')
    local lines_missed=$(echo "$issue_json" | jq -r '.metadata.lines_missed')
    local lines_total=$(echo "$issue_json" | jq -r '.metadata.lines_total')
    local target="${CODECOV_TARGET_COVERAGE:-80}"
    local test_framework=$(detect_test_framework)

    cat << EOF
# Test Coverage PRD - $(basename "$location")

## Overview

| Metric | Value |
|--------|-------|
| **File** | \`$location\` |
| **Current Coverage** | ${coverage}% |
| **Lines Missed** | $lines_missed of $lines_total |
| **Target Coverage** | ${target}% |
| **Test Framework** | $test_framework |

## Problem Statement

The file \`$location\` has insufficient test coverage at ${coverage}%.
This PR should add tests to increase coverage to at least ${target}%.

## Requirements

### Must Have
- [ ] Add tests for uncovered lines in \`$location\`
- [ ] Achieve minimum ${target}% coverage for this file
- [ ] All tests must pass
- [ ] Tests must be meaningful (not just coverage farming)

### Should Have
- [ ] Test edge cases and error conditions
- [ ] Test boundary conditions
- [ ] Mock external dependencies appropriately
- [ ] Follow existing test patterns in codebase

### Must NOT Do
- [ ] Do NOT modify the source file (only add tests)
- [ ] Do NOT delete existing tests
- [ ] Do NOT add tests that always pass without assertions
- [ ] Do NOT add unnecessary dependencies

## Test Framework Guidelines

$(get_framework_guidelines "$test_framework")

## Instructions for AI Agent

1. **Read the source file**: \`$location\`
2. **Find existing test file** or determine where to create new one
3. **Analyze the uncovered code paths** - focus on:
   - Branches and conditionals
   - Error handling paths
   - Edge cases
4. **Write comprehensive tests** following project conventions
5. **Run test suite** to verify all tests pass
6. **Verify coverage increased** (if coverage tool available)
7. **Commit changes**: \`test($(dirname "$location" | xargs basename)): add coverage for $(basename "$location")\`
8. When complete, output: \`<promise>COMPLETE</promise>\`

## Success Criteria

1. File coverage increases to >= ${target}%
2. All tests pass
3. Tests are readable and maintainable
4. No linting errors
EOF
}

# Helper function for framework-specific guidelines
get_framework_guidelines() {
    local framework="$1"
    case "$framework" in
        jest)
            cat << 'GUIDELINES'
### Jest Guidelines
- Test files: `__tests__/*.test.ts` or `*.test.ts` next to source
- Use `describe()` blocks to group related tests
- Use `it()` or `test()` for individual test cases
- Use `expect()` for assertions
- Mock modules with `jest.mock()`
- Run tests: `npm test` or `npx jest`
GUIDELINES
            ;;
        vitest)
            cat << 'GUIDELINES'
### Vitest Guidelines
- Test files: `*.test.ts` or `*.spec.ts`
- API similar to Jest: `describe()`, `it()`, `expect()`
- Use `vi.mock()` for mocking
- Run tests: `npm test` or `npx vitest`
GUIDELINES
            ;;
        pytest)
            cat << 'GUIDELINES'
### Pytest Guidelines
- Test files: `test_*.py` or `*_test.py`
- Test functions: `test_*` prefix
- Use `assert` statements
- Fixtures with `@pytest.fixture`
- Run tests: `pytest`
GUIDELINES
            ;;
        rust)
            cat << 'GUIDELINES'
### Rust Test Guidelines
- Tests in `#[cfg(test)]` module at end of file
- Or in `tests/` directory for integration tests
- Use `#[test]` attribute
- Assertions: `assert!()`, `assert_eq!()`, `assert_ne!()`
- Run tests: `cargo test`
GUIDELINES
            ;;
        go)
            cat << 'GUIDELINES'
### Go Test Guidelines
- Test files: `*_test.go` in same package
- Test functions: `TestXxx(t *testing.T)`
- Use `t.Error()`, `t.Errorf()`, `t.Fatal()`
- Table-driven tests encouraged
- Run tests: `go test ./...`
GUIDELINES
            ;;
        *)
            cat << 'GUIDELINES'
### General Test Guidelines
- Follow existing test patterns in the codebase
- Group related tests together
- Use descriptive test names
- Test both success and failure cases
GUIDELINES
            ;;
    esac
}
```

### 4. provider_branch_name()

```bash
provider_branch_name() {
    local issue_json="$1"
    local location=$(echo "$issue_json" | jq -r '.location')

    # Extract filename without extension, sanitize for branch name
    local filename=$(basename "$location" | sed 's/\.[^.]*$//')
    local sanitized=$(echo "$filename" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g')

    echo "test/coverage-$sanitized"
}
```

### 5. provider_pr_body()

```bash
provider_pr_body() {
    local issue_json="$1"
    local location=$(echo "$issue_json" | jq -r '.location')
    local coverage=$(echo "$issue_json" | jq -r '.metadata.coverage_percent')
    local missed=$(echo "$issue_json" | jq -r '.metadata.lines_missed')
    local permalink=$(echo "$issue_json" | jq -r '.permalink')
    local target="${CODECOV_TARGET_COVERAGE:-80}"

    cat << EOF
## Test Coverage Improvement

| Metric | Before | Target |
|--------|--------|--------|
| **File** | \`$location\` | - |
| **Coverage** | ${coverage}% | ${target}% |
| **Uncovered Lines** | $missed | - |

### Summary

This PR adds tests to improve coverage for \`$location\`.

### Changes

- Added test cases for previously uncovered code paths
- Focused on edge cases and error handling
- Followed existing test patterns in the codebase

### Verification

- [ ] All new tests pass
- [ ] Coverage increased (check Codecov report below)
- [ ] No existing tests broken
- [ ] Code follows project conventions

### Codecov Report

Coverage will be automatically reported by Codecov after merge.

**Original File**: [$location]($permalink)

---
*This PR was automatically generated by Meta-Ralph (Codecov provider)*
EOF
}
```

---

## Priority Calculation Algorithm

### Priority Formula

```
base_priority = 100 - coverage_percent

weighted_priority = base_priority * factor_multipliers

final_priority = min(100, weighted_priority)
```

### Weight Factors

| Factor | Multiplier | Condition |
|--------|------------|-----------|
| Coverage (base) | 1.0x | Always applied |
| Critical Path | 1.5x | File in CODECOV_CRITICAL_PATHS |
| Large File | 1.2x | > 100 lines of code |
| Recent Changes | 1.3x | Modified in last 30 days |
| High Complexity | 1.2x | Cyclomatic complexity > 10 |
| Many Importers | 1.1x | Imported by > 5 files |

### Implementation

```bash
# In providers/codecov/priority.sh

calculate_codecov_priority() {
    local coverage="$1"
    local is_critical="$2"
    local lines="$3"
    local days_since_modified="$4"
    local complexity="${5:-0}"
    local import_count="${6:-0}"

    # Base priority: inverse of coverage
    local base=$((100 - coverage))
    local priority=$base

    # Critical path multiplier (1.5x)
    if [[ "$is_critical" == "true" ]]; then
        priority=$(echo "$priority * 1.5" | bc)
    fi

    # Large file multiplier (1.2x)
    if [[ "$lines" -gt 100 ]]; then
        priority=$(echo "$priority * 1.2" | bc)
    fi

    # Recently modified multiplier (1.3x)
    if [[ "$days_since_modified" -lt 30 ]]; then
        priority=$(echo "$priority * 1.3" | bc)
    fi

    # High complexity multiplier (1.2x)
    if [[ "$complexity" -gt 10 ]]; then
        priority=$(echo "$priority * 1.2" | bc)
    fi

    # Many importers multiplier (1.1x)
    if [[ "$import_count" -gt 5 ]]; then
        priority=$(echo "$priority * 1.1" | bc)
    fi

    # Cap at 100
    if (( $(echo "$priority > 100" | bc -l) )); then
        priority=100
    fi

    # Return integer
    echo "${priority%.*}"
}
```

### Severity Mapping

| Coverage % | Severity | Priority Range |
|------------|----------|----------------|
| 0-20% | CRITICAL | 80-100 |
| 21-40% | HIGH | 60-79 |
| 41-60% | MEDIUM | 40-59 |
| 61-80% | LOW | 20-39 |
| 81-100% | INFO | 0-19 |

---

## Configuration

### Environment Variables

```bash
# Required: Codecov API Authentication
CODECOV_API_TOKEN=your-codecov-token

# Required: Repository Identification
CODECOV_SERVICE=github          # github, gitlab, bitbucket
CODECOV_OWNER=your-org          # Organization or username
CODECOV_REPO=your-repo          # Repository name

# Optional: Thresholds
CODECOV_MIN_COVERAGE=50         # Only fetch files below this % (default: 50)
CODECOV_TARGET_COVERAGE=80      # Target coverage in PRD (default: 80)
CODECOV_MAX_FILES=20            # Max files to process (default: 20)

# Optional: Critical Paths (regex patterns, comma-separated)
CODECOV_CRITICAL_PATHS="src/core,src/lib,src/services,src/api"

# Optional: Exclusion Patterns (comma-separated)
CODECOV_EXCLUDE_PATTERNS="*.test.ts,*.spec.ts,__tests__,__mocks__,node_modules,vendor,*.d.ts,*.generated.*,migrations"

# Optional: API Configuration
CODECOV_API_URL=https://api.codecov.io  # Default API URL
```

### config.sh Integration

Add to `config.sh`:

```bash
# =============================================================================
# CODECOV PROVIDER CONFIGURATION
# =============================================================================

# API Configuration
CODECOV_API_URL="${CODECOV_API_URL:-https://api.codecov.io}"
CODECOV_API_TOKEN="${CODECOV_API_TOKEN:-}"

# Repository
CODECOV_SERVICE="${CODECOV_SERVICE:-github}"
CODECOV_OWNER="${CODECOV_OWNER:-}"
CODECOV_REPO="${CODECOV_REPO:-}"

# Thresholds
CODECOV_MIN_COVERAGE="${CODECOV_MIN_COVERAGE:-50}"
CODECOV_TARGET_COVERAGE="${CODECOV_TARGET_COVERAGE:-80}"
CODECOV_MAX_FILES="${CODECOV_MAX_FILES:-20}"

# Paths and Exclusions
CODECOV_CRITICAL_PATHS="${CODECOV_CRITICAL_PATHS:-src/core,src/lib}"
CODECOV_EXCLUDE_PATTERNS="${CODECOV_EXCLUDE_PATTERNS:-*.test.*,*.spec.*,__tests__,__mocks__,node_modules,vendor,*.d.ts}"

# Priority Weights (for custom scoring)
PRIORITY_CODECOV_CRITICAL=100    # 0-20% coverage
PRIORITY_CODECOV_HIGH=80         # 21-40% coverage
PRIORITY_CODECOV_MEDIUM=60       # 41-60% coverage
PRIORITY_CODECOV_LOW=40          # 61-80% coverage
```

### .env.example Addition

```bash
# Codecov Provider
CODECOV_API_TOKEN=
CODECOV_SERVICE=github
CODECOV_OWNER=
CODECOV_REPO=
CODECOV_MIN_COVERAGE=50
CODECOV_TARGET_COVERAGE=80
```

---

## Test Framework Detection

### Implementation

```bash
# In providers/codecov/test-detection.sh

detect_test_framework() {
    local repo_root="${TARGET_REPO:-.}"

    # JavaScript/TypeScript
    if [[ -f "$repo_root/package.json" ]]; then
        if grep -q '"jest"' "$repo_root/package.json" 2>/dev/null; then
            echo "jest"
            return
        fi
        if grep -q '"vitest"' "$repo_root/package.json" 2>/dev/null; then
            echo "vitest"
            return
        fi
        if grep -q '"mocha"' "$repo_root/package.json" 2>/dev/null; then
            echo "mocha"
            return
        fi
    fi

    # Python
    if [[ -f "$repo_root/pytest.ini" ]] || [[ -f "$repo_root/pyproject.toml" ]]; then
        if grep -q "pytest" "$repo_root/pyproject.toml" 2>/dev/null; then
            echo "pytest"
            return
        fi
    fi
    if [[ -f "$repo_root/setup.py" ]] || [[ -f "$repo_root/requirements.txt" ]]; then
        if grep -q "pytest" "$repo_root/requirements.txt" 2>/dev/null; then
            echo "pytest"
            return
        fi
    fi

    # Rust
    if [[ -f "$repo_root/Cargo.toml" ]]; then
        echo "rust"
        return
    fi

    # Go
    if ls "$repo_root"/*_test.go 1>/dev/null 2>&1 || ls "$repo_root"/**/*_test.go 1>/dev/null 2>&1; then
        echo "go"
        return
    fi

    # Default
    echo "unknown"
}

get_test_command() {
    local framework="$1"
    case "$framework" in
        jest)     echo "npm test" ;;
        vitest)   echo "npm test" ;;
        mocha)    echo "npm test" ;;
        pytest)   echo "pytest" ;;
        rust)     echo "cargo test" ;;
        go)       echo "go test ./..." ;;
        *)        echo "npm test" ;;
    esac
}

get_test_file_pattern() {
    local framework="$1"
    local source_file="$2"
    local base_name=$(basename "$source_file" | sed 's/\.[^.]*$//')
    local dir_name=$(dirname "$source_file")

    case "$framework" in
        jest|vitest)
            echo "$dir_name/__tests__/$base_name.test.ts"
            echo "$dir_name/$base_name.test.ts"
            ;;
        mocha)
            echo "test/$base_name.test.js"
            ;;
        pytest)
            echo "tests/test_$base_name.py"
            echo "${dir_name}/test_$base_name.py"
            ;;
        rust)
            echo "Same file (mod tests) or tests/$base_name.rs"
            ;;
        go)
            echo "${source_file%.go}_test.go"
            ;;
        *)
            echo "$dir_name/$base_name.test.ts"
            ;;
    esac
}
```

---

## Codecov API Reference

### Authentication

```bash
curl -H "Authorization: Bearer $CODECOV_API_TOKEN" \
     -H "Accept: application/json" \
     "$CODECOV_API_URL/..."
```

### Endpoints Used

#### 1. Get Repository Coverage Report

```
GET /api/v2/repos/{service}/{owner}/{repo}/report
```

**Response:**
```json
{
  "totals": {
    "coverage": 75.5,
    "files": 120,
    "lines": 10000,
    "hits": 7550,
    "misses": 2450,
    "partials": 0,
    "branches": 500
  },
  "files": [
    {
      "name": "src/lib/utils.ts",
      "totals": {
        "coverage": 23.0,
        "lines": 58,
        "hits": 13,
        "misses": 45,
        "partials": 0,
        "branches": {
          "covered": 5,
          "missed": 12
        }
      }
    }
  ]
}
```

#### 2. Get File Coverage Details

```
GET /api/v2/repos/{service}/{owner}/{repo}/file_report/{path}
```

**Response:**
```json
{
  "name": "src/lib/utils.ts",
  "totals": { ... },
  "line_coverage": [
    [1, 1],     // line 1: covered
    [2, 1],     // line 2: covered
    [3, 0],     // line 3: not covered
    [4, null],  // line 4: not executable
    ...
  ]
}
```

### Error Handling

```json
// 401 Unauthorized
{ "detail": "Invalid token" }

// 404 Not Found
{ "detail": "Repository not found" }

// 429 Rate Limited
{ "detail": "Rate limit exceeded" }
```

---

## Implementation Plan

### Phase 1: Core Provider
- Create provider directory structure
- Implement `provider_name()` and `provider_fetch()`
- Basic Codecov API integration
- Simple priority calculation (100 - coverage)
- Test with `--providers codecov --dry-run`

### Phase 2: PRD Generation
- Implement `provider_gen_prd()` with comprehensive template
- Test framework detection
- Framework-specific guidelines
- Implement `provider_branch_name()` and `provider_pr_body()`

### Phase 3: Configuration & Priority
- Environment variable support in config.sh
- Exclusion patterns implementation
- Critical path configuration
- Advanced priority calculation with multipliers

### Phase 4: Testing & Documentation
- End-to-end testing with real Codecov data
- Documentation in README.md
- Example configurations
- Troubleshooting guide

---

## Usage Examples

### Basic Usage

```bash
# Process only coverage issues
./meta-ralph.sh --providers codecov --max-issues 5

# Dry run to see what would be processed
./meta-ralph.sh --providers codecov --dry-run

# Combined with other providers
./meta-ralph.sh --providers zeropath,sentry,codecov --max-issues 10
```

### Custom Thresholds

```bash
# Only files below 30% coverage, target 70%
CODECOV_MIN_COVERAGE=30 CODECOV_TARGET_COVERAGE=70 \
  ./meta-ralph.sh --providers codecov

# Focus on critical paths only
CODECOV_CRITICAL_PATHS="src/core,src/api" \
CODECOV_MIN_COVERAGE=60 \
  ./meta-ralph.sh --providers codecov --max-issues 3
```

### Single File

```bash
# Process specific file by ID
./meta-ralph.sh --providers codecov --single "codecov-src-lib-utils-ts"
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Coverage Improvement | > 20% increase per PR |
| Test Quality | < 5% test failure rate on generated tests |
| Processing Success | > 80% of issues result in merged PRs |
| Time Savings | 10x faster than manual test writing |

---

## Appendix A: Sample PRD Output

```markdown
# Test Coverage PRD - utils.ts

## Overview

| Metric | Value |
|--------|-------|
| **File** | `src/lib/utils.ts` |
| **Current Coverage** | 23% |
| **Lines Missed** | 45 of 58 |
| **Target Coverage** | 80% |
| **Test Framework** | jest |

## Problem Statement

The file `src/lib/utils.ts` has insufficient test coverage at 23%.
This PR should add tests to increase coverage to at least 80%.

## Requirements

### Must Have
- [ ] Add tests for uncovered lines in `src/lib/utils.ts`
- [ ] Achieve minimum 80% coverage for this file
- [ ] All tests must pass
- [ ] Tests must be meaningful (not just coverage farming)

### Should Have
- [ ] Test edge cases and error conditions
- [ ] Test boundary conditions
- [ ] Mock external dependencies appropriately
- [ ] Follow existing test patterns in codebase

### Must NOT Do
- [ ] Do NOT modify the source file (only add tests)
- [ ] Do NOT delete existing tests
- [ ] Do NOT add tests that always pass without assertions
- [ ] Do NOT add unnecessary dependencies

## Test Framework Guidelines

### Jest Guidelines
- Test files: `__tests__/*.test.ts` or `*.test.ts` next to source
- Use `describe()` blocks to group related tests
- Use `it()` or `test()` for individual test cases
- Use `expect()` for assertions
- Mock modules with `jest.mock()`
- Run tests: `npm test` or `npx jest`

## Instructions for AI Agent

1. **Read the source file**: `src/lib/utils.ts`
2. **Find existing test file** or determine where to create new one
3. **Analyze the uncovered code paths** - focus on:
   - Branches and conditionals
   - Error handling paths
   - Edge cases
4. **Write comprehensive tests** following project conventions
5. **Run test suite** to verify all tests pass
6. **Verify coverage increased** (if coverage tool available)
7. **Commit changes**: `test(lib): add coverage for utils.ts`
8. When complete, output: `<promise>COMPLETE</promise>`

## Success Criteria

1. File coverage increases to >= 80%
2. All tests pass
3. Tests are readable and maintainable
4. No linting errors
```

---

## Appendix B: Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid token" | Expired or wrong token | Regenerate token in Codecov settings |
| "Repository not found" | Wrong owner/repo or private repo | Verify CODECOV_OWNER and CODECOV_REPO |
| No files returned | All files above threshold | Lower CODECOV_MIN_COVERAGE |
| Wrong files included | Missing exclusion patterns | Add patterns to CODECOV_EXCLUDE_PATTERNS |
| Rate limit exceeded | Too many API calls | Add delay between requests or reduce MAX_FILES |

---

## Appendix C: Codecov Token Setup

1. Go to Codecov (https://app.codecov.io)
2. Navigate to Settings > Access
3. Generate a new API token
4. Add to `.env`:
   ```
   CODECOV_API_TOKEN=your-token-here
   ```
5. Verify with:
   ```bash
   curl -H "Authorization: Bearer $CODECOV_API_TOKEN" \
        https://api.codecov.io/api/v2/repos/github/your-org/your-repo/report
   ```
