import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import viteConfig from '../vite.config';
import { AudioDirector, parseAudioManifest, type AudioManifest } from '../src/audio/AudioDirector';
import { MusicDirector, MUSIC_TRACKS, musicLevel } from '../src/audio/MusicDirector';
import {
  applyManifestGainOffsets, dbToGain, emptyGainOffsets, GAIN_OFFSET_MAX_DB, GAIN_OFFSET_MIN_DB, GAIN_OFFSETS_ENDPOINT, GAIN_OFFSETS_FILE,
  parseGainOffsets, serializeGainOffsets, validateGainOffsets, type GainOffsets,
} from '../src/audio/gain-offsets';
import { buildSoundCatalogue, calibrationIndex } from '../src/audio/sound-catalogue';
import { buildInputs, DEVELOPER_PAGES, developerPagesForMode } from '../src/ui/developer-pages';
import { devAudioGainOffsets } from '../scripts/vite-dev-audio-gain-offsets';
import { createNativeFrontMenu } from '../src/ui3d/native-front';
import type { FrontMenuOptions } from '../src/ui/front-menu';
import type { NativeControl, NativePage } from '../src/ui3d/native-contract';

/* Developer pages hub (Options → « Développeur ») and the complete sounds page
 * with its gain offsets (docs/development/developer-pages.md,
 * docs/development/audio-coverage-20261122.md « Réglages manuels »). */

const repo = resolve(__dirname, '..');
const json = (path: string): unknown => JSON.parse(readFileSync(resolve(repo, path), 'utf8'));
const rawManifest = json('public/assets/audio/manifest.json') as { events: Record<string, { variants: { src: string }[] }> };
const offsets = (patch: Partial<Omit<GainOffsets, 'version'>>): GainOffsets => ({ ...emptyGainOffsets(), ...patch });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('developer pages hub', () => {
  type BuildConfig = { build: { rolldownOptions: { input: string[] } } };
  const inputs = (mode: string): string[] =>
    (viteConfig as unknown as (env: { mode: string; command: 'build' }) => BuildConfig)({ mode, command: 'build' }).build.rolldownOptions.input;

  it('lists every page of the repository once, and each page exists', () => {
    const ids = DEVELOPER_PAGES.map(page => page.id), files = DEVELOPER_PAGES.map(page => page.file);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(files).size).toBe(files.length);
    for (const page of DEVELOPER_PAGES) {
      expect(existsSync(resolve(repo, page.file)), page.file).toBe(true);
      expect(page.title.length && page.description.length, page.id).toBeTruthy();
    }
    // A new root page must be added to the hub (and so to the build inputs).
    const rootPages = readdirSync(repo).filter(file => file.endsWith('.html') && file !== 'index.html').sort();
    expect([...files].sort()).toEqual(rootPages);
  });

  it('puts every listed page in the dev build inputs, and only the published ones in the Pages build', () => {
    const dev = inputs('development');
    for (const page of DEVELOPER_PAGES) expect(dev, page.file).toContain(page.file);
    expect(dev).toContain('index.html');
    expect(inputs('pages')).toEqual(['index.html', ...DEVELOPER_PAGES.filter(page => page.published).map(page => page.file)]);
    expect(inputs('pages')).not.toContain('navigation.html');
    expect(buildInputs('production')).toEqual(dev);
    expect(developerPagesForMode('pages').every(page => page.published)).toBe(true);
    expect(developerPagesForMode('development')).toBe(DEVELOPER_PAGES);
  });

  function frontFixture(developerPages?: FrontMenuOptions['developerPages']) {
    const open = vi.fn();
    vi.stubGlobal('window', { open });
    const yes = () => true, no = () => false, noop = async () => {};
    let page: NativePage | undefined;
    const options: FrontMenuOptions = { onStart: noop, onLoad: noop, onResume: noop,
      getTexturesEnabled: yes, onTexturesEnabledChange: yes, getGroundGrassEnabled: yes, onGroundGrassEnabledChange: yes,
      getDioramaEnabled: yes, onDioramaEnabledChange: yes, getRoomEnabled: yes, onRoomEnabledChange: yes,
      getLightingSettings: () => ({ sun: 1, moon: 1, ambient: 1 }), onLightingSettingsChange: yes,
      getSoundEnabled: no, onSoundEnabledChange: yes, getSoundVolume: () => .5, onSoundVolumeChange: yes, onTestSound: noop,
      getMusicEnabled: no, onMusicEnabledChange: yes, getMusicVolume: () => .5, onMusicVolumeChange: yes,
      getSaves: () => [], getTestColonies: async () => [], onLoadTest: noop, onImport: noop, developerPages };
    const menu = createNativeFrontMenu(options, next => { page = next ?? undefined; });
    const controls = (): NativeControl[] => [...(page?.rows.flatMap(row => row.controls ?? []) ?? []), ...(page?.actions ?? [])];
    const control = (id: string): NativeControl => { const found = controls().find(value => value.id === id); if (!found) throw Error(`Missing ${id}`); return found; };
    return { menu, open, control, get page() { return page!; } };
  }

  it('shows « Développeur » in the native Options with one row per page, each opened in a new tab', async () => {
    const f = frontFixture(DEVELOPER_PAGES);
    f.menu.showOptions!();
    expect(f.page.rows.filter(row => row.region === 'catalogue').map(row => row.controls?.[0]?.label)).toContain('Développeur');
    await f.control('option-section-developer').onActivate();
    expect(f.page.rows.find(row => row.id === 'option-section-title')?.label).toBe('Développeur');
    for (const page of DEVELOPER_PAGES) expect(f.page.rows.find(row => row.id === `developer-page-${page.id}`)?.label).toBe(page.title);
    await f.control('developer-open-sounds').onActivate();
    expect(f.open).toHaveBeenCalledWith('/sounds-review.html', '_blank', 'noopener');
    // The published build lists only its pages; without a list the section is absent.
    const published = frontFixture(developerPagesForMode('pages'));
    published.menu.showOptions!();
    await published.control('option-section-developer').onActivate();
    expect(published.page.rows.some(row => row.id === 'developer-page-navigation')).toBe(false);
    const none = frontFixture();
    none.menu.showOptions!();
    expect(none.page.rows.some(row => row.id === 'option-section-developer')).toBe(false);
  });
});

describe('sounds page data', () => {
  const measures = calibrationIndex({
    pcm20261122: json('scripts/audio/pcm-balance-20261122.json'), pcmV175: json('scripts/audio/pcm-balance-v175.json'),
    pcmV196: json('scripts/audio/pcm-balance-v196.json'), processing: json('scripts/audio/processing-log.json'),
  });
  const parsed = parseAudioManifest(rawManifest);
  const catalogue = buildSoundCatalogue(parsed, MUSIC_TRACKS, measures);

  it('covers every sound event of the manifest and every take, grouped by family', () => {
    const entries = catalogue.families.flatMap(family => family.entries);
    expect(entries.map(entry => entry.kind).sort()).toEqual(Object.keys(parsed.events).sort());
    for (const kind of Object.keys(rawManifest.events)) expect(entries.some(entry => entry.kind === kind), kind).toBe(true);
    const takes = Object.values(parsed.events).reduce((count, event) => count + event.variants.length, 0);
    expect(catalogue.counts).toMatchObject({ events: Object.keys(parsed.events).length, takes });
    expect(entries.reduce((count, entry) => count + entry.takes.length, 0)).toBe(takes);
    // Every manifest file (86 events, 235 takes today) is reachable, classified and described.
    expect(Object.keys(rawManifest.events).length).toBeGreaterThanOrEqual(86);
    expect(catalogue.families.some(family => family.id === 'other')).toBe(false);
    for (const entry of entries) expect(entry.hint, entry.kind).not.toBe('');
    for (const entry of entries) for (const take of entry.takes) expect(existsSync(resolve(repo, 'public', take.src.slice(1))), take.src).toBe(true);
    expect(entries.filter(entry => entry.fresh)).toHaveLength(32);
  });

  it('lists every music title with its gain, and the calibrated loudness where it is known', () => {
    expect(catalogue.music.map(track => track.id)).toEqual(MUSIC_TRACKS.map(track => track.id));
    expect(catalogue.music.map(track => track.file).sort()).toEqual(readdirSync(resolve(repo, 'public/assets/audio/music')).filter(file => file.endsWith('.mp3')).sort());
    for (const track of catalogue.music) expect(track.gain).toBe(MUSIC_TRACKS.find(value => value.id === track.id)!.gain);
    expect(catalogue.counts.measuredTakes).toBeGreaterThanOrEqual(142);
    expect(catalogue.music.filter(track => track.measure?.rmsDbfs !== undefined)).toHaveLength(7);
    const take = catalogue.families.flatMap(family => family.entries).find(entry => entry.kind === 'ui.tab-open')!.takes[0]!;
    expect(take.measure).toMatchObject({ source: 'calibrage du 22 novembre' });
    expect(take.measure!.lufs).toBeTypeOf('number');
  });

  it('runs the page script on the game modules', () => {
    const html = readFileSync(resolve(repo, 'sounds-review.html'), 'utf8'), script = readFileSync(resolve(repo, 'src/dev/sounds-review.ts'), 'utf8');
    expect(html).toContain('<script type="module" src="/src/dev/sounds-review.ts"></script>');
    for (const name of ['parseAudioManifest', 'MUSIC_TRACKS', 'buildSoundCatalogue', 'applyManifestGainOffsets', 'GAIN_OFFSETS_ENDPOINT'])
      expect(script, name).toContain(name);
  });
});

describe('gain offsets', () => {
  it('bounds and rounds the offsets read by the game, and drops malformed entries', () => {
    const read = parseGainOffsets({ version: 1,
      events: { 'mining.hit': 40, 'ui.click': -99, 'ui.select': 2.345, 'bad key!': 3, 'ui.panel': 'loud', 'ui.reject': 0 },
      variants: { '/assets/audio/sfx/a.mp3': -6, 'https://example.com/a.mp3': 3, '/assets/audio/../x.mp3': 1 },
      music: { aube: 3, 'Bad Id': 2 } });
    expect(read.events).toEqual({ 'mining.hit': GAIN_OFFSET_MAX_DB, 'ui.click': GAIN_OFFSET_MIN_DB, 'ui.select': 2.3 });
    expect(read.variants).toEqual({ '/assets/audio/sfx/a.mp3': -6 });
    expect(read.music).toEqual({ aube: 3 });
    for (const broken of [null, [], { version: 2, events: { 'ui.click': 3 } }, 'text']) expect(parseGainOffsets(broken)).toEqual(emptyGainOffsets());
  });

  it('refuses before writing anything outside the format or the bounds', () => {
    expect(() => validateGainOffsets({ version: 1, events: { 'ui.click': 12.5 } })).toThrow(/hors limites/);
    expect(() => validateGainOffsets({ version: 1, events: { 'ui.click': -31 } })).toThrow(/hors limites/);
    expect(() => validateGainOffsets({ version: 1, variants: { '/etc/passwd': 1 } })).toThrow(/Clé refusée/);
    expect(() => validateGainOffsets({ version: 1, extra: {} })).toThrow(/Champ inconnu/);
    expect(() => validateGainOffsets({ version: 1, music: [] })).toThrow(/objet/);
    const valid = validateGainOffsets({ version: 1, events: { 'ui.select': 3, 'ui.click': 0 }, music: { aube: -2.5 } });
    expect(serializeGainOffsets(valid)).toBe('{\n  "version": 1,\n  "events": {\n    "ui.select": 3\n  },\n  "variants": {},\n  "music": {\n    "aube": -2.5\n  }\n}\n');
  });

  it('keeps the repository file valid and every key pointing at a real sound', () => {
    const text = readFileSync(resolve(repo, GAIN_OFFSETS_FILE), 'utf8');
    const file = validateGainOffsets(JSON.parse(text));
    expect(serializeGainOffsets(file)).toBe(text);
    const parsed = parseAudioManifest(rawManifest);
    for (const kind of Object.keys(file.events)) expect(parsed.events[kind], kind).toBeDefined();
    const sources = new Set(Object.values(parsed.events).flatMap(event => event.variants.map(variant => variant.src)));
    for (const src of Object.keys(file.variants)) expect(sources.has(src), src).toBe(true);
    for (const id of Object.keys(file.music)) expect(MUSIC_TRACKS.some(track => track.id === id), id).toBe(true);
  });

  it('multiplies event and take gains under the manifest ceilings, without touching the parsed manifest', () => {
    const manifest = parseAudioManifest({ version: 1, events: {
      'mining.hit': { gain: .5, variants: [{ src: '/assets/audio/sfx/a.mp3', gain: 1 }, { src: '/assets/audio/sfx/b.mp3', gain: 2 }] },
      'weather.rain': { gain: 1.5, loop: true, variants: [{ src: '/assets/audio/sfx/rain.mp3', gain: 1 }] },
    } });
    expect(applyManifestGainOffsets(manifest, emptyGainOffsets())).toBe(manifest);
    const applied = applyManifestGainOffsets(manifest, offsets({ events: { 'mining.hit': 6, 'weather.rain': 12 }, variants: { '/assets/audio/sfx/b.mp3': -6 } }));
    expect(applied.events['mining.hit']!.gain).toBeCloseTo(.5 * dbToGain(6), 12);
    expect(applied.events['mining.hit']!.variants.map(variant => variant.gain)).toEqual([1, 2 * dbToGain(-6)]);
    expect(applied.events['weather.rain']!.gain).toBe(2); // A loop stays under 2.
    expect(manifest.events['mining.hit']!.gain).toBe(.5);
  });

  it('applies the offsets in the game mixer, given before or after the manifest is loaded', async () => {
    class Param { value = 0; setValueAtTime(v: number): void { this.value = v; } setTargetAtTime(v: number): void { this.value = v; } cancelScheduledValues(): void {} }
    class Node { connections: Node[] = []; connect(node: Node): Node { this.connections.push(node); return node; } disconnect(): void {} }
    class Source extends Node { buffer: unknown; playbackRate = { value: 1 }; onended: (() => void) | null = null; start(): void {} stop(): void {} }
    class FakeContext {
      static latest: FakeContext;
      state = 'running'; currentTime = 0; destination = new Node(); sources: Source[] = [];
      listener = { positionX: new Param(), positionY: new Param(), positionZ: new Param(), forwardX: new Param(), forwardY: new Param(), forwardZ: new Param() };
      constructor() { FakeContext.latest = this; }
      createGain() { return Object.assign(new Node(), { gain: new Param() }); }
      createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
      createPanner() { return Object.assign(new Node(), { positionX: new Param(), positionY: new Param(), positionZ: new Param() }); }
      decodeAudioData(): Promise<object> { return Promise.resolve({ duration: .5 }); }
      resume(): Promise<void> { return Promise.resolve(); }
      close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
    }
    const small: AudioManifest = { version: 1, events: { 'ui.click': { gain: .5, loop: false, spatial: false, maxDistance: 24, variants: [{ src: '/assets/audio/sfx/click.mp3', gain: 1.2 }] } } };
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.endsWith('manifest.json') ? new Response(JSON.stringify(small)) : new Response(new Uint8Array([1]))));
    const voiceGain = async (setup: (audio: AudioDirector) => void, late?: (audio: AudioDirector) => void): Promise<number> => {
      const audio = new AudioDirector();
      setup(audio);
      await audio.unlock();
      for (let i = 0; i < 20 && audio.loadedCount < 1; i++) await new Promise(done => setTimeout(done, 0));
      late?.(audio);
      audio.playInterface('ui.click');
      const source = FakeContext.latest.sources.at(-1)!;
      audio.dispose();
      return (source.connections[0] as unknown as { gain: Param }).gain.value;
    };
    const plain = await voiceGain(() => undefined);
    const atLoad = await voiceGain(audio => audio.setGainOffsets(offsets({ events: { 'ui.click': 6 }, variants: { '/assets/audio/sfx/click.mp3': -3 } })));
    const afterLoad = await voiceGain(() => undefined, audio => audio.setGainOffsets(offsets({ events: { 'ui.click': -12 } })));
    expect(plain).toBeGreaterThan(0);
    expect(atLoad / plain).toBeCloseTo(dbToGain(3), 9);
    expect(afterLoad / plain).toBeCloseTo(dbToGain(-12), 9);
    // A huge offset never passes the voice ceiling of the mixer.
    const huge = await voiceGain(audio => audio.setGainOffsets(parseGainOffsets({ version: 1, events: { 'ui.click': 400 }, variants: { '/assets/audio/sfx/click.mp3': 400 } })));
    expect(huge).toBeLessThanOrEqual(8);
  });

  it('applies a music offset to the title playing, the element volume staying at most 1', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'performance'] });
    class FakeAudio { src = ''; preload = ''; loop = false; volume = 1; paused = true; onended: (() => void) | null = null; onerror: (() => void) | null = null;
      play = vi.fn(() => { this.paused = false; return Promise.resolve(); }); pause = vi.fn(() => { this.paused = true; });
      removeAttribute = vi.fn((name: string) => { if (name === 'src') this.src = ''; }); load = vi.fn(); }
    const players: FakeAudio[] = [];
    const music = new MusicDirector(MUSIC_TRACKS, () => { const player = new FakeAudio(); players.push(player); return player as unknown as HTMLAudioElement; });
    music.setVolume(.5);
    music.unlock();
    await Promise.resolve();
    vi.advanceTimersByTime(4000); // End of the fade in.
    const track = MUSIC_TRACKS.find(value => value.id === music.diagnostics.track)!, player = players.find(value => value.src === track.src)!;
    expect(player.volume).toBe(.5 * .36 * track.gain); // Unchanged without offsets.
    music.setGainOffsets(offsets({ music: { [track.id]: 6 } }));
    expect(player.volume).toBeCloseTo(.5 * .36 * track.gain * dbToGain(6), 12);
    music.setGainOffsets(offsets({ music: { [track.id]: GAIN_OFFSET_MAX_DB } }));
    music.setVolume(1);
    expect(player.volume).toBe(musicLevel(1, track, offsets({ music: { [track.id]: GAIN_OFFSET_MAX_DB } })));
    expect(player.volume).toBeLessThanOrEqual(1);
    music.dispose();
    for (const value of MUSIC_TRACKS) expect(musicLevel(1, value, offsets({ music: { [value.id]: GAIN_OFFSET_MAX_DB } }))).toBeLessThanOrEqual(1);
  });
});

describe('dev server endpoint of « Enregistrer »', () => {
  type Middleware = (request: EventEmitter & { method: string; headers: Record<string, string>; destroy(): void },
    response: { statusCode: number; headers: Record<string, string>; body: string; setHeader(name: string, value: string): void; end(body: string): void }) => void;
  function endpoint(root: string): Middleware {
    let handler: Middleware | undefined;
    const plugin = devAudioGainOffsets() as unknown as { apply: string; configureServer(server: unknown): void };
    expect(plugin.apply).toBe('serve');
    plugin.configureServer({ config: { root }, middlewares: { use(path: string, fn: Middleware) { expect(path).toBe(GAIN_OFFSETS_ENDPOINT); handler = fn; } } });
    return handler!;
  }
  async function post(handler: Middleware, body: string, headers: Record<string, string>): Promise<{ status: number; answer: { ok: boolean; error?: string } }> {
    const request = Object.assign(new EventEmitter(), { method: 'POST', headers, destroy() {} });
    let done!: () => void;
    const ended = new Promise<void>(resolveEnd => { done = resolveEnd; });
    const response = { statusCode: 0, headers: {} as Record<string, string>, body: '', setHeader(name: string, value: string) { this.headers[name] = value; }, end(text: string) { this.body = text; done(); } };
    handler(request, response);
    request.emit('data', Buffer.from(body)); request.emit('end');
    await ended;
    return { status: response.statusCode, answer: JSON.parse(response.body) };
  }

  it('writes only the gain offsets file, after the strict reader, for a request of the same origin', async () => {
    const root = mkdtempSync(join(tmpdir(), 'elsewhere-gain-offsets-'));
    try {
      mkdirSync(join(root, 'public/assets/audio'), { recursive: true });
      const handler = endpoint(root), same = { origin: 'http://127.0.0.1:5199', host: '127.0.0.1:5199', 'content-type': 'application/json', 'sec-fetch-site': 'same-origin' };
      const body = serializeGainOffsets(offsets({ events: { 'ui.select': 3 } }));
      expect((await post(handler, body, { ...same, origin: 'https://example.com', 'sec-fetch-site': 'cross-site' })).status).toBe(403);
      expect((await post(handler, body, { ...same, 'content-type': 'text/plain' })).status).toBe(415);
      const refused = await post(handler, JSON.stringify({ version: 1, events: { 'ui.select': 50 } }), same);
      expect(refused.status).toBe(400);
      expect(existsSync(join(root, GAIN_OFFSETS_FILE))).toBe(false);
      const saved = await post(handler, body, same);
      expect(saved).toMatchObject({ status: 200, answer: { ok: true } });
      expect(readFileSync(join(root, GAIN_OFFSETS_FILE), 'utf8')).toBe(body);
      expect(readdirSync(join(root, 'public/assets/audio'))).toEqual(['gain-offsets.json']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
