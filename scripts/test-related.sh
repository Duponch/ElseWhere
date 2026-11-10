#!/bin/sh
# Tests that import the files changed since a commit, chosen by Vitest from its
# own import graph. The quick check before a commit (minutes, not hours).
# Usage: sh scripts/test-related.sh [base=origin/main]
base=${1:-origin/main}
files=$( (git diff --name-only "$base" -- src scripts tests; git ls-files --others --exclude-standard -- src scripts tests) | grep -E '\.(ts|mjs)$' | sort -u | tr '\n' ' ')
if [ -z "$files" ]; then echo "No changed source file since $base"; exit 0; fi
echo "Changed: $files"
exec npx vitest related $files --run --maxWorkers=3
