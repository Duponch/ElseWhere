import {markTerrainCellChanged} from './terrain-mutation-journal.ts';
import {refreshDuckWaterCell256} from './duck-water-256.ts';
import {registeredMapId,registeredMap,registeredMapForValidation,captureLocalMap,registeredCampaign} from './world-map-context.ts';
import {terrainBridgeable256,terrainHoldsSnow256,terrainAcceptsFilth256} from './natural-terrain-runtime-256.ts';
import {constructionPlantBlocks} from './construction-plants.ts';
import {planConstructionPlantRetirement,commitConstructionPlantRetirement} from './plant-retirement.ts';
import {campaignAuthority,captureSecondaryMap,isSecondaryContext,secondaryContext} from './secondary-site-context.ts';
import {hasTravellingCargo} from './interrupted-cargo.ts';
import {footprintContains,STRUCTURE_DEFINITIONS} from './definitions.ts';
import {BRIDGE_SCHEMA_VERSION,BRIDGE_WOOD,BRIDGE_BOMB_THRESHOLD,isBridgeJob} from './bridge-rules.ts';
import {addMaterial,materialCanFit,refreshStock} from './materials.ts';
import {groundCapacity,planGroundPlacement} from './ground-placement.ts';
import {setSnowDepth} from './snow-surface.ts';
import {removeFilth} from './filth.ts';
import {cancelIntentJobs} from './designation-cancel.ts';
import {damageStructure,structureMaxHp} from './thing-damage.ts';
import {removeHumanSleepingSpot} from './human-sleeping-spot.ts';
import {removeAnimalSpot} from './animal-sleeping-spot.ts';
import {removeCraftingSpot} from './crafting-spot.ts';
import {planPawnDrops} from './work-release.ts';
import {detachMissingBills} from './unfinished.ts';
import {ensureFireState} from './fire-rules.ts';
import {neutralLossPlan} from './destruction-losses.ts';
import type {Cell,CommandResult,DesignateCommand,Job,World} from './types.ts';
import type {SecondaryMap} from './secondary-site-state.ts';

const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const supportedPlan=(j:Job)=>j.kind==='install'||Object.hasOwn(STRUCTURE_DEFINITIONS,j.kind);
const supportedPlans=(w:World,c:Cell)=>w.jobs.filter(j=>supportedPlan(j)&&footprintContains(j,c));
const buildings=(w:World,c:Cell)=>w.structures.filter(s=>footprintContains(s,c));
const below=(terrain:unknown)=>terrain==='water-shallow'?'eau peu profonde':terrain==='marsh'?'marais':'terrain sous-jacent';
function announce(w:World,message:string):void {w.events.push({tick:w.tick,type:'job',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);}
/** A voluntary removal cannot destroy a dependent building, blueprint or frame.
 * Exact refund space is preflighted again only at paid contact completion. */
export function canDesignateBridge(w:World,c:DesignateCommand,exceptJob?:number):CommandResult {
  const fail=(reason:string,code:CommandResult['code']='invalid-command'):CommandResult=>({ok:false,code,reason});
  if(w.schemaVersion<BRIDGE_SCHEMA_VERSION||!isBridgeJob(c)||Object.keys(c).some(k=>!['type','kind','x','z','orientation'].includes(k))||c.orientation!==undefined&&c.orientation!==0)return fail('Ordre de fondation invalide.');
  if(!Number.isInteger(c.x)||!Number.isInteger(c.z)||c.x<0||c.z<0||c.x>=w.width||c.z>=w.height)return fail('Case hors carte.','out-of-bounds');
  const tile=w.tiles[c.z*w.width+c.x]!;
  if(!terrainBridgeable256(tile.terrain,w.schemaVersion)||tile.floor!==undefined)return fail('Le pont standard exige un terrain permettant un pont, sans sol construit.','incompatible-resource');
  if(c.kind==='build-bridge'?tile.bridge!==undefined:tile.bridge!==true)return fail(c.kind==='build-bridge'?'Une fondation occupe déjà cette case.':'Aucun pont à retirer.','occupied');
  if(w.jobs.some(j=>j.id!==exceptJob&&same(j,c)&&isBridgeJob(j)))return fail('Un travail de pont occupe déjà cette case.','occupied');
  if(buildings(w,c).length||supportedPlans(w,c).length)return fail(c.kind==='remove-bridge'?'Retirez d’abord les bâtiments et leurs plans portés par ce pont.':'Dégagez bâtiments et plans avant de construire le pont.','occupied');
  if(w.resources.some(r=>r.kind==='rock'&&same(r,c)))return fail('Dégagez la roche.','incompatible-resource');
  return {ok:true};
}
export function finishBridge(w:World,job:Job):boolean {
  if(job.kind!=='build-bridge'||!canDesignateBridge(w,{type:'designate',kind:job.kind,x:job.x,z:job.z},job.id).ok)return false;
  const held=w.piles.filter(p=>p.owner.type==='job'&&p.owner.jobId===job.id);
  if(held.some(p=>p.item!=='wood')||held.reduce((n,p)=>n+p.quantity,0)!==BRIDGE_WOOD)return false;
  if(w.resources.some(r=>same(r,job)&&constructionPlantBlocks(job,r)))return false;
  const retirement=planConstructionPlantRetirement(w,job,job.id);if(!retirement||!commitConstructionPlantRetirement(w,retirement))return false;
  w.piles=w.piles.filter(p=>p.owner.type!=='job'||p.owner.jobId!==job.id);
  w.tiles[job.z*w.width+job.x]!.bridge=true;markTerrainCellChanged(w.tiles,job.z*w.width+job.x);job.escrow.wood=job.escrow.food=0;refreshDuckWaterCell256(w,job);refreshStock(w);
  announce(w,'Pont termine ; '+below(w.tiles[job.z*w.width+job.x]!.terrain)+' conserve sous la fondation.');return true;
}
function revealWetGround(w:World,c:Cell):void {
  const index=c.z*w.width+c.x;
  const tile=w.tiles[index]!;delete tile.bridge;markTerrainCellChanged(w.tiles,index);refreshDuckWaterCell256(w,c);
  if(!terrainHoldsSnow256(tile.terrain)){setSnowDepth(w,index,0);delete tile.snowDepth;}
  if(!terrainAcceptsFilth256(tile))for(const f of [...w.filth?.items??[]])if(same(f,c))removeFilth(w,f);
}
export function removeBridge(w:World,job:Job):boolean {
  if(job.kind!=='remove-bridge'||!canDesignateBridge(w,{type:'designate',kind:job.kind,x:job.x,z:job.z},job.id).ok)return false;
  const ledger=w.deconstructed,refund=BRIDGE_WOOD/2;
  if(!Number.isSafeInteger(ledger.count+1)||!Number.isSafeInteger(ledger.lostWood+BRIDGE_WOOD-refund))return false;
  const view={...w,jobs:w.jobs.map(j=>({...j,escrow:{...j.escrow}})),piles:w.piles.map(p=>({...p,owner:{...p.owner}}))};
  const drops=groundCapacity(view,job,'wood')>=refund?[{cell:{x:job.x,z:job.z},quantity:refund}]:planGroundPlacement(view,refund,job,'wood');
  if(!drops)return false;
  for(const d of drops){const owner={type:'ground' as const,...d.cell};if(!materialCanFit(view,'wood',d.quantity,owner,'wood'))return false;addMaterial(view,'wood',d.quantity,owner,'wood');}
  for(const d of drops)addMaterial(w,'wood',d.quantity,{type:'ground',...d.cell},'wood');
  revealWetGround(w,job);ledger.count++;ledger.lostWood+=BRIDGE_WOOD-refund;refreshStock(w);
  announce(w,'Pont retire ; 6 bois recuperes et '+below(w.tiles[job.z*w.width+job.x]!.terrain)+' revele.');return true;
}
/** Forced disappearance differs from voluntary removal. Cancel dependent
 * construction with its exact custody, then use ordinary killed-building
 * transactions for services, minified sources, salvage, networks and roofs. */
function commitDestroyed(w:World,c:Cell,cause:'fire'|'bomb'):boolean {
  const ids=new Set(w.jobs.filter(j=>(isBridgeJob(j)&&same(j,c)||supportedPlan(j)&&footprintContains(j,c))).map(j=>j.id));
  if(ids.size&&!cancelIntentJobs(w,ids).ok)return false;
  // Core reveals the underlying terrain before killing its occupant. This
  // also keeps automatic trap reconstruction from creating an unsupported plan.
  revealWetGround(w,c);
  for(const s of buildings(w,c))if(w.structures.includes(s)){
    if(s.kind==='sleeping-spot'||s.kind==='double-sleeping-spot'){if(!removeHumanSleepingSpot(w,s).ok)return false;}
    else if(s.kind==='animal-sleeping-spot')removeAnimalSpot(w,s);
    else if(s.kind==='crafting-spot'||s.kind==='butcher-spot'){
      const drops=planPawnDrops(w,new Set(w.pawns.filter(p=>p.cooking?.stationId===s.id&&!hasTravellingCargo(w,p)).map(p=>p.id)));if(!drops)return false;
      removeCraftingSpot(w,s,drops);detachMissingBills(w);
    }else if(!damageStructure(w,s,structureMaxHp(s),cause))return false;
  }
  if(cause==='fire'){
    const state=ensureFireState(w),lost=(state.ledger.items.wood??0)+BRIDGE_WOOD;if(!Number.isSafeInteger(lost))return false;state.ledger.items.wood=lost;
  }else{const loss=neutralLossPlan(w,{items:{wood:BRIDGE_WOOD}});if(!loss)return false;w.destroyed=loss;}
  refreshStock(w);announce(w,'Pont detruit ; fondation perdue et '+below(w.tiles[c.z*w.width+c.x]!.terrain)+' revele.');return true;
}
/** This synchronous destruction closure writes only its target tile. Roof
 * reconciliation replaces Resource records, and turret waves are registered,
 * never advanced here. Share those read-only objects and planet topology;
 * copy every other mutable domain, including all off-map people and memories. */
function copyDestructionMap<T extends World|SecondaryMap>(source:T,target?:number):T {
  const {tiles,resources,planet,secondarySite,...mutable}=source as World;
  const nextTiles=target===undefined?tiles:tiles.slice();
  if(target!==undefined)nextTiles[target]={...tiles[target]!};
  return {...structuredClone(mutable),tiles:nextTiles,resources:resources.slice(),...(planet?{planet}:{})} as T;
}
function destructionPreview(w:World,c:Cell):World {
  const campaign=registeredCampaign(w),target=registeredMapId(w);
  if(campaign.worldMaps&&target!==undefined){
    const bodies=new Map<number,ReturnType<typeof captureLocalMap>>();for(const row of campaign.worldMaps.sites)if(row.id!==campaign.worldMaps.rootMapId){const live=registeredMapForValidation(campaign,row.id);if(!live)throw Error('Bridge preview map missing');bodies.set(row.id,captureLocalMap(live));}
    // Exclude inactive terrain arrays from the root deep clone. Their local
    // mutable domains are copied once below, sharing untouched grid cells.
    const rootSource=campaign as World,{worldMaps,...withoutMaps}=rootSource,clone=copyDestructionMap(withoutMaps as World,target===worldMaps!.rootMapId?c.z*w.width+c.x:undefined);
    clone.worldMaps={...structuredClone({...worldMaps!,sites:[]}),sites:worldMaps!.sites.map(({map,...row})=>({...structuredClone(row),...row.id!==worldMaps!.rootMapId?{map:copyDestructionMap(bodies.get(row.id)! as World,row.id===target?c.z*w.width+c.x:undefined)}:{}}))};
    const local=registeredMap(clone,target);if(!local)throw Error('Bridge preview target map unavailable');return local;
  }
  const root=campaignAuthority(w),secondary=isSecondaryContext(w),index=c.z*w.width+c.x;
  const copy=copyDestructionMap(root,secondary?undefined:index);
  if(root.secondarySite){
    const {map,...metadata}=root.secondarySite;
    // A producer can replace local arrays before the end-of-tick flush. Keep
    // its actual local data and recreate the cloned campaign's forwarding view.
    const local=secondary?captureSecondaryMap(w):map;
    copy.secondarySite={...structuredClone(metadata),map:copyDestructionMap(local,secondary?index:undefined)};
  }
  return secondary?secondaryContext(copy)!:copy;
}
export function destroyBridge(w:World,c:Cell,cause:'fire'|'bomb',bombAmount=BRIDGE_BOMB_THRESHOLD):boolean {
  if(w.schemaVersion<BRIDGE_SCHEMA_VERSION||!w.tiles[c.z*w.width+c.x]?.bridge||cause==='bomb'&&bombAmount<BRIDGE_BOMB_THRESHOLD)return false;
  // Rare destructive boundary only. A bare bridge needs no World copy; when
  // dependencies exist, a discarded preview prevents a partial multi-owner
  // retirement. The authoritative commit preserves live pawn/job references.
  const dependencies=buildings(w,c).length||w.jobs.some(j=>isBridgeJob(j)&&same(j,c)||supportedPlan(j)&&footprintContains(j,c));
  if(dependencies&&!commitDestroyed(destructionPreview(w,c),c,cause))return false;
  if(!dependencies){
    if(cause==='fire'&&!Number.isSafeInteger((w.fires?.ledger.items.wood??0)+BRIDGE_WOOD))return false;
    if(cause==='bomb'&&!neutralLossPlan(w,{items:{wood:BRIDGE_WOOD}}))return false;
  }
  if(!commitDestroyed(w,c,cause))throw Error('Preflighted bridge destruction could not retire its dependencies.');
  return true;
}
