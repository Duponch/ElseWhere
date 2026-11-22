import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import { assertPlan, takeFilename } from './generate-sfx.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const script = join(repo, 'scripts/audio/generate-sfx.mjs');
const fixtureRoot = join(repo, 'tmp/test-runs');
const source = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(125, 1)]);
const derived = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(125, 2)]);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceFilename = 'mining-hit-v1.mp3';
const derivedFilename = 'mining-hit-soft-compressed-v1.mp3';

test('accepts hyphenated cue segments and rejects unsafe IDs', () => {
  const item = { filename: 'machine-wood-generator-v1.mp3', prompt: 'A small wood generator running steadily in a dry loop.',
    durationSeconds: 1, promptInfluence: 0.7, loop: true, gain: 0.5, maxDistance: 20 };
  const plan = (id) => ({ version: 1, modelId: 'eleven_text_to_sound_v2', outputFormat: 'mp3_44100_128',
    events: { [id]: item } });
  assert.doesNotThrow(() => assertPlan(plan('machine.wood-generator')));
  for (const id of ['machine..generator', 'machine.wood/../generator', 'machine.-generator',
    'machine.generator-', 'Machine.wood-generator', 'machine.wood_generator']) {
    assert.throws(() => assertPlan(plan(id)), /Invalid cue ID/);
  }
});

test('numbered takes derive their filename from the first take only', () => {
  assert.equal(takeFilename('ui-tab-open-c1122-take-1.mp3', 1), 'ui-tab-open-c1122-take-1.mp3');
  assert.equal(takeFilename('ui-tab-open-c1122-take-1.mp3', 3), 'ui-tab-open-c1122-take-3.mp3');
  assert.throws(() => takeFilename('mining-pickaxe-ping-v2.mp3', 2), /no numbered takes/);
});

await mkdir(fixtureRoot, { recursive: true });
const root = await mkdtemp(join(fixtureRoot, 'generate-sfx-'));
after(() => rm(root, { recursive: true, force: true }));

async function fixture(name, adjust = () => {}) {
  const directory = join(root, name);
  const audio = join(directory, 'scripts/audio');
  const sfx = join(directory, 'public/assets/audio/sfx');
  await mkdir(audio, { recursive: true });
  await mkdir(sfx, { recursive: true });
  await copyFile(script, join(audio, 'generate-sfx.mjs'));
  const plan = { version: 1, modelId: 'eleven_text_to_sound_v2', outputFormat: 'mp3_44100_128', events: {
    'mining.hit': { filename: sourceFilename, prompt: 'A short, soft steel pick tap against stone.', durationSeconds: 0.6,
      promptInfluence: 0.65, loop: false, gain: 2.5, maxDistance: 20 },
  } };
  const generationLog = { version: 1, generations: [{ id: 'mining.hit', filename: sourceFilename, sha256: hash(source) }] };
  const processingLog = { version: 1, derivations: [{ id: 'mining.hit', sourceFilename, sourceSha256: hash(source),
    filename: derivedFilename, sha256: hash(derived) }] };
  const manifest = { version: 1, events: { 'mining.hit': { variants: [{ src: `/assets/audio/sfx/${derivedFilename}`, gain: 1 }] } } };
  const files = { [sourceFilename]: source, [derivedFilename]: derived };
  adjust({ plan, generationLog, processingLog, manifest, files });
  await Promise.all([
    writeFile(join(audio, 'sfx-plan.json'), JSON.stringify(plan)),
    writeFile(join(audio, 'generation-log.json'), JSON.stringify(generationLog)),
    writeFile(join(audio, 'processing-log.json'), JSON.stringify(processingLog)),
    writeFile(join(directory, 'public/assets/audio/manifest.json'), JSON.stringify(manifest)),
    ...Object.entries(files).map(([filename, bytes]) => writeFile(join(sfx, filename), bytes)),
  ]);
  const module = await import(pathToFileURL(join(audio, 'generate-sfx.mjs')).href);
  return () => module.assertPublishedCue('mining.hit', plan.events['mining.hit'],
    manifest.events['mining.hit'], generationLog);
}

test('accepts a published derivative with matching local files and provenance', async () => {
  const validate = await fixture('valid');
  await assert.doesNotReject(validate());
});

test('accepts derivatives of independent later takes only with their own exact source provenance', async () => {
  const secondSource = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(125, 3)]);
  const validate = await fixture('later-take-derived', ({ generationLog, processingLog, files }) => {
    files['mining-hit-second-take.mp3'] = secondSource;
    generationLog.generations.push({ id: 'mining.hit', filename: 'mining-hit-second-take.mp3', sha256: hash(secondSource) });
    processingLog.derivations[0].sourceFilename = 'mining-hit-second-take.mp3';
    processingLog.derivations[0].sourceSha256 = hash(secondSource);
  });
  await assert.doesNotReject(validate());
  const wrongCue = await fixture('later-take-wrong-cue', ({ generationLog, processingLog, files }) => {
    files['mining-hit-second-take.mp3'] = secondSource;
    generationLog.generations.push({ id: 'woodcutting.hit', filename: 'mining-hit-second-take.mp3', sha256: hash(secondSource) });
    processingLog.derivations[0].sourceFilename = 'mining-hit-second-take.mp3';
    processingLog.derivations[0].sourceSha256 = hash(secondSource);
  });
  await assert.rejects(wrongCue(), /Derived SFX source differs/);
});

test('verifies the generation hash for a directly published MP3', async () => {
  const valid = await fixture('direct-valid', ({ manifest }) => {
    manifest.events['mining.hit'].variants[0].src = `/assets/audio/sfx/${sourceFilename}`;
  });
  await assert.doesNotReject(valid());
  const changed = await fixture('direct-changed', ({ manifest, files }) => {
    manifest.events['mining.hit'].variants[0].src = `/assets/audio/sfx/${sourceFilename}`;
    files[sourceFilename] = derived;
  });
  await assert.rejects(changed(), /Published SFX source differs/);
});

test('rejects an unknown manifest source even when another variant is valid', async () => {
  const validate = await fixture('unknown', ({ manifest, files }) => {
    manifest.events['mining.hit'].variants.push({ src: '/assets/audio/sfx/unknown.mp3', gain: 1 });
    files['unknown.mp3'] = derived;
  });
  await assert.rejects(validate(), /Manifest source differs/);
});

test('rejects a path outside the local SFX filenames', async () => {
  const validate = await fixture('unsafe-path', ({ manifest }) => {
    manifest.events['mining.hit'].variants[0].src = '/assets/audio/sfx/../outside.mp3';
  });
  await assert.rejects(validate(), /Unsafe manifest source/);
});

test('rejects changed derivative bytes and missing derivative files', async () => {
  const changed = await fixture('changed-derivative', ({ files }) => { files[derivedFilename] = source; });
  await assert.rejects(changed(), /Invalid derived SFX/);
  const missing = await fixture('missing-derivative', ({ files }) => { delete files[derivedFilename]; });
  await assert.rejects(missing(), /Missing or unsafe SFX asset/);
});

test('rejects a derivative with no matching source generation record', async () => {
  const validate = await fixture('unlinked-source', ({ generationLog }) => { generationLog.generations = []; });
  await assert.rejects(validate(), /Derived SFX source differs/);
});

test('rejects a source SHA that differs from its generation record', async () => {
  const validate = await fixture('source-sha', ({ processingLog }) => {
    processingLog.derivations[0].sourceSha256 = hash(derived);
  });
  await assert.rejects(validate(), /Derived SFX source differs/);
});

test('rejects changed source bytes even with a matching generation record', async () => {
  const validate = await fixture('changed-source', ({ files }) => { files[sourceFilename] = derived; });
  await assert.rejects(validate(), /Derived SFX source differs/);
});
