import {SCHEMA_VERSION} from './types.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {forestNativeSpecies291,treeSowingUnlocked291,isForestrySpecies291,isGrowingPlantInVersion291,TREE_SOWING_COST_291} from './forestry-content-291.ts';
import type {World} from './types.ts';

const own=(value:object,key:PropertyKey)=>Object.hasOwn(value,key);
const plain=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min&&value<=max;
const data=(value:object,key:string)=>{const d=Object.getOwnPropertyDescriptor(value,key);return d?.enumerable&&own(d,'value')?d:undefined;};

/** Birth clocks, current zones and possession never infer cultivated origin. */
export function validSownResource291(value:unknown,version:unknown):boolean {
 try{
  if(!value||typeof value!=='object')return false;
  if(!('sown291'in value))return true;
  return (version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version)))))))&&plain(value)&&data(value,'sown291')?.value===true&&data(value,'kind')?.value==='tree'&&isForestrySpecies291(data(value,'species')?.value);
 }catch{return false;}
}

export function validForestryResearch291(value:unknown,version:unknown,tick=Number.MAX_SAFE_INTEGER):boolean {
 try{
  if(value===undefined)return true;if(!plain(value))return false;
  const project=data(value,'project');if('project'in value&&!project)return false;
  if(!('treeSowing291'in value))return project?.value!=='tree-sowing';
  const d=data(value,'treeSowing291');if((version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))))))||!d||!plain(d.value))return false;
  const p=d.value,points=data(p,'points'),completed=data(p,'completedAt');
  if(!points||!Reflect.ownKeys(p).every(key=>typeof key==='string'&&(key==='points'||key==='completedAt')&&!!data(p,key))||!integer(points.value,0,TREE_SOWING_COST_291))return false;
  return completed?integer(completed.value,0,tick)&&points.value===TREE_SOWING_COST_291&&project?.value!=='tree-sowing':points.value<TREE_SOWING_COST_291;
 }catch{return false;}
}

/** Candidate zones include retained policy even when a delta omits resources. */
export function validForestryPolicies291(world:World):boolean {
 try{
  if(!validForestryResearch291(world.research,world.schemaVersion,world.tick))return false;
  let native:readonly string[]|undefined;
  for(const zone of world.growingZones){
   if(!isGrowingPlantInVersion291(zone.plant,world.schemaVersion))return false;
   if(isForestrySpecies291(zone.plant)&&(zone.basinId!==undefined||!treeSowingUnlocked291(world)||!(native??=forestNativeSpecies291(world)).includes(zone.plant)))return false;
  }
  return true;
 }catch{return false;}
}

/** Closed custody/envelope lanes only. Never inspect terrain or physiology.
 * Sparse resource tables visit their upserts, never an omitted whole grid. */
const lanes:readonly [string,boolean?][]=[
 ['world'],['summary'],['dynamic'],['campaign'],['worldMaps'],['sites',true],['map'],['secondarySite'],['campaignMap'],
 ['resources',true],['growingZones',true],['research'],['piles',true],['items',true],['innerResource'],['jobs',true],
 ['worldGroups'],['groups',true],['group'],['state'],['pending261'],['groupLosses',true],['animalLosses',true],['losses',true],['legacyTravellers',true],['abandonedPawns',true],['abandonedContents',true],
 ['worldPawns'],['owners',true],['worldFactions'],['leaders',true],['heldCaskets259',true],['heldPlayerCaskets271',true],['heldShipCaskets277',true],
 ['casket'],['cryptosleep'],['shipCryptosleep277'],['occupant'],['structures',true],['packed',true],['building'],
 ['visitors'],['podRescues'],['departed',true],['startingArrival'],['pods',true],['animalOwners'],
 ['humans',true],['members',true],['people',true],['animals',true],['pawns',true],['human'],['pawn'],['animal'],['actor'],['scout'],['commercialTrip'],
];
export function validForestryHistoricalTransport291(raw:unknown,version:unknown):boolean {
 if(!integer(version,1,SCHEMA_VERSION))return false;
 let budget=2_000_000;const active=new Set<object>();
 const list=(value:unknown,key:string):boolean=>{
  if(!Array.isArray(value))return key!=='visitor-member-id'&&plain(value)&&!!data(value,'upserted')&&visit(value,key);
  if(active.has(value)||value.length>1_000_000)return false;active.add(value);
  for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!own(d,'value')||(key==='visitor-member-id'?!d.enumerable||--budget<0||!integer(d.value,1):!visit(d.value,key))){active.delete(value);return false;}}
  active.delete(value);return true;
 };
 const visit=(value:unknown,kind:string):boolean=>{
  if(--budget<0||!plain(value)||active.has(value))return false;
  if('treeSowing291'in value&&kind!=='research')return false;
  if('sown291'in value&&(kind!=='resources'&&kind!=='innerResource'||!validSownResource291(value,version)))return false;
  if(kind==='growingZones'&&!own(value,'upserted')&&!isGrowingPlantInVersion291(data(value,'plant')?.value,version))return false;
  if(kind==='research'&&!validForestryResearch291(value,version))return false;
  active.add(value);
  if(own(value,'upserted')){const d=data(value,'upserted');if(!d||!list(d.value,kind)){active.delete(value);return false;}}
  for(const[key,array]of lanes){
   const d=Object.getOwnPropertyDescriptor(value,key);if(!d){if(key in value)return false;continue;}
   if(!d.enumerable||!own(d,'value'))return false;
   if(d.value===undefined||d.value===null||typeof d.value!=='object')continue;
   const child=kind==='visitors'&&key==='groups'?'visitor-group':kind==='visitor-group'&&key==='members'?'visitor-member-id':key;
   if(!(array?list(d.value,child):visit(d.value,child))){active.delete(value);return false;}
  }
  active.delete(value);return true;
 };
 try{return visit(raw,'world');}catch{return false;}
}
