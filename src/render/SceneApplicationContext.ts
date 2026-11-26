import {readSnapshotChanges} from '../bridge/snapshot-changes';
import {readResidentCollectionChanges379} from '../bridge/resident-collection-changes-379';
import {roofCoverage} from '../sim/roof-rules';
import {isRoofOutlineKind} from './pitched-roof';
import {caveLightSources256} from '../sim/cave-flora-256';
import {lightSourcesFromMembers,isStructureLightMember} from '../sim/light-sources';
import type {World} from '../sim/types';
import {SceneStructurePreparation,type SceneStructureGeometry} from './SceneStructurePreparation';
import {SceneLightTopology} from './SceneLightTopology';
import {ScenePilePresentation,type ScenePileChunks} from './ScenePilePresentation';
import {pileSurfaces,pileShelfCells,pileIdentitySurfacesFromCells,isPileSupportMember379,type PileSurface,type PileSurfaceReadPair,type PileShelfCell} from './pile-surfaces';
import type {PreparedPhysicalRoofs} from './RoofLayer';
import type {PreparedEnvironmentLight} from './EnvironmentLightField';
import {readSceneResourceFrame,type SceneResourceFrame} from './scene-resource-index';

const numbers=(a:readonly number[]|undefined,b:readonly number[]|undefined)=>a===b||!!a&&!!b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
const sameSurface=(a:PileSurface|undefined,b:PileSurface)=>!!a&&Object.is(a.x,b.x)&&Object.is(a.y,b.y)&&Object.is(a.z,b.z)&&Object.is(a.scale,b.scale)&&a.scaleHeight===b.scaleHeight&&a.shelfId===b.shelfId&&a.level===b.level;
const sameGeometry=(a:SceneStructureGeometry,b:SceneStructureGeometry|undefined)=>a===b||!!b&&a.id===b.id&&a.kind===b.kind&&Object.is(a.x,b.x)&&Object.is(a.z,b.z)&&a.orientation===b.orientation&&a.footprint===b.footprint;
function retainMapValues<T>(before:ReadonlyMap<number,T>,after:ReadonlyMap<number,T>,same:(a:T|undefined,b:T)=>boolean):ReadonlyMap<number,T>{
 const retained=new Map<number,T>();let changed=before.size!==after.size;
 for(const [key,value]of after){const old=before.get(key);if(same(old,value))retained.set(key,old!);else{retained.set(key,value);changed=true;}}
 return changed?retained:before;
}
type RoofInputs={constructed:readonly number[]|undefined;thin:readonly number[]|undefined;thick:readonly number[]|undefined};
export interface SceneApplicationView {
 readonly world:World;
 readonly structures:ReturnType<SceneStructurePreparation['read']>;
 readonly changedTiles:readonly number[]|null;
 readonly roofs:PreparedPhysicalRoofs;
 readonly lighting:PreparedEnvironmentLight;
}

/** MAIN's single confirmed fanout. There is no World flag, wire, clock or new
 * admission authority. prepare is invoked only for the World actually applied;
 * unmarked/public Worlds retain each consumer's exhaustive historical reader.
 * Geometry primitives are captured once and classify roof supports and lamp
 * members. Pile surface maps derive only when that geometry changes. */
export class SceneApplicationContext {
 readonly structures=new SceneStructurePreparation((world,geometry,changed,visited)=>this.prepareGeometry(world,geometry,changed,visited));
 readonly topology=new SceneLightTopology();
 readonly piles=new ScenePilePresentation();
 private world:World|undefined;
 private view:SceneApplicationView|undefined;
 private width=0;
 private height=0;
 private seed=0;
 private cells:ReturnType<typeof pileSurfaces>=new Map();
 private shelves:ReadonlyMap<number,PileShelfCell>=new Map();
 private supportRows:readonly SceneStructureGeometry[]=[];
 private roofSupports:readonly SceneStructureGeometry[]=[];
 private supportKey='';
 private emitters:readonly number[]=[];
 private roofWorld:World['roofing'];
 private roofInputs:RoofInputs|undefined;
 private roofs:PreparedPhysicalRoofs|undefined;
 private identities:PileSurfaceReadPair['identities']=new Map();
 private shelfMembers=new Map<number,number[]>();
 private shelfCellsById=new Map<number,number>();
 private shelfWorld:World|undefined;
 private supportChanged=true;
 private applying=false;
 private pendingPiles:ScenePileChunks|undefined;
 private counts={geometryRows:0,supportBuilds:0,roofBuilds:0,emitterReads:0,phaseSupportReuse:0,phaseShelfBuilds:0};

 read=(world:World):SceneApplicationView|undefined=>this.world===world?this.view:undefined;
 readSupports=(world:World):PileSurfaceReadPair|undefined=>this.piles.readSupports(world);
 metrics(){return{...this.counts};}

 clear():void {
  this.world=undefined;this.view=undefined;this.width=this.height=this.seed=0;
  this.cells=new Map();this.shelves=new Map();this.supportRows=[];this.roofSupports=[];this.supportKey='';this.emitters=[];
  this.roofWorld=undefined;this.roofInputs=undefined;this.roofs=undefined;
  this.structures.clear();this.piles.clear();this.identities=new Map();this.shelfMembers.clear();this.shelfCellsById.clear();this.shelfWorld=undefined;this.supportChanged=true;this.applying=false;this.pendingPiles=undefined;
 }

 private prepareGeometry(world:World,geometry:readonly SceneStructureGeometry[],changed:boolean,visited:number):void {
  this.counts.geometryRows+=visited;
  if(!changed)return;
  const roofs:SceneStructureGeometry[]=[],support:SceneStructureGeometry[]=[],emitters:number[]=[];
  for(let i=0;i<geometry.length;i++){const row=geometry[i]!;if(isRoofOutlineKind(row.kind))roofs.push(row);if(isStructureLightMember(row.kind))emitters.push(i);if(isPileSupportMember379(row))support.push(row);}
  this.roofSupports=roofs;
  // The id follows a rebuilt wall (gable colour = its material).
  this.supportKey=this.roofSupports.map(s=>`${s.kind}:${s.x}:${s.z}:${s.id}`).join(',');
  this.emitters=emitters;
  // The only physical primitive capture is StructurePreparation's. Surface
  // derivation consumes those copied primitives rather than rereading World.
  if(this.width===world.width&&this.height===world.height&&support.length===this.supportRows.length&&support.every((s,i)=>sameGeometry(s,this.supportRows[i])))return;
  this.supportRows=support;
  const surfaceWorld={...world,structures:support};
  const cells=retainMapValues(this.cells,pileSurfaces(surfaceWorld),sameSurface),shelves=retainMapValues(this.shelves,pileShelfCells(surfaceWorld),(a,b)=>!!a&&a.id===b.id&&a.orientation===b.orientation);
  if(cells!==this.cells||shelves!==this.shelves){this.cells=cells;this.shelves=shelves;this.supportChanged=true;this.counts.supportBuilds++;}
 }

 private prepareSupports(world:World):void {
  const proof=!this.supportChanged&&this.shelfWorld&&this.shelfWorld!==world?readResidentCollectionChanges379(this.shelfWorld,world,'piles'):undefined;
  let members:Map<number,number[]>|undefined,sparseMembers=false;
  if(proof){
   const touched=new Set<number>();for(const edge of proof.edges)for(const row of [...edge.removed,...edge.added,...edge.updated])touched.add(row.id);
   const edits:{id:number;cell:number|undefined}[]=[];let valid=true;
   for(const id of touched){const source=proof.after.source(id);if(source===undefined&&proof.after.capturedSource(id)!==undefined){valid=false;break;}
    const p=source===undefined?undefined:world.piles[source],at=p?.owner.type==='ground'?p.owner.z*world.width+p.owner.x:undefined,cell=at!==undefined&&this.shelves.has(at)?at:undefined;
    if(this.shelfCellsById.get(id)!==cell)edits.push({id,cell});}
   if(valid&&!edits.length){
    // Rot/quantity/permission writes or movement wholly off shelves leave the
    // shared support identities intact. No bucket/map copy, re-sort or census.
    this.shelfWorld=world;this.piles.prepareSupports(world,false,{cells:this.cells,identities:this.identities});return;
   }
   if(valid){members=new Map(this.shelfMembers);sparseMembers=true;const copied=new Set<number>();
    const bucket=(cell:number):number[]=>{let ids=members!.get(cell);if(!copied.has(cell)||!ids){ids=ids?.slice()??[];members!.set(cell,ids);copied.add(cell);}return ids;};
    for(const {id,cell}of edits){const old=this.shelfCellsById.get(id);if(old===cell)continue;if(old!==undefined){const ids=bucket(old),at=ids.indexOf(id);if(at>=0)ids.splice(at,1);if(!ids.length)members.delete(old);this.shelfCellsById.delete(id);}if(cell!==undefined){bucket(cell).push(id);this.shelfCellsById.set(id,cell);}}
   }
  }
  if(!members){members=new Map();this.shelfCellsById=new Map();
   if(this.shelves.size)for(const p of world.piles)if(p.owner.type==='ground'){
    const cell=p.owner.z*world.width+p.owner.x;if(!this.shelves.has(cell))continue;let ids=members.get(cell);if(!ids){ids=[];members.set(cell,ids);}ids.push(p.id);this.shelfCellsById.set(p.id,cell);
   }
  }
  let changed=this.supportChanged||members.size!==this.shelfMembers.size;
  for(const [cell,ids]of members){ids.sort((a,b)=>a-b);if(!numbers(this.shelfMembers.get(cell),ids))changed=true;}
  if(changed){
   const piles=sparseMembers&&proof?[...this.shelfCellsById.keys()].map(id=>{const source=proof.after.source(id);return source===undefined?undefined:world.piles[source];}).filter((p):p is World['piles'][number]=>p!==undefined):world.piles;
   this.identities=retainMapValues(this.identities,pileIdentitySurfacesFromCells(world.width,piles,this.shelves),sameSurface);
  }
  this.shelfMembers=members;this.shelfWorld=world;this.supportChanged=false;this.piles.prepareSupports(world,false,{cells:this.cells,identities:this.identities});
 }

 /** Supports of a frontier pile-patch view of the prepared World `base`: same
  * support cells (same structures); shelf identities are recomputed only when
  * the view's shelf membership differs. The base's own state is unchanged. */
 preparePileView297(view:World,base:World,patches?:ReadonlyMap<number,Readonly<World['piles'][number]>|null>,previous?:World):boolean {
  if(this.world!==base||!this.view||this.applying)return false;
  if(view.structures!==base.structures||view.seed!==base.seed||view.width!==base.width||view.height!==base.height)return false;
  if(previous&&this.piles.reuseView297(view,previous,base)){this.counts.phaseSupportReuse++;return true;}
  this.piles.registerView297(view,{cells:this.cells,identities:this.identities},base,patches);
  if(view.piles===base.piles||!this.shelves.size){this.counts.phaseSupportReuse++;return true;}
  const directory=this.piles.viewDirectory297(view);let members:Map<number,number[]>|undefined;
  if(directory&&patches){const copied=new Set<number>();
   const bucket=(cell:number):number[]=>{const map=members??=new Map(this.shelfMembers);let ids=map.get(cell);if(!copied.has(cell)||!ids){ids=ids?.slice()??[];map.set(cell,ids);copied.add(cell);}return ids;};
   for(const id of patches.keys()){
    const old=this.shelfCellsById.get(id),source=directory.source(id),p=source===undefined?undefined:view.piles[source],at=p?.owner.type==='ground'?p.owner.z*view.width+p.owner.x:undefined,cell=at!==undefined&&this.shelves.has(at)?at:undefined;
    if(old===cell)continue;if(old!==undefined){const ids=bucket(old),index=ids.indexOf(id);if(index>=0)ids.splice(index,1);if(!ids.length)members!.delete(old);}if(cell!==undefined)bucket(cell).push(id);
   }
   if(!members){this.counts.phaseSupportReuse++;return true;}
   for(const cell of copied)members.get(cell)?.sort((a,b)=>a-b);
  }else{members=new Map();for(const p of view.piles)if(p.owner.type==='ground'){
   const cell=p.owner.z*view.width+p.owner.x;if(!this.shelves.has(cell))continue;let ids=members.get(cell);if(!ids){ids=[];members.set(cell,ids);}ids.push(p.id);
  }for(const ids of members.values())ids.sort((a,b)=>a-b);}
  let changed=members.size!==this.shelfMembers.size;
  if(!changed)for(const [cell,ids]of members){if(!numbers(this.shelfMembers.get(cell),ids)){changed=true;break;}}
  let identities=this.identities;if(changed){this.counts.phaseShelfBuilds++;const piles=directory?[...members.values()].flatMap(ids=>ids.map(id=>view.piles[directory.source(id)!]!)):view.piles;identities=retainMapValues(this.identities,pileIdentitySurfacesFromCells(view.width,piles,this.shelves),sameSurface);}else this.counts.phaseSupportReuse++;
  this.piles.registerView297(view,{cells:this.cells,identities});
  return true;
 }

 prepare(world:World,reset=false,changedTiles:readonly number[]|null=null,resources?:SceneResourceFrame):SceneApplicationView|undefined {
  if(readSnapshotChanges(world,world)===undefined){this.clear();return;}
  if(!reset&&this.world===world&&this.view){this.applying=true;return this.view;}
  this.world=undefined;this.view=undefined;this.applying=true;this.pendingPiles=undefined;
  try{
   const prepared=this.structures.read(world,reset),sameMap=!reset&&this.width===world.width&&this.height===world.height&&this.seed===world.seed;
   this.prepareSupports(world);
   const r=world.roofing,input=this.roofInputs;
   if(!sameMap||!input||this.roofWorld!==r){
    const changed=!sameMap||!input||!numbers(input.constructed,r?.constructed)||!numbers(input.thin,r?.natural?.thin)||!numbers(input.thick,r?.natural?.thick);
    if(changed)this.roofInputs={constructed:r?.constructed.slice(),thin:r?.natural?.thin.slice(),thick:r?.natural?.thick.slice()};
    this.roofWorld=r;
   }
   const roofInput=this.roofInputs!,coverageChanged=!this.roofs||!sameMap||this.roofs.supportKey!==this.supportKey||this.roofs.input!==roofInput;
   if(coverageChanged){
    const coverage=Object.freeze([...roofCoverage(world)]),built=new Set(roofInput.constructed),cells=new Set(coverage);
    if(cells.size)for(const s of this.roofSupports){let near=false;
     for(let dz=-1;dz<=1&&!near;dz++)for(let dx=-1;dx<=1;dx++){const x=s.x+dx,z=s.z+dz;if(x>=0&&x<world.width&&z>=0&&z<world.height&&built.has(z*world.width+x)){near=true;break;}}
     if(near)cells.add(s.z*world.width+s.x);
    }
    const roofKey=coverage.join(','),tail=`${roofKey}|${roofInput.thin?.join(',')}|${roofInput.thick?.join(',')}|${this.supportKey}`;
    this.roofs={world,coverage,roofKey,tail,supportKey:this.supportKey,input:roofInput,cells:Object.freeze([...cells].sort((a,b)=>a-b).map(i=>Object.freeze({x:i%world.width,z:Math.floor(i/world.width)})))};this.counts.roofBuilds++;
   }
   // The roof geometry value survives, but its owner World must be the current
   // exact snapshot. Old returned views retain their own stable wrapper.
   const roofs={...this.roofs!,world};this.roofs=roofs;
   const topology=this.topology.read(world),access=readSceneResourceFrame(resources,world);
   const members=this.emitters.map(i=>world.structures[i]!);this.counts.emitterReads+=members.length;
   const sources=lightSourcesFromMembers(world,members,access?.caveLightSources??caveLightSources256(world));
   const lighting={world,topology,sources,roofs:roofs.coverage,roofKey:roofs.roofKey};
   this.width=world.width;this.height=world.height;this.seed=world.seed;
   const view={world,structures:prepared,changedTiles:changedTiles===null?null:Object.freeze([...changedTiles]),roofs,lighting};this.world=world;this.view=view;return view;
  }catch(error){this.abort();throw error;}
 }

 /** Keep A's pending chunks until the whole apply succeeds. A cargo release
  * outside apply is synchronous and ACKs immediately as in its isolated lot. */
 acknowledgePiles(receipt:ScenePileChunks):void{if(this.applying)this.pendingPiles=receipt;else this.piles.acknowledge(receipt);}
 commit(world:World):void {if(this.world!==world||!this.view)throw Error('Scene context commit without its prepared World');if(this.pendingPiles&&!this.piles.acknowledge(this.pendingPiles))throw Error('Scene context stale pile receipt');this.pendingPiles=undefined;this.applying=false;}
 abort():void {
  // No GPU rollback is claimed. Poison the sparse base and retry required
  // invalidations. Weak old-World support maps and old views remain valid.
  this.world=undefined;this.view=undefined;this.width=this.height=0;
  this.roofWorld=undefined;this.roofInputs=undefined;this.roofs=undefined;this.structures.clear();this.shelfWorld=undefined;this.supportChanged=true;this.applying=false;this.pendingPiles=undefined;
 }
}
