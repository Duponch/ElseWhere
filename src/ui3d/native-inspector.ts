import {isShipComputerSensorsKind298} from '../sim/ship-computer-sensors-content-298';
import { stripInspectorAction351 } from '../sim/strip-351';
import { PLAN_COLORS_369, PLAN_COLOR_DEFS_369, isPlanColor369, planById369, planLabel369, totalPlanArea369 } from '../sim/plans-369';
import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {readingRefusal295} from '../sim/reading-runtime-295';
import type { NativeControl, NativePage, NativeRow, NativeUiActions, NativeUiState } from './native-contract';
import type { Command, MaterialPile, Pawn, StorageSettings, Structure, World } from '../sim/types';
import type { MedicalRecord } from '../sim/injury-types';
import type { CookingBill, BillSettings } from '../sim/cooking-types';
import type { BillWorkerOptions283 } from '../sim/bill-worker-state-283';
import { mapObjectActions, mapObjectGroupActions } from '../ui/map-object-actions';
import { mapObjectsAt, mapObjectExists, type MapObjectSelection } from '../ui/map-object-selection';
import { selectedMapJob296 } from '../ui/wall-door-selection-296';
import { constructionRecipe } from '../sim/construction-materials';
import { mapCellDetails } from '../ui/map-cell-details';
import { rockThingLabel } from '../ui/geology-inspection';
import { floraDefinition } from '../sim/biome-flora';
import { rockMaxHP } from '../sim/mining-rules';
import { buildingLabels } from '../ui/building-labels';
import { animalDescription, animalTitle, buildingDescription, buildingTitle, itemDescription, itemTitle, traitLabel, traitTooltip, wildPlantTitle } from '../lore/lore-text';
import { plantInspection } from '../ui/plant-inspection';
import { STORAGE_FILTER_TREE, storageTreeSelection, storageTreePermissions, storageNodeLeaves, STORAGE_LEAVES } from '../ui/storage-filter-tree';
import {nativeStorageTreeRows} from './native-storage-editor';
import { shelfControlOptions } from '../ui/shelf-inspection';
import { ITEM_DEFINITIONS } from '../sim/items';
import { STRUCTURE_DEFINITIONS } from '../sim/definitions';
import { stationRecipes, PRODUCTION_RECIPES } from '../sim/production-recipes';
import { supportsBillReservePause289 } from '../sim/bill-pause-rules-289';
import { productionRecipeSkill283, readBillWorkerPolicy283 } from '../sim/bill-worker-rules-283';
import { BILL_STACK_MAX_COUNT, billClipboard, billPasteRefusal, copyBillToClipboard, pasteBillFromClipboard } from '../ui/bill-clipboard';
import { isApparelCountRecipe278, isBillTaintedSchema374, newApparelCountFilter278 } from '../sim/apparel-count-278';
import { isSchema278OrLater } from '../sim/schema-compatibility-257';
import { groundMaxStacks } from '../sim/shelf-storage';
import { stockpileZoneId } from '../sim/stockpile-zones';
import { buildCopy346 } from './native-build-copy-346';
import { selectionDraftCommand, selectionFireAtWillCommand, selectionStopCommand } from '../ui/drafting-controls';
import { isColonist, isCarePatient } from '../sim/affiliation';
import { biologicalYears, chronologicalYears } from '../sim/human-age';
import { appearanceOf } from '../sim/pawn-appearance';
import { BACKGROUND_SKILL_IDS, backgroundSkillRefusal } from '../sim/colonist-backgrounds';
import { TRAITS, breakThresholds, globalLearningFactor, moveSpeedFactor361, workSpeedGlobal361 } from '../sim/traits';
/** Schema 361: the general work and walking speeds of the traits, when they differ. */
const traitProfile361 = (pawn: Pawn): string => `${workSpeedGlobal361(pawn) !== 1 ? ` Vitesse de travail générale ${Math.round(workSpeedGlobal361(pawn) * 100)} %.` : ''}${moveSpeedFactor361(pawn) !== 1 ? ` Marche de base ${(4.6 * moveSpeedFactor361(pawn)).toFixed(1).replace('.', ',')} cases par seconde.` : ''}`;
import { MENTAL_CRISIS_CATALOG } from '../sim/mental-catalog';
import { mentalCrisisView } from '../sim/mental-presentation';
import { NEED_THRESHOLDS } from '../ui/need-gauge';
import { moodThoughts, moodTarget } from '../sim/mood';
import { captureRelationshipPeople } from '../sim/relationship-namespace';
import { relationshipIndex } from '../sim/relationship-runtime';
import { opinionOf, opinionCauses, SOCIAL_LABELS } from '../sim/social-state';
import { pawnBody } from '../sim/health-rules';
import { BODY_PARTS } from '../sim/body-definition';
import { BLOOD_UNIT, HP_UNIT, PAIN_UNIT, INJURY_RULES } from '../sim/injury-rules';
import { medicalBleed, medicalPain } from '../sim/injury-state';
import { MEDICAL_CARE, medicalCare, type MedicalCare } from '../sim/medicine-rules';
import { ARTIFICIAL_PARTS, artificialPartAvailable273, artificialPartIngredient273 } from '../sim/artificial-parts-rules';
import type { ArtificialPartKind } from '../sim/artificial-parts-types';
import { SURGICAL_LIMBS } from '../sim/surgery-anatomy';
import { surgeryRequestReason, surgeryInstallRequestReason, surgeryRemoveRequestReason273 } from '../sim/surgery-rules';
import { MALNUTRITION_UNIT } from '../sim/malnutrition';
import { summaryHealthPercent } from '../sim/threat-points';
import { assignmentAt, type ScheduleAssignment } from '../sim/schedule';
import type { NativeBioCard } from './native-bio-card';
import { NATIVE_INK } from './native-ui-scale';
import { resetCardScroll } from './native-tab-card';
import { needsSpec, healthEntries, capacitySpecs, painLabel } from './native-inspector-tabs';
import type { HealthSettingSpec, HealthOperationsSpec } from './native-tab-health';
import type { GearRowSpec, GearSpec } from './native-tab-gear';
import type { SocialRowSpec, InteractionSpec, LogLineSpec } from './native-tab-social';
import type { PrisonerLineSpec } from './native-tab-prisoner';
import { commercialMass } from '../sim/commercial-mass';
import { physicalTravelUnitMass } from '../sim/tree-transfer-mass';
import { BODY_COVERAGE } from '../sim/body-definition';
import { HEAT_UNIT, comfortableTemperature, apparelInsulation } from '../sim/heat-rules';
import { INFECTION_UNIT } from '../sim/infection-rules';
import { wornApparel, apparelLabel, apparelDefinition, armorPiece } from '../sim/apparel-rules';
import { QUALITY_LABELS, WEAPON_QUALITIES, equippedWeapon, weaponLabel, type WeaponQuality } from '../sim/equipment-rules';
import { minifiable } from '../sim/furniture-rules';
import { targetBuildingPlayerUse263 } from '../sim/world-target-building-263';
import { healthCapacityTooltip, healthPartTooltip, healthSurgeryView } from '../ui/health-inspection';
import { backgroundInspectionRows, backgroundRestrictionRows } from '../ui/background-inspection';
import type { TooltipContent } from '../ui/tooltip';
import { nativeSpecialRows, nativeClinicalConditionRows } from './native-special-inspection';
import { itemInformation } from '../ui/item-information';
import { learningFactor, XP_SCALE, xpRequired, constructionSpeed } from '../sim/skills';
import { plantSkill, plantWorkSpeed, plantHarvestYield } from '../sim/plant-skills';
import { miningSkill, miningWorkSpeed, miningYield } from '../sim/mining-skills';
import { cookingSpeed, butcherySpeed, butcheryEfficiency } from '../sim/cooking-statistics';
import { medicalTendSpeed, medicalTendQuality } from '../sim/care-rules';
import { socialImpact } from '../sim/social-state';
import { HUMAN_BODY, BODY_INDEX, type BodyPartId } from '../sim/body-definition';
import { bodyEfficiencies } from '../sim/body-capacities';
import { remainingPartHealth, partMissing, injuryBleed, freshMissing } from '../sim/injury-state';
import { artificialPartCovering, artificialPartEfficiencies } from '../sim/artificial-parts-rules';
import { humanLimbVisualMask } from '../render/human-anatomy-presentation';
import { apparelAppearance } from '../render/character-apparel';
import { portraitDataUrl, portraitExpressionOf } from '../ui/pawn-portrait';
import { nativeTextEntitiesFor } from './native-text-entities';
import { registeredMapId } from '../sim/world-map-context';
import { fuelLimit } from '../sim/fuel';
import { batteryWattDays, BATTERY_CAPACITY, BATTERY_ENERGY_SCALE } from '../sim/power-battery';
import { gestationTicks } from '../sim/animal-life';
import { colonyExpectation } from '../sim/colony-economy';
import { RECREATION_KINDS, recreationMood } from '../sim/recreation-rules';
import { corpseStage } from '../sim/corpses';
import { powerInspection } from '../ui/power-inspection';
import { brewingInspection265 } from '../ui/brewing-inspection-265';
import { eggBoxInspection374Text } from '../ui/egg-box-inspection-374';
import { toolCabinetInspection355 } from '../ui/tool-cabinet-inspection-355';
import { productKind, productFullness } from '../sim/animal-products';
import { queryPawnStatus, queryJobStatus } from '../sim/diagnostics';
import { specificWorkActivity } from '../ui/work-activity';
import { coupleActivity285 } from '../ui/couple-activity-285';
import { animalActivity } from '../ui/animal-activity';
import { structureMaxHp, pileMaxHp, pileDamage, resourceMaxHp } from '../sim/thing-damage-rules';
import { mechanoidView } from '../sim/mechanoid-presentation';
import { animalSpecies } from '../sim/animal-species';
import { animalLifeStage, animalBodySize, animalFoodPerDay, animalNutritionMax } from '../sim/animal-life';
import { animalBody } from '../sim/wildlife-health';
import { animalBodyModel } from '../sim/body-model';
import { actualAnimalName256 } from '../sim/starting-pet-state-256';
import { tameRefusal, handlingSkill } from '../sim/animal-handling';
import { slaughterRefusal } from '../sim/animal-slaughter';
import { isExecuteRelease364 } from '../sim/execute-release-364';
import type { PrisonerMode } from '../sim/prisoner-state';
import { readAnimalTraining282, trainingRefusal282, ANIMAL_TRAINING_LABELS_282 } from '../sim/animal-training-282';
import { supportsAnimalAreas287, currentAnimalAreaChoice287 } from '../sim/animal-area-policy-287';
import { animalRescueReason } from '../sim/animal-rescue';
import { eggSpeciesForItem256 } from '../sim/animal-egg-content-v256';
import { eggAllowedForPlayer256 } from '../sim/animal-egg-permission-v256';
import { LightEnvironmentCache } from '../sim/light-environment';
import { isMoodBasics345, roomSizeAdmitted345, roomSizeLevel345 } from '../sim/room-size-need-345';
import { isOutdoors359, outdoorsLevel359, outdoorsNeedApplies359 } from '../sim/outdoors-need-359';import { indoorsLevel362, indoorsNeedApplies362 } from '../sim/indoors-need-362';import { isTraitLinks362, painShockThreshold362 } from '../sim/trait-links-362';import { inspirationInspectLine360 } from '../sim/inspirations-360';

type Tab = 'journal' | 'gear' | 'social' | 'bio' | 'needs' | 'health' | 'prisoner';
// Core's human tabs (Races_Humanlike `inspectorTabs`), drawn from the pane's
// right edge leftwards: Health, Needs, Character, Social, Prisoner, Gear, Log.
// Declared here left to right.
const tabs: readonly [Tab, string][] = [['journal', 'Journal'], ['gear', 'Matériel'], ['prisoner', 'Prisonnier'], ['social', 'Social'], ['bio', 'Bio'], ['needs', 'Besoins'], ['health', 'Santé']];
/** `ITab.size` of each window; the Bio card is 480 × 455 inside 17 points. */
const tabSizes: Record<Tab, { width: number; height: number; margin: number }> = { bio: { width: 514, height: 489, margin: 17 }, needs: { width: 580, height: 520, margin: 0 }, health: { width: 630, height: 430, margin: 0 }, gear: { width: 460, height: 450, margin: 0 }, social: { width: 540, height: 510, margin: 0 }, journal: { width: 630, height: 510, margin: 0 }, prisoner: { width: 280, height: 450, margin: 0 } };
/** Planning's labels and colours (native-panels.ts), for the pane's gauge. */
const scheduleLabels: Record<ScheduleAssignment, string> = { anything: 'Temps libre', work: 'Travail', sleep: 'Dormir', recreation: 'Loisir' };
const scheduleColors: Record<ScheduleAssignment, string> = { anything: '#e9d2a9', work: '#dfb7a4', sleep: '#c2d5e0', recreation: '#c9dfc1' };
const skillLabels: Record<string, string> = { shooting: 'Tir', melee: 'Mêlée', construction: 'Construction', mining: 'Minage', cooking: 'Cuisine', plants: 'Plantes', animals: 'Animaux', crafting: 'Artisanat', artistic: 'Artistique', medicine: 'Médecine', social: 'Social', intellectual: 'Intellectuel' };
const capacityLabels: Record<string, string> = { consciousness: 'Conscience', moving: 'Mouvement', manipulation: 'Manipulation', talking: 'Parole', eating: 'Alimentation', sight: 'Vue', hearing: 'Ouïe', breathing: 'Respiration', bloodFiltration: 'Filtrage du sang', bloodPumping: 'Pompage du sang', digestion: 'Digestion' };
const capacityHelp: Record<string, string> = {
  consciousness: 'Le cerveau, la douleur, le pompage du sang, la respiration et le filtrage déterminent la conscience. Les affections peuvent imposer une pénalité ou un plafond.',
  moving: 'Les jambes, pieds, orteils, bassin et colonne déterminent la marche ; la conscience participe à sa capacité actuelle.',
  manipulation: 'Bras, épaules, mains et doigts contribuent à la manipulation, après effets de la conscience et des affections.',
  talking: 'La mâchoire, le cou, la langue et la conscience participent à la parole.',
  eating: 'La mâchoire, le cou, la langue et la conscience déterminent l’alimentation. La manipulation intervient aussi dans la vitesse d’ingestion.',
  sight: 'Le meilleur œil compte pour 75 % de la vue et l’autre pour 25 %.', hearing: 'La meilleure oreille compte pour 75 % de l’ouïe et l’autre pour 25 %.',
  breathing: 'La moyenne des poumons est multipliée par l’efficacité du cou et par la moyenne de la cage thoracique et du sternum.',
  bloodFiltration: 'La moyenne des reins est multipliée par l’efficacité du foie.', bloodPumping: 'Le pompage dépend de l’efficacité du cœur.', digestion: 'La digestion dépend de la moyenne de l’estomac et du foie.',
};
const relationLabels: Record<string, string> = { parent: 'Parent', child: 'Enfant', sibling: 'Fratrie', lover: 'Partenaire', spouse: 'Conjoint', 'ex-lover': 'Ancien partenaire', 'ex-spouse': 'Ancien conjoint' };
const pct = (value: number) => `${Math.round(value * 100)} %`;
const signed = (value: number) => `${value > 0 ? '+' : ''}${Number(value.toFixed(1))}`;
/** Core `MainTabWindow_Inspect.OpenTabType`: no tab open at first; a tab stays
 * open across selections while the new selection has it. */
let activeTab: Tab | null = null, feedback = '', latest: NativeUiState, owner: NativeUiActions;
let healthPane: 'overview' | 'operations' = 'overview';
/** Core `ITab_Pawn_Log`: « Tout » off, « Social » and « Combat » on at first. */
const logFilter = { all: false, social: true, combat: true };
let portraitClothed = true;
export function setNativeInspectorTab(value:string):void {
  if(value==='none'){activeTab=null;subpage=undefined;resetCardScroll();return;}
  if(!tabs.some(([tab])=>tab===value))return;activeTab=value as Tab;subpage=undefined;resetCardScroll();
}
let selectionKey = '', subpage: { kind: 'bills' | 'storage' | 'item' | 'anatomy'; structureId?: number; stockpileId?: number; itemId?: number; pawnId?: number } | undefined;
const billDrafts = new Map<string, BillSettings>();
const billWorkers = new Map<string, BillWorkerOptions283>();
let storageClipboard: StorageSettings | undefined;
let storageNavigation: {target:string;search:string;expanded:Set<string>} | undefined;
const lightCache = new LightEnvironmentCache();

function row(id: string, label: string, value?: string, hint?: string): NativeRow { return { id, label, value, hint }; }
function tooltipText(tip: TooltipContent): string { return [tip.body, ...(tip.rows ?? []).map(fact => `${fact.label} : ${fact.value}`)].filter(Boolean).join(' · '); }
function heading(id: string, label: string): NativeRow { return { id: `heading-${id}`, label, emphasis: 'heading' }; }
function meterRow(id: string, label: string, value: number, max = 1, hint?: string, display = pct(value / max), color = '#4e8277'): NativeRow { return { id, label, value: display, hint, meter: { value, max, label: display, color } }; }
const tabHints: Record<Tab, string> = {
  bio: 'Âge, traits et compétences. Survoler une compétence pour consulter son expérience et ses effets.',
  needs: 'Nourriture, sommeil, confort, loisirs et pensées qui influencent l’humeur.',
  health: 'Capacités, blessures, maladies et politiques de soins. Les opérations se demandent dans leur sous-onglet.',
  gear: 'Arme, vêtements et objets réellement possédés ou transportés.',
  social: 'Opinions réciproques et interactions consignées avec les autres personnes.',
  journal: 'Échanges et combats consignés pour cette personne.',
  prisoner: 'Mode de détention, résistance, régime et recrutement.',
};
const needHelp = {
  hunger: 'La réserve diminue au fil du temps et remonte au repas réellement consommé. Sous 24 % : faim ; sous 12 % : très faim. À zéro, la malnutrition progresse.',
  rest: 'Le repos remonte pendant le sommeil, plus efficacement dans un lit. Sous 28 % : somnolence ; sous 14 % : grande fatigue ; sous 1 % : épuisement. Une fatigue extrême peut provoquer un effondrement.',
  comfort: 'Le confort vient du lit ou du siège utilisé et redescend hors des meubles confortables. Sous 10 % : inconfort ; à partir de 60, 70, 80 et 90 % : pensées de confort croissantes.',
  beauty: 'L’exposition récente aux objets, au terrain et à la saleté influence ce besoin. Jusqu’à 1 % : environnement affreux ; sous 15 % : très laid ; sous 35 % : laid. À partir de 65, 85 et 99 % : pensées de beauté croissantes.',
};
function repaint(): void { const page = buildNativeInspector(owner.readState?.() ?? latest, owner); if (page) owner.showPage(page); owner.refresh(); }
function control(id: string, label: string, action: () => unknown, disabled = false, active = false, hint?: string): NativeControl {
  const epoch = latest.epoch, mapId = latest.world && registeredMapId(latest.world), seed = latest.world?.seed;
  return { id, label, disabled: disabled || latest.busy, active, hint: hint ?? label, onActivate: async () => {
    const current = owner.readState?.() ?? latest;
    if (disabled || current.busy) return;
    if (current.epoch !== epoch || current.world?.seed !== seed || (current.world && registeredMapId(current.world)) !== mapId) { feedback = 'La carte a changé. Sélectionnez à nouveau cet objet.'; repaint(); return; }
    latest = current;
    feedback = ''; try { await action(); } catch (cause) { feedback = cause instanceof Error ? cause.message : String(cause); } repaint();
  } };
}
async function send(command: Command): Promise<unknown> {
  const result = await owner.command(command);
  if (result && typeof result === 'object' && 'ok' in result && result.ok === false) throw Error('reason' in result ? String(result.reason) : 'La commande a été refusée.');
  owner.refresh(); return result;
}
function command(id: string, label: string, value: Command, disabled = false, active = false, hint?: string): NativeControl { return control(id, label, () => send(value), disabled, active, hint); }
function choices<T extends string | number>(id: string, label: string, value: T, values: readonly T[], change: (value: T) => unknown, labelOf: (value: T) => string = String, disabled = false): NativeRow {
  const options = values.map((next, index) => control(`${id}-${index}`, labelOf(next), () => change(next), disabled, value === next));
  const select = control(id, labelOf(value), () => undefined, disabled);
  select.select = { value: String(value), options: values.map(next => ({ value: String(next), label: labelOf(next) })), onChange: async text => {
    const index = values.findIndex(next => String(next) === text); if (index < 0) return;
    await options[index]!.onActivate();
  } };
  return { id, label, value: labelOf(value), compact:true, controls: [select] };
}
function numberRow(id: string, label: string, value: number, min: number, max: number, change: (value: number) => unknown, disabled = false): NativeRow {
  const epoch = latest.epoch, mapId = latest.world && registeredMapId(latest.world);
  const apply = async (text: string) => {
    const current = owner.readState?.() ?? latest;
    if (current.busy || disabled) return false;
    if (current.epoch !== epoch || (current.world && registeredMapId(current.world)) !== mapId) { feedback = 'La carte a changé. Sélectionnez à nouveau cet objet.'; repaint(); return false; }
    latest = current;
    const next = Number(text); if (!text.trim() || !Number.isSafeInteger(next) || next < min || next > max) { feedback = `Saisissez un entier de ${min} à ${max}.`; repaint(); return false; }
    feedback = ''; try { await change(next); } catch (cause) { feedback = cause instanceof Error ? cause.message : String(cause); repaint(); return false; } repaint();
  };
  return { id, label, value: String(value), input: { value: String(value), kind: 'number', onCommit: apply }, controls: [
    control(`${id}-less`, '−', () => change(value - 1), disabled || value <= min), control(`${id}-more`, '+', () => change(value + 1), disabled || value >= max),
  ] };
}
function booleanRow(id: string, label: string, value: boolean, change: (value: boolean) => unknown, disabled = false): NativeRow {
  return { id, label, value: value ? 'Oui' : 'Non', compact:true, controls: [control(id, value ? 'Désactiver' : 'Activer', () => change(!value), disabled, value)] };
}
function bodyRows(record: MedicalRecord | undefined, labels: (part: keyof typeof BODY_PARTS) => string = part => BODY_PARTS[part].label): NativeRow[] {
  if (!record) return [meterRow('pain', 'Douleur', 0, 1, 'La douleur provient des lésions, des parties fraîchement perdues et de certaines affections.', 'Aucune'), row('health-clear', 'Aucune lésion enregistrée')];
  const rows: NativeRow[] = [];
  if (record.death) rows.push(row('death', 'Décès', ({ execution: 'Exécution', 'blood-loss': 'Perte de sang', 'vital-failure': 'Défaillance vitale', trauma: 'Traumatisme', heatstroke: 'Coup de chaleur', hypothermia: 'Hypothermie', downed: 'État clinique fatal', infection: 'Infection', malnutrition: 'Malnutrition', flu: 'Grippe', malaria: 'Paludisme', plague: 'Peste', 'sleeping-sickness': 'Maladie du sommeil', 'heart-artery-blockage': 'Obstruction artérielle', 'heart-attack': 'Crise cardiaque', 'toxic-buildup': 'Charge toxique', scaria: 'Scaria' })[record.death.cause]));
  rows.push(meterRow('pain', 'Douleur', medicalPain(record), 1, `La douleur provient des lésions, des parties fraîchement perdues et de certaines affections. L’anesthésie atténue la douleur ; une douleur totale d’au moins ${Math.round(painShockThreshold362(record) * 100)} % provoque une incapacité${record.wimp362 ? ' (douillet)' : ''}.`, pct(medicalPain(record)), '#c08a77'), meterRow('blood', 'Sang perdu', record.bloodLoss, BLOOD_UNIT, 'Le saignement fait progresser la perte de sang. Le traitement des plaies arrête leur saignement ; la récupération du sang reste progressive.', pct(record.bloodLoss / BLOOD_UNIT), '#b26c5b'), meterRow('bleed', 'Saignement par jour', medicalBleed(record), 1, 'Le traitement des plaies arrête leur saignement ; la récupération du sang reste progressive.', pct(medicalBleed(record)), '#b26c5b'));
  for (const injury of record.injuries) rows.push(row(`injury-${injury.id}`, labels(injury.part), `${injury.scar?.pain !== undefined ? 'Cicatrice' : INJURY_RULES[injury.kind].label} · −${(injury.severity / HP_UNIT).toFixed(2)} PV`, `${injury.scar?.pain !== undefined ? 'Cette ancienne lésion laisse une cicatrice permanente. ' : ''}${artificialPartCovering(record, injury.part) ? 'Lésion de prothèse, sans douleur ni saignement.' : `Douleur avant anesthésie +${pct(injury.severity * (injury.scar?.pain !== undefined ? 5 * injury.scar.pain : INJURY_RULES[injury.kind].painUnits) / PAIN_UNIT)} · Saignement ${pct(injuryBleed(record, injury))}/jour.`} ${injury.tended === undefined ? 'Non soignée' : `Soignée · qualité ${Math.round(injury.tended / 10)} %`}`));
  for (const missing of record.missing) if (!artificialPartCovering(record, missing.part)) rows.push(row(`missing-${missing.part}`, labels(missing.part), 'Partie perdue', missing.tended ? 'Plaie soignée' : undefined));
  for (const part of record.artificialParts ?? []) rows.push(row(`artificial-${part.part}`, labels(part.part), ARTIFICIAL_PARTS[part.kind].label, `Efficacité ${pct(ARTIFICIAL_PARTS[part.kind].efficiency)}`));
  for (const [key, label, unit] of [['malnutrition', 'Malnutrition', MALNUTRITION_UNIT], ['heatstroke', 'Coup de chaleur', HEAT_UNIT], ['hypothermia', 'Hypothermie', HEAT_UNIT]] as const) if (record[key]) rows.push(meterRow(key, label, record[key]!, unit));
  if (record.infections) { rows.push(meterRow('immunity', 'Immunité contre les infections', record.infections.immunity, INFECTION_UNIT)); record.infections.cases.forEach((infection, i) => rows.push(meterRow(`infection-${i}`, `Infection · ${labels(infection.part)}`, infection.severity, INFECTION_UNIT, 'La gravité et l’immunité progressent séparément. Soins, qualité des médicaments et repos influencent leur évolution.'))); }
  for (const condition of record.ageAilments ?? []) rows.push(row(`age-${condition}`, condition === 'bad-back' ? 'Lumbago' : 'Frêle'));
  rows.push(...nativeClinicalConditionRows(record));
  return rows;
}

function itemPage(world: World, id: number): NativePage | null {
  const pile = world.piles.find(pile => pile.id === id); if (!pile) return null;
  const info = itemInformation(pile, world);
  return { id: `inspect-item-information-${id}`, title: info.title, subtitle: info.description, layout: 'inspector',
    rows: info.rows.map((fact, index) => row(`item-information-${index}`, `${fact.category} · ${fact.label}`, fact.value, fact.description)),
    actions: [control('item-information-back', 'Retour', () => { subpage = undefined; })] };
}
function anatomyPage(world: World, pawn: Pawn): NativePage {
  const health = pawn.health, efficiencies = bodyEfficiencies({ damage: health?.injuries.map(injury => ({ part: injury.part, loss: injury.severity / HP_UNIT })) ?? [], missing: health?.missing.map(part => part.part) ?? [], pain: 0, ...(health?.artificialParts ? { artificialParts: artificialPartEfficiencies(health) } : {}) });
  const rows: NativeRow[] = [];
  for (const definition of HUMAN_BODY) {
    const part = definition.id, added = health && artificialPartCovering(health, part), missing = !!health && partMissing(health, part), efficiency = efficiencies[BODY_INDEX[part]]!;
    rows.push(row(`anatomy-${part}`, definition.label, added ? `${ARTIFICIAL_PARTS[added.kind].label}${added.part !== part ? ' · Partie naturelle remplacée par celle du parent' : ''}` : missing ? 'Absente' : `${health ? (remainingPartHealth(health, part) / HP_UNIT).toFixed(2) : definition.hp} / ${definition.hp} PV`, `${definition.depth === 'inside' ? 'Interne' : 'Externe'} · Efficacité anatomique ${pct(efficiency)}${definition.parent ? ` · Sous ${BODY_PARTS[definition.parent].label.toLocaleLowerCase('fr-FR')}` : ''}`));
    rows.at(-1)!.meter = { value: missing ? 0 : health ? remainingPartHealth(health, part) / HP_UNIT : definition.hp, max: definition.hp, label: rows.at(-1)!.value, color: '#89a48b' };
    for (const injury of health?.injuries.filter(injury => injury.part === part) ?? []) rows.push(row(`anatomy-injury-${injury.id}`, injury.scar?.pain !== undefined ? 'Cicatrice permanente' : INJURY_RULES[injury.kind].label, `−${(injury.severity / HP_UNIT).toFixed(2)} PV · Saignement ${pct(injuryBleed(health!, injury))}/jour`, injury.tended === undefined ? 'Non soignée' : `Soignée · qualité ${pct(injury.tended / 1000)}`));
    const lost = health?.missing.find(missing => missing.part === part); if (lost && !added) rows.push(row(`anatomy-missing-${part}`, 'Plaie de membre perdu', lost.tended ? 'Soignée' : freshMissing(health!, lost) ? 'Fraîche · Non soignée' : 'Fermée'));
  }
  return { id: `inspect-anatomy-${pawn.id}`, title: `${pawn.name} · Anatomie`, rows, layout: 'inspector', actions: [control('anatomy-back', 'Retour', () => { subpage = undefined; })] };
}

/** The selected colonists, in selection order, when this dossier belongs to
 * the selection; otherwise this pawn alone. */
function selectionGroup(world: World, pawn: Pawn): Pawn[] {
  if (!latest.selectedPawnIds.includes(pawn.id)) return [pawn];
  return latest.selectedPawnIds.flatMap(id => { const person = world.pawns.find(candidate => candidate.id === id); return person && isColonist(person) && !person.prisoner ? [person] : []; });
}
/** Core `HealthUtility.GetGeneralConditionLabel` (short): the pane's health gauge. */
function healthCondition(pawn: Pawn): string {
  if (pawn.state === 'dead') return 'Mort';
  if (pawn.state === 'downed') return 'À terre';
  if (pawn.health?.injuries.some(injury => injury.scar === undefined)) return 'Blessé';
  return 'En bonne santé';
}
/** Core `Need_Mood.MoodString`, with the person's own break thresholds. */
function moodString(pawn: Pawn, thresholds: readonly [number, number, number]): string {
  if (pawn.mental?.crisis) return 'Crise mentale';
  const extreme = thresholds[2], minor = thresholds[0], mood = pawn.mood;
  return mood < extreme ? 'Au bord de la crise' : mood < extreme + 5 ? 'Sur les nerfs' : mood < minor ? 'Stressé' : mood < 65 ? 'Neutre' : mood < 90 ? 'Content' : 'Heureux';
}
/** The Bio card of Core `CharacterCardUtility`: name, « genre, âge » and the
 * faction chip, stories in chips at x 90, traits and incapacities in chips, the
 * twelve skills. Every detail that is not drawn is in a tooltip (Core 2.5). */
function bioCard(world: World, pawn: Pawn, sex: 'male' | 'female', colonist: boolean): NativeBioCard {
  const bio = pawn.age ? biologicalYears(pawn.age) : undefined, chrono = pawn.age ? chronologicalYears(pawn.age) : undefined;
  const description = { label: `${sex === 'female' ? 'Femme' : 'Homme'}${bio !== undefined ? `, ${bio} ans${chrono !== bio ? ` (${chrono})` : ''}` : ''}`, hint: bio !== undefined ? `Âge biologique : ${bio} ans. Âge chronologique : ${chrono} ans.` : 'Âge non renseigné.' };
  const registry = world.worldFactions, own = colonist ? registry?.factions.find(faction => faction.id === registry.playerFactionId) : undefined;
  // Core `pawn.Faction != null && !Faction.Hidden`: the colony's own faction is a chip too; a world saved before the faction registry shows it as « Colonie ».
  const colonyName = own?.name ?? (colonist ? 'Colonie' : undefined);
  const faction = colonyName ? { id: 'bio-faction', label: colonyName, hint: `Faction\n\n${pawn.name} appartient à ${colonyName}, votre colonie.\n\nCliquer pour ouvrir les factions.`, onActivate: () => owner.openFactions?.() } : undefined;
  const stories = backgroundInspectionRows(pawn, sex).map((story, index) => ({ phase: story.phase, chip: { id: index ? 'adulthood' : 'childhood', label: story.label, hint: tooltipText(story.tooltip) } }));
  const traits = (pawn.traits ?? []).map(trait => ({ id: `trait-${trait}`, label: traitLabel(trait, sex), hint: traitTooltip(trait, { name: pawn.name, sex }) }));
  const incapable = backgroundRestrictionRows(pawn).map((restriction, index) => ({ id: `refusal-${index}`, label: restriction.label, hint: restriction.reason }));
  const traitsHint = `Effets du profil : apprentissage général ${pct(globalLearningFactor(pawn))}. Risque de crise sous ${breakThresholds(pawn).map(value => Number(value.toFixed(2))).join(' / ')} % d’humeur (mineur / majeur / extrême).${traitProfile361(pawn)}`;
  const skills = BACKGROUND_SKILL_IDS.map(skill => {
    const record = skill === 'mining' ? miningSkill(pawn) : skill === 'plants' ? plantSkill(pawn) : pawn.skills[skill] ?? { level: 0, xp: 0, dailyXp: 0, passion: 0 as const }, reason = backgroundSkillRefusal(pawn, skill);
    const effects = skill === 'construction' ? `Vitesse ${pct(constructionSpeed(pawn))} avant lumière.` : skill === 'mining' ? `Vitesse ${pct(miningWorkSpeed(pawn))} avant lumière · Rendement minéral ${pct(miningYield(pawn))}, pondéré par les dégâts de chaque coup.` : skill === 'plants' ? `Travail ${pct(plantWorkSpeed(pawn))} avant lumière · Réussite ${pct(Math.min(1, plantHarvestYield(pawn)))} · Bonus de rendement ${pct(Math.max(0, plantHarvestYield(pawn) - 1))}. Les arbres ne subissent pas d’échec de récolte.` : skill === 'cooking' ? `Cuisine ${pct(cookingSpeed(pawn))} · Boucherie ${pct(butcherySpeed(pawn))} · Rendement de boucherie ${pct(butcheryEfficiency(pawn))}.` : skill === 'medicine' ? `Vitesse de soins ${pct(medicalTendSpeed(pawn))} avant lumière · Qualité de base ${pct(medicalTendQuality(pawn))}, puis médicament, lit et aléa.` : skill === 'social' ? `Impact social ${pct(socialImpact(pawn))}.` : skill === 'crafting' ? 'Influe sur la qualité de confection, sans accélérer la taille de pierre.' : skill === 'artistic' ? 'Détermine la qualité des sculptures, sans accélérer leur travail.' : skill === 'intellectual' ? 'Recherche et synthèse des médicaments.' : skill === 'animals' ? 'Apprivoisement, dressage et entretien ; les exigences dépendent de l’espèce et du travail.' : skill === 'shooting' ? 'Précision avec les armes à distance, après capacités et conditions du tir.' : 'Combat au contact, après capacités et conditions du combat.';
    const passion = record.passion === 2 ? 'Passion brûlante' : record.passion === 1 ? 'Passion' : 'Sans passion';
    const xp = `${(record.xp / XP_SCALE).toFixed(1)} / ${xpRequired(record.level) / XP_SCALE} XP`;
    const hint = `${skillLabels[skill]} ${record.level}/20 · ${passion}. ${reason ? `${reason} Le niveau enregistré est conservé ; cette compétence n’apprend pas et n’oublie pas.` : effects} Expérience du niveau : ${xp} · ${pct(Math.max(0, record.xp / xpRequired(record.level)))} du niveau. Aujourd’hui ${(record.dailyXp / XP_SCALE).toFixed(1)} / 4 000 XP avant saturation. Apprentissage : ${reason ? 'Indisponible' : pct(learningFactor(record, pawn))}${record.dailyXp > 4000 * XP_SCALE ? ' (saturation quotidienne)' : ''}.`;
    return { id: `skill-${skill}`, label: skillLabels[skill]!, level: record.level, passion: record.passion, disabled: !!reason, hint };
  });
  return { name: pawn.name, description, faction, stories, traits, traitsHint, incapable, skills };
}
/** The events of the journal that concern this person, most recent first,
 * classified as the old journal did (social exchanges, fights, mental crises). */
function personalEvents(world: World, pawn: Pawn): { index: number; event: World['events'][number]; kind: 'social' | 'combat' | 'mental' }[] {
  const escaped = pawn.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), named = new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu'), labels = Object.values(SOCIAL_LABELS);
  const result: { index: number; event: World['events'][number]; kind: 'social' | 'combat' | 'mental' }[] = [];
  for (const [index, event] of [...world.events].reverse().entries()) {
    if (!named.test(event.message)) continue;
    const lower = event.message.toLocaleLowerCase('fr-FR');
    const mental = event.type === 'need' && ['errance triste', 'frénésie alimentaire', 'crise de destruction', 'fureur violente', 'colère meurtrière'].some(word => lower.includes(word));
    const kind = mental ? 'mental' : labels.some(label => event.message.startsWith(`${label} entre `)) || ['a vexé', 'a insulté', 'bagarre'].some(word => lower.includes(word)) || event.type === 'need' && ['deviennent partenaires', 'repousse l’avance de', 'se sépare de'].some(word => lower.includes(word)) ? 'social' : ['tir', 'touché', 'blessé', 'attaque', 'frappé', 'combat'].some(word => lower.includes(word)) ? 'combat' : undefined;
    if (kind) result.push({ index, event, kind });
  }
  return result;
}
/** Core `ITab_Pawn_Gear.TryDrawOverallArmor`: the worn pieces' ratings (halved
 * and capped at 1) weighted by each part's coverage, doubled, at most 200 %. */
function overallArmor(pieces: readonly MaterialPile[]): Record<'sharp' | 'blunt' | 'heat', number> {
  const result = { sharp: 0, blunt: 0, heat: 0 }, armored = pieces.map(piece => armorPiece(piece));
  for (const kind of ['sharp', 'blunt', 'heat'] as const) {
    let sum = 0;
    HUMAN_BODY.forEach((part, index) => { let through = 1; for (const piece of armored) if (piece.coverage.parts.includes(part.id)) through *= 1 - Math.min(1, Math.max(0, piece.ratings[kind] / 2)); sum += BODY_COVERAGE[index]! * (1 - through); });
    result[kind] = Math.min(2, Math.max(0, sum * 2));
  }
  return result;
}
function pawnPage(world: World, pawn: Pawn): NativePage {
  const colonist = isColonist(pawn) && !pawn.prisoner, alive = pawn.state !== 'dead';
  if (!pawn.prisoner && activeTab === 'prisoner') activeTab = null;
  const sex = appearanceOf(pawn, world.seed).sex, status = pawn.prisoner ? 'Prisonnier' : colonist ? 'Colon' : pawn.visitor ? 'Visiteur' : pawn.podRescue ? 'Naufragé' : 'Hors-la-loi';
  // Core InterfaceToggleTab: clicking the open tab closes it.
  const rows: NativeRow[] = [{ id: 'pawn-tabs', label: '', region:'navigation', compact: true, controls: tabs.filter(([tab]) => tab !== 'prisoner' || pawn.prisoner).map(([tab, label]) => control(`pawn-tab-${tab}`, label, () => { activeTab = activeTab === tab ? null : tab; resetCardScroll(); }, false, activeTab === tab, tabHints[tab])) }];
  // The inspect pane (Core InspectPaneFiller): health, mood, timetable and
  // allowed-area gauges, then the inspect lines.
  const thresholds = breakThresholds(pawn), crises = Object.values(MENTAL_CRISIS_CATALOG).map(crisis => crisis.label.toLocaleLowerCase('fr-FR')).join(', ');
  const moodTip = `Humeur ${Math.round(pawn.mood)} %. ${thresholds.map((value, index) => `${['Risque mineur', 'Risque majeur', 'Risque extrême'][index]} : ${value.toFixed(1)} %`).join(' · ')}. Le risque ne déclenche pas une crise immédiatement. Crises disponibles : ${crises}.`;
  const gauges: NonNullable<NativeRow['gauges']>[number][] = [{ id: 'health', label: healthCondition(pawn), fill: pawn.health ? summaryHealthPercent(pawn.health) : 1, color: '#bdb39c', hint: `Santé générale ${pct(pawn.health ? summaryHealthPercent(pawn.health) : 1)} · ${healthCondition(pawn)}. Le détail est dans l’onglet Santé.` }];
  if (alive) gauges.push({ id: 'mood', label: moodString(pawn, thresholds), fill: pawn.mood / 100, color: '#9fc4bc', hint: moodTip });
  if (colonist && alive) {
    const assignment = assignmentAt(world, pawn);
    gauges.push({ id: 'schedule', label: scheduleLabels[assignment], fill: 1, color: scheduleColors[assignment], hint: `Planning de l’heure actuelle : ${scheduleLabels[assignment]}. Le Planning règle les 24 heures.` });
    const area = world.allowedAreas?.find(entry => entry.id === pawn.allowedAreaId), areaChoice = choices('pawn-area', 'Zone autorisée', area?.id ?? -1, [-1, ...(world.allowedAreas ?? []).map(entry => entry.id)], areaId => send({ type: 'assign-allowed-area', pawnId: pawn.id, areaId: areaId < 0 ? null : areaId }), areaId => areaId < 0 ? 'Sans restriction' : world.allowedAreas?.find(entry => entry.id === areaId)?.label ?? 'Zone', !alive);
    gauges.push({ id: 'area', label: areaChoice.value!, fill: 1, color: area ? `#${area.color.toString(16).padStart(6, '0')}` : '#b9ad96', hint: 'Zone autorisée : cliquer pour la changer. Les zones se gèrent dans Assignations.', select: areaChoice.controls![0]!.select });
  }
  rows.push({ id: 'pawn-gauges', label: '', inspectPane: true, gauges });
  if (!colonist) rows.push({ ...row('pawn-status', '', status), inspectPane: true });
  rows.push({ ...row('pawn-action', '', owner.pawnActivity?.(pawn.id) || coupleActivity285(world, pawn)?.label || specificWorkActivity(world, pawn) || queryPawnStatus(world, pawn).reason, `Activité · case ${pawn.x}, ${pawn.z}`), inspectPane: true });
  // Schema 360: Core's Pawn.GetInspectString shows the inspiration and its time left.
  const inspiration360 = inspirationInspectLine360(world, pawn); if (inspiration360) rows.push({ ...row('pawn-inspiration', inspiration360.label, inspiration360.value, inspiration360.hint), inspectPane: true });
  if (colonist && alive) rows.push({ ...row('pawn-orders', 'Ordres', `${pawn.orders.active !== null ? 'Travail imposé · ' : ''}${pawn.orders.queue.length} en file${pawn.priorityWork ? ` · Case ${pawn.priorityWork.cell.x}, ${pawn.priorityWork.cell.z}` : ''}`), inspectPane: true });
  if (activeTab === 'bio') {
    rows.push({ id: 'bio-card', label: '', bio: bioCard(world, pawn, sex, colonist) });
  } else if (activeTab === 'needs') {
    const tab: NativeRow[] = [];
    tab.push(heading('needs', 'Besoins'));
    for (const [key, label] of [['hunger', 'Nourriture'], ['rest', 'Sommeil'], ['beauty', 'Beauté'], ['comfort', 'Confort']] as const) tab.push(alive ? meterRow(`need-${key}`, label, pawn[key], 100, `${needHelp[key]} Repères de la jauge : ${NEED_THRESHOLDS[key].map(value => `${value} %`).join(' · ')}.`, `${Math.round(pawn[key])} %`) : row(`need-${key}`, label, '—', 'Décédé · Dossier arrêté au décès.'));
    // Schema 359: Core's outdoors need (colonists and prisoners), stepped at each need interval.
    if (isOutdoors359(world.schemaVersion) && outdoorsNeedApplies359(pawn)) {
      const air = outdoorsLevel359(pawn) * 100;
      tab.push(alive ? meterRow('need-outdoors', 'Plein air', air, 100, `Le besoin de voir le ciel. À l’intérieur, il baisse de 32 points par jour sous un toit construit ou de roche mince, sans descendre sous 20 %, et de 45 points par jour sous la roche épaisse d’une montagne, jusqu’à 0. Dehors à ciel ouvert, il se remplit en trois heures ; dehors sous un toit, en une journée (sous la roche épaisse, il baisse de 40 points par jour jusqu’à 20 %) ; sur une case sans toit d’une pièce fermée, en moins de cinq heures. Une pièce qui touche le bord de la carte, ou dont au moins un quart du sol est sans toit, compte comme l’extérieur. Au lit, éveillé, la baisse est cinq fois plus lente ; pendant le sommeil, le besoin reste figé. En caravane, il se remplit comme à ciel ouvert. À 80 % ou moins : envie de prendre l’air (−1) ; à 60 % ou moins : enfermé à l’intérieur (−3) ; à 40 % ou moins : syndrome de la cabane (−5) ; sous 20 % : prisonnier sous terre (−7) ; à 5 % ou moins : enseveli sous terre (−9). Les prisonniers ont ce besoin, sans ces pensées. Repères de la jauge : 5 · 20 · 40 · 60 · 80 %.`, `${Math.round(air)} %`) : row('need-outdoors', 'Plein air', '—', 'Décédé · Dossier arrêté au décès.'));
    }
    // Schema 362: Core's indoors need of an undergrounder (colonists and prisoners).
    if (isTraitLinks362(world.schemaVersion) && indoorsNeedApplies362(pawn)) {
      const inside = indoorsLevel362(pawn) * 100;
      tab.push(alive ? meterRow('need-indoors', 'Intérieur', inside, 100, `Le besoin d’un souterrain de se sentir à l’abri des murs et d’un toit. À l’intérieur, il se remplit en une demi-journée sous la roche épaisse et en une journée sous un toit construit ou de roche mince ; il ne bouge pas dans une pièce sans toit ni dehors sous la roche épaisse. Dehors, sans toit ou sous un toit mince, il baisse de 25 points par jour, comme en caravane. Pendant le sommeil, il reste figé. À 80 % ou moins : un peu trop dehors (−1) ; 60 % : trop longtemps dehors (−3) ; 40 % : dehors bien trop longtemps (−5) ; 20 % : perdu dans les grands espaces (−7) ; 5 % ou moins : écrasé par le ciel (−8). Les prisonniers ont ce besoin, sans ces pensées. Repères de la jauge : 5 · 20 · 40 · 60 · 80 %.`, `${Math.round(inside)} %`) : row('need-indoors', 'Intérieur', '—', 'Décédé · Dossier arrêté au décès.'));
    }
    // Schema 345: Core's room size need (colonists and prisoners), sampled at each need interval.
    if (isMoodBasics345(world.schemaVersion) && roomSizeAdmitted345(pawn)) {
      const space = roomSizeLevel345(pawn) * 100;
      tab.push(alive ? meterRow('need-room-size', 'Espace', space, 100, `Surface de la pièce perçue autour de ce colon, dans un rayon d’environ huit cases ; dehors, le besoin remonte vers 100 %. Le niveau rejoint la valeur de la pièce actuelle à raison de 90 points par heure et reste figé pendant le sommeil. Dans une pièce intérieure, éveillé : sous 1 % intérieur confiné (−10), sous 30 % intérieur exigu (−5), à partir de 70 % intérieur spacieux (+5). Repères de la jauge : 1 · 30 · 70 %.`, `${Math.round(space)} %`) : row('need-room-size', 'Espace', '—', 'Décédé · Dossier arrêté au décès.'));
    }
    tab.push(alive ? meterRow('recreation-level', 'Loisirs', pawn.recreation.level, 100, 'Sous 30 % : manque de loisirs ; sous 15 % : manque important ; sous 1 % : privation. À partir de 70 et 85 % : loisirs satisfaisants. Varier les activités évite la lassitude. Une famille lassante redevient intéressante sous 30 %. Repères de la jauge : 15 · 30 · 70 · 85 %.', `${pawn.recreation.level.toFixed(1)} %`) : row('recreation-level', 'Loisirs', '—'));
    const recreationLabels = { reading:'Lecture', solitary: 'Détente solitaire', dexterity: 'Dextérité', cerebral: 'Jeux cérébraux', social: 'Loisirs sociaux', television: 'Télévision', chemical: 'Consommation de boissons' };
    const pleasure = tab.find(entry => entry.id === 'recreation-level')!;
    pleasure.hint = (pleasure.hint ?? 'Décédé · Dossier arrêté au décès.') + ` La lassitude diminue de ${Math.round((colonyExpectation(world, pawn)?.joyToleranceDropPerDay ?? .18) * 100)} points par jour éveillé. Effet sur l’humeur : ${alive ? signed(recreationMood(pawn.recreation.level)) : '—'}. ` + [...RECREATION_KINDS, 'chemical' as const,...(Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))?['reading' as const]:[]].filter(kind => kind==='reading'||pawn.recreation.tolerance[kind] !== undefined).map(kind => `${recreationLabels[kind]} : ${(pawn.recreation.tolerance[kind]??0).toFixed(1)} %${pawn.recreation.bored[kind] ? ' · lassé' : ''}`).join(' · ');
    tab.push(heading('thoughts', 'Humeur et pensées'));
    const thoughts = moodThoughts(world, pawn), thresholds = breakThresholds(pawn);
    tab.push(alive ? meterRow('need-mood', 'Humeur', pawn.mood, 100, `L’humeur évolue progressivement vers la somme des pensées. Les repères indiquent les seuils de risque de crise mentale. Actuelle : ${pawn.mood.toFixed(1)} %. Cible : ${moodTarget(thoughts).toFixed(1)} %. ${thresholds.map((value, index) => `${['Risque mineur', 'Risque majeur', 'Risque extrême'][index]} : ${value.toFixed(1)} %`).join(' · ')}.`, `${Math.round(pawn.mood)} %`) : row('need-mood', 'Humeur', '—'));

    if (inspiration360) tab.push(row('mood-inspiration', inspiration360.label, inspiration360.value, inspiration360.hint));
    const crisis = alive && mentalCrisisView(world, pawn, structure => buildingLabels[structure.kind]);
    if (crisis) tab.push(row('mood-crisis', crisis.label, crisis.activity, `${crisis.description}${crisis.target ? ` Cible : ${crisis.target.label} (${crisis.target.cell.x}, ${crisis.target.cell.z}).` : ''} Les événements confirmés sont conservés dans le journal.`));
    thoughts.filter(thought => thought.offset !== 0).sort((a, b) => b.offset - a.offset).forEach(thought => tab.push(row(`thought-${thought.id}`, thought.label, signed(thought.offset), `${thought.description}${thought.expiresAt !== undefined ? ` · encore ${Math.ceil((thought.expiresAt - world.tick) / 250)} h` : ''} · Effet sur l’humeur : ${signed(thought.offset)}`)));
    if (pawn.recreation.task) tab.push(row('recreation-task', 'Loisir engagé', ({ skygaze: 'Observer le ciel', horseshoes: 'Fer à cheval', chess: 'Échecs', 'social-relax': 'Détente sociale', 'visit-sick': 'Visite à un malade', 'watch-television': 'Télévision', party: 'Fête collective', read:'Lecture', hoopstone:'Lancer de pierres', billiards:'Billard', 'game-of-ur':'Jeu royal d’Ur', poker:'Poker', 'view-art':'Contemplation d’une œuvre d’art' })[pawn.recreation.task.activity], pawn.recreation.task.activity==='read'?queryPawnStatus(world,pawn).reason:pawn.recreation.task.phase === 'travel' ? 'Rejoint le lieu' : 'Sur place'));
    const party = world.party292?.active, participation = party?.members.find(member => member.pawnId === pawn.id);
    if (party && (participation || party.organizerId === pawn.id)) tab.push(row('party-participation', party.organizerId === pawn.id ? 'Organise la fête collective' : 'Participe à la fête collective', `${((participation?.presentCore ?? 0) / 2500).toFixed(2)} h de présence réelle`, `Lieu ${party.site.x}, ${party.site.z}`));
    rows.push({ id: 'tab-card', label: '', card: needsSpec(world, pawn, alive, tab, thoughts, thresholds) });
  } else if (activeTab === 'health') {
    const health = pawn.health, careful = isCarePatient(pawn) && alive;
    const operationsAvailable = careful && (colonist || !!pawn.prisoner && world.schemaVersion >= 280);
    if (!operationsAvailable) healthPane = 'overview';
    const overviewTab = control('health-overview', 'Vue d’ensemble', () => { healthPane = 'overview'; resetCardScroll(); }, false, healthPane === 'overview', 'Capacités, lésions et politique de soins.');
    const operationsTab = operationsAvailable ? control('health-operations', `Opérations${pawn.surgeryRequest ? ' (1)' : ''}`, () => { healthPane = 'operations'; resetCardScroll(); }, false, healthPane === 'operations', 'Demandes, pose et retrait de prothèses ; risques et conditions opératoires.') : undefined;
    const records = bodyRows(health);
    for (const injury of health?.injuries ?? []) { const entry = records.find(entry => entry.id === `injury-${injury.id}`); if (entry) entry.hint = `${entry.hint ?? ''} · ${tooltipText(healthPartTooltip(pawn, injury.part))} · Saignement ${pct(injuryBleed(health!, injury))}/jour.`; }
    const clinical = pawn.state === 'dead' ? 'Décédé · Dossier conservé' : pawn.state === 'downed' ? 'À terre' : health?.flu?.severity || health?.immuneDiseases?.malaria?.severity || health?.immuneDiseases?.plague?.severity || health?.immuneDiseases?.['sleeping-sickness']?.severity || health?.parasites306 || health?.mechanites307 || (health?.cryptosleepSickness?.remainingCore ?? 0) > 0 ? 'Malade' : 'Mobile';
    const settings: HealthSettingSpec[] = [];
    if (careful) {
      const food = choices('medical-food', 'Régime alimentaire', pawn.foodPolicyId, world.foodPolicies.map(policy => policy.id), policyId => send({ type: 'food-policy-assign', pawnId: pawn.id, policyId }), id => world.foodPolicies.find(policy => policy.id === id)?.name ?? String(id)).controls![0]!;
      const care = choices('medical-care', 'Politique médicale', medicalCare(pawn), Object.keys(MEDICAL_CARE) as MedicalCare[], value => send({ type: 'medical-care', pawnId: pawn.id, care: value }), value => MEDICAL_CARE[value]).controls![0]!;
      settings.push({ id: 'food', label: 'Aliments :', kind: 'select', value: food.label, control: food, hint: 'Choisir les aliments autorisés. Modifier un régime dans Assignations modifie tous ses utilisateurs. Le régime ne change pas les ingrédients de cuisine.' },
        { id: 'care', label: 'Médicaments :', kind: 'select', value: care.label, control: care, hint: 'Détermine les soins autorisés et la meilleure catégorie de médicament que les médecins peuvent utiliser. Les doses sont consommées pendant les soins.' });
      if (colonist) { const tend = booleanRow('self-tend', 'Se soigner soi-même', !!pawn.selfTend, enabled => send({ type: 'self-tend-policy', pawnId: pawn.id, enabled })).controls![0]!; settings.push({ id: 'self-tend', label: 'Auto-soins :', kind: 'check', on: !!pawn.selfTend, control: tend, hint: 'Un colon peut se soigner lui-même, moins bien qu’un médecin. Cocher pour l’autoriser.' }); }
    }
    const pain = painLabel(health ? medicalPain(health) : 0);
    const painRow = records.find(entry => entry.id === 'pain');
    const painHint = [`Niveau de douleur : ${pct(health ? medicalPain(health) : 0)}`, painRow?.hint ?? '', `État clinique : ${clinical}. Les capacités actuelles ci-contre comprennent les lésions, les parties perdues, la douleur et les affections réellement présentes.`,
      health?.infections?.cases.length ? 'Infection : la gravité et l’immunité progressent séparément. Soins, qualité des médicaments et repos influencent leur évolution. Une amputation retire définitivement un membre directement infecté ; son résultat opératoire reste soumis aux règles cliniques.' : '',
      pawn.surgeryRequest ? 'Risques opératoires : un lit, un médecin, l’accès au chevet et les médicaments autorisés restent nécessaires. Une opération peut échouer et blesser. Annuler ne restitue ni une dose déjà administrée ni l’état avant anesthésie.' : ''].filter(Boolean).join('\n\n');
    const capacities = alive ? capacitySpecs(Object.entries(pawnBody(pawn).capacities), key => capacityLabels[key] ?? key, key => tooltipText(healthCapacityTooltip(pawn, key as Parameters<typeof healthCapacityTooltip>[1]))) : [];
    const anatomy = (key: string) => control(`anatomy-${key}`, 'Anatomie', () => { subpage = { kind: 'anatomy', pawnId: pawn.id }; }, false, false, 'Parties et lésions détaillées');
    const entries = healthEntries(records, {
      injury: id => { const injury = health?.injuries.find(entry => entry.id === id); return injury ? { part: injury.part, bleeding: injuryBleed(health!, injury) > 0, tended: injury.tended !== undefined } : undefined; },
      missing: part => health?.missing.find(entry => entry.part === part),
      infectionPart: index => health?.infections?.cases[index]?.part,
      part: part => {
        const id = part as BodyPartId, missing = !!health && partMissing(health, id), fraction = health && !missing ? remainingPartHealth(health, id) / HP_UNIT / BODY_PARTS[id].hp : 1;
        return { label: BODY_PARTS[id].label, hint: tooltipText(healthPartTooltip(pawn, id)), ink: missing ? NATIVE_INK.red : fraction < .5 ? NATIVE_INK.painSevere : fraction < 1 - 1e-6 ? NATIVE_INK.painMedium : NATIVE_INK.text, info: anatomy(part) };
      },
      whole: () => anatomy('whole'),
    });
    const bleedTotal = health ? health.injuries.reduce((sum, injury) => sum + injuryBleed(health, injury), 0) : 0;
    let operations: HealthOperationsSpec | undefined;
    if (healthPane === 'operations' && operationsAvailable) {
      const requests: { id: string; label: string; hint: string; control: NativeControl; reason: string | undefined }[] = [];
      if (!pawn.surgeryRequest) {
        for (const part of SURGICAL_LIMBS) { const reason = surgeryRequestReason(pawn, part, { version: world.schemaVersion }); requests.push({ id: `amputate-${part}`, label: `Amputer (${BODY_PARTS[part].label})`, reason, hint: `${reason ?? 'Retire définitivement ce membre directement infecté et ses parties dépendantes. Continuer les soins et attendre l’immunité reste possible.'} Préparation : lit, médecin et une dose autorisée. Risques : échec opératoire et lésions. Après annulation : anesthésie et dose déjà administrée conservées.`, control: command(`request-amputation-${part}`, 'Demander', { type: 'surgery-request', pawnId: pawn.id, part }, !!reason) }); }
        for (const [kind, rule] of Object.entries(ARTIFICIAL_PARTS) as [ArtificialPartKind, typeof ARTIFICIAL_PARTS[ArtificialPartKind]][]) if (artificialPartAvailable273(kind, world.schemaVersion)) for (const part of rule.sites) { const reason = surgeryInstallRequestReason(pawn, part, kind, { version: world.schemaVersion }); requests.push({ id: `implant-${kind}-${part}`, label: `${rule.label} (${BODY_PARTS[part].label})`, reason, hint: `${reason ?? 'Pose cette prothèse à la place du membre ou de sa prothèse actuelle. La fonction reste partielle et l’opération peut échouer.'} Efficacité ${pct(rule.efficiency)} · Médecine ${rule.medicineSkill}. Préparation : 1 ${ITEM_DEFINITIONS[artificialPartIngredient273(kind)].label.toLocaleLowerCase('fr-FR')} + 2 médicaments du même type autorisé. Patient installé au lit, chevet accessible et anesthésie. Risques : échec opératoire et lésions ; aucun résultat garanti.`, control: command(`request-${kind}-${part}`, 'Demander la pose', { type: 'surgery-install', pawnId: pawn.id, part, implant: kind }, !!reason) }); }
        for (const part of pawn.health?.artificialParts ?? []) { const reason = surgeryRemoveRequestReason273(pawn, part.part, part.kind, { version: world.schemaVersion }); requests.push({ id: `remove-prosthetic-${part.part}`, label: `Retirer ${ARTIFICIAL_PARTS[part.kind].label.toLocaleLowerCase('fr-FR')} (${BODY_PARTS[part.part].label})`, reason, hint: reason ?? 'Une dose autorisée, un lit et un médecin. En cas de réussite, la même sorte de prothèse est récupérée au sol ; le membre redevient absent. Risque d’échec opératoire.', control: command(`remove-${part.part}`, 'Demander le retrait', { type: 'surgery-remove-prosthetic', pawnId: pawn.id, part: part.part }, !!reason) }); }
      }
      const add: NativeControl | undefined = requests.length ? { ...control('surgery-add', 'Ajouter une opération…', () => undefined, false, false, 'Demander une opération : le médecin la fait au lit médical, avec les médicaments autorisés.'), select: { value: '', options: requests.map(request => ({ value: request.id, label: request.reason ? `${request.label} (${request.reason})` : request.label, hint: request.hint, disabled: !!request.control.disabled })), onChange: async value => { await requests.find(request => request.id === value)?.control.onActivate(); } } } : undefined;
      operations = { note: 'Lit, médecin et médicaments autorisés requis.', empty: requests.length ? 'Aucune opération demandée.' : 'Aucune opération disponible pour ce patient.', add,
        request: pawn.surgeryRequest ? { label: `Opération demandée : ${healthSurgeryView(pawn, world).status}`, hint: 'Un lit, un médecin, l’accès au chevet et les médicaments autorisés restent nécessaires. Une opération peut échouer et blesser.', cancel: command('surgery-cancel', 'Annuler', { type: 'surgery-cancel', pawnId: pawn.id }, false, false, 'Annule la demande en cours. Les ingrédients déjà consommés restent consommés et l’anesthésie continue à se dissiper.') } : undefined };
    }
    rows.push({ id: 'tab-card', label: '', card: { type: 'health', tab: healthPane, tabs: { overview: overviewTab, operations: operationsTab, operationsLabel: operationsTab?.label ?? 'Opérations' }, settings, pain: alive ? { ...pain, hint: painHint } : undefined, capacities, entries,
      bleed: bleedTotal > .01 ? { text: `Saignement : ${pct(bleedTotal)}/jour`, hint: 'Somme des plaies qui saignent encore. Le traitement des plaies arrête leur saignement ; la récupération du sang reste progressive.' } : undefined, operations, emptyText: '(Aucun problème de santé)' } });
  } else if (activeTab === 'gear') {
    const primary = equippedWeapon(world, pawn), comfortable = comfortableTemperature(world, pawn), canOrder = colonist && alive;
    const massOf = (pile: MaterialPile) => { const unit = physicalTravelUnitMass(pile, world.schemaVersion); return unit === undefined ? undefined : unit * pile.quantity; };
    const info = (id: number) => control(`item-information-${id}`, 'Informations', () => { subpage = { kind: 'item', itemId: id }; }, false, false, 'Informations sur cet objet');
    const equipment: GearRowSpec[] = primary ? [{ id: `weapon-${primary.id}`, label: weaponLabel(primary), grams: massOf(primary), hint: `Arme principale : ${weaponLabel(primary)}`, info: info(primary.id), drop: canOrder ? command('drop-primary', 'Déposer', { type: 'order-equipment', pawnId: pawn.id, itemId: primary.id, action: 'drop', queue: false }, false, false, 'Déposer cette arme') : undefined }] : [];
    const pieces = wornApparel(world, pawn);
    const apparel: GearRowSpec[] = pieces.map(piece => {
      const definition = apparelDefinition(piece), rating = armorPiece(piece).ratings, insulation = apparelInsulation(piece), label = apparelLabel(piece);
      return { id: `apparel-${piece.id}`, label: `${label}${piece.apparel!.forced ? ', imposé' : ''}`, grams: massOf(piece), info: info(piece.id),
        hint: `${label}\n\n${piece.apparel!.hitPoints}/${definition.hitPoints} PV${piece.apparel!.forced ? ' · Port imposé' : ''}\nTranchant ${pct(rating.sharp)} · Contondant ${pct(rating.blunt)} · Chaleur ${pct(rating.heat)}\nIsolation froid ${insulation.cold.toFixed(1)} °C / chaleur ${insulation.heat.toFixed(1)} °C`,
        drop: canOrder ? command(`remove-apparel-${piece.id}`, 'Retirer', { type: 'order-equipment', pawnId: pawn.id, itemId: piece.id, action: 'remove', queue: false }, false, false, 'Retirer ce vêtement') : undefined };
    });
    const inventory: GearRowSpec[] = world.piles.filter(pile => ['pawn', 'inventory'].includes(pile.owner.type) && 'pawnId' in pile.owner && pile.owner.pawnId === pawn.id).map(pile => ({ id: `inventory-${pile.id}`, label: `${pile.book?.title ?? ITEM_DEFINITIONS[pile.item].label}${pile.quantity > 1 ? ` ×${pile.quantity}` : ''}`, grams: massOf(pile), hint: `${pile.book?.title ?? ITEM_DEFINITIONS[pile.item].label} × ${pile.quantity}`, info: info(pile.id) }));
    for (const packed of world.packed) if (packed.owner.type === 'pawn' && packed.owner.pawnId === pawn.id) inventory.push({ id: `packed-${packed.building.id}`, label: `${buildingLabels[packed.building.kind]} (transporté)`, hint: 'Meuble emballé transporté' });
    const carried = (id: string, label: string, value: string | undefined) => inventory.push({ id, label: value ? `${label} : ${value}` : label, hint: label });
    if (pawn.cryptosleepTask?.action === 'carry' && ['carry', 'closing'].includes(pawn.cryptosleepTask.phase)) carried('carried-cryptosleep-patient', 'Patient porté vers un caisson', world.pawns.find(patient => patient.id === pawn.cryptosleepTask?.patientId)?.name ?? 'Patient confirmé');
    if (pawn.shipCasketTask277?.action === 'carry' && ['carry', 'closing'].includes(pawn.shipCasketTask277.phase)) carried('carried-spatial-patient', 'Occupant porté vers un caisson spatial', pawn.shipCasketTask277.patient ? `${pawn.shipCasketTask277.patient.kind === 'human' ? 'Personne' : pawn.shipCasketTask277.patient.kind === 'animal' ? 'Animal' : 'Mécanoïde'} ${pawn.shipCasketTask277.patient.id}` : undefined);
    if (pawn.rescue?.phase === 'carry') carried('carried-rescue', pawn.rescue.capture ? 'Personne capturée transportée' : 'Personne secourue transportée', world.pawns.find(patient => patient.id === pawn.rescue?.patientId)?.name);
    if (pawn.animalRescue?.phase === 'carry') carried('carried-animal', 'Animal secouru transporté', String(pawn.animalRescue.animalId));
    const extras: GearSpec['extras'][number][] = [];
    if (pawn.droppedWeaponId !== undefined) { if (colonist) extras.push({ id: 'lost-weapon', label: `Arme perdue (${pawn.droppedWeaponId})`, control: command('forget-weapon', 'Oublier', { type: 'forget-weapon', pawnId: pawn.id }), hint: 'Oublier cette arme perdue : le colon ne la cherchera plus.' }); else carried('lost-weapon', 'Arme perdue', String(pawn.droppedWeaponId)); }
    if (colonist && alive) extras.push({ id: 'clear-forced', label: 'Tenue imposée', control: command('clear-forced-apparel', 'Effacer', { type: 'apparel-clear-forced', pawnId: pawn.id }), hint: 'Effacer les obligations de tenue : le colon choisit à nouveau ses vêtements.' });
    const carriedMass = commercialMass(world, pawn), armor = overallArmor(pieces);
    const kilograms = (grams: number) => String(Number((grams / 1000).toFixed(2)));
    rows.push({ id: 'tab-card', label: '', card: { type: 'gear',
      mass: carriedMass && alive ? { text: `Masse portée : ${kilograms(carriedMass.grams)} / ${kilograms(carriedMass.capacityGrams)} kg`, hint: 'Masse de l’équipement, des vêtements et de l’inventaire, contre la capacité de charge.' } : undefined,
      comfort: alive ? { text: `Plage de température confortable : ${comfortable.min.toFixed(0)} ~ ${comfortable.max.toFixed(0)} °C`, hint: 'La plage combine les limites de la personne et l’isolation réelle de ses vêtements.' } : undefined,
      armor: alive ? [{ id: 'sharp', label: 'Tranchant', value: pct(armor.sharp) }, { id: 'blunt', label: 'Contondant', value: pct(armor.blunt) }, { id: 'heat', label: 'Chaleur', value: pct(armor.heat) }] : undefined,
      sections: [{ id: 'equipment', label: 'Équipement', rows: equipment }, { id: 'apparel', label: 'Vêtements', rows: apparel }, { id: 'inventory', label: 'Inventaire', rows: inventory }], extras,
      portrait: { control: control('portrait-clothing', portraitClothed ? 'Vêtements visibles' : 'Vêtements masqués', () => { portraitClothed = !portraitClothed; }, false, portraitClothed, portraitClothed ? 'Masquer les vêtements dans le portrait' : 'Montrer les vêtements dans le portrait'), visible: portraitClothed }, maxHeight: 4000 } });
  } else if (activeTab === 'social') {
    const people = captureRelationshipPeople(world), index = relationshipIndex(world), remembered = new Set([...pawn.social?.memories ?? [], ...pawn.romanceMemories ?? [], ...pawn.familyBereavement ?? []].map(memory => memory.otherId));
    const statusLabels = { present: 'Présent', away: 'En voyage', departed: 'Absent', dead: 'Décédé' } as const;
    const listed: (SocialRowSpec & { linked: boolean })[] = [];
    for (const person of people.values()) {
      if (person.id === pawn.id) continue;
      const other = world.pawns.find(candidate => candidate.id === person.id), kinds = index.kinds(pawn.id, person.id);
      if (!kinds.length && !remembered.has(person.id) && (!other || !isColonist(other))) continue;
      const current = person.status === 'present' && other?.state !== 'dead';
      const causes = alive ? opinionCauses(pawn, person.id, world.tick, world).map(cause => `${cause.label}${cause.count > 1 ? ` ×${cause.count}` : ''} : ${signed(cause.value)}`).join(' · ') : 'Avis arrêté au décès.';
      const reciprocalCauses = current && other ? opinionCauses(other, pawn.id, world.tick, world).map(cause => `${cause.label}${cause.count > 1 ? ` ×${cause.count}` : ''} : ${signed(cause.value)}`).join(' · ') : 'Avis actuel indisponible : propriétaire absent ou décédé.';
      const links = kinds.map(kind => relationLabels[kind] ?? kind).join(', ');
      listed.push({ id: String(person.id), linked: kinds.length > 0, relations: links, name: person.name, mine: alive ? opinionOf(pawn, person.id, world.tick, world) : undefined, his: current && other ? opinionOf(other, pawn.id, world.tick, world) : undefined, situation: statusLabels[person.status],
        hint: `${person.name} · ${statusLabels[person.status]}${links ? `\nLien : ${links}. Ces liens proviennent du dossier enregistré ; l’absence ne signifie pas un décès.` : ''}\n\nAvis de ${pawn.name} : ${causes || 'aucun motif'}\n\nAvis de ${person.name} : ${reciprocalCauses || 'aucun motif'}${other ? '\n\nCliquer pour sélectionner cette personne.' : ''}`,
        select: other ? control(`select-person-${person.id}`, 'Inspecter', () => owner.selectPawn(person.id), false, false, `Sélectionner ${person.name}`) : undefined });
    }
    listed.sort((a, b) => Number(b.linked) - Number(a.linked) || (b.mine ?? 0) - (a.mine ?? 0) || Number(a.id) - Number(b.id));
    const interactions: InteractionSpec[] = personalEvents(world, pawn).filter(entry => entry.kind === 'social').slice(0, 12).map(entry => ({ id: String(entry.index), text: entry.event.message, faded: world.tick - entry.event.tick > 7500, hint: `Il y a ${((world.tick - entry.event.tick) / 250).toFixed(1)} h` }));
    if (!interactions.length && pawn.social?.last) {
      const last = pawn.social.last, name = people.get(last.otherId)?.name ?? 'une personne non renseignée';
      const text = last.kind === 'slight' ? `${last.initiated ? 'A vexé' : 'A été vexé par'} ${name}` : last.kind === 'insult' ? `${last.initiated ? 'A insulté' : 'A été insulté par'} ${name}` : last.kind === 'kind-words' ? `${last.initiated ? 'A adressé des mots gentils à' : 'A reçu des mots gentils de'} ${name}` : last.kind === 'romance-attempt' ? `${last.initiated ? 'A tenté un rapprochement amoureux avec' : 'A reçu une tentative de rapprochement amoureux de'} ${name}` : last.kind === 'breakup' ? `${last.initiated ? 'A rompu avec' : 'A subi une rupture avec'} ${name}` : `${SOCIAL_LABELS[last.kind]} ${last.initiated ? 'engagé' : 'reçu'} avec ${name}`;
      interactions.push({ id: 'last', text, faded: world.tick - last.tick > 7500, hint: `Il y a ${((world.tick - last.tick) / 250).toFixed(1)} h` });
    }
    rows.push({ id: 'tab-card', label: '', card: { type: 'social', rows: listed.map(({ linked: _linked, ...entry }) => entry), interactions } });
  } else if (activeTab === 'journal') {
    const entries = personalEvents(world, pawn).filter(entry => entry.kind === 'social' ? logFilter.social : entry.kind === 'combat' ? logFilter.combat : logFilter.all).slice(0, 300);
    const lines: LogLineSpec[] = [];
    let previous: 'combat' | 'other' | undefined;
    for (const entry of entries) {
      const combat = entry.kind === 'combat';
      if (combat && previous !== 'combat') { if (previous) lines.push({ kind: 'gap', height: 20 }); lines.push({ kind: 'header', text: `Combat · il y a ${((world.tick - entry.event.tick) / 250).toFixed(0)} h` }); }
      else if (!combat && previous === 'combat') lines.push({ kind: 'gap', height: 20 });
      lines.push({ kind: 'entry', id: String(entry.index), text: entry.event.message, hint: `${({ social: 'Social', combat: 'Combat', mental: 'Crise mentale' })[entry.kind]} · Il y a ${((world.tick - entry.event.tick) / 250).toFixed(1)} h` });
      previous = combat ? 'combat' : 'other';
    }
    const toggle = (id: 'all' | 'social' | 'combat', label: string, x: number, width: number, hint: string) => ({ id, label, x, width, on: logFilter[id], control: control(`log-toggle-${id}`, label, () => { logFilter[id] = !logFilter[id]; resetCardScroll(); }, false, logFilter[id], hint) });
    rows.push({ id: 'tab-card', label: '', card: { type: 'log', lines, emptyText: '(Aucune entrée récente)',
      toggles: [toggle('all', 'Tout', 60, 100, 'Afficher aussi les crises mentales et les autres entrées moins importantes.'), toggle('social', 'Social', 330, 105, 'Afficher les échanges sociaux.'), toggle('combat', 'Combat', 445, 115, 'Afficher les combats.')],
      copy: control('log-copy', 'Copier', () => { void navigator.clipboard?.writeText(lines.flatMap(line => line.kind === 'header' ? [`--    ${line.text}`] : line.kind === 'gap' ? [''] : [line.text]).join('\n')); }, false, false, 'Copier le journal affiché dans le presse-papiers.') } });
  } else if (activeTab === 'prisoner' && pawn.prisoner) {
    const prisoner = pawn.prisoner, lines: PrisonerLineSpec[] = [];
    if (prisoner.breakout?.active) lines.push({ id: 'break', label: 'Évasion en cours', value: `initiateur ${world.pawns.find(person => person.id === prisoner.breakout?.active?.initiatorId)?.name ?? 'personne absente'}`, hint: `Commencée il y a ${((world.tick - prisoner.breakout.active.startedAt) / 250).toFixed(1)} h` });
    else if (prisoner.breakout?.lastAt !== undefined) lines.push({ id: 'break', label: 'Dernière évasion consignée', value: `il y a ${((world.tick - prisoner.breakout.lastAt) / 6000).toFixed(1)} jours`, hint: 'Une évasion se prépare lorsque la colère ou l’humeur du prisonnier sont trop basses.' });
    lines.push({ id: 'resistance', label: 'Résistance au recrutement', value: prisoner.resistance.toFixed(1), hint: `La résistance actuelle (${prisoner.resistance.toFixed(1)} sur ${prisoner.initialResistance} au départ) reste distincte du mode de détention choisi et de la décision de recrutement.` },
      { id: 'captured', label: 'Capture', value: `pas ${prisoner.capturedAt}`, hint: 'Pas de la simulation où cette personne a été capturée.' });
    const care = isCarePatient(pawn) && alive ? choices('medical-care', 'Politique médicale', medicalCare(pawn), Object.keys(MEDICAL_CARE) as MedicalCare[], value => send({ type: 'medical-care', pawnId: pawn.id, care: value }), value => MEDICAL_CARE[value]).controls![0]! : undefined;
    const modes: PrisonerMode[] = isExecuteRelease364(world.schemaVersion) && !isColonist(pawn) ? ['maintain', 'reduce', 'recruit', 'release', 'execute'] : ['maintain', 'reduce', 'recruit', 'release'];
    const modeLabels = { maintain: 'Maintenir', reduce: 'Réduire la résistance', recruit: 'Recruter', release: 'Libérer', execute: 'Exécuter' } as const;
    const modeHints = { maintain: 'Garder le prisonnier sans interaction particulière.', reduce: 'Les colons parlent au prisonnier pour réduire sa résistance au recrutement.', recruit: 'Tenter de recruter le prisonnier dans la colonie, une fois sa résistance tombée.', release: 'Le prisonnier sera escorté hors de la colonie puis libéré.', execute: 'Le prisonnier sera mis à mort.' } as const;
    rows.push({ id: 'tab-card', label: '', card: { type: 'prisoner', lines,
      medical: care ? { label: 'Médicaments autorisés :', value: care.label, control: care, hint: 'Détermine les soins autorisés et la meilleure catégorie de médicament que les médecins peuvent utiliser.' } : undefined,
      modes: modes.map(mode => ({ id: mode, label: modeLabels[mode], selected: prisoner.mode === mode, hint: modeHints[mode], control: control(`prisoner-mode-${mode}`, modeLabels[mode], () => send({ type: 'prisoner-mode', patientId: pawn.id, mode }), !alive, prisoner.mode === mode, modeHints[mode]) })) } });
  }
  const actions: NativeControl[] = [];
  // Core gizmos to the right of the pane (Command_Toggle merged over the
  // selection, see selectionDraftCommand: the shown state is the merged one).
  const group = selectionGroup(world, pawn), draft = selectionDraftCommand(group), stop = selectionStopCommand(group), fire = selectionFireAtWillCommand(group);
  if (colonist && alive) actions.push({ ...command('draft-pawn', draft && draft.type === 'draft' && !draft.enabled ? 'Démobiliser' : 'Mobiliser', draft ?? { type: 'draft', pawnIds: [pawn.id], enabled: !pawn.draft }, !draft), icon: 'mobilize' },
    { ...command('clear-orders', 'Effacer les ordres', { type: 'clear-orders', pawnId: pawn.id }), icon: 'clear-orders' }, { ...control('manage-work', 'Travail', () => owner.panel('work')), icon: 'manage-work' });
  // Schema 351: Designator_Strip is a reverse designator of the selected pawn or corpse.
  const strip351 = stripInspectorAction351(world, pawn.id); if (strip351) actions.push(command('strip-designate', strip351.label, strip351.command));
  if (colonist && alive && stop && fire) actions.push({ ...command('draft-stop', 'Stop', stop), icon: 'clear-orders' }, { ...command('fire-at-will', fire.type === 'fire-at-will' && fire.enabled ? 'Feu à volonté' : 'Cesser le feu', fire), icon: 'fire-at-will' });
  // Core's hostility response gizmo (also a column of Assignations).
  if (colonist && alive) { const hostility = choices('pawn-hostility', 'Réaction hostile', pawn.hostilityResponse ?? 'flee', ['flee', 'ignore', 'attack'] as const, response => send({ type: 'hostility-response', pawnId: pawn.id, response }), response => ({ flee: 'Fuir', ignore: 'Ignorer', attack: 'Attaquer' })[response]).controls![0]!; actions.push({ ...hostility, icon: 'target-melee', hint: `Réaction hostile : ${hostility.label}` }); }
  if (activeTab) actions.push({ ...control('inspect-tab-close', 'Fermer l’onglet', () => { activeTab = null; }), hint: 'Fermer l’onglet' });
  const result: NativePage & { portrait?: { url: string; label: string } } = { id: `inspect-pawn-${pawn.id}-${activeTab ?? 'pane'}`, title: pawn.name, rows, actions, layout: 'inspector' };
  if (activeTab) result.inspectTab = { id: activeTab, ...tabSizes[activeTab] };
  result.portrait = { url: portraitDataUrl(appearanceOf(pawn, world.seed), apparelAppearance(portraitClothed ? wornApparel(world, pawn) : []), equippedWeapon(world, pawn)?.item, portraitExpressionOf(pawn), humanLimbVisualMask(pawn)), label: `Portrait de ${pawn.name}` };
  return result;
}

function settingsOf(bill: CookingBill): BillSettings {
  const { id: _id, recipe: _recipe, worker: _worker, reservePause: _pause, ...settings } = bill;
  return structuredClone(settings);
}
/** Bill clipboard (Core BillUtility.Clipboard), kept in the interface only. */
function billCopyControl(structureId: number, billId: number): NativeControl {
  return control(`bill-copy-${billId}`, 'Copier', () => {
    const bill = latest.world?.structures.find(s => s.id === structureId)?.bills?.find(b => b.id === billId);
    if (!bill) throw Error('Cette facture n’existe plus.');
    copyBillToClipboard(bill, latest.epoch); feedback = `Facture copiée : ${PRODUCTION_RECIPES[bill.recipe].label}. Collez-la depuis les factures de tout poste qui fait cette recette.`;
  }, false, false, 'Copier cette facture avec ses réglages appliqués (pas les modifications en cours).');
}
function billPasteRows(world: World, structure: Structure): NativeRow[] {
  const copy = billClipboard(latest.epoch); if (!copy) return [];
  const label = PRODUCTION_RECIPES[copy.recipe].label, refusal = billPasteRefusal(world, structure, copy);
  return [{ id: 'bill-paste', label: 'Facture copiée', value: label, controls: [control('bill-paste', 'Coller', async () => { feedback = await pasteBillFromClipboard({ send, readWorld: () => (owner.readState?.() ?? latest).world }, structure.id, latest.epoch); }, !!refusal, false, refusal ?? `Ajouter à ce poste une facture « ${label} » avec tous les réglages copiés.`)] }];
}
function billPage(world: World, structure: Structure): NativePage {
  const rows: NativeRow[] = [];
  rows.push(...billPasteRows(world, structure)); const full = (structure.bills?.length ?? 0) >= BILL_STACK_MAX_COUNT;
  for (const recipe of stationRecipes(structure)) { const rule = PRODUCTION_RECIPES[recipe]; rows.push({ id: `add-${recipe}`, label: rule.label, detail: `Travail de recette ${rule.workTicks} pas locaux nominaux · Ingrédients autorisés : ${rule.inputs.map(item => ITEM_DEFINITIONS[item].label).join(', ')}`, controls: [command(`add-bill-${recipe}`, 'Ajouter', { type: 'bill-add', structureId: structure.id, recipe }, full, false, full ? `${BILL_STACK_MAX_COUNT} factures au plus par poste.` : undefined)] }); }
  for (const bill of structure.bills ?? []) {
    const key = `${structure.id}:${bill.id}`; let draft = billDrafts.get(key);
    if (!draft) { draft = settingsOf(bill); billDrafts.set(key, draft); }
    const edit = (mutate: (settings: BillSettings) => void) => { mutate(draft!); };
    rows.push({ ...row(`bill-${bill.id}`, `Facture ${bill.id} · ${PRODUCTION_RECIPES[bill.recipe].label}`, `${bill.suspended ? 'Suspendue' : 'Active'}${bill.reservePause?.paused ? ' · Pause de réserve acquise' : ''}`), controls: [billCopyControl(structure.id, bill.id)] },
      choices(`bill-mode-${bill.id}`, 'Répéter', draft.mode, ['smelt-weapon', 'smelt-apparel', 'cremate-corpse', 'burn-apparel'].includes(bill.recipe) ? ['times', 'forever'] as const : ['times', 'until', 'forever'] as const, mode => edit(settings => { settings.mode = mode; }), mode => ({ times: 'Faire X fois', until: 'Jusqu’à X en réserve', forever: 'Sans limite' })[mode]),
      numberRow(`bill-target-${bill.id}`, 'Quantité X', draft.target, 0, 9999, target => edit(settings => { settings.target = target; })),
      booleanRow(`bill-suspended-${bill.id}`, 'Suspendre', draft.suspended, suspended => edit(settings => { settings.suspended = suspended; })),
      numberRow(`bill-radius-${bill.id}`, 'Rayon des ingrédients depuis le poste', draft.radius, 0, 999, radius => edit(settings => { settings.radius = radius; })));
    for (const item of PRODUCTION_RECIPES[bill.recipe].inputs) rows.push(booleanRow(`bill-filter-${bill.id}-${item}`, ITEM_DEFINITIONS[item].label, draft.filters[item] === true, allowed => edit(settings => { settings.filters[item] = allowed; })));
    if (!['cremate-corpse', 'burn-apparel'].includes(bill.recipe)) rows.push(choices(`bill-destination-${bill.id}`, 'Livraison du produit', draft.destination, ['stockpile', 'drop'] as const, destination => edit(settings => { settings.destination = destination; }), value => value === 'stockpile' ? 'Meilleur stockage' : 'Déposer au sol'));
    if (draft.smeltFilter) {
      const filter = draft.smeltFilter;
      rows.push(numberRow(`smelt-hp-min-${bill.id}`, 'État minimum (%)', filter.hpMin, 0, filter.hpMax, value => { filter.hpMin = value; }), numberRow(`smelt-hp-max-${bill.id}`, 'État maximum (%)', filter.hpMax, filter.hpMin, 100, value => { filter.hpMax = value; }),
        choices(`smelt-quality-min-${bill.id}`, 'Qualité minimum', filter.qualityMin, WEAPON_QUALITIES.filter(value => WEAPON_QUALITIES.indexOf(value) <= WEAPON_QUALITIES.indexOf(filter.qualityMax)), value => { filter.qualityMin = value; }),
        choices(`smelt-quality-max-${bill.id}`, 'Qualité maximum', filter.qualityMax, WEAPON_QUALITIES.filter(value => WEAPON_QUALITIES.indexOf(value) >= WEAPON_QUALITIES.indexOf(filter.qualityMin)), value => { filter.qualityMax = value; }));
    }
    if (draft.cremationFilter) for (const [field, label] of [['colonists', 'Colons'], ['strangers', 'Étrangers'], ['fresh', 'Corps frais'], ['rotting', 'Corps pourris'], ['desiccated', 'Corps desséchés']] as const) rows.push(booleanRow(`cremate-${bill.id}-${field}`, label, draft.cremationFilter[field], value => { draft!.cremationFilter![field] = value; }));
    if (isSchema278OrLater(world.schemaVersion) && isApparelCountRecipe278(bill.recipe)) {
      const filter = draft.apparelCount;
      rows.push(booleanRow(`apparel-reserve-${bill.id}`, 'Filtrer la réserve de vêtements', !!filter, enabled => { if (enabled) draft!.apparelCount = newApparelCountFilter278(world.schemaVersion); else delete draft!.apparelCount; }));
      if (filter) rows.push(numberRow(`reserve-hp-min-${bill.id}`, 'Réserve · état minimum (%)', filter.hpMin, 0, filter.hpMax, value => { filter.hpMin = value; }), numberRow(`reserve-hp-max-${bill.id}`, 'Réserve · état maximum (%)', filter.hpMax, filter.hpMin, 100, value => { filter.hpMax = value; }),
        choices(`reserve-quality-min-${bill.id}`, 'Réserve · qualité minimum', filter.qualityMin, WEAPON_QUALITIES.filter(value => WEAPON_QUALITIES.indexOf(value) <= WEAPON_QUALITIES.indexOf(filter.qualityMax)), value => { filter.qualityMin = value; }),
        choices(`reserve-quality-max-${bill.id}`, 'Réserve · qualité maximum', filter.qualityMax, WEAPON_QUALITIES.filter(value => WEAPON_QUALITIES.indexOf(value) >= WEAPON_QUALITIES.indexOf(filter.qualityMin)), value => { filter.qualityMax = value; }), booleanRow(`reserve-equipped-${bill.id}`, 'Inclure les vêtements portés et en inventaire personnel', filter.includeEquipped, value => { filter.includeEquipped = value; }));
      // Schema 374: Core's "include tainted" (Dialog_BillConfig), off by default.
      if (filter && isBillTaintedSchema374(world.schemaVersion)) rows.push(booleanRow(`reserve-tainted-${bill.id}`, 'Compter les vêtements de mort', filter.includeTainted374 !== false, value => { filter.includeTainted374 = value; }));
    }
    const worker = readBillWorkerPolicy283(bill), skill = productionRecipeSkill283(bill.recipe);
    rows.push(row(`worker-skill-${bill.id}`, 'Compétence de production', skill ? skillLabels[skill]! : 'Aucune compétence de recette'), numberRow(`worker-min-${bill.id}`, 'Travailleur · compétence minimum', worker.skillMin, 0, worker.skillMax, skillMin => send({ type: 'bill-worker-policy', structureId: structure.id, billId: bill.id, policy: { ...worker, skillMin } })), numberRow(`worker-max-${bill.id}`, 'Travailleur · compétence maximum', worker.skillMax, worker.skillMin, 20, skillMax => send({ type: 'bill-worker-policy', structureId: structure.id, billId: bill.id, policy: { ...worker, skillMax } })));
    if (owner.readBillWorkers) rows.push({ id: `workers-load-${bill.id}`, label: 'Travailleur préféré', value: worker.pawnId === null ? 'Tout travailleur admissible' : `Personne ${worker.pawnId}`, controls: [control(`workers-load-${bill.id}`, 'Choisir', async () => { const options = await owner.readBillWorkers!(structure.id, bill.id); if (options.structureId !== structure.id || options.billId !== bill.id) throw Error('Les choix de travailleur reçus ne correspondent pas à cette facture.'); billWorkers.set(key, options); })] });
    const candidates = billWorkers.get(key);
    if (candidates) {
      rows.push({ id: `worker-any-${bill.id}`, label: 'Tout travailleur admissible', controls: [command(`worker-any-${bill.id}`, 'Choisir', { type: 'bill-worker-policy', structureId: structure.id, billId: bill.id, policy: { ...worker, pawnId: null } }, false, worker.pawnId === null)] });
      for (const candidate of candidates.candidates) rows.push({ id: `worker-${bill.id}-${candidate.pawnId}`, label: candidate.name, value: candidate.level === null ? 'Sans compétence de recette' : `Niveau ${candidate.level}`, detail: candidate.description, controls: [command(`worker-choose-${bill.id}-${candidate.pawnId}`, 'Choisir', { type: 'bill-worker-policy', structureId: structure.id, billId: bill.id, policy: { ...worker, pawnId: candidate.pawnId } }, !candidate.enabled, worker.pawnId === candidate.pawnId)] });
    }
    if (supportsBillReservePause289(bill.recipe) && world.schemaVersion >= 289) {
      const pause = bill.reservePause ?? { enabled: false, resumeAt: 0, paused: false };
      rows.push(booleanRow(`pause-enabled-${bill.id}`, 'Pause automatique à la réserve cible', pause.enabled, enabled => send({ type: 'bill-pause-policy', structureId: structure.id, billId: bill.id, policy: { enabled, resumeAt: enabled ? Math.min(pause.resumeAt, bill.target - 1) : pause.resumeAt } })), numberRow(`pause-resume-at-${bill.id}`, 'Reprendre sous ce seuil', pause.resumeAt, -1, pause.enabled ? Math.max(-1, bill.target - 1) : 9999, resumeAt => send({ type: 'bill-pause-policy', structureId: structure.id, billId: bill.id, policy: { enabled: pause.enabled, resumeAt } })));
      if (pause.paused) rows.push({ id: `resume-${bill.id}`, label: 'Pause de réserve', controls: [command(`resume-bill-${bill.id}`, 'Reprendre maintenant', { type: 'bill-pause-resume', structureId: structure.id, billId: bill.id })] });
    }
    const task = world.pawns.find(pawn => pawn.cooking?.stationId === structure.id && pawn.cooking.billId === bill.id);
    if (task?.cooking) rows.push(row(`bill-task-${bill.id}`, 'Travail engagé', `${task.name} · ${{ gather: 'Rassemble les ingrédients', work: 'Produit au poste', output: 'Livre le produit', interrupted: 'Ouvrage interrompu' }[task.cooking.phase]}`));
    rows.push({ id: `bill-apply-${bill.id}`, label: 'Modifications de la facture', controls: [control(`bill-apply-${bill.id}`, 'Appliquer', async () => { await send({ type: 'bill-update', structureId: structure.id, billId: bill.id, settings: structuredClone(draft!) }); billDrafts.delete(key); }), control(`bill-revert-${bill.id}`, 'Annuler les modifications', () => { billDrafts.delete(key); }), command(`bill-up-${bill.id}`, '↑', { type: 'bill-move', structureId: structure.id, billId: bill.id, direction: -1 }), command(`bill-down-${bill.id}`, '↓', { type: 'bill-move', structureId: structure.id, billId: bill.id, direction: 1 }), command(`bill-remove-${bill.id}`, 'Supprimer', { type: 'bill-remove', structureId: structure.id, billId: bill.id })] });
  }
  return { id: `inspect-bills-${structure.id}`, title: `${buildingLabels[structure.kind]} · Factures`, rows, actions: [control('bills-back', 'Retour', () => { subpage = undefined; })], layout: 'inspector' };
}

function storagePage(world: World, structureId?: number, stockpileId?: number): NativePage | null {
  const structure = world.structures.find(s => s.id === structureId), stockpile = world.stockpiles.find(s => s.id === stockpileId), current = structure?.shelf?.settings ?? stockpile;
  if (!current) return null;
  const target = structureId === undefined ? `stockpile:${stockpileId}` : `shelf:${structureId}`;
  if (storageNavigation?.target !== target) storageNavigation = { target, search: '', expanded: new Set<string>() };
  const navigation = storageNavigation;
  const selected = storageTreeSelection(current.filters, current.items);
  const admittedSelection=selectionKey;
  const update = (settings: StorageSettings) => { currentPolicy(); return send(structureId !== undefined ? { type: 'shelf-policy', structureId, settings } : { type: 'stockpile-policy', stockpileId: stockpileId!, settings }); };
  const currentPolicy = () => {
    const state=owner.readState?.()??latest;
    if(nativeInspectorSelectionKey(state)!==admittedSelection)throw Error('La sélection a changé. Ouvrez à nouveau les réglages de cette réserve.');
    const fresh = state.world, shelf = fresh?.structures.find(structure => structure.id === structureId), policy = shelf?.shelf?.settings ?? fresh?.stockpiles.find(stockpile => stockpile.id === stockpileId);
    if (!fresh || !policy || shelf && !targetBuildingPlayerUse263(fresh, shelf)) throw Error('Ce stockage n’est plus disponible pour la colonie.');
    return policy;
  };
  const capacity = structure?.shelf
    ? row('storage-capacity', 'Capacité par case', `${groundMaxStacks(world, structure)} piles`, 'Chaque pile respecte la limite propre à son objet.')
    : { ...numberRow('storage-capacity', 'Pile max.', current.capacity, 1, ITEM_DEFINITIONS.silver.stackLimit, capacity => update({ capacity })), detail: 'La limite propre à chaque objet reste applicable si elle est inférieure à ce plafond.' };
  const rows: NativeRow[] = [choices('storage-priority','Priorité',current.priority,world.schemaVersion>=219?[1,2,3,4,5]:[1,2,3,4],priority=>update({priority}),value=>['','Basse','Normale','Préférée','Importante','Critique'][value]??String(value)), capacity,
    booleanRow('fresh', 'Accepter les produits frais', current.allowFresh !== false, allowFresh => update({ allowFresh })), booleanRow('rotten', 'Accepter les produits pourris', current.allowRotten !== false, allowRotten => update({ allowRotten }))];
  rows.push({ id: 'storage-copy-settings', label: 'Réglages', detail: 'Filtres, priorité, qualité, état et fraîcheur. Les capacités physiques de chaque stockage sont conservées.', controls: [
    control('storage-copy', 'Copier', () => { const policy = currentPolicy(); storageClipboard = structuredClone({ filters: policy.filters, items: policy.items, priority: policy.priority, quality: policy.quality, hitPoints: policy.hitPoints, allowFresh: policy.allowFresh, allowRotten: policy.allowRotten }); feedback = 'Réglages copiés.'; }),
    control('storage-paste', 'Coller', () => { currentPolicy(); if (!storageClipboard) throw Error('Copiez d’abord les réglages d’un stockage.'); return update(structuredClone(storageClipboard)); }, !storageClipboard),
  ] });
  const quality = current.quality ?? { min: WEAPON_QUALITIES[0], max: WEAPON_QUALITIES.at(-1)! }, hp = current.hitPoints ?? { min: 0, max: 100 };
  rows.push(choices('storage-quality-min', 'Qualité minimum', quality.min, WEAPON_QUALITIES.filter(value => WEAPON_QUALITIES.indexOf(value) <= WEAPON_QUALITIES.indexOf(quality.max)), min => {
    const fresh = currentPolicy().quality ?? { min: WEAPON_QUALITIES[0]!, max: WEAPON_QUALITIES.at(-1)! };
    if (WEAPON_QUALITIES.indexOf(min) > WEAPON_QUALITIES.indexOf(fresh.max)) throw Error('Le minimum dépasse le maximum.');
    return update({ quality: { ...fresh, min } });
  }), choices('storage-quality-max', 'Qualité maximum', quality.max, WEAPON_QUALITIES.filter(value => WEAPON_QUALITIES.indexOf(value) >= WEAPON_QUALITIES.indexOf(quality.min)), max => {
    const fresh = currentPolicy().quality ?? { min: WEAPON_QUALITIES[0]!, max: WEAPON_QUALITIES.at(-1)! };
    if (WEAPON_QUALITIES.indexOf(max) < WEAPON_QUALITIES.indexOf(fresh.min)) throw Error('Le minimum dépasse le maximum.');
    return update({ quality: { ...fresh, max } });
  }), numberRow('storage-hp-min', 'PV minimum (%)', hp.min, 0, hp.max, min => {
    const fresh = currentPolicy().hitPoints ?? { min: 0, max: 100 };
    if (min > fresh.max) throw Error('Le minimum dépasse le maximum.');
    return update({ hitPoints: { ...fresh, min } });
  }), numberRow('storage-hp-max', 'PV maximum (%)', hp.max, hp.min, 100, max => {
    const fresh = currentPolicy().hitPoints ?? { min: 0, max: 100 };
    if (max < fresh.min) throw Error('Le minimum dépasse le maximum.');
    return update({ hitPoints: { ...fresh, max } });
  }));
  const freshRow=rows.find(entry=>entry.id==='fresh'),rottenRow=rows.find(entry=>entry.id==='rotten');
  if(freshRow&&rottenRow){
    const fresh=freshRow.controls![0]!,rotten=rottenRow.controls![0]!;
    rows.splice(rows.indexOf(freshRow),2,{id:'storage-freshness',label:'Conservation',controls:[{...fresh,label:'Frais',hint:'Autoriser ou interdire les produits frais'},{...rotten,label:'Pourris',hint:'Autoriser ou interdire les produits pourris'}]});
  }
  const minimum=rows.find(entry=>entry.id==='storage-quality-min'),maximum=rows.find(entry=>entry.id==='storage-quality-max');
  if(minimum&&maximum){
    const bounds=[minimum.controls![0]!,maximum.controls![0]!].map((action,index)=>({...action,label:QUALITY_LABELS[(index===0?quality.min:quality.max)!],caption:index===0?'Minimum':'Maximum',select:action.select?{...action.select,options:action.select.options.map(option=>({...option,label:QUALITY_LABELS[option.value as WeaponQuality]}))}:undefined}));
    rows.splice(rows.indexOf(minimum),2,{id:'storage-quality',label:'Qualité',controls:bounds});
  }
  const hpMinimum=rows.find(entry=>entry.id==='storage-hp-min'),hpMaximum=rows.find(entry=>entry.id==='storage-hp-max');
  if(hpMinimum){hpMinimum.column=0;hpMinimum.label='PV min %';hpMinimum.labelWidth=78;}
  if(hpMaximum){hpMaximum.column=1;hpMaximum.label='PV max %';hpMaximum.labelWidth=78;}
  for (const entry of rows) { entry.region = 'details'; entry.compact = true; entry.presentation = 'plain'; }
  const fixedAllows = structureId === undefined ? undefined : shelfControlOptions.fixedAllows;
  const setAll = (allow:boolean) => {
    const policy = currentPolicy(), next = storageTreeSelection(policy.filters, policy.items);
    for (const node of STORAGE_FILTER_TREE) for (const leaf of storageNodeLeaves(node)) if (!fixedAllows || fixedAllows(leaf)) { if (allow) next.add(leaf); else next.delete(leaf); }
    return update(storageTreePermissions(next));
  };
  rows.push({ id: 'storage-search', label: 'Rechercher', region: 'navigation', compact: true, presentation: 'plain', input: {
    value: navigation.search, placeholder: 'Objet ou catégorie…', maxLength: 160,
    onCommit: async value => { await control('storage-search-commit', 'Rechercher un objet', () => { navigation.search = value; }).onActivate(); },
  } }, { id: 'storage-all', label: `${selected.size} / ${STORAGE_LEAVES.length}`, hint:'Nombre d’objets autorisés dans le filtre', region: 'navigation', compact: true, presentation: 'plain', controls: [
    control('storage-clear', 'Tout effacer', () => setAll(false)), control('storage-allow', 'Tout autoriser', () => setAll(true)),
  ] });
  const treeRows = nativeStorageTreeRows({ id: 'storage', selected, expanded: navigation.expanded, search: navigation.search, disabled: latest.busy, fixedAllows,
    onExpand: id => { if (navigation.expanded.has(id)) navigation.expanded.delete(id); else navigation.expanded.add(id); },
    onToggle: (_node, _state, allowed) => {
      const policy = currentPolicy(), next = storageTreeSelection(policy.filters, policy.items);
      const all = allowed.every(leaf => next.has(leaf));
      for (const leaf of allowed) { if (all) next.delete(leaf); else next.add(leaf); }
      return update(storageTreePermissions(next));
    },
  });
  // Reuse the inspector's existing fresh-state/map/busy guards and repaint path.
  for (const entry of treeRows) entry.controls = entry.controls?.map(action => ({...control(action.id, action.label, action.onActivate, action.disabled, action.active, action.hint),glyph:action.glyph}));
  rows.push(...treeRows);
  return { id: `inspect-storage-${structureId ?? stockpileId}`, title: structure ? `${buildingLabels[structure.kind]} · Stockage` : 'Zone de stockage', contentKey:navigation.search, rows, actions: [control('storage-back', 'Retour', () => { subpage = undefined; })], layout: 'storage', width: 480, height: 760 };
}
function objectLabel(world: World, selected: MapObjectSelection): string {
  if(selected.kind==='job'){const job=selectedMapJob296(world,selected.id);if(job&&job.kind in buildingLabels)return `Plan · ${buildingLabels[job.kind as Structure['kind']]}`;}
  if (selected.kind === 'structure' || selected.kind === 'packed') { const structure = world.structures.find(s => s.id === selected.id) ?? world.packed.find(p => p.building.id === selected.id)?.building; return structure ? buildingTitle(structure.kind, buildingLabels[structure.kind]) : 'Bâtiment absent'; }
  if (selected.kind === 'pile') { const pile = world.piles.find(p => p.id === selected.id); return pile ? `${itemTitle(pile.item, ITEM_DEFINITIONS[pile.item].label)} × ${pile.quantity}` : 'Pile absente'; }
  if (selected.kind === 'resource') { const resource = world.resources.find(r => r.id === selected.id); return resource ? resource.species ? wildPlantTitle(resource.species, floraDefinition(resource)?.label ?? resource.species) : resource.kind : 'Ressource absente'; }
  if (selected.kind === 'plan') { const plan = planById369(world, selected.id); return plan ? planLabel369(plan) : 'Plan absent'; }
  // Core InspectPaneUtility.AdjustedLabelFor: the rock Thing's LabelCap.
  if (selected.kind === 'rock') { const tile = world.tiles[selected.id]; return tile?.terrain === 'rock' ? rockThingLabel(tile) : 'Massif rocheux'; }
  return ({ growing: 'Zone de culture', stockpile: 'Zone de stockage', rock: 'Massif rocheux', geyser: 'Geyser', job: 'Ordre de travail' } as Record<string, string>)[selected.kind] ?? selected.kind;
}
/** The installed RimWorld's description of the thing, when loaded (Elsewhere has none of its own). */
function objectDescription(world: World, selected: MapObjectSelection): string | undefined {
  if (selected.kind === 'structure') { const structure = world.structures.find(s => s.id === selected.id); return structure ? buildingDescription(structure.kind) : undefined; }
  if (selected.kind === 'pile') { const pile = world.piles.find(p => p.id === selected.id); return pile ? itemDescription(pile.item) : undefined; }
  return undefined;
}
function objectPage(world: World, objects: readonly MapObjectSelection[]): NativePage {
  const selected = objects[0]!, rows: NativeRow[] = [];
  if (objects.length > 1) {
    const counts = new Map<string, number>(); for (const object of objects) { const label = objectLabel(world, object); counts.set(label, (counts.get(label) ?? 0) + 1); }
    for (const [label, count] of counts) rows.push(row(`group-${rows.length}`, label, String(count)));
    const actions = mapObjectGroupActions(world, objects).map(action => control(`group-action-${action.id}`, `${action.label} (${action.commands.length})`, async () => { for (const value of action.commands) await send(value); }));
    // Core InspectPaneUtility.AdjustedLabelFor: one definition label (items
    // without their count) or « Divers », then « x » and the summed stack count.
    let base: string | undefined, same = true, total = 0;
    for (const object of objects) {
      const pile = object.kind === 'pile' ? world.piles.find(p => p.id === object.id) : undefined;
      const label = pile ? itemTitle(pile.item, ITEM_DEFINITIONS[pile.item].label) : objectLabel(world, object);
      total += pile?.quantity ?? 1; if (base === undefined) base = label; else if (base !== label) same = false;
    }
    return { id: 'inspect-object-group', title: `${same && base ? base : 'Divers'} ×${total}`, rows, actions };
  }
  const structure = selected.kind === 'structure' ? world.structures.find(s => s.id === selected.id) : undefined;
  if (structure && subpage?.structureId === structure.id && subpage.kind === 'bills') return billPage(world, structure);
  if (subpage?.kind === 'storage') { const storage = storagePage(world, subpage.structureId, subpage.stockpileId); if (storage) return storage; subpage = undefined; }
  const actions = mapObjectActions(world, selected).map(action => action.command ? command(`object-action-${action.id}`, action.label, action.command) : control(`object-action-${action.id}`, action.label, () => action.placementPileId === undefined ? undefined : owner.replant?.(action.placementPileId), !owner.replant));
  // Core BuildCopyCommandUtility: "Copier" selects the same construction and material.
  const copy = structure ? buildCopy346(world, structure) : undefined;
  if (copy) actions.push(control('object-action-copy', 'Copier', () => { owner.tool(copy.tool); if (copy.material) owner.material(copy.material); }, false, false, 'Choisir la même construction et le même matériau dans l’Architecte.'));
  rows.push(row('object-id', 'Identité', String(selected.id)));
  const wallProject=world.jobs.find(job=>job.wallDoor296?.plan&&(selected.kind==='structure'&&job.deconstruction?.structureId===selected.id||selected.kind==='job'&&(job.id===selected.id||job.wallDoor296.plan.id===selected.id)));
  if(wallProject?.wallDoor296?.plan&&owner.selectObject){
    const planId=wallProject.wallDoor296.plan.id,wallId=wallProject.deconstruction!.structureId;
    const target:MapObjectSelection=selected.kind==='job'&&selected.id===planId?{kind:'structure',id:wallId}:{kind:'job',id:planId};
    rows.push({id:'wall-door-inspection',label:'À cet emplacement',controls:[control(`wall-door-inspect-${target.kind}-${target.id}`,target.kind==='job'?'Inspecter le plan de porte':'Inspecter le mur',()=>{
      const current=owner.readState?.().world??latest.world;if(current&&mapObjectExists(current,target))owner.selectObject!(target);
    },false,false,'Changer d’élément inspecté sans annuler le plan ni la déconstruction.')]});
  }
  if (structure) {
    const max = structureMaxHp(structure), use = targetBuildingPlayerUse263(world, structure);
    rows.push(meterRow('structure-condition', 'Points de vie', Math.max(0, max - (structure.damage ?? 0)), max, undefined, `${Math.max(0, max - (structure.damage ?? 0))} / ${max}`), row('structure-orientation', 'Orientation', String(structure.orientation)));
    if (structure.material) rows.push(row('structure-material', 'Matériau', structure.material));
    if (structure.quality) rows.push(row('structure-quality', 'Qualité', structure.quality));
    const definition = STRUCTURE_DEFINITIONS[structure.kind]; rows.push(row('structure-size', 'Encombrement', `${definition.width} × ${definition.depth} cases`), row('structure-movement', 'Passage', definition.blocksMovement ? 'Bloque le déplacement' : 'Ne bloque pas le déplacement'));
    if (use && stationRecipes(structure).length) actions.push(control('station-bills', 'Factures', () => { subpage = { kind: 'bills', structureId: structure.id }; }));
    if (use && structure.shelf) actions.push(control('shelf-policy', 'Stockage', () => { subpage = { kind: 'storage', structureId: structure.id }; }));
    if (use && minifiable(structure.kind)) actions.push(command('uninstall', 'Désinstaller', { type: 'designate', kind: 'uninstall', x: structure.x, z: structure.z, targetId: structure.id }));
    if (use && minifiable(structure.kind) && owner.placeFurniture) actions.push(control('reinstall', 'Réinstaller', () => owner.placeFurniture!(structure.id)));
    if (use && structure.door) rows.push(booleanRow('door-hold', 'Maintenir ouverte', !!structure.door.holdOpen, value => send({ type: 'door-policy', structureId: structure.id, setting: 'holdOpen', value })), booleanRow('door-forbidden', 'Interdire le passage', !!structure.door.forbidden, value => send({ type: 'door-policy', structureId: structure.id, setting: 'forbidden', value })));
    if (use && structure.power && !isShipComputerSensorsKind298(structure.kind)) rows.push(booleanRow('power', 'Interrupteur demandé', structure.power.switchOn !== false, on => send({ type: 'power-flick', structureId: structure.id, on })));
    if (use && structure.fuel) rows.push(booleanRow('refuel', 'Autoriser le remplissage', structure.fuel.autoRefuel, enabled => send({ type: 'refuel-policy', structureId: structure.id, enabled })));
    if (use && ['table', 'table-square', 'table-long', 'table-large', 'campfire'].includes(structure.kind)) rows.push(booleanRow('gather-spot', 'Point de rencontre', structure.gatherSpot !== false, enabled => {
      const fresh = latest.world, current = fresh?.structures.find(current => current.id === structure.id);
      if (!fresh || !current || !['table', 'table-square', 'table-long', 'table-large', 'campfire'].includes(current.kind) || !targetBuildingPlayerUse263(fresh, current)) throw Error('Ce point de rencontre n’est plus disponible.');
      return send({ type: 'gather-spot', structureId: current.id, enabled });
    }));
    if (use && (structure.kind === 'heater' || structure.kind === 'cooler')) rows.push({ id: 'climate-target', label: 'Température de consigne', value: String(structure.heater?.target ?? structure.cooler?.target), controls: ([-10, -1, 1, 10, null] as const).map(offset => command(`climate-${offset}`, offset === null ? 'Réinitialiser' : signed(offset), structure.kind === 'heater' ? { type: 'heater-adjust', structureId: structure.id, offset } : { type: 'cooler-adjust', structureId: structure.id, offset })) });
    const power = powerInspection(world, structure); if (power) rows.push(row('power-details', 'Énergie et fonctionnement', undefined, power));
    const brewing = brewingInspection265(world, structure); if (brewing) rows.push(row('brewing-details', 'Brassage et fermentation', undefined, brewing));
    const eggBox = eggBoxInspection374Text(world, structure); if (eggBox) rows.push(row('egg-box-content', 'Boîte à œufs', undefined, eggBox));
    const facilities = toolCabinetInspection355(world, structure); if (facilities) rows.push(row('tool-cabinet-links', structure.kind === 'tool-cabinet' ? 'Établis liés' : 'Installations liées', undefined, facilities));
    if (structure.battery) rows.push(meterRow('battery-energy', 'Énergie stockée', batteryWattDays(structure.battery), BATTERY_CAPACITY / BATTERY_ENERGY_SCALE, undefined, `${batteryWattDays(structure.battery).toFixed(2)} W·j`));
    if (structure.fuel) rows.push(meterRow('fuel-reserve', 'Combustible', structure.fuel.ticks, fuelLimit(structure.kind), 'Réserve réelle ; le remplissage exige les objets, l’accès et le travail disponibles.'));
    if (structure.breakdown) rows.push(row('breakdown', 'En panne', `Depuis ${((world.tick - structure.breakdown.brokenAt) / 250).toFixed(1)} h`, 'Remplacement réel d’un composant et travail de construction requis.'));
    if (structure.wind && use) rows.push(row('wind-output', 'Production éolienne actuelle', `${structure.wind.cachedWatts} W`), booleanRow('wind-auto-cut', 'Couper les arbres dans le couloir éolien', structure.wind.autoCut, enabled => send({ type: 'wind-auto-cut', structureId: structure.id, enabled })));
    if (structure.turret) {
      rows.push(row('turret-ammo', 'Réserve de tir', `${(structure.turret.ammoQ / 4).toFixed(2)} tirs`), row('turret-target', 'Cible actuelle', structure.turret.targetKey ?? 'Aucune'), row('turret-phase', 'Canon', structure.turret.warmup ? `Préparation · ${(structure.turret.warmup.remainingCore / 60).toFixed(2)} s` : structure.turret.burst ? 'Rafale engagée' : structure.turret.cooldownCore > 0 ? `Récupération · ${(structure.turret.cooldownCore / 60).toFixed(2)} s` : 'Disponible'));
      if (use) rows.push(booleanRow('turret-hold-fire', 'Cesser le feu', structure.turret.holdFire, enabled => send({ type: 'turret-hold-fire', structureId: structure.id, enabled })), booleanRow('turret-auto-reload', 'Rechargement automatique', structure.turret.autoReload, enabled => send({ type: 'turret-auto-reload', structureId: structure.id, enabled })));
    }
  } else if (selected.kind === 'pile') {
    const pile = world.piles.find(pile => pile.id === selected.id); if (pile) {
      const max = pileMaxHp(pile, world.schemaVersion), info = itemInformation(pile, world);
      rows.push(row('pile-quantity', 'Quantité', String(pile.quantity)), meterRow('pile-condition', 'Points de vie', Math.max(0, max - pileDamage(pile)), max, undefined, `${Math.max(0, max - pileDamage(pile))} / ${max}`), ...info.rows.map((fact, index) => row(`pile-information-${index}`, `${fact.category} · ${fact.label}`, fact.value, fact.description)));
      if(pile.book&&(Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))){
        const readers=world.pawns.filter(p=>isColonist(p)&&!p.prisoner&&!p.visitor&&p.state!=='dead');
        const readerSelect=control('book-read-select','Choisir un lecteur',()=>undefined,!readers.length);
        readerSelect.select={value:'',options:[{value:'',label:'Choisir un lecteur',disabled:true},...readers.map(p=>{
          const reason=readingRefusal295(world,p,pile,true);return {value:String(p.id),label:p.name,hint:reason??'Prendre et lire ce roman',disabled:!!reason};
        })],onChange:async value=>{const id=Number(value);if(!Number.isSafeInteger(id)||!readers.some(p=>p.id===id))return;await send({type:'read-book-295',pawnId:id,bookId:pile.id});}};
        rows.push({id:'book-read',label:'Lire ce roman',hint:'Ordre direct : la politique règle seulement la sélection automatique. Le lecteur doit atteindre et porter le même exemplaire.',controls:[readerSelect]});
      }
      if (pile.weapon || pile.apparel) {
        const allowed = !(pile.apparel ?? pile.weapon)!.forbidden, apparel = !!pile.apparel;
        rows.push(row('equipment-permission-state', 'Usage et transport de cet objet', allowed ? 'Autorisé' : 'Interdit'));
        actions.push(control('equipment-permission', allowed ? 'Interdire cet objet' : 'Autoriser cet objet', () => {
          const current = latest.world?.piles.find(current => current.id === pile.id);
          if (!current || current.owner.type !== 'ground' || (apparel ? !current.apparel : !current.weapon)) throw Error('Cet objet n’est plus disponible au sol.');
          return send(apparel ? { type: 'apparel-permission', itemId: current.id, allowed: !allowed } : { type: 'weapon-permission', itemId: current.id, allowed: !allowed });
        }));
      }
      if (world.schemaVersion >= 256 && eggSpeciesForItem256(pile.item)) {
        const allowed = eggAllowedForPlayer256(pile), genericPermission = actions.findIndex(action => action.id === 'object-action-material-permission');
        if (genericPermission >= 0) actions.splice(genericPermission, 1);
        rows.push(row('egg-permission-state', 'Usage et transport de cet œuf', allowed ? 'Autorisé' : 'Interdit'));
        actions.push(control('egg-permission', allowed ? 'Interdire cet œuf' : 'Permettre cet œuf', () => {
          const current = latest.world?.piles.find(current => current.id === pile.id);
          if (!current || !eggSpeciesForItem256(current.item)) throw Error('Cet œuf n’est plus disponible.');
          return send({ type: 'egg-forbid', pileId: current.id, forbidden: allowed });
        }));
      }
      if (pile.corpse || pile.humanCorpse) rows.push(row('corpse-stage', 'État de la dépouille', ({ fresh: 'Fraîche', rotting: 'En décomposition', desiccated: 'Desséchée' })[corpseStage(pile, world.tick)]));
      if (pile.prostheticWork273 || pile.smithingWork || pile.artWork || pile.gunWork || pile.flakWork || pile.componentWork || pile.unfinished) actions.push(command('cancel-unfinished', 'Annuler cet ouvrage', { type: 'cancel-unfinished', itemId: pile.id }));
    }
  } else if (selected.kind === 'resource') {
    const resource = world.resources.find(resource => resource.id === selected.id); if (resource) { const max = resourceMaxHp(resource); rows.push(meterRow('resource-hp', 'Points de vie', max - (resource.damage ?? 0), max, undefined, `${max - (resource.damage ?? 0)} / ${max}`), row('resource-amount', 'Quantité enregistrée', String(resource.amount))); if (resource.kind !== 'rock') rows.push(row('resource-growth', 'Croissance et récolte', undefined, plantInspection(world, resource))); }
    if (resource?.blight) actions.push(control('cut-blighted-crops', 'Couper tous les plants malades', () => {
      if (!latest.world?.resources.some(current => current.id === resource.id && current.blight)) throw Error('Ce plant n’est plus atteint.');
      return send({ type: 'cut-blighted-crops' });
    }));
  } else if (selected.kind === 'rock') {
    // Core InspectPaneFiller.DrawHealth: the HitPoints bar of the Mineable
    // (Granite 900, compacted steel 1500…); Mineable adds no inspect string.
    const tile = world.tiles[selected.id];
    if (tile?.terrain === 'rock') { const max = rockMaxHP(tile), current = Math.max(0, max - (tile.miningDamage ?? 0)); rows.push(meterRow('rock-hp', 'Points de vie', current, max, undefined, `${current} / ${max}`)); }
  } else if (selected.kind === 'stockpile') {
    const currentZoneId = () => {
      const cell = latest.world?.stockpiles.find(cell => cell.id === selected.id);
      if (!cell) throw Error('Cette réserve n’est plus disponible.');
      return stockpileZoneId(cell);
    };
    actions.push(control('stockpile-settings', 'Réglages du stockage', () => { subpage = { kind: 'storage', stockpileId: selected.id }; }));
    if (owner.resizeZone) actions.push(control('stockpile-expand', 'Agrandir la zone', () => owner.resizeZone!('stockpile', currentZoneId(), false)), control('stockpile-shrink', 'Réduire la zone', () => owner.resizeZone!('stockpile', currentZoneId(), true)));
    actions.push(control('delete-stockpile', 'Supprimer la zone', () => send({ type: 'delete-zone', kind: 'stockpile', zoneId: currentZoneId() })));
  }
  else if (selected.kind === 'growing') {
    const zone = world.growingZones.find(zone => zone.id === selected.id); if (zone) rows.push(row('growing-size', 'Surface de culture', `${zone.cells.length} cases`), booleanRow('allow-sow', 'Autoriser les semis', zone.allowSow, allowSow => send({ type: 'growing-policy', zoneId: zone.id, allowSow, allowCut: zone.allowCut })), booleanRow('allow-cut', 'Couper les plantes indésirables', zone.allowCut, allowCut => send({ type: 'growing-policy', zoneId: zone.id, allowSow: zone.allowSow, allowCut })));
    if (owner.resizeZone) actions.push(control('growing-expand', 'Agrandir la zone', () => owner.resizeZone!('growing', selected.id, false)), control('growing-shrink', 'Réduire la zone', () => owner.resizeZone!('growing', selected.id, true)));
    actions.push(command('delete-growing', 'Supprimer la zone', { type: 'delete-zone', kind: 'growing', zoneId: selected.id }));
  } else if (selected.kind === 'plan') {
    // Schema 369: Plan.GetInspectString and the plan gizmos (hide, expand,
    // shrink, change colour, delete). Copy and rename are not offered.
    const plan = planById369(world, selected.id);
    if (plan) {
      rows.push(row('plan-size', 'Taille', `${plan.cells.length} case${plan.cells.length > 1 ? 's' : ''}`));
      if ((world.plans369?.plans.length ?? 0) > 1) rows.push(row('plan-total', 'Surface planifiée totale', `${totalPlanArea369(world)} cases`));
      const color = control('plan-color-select', 'Changer de couleur', () => undefined);
      color.select = { value: plan.color, options: PLAN_COLORS_369.map(value => ({ value, label: PLAN_COLOR_DEFS_369[value].label })),
        onChange: async value => { if (isPlanColor369(value) && value !== plan.color) await send({ type: 'plan-369', action: 'color', planId: plan.id, color: value }); } };
      rows.push({ id: 'plan-color', label: 'Couleur', value: PLAN_COLOR_DEFS_369[plan.color].label, controls: [color] });
      actions.push(command('plan-hide', plan.hidden ? 'Afficher le plan' : 'Masquer le plan', { type: 'plan-369', action: 'hide', planId: plan.id, hidden: !plan.hidden }));
      if (owner.editPlan369) actions.push(control('plan-expand', 'Agrandir le plan', () => owner.editPlan369!(plan.id, false)), control('plan-shrink', 'Réduire le plan', () => owner.editPlan369!(plan.id, true)));
      actions.push(command('plan-delete', 'Supprimer le plan', { type: 'plan-369', action: 'delete', planId: plan.id }));
    }
  } else if (selected.kind === 'packed') { const packed = world.packed.find(p => p.building.id === selected.id); if (packed) { const building = packed.building, max = structureMaxHp(building); rows.push(row('packed-label', 'Meuble emballé', buildingLabels[building.kind]), meterRow('packed-health', 'Points de vie conservés', max - (building.damage ?? 0), max, undefined, `${max - (building.damage ?? 0)} / ${max}`), row('packed-material', 'Matériau', building.material ?? 'Matériau de construction enregistré'), row('packed-quality', 'Qualité', building.quality ?? 'Sans qualité')); if (owner.placeFurniture) actions.push(control('install-packed', 'Installer', () => owner.placeFurniture!(selected.id))); } }
  else if (selected.kind === 'job') {
    const parent=world.jobs.find(job=>job.wallDoor296?.plan?.id===selected.id),job=selectedMapJob296(world,selected.id);
    if(job&&parent){
      const recipe=constructionRecipe(job);
      rows.push(row('job-kind','Projet',buildingLabels[job.kind as Structure['kind']]),
        row('job-state','Étape','Retrait du mur','Le mur reste en place jusqu’à sa déconstruction réelle. La porte sera ensuite approvisionnée et construite.'),
        row('job-worker','Démontage',world.pawns.find(pawn=>pawn.id===parent.reservedBy)?.name??'En attente d’un constructeur'),
        row('job-materials','Matériaux de la porte',recipe.ingredients.map(cost=>`${cost.quantity} ${ITEM_DEFINITIONS[cost.item].label}`).join(' · '),'Aucun matériau de la future porte n’est encore livré.'));
    }else if(job){const diagnostic=queryJobStatus(world,job);rows.push(row('job-kind','Travail',job.kind in buildingLabels?buildingLabels[job.kind as Structure['kind']]:job.kind),row('job-state','État',job.status==='active'?'En cours':'En attente',diagnostic.reason),row('job-worker','Réservation',world.pawns.find(pawn=>pawn.id===job.reservedBy)?.name??'Aucune'),row('job-materials','Matériaux livrés',`${diagnostic.delivered} / ${diagnostic.required}`));}
  }
  return { id: `inspect-${selected.kind}-${selected.id}`, title: objectLabel(world, selected), subtitle: objectDescription(world, selected), rows, actions, layout: 'inspector' };
}

function animalPage(world: World, animalId: number): NativePage | null {
  const animal = world.wildlife?.animals.find(animal => animal.id === animalId); if (!animal) return null;
  const species = animalSpecies(animal.species), body = animalBody(animal), model = animalBodyModel(animal.species, animal.ageTicks, animal.growthTracker?.value), dead = animal.state === 'dead';
  const rows: NativeRow[] = [row('animal-identity', `${animal.sex === 'female' ? 'Femelle' : 'Mâle'} · ${{ baby: 'Petit', juvenile: 'Jeune', adult: 'Adulte' }[animalLifeStage(animal)]} · ${animal.domestic ? 'Domestique' : 'Sauvage'}`, `${animal.x}, ${animal.z}`), row('animal-activity', 'Activité', animalActivity(world, animal)), row('animal-age', 'Âge', `${(animal.ageTicks / 6000).toFixed(1)} jours`), row('animal-size', 'Taille corporelle', animalBodySize(animal).toFixed(3)), row('animal-daily-food', 'Nutrition quotidienne', animalFoodPerDay(animal).toFixed(3)), meterRow('animal-food', 'Nourriture', animal.food, animalNutritionMax(animal)), meterRow('animal-rest', 'Repos', animal.rest)];
  if (!dead) for (const [key, value] of Object.entries(body.capacities)) rows.push(meterRow(`animal-capacity-${key}`, capacityLabels[key] ?? key, value, 1, capacityHelp[key]));
  rows.push(...bodyRows(animal.health, part => model.byId[part]?.label ?? part));
  if (animal.pregnancy) rows.push(meterRow('pregnancy', 'Gestation', animal.pregnancy.progress, gestationTicks(animal.species), `Père : ${animal.pregnancy.fatherId}`));
  if (animal.parents) rows.push(row('parents', 'Parents', `Mère ${animal.parents.motherId} · Père ${animal.parents.fatherId}`));
  if (animal.domestic) {
    rows.push(meterRow('animal-tameness', 'Familiarité', animal.domestic.tameness, 5, undefined, `${animal.domestic.tameness} / 5`), choices('animal-care', 'Soins vétérinaires', animal.domestic.care, Object.keys(MEDICAL_CARE) as MedicalCare[], care => send({ type: 'animal-care-policy', animalId, care }), care => MEDICAL_CARE[care], dead));
    for (const skill of ['obedience', 'haul'] as const) { const training = readAnimalTraining282(animal, skill), reason = trainingRefusal282(world, animal, skill); rows.push({ id: `training-${skill}`, label: ANIMAL_TRAINING_LABELS_282[skill], value: `${training.steps} / ${training.maxSteps}${training.learned ? ' · Acquis' : ''}`, detail: reason, controls: [command(`train-${skill}`, training.wanted ? 'Ne plus demander' : 'Demander', { type: 'animal-training', animalId, skill, wanted: !training.wanted }, dead || !!reason)] }); }
    if (supportsAnimalAreas287(animal.species) && world.schemaVersion >= 287) { const choice = currentAnimalAreaChoice287(world, animal); rows.push({ id: 'animal-area', label: 'Zone autorisée', value: choice === null ? 'Sans restriction' : choice.kind === 'home' ? 'Foyer' : world.allowedAreas?.find(area => area.id === choice.areaId)?.label ?? 'Zone absente', controls: [command('animal-unrestricted', 'Sans restriction', { type: 'animal-area-assign', animalId, choice: null }, dead), command('animal-home', 'Foyer', { type: 'animal-area-assign', animalId, choice: { kind: 'home' } }, dead), ...(world.allowedAreas ?? []).map(area => command(`animal-area-${area.id}`, area.label, { type: 'animal-area-assign', animalId, choice: { kind: 'allowed', areaId: area.id } }, dead))] }); }
    const masterId = animal.training?.masterId ?? animal.startingPet?.masterId;
    if (masterId !== undefined) rows.push(row('animal-master', 'Maître', world.pawns.find(pawn => pawn.id === masterId)?.name ?? world.campaignPeople?.find(person => person.id === masterId)?.name ?? 'Personne hors carte'));
    if (animal.domestic.bedId !== undefined) rows.push(row('animal-bed', 'Couchage attribué', String(animal.domestic.bedId)));
    if (animal.domestic.penMarkerId !== undefined) rows.push(row('animal-pen', 'Marqueur d’enclos', String(animal.domestic.penMarkerId)));
    const product = productKind(animal); if (product) rows.push(meterRow('animal-product', product === 'milk' ? 'Maturité du lait' : 'Maturité de la laine', productFullness(animal), 1, productFullness(animal) >= 1 ? 'Prêt à récolter par un éleveur' : undefined));
  }
  if (world.schemaVersion >= 221 && animal.domestic && animal.state === 'downed' && !animal.health?.death) {
    const workers = world.pawns.filter(isColonist);
    rows.push({ id: 'animal-rescue', label: 'Secourir cet animal', detail: workers.length ? 'Un médecin disponible rejoint cet animal puis le porte vers un couchage libre et accessible.' : 'Aucun colon présent.',
      controls: workers.map(worker => {
        const reason = animalRescueReason(world, worker, animal);
        return control(`animal-rescue-${worker.id}`, `Secourir · ${worker.name}`, () => {
          const fresh = latest.world, person = fresh?.pawns.find(person => person.id === worker.id), patient = fresh?.wildlife?.animals.find(patient => patient.id === animalId);
          if (!fresh || !person || !patient) throw Error('Le colon ou l’animal n’est plus présent.');
          const refusal = animalRescueReason(fresh, person, patient); if (refusal) throw Error(refusal);
          return send({ type: 'order-animal-rescue', pawnId: person.id, animalId: patient.id });
        }, !!reason, false, reason ?? 'Rejoindre l’animal puis le porter jusqu’à un couchage accessible.');
      }) });
  }
  const tame = tameRefusal(world, animal), slaughter = slaughterRefusal(world, animal), hunted = world.hunting?.targets.includes(animalId) ?? false;
  const actions: NativeControl[] = animal.domestic ? [command('animal-slaughter', animal.domestic.slaughter ? 'Annuler l’abattage' : 'Abattre', { type: 'slaughter', animalId, enabled: !animal.domestic.slaughter }, dead || !!slaughter, !!animal.domestic.slaughter, slaughter),
    ...(isExecuteRelease364(world.schemaVersion) ? [command('animal-release-wild', animal.domestic.release364 ? 'Annuler la remise en liberté' : 'Relâcher dans la nature', { type: 'release-wild', animalId, enabled: !animal.domestic.release364 }, dead, !!animal.domestic.release364, 'Un soigneur emmène l’animal dehors puis le relâche : il redevient sauvage et quitte la colonie.')] : [])] : [command('animal-hunt', hunted ? 'Annuler la chasse' : 'Chasser', { type: 'hunt', animalId, enabled: !hunted }, dead, hunted), command('animal-tame', animal.taming?.designated ? 'Annuler l’apprivoisement' : 'Apprivoiser', { type: 'tame', animalId, enabled: !animal.taming?.designated }, dead || !animal.taming?.designated && !!tame, !!animal.taming?.designated, tame ?? `Animaux ${handlingSkill(animal.species)} minimum`)];
  return { id: `inspect-animal-${animalId}`, title: actualAnimalName256(animal) ?? `${animalTitle(animal.species, species.label)} ${animalId}`, subtitle: animalDescription(animal.species), rows, actions, layout: 'inspector' };
}
function mechPage(world: World, actorId: number): NativePage | null {
  const actor = world.mechanoids?.find(actor => actor.id === actorId); if (!actor) return null;
  const view = mechanoidView(world, actor), rows: NativeRow[] = [row('mech-action', 'Activité', view.action), row('mech-authority', 'Machine hostile', undefined, 'Aucune commande coloniale : mobilisation, soins, recrutement, nourriture, chasse et dressage indisponibles.'), row('mech-mass', 'Masse naturelle restante', `${view.mass.toFixed(3)} kg`), row('mech-target', 'Cible', view.target?.label ?? 'Aucune'), row('mech-group', 'Groupe', view.group ?? 'Aucun')];
  for (const [key, value] of Object.entries(view.capacities)) rows.push(meterRow(`mech-capacity-${key}`, capacityLabels[key] ?? key, value, 1, capacityHelp[key]));
  for (const [key, value] of Object.entries(view.armor)) rows.push(meterRow(`mech-armor-${key}`, `Armure · ${key}`, value));
  for (const part of view.parts) rows.push(meterRow(`mech-part-${part.id}`, part.label, part.absent ? 0 : part.health, part.maximum, part.injuries.map(injury => `${injury.label} · −${injury.severity.toFixed(2)} PV`).join(' · '), part.absent ? 'Absente' : `${part.health.toFixed(2)} / ${part.maximum} PV`));
  if (view.ranged) rows.push(row('mech-ranged-range', 'Portée du canon intrinsèque', `${view.ranged.range.toFixed(1)} cases`, 'La ligne de tir et les capacités réelles restent nécessaires. Ce canon ne devient pas un objet transportable.'), row('mech-ranged-phase', 'Phase du canon', view.ranged.phase === 'warmup' ? 'Préparation du tir' : view.ranged.phase === 'cooldown' ? 'Récupération après un essai' : 'Disponible', view.ranged.phase ? `${((view.ranged.remainingCore ?? 0) / 60).toFixed(2)} s restantes${view.ranged.suspended ? ' · Suspendue' : ''}` : undefined), row('mech-ranged-target', view.ranged.phase === 'cooldown' ? 'Cible du dernier essai' : 'Visée', view.ranged.target?.label ?? 'Aucune'));
  if (actor.emp) { const core = world.tick * 10; rows.push(row('mech-emp', 'EMP', actor.emp.stunUntilCore > core ? `Neutralisé encore ${((actor.emp.stunUntilCore - core) / 60).toFixed(1)} s` : 'Mobilité et attaques rétablies', actor.emp.adaptedUntilCore > core ? `Adapté encore ${((actor.emp.adaptedUntilCore - core) / 60).toFixed(1)} s · Un nouvel impact ne prolonge pas cet arrêt` : undefined)); }
  rows.push(...nativeClinicalConditionRows(actor.health));
  return { id: `inspect-mech-${actorId}`, title: view.label, rows, layout: 'inspector' };
}

/** All projections use the accepted World passed by Main. Data and commands
 * never come from DOM layout, hidden legacy controls or simulated clicks. */
function nativeInspectorSelectionKey(state:NativeUiState):string {
  const world=state.world,selected=world?(state.selectedObjects??[]).filter(object=>mapObjectExists(world,object)):[];
  return `${state.epoch??''}:${world?registeredMapId(world)??'':''}|${state.selectedPawnIds.join(',')}|${state.selectedAnimalId??''}|${state.selectedMechanoidId??''}|${selected.map(object=>`${object.kind}:${object.id}`).join(',')}|${state.selectedCell?.x},${state.selectedCell?.z}`;
}

export function buildNativeInspector(state: NativeUiState, actions: NativeUiActions): NativePage | null {
  latest = state; owner = actions; const world = state.world; if (!world) return null;
  const selected = (state.selectedObjects ?? []).filter(object => mapObjectExists(world, object));
  const key = nativeInspectorSelectionKey(state);
  if (key !== selectionKey) { resetCardScroll(); subpage = undefined; billDrafts.clear(); billWorkers.clear(); storageNavigation = undefined; feedback = ''; selectionKey = key; }
  let page: NativePage | null = null;
  if (subpage?.kind === 'item') { page = itemPage(world, subpage.itemId!); if (!page) subpage = undefined; }
  else if (subpage?.kind === 'anatomy') { const pawn = world.pawns.find(pawn => pawn.id === subpage?.pawnId); if (pawn) page = anatomyPage(world, pawn); else subpage = undefined; }
  if (page) { /* The explicit information page keeps this selected owner. */ }
  else if (state.selectedAnimalId !== undefined) page = animalPage(world, state.selectedAnimalId);
  else if (state.selectedMechanoidId !== undefined) page = mechPage(world, state.selectedMechanoidId);
  else if (state.selectedPawnIds.length) {
    const pawn = world.pawns.find(pawn => pawn.id === state.selectedPawnIds[0]); if (pawn) page = pawnPage(world, pawn);
    if (page && state.selectedPawnIds.length > 1) page.rows.unshift({ id: 'selected-pawns', label: `${state.selectedPawnIds.length} personnes sélectionnées`, controls: state.selectedPawnIds.flatMap(id => { const person = world.pawns.find(pawn => pawn.id === id); return person ? [control(`inspect-selected-${id}`, person.name, () => owner.selectPawn(id))] : []; }) });
  } else if (selected.length) page = objectPage(world, selected);
  else if (state.selectedCell) {
    const objects = mapObjectsAt(world, state.selectedCell);
    const light = state.lightLevel ?? lightCache.read(world).lightAt(state.selectedCell);
    const details = mapCellDetails(world, state.selectedCell, light);
    if (details) page = { id: 'inspect-cell', title: details.heading, subtitle: `${state.selectedCell.x}, ${state.selectedCell.z}`, rows: [...details.rows.map((detail, index) => row(`cell-fact-${index}`, detail.label, detail.value)), ...details.things.map((thing, index) => row(`cell-thing-${index}`, thing)), ...objects.map(object => ({ id: `cell-object-${object.kind}-${object.id}`, label: objectLabel(world, object), controls: owner.selectObject ? [control(`inspect-${object.kind}-${object.id}`, 'Inspecter', () => owner.selectObject!(object))] : undefined }))], layout: 'inspector' };
  }
  if (!page) return null;
  if (page.layout !== 'storage') page.layout = 'inspector';
  page.width ??= page.id.startsWith('inspect-bills-') || page.id.startsWith('inspect-storage-') ? 630 : 500; page.height ??= 430;
  // The room-and-hygiene dossier of a person has no place in Core's Health or Needs
  // tab (they are cards): it is a command tile beside the pane, like a gizmo.
  if (!subpage && selected.length <= 1 && page.rows.some(entry => entry.id === 'tab-card') && (activeTab === 'health' || activeTab === 'needs')) {
    for (const entry of nativeSpecialRows(state, actions)) for (const action of entry.controls ?? []) (page.actions ??= []).push({ ...action, hint: [action.hint, entry.hint].filter(Boolean).join(' · ') || undefined });
  } else if (!subpage && selected.length <= 1 && (!state.selectedPawnIds.length || activeTab === 'health' || activeTab === 'needs')) page.rows.push(...nativeSpecialRows(state, actions).map(entry => page!.columnRatio === undefined ? entry : activeTab==='health'?{...entry,label:entry.id==='special-environment'?'':entry.label,compact:true,column:1 as const}:{...entry,column:0 as const}));
  for (const entry of page.rows) { if (entry.detail) { entry.hint = [entry.hint, entry.detail].filter(Boolean).join(' · '); delete entry.detail; } if (entry.hint) for (const action of entry.controls ?? []) action.hint = [action.hint, entry.hint].filter(Boolean).join(' · '); }
  if (feedback) page.rows.unshift({...row('inspector-feedback', feedback), ...(page.layout === 'storage' ? {region:'details' as const, compact:true, presentation:'plain' as const} : {})});
  if (owner.clearSelection) {
    // Inspection repaint uses the host's custom page slot. Release that slot
    // as well as selection, without changing unrelated host close callbacks.
    const clear=owner.clearSelection,closePage=owner.closePage,close=()=>{clear();closePage?.();};
    page.actions ??= []; page.actions.push(control('inspect-close', 'Fermer', close)); page.onClose = close;
  }
  page.textEntities=nativeTextEntitiesFor(world,state.campaign);
  return page;
}
