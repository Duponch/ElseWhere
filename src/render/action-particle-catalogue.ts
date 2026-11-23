import type { Cell, Job, MaterialPile, Pawn, Structure, StructureKind, Tile, World } from '../sim/types';
import { TICKS_PER_SECOND } from '../sim/types';
import type { WildAnimal } from '../sim/wildlife-state';
import type { FireRecord } from '../sim/fire-rules';
import { footprintCells } from '../sim/definitions';
import { ITEM_DEFINITIONS } from '../sim/items';
import { isAnimalMeat } from '../sim/biome-items';
import { stoneColor } from './stone-palette';
import { buildingMaterialColor } from './building-material-color';

/** Catalogue of the action particles (presentation only, 22 November 2026).
 *
 * Low-poly colonists have few joints and no fingers: small drawn particles at
 * the hands or at the physical place of an action show what is being done.
 * Every entry names the confirmed simulation state it reads, where its
 * particles are born and how they move. Nothing here is saved, simulated or
 * random: the visuals are a pure function of the confirmed presentation
 * clock, the emitter seed and this table. The animations page lists this
 * catalogue (`ACTION_PARTICLES`, `ACTIONS_WITHOUT_PARTICLES`).
 *
 * Core 1.6 reference for rhythms and lifetimes: EffecterDefs of
 * Defs/Effects (Mine, Harvest_Tree, Harvest_Plant, Sow, Clean, ClearSnow,
 * BuryPawn, ConstructWood/Metal/Dirt, RoofWork, Repair, Research, Drill,
 * Cook, ButcherFlesh, ButcherMechanoid, Surgery, CutStone, Tailor, Smith,
 * Sculpt, Smelt, Cremate, EatMeat, EatVegetarian) and their flecks/motes
 * (FoodBit 0.08 + 0.4 + 0.25 s, DustPuff 0.04 + 0.03 + 1 s, SparkThrown
 * 0.08 + 0.33 + 0.85 s, ResearchPage 1.14 s every 40 ticks, SleepZ
 * 0.08 + 1.4 + 1.5 s). Core sprays 2D motes on a top-down map; Elsewhere
 * adapts them to 3D arcs (gravity, drag, landing) at the contact point. */

/** Drawn particle families, in atlas order. Tintable families are painted in
 * light values so the emitter tint (rock, soil, material, cloth) colours them. */
export const PARTICLE_FAMILIES = [
  { id: 'wood-chip', variants: 4, label: 'Copeau de bois' },
  { id: 'splinter', variants: 3, label: 'Écharde' },
  { id: 'bark', variants: 2, label: 'Écorce' },
  { id: 'sawdust', variants: 2, label: 'Sciure' },
  { id: 'stone-chip', variants: 4, label: 'Éclat de pierre', tintable: true },
  { id: 'gravel', variants: 2, label: 'Gravillons', tintable: true },
  { id: 'dust', variants: 4, label: 'Poussière', tintable: true },
  { id: 'smoke', variants: 3, label: 'Volute de fumée ou de vapeur', tintable: true },
  { id: 'spark', variants: 3, label: 'Étincelle', emissive: true },
  { id: 'ember', variants: 2, label: 'Métal chaud, braise', emissive: true },
  { id: 'glint', variants: 2, label: 'Reflet d’outil', emissive: true },
  { id: 'shaving', variants: 2, label: 'Copeau de métal', tintable: true },
  { id: 'cloth', variants: 4, label: 'Chute de tissu', tintable: true },
  { id: 'thread', variants: 2, label: 'Fil', tintable: true },
  { id: 'wool', variants: 2, label: 'Touffe de laine', tintable: true },
  { id: 'seed', variants: 2, label: 'Graines' },
  { id: 'leaf', variants: 4, label: 'Feuille' },
  { id: 'grass', variants: 2, label: 'Brins d’herbe' },
  { id: 'soil', variants: 3, label: 'Motte de terre', tintable: true },
  { id: 'droplet', variants: 2, label: 'Gouttelette', tintable: true },
  { id: 'blood', variants: 3, label: 'Goutte de sang' },
  { id: 'bandage', variants: 2, label: 'Bande de pansement' },
  { id: 'crumb', variants: 4, label: 'Miette de nourriture', tintable: true },
  { id: 'meat', variants: 2, label: 'Morceau de viande' },
  { id: 'page', variants: 2, label: 'Feuillet' },
  { id: 'sleep-z', variants: 2, label: 'Z du sommeil' },
  { id: 'snow', variants: 2, label: 'Flocons' },
  { id: 'ash', variants: 2, label: 'Cendre' },
  { id: 'foam', variants: 2, label: 'Mousse' },
] as const satisfies readonly { id: string; variants: number; label: string; tintable?: boolean; emissive?: boolean }[];
export type ParticleFamily = typeof PARTICLE_FAMILIES[number]['id'];
const FAMILY_INDEX = new Map<ParticleFamily, number>(PARTICLE_FAMILIES.map((family, index) => [family.id, index]));
/** First atlas cell of each family; cells are numbered row by row. */
export const FAMILY_FIRST_CELL: Readonly<Record<ParticleFamily, number>> = (() => {
  const result = {} as Record<ParticleFamily, number>;let cell = 0;
  for (const family of PARTICLE_FAMILIES) { result[family.id] = cell; cell += family.variants; }
  return Object.freeze(result);
})();
export const PARTICLE_CELL_COUNT = PARTICLE_FAMILIES.reduce((sum, family) => sum + family.variants, 0);
export const familyInfo = (id: ParticleFamily) => PARTICLE_FAMILIES[FAMILY_INDEX.get(id)!]!;

/** Emission rhythm: bursts happen when omega·t + w ≡ phase (mod 2π), where t
 * is the confirmed presentation clock in seconds and w the actor's stroke
 * offset (`id × 1.7`, as the work swing of the human rig). The clock wraps
 * every 2π s; an integer omega makes the burst schedule wrap seamlessly. */
export interface ParticleRhythm { readonly omega: number; readonly phase: number }
/** Work strokes of the current human rig (PawnLayer: `sin(time × 11 + w)` for
 * mining, chopping and building, `sin(time × 8 + w)` crouched; the hand
 * reaches the target on the downswing). Keep in step if those change. */
export const WORK_RHYTHMS = Object.freeze({
  mine: { omega: 11, phase: -.25 }, chop: { omega: 11, phase: -.35 },
  hammer: { omega: 11, phase: 1.37 }, bench: { omega: 11, phase: .32 },
  ground: { omega: 8, phase: -.53 },
} as const satisfies Record<string, ParticleRhythm>);
const steady = (omega: number, phase = 0): ParticleRhythm => ({ omega, phase });
/** One-shot channels emit every slot once, at the event time. */
export const ONCE: ParticleRhythm = Object.freeze({ omega: 0, phase: 0 });

export interface ParticleChannel {
  readonly family: ParticleFamily;
  /** Pool slots used by this channel and particles per burst (slots / burst
   * bursts overlap, so slots / burst × period must cover the lifetime). */
  readonly slots: number; readonly burst: number;
  readonly rhythm: ParticleRhythm;
  /** Seconds. */
  readonly life: number;
  /** m/s, launch direction around the emitter direction (azimuth half-angle,
   * π = all around) and elevation range in radians above the horizontal. */
  readonly speed: readonly [number, number]; readonly spread: number; readonly elevation: readonly [number, number];
  /** m/s² downwards (negative rises) and horizontal drag (1/s). */
  readonly gravity: number; readonly drag: number;
  /** Metres, relative growth over the life and maximum spin (rad/s). */
  readonly size: readonly [number, number]; readonly growth: number; readonly spin: number;
  /** Birth jitter (m), fade in/out (s), sideways flutter (m). */
  readonly radius: number; readonly fadeIn: number; readonly fadeOut: number; readonly sway: number;
  /** Multiply by the emitter tint; stop on the ground until the fade. */
  readonly tint: boolean; readonly land: boolean;
}
type ChannelPreset = Omit<ParticleChannel, 'family' | 'slots' | 'burst' | 'rhythm'>;
const base = (overrides: Partial<ChannelPreset>): ChannelPreset => ({
  life: 1, speed: [1, 2], spread: .8, elevation: [.4, 1.1], gravity: 9.8, drag: .4, size: [.12, .18], growth: 0, spin: 6,
  radius: .06, fadeIn: .04, fadeOut: .3, sway: 0, tint: false, land: true, ...overrides,
});
/** Physical defaults of each family (adapted to 3D from the Core motes). */
const PRESETS: Readonly<Record<ParticleFamily, ChannelPreset>> = Object.freeze({
  'wood-chip': base({ life: .95, speed: [1.5, 2.8], elevation: [.45, 1.15], size: [.16, .24], spin: 11 }),
  splinter: base({ life: .95, speed: [1.6, 3], elevation: [.4, 1.05], size: [.2, .3], spin: 8 }),
  bark: base({ life: .9, speed: [1.2, 2.2], size: [.15, .21], spin: 9 }),
  sawdust: base({ life: 1, speed: [.5, 1.2], spread: Math.PI, gravity: 5, drag: 1.2, size: [.13, .19], spin: 3, sway: .08 }),
  'stone-chip': base({ life: .9, speed: [1.6, 3.2], elevation: [.35, 1.05], size: [.13, .2], spin: 13, tint: true }),
  gravel: base({ life: .85, speed: [.8, 1.8], elevation: [.45, 1.2], size: [.15, .2], spin: 4, tint: true }),
  dust: base({ life: 1.3, speed: [.25, .6], spread: Math.PI, elevation: [.25, .9], gravity: -.25, drag: 1.8, size: [.36, .52], growth: 1.1, spin: .8, radius: .1, fadeIn: .08, fadeOut: .8, tint: true, land: false }),
  smoke: base({ life: 2.2, speed: [.25, .45], spread: Math.PI, elevation: [1.2, 1.5], gravity: -.35, drag: 1.2, size: [.36, .5], growth: 1.6, spin: .6, radius: .08, fadeIn: .25, fadeOut: 1.2, sway: .2, tint: true, land: false }),
  spark: base({ life: .42, speed: [2.4, 4.5], elevation: [.2, 1.2], drag: .8, size: [.13, .19], spin: 0, radius: .03, fadeIn: 0, fadeOut: .18 }),
  ember: base({ life: .95, speed: [.5, 1.2], elevation: [.7, 1.4], gravity: -.5, drag: 1, size: [.1, .14], spin: 1, fadeIn: .05, fadeOut: .5, sway: .08, land: false }),
  glint: base({ life: .35, speed: [0, 0], size: [.24, .34], growth: .5, spin: 2.5, radius: .1, fadeIn: .05, fadeOut: .2, land: false, gravity: 0 }),
  shaving: base({ life: .9, speed: [1, 2], size: [.14, .2], spin: 12, tint: true }),
  cloth: base({ life: 1.15, speed: [.6, 1.3], elevation: [.55, 1.2], gravity: 3.2, drag: 1.6, size: [.17, .25], spin: 5, sway: .14, tint: true }),
  thread: base({ life: 1.2, speed: [.4, .9], elevation: [.55, 1.2], gravity: 2, drag: 2, size: [.18, .26], spin: 3, sway: .16, tint: true }),
  wool: base({ life: 1.3, speed: [.4, 1], elevation: [.55, 1.2], gravity: 1.8, drag: 2, size: [.2, .28], spin: 2, sway: .14, tint: true }),
  seed: base({ life: .85, speed: [.5, 1.1], elevation: [-.2, .6], size: [.1, .14], spin: 6 }),
  leaf: base({ life: 1.4, speed: [.7, 1.6], spread: Math.PI, elevation: [.6, 1.3], gravity: 2.4, drag: 1.7, size: [.17, .25], spin: 4, sway: .18 }),
  grass: base({ life: 1, speed: [.8, 1.7], spread: Math.PI, elevation: [.7, 1.3], gravity: 5, drag: 1.2, size: [.17, .24], spin: 6, sway: .08 }),
  soil: base({ life: .85, speed: [1, 2.2], spread: Math.PI, elevation: [.6, 1.2], drag: .3, size: [.14, .21], spin: 6, tint: true }),
  droplet: base({ life: .7, speed: [.8, 1.8], elevation: [.3, 1.1], drag: .2, size: [.09, .13], spin: 0, fadeOut: .15, tint: true, land: false }),
  blood: base({ life: .8, speed: [.6, 1.6], elevation: [.2, .9], drag: .3, size: [.08, .13], spin: 3 }),
  bandage: base({ life: 1.4, speed: [.3, .7], elevation: [.7, 1.3], gravity: 1.2, drag: 2.2, size: [.22, .3], spin: 2, sway: .16, land: false }),
  // Core FoodBit motes: 0.08 s in, 0.4 s solid, 0.25 s out.
  crumb: base({ life: .75, speed: [.5, 1.2], elevation: [.1, .8], size: [.09, .13], spin: 6, fadeIn: .08, fadeOut: .25, tint: true }),
  meat: base({ life: .75, speed: [.5, 1.2], elevation: [.1, .8], size: [.1, .14], spin: 6, fadeIn: .08, fadeOut: .25 }),
  // Core ResearchPage: 0.04 + 1 + 0.1 s.
  page: base({ life: 1.15, speed: [.5, 1], elevation: [.8, 1.3], gravity: 1, drag: 2.5, size: [.22, .3], spin: 3, sway: .2, fadeOut: .2, land: false }),
  // Core SleepZ: 0.08 + 1.4 + 1.5 s, drifting up.
  'sleep-z': base({ life: 3, speed: [.18, .22], spread: Math.PI, elevation: [1.35, 1.5], gravity: 0, drag: 0, size: [.24, .34], growth: .5, spin: .3, radius: .03, fadeIn: .1, fadeOut: 1.4, sway: .1, land: false }),
  snow: base({ life: .8, speed: [1, 2], spread: Math.PI, gravity: 6, drag: .8, size: [.14, .2], spin: 5 }),
  ash: base({ life: 1.6, speed: [.3, .7], spread: Math.PI, elevation: [.8, 1.4], gravity: -.15, drag: 1.4, size: [.1, .15], spin: 2, sway: .12, fadeOut: .7, land: false }),
  foam: base({ life: .8, speed: [.3, .8], elevation: [.5, 1.2], gravity: 5, drag: 1, size: [.14, .2], growth: .3, spin: 1, land: false }),
});
/** A channel; a repeating particle lives at most as long as its overlapping
 * groups cover (slots / burst periods), so no particle is cut short. */
/** Solid bits are drawn 30 % larger than their physical size: the sprite
 * fills about two thirds of its quad and must read at the default zoom. */
const SOFT_FAMILIES = new Set<ParticleFamily>(['dust', 'smoke', 'sleep-z']);
const ch = (family: ParticleFamily, slots: number, burst: number, rhythm: ParticleRhythm, overrides: Partial<ChannelPreset> = {}): ParticleChannel => {
  const merged = { ...PRESETS[family], ...overrides }, k = SOFT_FAMILIES.has(family) ? 1 : 1.3;
  const preset = { ...merged, size: [merged.size[0] * k, merged.size[1] * k] as const };
  const cover = rhythm.omega > 0 ? Math.floor(slots / burst) * 2 * Math.PI / rhythm.omega : Infinity;
  const life = Math.min(preset.life, cover);
  return Object.freeze({ family, slots, burst, rhythm, ...preset, life, fadeOut: Math.min(preset.fadeOut, life * .6) });
};

/** Where the particles are born. Contact rules read the target (tree trunk,
 * rock face, bench top, patient); hand rules read the actor's presented pose. */
export const PLACEMENT_RULES = {
  'tree-trunk': 'Sur le tronc, côté du bûcheron, à hauteur de hache',
  'rock-face': 'Sur la face de la roche tournée vers le mineur',
  'work-target': 'Sur l’ouvrage en chantier, côté de l’ouvrier',
  overhead: 'Sous le toit, au-dessus de la case travaillée',
  'ground-target': 'Au sol de la case travaillée',
  'hands-low': 'Aux mains baissées, devant l’acteur accroupi',
  hands: 'Aux mains, devant la poitrine',
  bench: 'Sur le plan de travail, au bord tourné vers l’ouvrier',
  mouth: 'À la bouche',
  'sleeper-head': 'Au-dessus de la tête du dormeur',
  'animal-rest': 'Au-dessus de la tête de l’animal couché',
  patient: 'Sur le corps du patient',
  'animal-body': 'Sur le flanc de l’animal',
  'animal-head': 'Devant la tête de l’animal',
  muzzle: 'Au museau de l’animal, au sol',
  fire: 'Sur les flammes',
  feet: 'Au sol devant l’acteur',
  'hit-target': 'Sur la cible touchée',
} as const;
export type PlacementRule = keyof typeof PLACEMENT_RULES;

export interface ActionParticleSpec {
  readonly id: string; readonly label: string; readonly group: string;
  readonly placement: PlacementRule;
  /** Confirmed state that selects this action (developer wording). */
  readonly source: string;
  /** Core 1.6 effecter this follows, when there is one. */
  readonly core?: string;
  /** Event (pick-up, drop, hit): one burst at the event time. */
  readonly once?: true;
  /** Actor is an animal (wildlife), not a human. */
  readonly animal?: true;
  readonly channels: readonly ParticleChannel[];
}
const R = WORK_RHYTHMS;
const spec = (s: ActionParticleSpec): ActionParticleSpec => Object.freeze(s);

/** Every action that shows particles. Order defines the shader action index
 * (index + 1; 0 means none). */
export const ACTION_PARTICLES = Object.freeze([
  spec({ id: 'chop-tree', label: 'Abattre un arbre', group: 'Plantes', placement: 'tree-trunk', core: 'Harvest_Tree', source: 'tâche « chop » réservée et active',
    channels: [ch('wood-chip', 8, 4, R.chop), ch('splinter', 2, 1, R.chop), ch('bark', 2, 1, R.chop), ch('dust', 3, 1, R.chop, { tint: false })] }),
  spec({ id: 'cut-plant', label: 'Couper des plantes', group: 'Plantes', placement: 'ground-target', core: 'Harvest_Plant', source: 'tâche « cut » ou dégagement avant construction',
    channels: [ch('leaf', 6, 3, R.ground), ch('grass', 4, 2, R.ground)] }),
  spec({ id: 'harvest', label: 'Récolter', group: 'Plantes', placement: 'ground-target', core: 'Harvest_Plant', source: 'tâche « harvest »',
    channels: [ch('leaf', 4, 2, R.ground), ch('grass', 4, 2, R.ground), ch('soil', 4, 2, R.ground)] }),
  spec({ id: 'sow', label: 'Semer', group: 'Plantes', placement: 'ground-target', core: 'Sow', source: 'tâche « sow »',
    channels: [ch('seed', 4, 2, R.ground), ch('soil', 4, 2, R.ground), ch('dust', 3, 1, R.ground)] }),
  spec({ id: 'transplant', label: 'Extraire ou replanter un arbre', group: 'Plantes', placement: 'ground-target', source: 'tâches « extract-tree » et « replant-tree »',
    channels: [ch('soil', 6, 3, R.ground), ch('leaf', 4, 2, R.ground), ch('dust', 3, 1, R.ground)] }),
  spec({ id: 'mine', label: 'Miner', group: 'Construction', placement: 'rock-face', core: 'Mine', source: 'tâche « mine » (teinte de la roche ou du minerai)',
    channels: [ch('stone-chip', 8, 4, R.mine), ch('dust', 3, 1, R.mine), ch('spark', 2, 2, R.mine)] }),
  spec({ id: 'smooth-wall', label: 'Lisser un mur de roche', group: 'Construction', placement: 'rock-face', source: 'tâche « smooth-wall »',
    channels: [ch('dust', 4, 1, R.hammer, { size: [.26, .38] }), ch('gravel', 4, 2, R.hammer), ch('stone-chip', 4, 2, R.hammer, { speed: [.8, 1.6], size: [.1, .14] })] }),
  spec({ id: 'smooth-floor', label: 'Lisser un sol de roche', group: 'Construction', placement: 'ground-target', source: 'tâche « smooth-floor »',
    channels: [ch('dust', 4, 1, R.ground, { size: [.26, .38] }), ch('gravel', 4, 2, R.ground)] }),
  spec({ id: 'build-wood', label: 'Construire en bois', group: 'Construction', placement: 'work-target', core: 'ConstructWood', source: 'chantier en bois (plan, charpente, mobilier)',
    channels: [ch('sawdust', 6, 3, R.hammer), ch('wood-chip', 4, 2, R.hammer), ch('dust', 3, 1, R.hammer, { tint: false })] }),
  spec({ id: 'build-stone', label: 'Construire en pierre', group: 'Construction', placement: 'work-target', source: 'chantier en blocs de pierre ou en jade',
    channels: [ch('stone-chip', 6, 3, R.hammer), ch('gravel', 4, 2, R.hammer), ch('dust', 3, 1, R.hammer)] }),
  spec({ id: 'build-metal', label: 'Construire en métal', group: 'Construction', placement: 'work-target', core: 'ConstructMetal', source: 'chantier en acier ou en plastacier',
    channels: [ch('spark', 6, 3, R.hammer), ch('ember', 2, 1, R.hammer), ch('dust', 3, 1, R.hammer, { tint: false }), ch('glint', 2, 1, R.hammer)] }),
  spec({ id: 'build-cloth', label: 'Construire en tissu ou en cuir', group: 'Construction', placement: 'work-target', source: 'chantier rembourré (tissu, cuir)',
    channels: [ch('cloth', 4, 2, R.hammer), ch('thread', 4, 2, R.hammer), ch('dust', 2, 1, R.hammer, { tint: false })] }),
  spec({ id: 'floor-work', label: 'Poser ou retirer un sol', group: 'Construction', placement: 'ground-target', core: 'ConstructDirt', source: 'tâches « lay-floor » et « remove-floor »',
    channels: [ch('gravel', 6, 3, R.ground), ch('dust', 3, 1, R.ground)] }),
  spec({ id: 'bridge', label: 'Construire ou retirer un pont', group: 'Construction', placement: 'ground-target', source: 'tâches « build-bridge » et « remove-bridge »',
    channels: [ch('wood-chip', 4, 2, R.ground), ch('droplet', 6, 3, R.ground)] }),
  spec({ id: 'deconstruct', label: 'Déconstruire ou désinstaller', group: 'Construction', placement: 'work-target', source: 'tâches « deconstruct » et « uninstall » (teinte du matériau)',
    channels: [ch('stone-chip', 6, 3, R.hammer, { size: [.14, .22] }), ch('dust', 4, 1, R.hammer)] }),
  spec({ id: 'repair', label: 'Réparer', group: 'Construction', placement: 'work-target', core: 'Repair', source: 'tâches « repair » et « fix-breakdown »',
    channels: [ch('spark', 4, 2, R.hammer), ch('glint', 2, 1, R.hammer), ch('dust', 2, 1, R.hammer, { tint: false })] }),
  spec({ id: 'roof', label: 'Construire ou retirer un toit', group: 'Construction', placement: 'overhead', core: 'RoofWork', source: 'tâches « build-roof » et « remove-roof »',
    channels: [ch('dust', 4, 1, R.hammer, { gravity: .6, elevation: [-.6, .2], tint: false }), ch('wood-chip', 4, 2, R.hammer, { speed: [.3, .8], elevation: [-.4, .4] })] }),
  spec({ id: 'install', label: 'Installer un meuble', group: 'Construction', placement: 'work-target', source: 'tâche « install » et petits travaux sans matériau connu',
    channels: [ch('dust', 3, 1, R.hammer, { tint: false }), ch('glint', 2, 1, R.hammer)] }),
  spec({ id: 'cook', label: 'Cuisiner', group: 'Production', placement: 'bench', core: 'Cook', source: 'facture d’une cuisinière ou d’un feu de camp',
    channels: [ch('smoke', 4, 1, steady(5), { size: [.3, .42], tint: false }), ch('crumb', 4, 2, R.bench), ch('dust', 2, 1, R.bench, { size: [.2, .3], speed: [.15, .35], tint: false })] }),
  spec({ id: 'butcher', label: 'Dépecer', group: 'Production', placement: 'bench', core: 'ButcherFlesh', source: 'facture de boucherie (table ou emplacement)',
    channels: [ch('blood', 6, 3, R.bench), ch('meat', 4, 2, R.bench)] }),
  spec({ id: 'butcher-mech', label: 'Démonter un mécanoïde', group: 'Production', placement: 'bench', core: 'ButcherMechanoid', source: 'factures « smash-mechanoid », « shred-mechanoid »',
    channels: [ch('shaving', 4, 2, R.bench), ch('spark', 4, 2, R.bench), ch('glint', 2, 1, R.bench)] }),
  spec({ id: 'smith', label: 'Forger', group: 'Production', placement: 'bench', core: 'Smith', source: 'forge, table d’usinage (armes, armures)',
    channels: [ch('spark', 6, 3, R.bench), ch('ember', 4, 2, R.bench), ch('glint', 2, 1, R.bench)] }),
  spec({ id: 'machine', label: 'Assembler des pièces', group: 'Production', placement: 'bench', source: 'établi de fabrication (composants, pièces)',
    channels: [ch('shaving', 4, 2, R.bench), ch('spark', 4, 2, R.bench), ch('glint', 2, 1, R.bench)] }),
  spec({ id: 'tailor', label: 'Coudre', group: 'Production', placement: 'bench', core: 'Tailor', source: 'tables de couture, vêtements tribaux au sol',
    channels: [ch('cloth', 6, 3, R.bench), ch('thread', 4, 2, R.bench)] }),
  spec({ id: 'craft-wood', label: 'Façonner le bois', group: 'Production', placement: 'bench', source: 'arcs et objets taillés à l’emplacement d’artisanat',
    channels: [ch('splinter', 4, 2, R.bench), ch('sawdust', 4, 2, R.bench)] }),
  spec({ id: 'stonecut', label: 'Tailler des blocs', group: 'Production', placement: 'bench', core: 'CutStone', source: 'table de taille de pierre',
    channels: [ch('stone-chip', 6, 3, R.bench), ch('dust', 3, 1, R.bench)] }),
  spec({ id: 'sculpt', label: 'Sculpter', group: 'Production', placement: 'bench', core: 'Sculpt', source: 'établi d’art',
    channels: [ch('stone-chip', 4, 2, R.bench), ch('wood-chip', 4, 2, R.bench, { size: [.12, .18] }), ch('dust', 3, 1, R.bench, { tint: false })] }),
  spec({ id: 'smelt', label: 'Fondre', group: 'Production', placement: 'bench', core: 'Smelt', source: 'fonderie électrique',
    channels: [ch('spark', 4, 2, R.bench), ch('ember', 4, 2, R.bench), ch('smoke', 3, 1, steady(4), { tint: false })] }),
  spec({ id: 'cremate', label: 'Incinérer', group: 'Production', placement: 'bench', core: 'Cremate', source: 'crématorium',
    channels: [ch('smoke', 4, 1, steady(4), { tint: false }), ch('ash', 4, 2, R.bench), ch('ember', 2, 1, R.bench)] }),
  spec({ id: 'drugs', label: 'Préparer des médicaments', group: 'Production', placement: 'bench', source: 'laboratoire (médicaments, pénoxycyline)',
    channels: [ch('droplet', 4, 2, R.bench), ch('smoke', 3, 1, steady(4), { size: [.22, .32] }), ch('glint', 1, 1, R.bench)] }),
  spec({ id: 'brew', label: 'Brasser', group: 'Production', placement: 'bench', source: 'brasserie (moût)',
    channels: [ch('smoke', 3, 1, steady(4), { size: [.26, .36], tint: false }), ch('droplet', 4, 2, R.bench)] }),
  spec({ id: 'refine', label: 'Raffiner du carburant', group: 'Production', placement: 'bench', source: 'raffinerie de biocarburant',
    channels: [ch('droplet', 4, 2, R.bench), ch('smoke', 3, 1, steady(4))] }),
  spec({ id: 'research', label: 'Rechercher', group: 'Production', placement: 'bench', core: 'Research', source: 'recherche à un bureau',
    channels: [ch('page', 3, 1, steady(9)), ch('dust', 2, 1, steady(1), { size: [.24, .32], tint: false })] }),
  spec({ id: 'deep-drill', label: 'Forer en profondeur', group: 'Production', placement: 'bench', core: 'Drill', source: 'foreuse profonde (opérateur)',
    channels: [ch('dust', 4, 1, steady(6)), ch('gravel', 4, 2, steady(6))] }),
  spec({ id: 'scan', label: 'Prospecter', group: 'Production', placement: 'bench', source: 'scanner de sol (opérateur)',
    channels: [ch('glint', 2, 1, steady(3))] }),
  spec({ id: 'rearm', label: 'Réarmer une tourelle', group: 'Production', placement: 'bench', source: 'service d’une mini-tourelle',
    channels: [ch('spark', 2, 1, R.bench), ch('glint', 2, 1, R.bench), ch('shaving', 2, 1, R.bench)] }),
  spec({ id: 'refuel', label: 'Ravitailler en combustible', group: 'Production', placement: 'bench', source: 'ravitaillement au contact (teinte du combustible)',
    channels: [ch('wood-chip', 4, 2, R.bench, { tint: true }), ch('dust', 3, 1, R.bench, { tint: false })] }),
  spec({ id: 'fill-barrel', label: 'Remplir un fût', group: 'Production', placement: 'bench', source: 'versement du moût dans un fût',
    channels: [ch('droplet', 6, 3, R.bench), ch('foam', 2, 1, R.bench)] }),
  spec({ id: 'barrel-extract', label: 'Tirer la bière', group: 'Production', placement: 'bench', source: 'récupération de la bière d’un fût',
    channels: [ch('droplet', 4, 2, R.bench), ch('foam', 3, 1, R.bench)] }),
  spec({ id: 'tend', label: 'Soigner', group: 'Soins', placement: 'patient', source: 'soins au contact du patient',
    channels: [ch('bandage', 3, 1, steady(4)), ch('droplet', 3, 1, R.bench), ch('blood', 2, 1, R.bench, { size: [.06, .09] })] }),
  spec({ id: 'surgery', label: 'Opérer', group: 'Soins', placement: 'patient', core: 'Surgery', source: 'opération au lit du patient',
    channels: [ch('blood', 6, 2, R.bench, { size: [.06, .1] }), ch('glint', 3, 1, R.bench), ch('bandage', 2, 1, steady(2))] }),
  spec({ id: 'feed-patient', label: 'Nourrir un patient', group: 'Soins', placement: 'patient', source: 'repas donné à un patient alité',
    channels: [ch('crumb', 4, 2, R.bench)] }),
  spec({ id: 'animal-tend', label: 'Soigner un animal', group: 'Animaux', placement: 'animal-body', source: 'soins vétérinaires',
    channels: [ch('bandage', 3, 1, steady(4)), ch('droplet', 3, 1, R.bench)] }),
  spec({ id: 'animal-feed', label: 'Nourrir un animal', group: 'Animaux', placement: 'animal-head', source: 'nourriture apportée à un animal',
    channels: [ch('crumb', 4, 2, R.bench)] }),
  spec({ id: 'tame', label: 'Apprivoiser, dresser, entretenir', group: 'Animaux', placement: 'animal-head', source: 'interaction avec un animal (friandises)',
    channels: [ch('crumb', 4, 2, steady(3)), ch('dust', 2, 1, steady(3), { size: [.2, .28], tint: false })] }),
  spec({ id: 'milk', label: 'Traire', group: 'Animaux', placement: 'animal-body', source: 'traite au contact de l’animal',
    channels: [ch('droplet', 6, 2, R.bench, { elevation: [-.6, .1], speed: [.3, .8] })] }),
  spec({ id: 'shear', label: 'Tondre', group: 'Animaux', placement: 'animal-body', source: 'tonte au contact de l’animal',
    channels: [ch('wool', 6, 3, R.bench)] }),
  spec({ id: 'slaughter', label: 'Abattre un animal', group: 'Animaux', placement: 'animal-body', source: 'abattage au contact de l’animal',
    channels: [ch('blood', 6, 3, R.bench)] }),
  spec({ id: 'clean', label: 'Nettoyer', group: 'Entretien', placement: 'ground-target', core: 'Clean', source: 'nettoyage des saletés',
    channels: [ch('dust', 4, 1, R.ground), ch('droplet', 4, 2, R.ground)] }),
  spec({ id: 'clear-snow', label: 'Déneiger', group: 'Entretien', placement: 'ground-target', core: 'ClearSnow', source: 'déneigement',
    channels: [ch('snow', 6, 3, R.ground), ch('dust', 2, 1, R.ground)] }),
  spec({ id: 'bury', label: 'Enterrer', group: 'Entretien', placement: 'ground-target', core: 'BuryPawn', source: 'inhumation dans une tombe',
    channels: [ch('soil', 6, 3, R.ground), ch('dust', 3, 1, R.ground)] }),
  spec({ id: 'strip', label: 'Dépouiller', group: 'Entretien', placement: 'hands-low', source: 'retrait des vêtements et objets',
    channels: [ch('cloth', 2, 1, R.ground), ch('dust', 2, 1, R.ground, { tint: false })] }),
  spec({ id: 'extinguish', label: 'Éteindre un feu', group: 'Entretien', placement: 'fire', source: 'battre un feu',
    channels: [ch('smoke', 4, 1, steady(7)), ch('ash', 4, 2, R.hammer), ch('ember', 4, 2, R.hammer)] }),
  spec({ id: 'open-casket', label: 'Ouvrir ou fermer un caisson', group: 'Entretien', placement: 'bench', source: 'caissons de cryptosommeil et caissons anciens',
    channels: [ch('smoke', 4, 1, steady(6), { gravity: .3, size: [.3, .44] })] }),
  spec({ id: 'eat-meal', label: 'Manger un repas', group: 'Besoins', placement: 'mouth', core: 'EatVegetarian', source: 'ingestion d’un repas',
    channels: [ch('crumb', 6, 3, steady(9), { spread: 1.4 })] }),
  spec({ id: 'eat-meat', label: 'Manger de la viande', group: 'Besoins', placement: 'mouth', core: 'EatMeat', source: 'ingestion de viande',
    channels: [ch('meat', 6, 3, steady(9), { spread: 1.4 })] }),
  spec({ id: 'drink', label: 'Boire', group: 'Besoins', placement: 'mouth', source: 'ingestion d’une boisson',
    channels: [ch('droplet', 3, 1, steady(9)), ch('foam', 2, 1, steady(9))] }),
  spec({ id: 'sleep', label: 'Dormir', group: 'Besoins', placement: 'sleeper-head', core: 'SleepZ', source: 'sommeil',
    channels: [ch('sleep-z', 3, 1, steady(2))] }),
  spec({ id: 'read', label: 'Lire', group: 'Loisirs', placement: 'hands', source: 'lecture d’un livre',
    channels: [ch('page', 2, 1, steady(2), { speed: [.15, .3], size: [.16, .22] })] }),
  spec({ id: 'play-billiards', label: 'Jouer au billard', group: 'Loisirs', placement: 'bench', source: 'partie de billard (craie)',
    channels: [ch('dust', 2, 1, steady(3), { size: [.18, .26] })] }),
  spec({ id: 'play-throw', label: 'Lancer (fer à cheval, anneau de pierre)', group: 'Loisirs', placement: 'ground-target', source: 'jeux de lancer, à la cible',
    channels: [ch('dust', 4, 1, steady(2)), ch('gravel', 4, 2, steady(2))] }),
  spec({ id: 'play-table', label: 'Jouer à une table', group: 'Loisirs', placement: 'bench', source: 'échecs, poker, jeu d’Ur',
    channels: [ch('glint', 2, 1, steady(2), { size: [.18, .24] })] }),
  spec({ id: 'haul-pickup', label: 'Ramasser', group: 'Transport', placement: 'feet', once: true, source: 'passage de « pickup » à « deliver » d’un transport',
    channels: [ch('dust', 3, 3, ONCE, { size: [.26, .36] }), ch('gravel', 2, 2, ONCE, { speed: [.4, .9] })] }),
  spec({ id: 'haul-drop', label: 'Déposer', group: 'Transport', placement: 'feet', once: true, source: 'fin d’un transport chargé',
    channels: [ch('dust', 4, 4, ONCE, { size: [.28, .4] })] }),
  spec({ id: 'rescue-lift', label: 'Soulever un blessé', group: 'Transport', placement: 'feet', once: true, source: 'passage de « approach » à « carry » d’un sauvetage',
    channels: [ch('dust', 4, 4, ONCE, { size: [.28, .4] })] }),
  spec({ id: 'melee-hit', label: 'Coup porté', group: 'Combat', placement: 'hit-target', once: true, source: 'coup au corps à corps confirmé sur un être de chair',
    channels: [ch('blood', 6, 6, ONCE, { speed: [.8, 1.9] }), ch('dust', 2, 2, ONCE, { size: [.22, .3], tint: false })] }),
  spec({ id: 'melee-hit-mech', label: 'Coup porté à un mécanoïde', group: 'Combat', placement: 'hit-target', once: true, source: 'coup au corps à corps confirmé sur un mécanoïde',
    channels: [ch('spark', 6, 6, ONCE), ch('glint', 1, 1, ONCE)] }),
  spec({ id: 'melee-hit-structure', label: 'Coup porté à un bâtiment', group: 'Combat', placement: 'hit-target', once: true, source: 'coup au corps à corps confirmé sur une structure',
    channels: [ch('stone-chip', 6, 6, ONCE, { tint: false }), ch('dust', 2, 2, ONCE, { tint: false })] }),
  spec({ id: 'graze', label: 'Brouter', group: 'Animaux', placement: 'muzzle', animal: true, source: 'animal qui mange une plante',
    channels: [ch('grass', 4, 2, steady(7), { speed: [.5, 1.1] }), ch('leaf', 2, 1, steady(7), { speed: [.4, .9] })] }),
  spec({ id: 'animal-eat', label: 'Manger (animal)', group: 'Animaux', placement: 'muzzle', animal: true, source: 'animal qui mange un tas (croquettes, foin, viande)',
    channels: [ch('crumb', 4, 2, steady(7), { speed: [.4, .9] })] }),
  spec({ id: 'animal-sleep', label: 'Dormir (animal)', group: 'Animaux', placement: 'animal-rest', animal: true, core: 'SleepZ', source: 'animal endormi',
    channels: [ch('sleep-z', 2, 1, steady(2), { size: [.2, .28] })] }),
] as const satisfies readonly ActionParticleSpec[]);
export type ActionParticleId = typeof ACTION_PARTICLES[number]['id'];
const ACTION_INDEX = new Map<string, number>(ACTION_PARTICLES.map((action, index) => [action.id, index + 1]));
/** Shader action index (1-based; 0 = no particles). */
export const actionParticleIndex = (id: ActionParticleId): number => ACTION_INDEX.get(id)!;
export const actionParticleSpec = (index: number): ActionParticleSpec | undefined => ACTION_PARTICLES[index - 1];
/** Pool slots per emitter: every action fits in this fixed quad budget. */
export const PARTICLE_SLOTS = 16;

/** Actions deliberately without particles, with the reason (for the page). */
export const ACTIONS_WITHOUT_PARTICLES = Object.freeze([
  { label: 'Regarder le ciel, admirer une œuvre, regarder la télévision', reason: 'activités contemplatives : rien ne se touche' },
  { label: 'Discuter, se détendre, fête, visite à un malade', reason: 'activités sociales : les bulles et animations du corps suffisent' },
  { label: 'Porter, marcher, se battre à distance', reason: 'le mouvement et les projectiles se voient déjà' },
  { label: 'Prier, méditer', reason: 'absent du jeu de base 1.6 sans extensions' },
  { label: 'Mener un animal à la corde', reason: 'la corde se voit déjà (lot des enclos)' },
] as const);

// ---------------------------------------------------------------- selection

/** Read-only lookups over one confirmed snapshot. */
export interface ActionParticleLookup {
  job(id: number): Job | undefined;
  structure(id: number): Structure | undefined;
  fire(id: number): FireRecord | undefined;
  pawn(id: number): Pawn | undefined;
  animal(id: number): WildAnimal | undefined;
  pile(id: number): MaterialPile | undefined;
  tile(x: number, z: number): Tile | undefined;
}
/** The chosen action and its physical target (cell centre, or contact point). */
export interface ActionParticleChoice {
  readonly action: ActionParticleId;
  readonly tx?: number; readonly tz?: number;
  /** Contact height (bench top), metres. */
  readonly ty?: number;
  /** Tint of tinted channels (0xRRGGBB). */
  readonly tint?: number;
  /** Eating seated at a table (lower mouth). */
  readonly seated?: true;
}

/** Bench tops, metres (WORLD_SCALE: table .76, stonecutter .85). Spots are on the floor. */
const BENCH_TOP: Partial<Record<StructureKind, number>> = {
  'fueled-stove': .95, 'electric-stove': .95, 'fueled-smithy': .9, 'electric-smithy': .9, 'machining-table': .88, 'fabrication-bench': .88,
  'tailor-bench': .84, 'electric-tailor-bench': .84, stonecutter: .85, 'art-bench': .84, 'research-bench': .8, 'hi-tech-research-bench': .82,
  'drug-lab': .9, brewery: 1, 'electric-crematorium': 1, 'electric-smelter': 1, 'biofuel-refinery': 1, 'butcher-table': .84,
  'crafting-spot': .12, 'butcher-spot': .12, campfire: .35,
};
const benchTop = (kind: StructureKind | undefined): number => (kind && BENCH_TOP[kind]) ?? .82;
/** Nearest footprint cell of a station, then the point .48 from its centre
 * towards the worker: the bench edge where the hands work. */
function benchContact(pawn: Cell, station: Structure): { x: number; z: number } {
  let best = Infinity, cx = station.x, cz = station.z;
  for (const cell of footprintCells(station)) { const d = (cell.x - pawn.x) ** 2 + (cell.z - pawn.z) ** 2; if (d < best) { best = d; cx = cell.x; cz = cell.z; } }
  const dx = pawn.x - cx, dz = pawn.z - cz, length = Math.hypot(dx, dz);
  return length > .001 ? { x: cx + dx / length * .48, z: cz + dz / length * .48 } : { x: cx, z: cz };
}
const atStation = (pawn: Pawn, action: ActionParticleId, station: Structure | undefined, tint?: number): ActionParticleChoice | undefined => {
  if (!station) return undefined;
  const contact = benchContact(pawn, station);
  return { action, tx: contact.x, tz: contact.z, ty: benchTop(station.kind), ...(tint === undefined ? {} : { tint }) };
};

const ORE_TINT: Readonly<Record<NonNullable<Tile['ore']>, number>> = {
  steel: 0x8e98a2, gold: 0xe2c25a, silver: 0xc9ccd0, jade: 0x77b08a, uranium: 0x6f7d70, plasteel: 0x9fc0c8, machinery: 0x8c8f88,
};
const SOIL = 0x8a6a48, WATER = 0xa8c8d8, MILK = 0xf3efe2, BEER = 0xd9a64a, MEDICINE = 0xa6d4a8, CHEMFUEL = 0xc0743a, WOOL = 0xf0e8d6, CLOTH = 0xe8dcc2;
const materialTint = (material: Job['material']): number => buildingMaterialColor(material) ?? 0xb0a898;
type MaterialFamily = 'wood' | 'stone' | 'metal' | 'cloth';
function materialFamily(material: Job['material']): MaterialFamily {
  if (!material || material === 'wood') return 'wood';
  if (material === 'steel' || String(material).includes('plasteel')) return 'metal';
  if (material === 'jade' || String(material).includes('block')) return 'stone';
  return 'cloth';
}
const itemTint = (pile: MaterialPile | undefined, fallback: number): number =>
  pile ? (ITEM_DEFINITIONS as unknown as Record<string, { color?: number } | undefined>)[pile.item]?.color ?? fallback : fallback;
const STATION_ACTION: Partial<Record<StructureKind, ActionParticleId>> = {
  'fueled-stove': 'cook', 'electric-stove': 'cook', campfire: 'cook', 'butcher-table': 'butcher', 'butcher-spot': 'butcher',
  'fueled-smithy': 'smith', 'electric-smithy': 'smith', 'machining-table': 'smith', 'fabrication-bench': 'machine',
  'tailor-bench': 'tailor', 'electric-tailor-bench': 'tailor', 'crafting-spot': 'craft-wood', stonecutter: 'stonecut', 'art-bench': 'sculpt',
  'electric-smelter': 'smelt', 'electric-crematorium': 'cremate', 'drug-lab': 'drugs', brewery: 'brew', 'biofuel-refinery': 'refine',
};
function billAction(recipe: NonNullable<Pawn['cooking']>['recipe'], station: Structure | undefined): ActionParticleId {
  if (recipe === 'smash-mechanoid' || recipe === 'shred-mechanoid') return 'butcher-mech';
  if (recipe === 'butcher-creature') return 'butcher';
  if (recipe === 'tribalwear' && station?.kind === 'crafting-spot') return 'tailor';
  return (station && STATION_ACTION[station.kind]) ?? (recipe ? 'machine' : 'cook');
}
const ROOF_JOBS = new Set<string>(['build-roof', 'remove-roof']);
const FLOOR_JOBS = new Set<string>(['lay-floor', 'remove-floor']);
const SIMPLE_JOBS: Readonly<Record<string, ActionParticleId>> = {
  harvest: 'harvest', sow: 'sow', 'extract-tree': 'transplant', 'replant-tree': 'transplant', 'smooth-wall': 'smooth-wall',
  'smooth-floor': 'smooth-floor', 'build-bridge': 'bridge', 'remove-bridge': 'bridge', repair: 'repair', 'fix-breakdown': 'repair',
  install: 'install', flick: 'install',
};

/** The action of one human in a confirmed snapshot, or undefined. Pure: it
 * reads the snapshot only, allocates one small object, never a random value. */
export function actionParticleForPawn(pawn: Pawn, lookup: ActionParticleLookup): ActionParticleChoice | undefined {
  if (pawn.state === 'dead' || pawn.body?.pileId !== undefined || pawn.body?.lostAt !== undefined || pawn.stun) return undefined;
  if (pawn.state === 'sleeping') return { action: 'sleep' };
  const need = pawn.need;
  if (pawn.state === 'eating' && need?.kind === 'eat' && need.phase === 'ingest') {
    const pile = lookup.pile(need.carryPileId ?? need.sourcePileId ?? -1);
    const seated = need.dining?.seatId !== null && need.dining?.seatId !== undefined;
    const item = pile?.item ?? '';
    const action: ActionParticleId = need.alcoholReason || pile?.kind === 'beer' ? 'drink' : isAnimalMeat(item) || /meat/.test(item) ? 'eat-meat' : 'eat-meal';
    return { action, ...(seated ? { seated: true } : {}), tint: action === 'drink' ? BEER : itemTint(pile, 0xd8b680) };
  }
  const joy = pawn.recreation?.task;
  if (joy && joy.phase === 'active' && pawn.state !== 'working') {
    if (joy.activity === 'read') return { action: 'read' };
    const building = joy.buildingId === null ? undefined : lookup.structure(joy.buildingId);
    if (joy.activity === 'billiards') return atStation(pawn, 'play-billiards', building, 0x7fa6c8);
    if (joy.activity === 'chess' || joy.activity === 'poker' || joy.activity === 'game-of-ur') return atStation(pawn, 'play-table', building);
    if (joy.activity === 'horseshoes' || joy.activity === 'hoopstone') return { action: 'play-throw', tx: joy.target.x, tz: joy.target.z, tint: SOIL };
    return undefined;
  }
  if (pawn.state !== 'working') return undefined;
  const haul = pawn.haul;
  if (haul?.serviceProgress !== undefined && haul.phase === 'deliver') {
    const d = haul.destination, station = 'structureId' in d ? lookup.structure(d.structureId) : undefined;
    if (d.type === 'turret') return atStation(pawn, 'rearm', station);
    if (d.type === 'fermenting-barrel') return atStation(pawn, 'fill-barrel', station, BEER);
    if (d.type === 'fuel') { const carried = lookup.pile(haul.carryPileId ?? -1); return atStation(pawn, 'refuel', station, carried?.kind === 'chemfuel' ? CHEMFUEL : itemTint(carried, 0xc8a070)); }
  }
  if (pawn.firefighting?.phase === 'beat') {
    const fire = lookup.fire(pawn.firefighting.fireId);
    return fire ? { action: 'extinguish', tx: fire.x, tz: fire.z, tint: 0x8d8a86 } : undefined;
  }
  const cooking = pawn.cooking;
  if (cooking?.phase === 'work') {
    const station = lookup.structure(cooking.stationId);
    if (!station) return undefined;
    const action = billAction(cooking.recipe, station);
    const tint = action === 'stonecut' || action === 'sculpt' ? stoneColor() : action === 'tailor' ? CLOTH : action === 'drugs' ? MEDICINE
      : action === 'refine' ? CHEMFUEL : action === 'brew' ? BEER : action === 'butcher-mech' ? 0xa4aaae : action === 'cook' ? 0xe6c48e : undefined;
    return atStation(pawn, action, station, tint);
  }
  if (pawn.research) return atStation(pawn, 'research', lookup.structure(pawn.research.stationId));
  if (pawn.deepWork) { const station = lookup.structure(pawn.deepWork.structureId); return atStation(pawn, pawn.deepWork.kind === 'scan' ? 'scan' : 'deep-drill', station, 0x8f857a); }
  if (pawn.brewing) return atStation(pawn, 'barrel-extract', lookup.structure(pawn.brewing.barrelId), BEER);
  const casket = pawn.cryptosleepTask?.phase === 'closing' || pawn.cryptosleepTask?.phase === 'opening' ? pawn.cryptosleepTask.casketId
    : pawn.openCasket?.phase === 'opening' ? pawn.openCasket.casketId : undefined;
  if (casket !== undefined) return atStation(pawn, 'open-casket', lookup.structure(casket), 0xdfe8ee);
  if (pawn.tend?.phase === 'tend') { const patient = lookup.pawn(pawn.tend.patientId); return patient ? { action: 'tend', tx: patient.x, tz: patient.z, tint: WATER } : undefined; }
  if (pawn.surgery?.phase === 'work') { const patient = lookup.pawn(pawn.surgery.patientId); return patient ? { action: 'surgery', tx: patient.x, tz: patient.z } : undefined; }
  if (pawn.feed?.phase === 'feed') { const patient = lookup.pawn(pawn.feed.patientId); return patient ? { action: 'feed-patient', tx: patient.x, tz: patient.z, tint: itemTint(lookup.pile(pawn.feed.carryPileId ?? -1), 0xd8b680) } : undefined; }
  if (pawn.animalCare?.phase === 'treat') { const animal = lookup.animal(pawn.animalCare.animalId); return animal ? { action: 'animal-tend', tx: animal.x, tz: animal.z, tint: WATER } : undefined; }
  if (pawn.animalFeed?.phase === 'feed') { const animal = lookup.animal(pawn.animalFeed.animalId); return animal ? { action: 'animal-feed', tx: animal.x, tz: animal.z, tint: itemTint(lookup.pile(pawn.animalFeed.carryPileId ?? -1), 0xc9a86a) } : undefined; }
  const handling = pawn.animalHandling;
  if (handling?.phase === 'interact') {
    const animal = lookup.animal(handling.animalId);
    if (!animal) return undefined;
    const at = { tx: animal.x, tz: animal.z };
    if (handling.kind === 'milk') return { action: 'milk', ...at, tint: MILK };
    if (handling.kind === 'shear') return { action: 'shear', ...at, tint: WOOL };
    if (handling.kind === 'slaughter') return { action: 'slaughter', ...at };
    if (handling.kind === 'tame' || handling.kind === 'train' || handling.kind === 'maintain') return { action: 'tame', ...at, tint: 0xc9a86a };
    return undefined;
  }
  if (pawn.cleaning?.phase === 'clean') {
    // The worked filth is the first target; its cell is not in the task, so
    // the particles stay at the cleaner's hands on the floor.
    return pawn.cleaning.snowCell !== undefined ? { action: 'clear-snow', tint: 0xf4f6f8 } : { action: 'clean', tint: 0xb8ab98 };
  }
  if (pawn.burial?.phase === 'bury') { const grave = lookup.structure(pawn.burial.graveId); return grave ? { action: 'bury', tx: grave.x, tz: grave.z, tint: SOIL } : { action: 'bury', tint: SOIL }; }
  if (pawn.strip351?.phase === 'strip') return { action: 'strip', tint: CLOTH };
  if (pawn.jobId !== null) {
    const job = lookup.job(pawn.jobId);
    if (!job || job.status !== 'active' || job.reservedBy !== pawn.id) return undefined;
    const at = { tx: job.x, tz: job.z };
    if (job.kind === 'chop') return { action: 'chop-tree', ...at };
    if (job.kind === 'cut' || job.clearance) return { action: 'cut-plant', ...at };
    if (job.kind === 'mine') {
      const tile = lookup.tile(job.x, job.z);
      return { action: 'mine', ...at, tint: tile?.ore ? ORE_TINT[tile.ore] : stoneColor(tile?.stone) };
    }
    if (job.kind === 'smooth-wall' || job.kind === 'smooth-floor') return { action: SIMPLE_JOBS[job.kind]!, ...at, tint: stoneColor(lookup.tile(job.x, job.z)?.stone) };
    if (job.kind === 'sow' || job.kind === 'harvest' || job.kind === 'extract-tree' || job.kind === 'replant-tree') return { action: SIMPLE_JOBS[job.kind]!, ...at, tint: SOIL };
    if (SIMPLE_JOBS[job.kind]) return { action: SIMPLE_JOBS[job.kind]!, ...at, tint: job.kind === 'build-bridge' || job.kind === 'remove-bridge' ? WATER : undefined };
    if (ROOF_JOBS.has(job.kind)) return { action: 'roof', ...at };
    if (FLOOR_JOBS.has(job.kind)) return { action: 'floor-work', ...at, tint: job.floor && /carpet|matting/.test(job.floor) ? CLOTH : job.floor && /wood/.test(job.floor) ? 0xc8a070 : 0xa8a49a };
    if (job.kind === 'deconstruct' || job.kind === 'uninstall') return { action: 'deconstruct', ...at, tint: materialTint(job.material) };
    const family = materialFamily(job.material);
    const action: ActionParticleId = family === 'metal' ? 'build-metal' : family === 'stone' ? 'build-stone' : family === 'cloth' ? 'build-cloth' : 'build-wood';
    return { action, ...at, tint: materialTint(job.material) };
  }
  return undefined;
}

/** The action of one animal in a confirmed snapshot, or undefined. */
export function actionParticleForAnimal(animal: WildAnimal): ActionParticleChoice | undefined {
  if (animal.state === 'sleeping') return { action: 'animal-sleep' };
  if (animal.state === 'eating' && animal.meal) return animal.meal.kind === 'plant' ? { action: 'graze' } : { action: 'animal-eat', tint: 0xc9a86a };
  return undefined;
}

/** Per-actor memory between confirmed snapshots, to detect events (pick-up,
 * drop, lift, hit). Presentation only, never saved. */
export interface ActionParticleMemory { haulPhase: 'pickup' | 'deliver' | ''; carrying: boolean; lifting: boolean; strikeAt: number }
export const emptyActionParticleMemory = (): ActionParticleMemory => ({ haulPhase: '', carrying: false, lifting: false, strikeAt: -1 });
export interface ActionParticleEvent { readonly action: ActionParticleId; readonly tick: number; readonly tx?: number; readonly tz?: number; readonly ty?: number; readonly tint?: number }
/** Events of one human between two snapshots; updates the memory. The first
 * snapshot of an actor only records its state (no event for the past). */
export function actionParticleEvents(memory: ActionParticleMemory | undefined, pawn: Pawn, tick: number, lookup: ActionParticleLookup,
  out: ActionParticleEvent[]): ActionParticleMemory {
  const next = memory ?? emptyActionParticleMemory();
  const haul = pawn.haul, carrying = !!haul && haul.carryPileId !== null, lifting = pawn.rescue?.phase === 'carry';
  const strike = pawn.melee?.strike;
  if (memory) {
    if (haul && memory.haulPhase === 'pickup' && haul.phase === 'deliver' && carrying) out.push({ action: 'haul-pickup', tick });
    else if (memory.carrying && !carrying && pawn.state !== 'dead') out.push({ action: 'haul-drop', tick });
    if (lifting && !memory.lifting) out.push({ action: 'rescue-lift', tick });
    if (strike && strike.outcome === 'hit' && strike.atCore !== memory.strikeAt) {
      // The lunge peaks 0.125 s after the strike (PawnLayer: sin(4π·Δt)).
      const at = strike.atCore / 10 + .125 * TICKS_PER_SECOND;
      if (strike.structure) out.push({ action: 'melee-hit-structure', tick: at, tx: strike.structure.x, tz: strike.structure.z, ty: .9 });
      else if (strike.targetId !== null) {
        const human = lookup.pawn(strike.targetId), animal = human ? undefined : lookup.animal(strike.targetId);
        const target = human ?? animal;
        if (target) out.push({ action: 'melee-hit', tick: at, tx: target.x, tz: target.z, ty: human ? 1.05 : .55 });
        else out.push({ action: 'melee-hit-mech', tick: at, ty: 1 });
      }
    }
  }
  next.haulPhase = haul?.phase ?? ''; next.carrying = carrying; next.lifting = lifting; next.strikeAt = strike?.atCore ?? -1;
  return next;
}

// ---------------------------------------------------------------- placement

export interface ParticlePose { x: number; y: number; z: number; yaw: number }
/** Birth point, launch direction on the ground plane and the floor height. */
export interface ParticleAnchor { x: number; y: number; z: number; dirX: number; dirZ: number; ground: number }
/** Anchor of an action from the actor's presented pose and its target. The
 * human rig faces +Z at yaw 0 (yaw = atan2(dx, dz)). */
export function placeActionParticles(rule: PlacementRule, pose: ParticlePose, choice: Pick<ActionParticleChoice, 'tx' | 'tz' | 'ty' | 'seated'>,
  out: ParticleAnchor = { x: 0, y: 0, z: 0, dirX: 0, dirZ: 0, ground: 0 }): ParticleAnchor {
  const fx = Math.sin(pose.yaw), fz = Math.cos(pose.yaw);
  const hasTarget = choice.tx !== undefined && choice.tz !== undefined;
  const tx = hasTarget ? choice.tx! : pose.x + fx * .6, tz = hasTarget ? choice.tz! : pose.z + fz * .6;
  // Unit vector from the target towards the actor (the side the actor works from).
  let wx = pose.x - tx, wz = pose.z - tz;const length = Math.hypot(wx, wz);
  if (length > .001) { wx /= length; wz /= length; } else { wx = -fx; wz = -fz; }
  const set = (x: number, y: number, z: number, dirX: number, dirZ: number, ground = pose.y) => {
    out.x = x; out.y = y; out.z = z; out.dirX = dirX; out.dirZ = dirZ; out.ground = ground; return out;
  };
  switch (rule) {
    case 'tree-trunk': return set(tx + wx * .24, .95, tz + wz * .24, wx, wz, 0);
    case 'rock-face': {
      // Axis-aligned rock block: the face towards the miner, its centre moved
      // along the face towards the miner's side.
      const alongX = Math.abs(wx) >= Math.abs(wz), nx = alongX ? Math.sign(wx) : 0, nz = alongX ? 0 : Math.sign(wz);
      return set(tx + nx * .53 + (alongX ? 0 : wx * .25), 1.05, tz + nz * .53 + (alongX ? wz * .25 : 0), nx, nz, 0);
    }
    case 'work-target': return set(tx + wx * .42, .75, tz + wz * .42, wx, wz, 0);
    case 'overhead': return set(tx, 2.55, tz, wx, wz, 0);
    // Hands of the crouched worker over the worked cell, above the grass.
    case 'ground-target': return hasTarget ? set(tx + wx * .32, .38, tz + wz * .32, wx, wz, 0) : set(pose.x + fx * .5, pose.y + .38, pose.z + fz * .5, -fx, -fz);
    case 'hands-low': return set(pose.x + fx * .45, pose.y + .3, pose.z + fz * .45, fx, fz);
    case 'hands': return set(pose.x + fx * .36, pose.y + 1, pose.z + fz * .36, fx, fz);
    case 'bench': return hasTarget ? set(tx, (choice.ty ?? .82) + .06, tz, wx, wz, choice.ty !== undefined && choice.ty > .3 ? choice.ty : 0) : set(pose.x + fx * .4, pose.y + .9, pose.z + fz * .4, -fx, -fz);
    case 'mouth': return set(pose.x + fx * .26, pose.y + (choice.seated ? 1.08 : 1.38), pose.z + fz * .26, fx, fz, choice.seated ? pose.y + .76 : pose.y);
    case 'sleeper-head': return set(pose.x - fx * .7, pose.y + .58, pose.z - fz * .7, 0, 0);
    case 'animal-rest': return set(pose.x + fx * .35, pose.y + .5, pose.z + fz * .35, 0, 0);
    case 'patient': return set(tx, .66, tz, wx, wz, .5);
    case 'animal-body': return set(tx + wx * .2, .5, tz + wz * .2, wx, wz, 0);
    case 'animal-head': return set(tx + wx * .35, .55, tz + wz * .35, wx, wz, 0);
    case 'muzzle': return set(pose.x + fx * .42, pose.y + .25, pose.z + fz * .42, fx, fz);
    case 'fire': return set(tx, .28, tz, wx, wz, 0);
    case 'feet': return set(pose.x + fx * .45, pose.y + .2, pose.z + fz * .45, fx, fz);
    case 'hit-target': return hasTarget ? set(tx, choice.ty ?? .9, tz, -wx, -wz, 0) : set(pose.x + fx * .7, choice.ty ?? .9, pose.z + fz * .7, fx, fz);
  }
}

// ---------------------------------------------------------- reference model

/** Same uint PCG as Three's TSL `hash` (pcg-random.org). */
export function particleHash(seed: number): number {
  const state = (Math.imul(seed >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0;
  return Math.fround((((word >>> 22) ^ word) >>> 0) / 4294967296);
}
/** Integer key of one particle: emitter seed, burst (mod omega, so the clock
 * wrap keeps identities), index in the burst and channel. */
export const particleKey = (seed: number, burst: number, index: number, channel: number): number =>
  ((seed * 4099 + burst * 131 + index * 17 + channel * 7919) >>> 0);
export const TIME_WRAP = 2 * Math.PI;
const positiveMod = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus;

/** One particle at the presentation time, computed exactly as the shader does
 * (the GPU is the only per-frame evaluator; this mirror serves tests and the
 * animations page). Returns undefined when the slot shows nothing. */
export interface ParticleState { x: number; y: number; z: number; size: number; rotation: number; alpha: number; cell: number; channel: number }
export function sampleActionParticle(action: ActionParticleSpec, slot: number, anchor: ParticleAnchor, seed: number, strokeOffset: number,
  time: number, start = -1, minSize = 0): ParticleState | undefined {
  let first = 0, channelIndex = -1;
  for (let c = 0; c < action.channels.length; c++) { const slots = action.channels[c]!.slots; if (slot < first + slots) { channelIndex = c; break; } first += slots; }
  if (channelIndex < 0) return undefined;
  const channel = action.channels[channelIndex]!, local = slot - first, index = local % channel.burst, group = Math.floor(local / channel.burst);
  const groups = Math.floor(channel.slots / channel.burst);
  let age: number, burst: number;
  if (start >= 0) { age = positiveMod(time - start, TIME_WRAP); burst = 0; }
  else {
    const omega = channel.rhythm.omega, u = (omega * time + strokeOffset - channel.rhythm.phase) / TIME_WRAP;
    burst = group + groups * Math.floor((u - group) / groups);
    age = (u - burst) * TIME_WRAP / omega;
    burst = positiveMod(burst, omega);
  }
  if (age < 0 || age > channel.life) return undefined;
  const key = particleKey(seed, burst, index, channelIndex), r = (n: number) => particleHash(key + n * 0x9e3779b1);
  // Launch direction: the emitter direction turned by up to ±spread.
  const length = Math.hypot(anchor.dirX, anchor.dirZ), dx = length > .001 ? anchor.dirX / length : 0, dz = length > .001 ? anchor.dirZ / length : 1;
  const turn = (r(1) * 2 - 1) * channel.spread, ux = dx * Math.cos(turn) + dz * Math.sin(turn), uz = dz * Math.cos(turn) - dx * Math.sin(turn);
  const elevation = channel.elevation[0] + (channel.elevation[1] - channel.elevation[0]) * r(2);
  const speed = channel.speed[0] + (channel.speed[1] - channel.speed[0]) * r(3);
  const horizontal = Math.cos(elevation) * speed, vy = Math.sin(elevation) * speed;
  const jitter = channel.radius * Math.sqrt(r(4)), jitterAngle = r(5) * TIME_WRAP;
  const x0 = anchor.x + Math.cos(jitterAngle) * jitter, z0 = anchor.z + Math.sin(jitterAngle) * jitter, y0 = anchor.y + (r(6) - .5) * channel.radius;
  // Ballistic in Y with an optional landing; horizontal drag; sideways flutter.
  let t = age;
  if (channel.land && channel.gravity > 0) {
    const drop = Math.max(0, y0 - anchor.ground), landing = (vy + Math.sqrt(vy * vy + 2 * channel.gravity * drop)) / channel.gravity;
    t = Math.min(age, landing);
  }
  const travel = channel.drag > .001 ? (1 - Math.exp(-channel.drag * t)) / channel.drag : t;
  const sway = Math.sin(age * 6 + r(7) * TIME_WRAP) * channel.sway;
  const x = x0 + ux * horizontal * travel + uz * sway, z = z0 + uz * horizontal * travel - ux * sway;
  const fall = y0 + vy * t - .5 * channel.gravity * t * t, y = channel.land ? Math.max(anchor.ground + .01, fall) : fall;
  const size = Math.max(channel.size[0] + (channel.size[1] - channel.size[0]) * r(8), minSize * (.85 + .3 * r(8))) * (1 + channel.growth * age / channel.life);
  const spinSign = r(9) < .5 ? -1 : 1, rotation = r(10) * TIME_WRAP + spinSign * channel.spin * t;
  const fadeIn = channel.fadeIn > 0 ? Math.min(1, age / channel.fadeIn) : 1, fadeOut = channel.fadeOut > 0 ? Math.min(1, (channel.life - age) / channel.fadeOut) : 1;
  const family = familyInfo(channel.family), cell = FAMILY_FIRST_CELL[channel.family] + Math.min(family.variants - 1, Math.floor(r(11) * family.variants));
  return { x, y, z, size, rotation, alpha: Math.max(0, fadeIn * fadeOut), cell, channel: channelIndex };
}
/** Stable emitter seed of an actor (0..1023). */
export const actorParticleSeed = (id: number): number => (Math.imul(id >>> 0, 2654435761) >>> 22);
/** Stroke offset of the human rig (PawnLayer: motion.w = id × 1.7). */
export const actorStrokeOffset = (id: number): number => positiveMod(id * 1.7, TIME_WRAP);
/** Confirmed presentation clock of the particles (and of the human rig with tracks). */
export const particleClock = (tick: number): number => positiveMod(tick / TICKS_PER_SECOND, TIME_WRAP);
export type { World };
