import {appendStructureEntries} from './structure-navigation.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {invalidateTerrainJournal} from './terrain-mutation-journal.ts';
import {draftForeignRoster261} from './caravan-foreign-roster-261.ts';
import {populateWorldTargetDefenders263} from './world-target-defence-263.ts';
import {newDoorState} from './door-rules.ts';
import {footprintCells} from './definitions.ts';
import {removedMineableTile256} from './local-mineable-owner-256.ts';
import {terrainSupportsAffordance256,terrainSupportsFloor256,terrainIsWater256} from './natural-terrain-runtime-256.ts';
import {buildingSupportNeed256} from './bridge-rules.ts';
import {captureGeographicGenerationReachability256} from './geographic-generation-reachability-256.ts';
import type {AncientRect256} from './local-ancient-placement-256.ts';
import type {WorldGenerationRandom} from './world-generation-random.ts';
import type {ItemStash263} from './world-sites-state-263.ts';
import type {World,Structure,Tile,Cell} from './types.ts';
export const SITE_OUTPOST_SEED_PART_263=398638181;
export interface SiteOutpostBuilt263 {rect:AncientRect256;defendSpot:Cell;turretsCount:0|1}
const overlaps=(a:AncientRect256,b:AncientRect256)=>a.minX<=b.maxX&&b.minX<=a.maxX&&a.minZ<=b.maxZ&&b.minZ<=a.maxZ;
/** Genuine16-cell Outpost next to the real RectOfInterest, not a Camp or an
 * alias of the foreign world settlement. Original finite wooden barracks,
 * beds and existing human roster are the declared3D/PNJ adaptation.
 * Optional real edge turret/power belongs to the following composition phase. */
export function constructSiteOutpost400263(w:World,site:ItemStash263,storage:AncientRect256,usedRects:AncientRect256[],random:WorldGenerationRandom):SiteOutpostBuilt263 {
 if(!isSchema263OrLater(Number(w.schemaVersion))||site.threat.kind!=='outpost'||site.factionId!==site.threat.factionId||!w.worldFactions?.factions.some(f=>f.id===site.factionId)||w.pawns.length||w.jobs.length||w.worldDefence263)throw Error('Actual unpublished Site Outpost400 required');
 const size=16,cx=Math.floor((storage.minX+storage.maxX)/2),cz=Math.floor((storage.minZ+storage.maxZ)/2),candidates=[{x:storage.minX-1-size,z:cz-size/2},{x:storage.maxX+1,z:cz-size/2},{x:cx-size/2,z:storage.minZ-1-size},{x:cx-size/2,z:storage.maxZ+1}].map(c=>({minX:c.x,minZ:c.z,maxX:c.x+size-1,maxZ:c.z+size-1}));
 const occupied=new Set(w.structures.flatMap(s=>footprintCells(s).map(c=>c.z*w.width+c.x))),reach=captureGeographicGenerationReachability256(w);
 const choices=candidates.filter(r=>{if(r.minX<0||r.minZ<0||r.maxX>=w.width||r.maxZ>=w.height||usedRects.some(u=>overlaps(r,u)))return false;let water=0;for(let z=r.minZ;z<=r.maxZ;z++)for(let x=r.minX;x<=r.maxX;x++){const c=z*w.width+x;if(occupied.has(c))return false;if(terrainIsWater256(w.tiles[c]!.terrain))water++;}return water<=size*size*.1&&reach.canReachMapEdgeNoPassClosedDoorsOrWater((r.minZ+8)*w.width+r.minX+8);});
 if(!choices.length)throw Error('Actual16-cell Outpost cannot be placed beside its storage');
 const rect=choices[random.integer(0,choices.length)]!,roster=draftForeignRoster261(w,'combat',site.threat.factionId,site.threat.points,(random.integerValue()>>>0)||1);
 if(!roster)throw Error('Actual current Outpost roster unavailable');
 let nextId=roster.nextId;const buildings:Structure[]=[],tiles=new Map<number,Tile>(),roofs:number[]=[],stands:number[]=[];
 const clear=(c:number)=>{const old=tiles.get(c)??w.tiles[c]!;if(old.mineable){const next=removedMineableTile256(old,old.mineable.id);if(!next)throw Error('Outpost Mineable owner cannot be retired');tiles.set(c,next);return next;}if(old.terrain==='rock'||old.collapsedRock)throw Error('Unresolved actual Outpost rock owner');return old;};
 const add=(kind:Structure['kind'],x:number,z:number)=>{const s:Structure={id:nextId++,kind,x,z,orientation:0,footprint:'standard',material:'wood',factionId:site.threat.kind==='outpost'?site.threat.factionId:null,...kind==='door'?{door:newDoorState(w.tick)}:{},...['bed','table','stool'].includes(kind)?{quality:'normal' as const}:{}};const support=buildingSupportNeed256(s);if(!support)throw Error('Outpost support definition missing');for(const p of footprintCells(s)){const c=p.z*w.width+p.x;if(p.x<rect.minX||p.x>rect.maxX||p.z<rect.minZ||p.z>rect.maxZ||occupied.has(c)||w.resources.some(r=>r.x===p.x&&r.z===p.z)||!terrainSupportsAffordance256(clear(c),support,w))throw Error('Actual Outpost building unsupported');occupied.add(c);}buildings.push(s);};
 // One bounded barracks leaves a real exterior guard strip on its eastern side.
 const room={minX:rect.minX,minZ:rect.minZ,maxX:rect.minX+13,maxZ:rect.maxZ};
 for(let z=room.minZ;z<=room.maxZ;z++)for(let x=room.minX;x<=room.maxX;x++){const c=z*w.width+x;if(x===room.minX||x===room.maxX||z===room.minZ||z===room.maxZ)add(x===room.maxX&&z===room.minZ+8?'door':'wall',x,z);else{const t=clear(c);if(!terrainSupportsFloor256(t,w))throw Error('Actual Outpost floor unsupported');tiles.set(c,{...t,floor:'wood-planks'});roofs.push(c);}}
 let beds=Math.min(36,roster.people.length);for(let z=room.minZ+1;z<=room.maxZ-2&&beds;z+=2)for(let x=room.minX+1;x<=room.maxX-3&&beds;x+=2){add('bed',x,z);beds--;}
 if(beds)throw Error('Actual Outpost barracks cannot hold its selected roster');
 for(let z=rect.minZ;z<=rect.maxZ;z++)for(let x=rect.minX;x<=rect.maxX;x++){const c=z*w.width+x;if(!occupied.has(c)&&(reach.physical.standable(c)||tiles.get(c)?.floor==='wood-planks'))stands.push(c);}
 // The finite original barracks never trims or rejects the selected humans.
 // Additional originals use genuine outdoor cells around the same base.
 if(stands.length<roster.people.length)for(let z=Math.max(0,rect.minZ-16);z<=Math.min(w.height-1,rect.maxZ+16);z++)for(let x=Math.max(0,rect.minX-16);x<=Math.min(w.width-1,rect.maxX+16);x++){
  if(x>=rect.minX&&x<=rect.maxX&&z>=rect.minZ&&z<=rect.maxZ)continue;const c=z*w.width+x;if(!occupied.has(c)&&reach.physical.standable(c)&&reach.canReachMapEdgeNoPassClosedDoorsOrWater(c))stands.push(c);
 }
 if(stands.length<roster.people.length||!Number.isSafeInteger(nextId))throw Error('Actual Outpost cannot place all selected defenders');
 for(const [c,t]of tiles)w.tiles[c]=t;invalidateTerrainJournal(w.tiles);appendStructureEntries(w,...buildings);w.nextId=nextId;w.roofing??={constructed:[],build:[],remove:[],cursor:0};const natural=new Set([...(w.roofing.natural?.thin??[]),...(w.roofing.natural?.thick??[])]);w.roofing.constructed=[...new Set([...w.roofing.constructed,...roofs.filter(c=>!natural.has(c))])].sort((a,b)=>a-b);usedRects.push(rect);
 const defendSpot={x:rect.minX+14,z:rect.minZ+8};populateWorldTargetDefenders263(w,{kind:'outpost',siteId:site.id},site.threat.factionId,roster,stands,defendSpot);
 return {rect,defendSpot,turretsCount:random.integer(0,2)as 0|1};
}
