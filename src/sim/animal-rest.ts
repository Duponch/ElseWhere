import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {claimLocalActorBed256,forgetLocalActorBed256,forgetLocalBedOwners256,localBedClaimAvailable256,type ActualActorBeds256,captureActorBeds256} from './actor-bed-local-256.ts';
import { canStandAt } from './furniture-travel.ts';
import { veterinaryCareSpeciesAllowed,veterinaryNeedsRest } from './veterinary-rules.ts';
import { autoSlaughterTargets,slaughterIntent } from './auto-slaughter.ts';
import { animalCarrier,animalClaimed,animalSpotClaimed,releaseAnimalRescue } from './animal-rest-state.ts';
import type { Cell,Structure,World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';
import {captureAnimalAreaPolicy287,type AnimalAreaPolicy287} from './animal-area-policy-287.ts';

const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
export function animalSpotAvailable(w:World,s:Structure,a:WildAnimal,exceptPawn?:number,bedOwners?:ActualActorBeds256):boolean {
  if(w.schemaVersion<221||s.kind!=='animal-sleeping-spot'||!a.domestic||a.state==='dead'||a.health?.death
    ||!veterinaryCareSpeciesAllowed(a.species,w.schemaVersion,a)||!canStandAt(w,s)||animalSpotClaimed(w,s.id,a.id,exceptPawn))return false;
  if(s.medical&&(a.domestic.care==='none'||a.domestic.slaughter||!(a.state==='downed'||a.health&&veterinaryNeedsRest(a.health))))return false;
  if(!s.medical&&(w.wildlife?.animals.some(other=>other!==a&&other.domestic?.bedId===s.id)||!localBedClaimAvailable256(w,s,a,undefined,bedOwners)))return false;
  return !w.wildlife?.animals.some(other=>other!==a&&same(other,s))
    &&(a.animalRest?.phase==='sleep'&&same(a,s)||!w.pawns.some(p=>p.id!==exceptPawn&&p.state!=='dead'&&same(p,s)));
}
export function animalRestingSpot(w:World,a:WildAnimal):Structure|undefined {
  if(w.schemaVersion<221||a.animalRest?.phase!=='sleep'||(a.motion?.end??0)>w.tick)return;
  return w.structures.find(s=>s.id===a.animalRest!.spotId&&s.kind==='animal-sleeping-spot'&&same(s,a));
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
  for(const a of w.wildlife?.animals??[]){
    if(a.domestic?.bedId!==undefined&&(a.state==='dead'||a.health?.death||!w.structures.some(s=>s.id===a.domestic!.bedId&&s.kind==='animal-sleeping-spot'&&!s.medical)))forgetLocalActorBed256(w,a);
    const t=a.animalRest;if(!t)continue;
    const s=w.structures.find(s=>s.id===t.spotId);
    const policy=a.state!=='downed'&&!animalCarrier(w,a.id)&&!animalClaimed(w,a.id)?captureAnimalAreaPolicy287(w,a):undefined;
    if(s&&policy&&!policy.has(s.z*w.width+s.x)){clearRest(w,a);continue;}
    if(!s||!animalSpotAvailable(w,s,a)||animalCarrier(w,a.id)||a.burning||a.flee||a.threat||a.retaliation||a.strike||a.manhunter||slaughterIntent(w,a,w.schemaVersion,targets)
      ||t.phase==='travel'&&(a.state!=='moving'||animalClaimed(w,a.id))
      ||t.phase==='sleep'&&(!same(s,a)||(a.motion?.end??0)>w.tick||!['sleeping','downed'].includes(a.state)))clearRest(w,a);
  }
}
export interface AnimalRestContext {
  free(c:Cell):boolean;step(a:Cell,b:Cell):boolean;route(goals:Cell[],rank?:(c:Cell)=>number):Cell[]|null|undefined;move():void;
  medicalRest:boolean;night:boolean;nutrition:number;
  readArea?:(a:WildAnimal)=>AnimalAreaPolicy287|undefined;
}
export function processAnimalRest(w:World,a:WildAnimal,ctx:AnimalRestContext):boolean {
  if(w.schemaVersion<221||!a.domestic||animalCarrier(w,a.id)||a.state==='dead'||a.state==='downed'||animalClaimed(w,a.id))return false;
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
    const s=w.structures.find(s=>s.id===t.spotId);
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
  const bedOwners=w.schemaVersion>=256&&w.structures.some(s=>s.kind==='animal-sleeping-spot')?captureActorBeds256(w):undefined;
  const spots=w.structures.filter(s=>inside(s)&&animalSpotAvailable(w,s,a,undefined,bedOwners)&&ctx.free(s)).sort((x,y)=>rank(x)-rank(y)
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
