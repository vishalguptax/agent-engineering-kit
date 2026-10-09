#!/bin/sh
# Agent Engineering Kit — project checks, for any AI tool (and humans).
# Runs every command in .agent-kit/checks.conf and refuses changes to files listed in .agent-kit/protected.
#
#   sh .agent-kit/check.sh            check all uncommitted changes (what the verify skill runs)
#   sh .agent-kit/check.sh --staged   check what is about to be committed (what the pre-commit hook runs)
#
# Exits 0 when everything passes, 1 otherwise. A failure prints its command and output; success is one line,
# so a passing run costs an agent almost no context.
set -u

root=$(git rev-parse --show-toplevel 2>/dev/null) || root=$(pwd)
cd "$root" || exit 1
mode=${1:-}
failed=0
passed=""
tmp=$(mktemp -d) || exit 1
trap 'rm -rf "$tmp"' EXIT

changed_files() {
  if [ "$mode" = "--staged" ]; then
    git diff --cached --name-only --diff-filter=ACMRD
  else
    git diff --name-only HEAD 2>/dev/null || git diff --name-only
    git ls-files --others --exclude-standard
  fi
}

# 1. Protected files: one shell glob per line (* also matches /). Lines starting with # are comments.
if [ -f .agent-kit/protected ] && git rev-parse --git-dir >/dev/null 2>&1; then
  changed="$tmp/changed"
  changed_files | sort -u > "$changed"
  while IFS= read -r file; do
    while IFS= read -r pattern || [ -n "$pattern" ]; do
      case "$pattern" in '' | '#'*) continue ;; esac
      # shellcheck disable=SC2254 # the pattern is meant to be a glob
      case "$file" in
        $pattern)
          echo "protected file changed: $file (it matches \"$pattern\" in .agent-kit/protected; remove that line if the change is intended)"
          failed=1
          ;;
      esac
    done < .agent-kit/protected
  done < "$changed"
fi

# 2. Commands: one "name: command" per line. Read on fd 3 so a command can't swallow the rest of the file.
if [ -f .agent-kit/checks.conf ]; then
  number=0
  while IFS= read -r line <&3 || [ -n "$line" ]; do
    number=$((number + 1))
    case "$line" in '' | '#'*) continue ;; esac
    case "$line" in
      *:*) ;;
      *)
        echo ".agent-kit/checks.conf line $number isn't \"name: command\": $line"
        failed=1
        continue
        ;;
    esac
    name=${line%%:*}
    command=$(printf '%s' "${line#*:}" | sed 's/^[[:space:]]*//')
    if sh -c "$command" </dev/null >"$tmp/output" 2>&1; then
      passed="${passed:+$passed, }$name"
    else
      echo "check $name FAILED: $command"
      cat "$tmp/output"
      failed=1
    fi
  done 3< .agent-kit/checks.conf
fi

if [ "$failed" -eq 0 ] && [ -n "$passed" ]; then echo "checks passed: $passed"; fi
exit "$failed"
