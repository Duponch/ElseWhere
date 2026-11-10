import {readSnapshotChanges} from '../bridge/snapshot-changes';
import {roofCoverage} from '../sim/roof-rules';
import {isRoofOutlineKind} from './pitched-roof';
import {caveLightSources256} from '../sim/cave-flora-256';
import {lightSourcesFromMembers,isStructureLightMember} from '../sim/light-sources';
import type {World} from '../sim/types';
import {SceneStructurePreparation,type SceneStructureGeometry} from './SceneStructurePreparation';
import {SceneLightTopology} from './SceneLightTopology';
import {ScenePilePresentation,type ScenePileChunks} from './ScenePilePresentation';
import {pileSurfaces,pileShelfCells,pileIdentitySurfacesFromCells,type PileSurfaceReadPair,type PileShelfCell} from './pile-surfaces';
import type {PreparedPhysicalRoofs} from './RoofLayer';
import type {PreparedEnvironmentLight} from './EnvironmentLightField';
import {readSceneResourceFrame,type SceneResourceFrame} from './scene-resource-index';

const numbers=(a:readonly number[]|undefined,b:readonly number[]|undefined)=>a===b||!!a&&!!b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]));
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
 private roofSupports:readonly SceneStructureGeometry[]=[];
 private supportKey='';
 private emitters:readonly number[]=[];
 private roofWorld:World['roofing'];
 private roofInputs:RoofInputs|undefined;
 private roofs:PreparedPhysicalRoofs|undefined;
 private identities:PileSurfaceReadPair['identities']=new Map();
 private shelfMembers=new Map<number,number[]>();
 private supportChanged=true;
 private applying=false;
 private pendingPiles:ScenePileChunks|undefined;
 private counts={geometryRows:0,supportBuilds:0,roofBuilds:0,emitterReads:0};

 read=(world:World):SceneApplicationView|undefined=>this.world===world?this.view:undefined;
 readSupports=(world:World):PileSurfaceReadPair|undefined=>this.piles.readSupports(world);
 metrics(){return{...this.counts};}

 clear():void {
  this.world=undefined;this.view=undefined;this.width=this.height=this.seed=0;
  this.cells=new Map();this.shelves=new Map();this.roofSupports=[];this.supportKey='';this.emitters=[];
  this.roofWorld=undefined;this.roofInputs=undefined;this.roofs=undefined;
  this.structures.clear();this.piles.clear();this.identities=new Map();this.shelfMembers.clear();this.supportChanged=true;this.applying=false;this.pendingPiles=undefined;
 }

 private prepareGeometry(world:World,geometry:readonly SceneStructureGeometry[],changed:boolean,visited:number):void {
  this.counts.geometryRows+=visited;
  if(!changed)return;
  this.roofSupports=geometry.filter(s=>isRoofOutlineKind(s.kind));
  // The id follows a rebuilt wall (gable colour = its material).
  this.supportKey=this.roofSupports.map(s=>`${s.kind}:${s.x}:${s.z}:${s.id}`).join(',');
  this.emitters=geometry.flatMap((s,i)=>isStructureLightMember(s.kind)?[i]:[]);
  // The only physical primitive capture is StructurePreparation's. Surface
  // derivation consumes those copied primitives rather than rereading World.
  const surfaceWorld={...world,structures:geometry.slice()};
  this.cells=pileSurfaces(surfaceWorld);this.shelves=pileShelfCells(surfaceWorld);this.supportChanged=true;this.counts.supportBuilds++;
 }

 private prepareSupports(world:World):void {
  const members=new Map<number,number[]>();
  if(this.shelves.size)for(const p of world.piles)if(p.owner.type==='ground'){
   const cell=p.owner.z*world.width+p.owner.x;if(!this.shelves.has(cell))continue;let ids=members.get(cell);if(!ids){ids=[];members.set(cell,ids);}ids.push(p.id);
  }
  let changed=this.supportChanged||members.size!==this.shelfMembers.size;
  for(const [cell,ids]of members){ids.sort((a,b)=>a-b);if(!numbers(this.shelfMembers.get(cell),ids))changed=true;}
  if(changed)this.identities=pileIdentitySurfacesFromCells(world.width,world.piles,this.shelves);
  this.shelfMembers=members;this.supportChanged=false;this.piles.prepareSupports(world,false,{cells:this.cells,identities:this.identities});
 }

 /** Supports of a frontier pile-patch view of the prepared World `base`: same
  * support cells (same structures); shelf identities are recomputed only when
  * the view's shelf membership differs. The base's own state is unchanged. */
 preparePileView297(view:World,base:World):boolean {
  if(this.world!==base||!this.view||this.applying)return false;
  const members=new Map<number,number[]>();
  if(this.shelves.size)for(const p of view.piles)if(p.owner.type==='ground'){
   const cell=p.owner.z*view.width+p.owner.x;if(!this.shelves.has(cell))continue;let ids=members.get(cell);if(!ids){ids=[];members.set(cell,ids);}ids.push(p.id);
  }
  let changed=members.size!==this.shelfMembers.size;
  for(const [cell,ids]of members){ids.sort((a,b)=>a-b);if(!numbers(this.shelfMembers.get(cell),ids))changed=true;}
  this.piles.registerView297(view,{cells:this.cells,identities:changed?pileIdentitySurfacesFromCells(view.width,view.piles,this.shelves):this.identities});
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
  this.roofWorld=undefined;this.roofInputs=undefined;this.roofs=undefined;this.structures.clear();this.supportChanged=true;this.applying=false;this.pendingPiles=undefined;
 }
}
