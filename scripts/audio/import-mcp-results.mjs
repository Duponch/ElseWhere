#!/usr/bin/env node
// Import one previously generated MCP result. Signed URLs stay in ignored tmp data.
import { readFile, writeFile, rename, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectMp3 } from './inspect-mp3.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const idIndex = process.argv.indexOf('--id');
if (idIndex < 0 || !process.argv[idIndex + 1]) {
  throw new Error('Usage: node scripts/audio/import-mcp-results.mjs --id <cue>');
}
const id = process.argv[idIndex + 1];
const takeIndex=process.argv.indexOf('--take'),take=takeIndex<0?1:Number(process.argv[takeIndex+1]);
if(!Number.isInteger(take)||take<1||take>9)throw new Error('Invalid take number');
const resultsIndex=process.argv.indexOf('--results'),results=resultsIndex<0?'pending-work-sfx-urls.json':process.argv[resultsIndex+1];
if(!/^[a-z0-9-]+\.json$/.test(results??''))throw new Error('Invalid results filename');
const plan = JSON.parse(await readFile(resolve(here, 'sfx-plan.json'), 'utf8'));
const item = plan.events[id];
if (!item) throw new Error(`Unknown cue ID: ${id}`);
const inputPath = resolve(repo, 'tmp/host-cache/audio',results);
const parsed = JSON.parse(await readFile(inputPath, 'utf8'));
const entries = Array.isArray(parsed) ? parsed : parsed.entries;
if (!Array.isArray(entries)) throw new Error('Invalid MCP result file');
const entry = entries.find((candidate) => candidate.id === id&&(candidate.take??1)===take);
if (!entry || !/^[A-Za-z0-9]{12,32}$/.test(entry.generationId ?? '')) {
  throw new Error(`Missing result metadata for ${id}`);
}
const signedUrl = new URL(entry.contentUrl);
const signedGoogle=signedUrl.hostname==='storage.googleapis.com'&&signedUrl.pathname.endsWith('/content.mp3')&&signedUrl.searchParams.has('X-Goog-Signature');
const signedEleven=signedUrl.hostname==='elevenlabsusercontent.com'&&signedUrl.pathname.endsWith('.mp3')&&signedUrl.searchParams.has('Signature')&&signedUrl.searchParams.has('Expires');
if (signedUrl.protocol !== 'https:' || (!signedGoogle&&!signedEleven)) {
  throw new Error(`Invalid signed URL metadata for ${id}`);
}
const filename=take===1?item.filename:item.filename.replace(/-take-1\.mp3$/,`-take-${take}.mp3`);
if(take!==1&&filename===item.filename)throw new Error('No numbered takes for this cue');
const dest = resolve(repo, 'public/assets/audio/sfx',filename);
if (await stat(dest).catch(() => null)) throw new Error(`${item.filename} already exists`);
let response;
try {
  response = await fetch(signedUrl, { signal: AbortSignal.timeout(120_000) });
} catch {
  throw new Error(`Download transport failed for ${id}`);
}
if (!response.ok) throw new Error(`Download HTTP ${response.status} for ${id}`);
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length < 128 || bytes.length > 8_000_000) throw new Error(`Unexpected MP3 size for ${id}`);
const info = inspectMp3(bytes);
if (info.sampleRate !== 44100 || info.bitrateKbps.length !== 1 || info.bitrateKbps[0] !== 128) {
  throw new Error(`Unexpected MP3 encoding for ${id}`);
}
const temp = resolve(repo, 'tmp/host-cache/audio', `${filename}.download-${process.pid}`);
await writeFile(temp, bytes, { flag: 'wx' });
await rename(temp, dest);
console.log(`${id}: ${bytes.length} bytes, SHA-256 ${info.sha256}`);
