/** Actual road props and natural hive components, not regenerated scenery. */
import type {ImportContext} from './convert.ts';
import type {RwsThing} from './rws-save.ts';
import {items,num,text} from './xml.ts';
import type {Structure,Tile} from '../../sim/types.ts';
import {validLocalRoadPropStructure256} from '../../sim/local-road-props-save-256.ts';
import {validCaveHiveBuilding256} from '../../sim/cave-hive-save-256.ts';
import {glowPodAgeAtCore256} from '../../sim/cave-hive-clocks-256.ts';
import {validCollapsedRock256,admittedRoofTerrain256} from '../../sim/collapsed-rocks-256.ts';
import {rockMaxHP} from '../../sim/mining-rules.ts';
import {hydroponicCropAllowed} from '../../sim/hydroponics.ts';
import {zonePlant} from './map-plants.ts';
import {isDropped} from './mapping.ts';
import {isDiningTable} from '../../sim/dining.ts';
import type {GapOrigin} from './gap-origin.ts';

const insectKind={Megascarab:'megascarab',Spelopede:'spelopede',Megaspider:'megaspider'} as const;
const bool=(t:RwsThing,key:string,fallback:boolean):boolean=>{const raw=text(t.node,key);return raw===undefined?fallback:raw==='True';};

/** Arrival of these identifiable owners precedes their first clock advance.
 * We only admit Hive combinations whose saved spawner/awake state is fully
 * representable. No fabricated Lord or pawn membership; those need their
 * actual actor-level source references before an occupied hive can be
 * recovered. Core defaults are Scribe defaults, not fresh-game guesses. */
export function admitImportedNaturalBuilding(ctx:ImportContext,t:RwsThing,s:Structure):boolean {
 const {w,notes}=ctx,now=w.tick*10;
 const refuse=(why:string,origin:GapOrigin)=>{notes.def('buildings',t.def,'dropped',s.kind,why,1,origin);return false;};
 const faction=t.faction===undefined?null:ctx.factionIds?.get(t.faction)??(t.faction===ctx.save.playerFaction?w.worldFactions?.playerFactionId:undefined);
 const insect=w.worldFactions?.factions.find(f=>f.def==='Insect')?.id;
 if(s.kind==='ancient-road-barrier'||s.kind==='ancient-road-lamp'){
  if(faction!==null&&(faction===undefined||faction!==w.worldFactions?.playerFactionId))return refuse('Propriétaire du mobilier routier absent ou non admis.',faction===undefined?'importer':'model');
  s.factionId=faction;
  return validLocalRoadPropStructure256(s,w.schemaVersion,w)||refuse('Composant de mobilier routier invalide.','unresolved');
 }
 if(s.kind==='glow-pod'){
  if(faction!==null&&(faction===undefined||faction!==insect&&faction!==w.worldFactions?.playerFactionId))return refuse('Propriétaire du bulbe lumineux absent ou non admis.',faction===undefined?'importer':'model');
  if(!w.wildlife)return refuse('Propriétaire local de vie sauvage absent.','importer');
  const made=num(t.node,'spawnedTick')??0,age=num(t.node,'age')??0;
  if(!Number.isSafeInteger(made)||made<0||made>now||!Number.isSafeInteger(age)||age< -1||age>=1200000||(age+1)%250!==0)return refuse('Horloge du bulbe lumineux non représentable.','model');
  if(!bool(t,'glowOn',false))return refuse('Bulbe explicitement éteint : état lumineux absent de la simulation.','model');
  // Core's Rare tick is indexed by ThingID modulo 250. Reserve a fresh
  // monotonic identity with that same residue instead of rephasing its age.
  const original=Number(/^GlowPod(\d+)$/.exec(t.id)?.[1]);
  if(!Number.isSafeInteger(original)||original<1)return refuse('Identité source du bulbe sans phase Rare reconnue.','source');
  const id=s.id+((original%250-s.id%250+250)%250);
  if(!Number.isSafeInteger(id+1)||age>glowPodAgeAtCore256(id,made,now))return refuse('Âge source incompatible avec sa phase Rare et l’horloge locale.','model');
  s.id=id;w.nextId=Math.max(w.nextId,id+1);
  s.factionId=faction;s.glowPod={revision:1,madeAtCore:made,ageCore:age,lastCore:now};
  if(!validCaveHiveBuilding256(s,w.schemaVersion,w))return refuse('Composant du bulbe lumineux invalide.','unresolved');
  notes.def('building-state','Âge du bulbe lumineux','exact',undefined,'Âge, apparition, faction et phase Rare conservés.');
  return true;
 }
 if(s.kind==='insect-hive'){
  if(insect===undefined||faction!==insect||!w.wildlife)return refuse('Propriétaire insecte absent.','importer');
  const made=num(t.node,'makeTick')??0,woke=num(t.node,'wokeUpTick')??-2147483648,
   wakeOn=num(t.node,'wakeUpOnTick')??-2147483648,
   chosen=text(t.node,'chosenKind'),kind=chosen===undefined?null:insectKind[chosen as keyof typeof insectKind];
  const nextPawn=num(t.node,'nextPawnSpawnTick')??0,nextHive=num(t.node,'nextHiveSpawnTick')??0,
   wasActivated=bool(t,'wasActivated',true),jelly=num(t.node,'jelly_ticksUntilSpawn')??0,
   pod=num(t.node,'pod_ticksUntilSpawn')??0,heal=num(t.node,'ticksPassedSinceLastHeal')??0,maintenance=num(t.node,'ticksSinceMaintain')??0;
  const canSpawnPawns=bool(t,'canSpawnPawns',true),canSpawnHives=bool(t,'canSpawnHives',true);
  const repeat=num(t.node,'repeatWakeUpSignalOnTick')??-2147483648,signal=text(t.node,'wakeUpSignalTag');
  if(wakeOn!==-2147483648||repeat!==-2147483648&&repeat!==2147483647||signal&&signal!=='CompCanBeDormant.WakeUp'||items(t.node,'wakeUpSignalTags').length||items(t.node,'questTags').length)return refuse('Réveil différé ou signaux de quête personnalisés absents de la simulation de ruche.','model');
  if(canSpawnPawns!==canSpawnHives||canSpawnHives&&!bool(t,'aggressive',false)||(num(t.node,'pawnsLeftToSpawn')??-1)!==-1||kind===undefined)return refuse('Combinaison de reproduction, limite de population ou espèce de ruche absente du modèle.','model');
  if(bool(t,'active',false)&&woke===-2147483648)return refuse('Ancienne ruche active sans date de réveil enregistrée.','source');
  const awakeAtCore=woke===-2147483648?null:woke;
  if(awakeAtCore===null&&(!canSpawnHives||!w.tiles[ctx.index(s)]?.fogged||items(t.node,'spawnedPawns').length))return refuse('Ruche dormant en zone visible, cave désactivée ou déjà peuplée non représentable.','model');
  s.factionId=insect;s.caveHive={revision:1,madeAtCore:made,awakeAtCore,...canSpawnHives?{temple:true as const}:{},lastCore:now,chosenKind:kind,spawnedPawnIds:[],canSpawnPawns,canSpawnHives,nextPawnSpawnCore:nextPawn,nextHiveSpawnCore:nextHive,wasActivated,jellyLeftCore:jelly,podLeftCore:pod,healCore:heal,maintenanceCore:maintenance};
  if(!validCaveHiveBuilding256(s,w.schemaVersion,w))return refuse('Horloges ou composant source de la ruche invalides pour le modèle actuel.','model');
  notes.def('building-state',awakeAtCore===null?'Ruche endormie':'Ruche éveillée','exact','dormance et compteurs, sans insectes générés');
 }
 return true;
}

/** Called for loaded terrain before the usual mineable-owner constructor.
 * Roof collapse is a physical obstruction retaining the covered ground; it
 * must not be converted to an ordinary rock, which yields stone on mining. */
export function importCollapsedRock(ctx:ImportContext,tile:Tile,thing?:RwsThing):Tile {
 const {w,notes}=ctx;
 const next:Tile={...tile,terrain:'rock',collapsedRock:{id:w.nextId++,terrain:tile.terrain}};
 delete next.ore;delete next.mineable;delete next.miningYield;delete next.miningDamage;delete next.smoothedWall367;
 if(!validCollapsedRock256(next,w.schemaVersion,w.nextId,(value):value is Tile['terrain']=>admittedRoofTerrain256(value,w.schemaVersion)))throw Error('Éboulis sur terrain source non admis.');
 const hp=thing?.hp,max=rockMaxHP(next);
 if(hp!==undefined&&Number.isSafeInteger(hp)&&hp>0&&hp<max)next.miningDamage=max-hp;
 if(thing?.id)ctx.thingIds.set(thing.id,next.collapsedRock!.id);
 if(hp!==undefined)notes.def('mineable-state','Éboulis (points de vie)',hp<=max?'exact':'adapted',undefined,hp>max?'Maximum de points de vie différent.':undefined);
 return next;
}

/** Existing table gathering toggle. Scribe omits false: treating omission as
 * an Elsewhere default-true table would activate gathering in abandoned ruins. */
export function importGatheringPolicy(ctx:ImportContext,t:RwsThing,s:Structure):void {
 if(!isDiningTable(s.kind))return;
 const active=bool(t,'active',false);
 if(active)delete s.gatherSpot;else s.gatherSpot=false;
 ctx.notes.def('building-state','Rassemblement à table','exact',active?'activé':'désactivé');
}

/** A basin is a growing policy owned by this exact structure. Called only
 * after initializeHydroponicBasin has admitted its footprint and zone ID. */
export function importHydroponicPolicy(ctx:ImportContext,t:RwsThing,s:Structure):void {
 if(s.kind!=='hydroponics-basin')return;
 const source=text(t.node,'plantDefToGrow'),zone=ctx.w.growingZones.find(z=>z.basinId===s.id),mapping=zonePlant(source);
 if(zone&&mapping&&!isDropped(mapping)&&hydroponicCropAllowed(mapping.to)){
  zone.plant=mapping.to;ctx.notes.def('building-state','Culture hydroponique','exact',zone.plant);
 }else if(source&&zone)ctx.notes.def('building-state','Culture hydroponique','adapted',zone.plant,`${source} n’est pas une culture hydroponique admise ; culture par défaut.`,1,'model');
}
