import {isIedTrapKind357} from '../sim/ied-traps-357';
import {fermentationStatusKey265,fermentationStatusParts265} from './brewing-parts265';
import {GEOTHERMAL_VENT_264,geothermalSteam264,harvestedGeyserIds264} from './geothermal-parts264';
import {knownSpawnedThing256} from '../sim/exploration-visibility-256';
import {geyserCells256} from '../sim/local-geyser-state-256';
import type {GeyserWorld256} from '../sim/local-geyser-state-256';
import {bombWaveRadius} from '../sim/bomb-state';
import {actualBombWick256} from '../sim/ancient-casket-explosive-state-256';
import * as THREE from 'three/webgpu';
import { Fn, attribute, cameraPosition, cross, float, mix, positionLocal, sin, smoothstep, uniform, uv, varying, vec2, vec3 } from 'three/tsl';
import { BATTERY_CAPACITY } from '../sim/power-battery.ts';
import { isPowerActive,powerWatts } from '../sim/power-rules.ts';
import { doorOrientations } from '../sim/door-rules.ts';
import { footprintCells } from '../sim/definitions.ts';
import type { Structure, World } from '../sim/types.ts';
import { WORLD_SCALE } from '../world/scale.ts';
import { BoxMesh, configureBoxMaterial } from './BoxMesh.ts';
import { groundFireSmokeProfile } from './fire-paper.ts';
import type { AnimationDetail } from './AnimationDetail';
import { FxAnimationCache,fxBillboard,fxFract,fxSmoothstep } from './FxAnimationCache';

type Glow = { x:number; y:number; z:number; sx:number; sy:number; sz:number; ry:number; color:number };
type Smoke = { x:number; y:number; z:number; seed:number; size:number; opacityBias:number; rise:number };
type GroundFire = { id:number; x:number; z:number; size:number };
type FireChunk = { x:number; z:number; fires:GroundFire[] };
type FireCandidate = { fire:GroundFire; distance:number };
const FIRE_CHUNK_SIZE=16;
const MAX_GROUND_SMOKE_SOURCES=128;
export const GROUND_SMOKE_PUFFS=7;
const object=new THREE.Object3D(), color=new THREE.Color();

// Keep only the nearest visible flames without sorting every fire. The heap
// holds at most MAX_GROUND_SMOKE_SOURCES entries even during a map-wide fire.
function worse(a:FireCandidate,b:FireCandidate):boolean {
  return a.distance>b.distance || (a.distance===b.distance&&a.fire.id>b.fire.id);
}
function offerFire(heap:FireCandidate[],candidate:FireCandidate):void {
  if(heap.length<MAX_GROUND_SMOKE_SOURCES){
    let i=heap.length;heap.push(candidate);
    while(i>0){const parent=(i-1)>>1;if(!worse(heap[i]!,heap[parent]!))break;[heap[i],heap[parent]]=[heap[parent]!,heap[i]!];i=parent;}
  }else if(worse(heap[0]!,candidate)){
    heap[0]=candidate;let i=0;
    for(;;){const left=i*2+1,right=left+1;if(left>=heap.length)break;
      let child=right<heap.length&&worse(heap[right]!,heap[left]!)?right:left;
      if(!worse(heap[child]!,heap[i]!))break;
      [heap[i],heap[child]]=[heap[child]!,heap[i]!];i=child;
    }
  }
}

function local(s:Structure,x:number,y:number,z:number,sx:number,sy:number,sz:number,tint:number):Glow {
  const ry=s.orientation*Math.PI/2,cs=Math.cos(ry),sn=Math.sin(ry);
  return {x:s.x+x*cs+z*sn,y,z:s.z+z*cs-x*sn,sx,sy,sz,ry,color:tint};
}
function phase(id:number,index:number):number {
  let n=Math.imul(id^0x45d9f3b,index*0x9e3779b1);n=Math.imul(n^(n>>>16),0x7feb352);
  return ((n^(n>>>15))>>>0)/4294967296;
}

/** Two resident draws: unlit metal/status pieces and shader-animated smoke.
 * Work/power/charge state is sampled only when a confirmed snapshot arrives;
 * there are no per-appliance meshes, lights or CPU-stepped particles. */
export class StructureVfxLayer {
  readonly group=new THREE.Group();
  readonly glow:BoxMesh;
  readonly smoke:THREE.Mesh<THREE.InstancedBufferGeometry>;
  private readonly tick=uniform(0);
  private readonly windStrength=uniform(0);
  private readonly windDirection=uniform(new THREE.Vector2(1,0));
  private readonly boxBase=new THREE.BoxGeometry(1,1,1);
  private readonly smokeBase=new THREE.PlaneGeometry(1,1);
  private readonly glowMaterial=new THREE.MeshBasicNodeMaterial({color:0xffffff,toneMapped:false});
  private readonly smokeMaterial=new THREE.MeshBasicNodeMaterial({color:0xffffff,transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});
  private smokeCapacity=64;
  private key:string|null=null;
  private structuralSmoke:Smoke[]=[];
  private fireChunks:FireChunk[]=[];
  private viewVersion=0;
  private selectedVersion=-1;
  private lastView:{targetX:number;targetZ:number;cameraX:number;cameraY:number;cameraZ:number;quaternion:THREE.Quaternion;projectionX:number;projectionY:number}|null=null;
  private readonly frustum=new THREE.Frustum();
  private readonly projection=new THREE.Matrix4();
  private readonly viewProjection=new THREE.Matrix4();
  private readonly chunkSphere=new THREE.Sphere(new THREE.Vector3(),1);
  private readonly firePoint=new THREE.Vector3();
  private readonly cameraPoint=new THREE.Vector3();
  private readonly glowCache:FxAnimationCache;
  private readonly smokeCache:FxAnimationCache;
  private glowRecords:Glow[]=[];
  private smokeRecords:(Smoke&{stretch:number})[]=[];
  private glowDrawn:number[]=[];
  private smokeDrawn:number[]=[];

  constructor(private readonly detail?:AnimationDetail){
    this.glowCache=new FxAnimationCache(2,detail);this.smokeCache=new FxAnimationCache(6,detail);
    configureBoxMaterial(this.glowMaterial);
    const point=attribute('boxMatrix3','vec4');
    const flutter=sin(this.tick.mul(2*Math.PI/18).add(point.x.mul(2.1)).add(point.z.mul(1.7))).mul(.12).add(.91);
    const sampledFlutter=this.glowCache.cachedVarying(()=>this.glowCache.cell(1).x);
    this.glowMaterial.colorNode=attribute('boxColor','vec3').mul(this.glowCache.choose(()=>flutter,()=>sampledFlutter,float(0)));
    this.glow=new BoxMesh(this.boxBase,this.glowMaterial,128);
    this.glow.geometry.setAttribute('fxSlot',new THREE.InstancedBufferAttribute(new Float32Array(128),1));
    this.glow.name='Hot workpieces, powered indicators and breakdown marks — resident GPU batch';
    this.glow.castShadow=false;this.glow.receiveShadow=false;

    const smokePosition=attribute('smokePosition','vec4'),smokeShape=attribute('smokeShape','vec4');
    const phase=this.tick.div(30).add(smokePosition.w).fract();
    this.smokeMaterial.positionNode=this.smokeCache.choose(()=>Fn(()=>{
      const drift=sin(this.tick.mul(2*Math.PI/80).add(smokePosition.w.mul(19))).mul(.08).mul(phase);
      const downwind=phase.mul(phase).mul(this.windStrength).mul(smokeShape.z).mul(.42);
      const center=vec3(
        smokePosition.x.add(this.windDirection.x.mul(downwind)).sub(this.windDirection.y.mul(drift)),
        smokePosition.y.add(phase.mul(smokeShape.z)),
        smokePosition.z.add(this.windDirection.y.mul(downwind)).add(this.windDirection.x.mul(drift)),
      );
      const look=cameraPosition.sub(center),lookDistance=look.length();
      const facing=lookDistance.greaterThan(.001).select(look.div(lookDistance.max(.001)),vec3(0,1,0));
      const horizontal=vec2(facing.z,facing.x.negate()),distance=horizontal.length();
      const right=distance.greaterThan(.001).select(
        vec3(horizontal.x.div(distance.max(.001)),0,horizontal.y.div(distance.max(.001))),vec3(1,0,0));
      const up=cross(facing,right).normalize();
      const breadth=smokeShape.x.mul(float(.59).add(phase.mul(1.04))).mul(.72);
      return center.add(right.mul(positionLocal.x.mul(breadth)))
        .add(up.mul(positionLocal.y.mul(breadth).mul(smokeShape.w)));
    })(),()=>this.smokeCache.affine(positionLocal));
    const pixel=uv().sub(vec2(.5,.5)),radius=pixel.length();
    const seed=varying(smokePosition.w);
    // Round paper puffs: removing the angular lobes also removes the star-like
    // silhouette and two trigonometric contour evaluations per fragment.
    const contour=float(.42);
    const edge=float(1).sub(smoothstep(contour.sub(.075),contour.add(.018),radius));
    const core=float(1).sub(smoothstep(contour.sub(.17),contour.sub(.075),radius));
    const grain=sin(pixel.x.mul(19).add(seed.mul(11)))
      .mul(sin(pixel.y.mul(17).sub(seed.mul(7)))).mul(.5).add(.5);
    const pigment=mix(vec3(.77,.75,.69),vec3(.90,.86,.77),grain);
    const steam=mix(vec3(.59,.58,.54),pigment,core.mul(.78).add(.18));
    // Combustion puffs keep their seed throughout the rise: light ash, middle
    // greys and occasional charcoal. Steam retains its existing pale wash.
    const tone=seed.mul(17.13).fract();
    const grey=mix(vec3(.075,.08,.075),vec3(.87,.88,.86),tone.mul(tone));
    const soot=tone.greaterThan(.88).select(vec3(.025,.03,.025),grey);
    const smokePaint=soot.mul(grain.mul(.09).add(.93)).add(core.mul(.035));
    this.smokeMaterial.colorNode=varying(smokeShape.y).greaterThan(.7).select(smokePaint,steam);
    const birth=smoothstep(0,.17,phase),death=float(1).sub(smoothstep(.68,1,phase));
    const density=sin(smokePosition.w.mul(39.7)).mul(.055).add(smokeShape.y.mul(.07)).add(.31);
    const sampledOpacity=this.smokeCache.cachedVarying(()=>this.smokeCache.cell(5).x);
    this.smokeMaterial.opacityNode=edge.mul(this.smokeCache.choose(()=>birth.mul(death).mul(density),()=>sampledOpacity,float(0)));
    this.smoke=new THREE.Mesh(this.smokeGeometry(),this.smokeMaterial);
    this.smoke.name='Steam and smoke — resident GPU billboards';
    this.smoke.castShadow=false;this.smoke.receiveShadow=false;this.smoke.frustumCulled=false;this.smoke.renderOrder=3;
    this.group.add(this.glow,this.smoke);
  }

  private smokeGeometry():THREE.InstancedBufferGeometry {
    const geometry=new THREE.InstancedBufferGeometry();
    geometry.index=this.smokeBase.index!.clone();
    for(const [name,part] of Object.entries(this.smokeBase.attributes))geometry.setAttribute(name,part.clone());
    geometry.setAttribute('smokePosition',new THREE.InstancedBufferAttribute(new Float32Array(this.smokeCapacity*4),4).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('smokeShape',new THREE.InstancedBufferAttribute(new Float32Array(this.smokeCapacity*4),4).setUsage(THREE.StaticDrawUsage));
    geometry.setAttribute('fxSlot',new THREE.InstancedBufferAttribute(new Float32Array(this.smokeCapacity),1));
    geometry.instanceCount=0;return geometry;
  }

  // V299_NATIVE_BEGIN
  /** Prototype-only entry for the centrally admitted, closed native path.
   * Neither this method nor an optional axes map supplies that admission.
   * RAW adopt below remains literal, including its reads and construction.
   * A miss deliberately pays this decision again in RAW adopt; a hit never
   * constructs glow/smoke/fire arrays or evaluates their geometry. */
  adoptNative(world:GeyserWorld256,reset=false,preparedDoorAxes?:ReadonlyMap<number,0|1>,subjects:ReadonlyArray<World['structures'][number]>=world.structures):void {
    // A reset is always a miss, exactly like RAW's key=null before capture.
    // Avoid a second decision pass on that already-known cold branch.
    if(reset){this.adopt(world,true);return;}
    const working=new Set<number>();
    for(const pawn of world.pawns)if(pawn.state==='working'&&pawn.cooking?.phase==='work')working.add(pawn.cooking.stationId);
    const tokens:string[]=[],harvested=harvestedGeyserIds264(world);
    for(const g of world.geysers?.items??[])tokens.push(`geyser:${g.id}:${g.x}:${g.z}:${g.sprayTicksLeft>0&&!harvested.has(g.id)}:${knownSpawnedThing256(world,geyserCells256(world.width,g))}`);
    let doorAxes=preparedDoorAxes;
    for(const s of subjects){
      const on=s.kind==='geothermal-generator'?powerWatts(s,world)>0:isPowerActive(s),work=working.has(s.id);
      const wick=actualBombWick256(s)??(isIedTrapKind357(s.kind)?s.iedWick357:undefined);if(wick)tokens.push(`${s.id}:turret-wick:${wick.startedAtCore}`);
      const foamWick=s.kind==='firefoam-popper'?s.firefoam290?.wick:undefined;if(foamWick)tokens.push(`${s.id}:firefoam-wick:${foamWick.startedAtCore}:${foamWick.endCore}`);
      if(s.kind==='autodoor'){
        doorAxes??=doorOrientations(world);
        const axis=doorAxes.get(s.z*world.width+s.x)??0;
        tokens.push(`${s.id}:autodoor:${s.x}:${s.z}:${axis}:${on}`);
      }else if(s.kind==='electric-crematorium'){
        tokens.push(`${s.id}:electric-crematorium:${s.x}:${s.z}:${s.orientation}:${on}:${work}`);
      }else if(s.kind==='electric-smelter'){
        tokens.push(`${s.id}:electric-smelter:${s.x}:${s.z}:${s.orientation}:${on}:${work}`);
      }else if(s.kind==='machining-table'||s.kind==='fabrication-bench'){
        tokens.push(`${s.id}:${s.kind}:${s.x}:${s.z}:${s.orientation}:${on}:${work}`);
      }else if(s.kind==='electric-stove'||s.kind==='fueled-stove'){
        const active=work&&(s.kind==='electric-stove'?on:!!s.fuel?.ticks);
        tokens.push(`${s.id}:${s.kind}:${s.x}:${s.z}:${s.orientation}:${on}:${active}`);
      }else if(s.kind==='hi-tech-research-bench'||s.kind==='multi-analyzer'){
        tokens.push(`${s.id}:${s.kind}:${s.x}:${s.z}:${s.orientation}:${on}`);
      }else if(s.kind==='battery'){
        const cells=footprintCells(s),last=cells[cells.length-1]!,x=(s.x+last.x)/2,z=(s.z+last.z)/2;
        const level=s.breakdown?0:Math.min(4,Math.max(0,Math.ceil((s.battery?.stored??0)/BATTERY_CAPACITY*4)));
        tokens.push(`${s.id}:battery:${x}:${z}:${s.orientation}:${level}`);
      }else if(s.kind==='fermenting-barrel'){
        tokens.push(fermentationStatusKey265(s));
      }else if(s.kind==='biofuel-refinery'){
        tokens.push(`${s.id}:biofuel-refinery:${s.x}:${s.z}:${s.orientation}:${on}`);
      }else if(s.kind==='geothermal-generator'){
        tokens.push(`${s.id}:geothermal-generator:${s.x}:${s.z}:${on}:${geothermalSteam264(s)}`);
      }else if(s.kind==='chemfuel-generator'){
        tokens.push(`${s.id}:chemfuel-generator:${s.x}:${s.z}:${on}`);
      }else if(s.kind==='wood-generator'){
        tokens.push(`${s.id}:wood-generator:${s.x}:${s.z}:${on}`);
      }else if(s.kind==='campfire'){
        const lit=!!s.fuel?.ticks;tokens.push(`${s.id}:campfire:${s.x}:${s.z}:${lit}`);
      }else if(s.kind==='torch-lamp'){
        tokens.push(`${s.id}:torch-lamp:${s.x}:${s.z}:${!!s.fuel?.ticks}`);
      }
      if(s.breakdown){
        const cells=footprintCells(s);
        const x=cells.reduce((sum,cell)=>sum+cell.x,0)/cells.length;
        const z=cells.reduce((sum,cell)=>sum+cell.z,0)/cells.length;
        tokens.push(`${s.id}:breakdown:${s.breakdown.brokenAt}:${x}:${z}`);
      }
      if(s.emp&&s.emp.untilCore>world.tick*10)tokens.push(`${s.id}:emp:${s.emp.untilCore}`);
    }
    for(const wave of world.firefoam290?.waves??[])tokens.push(`firefoam-wave:${wave.id}:${wave.nextCell}`);
    for(const p of world.projectiles??[])if(p.weaponItem==='mini-turret-gun'&&Math.ceil(p.emittedAtCore/10)===world.tick)tokens.push(`turret-shot:${p.id}`);
    for(const wave of world.bombWaves??[])if(Math.ceil(wave.startedAtCore/10)===world.tick){
      if(wave.emp){tokens.push(`emp-flash:${wave.id}`);continue;}
      const radius=wave.animalDeath||wave.casketExplosion||wave.ied357?bombWaveRadius(wave):wave.shortCircuit?.radius;
      const flame=!!wave.animalDeath||!!wave.casketExplosion||wave.shortCircuit?.damage==='flame'||wave.ied357?.damage==='flame';
      tokens.push(radius===undefined?`bomb-flash:${wave.id}`:`bomb-flash:${wave.id}:${radius}:${flame}`);
    }
    for(const fire of world.fires?.items??[])if(fire.attachedPawnId===undefined&&fire.attachedAnimalId===undefined)tokens.push(`${fire.id}:ground-fire:${fire.x}:${fire.z}:${fire.size}`);
    if(tokens.join('|')===this.key)return;
    this.adopt(world);
  }
  // V299_NATIVE_END

  adopt(world:GeyserWorld256,reset=false):void {
    if(reset)this.key=null;
    const working=new Set<number>();
    for(const pawn of world.pawns)if(pawn.state==='working'&&pawn.cooking?.phase==='work')working.add(pawn.cooking.stationId);
    const glow:Glow[]=[],smoke:Smoke[]=[],groundFires:GroundFire[]=[],tokens:string[]=[];
    const puff=(x:number,y:number,z:number,id:number,size:number,opacityBias:number,rise:number,count=9)=>{
      for(let i=0;i<count;i++){
        const spread=phase(id,i+23),shape=phase(id,i+61);
        smoke.push({x:x+(spread-.5)*.19,y,z:z+(shape-.5)*.16,seed:phase(id,i),
          size:size*(.53+phase(id,i+41)*.94),opacityBias,rise:rise*(.78+shape*.42)});
      }
    };
    const harvested=harvestedGeyserIds264(world);
    for(const g of world.geysers?.items??[]){const spraying=g.sprayTicksLeft>0&&!harvested.has(g.id);tokens.push(`geyser:${g.id}:${g.x}:${g.z}:${spraying}:${knownSpawnedThing256(world,geyserCells256(world.width,g))}`);if(spraying&&knownSpawnedThing256(world,geyserCells256(world.width,g)))puff(g.x+.5,.16,g.z+.5,g.id,.48,0,1.32,10);}
    const h=WORLD_SCALE.stonecutterHeight;
    let doorAxes:ReadonlyMap<number,0|1>|undefined;
    for(const s of world.structures){
      const on=s.kind==='geothermal-generator'?powerWatts(s,world)>0:isPowerActive(s),work=working.has(s.id);
      const wick=actualBombWick256(s)??(isIedTrapKind357(s.kind)?s.iedWick357:undefined);if(wick){
        tokens.push(`${s.id}:turret-wick:${wick.startedAtCore}`);
        const y=s.kind==='ancient-cryptosleep-casket'?.94:isIedTrapKind357(s.kind)?.48:1.43;
        glow.push({x:s.x,y,z:s.z-.09,sx:.12,sy:.045,sz:.25,ry:0,color:0xf0a176},
          {x:s.x,y,z:s.z+.15,sx:.12,sy:.045,sz:.08,ry:0,color:0xffd19a});
      }
      if(s.kind==='autodoor'){
        doorAxes??=doorOrientations(world);
        const axis=doorAxes.get(s.z*world.width+s.x)??0;
        tokens.push(`${s.id}:autodoor:${s.x}:${s.z}:${axis}:${on}`);
        if(on){
          const ry=axis*Math.PI/2,cs=Math.cos(ry),sn=Math.sin(ry);
          // Two tiny face indicators share the existing resident status batch.
          for(const face of [-1,1])glow.push({x:s.x+.455*cs+face*.19*sn,y:.46,z:s.z-.455*sn+face*.19*cs,sx:.055,sy:.045,sz:.018,ry,color:0x7fd9bd});
        }
      }else if(s.kind==='electric-crematorium'){
        tokens.push(`${s.id}:electric-crematorium:${s.x}:${s.z}:${s.orientation}:${on}:${work}`);
        if(on){
          glow.push(local(s,0,.68,-.21,1.44,.68,.02,work?0xffaa43:0xc96f31));
          glow.push(local(s,1.24,.90,-.30,.19,.15,.02,0xa6dab8));
        }
      }else if(s.kind==='electric-smelter'){
        tokens.push(`${s.id}:electric-smelter:${s.x}:${s.z}:${s.orientation}:${on}:${work}`);
        if(on){
          glow.push(local(s,-.65,.68,-.414,.82,.65,.025,work?0xffaa43:0xc96f31));
          glow.push(local(s,.57,.55,-.449,.13,.09,.02,0xa6dab8));
          if(work){const emitter=local(s,-.25,1.24,.29,.1,.1,.1,0xffffff);puff(emitter.x,emitter.y,emitter.z,s.id,.38,.35,.72,10);}
        }
      }else if(s.kind==='machining-table'||s.kind==='fabrication-bench'){
        tokens.push(`${s.id}:${s.kind}:${s.x}:${s.z}:${s.orientation}:${on}:${work}`);
        if(on){
          const lx=s.kind==='machining-table'?.56:1.9,lz=s.kind==='machining-table'?.05:.55;
          glow.push(local(s,lx,h+.26,lz,.17,.04,.13,s.kind==='machining-table'?0x68cbd4:0x72c8b4));
          if(work){
            const x=s.kind==='machining-table'?.55:0,z=s.kind==='machining-table'?.05:.38,y=s.kind==='machining-table'?h+.285:h+.48;
            glow.push(local(s,x,y,z,.56,.10,.20,0xff7132),local(s,x,y+.06,z,.29,.025,.11,0xffda78));
            const emitter=local(s,x,y+.17,z,.1,.1,.1,0xffffff);
            puff(emitter.x,emitter.y,emitter.z,s.id,.48,.42,.76);
          }
        }
      }else if(s.kind==='electric-stove'||s.kind==='fueled-stove'){
        const active=work&&(s.kind==='electric-stove'?on:!!s.fuel?.ticks);
        tokens.push(`${s.id}:${s.kind}:${s.x}:${s.z}:${s.orientation}:${on}:${active}`);
        if(s.kind==='electric-stove'&&on)glow.push(local(s,.8,h+.22,.37,.13,.04,.11,0x8ed7be));
        if(active){
          const emitter=local(s,-.58,h+.26,-.04,.1,.1,.1,0xffffff);
          puff(emitter.x,emitter.y,emitter.z,s.id,.52,s.kind==='fueled-stove'?.25:0,.82,10);
          glow.push(local(s,-.58,h+.105,-.04,.35,.015,.36,0xffa260));
        }
      }else if(s.kind==='hi-tech-research-bench'||s.kind==='multi-analyzer'){
        tokens.push(`${s.id}:${s.kind}:${s.x}:${s.z}:${s.orientation}:${on}`);
        if(on){
          if(s.kind==='multi-analyzer')glow.push(local(s,.5,1.68,.5,.38,.04,.38,0x79cfce));
          else glow.push(local(s,-1.55,h+.31,.84,.52,.045,.055,0x8acfd4),local(s,1.55,h+.31,.84,.52,.045,.055,0x8acfd4));
        }
      }else if(s.kind==='battery'){
        const cells=footprintCells(s),last=cells[cells.length-1]!,x=(s.x+last.x)/2,z=(s.z+last.z)/2;
        const level=s.breakdown?0:Math.min(4,Math.max(0,Math.ceil((s.battery?.stored??0)/BATTERY_CAPACITY*4)));
        tokens.push(`${s.id}:battery:${x}:${z}:${s.orientation}:${level}`);
        for(let i=0;i<level;i++){
          const ry=s.orientation*Math.PI/2,dx=(i-1.5)*.15,cs=Math.cos(ry),sn=Math.sin(ry);
          glow.push({x:x+dx*cs,y:1.012,z:z-dx*sn,sx:.105,sy:.026,sz:.24,ry,color:i===3?0x87dcc7:i===2?0xa7d792:0xe4af67});
        }
      }else if(s.kind==='fermenting-barrel'){
        tokens.push(fermentationStatusKey265(s));
        for(const part of fermentationStatusParts265(s))glow.push({x:part.x,y:part.y,z:part.z,sx:part.sx!,sy:part.sy!,sz:part.sz!,ry:part.ry??0,color:part.color!});
      }else if(s.kind==='biofuel-refinery'){
        tokens.push(`${s.id}:biofuel-refinery:${s.x}:${s.z}:${s.orientation}:${on}`);
        if(on){
          const ry=s.orientation*Math.PI/2,c=Math.cos(ry),n=Math.sin(ry);
          glow.push({x:s.x+.64*c-.38*n,y:.74,z:s.z-.38*c-.64*n,sx:.15,sy:.10,sz:.05,ry,color:0xb7dca0});
        }
      }else if(s.kind==='geothermal-generator'){
        tokens.push(`${s.id}:geothermal-generator:${s.x}:${s.z}:${on}:${geothermalSteam264(s)}`);
        if(on)glow.push({x:s.x+2.5,y:1.12,z:s.z+3.928,sx:.42,sy:.085,sz:.027,ry:0,color:0xb5d992});
        if(geothermalSteam264(s))puff(s.x+GEOTHERMAL_VENT_264.x,GEOTHERMAL_VENT_264.y,s.z+GEOTHERMAL_VENT_264.z,s.id,.72,0,1.8,12);
      }else if(s.kind==='chemfuel-generator'){
        tokens.push(`${s.id}:chemfuel-generator:${s.x}:${s.z}:${on}`);
        if(on){
          glow.push({x:s.x+.15,y:.66,z:s.z+1.28,sx:.47,sy:.055,sz:.025,ry:0,color:0xb5d992});
          puff(s.x+.15,1.76,s.z-.02,s.id,.56,.68,1.12,10);
        }
      }else if(s.kind==='wood-generator'){
        tokens.push(`${s.id}:wood-generator:${s.x}:${s.z}:${on}`);
        if(on){glow.push({x:s.x+.13,y:.58,z:s.z+1.23,sx:.42,sy:.07,sz:.025,ry:0,color:0xffa456});puff(s.x+.13,WORLD_SCALE.generatorHeight+.73,s.z-.04,s.id,.68,.9,1.32,10);}
      }else if(s.kind==='campfire'){
        const lit=!!s.fuel?.ticks;tokens.push(`${s.id}:campfire:${s.x}:${s.z}:${lit}`);
        if(lit)puff(s.x,.47,s.z,s.id,.58,.76,1.06,9);
      }else if(s.kind==='torch-lamp'){
        const lit=!!s.fuel?.ticks;tokens.push(`${s.id}:torch-lamp:${s.x}:${s.z}:${lit}`);
        if(lit)puff(s.x,1.04,s.z,s.id,.17,.1,.35,5);
      }
      if(s.breakdown){
        // A flat, two-piece amber exclamation remains legible from the normal
        // overhead camera. It joins the existing status draw on snapshots only.
        const cells=footprintCells(s);
        const x=cells.reduce((sum,cell)=>sum+cell.x,0)/cells.length;
        const z=cells.reduce((sum,cell)=>sum+cell.z,0)/cells.length;
        const y=s.kind==='geothermal-generator'?2.88:s.kind==='wind-turbine'?4.42:s.kind==='autodoor'||s.kind==='cooler'?WORLD_SCALE.wallHeight+.08:
          s.kind==='electric-smelter'?1.44:s.kind==='biofuel-refinery'?1.90:s.kind==='chemfuel-generator'?1.90:s.kind==='wood-generator'?WORLD_SCALE.generatorHeight+.35:s.kind==='battery'?1.21:
          s.kind==='solar-generator'?.67:WORLD_SCALE.stonecutterHeight+.4;
        tokens.push(`${s.id}:breakdown:${s.breakdown.brokenAt}:${x}:${z}`);
        glow.push({x,y,z:z-.09,sx:.115,sy:.045,sz:.255,ry:0,color:0xffac62});
        glow.push({x,y,z:z+.16,sx:.115,sy:.045,sz:.085,ry:0,color:0xffac62});
      }
      const foamWick=s.kind==='firefoam-popper'?s.firefoam290?.wick:undefined;
      if(foamWick){tokens.push(`${s.id}:firefoam-wick:${foamWick.startedAtCore}:${foamWick.endCore}`);glow.push({x:s.x,y:.89,z:s.z,sx:.12,sy:.10,sz:.12,ry:0,color:0xffc369});}
      if(s.emp&&s.emp.untilCore>world.tick*10){
        tokens.push(`${s.id}:emp:${s.emp.untilCore}`);
        glow.push({x:s.x,y:1.3,z:s.z,sx:.11,sy:.36,sz:.11,ry:Math.PI/4,color:0x8cefff});
      }
    }
    // Confirmed emissions/departures use the existing status draw. No fake
    // Pawn pose, light or fire is created; a flash lasts the adopted birth tick.
    // At most sixteen confirmed primary cells per wave feed the shared smoke
    // batch. Halo cells never become floor foam through a presentation effect.
    for(const wave of world.firefoam290?.waves??[]){
      tokens.push(`firefoam-wave:${wave.id}:${wave.nextCell}`);
      const from=Math.max(0,wave.nextCell-16);
      for(let i=from;i<wave.nextCell;i++){const cell=wave.cells[i];if(cell===undefined||wave.damageOnlyCells.includes(cell))continue;puff(cell%world.width,.10,Math.floor(cell/world.width),wave.id+i,.30,-.10,.34,2);}
    }
    for(const p of world.projectiles??[])if(p.weaponItem==='mini-turret-gun'&&Math.ceil(p.emittedAtCore/10)===world.tick){
      const from=p.flight.origin,to=p.flight.destination,ry=Math.atan2(to.x-from.x,to.z-from.z);
      tokens.push(`turret-shot:${p.id}`);glow.push({x:from.x+Math.sin(ry)*.7,y:1.12,z:from.z+Math.cos(ry)*.7,sx:.16,sy:.17,sz:.22,ry,color:0xffd599});
    }
    for(const wave of world.bombWaves??[])if(Math.ceil(wave.startedAtCore/10)===world.tick){
      if(wave.emp){tokens.push(`emp-flash:${wave.id}`);glow.push({x:wave.center.x,y:.68,z:wave.center.z,sx:1.5,sy:.45,sz:1.5,ry:0,color:0x8cefff});continue;}
      const radius=wave.animalDeath||wave.casketExplosion||wave.ied357?bombWaveRadius(wave):wave.shortCircuit?.radius,scale=radius===undefined?1:Math.max(.5,Math.min(3,radius/3.9));
      const flame=!!wave.animalDeath||!!wave.casketExplosion||wave.shortCircuit?.damage==='flame'||wave.ied357?.damage==='flame';
      tokens.push(radius===undefined?`bomb-flash:${wave.id}`:`bomb-flash:${wave.id}:${radius}:${flame}`);glow.push({x:wave.center.x,y:.68,z:wave.center.z,sx:.95*scale,sy:1.1*scale,sz:.95*scale,ry:0,color:flame?0xffb35b:0xffe7b4});
    }
    for(const fire of world.fires?.items??[])if(fire.attachedPawnId===undefined&&fire.attachedAnimalId===undefined){
      tokens.push(`${fire.id}:ground-fire:${fire.x}:${fire.z}:${fire.size}`);
      groundFires.push({id:fire.id,x:fire.x,z:fire.z,size:fire.size});
    }
    const key=tokens.join('|');if(key===this.key)return;this.key=key;
    this.glowRecords=glow;this.glowDrawn=[];this.glowCache.reset();
    this.structuralSmoke=smoke;
    const chunks=new Map<string,FireChunk>();
    for(const fire of groundFires){
      const x=Math.floor(fire.x/FIRE_CHUNK_SIZE)*FIRE_CHUNK_SIZE,z=Math.floor(fire.z/FIRE_CHUNK_SIZE)*FIRE_CHUNK_SIZE,key=`${x}:${z}`;
      let chunk=chunks.get(key);if(!chunk){chunk={x,z,fires:[]};chunks.set(key,chunk);}
      chunk.fires.push(fire);
    }
    this.fireChunks=[...chunks.values()];
    this.viewVersion++;
    if(glow.length>this.glow.instanceMatrix.count){this.glow.allocate(this.boxBase,2**Math.ceil(Math.log2(glow.length)));this.glow.geometry.setAttribute('fxSlot',new THREE.InstancedBufferAttribute(new Float32Array(this.glow.instanceMatrix.count),1));}
    this.glow.activeCount=glow.length;
    for(const [i,item] of glow.entries()){
      object.position.set(item.x,item.y,item.z);object.rotation.set(0,item.ry,0);object.scale.set(item.sx,item.sy,item.sz);object.updateMatrix();
      this.glow.setMatrixAt(i,object.matrix);this.glow.setColorAt(i,color.setHex(item.color));
    }
    if(glow.length){this.glow.instanceMatrix.needsUpdate=true;this.glow.colorBuffer.needsUpdate=true;this.glow.computeBoundingSphere();}
    // Structure smoke is independent of the capped ground-fire selection. The
    // camera refreshes that selection before the next render after adoption.
    this.uploadSmoke([]);
  }

  private uploadSmoke(fires:readonly GroundFire[]):void {
    const count=this.structuralSmoke.length+fires.length*GROUND_SMOKE_PUFFS;
    if(count>this.smokeCapacity){while(this.smokeCapacity<count)this.smokeCapacity*=2;this.smoke.geometry.dispose();this.smoke.geometry=this.smokeGeometry();}
    const positions=this.smoke.geometry.getAttribute('smokePosition') as THREE.InstancedBufferAttribute;
    const shapes=this.smoke.geometry.getAttribute('smokeShape') as THREE.InstancedBufferAttribute;
    for(const [i,item] of this.structuralSmoke.entries()){
      positions.setXYZW(i,item.x,item.y,item.z,item.seed);
      shapes.setXYZW(i,item.size,item.opacityBias,item.rise,1);
    }
    let i=this.structuralSmoke.length;
    for(const fire of fires){
      const profile=groundFireSmokeProfile(fire.size);
      for(let puff=0;puff<GROUND_SMOKE_PUFFS;puff++){
        const spread=phase(fire.id,puff+21),shape=phase(fire.id,puff+47);
        positions.setXYZW(i,fire.x+(spread-.5)*.23,profile.originY,fire.z+(shape-.5)*.19,phase(fire.id,puff));
        shapes.setXYZW(i++,profile.breadth*(.55+phase(fire.id,puff+83)*.95),.84,profile.rise*(.8+shape*.35),1);
      }
    }
    this.smoke.geometry.instanceCount=count;this.smoke.visible=count>0;
    if(count){positions.needsUpdate=true;shapes.needsUpdate=true;}
    // Own encoded primitive rows, independent of World and of compact draw
    // slots. Fire selection/birth/retraction is reconciled immediately.
    this.smokeRecords=[];this.smokeDrawn=[];this.smokeCache.reset();
    for(let row=0;row<count;row++)this.smokeRecords.push({x:positions.getX(row),y:positions.getY(row),z:positions.getZ(row),seed:positions.getW(row),size:shapes.getX(row),opacityBias:shapes.getY(row),rise:shapes.getZ(row),stretch:shapes.getW(row)});
  }

  /** Refresh only when the camera moves beyond a small guard band, not every
   * RAF. The expanded frustum keeps edge fires resident while panning within
   * that band; the chunk index avoids scanning the whole burning map. */
  setView(camera:THREE.Camera,target:THREE.Vector3):void {
    this.cameraPoint.setFromMatrixPosition(camera.matrixWorld);
    if(!this.group.visible)return;
    const x=camera.projectionMatrix.elements[0]!,y=camera.projectionMatrix.elements[5]!,prior=this.lastView;
    if(this.selectedVersion===this.viewVersion&&prior&&
      Math.hypot(target.x-prior.targetX,target.z-prior.targetZ)<3&&
      Math.hypot(camera.position.x-prior.cameraX,camera.position.y-prior.cameraY,camera.position.z-prior.cameraZ)<5&&
      Math.abs(camera.quaternion.dot(prior.quaternion))>.9975&&
      Math.abs(x-prior.projectionX)<Math.abs(prior.projectionX)*.06&&
      Math.abs(y-prior.projectionY)<Math.abs(prior.projectionY)*.06)return;
    this.lastView={targetX:target.x,targetZ:target.z,cameraX:camera.position.x,cameraY:camera.position.y,cameraZ:camera.position.z,
      quaternion:camera.quaternion.clone(),projectionX:x,projectionY:y};
    this.selectedVersion=this.viewVersion;
    if(!this.fireChunks.length)return;
    camera.updateMatrixWorld();
    this.projection.copy(camera.projectionMatrix);
    this.projection.elements[0]!*=.78;this.projection.elements[5]!*=.78;
    this.viewProjection.multiplyMatrices(this.projection,camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProjection, camera.coordinateSystem, camera.reversedDepth);
    const nearest:FireCandidate[]=[];
    for(const chunk of this.fireChunks){
      this.chunkSphere.center.set(chunk.x+7.5,4,chunk.z+7.5);
      this.chunkSphere.radius=23;
      if(!this.frustum.intersectsSphere(this.chunkSphere))continue;
      for(const fire of chunk.fires){
        const profile=groundFireSmokeProfile(fire.size);
        const maxRise=profile.rise*1.15;
        this.firePoint.set(fire.x,profile.originY+maxRise*.5,fire.z);
        this.chunkSphere.center.copy(this.firePoint);
        // Include full strong-wind drift, size variation and billboard corners,
        // not just the central rising column. The 128-source cap still applies.
        this.chunkSphere.radius=Math.hypot(maxRise*.5,maxRise*.84)+profile.breadth*1.73+.25;
        if(!this.frustum.intersectsSphere(this.chunkSphere))continue;
        const dx=fire.x-target.x,dz=fire.z-target.z;
        offerFire(nearest,{fire,distance:dx*dx+dz*dz});
      }
    }
    nearest.sort((a,b)=>a.distance-b.distance||a.fire.id-b.fire.id);
    this.uploadSmoke(nearest.map(item=>item.fire));
  }

  /** All three shader periods divide 7200, so wrap is invisible on long saves
   * and GPU float precision stays stable after millions of simulation ticks. */
  present(tick:number):void {
    this.tick.value=((tick%7200)+7200)%7200;
    if(!this.detail)return;
    const glowGeometry=this.glow.geometry;
    if(!glowGeometry.hasAttribute('fxSlot'))glowGeometry.setAttribute('fxSlot',new THREE.InstancedBufferAttribute(new Float32Array(this.glow.instanceMatrix.count),1));
    const glowSlots=glowGeometry.getAttribute('fxSlot') as THREE.InstancedBufferAttribute;let count=0,dirty=false;
    for(let row=0;row<this.glowRecords.length;row++){
      const item=this.glowRecords[row]!;
      if(this.glowCache.sampleDue(row,item.x,item.y,item.z)){
        this.glowCache.set(row,1,Math.sin(this.tick.value*2*Math.PI/18+item.x*2.1+item.z*1.7)*.12+.91);
      }
      if(this.glowCache.commitSample(row)===2)continue;
      if(this.glowDrawn[count]!==row){object.position.set(item.x,item.y,item.z);object.rotation.set(0,item.ry,0);object.scale.set(item.sx,item.sy,item.sz);object.updateMatrix();this.glow.setMatrixAt(count,object.matrix);this.glow.setColorAt(count,color.setHex(item.color));glowSlots.setX(count,row);this.glowDrawn[count]=row;dirty=true;}count++;
    }
    this.glowDrawn.length=count;this.glow.activeCount=count;if(dirty){this.glow.instanceMatrix.needsUpdate=this.glow.colorBuffer.needsUpdate=glowSlots.needsUpdate=true;this.glow.computeBoundingSphere();}this.glowCache.flush();
    const geometry=this.smoke.geometry,positions=geometry.getAttribute('smokePosition') as THREE.InstancedBufferAttribute,shapes=geometry.getAttribute('smokeShape') as THREE.InstancedBufferAttribute,slots=geometry.getAttribute('fxSlot') as THREE.InstancedBufferAttribute;count=0;dirty=false;
    for(let row=0;row<this.smokeRecords.length;row++){
      const item=this.smokeRecords[row]!;
      if(this.smokeCache.sampleDue(row,item.x,item.y,item.z)){
        const phase=fxFract(this.tick.value/30+item.seed),drift=Math.sin(this.tick.value*2*Math.PI/80+item.seed*19)*.08*phase,downwind=phase*phase*this.windStrength.value*item.rise*.42;
        const x=item.x+this.windDirection.value.x*downwind-this.windDirection.value.y*drift,y=item.y+phase*item.rise,z=item.z+this.windDirection.value.y*downwind+this.windDirection.value.x*drift;
        const basis=fxBillboard(x,y,z,this.cameraPoint),breadth=item.size*(.59+phase*1.04)*.72;
        this.smokeCache.set(row,1,basis.right[0]*breadth,basis.right[1]*breadth,basis.right[2]*breadth);
        this.smokeCache.set(row,2,basis.up[0]*breadth*item.stretch,basis.up[1]*breadth*item.stretch,basis.up[2]*breadth*item.stretch);
        this.smokeCache.set(row,3,0,0,0);this.smokeCache.set(row,4,x,y,z);
        this.smokeCache.set(row,5,fxSmoothstep(0,.17,phase)*(1-fxSmoothstep(.68,1,phase))*(Math.sin(item.seed*39.7)*.055+item.opacityBias*.07+.31));
      }
      if(this.smokeCache.commitSample(row)===2)continue;
      if(this.smokeDrawn[count]!==row){positions.setXYZW(count,item.x,item.y,item.z,item.seed);shapes.setXYZW(count,item.size,item.opacityBias,item.rise,item.stretch);slots.setX(count,row);this.smokeDrawn[count]=row;dirty=true;}count++;
    }
    this.smokeDrawn.length=count;if(dirty)positions.needsUpdate=shapes.needsUpdate=slots.needsUpdate=true;geometry.instanceCount=count;this.smoke.visible=count>0;this.smokeCache.flush();
  }
  setWind(strength:number,directionX:number,directionZ:number):void {
    this.windStrength.value=Number.isFinite(strength)?Math.max(0,Math.min(2,strength)):0;
    const length=Math.hypot(directionX,directionZ);
    if(length>0&&Number.isFinite(length))this.windDirection.value.set(directionX/length,directionZ/length);
  }
  setDistant(distant:boolean):void {this.group.visible=!distant;}
  prepareForCompile():()=>void {
    const before={group:this.group.visible,glow:this.glow.activeCount,glowCull:this.glow.frustumCulled,smoke:this.smoke.geometry.instanceCount,smokeVisible:this.smoke.visible};
    this.group.visible=true;
    if(!before.glow){object.position.set(0,-100,0);object.rotation.set(0,0,0);object.scale.set(.001,.001,.001);object.updateMatrix();this.glow.setMatrixAt(0,object.matrix);this.glow.setColorAt(0,color.setHex(0xffffff));this.glow.instanceMatrix.needsUpdate=true;this.glow.colorBuffer.needsUpdate=true;this.glow.activeCount=1;this.glow.frustumCulled=false;}
    if(!before.smoke){const position=this.smoke.geometry.getAttribute('smokePosition') as THREE.InstancedBufferAttribute,shape=this.smoke.geometry.getAttribute('smokeShape') as THREE.InstancedBufferAttribute;position.setXYZW(0,0,-100,0,0);shape.setXYZW(0,.001,0,0,1);position.needsUpdate=shape.needsUpdate=true;this.smoke.geometry.instanceCount=1;this.smoke.visible=true;}
    return ()=>{this.group.visible=before.group;this.glow.activeCount=before.glow;this.glow.frustumCulled=before.glowCull;this.smoke.geometry.instanceCount=before.smoke;this.smoke.visible=before.smokeVisible;};
  }
  dispose():void {this.glowCache.dispose();this.smokeCache.dispose();this.glowRecords=[];this.smokeRecords=[];this.group.clear();this.glow.dispose();this.smoke.geometry.dispose();this.boxBase.dispose();this.smokeBase.dispose();this.glowMaterial.dispose();this.smokeMaterial.dispose();}
}
