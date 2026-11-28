/** People and animals: kinds and species, traits, backstories, skills and
 * passions, work types, health (injuries, missing parts, prostheses). */
import {exact,adapt,drop,type DefMapping} from './mapping.ts';
import {TRAITS,type TraitId} from '../../sim/traits.ts';
import {CORE_ANIMAL_IDS_256} from '../../sim/animal-core-data-v256.ts';
import type {AnimalSpeciesId} from '../../sim/animal-species.ts';
import {BACKGROUND_SKILL_IDS,type ChildhoodId,type AdulthoodId,type BackgroundWorkTag,type BackgroundSkillId} from '../../sim/colonist-backgrounds.ts';
import {CORE_BACKSTORY_LIST_370,isCoreBackstoryId370,type CoreBackstory370} from '../../sim/core-backstories-370.ts';
import {CORE_BACKSTORY_EFFECTS,CORE_HUMAN_BODY_PARTS} from './core-tables.ts';
import type {WorkType} from '../../sim/types.ts';
import type {BodyPartId} from '../../sim/body-definition.ts';
import type {InjuryKind} from '../../sim/injury-rules.ts';
import type {ArtificialPartKind} from '../../sim/artificial-parts-types.ts';

// ---- Animals -------------------------------------------------------------------
const species:Record<string,DefMapping<AnimalSpeciesId>>={Hare:exact('hare'),Snowhare:exact('snow-hare'),Deer:exact('deer'),Muffalo:exact('muffalo'),
 Gazelle:exact('gazelle'),Dromedary:exact('dromedary'),Fox_Red:exact('red-fox')};
for(const [core,id] of Object.entries(CORE_ANIMAL_IDS_256))species[core]=exact(id as AnimalSpeciesId);
Object.assign(species,{
 Pig:adapt('wild-boar','Cochon : devient un sanglier (espèce la plus proche d’Elsewhere).'),
 Goat:adapt('ibex','Chèvre : devient un bouquetin (espèce la plus proche d’Elsewhere).'),
 Sheep:adapt('alpaca','Mouton : devient un alpaga (animal à laine le plus proche).'),
 Cow:adapt('yak','Vache : devient un yak (animal laitier le plus proche).'),
 Chicken:adapt('turkey','Poule : devient une dinde (volaille la plus proche).'),
 Goose:adapt('duck','Oie : devient un canard (volaille la plus proche).'),
 Thrumbo:drop('Thrumbo : espèce absente d’Elsewhere.'),Alphabeaver:drop('Castor alpha : espèce absente.'),Mammoth:drop('Mammouth : espèce absente.'),
});
export const ANIMAL_MAP:Readonly<Record<string,DefMapping<AnimalSpeciesId>>>=species;

/** Humanlike kinds other than the player's own: their people are not imported in this step. */
export const NON_COLONIST_NOTE={
 prisoner:'Prisonnier : non importé dans cette étape (statut et histoire de captivité non repris).',
 guest:'Visiteur ou hôte d’une autre faction : non importé.',
 hostile:'Personne d’une faction hostile présente sur la carte : non importée.',
 mechanoid:'Mécanoïde : non importé.',
} as const;

// ---- Traits ---------------------------------------------------------------------
const traits:Record<string,DefMapping<TraitId>>={};
for(const id of Object.keys(TRAITS) as TraitId[]){const t=TRAITS[id] as {def:string;degree:number};traits[`${t.def}:${t.degree}`]=exact(id);}
traits['Industriousness:0']=drop('Trait sans degré connu.');
export const TRAIT_MAP:Readonly<Record<string,DefMapping<TraitId>>>=traits;
export const traitKey=(def:string,degree:number|undefined)=>`${def}:${degree??0}`;

// ---- Skills, passions and work types ---------------------------------------------
export const SKILL_MAP:Readonly<Record<string,BackgroundSkillId>>={Shooting:'shooting',Melee:'melee',Construction:'construction',Mining:'mining',Cooking:'cooking',
 Plants:'plants',Animals:'animals',Crafting:'crafting',Artistic:'artistic',Medicine:'medicine',Social:'social',Intellectual:'intellectual'};
export const PASSION_MAP:Readonly<Record<string,0|1|2>>={None:0,Minor:1,Major:2};
/** Work types in the order the game saves a colonist's priorities. */
export const CORE_WORK_TYPES=['Firefighter','Patient','Doctor','PatientBedRest','BasicWorker','Warden','Handling','Cooking','Hunting','Construction','Growing',
 'Mining','PlantCutting','Smithing','Tailoring','Art','Crafting','Hauling','Cleaning','Research'] as const;
export const WORK_MAP:Readonly<Record<string,WorkType>>={Firefighter:'firefight',Patient:'patient',Doctor:'doctor',PatientBedRest:'bedrest',BasicWorker:'basic',
 Warden:'warden',Handling:'handle',Cooking:'cook',Hunting:'hunt',Construction:'build',Growing:'grow',Mining:'mine',PlantCutting:'gather',Smithing:'smith',
 Tailoring:'tailor',Art:'art',Crafting:'craft',Hauling:'haul',Cleaning:'clean',Research:'research'};

// ---- Backstories ----------------------------------------------------------------
const SKILL_CODES:Readonly<Record<string,BackgroundSkillId>>={Sh:'shooting',Me:'melee',Co:'construction',Mi:'mining',Ck:'cooking',Pl:'plants',An:'animals',Cr:'crafting',Ar:'artistic',Md:'medicine',So:'social',In:'intellectual'};
const TAG_CODES:Readonly<Record<string,readonly BackgroundWorkTag[]>>={d:['manual-dumb'],s:['manual-skilled'],v:['violent'],c:['caring'],o:['social'],m:['manual-dumb','manual-skilled'],
 i:['intellectual'],a:['animals'],r:['artistic'],f:['manual-skilled'],k:['manual-skilled'],x:['firefighting'],l:['manual-dumb'],h:['manual-dumb'],p:['plant-work'],
 n:['manual-skilled'],u:['hunting'],b:['manual-skilled'],t:['violent'],'*':['manual-dumb','manual-skilled','violent','caring','social','intellectual','animals','artistic','firefighting','plant-work','hunting']};
export interface CoreBackstoryEffect {readonly slot:'childhood'|'adulthood';readonly gains:Readonly<Partial<Record<BackgroundSkillId,number>>>;readonly disables:readonly BackgroundWorkTag[]}
export function coreBackstoryEffect(def:string):CoreBackstoryEffect|undefined {
 const raw=Object.hasOwn(CORE_BACKSTORY_EFFECTS,def)?CORE_BACKSTORY_EFFECTS[def]:undefined;if(raw===undefined)return undefined;
 const [slot,gains,tags]=raw.split('|') as [string,string,string];const out:Partial<Record<BackgroundSkillId,number>>={};
 for(const g of gains.split(',').filter(Boolean)){const skill=SKILL_CODES[g.slice(0,2)];if(skill)out[skill]=Number(g.slice(2));}
 const disables=new Set<BackgroundWorkTag>();for(const c of tags)for(const t of TAG_CODES[c]??[])disables.add(t);
 return {slot:slot==='a'?'adulthood':'childhood',gains:out,disables:[...disables]};
}
/** Distance between two mechanical effects: skill gain differences plus a
 * strong weight on disabled work tags (they change what a colonist can do). */
function effectDistance(a:CoreBackstoryEffect,b:{gains:Readonly<Partial<Record<BackgroundSkillId,number>>>;disables:readonly BackgroundWorkTag[]}):number {
 let d=0;for(const s of BACKGROUND_SKILL_IDS)d+=Math.abs((a.gains[s]??0)-(b.gains[s]??0));
 for(const t of new Set([...a.disables,...b.disables]))if(a.disables.includes(t)!==b.disables.includes(t))d+=6;
 return d;
}
export interface BackstoryChoice {childhood:ChildhoodId;adulthood?:AdulthoodId;childhoodDistance:number;adulthoodDistance?:number}
const CORE_CHILDHOODS=CORE_BACKSTORY_LIST_370.filter(story=>story.slot==='childhood');
const CORE_ADULTHOODS=CORE_BACKSTORY_LIST_370.filter(story=>story.slot==='adulthood');
/** A save's backstory that is one of Core's shuffled ones in that slot. */
function shuffled(def:string|undefined,slot:'childhood'|'adulthood'):CoreBackstory370|undefined {
 if(!isCoreBackstoryId370(def))return undefined;
 const story=CORE_BACKSTORY_LIST_370.find(entry=>entry.id===def);return story?.slot===slot?story:undefined;
}
/** Schema 370: Elsewhere holds Core's shuffled backstories under their own
 * defName, so a shuffled backstory of the save is kept as it is (distance 0).
 * A solid backstory (a named character's, not in the catalogue) becomes the
 * shuffled one of the same slot with the closest mechanical effects. A chosen
 * adulthood never requires a work tag that the childhood disables; a pair
 * kept from the save is never changed. Both sides are read through the same
 * table of the game's effects. Unknown backstories count as neutral. */
export function closestBackgrounds(childDef:string|undefined,adultDef:string|undefined,allowAdult:boolean):BackstoryChoice {
 const neutral:CoreBackstoryEffect={slot:'childhood',gains:{},disables:[]};
 const child=(childDef&&coreBackstoryEffect(childDef))||neutral,adult=adultDef?coreBackstoryEffect(adultDef)??{...neutral,slot:'adulthood' as const}:undefined;
 const keptChild=shuffled(childDef,'childhood'),keptAdult=allowAdult?shuffled(adultDef,'adulthood'):undefined;
 const childCandidates=keptChild?[keptChild]:CORE_CHILDHOODS;
 let best:BackstoryChoice|undefined,bestScore=Infinity;
 for(const c of childCandidates){
  const cd=keptChild?0:effectDistance(child,coreBackstoryEffect(c.id)??c);
  // Do not trade away an actual work entitlement for a closer birth-skill
  // bonus: saved skill levels have their own authority. In particular a
  // named Core backstory with no disabled work must not gain one via fallback.
  const childPenalty=keptChild?0:1000*c.disables.filter(tag=>!child.disables.includes(tag)).length;
  if(!adult||!allowAdult){if(cd+childPenalty<bestScore){bestScore=cd+childPenalty;best={childhood:c.id as ChildhoodId,childhoodDistance:cd};}continue;}
  for(const a of keptAdult?[keptAdult]:CORE_ADULTHOODS){
   if(!keptAdult&&a.requires.some(t=>c.disables.includes(t)))continue;
   const ad=keptAdult?0:effectDistance(adult,coreBackstoryEffect(a.id)??a),score=cd+ad+childPenalty+(keptAdult?0:1000*a.disables.filter(tag=>!adult.disables.includes(tag)).length);
   if(score<bestScore){bestScore=score;best={childhood:c.id as ChildhoodId,adulthood:a.id as AdulthoodId,childhoodDistance:cd,adulthoodDistance:ad};}
  }
 }
 return best!;
}
/** True when the save's backstory is kept under its own defName. */
export const keptBackstory=(def:string|undefined,chosen:string|undefined):boolean=>def!==undefined&&def===chosen;
export const BACKSTORY_NOTE='Histoires : une histoire du jeu de base est reprise telle quelle (même identifiant, titre et récit d’Elsewhere en français) ; l’histoire d’un personnage nommé devient l’histoire du jeu de base aux effets les plus proches (compétences gagnées, travaux refusés) ; aucun titre ni texte du jeu n’est repris.';

// ---- Health ---------------------------------------------------------------------
/** Human body parts in save order → Elsewhere part. */
export const HUMAN_PART_MAP:readonly (BodyPartId|undefined)[]=CORE_HUMAN_BODY_PARTS.map(entry=>{
 const [def,side,digit]=entry.split('|') as [string,string,string];
 const base=digit||{Torso:'torso',Ribcage:'ribcage',Sternum:'sternum',Pelvis:'pelvis',Spine:'spine',Stomach:'stomach',Heart:'heart',Lung:'lung',Kidney:'kidney',
  Liver:'liver',Neck:'neck',Head:'head',Skull:'skull',Brain:'brain',Eye:'eye',Ear:'ear',Nose:'nose',Jaw:'jaw',Tongue:'tongue',Shoulder:'shoulder',Clavicle:'clavicle',
  Arm:'arm',Humerus:'humerus',Radius:'radius',Hand:'hand',Waist:'waist',Leg:'leg',Femur:'femur',Tibia:'tibia',Foot:'foot'}[def];
 return base?(side?`${side}-${base}`:base) as BodyPartId:undefined;
});
export const INJURY_MAP:Readonly<Record<string,DefMapping<InjuryKind>>>={
 Cut:exact('cut'),SurgicalCut:adapt('cut','Incision chirurgicale : devient une coupure.'),Scratch:adapt('cut','Griffure : devient une coupure (Elsewhere n’a pas de griffure).'),
 Bite:exact('bite'),Stab:exact('stab'),Gunshot:exact('gunshot'),Crush:exact('crush'),Crack:exact('crack'),Bruise:exact('bruise'),Burn:exact('burn'),
 Shredded:exact('shredded'),Frostbite:drop('Gelure : blessure réservée à d’autres personnes dans Elsewhere.'),
 ChemicalBurn:adapt('burn','Brûlure chimique : devient une brûlure.'),ElectricalBurn:adapt('burn','Brûlure électrique : devient une brûlure.'),
 Blunt:adapt('bruise','Contusion : devient un bleu.'),BeamWound:drop('Blessure de faisceau : absente.'),
};
export const ADDED_PART_MAP:Readonly<Record<string,DefMapping<ArtificialPartKind>>>={
 PegLeg:exact('peg-leg'),WoodenFoot:exact('wooden-foot'),WoodenHand:exact('wooden-hand'),SimpleProstheticLeg:exact('prosthetic-leg'),SimpleProstheticArm:exact('prosthetic-arm'),
 BionicLeg:adapt('prosthetic-leg','Jambe bionique : devient une prothèse simple.'),BionicArm:adapt('prosthetic-arm','Bras bionique : devient une prothèse simple.'),
 ArchotechLeg:adapt('prosthetic-leg','Jambe archotech : devient une prothèse simple.'),ArchotechArm:adapt('prosthetic-arm','Bras archotech : devient une prothèse simple.'),
 BionicEye:drop('Œil bionique : absent.'),BionicEar:drop('Oreille bionique : absente.'),BionicSpine:drop('Colonne bionique : absente.'),
 BionicHeart:drop('Cœur bionique : absent.'),BionicStomach:drop('Estomac bionique : absent.'),CochlearImplant:drop('Implant cochléaire : absent.'),
 DenturesSimple:drop('Dentier : absent.'),PowerClaw:drop('Griffe : absente.'),Joywire:drop('Fil de joie : absent.'),Painstopper:drop('Inhibiteur de douleur : absent.'),
};
/** Other health conditions (diseases, addictions, tolerances, pregnancy…). */
export const OTHER_HEDIFF_NOTE='État de santé sans équivalent direct dans cette étape (maladie, dépendance, tolérance, grossesse, implant…) : non importé.';
