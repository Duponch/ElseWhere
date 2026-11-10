import {assignPileOwner} from './pile-index.ts';
import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {effectiveCore297 as frontierCore297} from './core-phase-297.ts';
import {validAiCoreInformationReceipt298} from './faction-comms-save-298.ts';
import {validAiCorePile298} from './victory-content-save-298.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {plainWorldPawnData256} from './world-pawn-save-256.ts';
import {captureActualLocalDistricts256} from './actual-local-districts-256.ts';
import {rotAge} from './food-preservation.ts';
import type {AncientRect256} from './local-ancient-placement-256.ts';
import type {ItemStash263} from './world-sites-state-263.ts';
import type {CampaignState} from './world-map-state.ts';
import type {World,MaterialPile} from './types.ts';

const writable=(o:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(o,k);return d?Object.hasOwn(d,'value')&&d.writable===true:!(k in o)&&Object.isExtensible(o);};
const arrayWritable=(a:unknown[])=>Object.isExtensible(a)&&Object.getOwnPropertyDescriptor(a,'length')?.writable===true;
export interface SiteHolderTransfer263 {current():boolean;commit():void}
/** Existing things remain in the real non-ticked Site until full generation
 * has succeeded. Every stack gets a physical supported cell; no merge,
 * re-created reward, remote collection or second ownership interval. */
export function prepareItemStashTransfer263(root:CampaignState,source:ItemStash263,map:World,mapId:number,storage:AncientRect256):SiteHolderTransfer263|null {
 const paid=Object.getOwnPropertyDescriptor(source,'aiCoreInformation298')?.value as import('./faction-comms-state-298.ts').AiCoreInformationReceipt298|undefined;
 const paidCurrent=isSchema298OrLater(Number(root.schemaVersion))&&!!paid,atCore=paidCurrent?frontierCore297(root):root.tick*10;
 if('aiCoreInformation298'in source&&(!paidCurrent||!validAiCoreInformationReceipt298(source,Number(root.schemaVersion),root.nextId,root.tick,atCore)))return null;
 // This preflight only strengthens the paid298 transfer. Historical holders
 // retain their literal path; the complete generation/RAW namespace stays required.
 if(paidCurrent&&!plainWorldPawnData256(source))return null;
 const registry=root.worldSites263,entries=registry?.entries,items=source.items,originals=items.slice(),piles=map.piles,localItems=piles.slice();
 if(!isSchema263OrLater(Number(root.schemaVersion))||!isSchema263OrLater(Number(map.schemaVersion))||!registry||!entries?.includes(source)||source.closed||source.mapId!==null||source.expiresAtCore===null||source.expiresAtCore<=atCore||!items.length||map.tick!==root.tick||!Number.isSafeInteger(mapId)||mapId<0)return null;
 if(originals.some(p=>p.owner.type!=='world-site263'||p.owner.siteId!==source.id))return null;
 const capturedNextId=root.nextId;
 // Local PILE collision check, not a replacement for campaign identity admission.
 // Re-read IDs at commit: a stable array/object reference does not seal its ID.
 const paidOriginalCurrent=()=>!paidCurrent||isSchema298OrLater(Number(root.schemaVersion))&&isSchema298OrLater(Number(map.schemaVersion))&&root.nextId===capturedNextId
  &&plainWorldPawnData256(source)&&plainWorldPawnData256(piles)&&originals.length===1&&items.length===1&&items[0]===originals[0]
  &&validAiCorePile298(originals[0],298)&&originals[0]!.id===paid!.coreId&&originals[0]!.id<capturedNextId
  &&originals[0]!.owner.type==='world-site263'&&originals[0]!.owner.siteId===source.id&&Reflect.ownKeys(originals[0]!.owner).length===2
  &&!piles.some(p=>p.id===originals[0]!.id);
 if(!paidOriginalCurrent())return null;
 const physical=captureActualLocalDistricts256(map),cells:number[]=[];
 for(let z=storage.minZ+1;z<storage.maxZ;z++)for(let x=storage.minX+1;x<storage.maxX;x++){
  const cell=z*map.width+x;if(x>=0&&z>=0&&x<map.width&&z<map.height&&physical.standable(cell)&&!physical.edifice(cell)&&!piles.some(p=>p.owner.type==='ground'&&p.owner.x===x&&p.owner.z===z)&&!map.resources.some(r=>r.x===x&&r.z===z))cells.push(cell);
 }
 if(cells.length<items.length)return null;
 const placements=originals.map((pile,i)=>({pile,...paidCurrent&&pile.id===paid!.coreId?{forbidden:true as const}:{},owner:{type:'ground' as const,x:cells[i]!%map.width,z:Math.floor(cells[i]!/map.width)},...pile.rot?{rot:{progress:rotAge(pile,source.heldAtCore/10),atTick:map.tick}}:{}}));
 const owners=originals.map(p=>p.owner),rots=originals.map(p=>p.rot),before=JSON.stringify(source),tick=root.tick;
 const recipients=()=>['items','mapId','expiresAtCore'].every(k=>writable(source,k))&&arrayWritable(piles)&&originals.every(p=>writable(p,'owner')&&(!p.rot||writable(p,'rot'))&&(!paidCurrent||p.id!==paid!.coreId||writable(p,'forbidden')));
 let used=false;
 const current=()=>!used&&(!paidCurrent||frontierCore297(root)===atCore)&&plainWorldPawnData256(source)&&root.tick===tick&&root.worldSites263===registry&&registry.entries===entries&&entries.includes(source)&&source.items===items&&items.length===originals.length&&items.every((p,i)=>p===originals[i]&&p.owner===owners[i]&&p.rot===rots[i])&&JSON.stringify(source)===before&&map.piles===piles&&piles.length===localItems.length&&piles.every((p,i)=>p===localItems[i])&&paidOriginalCurrent()&&recipients();
 if(!current())return null;
 return {current,commit(){if(!current())throw Error('Actual Site holder changed before its atomic map transfer');used=true;for(const p of placements){assignPileOwner(p.pile,p.owner);if(p.forbidden)p.pile.forbidden=true;if(p.rot)p.pile.rot=p.rot;}piles.push(...originals);source.items=[];source.mapId=mapId;source.expiresAtCore=null;}};
}
/** TimeoutComp's object destruction is prohibited while a Map exists. The
 * closed receipt owns only scalar lost identities; no hidden physical stock.
 * This executes in real SIM time, never during save admission/migration. */
export function expireWorldSites263(root:CampaignState):void {
 if(!isSchema263OrLater(Number(root.schemaVersion)))return;
 const registry=root.worldSites263;if(!registry)return;const atCore=root.tick*10;
 for(const entry of registry.entries){if(entry.kind!=='item-stash'||entry.closed||entry.mapId!==null||entry.expiresAtCore===null||entry.expiresAtCore>atCore)continue;
  entry.closed={atCore,reason:'expired',lost:entry.items.map(p=>({id:p.id,item:p.item,quantity:p.quantity}))};entry.items=[];
 }
}
/** The campaign physical census visits these originals exactly once. A
 * projection may name their IDs but must never carry another pile array. */
export function siteOwnedThings263(root:Pick<CampaignState,'schemaVersion'|'worldSites263'>):MaterialPile[] {
 if(!isSchema263OrLater(Number(root.schemaVersion)))return [];
 return root.worldSites263?.entries.flatMap(s=>s.kind==='item-stash'&&!s.closed?s.items:[])??[];
}
