import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { applyCommand, createWorld } from '../src/sim/index';
import type { World } from '../src/sim/types';
import type { NativePage, NativeUiActions, NativeUiState } from '../src/ui3d/native-contract';
import { buildNativeInspector, setNativeInspectorTab } from '../src/ui3d/native-inspector';
import { NATIVE_INSPECT, NATIVE_UI, layoutNativePage } from '../src/ui3d/native-layout';
import { NATIVE_CHIP, NATIVE_GAP, NATIVE_LINE, NATIVE_TEXT, NATIVE_WINDOW } from '../src/ui3d/native-ui-scale';
import { NATIVE_BIO_SIZE, layoutNativeBioCard, nativeElementStack, nativeElementStackVertical, type NativeBioCard } from '../src/ui3d/native-bio-card';
import { BACKGROUND_SKILL_IDS } from '../src/sim/colonist-backgrounds';

// A stand-in for the font: 7 points per character at Small (13), bold or not.
const measure = (text: string, size: number) => text.length * size * 7 / 13;
const cardMeasure = (text: string) => text.length * 7;
const viewport = { width: 1440, height: 900 };

describe('one interface scale in RimWorld points (Text, GenUI, Window)', () => {
  it('derives every charter value from the scale', () => {
    expect(NATIVE_LINE.small).toBe(22);
    expect(NATIVE_GAP).toMatchObject({ tiny: 4, small: 10, normal: 17, wide: 26, pad: 10, list: 28 });
    expect(NATIVE_WINDOW).toMatchObject({ margin: 18, close: 18, closeMargin: 4, scrollbar: 16, icon: 24 });
    expect(NATIVE_CHIP).toMatchObject({ height: 22, rowMargin: 4, itemMargin: 5, textPad: 10 });
    expect(NATIVE_UI).toMatchObject({ body: NATIVE_TEXT.small, small: NATIVE_TEXT.small, title: NATIVE_TEXT.medium, line: NATIVE_LINE.small, padding: 18, gap: 10 });
    expect(NATIVE_TEXT.tiny).toBeLessThan(NATIVE_TEXT.small); expect(NATIVE_TEXT.small).toBeLessThan(NATIVE_TEXT.medium);
  });

  it('refuses a literal text size in the native page builders, layout and painters', () => {
    const dir = 'src/ui3d/', offenders: string[] = [];
    const patterns: [string, RegExp][] = [
      ['font(<number>)', /\bfont(?:Px)?\(\s*\d/],
      ['canvas font with a literal size', /\bfont\s*=\s*[`'"][^`'"]*?\b\d+(?:\.\d+)?px/],
      ['measure with a literal size', /\bmeasure\w*\([^()]*,\s*\d+(?:\.\d+)?\s*(?:,\s*(?:true|false))?\)/],
      ['wrap with a literal size', /\bwrapNative\w*\([^()]*,\s*\d+(?:\.\d+)?\s*\)/],
      ['semantic text with a literal size', /\bsemanticText\([^;]*?,\s*\d{1,2}(?:\.\d+)?\s*(?:,\s*(?:true|false))?\)/],
      ['text op with a literal size', /\bkind\s*:\s*'text'[^}]*\bsize\s*:\s*\d/],
      ['literal default text size', /\bsize\s*=\s*\d/],
    ];
    for (const file of readdirSync(dir).filter(name => name.endsWith('.ts') && name !== 'native-ui-scale.ts')) {
      const source = readFileSync(dir + file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      source.split('\n').forEach((line, index) => { for (const [name, pattern] of patterns) if (pattern.test(line)) offenders.push(`${file}:${index + 1} ${name}`); });
    }
    expect(offenders).toEqual([]);
  });
});

function card(overrides: Partial<NativeBioCard> = {}): NativeBioCard {
  return {
    name: 'Eden Brun', description: { label: 'Femme, 28 ans (48)', hint: 'Âge' }, faction: { id: 'bio-faction', label: 'Nouveaux venus', hint: 'Faction' },
    stories: [{ phase: 'Enfance', chip: { id: 'childhood', label: 'Enfant sensible', hint: 'h' } }, { phase: 'Adulte', chip: { id: 'adulthood', label: 'Conseillère', hint: 'h' } }],
    traits: ['Gentille', 'Jolie', 'Paresseuse', 'Délicate'].map((label, index) => ({ id: `trait-${index}`, label, hint: label })),
    incapable: [{ id: 'refusal-0', label: 'Cuisine', hint: 'Histoire' }],
    skills: BACKGROUND_SKILL_IDS.map((id, index) => ({ id: `skill-${id}`, label: id, level: index, passion: (index % 3) as 0 | 1 | 2, disabled: index === 4, hint: id })),
    ...overrides,
  };
}

describe('the Bio card is Core CharacterCardUtility in its rectangles', () => {
  it('places name, top stack, columns, chips and skill rows at the read numbers', () => {
    const layout = layoutNativeBioCard(card(), cardMeasure);
    expect([layout.width, layout.height]).toEqual([480, 455]);
    expect(layout.name).toMatchObject({ x: 0, y: 0, height: 30 });
    expect(layout.description.rect).toMatchObject({ x: 0, y: 40, height: 22 });
    expect(layout.faction!.rect).toMatchObject({ y: 40, height: 22, width: cardMeasure('Nouveaux venus') + 22 + 15 });
    expect(layout.faction!.rect.x).toBe(layout.description.rect.width + NATIVE_CHIP.itemMargin);
    // 30 + 10, one row of 22, 10 after it, 15 more because the stack used less than 78.
    expect(layout.columnsTop).toBe(87);
    expect(layout.left).toEqual({ x: 0, y: 87, width: 250, height: 368 });
    expect(layout.right).toEqual({ x: 250, y: 87, width: 258, height: 368 });
    expect(layout.overflow).toBe(false);
    for (const size of layout.sections) expect(size).toBeCloseTo(368 / 3, 6);
    const chip = (id: string) => layout.chips.find(box => box.item.id === id)!.rect;
    expect(chip('childhood')).toEqual({ x: 90, y: 87, width: cardMeasure('Enfant sensible') + 10, height: 22 });
    expect(chip('adulthood')).toMatchObject({ x: 90, y: 87 + 26 });
    const traitsTop = 87 + 368 / 3;
    expect(layout.titles[0]!.rect).toMatchObject({ x: 0, y: traitsTop, width: 200, height: 30 });
    expect(chip('trait-0')).toMatchObject({ x: 0, y: traitsTop + 24, height: 22, width: cardMeasure('Gentille') + 10 });
    expect(chip('trait-1').x).toBe(cardMeasure('Gentille') + 10 + 5);
    expect(layout.titles[1]!.rect).toMatchObject({ y: 87 + 2 * 368 / 3, height: 24 });
    const longest = Math.max(...BACKGROUND_SKILL_IDS.map(cardMeasure));
    layout.skills.forEach((skill, index) => {
      expect(skill.row).toEqual({ x: 250, y: 87 + 27 * index, width: 230, height: 24 });
      expect(skill.label).toMatchObject({ x: 256, width: longest + 6 });
      expect(skill.icon).toMatchObject({ x: 256 + longest + 6, width: 24, height: 24 });
      expect(skill.number).toMatchObject({ x: skill.icon.x + 28, y: skill.row.y + 3 });
      if (index === 4) expect(skill.bar).toBeUndefined();
      else { expect(skill.bar!.x).toBe(skill.icon.x + 24); expect(skill.bar!.x + skill.bar!.width).toBe(480); expect(skill.fill).toBe(Math.max(.01, index / 20)); }
    });
    expect(layout.skills.at(-1)!.row.y + 24).toBeLessThanOrEqual(455);
  });

  it('writes « Aucun » for empty sections and leaves no name zone in creation', () => {
    const layout = layoutNativeBioCard(card({ name: undefined, traits: [], incapable: [], faction: undefined, creation: true }), cardMeasure);
    expect(layout.name).toBeUndefined();
    expect(layout.description.rect.y).toBe(10); expect(layout.columnsTop).toBe(57);
    expect(layout.nones).toHaveLength(2); expect(layout.nones[0]).toMatchObject({ x: 0, width: 250, height: 24 });
  });

  it('shares the left column like Core and only overflows past the minimum heights', () => {
    const traits = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `trait-${index}`, label: 'Trait numéro ' + index, hint: '' }));
    // Eight traits: their section keeps its height, the first shrinks to its minimum + 12.
    const eight = layoutNativeBioCard(card({ traits: traits(8) }), cardMeasure);
    expect(eight.sections[1]).toBe(30 + nativeElementStack(traits(8).map(item => cardMeasure(item.label) + 10), 245, 22).height);
    expect(eight.sections[0]).toBe(44 + 12); expect(eight.sections[2]).toBeCloseTo(368 / 3, 6); expect(eight.overflow).toBe(false);
    // Twenty-four do not fit even at the minimum heights: Core scrolls the column.
    const many = layoutNativeBioCard(card({ traits: traits(24) }), cardMeasure);
    expect(many.overflow).toBe(true); expect(many.sections[0]).toBe(44 + 22);
  });

  it('stacks elements like GenUI, with its order optimisation and its vertical variant', () => {
    expect(nativeElementStack([100, 100, 100], 245, 22)).toMatchObject({ height: 22 + 4 + 22, rects: [{ x: 0, y: 0 }, { x: 105, y: 0 }, { x: 0, y: 26 }] });
    // Optimisation: while the first row fills, the widest element that still fits.
    expect(nativeElementStack([40, 150, 60], 245, 22, 5, 5, true).order).toEqual([1, 2, 0]);
    // A new column when the next element would pass the height; x after its row's width.
    expect(nativeElementStackVertical([50, 60, 70], 49, 22).rects.map(rect => [rect.x, rect.y])).toEqual([[0, 0], [0, 27], [55, 0]]);
  });
});

let epoch = 489000;
function inspector(world: World, tab: string) {
  let page: NativePage;
  const state: NativeUiState = { world, epoch: ++epoch, panel: null, category: 'orders', tool: 'select', orientation: 0, selectedPawnIds: [world.pawns[0]!.id], selectedObjects: [],
    constructionMaterial: 'wood', creationStorage: { priority: 3, filters: { wood: true, food: true } }, speed: 0, hasGame: true, busy: false, saves: [] };
  const noop = () => {};
  const actions: NativeUiActions = { command: vi.fn(async command => applyCommand(world, command)), readState: () => state, panel: vi.fn(), category: noop, tool: noop, selectPawn: noop, speed: noop,
    rotate: noop, material: noop, creationStorage: noop, front: noop, save: noop, exportSave: noop, showPage: next => { page = next; }, refresh: noop, clearSelection: noop, closePage: noop };
  setNativeInspectorTab(tab); page = buildNativeInspector(state, actions)!;
  return { actions, get page() { return page; } };
}

describe('the inspect pane, its tabs and the Bio tab window', () => {
  it('shows only the 432 × 165 pane and its 72 × 30 tabs while no tab is open', () => {
    const world = createWorld(489, 16, 16), ui = inspector(world, 'none'), box = layoutNativePage(ui.page, viewport, false, measure);
    expect(ui.page.inspectTab).toBeUndefined();
    const parts = box.inspectorParts!;
    expect(parts.sheet.height).toBe(0);
    expect(parts.summary).toMatchObject({ x: 0, width: 432, height: 165, y: box.height - 165 });
    expect(parts.tabs).toMatchObject({ x: 0, width: 432, height: 30, y: box.height - 165 - 30 });
    const tabs = box.rows.find(row => row.row.id === 'pawn-tabs')!.controls;
    expect(tabs.map(tab => tab.control.label)).toEqual(['Journal', 'Matériel', 'Social', 'Bio', 'Besoins', 'Santé']);
    tabs.forEach((tab, index) => expect([tab.x, tab.width, tab.height]).toEqual([432 - 72 * (6 - index), 72, 30]));
    expect(box.y + box.height).toBe(viewport.height - NATIVE_UI.bottom - 10);
    // Gauges of 93 × 16, 6 apart, at 26 + 3 under the pane's top inner edge.
    expect(parts.gauges!.map(gauge => gauge.gauge.id)).toEqual(['health', 'mood', 'schedule', 'area']);
    parts.gauges!.forEach((gauge, index) => expect(gauge.rect).toEqual({ x: 12 + index * 99, y: parts.summary.y + 8 + 29, width: 93, height: 16 }));
    // Gizmos 75 × 75 from the pane's right + 14, bottom 14 above the pane's bottom.
    const gizmos = box.actions.filter(action => action.style === 'tile');
    expect(gizmos.map(gizmo => gizmo.control.id)).toEqual(expect.arrayContaining(['draft-pawn', 'clear-orders', 'manage-work', 'pawn-hostility']));
    gizmos.forEach((gizmo, index) => expect([gizmo.x, box.header + gizmo.y + 75, gizmo.width, gizmo.height]).toEqual([432 + 14 + index * 80, box.height - 14, 75, 75]));
    const close = box.actions.find(action => action.control.id === 'inspect-close')!;
    expect([close.x, box.header + close.y, close.width]).toEqual([432 - 4 - 18, parts.summary.y + 4, 18]);
  });

  it('opens the Bio card in a 514 × 489 window resting on the tabs, without scrolling', () => {
    const world = createWorld(489, 16, 16), ui = inspector(world, 'bio'), box = layoutNativePage(ui.page, viewport, false, measure);
    expect(ui.page.inspectTab).toMatchObject({ id: 'bio', width: 514, height: 489, margin: 17 });
    const parts = box.inspectorParts!;
    expect(parts.sheet).toEqual({ x: 0, y: box.height - 195 - 489, width: 514, height: 489 });
    const cardRow = box.rows.find(row => row.row.id === 'bio-card')!;
    expect([cardRow.x, box.header + cardRow.top - parts.sheet.y, cardRow.width, cardRow.height]).toEqual([17, 17, NATIVE_BIO_SIZE.width, NATIVE_BIO_SIZE.height]);
    expect(box.contentHeight).toBeLessThanOrEqual(box.body.height);
    expect(cardRow.bio!.overflow).toBe(false);
    expect(cardRow.bio!.skills).toHaveLength(12);
    expect(box.rows.filter(row => row.row.id !== 'pawn-tabs').map(row => row.row.id)).toEqual(['bio-card']);
    const tabClose = box.actions.find(action => action.control.id === 'inspect-tab-close')!;
    expect([tabClose.x, box.header + tabClose.y]).toEqual([514 - 22, parts.sheet.y + 4]);
  });

  it('toggles a tab like Core and gives the other tabs their RimWorld window sizes', async () => {
    const world = createWorld(489, 16, 16);
    for (const [tab, size] of [['needs', [580, 520]], ['health', [630, 430]], ['gear', [460, 450]], ['social', [540, 510]], ['journal', [630, 510]]] as const)
      expect(inspector(world, tab).page.inspectTab).toMatchObject({ id: tab, width: size[0], height: size[1] });
    const ui = inspector(world, 'bio');
    await ui.page.rows.find(row => row.id === 'pawn-tabs')!.controls!.find(control => control.id === 'pawn-tab-bio')!.onActivate();
    expect(ui.page.inspectTab).toBeUndefined();
    await ui.page.rows.find(row => row.id === 'pawn-tabs')!.controls!.find(control => control.id === 'pawn-tab-needs')!.onActivate();
    expect(ui.page.inspectTab?.id).toBe('needs');
    await ui.page.actions!.find(control => control.id === 'inspect-tab-close')!.onActivate();
    expect(ui.page.inspectTab).toBeUndefined();
  });

  it('keeps every row the old Bio dossier carried reachable where Core puts it', () => {
    const world = createWorld(489, 16, 16), pawn = world.pawns[0]!;
    const pane = inspector(world, 'none').page;
    expect(pane.rows.filter(row => row.inspectPane).map(row => row.id)).toEqual(expect.arrayContaining(['pawn-gauges', 'pawn-action', 'pawn-orders']));
    expect(pane.rows.find(row => row.id === 'pawn-orders')!.value).toContain(`${pawn.orders.queue.length} en file`);
    expect(pane.rows.find(row => row.id === 'pawn-gauges')!.gauges!.find(gauge => gauge.id === 'mood')!.hint).toMatch(/Risque mineur.*Crises disponibles/);
    expect(pane.actions!.find(control => control.id === 'pawn-hostility')!.select!.options.map(option => option.value)).toEqual(['flee', 'ignore', 'attack']);
    const bio = inspector(world, 'bio').page.rows.find(row => row.id === 'bio-card')!.bio!;
    expect(bio.description.label).toMatch(/^(Femme|Homme), \d+ ans/);
    expect(bio.description.hint).toContain('Âge chronologique');
    expect(bio.traitsHint).toContain('apprentissage général');
    expect(bio.skills.every(skill => /Expérience du niveau/.test(skill.hint) && /Apprentissage/.test(skill.hint))).toBe(true);
    const social = inspector(world, 'social').page;
    expect(social.rows.some(row => row.id === 'heading-bio-links')).toBe(true);
    expect(social.rows.some(row => row.id.startsWith('bio-relation') || row.id === 'bio-relations-empty')).toBe(true);
    const gear = inspector(world, 'gear').page;
    expect(gear.rows.find(row => row.id === 'portrait-clothing')!.controls![0]!.id).toBe('portrait-clothing');
    expect(layoutNativePage(gear, viewport, false, measure).portraitRect).toMatchObject({ width: 92, height: 128 });
  });
});
