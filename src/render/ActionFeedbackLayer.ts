import * as THREE from 'three/webgpu';
import { Fn, If, attribute, mix, positionLocal, uv, vec2, vec3, uint } from 'three/tsl';
import type { World, Cell,Job } from '../sim/types';
import { confirmedRouteEdgeSignature,type ConfirmedIntentRoute } from './confirmed-intent-fields';
import { pawnPresentationPose } from './pawn-presentation';
import type { PawnLayer } from './PawnLayer';
import { actionProgress, selectedConfirmedPath } from './action-feedback';
import {actionProgressAnchor,type ActionAnchorLookup,type ActionProgressAnchor} from './action-progress-anchor';
import {isActorPlaybackWorld435} from './ActorPlayback435';
import {readResidentCollectionDirectory379,type ResidentCollectionDirectory379} from '../bridge/resident-collection-changes-379';
import {hasOwnedResidentResourceShape379} from '../bridge/resident-resource-section-379';
import {readSnapshotChanges} from '../bridge/snapshot-changes';
import {ActionBarResourceCells} from './ActionBarResourceCells';

type Clock=Pick<PawnLayer,'blend'|'travelTime'>;
type Path491={index:number;id:number;route:readonly Readonly<Cell>[];anchor?:Readonly<Cell>};
/** A confirmed active edge may already end at the future logical origin.
 * Skip that zero segment; the remaining suffix still starts at that origin. */
const firstRouteStep491=(item:Path491)=>item.anchor&&item.route[0]?.x===item.anchor.x&&item.route[0]?.z===item.anchor.z?1:0;
const poseAttributes=['aFrom','aTo','aTravel'] as const;
type Pawn=World['pawns'][number];
type PhaseBarRow={pawn:Pawn;job:Job|undefined;anchor:ActionProgressAnchor|undefined;clock:boolean};
type FullBarLookup={world:World;lookup:ActionAnchorLookup;knownCells:Set<number>;knownIds:Set<number>;rows?:PhaseBarRow[];tick?:number;core?:number};
/** Progress totals can depend on a workpiece or a ground/carry target even
 * when the actor isn't replaced; keep those real identities, not a counter flag. */
function phaseBarPileChanged(pawn:Pawn,job:Job|undefined,piles:ReadonlyMap<number,unknown>):boolean{
  if(!piles.size)return false;
  const touched=(id:number|null|undefined)=>typeof id==='number'&&piles.has(id);
  return pawn.need?.kind==='eat'&&touched(pawn.need.carryPileId)||touched(pawn.feed?.carryPileId)||touched(pawn.animalFeed?.carryPileId)
    ||touched(pawn.equipmentTask?.itemId)||touched(pawn.hunting?.animalId)||touched(pawn.cooking?.ingredients[0]?.pileId)
    ||job?.tree?.kind==='replant'&&touched(job.tree.sourcePileId);
}
function lookupRow<T extends {id:number}>(values:readonly T[],directory:ResidentCollectionDirectory379):(id:number)=>T|undefined {
  return id=>{const slot=directory.source(id);return slot===undefined?undefined:values[slot];};
}
function phaseBarStatic(base:World,view:World):boolean {
  return view.resources===base.resources&&view.structures===base.structures&&view.tiles===base.tiles&&view.filth===base.filth&&view.research===base.research&&view.packed===base.packed&&view.wildlife===base.wildlife&&view.growingZones===base.growingZones&&view.schemaVersion===base.schemaVersion&&view.width===base.width&&view.height===base.height&&view.seed===base.seed;
}

function quad():THREE.InstancedBufferGeometry {
  const base=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
  geometry.index=base.index;
  geometry.setAttribute('position',base.getAttribute('position'));
  geometry.setAttribute('uv',base.getAttribute('uv'));
  base.dispose();
  geometry.instanceCount=0;
  return geometry;
}

/** Anchors and measured fractions upload on confirmed snapshots. Actor-only
 * bars and midpoints share the resident pose; no target lookup runs in RAF. */
export class ActionFeedbackLayer {
  readonly group=new THREE.Group();
  readonly bars:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.SpriteNodeMaterial>;
  readonly path:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshBasicNodeMaterial>;
  readonly stats={activeBars:0,pathSegments:0,barUploads:0,pathRebuilds:0,travelCopies:0,phaseRows:0,phaseSkipped:0};
  private readonly clock:Clock;
  private barCapacity=0;
  private pathCapacity=0;
  private pathSignature='';
  private barsDetailVisible=true;
  /** Filth thickness seen when each colonist began its current cleaning. */
  private readonly cleaningStart=new Map<number,{filthId:number;thickness:number}>();
  private readonly movingSlots:{slot:number;pawnIndex:number}[]=[];
  private source:THREE.InstancedBufferGeometry|undefined;
  private travelStamp='';
  private fullLookup297:FullBarLookup|undefined;
  private phaseLookup297:FullBarLookup|undefined;
  private phaseJobs297:ReadonlyMap<number,Job>|undefined;
  private resourceCells=new ActionBarResourceCells();
  private phaseDirty297:{humans:ReadonlySet<number>;piles:ReadonlyMap<number,Readonly<World['piles'][number]>|null>}|undefined;

  constructor(clock:Clock){
    this.clock=clock;
    const bars=quad();
    for(const name of poseAttributes)bars.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(4),4));
    (bars.getAttribute('aTravel') as THREE.InstancedBufferAttribute).setW(0,1);
    bars.setAttribute('aAction',new THREE.InstancedBufferAttribute(new Float32Array(2),2));
    bars.setAttribute('aActionAnchor',new THREE.InstancedBufferAttribute(new Float32Array(4),4));
    const barMaterial=new THREE.SpriteNodeMaterial({depthTest:false,depthWrite:false,transparent:true,opacity:.65});
    barMaterial.positionNode=Fn(()=>{
      const anchor=attribute('aActionAnchor','vec4'),pose=pawnPresentationPose(clock);
      return mix(vec3(anchor.x,0,anchor.y),vec3(pose.x,0,pose.z),anchor.z).add(vec3(0,.18,anchor.w));
    })();
    barMaterial.scaleNode=vec2(attribute('aAction','vec2').y.mul(.76),attribute('aAction','vec2').y.mul(.105));
    barMaterial.colorNode=uv().x.lessThanEqual(attribute('aAction','vec2').x)
      .select(vec3(.90,.85,.20),vec3(.17,.18,.17));
    this.bars=new THREE.Mesh(bars,barMaterial);
    this.bars.name='Measured target action bars - confirmed anchors';
    this.bars.visible=false;
    this.bars.frustumCulled=false;this.bars.renderOrder=7;

    const path=quad();
    const pathMaterial=new THREE.MeshBasicNodeMaterial({color:0x6da9ef,side:THREE.DoubleSide,depthTest:false,depthWrite:false});
    pathMaterial.positionNode=Fn(()=>{
      const owner=attribute('aPathOwner','float'),start=vec3(0).toVar(),end=attribute('aPathEnd','vec3');
      If(owner.greaterThanEqual(0),()=>{start.assign(pawnPresentationPose(clock,uint(owner)).xyz);})
        .Else(()=>{start.assign(pawnPresentationPose({travelTime:clock.travelTime,blend:clock.blend}).xyz);});
      const delta=end.sub(start),distance=delta.length().max(.0001),right=vec3(delta.z.div(distance),0,delta.x.negate().div(distance));
      return start.add(delta.mul(positionLocal.x.add(.5))).add(right.mul(positionLocal.y.mul(.085))).add(vec3(0,.075,0));
    })();
    this.path=new THREE.Mesh(path,pathMaterial);
    this.path.name='Selected colonist confirmed path — blue GPU ribbon';
    this.path.visible=false;
    this.path.frustumCulled=false;this.path.renderOrder=6;
    this.allocatePath(16);
    this.group.add(this.path,this.bars);
  }

  /** Called after PawnLayer.update. Its source may change only when the pawn
   * capacity grows; rebinding does not rebuild shader geometry or material. */
  update(world:World,selected:ReadonlySet<number>,source:THREE.InstancedBufferGeometry,externalPath=false):void {
    const retained=this.phaseLookup297;if(!retained)this.fullLookup297=undefined;
    const sameSource=this.source===source;
    this.bindSource(source);
    const action=this.bars.geometry.getAttribute('aAction') as THREE.InstancedBufferAttribute;
    const anchors=this.bars.geometry.getAttribute('aActionAnchor') as THREE.InstancedBufferAttribute;
    const lookup:ActionAnchorLookup=retained?.lookup??{cleaningStart:this.cleaningStart};lookup.jobs=this.phaseJobs297??new Map(world.jobs.map(job=>[job.id,job]));
    const nativeRows=retained?.rows,phase=this.phaseDirty297;
    const admitted=!!(readSnapshotChanges(world,world)!==undefined&&isActorPlaybackWorld435(world));
    if(!retained&&admitted){
      const structures=readResidentCollectionDirectory379(world,'structures'),piles=readResidentCollectionDirectory379(world,'piles');
      if(structures)lookup.structureById=lookupRow(world.structures,structures);
      if(piles)lookup.pileById=lookupRow(world.piles,piles);
      const resources=readResidentCollectionDirectory379(world,'resources');
      if(resources&&hasOwnedResidentResourceShape379(world.resources,world.nextId)){
        this.resourceCells.bind(world);
        lookup.resourceById=lookupRow(world.resources,resources);
      }
    }
    const sparse=!!(sameSource&&phase&&nativeRows&&nativeRows.length===world.pawns.length);
    const rows=sparse?nativeRows!:admitted?[]:undefined;
    const dirty:number[]=[];
    if(sparse){
      const clock=retained!.tick!==world.tick||retained!.core!==world.phaseCore297;
      // Core actor scenes share exactly the unmodified frozen rows. Reference
      // checks also catch actor-only frontiers between two feedback applications.
      for(let index=0;index<world.pawns.length;index++){
        const pawn=world.pawns[index]!,old=nativeRows![index]!,job=pawn.jobId===null?undefined:lookup.jobs?.get(pawn.jobId);
        // Travel and pose receipts replace actors even if they cannot have a
        // bar. The literal actionProgress returns before it reads any tasks
        // for both states. Preserve the cleaning ledger's per-pawn cleanup.
        if(!old.anchor&&pawn.state!=='working'&&pawn.state!=='eating'&&old.pawn.state!=='working'&&old.pawn.state!=='eating'){
          if(!pawn.cleaning)this.cleaningStart.delete(pawn.id);
          old.pawn=pawn;old.job=job;continue;
        }
        if(pawn!==old.pawn||phase!.humans.has(index)||old.job!==job||clock&&old.clock||old.anchor?.pawnId!==undefined||pawn.state==='working'&&(pawn.tend?.phase==='tend'||pawn.surgery?.phase==='work')||phaseBarPileChanged(pawn,job,phase!.piles))dirty.push(index);
      }
      this.stats.phaseRows+=dirty.length;this.stats.phaseSkipped+=world.pawns.length-dirty.length;
    }else for(let i=0;i<world.pawns.length;i++)dirty.push(i);
    if(this.cleaningStart.size)for(const index of dirty){const pawn=world.pawns[index]!;if(!pawn.cleaning)this.cleaningStart.delete(pawn.id);}
    // Retain only resources required by visible work counters. Building the
    // simulation's whole-map spatial index on each render snapshot cost ~1 ms
    // at 100 colonists; this linear capture avoids thousands of map entries.
    const cache:FullBarLookup=retained??{world,lookup,knownCells:new Set<number>(),knownIds:new Set<number>()};
    if(lookup.resourceById){
      const cells=(lookup.resourceCells??=new Map()) as Map<number,World['resources'][number]>;
      for(let i=0;i<dirty.length;i++){
        const pawn=world.pawns[dirty[i]!]!;
        if(pawn.state!=='working'||pawn.jobId===null)continue;
        const job=lookup.jobs.get(pawn.jobId);
        if(!job||job.clearance||job.tree?.kind==='extract'||job.kind!=='cut'&&job.kind!=='harvest')continue;
        const cell=job.z*world.width+job.x;
        if(cache.knownCells.has(cell))continue;
        cache.knownCells.add(cell);
        const resource=this.resourceCells.at(cell);
        if(resource)cells.set(cell,resource);
      }
    }else{
    const cells=new Set<number>(),ids=new Set<number>();
    for(const index of dirty){const pawn=world.pawns[index]!;if(pawn.state==='working'&&pawn.jobId!==null){
      const job=lookup.jobs!.get(pawn.jobId);if(!job)continue;
      if(job.clearance)ids.add(job.clearance.resourceId);
      else if(job.tree?.kind==='extract')ids.add(job.tree.resourceId);
      else if(job.kind==='cut'||job.kind==='harvest')cells.add(job.z*world.width+job.x);
    }}
    const resourceCells=(retained?.lookup.resourceCells as Map<number,World['resources'][number]>|undefined)??new Map<number,World['resources'][number]>(),resources=(retained?.lookup.resources as Map<number,World['resources'][number]>|undefined)??new Map<number,World['resources'][number]>();
    const requestedCells=new Set(cells),requestedIds=new Set(ids);
    if(retained){for(const cell of retained.knownCells)cells.delete(cell);for(const id of retained.knownIds)ids.delete(id);
      const directory=readResidentCollectionDirectory379(retained.world,'resources');if(directory)for(const id of ids){const source=directory.source(id),resource=source===undefined?undefined:world.resources[source];if(resource)resources.set(id,resource);ids.delete(id);}
    }
    if(cells.size||ids.size)for(const resource of world.resources){
      const cell=resource.z*world.width+resource.x;
      if(cells.delete(cell))resourceCells.set(cell,resource);
      if(ids.delete(resource.id))resources.set(resource.id,resource);
      if(!cells.size&&!ids.size)break;
    }
    lookup.resourceCells=resourceCells;lookup.resources=resources;
    for(const cell of requestedCells)cache.knownCells.add(cell);for(const id of requestedIds)cache.knownIds.add(id);
    }
    let changed=false,anchorChanged=false,active=sparse?this.stats.activeBars:0,pawnIndices:Map<number,number>|undefined;
    for(const index of dirty){const pawn=world.pawns[index]!;
      const progress=actionProgress(world,pawn,lookup),fraction=Math.fround(progress?.fraction??0),visible=progress?1:0;
      if(sparse)active-=action.getY(index);
      if(visible)active++;
      if(action.getX(index)!==fraction||action.getY(index)!==visible){action.setXY(index,fraction,visible);changed=true;}
      const anchor=progress?actionProgressAnchor(world,pawn,progress,lookup):undefined;
      if(rows){const job=pawn.jobId===null?undefined:lookup.jobs?.get(pawn.jobId);rows[index]={pawn,job,anchor,clock:pawn.state==='working'&&job?.kind==='cut'};}
      let x=anchor?.target?.x??0,z=anchor?.target?.z??0;
      if(anchor?.pawnId!==undefined){
        pawnIndices??=new Map(world.pawns.map((p,i)=>[p.id,i]));
        const slot=pawnIndices.get(anchor.pawnId);
        if(slot!==undefined){const poses=source.getAttribute('aTo');x=poses.getX(slot);z=poses.getZ(slot);}
      }
      const ax=Math.fround(x),az=Math.fround(z),weight=anchor?.actorWeight??1,offset=anchor?.offsetZ??-.5;
      if(anchors.getX(index)!==ax||anchors.getY(index)!==az||anchors.getZ(index)!==weight||anchors.getW(index)!==offset){
        anchors.setXYZW(index,ax,az,weight,offset);anchorChanged=true;
      }
    }
    this.bars.geometry.instanceCount=world.pawns.length;
    this.stats.activeBars=active;
    this.bars.visible=this.barsDetailVisible&&active>0;
    if(changed)action.needsUpdate=true;
    if(anchorChanged)anchors.needsUpdate=true;
    if(changed||anchorChanged)this.stats.barUploads++;
    if(!externalPath)this.updatePath(world,selected,source);
    cache.rows=rows;cache.tick=world.tick;cache.core=world.phaseCore297;
    if(!retained)this.fullLookup297=cache;
  }

  /** Same progress/anchor arithmetic and presentation clock, with the Full's
   * immutable section lookups retained across actual native frontier edits. */
  updatePhase297(base:World,view:World,selected:ReadonlySet<number>,source:THREE.InstancedBufferGeometry,externalPath:boolean,humans:ReadonlySet<number>,piles:ReadonlyMap<number,Readonly<World['piles'][number]>|null>,jobs?:ReadonlyMap<number,Job>,pileDirectory?:ResidentCollectionDirectory379):void {
    const cache=this.fullLookup297;if(!cache||cache.world!==base||!isActorPlaybackWorld435(base)||!phaseBarStatic(base,view)){this.update(view,selected,source,externalPath);return;}
    const native=!!(cache.rows&&readSnapshotChanges(base,base)!==undefined&&isActorPlaybackWorld435(view)&&Object.isFrozen(view.pawns)&&phaseBarStatic(base,view)&&view.pawns.length===cache.rows.length&&view.pawns.every((p,i)=>p.id===cache.rows![i]!.pawn.id));
    const lookup=cache.lookup;lookup.sowingWorld=base;
    // A phase may have appended or removed stacks since its Full. Its own
    // directory resolves the actual view, including all prior pose phases.
    const directory=native?(view.piles===base.piles?readResidentCollectionDirectory379(base,'piles'):pileDirectory):undefined;
    lookup.pileById=directory?lookupRow(view.piles,directory):undefined;
    if(lookup.pawns){const map=lookup.pawns as Map<number,World['pawns'][number]>;if(native){for(let i=0;i<view.pawns.length;i++){const p=view.pawns[i]!;if(p!==cache.rows![i]!.pawn)map.set(p.id,p);}}else for(const p of view.pawns)map.set(p.id,p);}
    if(lookup.piles){const map=lookup.piles as Map<number,World['piles'][number]>;for(const [id,pile]of piles){if(pile)map.set(id,pile as World['piles'][number]);else map.delete(id);}}
    this.fullLookup297=undefined;this.phaseLookup297=cache;this.phaseJobs297=jobs;this.phaseDirty297=native?{humans,piles}:undefined;
    try{this.update(view,selected,source,externalPath);this.fullLookup297=cache;}finally{this.phaseLookup297=undefined;this.phaseJobs297=undefined;this.phaseDirty297=undefined;}
  }

  private bindSource(source:THREE.InstancedBufferGeometry):void {
    const capacity=source.getAttribute('aFrom').count;
    if(this.source===source&&this.barCapacity===capacity)return;
    this.source=source;
    this.travelStamp='';
    const g=this.bars.geometry,old=g.getAttribute('aAction') as THREE.InstancedBufferAttribute|undefined,
      oldAnchors=g.getAttribute('aActionAnchor') as THREE.InstancedBufferAttribute|undefined;
    const action=new THREE.InstancedBufferAttribute(new Float32Array(capacity*2),2).setUsage(THREE.StaticDrawUsage);
    const anchors=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.StaticDrawUsage);
    if(old)action.array.set(old.array.subarray(0,Math.min(old.array.length,action.array.length)));
    if(oldAnchors)anchors.array.set(oldAnchors.array.subarray(0,Math.min(oldAnchors.array.length,anchors.array.length)));
    g.dispose();
    for(const name of poseAttributes)g.setAttribute(name,source.getAttribute(name));
    g.setAttribute('aAction',action);
    g.setAttribute('aActionAnchor',anchors);
    this.barCapacity=capacity;
  }

  private allocatePath(capacity:number):void {
    this.pathCapacity=capacity;
    const g=this.path.geometry;g.dispose();
    for(const [name,size] of [['aFrom',4],['aTo',4],['aTravel',4],['aPathEnd',3],['aPathOwner',1]] as const)
      g.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(THREE.StaticDrawUsage));
  }

  private updatePath(world:World,selected:ReadonlySet<number>,source:THREE.InstancedBufferGeometry):void {
    const paths=world.pawns.flatMap((pawn,index)=>selected.has(pawn.id)
      ?[{index,id:pawn.id,route:selectedConfirmedPath(world,pawn)}]:[]).filter(item=>item.route.length);
    this.writePath(paths,source);
  }

  /** Only an exactly compatible edge follows the executed GPU origin. A newer
   * confirmed suffix starts statically at its own logical origin, without a
   * chord from the actor, prediction or execution-clock/pose change. */
  updateConfirmedPath(routes:readonly ConfirmedIntentRoute[],executed:World,selected:ReadonlySet<number>,source:THREE.InstancedBufferGeometry,actors:Readonly<World['pawns']>=executed.pawns):void {
    this.bindSource(source);
    const byId=new Map(routes.map(route=>[route.pawnId,route]));
    const paths=actors.flatMap((pawn,index)=>{
      const intent=byId.get(pawn.id);if(!selected.has(pawn.id)||!intent)return [];
      const compatible=pawn.x===intent.origin.x&&pawn.z===intent.origin.z
        &&confirmedRouteEdgeSignature(pawn.motion)===intent.edgeSignature;
      const route=intent.cells;
      return route.length?[{index,id:pawn.id,route,...compatible?{}:{anchor:intent.origin}}]:[];
    });
    this.writePath(paths,source);
  }

  private writePath(paths:readonly Path491[],source:THREE.InstancedBufferGeometry):void {
    const signature=paths.map(item=>`${item.id}@${item.index}:${item.anchor?`static@${item.anchor.x},${item.anchor.z}`:'gpu'}:${item.route.map(c=>`${c.x},${c.z}`).join(';')}`).join('|');
    if(signature===this.pathSignature){this.syncTravel(source);return;}
    this.pathSignature=signature;this.stats.pathRebuilds++;
    const total=paths.reduce((count,item)=>count+item.route.length-firstRouteStep491(item),0);
    if(total>this.pathCapacity)this.allocatePath(2**Math.ceil(Math.log2(total)));
    this.movingSlots.length=0;
    const g=this.path.geometry,from=g.getAttribute('aFrom') as THREE.InstancedBufferAttribute,
      to=g.getAttribute('aTo') as THREE.InstancedBufferAttribute,
      travel=g.getAttribute('aTravel') as THREE.InstancedBufferAttribute,
      end=g.getAttribute('aPathEnd') as THREE.InstancedBufferAttribute,
      owner=g.getAttribute('aPathOwner') as THREE.InstancedBufferAttribute;
    let slot=0;
    for(const item of paths){
      const first=firstRouteStep491(item);
      if(!item.anchor&&first<item.route.length)this.movingSlots.push({slot,pawnIndex:item.index});
      for(let step=first;step<item.route.length;step++,slot++){
        const target=item.route[step]!,gpuOrigin=step===first&&!item.anchor;
        owner.setX(slot,gpuOrigin?item.index:-1);
        end.setXYZ(slot,target.x,0,target.z);
        if(gpuOrigin)continue;
        const previous=step===first?item.anchor!:item.route[step-1]!;
        from.setXYZW(slot,previous.x,0,previous.z,0);
        to.setXYZW(slot,previous.x,0,previous.z,0);
        travel.setXYZW(slot,0,0,0,1);
      }
    }
    g.instanceCount=total;this.stats.pathSegments=total;this.path.visible=total>0;
    if(total){from.needsUpdate=to.needsUpdate=travel.needsUpdate=end.needsUpdate=owner.needsUpdate=true;}
    this.syncTravel(source,true);
  }

  /** After PawnLayer.updateTravel, copy only selected path origins if their
   * confirmed edge changed. The ribbon's vertex shader follows that edge at
   * the same presentation clock as the pawn and its selection ring. */
  syncTravel(source:THREE.InstancedBufferGeometry,force=false):void {
    if(!this.movingSlots.length)return;
    const stamp=poseAttributes.map(name=>(source.getAttribute(name) as THREE.InstancedBufferAttribute).version).join(':');
    if(!force&&source===this.source&&stamp===this.travelStamp)return;
    this.travelStamp=stamp;
    const target=this.path.geometry;
    let changed=false;
    for(const {slot,pawnIndex} of this.movingSlots)for(const name of poseAttributes){
      const src=source.getAttribute(name) as THREE.InstancedBufferAttribute,
        dst=target.getAttribute(name) as THREE.InstancedBufferAttribute;
      let different=false;
      for(let component=0;component<4;component++)if(src.array[pawnIndex*4+component]!==dst.array[slot*4+component]){different=true;break;}
      if(!different)continue;
      for(let component=0;component<4;component++)dst.array[slot*4+component]=src.array[pawnIndex*4+component]!;
      dst.needsUpdate=true;changed=true;
    }
    if(changed)this.stats.travelCopies++;
  }

  /** The caller maps its closest camera detail tier to this display policy. */
  setBarsDetailVisible(visible:boolean):void {this.barsDetailVisible=visible;this.bars.visible=visible&&this.stats.activeBars>0;}

  prepareForCompile():()=>void {
    const bars=this.bars.geometry,path=this.path.geometry;
    const previousBars=bars.instanceCount,previousPath=path.instanceCount;
    const barsVisible=this.bars.visible,pathVisible=this.path.visible;
    this.bars.visible=this.path.visible=true;
    if(!previousBars)bars.instanceCount=1;
    if(!previousPath)path.instanceCount=1;
    return ()=>{bars.instanceCount=previousBars;path.instanceCount=previousPath;this.bars.visible=barsVisible;this.path.visible=pathVisible;};
  }

  dispose():void {
    this.fullLookup297=undefined;
    this.resourceCells=new ActionBarResourceCells();
    this.bars.geometry.dispose();this.bars.material.dispose();
    this.path.geometry.dispose();this.path.material.dispose();
    this.group.clear();
  }
}
