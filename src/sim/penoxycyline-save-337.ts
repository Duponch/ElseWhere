import {isPenoxycyline337,PENOXYCYLINE_FACTS_337} from './penoxycyline-337.ts';
import {isColonist} from './affiliation.ts';
import type {MaterialPile,Pawn,World} from './types.ts';

/* Schema 337: shape of a scheduled penoxycyline intake. The ordinary eat
 * validation already owns reservation, carried unit, dining place and state;
 * this guard closes the marked task and its actual drug unit. */
const data=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype
 &&Reflect.ownKeys(v).every(k=>typeof k==='string'&&!!Object.getOwnPropertyDescriptor(v,k)?.enumerable&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const int=(v:unknown,lo=0,hi=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const KEYS=['kind','drugReason337','phase','sourcePileId','carryPileId','quantity','progress','workRemainder','dining'];
export const hasPenoxycylineIntake337=(pawn:{need?:unknown}):boolean=>!!pawn.need&&typeof pawn.need==='object'&&'drugReason337'in pawn.need;
export function validPenoxycylineIntake337(pawn:Pawn,version:number,world:Pick<World,'piles'|'nextId'>,local:boolean):boolean {
 if(!hasPenoxycylineIntake337(pawn))return true;
 const t=pawn.need as unknown;
 if(!isPenoxycyline337(version)||!local||!data(t)||!Object.keys(t).every(k=>KEYS.includes(k))||!['kind','drugReason337','phase','sourcePileId','carryPileId','quantity','progress','dining'].every(k=>Object.hasOwn(t,k)))return false;
 if(t.kind!=='eat'||t.drugReason337!=='scheduled'||!['pickup','choose-spot','travel','ingest'].includes(t.phase as string)||t.quantity!==1||!int(t.progress,0,PENOXYCYLINE_FACTS_337.ingestTicks-1)||!int(t.sourcePileId,1,world.nextId-1))return false;
 if(t.phase==='pickup'?t.carryPileId!==null:!int(t.carryPileId,1,world.nextId-1))return false;
 if(t.phase!=='ingest'&&(t.progress!==0||Object.hasOwn(t,'workRemainder'))||Object.hasOwn(t,'workRemainder')&&!int(t.workRemainder,1,9999))return false;
 if((t.phase==='pickup'||t.phase==='choose-spot')&&t.dining!==null)return false;
 if(!isColonist(pawn)||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue||pawn.draft||pawn.orders.active!==null||pawn.health?.body!==undefined||pawn.health?.death)return false;
 const pile:MaterialPile|undefined=world.piles.find(p=>p.id===(t.phase==='pickup'?t.sourcePileId:t.carryPileId));
 if(!pile||pile.kind!=='drug'||pile.item!=='penoxycyline'||pile.quantity<1)return false;
 // Taking from the own inventory happens at once, without any travel.
 if(t.phase==='pickup'&&pile.owner.type==='inventory'&&(pile.owner.pawnId!==pawn.id||pawn.path.length>0))return false;
 return true;
}
