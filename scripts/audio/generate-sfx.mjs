#!/usr/bin/env node
// Offline asset preparation only: the game never calls ElevenLabs.
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile, rename, stat, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const planPath = resolve(here, 'sfx-plan.json');
const logPath = resolve(here, 'generation-log.json');
const processingLogPath = resolve(here, 'processing-log.json');
const manifestPath = resolve(repo, 'public/assets/audio/manifest.json');
const sfxDir = resolve(repo, 'public/assets/audio/sfx');

function usage() {
  console.log('Usage: node scripts/audio/generate-sfx.mjs [--id mining.hit] [--take 2] [--generate [--retake] | --publish]');
  console.log('Without an action: read-only plan and manifest check. Generation is one ID (and one take) per invocation.');
}

/** A plan filename ending in `-take-1.mp3` names every take of the cue:
 * take N replaces that suffix. Other filenames have a single take. */
export function takeFilename(filename, take) {
  if (take === 1) return filename;
  if (!/-take-1\.mp3$/.test(filename)) throw new Error(`${filename} has no numbered takes`);
  return filename.replace(/-take-1\.mp3$/, `-take-${take}.mp3`);
}

function parseArgs(args) {
  let id;
  let take = 1;
  let generate = false;
  let publish = false;
  let retake = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--id' && !id) id = args[++i];
    else if (args[i] === '--take') {
      take = Number(args[++i]);
      if (!Number.isInteger(take) || take < 1 || take > 9) throw new Error('--take expects an integer from 1 to 9');
    }
    else if (args[i] === '--generate') generate = true;
    else if (args[i] === '--publish') publish = true;
    else if (args[i] === '--retake') retake = true;
    else if (args[i] === '--dry-run') continue;
    else if (args[i] === '--help') { usage(); process.exit(0); }
    else throw new Error(`Unknown or duplicate argument: ${args[i]}`);
  }
  if (generate && publish) throw new Error('Choose --generate or --publish');
  if ((generate || publish) && !id) throw new Error('An action requires one --id');
  if (take !== 1 && !generate) throw new Error('--take only applies to --generate');
  if(retake&&!generate)throw new Error('--retake requires --generate and a new candidate filename');
  return { id, take, generate, publish, retake };
}

export function assertPlan(plan) {
  if (plan.version !== 1 || plan.modelId !== 'eleven_text_to_sound_v2' || plan.outputFormat !== 'mp3_44100_128') {
    throw new Error('Unsupported SFX plan version/model/format');
  }
  for (const [id, item] of Object.entries(plan.events ?? {})) {
    if (!/^[a-z]+(?:-[a-z]+)*(?:\.[a-z]+(?:-[a-z]+)*)+$/.test(id)) throw new Error(`Invalid cue ID: ${id}`);
    if (!/^[a-z0-9-]+\.mp3$/.test(item.filename)) throw new Error(`Invalid filename for ${id}`);
    if (typeof item.prompt !== 'string' || item.prompt.length < 20 || item.prompt.length > 450) throw new Error(`Invalid prompt for ${id}`);
    if (!(item.durationSeconds >= 0.5 && item.durationSeconds <= 30)) throw new Error(`Invalid duration for ${id}`);
    if (!(item.promptInfluence >= 0 && item.promptInfluence <= 1)) throw new Error(`Invalid influence for ${id}`);
    if (typeof item.loop !== 'boolean') throw new Error(`Invalid loop for ${id}`);
    if (item.spatial !== undefined && typeof item.spatial !== 'boolean') throw new Error(`Invalid spatial setting for ${id}`);
    if (!(item.gain > 0 && item.gain <= (item.loop ? 2 : 8))) throw new Error(`Invalid gain for ${id}`);
    if (item.spatial !== false && !(item.maxDistance > 0)) throw new Error(`Invalid maxDistance for ${id}`);
    if (item.takes !== undefined && !(Number.isInteger(item.takes) && item.takes >= 1 && item.takes <= 9)) throw new Error(`Invalid takes for ${id}`);
    if (item.calibrationFamily !== undefined && !/^[a-z]+(?:-[a-z]+)*$/.test(item.calibrationFamily)) throw new Error(`Invalid calibration family for ${id}`);
  }
}

function isMp3(bytes) {
  if (bytes.length < 128) return false;
  if (bytes.subarray(0, 3).toString('ascii') === 'ID3') return true;
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function readLocalSfx(filename) {
  if (!/^[a-z0-9-]+\.mp3$/.test(filename)) throw new Error(`Unsafe SFX filename: ${filename}`);
  const path = resolve(sfxDir, filename);
  const [directory, actual] = await Promise.all([
    realpath(sfxDir),
    realpath(path).catch(() => null),
  ]);
  if (!actual || dirname(actual) !== directory) throw new Error(`Missing or unsafe SFX asset: ${filename}`);
  const details = await stat(actual);
  if (!details.isFile()) throw new Error(`SFX asset is not a file: ${filename}`);
  return readFile(actual);
}

export async function assertPublishedSource(cueId, item, variant, log) {
  const prefix = '/assets/audio/sfx/';
  if (typeof variant?.src !== 'string' || !variant.src.startsWith(prefix)) {
    throw new Error(`Manifest source differs for ${cueId}`);
  }
  const filename = variant.src.slice(prefix.length);
  if (!/^[a-z0-9-]+\.mp3$/.test(filename)) throw new Error(`Unsafe manifest source for ${cueId}`);
  const bytes = await readLocalSfx(filename);
  // One cue may have several independent takes. Every direct take must be
  // registered under the same cue ID with its own filename and hash.
  const matches = log.generations.filter((entry) => entry.id === cueId &&
    entry.filename === filename && entry.sha256 === sha256(bytes));
  if (matches.length === 1) return;
  if (matches.length > 1 || filename === item.filename) throw new Error(`Published SFX source differs for ${cueId}`);

  const processingLog = JSON.parse(await readFile(processingLogPath, 'utf8'));
  if (processingLog.version !== 1 || !Array.isArray(processingLog.derivations)) {
    throw new Error('Unsupported processing log');
  }
  const matching = processingLog.derivations.filter((entry) => entry.id === cueId && entry.filename === filename);
  if (matching.length !== 1) throw new Error(`Manifest source differs for ${cueId}`);
  const [derivation] = matching;
  if (!/^[a-z0-9-]+\.mp3$/.test(derivation.sourceFilename ?? '') ||
      !/^[a-f0-9]{64}$/.test(derivation.sha256) ||
      !/^[a-f0-9]{64}$/.test(derivation.sourceSha256) ||
      sha256(bytes) !== derivation.sha256) {
    throw new Error(`Invalid derived SFX for ${cueId}`);
  }
  const sourceRecords = log.generations.filter((entry) => entry.id === cueId &&
    entry.filename === derivation.sourceFilename && entry.sha256 === derivation.sourceSha256);
  if (sourceRecords.length !== 1 || sha256(await readLocalSfx(derivation.sourceFilename)) !== derivation.sourceSha256) {
    throw new Error(`Derived SFX source differs for ${cueId}`);
  }
}

export async function assertPublishedCue(cueId, item, published, log) {
  if (!Array.isArray(published.variants) || published.variants.length === 0) {
    throw new Error(`Manifest source differs for ${cueId}`);
  }
  for (const variant of published.variants) await assertPublishedSource(cueId, item, variant, log);
}

async function main() {
  const { id, take, generate, publish, retake } = parseArgs(process.argv.slice(2));
  const plan = JSON.parse(await readFile(planPath, 'utf8'));
  const log = JSON.parse(await readFile(logPath, 'utf8'));
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assertPlan(plan);
  if (log.version !== 1 || !Array.isArray(log.generations)) throw new Error('Unsupported generation log');
  if (manifest.version !== 1 || !manifest.events || typeof manifest.events !== 'object' || Array.isArray(manifest.events)) {
    throw new Error('Unsupported runtime manifest');
  }
  const selected = id ? [[id, plan.events[id]]] : Object.entries(plan.events);
  if (selected.some(([, item]) => !item)) throw new Error(`Unknown cue ID: ${id}`);
  for (const [cueId, item] of selected) {
    const published = manifest.events[cueId];
    if (published) await assertPublishedCue(cueId, item, published, log);
    const status = published ? 'published' : 'pending';
    // API help lists 20 credits/s; overview lists 40. Show both until account billing is confirmed.
    console.log(`${cueId}: ${status}; ${item.durationSeconds}s; loop=${item.loop}; estimated ${Math.ceil(item.durationSeconds * 20)}–${Math.ceil(item.durationSeconds * 40)} credits`);
  }
  if (!generate && !publish) return;
  if (manifest.events[id]&&!retake) throw new Error(`${id} already published; review it before generating a new variant and use --retake for a new filename`);
  const item = plan.events[id];
  const filename = takeFilename(item.filename, take);
  if(retake&&(log.generations.some(entry=>entry.filename===filename)||manifest.events[id]?.variants.some(variant=>variant.src.endsWith('/'+filename))))throw new Error(`${filename} is an existing or historical take; choose a new filename without replacing the published sound`);
  const destination = resolve(sfxDir, filename);
  const existing = await stat(destination).catch(() => null);
  if (generate && existing) throw new Error(`${filename} already exists; audition or rename the candidate before regeneration`);
  if (publish) {
    if (!existing) throw new Error(`${item.filename} is missing; generate and audition it first`);
    const bytes = await readFile(destination);
    if (!isMp3(bytes)) throw new Error(`${item.filename} is not a plausible MP3`);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    if (!log.generations.some((entry) => entry.id === id && entry.filename === item.filename && entry.sha256 === sha256)) {
      throw new Error(`${item.filename} has no matching generation record`);
    }
    const nextManifest = {
      ...manifest,
      events: {
        ...manifest.events,
        [id]: {
          variants: [{ src: `/assets/audio/sfx/${item.filename}`, gain: 1 }],
          gain: item.gain,
          ...(item.maxDistance ? { maxDistance: item.maxDistance } : {}),
          loop: item.loop,
          ...(item.spatial === false ? { spatial: false } : {}),
        },
      },
    };
    const tempManifest = `${manifestPath}.tmp-${process.pid}`;
    await writeFile(tempManifest, `${JSON.stringify(nextManifest, null, 2)}\n`, { flag: 'wx' });
    await rename(tempManifest, manifestPath);
    console.log(`Published ${id}: SHA-256 ${sha256}`);
    return;
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is required for --generate');
  const response = await fetch(`https://api.elevenlabs.io/v1/sound-generation?output_format=${plan.outputFormat}`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: item.prompt,
      model_id: plan.modelId,
      duration_seconds: item.durationSeconds,
      prompt_influence: item.promptInfluence,
      loop: item.loop,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    // The body may name the refusal (e.g. quota_exceeded); it never echoes the key.
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`ElevenLabs generation failed: HTTP ${response.status} ${detail}`);
  }
  // The API reports the billed cost of the request in this header when present.
  const costHeader = response.headers.get('character-cost');
  const billedCredits = costHeader !== null && Number.isFinite(Number(costHeader)) ? Number(costHeader) : undefined;
  const requestId = response.headers.get('request-id') ?? undefined;
  const contentType = response.headers.get('content-type') ?? '';
  if (!/audio\/mpeg|audio\/mp3|application\/octet-stream/i.test(contentType)) throw new Error(`Unexpected response type: ${contentType}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8_000_000 || !isMp3(bytes)) throw new Error('Response is not a plausible MP3');

  await mkdir(sfxDir, { recursive: true });
  await writeFile(destination, bytes, { flag: 'wx' });
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const nextLog = {
    ...log,
    generations: [...log.generations, {
      id,
      filename,
      ...(/-take-\d\.mp3$/.test(filename) ? { take } : {}),
      generatedAt: new Date().toISOString(),
      provider: 'ElevenLabs',
      providerRoute: 'API /v1/sound-generation',
      ...(requestId ? { requestId } : {}),
      modelId: plan.modelId,
      outputFormat: plan.outputFormat,
      prompt: item.prompt,
      durationSeconds: item.durationSeconds,
      promptInfluence: item.promptInfluence,
      loop: item.loop,
      sha256,
      bytes: bytes.length,
      ...(billedCredits !== undefined ? { billedCredits } : {}),
      estimatedCredits: [Math.ceil(item.durationSeconds * 20), Math.ceil(item.durationSeconds * 40)],
    }],
  };
  const tempLog = `${logPath}.tmp-${process.pid}`;
  await writeFile(tempLog, `${JSON.stringify(nextLog, null, 2)}\n`, { flag: 'wx' });
  await rename(tempLog, logPath);
  console.log(`Generated candidate ${id} (${filename}): ${bytes.length} bytes, SHA-256 ${sha256}, billed ${billedCredits ?? 'unreported'} credits`);
  console.log('Audition the candidate, then publish it with --id and --publish.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
