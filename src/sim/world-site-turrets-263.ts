import {appendStructureEntries} from './structure-navigation.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {footprintCells} from './definitions.ts';
import {captureGeographicGenerationReachability256} from './geographic-generation-reachability-256.ts';
import {captureActualLocalDistricts256} from './actual-local-districts-256.ts';
import {terrainSupportsAffordance256} from './natural-terrain-runtime-256.ts';
import {isRoofed} from './roof-rules.ts';
import {newMiniTurretState} from './mini-turret-state.ts';
import {newPowerState} from './power-rules.ts';
import {BATTERY_CAPACITY} from './power-battery.ts';
import {isPowerTransmitter} from './power-grid.ts';
import {reconcilePower} from './power.ts';
import {draftForeignRoster261} from './caravan-foreign-roster-261.ts';
import {populateWorldTargetDefenders263} from './world-target-defence-263.ts';
import {WORLD_FACTION_TECH_LEVEL_259} from './world-faction-catalog.ts';
import {buildingSupportNeed256} from './bridge-rules.ts';
import type {World,Structure,Cell} from './types.ts';
import type {ItemStash263} from './world-sites-state-263.ts';
import type {AncientRect256} from './local-ancient-placement-256.ts';
import type {WorldGenerationRandom} from './world-generation-random.ts';

export const SITE_TURRETS_SEED_PART_263=895502705;
export const SITE_POWER_SEED_PART_263=1186199651;
const inside=(c:Cell,r:AncientRect256)=>c.x>=r.minX&&c.x<=r.maxX&&c.z>=r.minZ&&c.z<=r.maxZ;
function actual(w:World,siteId:number,factionId:number):void {
 const geography=w.site;if(!isSchema263OrLater(Number(w.schemaVersion))||geography?.revision!==3||!w.worldSites263?.entries.some(s=>s.id===siteId&&s.kind==='item-stash'&&!s.closed&&s.tile===geography.tileId&&s.factionId===factionId)||!w.worldFactions?.factions.some(f=>f.id===factionId&&f.id!==w.worldFactions!.playerFactionId))throw Error('Actual foreign Site faction required');
}
function clear(w:World,s:Structure,unroofed=false):boolean {
 const support=buildingSupportNeed256(s);if(!support)return false;
 const cells=footprintCells(s);return cells.every(c=>c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height&&terrainSupportsAffordance256(w.tiles[c.z*w.width+c.x]!,support,w)&&!w.tiles[c.z*w.width+c.x]!.mineable&&(!unroofed||!isRoofed(w,c.z*w.width+c.x))&&!w.structures.some(b=>footprintCells(b).some(p=>p.x===c.x&&p.z===c.z))&&!w.resources.some(r=>r.x===c.x&&r.z===c.z)&&!w.piles.some(p=>p.owner.type==='ground'&&p.owner.x===c.x&&p.owner.z===c.z)&&!w.pawns.some(p=>p.x===c.x&&p.z===c.z));
}
function append(w:World,s:Structure):void {if(!Number.isSafeInteger(w.nextId+1))throw Error('Site mechanical building namespace exhausted');appendStructureEntries(w,s);w.nextId++;}
/** Actual edgeDefence subset: current mini-turrets, whole original guns with
 * their normal finite240 ammunition quanta. No mortar/lighting substitute.
 * Caller retains the returned references for its real401/421 power phase. */
export function constructSiteDefenceTurrets263(w:World,siteId:number,factionId:number,rect:AncientRect256,count:number,random:WorldGenerationRandom):Structure[] {
 actual(w,siteId,factionId);if(!Number.isSafeInteger(count)||count<0||count>5)throw Error('Actual finite Site turret count required');if(!count)return [];
 const faction=w.worldFactions!.factions.find(f=>f.id===factionId)!;
 // Declared original3D edge layout with existing cloth sandbags and regular
 // human gaps. Every piece is a real finite owner with current cover/damage;
 // occupied/unsupported cells stay as they are, never cleared or dried.
 let edge=0;for(let z=Math.max(0,rect.minZ);z<=Math.min(w.height-1,rect.maxZ);z++)for(let x=Math.max(0,rect.minX);x<=Math.min(w.width-1,rect.maxX);x++){
  if(x!==rect.minX&&x!==rect.maxX&&z!==rect.minZ&&z!==rect.maxZ)continue;if(edge++%5===4)continue;
  const bag:Structure={id:w.nextId,kind:'sandbags',x,z,orientation:0,footprint:'standard',material:'cloth',factionId};if(clear(w,bag))append(w,bag);
 }
 // EdgeDefense.Resolve: a real pre-industrial faction ignores the selected
 // gun option. Its separate guard/Outpost originals are unaffected.
 if(WORLD_FACTION_TECH_LEVEL_259[faction.def]<4)return [];
 rect={minX:rect.minX+1,maxX:rect.maxX-1,minZ:rect.minZ+1,maxZ:rect.maxZ-1};
 const reach=captureGeographicGenerationReachability256(w),cells:Cell[]=[];
 for(let z=Math.max(0,rect.minZ);z<=Math.min(w.height-1,rect.maxZ);z++)for(let x=Math.max(0,rect.minX);x<=Math.min(w.width-1,rect.maxX);x++){
  if(x!==rect.minX&&x!==rect.maxX&&z!==rect.minZ&&z!==rect.maxZ)continue;
  const s:Structure={id:w.nextId,kind:'mini-turret',x,z,orientation:0,footprint:'standard',material:'steel',factionId};
  if(clear(w,s)&&reach.physical.standable(z*w.width+x)&&reach.canReachMapEdgeNoPassClosedDoorsOrWater(z*w.width+x))cells.push({x,z});
 }
 if(cells.length<count)throw Error('Actual reachable Site defence edge cannot hold its selected turrets');
 const made:Structure[]=[];
 for(let i=0;i<count;i++){const at=random.integer(0,cells.length),cell=cells[at]!;cells[at]=cells[cells.length-1]!;cells.pop();const s:Structure={id:w.nextId,kind:'mini-turret',...cell,orientation:0,footprint:'standard',material:'steel',factionId,turret:newMiniTurretState(),power:newPowerState('mini-turret')};append(w,s);made.push(s);}
 return made;
}
function nearBuilding(w:World,origin:Cell,kind:'battery'|'solar-generator',factionId:number,random:WorldGenerationRandom):Structure {
 const candidates:Structure[]=[];
 for(let z=Math.max(0,origin.z-8);z<=Math.min(w.height-1,origin.z+8);z++)for(let x=Math.max(0,origin.x-8);x<=Math.min(w.width-1,origin.x+8);x++){
  const s:Structure={id:w.nextId,kind,x,z,orientation:0,footprint:'standard',material:'steel',factionId,power:newPowerState(kind)};
  if((x-origin.x)**2+(z-origin.z)**2>64||!clear(w,s,true))continue;
  if(kind==='battery'){
   // Generated roof is supported by real original corner walls. Require the
   // entire support envelope before allocating anything, never erase terrain.
   const r={minX:x-2,maxX:x+2,minZ:z-2,maxZ:z+3};if(r.minX<0||r.minZ<0||r.maxX>=w.width||r.maxZ>=w.height)continue;
   if([[r.minX,r.minZ],[r.maxX,r.minZ],[r.minX,r.maxZ],[r.maxX,r.maxZ]].some(([cx,cz])=>!clear(w,{id:w.nextId,kind:'wall',x:cx!,z:cz!,orientation:0,footprint:'standard',material:'wood',factionId})))continue;
   if(w.structures.some(b=>b.kind==='solar-generator'&&footprintCells(b).some(c=>inside(c,r))))continue;
  }
  candidates.push(s);
 }
 if(!candidates.length)throw Error('Actual Site power building has no unroofed supported location');
 const s=candidates[random.integer(0,candidates.length)]!;
 if(kind==='battery')s.battery={stored:Math.floor(BATTERY_CAPACITY*random.float(.2,.5))};append(w,s);
 if(kind==='battery'){
  const r={minX:s.x-2,maxX:s.x+2,minZ:s.z-2,maxZ:s.z+3};
  for(const [x,z] of [[r.minX,r.minZ],[r.maxX,r.minZ],[r.minX,r.maxZ],[r.maxX,r.maxZ]])append(w,{id:w.nextId,kind:'wall',x:x!,z:z!,orientation:0,footprint:'standard',material:'wood',factionId});
  w.roofing??={constructed:[],build:[],remove:[],cursor:0};const roof=new Set(w.roofing.constructed);
  for(let z=r.minZ;z<=r.maxZ;z++)for(let x=r.minX;x<=r.maxX;x++)if(!isRoofed(w,z*w.width+x))roof.add(z*w.width+x);w.roofing.constructed=[...roof].sort((a,b)=>a-b);
 }
 return s;
}
/** Flood-fill route of original conduits. Walls/consumers can share its
 * construction layer; no transmitter is duplicated and no solid is erased. */
function connect(w:World,start:Cell,end:Structure,factionId:number):void {
 const n=w.width*w.height,parents=new Int32Array(n);parents.fill(-1);const queue=new Int32Array(n),root=start.z*w.width+start.x,targets=new Set(footprintCells(end).map(c=>c.z*w.width+c.x));let head=0,tail=1,found=-1;queue[0]=root;parents[root]=root;
 while(head<tail){const c=queue[head++]!;if(targets.has(c)){found=c;break;}const x=c%w.width,z=Math.floor(c/w.width);
  for(const [nx,nz] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){if(nx!<0||nz!<0||nx!>=w.width||nz!>=w.height)continue;const next=nz!*w.width+nx!,tile=w.tiles[next]!;if(parents[next]!==-1||tile.mineable||!terrainSupportsAffordance256(tile,'Light',w))continue;parents[next]=c;queue[tail++]=next;}
 }
 if(found<0)throw Error('Actual Site power conduit route refused');
 const cells:number[]=[];for(let c=found;c!==root;c=parents[c]!)cells.push(c);cells.push(root);cells.reverse();
 for(const c of cells){const cell={x:c%w.width,z:Math.floor(c/w.width)};if(w.structures.some(s=>isPowerTransmitter(s.kind)&&footprintCells(s).some(p=>p.x===cell.x&&p.z===cell.z)))continue;append(w,{id:w.nextId,kind:'power-conduit',...cell,orientation:0,footprint:'standard',material:'steel',factionId,power:newPowerState('power-conduit')});}
}
/** Native Power phase may birth genuine solar/battery/conduits for the actual
 * power users. Initial stored energy is finite20..50%, then ordinary leakage,
 * sunlight, outages and gun expenditure own every continuation. */
export function connectSiteTurretPower263(w:World,siteId:number,random:WorldGenerationRandom):void {
 const site=w.worldSites263?.entries.find(s=>s.id===siteId),factionId=site?.factionId;if(factionId===null||factionId===undefined)throw Error('Actual Site power faction required');
 actual(w,siteId,factionId);
 const guns=w.structures.filter(s=>s.kind==='mini-turret'&&s.factionId===factionId);
 for(const gun of guns){const battery=nearBuilding(w,gun,'battery',factionId,random),solar=nearBuilding(w,battery,'solar-generator',factionId,random);connect(w,gun,battery,factionId);connect(w,battery,solar,factionId);}
 reconcilePower(w);
 for(const gun of guns)if(gun.power?.parentId===null||!gun.power)throw Error('Actual Site turret has no physical power parent');
}
export function constructDirectSiteTurrets263(w:World,site:ItemStash263,storage:AncientRect256,_usedRects:AncientRect256[],random:WorldGenerationRandom):void {
 if(site.threat.kind!=='turrets'||site.factionId===null||site.threat.factionId!==site.factionId)throw Error('Actual Turrets420 Site ticket required');
 if(!w.worldFactions?.factions.some(f=>f.id===site.factionId&&['OutlanderCivil','OutlanderRough','Pirate'].includes(f.def)))throw Error('Actual industrial Turrets Site faction required');
 const width=random.integer(3,5),r={minX:Math.max(0,storage.minX-7-width),maxX:Math.min(w.width-1,storage.maxX+7+width),minZ:Math.max(0,storage.minZ-7-width),maxZ:Math.min(w.height-1,storage.maxZ+7+width)};
 constructSiteDefenceTurrets263(w,site.id,site.factionId,r,random.integer(4,6),random);
 // GuardsCount1, current human producer:35 admits exactly one35-cost drifter.
 // Keep every original belonging to that producer; no trimming after birth.
 const guard=draftForeignRoster261(w,'combat',site.factionId,35,(random.integerValue()>>>0)||1);if(!guard||guard.people.length!==1)throw Error('Actual single Site turret guard producer refused');
 const physical=captureActualLocalDistricts256(w),cells:number[]=[];for(let z=r.minZ;z<=r.maxZ;z++)for(let x=r.minX;x<=r.maxX;x++)if(!inside({x,z},storage)&&physical.standable(z*w.width+x)&&!w.structures.some(s=>s.x===x&&s.z===z))cells.push(z*w.width+x);
 if(!cells.length)throw Error('Actual Site turret guard placement refused');const at=cells[random.integer(0,cells.length)]!;w.nextId=guard.nextId;
 populateWorldTargetDefenders263(w,{kind:'turrets',siteId:site.id},site.factionId,guard,[at],{x:Math.floor((storage.minX+storage.maxX)/2),z:Math.floor((storage.minZ+storage.maxZ)/2)});
}
