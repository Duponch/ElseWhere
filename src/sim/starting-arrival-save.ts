import {isSchema256Or257} from './schema-compatibility-257.ts';
import {validCoreStartingArrivalShape256,validateCoreStartingArrivalOwners256} from './starting-pod-save-256.ts';
import {validCoreStartingArrivalTransition256} from './starting-pod-transition-256.ts';
import {CORE_STARTING_ARRIVAL_PROFILE_256} from './starting-pod-state-256.ts';
import { ARRIVING_CRASHLANDED_REVISION } from './scenario-definitions.ts';
import { STARTING_ARRIVAL_FALL_TICKS,STARTING_ARRIVAL_OPEN_DELAY,STARTING_ARRIVAL_PROFILE,type StartingArrivalState } from './starting-arrival-state.ts';
import { validatePawnRecordShape } from './pawn-record-save.ts';
import { validatePileRecordShape } from './material-record-save.ts';
import { newApparelState,type ApparelItem } from './apparel-rules.ts';
import { newWeaponState,type WeaponItem } from './equipment-rules.ts';
import { validSchedule } from './schedule.ts';
import { RECREATION_KINDS } from './recreation-rules.ts';
import type { NumericMembershipSink } from './numeric-membership.ts';
import type { World } from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,expected:readonly string[])=>Object.keys(v).length===expected.length&&expected.every(k=>Object.hasOwn(v,k));
const empty=(v:unknown)=>Array.isArray(v)&&v.length===0;
const sameFlat=(value:unknown,expected:object)=>object(value)&&Object.keys(value).length===Object.keys(expected).length
  &&Object.entries(expected).every(([key,v])=>value[key]===v);
/** Check descriptors before reading any nested value. Save/worker records have
 * no accessors, prototypes, holes, symbols or extra array properties. The
 * bounded walk also rejects cycles without invoking user-provided getters. */
function plainData(value:unknown):boolean {
  const seen=new Set<object>();let remaining=4096;
  const visit=(v:unknown,depth:number):boolean=>{
    if(--remaining<0||depth>16)return false;
    if(v===null||typeof v==='string'||typeof v==='boolean')return true;
    if(typeof v==='number')return Number.isFinite(v);
    if(typeof v!=='object'||seen.has(v))return false;
    const array=Array.isArray(v);
    if(Object.getPrototypeOf(v)!==(array?Array.prototype:Object.prototype))return false;
    seen.add(v);
    const own=Reflect.ownKeys(v);
    if(array&&(own.length!==v.length+1||!own.includes('length')))return false;
    for(const k of own){
      if(typeof k!=='string')return false;
      const d=Object.getOwnPropertyDescriptor(v,k);
      if(!d||!Object.hasOwn(d,'value'))return false;
      if(array&&k==='length')continue;
      if(!d.enumerable||array&&(!/^(0|[1-9][0-9]*)$/.test(k)||Number(k)>=v.length)||!visit(d.value,depth+1))return false;
    }
    seen.delete(v);return true;
  };
  return visit(value,0);
}
const cell=(v:unknown,w:Pick<World,'width'|'height'>):boolean=>object(v)&&keys(v,['x','z'])&&integer(v.x,0,w.width-1)&&integer(v.z,0,w.height-1);

/** Format only; original record guards and exclusive ownership run separately
 * against the REAL World before human capture or decoder adoption. */
export function validStartingArrivalShape(value:unknown,version:number,w:Pick<World,'tick'|'width'|'height'>):value is StartingArrivalState|undefined {
  if(value===undefined)return true;
  if(isSchema256Or257(version)&&plainData(value)&&object(value)&&value.profile===CORE_STARTING_ARRIVAL_PROFILE_256)return validCoreStartingArrivalShape256(value,version,w);
  if(version<231||!integer(w.tick)||!integer(w.width,1)||!integer(w.height,1)||!plainData(value)||!object(value)
    ||value.profile!==STARTING_ARRIVAL_PROFILE||value.start!==0||value.landAt!==STARTING_ARRIVAL_FALL_TICKS
    ||value.openAt!==STARTING_ARRIVAL_FALL_TICKS+STARTING_ARRIVAL_OPEN_DELAY)return false;
  if(value.phase==='opened')return keys(value,['profile','phase','start','landAt','openAt','openedAt','cells'])
    &&integer(value.openedAt,STARTING_ARRIVAL_FALL_TICKS+STARTING_ARRIVAL_OPEN_DELAY,w.tick)&&Array.isArray(value.cells)&&value.cells.length===3
    &&value.cells.every(c=>cell(c,w))&&new Set(value.cells.map(c=>`${c.x},${c.z}`)).size===3;
  if(!keys(value,['profile','phase','start','landAt','openAt','personalTick','pods'])||value.personalTick!==0
    ||(w.tick<STARTING_ARRIVAL_FALL_TICKS?value.phase!=='incoming':value.phase!=='landed')||!Array.isArray(value.pods)||value.pods.length!==3)return false;
  const cells=new Set<string>();
  for(const pod of value.pods){
    if(!object(pod)||!keys(pod,['id','cell','pawn','items','drops'])||!integer(pod.id,1)||!cell(pod.cell,w)||!object(pod.pawn)
      ||!Array.isArray(pod.items)||pod.items.length>16||!pod.items.every(object)||!Array.isArray(pod.drops)||pod.drops.length>16)return false;
    const c=pod.cell as {x:number;z:number},key=`${c.x},${c.z}`;if(cells.has(key))return false;cells.add(key);
    if(pod.drops.some(d=>!object(d)||!keys(d,['pileId','cell'])||!integer(d.pileId,1)||!cell(d.cell,w)))return false;
  }
  return true;
}

/** Schema 343: the only social state of a contained starting colonist is its
 * CrashedTogether opinion of the two others, dated tick 0. */
function crashedTogetherOnly343(social:unknown):boolean {
  if(!object(social)||!keys(social,['rng','memories'])||!integer(social.rng,1,0xffffffff)||!Array.isArray(social.memories)||social.memories.length!==2)return false;
  return social.memories.every(m=>object(m)&&keys(m,['otherId','kind','at','offset'])&&m.kind==='crashed-together'&&m.at===0&&m.offset===25&&integer(m.otherId,1))&&new Set(social.memories.map(m=>(m as {otherId:number}).otherId)).size===2;
}
const INITIAL_PAWN_KEYS=['id','name','x','z','appearance','age','health','medicalCare','skills','recreation','foodPolicyId',
  'apparelPolicyId','apparelAutomation','nextApparelCheckAt','schedule','restZeroTicks','collapsePending','hunger','rest','mood',
  'comfort','beauty','memories','orders','jobId','haul','cooking','need','bedId','needCooldown','state','priorities','path',
  'moveCooldown','planCooldown','traits','background','faction'];
function freshPawn(p:Record<string,unknown>,world:World,version:number):boolean {
  if(Object.keys(p).some(k=>!INITIAL_PAWN_KEYS.includes(k)&&!(k==='mental'&&isSchema256Or257(version)&&world.site?.revision===3&&world.climate?.revision===4&&world.planet?.revision===3)&&!(k==='social'&&version>=343&&crashedTogetherOnly343(p.social)))||!integer(p.id,1,world.nextId-1)||p.state!=='idle'
    ||p.faction!==undefined&&p.faction!=='colony'||p.jobId!==null||p.haul!==null||p.cooking!==null||p.need!==null||p.bedId!==null
    ||p.moveCooldown!==0||p.planCooldown!==0||p.needCooldown!==0||p.restZeroTicks!==0||p.collapsePending!==false
    ||!empty(p.path)||!empty(p.memories)||!object(p.orders)||!keys(p.orders,['active','queue'])||p.orders.active!==null||!empty(p.orders.queue)
    ||p.medicalCare!=='industrial'||p.foodPolicyId!==1||p.apparelPolicyId!==1||p.apparelAutomation!==true||p.nextApparelCheckAt!==0
    ||!validSchedule(p.schedule)||!world.foodPolicies.some(policy=>policy.id===p.foodPolicyId)
    ||!world.apparelPolicies?.some(policy=>policy.id===p.apparelPolicyId)||!object(p.recreation))return false;
  if(Object.hasOwn(p,'mental')){
    const m=p.mental;
    if(!isSchema256Or257(version)||world.site?.revision!==3||world.climate?.revision!==4||world.planet?.revision!==3||!object(m)||!keys(m,['below','cooldown','catharsis','wander'])||!Array.isArray(m.below)||m.below.length!==3||m.below.some(n=>n!==0)||m.cooldown!==0||!empty(m.catharsis)||!object(m.wander)||!keys(m.wander,['revision','nextMoveOrderIsWait'])||m.wander.revision!==1||m.wander.nextMoveOrderIsWait!==false)return false;
  }
  const joy=p.recreation;
  if(!keys(joy,['level','tolerance','bored','task'])||joy.task!==null||joy.level!==55||!object(joy.tolerance)||!object(joy.bored))return false;
  const tolerance=joy.tolerance,bored=joy.bored;
  if(!keys(tolerance,RECREATION_KINDS)||!keys(bored,RECREATION_KINDS)
    ||RECREATION_KINDS.some(k=>tolerance[k]!==0||bored[k]!==false))return false;
  if(p.health!==undefined){
    const h=p.health;
    if(!object(h)||Object.keys(h).some(k=>!['tick','nextInjuryId','injuries','missing','bloodLoss','ageAilments'].includes(k))
      ||h.tick!==0||h.nextInjuryId!==1||h.bloodLoss!==0||!empty(h.injuries)||!empty(h.missing))return false;
  }
  // The personal tick, not world.tick, validates skills, initial ailments and
  // memory clocks. No temporary Pawn is inserted in a map population.
  return validatePawnRecordShape(p,world,version,0).length===0;
}
const CARGO:Readonly<Record<string,number>>=Object.freeze({component:30,'survival-meal':50,medicine:30,silver:800,
  'bolt-action-rifle':1,revolver:1,'plasteel-knife':1,'flak-vest':1,'cloth-shirt':3});
/** Context and original records, without registering IDs or mutating World.
 * Pending may remain landed after openAt when the runtime cannot discharge
 * safely; its people still validate at their explicit personal tick zero. */
export function validateStartingArrivalOwners(w:World,version:number=w.schemaVersion):string[] {
  try {
    const d=Object.getOwnPropertyDescriptor(w,'startingArrival');
    if(d&&(!Object.hasOwn(d,'value')||d.value===undefined||!d.enumerable))return ['Invalid starting arrival field.'];
    const arriving=w.scenario?.id==='crashlanded'&&w.scenario.revision===ARRIVING_CRASHLANDED_REVISION;
    if(!d)return arriving||'startingArrival' in w?['Physical starting scenario has no arrival owner or receipt.']:[];
    const geographic=version>=256&&w.site?.revision===3&&w.climate?.revision===4&&w.planet?.revision===3;
    if(isSchema256Or257(version)&&plainData(d.value)&&object(d.value)&&d.value.profile===CORE_STARTING_ARRIVAL_PROFILE_256){if(!arriving||!geographic||!validCoreStartingArrivalShape256(d.value,version,w))return ['Invalid Core starting-arrival header.'];return validateCoreStartingArrivalOwners256(w,d.value);}
    if(!arriving||version<231||!validStartingArrivalShape(d.value,version,w)||!geographic&&(w.site?.revision!==2||w.climate?.revision!==2))
      return ['Invalid or future starting arrival provenance or phase.'];
    const a=d.value as Exclude<StartingArrivalState,import('./starting-pod-state-256.ts').CoreStartingArrival256>;if(a.phase==='opened')return [];
    if(!integer(w.nextId,1)||!Array.isArray(w.foodPolicies)||!Array.isArray(w.apparelPolicies))return ['Invalid initial policies or namespace.'];
    const ids=new Set<number>(),dropCells=new Set<string>(),totals=new Map<string,number>();
    const add=(id:unknown)=>integer(id,1,w.nextId-1)&&!ids.has(id)&&(ids.add(id),true);
    for(const pod of a.pods){
      if(!add(pod.id)||!add(pod.pawn.id)||pod.pawn.x!==pod.cell.x||pod.pawn.z!==pod.cell.z
        ||!freshPawn(pod.pawn as unknown as Record<string,unknown>,w,version))return ['Invalid initial contained person or duplicate arrival identity.'];
      const drops=new Map(pod.drops.map(d=>[d.pileId,d.cell]));
      if(drops.size!==pod.drops.length)return ['Duplicate starting arrival drop reference.'];
      let shirts=0,loose=0;
      for(const pile of pod.items){
        if(!add(pile.id)||!Object.hasOwn(CARGO,pile.item)||Object.keys(pile).some(k=>!['id','kind','item','quantity','owner','apparel','weapon'].includes(k))
          ||validatePileRecordShape(pile as unknown as Record<string,unknown>,w,version,0).length)return ['Invalid initial contained material or identity.'];
        const owner=pile.owner;
        if(owner.type==='apparel'){
          if(owner.pawnId!==pod.pawn.id||pile.item!=='cloth-shirt'||drops.has(pile.id))return ['Starting worn item belongs to another person.'];
          shirts++;
        }else if(owner.type==='starting-pod'){
          if(owner.podId!==pod.id||pile.item==='cloth-shirt'||!drops.has(pile.id))return ['Starting loose item has no real capsule or drop.'];
          const c=drops.get(pile.id)!,key=`${c.x},${c.z}`;
          if(dropCells.has(key)||a.pods.some(p=>p.cell.x===c.x&&p.cell.z===c.z))return ['Starting drop cells overlap.'];
          dropCells.add(key);loose++;
        }else return ['Starting material has a foreign owner.'];
        if(pile.kind==='apparel'){
          const expected=newApparelState(pile.item as ApparelItem,undefined,version);
          // A migrated pending original may still have unknown provenance.
          // Comparing must preserve that absence, never mint a clean proof.
          if(!Object.hasOwn(pile.apparel!,'corpseWear284'))delete expected.corpseWear284;
          if(!sameFlat(pile.apparel,expected))return ['Starting apparel is not fresh.'];
        }
        if(pile.kind==='weapon'&&!sameFlat(pile.weapon,newWeaponState(pile.item as WeaponItem)))return ['Starting weapon is not fresh.'];
        totals.set(pile.item,(totals.get(pile.item)??0)+pile.quantity);
      }
      if(shirts!==1||loose!==drops.size)return ['Starting possessions or drop references are incomplete.'];
    }
    if(Object.entries(CARGO).some(([item,quantity])=>totals.get(item)!==quantity))return ['Starting capsule dotation differs from its creation profile.'];
    if(w.piles.some(p=>p.owner.type==='starting-pod'))return ['Starting capsule item also occurs in map piles.'];
    return [];
  }catch{return ['Malformed starting arrival record.'];}
}

/** Only live owners reserve Thing IDs. The opened receipt contains just cells
 * and a confirmed tick; it registers no capsule, Pawn or material identity. */
export function registerStartingArrivalThingIds(w:World,ids:NumericMembershipSink):string[] {
  const a=w.startingArrival;if(!a)return [];
  const errors:string[]=[];
  if(a.profile===CORE_STARTING_ARRIVAL_PROFILE_256){
    // Tombstone IDs forbid namespace reuse; these scalars are not live owners.
    for(const receipt of a.destroyedPods??[]){if(!integer(receipt.id,1,w.nextId-1)||ids.has(receipt.id))errors.push('Destroyed capsule identity reused.');else ids.add(receipt.id);}
    if(a.phase==='opened')return errors;
    for(const pod of a.pods){const owned=[pod.id,pod.pawn.id,...pod.items.map(p=>p.id),...pod.animals.map(p=>p.id),...(pod.phase==='incoming'?[pod.skyfallerId]:[])];for(const id of owned){if(!integer(id,1,w.nextId-1)||ids.has(id))errors.push('Duplicate or invalid Core starting Thing owner.');else ids.add(id);}}
    return errors;
  }
  if(a.phase==='opened')return errors;
  for(const pod of a.pods)for(const entity of [pod,pod.pawn,...pod.items]){
    if(!integer(entity.id,1,w.nextId-1)||ids.has(entity.id))errors.push('Duplicate or invalid starting arrival Thing owner.');
    else ids.add(entity.id);
  }
  return errors;
}

/** Same accepted snapshot epoch only. Bounded to the three original pods:
 * custody is immutable until its one transfer; a receipt cannot resurrect it.
 * Callers replacing/reloading a World must start a new epoch instead. */
export function validStartingArrivalTransition(previous:World,next:World):boolean {
  const before=previous.startingArrival,after=next.startingArrival;
  if(before?.profile===CORE_STARTING_ARRIVAL_PROFILE_256||after?.profile===CORE_STARTING_ARRIVAL_PROFILE_256)return validCoreStartingArrivalTransition256(previous,next);
  if(!before&&!after)return true;
  if(!before||!after||!plainData(before)||!plainData(after))return false;
  const same=(a:unknown,b:unknown):boolean=>{
    if(a===b)return true;
    if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
    const ak=Object.keys(a),bk=Object.keys(b);if(ak.length!==bk.length)return false;
    return ak.every(k=>Object.hasOwn(b,k)&&same((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
  };
  if(before.phase==='opened')return after.phase==='opened'&&same(before,after);
  if(after.phase!=='opened')return (before.phase!=='landed'||after.phase==='landed')&&same(before.pods,after.pods);
  if(after.openedAt<previous.tick||!same(before.pods.map(p=>p.cell),after.cells))return false;
  // A later snapshot may already contain ordinary work, meals, damage or a
  // departure. It proves the receipt's monotone phase, not exhaustive cargo
  // transfer. At the exact opening boundary none of the held actors has acted:
  // every original must exist on map with only the specified custody changes.
  if(next.tick>after.openedAt)return true;
  if(next.tick!==after.openedAt)return false;
  for(const pod of before.pods){
    const pawns=next.pawns.filter(p=>p.id===pod.pawn.id);
    const pawn={...pod.pawn,...pod.pawn.health?{health:{...pod.pawn.health,tick:after.openedAt}}:{}};
    if(pawns.length!==1||!plainData(pawns[0])||!same(pawn,pawns[0]))return false;
    for(const item of pod.items){
      const piles=next.piles.filter(p=>p.id===item.id),drop=pod.drops.find(d=>d.pileId===item.id);
      if(item.owner.type==='starting-pod'&&!drop)return false;
      const pile={...item,...item.owner.type==='starting-pod'?{owner:{type:'ground',...drop!.cell}}:{},
        ...item.rot?{rot:{...item.rot,atTick:after.openedAt}}:{}};
      if(piles.length!==1||!plainData(piles[0])||!same(pile,piles[0]))return false;
    }
  }
  return true;
}
