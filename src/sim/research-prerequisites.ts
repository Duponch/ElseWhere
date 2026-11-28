import {isBlowbackSchema340} from './blowback-340.ts';
import type {ResearchProject} from './research.ts';

/** One source for the research prerequisites: the simulation refuses a
 * project from this table (`researchPrerequisite`), and the research view
 * draws its links and lists its prerequisites from it.
 *
 * Read from the Core ResearchProjectDefs of RimWorld 1.6
 * (Data/Core/Defs/ResearchProjectDefs/*.xml):
 *  - `visible` are Core `prerequisites`, in XML order. Core's research tab
 *    (MainTabWindow_Research) draws a line for each of them.
 *  - `hidden` are the Core `hiddenPrerequisites` Elsewhere enforces. Core
 *    lists them after the visible ones in the project's panel
 *    (DrawResearchPrerequisites) and draws no line for them.
 *  - `electricity` stands for Core's Electricity project, which every
 *    Elsewhere colony knows from the start: never missing, never drawn.
 *
 * Declared adaptations, kept from earlier lots (not rule changes here):
 *  - PackagedSurvivalMeal needs NutrientPaste in Core; Elsewhere keeps the
 *    historical project open without it.
 *  - HospitalBed hides SterileMaterials in Core; Elsewhere does not ask for it.
 *  - GunTurrets needs BlowbackOperation as in Core from schema 340 only;
 *    before, the delivered adaptation kept Gunsmithing. */
export type ResearchParent=ResearchProject;
export interface ResearchPrerequisites {
  readonly visible:readonly ResearchParent[];
  readonly hidden:readonly ResearchProject[];
}
const none:ResearchPrerequisites=Object.freeze({visible:Object.freeze([]),hidden:Object.freeze([])});
const of=(visible:readonly ResearchParent[],hidden:readonly ResearchProject[]=[]):ResearchPrerequisites=>Object.freeze({visible:Object.freeze([...visible]),hidden:Object.freeze([...hidden])});

/** Every project, from schema 340 on (see researchPrerequisitesAt). */
export const RESEARCH_PREREQUISITES:Readonly<Record<ResearchProject,ResearchPrerequisites>>=Object.freeze({
  electricity:none,'passive-cooler':none,
  'complex-furniture':none,stonecutting:none,'complex-clothing':none,smithing:none,'drug-production':none,brewing:none,pemmican:none,
  'tree-sowing':none,'recurve-bow':none,devilstrand:none,'carpet-making':none,
  // Core PackagedSurvivalMeal: NutrientPaste (declared adaptation above).
  'packaged-survival-meals':none,
  greatbow:of(['recurve-bow']),
  'long-blades':of(['smithing']),
  'plate-armor':of(['smithing','complex-clothing']),
  'penoxycyline-production':of(['drug-production']),
  batteries:of(['electricity']),'biofuel-refining':of(['electricity']),'nutrient-paste':of(['electricity']),'solar-power':of(['electricity']),
  'air-conditioning':of(['electricity']),autodoors:of(['electricity']),hydroponics:of(['electricity']),firefoam:of(['electricity']),
  ieds:of(['electricity']),'geothermal-power':of(['electricity']),'sterile-materials':of(['electricity']),microelectronics:of(['electricity']),
  'tube-television':of(['electricity'],['complex-furniture']),
  machining:of(['electricity','smithing']),
  prosthetics:of(['machining']),
  gunsmithing:of(['machining']),
  'flak-armor':of(['machining'],['plate-armor']),
  'blowback-operation':of(['gunsmithing']),
  'gas-operation':of(['blowback-operation']),
  'gun-turrets':of(['blowback-operation']),
  // Core HospitalBed also hides SterileMaterials (declared adaptation above).
  'hospital-bed':of(['microelectronics'],['complex-furniture']),
  'deep-drilling':of(['microelectronics']),
  'ground-scanner':of(['deep-drilling']),
  'medicine-production':of(['drug-production','microelectronics']),
  'long-range-mineral-scanner':of(['microelectronics'],['machining']),
  'precision-rifling':of(['gas-operation','microelectronics']),
  'multi-analyzer':of(['microelectronics'],['machining']),
  'vitals-monitor':of(['multi-analyzer','hospital-bed']),
  fabrication:of(['multi-analyzer']),
  'advanced-fabrication':of(['fabrication']),
  cryptosleep:of(['multi-analyzer']),
  'recon-armor':of(['fabrication'],['complex-clothing']),
  'ship-basics':of(['advanced-fabrication']),
  'ship-cryptosleep':of(['ship-basics'],['cryptosleep']),
  'ship-reactor':of(['ship-basics']),
  'ship-engine':of(['ship-basics']),
  'ship-computer':of(['ship-basics']),
  'ship-sensors':of(['ship-basics'],['long-range-mineral-scanner']),
});
/** Before schema 340, Gun turrets kept the delivered Gunsmithing parent. */
const GUN_TURRETS_BEFORE_340:ResearchPrerequisites=of(['gunsmithing']);

/** The prerequisites the simulation enforces for this schema. */
export function researchPrerequisitesAt(project:ResearchProject,schemaVersion:number):ResearchPrerequisites {
  return project==='gun-turrets'&&!isBlowbackSchema340(schemaVersion)?GUN_TURRETS_BEFORE_340:RESEARCH_PREREQUISITES[project];
}
/** Projects to complete first, in the order they are checked: the visible
 * ones in Core order, then the hidden ones; Electricity is always known. */
export function researchParentProjects(project:ResearchProject,schemaVersion:number):ResearchProject[] {
  const p=researchPrerequisitesAt(project,schemaVersion);
  return [...p.visible.filter(parent=>schemaVersion>=382||parent!=='electricity'),...p.hidden];
}

/** French labels of the parents, as the refusal and the research view name
 * them (the node titles of the research view use the same words). */
export const RESEARCH_PARENT_LABELS:Readonly<Record<ResearchParent,string>>=Object.freeze({
  electricity:'Électricité','passive-cooler':'Refroidisseur passif',
  'complex-furniture':'Mobilier complexe',stonecutting:'Taille de pierre','complex-clothing':'Vêtements complexes',smithing:'Forge',
  'drug-production':'Production de drogues',brewing:'Brassage de bière',pemmican:'Pemmican','tree-sowing':'Semis d’arbres',
  'recurve-bow':'Arc recourbé',devilstrand:'Soie du diable','carpet-making':'Fabrication de tapis','packaged-survival-meals':'Repas de survie',
  greatbow:'Grand arc','long-blades':'Lames longues','plate-armor':'Armure de plaques','penoxycyline-production':'Production de pénoxycyline',
  batteries:'Batteries','biofuel-refining':'Raffinage de biocarburant','nutrient-paste':'Pâte nutritive','solar-power':'Panneaux solaires',
  'air-conditioning':'Climatisation',autodoors:'Portes automatiques',hydroponics:'Hydroponie',firefoam:'Mousse anti-incendie',ieds:'EEI',
  'geothermal-power':'Énergie géothermique','sterile-materials':'Matériaux stériles',microelectronics:'Microélectronique',
  'tube-television':'Télévision cathodique',machining:'Usinage',prosthetics:'Prothèses',gunsmithing:'Armurerie','flak-armor':'Armure pare-balles',
  'blowback-operation':'Culasse non calée','gas-operation':'Emprunt de gaz','gun-turrets':'Tourelles automatiques','hospital-bed':'Lit d’hôpital',
  'deep-drilling':'Forage profond','ground-scanner':'Scanner de sol','medicine-production':'Production de médicaments',
  'long-range-mineral-scanner':'Scanner minéral longue portée','precision-rifling':'Rayures de précision','multi-analyzer':'Multi-analyseur',
  'vitals-monitor':'Moniteur vital',fabrication:'Fabrication','advanced-fabrication':'Fabrication avancée',cryptosleep:'Cryptosommeil',
  'recon-armor':'Armure de reconnaissance','ship-basics':'Construction de vaisseau','ship-cryptosleep':'Caisson spatial',
  'ship-reactor':'Réacteur stellaire','ship-engine':'Moteur Johnson–Tanaka','ship-computer':'Ordinateur de vaisseau','ship-sensors':'Ensemble de capteurs',
});
