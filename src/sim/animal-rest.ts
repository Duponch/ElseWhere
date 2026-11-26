import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {claimLocalActorBed256,forgetLocalActorBed256,forgetLocalBedOwners256,localBedClaimAvailable256,type ActualActorBeds256,captureActorBeds256} from './actor-bed-local-256.ts';
import { canStandAt } from './furniture-travel.ts';
import { veterinaryCareSpeciesAllowed,veterinaryNeedsRest } from './veterinary-rules.ts';
import { autoSlaughterTargets,slaughterIntent } from './auto-slaughter.ts';
import { animalCarriedOrClaimed,animalSpotClaimed,releaseAnimalRescue,createAnimalServiceReadPass379 } from './animal-rest-state.ts';
import type { Cell,Structure,World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';
import {captureAnimalAreaPolicy287,type AnimalAreaPolicy287} from './animal-area-policy-287.ts';
import { structureById,structuresOfKind} from './structure-navigation.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import type {Pawn} from './types.ts';

const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
type BedCapture=ActualActorBeds256|(()=>ActualActorBeds256);
export interface AnimalSpotRead379 {
 claimed(s:Structure,a:WildAnimal,exceptPawn?:number):boolean;
 foreignBed(s:Structure,a:WildAnimal):boolean;
 occupiedAnimal(s:Structure,a:WildAnimal):boolean;
 occupiedPawn(s:Structure,exceptPawn?:number):boolean;
 beds():ActualActorBeds256;
}
/** A synchronous availability pass only: local reconciliation may release
 * claims but does not move actors or acquire a new spot; a planning query is
 * read-only until its result is committed. Index live candidate identities,
 * not occupancy booleans. No cache is kept between the turns of animals. */
export function createAnimalSpotRead379(w:World):AnimalSpotRead379 {
 const owned=terrainJournalReadOwner()!==undefined,animals=w.wildlife?.animals??[],humans=w.pawns;
 type Index<K,T>=Map<K,T[]>;
 let byRest:Index<number,WildAnimal>|undefined,byBed:Index<number,WildAnimal>|undefined,byRescue:Index<number,Pawn>|undefined,animalCells:Index<number,WildAnimal>|undefined,pawnCells:Index<number,Pawn>|undefined;
 const add=<K,T>(map:Index<K,T>,key:K,value:T)=>{const rows=map.get(key);if(rows)rows.push(value);else map.set(key,[value]);};
 const cell=(c:Cell)=>c.z*w.width+c.x;
 const indexAnimals=()=>{if(animalCells)return;byRest=new Map();byBed=new Map();animalCells=new Map();for(const a of animals){
  if(a.animalRest)add(byRest,a.animalRest.spotId,a);if(a.domestic?.bedId!==undefined)add(byBed,a.domestic.bedId,a);add(animalCells,cell(a),a);
 }};
 const indexHumans=()=>{if(pawnCells)return;byRescue=new Map();pawnCells=new Map();for(const p of humans){if(p.animalRescue)add(byRescue,p.animalRescue.spotId,p);add(pawnCells,cell(p),p);}};
 const emptyAnimals:readonly WildAnimal[]=[],emptyHumans:readonly Pawn[]=[];
 const validate=(answer:boolean,scan:()=>boolean)=>{if(owned&&verifyTerrainWriteCaches&&answer!==scan())throw Error('Animal spot membership changed outside its synchronous read phase');return answer;};
 let beds:ActualActorBeds256|undefined,queries=0;
 const indexed=()=>owned&&queries>=2;
 return {
  claimed(s,a,exceptPawn){queries++;if(!indexed())return animalSpotClaimed(w,s.id,a.id,exceptPawn);indexAnimals();indexHumans();
   const answer=(byRescue!.get(s.id)??emptyHumans).some(p=>p.id!==exceptPawn&&p.animalRescue?.spotId===s.id&&p.animalRescue.animalId!==a.id)||(byRest!.get(s.id)??emptyAnimals).some(other=>other.id!==a.id&&other.animalRest?.spotId===s.id);
   return validate(answer,()=>animalSpotClaimed(w,s.id,a.id,exceptPawn));},
  foreignBed(s,a){const scan=()=>!!w.wildlife?.animals.some(other=>other!==a&&other.domestic?.bedId===s.id);if(!indexed())return scan();indexAnimals();return validate((byBed!.get(s.id)??emptyAnimals).some(other=>other!==a&&other.domestic?.bedId===s.id),scan);},
  occupiedAnimal(s,a){const scan=()=>!!w.wildlife?.animals.some(other=>other!==a&&same(other,s));if(!indexed())return scan();indexAnimals();return validate((animalCells!.get(cell(s))??emptyAnimals).some(other=>other!==a&&same(other,s)),scan);},
  occupiedPawn(s,exceptPawn){const scan=()=>w.pawns.some(p=>p.id!==exceptPawn&&p.state!=='dead'&&same(p,s));if(!indexed())return scan();indexHumans();return validate((pawnCells!.get(cell(s))??emptyHumans).some(p=>p.id!==exceptPawn&&p.state!=='dead'&&same(p,s)),scan);},
  beds:()=>beds??=captureActorBeds256(w),
 };
}
export function animalSpotAvailable(w:World,s:Structure,a:WildAnimal,exceptPawn?:number,bedOwners?:BedCapture,read?:AnimalSpotRead379):boolean {
  if(w.schemaVersion<221||s.kind!=='animal-sleeping-spot'||!a.domestic||a.state==='dead'||a.health?.death
    ||!veterinaryCareSpeciesAllowed(a.species,w.schemaVersion,a)||!canStandAt(w,s)||(read?read.claimed(s,a,exceptPawn):animalSpotClaimed(w,s.id,a.id,exceptPawn)))return false;
  if(s.medical&&(a.domestic.care==='none'||a.domestic.slaughter||!(a.state==='downed'||a.health&&veterinaryNeedsRest(a.health))))return false;
  if(!s.medical&&((read?read.foreignBed(s,a):w.wildlife?.animals.some(other=>other!==a&&other.domestic?.bedId===s.id))||!localBedClaimAvailable256(w,s,a,undefined,bedOwners??read?.beds)))return false;
  return !(read?read.occupiedAnimal(s,a):w.wildlife?.animals.some(other=>other!==a&&same(other,s)))
    &&(a.animalRest?.phase==='sleep'&&same(a,s)||!(read?read.occupiedPawn(s,exceptPawn):w.pawns.some(p=>p.id!==exceptPawn&&p.state!=='dead'&&same(p,s))));
}
export function animalRestingSpot(w:World,a:WildAnimal):Structure|undefined {
  if(w.schemaVersion<221||a.animalRest?.phase!=='sleep'||(a.motion?.end??0)>w.tick)return;
  return structuresOfKind(w,'animal-sleeping-spot').find(s=>s.id===a.animalRest!.spotId&&same(s,a));
}
function clearRest(w:World,a:WildAnimal):void {
  if(!a.animalRest)return;
  delete a.animalRest;a.path=[];a.nextDecision=w.tick;
  if(a.state==='sleeping')a.state='idle';
}
export function releaseAnimalSpotBindings(w:World,id:number):void {
  forgetLocalBedOwners256(w,id);
  for(const p of w.pawns)if(p.animalRescue?.spotId===id)releaseAnimalRescue(w,p);
  for(const a of w.wildlife?.animals??[]){
    if(a.animalRest?.spotId===id)clearRest(w,a);
    if(a.domestic?.bedId===id)delete a.domestic.bedId;
  }
}
export function reconcileAnimalRest(w:World):void {
  if(w.schemaVersion<221)return;
  const targets=autoSlaughterTargets(w);
  let services:ReturnType<typeof createAnimalServiceReadPass379>|undefined,spots:AnimalSpotRead379|undefined;
  const owned=terrainJournalReadOwner()!==undefined;
  let ordinaryBeds:Set<number>|undefined;
  for(const a of w.wildlife?.animals??[]){
    if(a.domestic?.bedId!==undefined){
     // The reconciliation itself changes aliases/tasks only, not structures
     // or bed roles. All assigned animals share the same exact spot membership.
     const valid=()=>owned?(ordinaryBeds??=new Set(structuresOfKind(w,'animal-sleeping-spot').filter(s=>!s.medical).map(s=>s.id))).has(a.domestic!.bedId!):structuresOfKind(w,'animal-sleeping-spot').some(s=>s.id===a.domestic!.bedId&&!s.medical);
     if(a.state==='dead'||a.health?.death||!valid())forgetLocalActorBed256(w,a);}
    const t=a.animalRest;if(!t)continue;
    services??=createAnimalServiceReadPass379(w);spots??=createAnimalSpotRead379(w);
    const s=structureById(w,t.spotId);
    const policy=a.state!=='downed'&&!services.carriedOrClaimed(a.id)?captureAnimalAreaPolicy287(w,a):undefined;
    if(s&&policy&&!policy.has(s.z*w.width+s.x)){clearRest(w,a);continue;}
    if(!s||!animalSpotAvailable(w,s,a,undefined,undefined,spots)||services.carrier(a.id)||a.burning||a.flee||a.threat||a.retaliation||a.strike||a.manhunter||slaughterIntent(w,a,w.schemaVersion,targets)
      ||t.phase==='travel'&&(a.state!=='moving'||services.claimed(a.id))
      ||t.phase==='sleep'&&(!same(s,a)||(a.motion?.end??0)>w.tick||!['sleeping','downed'].includes(a.state)))clearRest(w,a);
  }
}
export interface AnimalRestContext {
  free(c:Cell):boolean;step(a:Cell,b:Cell):boolean;route(goals:Cell[],rank?:(c:Cell)=>number):Cell[]|null|undefined;move():void;
  medicalRest:boolean;night:boolean;nutrition:number;
  readArea?:(a:WildAnimal)=>AnimalAreaPolicy287|undefined;
  carriedOrClaimed?:(id:number)=>boolean;
}
export function processAnimalRest(w:World,a:WildAnimal,ctx:AnimalRestContext):boolean {
  if(w.schemaVersion<221||!a.domestic||a.state==='dead'||a.state==='downed'||(ctx.carriedOrClaimed?ctx.carriedOrClaimed(a.id):animalCarriedOrClaimed(w,a.id)))return false;
  const policy=ctx.readArea?ctx.readArea(a):captureAnimalAreaPolicy287(w,a),inside=(c:Cell)=>!policy||policy.has(c.z*w.width+c.x);
  const wanted=(ctx.medicalRest?a.food>=ctx.nutrition*.45:a.rest<.3||ctx.night&&a.rest<.75)&&!a.sleepUntilCore;
  const t=a.animalRest;
  if(a.food<ctx.nutrition*.45||a.sleepUntilCore||t?.phase==='sleep'&&(!ctx.medicalRest&&a.rest>=1)){
    clearRest(w,a);return false;
  }
  if(t?.phase==='sleep'){
    if(inside(a))return true;clearRest(w,a);return false;
  }
  if(t?.phase==='travel'){
    const s=structureById(w,t.spotId);
    if(!s||!inside(s)||!animalSpotAvailable(w,s,a)||!ctx.free(s)){clearRest(w,a);return false;}
    if(same(s,a)){a.path=[];delete a.motion;a.state='sleeping';t.phase='sleep';return true;}
    if(a.path.length&&!ctx.step(a,a.path[0]!)){clearRest(w,a);return false;}
    if(!a.path.length){clearRest(w,a);return false;}
    ctx.move();return true;
  }
  const replaceAreaReturn=isSchema287OrLater(Number(w.schemaVersion))&&ctx.medicalRest&&!!a.animalAreaReturn287;
  const replaceThermal=(Number(w.schemaVersion)===288||(Number(w.schemaVersion)===289||(Number(w.schemaVersion)===290||(Number(w.schemaVersion)===291||(Number(w.schemaVersion)===292||(Number(w.schemaVersion)===293||(Number(w.schemaVersion)===294||(Number(w.schemaVersion)===295||(Number(w.schemaVersion)===296||isCorePhysicalSchema297(Number(w.schemaVersion)))))))))))&&ctx.medicalRest&&!!a.animalThermalRefuge288;
  if(!wanted||a.meal||a.path.length&&!replaceAreaReturn&&!replaceThermal||a.nextDecision>w.tick&&!replaceThermal)return false;
  const rank=(s:Structure)=>s.medical?0:a.domestic?.bedId===s.id?1:2;
  const candidates=structuresOfKind(w,'animal-sleeping-spot');if(!candidates.length)return false;
  const spotRead=candidates.length>1&&terrainJournalReadOwner()!==undefined?createAnimalSpotRead379(w):undefined;
  let beds:ActualActorBeds256|undefined;
  const bedOwners=w.schemaVersion>=256?terrainJournalReadOwner()!==undefined&&!verifyTerrainWriteCaches?()=>beds??=captureActorBeds256(w):captureActorBeds256(w):undefined;
  // Only animal sleeping spots can be available (animalSpotAvailable): the
  // kind index gives them in source order, instead of every structure.
  const spots=candidates.filter(s=>inside(s)&&animalSpotAvailable(w,s,a,undefined,bedOwners,spotRead)&&ctx.free(s)).sort((x,y)=>rank(x)-rank(y)
    ||(x.x-a.x)**2+(x.z-a.z)**2-((y.x-a.x)**2+(y.z-a.z)**2)||x.id-y.id);
  // One flood finds all available ranks, including a fallback if medical is unreachable.
  if(!spots.length)return false;
  const ranks=new Map(spots.map(s=>[s.z*w.width+s.x,rank(s)]));
  const path=ctx.route(spots,c=>ranks.get(c.z*w.width+c.x)??2);if(!path)return false;
  const end=path.at(-1)??a,spot=spots.find(s=>same(s,end));if(!spot)return false;
  if(replaceAreaReturn)delete a.animalAreaReturn287;
  if(replaceThermal)delete a.animalThermalRefuge288;
  if(!spot.medical)claimLocalActorBed256(w,a,spot);
  a.animalRest={spotId:spot.id,phase:path.length?'travel':'sleep'};a.path=path;a.state=path.length?'moving':'sleeping';
  if(path.length)ctx.move();return true;
}
