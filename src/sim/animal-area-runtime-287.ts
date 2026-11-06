import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {registeredMapId} from './world-map-context.ts';
import {captureAnimalAreaPolicy287,type AnimalAreaPolicy287} from './animal-area-policy-287.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {animalHandlingHolding} from './animal-handling.ts';
import {animalCareInProgress} from './animal-care.ts';
import {animalFeedingInProgress} from './animal-feeding.ts';
import type {animalNavigation} from './wildlife-navigation.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {World} from './types.ts';
import { structureById } from './structure-navigation.ts';

export function animalAreaProtected287(w:World,a:WildAnimal):boolean {
 return a.state==='dead'||a.state==='downed'||!!a.health?.death||!!animalCarrier(w,a.id)
  ||animalHandlingHolding(w,a.id)||animalCareInProgress(w,a)||animalFeedingInProgress(w,a);
}
const busy=(a:WildAnimal)=>!!(a.meal||a.animalRest||a.haul||a.eggLay||a.mating||a.exiting||a.predation||a.hiveJob||a.flight||a.exitFlight||a.animalThermalRefuge288);
const settle=(w:World,a:WildAnimal)=>{if((a.motion?.end??0)<=w.tick&&a.state==='moving')a.state='idle';a.nextDecision=w.tick;};
/** Remove only this Goto's future route. A replacement job already owns its
 * own path, and every admitted physical edge remains untouched. */
export function releaseAnimalAreaReturn287(w:World,a:WildAnimal):void {
 if(!a.animalAreaReturn287)return;delete a.animalAreaReturn287;
 if(!busy(a)){a.path=[];settle(w,a);}
}
/** Targets are checked before their next real act, never every corridor cell. */
export function reconcileAnimalAreaTasks287(w:World,a:WildAnimal,policy=captureAnimalAreaPolicy287(w,a)):void {
 if(!isSchema287OrLater(w.schemaVersion))return;
 if(a.animalAreaReturn287&&(a.stun||a.sleepUntilCore||busy(a)||a.state==='sleeping'||a.state==='eating'||a.wander?.job))releaseAnimalAreaReturn287(w,a);
 if(!policy||animalAreaProtected287(w,a)){
  releaseAnimalAreaReturn287(w,a);return;
 }
 if(a.animalThermalRefuge288&&(a.animalThermalRefuge288.mapId!==registeredMapId(w)||!policy.has(a.animalThermalRefuge288.target.z*w.width+a.animalThermalRefuge288.target.x))){
  delete a.animalThermalRefuge288;
  const replacement=!!(a.meal||a.animalRest||a.haul&&a.haul.phase!=='holding'||a.eggLay||a.mating||a.predation||a.exiting||a.hiveJob||a.wander?.job||a.animalAreaReturn287||a.flight||a.exitFlight);
  if(!replacement){a.path=[];settle(w,a);}
 }
 if(a.animalAreaReturn287&&(a.motion?.end??0)<=w.tick&&policy.has(a.z*w.width+a.x))releaseAnimalAreaReturn287(w,a);
 const inside=(c:{x:number;z:number})=>policy.has(c.z*w.width+c.x);
 let interrupted=false;
 if(a.meal){const source=a.meal.kind==='plant'?w.resources.find(r=>r.id===a.meal!.id):w.piles.find(p=>p.id===a.meal!.id)?.owner;
  if(source&&'x'in source&&!inside(source)){delete a.meal;interrupted=true;}
 }
 if(a.animalRest){const bed=structureById(w,a.animalRest!.spotId);if(bed&&!inside(bed)){delete a.animalRest;if(a.state==='sleeping')a.state='idle';interrupted=true;}}
 if(a.eggLay&&!inside(a.eggLay.target)){delete a.eggLay;interrupted=true;}
 if(a.animalAreaReturn287&&(!inside(a.animalAreaReturn287.target)||a.animalAreaReturn287.mapId!==registeredMapId(w)))releaseAnimalAreaReturn287(w,a);
 if(a.state==='sleeping'&&!a.sleepUntilCore&&!inside(a)){a.state='idle';interrupted=true;}
 if(interrupted){a.path=[];settle(w,a);}
}
export interface AnimalAreaReturnContext287 {
 nav:ReturnType<typeof animalNavigation>;
 takeSearch():boolean;
 move():void;
 policy?:AnimalAreaPolicy287;
 /** undefined=no prior search; null=the exhausted prior frontier has no goal. */
 fallbackRoute?:(goals:{x:number;z:number}[])=>{x:number;z:number}[]|null|undefined;
}
/** A deterministic, budgeted real Goto. Medical rest and urgent/held branches
 * run before this caller; ordinary needs run after it. No reader draws RNG. */
export function processAnimalAreaReturn287(w:World,a:WildAnimal,c:AnimalAreaReturnContext287):boolean {
 if(!isSchema287OrLater(w.schemaVersion))return false;
 const policy=c.policy,mapId=registeredMapId(w);
 if(!policy||mapId===undefined||animalAreaProtected287(w,a)||a.stun||a.sleepUntilCore||busy(a)){
  releaseAnimalAreaReturn287(w,a);return false;
 }
 if((a.motion?.end??0)>w.tick)return !!a.animalAreaReturn287;
 if(policy.has(a.z*w.width+a.x)){releaseAnimalAreaReturn287(w,a);return false;}
 const intent=a.animalAreaReturn287;
 if(intent&&(intent.mapId!==mapId||!policy.has(intent.target.z*w.width+intent.target.x)||!c.nav.free(intent.target)))releaseAnimalAreaReturn287(w,a);
 const move=()=>{c.move();const current=a.animalAreaReturn287;
  if(current&&!a.path.length&&(a.x!==current.target.x||a.z!==current.target.z)){delete a.animalAreaReturn287;return false;}return true;
 };
 if(a.animalAreaReturn287&&a.path.length)return move();
 if(a.nextDecision>w.tick)return true;
 const goals=policy.cells.map(i=>({x:i%w.width,z:Math.floor(i/w.width)})).filter(c.nav.free);
 let path=c.fallbackRoute?.(goals);
 if(path===undefined){if(!c.takeSearch())return true;path=c.nav.route(a,goals);}
 if(!path?.length){releaseAnimalAreaReturn287(w,a);a.nextDecision=w.tick+20;return true;}
 const target=path.at(-1)!;if(a.wander?.job)delete a.wander.job;a.animalAreaReturn287={mapId,target:{...target}};
 a.path=path;a.state='moving';a.nextDecision=w.tick;return move();
}
