import {assignPileOwner} from './pile-index.ts';
import {isSchema271OrLater} from './schema-compatibility-257.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {nearbyGround,groundCapacity,groundPile} from './ground-placement.ts';
import {canStandAt,FURNITURE_TRAVEL} from './furniture-travel.ts';
import {FILTH_DEFINITIONS,ensureFilth} from './filth-rules.ts';
import {addFilth} from './filth.ts';
import {notifyActualExplorationSpawn256} from './exploration-runtime-256.ts';
import {refreshStock} from './materials.ts';
import {reconcilePawnHealth} from './health.ts';
import {reconcileAnimalHealth} from './wildlife-health.ts';
import {medicalStatus} from './injury-state.ts';
import {partitionAncientNear256,ancientCasketOpeningGroup256,ancientCasketInteraction256,ancientCasketHasContents256,isAncientCasket256,type AncientCasket256,type AncientHeldPile256} from './ancient-casket-state-256.ts';
import {prepareAncientResumeClock256} from './ancient-casket-clock-256.ts';
import {validateAncientCasketOwners256} from './ancient-casket-save-256.ts';
import {addCryptosleepSickness256,type CryptosleepSicknessRandom256} from './cryptosleep-sickness-256.ts';
import {createMedicalRecord,reconcileMedicalDeath} from './injury-state.ts';
import {healthRandom} from './health.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import type {Cell,MaterialPile,Pawn,World} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
type MovedActor={actor:Pawn|WildAnimal;cell:Cell;human:boolean};
type MovedPile={pile:AncientHeldPile256;cell?:Cell};
export type AncientReleasePlan256={ok:false;reason:string}|{ok:true;targetWillBeEmpty:boolean;commit():{ok:boolean;moved:number;retained:number}};
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
/** Real gameplay word stream, not a float reinterpreted as an invented seed.
 * Each integer/Int request consumes exactly one existing healthRandom word. */
export function ancientCasketEjectionRandom256(source:Pick<World,'rng'>):CryptosleepSicknessRandom256 {
 const word=()=>{healthRandom(source);return source.rng|0;};
 return {integer:(min,max)=>{if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max)||max<=min)throw Error('Invalid actual casket random range');return min+Math.abs(word()%(max-min));},integerValue:word};
}
/** A real eject operation at its true owner clock. Dead humans are represented
 * by their original corpse Thing, which does not acquire a new Pawn Hediff. */
export function applyAncientHumanEjectionSickness256(pawn:Pawn,clock:number,random:CryptosleepSicknessRandom256,version=270):void {
 if(!Number.isSafeInteger(clock)||clock<0)throw Error('Invalid actual ejection clinical clock');
 if(pawn.state==='dead'||pawn.health?.death){if(pawn.state!=='dead'||!pawn.health?.death||(isSchema271OrLater(version)?medicalCivilTick271(pawn.health):pawn.health.tick)!==pawn.health.death.tick||pawn.health.death.tick>clock)throw Error('Invalid original terminal ejection owner');return;}
 if(pawn.health&&((isSchema271OrLater(version)?medicalCivilTick271(pawn.health):pawn.health.tick)!==clock||pawn.health.body!==undefined))throw Error('Invalid original human ejection clinical owner');
 const record=pawn.health??createMedicalRecord(clock);addCryptosleepSickness256(record,random,256);reconcileMedicalDeath(record);pawn.health=record;
}
/** Original map only. Connected Near candidates and ground capacity are reused;
 * no World clone, alternate map, synthetic Pawn or item merge is involved. */
export function planAncientCasketRelease256(w:World,target:AncientCasket256,releaseRng=w.rng):AncientReleasePlan256 {
 if(!Number.isSafeInteger(releaseRng)||releaseRng<0||releaseRng>0xffffffff)return {ok:false,reason:'Invalid actual incoming casket gameplay stream.'};
 const all=w.structures.filter(isAncientCasket256) as unknown as AncientCasket256[];
 if(!isSchema256Or257(w.schemaVersion)||!all.includes(target)||!ancientCasketHasContents256(target.casket))return {ok:false,reason:'Actual nonempty ancient casket required.'};
 if(!Object.hasOwn(FURNITURE_TRAVEL,'ancient-cryptosleep-casket')||!Object.hasOwn(FILTH_DEFINITIONS,'slime'))return {ok:false,reason:'Named casket geometry/Slime integration splices are not installed.'};
 const errors=validateAncientCasketOwners256(w);if(errors.length)return {ok:false,reason:errors[0]!};
 const group=ancientCasketOpeningGroup256(all,target),unknown=!target.casket.contentsKnown;
 if(group.some(c=>c.casket.humans.some(p=>String(p.faction)==='ancients-hostile')))return {ok:false,reason:'Real AncientsHostile lord admission is required before releasing these actual humans.'};
 if(group.some(c=>c.casket.animals.length)&&!w.wildlife)return {ok:false,reason:'Original live animal owner is absent.'};
 const used=new Set<number>(),actors:MovedActor[]=[],items:MovedPile[]=[],parts:{c:AncientCasket256;actors:MovedActor[];items:MovedPile[];clock:ReturnType<typeof prepareAncientResumeClock256>}[]=[];
 const occupied=(cell:Cell)=>w.pawns.some(p=>same(p,cell)||p.motion&&p.motion.end>w.tick&&(same(p.motion.from,cell)||same(p.motion.to,cell)))||!!w.wildlife?.animals.some(a=>same(a,cell)||a.motion&&a.motion.end>w.tick&&(same(a.motion.from,cell)||same(a.motion.to,cell)))||!!w.mechanoids?.some(a=>same(a,cell));
 for(const c of group){
  const s=c.casket,origin=ancientCasketInteraction256(c),near=nearbyGround(w,origin),localActors:MovedActor[]=[],localItems:MovedPile[]=[];
  const reserve=(item?:AncientHeldPile256)=>{
   const cell=near.find(v=>!used.has(v.z*w.width+v.x)&&canStandAt(w,v)&&!occupied(v)&&!groundPile(w,v)&&!w.packed.some(p=>p.owner.type==='ground'&&same(p.owner,v))&&(!item||groundCapacity(w,v,item as MaterialPile)>=item.quantity));
   if(cell)used.add(cell.z*w.width+cell.x);return cell;
  };
  // A directly held corpse is the physical root of its original dead human.
  for(const pile of s.items)if(pile.owner.type==='ancient-casket'){const cell=reserve(pile);if(cell)localItems.push({pile,cell});}
  for(const pawn of s.humans){
   const cell=pawn.state==='dead'?localItems.find(p=>p.pile.id===pawn.body?.pileId&&p.pile.humanCorpse?.pawnId===pawn.id)?.cell:reserve();
   if(cell)localActors.push({actor:pawn,cell,human:true});
  }
  for(const animal of s.animals){const cell=reserve();if(cell)localActors.push({actor:animal,cell,human:false});}
  const movedIds=new Set(localActors.map(p=>p.actor.id));
  // A corpse cannot leave while its original identity remains in the holder.
  for(let i=localItems.length-1;i>=0;i--)if(localItems[i]!.pile.humanCorpse&&!movedIds.has(localItems[i]!.pile.humanCorpse!.pawnId))localItems.splice(i,1);
  for(const pile of s.items)if(pile.owner.type!=='ancient-casket'&&'pawnId'in pile.owner&&movedIds.has(pile.owner.pawnId))localItems.push({pile});
  let clock:ReturnType<typeof prepareAncientResumeClock256>;
  try{clock=prepareAncientResumeClock256({...s,humans:localActors.filter(p=>p.human).map(p=>p.actor as Pawn),animals:localActors.filter(p=>!p.human).map(p=>p.actor as WildAnimal),items:localItems.map(p=>p.pile)},w.tick,w.schemaVersion);}catch(error){return {ok:false,reason:String(error)};}
  actors.push(...localActors);items.push(...localItems);parts.push({c,actors:localActors,items:localItems,clock});
 }
 if(w.pawns.length+actors.filter(a=>a.human).length>w.width*w.height||w.piles.length+items.length>32768||w.wildlife&&w.wildlife.animals.length+actors.filter(a=>!a.human).length>256)return {ok:false,reason:'The real receiving owner capacity is exhausted.'};
 // Preflight the actual clinical additions on record-only drafts and the
 // captured gameplay stream. If this factor would kill a still-held original,
 // the required true corpse materialization inside this holder is not yet
 // composed. Refuse before clocks/owners/RNG are changed, never cure or reroll.
 const clinicalState={rng:releaseRng},clinicalRandom=ancientCasketEjectionRandom256(clinicalState);
 for(const part of parts){const moved=new Set(part.actors.filter(a=>a.human).map(a=>a.actor));for(const p of part.c.casket.humans){
  if(p.state==='dead'||p.health?.death)continue;const clock=moved.has(p)?w.tick:part.c.casket.heldAt,record=p.health?structuredClone(p.health):createMedicalRecord(clock);if(isSchema271OrLater(w.schemaVersion)){if(record.tick!==clock)record.civilTick271=clock;}else record.tick=clock;
  addCryptosleepSickness256(record,clinicalRandom,256);reconcileMedicalDeath(record);
  if(record.death)return {ok:false,reason:'Actual fatal ejection requires original corpse materialization/held transfer; original holder retained.'};
 }}
 // Cold command boundary only; not a snapshot/frame cache.
 const witness=(c:AncientCasket256)=>JSON.stringify({id:c.id,x:c.x,z:c.z,orientation:c.orientation,casket:c.casket});
 const witnesses=group.map(witness),originals=group.map(c=>({state:c.casket,humans:c.casket.humans,animals:c.casket.animals,items:c.casket.items,people:[...c.casket.humans],beasts:[...c.casket.animals],things:[...c.casket.items]})),tick=w.tick,nextId=w.nextId,rng=w.rng;
 const actualOriginals=(c:AncientCasket256,i:number)=>{const old=originals[i]!;return c.casket===old.state&&c.casket.humans===old.humans&&c.casket.animals===old.animals&&c.casket.items===old.items&&old.humans.length===old.people.length&&old.humans.every((p,i)=>p===old.people[i])&&old.animals.length===old.beasts.length&&old.animals.every((a,i)=>a===old.beasts[i])&&old.items.length===old.things.length&&old.items.every((p,i)=>p===old.things[i]);};
 const targetPart=parts.find(part=>part.c===target)!;
 const targetWillBeEmpty=targetPart.actors.length===target.casket.humans.length+target.casket.animals.length&&targetPart.items.length===target.casket.items.length;
 let spent=false;
 return {ok:true,targetWillBeEmpty,commit(){
  if(spent||w.tick!==tick||w.nextId!==nextId||w.rng!==rng||validateAncientCasketOwners256(w).length||parts.some((p,i)=>!w.structures.includes(p.c as unknown as World['structures'][number])||witness(p.c)!==witnesses[i]||!actualOriginals(p.c,i)||!p.clock.current()))return {ok:false,moved:0,retained:0};
  if(actors.some(a=>occupied(a.cell)||!canStandAt(w,a.cell))||items.some(i=>i.cell&&(groundPile(w,i.cell)||groundCapacity(w,i.cell,i.pile as MaterialPile)<i.pile.quantity)))return {ok:false,moved:0,retained:0};
  spent=true;w.rng=releaseRng;
  const partitions=parts.map(part=>partitionAncientNear256(part.c.casket,new Set(part.actors.map(p=>p.actor.id)),new Set(part.items.filter(i=>i.cell).map(i=>i.pile.id))));
  // Every remaining operation has been preflighted; original record references
  // move exactly once. Failed Near Things remain owned by the same holder.
  for(const p of parts){if(!p.clock.commit())throw Error('Casket clock changed inside synchronous commit');}
  for(const a of actors){a.actor.x=a.cell.x;a.actor.z=a.cell.z;if(a.human)w.pawns.push(a.actor as Pawn);else w.wildlife!.animals.push(a.actor as WildAnimal);}
  for(const i of items){if(i.cell)assignPileOwner(i.pile,{type:'ground',...i.cell});w.piles.push(i.pile as MaterialPile);}
  const random=()=>healthRandom(w),clinicalRandom=ancientCasketEjectionRandom256(w);
  for(let index=0;index<parts.length;index++){
   const part=parts[index]!,s=part.c.casket,moved=new Set(part.actors.map(p=>p.actor));
   for(const human of s.humans){applyAncientHumanEjectionSickness256(human,moved.has(human)?w.tick:s.heldAt,clinicalRandom,w.schemaVersion);if(human.state!=='dead'){ensureFilth(w);const feet=human.filthFeet??={carried:[]};const slime=feet.carried.find(f=>String(f.kind)==='slime');if(slime)slime.thickness=Math.min(5,slime.thickness+1);else feet.carried.push({kind:'slime',thickness:1});}}
   // validateAncientCasketOwners256 keeps the animal lane explicitly closed:
   // no human surrogate, clinical birth rewrite or new suspension tracker.
   const partition=partitions[index]!;
   s.humans=partition.retainedHumans;s.animals=partition.retainedAnimals;s.items=partition.retainedItems;s.contentsKnown=true;
   for(const human of s.humans)if(human.health&&!human.health.death&&medicalStatus(human.health)==='downed')human.state='downed';
  }
  // Only the initially unknown initiator runs Ancient's extra map Slime pass;
  // sibling contentsKnown was set before its base ejection in the primary.
  if(unknown)addFilth(w,target,'slime',8+Math.floor(random()*4));
  for(const a of actors){if(a.human)reconcilePawnHealth(w,a.actor as Pawn);else reconcileAnimalHealth(w,a.actor as WildAnimal);notifyActualExplorationSpawn256(w,a.actor);}
  // Sibling opens may empty another reserved casket in this same commit.
  // Retire only that intent; a previously captured movement edge stays real.
  for(const p of w.pawns)if(p.openCasket&&parts.some(part=>part.c.id===p.openCasket!.casketId&&!ancientCasketHasContents256(part.c.casket))){delete p.openCasket;p.path=[];p.planCooldown=0;if(p.moveCooldown===0&&(p.motion?.end??0)<=w.tick&&['moving','working'].includes(p.state))p.state='idle';}
  refreshStock(w);
  return {ok:true,moved:actors.length+items.length,retained:group.reduce((n,c)=>n+c.casket.humans.length+c.casket.animals.length+c.casket.items.length,0)};
 }};
}
/** Destruction is never treated as a free Open. Empty KillFinalize now uses
 * its actual leavings/Flame lane; nonempty terminal owners remain explicit. */
export function ancientCasketDestructionRefusal256(c:AncientCasket256,mode:'deconstruct'|'kill-finalize'|'vanish'):string|null {
 return c.casket.humans.length||c.casket.animals.length||c.casket.items.length?`Nonempty ${mode} requires the original contents transaction; holder retained.`:null;
}
