/* Data of the sounds page (sounds-review.html): every sound event the game
 * plays, read with the game's own manifest reader, and every music title of
 * MUSIC_TRACKS, grouped by family, with their gains and the loudness measured
 * by the calibration scripts (scripts/audio/*.json) when it is known.
 * Pure data: no browser global, so a test can count it against the tables. */
import type { AudioManifest } from './AudioDirector';
import type { MusicMood, MusicTrack } from './MusicDirector';

export type SoundFamilyId = 'notifications' | 'interface' | 'work' | 'buildings' | 'combat' | 'creatures' | 'environment' | 'other';

export const SOUND_FAMILIES: readonly { id: SoundFamilyId; label: string }[] = [
  { id: 'notifications', label: 'Lettres, alertes et messages' },
  { id: 'interface', label: 'Interface' },
  { id: 'work', label: 'Travaux et gestes des colons' },
  { id: 'buildings', label: 'Bâtiments, portes et machines' },
  { id: 'combat', label: 'Combat' },
  { id: 'creatures', label: 'Douleur et mort des humains et des animaux' },
  { id: 'environment', label: 'Météo et ambiance' },
  { id: 'other', label: 'Autres sons' },
];

export const MUSIC_MOOD_LABELS: Record<MusicMood, string> = { day: 'Jour', night: 'Nuit', tension: 'Tension' };

const WORK = ['mining', 'woodcutting', 'construction', 'cooking', 'crafting', 'tailoring', 'butchering', 'research',
  'haul', 'farming', 'eating', 'cleaning', 'medical', 'maintenance', 'deconstruction', 'firefighting'];
const BUILDINGS = ['door', 'autodoor', 'fencegate', 'power', 'machine', 'building'];
const NOTIFICATION_UI = new Set(['ui.threat', 'ui.colonist-death', 'ui.colonist-downed', 'ui.research-complete']);

export function soundFamily(kind: string): SoundFamilyId {
  const prefix = kind.split('.')[0]!;
  if (prefix === 'letter' || prefix === 'alert' || prefix === 'tutorial' || prefix === 'quest' || NOTIFICATION_UI.has(kind)) return 'notifications';
  if (prefix === 'ui') return 'interface';
  if (WORK.includes(prefix)) return 'work';
  if (BUILDINGS.includes(prefix)) return 'buildings';
  if (prefix === 'weapon') return 'combat';
  if (prefix === 'animal' || prefix === 'human') return 'creatures';
  if (prefix === 'weather' || prefix === 'ambient') return 'environment';
  return 'other';
}

/** Where a sound is heard in a game (French, shown on the page). */
const HINTS: Record<string, string> = {
  'letter.threat-big': 'Lettre de grande menace : raid, camp repéré, danger ancien.',
  'letter.threat-small': 'Lettre de petite menace : rage meurtrière ou berserk d’un colon.',
  'letter.negative': 'Lettre négative : crise mentale, piège déclenché par un colon.',
  'letter.neutral': 'Lettre neutre.',
  'letter.positive': 'Lettre positive : inspiration, recrutement, nouvelle quête.',
  'alert.high': 'Une alerte importante apparaît à droite (cloche, au plus une fois par demi-seconde).',
  'alert.critical': 'Une alerte critique apparaît (double cloche).',
  'tutorial.lesson-appear': 'Tutoriel : une carte de leçon apparaît.',
  'tutorial.lesson-complete': 'Tutoriel : la leçon est réussie.',
  'quest.accepted': 'Accepter une quête.',
  'ui.threat': 'Nouvelle menace : page « Nouvelle menace » et événements graves.',
  'ui.colonist-death': 'Un colon meurt.',
  'ui.colonist-downed': 'Un colon tombe à terre (blessure, douleur, maladie).',
  'ui.research-complete': 'Une recherche est terminée.',
  'ui.click': 'Clic sur un bouton qui n’a pas de son propre.',
  'ui.reject': 'Geste refusé ou impossible.',
  'ui.panel': 'Ouverture d’une fenêtre ou d’un panneau sans son propre.',
  'ui.tab-open': 'Ouvrir un onglet du bas, la palette Ordres ou Zones.',
  'ui.tab-close': 'Refermer cet onglet, Échap ou bouton Retour d’une page.',
  'ui.toggle-on': 'Boutons de vue en bas à droite : murs coupés, toits, feuillage, zones activés.',
  'ui.toggle-off': 'Les mêmes boutons désactivés.',
  'ui.clock-pause': 'Mettre en pause (bouton ou Espace).',
  'ui.clock-run': 'Vitesses ×1, ×3, ×6 (la même prise, plus aiguë à chaque vitesse).',
  'ui.tool-select': 'Choisir un outil : ordre, zone ou plan de l’Architecte.',
  'ui.designate': 'Désigner miner, abattre, récolter, déconstruire, chasser…',
  'ui.designate-zone': 'Tracer une zone de stockage, de culture, une aire ou le domicile.',
  'ui.designate-cancel': 'Annuler une désignation ou retirer une zone.',
  'ui.place-building': 'Poser un plan de construction, un sol, un mur en ligne.',
  'ui.draft-on': 'Mobiliser un colon.',
  'ui.draft-off': 'Démobiliser.',
  'ui.order': 'Ordre direct : déplacer un colon mobilisé, ordre du menu contextuel.',
  'ui.select': 'Sélectionner un colon, un animal ou un objet.',
  'ui.trade-open': 'Ouvrir le commerce avec des visiteurs ou un vaisseau.',
  'ui.trade-execute': 'Conclure l’échange.',
  'mining.hit': 'Coups de pioche d’un colon qui mine.',
  'woodcutting.hit': 'Coups de hache sur un arbre.',
  'woodcutting.fell': 'Un arbre abattu tombe.',
  'construction.hit': 'Construire ou réparer.',
  'cooking.work': 'Cuisiner à un fourneau.',
  'crafting.work': 'Fabriquer à un établi.',
  'tailoring.work': 'Coudre à l’établi de couture.',
  'butchering.work': 'Découper une carcasse.',
  'research.work': 'Étudier à un pupitre de recherche.',
  'haul.pickup': 'Ramasser un objet.',
  'haul.drop': 'Déposer un objet.',
  'farming.sow': 'Semer.',
  'farming.harvest': 'Récolter une plante.',
  'eating.work': 'Manger.',
  'cleaning.work': 'Nettoyer la saleté ou déneiger.',
  'medical.tend': 'Soigner un blessé ou un malade.',
  'maintenance.work': 'Entretenir ou réparer une machine en panne.',
  'deconstruction.work': 'Déconstruire.',
  'firefighting.beat': 'Battre un feu pour l’éteindre.',
  'door.open': 'Une porte manuelle s’ouvre.',
  'door.close': 'Une porte manuelle se ferme.',
  'autodoor.open': 'Une porte automatique s’ouvre.',
  'autodoor.close': 'Une porte automatique se ferme.',
  'fencegate.move': 'Un portail de clôture s’ouvre ou se ferme.',
  'power.switch-on': 'Un colon allume un interrupteur.',
  'power.switch-off': 'Un colon éteint un interrupteur.',
  'machine.wind-turbine': 'Boucle d’une éolienne qui tourne.',
  'machine.wood-generator': 'Boucle d’un générateur à bois allumé.',
  'building.complete': 'Un ouvrage est achevé.',
  'building.deconstructed': 'Un bâtiment déconstruit tombe en pièces.',
  'weapon.gunshot': 'Coup de feu.',
  'weapon.melee': 'Coup au corps à corps.',
  'weapon.impact-ground': 'Une balle frappe le sol.',
  'weapon.impact-barrier': 'Une balle frappe un mur, une barricade ou un objet.',
  'weapon.impact-flesh': 'Une balle touche une personne ou un animal.',
  'weapon.explosion': 'Explosion (réutilise les prises de « weapon.impact-barrier », un peu moins fort).',
  'weather.rain': 'Boucle de pluie.',
  'weather.wind': 'Boucle de vent.',
  'weather.thunder': 'Coup de tonnerre près d’un éclair.',
  'ambient.fire': 'Boucle d’un feu qui brûle.',
  'human.hurt.male': 'Cri de douleur d’un homme blessé.',
  'human.hurt.female': 'Cri de douleur d’une femme blessée.',
};

/** Game sounds of 22 November: where each one is heard. */
const GAME_HINTS: Record<string, string> = {
  'haul.drop-wood': 'Déposer du bois.', 'haul.drop-metal': 'Déposer de l’acier, du plastacier ou de l’uranium.',
  'haul.drop-silver': 'Déposer de l’argent ou de l’or.', 'haul.drop-stone': 'Déposer des blocs de pierre.',
  'haul.drop-chunk': 'Déposer un fragment de roche ou du jade.', 'haul.drop-slag': 'Déposer un fragment de scories.',
  'haul.drop-grain': 'Déposer du riz ou du maïs.', 'haul.drop-corpse': 'Déposer un cadavre.',
  'construction.metal': 'Construire en métal ou en pierre, ou un bâtiment sans matériau.',
  'construction.dirt': 'Poser un sol (dalles, pavage, béton, tapis, paille), creuser une tombe.',
  'crafting.smith': 'Forger : armes de mêlée, armures, armes à feu, prothèses.',
  'crafting.machining': 'Usiner : composants, armures de reconnaissance et pare-éclats.',
  'crafting.stonecut': 'Tailler des blocs de pierre.', 'crafting.smelt': 'Fondre au four électrique.',
  'crafting.brew': 'Brasser le moût.', 'crafting.drug': 'Préparer un médicament au laboratoire.',
  'crafting.sculpt': 'Sculpter à l’établi d’art.', 'crafting.bow': 'Fabriquer un arc.',
  'crafting.cremate': 'Incinérer, brûler des vêtements, raffiner du carburant.',
  'crafting.mech': 'Démonter ou broyer un mécanoïde.', 'medical.surgery': 'Opérer un patient.',
  'farming.harvest-finish': 'Une plante est récoltée ou coupée.',
  'eating.vegetable': 'Manger un légume cru, des baies, du maïs, des croquettes.',
  'eating.meat': 'Manger de la viande crue ou un œuf.', 'eating.drink': 'Boire une bière.',
  'eating.pill': 'Prendre un médicament en pilule.',
  'weapon.shot-pistol': 'Tir de revolver ou de pistolet.', 'weapon.shot-rifle': 'Tir de fusil à verrou ou de fusil d’assaut.',
  'weapon.shot-sniper': 'Tir de fusil de précision.', 'weapon.shot-shotgun': 'Tir de fusil à pompe ou de fusil à chaîne.',
  'weapon.shot-auto': 'Tir de pistolet-mitrailleur ou de mitrailleuse légère.',
  'weapon.shot-bow': 'Tir à l’arc (plus grave pour le grand arc).', 'weapon.shot-launcher': 'Tir du lanceur EMP.',
  'weapon.shot-charge': 'Tir du lancier mécanoïde.', 'weapon.shot-needle': 'Tir du piquier mécanoïde.',
  'weapon.melee-sharp': 'Coup d’une lame en métal (épée, lance, couteau).', 'weapon.melee-blunt': 'Coup de masse en métal.',
  'weapon.melee-wood': 'Coup d’une arme en bois.', 'weapon.melee-scratch': 'Griffure ou morsure d’un petit animal.',
  'weapon.melee-bash': 'Charge d’un grand animal.', 'weapon.melee-mech': 'Coup de lame d’un mécanoïde.',
  'weapon.melee-miss': 'Coup manqué ou esquivé.',
  'ambient.night-insects': 'Boucle des insectes de nuit (biomes tempérés, boréaux, toundra, broussailles), par temps doux.',
  'weather.wind-clear': 'Boucle de vent léger par temps clair, brouillard ou neige légère.',
  'weather.wind-storm': 'Boucle de vent d’orage ou de tempête de neige.',
  'machine.chemfuel-generator': 'Boucle d’un générateur à carburant allumé.',
  'machine.geothermal': 'Boucle d’une centrale géothermique allumée.',
};
const VOICE_FAMILY_LABELS: Record<string, string> = {
  canine: 'chiens et loups', feline: 'chats', 'big-cat': 'grands félins', bear: 'ours', bovine: 'muffalos, yaks, bisons et boomalopes',
  cervid: 'cerfs, gazelles, bouquetins, élans, alpagas et caribous', equine: 'chevaux, ânes et dromadaires',
  pachyderm: 'éléphants, rhinocéros et mégaparesseux', boar: 'sangliers', rodent: 'lièvres et rongeurs', bird: 'canards',
  chick: 'poussins (petits des oiseaux)', reptile: 'reptiles', insect: 'insectes géants', primate: 'singes',
  herbivore: 'herbivores', 'predator-large': 'grands prédateurs', 'predator-small': 'petits carnivores',
};
const VOICE_VERBS: Record<string, string> = { call: 'Cri spontané', angry: 'Cri agressif', hurt: 'Cri de douleur', death: 'Cri de mort', eat: 'Repas' };

export function soundHint(kind: string): string {
  const known = HINTS[kind] ?? GAME_HINTS[kind];
  if (known) return known;
  const family = /^animal\.(call|angry|hurt|death|eat)\.(.+)$/.exec(kind);
  if (family && VOICE_FAMILY_LABELS[family[2]!]) return `${VOICE_VERBS[family[1]!]} des animaux : ${VOICE_FAMILY_LABELS[family[2]!]}.`;
  const animal = /^animal\.(hurt|death)\.(.+)$/.exec(kind);
  if (animal) return `${animal[1] === 'hurt' ? 'Cri de douleur' : 'Cri de mort'} d’un animal : voix « ${animal[2]} », partagée par les espèces proches.`;
  return '';
}

export interface LevelMeasure {
  /** RMS of the file (active part when the calibration measured it), dBFS. */
  rmsDbfs?: number;
  peakDbfs?: number;
  /** Ungated K-weighted loudness (BS.1770) when measured. */
  lufs?: number;
  /** Which calibration file gave the figures. */
  source: string;
}

export interface SoundTake { src: string; file: string; gain: number; measure?: LevelMeasure }
export interface SoundEntry {
  kind: string;
  family: SoundFamilyId;
  hint: string;
  gain: number;
  loop: boolean;
  spatial: boolean;
  maxDistance: number;
  takes: SoundTake[];
  /** A take of the coverage pass of 22 November 2026. */
  fresh: boolean;
}
export interface MusicEntry { id: string; src: string; file: string; mood: MusicMood; gain: number; measure?: LevelMeasure }
export interface SoundCatalogue {
  families: { id: SoundFamilyId; label: string; entries: SoundEntry[] }[];
  music: MusicEntry[];
  counts: { events: number; takes: number; music: number; measuredTakes: number };
}

const fileOf = (src: string): string => src.slice(src.lastIndexOf('/') + 1);
const num = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const records = (value: unknown, key: string): Record<string, unknown>[] => {
  const list = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
  return Array.isArray(list) ? list.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : [];
};

/** File name → measured level, from the calibration logs (first source wins:
 * the most recent pass measured the published file itself). */
export function calibrationIndex(sources: { pcm20261122?: unknown; pcmG1122?: unknown; pcmV175?: unknown; pcmV196?: unknown; processing?: unknown }): Map<string, LevelMeasure> {
  const index = new Map<string, LevelMeasure>();
  const add = (file: unknown, measure: LevelMeasure): void => {
    if (typeof file === 'string' && !index.has(file) && (measure.rmsDbfs !== undefined || measure.peakDbfs !== undefined)) index.set(file, measure);
  };
  for (const item of records(sources.pcm20261122, 'files'))
    add(item.file, { rmsDbfs: num(item.rmsDbfs), peakDbfs: num(item.peakDbfs), lufs: num(item.loudnessLufsUngated), source: 'calibrage du 22 novembre' });
  for (const item of records(sources.pcmG1122, 'files'))
    add(item.file, { rmsDbfs: num(item.rmsDbfs), peakDbfs: num(item.peakDbfs), lufs: num(item.loudnessLufsUngated), source: 'calibrage des sons du jeu' });
  for (const item of records(sources.pcmV175, 'files'))
    add(item.file, { rmsDbfs: num(item.rmsDbfs), peakDbfs: num(item.peakDbfs), source: 'calibrage V175' });
  for (const item of records(sources.pcmV196, 'files'))
    add(item.file, { rmsDbfs: num(item.rmsDbfs), peakDbfs: num(item.peakDbfs), source: 'calibrage V196' });
  for (const item of records(sources.processing, 'derivations')) {
    const output = (item.decodedMeasurements as { output?: Record<string, unknown> } | undefined)?.output;
    if (output) add(item.filename, { rmsDbfs: num(output.activeRmsDbfs) ?? num(output.rmsDbfs), peakDbfs: num(output.peakDbfs), source: 'traitement V165' });
  }
  return index;
}

/** Every event of the parsed manifest and every music title, nothing filtered. */
export function buildSoundCatalogue(manifest: AudioManifest, tracks: readonly MusicTrack[], measures: ReadonlyMap<string, LevelMeasure> = new Map()): SoundCatalogue {
  const families = SOUND_FAMILIES.map(family => ({ ...family, entries: [] as SoundEntry[] }));
  let takes = 0, measuredTakes = 0;
  for (const kind of Object.keys(manifest.events).sort()) {
    const event = manifest.events[kind]!;
    const entry: SoundEntry = {
      kind, family: soundFamily(kind), hint: soundHint(kind), gain: event.gain, loop: event.loop, spatial: event.spatial,
      maxDistance: event.maxDistance,
      takes: event.variants.map(variant => ({ src: variant.src, file: fileOf(variant.src), gain: variant.gain, measure: measures.get(fileOf(variant.src)) })),
      fresh: event.variants.some(variant => variant.src.includes('-c1122-') || variant.src.includes('-g1122-')),
    };
    takes += entry.takes.length;
    measuredTakes += entry.takes.filter(take => take.measure).length;
    families.find(family => family.id === entry.family)!.entries.push(entry);
  }
  const music = tracks.map(track => ({ id: track.id, src: track.src, file: fileOf(track.src), mood: track.mood, gain: track.gain, measure: measures.get(fileOf(track.src)) }));
  return {
    families: families.filter(family => family.entries.length),
    music,
    counts: { events: Object.keys(manifest.events).length, takes, music: music.length, measuredTakes },
  };
}
