#!/bin/sh
# Runs Vitest on a list of test files in chunks of 30 (a single command line
# cannot hold them all on Windows), three workers, and merges the JSON reports.
# A chunk that exceeds its time limit is stopped; the files it had not finished
# are listed in <out>.unfinished.txt. Optional tests (*.optin.test.ts) and the
# energy and prison colonies are left out, as in the ordinary suite.
# Usage: sh scripts/test-chunked.sh [list=all test files] [out=tmp/test-all.json] [chunkSeconds=900]
list=${1:-}; out=${2:-tmp/test-all.json}; limit=${3:-900}
mkdir -p tmp; work=tmp/test-chunks-$$; mkdir -p "$work"
if [ -z "$list" ]; then ls tests/*.test.ts > "$work/all.txt"; list="$work/all.txt"; fi
grep -vE "\.optin\.test\.ts|/(energy|prison)-colony\.test\.ts|^tests/scenarios/" "$list" > "$work/list.txt"
split -l 30 "$work/list.txt" "$work/part-"
: > "$out.unfinished.txt"
for part in "$work"/part-*; do
  case "$part" in *.json|*.log) continue;; esac
  timeout -k 10 "$limit" npx vitest run $(tr '\n' ' ' < "$part") --maxWorkers=3 --reporter=json --outputFile="$part.json" --reporter=default > "$part.log" 2>&1
  echo "$(date +%H:%M:%S) $(basename "$part") rc=$?" >> "$work/progress.txt"
  if [ ! -s "$part.json" ]; then for f in $(cat "$part"); do grep -q "$(basename "$f")" "$part.log" || echo "$f"; done >> "$out.unfinished.txt"; fi
done
python - "$out" "$work"/part-*.json <<'PY'
import json, sys
out, parts = sys.argv[1], sys.argv[2:]
merged = {'numTotalTests': 0, 'numPassedTests': 0, 'numFailedTests': 0, 'numPendingTests': 0, 'testResults': []}
for p in parts:
    try: d = json.load(open(p, encoding='utf-8'))
    except Exception: continue
    for k in ['numTotalTests', 'numPassedTests', 'numFailedTests', 'numPendingTests']: merged[k] += d.get(k, 0)
    merged['testResults'] += d['testResults']
json.dump(merged, open(out, 'w', encoding='utf-8'))
print('merged', len(parts), 'chunks:', merged['numPassedTests'], 'passed', merged['numFailedTests'], 'failed')
PY
echo "kept $work"
