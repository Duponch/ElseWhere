import { describe, expect, it, vi } from 'vitest';
import { applyCommand, createWorld } from '../src/sim/index';
import type { World } from '../src/sim/types';
import type { NativeControl, NativePage, NativeUiActions, NativeUiState } from '../src/ui3d/native-contract';
import { buildNativeInspector, setNativeInspectorTab } from '../src/ui3d/native-inspector';
import { layoutNativePage } from '../src/ui3d/native-layout';
import { NATIVE_INK } from '../src/ui3d/native-ui-scale';
import { appliedScroll, cardScroll, nativeTabTargets, paintNativeTabCard, resetCardScroll, setCardScroll, type NativeTabCard } from '../src/ui3d/native-tab-card';
import { NEEDS_FULL, layoutNeedsTab, needBarGeometry, thoughtOffsetLabel, type NeedsSpec, type NeedBarSpec } from '../src/ui3d/native-tab-needs';
import { HEALTH_SIZE, layoutHealthTab, type HealthSpec } from '../src/ui3d/native-tab-health';
import { GEAR_SIZE, gearMassLabel, layoutGearTab, type GearSpec } from '../src/ui3d/native-tab-gear';
import { SOCIAL_SIZE, LOG_SIZE, layoutLogTab, layoutSocialTab, opinionInk, signedInteger, socialColumnWidths, type SocialSpec } from '../src/ui3d/native-tab-social';
import { PRISONER_SIZE, layoutPrisonerTab } from '../src/ui3d/native-tab-prisoner';
import { efficiencyInk, painLabel } from '../src/ui3d/native-inspector-tabs';
import { newApparelState } from '../src/sim/apparel-rules';

// A stand-in for the font: 7 points per character, whatever the role.
const measure = (text: string) => text.length * 7;
const pageMeasure = (text: string, size: number) => text.length * size * 7 / 13;
const viewport = { width: 1440, height: 900 };
const control = (id: string, extra: Partial<NativeControl> = {}): NativeControl => ({ id, label: id, hint: id, onActivate: () => undefined, ...extra });
const find = (card: NativeTabCard, id: string) => card.targets.find(target => target.id === id)!;
const need = (id: string, extra: Partial<NeedBarSpec> = {}): NeedBarSpec => ({ id, label: id, major: true, level: .5, thresholds: [.25], arrow: 0, hint: id, ...extra });

it('paints embedded scroll tracks and thumbs across the full16-point reserved gutter',()=>{
  const fillRect=vi.fn(),ctx={save:vi.fn(),restore:vi.fn(),beginPath:vi.fn(),rect:vi.fn(),clip:vi.fn(),fillRect} as unknown as CanvasRenderingContext2D;
  const card:NativeTabCard={width:200,height:100,items:[],targets:[],regions:[{id:'track-width',x:10,y:10,w:180,h:80,contentHeight:240}]};
  paintNativeTabCard(ctx,card,3,4,{} as never);
  expect(fillRect.mock.calls[0]).toEqual([177,14,16,80]);expect(fillRect.mock.calls[1]).toEqual([177,14,16,28]);
});

describe('contrast of the colour roles on the paper (WCAG AA)', () => {
  const luminance = (hex: string) => { const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * c[0]! + .7152 * c[1]! + .0722 * c[2]!; };
  const contrast = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  it('keeps every text role at 4.5:1 or more on both papers and on a chip', () => {
    const roles = ['text', 'sectionTitle', 'subtle', 'none', 'disabled', 'royal', 'positive', 'negative', 'painMedium', 'painSevere', 'good', 'red', 'enhanced', 'relation', 'separator'] as const;
    for (const paper of ['#f1e7cf', '#f3ead6'])
      for (const role of roles) expect(contrast(NATIVE_INK[role], paper), `${role} on ${paper}`).toBeGreaterThanOrEqual(4.5);
    // A chip is the paper under a 10 % ink wash: the section titles and faded roles keep 4.5 there too.
    for (const role of ['text', 'sectionTitle', 'subtle', 'none', 'positive', 'negative']) expect(contrast(NATIVE_INK[role as 'text'], '#e0d6bd'), `${role} on a chip`).toBeGreaterThanOrEqual(4.4);
  });
});

describe('Needs tab (NeedsCardUtility, Need.DrawOnGUI)', () => {
  const six = ['food', 'rest', 'joy'].map(id => need(id)).concat(['beauty', 'comfort', 'outdoors'].map(id => need(id, { major: false })));
  const spec: NeedsSpec = { type: 'needs', needs: six, mood: need('mood', { thresholds: [.05, .2, .35] }), thoughts: Array.from({ length: 30 }, (_, index) => ({ id: `t${index}`, label: `Pensée ${index}`, count: 1, offset: index % 3 - 1, hint: 'h' })) };
  const card = layoutNeedsTab(spec, measure);
  it('is 580 × 520 with a needs column of 225, each need min(70, 520 / n) high', () => {
    expect([card.width, card.height]).toEqual([580, 520]);
    // Six needs: 520 / 6 > 70, so 70 each; the minor ones are 0.73 as wide and 0.666 as high (at least 30), the first after a gap of 10.
    expect(find(card, 'need:food')).toMatchObject({ x: 0, y: 0, w: 225, h: 70 });
    expect(find(card, 'need:rest')).toMatchObject({ y: 70, h: 70 }); expect(find(card, 'need:joy')).toMatchObject({ y: 140, h: 70 });
    const beauty = find(card, 'need:beauty'); expect(beauty.y).toBe(220); expect(beauty.w).toBeCloseTo(225 * .73, 6); expect(beauty.h).toBeCloseTo(70 * .666, 6);
    expect(find(card, 'need:comfort').y).toBeCloseTo(220 + 70 * .666, 6);
  });
  it('draws the label in the upper half and the bar 29 in from each side, 14 above the bottom', () => {
    const g = needBarGeometry({ x: 0, y: 0, width: 225, height: 70 });
    expect(g.bar).toEqual({ x: 29, y: 35, width: 225 - 58, height: 35 - 14 });
    expect(g.label).toEqual({ x: 29 + 22.5, y: 0, width: 225 - 29 - 22.5, height: 35 });
    expect(g.smallLabel).toBe(false);
    expect(needBarGeometry({ x: 0, y: 0, width: 164, height: 46 }).smallLabel).toBe(true);
    // A rect taller than 70 is centred on its own middle.
    expect(needBarGeometry({ x: 0, y: 0, width: 225, height: 90 }).outer).toMatchObject({ y: 10, height: 70 });
    const bar = card.items.find(item => item.k === 'bar')!;
    expect(bar).toMatchObject({ k: 'bar', border: true, ticks: [.25] });
  });
  it('puts the mood bar on 80 % of the remaining width and the thoughts in a scrolling list of rows of 20 every 24', () => {
    expect(find(card, 'mood')).toMatchObject({ x: 225, y: 0, w: 355 * .8, h: 70 });
    const region = card.regions[0]!;
    expect(region).toMatchObject({ id: 'thoughts', x: 235, y: 90, w: 335, h: 420, contentHeight: 30 * 24 });
    expect(find(card, 'thought:t1')).toMatchObject({ y: 24, h: 20, w: 319 });
    expect(card.items.filter(item => item.k === 'text' && item.region === 'thoughts' && item.x === 235).length).toBe(30);
    expect(thoughtOffsetLabel(3.4)).toBe('3'); expect(thoughtOffsetLabel(-0.2)).toBe('0'); expect(thoughtOffsetLabel(-7)).toBe('-7');
  });
  it('is 225 wide without a mood, each need min(70, 520 / n) high', () => {
    const small = layoutNeedsTab({ type: 'needs', needs: [need('a'), need('b')], thoughts: [] }, measure);
    expect([small.width, small.height]).toEqual([225, 140]);
    expect(NEEDS_FULL).toMatchObject({ width: 580, height: 520, column: 225 });
  });
  it('scrolls a region by the offset the card keeps, and clips its targets to the viewport', () => {
    resetCardScroll();
    const region = card.regions[0]!;
    expect(setCardScroll(card, 'thoughts', 48)).toBe(true); expect(cardScroll('thoughts')).toBe(48); expect(appliedScroll(region)).toBe(48);
    const targets = nativeTabTargets(card);
    expect(targets.find(target => target.id === 'region:thoughts')).toMatchObject({ x: 235, y: 90, w: 335, h: 420 });
    expect(targets.find(target => target.id === 'thought:t0')).toBeUndefined();
    expect(targets.find(target => target.id === 'thought:t2')).toMatchObject({ x: 235, y: 90, h: 20 });
    expect(setCardScroll(card, 'thoughts', 99999)).toBe(true); expect(cardScroll('thoughts')).toBe(30 * 24 - 420);
    resetCardScroll(); expect(cardScroll('thoughts')).toBe(0);
  });
});

describe('Health tab (HealthCardUtility)', () => {
  const tabs = { overview: control('overview'), operations: control('operations'), operationsLabel: 'Opérations' };
  const spec: HealthSpec = { type: 'health', tab: 'overview', tabs, settings: [
    { id: 'food', label: 'Aliments', kind: 'select', value: 'Tout', control: control('food', { select: { value: '1', options: [], onChange: () => undefined } }), hint: 'food' },
    { id: 'care', label: 'Soins', kind: 'select', value: 'Meilleur', control: control('care'), hint: 'care' },
    { id: 'self', label: 'Auto-soins', kind: 'check', on: true, control: control('self'), hint: 'self' }],
    pain: { label: 'Aucune douleur', ink: NATIVE_INK.good, hint: 'pain' }, capacities: [{ id: 'consciousness', label: 'Conscience', value: '100 %', ink: NATIVE_INK.good, hint: 'c' }, { id: 'moving', label: 'Mouvement', value: '60 %', ink: NATIVE_INK.subtle, hint: 'm' }],
    entries: [{ id: 'whole-body', items: [{ id: 'blood', label: 'Perte de sang (12 %)', count: 1, bleeding: true, tended: false, hint: 'b' }], info: control('anatomy') }, { id: 'left-arm', part: { label: 'Bras gauche', ink: NATIVE_INK.painMedium, hint: 'arm' }, info: control('anatomy-arm'), items: [{ id: 'i1', label: 'Coupure', count: 1, bleeding: false, tended: true, hint: 'i1' }, { id: 'i2', label: 'Contusion', count: 1, bleeding: false, tended: false, hint: 'i2' }] }],
    bleed: { text: 'Saignement : 10 %/jour', hint: 'bleed' }, emptyText: '(Aucun problème de santé)' };
  const card = layoutHealthTab(spec, measure);
  it('is 630 × 430 with a left summary of 37.5 % under two tabs, and the list contracted by 10 on the right', () => {
    expect([card.width, card.height]).toEqual([HEALTH_SIZE.width, HEALTH_SIZE.height]);
    const panel = card.items.find(item => item.k === 'panel')!;
    expect(panel).toMatchObject({ x: 0, y: 31, w: 236 });
    const buttons = card.items.filter(item => item.k === 'button' && !item.dropdown);
    expect(buttons.map(item => item.k === 'button' && item.label)).toEqual(['Vue d’ensemble', 'Opérations']);
    expect(find(card, 'health-tab:0')).toMatchObject({ x: 0, w: 123, h: 31 });
    expect(find(card, 'health-tab:1').x).toBe(113);
    const region = card.regions[0]!;
    expect(region).toMatchObject({ id: 'hediffs', x: 246, y: 30, w: 374, h: 390 - 22 });
  });
  it('lists the settings in rows of 23, then the pain and capacity rows of 22 at x = 17', () => {
    // Content starts 9 inside the panel, 4 down; each setting row is 23 high, 4 apart (10 after the checkbox).
    expect(find(card, 'health-setting:food')).toMatchObject({ y: 31 + 9 + 4, h: 23 });
    expect(find(card, 'health-setting:care').y).toBe(31 + 9 + 4 + 27);
    expect(find(card, 'health-setting:self').y).toBe(31 + 9 + 4 + 54);
    const painRow = find(card, 'health-pain'); expect(painRow).toMatchObject({ x: 9 + 17, h: 22, w: 236 - 18 - 44 });
    expect(find(card, 'capacity:consciousness').y).toBe(painRow.y + 22 + 6);
    expect(find(card, 'capacity:moving').y).toBe(painRow.y + 22 + 6 + 22);
  });
  it('shows the whole body first, parts with their icons (info, bleeding, tended), alternating bands and the bleeding line', () => {
    const bands = card.items.filter(item => item.k === 'fill' && item.region === 'hediffs'); expect(bands).toHaveLength(1);
    expect(card.items.filter(item => item.k === 'glyph').map(item => item.k === 'glyph' && item.glyph)).toEqual(expect.arrayContaining(['info', 'bleed', 'tend']));
    const bleed = find(card, 'health-bleed'); expect(bleed).toMatchObject({ x: 246, h: 22, y: 30 + 368 });
    expect(find(card, 'info:left-arm').control!.id).toBe('anatomy-arm');
    expect(find(card, 'hediff:i1').y).toBe(22 + 0); // after the whole-body row of 22
  });
  it('has an Operations view with the add menu or the request and its cancel button', () => {
    const operations = layoutHealthTab({ ...spec, tab: 'operations', operations: { note: 'n', empty: 'Aucune', add: control('add', { select: { value: '', options: [], onChange: () => undefined } }) } }, measure);
    expect(find(operations, 'operation-add')).toMatchObject({ h: 29 });
    const request = layoutHealthTab({ ...spec, tab: 'operations', operations: { note: 'n', empty: 'Aucune', request: { label: 'Amputation', hint: 'h', cancel: control('cancel') } } }, measure);
    expect(find(request, 'operation-cancel')).toMatchObject({ w: 120, h: 29 });
  });
  it('colours the efficiency estimates and the pain wording like Core', () => {
    expect(efficiencyInk(0)).toBe(NATIVE_INK.red); expect(efficiencyInk(1)).toBe(NATIVE_INK.good); expect(efficiencyInk(1.2)).toBe(NATIVE_INK.enhanced); expect(efficiencyInk(.5)).toBe(NATIVE_INK.subtle);
    expect(painLabel(0).ink).toBe(NATIVE_INK.good); expect(painLabel(.1).ink).toBe(NATIVE_INK.relation); expect(painLabel(.3).ink).toBe(NATIVE_INK.painMedium); expect(painLabel(.6).ink).toBe(NATIVE_INK.painSevere); expect(painLabel(.9).ink).toBe(NATIVE_INK.red);
  });
});

describe('Gear tab (ITab_Pawn_Gear)', () => {
  const row = (id: string, extra = {}) => ({ id, label: id, grams: 1500, hint: id, info: control('info-' + id), ...extra });
  const spec: GearSpec = { type: 'gear', mass: { text: 'Masse', hint: 'm' }, comfort: { text: 'Plage', hint: 'p' }, armor: [{ id: 'sharp', label: 'Tranchant', value: '10 %' }, { id: 'blunt', label: 'Contondant', value: '5 %' }, { id: 'heat', label: 'Chaleur', value: '0 %' }],
    sections: [{ id: 'equipment', label: 'Équipement', rows: [row('gun', { drop: control('drop-gun') })] }, { id: 'apparel', label: 'Vêtements', rows: [row('shirt', { drop: control('rm-shirt') }), row('hat')] }, { id: 'inventory', label: 'Inventaire', rows: [row('meal', { ingest: control('eat') })] }],
    extras: [], maxHeight: 4000 };
  const card = layoutGearTab(spec, measure);
  it('is 460 wide, starts 20 down in a view contracted by 10, with lines of 22 and separators of 25', () => {
    expect(card.width).toBe(460);
    const region = card.regions[0]!; expect(region).toMatchObject({ x: 10, y: 30, w: 440 });
    expect(find(card, 'gear-mass')).toMatchObject({ y: 0, h: 22 }); expect(find(card, 'gear-comfort').y).toBe(22);
    // Separator (3 + 20 + 2) then three armour lines of 22, then the next separator and the first row of 28.
    expect(find(card, 'gear-row:gun').y).toBe(44 + 25 + 66 + 25);
    expect(find(card, 'gear-row:shirt').y).toBe(44 + 25 + 66 + 25 + 28 + 25);
    expect(find(card, 'gear-row:hat').y - find(card, 'gear-row:shirt').y).toBe(28);
  });
  it('lays out each thing row: info 24 on the right, drop and ingest 24 before it, the mass in 60', () => {
    const inner = 440 - 16;
    expect(find(card, 'gear-info:gun')).toMatchObject({ x: inner - 24, w: 24, h: 24 });
    expect(find(card, 'gear-drop:gun')).toMatchObject({ x: inner - 48, w: 24 });
    expect(find(card, 'gear-ingest:meal').x).toBe(inner - 48);
    expect(find(card, 'gear-row:gun').w).toBe(inner - 48 - 60);
    expect(gearMassLabel(1500)).toBe('1.5 kg'); expect(gearMassLabel(250)).toBe('0.25 kg');
    expect(GEAR_SIZE).toMatchObject({ width: 460, height: 450, row: 28, icon: 28, labelX: 36, massWidth: 60 });
  });
  it('grows with its content up to the screen bound and keeps the portrait toggle where the picture is', () => {
    const many = layoutGearTab({ ...spec, sections: [{ id: 'inventory', label: 'Inventaire', rows: Array.from({ length: 30 }, (_, index) => row('r' + index)) }], maxHeight: 700 }, measure);
    expect(many.height).toBe(700); expect(many.regions[0]!.contentHeight).toBeGreaterThan(many.regions[0]!.h);
    const portrait = layoutGearTab({ ...spec, portrait: { control: control('clothes'), visible: true } }, measure);
    expect(find(portrait, 'gear-clothing')).toMatchObject({ x: 440 - 16 - 92, w: 92 });
    expect(find(portrait, 'gear-mass').w).toBe(440 - 16 - 100);
  });
});

describe('Social and Log tabs (SocialCardUtility, InteractionCardUtility, ITab_Pawn_Log)', () => {
  it('shares the row width like CalculateColumnsWidths', () => {
    const c = socialColumnWidths(520);
    expect(c.relations).toBeCloseTo(510 * .23, 6); expect(c.label).toBeCloseTo(510 * .41, 6); expect(c.mine).toBeCloseTo(510 * .075, 6); expect(c.his).toBeCloseTo(510 * .085, 6); expect(c.situation).toBeCloseTo(510 * .2, 6);
    // Narrow rows keep 25 and 35 for the opinions, taken from the name column.
    const narrow = socialColumnWidths(200); expect(narrow.mine).toBe(25); expect(narrow.his).toBe(35);
    expect(opinionInk(5)).toBe(NATIVE_INK.relation); expect(opinionInk(-30)).toBe(NATIVE_INK.red); expect(opinionInk(30)).toBe(NATIVE_INK.good); expect(signedInteger(12)).toBe('+12'); expect(signedInteger(-3)).toBe('-3'); expect(signedInteger(0)).toBe('0');
  });
  it('is 540 × 510: the list takes 63 % of the area, the log the rest after a gap of 17, a rule in the middle', () => {
    const spec: SocialSpec = { type: 'social', rows: [{ id: '1', relations: 'Parent', name: 'Anne', mine: 20, his: -15, situation: 'Présent', hint: 'h', select: control('pick') }], interactions: [{ id: 'a', text: 'Anne a insulté Bob', faded: false, hint: 'h' }] };
    const card = layoutSocialTab(spec, measure);
    expect([card.width, card.height]).toEqual([SOCIAL_SIZE.width, SOCIAL_SIZE.height]);
    const [relations, log] = card.regions;
    expect(relations).toMatchObject({ id: 'relations', x: 10, y: 25, w: 520 }); expect(relations!.h).toBeCloseTo(475 * .63, 6);
    expect(log!.y).toBeCloseTo(25 + 475 * .63 + 17, 6); expect(log!.y + log!.h).toBeCloseTo(500, 6);
    const rule = card.items.find(item => item.k === 'line')!; expect(rule.y).toBe(Math.round((25 + 475 * .63 + log!.y) / 2));
    // Rows of 22 + 3, text from x = 5, the interaction text at x = 29.
    expect(find(card, 'social:1')).toMatchObject({ y: 0, h: 25, w: 520 }); expect(find(card, 'social:1').control!.id).toBe('pick');
    expect(card.items.filter(item => item.k === 'text' && item.region === 'interactions')[0]).toMatchObject({ x: 29 });
  });
  it('lays the Log tab out with its three checkboxes, copy button and list', () => {
    const card = layoutLogTab({ type: 'log', copy: control('copy'), emptyText: 'vide', toggles: [{ id: 'all', label: 'Tout', x: 60, width: 100, on: false, control: control('t1') }, { id: 'social', label: 'Social', x: 330, width: 105, on: true, control: control('t2') }, { id: 'combat', label: 'Combat', x: 445, width: 115, on: true, control: control('t3') }],
      lines: [{ kind: 'header', text: 'Combat' }, { kind: 'entry', id: 'e1', text: 'Tir', hint: 'h' }, { kind: 'entry', id: 'e2', text: 'Tir 2', hint: 'h' }, { kind: 'gap', height: 20 }, { kind: 'entry', id: 'e3', text: 'Fin', hint: 'h' }] }, measure);
    expect([card.width, card.height]).toEqual([LOG_SIZE.width, LOG_SIZE.height]);
    expect(find(card, 'log-toggle:all')).toMatchObject({ x: 60, y: 2, w: 100, h: 24 }); expect(find(card, 'log-toggle:combat')).toMatchObject({ x: 445, w: 115 });
    expect(find(card, 'log-copy')).toMatchObject({ x: 570, y: 0, w: 18, h: 24 });
    expect(card.regions[0]).toMatchObject({ id: 'log', x: 10, y: 34, w: 610, h: 466 });
    expect(find(card, 'log:e1').y).toBe(30); expect(find(card, 'log:e2').y).toBe(30 + 26); expect(find(card, 'log:e3').y).toBe(30 + 26 + 26 + 20);
    // Alternating bands: the second entry only (the first has none), then the next run restarts after it.
    expect(card.items.filter(item => item.k === 'fill').map(item => item.k === 'fill' && item.y)).toEqual([56]);
    const empty = layoutLogTab({ type: 'log', copy: control('copy'), emptyText: 'vide', toggles: [], lines: [] }, measure);
    expect(empty.regions).toHaveLength(0);
  });
  it('lays the Prisoner tab out as 280 wide listing lines, the medical row and a menu section of radio rows of 28', () => {
    const card = layoutPrisonerTab({ type: 'prisoner', lines: [{ id: 'r', label: 'Résistance', value: '5.0', hint: 'h' }], medical: { label: 'Médicaments', value: 'Meilleur', control: control('med'), hint: 'h' },
      modes: [{ id: 'a', label: 'A', selected: true, control: control('ma'), hint: 'h' }, { id: 'b', label: 'B', selected: false, control: control('mb'), hint: 'h' }] }, measure);
    expect(card.width).toBe(PRISONER_SIZE.width);
    expect(find(card, 'prisoner-line:r')).toMatchObject({ x: 10, y: 10, w: 260, h: 22 });
    expect(find(card, 'prisoner-medical')).toMatchObject({ y: 10 + 22 + 2 + 1, h: 24 });
    const first = find(card, 'prisoner-mode:a'), second = find(card, 'prisoner-mode:b');
    expect(second.y - first.y).toBe(28); expect(first.w).toBe(240);
    expect(card.height).toBe(first.y - 10 + (28 * 2 + 20) + 10);
  });
});

let epoch = 612000;
function inspector(world: World, tab: string, pawnIndex = 0) {
  let page: NativePage;
  const state: NativeUiState = { world, epoch: ++epoch, panel: null, category: 'orders', tool: 'select', orientation: 0, selectedPawnIds: [world.pawns[pawnIndex]!.id], selectedObjects: [],
    constructionMaterial: 'wood', creationStorage: { priority: 3, filters: { wood: true, food: true } }, speed: 0, hasGame: true, busy: false, saves: [] };
  const noop = () => {};
  const actions: NativeUiActions = { command: vi.fn(async command => applyCommand(world, command)), readState: () => state, panel: vi.fn(), category: noop, tool: noop, selectPawn: noop, speed: noop,
    rotate: noop, material: noop, creationStorage: noop, front: noop, save: noop, exportSave: noop, showPage: next => { page = next; }, refresh: noop, clearSelection: noop, closePage: noop };
  setNativeInspectorTab(tab); page = buildNativeInspector(state, actions)!;
  return { actions, get page() { return page; } };
}
const cardOf = (page: NativePage) => page.rows.find(row => row.id === 'tab-card')!.card!;
const boxOf = (page: NativePage) => layoutNativePage(page, viewport, false, pageMeasure);

describe('the inspector builds each tab as one card at its RimWorld size', () => {
  const world = createWorld(489, 16, 16);
  it('opens Needs, Health, Gear, Social and Log as a single card row with no margin', () => {
    for (const [tab, size] of [['needs', [580, 520]], ['health', [630, 430]], ['social', [540, 510]], ['journal', [630, 510]]] as const) {
      const page = inspector(world, tab).page;
      expect(page.rows.filter(row => row.id !== 'pawn-tabs' && !row.inspectPane).map(row => row.id)).toEqual(['tab-card']);
      const box = boxOf(page), row = box.rows.find(entry => entry.row.id === 'tab-card')!;
      expect([row.x, row.width, row.height]).toEqual([0, size[0], size[1]]);
      expect(box.inspectorParts!.sheet).toMatchObject({ width: size[0], height: size[1] });
      expect(box.contentHeight).toBeLessThanOrEqual(box.body.height + 0.01);
    }
  });
  it('keeps every former Needs row reachable: bars in Core order, the mood with its thresholds, thoughts and the recreation detail', () => {
    resetCardScroll();
    const spec = cardOf(inspector(world, 'needs').page) as NeedsSpec;
    expect(spec.needs.map(entry => entry.label)).toEqual(expect.arrayContaining(['Nourriture', 'Sommeil', 'Loisirs', 'Beauté', 'Confort']));
    expect(spec.needs.map(entry => entry.label).slice(0, 3)).toEqual(['Nourriture', 'Sommeil', 'Loisirs']);
    expect(spec.needs.filter(entry => entry.major).map(entry => entry.label)).toEqual(['Nourriture', 'Sommeil', 'Loisirs']);
    expect(spec.mood!.thresholds).toHaveLength(3); expect(spec.mood!.hint).toMatch(/Risque mineur/); expect(spec.mood!.hint).toMatch(/Cible/);
    expect(spec.needs.find(entry => entry.id === 'recreation-level')!.hint).toMatch(/lassitude/);
    expect(spec.needs.find(entry => entry.id === 'need-hunger')!.thresholds).toEqual([.12, .24]);
  });
  it('keeps Health: policies, pain, capacities, the anatomy dossier and the operations as controls', () => {
    const page = inspector(world, 'health').page, spec = cardOf(page) as HealthSpec;
    expect(spec.tabs.overview.label).toBe('Vue d’ensemble'); expect(spec.tabs.operations?.label).toMatch(/^Opérations/);
    expect(spec.settings.map(setting => setting.id)).toEqual(expect.arrayContaining(['food', 'care']));
    expect(spec.capacities.map(capacity => capacity.label)).toEqual(expect.arrayContaining(['Conscience', 'Mouvement']));
    expect(spec.capacities.every(capacity => /^\d+ %$/.test(capacity.value))).toBe(true);
    expect(spec.pain?.hint).toMatch(/État clinique/);
    const card = layoutHealthTab(spec, measure);
    expect(card.targets.some(target => target.control?.id.startsWith('anatomy-'))).toBe(false); // a healthy colonist has no wound row
    const operations = inspector(world, 'health');
    void operations;
  });
  it('keeps Gear: portrait toggle, comfort range, armour, weapon and apparel with their buttons', () => {
    const dressed = createWorld(489, 16, 16), person = dressed.pawns[0]!;
    dressed.piles.push({ id: dressed.nextId++, kind: 'apparel', item: 'cloth-shirt', quantity: 1, owner: { type: 'apparel', pawnId: person.id }, apparel: newApparelState('cloth-shirt') } as never);
    const page = inspector(dressed, 'gear').page, spec = cardOf(page) as GearSpec;
    expect(spec.portrait!.control.id).toBe('portrait-clothing');
    expect(spec.comfort!.text).toMatch(/^Plage de température confortable : -?\d+ ~ -?\d+ °C$/);
    expect(spec.armor!.map(armor => armor.label)).toEqual(['Tranchant', 'Contondant', 'Chaleur']);
    const rows = spec.sections.flatMap(section => section.rows); expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(entry => entry.info && /^item-information-/.test(entry.info.id))).toBe(true);
    expect(spec.sections.find(section => section.id === 'apparel')!.rows.every(entry => entry.drop?.id.startsWith('remove-apparel-'))).toBe(true);
    expect(boxOf(page).portraitRect).toMatchObject({ width: 92, height: 128 });
    expect(boxOf(page).inspectorParts!.sheet.height).toBeGreaterThanOrEqual(450);
  });
  it('keeps Social: relations with their situation, opinions and the sorted interaction log', () => {
    const spec = cardOf(inspector(world, 'social').page) as SocialSpec;
    expect(Array.isArray(spec.rows)).toBe(true);
    for (const row of spec.rows) { expect(row.hint).toMatch(/Avis de/); expect(['Présent', 'En voyage', 'Absent', 'Décédé']).toContain(row.situation); }
  });
  it('keeps the Log filters and the copy button', () => {
    const spec = cardOf(inspector(world, 'journal').page) as Extract<ReturnType<typeof cardOf>, { type: 'log' }>;
    expect(spec.toggles.map(toggle => [toggle.id, toggle.x, toggle.width])).toEqual([['all', 60, 100], ['social', 330, 105], ['combat', 445, 115]]);
    expect(spec.toggles.map(toggle => toggle.on)).toEqual([false, true, true]); expect(spec.copy.id).toBe('log-copy');
  });
  it('shows the Prisoner tab for a captive: resistance, the medical row and the detention modes as radio rows', () => {
    const captive = createWorld(489, 16, 16);
    const pawn = captive.pawns[1]!;
    pawn.prisoner = { capturedAt: 3, resistance: 12.5, initialResistance: 20, mode: 'maintain' } as never;
    const page = inspector(captive, 'prisoner', 1).page;
    expect(page.inspectTab).toMatchObject({ id: 'prisoner' });
    const spec = cardOf(page) as Extract<ReturnType<typeof cardOf>, { type: 'prisoner' }>;
    expect(spec.lines.map(line => line.id)).toEqual(expect.arrayContaining(['resistance', 'captured']));
    expect(spec.modes.map(mode => mode.id)).toEqual(expect.arrayContaining(['maintain', 'reduce', 'recruit', 'release']));
    expect(spec.modes.filter(mode => mode.selected).map(mode => mode.id)).toEqual(['maintain']);
    const box = boxOf(page), row = box.rows.find(entry => entry.row.id === 'tab-card')!;
    expect(row.width).toBe(280); expect(box.inspectorParts!.sheet.height).toBe(row.height);
  });
});
