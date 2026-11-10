#!/bin/sh
# The fast suite: every test file except the slowest ones (scripts/slow-tests.txt,
# about 80 % of the complete suite's time) and the optional ones. Run it before
# pushing a broad change; the complete suite (sh scripts/test-chunked.sh) runs
# once a night. Results are merged into <out>; compare them with the list of
# known failures, read as UTF-8.
# Usage: sh scripts/test-fast.sh [out=tmp/test-fast.json]
out=${1:-tmp/test-fast.json}
mkdir -p tmp
ls tests/*.test.ts | grep -vxFf scripts/slow-tests.txt > tmp/test-fast-list.txt
echo "$(wc -l < tmp/test-fast-list.txt) files, $(wc -l < scripts/slow-tests.txt) slow files left to the nightly suite"
exec sh scripts/test-chunked.sh tmp/test-fast-list.txt "$out"
