import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import {recordTutorialStartingItem349} from './tutorial-lessons-349.ts';
import {findStartingPlaceNear256,planStartingPlaceDirect256,type StartingPlaceThing256} from './starting-place-near-256.ts';
import {captureStartingPlacePhysics256} from './starting-place-physics-256.ts';
import {prepareStartingHeldClinicalResume256} from './starting-held-clinical-256.ts';
import {prepareStartingSpawnFog256} from './starting-spawn-fog-256.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {canMergeEggPile256} from './animal-egg-permission-v256.ts';
import {mergePileContamination,mergePileEgg256} from './pile-condition.ts';
import {mergeThingDamage,pileMaxHp} from './thing-damage-rules.ts';
import {mergeRot,rotAge} from './food-preservation.ts';
import {refreshStock} from './materials.ts';
import {duckPhysicalOwnerCount256} from './duck-flyer-runtime-256.ts';
import {MAX_WILDLIFE} from './wildlife-state.ts';
import type {CoreStartingArrivalPending256,CoreStartingPod256} from './starting-pod-state-256.ts';
import type {World,MaterialPile,Pawn,Cell} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
const mutable=(o:object)=>Object.isExtensible(o)&&Reflect.ownKeys(o).every(k=>{const d=Object.getOwnPropertyDescriptor(o,k)!;return Object.hasOwn(d,'value')&&d.writable&&d.configurable;});
function adopt<T extends object>(original:T,next:T):T {for(const key of Object.keys(original))delete (original as Record<string,unknown>)[key];Object.assign(original,next);return original;}
export type PreparedStartingDischarge256={status:'ready';nextId:number;current():boolean;commit():void}|{status:'blocked';reason:string};
/** Actual reverse ThingOwner discharge. Only touched stacks/clinical dossiers
 * are privately projected; no World or old map is cloned. IDs for SplitOff
 * and the slag Thing are preflighted BEFORE any original changes. */
export function prepareStartingPodDischarge256(world:World,arrival:CoreStartingArrivalPending256,pod:CoreStartingPod256):PreparedStartingDischarge256 {
 const fail=(reason:string):PreparedStartingDischarge256=>({status:'blocked',reason});
 if(world.startingArrival!==arrival||!arrival.pods.includes(pod)||pod.phase!=='landed'||pod.ageCore<=110)return fail('Actual active transporter is not opening');
 if(pod.animals.length&&(!world.wildlife||world.wildlife.profile!=='geographic-fauna-v3'||duckPhysicalOwnerCount256(world)+pod.animals.length>MAX_WILDLIFE))return fail('Actual initial wildlife owner/capacity is missing');
 if(!Object.hasOwn(ITEM_DEFINITIONS,'slag-steel-chunk'))return fail('Actual starting slag definition is missing');
 const beforeId=world.nextId,beforeRng=world.rng,pilesBefore=world.piles,pawnsBefore=world.pawns,animalsBefore=world.wildlife?.animals,
  pileMembers=world.piles.slice(),pawnMembers=world.pawns.slice(),animalMembers=world.wildlife?.animals.slice(),
  originals=new Map(pod.items.map(p=>[p.id,p])),ground=new Map<number,MaterialPile[]>(),changed=new Map<MaterialPile,MaterialPile>(),privateTargets=new Set<MaterialPile>(),spawnedItems:MaterialPile[]=[],
  entrants:{actor:Pawn|WildAnimal;cell:Cell;health:ReturnType<typeof prepareStartingHeldClinicalResume256>}[]=[],spawned:{cell:Cell;downed:boolean}[]=[];
 let nextId=beforeId;
 for(const pile of pilesBefore)if(pile.owner.type==='ground'){const key=pile.owner.z*world.width+pile.owner.x,list=ground.get(key)??[];list.push(pile);ground.set(key,list);}
 let read:ReturnType<typeof captureStartingPlacePhysics256>;
 try{read=captureStartingPlacePhysics256(world,arrival,pod.cell,ground,spawned);}catch(error){return fail(error instanceof Error?error.message:'Actual pod placement capture refused');}
 const writable=(target:MaterialPile):MaterialPile=>{
  if(spawnedItems.includes(target)||privateTargets.has(target))return target;const old=changed.get(target);if(old)return old;
  const copy=structuredClone(target);changed.set(target,copy);privateTargets.add(copy);
  if(target.owner.type!=='ground')throw Error('Starting absorption target has no real ground owner');
  const list=ground.get(target.owner.z*world.width+target.owner.x)!;list[list.indexOf(target)]=copy;return copy;
 };
 const placeItem=(source:MaterialPile):boolean=>{
  const working=structuredClone(source),limit=ITEM_DEFINITIONS[working.item].stackLimit;
  for(;;){
   const thing:StartingPlaceThing256={id:working.id,category:'item',quantity:working.quantity,stackLimit:limit,downed:false,saveCompressible:false},cell=findStartingPlaceNear256(pod.cell,thing,c=>read(c,thing,working));if(!cell)return false;
   const facts=read(cell,thing,working),key=cell.z*world.width+cell.x,targets=(ground.get(key)??[]).slice().sort((a,b)=>b.quantity-a.quantity),
    plan=planStartingPlaceDirect256(thing,facts,targets.map(p=>({id:p.id,quantity:p.quantity,stackLimit:ITEM_DEFINITIONS[p.item].stackLimit,compatible:p.item===working.item&&canMergeEggPile256(p,working)})),nextId);
   nextId=plan.nextId;const oldQuantity=working.quantity;
   for(const operation of plan.operations){
    if(operation.kind==='absorb'){
     const target=(ground.get(key)??[]).find(p=>p.id===operation.targetId);if(!target)throw Error('Starting absorption lost its actual target');const out=writable(target);
     mergePileEgg256(out,operation.quantity,working.egg);mergePileContamination(out,operation.quantity,working.foodPoison);mergeThingDamage(out,operation.quantity,working.damage,pileMaxHp(out,world.schemaVersion));mergeRot(out,operation.quantity,rotAge(working,0),world.tick);markPileContentWrite379(out).quantity+=operation.quantity;
    }else {const out={...structuredClone(working),id:operation.id,quantity:operation.quantity,owner:{type:'ground' as const,...cell}};spawnedItems.push(out);const list=ground.get(key)??[];list.push(out);ground.set(key,list);}
   }
   markPileContentWrite379(working).quantity=plan.remaining;if(plan.complete)return true;if(working.quantity===oldQuantity)return false;
  }
 };
 try {
  for(let i=pod.order.length-1;i>=0;i--){const ref=pod.order[i]!;
   if(ref.kind==='item'){const source=originals.get(ref.id);if(!source||source.owner.type!=='starting-pod'||source.owner.podId!==pod.id)return fail('Initial item lost its actual holder');if(!placeItem(source))return fail('Actual GenPlace.Near exhausted for a held starting Thing');}
   else {const actor=ref.kind==='human'?pod.pawn:pod.animals.find(a=>a.id===ref.id);if(!actor||actor.id!==ref.id)return fail('Initial actor lost its actual holder');
    const thing:StartingPlaceThing256={id:actor.id,category:'pawn',quantity:1,stackLimit:1,downed:actor.state==='downed',saveCompressible:false},cell=findStartingPlaceNear256(pod.cell,thing,c=>read(c,thing));if(!cell)return fail('Actual GenPlace.Near exhausted for an original starting actor');
    const health=prepareStartingHeldClinicalResume256(actor.health,world.tick);entrants.push({actor,cell,health});spawned.push({cell,downed:actor.state==='downed'});
   }
  }
  if(!Number.isSafeInteger(nextId+1))return fail('Starting slag namespace exhausted');
  const slag:MaterialPile={id:nextId++,kind:'chunk',item:'slag-steel-chunk',quantity:1,owner:{type:'starting-pod',podId:pod.id}};
  if(!placeItem(slag))return fail('Actual GenPlace.Near exhausted for the new slag Thing');
 }catch(error){return fail(error instanceof Error?error.message:'Starting discharge refused');}
 const gear=pod.items.filter(p=>p.owner.type!=='starting-pod');
 if(pilesBefore.length+spawnedItems.length+gear.length>32768)return fail('Actual material owner capacity exhausted');
 const affected=[...changed.keys(),...pod.items,...entrants.map(p=>p.actor)];if(affected.some(o=>!mutable(o)))return fail('Starting originals are not mutable owners');
 const signatures=affected.map(o=>JSON.stringify(o)),podBefore=JSON.stringify(pod);
 let fog:ReturnType<typeof prepareStartingSpawnFog256>;try{fog=prepareStartingSpawnFog256(world,entrants);}catch(error){return fail(error instanceof Error?error.message:'Actual initial reveal refused');}
 let done=false;
 const current=()=>!done&&world.startingArrival===arrival&&arrival.pods.includes(pod)&&JSON.stringify(pod)===podBefore&&world.nextId===beforeId&&world.rng===beforeRng&&world.piles===pilesBefore&&world.pawns===pawnsBefore&&world.wildlife?.animals===animalsBefore&&pilesBefore.length===pileMembers.length&&pilesBefore.every((p,i)=>p===pileMembers[i])&&pawnsBefore.length===pawnMembers.length&&pawnsBefore.every((p,i)=>p===pawnMembers[i])&&(!animalsBefore||animalsBefore.length===animalMembers!.length&&animalsBefore.every((a,i)=>a===animalMembers![i]))&&affected.every((o,i)=>JSON.stringify(o)===signatures[i])&&fog.current();
 return {status:'ready',nextId,current,commit(){if(!current())throw Error('Starting discharge preflight is stale');done=true;
  for(const [original,next] of changed)adopt(original,next);
  const actualItems=spawnedItems.map(next=>{const original=originals.get(next.id);return original?adopt(original,next):next;});world.piles=[...pilesBefore,...actualItems,...gear];world.nextId=nextId;
  for(const {actor,cell,health}of entrants){actor.x=cell.x;actor.z=cell.z;actor.path=[];delete actor.motion;actor.arrivalRotation=0;if(health)actor.health=health;
   if('species'in actor){actor.nextDecision=world.tick;world.wildlife!.animals.push(actor);}else world.pawns.push(actor);
  }
  arrival.pods.splice(arrival.pods.indexOf(pod),1);arrival.openedCells.push({...pod.cell});
  // Schema 349, ActiveTransporter: the items a pod places (or tops up) in a
  // tutorial are its starting items; the slag of the pod is not one of them.
  if(world.gameProfile?.tutorial347?.lessons349)for(const pile of [...changed.keys(),...actualItems])if(pile.item!=='slag-steel-chunk')recordTutorialStartingItem349(world,pile.id);
  fog.commit();refreshStock(world);
 }};
}
