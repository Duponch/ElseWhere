import {expect,vi} from 'vitest';
import {ITEM_DEFINITIONS} from '../../src/sim/items.ts';
import type {ItemId} from '../../src/sim/items.ts';
import type {MentalCrisis} from '../../src/sim/mental-state.ts';
type RecordedMentalKind=MentalCrisis['kind'];
import type {World} from '../../src/sim/types.ts';
import * as probedEating from '../../src/sim/eating.ts';
import { sameMapWorld } from './same-map.ts';

export const RATION_DEADLINE=17*6000;
export interface IngestionRecord {
  tick:number;pawnId:number;portionId:number;item:ItemId;quantity:number;
  source:'self'|'assisted';mentalKind:RecordedMentalKind|null;
}
interface LegacyBoundary {
  tick:number;rawLastSurvivalMealTick:number;checkpointSha256:string;
  boundary:'all-recorded-ingestions-before-or-at-102000';
}
export interface IngestionLedger {
  revision:1;observedFromTick:number;legacyBeforeDeadline?:LegacyBoundary;
  lastObservedOrdinarySurvivalMealTick:number;lateBingeSurvivalQuantity:number;
  lateBingeSurvivalByPawn:Record<number,number>;lateSurvivalMeals:IngestionRecord[];
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,allowed:readonly string[],required:readonly string[]=allowed)=>Object.keys(v).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(v,k));
const kinds:readonly (RecordedMentalKind|null)[]=[null,'sad-wander','food-binge','tantrum','berserk','murderous-rage','confused-wander'];
function validRecord(v:unknown,tick:number,nextId:number):v is IngestionRecord {
  return object(v)&&keys(v,['tick','pawnId','portionId','item','quantity','source','mentalKind'])
    &&integer(v.tick,0,tick)&&integer(v.pawnId,1,nextId-1)&&integer(v.portionId,1,nextId-1)&&integer(v.quantity,1)
    &&typeof v.item==='string'&&Object.hasOwn(ITEM_DEFINITIONS,v.item)&&ITEM_DEFINITIONS[v.item as ItemId].nutrition>0
    &&(v.source==='self'||v.source==='assisted')&&kinds.includes(v.mentalKind as RecordedMentalKind|null);
}
const impulsive=(r:IngestionRecord)=>r.source==='self'&&r.mentalKind==='food-binge';
export function createIngestionLedger(observedFromTick=0):IngestionLedger {
  if(!integer(observedFromTick))throw Error('Invalid ingestion observation boundary.');
  return {revision:1,observedFromTick,lastObservedOrdinarySurvivalMealTick:0,lateBingeSurvivalQuantity:0,lateBingeSurvivalByPawn:{},lateSurvivalMeals:[]};
}
/** An earlier bounded prefix gives a temporal bound, not a retroactive mental
 * classification. It cannot excuse even one unobserved late consumption. */
export function promoteLegacyIngestionLedger(tick:number,rawLastSurvivalMealTick:number,checkpointSha256:string):IngestionLedger {
  if(!integer(tick,0,RATION_DEADLINE)||!integer(rawLastSurvivalMealTick,0,tick)||!/^[a-f0-9]{64}$/i.test(checkpointSha256))
    throw Error('Instrumentation 3 can be promoted only at an authenticated prefix at or before tick102000; late ingestion cannot be reconstructed.');
  return {...createIngestionLedger(tick),legacyBeforeDeadline:{tick,rawLastSurvivalMealTick,checkpointSha256:checkpointSha256.toLowerCase(),boundary:'all-recorded-ingestions-before-or-at-102000'}};
}
/** Strict external notebook, including raw failure checkpoints. It is never a
 * game-state field and cannot repair a malformed or incomplete World. */
export function readIngestionLedger(value:unknown,tick:number,nextId=Number.MAX_SAFE_INTEGER):IngestionLedger {
  const allowed=['revision','observedFromTick','legacyBeforeDeadline','lastObservedOrdinarySurvivalMealTick','lateBingeSurvivalQuantity','lateBingeSurvivalByPawn','lateSurvivalMeals'];
  if(!integer(tick)||!integer(nextId,2)||!object(value)||!keys(value,allowed,allowed.filter(k=>k!=='legacyBeforeDeadline'))||value.revision!==1
    ||!integer(value.observedFromTick,0,tick)||!integer(value.lastObservedOrdinarySurvivalMealTick,0,tick)
    ||value.lastObservedOrdinarySurvivalMealTick!==0&&value.lastObservedOrdinarySurvivalMealTick<value.observedFromTick
    ||!integer(value.lateBingeSurvivalQuantity)||!object(value.lateBingeSurvivalByPawn)||!Array.isArray(value.lateSurvivalMeals))
    throw Error('Invalid ingestion instrumentation revision 1.');
  if(Object.hasOwn(value,'legacyBeforeDeadline')){
    const legacy=value.legacyBeforeDeadline;
    if(!object(legacy)||!keys(legacy,['tick','rawLastSurvivalMealTick','checkpointSha256','boundary'])
      ||legacy.boundary!=='all-recorded-ingestions-before-or-at-102000'||legacy.tick!==value.observedFromTick
      ||!integer(legacy.tick,0,RATION_DEADLINE)||!integer(legacy.rawLastSurvivalMealTick,0,legacy.tick)
      ||typeof legacy.checkpointSha256!=='string'||!/^[a-f0-9]{64}$/.test(legacy.checkpointSha256))throw Error('Invalid legacy ingestion boundary.');
  }
  let total=0,lastOrdinaryLate=0,lastTick=-1;const portions=new Set<number>(),byPawn:Record<number,number>={};
  for(const r of value.lateSurvivalMeals){
    if(!validRecord(r,tick,nextId)||r.item!=='survival-meal'||r.tick<=RATION_DEADLINE||r.tick<value.observedFromTick||r.tick<lastTick||portions.has(r.portionId))
      throw Error('Invalid or duplicated late physical ingestion.');
    portions.add(r.portionId);lastTick=r.tick;
    if(impulsive(r)){total+=r.quantity;byPawn[r.pawnId]=(byPawn[r.pawnId]??0)+r.quantity;}
    else lastOrdinaryLate=Math.max(lastOrdinaryLate,r.tick);
  }
  const stored=value.lateBingeSurvivalByPawn;
  if(!integer(total)||total!==value.lateBingeSurvivalQuantity||Object.keys(stored).length!==Object.keys(byPawn).length
    ||Object.keys(stored).some(k=>!/^\d+$/.test(k)||String(Number(k))!==k||!integer(Number(k),1,nextId-1)||!integer(stored[k],1)||stored[k]!==byPawn[Number(k)])
    ||value.lastObservedOrdinarySurvivalMealTick>RATION_DEADLINE&&value.lastObservedOrdinarySurvivalMealTick!==lastOrdinaryLate
    ||lastOrdinaryLate>RATION_DEADLINE&&value.lastObservedOrdinarySurvivalMealTick!==lastOrdinaryLate)
    throw Error('Ingestion totals disagree with the actual recorded portions.');
  return value as unknown as IngestionLedger;
}
export function ordinaryRationBoundary(ledger:IngestionLedger):number {
  return Math.max(ledger.legacyBeforeDeadline?.rawLastSurvivalMealTick??0,ledger.lastObservedOrdinarySurvivalMealTick);
}
export function observeIngestion(ledger:IngestionLedger,record:IngestionRecord):void {
  if(!validRecord(record,record.tick,Number.MAX_SAFE_INTEGER)||record.tick<ledger.observedFromTick)throw Error('Invalid physical ingestion record.');
  if(record.item!=='survival-meal')return;
  if(!impulsive(record))ledger.lastObservedOrdinarySurvivalMealTick=Math.max(ledger.lastObservedOrdinarySurvivalMealTick,record.tick);
  if(record.tick>RATION_DEADLINE){
    ledger.lateSurvivalMeals.push({...record});
    if(impulsive(record)){ledger.lateBingeSurvivalQuantity+=record.quantity;ledger.lateBingeSurvivalByPawn[record.pawnId]=(ledger.lateBingeSurvivalByPawn[record.pawnId]??0)+record.quantity;}
  }
  readIngestionLedger(ledger,record.tick);
}

// This leaf registers the mock before any engine/pilot import. The state is
// scoped to one original World; comparison forks and inactive tests are inert.
const ingestionProbe=vi.hoisted(()=>({world:null as World|null,records:[] as IngestionRecord[]}));
// Spy on the export binding every importer reads at call time
// (a vi.mock factory deadlocks: the probed modules import each other).
{
  const actual={processEating:probedEating.processEating};
  vi.spyOn(probedEating,'processEating').mockImplementation((...args:Parameters<typeof actual.processEating>)=>{
    const [world,pawn]=args;
    if(!sameMapWorld(ingestionProbe.world,world))return actual.processEating(...args);
    const task=pawn.need,portion=task?.kind==='eat'&&task.phase==='ingest'?world.piles.find(p=>p.id===task.carryPileId):undefined;
    // Capture the actual mental kind at physical ingestion; confused-wander
    // remains ordinary consumption. Only food-binge is impulsive below.
    const before=task?.kind==='eat'&&portion?.owner.type==='pawn'&&portion.owner.pawnId===pawn.id&&portion.quantity===task.quantity
      ?{tick:world.tick,pawnId:pawn.id,portionId:portion.id,item:portion.item,quantity:portion.quantity,source:'self' as const,mentalKind:pawn.mental?.crisis?.kind??null}:null;
    actual.processEating(...args);
    if(before&&pawn.need!==task&&!world.piles.some(p=>p.id===before.portionId)){
      expect(pawn.need).toBeNull();
      expect(world.events.some(e=>e.tick===world.tick&&e.message.startsWith(`${pawn.name} a mangé une portion (${before.quantity} × ${ITEM_DEFINITIONS[before.item].label}) `))).toBe(true);
      expect(ingestionProbe.records.some(r=>r.portionId===before.portionId)).toBe(false);
      ingestionProbe.records.push(before);
    }
  });
}
export function trackIngestionStep(world:World,step:()=>void):IngestionRecord[] {
  if(ingestionProbe.world!==null)throw Error('Nested ingestion instrumentation.');
  ingestionProbe.records=[];ingestionProbe.world=world;
  try{step();return ingestionProbe.records.slice();}finally{ingestionProbe.world=null;ingestionProbe.records=[];}
}
