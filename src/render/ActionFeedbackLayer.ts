import * as THREE from 'three/webgpu';
import { Fn, If, attribute, mix, positionLocal, uv, vec2, vec3, uint } from 'three/tsl';
import type { World, Cell } from '../sim/types';
import { confirmedRouteEdgeSignature,type ConfirmedIntentRoute } from './confirmed-intent-fields';
import { pawnPresentationPose } from './pawn-presentation';
import type { PawnLayer } from './PawnLayer';
import { actionProgress, selectedConfirmedPath } from './action-feedback';
import {actionProgressAnchor,type ActionAnchorLookup} from './action-progress-anchor';

type Clock=Pick<PawnLayer,'blend'|'travelTime'>;
type Path491={index:number;id:number;route:readonly Readonly<Cell>[];anchor?:Readonly<Cell>};
/** A confirmed active edge may already end at the future logical origin.
 * Skip that zero segment; the remaining suffix still starts at that origin. */
const firstRouteStep491=(item:Path491)=>item.anchor&&item.route[0]?.x===item.anchor.x&&item.route[0]?.z===item.anchor.z?1:0;
const poseAttributes=['aFrom','aTo','aTravel'] as const;

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
  readonly stats={activeBars:0,pathSegments:0,barUploads:0,pathRebuilds:0,travelCopies:0};
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
    this.bindSource(source);
    const action=this.bars.geometry.getAttribute('aAction') as THREE.InstancedBufferAttribute;
    const anchors=this.bars.geometry.getAttribute('aActionAnchor') as THREE.InstancedBufferAttribute;
    const lookup:ActionAnchorLookup={jobs:new Map(world.jobs.map(job=>[job.id,job])),cleaningStart:this.cleaningStart};
    if(this.cleaningStart.size)for(const pawn of world.pawns)if(!pawn.cleaning)this.cleaningStart.delete(pawn.id);
    // Retain only resources required by visible work counters. Building the
    // simulation's whole-map spatial index on each render snapshot cost ~1 ms
    // at 100 colonists; this linear capture avoids thousands of map entries.
    const cells=new Set<number>(),ids=new Set<number>();
    for(const pawn of world.pawns)if(pawn.state==='working'&&pawn.jobId!==null){
      const job=lookup.jobs!.get(pawn.jobId);if(!job)continue;
      if(job.clearance)ids.add(job.clearance.resourceId);
      else if(job.tree?.kind==='extract')ids.add(job.tree.resourceId);
      else if(job.kind==='cut'||job.kind==='harvest')cells.add(job.z*world.width+job.x);
    }
    const resourceCells=new Map<number,World['resources'][number]>(),resources=new Map<number,World['resources'][number]>();
    if(cells.size||ids.size)for(const resource of world.resources){
      const cell=resource.z*world.width+resource.x;
      if(cells.delete(cell))resourceCells.set(cell,resource);
      if(ids.delete(resource.id))resources.set(resource.id,resource);
      if(!cells.size&&!ids.size)break;
    }
    lookup.resourceCells=resourceCells;lookup.resources=resources;
    let changed=false,anchorChanged=false,active=0,pawnIndices:Map<number,number>|undefined;
    world.pawns.forEach((pawn,index)=>{
      const progress=actionProgress(world,pawn,lookup),fraction=Math.fround(progress?.fraction??0),visible=progress?1:0;
      if(visible)active++;
      if(action.getX(index)!==fraction||action.getY(index)!==visible){action.setXY(index,fraction,visible);changed=true;}
      const anchor=progress?actionProgressAnchor(world,pawn,progress,lookup):undefined;
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
    });
    this.bars.geometry.instanceCount=world.pawns.length;
    this.stats.activeBars=active;
    this.bars.visible=this.barsDetailVisible&&active>0;
    if(changed)action.needsUpdate=true;
    if(anchorChanged)anchors.needsUpdate=true;
    if(changed||anchorChanged)this.stats.barUploads++;
    if(!externalPath)this.updatePath(world,selected,source);
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
    this.bars.geometry.dispose();this.bars.material.dispose();
    this.path.geometry.dispose();this.path.material.dispose();
    this.group.clear();
  }
}
