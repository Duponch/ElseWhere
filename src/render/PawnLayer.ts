import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {POSE_SLEEP,POSE_DEAD,POSE_FIGHT_READY,READING_ACTIVITY295,seatedOnFurniture,workActivity,animationPose,humanCorpseVisualStage,humanWorkContact297} from '../bridge/actor-phase-dependencies-297';
export {humanCorpseVisualStage} from '../bridge/actor-phase-dependencies-297';
import type {CoreActorScene297,CoreHumanPose297} from '../bridge/core-phase-projection-297';
import {PawnTweener297} from './PawnTweener297';
import {ActorPlayback435} from './ActorPlayback435';
import {isSmithingApparel267} from '../sim/smithing-apparel-267';
import {groupHumanCarryPairs257} from '../sim/group-human-admission-257.ts';
import {arrivalRotationYaw256} from '../sim/arrival-rotation-256';
import {actorExplorationMaterial256} from './ExplorationMask256';
import {isAnimalSpecies256} from '../sim/animal-core-v256';
import {BEDROLL_SURFACE_HEIGHT} from './bedroll-parts';
import {treeCargoKind} from './tree-presentation';
import { appearanceOf } from '../sim/pawn-appearance';
import { AnimationDetail } from './AnimationDetail';
import {ActorAnimationCache,sampleActorRoot} from './ActorAnimationCache';
import {samplePawnRig} from './actor-animation-sampling';
import { bedSlotBodyCenter,pawnBedSlot } from '../sim/bed-slots';
import {coupleBed285} from '../sim/couple-bed-285';
import { corpseStage,CORPSE_ROT_TICKS,CORPSE_DESSICATION_TICKS } from '../sim/corpses';
import { corpseVisualMask } from './corpse-presentation';
import { humanCorpseAge } from '../sim/human-corpses';
import { HUMAN_LIMB_VISUALS,humanLimbVisualMask,packHumanShape } from './human-anatomy-presentation';
import { anestheticStage } from '../sim/anesthetic';
import { appearanceShape,pawnBaseColor } from './pawn-appearance-shape';
import { pawnMorph,hiddenAppearancePart,pawnBoneNode,pawnDyeNode } from './pawn-appearance-nodes';
import { BIOME_CARGO } from './biome-cargo';
import {itemCargoKind} from './item-presentation';
import { firePosition } from '../sim/fire-rules';
import { attachedFireMesh, presentAttachedFire,setFireTexturesEnabled } from './FireLayer';
import { apparelProjection,apparelAppearance,SIMPLE_HELMET_COLORS267 } from './character-apparel';
import { coreTimeSeconds,localTimeSeconds } from '../bridge/clock-rate';
import { growPawnBuffers } from './pawn-buffers';
import { isColonist } from '../sim/affiliation';
import { selectCargoGeometryKinds,prepareCargoGeometryForCompile,PARKA_HOOD_DYE,FLAK_HELMET_DYE,PLATE_ARMOR_DYE,SIMPLE_HELMET_DYE,TUQUE_DYE,RECON_HELMET_DYE,RECON_ARMOR_DYE,PAWN_EYE_OPEN,PAWN_EYE_CLOSED,PAWN_EYE_CROSS } from './pawn-geometry';
import { equipmentProjection } from './character-equipment';
import { RESIDENT_WEAPON_VISUALS269,weaponVisual } from './weapon-shape';
import {LONGSWORD_DYE270,LONGSWORD_EQUIPMENT270,longswordStrikeActivity270} from './longsword-parts270';
import {SPEAR_DYE272,SPEAR_EQUIPMENT272,spearStrikeActivity272} from './spear-parts272';
import {spearPositionNode272} from './spear-pose272';
import {SPEAR_ITEMS_272,isSpearItem272,spearColor272} from '../sim/spear-content-272';
import {longswordPositionNode270} from './longsword-pose270';
import {LONGSWORD_ITEMS_270,isLongswordItem270,longswordColor270} from '../sim/longsword-content-270';
import {MACE_DYE269,MACE_EQUIPMENT269,maceStrikeActivity269} from './mace-parts269';
import {macePositionNode269} from './mace-pose269';
import {MACE_ITEMS_269,isMaceItem269,maceColor269} from '../sim/mace-content-269';
import { doorAt } from '../sim/door-rules';
import { furnitureSurfaces } from './furniture-motion';
import { pawnPresentationPose } from './pawn-presentation';
import { headingAt,turnToward,TURN_TICKS,type TurnHeading } from './turn-presentation';
import { pawnWorkPose,pasteCollectionSource,workApproach,meleeApproach,WORK_POSE } from './work-presentation';
import { GaitPhaseTracker,HUMAN_GAIT_RADIANS_PER_UNIT } from './gait-presentation';
import { constructionWorkTarget } from '../sim/construction-rules';
import { pawnSelectionMesh } from './PawnSelectionLayer';
import type { MotionTimeline } from './MotionTimeline';
import * as THREE from 'three/webgpu';
import {currentGraphicsStyle} from './graphics-style';
import {ActorPartUnionIndex,HumanPartUnionReader} from './origami/actor-part-union';
import {HumanModels,createHumanWearGeometry,type HumanModel} from './models/HumanModels';
import {HumanCargoModel} from './models/HumanCargoModel';
import {naturalStroke} from './surfaces/NaturalSurfaceModels';
import {faceStrokeHalfUvVertexHeaders,createFaceStrokeNode,attachFaceStrokeGpuRetirement,type FaceStrokeData} from './surfaces/FaceStrokeTable';
import {createPreparedAffineStrokeNode} from './surfaces/AffineStrokeKernel';
import {ActorAtlasOwner,actorPoseIsRigid} from './origami/baked/actors/ActorAtlasOwner';
import {applySharedPaintSurface,type SharedPaintSurfaceOptions} from './surfaces/SharedPaintSurface';
import { Fn, If, attribute, cos, float, instanceIndex, mix, positionLocal, sin, uniform, renderGroup,uv,vec2,vec3,vec4, varying } from 'three/tsl';
import { TICKS_PER_SECOND,type MaterialPile,type Pawn,type World,type Job } from '../sim/types';
import {origamiWorkTool} from './origami/work-tools';
import {encodeOrigamiEquipment,origamiWeaponVisualSignal,origamiEquipmentPositionNode,ORIGAMI_EQUIPMENT_HAND,ORIGAMI_EQUIPMENT_BELT,ORIGAMI_EQUIPMENT_SLING} from './origami/equipment-pose';
import {ORIGAMI_HUMAN_BIND,ORIGAMI_DUSTER_DYE,ORIGAMI_PARKA_DYE,ORIGAMI_RECON_ARMOR_DYE,humanReferencePaintProfiles} from './origami/human-geometry';
import {APPAREL} from '../sim/apparel-rules';
import { adjacentTable } from '../sim/dining';
import { CARRY_CAPACITY, footprintCells } from '../sim/definitions';
import { PAWN_MODEL_SCALE, WORLD_SCALE } from '../world/scale';
import { clearGroup, material } from './primitives';
import { createStylizedSurfaceTexture } from './stylized-surfaces';
import { pawnSurfaceShade,pawnSurfaceUvNode,pawnSurfaceShadeFromSample } from './actor-surface';
import { CargoHandoffs,type CargoAnchor } from './cargo-handoff';
import { bodyBloodPigment,bodyBloodWord } from './body-blood';
import type { AnimalCorpseCarrier } from './animal-corpse-carrier';
/** Stable all-rigid real time before the colonists' body atlas is admitted again. */
const BODY_ATLAS_READMIT_MS=6000;
/** One-instance mesh sharing the source's attribute objects, index and user
 * data with another material. Never disposed: its attributes are the source's. */
function bodyVariantStandIn(source:THREE.Mesh,material:THREE.Material):THREE.Mesh{
  const from=source.geometry as THREE.InstancedBufferGeometry,geometry=new THREE.InstancedBufferGeometry();
  for(const [name,attribute] of Object.entries(from.attributes))geometry.setAttribute(name,attribute);
  if(from.index)geometry.setIndex(from.index);
  geometry.userData=from.userData;geometry.instanceCount=1;
  const mesh=new THREE.Mesh(geometry,material);mesh.name=source.name+' — warm-up stand-in';
  mesh.frustumCulled=false;mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;mesh.layers.mask=source.layers.mask;mesh.renderOrder=source.renderOrder;
  return mesh;
}
// Two affine traits share one fragment location. Keep all decisions (skin,
// equipment, corpse ribs and blood) in the fragment shader; vertex poses use
// the original attributes and receive no additional buffer or approximation.
export const pawnFragmentTraits=varying(attribute('pawnRigTraits','vec4').xy,'v_pawnFragmentTraits');

type VisualPawn = { from: THREE.Vector4; to: THREE.Vector4 };
type ApproachTransition = { fromX:number; fromZ:number; toX:number; toZ:number; start:number; baseX:number; baseZ:number };
type CrouchTransition = { start:number; from:number; to:number };
const APPROACH_TICKS=.24*TICKS_PER_SECOND;
const CROUCH_TICKS=.28*TICKS_PER_SECOND;
// aMotion.x normally stores 0/1 locomotion. A negative value also carries a
// short pose transition: quarter-tick start, initial crouch fraction, and the
// locomotion bit. Work subtype (y), pose (z), and strike clock (w) stay intact.
const CROUCH_QUANTA=4,CROUCH_PADDING=16,CROUCH_WALK_MARK=8192;

const crouched=(pose:number|undefined):boolean=>pose===WORK_POSE.ground||pose===WORK_POSE.groundMelee;
function crouchAt(transition:CrouchTransition,tick:number):number {
  const fraction=THREE.MathUtils.clamp((tick-transition.start)/CROUCH_TICKS,0,1);
  const smooth=fraction*fraction*(3-2*fraction);
  return THREE.MathUtils.lerp(transition.from,transition.to,smooth);
}
function motionX(walking:boolean,transition:CrouchTransition|undefined,origin:number):number {
  if(!transition)return walking?1:0;
  const quarterTick=Math.round(transition.start*CROUCH_QUANTA)-origin*CROUCH_QUANTA+CROUCH_PADDING;
  return -1-quarterTick-Math.min(.999,Math.max(0,transition.from))-(walking?CROUCH_WALK_MARK:0);
}
/** Decode the already published equipment scalar; no pile lookup in a frame. */
function presentationActivity(pawn:Pawn,equipmentCode:number):number {
  if(pawn.state==='recreating'&&pawn.recreation.task?.activity==='read'&&pawn.recreation.task.stage==='read'&&pawn.recreation.task.phase==='active')return READING_ACTIVITY295;
  if(Math.floor(equipmentCode)===SPEAR_EQUIPMENT272&&pawn.melee?.strike){
    const item=SPEAR_ITEMS_272[Math.round((equipmentCode-SPEAR_EQUIPMENT272)*8)-1];
    return item?spearStrikeActivity272(pawn.melee.strike.tool,item):0;
  }
  if(Math.floor(equipmentCode)===LONGSWORD_EQUIPMENT270&&pawn.melee?.strike){
    const item=LONGSWORD_ITEMS_270[Math.round((equipmentCode-LONGSWORD_EQUIPMENT270)*8)-1];
    return item?longswordStrikeActivity270(pawn.melee.strike.tool,item):0;
  }
  if(Math.floor(equipmentCode)===MACE_EQUIPMENT269&&pawn.melee?.strike){
    const item=MACE_ITEMS_269[Math.round((equipmentCode-MACE_EQUIPMENT269)*8)-1];
    return item?maceStrikeActivity269(pawn.melee.strike.tool,item):0;
  }
  return workActivity(pawn);
}
function approachAt(transition:ApproachTransition,tick:number):{x:number;z:number} {
  const alpha=THREE.MathUtils.clamp((tick-transition.start)/APPROACH_TICKS,0,1);
  return {x:THREE.MathUtils.lerp(transition.fromX,transition.toX,alpha),z:THREE.MathUtils.lerp(transition.fromZ,transition.toZ,alpha)};
}
const scratchColor = new THREE.Color();
const scratchVestColor = new THREE.Color();
const ORIGAMI_PANTS_COLORS=[0x3c424a,0xd8c8a2,0xad8a61,0xa88b63,0x839ac5,0xc3a375,0xb3c0ba,0xb26422,0x707070,0xcecece,0xb1b1b1] as const;
function cargoAppearance(load:MaterialPile|undefined):readonly [number,number] {
  if(!load)return [0,0];
  // The dedicated mechanical rig follows this owner's existing cargo handoff.
  // No generic food/material proxy may duplicate the entire carcass.
  if(load.mechCorpse||load.corpse&&isAnimalSpecies256(load.corpse.species))return [0,0];
  const kind=load.kind==='corpse'?(BIOME_CARGO[load.item]??27):load.item==='minified-tree'?treeCargoKind(load.innerResource):itemCargoKind(load.item);
  // Corpse loads are indivisible. Negative y encodes their exact anatomical
  // mask in the existing actor stream; no extra per-actor GPU attribute.
  const size=load.corpse?-1-corpseVisualMask(load.corpse):load.kind==='corpse'||load.kind==='unfinished'||load.kind==='book'||load.kind==='weapon'||load.kind==='apparel'||load.kind==='plant'?1:Math.min(1,load.quantity/CARRY_CAPACITY);
  return [kind,size];
}
/** Packed into the existing appearance stream; no extra vertex buffer. */
/** Bodies awaiting a free pile cell remain logically where they fell. Fan only
 * coincident presentations within that cell so their surfaces do not fight. */
export function retainedHumanCorpseOffsets(world:World):ReadonlyMap<number,{x:number;z:number;y:number}> {
  const occupied=new Set<string>();
  for(const pile of world.piles)if(pile.humanCorpse&&pile.owner.type==='ground')occupied.add(`${pile.owner.x}:${pile.owner.z}`);
  const groups=new Map<string,number[]>();
  for(const pawn of world.pawns)if(pawn.state==='dead'&&pawn.body?.pileId===undefined&&pawn.body?.lostAt===undefined){
    const key=`${pawn.x}:${pawn.z}`,ids=groups.get(key)??[];ids.push(pawn.id);groups.set(key,ids);
  }
  const offsets=new Map<number,{x:number;z:number;y:number}>();
  for(const [key,ids] of groups){
    if(ids.length+(occupied.has(key)?1:0)<2)continue;
    ids.sort((a,b)=>a-b);
    ids.forEach((id,index)=>{
      const slot=index+(occupied.has(key)?1:0),angle=slot*Math.PI*2/Math.max(2,ids.length+(occupied.has(key)?1:0));
      offsets.set(id,{x:.20*Math.cos(angle),z:.16*Math.sin(angle),y:Math.min(.06,.012*(index+1))});
    });
  }
  return offsets;
}

export class PawnLayer {
  private readonly graphics=currentGraphicsStyle();
  /** Shared anatomy/rig; the graphics context selects surface treatment only. */
  private readonly referenceRig=true;
  private readonly humanBind=(()=>{
    if(!this.referenceRig)return {hip:.61,foot:.11,kneeSpan:.21,seatedHip:.605,crouchHip:.49,crouchZ:.075,kneelHip:.48,lieCenter:.65,gunY:1.02,gunZ:.45,pistolY:.99,pistolZ:.44,weaponXScale:1};
    const bind=ORIGAMI_HUMAN_BIND,legScale=(bind.hipY-bind.footY)/(.61-.11),armDelta=(bind.shoulderY-bind.handY)-(1.01-.62);
    return {hip:bind.hipY,foot:bind.footY,kneeSpan:bind.hipY-bind.kneeY,seatedHip:bind.hipY-.005,crouchHip:bind.hipY-.12*legScale,crouchZ:.075*legScale,kneelHip:bind.hipY-.13*legScale,lieCenter:bind.hipY+.04*legScale,gunY:bind.shoulderY+.01,gunZ:.45+armDelta,pistolY:bind.shoulderY-.02,pistolZ:.44+armDelta,weaponXScale:bind.shoulderX/.23};
  })();
  private workToolJobs=new Map<number,Job>();
  private equippedVisualItems=new Map<number,string>();
  private refreshOrigamiEquipmentSignal(pawn:Pawn,index:number):void {
    if(!this.referenceRig||!this.pawnMesh)return;
    const equipment=this.pawnMesh.geometry.getAttribute('aEquipment') as THREE.InterleavedBufferAttribute,signal=origamiWeaponVisualSignal(pawn,this.equippedVisualItems.get(pawn.id));
    const encoded=encodeOrigamiEquipment(equipment.getX(index),signal.ready,signal.strike);
    if(equipment.getX(index)!==encoded){equipment.setX(index,encoded);equipment.data.needsUpdate=true;}
  }
  private activity(pawn:Pawn,equipment:number):number{return (this.referenceRig?origamiWorkTool(pawn,this.workToolJobs.get(pawn.jobId??-1)):0)||presentationActivity(pawn,equipment);}
  private selected:ReadonlySet<number>=new Set();
  private pawnIds:number[]=[];
  private selectionMesh:THREE.Mesh|null=null;
  setSelected(ids:ReadonlySet<number>):void {
    this.selected=ids;
    if(!this.selectionMesh)return;
    const flags=this.selectionMesh.geometry.getAttribute('aSelected') as THREE.InstancedBufferAttribute;
    this.pawnIds.forEach((id,i)=>flags.setX(i,ids.has(id)?1:0));flags.needsUpdate=true;
  }
  readonly group = new THREE.Group();
  readonly time = uniform(0).setGroup(renderGroup);
  readonly travelTime = uniform(0).setGroup(renderGroup);
  readonly blend = uniform(1).setGroup(renderGroup);
  readonly animationCache:ActorAnimationCache;
  private readonly partialAnimationCache:ActorAnimationCache;
  private partialOwners:number[]=[];
  private readonly animationOwners=new Map<number,number>();
  private readonly playback435=new ActorPlayback435<Pawn>((pawn,index)=>this.animationOwners.has(index)||this.handoffs.active.has(pawn.id)||this.groupHumanCarrierIds.has(pawn.id)||pawn.rescue?.phase==='carry'||pawn.animalRescue?.phase==='carry'||(this.pawnMesh?.geometry.getAttribute('aCargo').getX(index)??0)!==0,false);
  actorPlaybackMetrics435(){return this.playback435.snapshot();}
  private readonly animationRoot={x:0,y:0,z:0,yaw:0};
  private readonly linkedRoot={x:0,y:0,z:0,yaw:0};
  readonly visuals = new Map<number, VisualPawn>();
  private pawnMesh: THREE.Mesh | null = null;
  private readonly bodyPartUnions:ActorPartUnionIndex[]=[];
  private bodyPartUnionReader?:HumanPartUnionReader;
  private readonly humanModels=new HumanModels();
  private readonly cargoModel=new HumanCargoModel();
  private humanModel?:HumanModel;
  private humanStroke?:FaceStrokeData;
  private bodyAtlas:ActorAtlasOwner|undefined;
  private readonly bodyAtlasAppearance=new Map<number,string>();
  private readonly bodyAtlasRigid=new Map<number,boolean>();
  private bodyAtlasPublishedCount=0;private bodyAtlasModelKey='';
  private observeBodyAtlasPose(id:number,slot:number,geometry:THREE.BufferGeometry):boolean{if(!this.bodyAtlas)return false;const rigid=actorPoseIsRigid('human',geometry,slot);if(this.bodyAtlasRigid.get(id)===rigid)return rigid;this.bodyAtlasRigid.set(id,rigid);return rigid;}
  /** Whether every colonist pose was rigid at the last observation. The atlas
   * refuses the whole kind while one pose is not rigid (Source stays exact). */
  private bodyAtlasAllRigid:boolean|undefined;
  /** Real time at which a stable all-rigid state may admit the atlas again. */
  private bodyAtlasReadmitAt:number|undefined;
  /** A pose leaving the rigid class falls back to Source at once; the return
   * to the atlas waits for BODY_ATLAS_READMIT_MS of stable rigid poses. Each
   * flip re-prepares the shared surfaces, which holds frames: colonists
   * kneeling then standing several times per second no longer do that. */
  private observeBodyAtlasPoseAggregate(allRigid:boolean,now=performance.now()):boolean{
    const atlas=this.bodyAtlas;if(!atlas)return false;
    const previous=this.bodyAtlasAllRigid;this.bodyAtlasAllRigid=allRigid;
    // Leaving the rigid class matters only while the atlas is actually drawn.
    if(!allRigid){this.bodyAtlasReadmitAt=undefined;return previous!==false&&atlas.status().ready;}
    if(previous!==true)this.bodyAtlasReadmitAt=now+BODY_ATLAS_READMIT_MS;
    if(this.bodyAtlasReadmitAt===undefined||now<this.bodyAtlasReadmitAt)return false;
    this.bodyAtlasReadmitAt=undefined;
    // Only the Gouache style bakes this atlas; it may already be in service.
    return !!this.graphics?.origami&&!atlas.status().ready;
  }
  private bodyAtlasAppearanceChanged(id:number,slot:number,geometry:THREE.BufferGeometry):boolean{
    if(!this.bodyAtlas)return false;const tint=geometry.getAttribute('aTint'),skin=geometry.getAttribute('aSkin'),hair=geometry.getAttribute('aHair'),shape=geometry.getAttribute('aShape'),equipment=geometry.getAttribute('aEquipment'),blood=geometry.getAttribute('aBodyBlood'),x=equipment.getX(slot),cleanEquipment=Math.floor(x)+Math.round((x-Math.floor(x))*8)/8;
    const key=[tint.getX(slot),tint.getY(slot),tint.getZ(slot),skin.getX(slot),skin.getY(slot),skin.getZ(slot),hair.getX(slot),hair.getY(slot),hair.getZ(slot),shape.getX(slot),shape.getY(slot),shape.getZ(slot),shape.getW(slot),cleanEquipment,equipment.getY(slot),equipment.getZ(slot),equipment.getW(slot),blood.getX(slot)===0?0:1].join(':');
    if(this.bodyAtlasAppearance.get(id)===key)return false;this.bodyAtlasAppearance.set(id,key);return true;
  }
  private readonly humanCanonicalTables=new Set<FaceStrokeData>();
  private refreshHumanBodySurface:(()=>void)|undefined;
  private humanBodyBakeOptions:((surfacePosition:THREE.Node<'vec3'>)=>SharedPaintSurfaceOptions&{surfacePosition:THREE.Node<'vec3'>})|undefined;
  private humanPastelFromSample:((sample:THREE.Node<'vec4'>)=>THREE.Node<'vec3'>)|undefined;
  private wearEffect?:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshStandardNodeMaterial>;
  private wearModelKey?:string;
  private releaseWearEffect?:()=>void;
  private releaseFeatureRefresh?:()=>void;
  private smithingGeometry=false;
  private maceGeometry=false;
  private longswordGeometry=false;
  private spearGeometry=false;
  private readonly retiredPawnGeometries:THREE.BufferGeometry[]=[];
  private readonly surfaceTexture = createStylizedSurfaceTexture();
  private plainMaterial: THREE.MeshStandardNodeMaterial | null = null;
  private texturedMaterial: THREE.MeshStandardNodeMaterial | null = null;
  private nativePlainMaterial: THREE.MeshStandardNodeMaterial | null = null;
  private nativeTexturedMaterial: THREE.MeshStandardNodeMaterial | null = null;
  private nativeBody = false;
  private texturesEnabled = true;
  get feedbackSource():THREE.InstancedBufferGeometry|undefined {return this.pawnMesh?.geometry as THREE.InstancedBufferGeometry|undefined;}
  private cargoMesh: THREE.Mesh | null = null;
  private partialCargoMesh: THREE.Mesh | null = null;
  private fireMesh: THREE.Mesh | null = null;
  private readonly targetPoses = new Map<number,THREE.Vector4>();
  private targetOffsets297 = new Float64Array(0);
  private readonly pawnIndices = new Map<number,number>();
  private readonly headings = new Map<number,TurnHeading>();
  private readonly workPoses = new Map<number,number>();
  private readonly workOffsets = new Map<number,{x:number;z:number}>();
  private readonly approachTransitions = new Map<number,ApproachTransition>();
  private readonly departureOffsets = new Map<number,{start:number;x:number;z:number;arrivalX:number;arrivalZ:number}>();
  private readonly crouchTransitions = new Map<number,CrouchTransition>();
  private readonly shownPoses = new Map<number,number>();
  private readonly gait = new GaitPhaseTracker();
  private readonly handoffs = new CargoHandoffs();
  /** Wildlife's resident species batch reads these already encoded primitives
   * at edge/snapshot boundaries; there is no World search or CPU rig pose. */
  animalCorpseCarrier(id:number):AnimalCorpseCarrier|undefined {
    const index=this.pawnIndices.get(id),geometry=this.pawnMesh?.geometry;
    if(index===undefined||!geometry)return;
    return {index,geometry,handoff:this.handoffs.active.get(id),blend:this.blend.value};
  }
  animalCorpseTransferCarrier(pileId:number):number|undefined {
    for(const item of this.handoffs.active.values())if(item.pile.id===pileId||item.targetPileId===pileId)return item.pawnId;
  }
  private carryOrigin=0;
  private travelOrigin=0;
  readonly cargoTime=uniform(0).setGroup(renderGroup);
  hiddenPileQuantity(pileId:number):number {return this.handoffs.hiddenQuantity(pileId);}
  hiddenPileQuantities():ReadonlyMap<number,number> {return this.handoffs.hiddenQuantities();}
  private travelSurfaces:ReadonlyMap<number,number>=new Map();
  private groupHumanCarrierIds=new Set<number>();
  private rescuePairs:readonly (readonly [number,number])[]=[];
  constructor(private readonly configure?: (material: THREE.NodeMaterial) => void,private readonly animationDetail=new AnimationDetail()) {this.animationCache=new ActorAnimationCache(animationDetail);this.partialAnimationCache=new ActorAnimationCache(animationDetail);this.releaseFeatureRefresh=this.graphics?.trackSharedSurfaceRefresh(()=>this.refreshWearEffect());}
  cpuPoseForId(id:number){const slot=this.pawnIndices.get(id),g=this.pawnMesh?.geometry;return slot===undefined||!g?undefined:this.animationCache.presentedRoot(slot,g.getAttribute('aFrom'),g.getAttribute('aTo'),g.getAttribute('aTravel'),this.travelTime.value,this.blend.value);}
  presentedPose(id:number){return this.cpuPoseForId(id);}
  /** Warm the resident fire graph before the first burning actor appears. */
  prepareFiresForCompile():()=>void {
    if(!this.fireMesh)return ()=>{};
    const geometry=this.fireMesh.geometry as THREE.InstancedBufferGeometry,count=geometry.instanceCount;
    geometry.instanceCount=Math.max(1,count);
    return ()=>{geometry.instanceCount=count;};
  }
  /** Keep both resident cargo materials visible to the existing scene/shadow
   * preparation. No snapshot, attribute, material or capacity is fabricated. */
  prepareCargoForCompile():()=>void {
    const restorers:(()=>void)[]=[];let active=true;
    const restore=()=>{if(!active)return;active=false;for(let i=restorers.length-1;i>=0;i--)restorers[i]!();};
    try {
      for(const mesh of [this.cargoMesh,this.partialCargoMesh]) {
        if(!mesh)continue;
        const geometry=mesh.geometry as THREE.InstancedBufferGeometry,visible=mesh.visible;
        const restoreGeometry=prepareCargoGeometryForCompile(geometry);
        mesh.visible=true;
        restorers.push(()=>{
          const sameGeometry=mesh.geometry===geometry;
          restoreGeometry(sameGeometry);
          if(mesh.visible===true)mesh.visible=visible;
        });
      }
      return restore;
    } catch(error) {restore();throw error;}
  }
  private showPose(id:number,pose:number,tick:number):void {
    const previous=this.shownPoses.get(id);
    if(previous===pose)return;
    if(previous!==undefined&&crouched(previous)!==crouched(pose)){
      // The presentation playhead, not the latest worker snapshot, starts the
      // bend. A rapid interruption resumes from the fraction already shown.
      const earlier=this.crouchTransitions.get(id);
      const from=earlier?crouchAt(earlier,tick):crouched(previous)?1:0;
      const to=crouched(pose)?1:0;
      if(pose===POSE_SLEEP||pose===POSE_DEAD||pose===1||pose===5||pose===6||Math.abs(from-to)<.001)
        this.crouchTransitions.delete(id);
      else this.crouchTransitions.set(id,{start:Math.ceil(tick*CROUCH_QUANTA)/CROUCH_QUANTA,from,to});
    }
    this.shownPoses.set(id,pose);
  }
  setTexturesEnabled(enabled: boolean): void {
    if (this.texturesEnabled === enabled) return;
    this.texturesEnabled = enabled;
    this.selectBodyMaterial();
    if (this.fireMesh) setFireTexturesEnabled(this.fireMesh,enabled);
  }
  private selectBodyMaterial(): void {
    if (!this.pawnMesh) return;
    const source = this.nativeBody
      ? (this.texturesEnabled ? this.nativeTexturedMaterial : this.nativePlainMaterial)
      : (this.texturesEnabled ? this.texturedMaterial : this.plainMaterial);
    const selected=source&&this.texturesEnabled?(this.bodyAtlas?.selectedMaterial(source)??source):source;
    if (selected && this.pawnMesh.material !== selected) this.pawnMesh.material = selected;
    if(selected&&this.wearEffect){if(this.wearEffect.material.positionNode!==selected.positionNode){this.wearEffect.material.positionNode=selected.positionNode;this.wearEffect.material.needsUpdate=true;}this.wearEffect.userData.origamiTexturesEnabled=this.texturesEnabled;this.graphics?.refreshEdgeObject(this.wearEffect,'wear');}
  }
  private clearBodyPartUnions():void{for(const union of this.bodyPartUnions)union.dispose();this.bodyPartUnions.length=0;}
  private installBodyPartUnions(body=this.pawnMesh?.geometry as THREE.InstancedBufferGeometry|undefined):void{this.clearBodyPartUnions();if(!body)return;this.bodyPartUnionReader??=new HumanPartUnionReader();for(const geometry of [body,this.wearEffect?.geometry])if(geometry)this.bodyPartUnions.push(new ActorPartUnionIndex(geometry,'human'));}
  private refreshBodyPartUnion(body=this.pawnMesh?.geometry as THREE.InstancedBufferGeometry|undefined):void{if(!body||!this.bodyPartUnionReader)return;const state=this.bodyPartUnionReader.read(body,body.instanceCount);for(const union of this.bodyPartUnions)union.reconcile(state);}
  private syncBodyInstances(body=this.pawnMesh?.geometry as THREE.InstancedBufferGeometry|undefined):void{if(!body)return;body.userData.animationCache=this.animationCache;if(this.wearEffect){for(const[name,a]of Object.entries(body.attributes))if(a instanceof THREE.InstancedBufferAttribute||a instanceof THREE.InterleavedBufferAttribute&&a.data instanceof THREE.InstancedInterleavedBuffer)this.wearEffect.geometry.setAttribute(name,a);this.wearEffect.geometry.instanceCount=body.instanceCount;this.wearEffect.geometry.userData.animationCache=this.animationCache;}this.refreshBodyPartUnion(body);}
  private adoptBodyGeometry(body:THREE.InstancedBufferGeometry):void{this.refreshWearEffect();this.installBodyPartUnions(body);this.syncBodyInstances(body);}
  private retireWearEffect():void{
    const effect=this.wearEffect,release=this.releaseWearEffect;this.wearEffect=undefined;this.releaseWearEffect=undefined;this.wearModelKey=undefined;if(!effect)return;
    this.clearBodyPartUnions();const errors:unknown[]=[];for(const close of [()=>release?.(),()=>effect.removeFromParent(),()=>effect.geometry.dispose(),()=>effect.material.dispose()])try{close();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Human physical-wear retirement failed');
  }
  /** A true optional effect, independent of Pastel/Gouache. Texture encoding
   * only gates its visibility. Zero owns no wear geometry, material or cache. */
  private refreshWearEffect():void{
    const context=this.graphics,body=this.pawnMesh;if(!context||!body)return;
    if(!context.wearEnabled){const had=!!this.wearEffect;this.retireWearEffect();if(had){this.installBodyPartUnions();this.syncBodyInstances();}return;}
    if(this.wearEffect&&this.wearModelKey!==this.humanModel?.key)this.retireWearEffect();
    const source=body.material as THREE.MeshStandardNodeMaterial;
    if(this.wearEffect){const material=this.wearEffect.material,fresh=context.createWearMaterial(source.positionNode,attribute('origamiPaintUv','vec2'));try{material.colorNode=fresh.colorNode;material.opacityNode=fresh.opacityNode;material.normalNode=fresh.normalNode;material.positionNode=fresh.positionNode;}finally{fresh.dispose();}material.needsUpdate=true;context.refreshEdgeObject(this.wearEffect,'wear');return;}
    let geometry:THREE.InstancedBufferGeometry|undefined,material:THREE.MeshStandardNodeMaterial|undefined,effect:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshStandardNodeMaterial>|undefined,releaseGeometry:(()=>void)|undefined,releaseObject:(()=>void)|undefined,attached=false;
    try{
      geometry=createHumanWearGeometry({smithing:this.smithingGeometry,mace:this.maceGeometry,longsword:this.longswordGeometry,spear:this.spearGeometry});material=context.createWearMaterial(source.positionNode,attribute('origamiPaintUv','vec2'));this.configure?.(actorExplorationMaterial256(material));material.maskNode=source.maskNode;material.maskShadowNode=source.maskShadowNode;
      effect=new THREE.Mesh(geometry,material);effect.name='Colonists — optional physical paint wear';effect.frustumCulled=false;effect.castShadow=false;effect.receiveShadow=true;effect.userData.origamiTexturesEnabled=this.texturesEnabled;
      releaseGeometry=context.trackWearGeometry(geometry);releaseObject=context.trackEdgeObject(effect,'wear');const freeGeometry=releaseGeometry,freeObject=releaseObject;this.releaseWearEffect=()=>{try{freeObject();}finally{freeGeometry();}};this.wearEffect=effect;this.wearModelKey=this.humanModel?.key;this.group.add(effect);this.installBodyPartUnions();this.syncBodyInstances();attached=true;
    }finally{if(!attached){releaseObject?.();releaseGeometry?.();effect?.removeFromParent();geometry?.dispose();material?.dispose();this.wearEffect=undefined;this.releaseWearEffect=undefined;this.wearModelKey=undefined;}}
  }
  /** Canonical model records are borrowed, with no second CPU/GPU mirror.
   * The prepared owner has a stable runtime binding across equipment models. */
  private createHumanGeometry():THREE.InstancedBufferGeometry{
    const model=this.humanModels.get({smithing:this.smithingGeometry,mace:this.maceGeometry,longsword:this.longswordGeometry,spear:this.spearGeometry}),changed=model!==this.humanModel;this.humanModel=model;this.humanCanonicalTables.add(model.strokes);
    if(!this.humanStroke){const owner=this;let closed=false;this.humanStroke={get faceCount(){return owner.humanModel!.strokes.faceCount;},get edgeCount(){return owner.humanModel!.strokes.edgeCount;},get maxEdgesPerFace(){return owner.humanModel!.strokes.maxEdgesPerFace;},get values(){return owner.humanModel!.strokes.values;},get buffer(){return owner.humanModel!.strokes.buffer;},get node(){return owner.humanModel!.strokes.node;},get cpuBytes(){return owner.humanModel!.strokes.cpuBytes;},assertCurrent(){if(closed)throw Error('Human canonical facade retired');owner.humanModel!.assertCurrent();},dispose(){closed=true;}};}
    if(changed)this.graphics?.preparedStrokes.refresh(this.humanStroke);
    return model.createGeometry();
  }
  /** Source factories are borrowed by the offline baker, never by frame code.
   * It captures genuine owner streams; a rejected whole actor stays Source. */
  actorAtlasStatus(){return this.bodyAtlas?.status();}
  bodySurfaceBakeSource(){
    if(!this.humanModel||!this.pawnMesh||!this.texturedMaterial||!this.humanBodyBakeOptions||!this.humanPastelFromSample)return undefined;
    const model=this.humanModel;return{model,createGeometry:()=>model.createGeometry(),geometry:this.pawnMesh.geometry as THREE.InstancedBufferGeometry,sourceMaterial:this.texturedMaterial,nativeMaterial:this.nativeTexturedMaterial,buildOptions:this.humanBodyBakeOptions,morphPosition:()=>pawnMorph(positionLocal,true).mul(PAWN_MODEL_SCALE),pastelTexture:this.surfaceTexture,pastelUv:pawnSurfaceUvNode(),pastelFromSample:this.humanPastelFromSample};
  }
  /** Call only while the owner suspends frames and prepares scene visibility.
   * compileAsync skips shadows; prepareShadow must request a real shadow pass.
   * Every body variant (and its wear effect) draws through a detached stand-in
   * sharing the body attributes, index and user data: the same render-object
   * cache key as the body itself. One compilation per camera and ONE shadow
   * warm-up cover all variants. The body keeps its own material throughout. */
  async prepareBodyPipelines(renderer: THREE.WebGPURenderer, scene: THREE.Scene,
    cameras: readonly THREE.Camera[], prepareShadow: () => Promise<void>, progress?: (done:number,total:number)=>void): Promise<void> {
    const mesh = this.pawnMesh;
    if (!mesh) return;
    const geometry = mesh.geometry as THREE.InstancedBufferGeometry;
    const savedVisible = mesh.visible, savedCount = geometry.instanceCount;
    const effect=this.wearEffect,savedWear=effect?{visible:effect.visible,count:effect.geometry.instanceCount}:undefined;
    const restoreUnions=this.bodyPartUnions.map(union=>union.prepareForCompile());
    const variants=[this.plainMaterial, this.texturedMaterial,
      this.nativePlainMaterial, this.nativeTexturedMaterial,...(this.bodyAtlas?.materials??[])].filter((variant):variant is NonNullable<typeof variant>=>!!variant);
    const stands=new THREE.Group();stands.name='Colonists — body variant warm-up stand-ins';
    for(const variant of variants){
      stands.add(bodyVariantStandIn(mesh,variant));
      // Its material is never disposed: that would release the shared programs.
      if(effect){const material=effect.material.clone();material.positionNode=variant.positionNode;stands.add(bodyVariantStandIn(effect,material));}
    }
    try {
      mesh.visible = true;
      geometry.instanceCount = Math.max(1, savedCount);
      if(effect){effect.visible=true;effect.geometry.instanceCount=Math.max(1,effect.geometry.instanceCount);}
      (mesh.parent??scene).add(stands);
      progress?.(0,2);
      for(const camera of cameras)await renderer.compileAsync(stands,camera,scene);
      progress?.(1,2);
      await prepareShadow();
    } finally {
      stands.removeFromParent();
      mesh.visible = savedVisible;
      geometry.instanceCount = savedCount;
      if(effect&&savedWear){effect.visible=savedWear.visible;effect.geometry.instanceCount=savedWear.count;}
      for(const restore of restoreUnions)restore();
    }
  }
  private readonly travelKeys = new Map<number,string>();
  /** One-way extension at adoption, never per frame or per garment removal.
   * Shared actor/cargo/fire trajectories and material graphs retain identity.
   * Keep retired geometries until teardown: Three's disposal also frees
   * shared attributes recorded by its previous RenderObject. */
  private extendResidentGeometry(smithing:boolean,mace:boolean,longsword:boolean,spear:boolean):void {
    if(this.smithingGeometry===smithing&&this.maceGeometry===mace&&this.longswordGeometry===longsword&&this.spearGeometry===spear)return;
    this.smithingGeometry=smithing;this.maceGeometry=mace;this.longswordGeometry=longsword;this.spearGeometry=spear;
    if(!this.pawnMesh)return;
    const previous=this.pawnMesh.geometry as THREE.InstancedBufferGeometry,next=this.createHumanGeometry();
    for(const [name,attribute]of Object.entries(previous.attributes))if(attribute instanceof THREE.InstancedBufferAttribute
      ||attribute instanceof THREE.InterleavedBufferAttribute&&attribute.data instanceof THREE.InstancedInterleavedBuffer)next.setAttribute(name,attribute);
    next.userData={...previous.userData,...next.userData};next.instanceCount=previous.instanceCount;
    this.pawnMesh.geometry=next;this.retiredPawnGeometries.push(previous);
    this.adoptBodyGeometry(next);
  }
  private createPawnMesh(count: number): void {
    this.retireWearEffect();
    this.clearBodyPartUnions();
    clearGroup(this.group);
    const geometry=this.createHumanGeometry();
    geometry.userData.animationCache=this.animationCache;
    const travel = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
    for(let i=0;i<count;i++)travel.setW(i,1);
    geometry.setAttribute('aTravel', travel);
    geometry.setAttribute('aFrom', new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4));
    geometry.setAttribute('aTo', new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4));
    geometry.setAttribute('aMotion', new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4));
    // One resident appearance stream leaves WebGPU within its eight-buffer limit.
    const appearance=new THREE.InstancedInterleavedBuffer(new Float32Array(count*18),18).setUsage(THREE.StaticDrawUsage);
    for(const [name,size,offset] of [['aTint',3,0],['aEquipment',4,3],['aSkin',3,7],['aHair',3,10],['aHairBlood',4,10],['aShape',4,14],['aBodyBlood',1,13]] as const)
      geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(appearance,size,offset));
    // Z/W carry a short, presentation-only handoff interval. X/Y retain the
    // existing kind and load for HUD probes and the pawn's own geometry.
    geometry.setAttribute('aCargo', new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4));
    for (const name of ['aFrom', 'aTo', 'aMotion', 'aCargo', 'aTravel']) (geometry.getAttribute(name) as THREE.InstancedBufferAttribute).setUsage(THREE.StaticDrawUsage);
    const mat = material(0xffffff);
    this.configure?.(actorExplorationMaterial256(mat));
    // One factory for both graphs. The original clock deliberately has no
    // animationCache, so the native body has no retained flag/root read at all.
    const originalClock = { travelTime: this.travelTime, blend: this.blend };
    const makeOriginalPosition = (probe?:{bone:0|3;point:THREE.Node<'vec3'>}):THREE.Node<'vec3'> => Fn(() => {
      const bone = probe?float(probe.bone):pawnBoneNode(this.referenceRig),probeTraits=probe?{bone,dye:float(2)}:undefined;
      const bindPivot=probe?probe.bone===3?vec3(ORIGAMI_HUMAN_BIND.shoulderX,ORIGAMI_HUMAN_BIND.shoulderY,0):vec3(0,ORIGAMI_HUMAN_BIND.hipY,0):attribute('bindPivot','vec3');
      const pivot = pawnMorph(bindPivot,this.referenceRig,probeTraits);
      const motion = attribute('aMotion', 'vec4');
      const pose = pawnPresentationPose(originalClock);
      // This branch is the complete original rig. Intermediate and distant
      // actors use retained CPU coefficients in the other branch.
      const time=this.time,decorativeSin=(phase:THREE.Node<'float'>)=>sin(phase);
      const transitioning=motion.x.lessThan(-.5);
      const packed=motion.x.negate().sub(1);
      const transitionWalk=packed.greaterThan(CROUCH_WALK_MARK);
      const walking=transitioning.select(transitionWalk.select(float(1),float(0)),motion.x);
      // Motion.w carries the phase at the beginning of an active edge. The
      // distance is computed from the same interpolated XZ pose as the body,
      // so a slowed/stunned edge cannot keep cycling the limbs in place.
      const gaitPhase=float(0).toVar();
      If(bone.greaterThan(1.5).or(bone.equal(1).and(walking.greaterThan(.5))),()=>{
        gaitPhase.assign(motion.w.add(pose.xz.sub(attribute('aFrom','vec4').xz).length().mul(HUMAN_GAIT_RADIANS_PER_UNIT)));
      });
      const ground=motion.z.equal(WORK_POSE.ground),low=ground.or(motion.z.equal(WORK_POSE.groundMelee));
      const crouch=low.select(float(1),float(0)).toVar();
      If(transitioning,()=>{
        const payload=transitionWalk.select(packed.sub(CROUCH_WALK_MARK),packed);
        const start=payload.floor().sub(CROUCH_PADDING).div(CROUCH_QUANTA*TICKS_PER_SECOND);
        const elapsed=this.travelTime.sub(start).div(CROUCH_TICKS/TICKS_PER_SECOND).clamp(0,1);
        const smooth=elapsed.mul(elapsed).mul(float(3).sub(elapsed.mul(2)));
        crouch.assign(mix(payload.fract(),crouch,smooth));
      });
      const angle = float(0).toVar();
      const sign = float(1).toVar();
      const idle=motion.z.equal(0).and(walking.lessThan(.5)).and(motion.y.equal(0));
      // Quiet breathing and weight shifts share the presentation clock. They
      // stop on pause and cannot change a logical position or decision.
      const breath=float(0).toVar();
      If(idle.and(bone.lessThan(3.5)),()=>{breath.assign(decorativeSin(time.add(motion.w)));});
      If(bone.equal(3).or(bone.equal(4)).or(bone.equal(6)), () => { sign.assign(-1); });
      If(bone.greaterThan(1.5), () => {
        angle.assign(decorativeSin(gaitPhase).mul(walking).mul(sign).mul(0.65));
        If(bone.lessThan(3.5), () => {
          If(motion.y.greaterThan(0).and(motion.z.lessThan(10.5)),()=>{
            angle.addAssign(decorativeSin(time.mul(12).add(motion.w)).mul(0.35).sub(0.8));
          });
          If(attribute('aCargo', 'vec4').x.abs().greaterThan(0.5), () => {
            angle.assign(float(-0.9).add(decorativeSin(gaitPhase).mul(walking).mul(0.06)));
            If(motion.z.greaterThan(1.5), () => { angle.assign(float(-1.3).add(decorativeSin(time.mul(4).add(motion.w)).mul(0.22))); });
          });
        });
      });
      // Every working silhouette has a small continuous gesture in the
      // resident rig. Cooking stirs; research taps; fabrication alternates
      // hands. The torso and head participate without CPU bone updates.
      const stroke=float(0).toVar();
      const busy=motion.z.equal(WORK_POSE.mine).or(motion.z.equal(WORK_POSE.chop)).or(motion.z.equal(WORK_POSE.build))
        .or(motion.z.equal(WORK_POSE.craft)).or(motion.z.equal(WORK_POSE.ground));
      If(busy.and(bone.lessThan(3.5)),()=>{stroke.assign(decorativeSin(time.mul(11).add(motion.w)));});
      const swing=stroke;
      If(busy.and(bone.equal(0)),()=>{
        angle.assign(swing.mul(motion.z.equal(WORK_POSE.mine).or(motion.z.equal(WORK_POSE.chop)).select(float(.13),float(.065))));
      });
      If(busy.and(bone.equal(1)),()=>{
        angle.assign(decorativeSin(time.mul(7).add(motion.w).add(.7)).mul(.075));
      });
      If(motion.z.equal(WORK_POSE.mine).and(bone.greaterThan(1.5)).and(bone.lessThan(3.5)),()=>{
        angle.assign(stroke.mul(.78).sub(1.44));
      });
      If(motion.z.equal(WORK_POSE.chop).and(bone.greaterThan(1.5)).and(bone.lessThan(3.5)),()=>{
        angle.assign(bone.equal(3).select(stroke.mul(.95).sub(1.25),float(-.64)));
      });
      If(motion.z.equal(WORK_POSE.build).and(bone.greaterThan(1.5)).and(bone.lessThan(3.5)),()=>{
        angle.assign(bone.equal(3).select(stroke.mul(.53).sub(.92),float(-.45)));
      });
      If(motion.z.equal(WORK_POSE.craft).and(bone.greaterThan(1.5)).and(bone.lessThan(3.5)),()=>{
        const cadence=motion.y.equal(2).select(float(8),motion.y.equal(3).select(float(5),float(11)));
        const breadth=motion.y.equal(2).select(float(.62),motion.y.equal(3).select(float(.33),float(.54)));
        angle.assign(decorativeSin(time.mul(cadence).add(motion.w).add(bone.equal(3).select(float(1.25),float(0))))
          .mul(breadth).sub(motion.y.equal(3).select(float(.99),float(.87))));
      });
      If(bone.equal(1).and(walking.greaterThan(.5)),()=>{
        angle.assign(decorativeSin(gaitPhase).mul(.045));
      });
      If(idle.and(bone.equal(0)),()=>{ angle.assign(breath.mul(.018)); });
      If(idle.and(bone.equal(1)),()=>{ angle.assign(breath.mul(.026)); });
      If(idle.and(bone.greaterThan(1.5)).and(bone.lessThan(3.5)),()=>{
        angle.assign(breath.mul(bone.equal(3).select(float(-.025),float(.025))).add(.035));
      });
      If(motion.z.greaterThan(2.5).and(motion.z.lessThan(3.5)).and(bone.greaterThan(3.5)), () => {
        angle.assign(bone.lessThan(5.5).select(float(-Math.PI / 2), float(0)));
      });
      If(motion.z.equal(WORK_POSE.groundMelee).and(bone.greaterThan(1.5)).and(bone.lessThan(3.5)),()=>{
        angle.assign(sin(this.travelTime.sub(motion.w).mul(4).clamp(0,1).mul(Math.PI)).mul(-.9).sub(.2));
      });
      // A stable appearance-based phase survives the ready -> strike clock
      // switch in aMotion.w. Confirmed strikes add a short accent to the same
      // continuous arm/torso/leg rhythm instead of replacing the whole pose.
      const brawl=motion.z.equal(POSE_FIGHT_READY).or(motion.z.equal(8));
      const fightPhase=time.mul(8).add(attribute('aShape','vec4').x.mod(10).mul(3.7)).add(attribute('aHairBlood','vec4').x.mul(7)).toVar();
      const strike=motion.z.equal(8).select(
        sin(this.travelTime.sub(motion.w).mul(4).clamp(0,1).mul(Math.PI)),float(0));
      If(brawl.and(bone.greaterThan(1.5)).and(bone.lessThan(3.5)),()=>{
        angle.assign(decorativeSin(fightPhase.add(bone.equal(3).select(float(Math.PI),float(0))))
          .mul(.29).sub(.95).sub(strike.mul(bone.equal(3).select(float(.85),float(.3)))));
      });
      If(brawl.and(bone.equal(0).or(bone.equal(1))),()=>{
        angle.assign(decorativeSin(fightPhase).mul(bone.equal(0).select(float(.105),float(.06))).sub(strike.mul(.11)));
      });
      If(brawl.and(bone.greaterThan(3.5)),()=>{
        angle.assign(decorativeSin(fightPhase.add(bone.equal(4).or(bone.equal(6)).select(float(0),float(Math.PI))))
          .mul(bone.lessThan(5.5).select(float(.12),float(.055))));
      });
      const shooting=motion.z.equal(7).or(motion.z.equal(15));
      If(shooting.and(bone.greaterThan(1.5)).and(bone.lessThan(3.5)),()=>{
        angle.assign(bone.equal(3).select(float(-1.54),float(-1.12)));
      });
      If(motion.z.equal(4).and(bone.equal(3)), () => { angle.assign(decorativeSin(time.mul(2).add(motion.w)).mul(1.1).sub(.35)); });
      If(crouch.greaterThan(0).and(brawl.not()).and(bone.lessThan(3.5)),()=>{
        const lowAngle=bone.equal(0)
          .select(decorativeSin(time.mul(8).add(motion.w)).mul(.085).sub(.09),
            bone.equal(1).select(decorativeSin(time.mul(8).add(motion.w).add(.7)).mul(.055).add(.055),
              decorativeSin(time.mul(8).add(motion.w).add(bone.equal(3).select(float(2.1),float(0)))).mul(.39).sub(.65)));
        // Keep the active strike of a low melee target, but transition ordinary
        // ground-work hands with the same bend as the body.
        If(motion.z.notEqual(WORK_POSE.groundMelee),()=>{angle.assign(mix(angle,lowAngle,crouch));});
      });
      If(crouch.greaterThan(0).and(bone.greaterThan(3.5)),()=>{
        const lowLeg=decorativeSin(time.mul(8).add(motion.w).add(bone.equal(4).or(bone.equal(6)).select(float(0),float(Math.PI))))
          .mul(bone.lessThan(5.5).select(float(.045),float(.025)));
        angle.assign(mix(angle,lowLeg,crouch));
      });
      const local = pawnMorph(probe?.point??positionLocal,this.referenceRig,probeTraits).sub(pivot);
      const c = cos(angle), s = sin(angle);
      const animated = vec3(local.x, local.y.mul(c).sub(local.z.mul(s)), local.y.mul(s).add(local.z.mul(c))).add(pivot).toVar();
      If(busy.and(bone.lessThan(3.5)),()=>{
        animated.y.addAssign(stroke.mul(.012));
      });
      If(idle.and(bone.lessThan(3.5)),()=>{
        animated.y.addAssign(breath.mul(.007));
        animated.z.addAssign(breath.mul(.004));
      });
      If(crouch.greaterThan(0),()=>{
        // Blend the entire low silhouette, not just its vertical offset. Feet
        // stay anchored while the hands, head and torso continue to move.
        const upright=animated.toVar();
        If(bone.greaterThan(3.5),()=>{animated.y.assign(animated.y.sub(this.humanBind.foot).mul(.72).add(this.humanBind.foot));});
        If(bone.lessThan(3.5),()=>{
          const y=animated.y.sub(this.humanBind.hip).toVar(),z=animated.z.toVar();
          animated.y.assign(y.mul(.91).sub(z.mul(.42)).add(this.humanBind.crouchHip));
          animated.z.assign(y.mul(.42).add(z.mul(.91)).add(this.humanBind.crouchZ));
        });
        animated.assign(mix(upright,animated,crouch));
      });
      If(brawl.and(bone.lessThan(3.5)),()=>{
        animated.y.addAssign(decorativeSin(fightPhase.mul(2)).mul(.014));
        animated.z.addAssign(decorativeSin(fightPhase).mul(.025));
      });
      If(motion.z.greaterThan(2.5).and(motion.z.lessThan(3.5)), () => {
        // Thigh rotates around the hip; the lower leg keeps its vertical pose
        // at the translated knee. Two extra rigid bones, no CPU skeleton update.
        If(bone.greaterThan(5.5), () => { animated.y.addAssign(this.humanBind.kneeSpan); animated.z.addAssign(this.humanBind.kneeSpan); });
        animated.y.addAssign(WORLD_SCALE.stoolHeight / PAWN_MODEL_SCALE - this.humanBind.seatedHip);
      });
      If(motion.z.equal(10).and(bone.lessThan(3.5)),()=>{
        const y=animated.y.sub(this.humanBind.kneelHip).toVar(),z=animated.z.toVar();
        animated.y.assign(y.mul(.82).sub(z.mul(.57)).add(this.humanBind.kneelHip));animated.z.assign(y.mul(.57).add(z.mul(.82)));
      });
      // The equipped object asks this exact rig for its grip anchor. No
      // duplicate arm animation, alternate anatomy or world trajectory exists.
      if(probe)return animated;
      // The first confirmed cooldown image can arrive one local tick after
      // the shot (0.134 s in the native pilot). Keep the cosmetic kick short
      // but long enough to survive that presentation boundary.
      const recoil=motion.z.equal(15).select(float(1).sub(this.travelTime.sub(motion.w).div(.30)).clamp(0,1),float(0));
      if(this.referenceRig){
        const dye=pawnDyeNode(true),equipmentVertex=RESIDENT_WEAPON_VISUALS269.reduce((matches,weapon)=>matches.or(dye.equal(weapon.dye)),dye.equal(-999));
        If(equipmentVertex,()=>{
          const hand=makeOriginalPosition({bone:3,point:vec3(...ORIGAMI_EQUIPMENT_HAND)}).toVar();
          const sling=dye.equal(-4).or(dye.equal(-9)).or(dye.equal(SPEAR_DYE272));
          const stowed=makeOriginalPosition({bone:0,point:sling.select(vec3(...ORIGAMI_EQUIPMENT_SLING),vec3(...ORIGAMI_EQUIPMENT_BELT))}).toVar();
          const reach=sin(this.travelTime.sub(motion.w).mul(4).clamp(0,1).mul(Math.PI));
          for(const weapon of RESIDENT_WEAPON_VISUALS269)If(dye.equal(weapon.dye),()=>{animated.assign(origamiEquipmentPositionNode(weapon.item,positionLocal,hand,stowed,motion.z,motion.y,reach,recoil));});
        });
        for(const weapon of RESIDENT_WEAPON_VISUALS269)If(dye.equal(weapon.dye).and(attribute('aEquipment','vec4').x.floor().notEqual(weapon.equipment)),()=>{animated.assign(vec3(0));});
      }else for(const weapon of RESIDENT_WEAPON_VISUALS269) {
        const isWeapon=pawnDyeNode(this.referenceRig).equal(weapon.dye);
        const along=positionLocal.y.sub(.68),across=positionLocal.x.sub(.205),depth=positionLocal.z;
        if(weapon.item==='bolt-action-rifle'||weapon.item==='emp-launcher') {
          // High diagonal sling at rest: the long gun remains legible above
          // the torso. During aim its authored barrel (+Y) points forward.
          If(isWeapon,()=>{ animated.assign(vec3(along.mul(.30).add(across).add(.13),along.mul(.78).add(depth.mul(.12)).add(.84),depth.mul(.8).add(.25))); });
          If(shooting.and(isWeapon),()=>{ animated.assign(vec3(across.add(.10*this.humanBind.weaponXScale),depth.add(this.humanBind.gunY).add(recoil.mul(.035)),along.add(this.humanBind.gunZ).sub(recoil.mul(.12)))); });
        } else if(weapon.item==='spear-family') {
          If(isWeapon,()=>{animated.assign(spearPositionNode272(along,across,depth,sin(this.travelTime.sub(motion.w).mul(4).clamp(0,1).mul(Math.PI)),motion.y,motion.z.equal(8).or(motion.z.equal(WORK_POSE.groundMelee))));});
        } else if(weapon.item==='longsword-family') {
          If(isWeapon,()=>{animated.assign(longswordPositionNode270(along,across,depth,sin(this.travelTime.sub(motion.w).mul(4).clamp(0,1).mul(Math.PI)),motion.y,motion.z.equal(8).or(motion.z.equal(WORK_POSE.groundMelee))));});
        } else if(weapon.item==='mace-family') {
          If(isWeapon,()=>{animated.assign(macePositionNode269(along,across,depth,sin(this.travelTime.sub(motion.w).mul(4).clamp(0,1).mul(Math.PI)),motion.y,motion.z.equal(8).or(motion.z.equal(WORK_POSE.groundMelee))));});
        } else {
          If(isWeapon,()=>{ animated.assign(vec3(across.add(.27),along.mul(.82).add(.65),depth.add(.13))); });
          If(shooting.and(isWeapon),()=>{ animated.assign(vec3(across.add(.19*this.humanBind.weaponXScale),depth.add(this.humanBind.pistolY).add(recoil.mul(.035)),along.add(this.humanBind.pistolZ).sub(recoil.mul(.09)))); });
          if(weapon.item==='plasteel-knife')If(motion.z.equal(8).or(motion.z.equal(WORK_POSE.groundMelee)).and(isWeapon),()=>{
            const reach=sin(this.travelTime.sub(motion.w).mul(4).clamp(0,1).mul(Math.PI));
            animated.assign(vec3(across.add(.23),depth.add(.83),along.add(.38).add(reach.mul(.2))));
          });
        }
        If(isWeapon.and(attribute('aEquipment','vec4').x.floor().notEqual(weapon.equipment)),()=>{animated.assign(vec3(0));});
      }
      // Holstered equipment follows the same full-body transformation as the
      // torso when reclining, dying or being carried. Previously it was reset
      // to the standing hip after these poses and floated above the sleeper.
      If(motion.z.equal(1).or(motion.z.equal(5)).or(motion.z.equal(POSE_SLEEP)).or(motion.z.equal(POSE_DEAD)), () => {
        const y = animated.y.toVar();
        animated.y.assign(animated.z.add(.19));
        animated.z.assign(float(this.humanBind.lieCenter).sub(y));
      });
      If(motion.z.equal(POSE_DEAD),()=>{ animated.z.assign(animated.z.mul(.78)); });
      If(motion.z.equal(6),()=>{
        const x=animated.x.toVar(),y=animated.y.toVar(),z=animated.z.toVar();
        animated.assign(vec3(float(this.humanBind.lieCenter).sub(y),z.add(.19+.95/PAWN_MODEL_SCALE),x.add(.3)));
      });
      If(pawnDyeNode(this.referenceRig).equal(-3).and(this.referenceRig?attribute('aEquipment','vec4').y.notEqual(2):attribute('aEquipment','vec4').y.notEqual(2).and(attribute('aEquipment','vec4').y.notEqual(3))),()=>{animated.assign(vec3(0));});
      if(this.referenceRig){If(pawnDyeNode(true).equal(ORIGAMI_DUSTER_DYE).and(attribute('aEquipment','vec4').y.notEqual(3)).or(pawnDyeNode(true).equal(ORIGAMI_PARKA_DYE).and(attribute('aEquipment','vec4').y.notEqual(4))),()=>{animated.assign(vec3(0));});}
      // Vest is bit0. Mutually exclusive headgear occupies even codes:
      // flak2, recon4, cloth tuque6, wool tuque8, simple10. No new buffer.
      const wornFlags=attribute('aEquipment','vec4').z.floor(),helmet=wornFlags.greaterThan(1.5),recon=wornFlags.greaterThan(3.5).and(wornFlags.lessThan(5.5)),tuque=wornFlags.greaterThan(5.5).and(wornFlags.lessThan(9.5));
      If(pawnDyeNode(this.referenceRig).equal(-2).and(wornFlags.mod(2).lessThan(.5)),()=>{animated.assign(vec3(0));});
      If(pawnDyeNode(this.referenceRig).equal(FLAK_HELMET_DYE).and(helmet.not().or(wornFlags.greaterThan(3.5))),()=>{animated.assign(vec3(0));});
      If(pawnDyeNode(this.referenceRig).equal(PLATE_ARMOR_DYE).and(attribute('aEquipment','vec4').y.notEqual(6)),()=>{animated.assign(vec3(0));});
      If(pawnDyeNode(this.referenceRig).equal(SIMPLE_HELMET_DYE).and(wornFlags.lessThan(9.5).or(wornFlags.greaterThan(11.5))),()=>{animated.assign(vec3(0));});
      If(pawnDyeNode(this.referenceRig).equal(this.referenceRig?ORIGAMI_RECON_ARMOR_DYE:RECON_ARMOR_DYE).and(attribute('aEquipment','vec4').y.notEqual(5)),()=>{animated.assign(vec3(0));});
      If(pawnDyeNode(this.referenceRig).equal(RECON_HELMET_DYE).and(recon.not()),()=>{animated.assign(vec3(0));});
      If(pawnDyeNode(this.referenceRig).equal(TUQUE_DYE).and(tuque.not()),()=>{animated.assign(vec3(0));});
      If(pawnDyeNode(this.referenceRig).equal(PARKA_HOOD_DYE).and(attribute('aEquipment','vec4').y.notEqual(4).or(helmet)),()=>{animated.assign(vec3(0));});
      // One face variant is visible at a time. The pause-controlled scene
      // clock also freezes blinks and sleep poses when the game is paused.
      const dye=pawnDyeNode(this.referenceRig),asleep=motion.z.equal(POSE_SLEEP),dead=motion.z.equal(POSE_DEAD);
      // The presentation clock wraps at 2π during tracked play, so the
      // frequency is integral and cannot jump at that wrap boundary.
      const blink=decorativeSin(time.add(motion.w.mul(1.97))).greaterThan(.994);
      const face=dead.select(float(PAWN_EYE_CROSS),asleep.or(blink).select(float(PAWN_EYE_CLOSED),float(PAWN_EYE_OPEN)));
      If(dye.greaterThanEqual(PAWN_EYE_OPEN).and(dye.lessThanEqual(PAWN_EYE_CROSS)).and(dye.notEqual(face)),()=>{ animated.assign(vec3(0)); });
      If(recon.and(dye.greaterThanEqual(PAWN_EYE_OPEN)).and(dye.lessThanEqual(PAWN_EYE_CROSS)),()=>{ animated.assign(vec3(0)); });
      If(hiddenAppearancePart(this.referenceRig),()=>{ animated.assign(vec3(0)); });
      if(this.referenceRig){const tool=dye.lessThanEqual(-30).and(dye.greaterThanEqual(-32));If(tool.and(dye.notEqual(attribute('aMotion','vec4').y).or(attribute('aCargo','vec4').x.abs().greaterThan(.5))),()=>{animated.assign(vec3(0));});}
      // Four anatomical bits share aShape.x. Degenerate each absent limb at
      // the common body origin after pose/portage transforms; colour and shadow
      // passes use this same node, without another mesh or actor attribute.
      const limbMask=attribute('aShape','vec4').x.div(100).floor();
      for(const limb of HUMAN_LIMB_VISUALS){
        const limbBone=limb.bones.reduce((matches,id)=>matches.or(bone.equal(id)),bone.equal(-1));
        If(limbBone.and(limbMask.div(limb.bit).floor().mod(2).greaterThan(.5)),()=>{ animated.assign(vec3(0)); });
      }
      If(helmet.and(dye.greaterThanEqual(100)).and(dye.lessThan(200)),()=>{ animated.assign(vec3(0)); });
      If(recon.and(dye.greaterThanEqual(200)),()=>{ animated.assign(vec3(0)); });
      const rotStage=attribute('aShape','vec4').x.div(10).floor().mod(10);
      // A dried body loses the garment/hair silhouette and narrows in the
      // same resident rig. The palette below reveals a pale skeletal form.
      If(rotStage.greaterThan(1.5),()=>{
        If(dye.lessThan(0).or(dye.greaterThanEqual(100)),()=>{ animated.assign(vec3(0)); });
        animated.x.assign(animated.x.mul(.78));
      });
      const cy = cos(pose.w), sy = sin(pose.w);
      return vec3(animated.x.mul(cy).add(animated.z.mul(sy)), animated.y, animated.z.mul(cy).sub(animated.x.mul(sy))).mul(PAWN_MODEL_SCALE).add(pose.xyz);
    })();
    const originalPosition = makeOriginalPosition();
    mat.positionNode=Fn(()=>{const result=vec3(0).toVar();If(this.animationCache.cached(),()=>{result.assign(this.cachedPawnPosition());}).Else(()=>{result.assign(originalPosition);});return result;})();
    const origamiProfiles=humanReferencePaintProfiles();
    // Resolve the metadata lookup once in the vertex stage. Passing its one
    // constant-per-part ID with the existing traits keeps bumpMap's three
    // isolated UV contexts from re-expanding instance attributes as varyings.
    const origamiVertexTraits=this.graphics?Fn(()=>{
      const raw=attribute('pawnRigTraits','vec4'),outfit=attribute('aEquipment','vec4').y,selected=raw.z.toVar();
      const sleeve=raw.x.greaterThanEqual(2).and(raw.x.lessThanEqual(3)).and(raw.y.equal(1));
      If(sleeve.and(outfit.equal(2)),()=>{selected.assign(origamiProfiles!.skin);});
      If(sleeve.and(outfit.equal(3).or(outfit.equal(4))),()=>{selected.assign(origamiProfiles!.outerwear);});
      const resolved=float(0).toVar();If(this.graphics!.surfaceEncoding.greaterThan(0),()=>{resolved.assign(this.graphics!.humanProfileNode(selected,attribute('aShape','vec4').w.div(32).floor(),raw.y));});
      return vec4(raw.xyz,resolved);
    })():undefined;
    const origamiTraits=origamiVertexTraits?varying(origamiVertexTraits,'v_pawnOrigamiTraits').setInterpolation('flat'):undefined;
    const origamiBloodBind=this.referenceRig?(()=>{
      const bone=attribute('pawnRigTraits','vec4').x,region=bone.greaterThanEqual(6).select(bone.sub(2),bone);
      // Both pigment graphs share one bind-space transport. Creating it here
      // keeps repeated Fn builds and normal-map contexts from allocating new
      // anonymous position/region varyings; its interpolation is unchanged.
      return varying(vec4(attribute('position','vec3'),region),'v_pawnBloodBind');
    })():undefined;
    const baseColor = Fn(()=>{const traits=origamiTraits??pawnFragmentTraits;const fragmentBone=traits.x,fragmentDye=traits.y;const tint=mix(attribute('color','vec3'),attribute('aTint','vec3'),fragmentDye.equal(1).select(float(1),float(0))).toVar();
      If(fragmentDye.equal(SPEAR_DYE272),()=>{
        const material=attribute('aEquipment','vec4').x.fract().mul(8).round();
        for(const [index,item]of SPEAR_ITEMS_272.entries()){const c=new THREE.Color(spearColor272(item));If(material.equal(index+1),()=>{tint.mulAssign(vec3(c.r,c.g,c.b));});}
      });
      If(fragmentDye.equal(LONGSWORD_DYE270),()=>{
        const material=attribute('aEquipment','vec4').x.fract().mul(8).round();
        for(const [index,item]of LONGSWORD_ITEMS_270.entries()){const c=new THREE.Color(longswordColor270(item));If(material.equal(index+1),()=>{tint.mulAssign(vec3(c.r,c.g,c.b));});}
      });
      If(fragmentDye.equal(MACE_DYE269),()=>{
        const material=attribute('aEquipment','vec4').x.fract().mul(8).round();
        for(const [index,item]of MACE_ITEMS_269.entries()){const c=new THREE.Color(maceColor269(item));If(material.equal(index+1),()=>{tint.mulAssign(vec3(c.r,c.g,c.b));});}
      });
      {const wool=new THREE.Color(0xb3c0ba);If(fragmentDye.equal(TUQUE_DYE).and(attribute('aEquipment','vec4').z.greaterThan(7.5)),()=>{tint.assign(vec3(wool.r,wool.g,wool.b));});}
      If(fragmentDye.equal(PLATE_ARMOR_DYE),()=>{tint.assign(attribute('aTint','vec3'));});
      for(const [index,hex] of SIMPLE_HELMET_COLORS267.entries()){const color=new THREE.Color(hex);If(fragmentDye.equal(SIMPLE_HELMET_DYE).and(attribute('aEquipment','vec4').w.fract().mul(16).round().equal(index+1)),()=>{tint.assign(vec3(color.r,color.g,color.b));});}
      If(fragmentDye.equal(-3).or(fragmentDye.equal(PARKA_HOOD_DYE)),()=>{ tint.assign(attribute('aTint','vec3')); });
      if(this.referenceRig)If(fragmentDye.equal(ORIGAMI_DUSTER_DYE).or(fragmentDye.equal(ORIGAMI_PARKA_DYE)),()=>{tint.assign(attribute('aTint','vec3'));});
      If(attribute('aEquipment','vec4').y.equal(2).and(fragmentBone.greaterThanEqual(2)).and(fragmentBone.lessThanEqual(3)),()=>{ tint.assign(attribute('aSkin','vec3')); });
      If(fragmentDye.equal(2),()=>{ tint.assign(attribute('aSkin','vec3')); });
      If(fragmentDye.greaterThanEqual(100),()=>{ tint.assign(attribute('aHairBlood','vec4').xyz); });
      const legs=fragmentBone.greaterThanEqual(4).and(fragmentDye.equal(0)),pants=attribute('aEquipment','vec4').w.floor();
      {const color=new THREE.Color(0xa0b2b5);If(fragmentDye.equal(FLAK_HELMET_DYE).and(attribute('aEquipment','vec4').w.fract().greaterThan(.25)),()=>{tint.assign(vec3(color.r,color.g,color.b));});}
      const cloth=new THREE.Color(0xd8c8a2),leather=new THREE.Color(0xad8a61);
      If(legs.and(pants.equal(1)),()=>{ tint.assign(vec3(cloth.r,cloth.g,cloth.b)); });
      If(legs.and(pants.equal(2)),()=>{ tint.assign(vec3(leather.r,leather.g,leather.b)); });
      {const color=new THREE.Color(0xa88b63);If(legs.and(pants.equal(3)),()=>{ tint.assign(vec3(color.r,color.g,color.b)); });}
      {const color=new THREE.Color(0x839ac5);If(legs.and(pants.equal(4)),()=>{ tint.assign(vec3(color.r,color.g,color.b)); });}
      {const color=new THREE.Color(0xc3a375);If(legs.and(pants.equal(5)),()=>{ tint.assign(vec3(color.r,color.g,color.b)); });}
      {const color=new THREE.Color(0xb3c0ba);If(legs.and(pants.equal(6)),()=>{ tint.assign(vec3(color.r,color.g,color.b)); });}
      {const color=new THREE.Color(0xb26422);If(legs.and(pants.equal(7)),()=>{ tint.assign(vec3(color.r,color.g,color.b)); });}
      {const color=new THREE.Color(0x707070);If(legs.and(pants.equal(8)),()=>{ tint.assign(vec3(color.r,color.g,color.b)); });}
      {const color=new THREE.Color(0xcecece);If(legs.and(pants.equal(9)),()=>{tint.assign(vec3(color.r,color.g,color.b));});}
      {const color=new THREE.Color(0xb1b1b1);If(legs.and(pants.equal(10)),()=>{tint.assign(vec3(color.r,color.g,color.b));});}
      {const word=attribute('aEquipment','vec4').z.fract().mul(65536).round(),code=word.sub(1);If(fragmentDye.equal(-2).and(word.greaterThan(0)),()=>{tint.assign(vec3(code.div(1024).floor().div(31),code.div(32).floor().mod(32).div(31),code.mod(32).div(31)));});}
      const stage=attribute('aShape','vec4').x.div(10).floor().mod(10);
      {const red=new THREE.Color(0x965f58);If(stage.equal(1),()=>{ tint.assign(mix(tint,vec3(red.r,red.g,red.b),.7)); });}
      {const bone=new THREE.Color(0xc9bd9b),dark=new THREE.Color(0x554e43);
        const eyes=fragmentDye.greaterThanEqual(PAWN_EYE_OPEN).and(fragmentDye.lessThanEqual(PAWN_EYE_CROSS));
        If(stage.greaterThan(1.5),()=>{
          tint.assign(eyes.select(vec3(dark.r,dark.g,dark.b),vec3(bone.r,bone.g,bone.b)));
          // Sparse dark gaps read as ribs in the existing torso geometry.
          const ribs=sin(positionLocal.y.mul(43)).greaterThan(.25);
          If(fragmentBone.equal(0).and(fragmentDye.equal(1)),()=>{ tint.assign(ribs.select(vec3(bone.r,bone.g,bone.b),vec3(dark.r,dark.g,dark.b))); });
        });}
      // Blood is drawn only on body/clothes, never weapon, hair or eye marks.
      const dye=fragmentDye,bone=fragmentBone;
      const region=bone.greaterThanEqual(6).select(bone.sub(2),bone);
      const clothPart=dye.equal(-3).or(dye.equal(-2)).or(dye.greaterThanEqual(0).and(dye.lessThan(3)));
      const bloodSurface=this.referenceRig?clothPart.or(dye.equal(ORIGAMI_DUSTER_DYE)).or(dye.equal(ORIGAMI_PARKA_DYE)):clothPart;
      return bodyBloodPigment(tint,region,1,bloodSurface.select(float(1),float(0)),attribute('aHairBlood','vec4').w,origamiBloodBind);})();
    mat.colorNode = baseColor;
    const textured = material(0xffffff);
    this.configure?.(actorExplorationMaterial256(textured));
    textured.positionNode = mat.positionNode;
    textured.colorNode = baseColor.mul(pawnSurfaceShade(this.surfaceTexture));
    let bodySurfaceOptions:SharedPaintSurfaceOptions|undefined;
    if(this.graphics&&origamiTraits){
      const profiles=origamiProfiles!,bone=origamiTraits.x,dye=origamiTraits.y;

      const region=bone.greaterThanEqual(6).select(bone.sub(2),bone),cloth=dye.equal(-3).or(dye.equal(-2)).or(dye.equal(ORIGAMI_DUSTER_DYE)).or(dye.equal(ORIGAMI_PARKA_DYE)).or(dye.greaterThanEqual(0).and(dye.lessThan(3)));
      const transformPaint=(sourcePaint:THREE.Node<'vec3'>)=>Fn(()=>{
        const pigment=sourcePaint.toVar(),stage=attribute('aShape','vec4').x.div(10).floor().mod(10),red=new THREE.Color(0x965f58),boneColor=new THREE.Color(0xc9bd9b),dark=new THREE.Color(0x554e43),steel=new THREE.Color(0x6c767d);
        const weapon=RESIDENT_WEAPON_VISUALS269.reduce((selected,variant)=>selected.or(dye.equal(variant.dye)),dye.equal(-999));
        // Equipment is an adaptation absent from this reference anatomy. Keep
        // its genuine material/trim pigments as ratios to the steel recipe;
        // reference skin, hair, garments and face receive no RGB multiplier.
        If(weapon,()=>{pigment.mulAssign(baseColor.div(vec3(steel.r,steel.g,steel.b)));});
        const tool=dye.lessThanEqual(-30).and(dye.greaterThanEqual(-32)),trim=dye.equal(ORIGAMI_RECON_ARMOR_DYE).or(dye.equal(RECON_HELMET_DYE)).or(tool);
        If(trim.and(origamiTraits.z.equal(profiles.steel)),()=>{pigment.mulAssign(attribute('color','vec3').div(vec3(steel.r,steel.g,steel.b)));});
        If(stage.equal(1).and(weapon.not()),()=>{pigment.assign(mix(pigment,vec3(red.r,red.g,red.b),.7));});
        If(stage.greaterThan(1.5),()=>{
          const eyes=dye.greaterThanEqual(PAWN_EYE_OPEN).and(dye.lessThanEqual(PAWN_EYE_CROSS));
          pigment.assign(eyes.select(vec3(dark.r,dark.g,dark.b),vec3(boneColor.r,boneColor.g,boneColor.b)));
          If(bone.equal(0).and(dye.equal(1)),()=>{pigment.assign(sin(positionLocal.y.mul(43)).greaterThan(.25).select(vec3(boneColor.r,boneColor.g,boneColor.b),vec3(dark.r,dark.g,dark.b)));});
        });
        return bodyBloodPigment(pigment,region,1,cloth.select(float(1),float(0)),attribute('aHairBlood','vec4').w,origamiBloodBind);
      })();
      const context=this.graphics,faceUv=varying(attribute('origamiPaintUv','vec2'),'v_pawnSurfaceUv'),faceId=attribute('pawnRigTraits','vec4').w,table=this.humanStroke!;
      const buildStroke=(surfacePosition?:THREE.Node<'vec3'>,canonical=false)=>{
        const prepared=canonical?undefined:context.preparedStrokes.acquire(table,{revision:()=>this.humanModel!.key,onRepresentationChange:()=>this.refreshHumanBodySurface?.()}),headerTable=prepared?.headerTable()??table,headers=faceStrokeHalfUvVertexHeaders({table:headerTable,faceId,enabled:context.surfaceEncoding.mul(context.lineOpacity),opacity:context.lineOpacity},'v_pawnStrokeHeaderPacked');
        const common={faceId,headers,faceUv,surfacePosition,enabled:context.surfaceEncoding.mul(context.lineOpacity),opacity:context.lineOpacity,brushColor:context.brushColor.rgb,samplePigment:(u:THREE.Node<'vec2'>,x:THREE.Node<'vec2'>,y:THREE.Node<'vec2'>)=>context.sampleStrokePigment(u,x,y),sampleDry:(u:THREE.Node<'vec2'>,x:THREE.Node<'vec2'>,y:THREE.Node<'vec2'>)=>context.sampleStrokeDry(u,x,y)};
        return prepared?(body:THREE.Node<'vec3'>)=>createPreparedAffineStrokeNode(body,{...common,owner:prepared}):(body:THREE.Node<'vec3'>)=>createFaceStrokeNode(body,{...common,table,width:context.edgeWidth,irregularity:context.strokeImperfection});
      };
      this.humanPastelFromSample=sample=>baseColor.mul(pawnSurfaceShadeFromSample(sample));
      bodySurfaceOptions={context,base:baseColor,pastel:baseColor.mul(pawnSurfaceShade(this.surfaceTexture)),faceUv,profile:origamiTraits.w,includeGeneric:false,gouacheTransform:transformPaint,stroke:buildStroke()};applySharedPaintSurface(textured,bodySurfaceOptions);
      this.humanBodyBakeOptions=surfacePosition=>({...bodySurfaceOptions!,surfacePosition,stroke:buildStroke(surfacePosition,true)});
      this.refreshHumanBodySurface=()=>{bodySurfaceOptions={...bodySurfaceOptions!,stroke:buildStroke()};for(const material of[this.texturedMaterial,this.nativeTexturedMaterial])if(material){applySharedPaintSurface(material,bodySurfaceOptions);material.needsUpdate=true;}};
    }
    const nativePlain = material(0xffffff), nativeTextured = material(0xffffff);
    this.configure?.(actorExplorationMaterial256(nativePlain));
    this.configure?.(actorExplorationMaterial256(nativeTextured));
    // Instantiate separately from the LOD Else node: lazy TSL Fn state must
    // not reuse a branch-built root in the independent native pipeline.
    nativePlain.positionNode = makeOriginalPosition();
    nativeTextured.positionNode = nativePlain.positionNode;
    nativePlain.colorNode = baseColor;
    nativeTextured.colorNode = textured.colorNode;
    nativeTextured.normalNode=textured.normalNode;
    if(bodySurfaceOptions)applySharedPaintSurface(nativeTextured,bodySurfaceOptions);
    for(const bodyMaterial of [mat,textured,nativePlain,nativeTextured]){bodyMaterial.roughness=.88;bodyMaterial.metalness=.02;}
    // All variants survive map changes; geometry, appearance and shading stay
    // shared. Explicit disposal below owns these materials, not clearGroup.
    mat.userData.rendererOwned = textured.userData.rendererOwned = true;
    nativePlain.userData.rendererOwned = nativeTextured.userData.rendererOwned = true;
    this.plainMaterial = mat;
    this.texturedMaterial = textured;
    this.nativePlainMaterial = nativePlain;
    this.nativeTexturedMaterial = nativeTextured;
    const mesh = new THREE.Mesh(geometry, this.texturesEnabled ? textured : mat);
    // CPU bounds cannot follow the shader positions. Individual culling/LOD is a later measured optimization.
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'Colonists — procedural eight-bone GPU rig';
    // Three r186 reuses the same override-material RenderObject for this mesh.
    // A changed source graph must explicitly invalidate that override version.
    // Colour draws do nothing; stable shadow draws only compare two scalars.
    const beforeRender = mesh.onBeforeRender;
    const shadowSources = new WeakMap<THREE.Material, {source: THREE.Material; version: number}>();
    mesh.onBeforeRender = function(renderer, scene, camera, geometry, source, group) {
      beforeRender.call(this, renderer, scene, camera, geometry, source, group);
      const override = scene.overrideMaterial as (THREE.Material & {isShadowPassMaterial?: boolean}) | null;
      if (!override?.isShadowPassMaterial) return;
      const previous = shadowSources.get(override);
      if (previous?.source === source && previous.version === source.version) return;
      override.needsUpdate = true;
      shadowSources.set(override, {source, version: source.version});
    };
    this.pawnMesh = mesh;
    if(this.graphics&&!this.bodyAtlas)this.bodyAtlas=new ActorAtlasOwner({key:'human-full-body:'+this.group.uuid,kind:'human',context:this.graphics,readPort:()=>this.bodySurfaceBakeSource(),ownerCount:()=>this.pawnMesh?(this.pawnMesh.geometry as THREE.InstancedBufferGeometry).instanceCount:0,changed:()=>this.selectBodyMaterial(),configure:material=>{this.configure?.(actorExplorationMaterial256(material));}});
    this.selectBodyMaterial();this.group.add(mesh);
    this.adoptBodyGeometry(geometry);
    const cargo = this.cargoModel.createGeometry();
    for (const name of ['aFrom', 'aTo', 'aCargo', 'aMotion', 'aTravel']) cargo.setAttribute(name, geometry.getAttribute(name));
    cargo.setAttribute('aHandoffFrom',new THREE.InstancedBufferAttribute(new Float32Array(count*4),4).setUsage(THREE.StaticDrawUsage));
    cargo.setAttribute('aHandoffTo',new THREE.InstancedBufferAttribute(new Float32Array(count*4),4).setUsage(THREE.StaticDrawUsage));
    const cargoMat = material(0xffffff);
    this.configure?.(actorExplorationMaterial256(cargoMat));
    cargoMat.roughness=.88;cargoMat.metalness=.02;
    cargoMat.colorNode = naturalStroke(this.graphics,this.graphics?this.cargoModel.strokes:undefined)(attribute('color', 'vec3'));
    cargoMat.positionNode = Fn(() => {
      const cached=this.animationCache.cached().toVar(),pose=pawnPresentationPose(this,instanceIndex,cached);
      const load = attribute('aCargo', 'vec4');
      const scale = float(0).toVar();
      If(attribute('cargoKind', 'float').equal(load.x), () => {
        scale.assign(load.y.lessThan(0).select(float(1),load.y).mul(0.25).add(0.75));
        const bit=attribute('corpsePartMask','float');
        If(bit.greaterThan(0).and(load.y.lessThan(0)).and(load.y.negate().sub(1).div(bit.max(1)).floor().mod(2).greaterThan(.5)),()=>{ scale.assign(0); });
      });
      const height = float(WORLD_SCALE.carriedHeight).toVar();
      If(cached,()=>{height.assign(this.animationCache.cell(4).x);}).Else(()=>{
      If(attribute('aMotion','vec4').z.equal(1).or(attribute('aMotion','vec4').z.equal(POSE_SLEEP)).or(attribute('aMotion','vec4').z.equal(POSE_DEAD)),()=>{height.assign(.28);});
      If(attribute('aMotion', 'vec4').z.greaterThan(1.5).and(attribute('aMotion','vec4').z.lessThan(3.5)), () => { height.assign(sin(this.time.mul(4).add(attribute('aMotion', 'vec4').w)).mul(0.08).add(1.32)); });
      If(attribute('aMotion', 'vec4').z.equal(3), () => { height.addAssign(WORLD_SCALE.stoolHeight - this.humanBind.seatedHip * PAWN_MODEL_SCALE); });
      If(attribute('aMotion','vec4').z.equal(6),()=>{height.assign(1.3);});
      });
      const local = positionLocal.mul(scale).toVar();
      // Open only the actually held novel during the published reading phase.
      // Existing motion scalars suffice; no new buffer or per-frame lookup.
      If(attribute('cargoKind','float').equal(itemCargoKind('novel')).and(attribute('aMotion','vec4').y.equal(READING_ACTIVITY295)),()=>{
        local.x.mulAssign(1.45);local.y.addAssign(local.x.abs().mul(.42));
      });
      local.addAssign(vec3(0,height,WORLD_SCALE.carriedForward));
      const cy = this.animationCache.yawNode(pose.w,'cos',instanceIndex,cached), sy = this.animationCache.yawNode(pose.w,'sin',instanceIndex,cached);
      const carried=vec3(local.x.mul(cy).add(local.z.mul(sy)), local.y, local.z.mul(cy).sub(local.x.mul(sy))).add(pose.xyz);
      const result=carried.toVar();
      const start=attribute('aHandoffFrom','vec4'),end=attribute('aHandoffTo','vec4');
      If(load.w.abs().greaterThan(.0001),()=>{
        const progress=this.animationCache.clockNode(this.cargoTime,'cargoTime',instanceIndex,cached).sub(load.z).div(load.w.abs().sub(load.z).max(.001)).clamp(0,1);
        const smooth=progress.mul(progress).mul(float(3).sub(progress.mul(2)));
        const grounded=positionLocal.mul(scale.greaterThan(0).select(end.w,float(0)));
        If(load.w.greaterThan(0),()=>{
          result.assign(mix(start.xyz.add(grounded),carried,smooth));
        }).Else(()=>{
          const cx=cos(start.w),sx=sin(start.w),part=positionLocal.mul(scale);
          const released=vec3(part.x.mul(cx).add(part.z.mul(sx)),part.y,part.z.mul(cx).sub(part.x.mul(sx))).add(start.xyz);
          result.assign(mix(released,end.xyz.add(grounded),smooth));
        });
      });
      return result;
    })();
    this.cargoMesh = new THREE.Mesh(cargo, [cargoMat]);
    this.cargoMesh.name = 'Carried materials — shared GPU pawn poses';
    this.cargoMesh.frustumCulled = false;
    this.cargoMesh.castShadow = true;
    this.cargoMesh.receiveShadow = true;
    this.group.add(this.cargoMesh);
    this.fireMesh=attachedFireMesh(geometry,this,1,this.animationDetail);setFireTexturesEnabled(this.fireMesh,this.texturesEnabled);this.group.add(this.fireMesh);
    this.selectionMesh=pawnSelectionMesh(geometry,this);this.group.add(this.selectionMesh);
    const partial=this.cargoModel.createGeometry();
    partial.setAttribute('aTransferFrom',new THREE.InstancedBufferAttribute(new Float32Array(count*4),4).setUsage(THREE.StaticDrawUsage));
    partial.setAttribute('aTransferTo',new THREE.InstancedBufferAttribute(new Float32Array(count*4),4).setUsage(THREE.StaticDrawUsage));
    partial.setAttribute('aTransferCargo',new THREE.InstancedBufferAttribute(new Float32Array(count*4),4).setUsage(THREE.StaticDrawUsage));
    const partialMat=material(0xffffff);this.configure?.(actorExplorationMaterial256(partialMat));
    partialMat.roughness=.88;partialMat.metalness=.02;
    partialMat.colorNode=naturalStroke(this.graphics,this.graphics?this.cargoModel.strokes:undefined)(attribute('color','vec3'));
    partialMat.positionNode=Fn(()=>{
      const from=attribute('aTransferFrom','vec4'),to=attribute('aTransferTo','vec4'),load=attribute('aTransferCargo','vec4');
      const bit=attribute('corpsePartMask','float');
      const absent=bit.greaterThan(0).and(load.y.lessThan(0)).and(load.y.negate().sub(1).div(bit.max(1)).floor().mod(2).greaterThan(.5));
      const visible=attribute('cargoKind','float').equal(load.x).and(absent.not());
      const scale=visible.select(load.y.lessThan(0).select(float(1),load.y).mul(.25).add(.75),float(0));
      const part=positionLocal.mul(scale),c=cos(from.w),s=sin(from.w);
      const carried=vec3(part.x.mul(c).add(part.z.mul(s)),part.y,part.z.mul(c).sub(part.x.mul(s))).add(from.xyz);
      const landed=positionLocal.mul(visible.select(to.w,float(0))).add(to.xyz);
      const t=this.partialAnimationCache.clockNode(this.cargoTime,'cargoTime').sub(load.z).div(load.w.sub(load.z).max(.001)).clamp(0,1);
      const smooth=t.mul(t).mul(float(3).sub(t.mul(2)));
      return mix(carried,landed,smooth);
    })();
    this.partialCargoMesh=new THREE.Mesh(partial,[partialMat]);
    this.partialCargoMesh.name='Partial material releases — resident transfer batch';
    this.partialCargoMesh.frustumCulled=false;this.partialCargoMesh.castShadow=true;this.partialCargoMesh.receiveShadow=true;
    this.group.add(this.partialCargoMesh);
  }

  /** Cached rig coefficients replace every animated trig/clock expression;
   * static morphology and visibility still use the live encoded streams. */
  private cachedPawnPosition(probe?:{bone:0|3;point:THREE.Node<'vec3'>}):THREE.Node<'vec3'> {
    return Fn(()=>{
      const bone=probe?float(probe.bone):pawnBoneNode(this.referenceRig),dye=pawnDyeNode(this.referenceRig),motion=vec4(0,this.animationCache.cell(4).z,this.animationCache.cell(4).y,0),probeTraits=probe?{bone,dye:float(2)}:undefined;
      const pose=pawnPresentationPose({travelTime:this.travelTime,blend:this.blend});
      const bindPivot=probe?probe.bone===3?vec3(ORIGAMI_HUMAN_BIND.shoulderX,ORIGAMI_HUMAN_BIND.shoulderY,0):vec3(0,ORIGAMI_HUMAN_BIND.hipY,0):attribute('bindPivot','vec3');
      const pivot=pawnMorph(bindPivot,this.referenceRig,probeTraits),local=pawnMorph(probe?.point??positionLocal,this.referenceRig,probeTraits).sub(pivot);
      const data=this.animationCache.cellAt(float(8).add(bone));
      const animated=vec3(local.x,local.y.mul(data.x).sub(local.z.mul(data.y)),local.y.mul(data.y).add(local.z.mul(data.x))).add(pivot).toVar();
      animated.y.addAssign(data.z);animated.z.addAssign(data.w);
      const crouch=this.animationCache.cell(3).x;
      If(crouch.greaterThan(0),()=>{const upright=animated.toVar();
        If(bone.greaterThan(3.5),()=>{animated.y.assign(animated.y.sub(this.humanBind.foot).mul(.72).add(this.humanBind.foot));});
        If(bone.lessThan(3.5),()=>{const y=animated.y.sub(this.humanBind.hip).toVar(),z=animated.z.toVar();animated.y.assign(y.mul(.91).sub(z.mul(.42)).add(this.humanBind.crouchHip));animated.z.assign(y.mul(.42).add(z.mul(.91)).add(this.humanBind.crouchZ));});
        animated.assign(mix(upright,animated,crouch));});
      const post=this.animationCache.cellAt(float(16).add(bone));animated.y.addAssign(post.x);animated.z.addAssign(post.y);
      If(motion.z.greaterThan(2.5).and(motion.z.lessThan(3.5)),()=>{If(bone.greaterThan(5.5),()=>{animated.y.addAssign(this.humanBind.kneeSpan);animated.z.addAssign(this.humanBind.kneeSpan);});animated.y.addAssign(WORLD_SCALE.stoolHeight/PAWN_MODEL_SCALE-this.humanBind.seatedHip);});
      If(motion.z.equal(10).and(bone.lessThan(3.5)),()=>{const y=animated.y.sub(this.humanBind.kneelHip).toVar(),z=animated.z.toVar();animated.y.assign(y.mul(.82).sub(z.mul(.57)).add(this.humanBind.kneelHip));animated.z.assign(y.mul(.57).add(z.mul(.82)));});
      if(probe)return animated;
      const shooting=motion.z.equal(7).or(motion.z.equal(15)),recoil=this.animationCache.cell(3).z;
      if(this.referenceRig){
        const equipmentVertex=RESIDENT_WEAPON_VISUALS269.reduce((matches,weapon)=>matches.or(dye.equal(weapon.dye)),dye.equal(-999));
        If(equipmentVertex,()=>{
          const hand=this.cachedPawnPosition({bone:3,point:vec3(...ORIGAMI_EQUIPMENT_HAND)}).toVar(),sling=dye.equal(-4).or(dye.equal(-9)).or(dye.equal(SPEAR_DYE272));
          const stowed=this.cachedPawnPosition({bone:0,point:sling.select(vec3(...ORIGAMI_EQUIPMENT_SLING),vec3(...ORIGAMI_EQUIPMENT_BELT))}).toVar();
          for(const weapon of RESIDENT_WEAPON_VISUALS269)If(dye.equal(weapon.dye),()=>{animated.assign(origamiEquipmentPositionNode(weapon.item,positionLocal,hand,stowed,motion.z,motion.y,this.animationCache.cell(3).w,recoil));});
        });
        for(const weapon of RESIDENT_WEAPON_VISUALS269)If(dye.equal(weapon.dye).and(attribute('aEquipment','vec4').x.floor().notEqual(weapon.equipment)),()=>{animated.assign(vec3(0));});
      }else for(const weapon of RESIDENT_WEAPON_VISUALS269){const isWeapon=dye.equal(weapon.dye),along=positionLocal.y.sub(.68),across=positionLocal.x.sub(.205),depth=positionLocal.z;
        if(weapon.item==='bolt-action-rifle'||weapon.item==='emp-launcher'){
          If(isWeapon,()=>{animated.assign(vec3(along.mul(.30).add(across).add(.13),along.mul(.78).add(depth.mul(.12)).add(.84),depth.mul(.8).add(.25)));});
          If(shooting.and(isWeapon),()=>{animated.assign(vec3(across.add(.10*this.humanBind.weaponXScale),depth.add(this.humanBind.gunY).add(recoil.mul(.035)),along.add(this.humanBind.gunZ).sub(recoil.mul(.12))));});
        }else if(weapon.item==='spear-family'){If(isWeapon,()=>{animated.assign(spearPositionNode272(along,across,depth,this.animationCache.cell(3).w,motion.y,motion.z.equal(8).or(motion.z.equal(WORK_POSE.groundMelee))));});
        }else if(weapon.item==='longsword-family'){If(isWeapon,()=>{animated.assign(longswordPositionNode270(along,across,depth,this.animationCache.cell(3).w,motion.y,motion.z.equal(8).or(motion.z.equal(WORK_POSE.groundMelee))));});
        }else if(weapon.item==='mace-family'){If(isWeapon,()=>{animated.assign(macePositionNode269(along,across,depth,this.animationCache.cell(3).w,motion.y,motion.z.equal(8).or(motion.z.equal(WORK_POSE.groundMelee))));});
        }else{If(isWeapon,()=>{animated.assign(vec3(across.add(.27),along.mul(.82).add(.65),depth.add(.13)));});
          If(shooting.and(isWeapon),()=>{animated.assign(vec3(across.add(.19*this.humanBind.weaponXScale),depth.add(this.humanBind.pistolY).add(recoil.mul(.035)),along.add(this.humanBind.pistolZ).sub(recoil.mul(.09))));});
          if(weapon.item==='plasteel-knife')If(motion.z.equal(8).or(motion.z.equal(WORK_POSE.groundMelee)).and(isWeapon),()=>{animated.assign(vec3(across.add(.23),depth.add(.83),along.add(.38).add(this.animationCache.cell(3).w.mul(.2))));});}
        If(isWeapon.and(attribute('aEquipment','vec4').x.floor().notEqual(weapon.equipment)),()=>{animated.assign(vec3(0));});}
      If(motion.z.equal(1).or(motion.z.equal(5)).or(motion.z.equal(POSE_SLEEP)).or(motion.z.equal(POSE_DEAD)),()=>{const y=animated.y.toVar();animated.y.assign(animated.z.add(.19));animated.z.assign(float(this.humanBind.lieCenter).sub(y));});
      If(motion.z.equal(POSE_DEAD),()=>{animated.z.assign(animated.z.mul(.78));});
      If(motion.z.equal(6),()=>{const x=animated.x.toVar(),y=animated.y.toVar(),z=animated.z.toVar();animated.assign(vec3(float(this.humanBind.lieCenter).sub(y),z.add(.19+.95/PAWN_MODEL_SCALE),x.add(.3)));});
      const equipment=attribute('aEquipment','vec4'),worn=equipment.z.floor(),helmet=worn.greaterThan(1.5),recon=worn.greaterThan(3.5).and(worn.lessThan(5.5)),tuque=worn.greaterThan(5.5).and(worn.lessThan(9.5));
      If(dye.equal(-3).and(this.referenceRig?equipment.y.notEqual(2):equipment.y.notEqual(2).and(equipment.y.notEqual(3))),()=>{animated.assign(vec3(0));});
      if(this.referenceRig){If(dye.equal(ORIGAMI_DUSTER_DYE).and(equipment.y.notEqual(3)).or(dye.equal(ORIGAMI_PARKA_DYE).and(equipment.y.notEqual(4))),()=>{animated.assign(vec3(0));});}
      If(dye.equal(-2).and(worn.mod(2).lessThan(.5)),()=>{animated.assign(vec3(0));});
      If(dye.equal(FLAK_HELMET_DYE).and(helmet.not().or(worn.greaterThan(3.5))),()=>{animated.assign(vec3(0));});
      If(dye.equal(PLATE_ARMOR_DYE).and(equipment.y.notEqual(6)),()=>{animated.assign(vec3(0));});
      If(dye.equal(SIMPLE_HELMET_DYE).and(worn.lessThan(9.5).or(worn.greaterThan(11.5))),()=>{animated.assign(vec3(0));});
      If(dye.equal(this.referenceRig?ORIGAMI_RECON_ARMOR_DYE:RECON_ARMOR_DYE).and(attribute('aEquipment','vec4').y.notEqual(5)),()=>{animated.assign(vec3(0));});
      If(dye.equal(RECON_HELMET_DYE).and(recon.not()),()=>{animated.assign(vec3(0));});
      If(dye.equal(TUQUE_DYE).and(tuque.not()),()=>{animated.assign(vec3(0));});
      If(dye.equal(PARKA_HOOD_DYE).and(equipment.y.notEqual(4).or(helmet)),()=>{animated.assign(vec3(0));});
      const face=motion.z.equal(POSE_DEAD).select(float(PAWN_EYE_CROSS),motion.z.equal(POSE_SLEEP).or(this.animationCache.cell(3).y.greaterThan(.5)).select(float(PAWN_EYE_CLOSED),float(PAWN_EYE_OPEN)));
      If(dye.greaterThanEqual(PAWN_EYE_OPEN).and(dye.lessThanEqual(PAWN_EYE_CROSS)).and(dye.notEqual(face)),()=>{animated.assign(vec3(0));});
      If(recon.and(dye.greaterThanEqual(PAWN_EYE_OPEN)).and(dye.lessThanEqual(PAWN_EYE_CROSS)),()=>{animated.assign(vec3(0));});
      If(hiddenAppearancePart(this.referenceRig),()=>{animated.assign(vec3(0));});
      if(this.referenceRig){const tool=dye.lessThanEqual(-30).and(dye.greaterThanEqual(-32));If(tool.and(dye.notEqual(attribute('aMotion','vec4').y).or(attribute('aCargo','vec4').x.abs().greaterThan(.5))),()=>{animated.assign(vec3(0));});}
      const mask=attribute('aShape','vec4').x.div(100).floor();
      for(const limb of HUMAN_LIMB_VISUALS){const member=limb.bones.reduce((matches,id)=>matches.or(bone.equal(id)),bone.equal(-1));If(member.and(mask.div(limb.bit).floor().mod(2).greaterThan(.5)),()=>{animated.assign(vec3(0));});}
      If(helmet.and(dye.greaterThanEqual(100)).and(dye.lessThan(200)),()=>{animated.assign(vec3(0));});
      If(recon.and(dye.greaterThanEqual(200)),()=>{animated.assign(vec3(0));});
      If(attribute('aShape','vec4').x.div(10).floor().mod(10).greaterThan(1.5),()=>{If(dye.lessThan(0).or(dye.greaterThanEqual(100)),()=>{animated.assign(vec3(0));});animated.x.assign(animated.x.mul(.78));});
      const yaw=this.animationCache.cell(1);return vec3(animated.x.mul(yaw.x).add(animated.z.mul(yaw.y)),animated.y,animated.z.mul(yaw.x).sub(animated.x.mul(yaw.y))).mul(PAWN_MODEL_SCALE).add(pose.xyz);
    })();
  }

  private syncPartialCargo():void {
    if(!this.partialCargoMesh)return;
    const geometry=this.partialCargoMesh.geometry as THREE.InstancedBufferGeometry;
    const from=geometry.getAttribute('aTransferFrom') as THREE.InstancedBufferAttribute;
    const to=geometry.getAttribute('aTransferTo') as THREE.InstancedBufferAttribute;
    const cargo=geometry.getAttribute('aTransferCargo') as THREE.InstancedBufferAttribute;
    const kinds=new Set<number>();
    this.partialOwners=[];
    let index=0;
    for(const item of this.handoffs.active.values())if(item.partial){
      const [kind,size]=cargoAppearance(item.pile);
      from.setXYZW(index,item.from.x,item.from.y,item.from.z,item.from.yaw);
      to.setXYZW(index,item.to.x,item.to.y,item.to.z,item.groundScale);
      cargo.setXYZW(index,kind,size,localTimeSeconds(item.start,this.carryOrigin),localTimeSeconds(item.end,this.carryOrigin));
      this.partialOwners[index]=this.pawnIndices.get(item.pawnId)??-1;
      this.partialAnimationCache.reconcile(index,item.pawnId,`${item.start}:${item.end}:${item.targetPileId}`);
      kinds.add(kind);
      index++;
    }
    geometry.instanceCount=index;
    selectCargoGeometryKinds(geometry,kinds);
    if(index){from.needsUpdate=true;to.needsUpdate=true;cargo.needsUpdate=true;}
  }

  private syncMainCargoKinds():void {
    if(!this.cargoMesh||!this.pawnMesh)return;
    const geometry=this.cargoMesh.geometry as THREE.InstancedBufferGeometry,cargo=this.pawnMesh.geometry.getAttribute('aCargo');
    const kinds=new Set<number>();for(let i=0;i<geometry.instanceCount;i++)kinds.add(cargo.getX(i));
    selectCargoGeometryKinds(geometry,kinds);
  }

  /** Read the already presented pose once at an ownership change. The release
   * then has a fixed hand origin even if the pawn starts its next route. */
  private presentedCargoAnchor(id:number,tick:number):CargoAnchor|undefined {
    const index=this.pawnIndices.get(id),geometry=this.pawnMesh?.geometry;
    if(index===undefined||!geometry)return;
    const from=geometry.getAttribute('aFrom') as THREE.InstancedBufferAttribute;
    const to=geometry.getAttribute('aTo') as THREE.InstancedBufferAttribute;
    const travel=geometry.getAttribute('aTravel') as THREE.InstancedBufferAttribute;
    const cached=this.animationCache.presentedRoot(index,from,to,travel,this.travelTime.value,this.blend.value);
    if(cached)return {x:cached.x+Math.sin(cached.yaw)*WORLD_SCALE.carriedForward,y:cached.y+this.animationCache.get(index,4,0),z:cached.z+Math.cos(cached.yaw)*WORLD_SCALE.carriedForward,yaw:cached.yaw};
    const motion=geometry.getAttribute('aMotion') as THREE.InstancedBufferAttribute;
    const clock=localTimeSeconds(tick,this.travelOrigin),start=travel.getX(index),end=travel.getY(index);
    const alpha=end>start?THREE.MathUtils.clamp((clock-start)/(end-start),0,1):this.blend.value;
    const turnStart=travel.getW(index)>1?travel.getZ(index):start;
    const turnAlpha=end>start||travel.getW(index)>1?THREE.MathUtils.clamp((clock-turnStart)/(TURN_TICKS/TICKS_PER_SECOND),0,1):this.blend.value;
    const yaw=THREE.MathUtils.lerp(from.getW(index),to.getW(index),turnAlpha);
    const fraction=THREE.MathUtils.lerp(travel.getZ(index),travel.getW(index),alpha);
    const vertical=from.getY(index)<to.getY(index)?THREE.MathUtils.clamp(fraction*3,0,1)
      :from.getY(index)>to.getY(index)?THREE.MathUtils.clamp(fraction*3-2,0,1):fraction;
    const pose=motion.getZ(index);
    const height=pose===1||pose===POSE_SLEEP||pose===POSE_DEAD ? .28 : pose===6 ? 1.3 : WORLD_SCALE.carriedHeight;
    return {x:THREE.MathUtils.lerp(from.getX(index),to.getX(index),alpha)+Math.sin(yaw)*WORLD_SCALE.carriedForward,
      y:THREE.MathUtils.lerp(from.getY(index),to.getY(index),vertical)+height,
      z:THREE.MathUtils.lerp(from.getZ(index),to.getZ(index),alpha)+Math.cos(yaw)*WORLD_SCALE.carriedForward,yaw};
  }

  adoptCargo(previous:World|undefined,world:World,tick:number,animate:boolean):void {
    this.carryOrigin=Math.floor(tick/1024)*1024;
    this.handoffs.adopt(previous,world,tick,animate,id=>this.presentedCargoAnchor(id,tick));
  }

  /** Only the clock uniform changes on ordinary frames. Instance attributes and
   * static pile chunks change when the short transfer starts or completes. */
  presentCargo(tick:number,world:World):boolean {
    if(!this.cargoMesh||!this.pawnMesh)return false;
    const cargo=this.pawnMesh.geometry.getAttribute('aCargo') as THREE.InstancedBufferAttribute;
    const nextOrigin=Math.floor(tick/1024)*1024;
    if(nextOrigin!==this.carryOrigin){
      this.carryOrigin=nextOrigin;
      for(const [id,transition] of this.handoffs.active){
        const index=this.pawnIndices.get(id);if(index===undefined)continue;
        cargo.setZ(index,localTimeSeconds(transition.start,nextOrigin));
        cargo.setW(index,(transition.direction==='pickup'?1:-1)*localTimeSeconds(transition.end,nextOrigin));
      }
      cargo.needsUpdate=true;
      this.syncPartialCargo();
    }
    this.cargoTime.value=localTimeSeconds(tick,this.carryOrigin);
    if(this.handoffs.active.size===0)return false;
    const expired=[...this.handoffs.active.values()].filter(item=>tick>=item.end);
    const refresh=this.handoffs.complete(tick);
    if(expired.length){
      const carried=new Map<number,MaterialPile>();
      for(const pile of world.piles)if(pile.owner.type==='pawn'&&!pile.humanCorpse)carried.set(pile.owner.pawnId,pile);
      for(const item of expired){
        const index=this.pawnIndices.get(item.pawnId);if(index===undefined)continue;
        const [kind,size]=cargoAppearance(carried.get(item.pawnId));
        cargo.setXYZW(index,kind,size,0,0);
      }
      cargo.needsUpdate=true;
      this.syncMainCargoKinds();
      this.syncPartialCargo();
      this.refreshBodyPartUnion();
    }
    return refresh;
  }

  /** `poses297` (frontier pose patch): for these humans the work pose, reach
   * and facing toward the work target come from the Worker's live World, as a
   * Full would compute them; everything else is derived exactly as in a Full. */
  update(world: World, oldBlend: number, newMap: boolean, poses297?: ReadonlyMap<number,Pick<CoreHumanPose297,'workPose'|'reach'|'yaw'>>): void {
    if(this.referenceRig)this.workToolJobs=new Map(world.jobs.map(job=>[job.id,job]));
    if(newMap){this.animationCache.reset();this.partialAnimationCache.reset();}
    this.travelKeys.clear();this.travelSurfaces=furnitureSurfaces(world);
    if(newMap){this.headings.clear();this.approachTransitions.clear();this.departureOffsets.clear();this.workOffsets.clear();this.crouchTransitions.clear();this.shownPoses.clear();this.gait.clear();this.handoffs.clear();}
    const indices=new Map<number,number>(),pawnsById=new Map<number,Pawn>();
    world.pawns.forEach((p,i)=>{indices.set(p.id,i);pawnsById.set(p.id,p);});
    const humanCarry=[...groupHumanCarryPairs257(world),...world.pawns.flatMap(p=>p.cryptosleepTask?.action==='carry'&&(p.cryptosleepTask.phase==='carry'||p.cryptosleepTask.phase==='closing')&&p.cryptosleepTask.patientId!==undefined?[{carrierId:p.id,patientId:p.cryptosleepTask.patientId}]:[]),...world.pawns.flatMap(p=>p.raid?.kidnap261?.phase==='carry'?[{carrierId:p.id,patientId:p.raid.kidnap261.patientId}]:[])];
    this.rescuePairs=[...world.pawns.flatMap((p,i)=>p.rescue?.phase==='carry'&&indices.has(p.rescue.patientId)?[[i,indices.get(p.rescue.patientId)!] as const]:[]),...humanCarry.filter(pair=>indices.has(pair.carrierId)&&indices.has(pair.patientId)).map(pair=>[indices.get(pair.carrierId)!,indices.get(pair.patientId)!] as const)];
    this.groupHumanCarrierIds=new Set(humanCarry.map(pair=>pair.carrierId));
    this.rescuePairs=[...this.rescuePairs,...world.piles.flatMap(p=>p.humanCorpse&&p.owner.type==='pawn'&&indices.has(p.owner.pawnId)&&indices.has(p.humanCorpse.pawnId)?[[indices.get(p.owner.pawnId)!,indices.get(p.humanCorpse.pawnId)!] as const]:[])];
    const bodies=new Map(world.piles.filter(p=>p.humanCorpse).map(p=>[p.humanCorpse!.pawnId,p]));
    const retainedOffsets=retainedHumanCorpseOffsets(world);
    const apparel=apparelProjection(world);
    const gears=equipmentProjection(world);
    if(this.referenceRig)this.equippedVisualItems=new Map([...gears].map(([id,piece])=>[id,piece.item]));
    let smithing=this.smithingGeometry,mace=this.maceGeometry,longsword=this.longswordGeometry,spear=this.spearGeometry;
    if(!smithing)for(const pieces of apparel.values())if(pieces.some(p=>isSmithingApparel267(p.item))){smithing=true;break;}
    if(!mace)for(const piece of gears.values())if(isMaceItem269(piece.item)){mace=true;break;}
    if(!longsword)for(const piece of gears.values())if(isLongswordItem270(piece.item)){longsword=true;break;}
    if(!spear)for(const piece of gears.values())if(isSpearItem272(piece.item)){spear=true;break;}
    this.extendResidentGeometry(smithing,mace,longsword,spear);
    if (!this.pawnMesh) this.createPawnMesh(Math.max(1,world.pawns.length));
    else if(this.pawnMesh.geometry.getAttribute('aFrom').count<world.pawns.length){this.clearBodyPartUnions();growPawnBuffers([this.pawnMesh,this.cargoMesh!,this.selectionMesh!,this.fireMesh!,this.partialCargoMesh!],world.pawns.length,(geometry,mesh)=>{if(mesh===this.pawnMesh||mesh===this.cargoMesh||mesh===this.partialCargoMesh)this.retiredPawnGeometries.push(geometry);else geometry.dispose();});this.installBodyPartUnions();this.syncBodyInstances();}
    const geometry = this.pawnMesh!.geometry as THREE.InstancedBufferGeometry;
    if(this.targetOffsets297.length<world.pawns.length*3)this.targetOffsets297=new Float64Array(world.pawns.length*3);
    const flames=geometry.getAttribute('aFire') as THREE.InstancedBufferAttribute;
    const burning=new Map((world.fires?.items??[]).filter(f=>f.attachedPawnId!==undefined).map(f=>[f.attachedPawnId!,f.size]));
    let fireCount=0;
    world.pawns.forEach((p,i)=>{
      const size=burning.has(p.id)?Math.max(.5,burning.get(p.id)!):0;
      flames.setX(i,size);if(size>0)fireCount=i+1;
    });
    if(!world.pawns.length)flames.setX(0,0);flames.needsUpdate=true;
    // Keep actor indices and shared attributes; omit only the unused tail.
    (this.fireMesh!.geometry as THREE.InstancedBufferGeometry).instanceCount=fireCount;
    this.springValid297.fill(0);if(newMap)this.tweener297.reset();
    const fromAttribute = geometry.getAttribute('aFrom') as THREE.InstancedBufferAttribute;
    const toAttribute = geometry.getAttribute('aTo') as THREE.InstancedBufferAttribute;
    const travelAttribute = geometry.getAttribute('aTravel') as THREE.InstancedBufferAttribute;
    const presented=new Map<number,{x:number;z:number}>();
    if(!newMap)for(const [id,index] of this.pawnIndices){
      const start=travelAttribute.getX(index),end=travelAttribute.getY(index);
      const alpha=end>start?THREE.MathUtils.clamp((this.travelTime.value-start)/(end-start),0,1):oldBlend;
      presented.set(id,{x:THREE.MathUtils.lerp(fromAttribute.getX(index),toAttribute.getX(index),alpha),z:THREE.MathUtils.lerp(fromAttribute.getZ(index),toAttribute.getZ(index),alpha)});
    }
    const motion = geometry.getAttribute('aMotion') as THREE.InstancedBufferAttribute;
    const tint = geometry.getAttribute('aTint') as THREE.InterleavedBufferAttribute;
    const skin=geometry.getAttribute('aSkin'),hair=geometry.getAttribute('aHair'),shape=geometry.getAttribute('aShape'),blood=geometry.getAttribute('aBodyBlood');
    const cargo = geometry.getAttribute('aCargo') as THREE.InstancedBufferAttribute;
    const handoffFrom=this.cargoMesh!.geometry.getAttribute('aHandoffFrom') as THREE.InstancedBufferAttribute;
    const handoffTo=this.cargoMesh!.geometry.getAttribute('aHandoffTo') as THREE.InstancedBufferAttribute;
    const equipment=geometry.getAttribute('aEquipment') as THREE.InterleavedBufferAttribute;
    const carried = new Map<number, World['piles'][number]>();
    for (const pile of world.piles) if (pile.owner.type === 'pawn') carried.set(pile.owner.pawnId, pile);
    let jobsById:Map<number,World['jobs'][number]>|undefined=this.referenceRig?this.workToolJobs:undefined;
    const present = new Set<number>();let atlasChanged=this.bodyAtlasPublishedCount!==world.pawns.length||this.bodyAtlasModelKey!==this.humanModel?.key,allRigid=true;
    world.pawns.forEach((pawn, index) => {
      present.add(pawn.id);
      const previous = newMap ? undefined : this.visuals.get(pawn.id);
      // A stationary actor retains its last travel heading after a save reload.
      // Work with an external target and bed posture override it below.
      const initialYaw=pawn.motion?Math.atan2(pawn.motion.to.x-pawn.motion.from.x,pawn.motion.to.z-pawn.motion.from.z):arrivalRotationYaw256(pawn)??Math.PI*.2+(pawn.state==='dead'?(pawn.id%5-2)*.14:0);
      const from = previous ? previous.from.clone().lerp(previous.to, oldBlend) : new THREE.Vector4(pawn.x, 0, pawn.z, initialYaw);
      const lastShown=presented.get(pawn.id);
      if(lastShown){from.x=lastShown.x;from.z=lastShown.z;}
      const priorHeading=this.headings.get(pawn.id);
      if(priorHeading)from.w=headingAt(priorHeading,world.tick);
      let yaw = from.w;
      const dx = pawn.x - from.x, dz = pawn.z - from.z;
      if (dx * dx + dz * dz > 0.01) {
        const target = Math.atan2(dx, dz);
        yaw = from.w + Math.atan2(Math.sin(target - from.w), Math.cos(target - from.w));
      }
      if(pawn.state==='dead'&&!pawn.motion)yaw=initialYaw;
      const bedId = pawn.need?.kind === 'sleep' ? pawn.need.bedId : null;
      if(pawn.feed?.phase==='feed'){const p=pawnsById.get(pawn.feed.patientId);if(p)yaw=Math.atan2(p.x-pawn.x,p.z-pawn.z);}
      if(pawn.tend?.phase==='tend'&&pawn.tend.patientId!==pawn.id){const p=pawnsById.get(pawn.tend.patientId);if(p)yaw=Math.atan2(p.x-pawn.x,p.z-pawn.z);}
      if(pawn.surgery?.phase==='work'){const p=pawnsById.get(pawn.surgery.patientId);if(p)yaw=Math.atan2(p.x-pawn.x,p.z-pawn.z);}
      const coupleBed=coupleBed285(world,pawn);
      const bed = coupleBed??((pawn.state === 'sleeping'||pawn.state==='resting'||pawn.state==='downed') && bedId !== null ? world.structures.find(item => item.id === bedId) : undefined);
      const seated=seatedOnFurniture(pawn);
      let px = pawn.x, pz = pawn.z, py = seated||pawn.state==='eating'||pawn.state==='sleeping'||pawn.state==='resting'||medicallyStopped(pawn)?0:this.travelSurfaces.get(pawn.z*world.width+pawn.x)??0;
      const body=bodies.get(pawn.id);
      const hiddenBody=pawn.body?.lostAt!==undefined||pawn.body?.pileId!==undefined&&(!body||body.owner.type==='grave');
      if(body?.owner.type==='ground'){px=body.owner.x;pz=body.owner.z;py=0;}
      const retainedOffset=retainedOffsets.get(pawn.id);
      if(retainedOffset){px+=retainedOffset.x;pz+=retainedOffset.z;py+=retainedOffset.y;}
      if(hiddenBody)py=-1000;
      if (bed&&!body&&!hiddenBody) {
        const slot=pawnBedSlot(pawn,bed),center=bed.kind==='double-bed'&&slot!==undefined?bedSlotBodyCenter(bed,slot):undefined;
        if(center){px=center.x;pz=center.z;}
        else {const cells = footprintCells(bed), last = cells[cells.length - 1]!;px = (bed.x + last.x) / 2;pz = (bed.z + last.z) / 2;}
        py = bed.kind==='sleeping-spot'?0:bed.kind==='bedroll'?BEDROLL_SURFACE_HEIGHT:WORLD_SCALE.bedSurfaceHeight;
        const target = bed.orientation * Math.PI / 2;
        yaw = from.w + Math.atan2(Math.sin(target - from.w), Math.cos(target - from.w));
      }
      const dining = pawn.state === 'eating' && pawn.need?.kind === 'eat' ? pawn.need.dining : null;
      const surface = dining ? adjacentTable(world, pawn) : null;
      if (surface) {
        const target = Math.atan2(surface.cell.x - pawn.x, surface.cell.z - pawn.z);
        yaw = from.w + Math.atan2(Math.sin(target - from.w), Math.cos(target - from.w));
      }
      // A task already owns the final travel edge before the worker changes to
      // `working`. Resolve that target early so the edge ends at its visual
      // contact pose instead of arriving at the cell centre and sliding later.
      const contact297=humanWorkContact297(world,pawn,pawnsById,jobsById,yaw),patch297=poses297?.get(pawn.id);
      const {arriving,humanOpponent,pasteCollect}=contact297;
      const workPose=patch297?patch297.workPose:contact297.workPose,reach=patch297?{x:patch297.reach.x,z:patch297.reach.z}:contact297.reach;
      jobsById=contact297.jobsById;yaw=patch297?patch297.yaw??yaw:contact297.yaw;
      this.workOffsets.set(pawn.id,reach);
      if(newMap)this.approachTransitions.set(pawn.id,{fromX:reach.x,fromZ:reach.z,toX:reach.x,toZ:reach.z,start:world.tick,baseX:pawn.x,baseZ:pawn.z});
      px+=reach.x;pz+=reach.z;
      const recreation=pawn.state==='recreating'?pawn.recreation.task:null;
      const leisureSite=recreation&&recreation.buildingId!==null&&recreation.activity!=='skygaze'?world.structures.find(s=>s.id===recreation.buildingId):undefined;
      const leisureTarget=recreation?.activity==='visit-sick'?pawnsById.get(recreation.patientId!):leisureSite
        ?footprintCells(leisureSite).reduce((nearest,cell)=>(cell.x-pawn.x)**2+(cell.z-pawn.z)**2<(nearest.x-pawn.x)**2+(nearest.z-pawn.z)**2?cell:nearest)
        :undefined;
      if(leisureTarget)yaw=Math.atan2(leisureTarget.x-pawn.x,leisureTarget.z-pawn.z);
      const melee=pawn.melee?.strike;
      const shotTarget=pawn.shooting?.stance?pawn.shooting.order?.targetId??(pawn.shooting.stance.phase==='cooldown'?pawn.lastAttack?.targetId:undefined):undefined;
      const aim=melee?(melee.structure??(melee.targetId===null?undefined:pawnsById.get(melee.targetId))??world.wildlife?.animals.find(a=>a.id===melee.targetId)??world.raids?.departed.find(d=>d.pawnId===melee.targetId)?.cell):humanOpponent??(shotTarget?(pawnsById.get(shotTarget)??world.wildlife?.animals.find(a=>a.id===shotTarget)):undefined);
      if(aim)yaw=Math.atan2(aim.x-pawn.x,aim.z-pawn.z);
      const to = new THREE.Vector4(px, py, pz, yaw);
      if (!previous||hiddenBody||previous.to.y< -100) from.copy(to);
      this.targetPoses.set(pawn.id,to.clone());
      const anchor=3*index;this.targetOffsets297[anchor]=to.x-pawn.x;this.targetOffsets297[anchor+1]=to.y-(this.travelSurfaces.get(pawn.z*world.width+pawn.x)??0);this.targetOffsets297[anchor+2]=to.z-pawn.z;
      this.visuals.set(pawn.id, { from, to });
      fromAttribute.setXYZW(index, from.x, from.y, from.z, from.w);
      toAttribute.setXYZW(index, to.x, to.y, to.z, to.w);
      this.workPoses.set(pawn.id,workPose);
      const smallMelee=!!pawn.melee?.strike&&(world.wildlife?.animals.some(animal=>animal.id===pawn.melee!.strike!.targetId&&animal.species==='hare')??false);
      const equipmentCode=weaponVisual(gears.get(pawn.id)?.item)?.equipment??0;
      motion.setXYZW(index, pawn.state === 'moving'&&!pawn.stun&&!pasteCollect ? 1 : 0,this.activity(pawn,equipmentCode),animationPose(pawn,workPose,smallMelee,seated,!!coupleBed),pawn.melee?.strike ? coreTimeSeconds(pawn.melee.strike.atCore,Math.floor(world.tick/1024)*1024) : pawn.shooting?.stance?.phase==='cooldown'?coreTimeSeconds(pawn.shooting.stance.startedAtCore,Math.floor(world.tick/1024)*1024):pawn.id * 1.7);
      const identity=appearanceOf(pawn,world.seed),variant=appearanceShape(identity);
      blood.setX(index,bodyBloodWord(pawn.health));
      scratchColor.setHex(identity.skinColor);skin.setXYZ(index,scratchColor.r,scratchColor.g,scratchColor.b);
      scratchColor.setHex(identity.hairColor);hair.setXYZ(index,scratchColor.r,scratchColor.g,scratchColor.b);
      shape.setXYZW(index,packHumanShape(variant[0],humanCorpseVisualStage(world,pawn,body),humanLimbVisualMask(pawn)),variant[1],variant[2],variant[3]);
      const look=apparelAppearance(apparel.get(pawn.id));
      scratchColor.setHex(look.color??(isColonist(pawn)?pawnBaseColor(pawn.id):pawn.visitor&&!world.visitors?.groups.find(g=>g.id===pawn.visitor!.group)?.hostile?0x77958f:0xb74736));
      if(pawn.state==='dead')scratchColor.setHex(0x73756c);
      tint.setXYZ(index, scratchColor.r, scratchColor.g, scratchColor.b);
      if(this.graphics){
        const hat=look.simpleHelmet?(SIMPLE_HELMET_COLORS267[look.simpleHelmetMaterial-1]??0x8c5832):look.reconHelmet?APPAREL['recon-helmet'].color:look.helmet?(look.plasteelHelmet?0xa0b2b5:APPAREL['flak-helmet'].color):look.tuque===2?0xb3c0ba:look.tuque===1?APPAREL['cloth-tuque'].color:0x8c5832;
        const vestCode=(look.vestTintCode??0)-1,vest=vestCode<0?APPAREL['flak-vest'].color:scratchVestColor.setRGB(Math.floor(vestCode/1024)/31,Math.floor(vestCode/32)%32/31,vestCode%32/31).getHex();
        const row=this.graphics.registerHumanAppearance({skin:identity.skinColor,hair:identity.hairColor,shirt:scratchColor.getHex(),outerwear:scratchColor.getHex(),pants:ORIGAMI_PANTS_COLORS[look.pants]??ORIGAMI_PANTS_COLORS[0],hat,vest,reconArmor:APPAREL['recon-armor'].color,plate:scratchColor.getHex()});
        shape.setW(index,variant[3]+row*32);
      }
      equipment.setXYZW(index,equipmentCode,look.silhouette,(look.vest?1:0)+(look.simpleHelmet?10:look.reconHelmet?4:look.helmet?2:look.tuque===2?8:look.tuque===1?6:0)+(look.vestTintCode??0)/65536,look.pants+(look.simpleHelmet?look.simpleHelmetMaterial/16:look.plasteelHelmet?.5:0));
      this.refreshOrigamiEquipmentSignal(pawn,index);
      atlasChanged=this.bodyAtlasAppearanceChanged(pawn.id,index,geometry)||atlasChanged;allRigid=this.observeBodyAtlasPose(pawn.id,index,geometry)&&allRigid;
      const load = carried.get(pawn.id);
      const packed=world.packed?.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id);
      const handoff=this.handoffs.active.get(pawn.id);
      const mainHandoff=handoff?.partial?undefined:handoff;
      const [kind,size]=cargoAppearance(mainHandoff?.direction==='drop'?mainHandoff.pile:load);
      cargo.setXYZW(index,pawn.rescue?.phase==='carry'||this.groupHumanCarrierIds.has(pawn.id)||pawn.animalRescue?.phase==='carry'||load?.humanCorpse?-1:packed?4:kind,packed?1:size,
        mainHandoff?localTimeSeconds(mainHandoff.start,this.carryOrigin):0,
        mainHandoff?(mainHandoff.direction==='pickup'?1:-1)*localTimeSeconds(mainHandoff.end,this.carryOrigin):0);
      if(mainHandoff){
        handoffFrom.setXYZW(index,mainHandoff.from.x,mainHandoff.from.y,mainHandoff.from.z,mainHandoff.from.yaw);
        handoffTo.setXYZW(index,mainHandoff.to.x,mainHandoff.to.y,mainHandoff.to.z,mainHandoff.groundScale);
      }else{
        handoffFrom.setXYZW(index,0,0,0,0);handoffTo.setXYZW(index,0,0,0,0);
      }
    });
    for (const id of this.visuals.keys()) if (!present.has(id)){this.bodyAtlasAppearance.delete(id);this.bodyAtlasRigid.delete(id);this.visuals.delete(id);this.targetPoses.delete(id);this.headings.delete(id);this.workPoses.delete(id);this.workOffsets.delete(id);this.approachTransitions.delete(id);this.departureOffsets.delete(id);this.crouchTransitions.delete(id);this.shownPoses.delete(id);this.gait.delete(id);}
    this.pawnIndices.clear();for(const [id,index] of indices)this.pawnIndices.set(id,index);
    const patientOwners=new Map(this.rescuePairs.map(([carrier,patient])=>[patient,carrier] as const));
    this.animationOwners.clear();for(const [patient,carrier] of patientOwners)this.animationOwners.set(patient,carrier);
    world.pawns.forEach((p,i)=>{const owner=bodies.get(p.id)?.owner;
      const pose=motion.getZ(i),posture=pose===1||pose===3||pose===5||pose===6||pose===10||pose===POSE_SLEEP||pose===POSE_DEAD||pose===WORK_POSE.ground||pose===WORK_POSE.groundMelee?pose:0;
      // A new confirmed optional melee tool/strike invalidates its retained pose once.
      // Reach then follows ordinary sampling; no continuously changing tick.
      const activity=motion.getY(i),family=isMaceItem269(gears.get(p.id)?.item)||isLongswordItem270(gears.get(p.id)?.item)||isSpearItem272(gears.get(p.id)?.item),
        melee=family?[activity,p.melee?.strike?.tool,p.melee?.strike?.atCore]:[];
      this.animationCache.reconcile(i,p.id,[posture,shape.getX(i),shape.getY(i),shape.getZ(i),shape.getW(i),equipment.getX(i),equipment.getY(i),equipment.getZ(i),equipment.getW(i),owner?.type,owner?.type==='pawn'?owner.pawnId:undefined,patientOwners.get(i),...melee].join(':'));});
    for (const attr of [fromAttribute, toAttribute, motion, tint, cargo,handoffFrom,handoffTo]) attr.needsUpdate = true;
    geometry.instanceCount = world.pawns.length;
    this.syncBodyInstances(geometry);
    (this.cargoMesh!.geometry as THREE.InstancedBufferGeometry).instanceCount = world.pawns.length;
    this.syncMainCargoKinds();
    this.syncPartialCargo();
    (this.selectionMesh!.geometry as THREE.InstancedBufferGeometry).instanceCount=world.pawns.length;
    this.pawnIds=world.pawns.map(p=>p.id);this.setSelected(this.selected);
    this.playback435.prepare(world,world.pawns,true);this.bodyAtlasPublishedCount=world.pawns.length;this.bodyAtlasModelKey=this.humanModel?.key??'';if(this.observeBodyAtlasPoseAggregate(allRigid)||atlasChanged)this.bodyAtlas?.invalidate();
  }

  /** No appearance, surface, ownership or job reconstruction on an actor-only
   * phase. Those changes are explicit Full barriers in the producer. */
  adoptPhase297(world:World,indices:readonly number[],actorScene?:CoreActorScene297,changedActorIds?:ReadonlySet<number>):void {
    const humans=actorScene?.humans??world.pawns,dirty=new Set(indices);
    // A stationary attacker also depends on the confirmed position of its target.
    // Resolve this once per adoption, rather than scanning dependencies every RAF.
    if(actorScene){const targets=changedActorIds??new Set(indices.map(i=>humans[i]!.id));
      humans.forEach((pawn,i)=>{const target=pawn.melee?.strike?.targetId??(pawn.shooting?.stance?pawn.shooting.order?.targetId??(pawn.shooting.stance.phase==='cooldown'?pawn.lastAttack?.targetId:undefined):undefined);if(target!==undefined&&target!==null&&targets.has(target))dirty.add(i);});}
    const changed=[...dirty];
    this.playback435.adoptPhase297(world,humans,changed);
    for(const i of changed){const pawn=humans[i]!,target=this.targetPoses.get(pawn.id);if(!target)throw Error('Missing resident pawn pose');
      this.refreshOrigamiEquipmentSignal(pawn,i);
      // Full owns interaction anchors; a dirty phase only moves their cell basis.
      const anchor=3*i;target.x=pawn.x+this.targetOffsets297[anchor]!;target.z=pawn.z+this.targetOffsets297[anchor+2]!;
      target.y=(this.travelSurfaces.get(pawn.z*world.width+pawn.x)??0)+this.targetOffsets297[anchor+1]!;
      const melee=pawn.melee?.strike,shot=pawn.shooting?.stance?pawn.shooting.order?.targetId??(pawn.shooting.stance.phase==='cooldown'?pawn.lastAttack?.targetId:undefined):undefined;
      const id=melee?.targetId??shot,aim=melee?.structure??(id===undefined||id===null?undefined:(actorScene&&id!==undefined?actorScene.byId[id]?.actor:undefined)??world.pawns.find(p=>p.id===id)??world.wildlife?.animals.find(a=>a.id===id)??world.raids?.departed.find(d=>d.pawnId===id)?.cell);
      if(aim)target.w=Math.atan2(aim.x-pawn.x,aim.z-pawn.z);
      this.travelKeys.delete(pawn.id);
    }
  }

  private readonly tweener297=new PawnTweener297();
  private springCapacity297=0;
  private springFrom297=new THREE.BufferAttribute(new Float32Array(0),4);
  private springTo297=new THREE.BufferAttribute(new Float32Array(0),4);
  private springTravel297=new THREE.BufferAttribute(new Float32Array(0),4);
  private springMotionW297=new Float32Array(0);
  private springGaitPhase297=new Float32Array(0);
  private springValid297=new Uint8Array(0);
  private readonly springTarget297={x:0,y:0,z:0,yaw:0};
  private ensureSpring297(count:number):void {
    if(count<=this.springCapacity297)return;const n=2**Math.ceil(Math.log2(Math.max(1,count)));
    const copy=(old:THREE.BufferAttribute)=>{const value=new THREE.BufferAttribute(new Float32Array(n*4),4);(value.array as Float32Array).set(old.array);return value;};
    this.springFrom297=copy(this.springFrom297);this.springTo297=copy(this.springTo297);this.springTravel297=copy(this.springTravel297);
    const w=new Float32Array(n),phase=new Float32Array(n),valid=new Uint8Array(n);w.set(this.springMotionW297);phase.set(this.springGaitPhase297);valid.set(this.springValid297);this.springMotionW297=w;this.springGaitPhase297=phase;this.springValid297=valid;this.springCapacity297=n;this.tweener297.ensure(n);
  }
  private captureSpring297(slot:number,from:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,to:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,travel:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,motion:THREE.BufferAttribute|THREE.InterleavedBufferAttribute):void {
    this.springFrom297.setXYZW(slot,from.getX(slot),from.getY(slot),from.getZ(slot),from.getW(slot));
    this.springTo297.setXYZW(slot,to.getX(slot),to.getY(slot),to.getZ(slot),to.getW(slot));
    this.springTravel297.setXYZW(slot,travel.getX(slot),travel.getY(slot),travel.getZ(slot),travel.getW(slot));
    this.springMotionW297[slot]=motion.getW(slot);this.springValid297[slot]=1;
  }
  private springPose297(slot:number,pawn:Pawn,dt:number,speed:number,from:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,to:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,travel:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,motion:THREE.BufferAttribute|THREE.InterleavedBufferAttribute):boolean {
    const target=sampleActorRoot(this.springFrom297,this.springTo297,this.springTravel297,slot,this.travelTime.value,this.blend.value,this.springTarget297);
    // Body transitions preserve their existing anchor. Ordinary stops retain
    // the tweened position; map and actor-slot resets clear its history.
    const explicitReset=pawn.body?.pileId!==undefined||pawn.body?.lostAt!==undefined;
    const pose=this.tweener297.advance(slot,pawn.id,target.x,target.y,target.z,dt,speed,explicitReset);
    const walking=motion.getX(slot),stepping=walking<-.5?(-walking-1)>CROUCH_WALK_MARK:walking>.5;
    // Keep distance travelled on screen continuous across confirmed edges and Full adoption.
    let gaitPhase=this.tweener297.fresh?0:this.springGaitPhase297[slot]!;
    if(stepping&&speed>0){gaitPhase+=Math.hypot(this.tweener297.deltaX,this.tweener297.deltaZ)*HUMAN_GAIT_RADIANS_PER_UNIT;if(gaitPhase>=Math.PI*2)gaitPhase%=Math.PI*2;}
    this.springGaitPhase297[slot]=gaitPhase;
    // Float32 rounding at the turn boundary must not leave an out-of-range phase.
    if(this.springGaitPhase297[slot]!>=Math.PI*2)this.springGaitPhase297[slot]=0;
    const phase=stepping?this.springGaitPhase297[slot]!:this.springMotionW297[slot]!;
    const changed=from.getX(slot)!==pose.x||from.getY(slot)!==pose.y||from.getZ(slot)!==pose.z||to.getX(slot)!==pose.x||to.getY(slot)!==pose.y||to.getZ(slot)!==pose.z||from.getW(slot)!==Math.fround(target.yaw)||to.getW(slot)!==Math.fround(target.yaw)||motion.getW(slot)!==phase;
    from.setXYZW(slot,pose.x,pose.y,pose.z,target.yaw);to.setXYZW(slot,pose.x,pose.y,pose.z,target.yaw);travel.setXYZW(slot,0,0,0,2);motion.setW(slot,phase);
    const visual=this.visuals.get(pawn.id)!;visual.from.set(pose.x,pose.y,pose.z,target.yaw);visual.to.copy(visual.from);return changed;
  }

  /** CPU chooses a confirmed edge; translation, orientation and rig evaluation stay on GPU. */
  updateTravel(world:World,timeline:MotionTimeline,dt297=0,speed297=0,actorScene?:CoreActorScene297):void {
    const humans=actorScene?.humans??world.pawns,animals=actorScene?.animals??world.wildlife?.animals,actorTick=actorScene?actorScene.core/10:world.tick;
    if(!this.pawnMesh)return;
    const geometry=this.pawnMesh.geometry;
    const from=geometry.getAttribute('aFrom') as THREE.InstancedBufferAttribute,to=geometry.getAttribute('aTo') as THREE.InstancedBufferAttribute,times=geometry.getAttribute('aTravel') as THREE.InstancedBufferAttribute,motion=geometry.getAttribute('aMotion') as THREE.InstancedBufferAttribute;
    const equipment=geometry.getAttribute('aEquipment');
    const origin=Math.floor(timeline.tick/1024)*1024;
    this.travelOrigin=origin;
    this.travelTime.value=localTimeSeconds(timeline.tick,origin);
    const playback=this.playback435.beginFrame(timeline);if(this.playback435.retrying)this.travelKeys.clear();
    const spring=isCorePhysicalSchema297(Number(world.schemaVersion));if(spring)this.ensureSpring297(humans.length);
    let dirty=false,partUnionDirty=false,allRigidBefore=true,allRigidAfter=true;
    humans.forEach((pawn,i)=>{
      allRigidBefore=this.observeBodyAtlasPose(pawn.id,i,geometry)&&allRigidBefore;
      const prepared=playback?this.playback435.select(i,timeline,timeline.tick,origin):undefined;
      if(spring&&!this.springValid297[i])this.captureSpring297(i,from,to,times,motion);
      if(playback&&!prepared){if(spring)dirty=this.springPose297(i,pawn,dt297,speed297,from,to,times,motion)||dirty;return;}
      if(this.referenceRig)this.refreshOrigamiEquipmentSignal(pawn,i);
      const segment=pawn.body?.pileId!==undefined||pawn.body?.lostAt!==undefined?undefined:(playback?prepared!.edge:timeline.segment(pawn.id));
      const active=!!segment && timeline.tick<segment.end;
      const pasteCollect=pasteCollectionSource(pawn);
      const onEdge=!!segment&&(active||pawn.state==='moving'&&!pasteCollect||actorTick<segment.end);
      const stepping=onEdge&&!!segment&&active&&!medicallyStopped(pawn)&&(segment.fromFraction??0)!==(segment.toFraction??1)&&timeline.tick>=segment.start;
      const smallMelee=!!pawn.melee?.strike&&(animals?.some(animal=>animal.id===pawn.melee!.strike!.targetId&&animal.species==='hare')??false);
      const shownPose=onEdge?(medicallyStopped(pawn)?1:0)
        :animationPose(pawn,this.workPoses.get(pawn.id)??0,smallMelee,seatedOnFurniture(pawn));
      this.showPose(pawn.id,shownPose,timeline.tick);
      const key=`${origin}:${segment?.start}:${segment?.end}:${segment?.edgeStart}:${segment?.fromFraction}:${segment?.toFraction}:${active}:${!!segment&&timeline.tick>=segment.start}:${pawn.state}:${shownPose}:${pawn.path[0]?.x}:${pawn.path[0]?.z}:${pasteCollect?.dispenserId}`;
      if(this.travelKeys.get(pawn.id)===key){if(spring)dirty=this.springPose297(i,pawn,dt297,speed297,from,to,times,motion)||dirty;return;}
      this.travelKeys.set(pawn.id,key);dirty=true;
      const priorActivity=motion.getY(i);
      const visual=this.visuals.get(pawn.id)!;
      if(onEdge&&segment) {
        const yaw=Math.atan2(segment.to.x-segment.from.x,segment.to.z-segment.from.z);
        const previous=this.headings.get(pawn.id);
        let heading=turnToward(previous,yaw,segment.start);
        if(previous&&heading===previous&&previous.startTick!==segment.start)heading={from:headingAt(previous,segment.start),to:previous.to,startTick:segment.start};
        this.headings.set(pawn.id,heading);
        const a=segment.fromFraction??0,b=segment.toFraction??1,lerp=THREE.MathUtils.lerp;
        const y0=this.travelSurfaces.get(segment.from.z*world.width+segment.from.x)??0,y1=this.travelSurfaces.get(segment.to.z*world.width+segment.to.x)??0;
        // Preserve the original confirmed edge fractions through a change of
        // pace; the ground movement helper supplies its height primitives.
        visual.from.set(lerp(segment.from.x,segment.to.x,a),y0,lerp(segment.from.z,segment.to.z,a),heading.from);
        visual.to.set(lerp(segment.from.x,segment.to.x,b),y1,lerp(segment.from.z,segment.to.z,b),heading.to);
        const edgeStart=segment.edgeStart??segment.start;
        let departure=this.departureOffsets.get(pawn.id);
        if(!departure||departure.start!==edgeStart){
          const previous=this.approachTransitions.get(pawn.id);
          const offset=previous&&previous.baseX===segment.from.x&&previous.baseZ===segment.from.z?approachAt(previous,edgeStart):{x:0,z:0};
          const planned=this.workOffsets.get(pawn.id);
          const finalCell=segment.to.x===pawn.x&&segment.to.z===pawn.z&&pawn.path.length===0;
          departure={start:edgeStart,x:offset.x,z:offset.z,arrivalX:finalCell?planned?.x??0:0,arrivalZ:finalCell?planned?.z??0:0};
          this.departureOffsets.set(pawn.id,departure);
        }
        // The first part of a confirmed edge departs from the reached work
        // pose, then converges on the same authoritative destination.
        visual.from.x+=departure.x*(1-a);visual.from.z+=departure.z*(1-a);
        visual.to.x+=departure.x*(1-b);visual.to.z+=departure.z*(1-b);
        visual.from.x+=departure.arrivalX*a;visual.from.z+=departure.arrivalZ*a;
        visual.to.x+=departure.arrivalX*b;visual.to.z+=departure.arrivalZ*b;
        this.approachTransitions.delete(pawn.id);
        times.setXYZW(i,localTimeSeconds(segment.start,origin),localTimeSeconds(segment.end,origin),a,b);
        motion.setX(i,motionX(!medicallyStopped(pawn)&&active&&a!==b&&timeline.tick>=segment.start,this.crouchTransitions.get(pawn.id),origin));
        if(stepping)motion.setW(i,this.gait.begin(pawn.id,{
          start:segment.start,end:segment.end,
          fromX:visual.from.x,fromZ:visual.from.z,toX:visual.to.x,toZ:visual.to.z,
        },timeline.tick,HUMAN_GAIT_RADIANS_PER_UNIT));
        else this.gait.halt(pawn.id,timeline.tick,HUMAN_GAIT_RADIANS_PER_UNIT);
        motion.setY(i,this.referenceRig?origamiWorkTool(pawn,this.workToolJobs.get(pawn.jobId??-1)):0);
        motion.setZ(i,shownPose);
      } else {
        this.gait.halt(pawn.id,timeline.tick,HUMAN_GAIT_RADIANS_PER_UNIT);
        const desired=this.workOffsets.get(pawn.id)??{x:0,z:0};
        const target=this.targetPoses.get(pawn.id)!;
        const baseX=target.x-desired.x,baseZ=target.z-desired.z;
        let approach=this.approachTransitions.get(pawn.id);
        if(!approach||approach.baseX!==baseX||approach.baseZ!==baseZ||Math.abs(approach.toX-desired.x)>1e-5||Math.abs(approach.toZ-desired.z)>1e-5){
          // An edge or a changed work cell can leave no approach record even
          // though the last rendered pose is still off centre. Begin from that
          // shared pose rather than teleporting back to the logical cell.
          const edgeStart=segment?.edgeStart??segment?.start;
          const edgeArrival=segment&&timeline.tick>=segment.end&&(segment.toFraction??1)>=1&&segment.to.x===baseX&&segment.to.z===baseZ&&this.departureOffsets.get(pawn.id)?.start===edgeStart?this.departureOffsets.get(pawn.id):undefined;
          const visualX=edgeArrival?.arrivalX??visual.from.x-baseX,visualZ=edgeArrival?.arrivalZ??visual.from.z-baseZ;
          const visibleOffset=Math.hypot(visualX,visualZ)<=1.5?{x:visualX,z:visualZ}:{x:0,z:0};
          const current=approach&&approach.baseX===baseX&&approach.baseZ===baseZ?approachAt(approach,timeline.tick):visibleOffset;
          approach={fromX:current.x,fromZ:current.z,toX:desired.x,toZ:desired.z,start:timeline.tick,baseX,baseZ};
          this.approachTransitions.set(pawn.id,approach);
        }
        this.departureOffsets.delete(pawn.id);
        visual.from.copy(target);visual.from.x=baseX+approach.fromX;visual.from.z=baseZ+approach.fromZ;
        visual.to.copy(target);visual.to.x=baseX+approach.toX;visual.to.z=baseZ+approach.toZ;
        if(pawn.state==='moving'&&pawn.path[0]&&doorAt(world,pawn.path[0])) {
          const target=pawn.path[0];visual.to.w=Math.atan2(target.x-pawn.x,target.z-pawn.z);
        }
        const heading=turnToward(this.headings.get(pawn.id),visual.to.w,timeline.tick);
        this.headings.set(pawn.id,heading);
        const turning=timeline.tick-heading.startTick<TURN_TICKS;
        visual.from.w=turning?heading.from:heading.to;visual.to.w=heading.to;
        const shifting=timeline.tick-approach.start<APPROACH_TICKS&&(Math.abs(approach.fromX-approach.toX)>1e-5||Math.abs(approach.fromZ-approach.toZ)>1e-5);
        // Snapshot adoption resets the general blend to zero. A completed
        // approach must have equal endpoints, or every new worker snapshot
        // briefly snaps the pawn back to the centre of its logical cell.
        if(!shifting){visual.from.x=visual.to.x;visual.from.z=visual.to.z;}
        const approachStart=localTimeSeconds(approach.start,origin);
        times.setXYZW(i,shifting?approachStart:0,shifting?approachStart+APPROACH_TICKS/TICKS_PER_SECOND:0,localTimeSeconds(heading.startTick,origin),2);
        // Unexpected target changes still get a short, visibly stepping
        // adjustment. Normal task arrivals already reach contact on the edge.
        motion.setX(i,motionX(shifting,this.crouchTransitions.get(pawn.id),origin));motion.setY(i,this.activity(pawn,equipment.getX(i)));
        motion.setZ(i,shownPose);
      }
      if(!stepping){
        if(pawn.melee?.strike)motion.setW(i,coreTimeSeconds(pawn.melee.strike.atCore,origin));
        else if(pawn.shooting?.stance?.phase==='cooldown')motion.setW(i,coreTimeSeconds(pawn.shooting.stance.startedAtCore,origin));
        else motion.setW(i,pawn.id*1.7);
      }
      from.setXYZW(i,visual.from.x,visual.from.y,visual.from.z,visual.from.w);to.setXYZW(i,visual.to.x,visual.to.y,visual.to.z,visual.to.w);
      allRigidAfter=this.observeBodyAtlasPose(pawn.id,i,geometry)&&allRigidAfter;
      if(motion.getY(i)!==priorActivity)partUnionDirty=true;
      if(spring){this.captureSpring297(i,from,to,times,motion);dirty=this.springPose297(i,pawn,dt297,speed297,from,to,times,motion)||dirty;}
    });
    let crouchFinished=false;
    for(const [id,transition] of this.crouchTransitions){
      if(timeline.tick<transition.start+CROUCH_TICKS)continue;
      this.crouchTransitions.delete(id);
      const index=this.pawnIndices.get(id);
      if(index===undefined)continue;
      const value=motion.getX(index);
      if(value>=-.5)continue;
      motion.setX(index,-value-1>=CROUCH_WALK_MARK?1:0);
      crouchFinished=true;
    }
    if(dirty){
      // Both actors, their loads and selection rings use exactly the same edge
      // and yaw. The carried rig is an extra pose in the existing GPU batch.
      for(const [carrier,patient] of this.rescuePairs){
        from.setXYZW(patient,from.getX(carrier),from.getY(carrier),from.getZ(carrier),from.getW(carrier));
        to.setXYZW(patient,to.getX(carrier),to.getY(carrier),to.getZ(carrier),to.getW(carrier));
        times.setXYZW(patient,times.getX(carrier),times.getY(carrier),times.getZ(carrier),times.getW(carrier));if(motion.getY(patient)!==0)partUnionDirty=true;motion.setXYZ(patient,0,0,6);
        this.crouchTransitions.delete(humans[patient]!.id);this.shownPoses.set(humans[patient]!.id,6);
        const source=this.visuals.get(humans[carrier]!.id)!,target=this.visuals.get(humans[patient]!.id)!;
        target.from.copy(source.from);target.to.copy(source.to);
        const heading=this.headings.get(humans[carrier]!.id);if(heading)this.headings.set(humans[patient]!.id,{...heading});
      }
      for(const attribute of [from,to,times,motion])attribute.needsUpdate=true;
    }else if(crouchFinished)motion.needsUpdate=true;
    if(partUnionDirty)this.refreshBodyPartUnion(geometry as THREE.InstancedBufferGeometry);if(this.observeBodyAtlasPoseAggregate(allRigidBefore&&allRigidAfter))this.bodyAtlas?.invalidate();
    if(playback)this.playback435.commit();
  }

  /** Called once after camera publication and physical stream reconciliation. */
  presentAnimations():void {
    const g=this.pawnMesh?.geometry;if(!g)return;
    this.animationCache.setOrigins(this.travelOrigin,this.carryOrigin);this.partialAnimationCache.setOrigins(this.travelOrigin,this.carryOrigin);
    const originalOnly = this.animationCache.prepareOriginalOnly();
    this.nativeBody = originalOnly;
    this.selectBodyMaterial();
    if(!originalOnly){
      for(const slot of this.pawnIndices.values())if(!this.animationOwners.has(slot))this.captureAnimation(slot);
      for(const [patient,carrier] of this.animationOwners)this.captureAnimation(patient,carrier);
    }
    this.animationCache.flush();
    if(!this.partialAnimationCache.prepareOriginalOnly())for(let slot=0;slot<this.partialOwners.length;slot++){const owner=this.partialOwners[slot]!;if(owner<0||!this.partialAnimationCache.shouldCaptureLinked(slot,this.animationCache,owner))continue;
      this.animationCache.readRoot(owner,this.linkedRoot);this.partialAnimationCache.setRoot(slot,this.linkedRoot,this.time.value,this.travelTime.value,this.cargoTime.value,this.blend.value);this.partialAnimationCache.publish(slot);}
    this.partialAnimationCache.flush();
    if(this.fireMesh)presentAttachedFire(this.fireMesh,g,this,this.animationDetail);
  }
  private captureAnimation(slot:number,owner?:number):void {
    const g=this.pawnMesh!.geometry,live=sampleActorRoot(g.getAttribute('aFrom'),g.getAttribute('aTo'),g.getAttribute('aTravel'),slot,this.travelTime.value,this.blend.value,this.animationRoot);
    const motion=g.getAttribute('aMotion'),cargo=g.getAttribute('aCargo'),pose=motion.getZ(slot);
    // Awake idle actors breathe/blink. Even a reclined original rig can
    // oscillate carried arms; decide from the actual encoded presentation.
    const continuousMiddle=pose!==POSE_SLEEP&&pose!==POSE_DEAD||motion.getX(slot)!==0||Math.abs(cargo.getX(slot))>.5||Math.abs(cargo.getW(slot))>.0001;
    const due=owner===undefined?this.animationCache.shouldCapture(slot,live.x,live.y,live.z,1,continuousMiddle):this.animationCache.shouldCaptureLinked(slot,this.animationCache,owner);
    if(!due)return;
    const root=owner!==undefined&&this.animationCache.readRoot(owner,this.linkedRoot)?this.linkedRoot:live;
    const time=owner===undefined?this.time.value:this.animationCache.cpuClock(owner,'time')??this.time.value;
    const travelTime=owner===undefined?this.travelTime.value:this.animationCache.cpuClock(owner,'travelTime')??this.travelTime.value;
    this.animationCache.setRoot(slot,root,time,travelTime,this.cargoTime.value,this.blend.value);samplePawnRig(this.animationCache,slot,g,root,time,travelTime);
    if(this.referenceRig&&pose===3)this.animationCache.set(slot,4,this.animationCache.get(slot,4,0)+(.605-this.humanBind.seatedHip)*PAWN_MODEL_SCALE,pose,motion.getY(slot));
    this.animationCache.publish(slot);
  }

  dispose(): void {
    this.playback435.clear();
    this.releaseFeatureRefresh?.();this.releaseFeatureRefresh=undefined;this.retireWearEffect();
    this.clearBodyPartUnions();
    // All borrowers stop together. Real initialized candidates retain their
    // r186 geometry-dispose listener until this point, even after growth.
    const terminalGeometries=[...this.retiredPawnGeometries,...[this.pawnMesh,this.cargoMesh,this.partialCargoMesh].filter((mesh):mesh is THREE.Mesh=>!!mesh).map(mesh=>mesh.geometry)];
    this.bodyAtlas?.attachGpuRetirement(terminalGeometries);this.bodyAtlas?.dispose();this.bodyAtlas=undefined;this.bodyAtlasAppearance.clear();this.bodyAtlasRigid.clear();this.bodyAtlasAllRigid=this.bodyAtlasReadmitAt=undefined;this.bodyAtlasPublishedCount=0;this.bodyAtlasModelKey='';
    if(this.humanStroke)this.graphics?.preparedStrokes.release(this.humanStroke,terminalGeometries);for(const table of this.humanCanonicalTables)attachFaceStrokeGpuRetirement(table,terminalGeometries);this.humanCanonicalTables.clear();this.refreshHumanBodySurface=undefined;this.humanBodyBakeOptions=undefined;this.humanPastelFromSample=undefined;
    this.cargoModel.attachGpuRetirement(terminalGeometries);
    clearGroup(this.group);
    for(const retired of this.retiredPawnGeometries)retired.dispose();this.retiredPawnGeometries.length=0;this.smithingGeometry=false;this.maceGeometry=false;this.longswordGeometry=false;this.spearGeometry=false;
    this.plainMaterial?.dispose();
    this.texturedMaterial?.dispose();
    this.nativePlainMaterial?.dispose();
    this.nativeTexturedMaterial?.dispose();
    this.nativePlainMaterial = this.nativeTexturedMaterial = null;
    this.nativeBody = false;
    this.surfaceTexture.dispose();this.humanStroke?.dispose();this.humanStroke=undefined;this.humanModels.dispose();this.cargoModel.dispose();
    this.animationCache.dispose();this.partialAnimationCache.dispose();
    this.pawnMesh = this.cargoMesh = this.partialCargoMesh = this.fireMesh = this.selectionMesh = null;
  }

}
import { medicallyStopped } from '../sim/health-rules';
