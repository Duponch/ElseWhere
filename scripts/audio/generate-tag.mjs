#!/usr/bin/env node
// Offline asset preparation only: generates, one after the other, every missing
// take of the plan entries of one tag (e.g. g1122, the game sounds of 22
// November 2026). Each take goes through generate-sfx.mjs --generate, which
// writes the file and its generation-log record. Stops at the first refusal
// (a quota, a network failure) and before the credit cap of this run.
// Usage: node scripts/audio/generate-tag.mjs --tag g1122 [--max-credits 8000] [--dry-run]
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { takeFilename } from './generate-sfx.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const tag = option('--tag');
const maxCredits = Number(option('--max-credits') ?? 8000);
const dryRun = args.includes('--dry-run');
if (!tag || !/^[a-z0-9]+$/.test(tag) || !(maxCredits > 0)) {
  console.error('Usage: node scripts/audio/generate-tag.mjs --tag g1122 [--max-credits 8000] [--dry-run]');
  process.exit(1);
}

/** The missing takes of a tag, in plan order: [{ id, take, seconds }]. */
function missingTakes(plan, tagName, exists) {
  const queue = [];
  for (const [id, item] of Object.entries(plan.events)) {
    if (!item.filename.endsWith(`-${tagName}-take-1.mp3`)) continue;
    for (let take = 1; take <= (item.takes ?? 1); take++)
      if (!exists(takeFilename(item.filename, take))) queue.push({ id, take, seconds: item.durationSeconds });
  }
  return queue;
}

const plan = JSON.parse(readFileSync(resolve(here, 'sfx-plan.json'), 'utf8'));
const sfx = resolve(here, '../../public/assets/audio/sfx');
// A take already generated (kept, or rejected after measurement and removed)
// is never generated again under the same name: raise `takes` for a retake.
const logged = new Set(JSON.parse(readFileSync(resolve(here, 'generation-log.json'), 'utf8')).generations.map((entry) => entry.filename));
const queue = missingTakes(plan, tag, (file) => logged.has(file) || existsSync(resolve(sfx, file)));
const estimate = queue.reduce((sum, item) => sum + Math.ceil(item.seconds * 10), 0);
console.log(`${tag}: ${queue.length} missing takes, about ${estimate} credits (10 per second requested); cap ${maxCredits}.`);
if (dryRun) process.exit(0);
let billed = 0, made = 0;
for (const { id, take, seconds } of queue) {
  if (billed + Math.ceil(seconds * 10) > maxCredits) { console.log(`Stopped at the cap of ${maxCredits} credits.`); break; }
  const run = spawnSync(process.execPath, [resolve(here, 'generate-sfx.mjs'), '--generate', '--id', id, '--take', String(take)],
    { encoding: 'utf8' });
  const output = `${run.stdout}${run.stderr}`;
  const credits = /billed (\d+) credits/.exec(output);
  if (run.status !== 0 || !credits) {
    console.log(`Stopped on ${id} take ${take}: ${output.split('\n').find((line) => /fail|error|quota/i.test(line)) ?? 'no candidate'}`);
    break;
  }
  billed += Number(credits[1]);
  made++;
  console.log(`${id} take ${take}: ${credits[1]} credits`);
}
console.log(`${made} takes generated, ${billed} credits billed in this run.`);
