import {devModeEnabled,requestDevAdvance} from './dev-session.ts';
import {isColonist} from './affiliation.ts';
import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {addGroundMaterial,refreshStock} from './materials.ts';
import {removeIdentity} from './collection-remove.ts';
import {BACKGROUND_SKILL_IDS,backgroundSkillRefusal,type BackgroundSkillId} from './colonist-backgrounds.ts';
import type {SkillRecord} from './skills.ts';
import {animalNutritionMax} from './animal-life.ts';
import {medicalModel} from './body-model.ts';
import type {BodyPartId} from './body-definition.ts';
import {createMedicalRecord,addResolvedInjury,remainingPartHealth,partMissing} from './injury-state.ts';
import {reconcilePawnHealth,healthRandom} from './health.ts';
import {reconcileAnimalHealth} from './wildlife-health.ts';
import {animalExecutionPart256} from './animal-execution-v256.ts';
import {planAnimalDeathExplosion256} from './animal-death-explosion-v256.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {finishMentalBreak} from './mental-state.ts';
import {startSadWander,startFoodBinge,startTantrum,startBerserk,startMurderousRage,startAlcoholBinge265,startFireStartingSpree368} from './mental-break.ts';
import {projectProgress,researchCost} from './research.ts';
import {releaseAssignments} from './work-release.ts';
import {otherCampaignMap} from './secondary-site-context.ts';
import {WEATHER_KINDS,type WeatherKind} from './weather-definitions.ts';
import {forceWeather} from './weather.ts';
import {startDevRaid} from './raids.ts';
import {arriveTraderCaravan332} from './visitors.ts';
import {enableArrivals} from './arrivals.ts';
import {resolveSelectedFarmAnimals305,resolveSelectedSelfTame305,resolveSelectedAurora305} from './misc-incidents-305.ts';
import {resolveSelectedResourcePod305} from './resource-pods-305.ts';
import {INITIAL_ANIMAL_FACTS_256} from './initial-animal-data-256.ts';
import {constructFreshInitialWildAnimal256} from './initial-animal-constructor-256.ts';
import {stagedCampArrivalRandom256} from './camp-center-entry-256.ts';
import {adoptAsColonyAnimal} from './animal-handling.ts';
import {isConstruction} from './construction-rules.ts';
import {TICKS_PER_DAY,type Cell,type Pawn,type World} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';

/**
 * Developer mode: « magic » actions to test mechanics (schema-free).
 *
 * Core's organisation, copied (not its texts): Prefs.DevMode shows a toolbar
 * (DebugWindowsOpener) with the debug actions menu (Dialog_Debug, tab Actions:
 * actions grouped by category, a filter box), the dev palette and the god-mode
 * switch (DebugSettings.godMode: instant, free construction). Each Core action
 * is a [DebugAction(category, name, actionType)] where the type is Action (runs
 * at once), ToolMap (runs on the clicked cell) or ToolMapForPawns (runs on the
 * pawns of the clicked cell). Elsewhere keeps the three kinds as `target`:
 * 'none', 'cell' (the map tool: the UI arms the action, the next map click
 * sends it with that cell) and 'pawn'|'animal'|'creature' (the current
 * selection).
 *
 * Every action is a bridge command {type:'dev-action'}: the Worker applies it at
 * a tick boundary and acknowledges it, exactly like an order. Nothing here is
 * written by the UI. Each action calls the simulation's own functions (needs,
 * health, mental breaks, incidents, spawning) so the cascade of consequences is
 * the real one. The gate is the Worker's session flag (dev-session.ts), never
 * the save: with the mode off every dev command is refused.
 *
 * To add an action: append one entry to DEV_ACTIONS below (id, group, label,
 * target, optional params, apply). The UI lists the registry as it is.
 */
export type DevTarget='none'|'cell'|'pawn'|'animal'|'creature';
export interface DevParam {readonly key:string;readonly label:string;readonly options:readonly {readonly value:string;readonly label:string}[];readonly default:string}
export type DevOutcome={ok:true;message:string}|{ok:false;reason:string};
export interface DevContext {
  readonly world:World;
  readonly args:Readonly<Record<string,string>>;
  readonly pawn?:Pawn;
  readonly animal?:WildAnimal;
  readonly cell?:Cell;
}
export interface DevAction {
  readonly id:string;
  readonly group:string;
  readonly label:string;
  readonly hint:string;
  readonly target:DevTarget;
  readonly params?:readonly DevParam[];
  readonly apply:(ctx:DevContext)=>DevOutcome;
}
export interface DevCommand {type:'dev-action';action:string;targetId?:number;cell?:Cell;args?:Record<string,string>}

const ok=(message:string):DevOutcome=>({ok:true,message});
const no=(reason:string):DevOutcome=>({ok:false,reason});
const label=(c:DevContext):string=>c.pawn?.name??`${c.animal?.species??'animal'} ${c.animal?.id??''}`.trim();
const levelParam=(key='level',text='Niveau'):DevParam=>({key,label:text,default:'100',options:['0','25','50','75','100'].map(value=>({value,label:`${value} %`}))});
const percent=(c:DevContext,key='level'):number=>Number(c.args[key]??'100')/100;
const SKILL_LABELS:Readonly<Record<BackgroundSkillId,string>>={shooting:'Tir',melee:'Mêlée',construction:'Construction',mining:'Minage',cooking:'Cuisine',plants:'Plantes',animals:'Dressage',crafting:'Artisanat',artistic:'Art',medicine:'Médecine',social:'Social',intellectual:'Intelligence'};
const skillParam:DevParam={key:'skill',label:'Compétence',default:'construction',options:BACKGROUND_SKILL_IDS.map(value=>({value,label:SKILL_LABELS[value]}))};
const pushEvent=(w:World,text:string):void=>{w.events.push({tick:w.tick,type:'command',message:`Mode développeur : ${text}`});if(w.events.length>80)w.events.splice(0,w.events.length-80);};

/** Items a developer can drop: plain ground stacks. Books, corpses, trees and
 * AI cores each need an original owner or a generated identity, and eggs need a
 * fertilisation context and unfinished items a work record, so they are left out rather than faked. */
const UNSPAWNABLE_KINDS:ReadonlySet<string>=new Set(['book','plant','corpse','mech-corpse','ai-core']);
export const DEV_SPAWNABLE_ITEMS:readonly ItemId[]=(Object.keys(ITEM_DEFINITIONS) as ItemId[]).filter(id=>!UNSPAWNABLE_KINDS.has(ITEM_DEFINITIONS[id].kind)&&id!=='novel'&&!/egg/.test(id)&&!id.startsWith('unfinished-')).sort((a,b)=>ITEM_DEFINITIONS[a].label.localeCompare(ITEM_DEFINITIONS[b].label,'fr'));
const DEV_ANIMALS=Object.values(INITIAL_ANIMAL_FACTS_256).filter((f,i,all)=>all.findIndex(g=>g.species===f.species)===i).sort((a,b)=>a.species.localeCompare(b.species));

function setNeed(c:DevContext,human:(p:Pawn,v:number)=>string|undefined,animal?:(a:WildAnimal,v:number)=>string|undefined):DevOutcome {
  const v=percent(c);
  if(c.pawn){const err=human(c.pawn,v);return err?no(err):ok(`${c.pawn.name} : ${Math.round(v*100)} %.`);}
  if(c.animal&&animal){const err=animal(c.animal,v);return err?no(err):ok(`${label(c)} : ${Math.round(v*100)} %.`);}
  return no('Ce besoin n’existe que pour les colons.');
}
const needsRecreation=(p:Pawn):boolean=>!p.prisoner&&p.faction!=='outlaws';

function healRecord(record:NonNullable<Pawn['health']>):void {
  record.injuries=[];record.bloodLoss=0;
  delete record.infections;delete record.heatstroke;delete record.hypothermia;delete record.malnutrition;delete record.flu;delete record.immuneDiseases;
  delete record.foodPoisoning;delete record.parasites306;delete record.mechanites307;delete record.penoxycyline337;delete record.toxicBuildup;
}
function healAll(c:DevContext):DevOutcome {
  const {world}=c;
  if(c.pawn){
    const p=c.pawn;if(!p.health)return ok(`${p.name} n’a aucune blessure ni maladie.`);
    if(p.health.death||p.state==='dead')return no(`${p.name} est mort : le mode développeur ne ressuscite pas.`);
    healRecord(p.health);reconcilePawnHealth(world,p);
    return ok(`${p.name} est entièrement soigné (blessures, sang, maladies ; les membres manquants restent manquants).`);
  }
  const a=c.animal!;
  if(a.state==='dead'||a.health?.death)return no(`${label(c)} est mort : le mode développeur ne ressuscite pas.`);
  if(!a.health)return ok(`${label(c)} n’a aucune blessure ni maladie.`);
  healRecord(a.health);reconcileAnimalHealth(world,a);
  return ok(`${label(c)} est entièrement soigné.`);
}
/** Down: every leg is bruised to 1 HP (no moving capacity left, nothing
 * destroyed), as a hard fall would; the ordinary reconciliation then downs. */
function downCreature(c:DevContext):DevOutcome {
  const {world}=c;
  const record=c.pawn?(c.pawn.health??=createMedicalRecord(world.tick)):(c.animal!.health??=createAnimalMedicalRecord256(world,c.animal!));
  if(c.pawn?.state==='dead'||c.animal?.state==='dead'||record.death)return no(`${label(c)} est déjà mort.`);
  const stateOf=():string=>c.pawn?c.pawn.state:c.animal!.state;
  if(stateOf()==='downed')return no(`${label(c)} est déjà à terre.`);
  const model=medicalModel(record).byId as Readonly<Record<string,{parent:string|null;groups:readonly string[];nativeTags?:readonly string[]}>>;
  const limb=(part:string):boolean=>/leg$/.test(part)||model[part]!.groups.includes('legs')||!!model[part]!.nativeTags?.includes('MovingLimbCore');
  const limbs=(Object.keys(model) as BodyPartId[]).filter(part=>limb(part)&&!partMissing(record,part));
  // Only the top of each limb (its bones, foot and toes are inside it).
  const legs=limbs.filter(part=>!model[part]!.parent||!limbs.includes(model[part]!.parent as BodyPartId));
  let hurt=0;
  for(const part of legs){
    const damage=remainingPartHealth(record,part)-1000;
    if(damage>0){addResolvedInjury(record,part,'bruise',damage,()=>healthRandom(world));hurt++;}
  }
  if(!hurt)return no(`${label(c)} n’a plus de jambe valide à blesser.`);
  if(c.pawn)reconcilePawnHealth(world,c.pawn,undefined,true);else reconcileAnimalHealth(world,c.animal!);
  return stateOf()==='downed'?ok(`${label(c)} est à terre.`):no(`${label(c)} a les jambes meurtries mais tient encore debout.`);
}
/** Kill: the neck cut of an execution (the validated lethal path), then the
 * ordinary death reconciliation (corpse, thoughts, filth) runs. */
function killCreature(c:DevContext):DevOutcome {
  const {world}=c;
  if(c.pawn){
    const p=c.pawn;if(p.state==='dead'||p.health?.death)return no(`${p.name} est déjà mort.`);
    const record=p.health??=createMedicalRecord(world.tick);
    if(!partMissing(record,'neck')){
      const damage=Math.min(1000,Math.max(0,Math.floor(remainingPartHealth(record,'neck')/1000-1)*1000));
      if(damage>0)addResolvedInjury(record,'neck','execution-cut',damage,()=>healthRandom(world));
    }
    record.death={tick:medicalCivilTick271(record),cause:'execution'};
    reconcilePawnHealth(world,p,undefined,true);
    return ok(`${p.name} est mort.`);
  }
  const a=c.animal!;if(a.state==='dead'||a.health?.death)return no(`${label(c)} est déjà mort.`);
  const record=a.health??createAnimalMedicalRecord256(world,a);
  const random={rng:world.rng},part=animalExecutionPart256(record,()=>healthRandom(random));
  const damage=Math.min(1000,Math.max(0,Math.floor(remainingPartHealth(record,part))-1000));
  if(damage>0)addResolvedInjury(record,part,'execution-cut',damage,()=>healthRandom(random));
  record.death={tick:world.tick,cause:'execution'};
  planAnimalDeathExplosion256(world,a,record).commit();
  a.health=record;world.rng=random.rng;
  reconcileAnimalHealth(world,a);
  return ok(`${label(c)} est mort.`);
}

const MENTAL_STARTS:Readonly<Record<string,{label:string;start:(w:World,p:Pawn)=>boolean}>>={
  'sad-wander':{label:'Errance triste',start:startSadWander},
  'food-binge':{label:'Frénésie alimentaire',start:startFoodBinge},
  tantrum:{label:'Crise de colère',start:startTantrum},
  berserk:{label:'Folie furieuse',start:startBerserk},
  'murderous-rage':{label:'Rage meurtrière',start:startMurderousRage},
  'drug-binge':{label:'Excès d’alcool',start:(w,p)=>startAlcoholBinge265(w,p)},
  'fire-starting-spree':{label:'Frénésie incendiaire (pyromanes)',start:startFireStartingSpree368},
};

function spawnCellFree(w:World,cell:Cell):string|undefined {
  if(!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=w.width||cell.z>=w.height)return 'Cette case est hors de la carte.';
  const tile=w.tiles[cell.z*w.width+cell.x];
  if(!tile||tile.terrain==='water'||tile.terrain==='rock')return 'Cette case est de l’eau ou de la roche : rien ne peut y être posé.';
  return undefined;
}
const spawnSeed=(w:World):number=>{let n=(w.rng^Math.imul(w.tick+1,2654435761))>>>0||1;n^=n<<13;n^=n>>>17;n^=n<<5;w.rng=n>>>0||1;return w.rng;};

function spawnItem(c:DevContext):DevOutcome {
  const {world}=c,cell=c.cell!,item=c.args.item as ItemId;
  if(!DEV_SPAWNABLE_ITEMS.includes(item))return no('Cet objet ne peut pas être posé par le mode développeur.');
  const blocked=spawnCellFree(world,cell);if(blocked)return no(blocked);
  const def=ITEM_DEFINITIONS[item],raw=c.args.quantity==='stack'?def.stackLimit:Number(c.args.quantity??'1');
  const quantity=Math.max(1,Math.min(def.stackLimit*4,Number.isFinite(raw)?Math.floor(raw):1));
  try{addGroundMaterial(world,def.kind,quantity,cell,item);}
  catch(e){return no(`Impossible de poser ${def.label} ici : ${e instanceof Error?e.message:'refusé'}.`);}
  return ok(`${quantity} × ${def.label} posé(s) en ${cell.x}, ${cell.z}.`);
}
function spawnAnimal(c:DevContext):DevOutcome {
  const {world}=c,cell=c.cell!,wildlife=world.wildlife;
  if(!wildlife)return no('Cette partie n’a pas de faune activée.');
  const fact=DEV_ANIMALS.find(f=>f.species===c.args.species);if(!fact)return no('Espèce inconnue.');
  const blocked=spawnCellFree(world,cell);if(blocked)return no(blocked);
  if(wildlife.animals.some(a=>a.x===cell.x&&a.z===cell.z&&a.state!=='dead'))return no('Un animal occupe déjà cette case.');
  const stream=stagedCampArrivalRandom256(spawnSeed(world)),f=Math.fround;
  const random={value:stream.value,integer:stream.integer,float:(min:number,max:number)=>max<=min?f(min):f(f(stream.value()*f(f(max)-f(min)))+f(min))};
  const made=constructFreshInitialWildAnimal256({fact,id:world.nextId,cell,tick:world.tick,random});
  if(made.status==='blocked')return no(`Cette espèce ne peut pas encore être créée : ${made.reason}.`);
  world.nextId++;wildlife.animals.push(made.animal);
  if(c.args.tame==='tame')adoptAsColonyAnimal(world,made.animal);
  return ok(`${fact.species} créé en ${cell.x}, ${cell.z}${c.args.tame==='tame'?' (apprivoisé)':''}.`);
}
function destroyItems(c:DevContext):DevOutcome {
  const {world}=c,cell=c.cell!;
  const piles=world.piles.filter(p=>p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z);
  if(!piles.length)return no('Aucun objet au sol sur cette case. (Les bâtiments et les plantes se retirent par la déconstruction ou la coupe.)');
  const special=piles.filter(p=>UNSPAWNABLE_KINDS.has(p.kind)||p.item==='novel'||p.plantPack!==undefined);
  const plain=piles.filter(p=>!special.includes(p));
  if(!plain.length)return no('Les objets de cette case (cadavres, livres, arbres emballés…) ont un propriétaire propre : retirez-les par leur voie ordinaire.');
  for(const p of plain)removeIdentity(world.piles,p);
  refreshStock(world);
  return ok(`${plain.length} pile(s) d’objets détruite(s) en ${cell.x}, ${cell.z}.`);
}
/** Finishes the construction at the cell through the engine's own completion
 * (devCompleteJob, set by the engine to avoid an import cycle). */
export const devHooks:{completeJob?:(w:World,cell:Cell)=>DevOutcome}={};
function finishConstruction(c:DevContext):DevOutcome {
  if(!devHooks.completeJob)return no('La fin de construction n’est pas disponible ici.');
  return devHooks.completeJob(c.world,c.cell!);
}
/** Same bookkeeping as the completion branch of processResearch. */
export function finishCurrentResearch(world:World):DevOutcome {
  const state=world.research,project=state?.project;
  if(!state||!project)return no('Aucune recherche en cours : choisissez d’abord un projet.');
  const progress=projectProgress(state,project);
  progress.points=researchCost(project);state.project=null;progress.completedAt=world.tick;
  for(const local of [world,otherCampaignMap(world)])if(local)for(const p of local.pawns)if(p.research)releaseAssignments(local,p);
  pushEvent(world,'recherche terminée à l’instant.');
  return ok('La recherche en cours est terminée.');
}

const ADVANCES=[['hour','Une heure',TICKS_PER_DAY/24],['six-hours','Six heures',TICKS_PER_DAY/4],['day','Un jour',TICKS_PER_DAY]] as const;
const INCIDENT_POINTS=['100','300','600','1000','2000'];

export const DEV_ACTIONS:readonly DevAction[]=[
  // ---- Besoins (Core: Need.CurLevelPercentage, set from the pawn's dev menu) ----
  {id:'need-food',group:'Besoins',label:'Faim (nourriture)',hint:'Fixe la jauge de nourriture : 0 % affame, 100 % rassasié.',target:'creature',params:[levelParam()],
    apply:c=>setNeed(c,(p,v)=>{if(p.state==='dead')return `${p.name} est mort.`;p.hunger=v*100;},(a,v)=>{if(a.state==='dead')return `${label(c)} est mort.`;a.food=v*animalNutritionMax(a);})},
  {id:'need-rest',group:'Besoins',label:'Repos (sommeil)',hint:'Fixe la jauge de repos : 0 % épuisé (il ira dormir), 100 % reposé.',target:'creature',params:[levelParam()],
    apply:c=>setNeed(c,(p,v)=>{if(p.state==='dead')return `${p.name} est mort.`;p.rest=v*100;if(v>0)p.restZeroTicks=0;if(v>0)p.collapsePending=false;},(a,v)=>{if(a.state==='dead')return `${label(c)} est mort.`;a.rest=v;})},
  {id:'need-recreation',group:'Besoins',label:'Loisirs',hint:'Fixe la jauge de loisirs d’un colon.',target:'pawn',params:[levelParam()],
    apply:c=>setNeed(c,(p,v)=>{if(!needsRecreation(p))return `${p.name} n’a pas de besoin de loisirs.`;p.recreation.level=v*100;})},
  {id:'need-comfort',group:'Besoins',label:'Confort',hint:'Fixe la jauge de confort d’un colon.',target:'pawn',params:[levelParam()],
    apply:c=>setNeed(c,(p,v)=>{p.comfort=v*100;})},
  {id:'need-beauty',group:'Besoins',label:'Beauté',hint:'Fixe la jauge de beauté d’un colon.',target:'pawn',params:[levelParam()],
    apply:c=>setNeed(c,(p,v)=>{p.beauty=v*100;})},
  {id:'need-outdoors',group:'Besoins',label:'Plein air',hint:'Fixe la jauge de plein air (parties au schéma 359 ou plus).',target:'pawn',params:[levelParam()],
    apply:c=>setNeed(c,(p,v)=>{if(c.world.schemaVersion<359)return 'Ce besoin n’existe pas dans cette partie.';if(!isColonist(p)&&!p.prisoner)return `${p.name} n’a pas de besoin de plein air.`;p.outdoors359=Math.fround(v);})},
  {id:'need-room-size',group:'Besoins',label:'Espace',hint:'Fixe la jauge d’espace d’un colon (parties au schéma 345 ou plus).',target:'pawn',params:[levelParam()],
    apply:c=>setNeed(c,(p,v)=>{if(c.world.schemaVersion<345)return 'Ce besoin n’existe pas dans cette partie.';if(!isColonist(p)&&!p.prisoner)return `${p.name} n’a pas de besoin d’espace.`;p.roomSize345={level:Math.fround(v),indoors:p.roomSize345?.indoors??false};})},
  {id:'need-all',group:'Besoins',label:'Tous les besoins',hint:'Fixe d’un coup nourriture, repos, loisirs, confort et beauté.',target:'pawn',params:[levelParam()],
    apply:c=>setNeed(c,(p,v)=>{if(p.state==='dead')return `${p.name} est mort.`;p.hunger=v*100;p.rest=v*100;p.comfort=v*100;p.beauty=v*100;if(needsRecreation(p))p.recreation.level=v*100;if(v>0){p.restZeroTicks=0;p.collapsePending=false;}})},
  {id:'mood-set',group:'Besoins',label:'Humeur',hint:'Fixe l’humeur actuelle. Elle redérive ensuite vers la valeur que donnent les pensées, comme le jeu de base.',target:'pawn',params:[levelParam()],
    apply:c=>setNeed(c,(p,v)=>{if(p.state==='dead')return `${p.name} est mort.`;p.mood=v*100;})},
  // ---- Santé ----
  {id:'heal-all',group:'Santé',label:'Tout soigner',hint:'Efface blessures, saignement et maladies. Ne ressuscite pas et ne repose pas les membres manquants.',target:'creature',apply:healAll},
  {id:'down',group:'Santé',label:'Mettre à terre',hint:'Un grand coup au torse : choc douloureux, sans rien détruire.',target:'creature',apply:downCreature},
  {id:'kill',group:'Santé',label:'Tuer',hint:'Mort par la voie ordinaire : cadavre, pensées de deuil, sang.',target:'creature',apply:killCreature},
  {id:'mental-add',group:'Santé',label:'Déclencher un état mental',hint:'Lance la crise par la fonction du jeu ; refusée si le colon ne peut pas la subir (endormi, à terre, déjà en crise, trait requis).',target:'pawn',
    params:[{key:'kind',label:'État',default:'tantrum',options:Object.entries(MENTAL_STARTS).map(([value,m])=>({value,label:m.label}))}],
    apply:c=>{const p=c.pawn!;if(p.mental?.crisis)return no(`${p.name} est déjà en crise.`);const start=MENTAL_STARTS[c.args.kind??'tantrum'];if(!start)return no('État mental inconnu.');
      return start.start(c.world,p)?ok(`${p.name} : ${start.label.toLowerCase()}.`):no(`${p.name} ne peut pas subir cet état maintenant (endormi, à terre, trait requis, tutoriel…).`);}},
  {id:'mental-clear',group:'Santé',label:'Retirer l’état mental',hint:'Termine la crise en cours, sans catharsis.',target:'pawn',
    apply:c=>{const p=c.pawn!;if(!p.mental?.crisis)return no(`${p.name} n’est pas en crise.`);finishMentalBreak(c.world,p,false);return ok(`${p.name} retrouve ses esprits.`);}},
  // ---- Compétences ----
  {id:'skill-set',group:'Compétences',label:'Niveau de compétence',hint:'Fixe le niveau (0 à 20) d’une compétence, sans toucher à la passion.',target:'pawn',
    params:[skillParam,{key:'level',label:'Niveau',default:'10',options:['0','4','8','10','12','16','20'].map(value=>({value,label:value}))}],
    apply:c=>{const p=c.pawn!,id=c.args.skill as BackgroundSkillId;if(!BACKGROUND_SKILL_IDS.includes(id))return no('Compétence inconnue.');
      const refusal=backgroundSkillRefusal(p,id);if(refusal)return no(`${p.name} ne peut pas pratiquer cette compétence (${refusal}).`);
      const skill=(p.skills as unknown as Record<string,SkillRecord|undefined>)[id]??((p.skills as unknown as Record<string,SkillRecord>)[id]={level:0,xp:0,dailyXp:0,passion:0});
      skill.level=Number(c.args.level??'10');skill.xp=0;return ok(`${p.name} : ${SKILL_LABELS[id]} niveau ${skill.level}.`);}},
  {id:'passion-set',group:'Compétences',label:'Passion',hint:'Fixe la passion d’une compétence (aucune, un feu, deux feux).',target:'pawn',
    params:[skillParam,{key:'passion',label:'Passion',default:'2',options:[{value:'0',label:'Aucune'},{value:'1',label:'Intérêt'},{value:'2',label:'Passion'}]}],
    apply:c=>{const p=c.pawn!,id=c.args.skill as BackgroundSkillId;if(!BACKGROUND_SKILL_IDS.includes(id))return no('Compétence inconnue.');
      const refusal=backgroundSkillRefusal(p,id);if(refusal)return no(`${p.name} ne peut pas pratiquer cette compétence (${refusal}).`);
      const skill=(p.skills as unknown as Record<string,SkillRecord|undefined>)[id]??((p.skills as unknown as Record<string,SkillRecord>)[id]={level:0,xp:0,dailyXp:0,passion:0});
      skill.passion=Number(c.args.passion??'2') as 0|1|2;return ok(`${p.name} : passion ${skill.passion} pour ${SKILL_LABELS[id]}.`);}},
  // ---- Carte (outils : l'interface arme l'action, le clic suivant sur la carte l'envoie) ----
  {id:'spawn-item',group:'Carte',label:'Poser un objet',hint:'Pose une quantité d’un objet à la case cliquée.',target:'cell',
    params:[{key:'item',label:'Objet',default:'steel',options:DEV_SPAWNABLE_ITEMS.map(value=>({value,label:ITEM_DEFINITIONS[value].label}))},
      {key:'quantity',label:'Quantité',default:'50',options:['1','10','50','100','stack'].map(value=>({value,label:value==='stack'?'Une pile pleine':value}))}],apply:spawnItem},
  {id:'spawn-animal',group:'Carte',label:'Créer un animal',hint:'Crée un animal adulte tiré comme à la génération de la carte, à la case cliquée.',target:'cell',
    params:[{key:'species',label:'Espèce',default:DEV_ANIMALS.find(f=>f.species==='muffalo')?.species??DEV_ANIMALS[0]!.species,options:DEV_ANIMALS.map(f=>({value:f.species,label:f.species}))},
      {key:'tame',label:'État',default:'wild',options:[{value:'wild',label:'Sauvage'},{value:'tame',label:'Apprivoisé'}]}],apply:spawnAnimal},
  {id:'destroy-items',group:'Carte',label:'Détruire les objets au sol',hint:'Retire les piles d’objets ordinaires de la case cliquée.',target:'cell',apply:destroyItems},
  {id:'finish-construction',group:'Carte',label:'Terminer la construction',hint:'Achève le chantier de la case cliquée si ses matériaux sont livrés.',target:'cell',apply:finishConstruction},
  {id:'finish-research',group:'Carte',label:'Terminer la recherche en cours',hint:'Achève immédiatement le projet de recherche choisi.',target:'none',apply:c=>finishCurrentResearch(c.world)},
  // ---- Temps et météo ----
  {id:'time-advance',group:'Temps',label:'Avancer le temps',hint:'Fait jouer la simulation en accéléré, d’une traite (plusieurs secondes sur une grande colonie).',target:'none',
    params:[{key:'span',label:'Durée',default:'hour',options:ADVANCES.map(([value,text])=>({value,label:text}))}],
    apply:c=>{const span=ADVANCES.find(([value])=>value===c.args.span);if(!span)return no('Durée inconnue.');requestDevAdvance(span[2]);return ok(`${span[1].toLowerCase()} de simulation à jouer.`);}},
  {id:'weather-set',group:'Temps',label:'Changer la météo',hint:'Passe à la météo choisie (fondu de 4000 ticks de jeu de base, durée tirée comme d’ordinaire).',target:'none',
    params:[{key:'kind',label:'Météo',default:'rain',options:WEATHER_KINDS.map(value=>({value,label:{clear:'Dégagé',fog:'Brouillard',rain:'Pluie','dry-thunderstorm':'Orage sec','rainy-thunderstorm':'Orage pluvieux','foggy-rain':'Pluie et brouillard','snow-gentle':'Neige légère','snow-hard':'Forte neige'}[value]}))}],
    apply:c=>{const kind=c.args.kind as WeatherKind;if(!WEATHER_KINDS.includes(kind))return no('Météo inconnue.');if(c.world.schemaVersion<87)return no('Cette partie n’a pas de météo.');forceWeather(c.world,kind);pushEvent(c.world,`météo forcée : ${kind}.`);return ok('La météo change.');}},
  // ---- Incidents (storyteller): the real resolvers, without waiting for the calendar ----
  {id:'incident-raid',group:'Incidents',label:'Raid',hint:'Un raid sur la colonie avec les points choisis (faction, composition et entrée tirées comme un vrai raid).',target:'none',
    params:[{key:'points',label:'Points de menace',default:'300',options:INCIDENT_POINTS.map(value=>({value,label:value}))}],
    apply:c=>{if(c.world.raids?.profile!=='cassandra-raids-v1')return no('Cette partie n’a pas le calendrier de raids du narrateur : il ne tire pas de raid à la demande.');return startDevRaid(c.world,Number(c.args.points??'300'))?ok('Des raiders arrivent.'):no('Le raid n’a pas pu commencer (pas de colon libre, pas de place d’entrée, ou aucune faction hostile disponible).');}},
  {id:'incident-wanderer',group:'Incidents',label:'Voyageur qui demande à rejoindre',hint:'Rend la prochaine demande d’accueil immédiate (elle s’ouvre au tick suivant).',target:'none',
    apply:c=>{const w=c.world;if(w.gameProfile)return no('Le narrateur de cette partie n’a pas ce calendrier d’arrivées.');if(!w.arrivals)enableArrivals(w);
      if(w.arrivals!.pending)return no('Une demande d’accueil est déjà en attente.');w.arrivals!.nextCheck=w.tick;return ok('Une demande d’accueil va s’ouvrir.');}},
  {id:'incident-trader',group:'Incidents',label:'Caravane marchande',hint:'Fait arriver une caravane marchande (schéma 332 ou plus, avec le calendrier des visiteurs).',target:'none',
    apply:c=>{const w=c.world;if(!w.visitors||w.schemaVersion<332)return no('Cette partie n’a pas de calendrier de caravanes marchandes.');
      return arriveTraderCaravan332(w)?ok('Une caravane marchande arrive.'):no('Aucune caravane n’a pu arriver (pas d’allié qui en envoie, pas de place d’entrée, ou une menace est active).');}},
  {id:'incident-farm-animals',group:'Incidents',label:'Animaux de ferme qui arrivent',hint:'Des animaux domestiques rejoignent la colonie (schéma 305 ou plus).',target:'none',
    apply:c=>resolveSelectedFarmAnimals305(c.world,spawnSeed(c.world))?ok('Des animaux de ferme arrivent.'):no('Aucun animal de ferme ne peut arriver (calendrier absent, climat, ou pas de place).')},
  {id:'incident-self-tame',group:'Incidents',label:'Animal sauvage qui s’attache',hint:'Un animal sauvage apprivoisable devient celui de la colonie.',target:'none',
    apply:c=>{let n=spawnSeed(c.world);const next=()=>{n^=n<<13;n^=n>>>17;n^=n<<5;n>>>=0;return n/4294967296;};return resolveSelectedSelfTame305(c.world,next)?ok('Un animal se joint à la colonie.'):no('Aucun animal sauvage ne peut s’attacher maintenant.');}},
  {id:'incident-aurora',group:'Incidents',label:'Aurore',hint:'Lance une aurore (de nuit seulement, comme dans le jeu de base).',target:'none',
    apply:c=>resolveSelectedAurora305(c.world,()=>.5)?ok('Une aurore commence.'):no('Une aurore ne peut commencer que de nuit, sans autre aurore active.')},
  {id:'incident-resource-pod',group:'Incidents',label:'Capsule de ressources',hint:'Une capsule de fret tombe du ciel.',target:'none',
    apply:c=>resolveSelectedResourcePod305(c.world,spawnSeed(c.world))?ok('Une capsule tombe.'):no('Aucune capsule ne peut tomber (calendrier absent, ou une capsule est déjà là).')},
];
const REGISTRY=new Map(DEV_ACTIONS.map(a=>[a.id,a]));
export const devActionById=(id:string):DevAction|undefined=>REGISTRY.get(id);

/** Strict shape check: only registry ids, only declared parameters with one of their listed values. */
export function validDevCommand(value:unknown):value is DevCommand {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const c=value as Record<string,unknown>;
  if(c.type!=='dev-action'||typeof c.action!=='string'||Object.keys(c).some(k=>!['type','action','targetId','cell','args'].includes(k)))return false;
  const action=REGISTRY.get(c.action);if(!action)return false;
  if(c.targetId!==undefined&&(!Number.isSafeInteger(c.targetId)||(c.targetId as number)<1))return false;
  if(c.cell!==undefined){const cell=c.cell as Record<string,unknown>;if(!cell||typeof cell!=='object'||Object.keys(cell).some(k=>k!=='x'&&k!=='z')||!Number.isSafeInteger(cell.x)||!Number.isSafeInteger(cell.z))return false;}
  if(c.args!==undefined){
    const args=c.args as Record<string,unknown>;if(!args||typeof args!=='object'||Array.isArray(args))return false;
    for(const [key,v] of Object.entries(args)){const param=action.params?.find(p=>p.key===key);if(!param||typeof v!=='string'||!param.options.some(o=>o.value===v))return false;}
  }
  return true;
}
function pawnTarget(world:World,id:number|undefined):{pawn?:Pawn;animal?:WildAnimal} {
  if(id===undefined)return {};
  const pawn=world.pawns.find(p=>p.id===id);if(pawn)return {pawn};
  const animal=world.wildlife?.animals.find(a=>a.id===id);return animal?{animal}:{};
}
/** The command entry (engine.ts): refuses with a reason, never throws. */
export function applyDevAction(world:World,command:unknown):{ok:true}|{ok:false;code:'invalid-command'|'missing-target';reason:string} {
  if(!devModeEnabled())return {ok:false,code:'invalid-command',reason:'Le mode développeur est désactivé.'};
  if(!validDevCommand(command))return {ok:false,code:'invalid-command',reason:'Action de développeur invalide.'};
  const action=REGISTRY.get(command.action)!,args={...Object.fromEntries((action.params??[]).map(p=>[p.key,p.default])),...command.args};
  let target:{pawn?:Pawn;animal?:WildAnimal}={};
  if(action.target==='pawn'||action.target==='animal'||action.target==='creature'){
    target=pawnTarget(world,command.targetId);
    const what=action.target==='pawn'?'un colon':action.target==='animal'?'un animal':'un colon ou un animal';
    if(command.targetId===undefined)return {ok:false,code:'missing-target',reason:`Sélectionnez d’abord ${what}.`};
    if(!target.pawn&&!target.animal)return {ok:false,code:'missing-target',reason:'La cible n’est plus sur cette carte.'};
    if(action.target==='pawn'&&!target.pawn)return {ok:false,code:'missing-target',reason:'Cette action concerne un colon, pas un animal.'};
    if(action.target==='animal'&&!target.animal)return {ok:false,code:'missing-target',reason:'Cette action concerne un animal, pas un colon.'};
  }else if(action.target==='cell'&&!command.cell)return {ok:false,code:'missing-target',reason:'Cliquez une case de la carte.'};
  const outcome=action.apply({world,args,...target,...command.cell?{cell:command.cell}:{}});
  if(!outcome.ok)return {ok:false,code:'invalid-command',reason:outcome.reason};
  pushEvent(world,outcome.message);
  return {ok:true};
}
/** Construction jobs at a cell, for the engine's completion hook. */
export const devConstructionJobAt=(world:World,cell:Cell)=>world.jobs.find(j=>j.x===cell.x&&j.z===cell.z&&isConstruction(j));
