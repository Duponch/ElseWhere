/* sounds-review.html: every sound and music title of the game, playable at its
 * game level, with a manual gain offset per sound, per take and per title.
 * « Enregistrer » writes public/assets/audio/gain-offsets.json through the dev
 * server (scripts/vite-dev-audio-gain-offsets.ts) or downloads it elsewhere;
 * the game applies the file at load. No World is loaded here. */
import { parseAudioManifest, SFX_MIX_GAIN, type AudioManifest } from '../audio/AudioDirector';
import { MUSIC_TRACKS, musicLevel } from '../audio/MusicDirector';
import {
  buildSoundCatalogue, calibrationIndex, MUSIC_MOOD_LABELS, type LevelMeasure, type MusicEntry, type SoundEntry, type SoundTake,
} from '../audio/sound-catalogue';
import {
  applyManifestGainOffsets, clampOffsetDb, countGainOffsets, emptyGainOffsets, GAIN_OFFSET_MAX_DB, GAIN_OFFSET_MIN_DB,
  GAIN_OFFSETS_ENDPOINT, GAIN_OFFSETS_ENDPOINT_HEADER, GAIN_OFFSETS_FILE, GAIN_OFFSETS_URL, gainToDb, musicTrackGain,
  parseGainOffsets, serializeGainOffsets, type GainOffsets,
} from '../audio/gain-offsets';
import pcm20261122 from '../../scripts/audio/pcm-balance-20261122.json';
import pcmV175 from '../../scripts/audio/pcm-balance-v175.json';
import pcmV196 from '../../scripts/audio/pcm-balance-v196.json';
import processing from '../../scripts/audio/processing-log.json';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector(selector) as T;
function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
const decimal = (value: number, digits: number): string => value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signedDb = (db: number): string => db === 0 ? '0 dB' : `${db > 0 ? '+' : '−'}${decimal(Math.abs(db), 1)} dB`;
const dbfs = (value: number): string => `${value < 0 ? '−' : ''}${decimal(Math.abs(value), 1)}`;
function levelText(measure: LevelMeasure | undefined, gain: number): string {
  if (!measure) return 'niveau inconnu (jouer pour mesurer)';
  const parts: string[] = [];
  if (measure.rmsDbfs !== undefined) parts.push(`RMS ${dbfs(measure.rmsDbfs)} dBFS`);
  if (measure.peakDbfs !== undefined) parts.push(`crête ${dbfs(measure.peakDbfs)}`);
  if (measure.lufs !== undefined) parts.push(`${dbfs(measure.lufs)} LUFS`);
  if (measure.rmsDbfs !== undefined && gain > 0) parts.push(`avec son gain ≈ ${dbfs(measure.rmsDbfs + gainToDb(gain))} dBFS`);
  return `${parts.join(' · ')} (${measure.source})`;
}

const statusLine = $('#status'), list = $('#list');
let manifest: AudioManifest;
try {
  const response = await fetch('/assets/audio/manifest.json', { cache: 'no-store' });
  manifest = parseAudioManifest(await response.json());
} catch (error) {
  statusLine.textContent = `Le manifeste audio n’a pas pu être lu : ${error instanceof Error ? error.message : String(error)}`;
  throw error;
}
const measures = calibrationIndex({ pcm20261122, pcmV175, pcmV196, processing });
const catalogue = buildSoundCatalogue(manifest, MUSIC_TRACKS, measures);

/** Working offsets (what the sliders show) and the last saved text. */
const offsets: GainOffsets = emptyGainOffsets();
let savedText = serializeGainOffsets(offsets);
try {
  const response = await fetch(GAIN_OFFSETS_URL, { cache: 'no-store' });
  if (response.ok) Object.assign(offsets, parseGainOffsets(await response.json()));
  savedText = serializeGainOffsets(offsets);
} catch { /* No file yet: every sound at 0 dB. */ }
let applied = applyManifestGainOffsets(manifest, offsets);

const dirty = (): boolean => serializeGainOffsets(offsets) !== savedText;
function setOffset(section: keyof Omit<GainOffsets, 'version'>, key: string, db: number): void {
  const value = clampOffsetDb(db);
  if (value === 0) delete offsets[section][key]; else offsets[section][key] = value;
  applied = applyManifestGainOffsets(manifest, offsets);
  updateStatus();
}
function updateStatus(message?: string): void {
  const count = countGainOffsets(offsets);
  statusLine.textContent = message ?? (dirty()
    ? `Réglages modifiés, non enregistrés (${count} réglage${count > 1 ? 's' : ''}).`
    : count ? `${count} réglage${count > 1 ? 's' : ''} enregistré${count > 1 ? 's' : ''}, appliqué${count > 1 ? 's' : ''} par le jeu au chargement.` : 'Aucun réglage : chaque son à son niveau d’origine.');
  ($('#save') as HTMLButtonElement).disabled = !dirty();
}

/* ---- Playback at the game level ---------------------------------------- */
const sfxVolume = $<HTMLInputElement>('#volume'), musicVolume = $<HTMLInputElement>('#music-volume');
let context: AudioContext | null = null, mix: GainNode | null = null;
const buffers = new Map<string, Promise<AudioBuffer>>();
const measuredHere = new Map<string, LevelMeasure>();
let current: { kind: string; src: string; source: AudioBufferSourceNode; gain: GainNode } | null = null;
let sequence = 0;

/** The game's voice gain for a take (AudioDirector: one-shot and interface
 * voices `min(8, event × take)`, loops `min(2, event) × take`), without the
 * small random variation of each play. */
function voiceGain(kind: string, src: string): number {
  const event = applied.events[kind];
  const variant = event?.variants.find(candidate => candidate.src === src);
  if (!event || !variant) return 0;
  return event.loop ? Math.min(2, event.gain) * variant.gain : Math.min(8, event.gain * variant.gain);
}
function mixLevel(): number { return SFX_MIX_GAIN * Number(sfxVolume.value); }

function measureBuffer(buffer: AudioBuffer): LevelMeasure {
  // Peak and RMS of the 10 ms windows above −50 dBFS, as the calibration scripts.
  const span = Math.max(1, Math.round(buffer.sampleRate / 100)), floor = 10 ** (-50 / 20);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  let peak = 0, activeSum = 0, activeCount = 0;
  for (let start = 0; start < buffer.length; start += span) {
    const end = Math.min(buffer.length, start + span);
    let sum = 0;
    for (const data of channels) for (let i = start; i < end; i++) { const sample = data[i]!; sum += sample * sample; if (Math.abs(sample) > peak) peak = Math.abs(sample); }
    const count = (end - start) * channels.length;
    if (Math.sqrt(sum / count) > floor) { activeSum += sum; activeCount += count; }
  }
  return { rmsDbfs: activeCount ? gainToDb(Math.sqrt(activeSum / activeCount)) : undefined, peakDbfs: peak > 0 ? gainToDb(peak) : undefined, source: 'mesuré ici' };
}

function audio(): { context: AudioContext; mix: GainNode } {
  if (!context || !mix) {
    context = new AudioContext();
    mix = context.createGain();
    mix.connect(context.destination);
  }
  mix.gain.value = mixLevel();
  return { context, mix };
}
function decode(src: string): Promise<AudioBuffer> {
  let buffer = buffers.get(src);
  if (!buffer) {
    const { context } = audio();
    buffer = fetch(src).then(response => response.arrayBuffer()).then(data => context.decodeAudioData(data)).then(decoded => {
      measuredHere.set(src, measureBuffer(decoded));
      refreshers.get(src)?.();
      return decoded;
    });
    buffer.catch(() => buffers.delete(src));
    buffers.set(src, buffer);
  }
  return buffer;
}
function stopSound(): void {
  if (!current) return;
  try { current.source.stop(); } catch { /* Ended already. */ }
  current = null;
}
async function playTake(kind: string, src: string): Promise<void> {
  const { context, mix } = audio();
  await context.resume();
  const mine = ++sequence;
  const buffer = await decode(src);
  if (mine !== sequence) return; // A newer play request won.
  stopSound();
  const source = context.createBufferSource(), gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = voiceGain(kind, src);
  source.connect(gain).connect(mix);
  const voice = { kind, src, source, gain };
  current = voice;
  source.start();
  await new Promise<void>(done => { source.onended = () => { if (current === voice) current = null; done(); }; });
}
sfxVolume.addEventListener('input', () => { if (mix) mix.gain.value = mixLevel(); });

const music = new Audio();
music.preload = 'none';
let playingMusic: MusicEntry | null = null;
const musicButtons = new Map<string, HTMLButtonElement>();
function musicVolumeFor(track: MusicEntry): number { return musicLevel(Number(musicVolume.value), track, offsets); }
function stopMusic(): void {
  music.pause();
  const button = playingMusic && musicButtons.get(playingMusic.id);
  if (button) button.textContent = '▶ Écouter';
  playingMusic = null;
}
function toggleMusic(track: MusicEntry): void {
  if (playingMusic?.id === track.id) { stopMusic(); return; }
  stopMusic();
  playingMusic = track;
  music.src = track.src;
  music.volume = musicVolumeFor(track);
  musicButtons.get(track.id)!.textContent = '■ Arrêter';
  void music.play().catch(() => { stopMusic(); updateStatus(`Le titre ${track.id} ne peut pas être lu.`); });
}
music.addEventListener('ended', stopMusic);
musicVolume.addEventListener('input', () => { if (playingMusic) music.volume = musicVolumeFor(playingMusic); });

/* ---- Rendering --------------------------------------------------------- */
/** Refresh functions by take src, event kind and music id. */
const refreshers = new Map<string, () => void>();
const rows: { row: HTMLElement; family: string; fresh: boolean; adjusted: () => boolean; text: string; kind?: string; takes: string[] }[] = [];

function slider(label: string, value: number, onInput: (db: number) => void, onRelease: () => void): { root: HTMLElement; input: HTMLInputElement; output: HTMLOutputElement } {
  const root = element('label', 'adjust'), input = element('input'), output = element('output');
  input.type = 'range'; input.min = String(GAIN_OFFSET_MIN_DB); input.max = String(GAIN_OFFSET_MAX_DB); input.step = '0.5';
  input.value = String(value); input.setAttribute('aria-label', label);
  output.textContent = signedDb(value);
  input.addEventListener('input', () => onInput(Number(input.value)));
  input.addEventListener('change', onRelease);
  root.append(input, output);
  return { root, input, output };
}

function renderSound(entry: SoundEntry): HTMLElement {
  const row = element('div', 'cue' + (entry.fresh ? ' new' : ''));
  const name = element('div', 'name');
  name.append(element('code', '', entry.kind));
  if (entry.fresh) name.append(element('span', 'badge', '22 nov.'));
  if (entry.hint) name.append(element('small', '', entry.hint));
  const meta = element('small', 'meta');
  name.append(meta);
  let lastTake = entry.takes[0]!.src;

  const body = element('div', 'body');
  const eventSlider = slider(`Réglage de ${entry.kind}`, offsets.events[entry.kind] ?? 0, db => {
    setOffset('events', entry.kind, db); refresh();
    if (current?.kind === entry.kind) current.gain.gain.value = voiceGain(entry.kind, current.src);
  }, () => void playTake(entry.kind, lastTake));
  const reset = element('button', '', 'Réinitialiser');
  reset.title = 'Remettre ce son et ses prises à leur niveau d’origine';
  reset.addEventListener('click', () => {
    setOffset('events', entry.kind, 0);
    for (const take of entry.takes) setOffset('variants', take.src, 0);
    refresh(); for (const take of entry.takes) refreshers.get(take.src)?.();
  });
  const adjustRow = element('div', 'adjust-row');
  adjustRow.append(element('span', 'adjust-label', 'Tout le son'), eventSlider.root, reset);
  const takes = element('div', 'takes');
  entry.takes.forEach((take, index) => takes.append(renderTake(entry, take, index, () => { lastTake = take.src; })));
  body.append(adjustRow, takes);
  row.append(name, body);

  function refresh(): void {
    const db = offsets.events[entry.kind] ?? 0, event = applied.events[entry.kind]!;
    eventSlider.input.value = String(db); eventSlider.output.textContent = signedDb(db);
    row.classList.toggle('changed', db !== 0 || entry.takes.some(take => offsets.variants[take.src]));
    meta.textContent = [
      `gain du son ${decimal(entry.gain, 3)}${event.gain !== entry.gain ? ` → ${decimal(event.gain, 3)}` : ''}`,
      `${entry.takes.length} prise${entry.takes.length > 1 ? 's' : ''}`,
      entry.loop ? 'boucle' : '',
      entry.spatial ? `portée ${entry.maxDistance} cases` : 'interface',
    ].filter(Boolean).join(' · ');
    for (const take of entry.takes) refreshers.get(take.src)?.();
  }
  refreshers.set(entry.kind, refresh);
  refresh();
  rows.push({ row, family: entry.family, fresh: entry.fresh, kind: entry.kind, takes: entry.takes.map(take => take.src),
    adjusted: () => !!offsets.events[entry.kind] || entry.takes.some(take => !!offsets.variants[take.src]),
    text: [entry.kind, entry.hint, ...entry.takes.map(take => take.file)].join(' ').toLowerCase() });
  return row;
}

function renderTake(entry: SoundEntry, take: SoundTake, index: number, chosen: () => void): HTMLElement {
  const box = element('div', 'take');
  const play = element('button', 'play', `▶ Prise ${index + 1}`);
  play.title = take.src;
  play.setAttribute('aria-label', `${entry.kind}, prise ${index + 1}`);
  play.dataset.kind = entry.kind; play.dataset.src = take.src;
  play.addEventListener('click', () => { chosen(); void playTake(entry.kind, take.src); });
  const level = element('small', 'level');
  const takeSlider = slider(`Réglage de ${entry.kind}, prise ${index + 1}`, offsets.variants[take.src] ?? 0, db => {
    setOffset('variants', take.src, db); refresh(); refreshers.get(entry.kind)?.();
    if (current?.src === take.src) current.gain.gain.value = voiceGain(entry.kind, take.src);
  }, () => { chosen(); void playTake(entry.kind, take.src); });
  box.append(play, takeSlider.root, level);
  function refresh(): void {
    const db = offsets.variants[take.src] ?? 0;
    takeSlider.input.value = String(db); takeSlider.output.textContent = signedDb(db);
    box.classList.toggle('changed', db !== 0);
    const gain = voiceGain(entry.kind, take.src);
    level.textContent = `gain ${decimal(gain, 3)} · ${levelText(take.measure ?? measuredHere.get(take.src), gain)}`;
  }
  refreshers.set(take.src, refresh);
  refresh();
  return box;
}

function renderMusic(track: MusicEntry): HTMLElement {
  const row = element('div', 'cue music');
  const name = element('div', 'name');
  name.append(element('code', '', track.id), element('small', '', `${MUSIC_MOOD_LABELS[track.mood]} · ${track.file}`));
  const meta = element('small', 'meta');
  name.append(meta);
  const body = element('div', 'body'), adjustRow = element('div', 'adjust-row');
  const play = element('button', 'play', '▶ Écouter');
  musicButtons.set(track.id, play);
  play.addEventListener('click', () => toggleMusic(track));
  const control = slider(`Réglage du titre ${track.id}`, offsets.music[track.id] ?? 0, db => {
    setOffset('music', track.id, db); refresh();
    if (playingMusic?.id === track.id) music.volume = musicVolumeFor(track);
  }, () => { if (playingMusic?.id !== track.id) toggleMusic(track); });
  const reset = element('button', '', 'Réinitialiser');
  reset.addEventListener('click', () => { setOffset('music', track.id, 0); refresh(); if (playingMusic?.id === track.id) music.volume = musicVolumeFor(track); });
  adjustRow.append(play, control.root, reset);
  body.append(adjustRow);
  row.append(name, body);
  function refresh(): void {
    const db = offsets.music[track.id] ?? 0, gain = musicTrackGain(track, offsets);
    control.input.value = String(db); control.output.textContent = signedDb(db);
    row.classList.toggle('changed', db !== 0);
    const ceiling = musicLevel(1, track, offsets) >= 1 ? ' · au plafond du lecteur quand la musique est à 100 %' : '';
    meta.textContent = `gain ${decimal(track.gain, 3)}${gain !== track.gain ? ` → ${decimal(gain, 3)}` : ''} · ${levelText(track.measure, gain)}${ceiling}`;
  }
  refreshers.set(`music:${track.id}`, refresh);
  refresh();
  rows.push({ row, family: 'music', fresh: false, takes: [], adjusted: () => !!offsets.music[track.id], text: `${track.id} ${track.file} ${MUSIC_MOOD_LABELS[track.mood]}`.toLowerCase() });
  return row;
}

const familySelect = $<HTMLSelectElement>('#family');
const sections: { section: HTMLElement; family: string }[] = [];
for (const family of catalogue.families) {
  const section = element('section', 'family');
  const takes = family.entries.reduce((count, entry) => count + entry.takes.length, 0);
  section.append(element('h2', '', `${family.label} `), element('p', 'count', `${family.entries.length} son${family.entries.length > 1 ? 's' : ''}, ${takes} prise${takes > 1 ? 's' : ''}`));
  for (const entry of family.entries) section.append(renderSound(entry));
  list.append(section); sections.push({ section, family: family.id });
  const option = element('option', '', family.label); option.value = family.id; familySelect.append(option);
}
{
  const section = element('section', 'family');
  section.append(element('h2', '', 'Musiques'), element('p', 'count', `${catalogue.music.length} titres, joués par le lecteur de musique du jeu (volume plafonné à 100 %).`));
  for (const track of catalogue.music) section.append(renderMusic(track));
  list.append(section); sections.push({ section, family: 'music' });
  const option = element('option', '', 'Musiques'); option.value = 'music'; familySelect.append(option);
}
$('#summary').textContent = `${catalogue.counts.events} sons (${catalogue.counts.takes} prises, dont ${catalogue.counts.measuredTakes} mesurées au calibrage) et ${catalogue.counts.music} musiques.`;

function filter(): void {
  const query = $<HTMLInputElement>('#search').value.trim().toLowerCase(), family = familySelect.value;
  const onlyNew = $<HTMLInputElement>('#only-new').checked, onlyAdjusted = $<HTMLInputElement>('#only-adjusted').checked;
  for (const item of rows) item.row.classList.toggle('hidden', (family !== 'all' && item.family !== family) || (onlyNew && !item.fresh)
    || (onlyAdjusted && !item.adjusted()) || (query !== '' && !item.text.includes(query)));
  for (const { section } of sections) section.classList.toggle('hidden', !section.querySelector('.cue:not(.hidden)'));
}
for (const id of ['#search', '#family', '#only-new', '#only-adjusted']) $(id).addEventListener(id === '#search' ? 'input' : 'change', filter);
filter();

/* ---- Actions ------------------------------------------------------------ */
let listening = 0;
$('#all').addEventListener('click', async () => {
  const mine = ++listening;
  for (const button of list.querySelectorAll<HTMLButtonElement>('.cue:not(.hidden):not(.music) button.play')) {
    if (mine !== listening) return;
    await playTake(button.dataset.kind!, button.dataset.src!);
    await new Promise(done => setTimeout(done, 250));
  }
});
$('#stop').addEventListener('click', () => { listening++; sequence++; stopSound(); stopMusic(); });

function refreshAll(): void { for (const refresh of refreshers.values()) refresh(); filter(); }
$('#reset-all').addEventListener('click', () => {
  if (!countGainOffsets(offsets) || !confirm('Remettre tous les sons et musiques à leur niveau d’origine ? Il faudra encore enregistrer.')) return;
  for (const section of ['events', 'variants', 'music'] as const) for (const key of Object.keys(offsets[section])) delete offsets[section][key];
  applied = applyManifestGainOffsets(manifest, offsets);
  refreshAll(); updateStatus();
});

function download(text: string): void {
  const link = element('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  link.download = 'gain-offsets.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
$('#download').addEventListener('click', () => download(serializeGainOffsets(offsets)));
$('#save').addEventListener('click', async () => {
  const text = serializeGainOffsets(offsets);
  try {
    const response = await fetch(GAIN_OFFSETS_ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: text });
    if (response.headers.get(GAIN_OFFSETS_ENDPOINT_HEADER)) {
      const answer = await response.json() as { ok: boolean; error?: string };
      if (!answer.ok) { updateStatus(`Enregistrement refusé : ${answer.error ?? response.status}`); return; }
      savedText = text;
      updateStatus(`Enregistré dans ${GAIN_OFFSETS_FILE} : le jeu applique ces réglages à son prochain chargement.`);
      ($('#save') as HTMLButtonElement).disabled = true;
      return;
    }
  } catch { /* No dev server: download below. */ }
  download(text);
  savedText = text;
  updateStatus(`Ce serveur ne peut pas écrire dans le dépôt : gain-offsets.json est téléchargé ; placez-le dans ${GAIN_OFFSETS_FILE.replace('/gain-offsets.json', '/')} pour que le jeu l’applique.`);
  ($('#save') as HTMLButtonElement).disabled = true;
});
addEventListener('beforeunload', event => { if (dirty()) event.preventDefault(); });

updateStatus();
Object.assign(window, { soundsReview: { counts: catalogue.counts, families: catalogue.families.map(family => ({ id: family.id, sounds: family.entries.length })), offsets: () => serializeGainOffsets(offsets) }, soundsReviewReady: true });
