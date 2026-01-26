#!/bin/bash
# providers/codecov/test-detection.sh
# Test framework detection for Codecov provider

# Detect the test framework used in the repository
detect_test_framework() {
    local repo_root="${TARGET_REPO:-.}"

    # JavaScript/TypeScript - check package.json
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
        # Check devDependencies as well
        if grep -q '"@jest/core"' "$repo_root/package.json" 2>/dev/null; then
            echo "jest"
            return
        fi
    fi

    # Python - check for pytest
    if [[ -f "$repo_root/pytest.ini" ]] || [[ -f "$repo_root/conftest.py" ]]; then
        echo "pytest"
        return
    fi
    if [[ -f "$repo_root/pyproject.toml" ]]; then
        if grep -q "pytest" "$repo_root/pyproject.toml" 2>/dev/null; then
            echo "pytest"
            return
        fi
    fi
    if [[ -f "$repo_root/requirements.txt" ]]; then
        if grep -q "pytest" "$repo_root/requirements.txt" 2>/dev/null; then
            echo "pytest"
            return
        fi
    fi
    if [[ -f "$repo_root/requirements-dev.txt" ]]; then
        if grep -q "pytest" "$repo_root/requirements-dev.txt" 2>/dev/null; then
            echo "pytest"
            return
        fi
    fi

    # Rust - check for Cargo.toml
    if [[ -f "$repo_root/Cargo.toml" ]]; then
        echo "rust"
        return
    fi

    # Go - check for go.mod or test files
    if [[ -f "$repo_root/go.mod" ]]; then
        echo "go"
        return
    fi
    if ls "$repo_root"/*_test.go 1>/dev/null 2>&1; then
        echo "go"
        return
    fi

    # Elixir - check for mix.exs
    if [[ -f "$repo_root/mix.exs" ]]; then
        echo "elixir"
        return
    fi

    # Ruby - check for Gemfile with rspec
    if [[ -f "$repo_root/Gemfile" ]]; then
        if grep -q "rspec" "$repo_root/Gemfile" 2>/dev/null; then
            echo "rspec"
            return
        fi
        if grep -q "minitest" "$repo_root/Gemfile" 2>/dev/null; then
            echo "minitest"
            return
        fi
    fi

    # Default
    echo "unknown"
}

# Get the command to run tests
get_test_command() {
    local framework="$1"
    case "$framework" in
        jest)     echo "npm test" ;;
        vitest)   echo "npm test" ;;
        mocha)    echo "npm test" ;;
        pytest)   echo "pytest" ;;
        rust)     echo "cargo test" ;;
        go)       echo "go test ./..." ;;
        elixir)   echo "mix test" ;;
        rspec)    echo "bundle exec rspec" ;;
        minitest) echo "bundle exec rake test" ;;
        *)        echo "npm test" ;;
    esac
}

# Get the test file pattern for a source file
get_test_file_pattern() {
    local framework="$1"
    local source_file="$2"
    local base_name=$(basename "$source_file" | sed 's/\.[^.]*$//')
    local dir_name=$(dirname "$source_file")

    case "$framework" in
        jest|vitest)
            echo "$dir_name/__tests__/$base_name.test.ts"
            echo "$dir_name/$base_name.test.ts"
            echo "$dir_name/__tests__/$base_name.test.tsx"
            echo "$dir_name/$base_name.test.tsx"
            echo "$dir_name/__tests__/$base_name.spec.ts"
            echo "$dir_name/$base_name.spec.ts"
            ;;
        mocha)
            echo "test/$base_name.test.js"
            echo "test/$base_name.spec.js"
            ;;
        pytest)
            echo "tests/test_$base_name.py"
            echo "${dir_name}/test_$base_name.py"
            echo "tests/${dir_name}/test_$base_name.py"
            ;;
        rust)
            echo "Same file (mod tests) or tests/$base_name.rs"
            ;;
        go)
            echo "${source_file%.go}_test.go"
            ;;
        elixir)
            echo "test/${dir_name}/${base_name}_test.exs"
            ;;
        rspec)
            echo "spec/${dir_name}/${base_name}_spec.rb"
            ;;
        minitest)
            echo "test/${dir_name}/${base_name}_test.rb"
            echo "test/test_${base_name}.rb"
            ;;
        *)
            echo "$dir_name/$base_name.test.ts"
            ;;
    esac
}

# Get framework-specific test guidelines for PRD generation
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
- Mock functions with `jest.fn()` and `jest.spyOn()`
- Run tests: `npm test` or `npx jest`
- Run single file: `npx jest path/to/test.ts`
- Check coverage: `npm test -- --coverage`
GUIDELINES
            ;;
        vitest)
            cat << 'GUIDELINES'
### Vitest Guidelines
- Test files: `*.test.ts` or `*.spec.ts`
- API similar to Jest: `describe()`, `it()`, `expect()`
- Use `vi.mock()` for mocking modules
- Use `vi.fn()` for mock functions
- Use `vi.spyOn()` for spying
- Run tests: `npm test` or `npx vitest`
- Run single file: `npx vitest path/to/test.ts`
- Check coverage: `npx vitest --coverage`
GUIDELINES
            ;;
        pytest)
            cat << 'GUIDELINES'
### Pytest Guidelines
- Test files: `test_*.py` or `*_test.py`
- Test functions: `test_*` prefix
- Test classes: `Test*` prefix
- Use `assert` statements for assertions
- Use `@pytest.fixture` for test fixtures
- Use `@pytest.mark.parametrize` for parameterized tests
- Mock with `unittest.mock` or `pytest-mock`
- Run tests: `pytest`
- Run single file: `pytest path/to/test_file.py`
- Check coverage: `pytest --cov=src`
GUIDELINES
            ;;
        rust)
            cat << 'GUIDELINES'
### Rust Test Guidelines
- Unit tests in `#[cfg(test)]` module at end of source file
- Integration tests in `tests/` directory
- Use `#[test]` attribute for test functions
- Assertions: `assert!()`, `assert_eq!()`, `assert_ne!()`
- Use `#[should_panic]` for expected panics
- Use `#[ignore]` for expensive tests
- Run tests: `cargo test`
- Run single test: `cargo test test_name`
- Check coverage: `cargo tarpaulin`
GUIDELINES
            ;;
        go)
            cat << 'GUIDELINES'
### Go Test Guidelines
- Test files: `*_test.go` in same package
- Test functions: `TestXxx(t *testing.T)`
- Benchmark functions: `BenchmarkXxx(b *testing.B)`
- Use `t.Error()`, `t.Errorf()`, `t.Fatal()` for failures
- Table-driven tests are strongly encouraged
- Use `t.Run()` for subtests
- Run tests: `go test ./...`
- Run single test: `go test -run TestName`
- Check coverage: `go test -cover ./...`
GUIDELINES
            ;;
        elixir)
            cat << 'GUIDELINES'
### Elixir ExUnit Guidelines
- Test files: `test/**/*_test.exs`
- Use `use ExUnit.Case` in test modules
- Use `test "description" do ... end` for test cases
- Use `describe` for grouping related tests
- Assertions: `assert`, `refute`, `assert_raise`
- Use `setup` and `setup_all` for fixtures
- Run tests: `mix test`
- Run single file: `mix test test/path/to_test.exs`
- Check coverage: `mix test --cover`
GUIDELINES
            ;;
        rspec)
            cat << 'GUIDELINES'
### RSpec Guidelines
- Test files: `spec/**/*_spec.rb`
- Use `describe` for grouping by class/method
- Use `context` for different scenarios
- Use `it` or `specify` for individual tests
- Expectations: `expect(x).to eq(y)`
- Use `let` and `let!` for lazy/eager fixtures
- Use `before` and `after` hooks
- Run tests: `bundle exec rspec`
- Run single file: `bundle exec rspec spec/path/to_spec.rb`
- Check coverage: Add simplecov gem
GUIDELINES
            ;;
        minitest)
            cat << 'GUIDELINES'
### Minitest Guidelines
- Test files: `test/**/*_test.rb` or `test/**/test_*.rb`
- Test classes: `class TestClassName < Minitest::Test`
- Test methods: `def test_method_name`
- Assertions: `assert`, `assert_equal`, `assert_nil`, `assert_raises`
- Use `setup` and `teardown` for fixtures
- Run tests: `bundle exec rake test`
- Run single file: `ruby -Itest test/path/to_test.rb`
GUIDELINES
            ;;
        *)
            cat << 'GUIDELINES'
### General Test Guidelines
- Follow existing test patterns in the codebase
- Group related tests together
- Use descriptive test names that explain what is being tested
- Test both success (happy path) and failure (edge cases) scenarios
- Mock external dependencies to isolate the unit under test
- Keep tests independent - each test should be able to run in isolation
- Aim for high test coverage but prioritize meaningful tests over line coverage
GUIDELINES
            ;;
    esac
}
