import {isSchema298OrLater} from '../sim/schema-compatibility-257.ts';
import type { NativeControl, NativePage, NativeRow, NativeUiActions, NativeUiState } from './native-contract';
import type { Cell, Command, Pawn, Structure, World } from '../sim/types';
import type { MedicalRecord } from '../sim/injury-types';
import type { LinkedStorageGroup286 } from '../sim/linked-storage-state-286';
import type { ShipCasketPatient277, ShipCasketCommand277 } from '../sim/ship-casket-state-277';
import type { CryptosleepCommand271 } from '../sim/cryptosleep-state-271';
import { growingCultureChoices, growingCultureHelp } from '../ui/growing-controls';
import { growingPlantLabel291 } from '../sim/forestry-content-291';
import { knownBuilding256, knownPosition256 } from '../ui/exploration-readers-256';
import { buildingLabels } from '../ui/building-labels';
import { targetBuildingPlayerUse263 } from '../sim/world-target-building-263';
import { registeredMapId } from '../sim/world-map-context';
import { normalizeLinkedStorageName286 } from '../sim/linked-storage-plan-286';
import { isShelfKind } from '../sim/shelf-storage';
import { isColonist } from '../sim/affiliation';
import { isBedKind } from '../sim/bed-kinds';
import { footprintCells } from '../sim/definitions';
import { WorkEnvironmentCache, ROOM_ROLE_LABEL } from '../sim/work-environment';
import { RoomQualityCapture } from '../sim/room-quality';
import { IMPRESSION_LABELS } from '../sim/room-impressiveness';
import { roofKindAt } from '../sim/roof-rules';
import { temperatureAt } from '../sim/temperature';
import { cookingSpot } from '../sim/cooking-bills';
import { stationRecipes } from '../sim/production-recipes';
import { FILTH_DEFINITIONS } from '../sim/filth-rules';
import { backgroundWorkRefusal } from '../sim/colonist-backgrounds';
import { medicalWorkRefusal, pawnBody } from '../sim/health-rules';
import { burialReason, graveAccepts } from '../sim/burial';
import { isBurialContainer256 } from '../sim/ancient-monument-runtime-256';
import { corpseStage } from '../sim/corpses';
import { firefoamManualCapable290, queryFirefoamUseReason290 } from '../sim/firefoam-manual-290';
import { FIREFOAM_CONTENT_290 } from '../sim/firefoam-content-290';
import { cryptosleepActorCapable271, cryptosleepHuman271, cryptosleepLastColonist271, cryptosleepIntent271 } from '../sim/cryptosleep-intent-271';
import { isPlayerCasket271 } from '../sim/cryptosleep-state-271';
import { isShipCasket277 } from '../sim/ship-casket-state-277';
import { shipCasketActorCapable277, shipCasketIntent277 } from '../sim/ship-casket-intent-277';
import { shipCasketOccupantLabel277 } from '../sim/ship-casket-task-277';
import { readShipReactorStart275 } from '../sim/ship-reactor-runtime-275';
import {isShipPartKind298} from '../sim/ship-graph-298';
import {isShipComputerSensorsKind298} from '../sim/ship-computer-sensors-content-298';
import { indexShipParts276, readShipAssembly276 } from '../sim/ship-part-reader-276';
import { animalBody } from '../sim/wildlife-health';
import { animalNutritionMax } from '../sim/animal-life';
import { animalSpecies } from '../sim/animal-species';
import { penRegion } from '../sim/animal-pens';
import { mechaAssessment } from '../sim/mechanoid-health';
import { ITEM_DEFINITIONS } from '../sim/items';
import { BODY_PARTS } from '../sim/body-definition';
import { INJURY_RULES, HP_UNIT } from '../sim/injury-rules';
import { FLU_UNIT } from '../sim/flu-rules';
import { IMMUNE_DISEASE_UNIT } from '../sim/immune-diseases-rules';
import { FOOD_POISON_UNIT } from '../sim/food-poisoning';
import { ANESTHETIC_UNIT } from '../sim/anesthetic';

type ExtendedState = NativeUiState & { epoch?: number };
type ExtendedActions = NativeUiActions & { readState?: () => NativeUiState; closePage?: () => void };
interface Scope { epoch?: number; mapId: number | undefined; seed: number; width: number; height: number }
interface LinkChoice { id: number; label: string; groupId?: number; stamp: string }
let lastState: ExtendedState, actions: ExtendedActions, pending = false;
const environmentCache = new WorkEnvironmentCache();
const percent = (value: number) => `${(value * 100).toFixed(1).replace('.0', '')} %`;
const row = (id: string, label: string, value?: string, detail?: string): NativeRow => ({ id, label, value, hint: detail });
const now = (): ExtendedState => actions.readState?.() ?? lastState;
const worldNow = (): World => { const world = now().world; if (!world) throw Error('La carte inspectée n’est plus disponible.'); return world; };
const close = () => { actions.closePage?.(); actions.refresh(); };
const scopeOf = (state: ExtendedState): Scope => ({ epoch: state.epoch, mapId: state.world ? registeredMapId(state.world) : undefined, seed: state.world?.seed ?? 0, width: state.world?.width ?? 0, height: state.world?.height ?? 0 });
function assertScope(scope: Scope): World {
  const current = scopeOf(now());
  if (current.epoch !== scope.epoch || current.mapId !== scope.mapId || current.seed !== scope.seed || current.width !== scope.width || current.height !== scope.height) throw Error('La carte a changé. Fermez ce panneau et confirmez le choix dans la vue actuelle.');
  return worldNow();
}
function show(title: string, rows: NativeRow[], controls: NativeControl[] = []): void {
  for (const entry of rows) { if (entry.detail) { entry.hint = [entry.hint, entry.detail].filter(Boolean).join(' · '); delete entry.detail; } if (entry.hint) for (const action of entry.controls ?? []) action.hint = [action.hint, entry.hint].filter(Boolean).join(' · '); }
  actions.showPage({ id: `inspect-special-${title}`, title, modal: true, rows, actions: [...controls, button('special-close', 'Retour', close)], onClose: close, layout: 'inspector', width: 600, height: 430 });
}
function button(id: string, label: string, action: () => unknown, disabled = false, active = false, hint?: string): NativeControl {
  return { id, label, disabled, active, hint: hint ?? label, onActivate: async () => {
    if (disabled || pending || now().busy) return;
    pending = true;
    try { await action(); } catch (cause) { show('Choix non appliqué', [row('special-error', cause instanceof Error ? cause.message : String(cause))]); }
    finally { pending = false; actions.refresh(); }
  } };
}
async function send(command: Command): Promise<void> {
  const result = await actions.command(command);
  if (result && typeof result === 'object' && 'ok' in result && result.ok === false) throw Error('reason' in result ? String(result.reason) : 'La commande a été refusée.');
}
function confirm(title: string, message: string, action: () => Promise<unknown>, extra: NativeRow[] = []): void {
  show(title, [row('special-confirmation', message), ...extra], [button('special-confirm', 'Confirmer', async () => { await action(); close(); })]);
}
function toggle(id: string, label: string, value: boolean, commit: (value: boolean) => Promise<unknown>, disabled = false): NativeRow {
  return { id, label, value: value ? 'Oui' : 'Non', controls: [button(id, value ? 'Désactiver' : 'Activer', () => commit(!value), disabled, value)] };
}
const workers = (world: World) => world.pawns.filter(pawn => isColonist(pawn) && !pawn.prisoner && !pawn.visitor && !['dead', 'downed'].includes(pawn.state));

/** Human-readable presentations for the uncommon conditions formerly exposed
 * as raw component fields. Values retain each condition's actual scale. */
export function nativeClinicalConditionRows(health: MedicalRecord | undefined, suspended = false): NativeRow[] {
  if (!health) return [];
  const rows: NativeRow[] = [], clock = health.tick * 10;
  const episode = (id: string, label: string, state: { severity: number; immunity: number; tend?: { quality: number; expiresAtCore: number }; vomit?: unknown }, unit: number) => {
    rows.push({ ...row(`${id}-severity`, label, `Gravité ${percent(state.severity / unit)} · Immunité ${percent(state.immunity / unit)}`, 'La gravité et l’immunité progressent séparément ; les soins et le repos influencent leur évolution.'), meter: { value: state.severity, max: unit, color: '#b77b68', secondary: { value: state.immunity, max: unit, label: `Immunité ${percent(state.immunity / unit)}`, color: '#89a48b' } } });
    if (state.tend) rows.push(row(`${id}-tend`, 'Derniers soins', `Qualité ${percent(state.tend.quality / 1000)}`, `${Math.max(0, state.tend.expiresAtCore - clock) / 2500} h cliniques restantes${suspended ? ' · Horloge suspendue' : ''}`));
    if (state.vomit) rows.push(row(`${id}-vomit`, 'Épisode de vomissement en cours'));
  };
  if (health.flu) episode('flu', 'Grippe', health.flu, FLU_UNIT);
  for (const [kind, state] of Object.entries(health.immuneDiseases ?? {})) if (state) episode(kind, kind === 'malaria' ? 'Paludisme' : kind === 'plague' ? 'Peste' : 'Maladie du sommeil', state, IMMUNE_DISEASE_UNIT);
  for (const [kind, state] of Object.entries(health.parasites306 ?? {})) if (state) {
    const left = state.tend ? Math.max(0, state.tend.expiresAtCore - clock) : 0;
    rows.push(row(`${kind}-cure`, kind === 'gut-worms' ? 'Vers intestinaux' : 'Parasites musculaires', `Guérison ${percent(state.totalTend / 3000)}`, `${kind === 'gut-worms' ? 'Faim deux fois plus rapide' : 'Fatigue deux fois plus rapide, manipulation et déplacement −30 points'} · douleur +20 % · ${left > 0 ? `soin de qualité ${percent(state.tend!.quality / 1000)}, ${(left / 2500).toFixed(1)} h restantes` : 'aucun soin actif'}${suspended ? ' · Horloge suspendue' : ''}`));
  }
  for (const [kind, state] of Object.entries(health.mechanites307 ?? {})) if (state) {
    const left = state.tend ? Math.max(0, state.tend.expiresAtCore - clock) : 0, two = state.severity >= 12_000_000;
    rows.push(row(`${kind}-severity`, kind === 'fibrous-mechanites' ? 'Mécanites fibreuses' : 'Mécanites sensorielles', `Gravité ${percent(state.severity / 24_000_000)}`, `${kind === 'fibrous-mechanites' ? 'Manipulation, déplacement et circulation +50 points' : 'Vue, ouïe et parole +50 points, manipulation +30 points'} · douleur +${two ? 60 : 20} % · fatigue ×${two ? 2 : 1.7} · ${left > 0 ? `soin de qualité ${percent(state.tend!.quality / 1000)}, ${(left / 2500).toFixed(1)} h restantes` : 'aucun soin actif'} · disparition dans ${((state.disappearsAtCore - clock) / 60000).toFixed(1)} jours${suspended ? ' · Horloge suspendue' : ''}`));
  }
  if (health.foodPoisoning) rows.push(row('food-poisoning', 'Intoxication alimentaire', `Gravité ${percent(health.foodPoisoning.severity / FOOD_POISON_UNIT)}`, health.foodPoisoning.vomit ? 'Vomit' : undefined));
  if (health.toxicBuildup) rows.push(row('toxic-buildup', 'Charge toxique', percent(health.toxicBuildup.severity), health.toxicBuildup.vomit || health.toxicBuildup.vomitRequestedAt !== undefined ? 'Nausée ou vomissement engagé' : undefined));
  if (health.anesthetic) rows.push(row('anesthetic', 'Anesthésie', percent(health.anesthetic.severity / ANESTHETIC_UNIT), suspended ? 'Dissipation suspendue pendant le cryptosommeil' : 'Dissipation selon le temps clinique actif'));
  if (health.alcohol) {
    const alcohol = health.alcohol;
    rows.push(row('alcohol-high', 'Alcoolémie', percent(alcohol.high)), row('alcohol-tolerance', 'Tolérance à l’alcool', percent(alcohol.tolerance)), row('alcohol-hangover', 'Gueule de bois', percent(alcohol.hangover)), row('alcohol-doses', 'Doses aujourd’hui', String(alcohol.dosesToday)));
    if (alcohol.addiction) rows.push(row('alcohol-addiction', 'Dépendance à l’alcool', percent(alcohol.addiction.severity)), row('alcohol-need', 'Besoin chimique', percent(alcohol.addiction.need)));
    if (alcohol.cirrhosis) rows.push(row('cirrhosis', 'Cirrhose du foie'));
    if (alcohol.brainDamage) rows.push(row('alcohol-brain', 'Lésion cérébrale liée à l’alcool'));
    if (alcohol.vomit) rows.push(row('alcohol-vomit', 'Vomissement lié à l’alcool'));
  }
  if (health.coveredInFirefoam290) rows.push(row('firefoam-protection', 'Couvert de mousse', `${(health.coveredInFirefoam290.remainingCore / 60).toFixed(1)} s restantes`, suspended ? 'Dossier suspendu' : 'Nouvel allumage empêché'));
  if (health.scaria261) rows.push(row('scaria', 'Scaria', 'Rage pathologique', health.scaria261.manhunterCore > 0 ? `Rage persistante depuis ${((clock - health.scaria261.manhunterCore) / 60000).toFixed(2)} jours cliniques` : 'Aucun début de rage persistante enregistré'));
  const ageNames: Record<string, string> = { Carcinoma: 'Carcinome', BadBack: 'Lumbago', Frail: 'Fragilité', Cataract: 'Cataracte', HearingLoss: 'Perte d’audition', Dementia: 'Démence', Alzheimers: 'Maladie d’Alzheimer', Asthma: 'Asthme', HeartArteryBlockage: 'Obstruction d’une artère du cœur', HeartAttack: 'Crise cardiaque' };
  for (const condition of health.animalAgeConditions?.cases ?? []) rows.push(row(`condition-age-${condition.id}`, `${ageNames[condition.kind] ?? condition.kind} · ${BODY_PARTS[condition.part].label}`, percent(condition.severity), condition.tend ? `Qualité des soins ${percent(condition.tend.quality)}` : undefined));
  if (health.cryptosleepSickness) rows.push(row('cryptosleep-sickness', 'Mal de cryptosommeil', `${(health.cryptosleepSickness.remainingCore / 2500).toFixed(1)} h cliniques restantes`, health.cryptosleepSickness.vomit ? 'Vomit' : undefined));
  return rows;
}
function heldHumanRows(pawn: Pawn): NativeRow[] {
  const rows = [row('held-identity', pawn.name, pawn.prisoner ? 'Prisonnier · Cryptosommeil' : 'Cryptosommeil'), row('held-needs', 'Besoins suspendus', `Nourriture ${Math.round(pawn.hunger)} % · Repos ${Math.round(pawn.rest)} % · Humeur ${Math.round(pawn.mood)} %`)];
  for (const injury of pawn.health?.injuries ?? []) rows.push(row(`held-injury-${injury.id}`, BODY_PARTS[injury.part].label, `${injury.scar?.pain !== undefined ? 'Cicatrice' : INJURY_RULES[injury.kind].label} · −${(injury.severity / HP_UNIT).toFixed(2)} PV`, injury.tended === undefined ? 'Non soignée' : `Soignée · qualité ${Math.round(injury.tended / 10)} %`));
  for (const missing of pawn.health?.missing ?? []) rows.push(row(`held-missing-${missing.part}`, BODY_PARTS[missing.part].label, 'Partie perdue'));
  rows.push(row('held-consciousness', 'Conscience conservée', percent(pawnBody(pawn).capacities.consciousness)), row('held-moving', 'Mobilité conservée', percent(pawnBody(pawn).capacities.moving)), row('held-manipulation', 'Manipulation conservée', percent(pawnBody(pawn).capacities.manipulation)), ...nativeClinicalConditionRows(pawn.health, true));
  return rows;
}

function environmentRows(state: ExtendedState, cell: Cell): NativeRow[] {
  const world = state.world!; if (!knownPosition256(world, cell)) return [];
  const environment = environmentCache.read(world), room = environment.room(cell), topology = environment.topology.at(cell.x, cell.z), quality = new RoomQualityCapture(world, environment.topology).room(cell), roof = roofKindAt(world, cell.z * world.width + cell.x);
  const rows: NativeRow[] = [row('room-status', topology?.kind === 'solid' ? 'Paroi' : topology?.kind === 'doorway' ? 'Seuil' : topology?.touchesMapEdge ? 'Extérieur ouvert vers le bord de la carte' : room ? 'Pièce' : 'Extérieur', room ? `${room.covered} / ${room.space.cellCount} cases couvertes` : undefined), row('room-role', 'Usage', room ? ROOM_ROLE_LABEL[room.role] : 'Extérieur'), row('room-temperature', 'Température', `${temperatureAt(world, cell).toFixed(1)} °C`), row('room-light', 'Lumière', percent(environment.lightAt(cell))), row('room-light-speed', 'Facteur de marche et de travail lié à la lumière', percent(environment.speedAt(cell))), row('room-roof', 'Toit de la case', roof === 'natural-thick' ? 'Naturel épais' : roof === 'natural-thin' ? 'Naturel mince' : roof ? 'Construit' : 'Aucun')];
  if (quality) rows.push(row('room-cleanliness', 'Propreté de la pièce', quality.cleanliness.toFixed(2)), row('room-beauty', 'Beauté de la pièce', quality.beauty.toFixed(2)), row('room-impression', 'Impression', `${quality.impressiveness.toFixed(1)} · ${IMPRESSION_LABELS[quality.stage]}`), row('room-wealth', 'Richesse', quality.wealth.toFixed(1)), row('room-space', 'Espace', quality.space.toFixed(1)));
  const station = world.structures.find(structure => stationRecipes(structure).length > 0 && footprintCells(structure).some(position => position.x === cell.x && position.z === cell.z));
  if (station) { const factors = environment.production(station, cookingSpot(station)); rows.push(row('production-total', 'Facteur de production', percent(factors.total)), row('production-factors', 'Contributions à la production', `Lumière ×${factors.lighting.toFixed(2)} · Extérieur ×${factors.outdoors.toFixed(2)} · Pièce ×${factors.roomRole.toFixed(2)} · Poste ×${factors.station.toFixed(2)}`)); }
  const traces = world.filth?.items.filter(filth => filth.x === cell.x && filth.z === cell.z) ?? [];
  rows.push(row('cell-filth', 'Traces physiques sur la case', traces.map(filth => `${FILTH_DEFINITIONS[filth.kind].label} ×${filth.thickness}`).join(' · ') || 'Aucune'));
  return rows;
}
function environmentPage(scope: Scope, cell: Cell): void {
  const world = assertScope(scope), rows = environmentRows(now(), cell);
  for (const pawn of workers(world)) {
    const reason = medicalWorkRefusal(pawn) ?? backgroundWorkRefusal(pawn, 'clean') ?? (pawn.draft ? 'Colon mobilisé' : !pawn.priorities.clean ? 'Nettoyage désactivé' : undefined);
    rows.push({ id: `clean-with-${pawn.id}`, label: `Nettoyer avec ${pawn.name}`, detail: reason, controls: [button(`clean-room-${pawn.id}`, 'Nettoyer cette pièce', async () => { assertScope(scope); await send({ type: 'clean-room', pawnId: pawn.id, x: cell.x, z: cell.z }); environmentPage(scope, cell); }, !!reason)] });
  }
  rows.push(row('cleaning-guidance', 'Le nettoyage suit le travail physique', undefined, 'Les traces restent présentes jusqu’au travail. Le nettoyage automatique dépend du foyer et des priorités du colon.'));
  show('Environnement et nettoyage', rows);
}

function burialPage(scope: Scope, bodyId: number): void {
  const world = assertScope(scope), body = world.pawns.find(pawn => pawn.id === bodyId); if (!body || body.state !== 'dead') throw Error('La dépouille humaine inspectée n’est plus disponible.');
  const pile = world.piles.find(pile => pile.id === body.body?.pileId), rows: NativeRow[] = [row('burial-body', body.name, body.body?.lostAt !== undefined ? 'Dépouille détruite' : pile?.owner.type === 'grave' ? 'Inhumée' : pile?.owner.type === 'pawn' ? 'Déjà portée' : 'Dépouille sur place', pile?.humanCorpse ? `État : ${corpseStage(pile, world.tick)}` : undefined), row('burial-guidance', 'Une sépulture arrête le renouvellement des pensées de corps vu', undefined, 'Les souvenirs d’un décès ou d’un corps déjà vu persistent jusqu’à leur propre expiration.')];
  for (const pawn of workers(world)) {
    const reason = burialReason(world, pawn, body);
    rows.push({ id: `bury-auto-${pawn.id}`, label: `Porteur : ${pawn.name}`, detail: reason, controls: [button(`bury-auto-${pawn.id}`, 'Sépulture compatible disponible', async () => { assertScope(scope); await send({ type: 'order-bury', pawnId: pawn.id, bodyPawnId: bodyId }); close(); }, !!reason)] });
    if (!reason) for (const grave of world.structures.filter(grave => isBurialContainer256(grave.kind, world.schemaVersion) && knownBuilding256(world, grave))) {
      const accepted = graveAccepts(world, grave, body, pawn.id);
      rows.push({ id: `bury-${pawn.id}-${grave.id}`, label: `${pawn.name} → ${buildingLabels[grave.kind]} ${grave.id} (${grave.x}, ${grave.z})`, controls: [button(`bury-command-${pawn.id}-${grave.id}`, 'Inhumer ici', async () => { assertScope(scope); await send({ type: 'order-bury', pawnId: pawn.id, bodyPawnId: bodyId, graveId: grave.id }); close(); }, !accepted)] });
    }
  }
  show('Inhumer la dépouille', rows);
}
function gravePolicyRows(world: World, grave: Structure, scope: Scope): NativeRow[] {
  if (!grave.grave) return [];
  const settings = grave.grave, occupied = settings.corpseId !== undefined, occupant = world.piles.find(pile => pile.id === settings.corpseId)?.humanCorpse;
  const rows: NativeRow[] = [row('grave-occupant', 'Sépulture', occupied ? world.pawns.find(pawn => pawn.id === occupant?.pawnId)?.name ?? 'Occupée' : 'Vide'), toggle('grave-colonists', 'Accepter les colons', settings.colonists, async colonists => { assertScope(scope); await send({ type: 'grave-policy', graveId: grave.id, colonists, strangers: settings.strangers }); }, occupied), toggle('grave-strangers', 'Accepter les étrangers', settings.strangers, async strangers => { assertScope(scope); await send({ type: 'grave-policy', graveId: grave.id, colonists: settings.colonists, strangers }); }, occupied)];
  rows.push({ id: 'grave-assignment', label: 'Attribution de la sépulture', value: world.pawns.find(pawn => pawn.id === settings.assignedPawnId)?.name ?? 'Aucune', controls: [button('grave-unassign', 'Aucune attribution', async () => { assertScope(scope); await send({ type: 'assign-grave', graveId: grave.id, pawnId: null }); }, occupied), ...world.pawns.filter(isColonist).map(pawn => button(`grave-assign-${pawn.id}`, `${pawn.name}${pawn.state === 'dead' ? ' · Décédé' : ''}`, async () => { assertScope(scope); await send({ type: 'assign-grave', graveId: grave.id, pawnId: pawn.id }); }, occupied, settings.assignedPawnId === pawn.id))] });
  return rows;
}
function bedPolicyRows(world: World, bed: Structure, scope: Scope): NativeRow[] {
  if (bed.kind === 'animal-sleeping-spot') {
    const occupant = world.wildlife?.animals.find(animal => animal.animalRest?.spotId === bed.id && animal.animalRest.phase === 'sleep'), claimant = world.wildlife?.animals.find(animal => animal.domestic?.bedId === bed.id), carrier = world.pawns.find(pawn => pawn.animalRescue?.spotId === bed.id);
    return [toggle('animal-spot-medical', 'Couchage animal médical', !!bed.medical, async enabled => { assertScope(scope); await send({ type: 'animal-spot-medical', spotId: bed.id, enabled }); }), row('animal-spot-occupant', 'Occupation', occupant ? `${animalSpecies(occupant.species).label} ${occupant.id}` : carrier ? `Secours en cours · ${carrier.name}` : claimant ? `Attribué à ${animalSpecies(claimant.species).label} ${claimant.id}` : 'Disponible')];
  }
  if (!isBedKind(bed.kind)) return [];
  const double = bed.kind === 'double-bed', rows: NativeRow[] = [];
  if (!double) rows.push(toggle('special-medical-bed', 'Usage médical', !!bed.medical, async enabled => { assertScope(scope); await send({ type: 'medical-bed', bedId: bed.id, enabled }); }), toggle('special-prison-bed', 'Réservé aux prisonniers', !!bed.prisoner, async enabled => { assertScope(scope); await send({ type: 'prison-bed', bedId: bed.id, enabled }); }));
  else rows.push(row('double-bed-civil', 'Deux places civiles indépendantes', undefined, 'Usage médical et prisonniers indisponibles. Une attribution automatique dans le lit d’un autre colon est réservée à son partenaire.'));
  if (!bed.prisoner) for (const slot of double ? [0, 1] as const : [undefined]) {
    const current = world.pawns.find(pawn => pawn.bedId === bed.id && (slot === undefined || pawn.bedSlot === slot)), choices = world.pawns.filter(pawn => isColonist(pawn) && pawn.state !== 'dead' && (!double || !pawn.prisoner && !pawn.visitor && !pawn.raid && !pawn.podRescue && !pawn.health?.death));
    rows.push({ id: `special-bed-slot-${slot ?? 0}`, label: double ? `Place ${slot! + 1}` : 'Propriétaire', value: current?.name ?? 'Non attribué', controls: [button(`special-bed-clear-${slot ?? 0}`, 'Non attribué', async () => { assertScope(scope); await send({ type: 'assign-bed', bedId: bed.id, pawnId: null, ...(slot === undefined ? {} : { slot }) }); }, !!bed.medical), ...choices.map(pawn => button(`special-bed-${slot ?? 0}-${pawn.id}`, pawn.name, async () => { assertScope(scope); await send({ type: 'assign-bed', bedId: bed.id, pawnId: pawn.id, ...(slot === undefined ? {} : { slot }) }); }, !!bed.medical, current?.id === pawn.id))] });
  }
  return rows;
}

const linkedGroup = (world: World, shelf: Structure): LinkedStorageGroup286 | undefined => world.linkedStorage286?.groups.find(group => group.id === shelf.shelf?.linked286?.groupId);
const usableShelf = (world: World, shelf: Structure) => isShelfKind(shelf.kind) && !!shelf.shelf && knownBuilding256(world, shelf) && targetBuildingPlayerUse263(world, shelf);
const shelfStamp = (world: World, shelf: Structure) => JSON.stringify([shelf.id, shelf.kind, shelf.x, shelf.z, shelf.orientation, shelf.shelf?.linked286?.groupId ?? null, shelf.shelf?.settings, linkedGroup(world, shelf) ?? null]);
function linkedChoices(world: World, source: Structure): LinkChoice[] {
  const mapId = registeredMapId(world), own = linkedGroup(world, source), independent: LinkChoice[] = [], groups = new Map<number, { shelf: Structure; group: LinkedStorageGroup286 }>();
  for (const shelf of world.structures) {
    if (shelf.id === source.id || !usableShelf(world, shelf)) continue;
    const group = linkedGroup(world, shelf);
    if (shelf.shelf?.linked286?.groupId === undefined) independent.push({ id: shelf.id, label: `${buildingLabels[shelf.kind]} ${shelf.id} (${shelf.x}, ${shelf.z}) · Indépendante`, stamp: shelfStamp(world, shelf) });
    else if (group && group.originMapId === mapId && group.id !== own?.id && group.memberIds.includes(shelf.id)) { const prior = groups.get(group.id); if (!prior || shelf.id < prior.shelf.id) groups.set(group.id, { shelf, group }); }
  }
  return [...independent.sort((a, b) => a.id - b.id), ...[...groups.values()].sort((a, b) => a.group.id - b.group.id).map(({ shelf, group }) => ({ id: shelf.id, groupId: group.id, label: `« ${group.name} » · ${group.memberIds.length} membres · Étagère ${shelf.id}`, stamp: shelfStamp(world, shelf) }))];
}
function checkedShelf(scope: Scope, id: number, expected: string): { world: World; shelf: Structure } {
  const world = assertScope(scope), shelf = world.structures.find(shelf => shelf.id === id);
  if (!shelf || !usableShelf(world, shelf) || shelfStamp(world, shelf) !== expected) throw Error('L’étagère, son groupe ou ses réglages ont changé. Actualisez les choix avant de confirmer.');
  return { world, shelf };
}
function linkedStoragePage(scope: Scope, id: number): void {
  const world = assertScope(scope), shelf = world.structures.find(shelf => shelf.id === id); if (!shelf || !usableShelf(world, shelf)) throw Error('L’étagère installée et contrôlée est indisponible.');
  const group = linkedGroup(world, shelf), sourceStamp = shelfStamp(world, shelf), mapId = registeredMapId(world);
  if (shelf.shelf?.linked286 && (!group || group.originMapId !== mapId || !group.memberIds.includes(id))) throw Error('Le groupe lié confirmé est indisponible.');
  const rows = [row('linked-storage-summary', group ? `« ${group.name} » · Groupe ${group.id}` : 'Réglages indépendants', group ? `${group.memberIds.length} membres au total` : undefined), row('linked-storage-scope', 'Les filtres et la priorité sont communs au groupe', undefined, 'Chaque étagère conserve sa capacité et son contenu. Les membres emballés ou absents de cette vue gardent leur véritable appartenance.')];
  const controls: NativeControl[] = [button('linked-refresh', 'Actualiser les choix', () => linkedStoragePage(scope, id))];
  for (const choice of linkedChoices(world, shelf)) rows.push({ id: `link-choice-${choice.id}`, label: choice.label, controls: [button(`link-to-${choice.id}`, 'Lier les réglages…', () => {
    const message = choice.groupId !== undefined ? `L’étagère ${id} rejoindra ${choice.label}. Les réglages du groupe destination gagnent ; les autres membres de son ancien groupe restent dans leur groupe.` : group ? `Ajouter ${choice.label} au groupe « ${group.name} ». Les réglages actuels de ce groupe gagnent.` : `Créer un groupe pour les étagères ${id} et ${choice.id}. Les réglages actuels de l’étagère ${id} gagnent.`;
    confirm('Confirmer la liaison', message, async () => { const checked = checkedShelf(scope, id, sourceStamp), target = checked.world.structures.find(target => target.id === choice.id); if (!target || !usableShelf(checked.world, target) || shelfStamp(checked.world, target) !== choice.stamp) throw Error('La destination a changé. Actualisez les choix.'); await send({ type: 'shelf-link', structureIds: choice.groupId === undefined ? [id, choice.id] : [choice.id, id] }); });
  })] });
  if (rows.length === 2) rows.push(row('linked-no-choice', 'Aucune autre étagère indépendante ou groupe compatible installé et connu sur cette carte.'));
  if (group) {
    controls.push(button('linked-unlink', 'Délier cette étagère…', () => confirm('Délier cette étagère', `L’étagère ${id} conservera ses réglages effectifs actuels.${group.memberIds.length === 2 ? ' Le groupe de deux sera dissous ; l’autre étagère conservera aussi ces réglages.' : ' Les autres membres resteront liés.'}`, async () => { checkedShelf(scope, id, sourceStamp); await send({ type: 'shelf-unlink', structureId: id }); })));
    let proposed = group.name;
    const renamePage = () => show('Renommer le groupe', [{ id: 'linked-group-name', label: 'Nom du groupe', input: { value: proposed, maxLength: 64, onCommit: value => { proposed = value; renamePage(); } } }], [button('linked-rename-confirm', 'Confirmer', async () => { const name = normalizeLinkedStorageName286(proposed); if (!name) throw Error('Le nom doit contenir de 1 à 64 caractères après retrait des espaces aux extrémités, sans caractère de contrôle.'); checkedShelf(scope, id, sourceStamp); await send({ type: 'shelf-group-rename', structureId: id, name }); close(); })]);
    controls.push(button('linked-rename', 'Renommer le groupe…', renamePage));
  }
  show('Réglages liés des étagères', rows, controls);
}

function ordinaryCasketPage(scope: Scope, casketId: number): void {
  const world = assertScope(scope), casket = world.structures.find(casket => casket.id === casketId); if (!casket || !isPlayerCasket271(casket) || !casket.cryptosleep) throw Error('Le caisson réel n’est plus disponible.');
  const rows = [row('cryptosleep-status', casket.cryptosleep.human ? `Occupant : ${casket.cryptosleep.human.name}` : 'Caisson vide', 'Sans électricité', 'Une autre personne doit se rendre sur place pour ouvrir le caisson.')];
  if (casket.cryptosleep.human) rows.push(...heldHumanRows(casket.cryptosleep.human));
  for (const item of casket.cryptosleep.items) rows.push(row(`held-item-${item.id}`, ITEM_DEFINITIONS[item.item].label, `× ${item.quantity}`));
  for (const item of casket.cryptosleep.packed) rows.push(row(`held-pack-${item.building.id}`, buildingLabels[item.building.kind], 'Emballé · Possession conservée'));
  const apply = async (command: CryptosleepCommand271) => { const current = assertScope(scope), intent = cryptosleepIntent271(current, command); if (!intent.ok) throw Error(intent.reason); await send(command); close(); };
  for (const pawn of world.pawns.filter(pawn => cryptosleepActorCapable271(world, pawn))) {
    if (casket.cryptosleep.human) rows.push({ id: `open-casket-${pawn.id}`, label: `${pawn.name} · Ouvrir le caisson`, controls: [button(`open-casket-${pawn.id}`, 'Ordonner l’ouverture', () => apply({ type: 'order-open-cryptosleep', pawnId: pawn.id, casketId }))] });
    else {
      rows.push({ id: `enter-casket-${pawn.id}`, label: `${pawn.name} · Entrer`, controls: [button(`enter-casket-${pawn.id}`, 'Entrer en cryptosommeil', () => {
        const current = assertScope(scope), last = cryptosleepLastColonist271(current, pawn.id);
        if (last) confirm('Dernier colon libre', `${pawn.name} est le dernier colon libre. Ce caisson exige une autre personne sur place pour être ouvert. Confirmer son entrée ?`, () => apply({ type: 'order-enter-cryptosleep', pawnId: pawn.id, casketId, confirmLastColonist: true }));
        else return apply({ type: 'order-enter-cryptosleep', pawnId: pawn.id, casketId });
      })] });
      for (const patient of world.pawns.filter(patient => patient.id !== pawn.id && patient.state === 'downed' && cryptosleepHuman271(patient))) rows.push({ id: `carry-casket-${pawn.id}-${patient.id}`, label: `${pawn.name} → ${patient.name}`, controls: [button(`carry-casket-${pawn.id}-${patient.id}`, 'Porter vers le caisson', () => apply({ type: 'order-carry-cryptosleep', pawnId: pawn.id, patientId: patient.id, casketId }))] });
    }
  }
  show('Caisson de cryptosommeil', rows);
}
function shipCasketPage(scope: Scope, casketId: number): void {
  const world = assertScope(scope), casket = world.structures.find(casket => casket.id === casketId); if (!casket || !isShipCasket277(casket) || !casket.shipCryptosleep277) throw Error('Le caisson spatial réel n’est plus disponible.');
  const holder = casket.shipCryptosleep277, occupant = holder.occupant, rows = [row('ship-casket-status', occupant ? `Occupant : ${shipCasketOccupantLabel277(occupant)}` : 'Caisson spatial vide', 'Sans alimentation requise · Éjection directe')];
  if (occupant?.kind === 'human') rows.push(...heldHumanRows(occupant.pawn));
  else if (occupant) {
    const body = occupant.kind === 'animal' ? animalBody(occupant.animal) : mechaAssessment(occupant.mech), actor = occupant.kind === 'animal' ? occupant.animal : occupant.mech;
    if (occupant.kind === 'animal') rows.push(row('held-animal-needs', 'Besoins suspendus', `Nourriture ${percent(occupant.animal.food / animalNutritionMax(occupant.animal))} · Repos ${percent(occupant.animal.rest)}`));
    else rows.push(row('held-mechanical-needs', 'Aucun besoin organique', 'État mécanique conservé'));
    rows.push(row('held-consciousness', 'Conscience', percent(body.capacities.consciousness)), row('held-moving', 'Mobilité', percent(body.capacities.moving)), row('held-manipulation', 'Manipulation', percent(body.capacities.manipulation)), row('held-injuries', 'Dossier conservé', `${actor.health?.injuries.length ?? 0} blessures · ${actor.health?.missing.length ?? 0} parties perdues`), ...nativeClinicalConditionRows(actor.health, true));
  }
  for (const item of holder.items) rows.push(row(`spatial-held-item-${item.id}`, ITEM_DEFINITIONS[item.item].label, `× ${item.quantity}`));
  for (const item of holder.packed) rows.push(row(`spatial-held-pack-${item.building.id}`, buildingLabels[item.building.kind], 'Possession conservée'));
  const controls: NativeControl[] = [];
  if (occupant) controls.push(button('ship-casket-eject', 'Éjecter l’occupant', async () => { assertScope(scope); await send({ type: 'eject-ship-casket', casketId }); close(); }));
  else {
    const apply = async (command: Exclude<ShipCasketCommand277, { type: 'eject-ship-casket' }>) => { const current = assertScope(scope), intent = shipCasketIntent277(current, command); if (!intent.ok) throw Error(intent.reason); await send(command); close(); };
    const patients: { patient: ShipCasketPatient277; label: string }[] = [...world.pawns.filter(pawn => pawn.state === 'downed').map(pawn => ({ patient: { kind: 'human' as const, id: pawn.id }, label: pawn.name })), ...(world.wildlife?.animals ?? []).filter(animal => animal.state === 'downed').map(animal => ({ patient: { kind: 'animal' as const, id: animal.id }, label: `${animalSpecies(animal.species).label} ${animal.id}` })), ...(world.mechanoids ?? []).filter(mech => mech.state === 'downed').map(mech => ({ patient: { kind: 'mechanical' as const, id: mech.id }, label: `Mécanoïde ${mech.id}` }))];
    for (const pawn of world.pawns.filter(pawn => shipCasketActorCapable277(world, pawn))) {
      rows.push({ id: `enter-spatial-${pawn.id}`, label: `${pawn.name} · Entrer`, controls: [button(`enter-spatial-${pawn.id}`, 'Entrer dans le caisson', () => apply({ type: 'order-enter-ship-casket', pawnId: pawn.id, casketId }))] });
      for (const { patient, label } of patients) if (patient.kind !== 'human' || patient.id !== pawn.id) rows.push({ id: `spatial-carry-${pawn.id}-${patient.kind}-${patient.id}`, label: `${pawn.name} → ${label}`, controls: [button(`spatial-carry-${pawn.id}-${patient.kind}-${patient.id}`, 'Porter vers le caisson', () => apply({ type: 'order-carry-ship-casket', pawnId: pawn.id, patient, casketId }))] });
    }
  }
  show('Caisson spatial de cryptosommeil', rows, controls);
}
function shipAssemblyPage(scope: Scope, structureId: number): void {
  const world = assertScope(scope), index = indexShipParts276(world.structures, world.width, world.height);
  if (!index.ok) throw Error('L’assemblage physique est indisponible.');
  const report = readShipAssembly276(index.index, structureId); if (!report.ok) throw Error('Les pièces reliées ne peuvent pas être inspectées.');
  const rows = report.requirements.map((requirement, index) => row(`ship-requirement-${index}`, requirement.label, `${requirement.present} / ${requirement.required}`));
  rows.push(row('ship-reactors-running', 'Réacteurs opérationnels', `${report.parts.filter(part => part.kind === 'ship-reactor' && part.source.shipReactor275?.state === 'running').length} / ${report.counts.reactor}`), row('ship-occupied-caskets', 'Caissons spatiaux occupés', `${report.occupiedCaskets} / ${report.counts.casket}`), row('ship-development', isSchema298OrLater(Number(world.schemaVersion))?'Seuls les occupants des caissons reliés partiront.':'Embarquement et lancement restent en développement.'));
  show(`Vaisseau relié · ${report.partIds.length} pièces`, rows);
}

/** Extra native controls for genuinely present owners. Opening a chooser never
 * issues a command, advances a clock, changes a World or creates an occupant. */
export function nativeSpecialRows(state: NativeUiState, nativeActions: NativeUiActions): NativeRow[] {
  lastState = state; actions = nativeActions; const world = state.world; if (!world) return [];
  const scope = scopeOf(state), selected = state.selectedObjects[0], pawn = world.pawns.find(pawn => pawn.id === state.selectedPawnIds[0]), structure = selected?.kind === 'structure' ? world.structures.find(structure => structure.id === selected.id) : undefined;
  const cell = pawn ?? state.selectedCell ?? structure, rows: NativeRow[] = [];
  if(structure?.kind==='comms-console'&&isSchema298OrLater(Number(world.schemaVersion))&&actions.openFactionComms298)rows.push({id:'special-faction-comms298',label:'Communications de faction',controls:[button('special-faction-comms298','Appeler une faction…',()=>actions.openFactionComms298?.(structure.id))]});
  if(pawn?.visitor&&actions.openVisitorTrade) rows.push({id:'special-visitor-trade',label:'Échanges avec les visiteurs',controls:[button('special-visitor-trade','Ouvrir le commerce',()=>actions.openVisitorTrade?.())]});
  if (cell && (!pawn || pawn.state !== 'dead') && knownPosition256(world, cell)) rows.push({ id: 'special-environment', label: 'Pièce et hygiène', controls: [button('special-environment', 'Environnement et nettoyage', () => environmentPage(scope, { x: cell.x, z: cell.z }))] });
  const pile = selected?.kind === 'pile' ? world.piles.find(pile => pile.id === selected.id) : undefined;
  const body = pawn?.state === 'dead' ? pawn : pile?.humanCorpse ? world.pawns.find(pawn => pawn.id === pile.humanCorpse!.pawnId) : undefined;
  if (body) rows.push({ id: 'special-burial', label: `Dépouille de ${body.name}`, controls: [button('special-burial', 'Inhumer…', () => burialPage(scope, body.id))] });
  const growing = selected?.kind === 'growing' ? world.growingZones.find(zone => zone.id === selected.id)
    : structure?.kind === 'hydroponics-basin' && knownBuilding256(world,structure) && targetBuildingPlayerUse263(world,structure) ? world.growingZones.find(zone => zone.basinId === structure.id) : undefined;
  if (growing) {
    const zone = growing, choices = growingCultureChoices(zone, world);
    const choosePlant = (plant:typeof zone.plant) => button(`crop-${plant}`, growingPlantLabel291(plant), async () => {
      const current = assertScope(scope).growingZones.find(current => current.id === zone.id);
      if (!current) throw Error('La zone a disparu.');
      await send({ type: 'growing-policy', zoneId: current.id, plant, allowSow: current.allowSow, allowCut: current.allowCut });
    }, false, zone.plant === plant, growingCultureHelp(plant, world));
    const choice = button('special-crop-select', growingPlantLabel291(zone.plant), () => {}, false, false, growingCultureHelp(zone.plant, world));
    choice.select = { value: zone.plant, options: choices.map(plant => ({value:plant,label:growingPlantLabel291(plant),hint:growingCultureHelp(plant,world)})), onChange:async value => {
      const plant = choices.find(plant => plant === value); if (plant) await choosePlant(plant).onActivate();
    } };
    rows.push({ id:'special-crop-species',label:zone.basinId===undefined?'Culture':'Culture hydroponique',value:growingPlantLabel291(zone.plant),compact:true,presentation:'plain',hint:growingCultureHelp(zone.plant,world),controls:[choice] });
    if (selected?.kind !== 'growing') {
      rows.push(row('special-crop-size','Surface de culture',`${zone.cells.length} cases`));
      for (const [field,label] of [['allowSow','Autoriser les semis'],['allowCut','Couper les plantes indésirables']] as const) rows.push(toggle(`special-crop-${field}`,label,zone[field],async enabled=>{
        const current=assertScope(scope).growingZones.find(current=>current.id===zone.id);if(!current)throw Error('La zone a disparu.');
        await send({type:'growing-policy',zoneId:current.id,allowSow:field==='allowSow'?enabled:current.allowSow,allowCut:field==='allowCut'?enabled:current.allowCut});
      }));
    }
    if (zone.basinId !== undefined) rows.push(row('special-crop-basin-care','Bac hydroponique','Fertilité 280 % · 70 W en continu','Sans alimentation : nouveaux semis suspendus et plantes qui dépérissent. Prévoir une lumière horticole sous toit et une température adaptée. Retirer le bac détruit ses plantes.'));
  }
  if (!structure || !knownBuilding256(world, structure)) return rows;
  if (isShipPartKind298(structure.kind) && world.schemaVersion >= 276) rows.push({ id: 'special-ship-assembly', label: 'Assemblage du vaisseau', controls: [button('special-ship-assembly', 'Inspecter les pièces reliées', () => shipAssemblyPage(scope, structure.id))] });
  if(isShipComputerSensorsKind298(structure.kind))rows.push(row('special-ship-fixed','Pièce de vaisseau fixe','2 × 2 · terrain lourd · extérieur sans toit'),row('special-ship-transmitter','Réseau électrique','Transmet le courant · aucune consommation propre'));
  if (!targetBuildingPlayerUse263(world, structure)) return rows;
  if(isSchema298OrLater(Number(world.schemaVersion))&&structure.kind==='ship-computer'&&actions.launchShip298)rows.push({id:'special-ship-launch298',label:'Départ du vaisseau',controls:[{...button('special-ship-launch298','Lancer…',()=>{assertScope(scope);actions.launchShip298?.(structure.id);}),icon:'rocket'}]});
  if (structure.kind === 'comms-console' && actions.openOrbitalTrade) rows.push({id:'special-orbital-trade',label:'Communications orbitales',controls:[button('special-orbital-trade','Appeler un vaisseau',()=>actions.openOrbitalTrade?.(structure.id))]});
  if (structure.kind === 'pen-marker') {
    const region=penRegion(world,structure.id);
    rows.push(row('pen-region','Enclos',!region?'Région indisponible':!region.closed?'Périmètre ouvert':!region.accessible?`Fermé · ${region.cells.size} cases · portillon accessible requis`:`Fermé et accessible · ${region.cells.size} cases`));
    for(const species of ['deer','gazelle','muffalo','dromedary'] as const) rows.push(toggle(`pen-species-${species}`,animalSpecies(species).label,!!structure.pen?.accepted.includes(species),async accepted=>{assertScope(scope);await send({type:'pen-species',markerId:structure.id,species,accepted});}));
  }
  if (structure.kind === 'spike-trap') rows.push(toggle('spike-trap-auto-rebuild','Reconstruire automatiquement le piège',!!structure.spikeTrap?.autoRebuild,async on=>{assertScope(scope);await send({type:'spike-trap-auto-rebuild',structureId:structure.id,on});}),row('spike-trap-rebuild-cost','Après déclenchement','Nouveau plan, livraison de 45 matériaux et construction complète.','Les alliés conservent un risque d’accident.'));
  rows.push(...bedPolicyRows(world, structure, scope));
  if (isBurialContainer256(structure.kind, world.schemaVersion)) rows.push(...gravePolicyRows(world, structure, scope));
  if (structure.shelf && world.schemaVersion >= 286) rows.push({ id: 'special-linked-storage', label: 'Réglages liés des étagères', controls: [button('special-linked-storage', 'Lier, délier ou renommer…', () => linkedStoragePage(scope, structure.id))] });
  if (structure.kind === 'firefoam-popper' && structure.firefoam290) {
    const foam = structure.firefoam290;
    rows.push(row('firefoam-spec', 'Diffuseur de mousse', `Détection ${FIREFOAM_CONTENT_290.detectRadius} cases · Effet ${FIREFOAM_CONTENT_290.effectRadius} cases`, 'Le déclenchement consomme le dispositif. La reconstruction suit les matériaux, l’accès et le travail réellement disponibles.'), toggle('firefoam-rebuild', 'Reconstruire automatiquement après déclenchement', foam.autoRebuild, async on => { assertScope(scope); await send({ type: 'firefoam-auto-rebuild', structureId: structure.id, on }); }));
    if (foam.wick) rows.push(row('firefoam-wick', 'Déclenchement engagé', `${(Math.max(0, foam.wick.endCore - world.tick * 10) / 60).toFixed(1)} s restantes`));
    else rows.push({ id: 'firefoam-manual', label: 'Déclenchement manuel', controls: [button('firefoam-manual', 'Choisir le colon…', () => {
      const current = assertScope(scope), choices = current.pawns.filter(pawn => firefoamManualCapable290(pawn, current.tick));
      show('Déclencher le diffuseur de mousse', choices.map(pawn => ({ id: `foam-actor-${pawn.id}`, label: pawn.name, controls: [button(`foam-use-${pawn.id}`, 'Déclencher sur place', async () => { const fresh = assertScope(scope), reason = queryFirefoamUseReason290(fresh, pawn.id, structure.id); if (reason) throw Error(reason); await send({ type: 'firefoam-trigger', pawnId: pawn.id, structureId: structure.id }); close(); })] })));
    })] });
  }
  if (isPlayerCasket271(structure)) rows.push({ id: 'special-cryptosleep', label: 'Cryptosommeil', controls: [button('special-cryptosleep', 'Occupant et ordres…', () => ordinaryCasketPage(scope, structure.id))] });
  if (isShipCasket277(structure)) rows.push({ id: 'special-ship-casket', label: 'Caisson spatial', controls: [button('special-ship-casket', 'Occupant, embarquement et éjection…', () => shipCasketPage(scope, structure.id))] });
  if (structure.kind === 'ship-reactor') {
    const reactor = structure.shipReactor275;
    rows.push(row('special-reactor-status', 'Réacteur stellaire', reactor?.state === 'running' ? 'Opérationnel · 1 000 W disponibles' : reactor?.state === 'starting' ? `Démarrage · ${(Math.max(0, reactor.endCore - world.tick * 10) / 60000).toFixed(1)} jours restants · Signal attirant les attaques` : 'En veille · Démarrage manuel · 1 000 W disponibles'));
    if (!reactor) rows.push({ id: 'special-reactor-start', label: 'Démarrer les réacteurs reliés', controls: [button('special-reactor-start', 'Démarrer…', () => { const current = assertScope(scope), plan = readShipReactorStart275(current, structure.id); if (!plan.ok) throw Error(plan.reason); const ids = [...plan.reactorIds]; confirm('Démarrer le réacteur stellaire', `${ids.length} réacteur(s) relié(s) vont commencer un démarrage de quatorze jours. Le signal attirera des attaques sur cette carte. Préparez les défenses avant de commencer.`, async () => { const fresh = assertScope(scope), next = readShipReactorStart275(fresh, structure.id); if (!next.ok || next.reactorIds.length !== ids.length || next.reactorIds.some((id, index) => id !== ids[index])) throw Error('Les réacteurs reliés ont changé. Confirmez à nouveau leur démarrage.'); await send({ type: 'ship-reactor-start', reactorId: structure.id, reactorIds: ids }); }); })] });
  }
  return rows;
}
