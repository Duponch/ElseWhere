import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {readNativeCorePhaseInput297} from '../bridge/native-clone-resident';
import type {CorePhaseTypedProjection297,CorePhaseAnchor297,CoreActorScene297} from '../bridge/core-phase-projection-297';
import {OwnedOpaqueRevisions435} from './OwnedOpaqueRevisions435';
import {ownActorPlaybackWorld435,isActorPlaybackWorld435} from './ActorPlayback435';
import {StaticSceneCompiler435} from './StaticSceneCompiler435';
import type {SceneApplicationContext} from './SceneApplicationContext';
import{createSurfaceMaterial}from'./SurfaceMaterials';
import {GraphicsStyleContext,currentGraphicsStyle} from './graphics-style';
import {normalizeGraphicsStylePreferences,graphicsStylePipelineKey,type GraphicsStylePreferences} from '../ui3d/native-preferences';
import {createGraphicsStyleComparison,type GraphicsStyleComparisonContext,type GraphicsStyleComparisonResult,type GraphicsComparisonMetadata} from './graphics-style-comparison';
import {knownPosition256} from '../ui/exploration-readers-256';
import {knownCell256,UNDISCOVERED_CELL_LABEL_256} from '../sim/exploration-visibility-256';
import {roofCoverage} from '../sim/roof-rules';
import {opaqueGroundExplorationMaterial256} from './ExplorationMask256';
import {replantTreeReason,isMinifiedTree} from '../sim/tree-transfer';
import { AllowedAreaLayer } from './AllowedAreaLayer';
import { DioramaLayer } from './DioramaLayer';
import { RoomLayer } from './RoomLayer';
import { parseLightingSettings, type LightingSettings } from './lighting-settings';
import { DecorOcclusion } from './decor-occlusion';
import { DeepResourceLayer } from './DeepResourceLayer';
import { AreaPreviewLayer } from './AreaPreviewLayer';
import {OrderTargetIndex} from './order-target-index';
import {OrderTargetPreviewLayer} from './OrderTargetPreviewLayer';
import { ConstructionPreviewLayer } from './ConstructionPreviewLayer';
import {EMPTY_GROUND_OVERLAYS,GROUND_OVERLAY_RENDER_ORDER,groundOverlayPlacements,groundOverlayRect,setGroundOverlayRenderOrder,type GroundOverlayRect} from './ground-overlay-surfaces';
import type { ConstructionPreviewSpec } from './construction-preview-parts';
import { HygieneLayer } from './HygieneLayer';

import { pawnBodyLocation } from '../sim/human-corpses';
import type { BuildableFloorKind } from '../sim/flooring';
import type { ConstructionMaterial } from '../sim/construction-materials';
import { WindLayer } from './WindLayer';
import { pileParts,type PileBundle } from './pile-parts';
import {materialAllowedForPlayer256} from '../sim/material-permission-256';
import { corpseStage } from '../sim/corpses';
import { corpseVisualMask } from './corpse-presentation';
import { WildlifeLayer } from './WildlifeLayer';
import {AtlasBuildQuarantineError} from './origami/baked/atlas-cache';
import {TreeBakeOwner,type OwnedTreeCatalog} from './origami/TreeBakeOwner';
import { AnimalCargoLayer282 } from './AnimalCargoLayer282';
import { MechanoidLayer } from './MechanoidLayer';
import { RopeLayer } from './RopeLayer';
import { NaturalResourcePresentation } from './NaturalResourcePresentation';
import {PreparedNaturalPresentation} from './PreparedNaturalPresentation';
import {withPreparedSceneMatrices} from './scene-matrix-pass';
import {readPreparedNaturalFrame} from '../bridge/prepared-natural-frame';
import { SceneResourceIndex, readSceneResourceFrame, type SceneResourceFrame } from './scene-resource-index';
import { ProjectileLayer } from './ProjectileLayer';
import { EnvironmentLighting } from './EnvironmentLighting';
import { RangeOutlineLayer } from './RangeOutlineLayer';
import { PresentationQueue } from './PresentationQueue';
import { MOTION_HISTORY_TICKS } from '../bridge/motion-tracks';
import { RoofLayer } from './RoofLayer';
import { terrainSurfaceChanges,terrainTileChanges } from './terrain-state';
import { doorOrientations } from '../sim/door-rules';
import { DoorLayer } from './DoorLayer';
import type { SceneStructurePreparation } from './SceneStructurePreparation';
import { TimberCladdingLayer } from './TimberCladdingLayer';
import { prepareShadowPipelines } from './shadow-preparation';
import { PausedShadowCache } from './PausedShadowCache';
import { installCommand } from '../sim/furniture-commands';
import type { Structure } from '../sim/types';
import { buildJobMarkers, ConfirmedJobMarkers } from './JobLayer';
import type { ClosedMainMapIntentReader } from './closed-main-map-intents';
import type { ConfirmedIntentFields } from './confirmed-intent-fields';
import { jobDuration } from '../sim/farming';
import { travelHeight } from './furniture-motion';
import { pileSurfaces,pileIdentitySurfaces,withPileSurfaceReads } from './pile-surfaces';
import { CropLayer } from './CropLayer';
import type { ScreenPawn, SelectionGesture } from './PawnSelectionInput';
import { FireLayer } from './FireLayer';
import { GrowingZoneLayer } from './GrowingZoneLayer';
import { buildTerrain, copyTerrainPaintRect, createTerrainPaintTexture, patchTerrainPaintTexture, singleTerrainPaintPatchRect, syncTerrainPaintUvs, terrainPresentationType, TERRAIN_PAINT_PIXELS_PER_CELL, type TerrainPaintPatchRect } from './TerrainLayer';
import { PaintedWater } from './PaintedWater';
import { WeatherCloudLayer } from './WeatherCloudLayer';
import { OrbitalDeliveryLayer } from './OrbitalDeliveryLayer';
import { PodRescueLayer } from './PodRescueLayer';
import { StartingArrivalLayer } from './StartingArrivalLayer';
import { WeatherPrecipitationLayer } from './WeatherPrecipitationLayer';
import { weatherRainRate, weatherSnowRate } from '../sim/weather';
import { visualWindDirection } from './visual-weather';
import { RockLayer } from './RockLayer';
import { MotionTimeline } from './MotionTimeline';
import type { PawnTrack } from '../bridge/motion-tracks';
import { OverviewLayer } from './OverviewLayer';
import * as THREE from 'three/webgpu';
import { FurniturePresentation } from './FurnitureLayer';
import { PawnLayer } from './PawnLayer';
import { FrameMetrics } from './FrameMetrics';
import { BoxBatches } from './BoxBatches';
import {GeyserLayer256} from './GeyserLayer256';
import {SnowSurfaceLayer} from './SnowSurfaceLayer';
import { ResourceLayer } from './ResourceLayer';
import { clearGroup, material } from './primitives';
import type { Placement } from './primitives';

import type { World, Orientation, AreaAction, Cell, JobKind } from '../sim/types';
import { TICKS_PER_SECOND } from '../sim/types';
import { windIntensity } from '../sim/wind-rules';
import { calendarTick } from '../sim/calendar';
import { footprintCells,STRUCTURE_DEFINITIONS } from '../sim/definitions';
import { buildConstructionCellIndex, canDesignate, type ConstructionCellIndex } from '../sim/engine';
import { buildAreaIndex, isAreaAction, queryArea } from '../sim/designation';
import { constructionLineCells, isLineBuildKind, type LineBuildKind } from '../sim/construction-line';
import type { AreaIndex } from '../sim/designation';
import { WORLD_SCALE } from '../world/scale';
import type { CameraMode } from './CameraRig';
import { cameraClipNear } from './camera-clip';
import { DayNightLayer } from './DayNightLayer';
import { RecreationHints } from './RecreationHints';
import { PlantClusterLayer } from './PlantClusterLayer';
import { isClusterPlantSpecies,isResidentCrop } from './flora-presentation';
import { DesignationIconLayer } from './DesignationIconLayer';
import { LandscapeBatch } from './LandscapeBatch';
import { ActionFeedbackLayer } from './ActionFeedbackLayer';
import { ActionVfxLayer } from './ActionVfxLayer';
import { BrawlCloudLayer } from './BrawlCloudLayer';
import { StructureVfxLayer } from './StructureVfxLayer';
import { MiniTurretLayer } from './MiniTurretLayer';
import { miniTurretRadiusCells, MINI_TURRET_DISPLAY_RANGE, MINI_TURRET_DISPLAY_BOMB_RADIUS } from '../sim/mini-turret-presentation';

import { createStylizedSurfaceTexture } from './stylized-surfaces';
import { GpuGroundGrassLayer } from './GpuGroundGrassLayer';
import { storageZonePlacements } from './storage-zone-presentation';
import {GroundSurfaceTint} from './GroundSurfaceTint';
import {ZONE_FILL_OPACITY,ZONE_TOOLS,areaPreviewColor,zoneBoundaryVertices} from './zone-surface-presentation';
import {stockpileZoneCells} from '../sim/stockpile-zones';
import {overlaySurfaceHeightAtCell as surfaceHeightAtCell,SNOW_OVERLAY_LIFT,isWaterTerrain} from './surface-height';
import { HomePresentationSignature, StoragePresentationSignature, StructurePresentationSignature } from './presentation-signatures';
import { mapObjectCells,mapObjectsAt,sameMapObject,type MapObjectSelection } from '../ui/map-object-selection';
import {mapObjectGroupCells} from '../ui/map-object-group-selection';

import type {SceneRenderHostPort,SceneCameraPort,RendererLifetime} from './scene-render-ports';
import { AnimationDetail } from './AnimationDetail';
import { parseAnimationSettings, type AnimationSettings } from './animation-settings';
import { DEFAULT_SHADOW_SETTINGS, parseShadowSettings, type ShadowSettings } from './shadow-settings';
import { ShadowRefreshScheduler } from './ShadowRefreshScheduler';
type VisualChunk = { signature: string; group: THREE.Group };
interface PreparedCoreTreeTextures {commit():void;rollback():void;dispose():void}

export interface AudioFrameView {
  tick: number;
  paused: boolean;
  camera: { x: number; y: number; z: number; targetX: number; targetZ: number; span: number; mode: CameraMode };
}


function isNaturalSceneWorld(value:World|{changed:boolean}):value is World {
  return Object.hasOwn(value,'resources');
}

export class SceneRenderCore {
  private rendererDisposal:Promise<void>|undefined;
  private bakedTreeOwner?:TreeBakeOwner;
  /** A failed publication/retirement may still have Source or435 users. These
   * textures stay owned until both producers detach; never allocated normally. */
  private quarantinedTreeCatalogs?:Set<OwnedTreeCatalog>;
  private sharedSurfacePreparation?:Promise<void>;
  private sharedSurfaceEpoch=0;
  private treeTextureTimer?:ReturnType<typeof setTimeout>;
  private holdSurfaceWorld=false;
  private pendingSurfaceWorld?:{world:World;reset:boolean};
  private closingPresentation=false;
  private disposeAfterPreparation?:Promise<void>;
  private graphicsMeasurement:{collector:ReturnType<typeof createGraphicsStyleComparison>;context:()=>GraphicsStyleComparisonContext;isCurrent:()=>boolean;resolve:(result:GraphicsStyleComparisonResult)=>void;timer?:ReturnType<typeof setTimeout>}|undefined;
  async disposeAsync():Promise<void>{
    const errors:unknown[]=[];
    try{this.dispose();}catch(error){errors.push(error);}
    try{await this.disposeAfterPreparation;}catch(error){errors.push(error);}
    try{await this.rendererDisposal;}catch(error){errors.push(error);}
    if(errors.length===1)throw errors[0];if(errors.length)throw new AggregateError(errors,'Scene disposal failed');
  }
  protected diorama: DioramaLayer | null = null;
  protected dioramaEnabled = true;
  protected room: RoomLayer | null = null;
  protected roomEnabled = true;
  private armedRoom: RoomLayer | null = null;
  protected readonly decorOcclusion = new DecorOcclusion();
  private lightingSettings = parseLightingSettings(null);
  private shadowSettings = { ...DEFAULT_SHADOW_SETTINGS };
  protected readonly shadowRefresh = new ShadowRefreshScheduler();
  protected readonly animationDetail = new AnimationDetail();
  private readonly skyAnimation=this.animationDetail.createHandle();
  private readonly shadowView = new THREE.Matrix4();
  private readonly shadowProjection = new THREE.Matrix4();
  private shadowViewReady = false;
  private shadowCamera: THREE.Camera | undefined;
  private shadowCameraLayers = -1;
  private shadowCameraCoordinates = -1;
  private shadowCameraReversedDepth = false;
  readonly graphicsStyle=currentGraphicsStyle()??new GraphicsStyleContext();
  readonly stats = { fps: 0, frameMs: 0, frameP95: 0, drawCalls: 0, triangles: 0 };
  async setGraphicsStyleParameters(settings:GraphicsStylePreferences):Promise<void> {
    if(this.disposed||this.closingPresentation||this.fatalError)throw Error('Cet affichage est fermé ou indisponible.');
    if(this.sharedSurfacePreparation||this.preparing)throw Error('La préparation des textures est déjà en cours.');
    const next=normalizeGraphicsStylePreferences(settings),previous={...this.graphicsStyle.preferences},epoch=++this.sharedSurfaceEpoch;
    const treePaintChanged=(['impasto','wear','edges','blackEdges','edgeWidth','strokeImperfection','contourImperfection'] as const).some(key=>next[key]!==previous[key]);
    const compileOnly=graphicsStylePipelineKey(next)===graphicsStylePipelineKey(previous);
    if(this.treeTextureTimer){clearTimeout(this.treeTextureTimer);this.treeTextureTimer=undefined;}
    this.cancelGraphicsMeasurement('texture-change');this.holdSurfaceWorld=true;this.preparing=true;
    const assertCurrent=()=>{if(this.disposed||this.closingPresentation||epoch!==this.sharedSurfaceEpoch)throw Error('La préparation des textures a été interrompue.');};
    const job=(async()=>{
      let trees:PreparedCoreTreeTextures|undefined;
      try{
        this.graphicsStyle.update(next);this.uploadSharedSurfaceAssets();assertCurrent();
        if(this.canBakeTrees)trees=await this.stageBakedTreeResources(this.graphicsStyle.prepareAtlasPaint(),assertCurrent,treePaintChanged);
        // An actual paint change ends the old generation even for an empty
        // cohort. Encoding alone preserves it, including while on Pastel.
        if(!trees&&treePaintChanged&&this.bakedTreeOwner){const owner=this.bakedTreeOwner,publication=this.resources.setTreeAssetCatalog(undefined);let settled=false;trees={commit:()=>{settled=true;publication.commit();owner.invalidate();},rollback:()=>{if(settled)throw Error('Committed tree images cannot be rolled back');publication.rollback();},dispose:()=>{}};}
        // Encoding alone keeps the prepared Gouache bank resident: the shared
        // surface's Pastel branch does not sample it. No bake on a return to
        // Gouache unless an actual paint value or model cohort changed.
        assertCurrent();await this.preparePresentationResources(compileOnly);assertCurrent();trees?.commit();
      }catch(error){
        // Keep the old images alive until every candidate program is ready.
        // A failed candidate cannot retire a texture still bound by Source435.
        if(this.closingPresentation||this.disposed)throw error;
        try{trees?.rollback();this.graphicsStyle.update(previous);this.uploadSharedSurfaceAssets();await this.preparePresentationResources(compileOnly);assertCurrent();}
        catch(rollbackError){const failure=new AggregateError([error,rollbackError],'Le retour aux textures précédentes a échoué.');this.reportFailure(failure.message);throw failure;}
        throw error;
      }finally{
        try{trees?.dispose();}catch(error){if(!this.closingPresentation)this.reportFailure('Libération des textures interrompue : '+(error instanceof Error?error.message:String(error)));throw error;}finally{this.finishSurfacePreparation();}
      }
    })();
    this.sharedSurfacePreparation=job;
    try{await job;}finally{if(this.sharedSurfacePreparation===job)this.sharedSurfacePreparation=undefined;this.queuePausedTreeTextures();}
  }
  private uploadSharedSurfaceAssets():void{for(const texture of this.graphicsStyle.prepareSharedSurfaceAssets())this.renderer.initTexture(texture);}
  /** Only the newest fully admitted World is held. Native admissions and the
   * motion timeline continue; no simulation, input owner or camera is replaced. */
  private finishSurfacePreparation():void{
    this.holdSurfaceWorld=false;this.preparing=false;this.lastFrame=0;this.invalidatePausedShadow();
    const pending=this.pendingSurfaceWorld;this.pendingSurfaceWorld=undefined;
    if(this.disposed||this.closingPresentation||this.fatalError||this.hostPort.hidden()||this.presentationSuspendedUntilFrame325)return;
    if(pending)try{this.presentation.clear();this.applyWorld(pending.world,pending.reset);this.presentCorePhases297();this.uploadSharedSurfaceAssets();}catch(error){this.reportFailure('Adoption après préparation des textures interrompue : '+(error instanceof Error?error.message:String(error)));throw error;}
    this.updateSelectedObject();this.updateHover();
  }
  bakedGraphicsStatus(){return{animals:this.wildlife.bakedStatus(),cache:null,
    trees:this.resources.bakedTreeStatus(),treeCache:this.bakedTreeOwner?.snapshot()??null};}
  private get canBakeTrees():boolean{return this.backend==='WebGPU'&&this.graphicsStyle.origami&&!this.graphicsStyle.reliefEnabled&&!this.graphicsStyle.wearEnabled&&this.texturesEnabled;}
  private get hasPendingBakedResources():boolean {
    const demand=this.resources.treeBakeDemand();
    return this.bakedTreeOwner?this.bakedTreeOwner.needsPreparation(demand):demand.models.length>0;
  }
  private async prepareBakedTreeResources(source:ReturnType<GraphicsStyleContext['prepareAtlasPaint']>,assertCurrent:()=>void):Promise<void>{
    const prepared=await this.stageBakedTreeResources(source,assertCurrent);
    try{prepared?.commit();}finally{prepared?.dispose();}
  }
  private async stageBakedTreeResources(source:ReturnType<GraphicsStyleContext['prepareAtlasPaint']>,assertCurrent:()=>void,force=false):Promise<PreparedCoreTreeTextures|undefined>{
    const demand=this.resources.treeBakeDemand();if(!demand.models.length)return;
    const MiB=1024*1024,owner=this.bakedTreeOwner??=new TreeBakeOwner({cpuBytes:128*MiB,gpuBytes:512*MiB});
    if(!force&&!owner.needsPreparation(demand))return;
    let candidate:Awaited<ReturnType<TreeBakeOwner['prepare']>>;
    let staging:ReturnType<ResourceLayer['prepareTreeAssetCatalog']>|undefined;
    try{
      candidate=await owner.prepare(this.renderer,this.graphicsStyle,demand,source,assertCurrent,force);
      if(!candidate)return;
      assertCurrent();
      staging=this.resources.prepareTreeAssetCatalog(candidate,this.environmentLighting.configure);
      const preview=new THREE.Group();preview.add(...staging.warmup);
      await this.renderer.compileAsync(preview,this.rig.orthographic,this.scene);assertCurrent();
      await this.renderer.compileAsync(preview,this.rig.perspective,this.scene);assertCurrent();
      if(!demand.isCurrent())throw Error('Tree cohort changed before publication');
      // No await after publication. Only the shared texture binding changes;
      // model buffers, materials, wind and compiled435 pages stay resident.
      const transaction=staging.publish(),published=candidate,stage=staging;candidate=undefined;staging=undefined;let settled=false,rolledBack=false,closed=false;
      return{commit:()=>{
        if(settled||rolledBack)return;
        try{settled=true;transaction.commit();const retired=owner.adopt(published);retired?.dispose();this.invalidatePausedShadow();}
        catch(error){(this.quarantinedTreeCatalogs??=new Set()).add(published);throw new AggregateError([error],'Tree publication ownership transfer failed');}
      },rollback:()=>{if(settled)throw Error('Committed tree images cannot be rolled back');if(rolledBack)return;transaction.rollback();rolledBack=true;},dispose:()=>{
        if(closed)return;closed=true;const errors:unknown[]=[];try{stage.dispose();}catch(error){errors.push(error);}
        if(!settled){if(!rolledBack){(this.quarantinedTreeCatalogs??=new Set()).add(published);errors.push(Error('Published tree candidate must be committed or rolled back before retirement'));}else try{published.dispose();}catch(error){(this.quarantinedTreeCatalogs??=new Set()).add(published);errors.push(error);}}
        if(errors.length)throw new AggregateError(errors,'Tree staged publication cleanup failed');
      }};
    }catch(error){
      if(error instanceof AggregateError||error instanceof AtlasBuildQuarantineError){
        if(candidate){(this.quarantinedTreeCatalogs??=new Set()).add(candidate);candidate=undefined;}
        throw error;
      }
      assertCurrent();if(!demand.isCurrent())throw error;
      owner.refuse(demand,error);console.warn('Tree atlas retained the shared direct-painted surface',error);
      // A different paint generation must never keep the previous cached
      // image. The exact opaque direct surface remains available if a bounded
      // old+new atlas reservation is refused, and rollback keeps the old bank.
      if(force){const publication=this.resources.setTreeAssetCatalog(undefined);let settled=false;return{commit:()=>{settled=true;publication.commit();owner.invalidate();},rollback:()=>{if(settled)throw Error('Committed tree images cannot be rolled back');publication.rollback();},dispose:()=>{}};}
    }finally{
      const errors:unknown[]=[];
      try{staging?.dispose();}catch(error){errors.push(error);}
      try{candidate?.dispose();}catch(error){errors.push(error);}
      if(errors.length)throw new AggregateError(errors,'Tree staged resource cleanup failed');
    }
  }
  /** The renderer is exclusively held across every GPU await. Existing actors
   * remain on their source materials until the complete texture is published. */
  private async prepareSharedTreeTextures(pausedOnly=false):Promise<void>{
    if(!this.canBakeTrees||!this.hasPendingBakedResources||this.closingPresentation)return;
    if(!this.preparing)throw Error('Tree texture preparation requires an exclusive renderer');
    const epoch=this.sharedSurfaceEpoch,source=this.graphicsStyle.prepareAtlasPaint();
    const assertCurrent=()=>{if(this.disposed||this.closingPresentation||!this.preparing||!this.canBakeTrees||epoch!==this.sharedSurfaceEpoch||pausedOnly&&this.received?.speed!==0)throw Error('Tree texture preparation superseded');source.assertCurrent();};
    await this.prepareBakedTreeResources(source,assertCurrent);
  }
  /** Optional image caching only; every arriving model already has its shared
   * opaque paint surface. No animal atlas queue or renderer replacement exists. */
  private queuePausedTreeTextures():void{
    if(this.treeTextureTimer)clearTimeout(this.treeTextureTimer);
    this.treeTextureTimer=undefined;
    if(this.disposed||this.closingPresentation||this.fatalError||this.preparing||this.sharedSurfacePreparation||this.received?.speed!==0||!this.canBakeTrees||!this.hasPendingBakedResources)return;
    this.treeTextureTimer=setTimeout(()=>{
      this.treeTextureTimer=undefined;
      if(this.disposed||this.closingPresentation||this.fatalError||this.preparing||this.received?.speed!==0)return;
      this.preparing=true;this.holdSurfaceWorld=true;
      const job=this.prepareSharedTreeTextures(true);this.sharedSurfacePreparation=job;
      void job.catch(error=>{
        if(this.closingPresentation)return;
        if(error instanceof AggregateError||error instanceof AtlasBuildQuarantineError)this.reportFailure('Préparation des textures interrompue : '+error.message);
        else console.warn('Tree texture preparation retained the shared surface',error);
      }).finally(()=>{
        if(this.sharedSurfacePreparation===job)this.sharedSurfacePreparation=undefined;
        this.finishSurfacePreparation();this.queuePausedTreeTextures();
      }).catch(error=>{if(!this.closingPresentation&&!this.fatalError)this.reportFailure('Reprise des textures interrompue : '+(error instanceof Error?error.message:String(error)));});
    },100);
  }
  captureGraphicsView(){return{mode:this.rig.mode,position:this.camera.position.toArray(),target:this.controls.target.toArray(),zoom:this.camera.zoom};}
  captureGraphicsInteraction(){return{tool:this.tool,floor:this.selectedFloor,material:this.constructionMaterial,rotation:this.placementRotation,zone:this.zoneTarget,allowedArea:this.allowedAreaTarget,tree:this.treePlacementId,furniture:this.furniturePlacement,roofAreas:this.roofAreasVisible};}
  restoreGraphicsInteraction(state:ReturnType<SceneRenderCore['captureGraphicsInteraction']>):void{
    this.setFloorSelection(state.floor);this.setConstructionMaterial(state.material);this.setPlacementRotation(state.rotation);this.setTool(state.tool);this.setZoneTarget(state.zone);this.setAllowedAreaTarget(state.allowedArea);this.setTreePlacement(state.tree);this.setFurniturePlacement(state.furniture);this.setRoofAreasVisible(state.roofAreas);
  }
  restoreGraphicsView(view:ReturnType<SceneRenderCore['captureGraphicsView']>):void{
    this.rig.setMode(view.mode);this.controls.target.fromArray(view.target);this.camera.position.fromArray(view.position);this.camera.zoom=view.zoom;this.camera.updateProjectionMatrix();this.controls.update();this.invalidatePausedShadow();
  }
  /** Manual fixed window over actual scene submissions. CPU renderScene time
   * and submission intervals remain distinct; no GPU time is inferred. */
  async measureGraphicsStyle(sceneFingerprint:string,settings:Record<string,GraphicsComparisonMetadata>,isCurrent:()=>boolean):Promise<GraphicsStyleComparisonResult>{
    if(this.graphicsMeasurement)throw Error('Une mesure graphique est déjà en cours.');
    if(this.disposed||this.fatalError||this.preparing||this.presentationStopped||!this.world||this.received?.speed!==0)throw Error('Mettez une colonie affichée en pause avant de mesurer.');
    const context=():GraphicsStyleComparisonContext=>({preferences:{...this.graphicsStyle.preferences},sceneFingerprint,
      camera:{...this.captureGraphicsView(),up:this.camera.up.toArray(),quaternion:this.camera.quaternion.toArray(),projection:Array.from(this.camera.projectionMatrix.toArray()),near:this.camera.near,far:this.camera.far,layers:this.camera.layers.mask,coordinateSystem:this.camera.coordinateSystem,reversedDepth:this.camera.reversedDepth,span:this.rig.span},
      viewport:{width:this.viewportWidth,height:this.viewportHeight,pixelRatio:this.renderer.getPixelRatio()},backend:this.backend,
      settings:{requested:settings,origamiBaked:{animals:this.wildlife.graphicsComparisonMetadata(),trees:this.resources.graphicsComparisonMetadata()},renderer:{textures:this.texturesEnabled,grassVisible:this.grassVisible,groundGrass:!!this.grass,room:this.roomEnabled,diorama:this.dioramaEnabled,lighting:{...this.lightingSettings},shadows:{...this.shadowSettings},animations:{...this.animationDetail.settings},requestedPixelRatio:this.hostPort.pixelRatio(),requestedViewport:{...this.hostPort.viewport()},backend:this.hostPort.backend()}}});
    const started=this.hostPort.now(),collector=createGraphicsStyleComparison(context(),started);
    return new Promise(resolve=>{
      const active={collector,context,isCurrent,resolve,timer:undefined as ReturnType<typeof setTimeout>|undefined};
      this.graphicsMeasurement=active;
      if(!this.graphicsMeasurementIsCurrent()){this.cancelGraphicsMeasurement('context-changed');return;}
      if(this.hostPort.hidden()){this.cancelGraphicsMeasurement('hidden');return;}
      // A fixed deadline also resolves when hidden/suspended RAF produces no
      // further frames. The main visibility owner can cancel immediately.
      active.timer=setTimeout(()=>{
        if(this.graphicsMeasurement!==active)return;
        if(!this.graphicsMeasurementIsCurrent()){this.cancelGraphicsMeasurement('context-changed');return;}
        try{this.completeGraphicsMeasurement(collector.finish(this.hostPort.now(),context(),!this.hostPort.hidden()));}
        catch{this.cancelGraphicsMeasurement('invalid-context');}
      },Math.max(0,Math.ceil(collector.deadlineMs-this.hostPort.now())));
    });
  }
  cancelGraphicsMeasurement(reason='cancelled'):void{
    const active=this.graphicsMeasurement;if(active)this.completeGraphicsMeasurement(active.collector.cancel(reason,this.hostPort.now()));
  }
  private graphicsMeasurementIsCurrent():boolean{
    const active=this.graphicsMeasurement;if(!active||this.disposed||this.fatalError||this.preparing||this.presentationStopped||this.received?.speed!==0)return false;
    try{return active.isCurrent();}catch{return false;}
  }
  private completeGraphicsMeasurement(result:GraphicsStyleComparisonResult):void{
    const active=this.graphicsMeasurement;if(!active)return;
    this.graphicsMeasurement=undefined;if(active.timer!==undefined)clearTimeout(active.timer);active.resolve(result);
  }
  private recordGraphicsMeasurement(cpuSubmitMs:number,submittedAtMs:number):void{
    const active=this.graphicsMeasurement;if(!active)return;
    if(!this.graphicsMeasurementIsCurrent()){this.cancelGraphicsMeasurement('context-changed');return;}
    try{
      const result=active.collector.sample({nowMs:submittedAtMs,context:active.context(),visible:!this.hostPort.hidden(),drawCalls:this.renderer.info.render.drawCalls,triangles:this.renderer.info.render.triangles,cpuSubmitMs});
      if(result)this.completeGraphicsMeasurement(result);
    }catch{this.cancelGraphicsMeasurement('invalid-context');}
  }
  protected readonly frames = new FrameMetrics();
  protected viewportWidth=1;
  protected viewportHeight=1;
  protected createApplicationContext():SceneApplicationContext|undefined{return undefined;}
  protected readonly applicationContext=this.createApplicationContext();
  protected readonly ownedOpaqueRevisions435=this.applicationContext?new OwnedOpaqueRevisions435():undefined;
  protected createEnvironmentLighting():EnvironmentLighting { return new EnvironmentLighting(); }
  protected readonly environmentLighting = this.createEnvironmentLighting();
  protected readonly overview = new OverviewLayer(this.environmentLighting.configure);
  protected readonly timeline = new MotionTimeline();
  protected readonly confirmedIntentReader=this.createIntentReader();
  protected createIntentReader():ClosedMainMapIntentReader|undefined {return undefined;}
  private confirmedIntents:ConfirmedIntentFields|undefined;
  private confirmedIntentsDirty=false;
  private presentedIntentFields:ConfirmedIntentFields|undefined;
  private confirmedJobsSource:ConfirmedIntentFields['jobs']|undefined;
  private confirmedSurfaceDirty=false;
  private confirmedPathDirty=false;
  private confirmedDesignationsDirty=false;
  private readonly confirmedJobMarkers=new ConfirmedJobMarkers();
  protected readonly presentation = this.createPresentationQueue();
  protected createPresentationQueue():PresentationQueue { return new PresentationQueue(); }
  protected received:{world:World;speed:number;tracks?:PawnTrack[];immutableSnapshot:boolean;coreInput297?:object}|undefined;
  private readonly coreFullInputs297=new WeakMap<World,CorePhaseTypedProjection297>();
  private readonly pendingCore297:CorePhaseTypedProjection297[]=[];
  private presentationFrame297=0;
  private calmFullFrame297:{frame:number;anchor:CorePhaseAnchor297}|undefined;
  private hasCalmFrameGates297=false;
  /** Called by the actual Main RAF entry before its Native FIFO drain. */
  protected beginPresentationFrame297():void {
    if(this.disposed||this.fatalError)return;
    if(!Number.isSafeInteger(this.presentationFrame297+1))throw Error('Presentation frame marker exhausted');
    this.presentationFrame297++;
  }
  private releaseCalmFullFrame297():void {
    this.calmFullFrame297=undefined;
    if(this.hasCalmFrameGates297){this.presentation.releaseFrameGates();this.hasCalmFrameGates297=false;}
  }
  private latestCoreInput297:object|undefined;
  private appliedCoreAnchor297:CorePhaseAnchor297|undefined;
  private appliedCore297=-Infinity;
  /** The authentic Full and confirmed physical records have distinct data frontiers. */
  private actorScene297:CoreActorScene297|undefined;
  /** Only the private native-lane receipt can enter this confirmed channel. */
  setCorePhase297(nativeInput:object):void {
    if(this.disposed||this.fatalError)return;
    const input=readNativeCorePhaseInput297(nativeInput),full=this.received?.world,base=full&&this.coreFullInputs297.get(full);
    if(!input||input.kind!=='phase'||!base||input.anchor!==base.anchor||input.world!==full||input.speed!==this.received!.speed)throw Error('Unowned or displaced actor phase');
    const previous=this.pendingCore297.at(-1);if(previous&&input.core<previous.core||input.core<this.appliedCore297)throw Error('Actor phase would rewind presentation');
    this.latestCoreInput297=nativeInput;
    this.projectiles.adoptPhase297(input);
    if(this.presentationSuspendedUntilFrame325||this.hostPort.hidden())return;
    this.timeline.adopt(input.core/10,input.speed,input.tracks,this.hostPort.now(),false,!!this.applicationContext,true);this.hasTracks=true;
    this.pendingCore297.push(input);if(this.pendingCore297.length>64)throw Error('Actor phase presentation history overflow');
    if(input.speed===0)this.presentCorePhases297();
  }
  private presentCorePhases297():void {
    if(this.holdSurfaceWorld)return;
    const anchor=this.appliedCoreAnchor297;if(!anchor)return;
    const received=this.received&&this.coreFullInputs297.get(this.received.world),applicable:CorePhaseTypedProjection297[]=[],retained:CorePhaseTypedProjection297[]=[];
    for(const input of this.pendingCore297){
      if(input.anchor===anchor){
        if(input.core<this.appliedCore297)continue; // This exact anchor already presented it.
        (input.core/10<=this.timeline.tick+1e-10?applicable:retained).push(input);continue;
      }
      const sameOwner=input.anchor.epoch===anchor.epoch&&input.anchor.mapId===anchor.mapId;
      if(sameOwner&&input.anchor.revision>anchor.revision){retained.push(input);continue;}
      // Snapshot epoch/revision are already committed Native order, not a Core-time guess.
      if(input.anchor.epoch<anchor.epoch||input.anchor.epoch===anchor.epoch&&input.anchor.revision<anchor.revision)continue;
      if(input.anchor===received?.anchor){retained.push(input);continue;}
      throw Error('Unordered actor phase presentation anchor');
    }
    this.pendingCore297.splice(0,this.pendingCore297.length,...retained);
    if(!applicable.length)return;
    const last=applicable.at(-1)!,human=new Set<number>(),animal=new Set<number>(),mechanical=new Set<number>(),changedIds=new Set<number>();
    for(const p of applicable)for(const row of p.actors){changedIds.add(row.id);(row.kind==='human'?human:row.kind==='animal'?animal:mechanical).add(row.index);}
    const world=this.world;if(!world||last.world!==world)throw Error('Actor frontier lost its presented authentic Full');
    const actors=last.actorScene;
    this.pawns.adoptPhase297(world,[...human],actors,changedIds);this.wildlife.adoptPhase297(world,[...animal],actors,changedIds);this.mechanoids.adoptPhase297(world,[...mechanical],actors);
    this.actorScene297=actors;this.appliedCore297=last.core;this.confirmedPathDirty=true;
  }
  protected immutableSnapshot=false;
  protected readonly immutableWorlds=new WeakSet<World>();
  protected hasTracks = false;
  protected readonly deepResources = new DeepResourceLayer();
  protected readonly hygiene = new HygieneLayer(this.environmentLighting.configure);
  protected selectedFloor:BuildableFloorKind|undefined;
  protected constructionMaterial:ConstructionMaterial|undefined;
  protected readonly fires = new FireLayer(this.animationDetail);
  protected readonly wind = new WindLayer(this.environmentLighting.configure,this.animationDetail);
  protected readonly projectiles = new ProjectileLayer(this.animationDetail);
  protected readonly wildlife:WildlifeLayer;
  protected readonly animalCargo = new AnimalCargoLayer282(this.environmentLighting.configure);
  protected readonly mechanoids = new MechanoidLayer(this.environmentLighting.configure,this.animationDetail);
  protected readonly ropes = new RopeLayer();
  protected readonly pawns = new PawnLayer(this.environmentLighting.configure,this.animationDetail);
  protected readonly actionFeedback = new ActionFeedbackLayer(this.pawns);
  protected readonly actionVfx = new ActionVfxLayer(this.pawns,this.animationDetail);
  protected readonly brawlCloud = new BrawlCloudLayer(this.pawns,this.animationDetail);
  protected readonly structureVfx = new StructureVfxLayer(this.animationDetail);
  protected readonly turretTops=new MiniTurretLayer(this.animationDetail);
  protected turretPreviewSignature='';
  protected turretPreviewVisible=false;
  protected readonly orbitalDelivery = new OrbitalDeliveryLayer(this.environmentLighting.configure,this.animationDetail);
  protected readonly podRescue = new PodRescueLayer(this.environmentLighting.configure,this.animationDetail);
  protected readonly startingArrival = new StartingArrivalLayer(this.environmentLighting.configure,this.animationDetail);

  readonly backend: string;
  protected readonly renderer: THREE.WebGPURenderer;
  protected readonly scene = new THREE.Scene();
  protected readonly staticSceneCompiler435=this.applicationContext?new StaticSceneCompiler435(this.scene):undefined;
  staticSceneCompilerMetrics435(){return this.staticSceneCompiler435?.snapshot();}
  private reconcileStaticCompiler435():void {
    const owner=this.staticSceneCompiler435;if(!owner)return;
    if(!this.world||!this.immutableWorlds.has(this.world)){owner.clear();return;}
    // Rock local views share their global attribute owner; exclude distant
    // aggregate and let the compiler deduplicate only referenced vertices.
    owner.reconcile([this.terrainGroup,this.resourceGroup,...this.rocks.group.children.filter(child=>child instanceof THREE.Group)],[this.terrainPlainMaterial,this.terrainPaintMaterial,...this.resources.compiledMaterials435(),...this.rocks.compiledMaterials435()]);
  }
  protected readonly actorPlayback435={snapshot:()=>{
    const pawns=this.pawns.actorPlaybackMetrics435(),wildlife=this.wildlife.actorPlaybackMetrics435(),mechanoids=this.mechanoids.actorPlaybackMetrics435(),rows=[pawns,...wildlife,...mechanoids];
    return{enabled:!!this.applicationContext&&isActorPlaybackWorld435(this.world??undefined),actors:rows.reduce((n,row)=>n+row.actors,0),visits:rows.reduce((n,row)=>n+row.visits,0),skips:rows.reduce((n,row)=>n+row.skips,0),dependentVisits:rows.reduce((n,row)=>n+row.dependentVisits,0),cursor:this.timeline.playbackDiagnostics435(),producers:{pawns,wildlife,mechanoids}};
  }};
  protected readonly landscape = new LandscapeBatch();
  protected grass: GpuGroundGrassLayer | null = null;
  protected readonly rig: SceneCameraPort;
  protected get camera(): THREE.OrthographicCamera | THREE.PerspectiveCamera { return this.rig.camera; }
  protected get controls(): SceneCameraPort['controls'] { return this.rig.controls; }
  protected readonly terrainGroup = new THREE.Group();
  protected readonly resourceGroup = new THREE.Group();
  protected readonly roofs=new RoofLayer(this.environmentLighting.configure,world=>this.applicationContext?.read(world)?.roofs);
  protected readonly doors=new DoorLayer(this.environmentLighting.configure,this.animationDetail);
  protected readonly timber=new TimberCladdingLayer(this.environmentLighting.configure,this.ownedOpaqueRevisions435?.producer('timber'));
  protected readonly structureGroup = new THREE.Group();
  protected readonly jobGroup = new THREE.Group();
  protected readonly pileGroup = new THREE.Group();
  protected readonly storageGroup = new THREE.Group();
  protected zonesVisible=true;
  protected roofAreasVisible=false;
  protected zoneTarget:number|undefined;
  protected readonly surfaceTint=new GroundSurfaceTint();
  private objectTintSurfaces:readonly GroundOverlayRect[]=EMPTY_GROUND_OVERLAYS;
  private turretTintSurfaces:readonly GroundOverlayRect[]=EMPTY_GROUND_OVERLAYS;
  private groundOverlayInputs:readonly unknown[]=[];
  protected storageTintPlacements:readonly Placement[]=[];
  protected homeTintPlacements:readonly Placement[]=[];
  protected zonesTintDirty=true;
  protected roofTintKey='';
  protected readonly hover: THREE.Mesh;
  protected readonly objectSelection: THREE.Mesh;
  protected selectedObject:MapObjectSelection|undefined;
  protected selectedObjects:readonly MapObjectSelection[]=[];
  protected objectSelectionSignature='';

  protected selectedPawns:ReadonlySet<number>=new Set();
  onSelection: (gesture:SelectionGesture)=>void=()=>{};
  onObjectSelection:(objects:MapObjectSelection[],additive:boolean)=>void=()=>{};
  onHover: (cell:Cell|null)=>void=()=>{};
  onContext: (cell:Cell,x:number,y:number,queue:boolean,targetId?:number)=>void=()=>{};
  onInteractionCancel: ()=>void=()=>{};
  onAudioFrame?: (view: AudioFrameView) => void;
  onFatalError: (message: string) => void = () => {};
  onCompatibilityWarning: (message: string) => void = () => {};
  fatalError?: string;
  compatibilityWarning?: string;
  protected textureDimensionLimit = Infinity;
  protected readonly areaPreview=new AreaPreviewLayer();
  protected readonly turretRange=new RangeOutlineLayer();
  protected readonly constructionPreview=new ConstructionPreviewLayer();
  protected areaIndex: AreaIndex | undefined;
  protected orderTargetIndex: OrderTargetIndex | undefined;
  protected readonly orderRockPreview=new OrderTargetPreviewLayer();
  protected constructionIndex: ConstructionCellIndex | undefined;
  protected areaSignature = '';
  protected areaDrag: ({ pointerId: number; action: AreaAction; from: Cell }
    | { pointerId:number; allowed:boolean; from:Cell }
    | { pointerId: number; kind: LineBuildKind; from: Cell; material?: ConstructionMaterial }) | null = null;
  onArea: (action: AreaAction, from: Cell, to: Cell) => void = () => {};
  onAllowedAreaPaint:(enabled:boolean,from:Cell,to:Cell)=>void=()=>{};
  protected allowedAreaTarget:number|undefined;
  onExitOrder: () => void = () => {};
  onBuildLine: (kind: LineBuildKind, from: Cell, to: Cell, material?: ConstructionMaterial) => void = () => {};
  onAreaPreview: (info: { width: number; height: number; eligible: number; skipped: number; line?: boolean } | null) => void = () => {};
  protected readonly raycaster = new THREE.Raycaster();
  protected readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  protected readonly pointer = new THREE.Vector2();
  protected readonly hit = new THREE.Vector3();

  protected readonly keys = new Set<string>();
  protected readonly pileChunks = new Map<string, VisualChunk>();
  protected readonly staticMaterial = createSurfaceMaterial('diffuse',0xffffff, { vertexColors: true });
  protected readonly terrainPlainMaterial = opaqueGroundExplorationMaterial256(createSurfaceMaterial('diffuse',0xffffff,{vertexColors:true}));
  // Keep texture identity stable: terrain and water can share one GPU image and
  // one shader graph even when a new map or the texture option replaces pixels.
  protected readonly terrainPaintTexture=new THREE.DataTexture(new Uint8Array([255,255,255,0]),1,1);
  protected readonly terrainPaintStaging=new THREE.DataTexture(
    new Uint8Array((3*TERRAIN_PAINT_PIXELS_PER_CELL)**2*4),3*TERRAIN_PAINT_PIXELS_PER_CELL,3*TERRAIN_PAINT_PIXELS_PER_CELL);
  protected readonly terrainPaintPatchSource=new THREE.Box2(new THREE.Vector2(),new THREE.Vector2());
  protected readonly terrainPaintPatchDestination=new THREE.Vector2();
  protected terrainPaintResident=false;
  protected readonly terrainPaintMaterial = opaqueGroundExplorationMaterial256(createSurfaceMaterial('diffuse',0xffffff,{vertexColors:false,map:this.terrainPaintTexture}));
  protected readonly staticPaint=createStylizedSurfaceTexture('vegetation');
  protected readonly texturedStaticMaterial=createSurfaceMaterial('diffuse',0xffffff,{vertexColors:true,map:this.staticPaint});
  protected readonly waterMaterial = material(0xffffff, { vertexColors: true, roughness: 0.45, metalness: 0.08 });
  protected readonly paintedWater=new PaintedWater(this.terrainPaintTexture,this.environmentLighting.configure,this.animationDetail);
  protected readonly clouds=new WeatherCloudLayer(this.animationDetail,this.decorOcclusion);
  protected readonly precipitation=new WeatherPrecipitationLayer(this.animationDetail);
  protected readonly boxes = new BoxBatches(this.environmentLighting.configure,this.ownedOpaqueRevisions435?.producer('box'));
  protected readonly geysers=new GeyserLayer256(this.boxes);
  protected readonly snowSurface=new SnowSurfaceLayer(this.environmentLighting.configure);
  protected readonly recreationHints = new RecreationHints(this.boxes);
  protected readonly resources = new ResourceLayer(this.resourceGroup, this.staticMaterial,this.texturedStaticMaterial,this.animationDetail,{pastelTexture:this.staticPaint,configure:this.environmentLighting.configure});
  protected readonly naturalPresentation = new NaturalResourcePresentation();
  protected readonly preparedNaturalPresentation = new PreparedNaturalPresentation();
  protected readonly sceneResources = new SceneResourceIndex();
  protected readonly crops = new CropLayer(this.staticMaterial,this.texturedStaticMaterial,this.staticPaint);
  protected readonly growing = new GrowingZoneLayer(this.boxes);
  protected readonly allowedAreaLayer=new AllowedAreaLayer(this.boxes);
  protected readonly rocks = new RockLayer(this.environmentLighting.configure);
  protected readonly plants = new PlantClusterLayer(this.staticMaterial,this.texturedStaticMaterial,this.animationDetail,this.staticPaint);
  protected readonly designations:DesignationIconLayer;
  protected readonly daylight: DayNightLayer;
  protected readonly pausedShadow = new PausedShadowCache();
  protected world: World | null = null;
  protected structureKey = '';
  protected jobKey = '';
  protected designationKey = '';
  protected storageKey = '';
  protected readonly furniturePresentation = new FurniturePresentation();
  // The public Core remains RAW. Only the non-exported MAIN subclass creates
  // a preparation owner for its fixed readers; immutableSnapshot is not authority.
  protected createStructurePreparation():SceneStructurePreparation|undefined { return undefined; }
  protected readonly structurePreparation=this.createStructurePreparation();
  protected preparedStructures:ReturnType<SceneStructurePreparation['read']>|undefined;
  protected readonly structureSignature = this.structurePreparation?.signature ?? new StructurePresentationSignature();
  protected readonly storageSignature = new StoragePresentationSignature();
  protected readonly homeSignature = new HomePresentationSignature();
  protected tool = 'select';
  protected treePlacementId:number|undefined;
  setTreePlacement(pileId:number|undefined):void {this.treePlacementId=pileId;this.updateHover();}
  protected furniturePlacement:Structure|undefined;
  setFurniturePlacement(object:Structure|undefined):void {this.furniturePlacement=object;this.updateDeepResources();this.updateHover();}
  protected placementRotation: Orientation = 0;
  protected hoverCell: { x: number; z: number } | null = null;
  protected wallCutaway = false;
  protected grassVisible = true;
  protected texturesEnabled=true;
  protected terrainPaintDirty=true;
  protected terrainGeometryDirty=false;
  protected lastFrame = 0;
  protected snapshotAt = 0;
  protected timeFrom = 0;
  protected timeTo = 0;
  protected snapshotDuration = 120;
  protected disposed = false;
  protected preparing = false;
  protected presentationStopped = false;
  private presentationSuspendedUntilFrame325 = false;
  protected pointerDown: { x: number; y: number; button: number; pointerId: number } | null = null;

  constructor(renderer: THREE.WebGPURenderer, groundGrassEnabled: boolean, protected readonly rendererLifetime: RendererLifetime, protected readonly hostPort:SceneRenderHostPort) {
    this.renderer = renderer; this.ownedOpaqueRevisions435?.attach(renderer,this.scene,this.environmentLighting.exploration.ownedObjectUniforms435(),[this.environmentLighting.map,this.environmentLighting.exploration.map]); this.designations=new DesignationIconLayer(hostPort.loadTexture);
    this.wildlife=new WildlifeLayer(this.environmentLighting.configure,hostPort.loadTexture,this.animationDetail);
    try {
    const lost = renderer.onDeviceLost.bind(renderer);
    renderer.onDeviceLost = info => { lost(info); this.reportFailure(`Périphérique graphique perdu : ${info.message}`); };
    renderer.onError = (info: unknown) => {
      const detail = typeof info === 'object' && info !== null && 'message' in info ? String(info.message) : String(info);
      this.reportFailure(`Erreur du périphérique graphique : ${detail}`);
    };
    this.scene.matrixAutoUpdate = false;
    // WebGPU has selected its HDR/MSAA target before this public callback, but
    // has not begun the scene pass. Composing here avoids an intermediate screen
    // output transform while preserving room -> bundles -> objects draw order.
    this.scene.onBeforeRender = (_renderer, scene, camera) => this.composeRoomBeforeRender(scene, camera);
    this.resources.compiledAttributeChanged435=(attribute,start,count)=>this.staticSceneCompiler435?.patchAttribute(attribute,start,count);
    this.resources.compiledMaterialsChanged435=()=>{this.ownedOpaqueRevisions435?.invalidateResources();this.reconcileStaticCompiler435();};
    this.environmentLighting.configure(this.staticMaterial);
    this.environmentLighting.configure(this.terrainPlainMaterial);
    this.environmentLighting.configure(this.terrainPaintMaterial);
    this.environmentLighting.configure(this.texturedStaticMaterial);
    this.environmentLighting.configure(this.waterMaterial);
    this.terrainPaintTexture.colorSpace=THREE.SRGBColorSpace;
    this.terrainPaintTexture.magFilter=THREE.LinearFilter;
    this.terrainPaintTexture.minFilter=THREE.LinearMipmapLinearFilter;
    this.terrainPaintTexture.generateMipmaps=true;
    this.terrainPaintTexture.wrapS=this.terrainPaintTexture.wrapT=THREE.ClampToEdgeWrapping;
    this.terrainPaintTexture.onUpdate=()=>{this.terrainPaintResident=true;};
    this.terrainPaintTexture.needsUpdate=true;
    this.terrainPaintStaging.colorSpace=THREE.SRGBColorSpace;
    this.terrainPaintStaging.magFilter=THREE.LinearFilter;
    this.terrainPaintStaging.minFilter=THREE.LinearFilter;
    this.terrainPaintStaging.generateMipmaps=false;
    this.terrainPaintStaging.wrapS=this.terrainPaintStaging.wrapT=THREE.ClampToEdgeWrapping;
    // Renderer-owned shared material survives deletion of an individual chunk.
    // Reusing its node graph also avoids compiling a pipeline per tree batch.
    this.staticMaterial.userData.rendererOwned = true;
    this.terrainPlainMaterial.userData.rendererOwned = true;
    this.terrainPaintMaterial.userData.rendererOwned = true;
    this.texturedStaticMaterial.userData.rendererOwned = true;
    this.waterMaterial.userData.rendererOwned = true;
    this.backend = hostPort.backend();
    const context = renderer.getContext() as GPUCanvasContext | WebGL2RenderingContext;
    if ('getConfiguration' in context) {
      const device = context.getConfiguration()?.device;
      // Three deliberately ignores reason=destroyed. Watch our configured
      // device too, so an explicit diagnostic destroy follows the real loss
      // notification path; normal disposal is already guarded by disposed.
      void device?.lost.then(info => this.reportFailure(`Périphérique graphique perdu : ${info.message || info.reason}`));
    }
    this.textureDimensionLimit = 'getConfiguration' in context
      ? context.getConfiguration()?.device.limits.maxTextureDimension2D ?? 1
      : Number(context.getParameter(context.MAX_TEXTURE_SIZE));
    if (!Number.isSafeInteger(this.textureDimensionLimit) || this.textureDimensionLimit < 1) this.textureDimensionLimit = 1;
    renderer.setPixelRatio(Math.min(hostPort.pixelRatio(), 1.8));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.info.autoReset = false;
    hostPort.attachSurface(this.backend);
    this.daylight = new DayNightLayer(this.scene);
    this.invalidatePausedShadow();
    this.landscape.add(this.plants.group,this.overview.group,this.terrainGroup,this.resourceGroup,this.rocks.group);
    this.scene.add(this.mechanoids.group);
    this.scene.add(this.geysers.group);
    this.scene.add(this.deepResources.mesh,this.areaPreview.mesh,this.turretRange.mesh,this.orderRockPreview.mesh,this.landscape,this.pileGroup,this.hygiene.group,this.wind.group,this.wildlife.mesh,this.wildlife.flames,this.animalCargo.group,this.ropes.mesh,this.fires.mesh,this.projectiles.mesh,this.roofs.surface,this.roofs.areas,this.doors.group,this.timber.group,this.crops.group, this.growing.group, this.allowedAreaLayer.group, this.structureGroup, this.jobGroup, this.designations.mesh, this.storageGroup, this.pawns.group,this.clouds.mesh,this.precipitation.mesh);
    if (groundGrassEnabled) {
      this.grass = this.createGrass();
      this.grass.setTerrainPaint(this.terrainPaintTexture);
      this.scene.add(this.grass.mesh);
    }
    this.rig = hostPort.createCamera();
    const hoverMat = new THREE.MeshBasicNodeMaterial({ color: 0xf9ebae, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, forceSinglePass:true });
    // A zero-thickness cursor has no front/back transparency ordering.
    this.hover = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), hoverMat);
    this.hover.rotation.x = -Math.PI / 2;
    this.hover.position.y = 0.08;
    this.hover.visible = false;
    this.hover.renderOrder = GROUND_OVERLAY_RENDER_ORDER.hover;
    const selectionGeometry=new THREE.BufferGeometry();
    // A degenerate resident triangle warms the same position-only selection
    // pipeline under loading, before the first object inspection.
    selectionGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(9),3));
    this.objectSelection = new THREE.Mesh(selectionGeometry,new THREE.MeshBasicNodeMaterial({color:0xfff5d6,side:THREE.DoubleSide,depthTest:false,depthWrite:false,transparent:true,opacity:1,forceSinglePass:true}));
    this.objectSelection.visible=false;this.objectSelection.frustumCulled=false;this.objectSelection.renderOrder=GROUND_OVERLAY_RENDER_ORDER.selection;
    this.scene.add(this.hover,this.constructionPreview.group,this.objectSelection,this.recreationHints.group,this.actionFeedback.group,this.actionVfx.group,this.brawlCloud.group,this.structureVfx.group,this.podRescue.group,this.orbitalDelivery.group,this.startingArrival.group);
    } catch (error) {
      try { this.dispose(); } catch { /* Static create also closes the device. */ }
      throw error;
    }
  }

  /** Idempotent failure entry point, also used by controlled native diagnostics.
   * The main lifecycle pauses the authoritative worker and offers reconstruction. */
  reportFailure(message: string): void {
    if (this.disposed || this.fatalError) return;
    this.fatalError = message;
    this.cancelGraphicsMeasurement('renderer-failed');
    this.renderer.setAnimationLoop(null);
    this.keys.clear();
    if (this.hostPort.selectionReady() && this.rig && this.hover) this.cancelDesignation();
    this.onFatalError(message);
  }

  /** Only callable in development diagnostics. Targets this canvas's actual
   * device/context; never requests or destroys a separate/shared adapter. */
  requestDeviceLossForDiagnostics(): boolean {
    if (!import.meta.env.DEV || this.disposed || this.fatalError) return false;
    const context = this.renderer.getContext() as GPUCanvasContext | WebGL2RenderingContext;
    if ('getConfiguration' in context) {
      const device = context.getConfiguration()?.device;
      if (!device) return false;
      device.destroy(); return true;
    }
    const extension = context.getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext(); return true;
  }

  protected createGrass(): GpuGroundGrassLayer {
    return new GpuGroundGrassLayer(this.environmentLighting.configure, this.textureDimensionLimit, message => {
      this.compatibilityWarning = message;
      this.onCompatibilityWarning(message);
    },this.surfaceTint,this.environmentLighting.configureGrounded,this.animationDetail);
  }

  /** Admissions continue under their original guards while RAF is absent. */
  suspendUntilNextFrame(): void {
    if(this.disposed||this.fatalError||this.presentationStopped)return;
    this.presentationSuspendedUntilFrame325=true;
  }

  /** Only an actual MAIN frame resumes poses from the latest confirmed input. */
  resumeAfterFrameStarvation(): void {
    if(!this.presentationSuspendedUntilFrame325)return;
    this.presentationSuspendedUntilFrame325=false;
    this.visibilityChanged();
  }

  /** Freeze the last prepared scene after a source fault. No World or Native owner is re-admitted. */
  stopPresentation(): void {
    this.cancelGraphicsMeasurement('presentation-stopped');
    this.presentationStopped = true; this.lastFrame = 0; this.keys.clear();
  }

  setWorld(world: World, resetPresentation = false, speed = 1, tracks?: PawnTrack[], immutableSnapshot = false, coreInput297?:object, deferCalmFull297 = false): void {
    if(this.disposed || this.fatalError)return;
    try {
    const coreInput=readNativeCorePhaseInput297(coreInput297);
    if(coreInput297&&(!coreInput||coreInput.kind!=='full'||coreInput.world!==world))throw Error('Invalid Native Full phase owner');
    if(isCorePhysicalSchema297(Number(world.schemaVersion))&&!coreInput)throw Error('Current297 renderer requires its Native Full owner');
    if(this.presentationStopped){if(!resetPresentation)return;this.presentationStopped=false;}
    if(coreInput)this.coreFullInputs297.set(world,coreInput);
    const at=coreInput?coreInput.core/10:world.tick;
    const previous=this.received?.world;
    const reset=resetPresentation||!previous||world.tick<previous.tick||world.seed!==previous.seed||world.width!==previous.width||world.height!==previous.height;
    const previousCore=previous&&this.coreFullInputs297.get(previous),ownerChanged=!!coreInput&&!!previousCore&&(coreInput.anchor.epoch!==previousCore.anchor.epoch||coreInput.anchor.mapId!==previousCore.anchor.mapId);
    const calm=deferCalmFull297===true&&!!coreInput&&!reset&&!ownerChanged&&speed>0&&!!tracks;
    if(!calm)this.releaseCalmFullFrame297();
    this.invalidatePausedShadow(reset);
    if(reset){
      this.pendingCore297.length=0;this.latestCoreInput297=undefined;this.appliedCoreAnchor297=undefined;this.appliedCore297=-Infinity;this.actorScene297=undefined;
      this.presentation.clear();this.confirmedJobMarkers.clear();this.confirmedJobsSource=undefined;
      this.presentedIntentFields=undefined;this.confirmedSurfaceDirty=true;this.confirmedPathDirty=true;
    }
    if(this.confirmedIntentReader?.admit){
      const intents=this.confirmedIntentReader.admit(world);
      if(intents!==this.confirmedIntents||reset){this.confirmedIntents=intents;this.confirmedIntentsDirty=true;}
    }
    this.received={world,speed,tracks,immutableSnapshot,coreInput297};
    if(this.holdSurfaceWorld){
      this.pendingSurfaceWorld={world,reset:reset||(this.pendingSurfaceWorld?.reset??false)};
      // A newly admitted authentic Full contains the complete actor frontier
      // for its anchor. Older-anchor phases cannot be presented after it.
      if(coreInput){const retained=this.pendingCore297.filter(input=>input.anchor===coreInput.anchor);this.pendingCore297.splice(0,this.pendingCore297.length,...retained);}
    }
    this.immutableSnapshot=immutableSnapshot;
    if(immutableSnapshot)this.immutableWorlds.add(world);else this.immutableWorlds.delete(world);
    if(coreInput)this.projectiles.adoptPhase297(coreInput,reset);else this.projectiles.adopt(world,reset);
    if(this.presentationSuspendedUntilFrame325||this.hostPort.hidden())return;
    if(tracks){this.timeline.adopt(at,speed,tracks,this.hostPort.now(),reset||!this.hasTracks,!!this.applicationContext&&immutableSnapshot,!!coreInput);this.hasTracks=true;}
    if(this.holdSurfaceWorld){
      if(speed===0&&!tracks&&this.hasTracks)this.timeline.adopt(at,0,[],this.hostPort.now(),reset,!!this.applicationContext&&immutableSnapshot,!!coreInput);
      this.presentation.clear();this.applyWorld(world,reset);return;
    }
    if(speed===0){
      // This World has already been received/admitted. Pause presents this
      // confirmed state now, bypassing only the scene's old playout/5Hz queue.
      if(!tracks&&this.hasTracks)this.timeline.adopt(at,0,[],this.hostPort.now(),reset,!!this.applicationContext&&immutableSnapshot,!!coreInput);
      this.presentation.clear();this.applyWorld(world,reset);this.presentCorePhases297();return;
    }
    if(reset||!tracks){if(!reset)this.presentation.clear();this.applyWorld(world,reset);return;}
    if(calm){
      if(!this.calmFullFrame297)this.calmFullFrame297={frame:this.presentationFrame297+1,anchor:coreInput!.anchor};
      this.hasCalmFrameGates297=true;
    }
    this.presentation.push(world,at,calm?this.calmFullFrame297!.frame:undefined);
    // A background/stalled page must not retain an unlimited snapshot history.
    // Recovery replaces the whole presentation, never only one actor's path.
    if(this.presentation.size>64||at-this.timeline.tick>MOTION_HISTORY_TICKS){this.releaseCalmFullFrame297();this.presentation.clear();this.timeline.adopt(at,speed,tracks,this.hostPort.now(),true,!!this.applicationContext&&immutableSnapshot,!!coreInput);this.applyWorld(world,true);return;}
    if(calm)return;
    const due=this.presentation.take(this.timeline.tick,coreInput?undefined:this.hostPort.now());if(due)this.applyWorld(due);
    } catch (error) {
      this.reportFailure(`Adoption de l’affichage interrompue : ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  protected applyWorld(world: World, resetPresentation = false): void {
    if(this.holdSurfaceWorld){this.pendingSurfaceWorld={world,reset:resetPresentation||(this.pendingSurfaceWorld?.reset??false)};return;}
    const phase=this.coreFullInputs297.get(world);this.appliedCoreAnchor297=phase?.anchor;this.appliedCore297=phase?.core??-Infinity;this.actorScene297=phase?.actorScene;
    const calm=this.calmFullFrame297;if(calm&&phase?.anchor.epoch===calm.anchor.epoch&&phase.anchor.mapId===calm.anchor.mapId&&phase.anchor.revision>=calm.anchor.revision)this.calmFullFrame297=undefined;
    this.ownedOpaqueRevisions435?.setEnabled(!!this.applicationContext&&this.immutableWorlds.has(world));this.ownedOpaqueRevisions435?.invalidateResources();
    if(!this.immutableWorlds.has(world))this.applicationContext?.clear();
    ownActorPlaybackWorld435(world,!!this.applicationContext&&this.immutableWorlds.has(world));
    try{withPileSurfaceReads(()=>this.applyWorldWithinSurfaceReads(world,resetPresentation),this.applicationContext?.readSupports);if(this.applicationContext?.read(world))this.applicationContext.commit(world);}
    catch(error){this.applicationContext?.abort();throw error;}
  }

  private applyWorldWithinSurfaceReads(world: World, resetPresentation = false): void {
    if (this.disposed) return;
    this.invalidatePausedShadow(resetPresentation);
    if (resetPresentation) this.cancelDesignation();
    this.areaIndex = undefined; this.constructionIndex = undefined; this.areaSignature = '';
    this.orderTargetIndex=undefined;
    const now = this.hostPort.now();
    const previousWorld = this.world;
    // Worker deltas keep immutable terrain/resources references stable. A changed
    // collection is inspected once; ordinary pawn snapshots do not scan the map.
    const newMap = !previousWorld||previousWorld.seed!==world.seed||previousWorld.width!==world.width||previousWorld.height!==world.height||previousWorld.scenario?.id!==world.scenario?.id||previousWorld.scenario?.revision!==world.scenario?.revision||
      previousWorld.site?.hilliness!==world.site?.hilliness||previousWorld.site?.revision!==world.site?.revision||previousWorld.site?.biome!==world.site?.biome;
    const changedTiles=terrainTileChanges(previousWorld,world,!!previousWorld&&this.immutableWorlds.has(previousWorld)&&this.immutableWorlds.has(world));
    if(newMap)this.mechanoids.reset();
    const terrainChanges=terrainSurfaceChanges(previousWorld,world,changedTiles);
    // External setWorld callers may mutate tile collections in place. Only
    // decoder snapshots promise identity-stable unchanged tiles.
    const immutableTileChanges=this.immutableSnapshot?changedTiles??undefined:undefined;
    const groundChanged=terrainChanges===null||terrainChanges.length>0;
    if(this.confirmedIntents&&(groundChanged||newMap||!!previousWorld?.snow!==!!world.snow||changedTiles===null||changedTiles.length>0))this.confirmedSurfaceDirty=true;
    if (newMap) {this.cancelDesignation();this.shadowRefresh.invalidate();}
    // The worker epoch distinguishes a checkpoint from an ordinary delta even
    // if terrain content and simulation tick match a previous session.
    const resetPoses = resetPresentation || newMap || world.tick < (previousWorld?.tick ?? 0);
    if(resetPoses)this.animationDetail.reset();
    // Advance memberships only for the World actually applied to the scene.
    // The journal/full capture establishes the context; a public flag alone
    // cannot certify a sparse traversal or cross a missing publication.
    const resourceFrame = this.immutableWorlds.has(world) ? this.sceneResources.adopt(world,resetPoses) : undefined;
    if(!resourceFrame)this.sceneResources.clear();
    const application=this.immutableWorlds.has(world)?this.applicationContext?.prepare(world,resetPoses,changedTiles,resourceFrame):undefined;
    this.world = world;
    this.paintedWater.adoptRiverWater(world);
    if(this.environmentLighting.exploration.adopt(world,newMap||resetPoses,previousWorld&&this.immutableWorlds.has(previousWorld)&&this.immutableWorlds.has(world)?changedTiles:null))this.invalidatePausedShadow();
    if (newMap) { this.configureDiorama(); this.configureRoom(); }
    this.updateDeepResources();
    this.grass?.update(world,newMap,immutableTileChanges,resourceFrame);
    this.fires.adopt(world,newMap);this.wind.adopt(world,newMap);
    this.environmentLighting.update(world);
    this.snowSurface.update(world,newMap,immutableTileChanges);
    if(!this.snowSurface.group.parent)this.scene.add(this.snowSurface.group);
    if(groundChanged) {
      if(terrainChanges===null||this.terrainPaintDirty)this.terrainPaintDirty=true;
      else if(this.texturesEnabled){
        const rect=this.terrainPaintResident?singleTerrainPaintPatchRect(world,terrainChanges):null;
        patchTerrainPaintTexture(this.terrainPaintTexture,world,terrainChanges,rect!==null);
        if(rect)this.uploadTerrainPaintPatch(rect);
        else this.terrainPaintResident=false;
      }
      else this.terrainPaintDirty=true;
      if(this.texturesEnabled)this.refreshTerrainPaint(world);
      const waterTopologyChanged=terrainChanges===null||terrainChanges.some(i=>isWaterTerrain(terrainPresentationType(previousWorld!,i))!==isWaterTerrain(terrainPresentationType(world,i)));
      if(this.texturesEnabled&&!waterTopologyChanged){
        // Painted terrain reads its colour from the map. A soil/grass/stone
        // change does not alter its quad or bank geometry. Keep the plain
        // vertex colours marked dirty for a later texture-off switch.
        this.terrainGeometryDirty=true;
      }else{
        buildTerrain(world,this.terrainGroup,this.texturesEnabled?this.terrainPaintMaterial:this.terrainPlainMaterial,this.texturesEnabled?this.paintedWater.material:this.waterMaterial,this.texturesEnabled);
        this.overview.rebuildTerrain(this.terrainGroup);
        this.terrainGeometryDirty=false;
      }
    }
    this.rocks.update(world,newMap,immutableTileChanges);
    if(!this.rocks.group.parent)this.scene.add(this.rocks.group);
    if (newMap) {
      this.boxes.clear();
      this.clouds.configureMap(world.width, world.height);
      this.precipitation.configureMap(world.width, world.height);
      this.paintedWater.reset();
      this.rig.configureMap(world.width, world.height, world.scenario?.landing);
      this.daylight.configureShadow(world.width, world.height);
      this.resize();
    }
    this.hygiene.update(world,this.boxes,newMap);
    if (previousWorld?.resources !== world.resources || newMap || this.preparedNaturalPresentation.hasFrameChange(world) || this.preparedNaturalPresentation.active&&!this.immutableWorlds.has(world) || Math.floor(previousWorld.tick / 25) !== Math.floor(world.tick / 25)) this.updateResources(world, newMap,resourceFrame);
    const packageKey=(world.packed??[]).filter(p=>p.owner.type==='ground').map(p=>`${p.building.id}:${p.building.material}:${p.owner.type==='ground'?`${p.owner.x}:${p.owner.z}`:''}`).join('|');
    if(this.confirmedIntents)this.roofs.updatePhysical(world,this.wallCutaway,newMap);
    else this.roofs.update(world,this.boxes,this.wallCutaway,newMap);
    if(this.roofAreasVisible){const key=`${(world.roofing?.build??[]).join(',')};${(world.roofing?.remove??[]).join(',')}`;
      if(key!==this.roofTintKey||newMap){this.roofTintKey=key;this.zonesTintDirty=true;}}
    const prepared=this.preparedStructures=application?.structures??this.structurePreparation?.read(world,resetPoses);
    if(prepared)this.doors.updateNative(world,this.wallCutaway,resetPoses,prepared.doors,prepared.axes,prepared.gateAxes);
    else this.doors.update(world,this.wallCutaway,resetPoses);
    const structureKey = prepared
      ? this.structurePreparation!.signature.readConfirmed(world.structures,prepared.axesKey,packageKey,prepared.indices,resetPoses)
      : this.structureSignature.read(world.structures,[...doorOrientations(world)].join(':'),packageKey,resetPoses);
    if (structureKey !== this.structureKey || newMap) { this.structureKey = structureKey; this.buildStructures(world); }
    if(this.geysers.adopt(world,newMap))this.invalidatePausedShadow();
    this.turretTops.update(world,this.structureGroup,this.boxes,resetPoses);
    // Quantize presentation of progression to avoid rebuilding static meshes for
    // every work tick. Saved simulation progress remains exact and authoritative.
    const jobKey = world.jobs.filter(j=>j.kind!=='fix-breakdown').map((j) => `${j.id}:${j.kind}:${j.floor}:${j.material}:${j.x}:${j.z}:${j.orientation}:${j.footprint}:${j.status}:${j.construction}:${j.escrow.wood}:${j.kind === 'mine' || j.kind === 'chop' || j.kind === 'harvest' || j.kind === 'cut' || j.kind === 'sow' || j.kind === 'deconstruct' || j.kind==='repair' ? 0 : Math.floor(j.progress / jobDuration(world,j) * 20)}${j.wallDoor296?`:wall-door:${j.wallDoor296.manual}:${j.wallDoor296.plan?.id}:${j.wallDoor296.plan?.kind}:${j.wallDoor296.plan?.material}`:''}`).join('|');
    const jobsChanged=jobKey!==this.jobKey||newMap||resetPoses;
    if (jobsChanged) { this.jobKey = jobKey; this.buildJobs(world); }
    // Chunk permissions and unscheduled roof intentions have no Job. Check
    // their small primitive signature at adoption, never in the RAF loop.
    const designationKey=`fog:${this.environmentLighting.exploration.field.revision};`+world.piles.filter(p=>p.kind==='chunk'&&p.haulRequested&&p.owner.type==='ground')
      .map(p=>p.owner.type==='ground'?`${p.id}:${p.owner.x}:${p.owner.z}`:'').join('|')
      +`;${world.roofing?.build.join(',')};${world.roofing?.remove.join(',')};${application?.roofs.roofKey??roofCoverage(world).join(',')};${world.roofing?.natural?.thin.join(',')};${world.roofing?.natural?.thick.join(',')}`;
    if(jobsChanged||designationKey!==this.designationKey){this.designationKey=designationKey;if(this.confirmedIntents)this.confirmedDesignationsDirty=true;else this.designations.update(world);}
    if(resetPoses)this.homeSignature.clear();
    const residentStorage = this.immutableWorlds.has(world);
    const homeKey = residentStorage ? this.homeSignature.readResident(world) : this.homeSignature.read(world.home);
    const stockpileKey = residentStorage ? this.storageSignature.readResident(world,resetPoses) : this.storageSignature.read(world.stockpiles,resetPoses);
    const storageKey = `${homeKey};${stockpileKey};snow:${world.snowClearArea?.join(',')??''};surface:${!!world.snow}`;
    if (storageKey !== this.storageKey || newMap || groundChanged) { this.storageKey = storageKey; this.buildStorage(world); }
    if (newMap || previousWorld?.resources !== world.resources || this.crops.hasPreparedFrameChange(world) || Math.floor((previousWorld?.tick ?? -1) / 25) !== Math.floor(world.tick / 25)) this.crops.update(world, newMap, this.immutableWorlds.has(world),resourceFrame);
    const zoneChanged=this.updateGrowingZones(newMap);
    if(this.allowedAreaLayer.updateIntents(world,this.confirmedIntents?this.confirmedIntents.allowedAreas:world.allowedAreas,this.allowedAreaTarget,newMap,this.confirmedIntents?i=>knownCell256(world,i):undefined))this.zonesTintDirty=true;
    if(zoneChanged||newMap)this.zonesTintDirty=true;
    this.pawns.adoptCargo(previousWorld??undefined,world,this.hasTracks?this.timeline.tick:world.tick,
      !resetPoses&&this.hasTracks&&(this.received?.speed??0)>0);
    this.updatePiles(world, newMap);
    const paused=this.received?.world===world&&this.received.speed===0;
    const oldBlend = this.pawns.blend.value;
    this.snapshotDuration = !paused && previousWorld && world.tick >= previousWorld.tick ? Math.min(200, Math.max(70, now - this.snapshotAt)) : 0;
    this.snapshotAt = now;
    this.timeFrom = resetPoses||paused ? world.tick / TICKS_PER_SECOND : this.pawns.time.value;
    this.timeTo = world.tick / TICKS_PER_SECOND;
    this.pawns.blend.value = resetPoses||paused ? 1 : 0;
    this.pawns.update(world, resetPoses||paused ? 1 : oldBlend, resetPoses);
    this.actionVfx.update(world,this.pawns.feedbackSource!);
    this.brawlCloud.update(world,this.pawns.feedbackSource!);
    if(prepared)this.structureVfx.adoptNative(world,newMap,prepared.axes,prepared.effects);
    else this.structureVfx.adopt(world,newMap);
    this.podRescue.adopt(world);this.orbitalDelivery.adopt(world);
    if(this.startingArrival.adopt(world,resetPoses))this.invalidatePausedShadow();
    this.resources.adoptChopWork(previousWorld??undefined,world,resetPoses,resourceFrame);
    this.actionFeedback.update(world,this.selectedPawns,this.pawns.feedbackSource!,!!this.confirmedIntents);
    this.wildlife.update(world,this.hasTracks?this.timeline:undefined,resetPoses,this.pawns);
    this.queuePausedTreeTextures();
    this.animalCargo.update(world,this.hasTracks?this.timeline:undefined,resetPoses);
    this.mechanoids.update(world,this.hasTracks?this.timeline:undefined,resetPoses,this.pawns);
    this.graphicsStyle.flushPaint();
    this.ropes.adopt(world,resetPoses);
    this.landscape.refresh(this.backend==='WebGPU'&&this.overview.group.visible);
    if(this.selectedObject?.kind!=='growing'||zoneChanged)this.updateSelectedObject();
    this.confirmedPathDirty=!!this.confirmedIntents;
    this.presentConfirmedIntents();
    this.refreshZonesTint();
    this.environmentLighting.exploration.bind(this.scene);
    this.updateHover();
    this.reconcileStaticCompiler435();
  }

  setFloorSelection(floor:BuildableFloorKind|undefined):void {
    if(floor!==this.selectedFloor)this.cancelDesignation();this.selectedFloor=floor;this.updateHover();
  }
  setConstructionMaterial(value:ConstructionMaterial|undefined):void {
    if (this.constructionMaterial!==value && this.areaDrag) this.cancelDesignation();
    this.constructionMaterial=value;this.updateHover();
  }

  setTool(tool: string): void {
    if (tool !== this.tool) this.cancelDesignation();
    const homeBefore=['home','remove-home','snow-clear','remove-snow-clear'].includes(this.tool);
    this.tool = tool;
    if(tool!=='replant-tree')this.treePlacementId=undefined;
    this.updateDeepResources();
    this.updateGrowingZones(false);
    if(this.world&&(homeBefore||['home','remove-home','snow-clear','remove-snow-clear'].includes(tool)))this.buildStorage(this.world);
    if (tool in STRUCTURE_DEFINITIONS) this.keys.delete('q');
    const color = tool === 'cancel' ? 0xe6876a : tool === 'select' ? 0xf9ebae : 0x9dd9ca;
    (this.hover.material as THREE.MeshBasicNodeMaterial).color.setHex(color);
    this.hostPort.cursor(tool === 'select' ? 'default' : 'crosshair');
    this.refreshZonesTint();
    this.environmentLighting.exploration.bind(this.scene);
    this.updateHover();
  }

  setPlacementRotation(orientation: Orientation): void {
    this.placementRotation = orientation;
    this.updateHover();
  }

  /** A gesture is an uncommitted intention. Losing focus, changing tools/maps or
   * pressing Escape must never submit it later through a stray pointerup.
   */
  cancelDesignation(): boolean {
    const selecting=this.hostPort.cancelSelection();this.onInteractionCancel();
    const drag = this.areaDrag;
    this.areaDrag = null; this.pointerDown = null; this.areaSignature = ''; this.hoverCell = null;
    this.constructionIndex = undefined;
    this.onHover(null);
    this.controls.enabled = true;
    if (drag) this.hostPort.releasePointer(drag.pointerId);
    this.areaPreview.hide();
    this.surfaceTint.clearPreview();
    this.designations.clearPreview();
    this.clearOrderTargets();
    this.constructionPreview.hide();
    this.recreationHints.hide();
    this.turretRange.hide();this.turretPreviewVisible=false;this.turretPreviewSignature='';this.turretTintSurfaces=EMPTY_GROUND_OVERLAYS;
    this.hover.visible = false;
    (this.hover.material as THREE.MeshBasicNodeMaterial).opacity = 0.55;
    this.onAreaPreview(null);
    this.refreshGroundOverlays();
    return drag !== null || selecting;
  }

  protected invalidatePausedShadow(urgent=true):void {
    this.pausedShadow.invalidate();
    if(urgent)this.shadowRefresh.invalidate();
    const shadow=(this.room?.lighting.shadowLight ?? this.daylight.light).shadow;
    shadow.autoUpdate=true;
    shadow.needsUpdate=true;
  }

  /** Presentation only: hidden wall volume remains blocked in the simulation. */
  setRoofsVisible(visible:boolean):void {if(this.roofs.surface.visible!==visible)this.invalidatePausedShadow();this.roofs.surface.visible=visible;}
  /** Switch resident material graphs. The plain variants contain no texture
   * sampling node; no image or per-frame CPU work is involved while disabled. */
  setTexturesEnabled(enabled:boolean):void {
    this.ownedOpaqueRevisions435?.invalidateResources();
    if(this.texturesEnabled===enabled)return;
    this.invalidatePausedShadow();
    this.texturesEnabled=enabled;
    if (this.dioramaEnabled || this.roomEnabled) this.diorama?.setTexturesEnabled(enabled);
    this.room?.setTexturesEnabled(enabled);
    if(enabled&&this.world)this.refreshTerrainPaint(this.world);
    if(!enabled)this.releaseTerrainPaint();
    if(!enabled&&this.world&&this.terrainGeometryDirty){
      buildTerrain(this.world,this.terrainGroup,this.terrainPlainMaterial,this.waterMaterial);
      this.overview.rebuildTerrain(this.terrainGroup);
      this.terrainGeometryDirty=false;
    }
    const oldTerrain=enabled?this.terrainPlainMaterial:this.terrainPaintMaterial;
    const nextTerrain=enabled?this.terrainPaintMaterial:this.terrainPlainMaterial;
    const oldWater=enabled?this.waterMaterial:this.paintedWater.material;
    const nextWater=enabled?this.paintedWater.material:this.waterMaterial;
    for(const child of this.terrainGroup.children)if(child instanceof THREE.Mesh&&child.material===oldTerrain)child.material=nextTerrain;
    for(const child of this.terrainGroup.children)if(child instanceof THREE.Mesh&&child.material===oldWater)child.material=nextWater;
    if(this.world){
      syncTerrainPaintUvs(this.world,this.terrainGroup,nextTerrain,enabled,nextWater);
      this.overview.setTerrainMaterial(oldTerrain,nextTerrain,this.world,enabled);
      this.overview.setTerrainMaterial(oldWater,nextWater,this.world,enabled);
    }
    this.boxes.setTexturesEnabled(enabled);
    this.timber.setTexturesEnabled(enabled);
    this.doors.setTexturesEnabled(enabled);
    this.roofs.setTexturesEnabled(enabled);
    this.resources.setTexturesEnabled(enabled);
    this.crops.setTexturesEnabled(enabled);
    this.plants.setTexturesEnabled(enabled);
    this.rocks.setTexturesEnabled(enabled);
    this.overview.setTexturesEnabled(enabled);
    this.pawns.setTexturesEnabled(enabled);
    this.wildlife.setTexturesEnabled(enabled);
    this.queuePausedTreeTextures();
    this.fires.setTexturesEnabled(enabled);
    this.clouds.setTexturesEnabled(enabled);
    this.grass?.setTexturesEnabled(enabled);
    this.podRescue.setTexturesEnabled(enabled);this.orbitalDelivery.setTexturesEnabled(enabled);
    this.startingArrival.setTexturesEnabled(enabled);
    this.environmentLighting.exploration.bind(this.scene);
    this.landscape.needsUpdate=true;
    this.reconcileStaticCompiler435();
  }
  protected refreshTerrainPaint(world:World):void {
    if(!this.terrainPaintDirty)return;
    const baked=createTerrainPaintTexture(world);
    if(this.terrainPaintTexture.image.width!==baked.image.width||this.terrainPaintTexture.image.height!==baked.image.height)this.terrainPaintTexture.dispose();
    this.terrainPaintTexture.image=baked.image;
    this.terrainPaintTexture.userData.terrainPalette=baked.userData.terrainPalette;
    this.terrainPaintResident=false;
    this.terrainPaintTexture.needsUpdate=true;
    this.terrainPaintDirty=false;
    this.grass?.setTerrainPaint(this.terrainPaintTexture);
  }
  protected uploadTerrainPaintPatch(rect:TerrainPaintPatchRect):void {
    const atlas=this.terrainPaintTexture.image;
    const staging=this.terrainPaintStaging.image;
    copyTerrainPaintRect(atlas.data as Uint8Array,atlas.width,rect,staging.width,staging.data as Uint8Array);
    this.terrainPaintStaging.needsUpdate=true;
    this.terrainPaintPatchSource.min.set(0,0);
    this.terrainPaintPatchSource.max.set(rect.width,rect.height);
    this.terrainPaintPatchDestination.set(rect.x,rect.y);
    // Three 0.186 ignores DataTexture updateRanges in WebGPU and its WebGL
    // fallback. The public copy API transfers only this staging image and
    // regenerates the atlas mipmaps; the resident atlas version stays intact.
    this.renderer.copyTextureToTexture(this.terrainPaintStaging,this.terrainPaintTexture,this.terrainPaintPatchSource,this.terrainPaintPatchDestination);
  }
  protected releaseTerrainPaint():void {
    this.grass?.setTerrainPaint(null);
    this.terrainPaintResident=false;
    this.terrainPaintTexture.dispose();
    this.terrainPaintTexture.image={data:new Uint8Array([255,255,255,0]),width:1,height:1};
    delete this.terrainPaintTexture.userData.terrainPalette;
    this.terrainPaintTexture.needsUpdate=true;
    this.terrainPaintDirty=true;
  }
  /** A disabled decorative grass layer owns no mesh, texture, shader or map
   * update path. Re-enable lazily from the current immutable world snapshot. */
  setGroundGrassEnabled(enabled: boolean): void {
    if (this.disposed || enabled === Boolean(this.grass)) return;
    this.invalidatePausedShadow();
    if (!enabled) {
      this.grass!.mesh.removeFromParent();
      this.grass!.dispose();
      this.grass = null;
      return;
    }
    this.grass = this.createGrass();
    this.grass.setTexturesEnabled(this.texturesEnabled);
    this.grass.setTerrainPaint(this.texturesEnabled?this.terrainPaintTexture:null);
    this.scene.add(this.grass.mesh);
    if (this.world) this.grass.update(this.world, true);
  }
  setRoofAreasVisible(visible:boolean):void {
    this.roofAreasVisible=visible;if(!this.preparing)this.roofs.areas.visible=visible&&this.zonesVisible;
    this.zonesTintDirty=true;this.refreshZonesTint();
  }
  setDecorOcclusion(enabled:boolean):void {
    if(!this.decorOcclusion.setEnabled(enabled))return;
    this.room?.invalidateDecorOcclusion();
  }

  setDioramaEnabled(enabled: boolean): void {
    if (this.disposed || this.dioramaEnabled === enabled) return;
    this.dioramaEnabled = enabled;
    this.animationDetail.invalidate(this.skyAnimation);
    if (!enabled && !this.roomEnabled) { this.diorama?.group.removeFromParent(); return; }
    this.configureDiorama();
  }

  /** The disabled branch owns no room scene, lights, render target or update work. */
  setRoomEnabled(enabled: boolean): void {
    if (this.disposed || this.roomEnabled === enabled) return;
    this.roomEnabled = enabled;
    this.animationDetail.invalidate(this.skyAnimation);
    // Retained WebGPU commands own their compiled light/shadow nodes. Rebuild
    // them when the emitter set changes, before replay can reach a freed atlas.
    this.landscape.needsUpdate = true;
    if (!enabled) {
      this.armedRoom = null;
      this.room?.dispose(); this.room = null;
      this.daylight.setExternalLighting(false);
      if (!this.dioramaEnabled) { this.diorama?.dispose(); this.diorama = null; }
    } else { this.configureDiorama(); this.configureRoom(); }
    this.rig.setRoomEnabled?.(enabled);
    this.invalidatePausedShadow();
  }

  setLightingSettings(settings: LightingSettings): void {
    this.ownedOpaqueRevisions435?.invalidateResources();
    this.lightingSettings = parseLightingSettings(settings);
    this.daylight.setSettings(this.lightingSettings);
    this.room?.setSettings(this.lightingSettings);
    this.animationDetail.invalidate(this.skyAnimation);
    this.invalidatePausedShadow();
  }

  setShadowSettings(settings: ShadowSettings): void {
    this.ownedOpaqueRevisions435?.invalidateResources();
    const next=parseShadowSettings(settings);
    // The native backend owns the allocation and resizing of the one atlas.
    const supported=[4096,2048,1024,512].find(size=>size<=this.textureDimensionLimit)??512;
    next.resolution=Math.min(next.resolution,supported) as ShadowSettings['resolution'];
    this.shadowSettings=next;this.shadowRefresh.setSettings(next);
    this.daylight.setShadowSettings(next);this.room?.setShadowSettings(next);
    this.invalidatePausedShadow();
  }

  setAnimationSettings(settings: AnimationSettings): void {
    this.animationDetail.setSettings(parseAnimationSettings(settings));
    this.invalidatePausedShadow();
  }

  private configureRoom(): void {
    if (!this.roomEnabled || !this.world) return;
    this.room ??= new RoomLayer(this.scene,this.decorOcclusion);
    this.room.configure(this.world.width, this.world.height, this.world.seed);
    this.room.setSettings(this.lightingSettings);
    this.room.setShadowSettings(this.shadowSettings);

    this.room.setTexturesEnabled(this.texturesEnabled);
    this.daylight.setExternalLighting(true);
    this.rig.setRoomEnabled?.(true);
  }

  private configureDiorama(): void {
    if ((!this.dioramaEnabled && !this.roomEnabled) || !this.world) return;
    this.diorama ??= new DioramaLayer(this.hostPort.loadTexture);
    this.diorama.configure(this.world.width, this.world.height, this.texturesEnabled,
      this.world.seed, this.world.site?.biome ?? 'temperate-forest');
    this.scene.add(this.diorama.group);
    this.diorama.setBoxVisible(this.dioramaEnabled);
    if (this.dioramaEnabled) this.diorama.presentSky(this.daylight.sample.y);
    this.diorama.present(this.camera, this.controls.target, this.rig.span);
  }
  setZonesVisible(visible:boolean):void {
    if(this.zonesVisible===visible)return;this.zonesVisible=visible;
    if(!this.preparing){this.storageGroup.visible=this.growing.group.visible=this.allowedAreaLayer.group.visible=visible;this.roofs.areas.visible=visible&&this.roofAreasVisible;}
    this.zonesTintDirty=true;this.refreshZonesTint();this.updateSelectedObject();
  }
  setAllowedAreaTarget(id:number|undefined):void {
    this.allowedAreaTarget=id;this.areaSignature='';
    if(this.world&&this.allowedAreaLayer.updateIntents(this.world,this.confirmedIntents?this.confirmedIntents.allowedAreas:this.world.allowedAreas,id,false,this.confirmedIntents?i=>knownCell256(this.world!,i):undefined)){this.zonesTintDirty=true;this.refreshZonesTint();}this.updateHover();
  }
  setZoneTarget(id:number|undefined):void {
    if(this.zoneTarget===id)return;this.zoneTarget=id;this.areaSignature='';this.updateHover();
  }
  private zoneTargetCommand(action:string):{targetZoneId?:number} {
    return this.zoneTarget!==undefined&&['stockpile','growing','remove-stockpile','remove-growing'].includes(action)?{targetZoneId:this.zoneTarget}:{};
  }
  private refreshZonesTint():void {
    const world=this.world;if(!world||!this.zonesTintDirty)return;this.zonesTintDirty=false;
    this.surfaceTint.setZones(world.width,world.height,[{placements:this.storageTintPlacements,opacity:ZONE_FILL_OPACITY},
      {placements:this.growing.surfaces,opacity:ZONE_FILL_OPACITY},{placements:this.allowedAreaLayer.surfaces,opacity:ZONE_FILL_OPACITY},{placements:this.homeTintPlacements,opacity:.28}],this.zonesVisible);
    this.refreshGroundOverlays();
  }
  setWallCutaway(enabled: boolean): void {
    if (this.wallCutaway === enabled) return;
    this.invalidatePausedShadow();
    this.wallCutaway = enabled;
    if (this.world) { this.confirmedIntents?this.roofs.updatePhysical(this.world,this.wallCutaway):this.roofs.update(this.world,this.boxes,this.wallCutaway);this.confirmedIntentsDirty=!!this.confirmedIntents;this.buildStructures(this.world); this.buildJobs(this.world); }
    this.areaSignature='';this.updateHover();
  }

  /** Hide canopies for inspection while retaining trunks and all game rules. */
  setFoliageVisible(visible: boolean): void {
    if(this.grassVisible!==visible)this.invalidatePausedShadow();
    this.grassVisible=visible;
    if(!visible&&this.grass){this.grass.mesh.visible=false;this.grass.mesh.geometry.instanceCount=0;}
    this.resources.setFoliageVisible(visible);
    this.overview.setFoliageVisible(visible);
    this.landscape.needsUpdate = true;
    this.reconcileStaticCompiler435();
  }

  get cameraMode(): CameraMode { return this.rig.mode; }
  get audioFocus(): { x: number; z: number } { return { x: this.controls.target.x, z: this.controls.target.z }; }

  /** Warm both projections and resident LOD variants under the loading screen.
   * Do not defer the first overview pipeline to the player's first wheel zoom. */
  async preparePresentation(): Promise<void> {
    if (this.fatalError) throw new Error(this.fatalError);
    if(this.sharedSurfacePreparation||this.preparing)throw Error('La préparation de l’affichage est déjà en cours.');
    const job=this.preparePresentationResources();this.sharedSurfacePreparation=job;
    try { await job; }
    catch (error) {
      // Restoration inside the preparation completes before teardown.
      try { this.dispose(); } catch { /* Preserve the original preparation error. */ }
      throw error;
    }finally{if(this.sharedSurfacePreparation===job)this.sharedSurfacePreparation=undefined;this.queuePausedTreeTextures();}
  }

  protected async preparePresentationResources(compileOnly=false): Promise<void> {
    if(compileOnly){
      // Data changes keep the existing model/material programs and all LOD/
      // shadow variants. Unlike render-based warmups, compileAsync never
      // submits Room/shadow frames or invokes producers' geometry helpers.
      this.uploadSharedSurfaceAssets();
      await this.renderer.compileAsync(this.scene,this.rig.orthographic);
      await this.renderer.compileAsync(this.scene,this.rig.perspective);
      if(this.fatalError)throw Error(this.fatalError);
      return;
    }
    this.preparing = true;this.ownedOpaqueRevisions435?.setEnabled(false);this.ownedOpaqueRevisions435?.invalidateResources();
    this.uploadSharedSurfaceAssets();
    if(!this.holdSurfaceWorld)await this.prepareSharedTreeTextures();
    const restoreDiorama = this.dioramaEnabled || this.roomEnabled ? await this.diorama?.prepare() : undefined;
    this.invalidatePausedShadow();
    const culling = new Map<THREE.Object3D, boolean>();
    const distant = this.overview.group.visible;
    const restorePawnFires=this.pawns.prepareFiresForCompile();
    const restoreWildlife=this.wildlife.prepare();
    const restoreAnimalCargo=this.animalCargo.prepareForCompile();
    const restoreMechanoids=this.mechanoids.prepare();
    const restoreRopes=this.ropes.prepareForCompile();
    const restoreFeedback=this.actionFeedback.prepareForCompile();
    const restoreActionVfx=this.actionVfx.prepareForCompile();
    const restoreBrawlCloud=this.brawlCloud.prepareForCompile();
    const restoreStructureVfx=this.structureVfx.prepareForCompile();
    const restoreWind=this.wind.prepareForCompile();
    const restoreRoofs=this.roofs.prepare();
    const restoreDoors=this.doors.prepareForCompile();
    const restoreTimber=this.timber.prepareForCompile();
    const restoreCrops = this.crops.prepareForCompile();
    const restoreOverview = this.overview.prepareForCompile();
    const restorePlants = this.plants.prepareForCompile();
    const restoreGrass = this.grass?.prepareForCompile() ?? (() => {});
    const restoreDesignations=this.designations.prepareForCompile();
    const restoreLabels=this.hostPort.prepareLabelsForCompile?.();
    const restoreFilth=this.hygiene.filth.prepareForCompile();
    const restoreClouds=this.clouds.prepareForCompile();
    const restorePodRescue=this.podRescue.prepareForCompile();
    const restoreStartingArrival=this.startingArrival.prepareForCompile();
    const restoreOrbitalDelivery=this.orbitalDelivery.prepareForCompile();
    const restorePrecipitation=this.precipitation.prepareForCompile();
    const restoreBoxes=this.boxes.prepareEmptyShadows();
    const restoreSnow=this.snowSurface.prepareForCompile();
    const restoreArea=this.areaPreview.prepareForCompile();
    const restoreTurretRange=this.turretRange.prepareForCompile();
    const restoreHints=this.recreationHints.prepareForCompile();
    const restoreOrderRock=this.orderRockPreview.prepareForCompile();
    const restoreConstruction=this.constructionPreview.prepareForCompile();
    const restoreDeep=this.deepResources.prepareForCompile();
    let restorePawnCargo=()=>{};
    const preparePawnCargo=()=>{restorePawnCargo();restorePawnCargo=this.pawns.prepareCargoForCompile();};
    try {
      // The double-sided cursor otherwise compiles both face variants on the
      // first map interaction. Include it behind the loading overlay.
      this.hover.visible = true;
      this.objectSelection.visible = true;
      this.storageGroup.visible=this.growing.group.visible=this.allowedAreaLayer.group.visible=true;
      this.overview.group.visible = this.terrainGroup.visible = this.resourceGroup.visible = this.plants.group.visible = true;
      this.rocks.setDistant(false); this.rocks.mesh.visible = true;
      this.staticSceneCompiler435?.syncVisibility();
      this.scene.traverse(object => { culling.set(object, object.frustumCulled); object.frustumCulled = false; });
      this.daylight.update(this.world ? calendarTick(this.world) : 0, this.controls.target,this.world??undefined);
      if (this.dioramaEnabled) this.diorama?.presentSky(this.daylight.sample.y);
      if (this.room) this.room.present(this.daylight.sample, this.camera);
      else this.daylight.fitShadow(this.camera);
      if (this.room) {
        await this.room.prepare(this.renderer, this.rig.orthographic);
        await this.room.prepare(this.renderer, this.rig.perspective);
      }
      this.environmentLighting.exploration.bind(this.scene);
      preparePawnCargo();
      await this.renderer.compileAsync(this.scene, this.rig.orthographic);
      preparePawnCargo();
      await this.renderer.compileAsync(this.scene, this.rig.perspective);
      await this.pawns.prepareBodyPipelines(this.renderer,this.scene,[this.rig.orthographic,this.rig.perspective],async()=>{
        const shadow=(this.room?.lighting.shadowLight??this.daylight.light).shadow,needsUpdate=shadow.needsUpdate;
        try {shadow.needsUpdate=true;preparePawnCargo();await prepareShadowPipelines(this.renderer,this.scene,this.rig.orthographic,this.boxes);}
        finally {shadow.needsUpdate=needsUpdate;}
      });
      this.landscape.needsUpdate=true;
      preparePawnCargo();
      await prepareShadowPipelines(this.renderer,this.scene,this.rig.orthographic,this.boxes);
      if (this.fatalError) throw new Error(this.fatalError);
    } finally {
      // Restore the broad compile override first. Layers prepared above had
      // already disabled culling when that override was captured; their own
      // restorers must therefore run last to recover their real runtime flag.
      for (const [object, value] of culling) object.frustumCulled = value;
      restoreMechanoids();
      restoreWind();restorePawnFires();restorePawnCargo();restoreWildlife();restoreAnimalCargo();restoreRopes();restoreFeedback();restoreActionVfx();restoreBrawlCloud();restoreStructureVfx();restoreRoofs();restoreDoors();restoreTimber();restoreCrops();restorePlants();restoreGrass();restoreDesignations();restoreFilth();restoreClouds();restorePrecipitation();
      restoreSnow();restoreBoxes();restoreArea();restoreTurretRange();restoreHints();restoreOrderRock();restoreConstruction();restoreDeep();
      restoreOverview();
      restoreLabels?.();
      restorePodRescue();restoreOrbitalDelivery();
      restoreStartingArrival();
      restoreDiorama?.();
      this.overview.group.visible = distant; this.terrainGroup.visible = this.resourceGroup.visible = this.plants.group.visible = !distant;
      this.rocks.setDistant(distant); this.landscape.refresh(this.backend==='WebGPU'&&distant); this.preparing = this.holdSurfaceWorld;
      this.staticSceneCompiler435?.syncVisibility();
      this.storageGroup.visible=this.growing.group.visible=this.allowedAreaLayer.group.visible=this.zonesVisible;
      this.roofs.areas.visible=this.zonesVisible&&this.roofAreasVisible;
      this.invalidatePausedShadow();
      this.updateSelectedObject();
      this.updateHover();
      this.frames.reset(); this.lastFrame = 0;
      this.ownedOpaqueRevisions435?.invalidateResources();this.ownedOpaqueRevisions435?.setEnabled(!!this.world&&this.immutableWorlds.has(this.world));
      this.queuePausedTreeTextures();
    }
  }

  toggleCameraMode(): CameraMode {
    this.cancelDesignation();
    this.invalidatePausedShadow();
    this.rig.setMode(this.rig.mode === 'orthographic' ? 'perspective' : 'orthographic');
    return this.rig.mode;
  }

  focusCell(cell:Cell):void {
    this.invalidatePausedShadow();
    const offset=this.camera.position.clone().sub(this.controls.target);this.controls.target.set(cell.x,0,cell.z);this.camera.position.copy(this.controls.target).add(offset);this.controls.update();
  }
  focusPawn(id: number): void {
    const pawn = this.actorScene297?.byId[id]?.actor??this.world?.pawns.find((item) => item.id === id)??this.world?.wildlife?.animals.find(a=>a.id===id)??this.world?.mechanoids?.find(m=>m.id===id);
    if (!pawn) return;
    this.invalidatePausedShadow();
    const offset = this.camera.position.clone().sub(this.controls.target);
    const rendered=this.pawns.presentedPose(id)??this.wildlife.presentedPose(id)??(()=>{let pose:{x:number;y:number;z:number}|undefined;this.mechanoids.forEachPose((actorId,x,y,z)=>{if(actorId===id)pose={x,y,z};});return pose;})();
    const physical=rendered??('body' in pawn&&this.world?pawnBodyLocation(this.world,pawn):pawn);if(!physical)return;
    this.controls.target.set(physical.x, 0, physical.z);
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
  }

  setSelectedPawns(ids:ReadonlySet<number>):void {this.selectedPawns=new Set(ids);this.pawns.setSelected(ids);this.wildlife.setSelected(ids);this.mechanoids.setSelected(ids);if(this.world&&this.pawns.feedbackSource)this.actionFeedback.update(this.world,this.selectedPawns,this.pawns.feedbackSource,!!this.confirmedIntents);this.confirmedPathDirty=!!this.confirmedIntents;}
  setSelectedObject(selected:MapObjectSelection|undefined):void {this.setSelectedObjects(selected?[selected]:[]);}
  setSelectedObjects(selected:readonly MapObjectSelection[]):void {this.selectedObjects=selected.map(s=>({...s}));this.selectedObject=this.selectedObjects[0];this.updateSelectedObject();this.updateGrowingZones(false);this.updateTurretPreview();this.updateDeepResources();}
  protected updateDeepResources():void {
    if(this.world&&this.deepResources.update(this.world,{selectedId:this.tool==='select'&&this.selectedObject?.kind==='structure'?this.selectedObject.id:undefined,placement:this.tool==='install'?this.furniturePlacement?.kind:this.tool}))this.invalidatePausedShadow();
    this.refreshGroundOverlays();
  }
  /** One bridge for all producers. Their records come from the same authored
   * placements/colours as their ground meshes, not from scene-graph inspection. */
  private refreshGroundOverlays():void {
    const world=this.world;if(!world||this.preparing)return;
    const hints=this.recreationHints.group.visible?this.recreationHints.surfaces:EMPTY_GROUND_OVERLAYS;
    const roof=this.zonesVisible&&this.roofAreasVisible?this.roofs.areaSurfaces:EMPTY_GROUND_OVERLAYS;
    const turret=this.turretPreviewVisible?this.turretTintSurfaces:EMPTY_GROUND_OVERLAYS;
    const deep=this.deepResources.mesh.visible?this.deepResources.surfaces:EMPTY_GROUND_OVERLAYS;
    const selection=this.objectSelection.visible?this.objectTintSurfaces:EMPTY_GROUND_OVERLAYS;
    const inputs=[world.width,world.height,roof,hints,turret,deep,this.constructionPreview.surfaces,selection];
    if(inputs.every((value,index)=>value===this.groundOverlayInputs[index]))return;this.groundOverlayInputs=inputs;
    this.surfaceTint.setOverlays(world.width,world.height,
      [...roof,...hints],[...turret,...deep,...this.constructionPreview.surfaces,...selection]);
  }
  protected updateTurretPreview():void {
    const world=this.world,selected=this.selectedObject;
    const structure=this.tool==='select'&&selected?.kind==='structure'?world?.structures.find(s=>s.id===selected.id&&s.kind==='mini-turret'):undefined;
    if(this.areaDrag||!world||!structure){this.turretRange.hide();this.turretPreviewVisible=false;this.turretPreviewSignature='';this.turretTintSurfaces=EMPTY_GROUND_OVERLAYS;this.refreshGroundOverlays();return;}
    const danger=!!structure.turret?.wick,radius=danger?MINI_TURRET_DISPLAY_BOMB_RADIUS:MINI_TURRET_DISPLAY_RANGE;
    const signature=`${structure.id}:${structure.x}:${structure.z}:${world.width}:${world.height}:${danger}`;
    if(signature===this.turretPreviewSignature)return;
    this.turretPreviewSignature=signature;this.turretPreviewVisible=true;
    const cells=miniTurretRadiusCells(world,structure,radius),color=danger?0xe79c7c:0x9bbeb0;
    this.turretRange.update(world.width,cells,color);
    this.turretTintSurfaces=this.turretRange.surfaces;
    this.refreshGroundOverlays();
  }
  protected updateGrowingZones(reset:boolean):boolean {
    return this.world?this.growing.updateIntents(this.world,this.confirmedIntents?.growingZones??this.world.growingZones,reset,this.tool==='growing'||this.tool==='remove-growing',this.selectedObject?.kind==='growing'?this.selectedObject.id:undefined,this.confirmedIntents?i=>knownCell256(this.world!,i):undefined):false;
  }
  protected updateSelectedObject():void {
    if(this.preparing)return;
    try {
    if(this.world&&this.selectedObjects.length>1){
      this.surfaceTint.setSelection(this.world.width,this.world.height,[],false);
      const groups=mapObjectGroupCells(this.world,this.selectedObjects),vertices:number[]=[],keys:string[]=[],surfaces:GroundOverlayRect[]=[];
      const selectedColor=(this.objectSelection.material as THREE.MeshBasicNodeMaterial).color;
      const y=.14,stroke=(ax:number,az:number,bx:number,bz:number)=>{
        const dx=bx-ax,dz=bz-az,scale=.024/Math.hypot(dx,dz),nx=-dz*scale,nz=dx*scale;
        vertices.push(ax+nx,y,az+nz,bx+nx,y,bz+nz,bx-nx,y,bz-nz,ax+nx,y,az+nz,bx-nx,y,bz-nz,ax-nx,y,az-nz);
        surfaces.push(groundOverlayRect(Math.min(ax+nx,bx+nx,bx-nx,ax-nx),Math.min(az+nz,bz+nz,bz-nz,az-nz),
          Math.max(ax+nx,bx+nx,bx-nx,ax-nx),Math.max(az+nz,bz+nz,bz-nz,az-nz),selectedColor,1));
      };
      for(let i=0;i<groups.length;i++){
        const cells=groups[i]!;if(!cells.length)continue;
        let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
        for(const c of cells){minX=Math.min(minX,c.x);maxX=Math.max(maxX,c.x);minZ=Math.min(minZ,c.z);maxZ=Math.max(maxZ,c.z);}
        minX-=.44;maxX+=.44;minZ-=.44;maxZ+=.44;
        const selected=this.selectedObjects[i]!;keys.push(`${selected.kind}:${selected.id}:${minX}:${maxX}:${minZ}:${maxZ}`);
        const length=Math.min(.23,(maxX-minX)/3,(maxZ-minZ)/3);
        for(const x of [minX,maxX])for(const z of [minZ,maxZ]){
          stroke(x,z,x+(x===minX?1:-1)*length,z);stroke(x,z,x,z+(z===minZ?1:-1)*length);
        }
      }
      const signature=keys.join('|');this.objectSelection.visible=!!vertices.length;
      if(signature===this.objectSelectionSignature)return;
      this.objectTintSurfaces=surfaces.length?surfaces:EMPTY_GROUND_OVERLAYS;
      this.objectSelectionSignature=signature;const old=this.objectSelection.geometry;
      this.objectSelection.geometry=new THREE.BufferGeometry();
      this.objectSelection.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));old.dispose();return;
    }
    const isZone=this.selectedObject?.kind==='growing'||this.selectedObject?.kind==='stockpile';
    if(isZone)this.objectTintSurfaces=EMPTY_GROUND_OVERLAYS;
    const cells=this.world&&this.selectedObject?(this.selectedObject.kind==='stockpile'?stockpileZoneCells(this.world,this.selectedObject.id):mapObjectCells(this.world,this.selectedObject)):[];
    if(this.world)this.surfaceTint.setSelection(this.world.width,this.world.height,isZone?cells.map(c=>c.z*this.world!.width+c.x):[],isZone&&this.zonesVisible);
    if(isZone&&!this.zonesVisible){this.objectSelection.visible=false;this.objectSelectionSignature='';return;}
    if(!cells.length){this.objectTintSurfaces=EMPTY_GROUND_OVERLAYS;this.objectSelection.visible=false;this.objectSelectionSignature='';return;}
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,shape=2166136261;
    for(const cell of cells){minX=Math.min(minX,cell.x);maxX=Math.max(maxX,cell.x);minZ=Math.min(minZ,cell.z);maxZ=Math.max(maxZ,cell.z);shape=Math.imul(shape^((cell.z*this.world!.width+cell.x)>>>0),16777619);}
    minX-=.44;maxX+=.44;minZ-=.44;maxZ+=.44;
    const signature=`${this.selectedObject!.kind}:${this.selectedObject!.id}:${cells.length}:${shape}:${minX}:${maxX}:${minZ}:${maxZ}`;
    this.objectSelection.visible=true;
    if(signature===this.objectSelectionSignature)return;
    this.objectSelectionSignature=signature;
    if(isZone){
      const vertices=zoneBoundaryVertices(this.world!.width,cells.map(c=>c.z*this.world!.width+c.x));
      const old=this.objectSelection.geometry;this.objectSelection.geometry=new THREE.BufferGeometry();
      this.objectSelection.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));old.dispose();return;
    }
    const length=Math.min(.23,(maxX-minX)/3,(maxZ-minZ)/3),y=.14;
    const vertices:number[]=[],surfaces:GroundOverlayRect[]=[];
    const selectedColor=(this.objectSelection.material as THREE.MeshBasicNodeMaterial).color;
    // GPU line width is fixed to one pixel on common WebGPU backends. Flat
    // strokes give object corners a stable thickness comparable to pawn rings.
    const stroke=(ax:number,az:number,bx:number,bz:number)=>{
      const dx=bx-ax,dz=bz-az,scale=.024/Math.hypot(dx,dz),nx=-dz*scale,nz=dx*scale;
      vertices.push(ax+nx,y,az+nz,bx+nx,y,bz+nz,bx-nx,y,bz-nz,
        ax+nx,y,az+nz,bx-nx,y,bz-nz,ax-nx,y,az-nz);
      surfaces.push(groundOverlayRect(Math.min(ax+nx,bx+nx,bx-nx,ax-nx),Math.min(az+nz,bz+nz,bz-nz,az-nz),
        Math.max(ax+nx,bx+nx,bx-nx,ax-nx),Math.max(az+nz,bz+nz,bz-nz,az-nz),selectedColor,1));
    };
    for(const x of [minX,maxX])for(const z of [minZ,maxZ]){
      const dx=x===minX?1:-1,dz=z===minZ?1:-1;
      stroke(x,z,x+dx*length,z);stroke(x,z,x,z+dz*length);
    }
    const old=this.objectSelection.geometry;
    this.objectSelection.geometry=new THREE.BufferGeometry();
    this.objectSelection.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));old.dispose();
    this.objectTintSurfaces=surfaces;
    } finally {this.refreshGroundOverlays();}
  }

  /** Project lightweight actor proxies only for pointer gestures, using the
   * same confirmed edge as the GPU. Canopies don't prevent selecting a colon. */
  screenPawns():ScreenPawn[] {
    const rect=this.hostPort.surfaceRect(),result:ScreenPawn[]=[];
    // The carried body uses the carrier's GPU pose and edge times. Its own
    // final walking segment is historical and must not drive its hit proxy.
    const bodyCarriers=new Map((this.world?.piles??[]).flatMap(p=>p.humanCorpse&&p.owner.type==='pawn'?[[p.humanCorpse.pawnId,p.owner.pawnId] as const]:[]));
    const actors=new Map((this.actorScene297?.humans??this.world?.pawns)?.map(p=>[p.id,p]));
    for(const [id,visual] of this.pawns.visuals) {
      if(visual.to.y< -100||!this.world||!knownPosition256(this.world,{x:Math.floor(visual.to.x+.5),z:Math.floor(visual.to.z+.5)}))continue;
      const segment=this.hasTracks?this.timeline.segment(bodyCarriers.get(id)??id):undefined;
      const alpha=segment?THREE.MathUtils.clamp((this.timeline.tick-segment.start)/(segment.end-segment.start),0,1):this.pawns.blend.value;
      const position=new THREE.Vector3().lerpVectors(visual.from,visual.to,alpha);
      const distance=segment?THREE.MathUtils.lerp(segment.fromFraction??0,segment.toFraction??1,alpha):alpha;
      position.y=travelHeight(visual.from.y,visual.to.y,distance);
      const held=this.pawns.presentedPose(id);
      if(held)position.set(held.x,held.y,held.z);
      const center=position.clone().add(new THREE.Vector3(0,.75,0)).project(this.camera);
      if(center.z < cameraClipNear(this.camera)||center.z>1||Math.abs(center.x)>1||Math.abs(center.y)>1)continue;
      const head=position.clone().add(new THREE.Vector3(0,1.75,0)).project(this.camera);
      result.push({id,x:rect.left+(center.x+1)*rect.width/2,y:rect.top+(1-center.y)*rect.height/2,
        radius:Math.max(5,Math.abs(head.y-center.y)*rect.height/2),depth:center.z,group:actors.get(id)?.state==='dead'?'corpse:human':`human:${actors.get(id)?.faction??'colony'}:${!!actors.get(id)?.prisoner}`,category:actors.get(id)?.state==='dead'?3:(actors.get(id)?.faction??'colony')==='colony'&&!actors.get(id)?.prisoner?0:1});
    }
    const animals=new Map((this.actorScene297?.animals??this.world?.wildlife?.animals)?.map(a=>[a.id,a]));
    const center=new THREE.Vector3(),edge=new THREE.Vector3(),side=new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld,0);
    this.wildlife.forEachPose((id,species,x,y,z,height,radius)=>{
      if(!this.world||!knownPosition256(this.world,{x:Math.floor(x+.5),z:Math.floor(z+.5)}))return;
      center.set(x,y+height*.5,z).project(this.camera);
      if(center.z< cameraClipNear(this.camera)||center.z>1||Math.abs(center.x)>1||Math.abs(center.y)>1)return;
      edge.set(x,y+height*.5,z).addScaledVector(side,Math.max(height*.5,radius)).project(this.camera);
      const animal=animals.get(id);
      result.push({id,x:rect.left+(center.x+1)*rect.width/2,y:rect.top+(1-center.y)*rect.height/2,radius:Math.max(6,Math.abs(edge.x-center.x)*rect.width/2),depth:center.z,group:`${animal?.state==='dead'?'corpse':'animal'}:${species}:${animal?.domestic?'colony':'wild'}`,category:animal?.state==='dead'?3:2});
    });
    this.mechanoids.forEachPose((id,x,y,z,height,radius,dead,kind)=>{
      if(!this.world||!knownPosition256(this.world,{x:Math.floor(x+.5),z:Math.floor(z+.5)}))return;
      center.set(x,y+height*.5,z).project(this.camera);
      if(center.z<cameraClipNear(this.camera)||center.z>1||Math.abs(center.x)>1||Math.abs(center.y)>1)return;
      edge.set(x,y+height*.5,z).addScaledVector(side,Math.max(height*.5,radius)).project(this.camera);
      result.push({id,x:rect.left+(center.x+1)*rect.width/2,y:rect.top+(1-center.y)*rect.height/2,radius:Math.max(6,Math.abs(edge.x-center.x)*rect.width/2),depth:center.z,group:dead?`corpse:mech:${kind}`:`mech:${kind}`,category:dead?3:1});
    });
    return result;
  }

  resize(): void {
    if (this.disposed) return;
    this.invalidatePausedShadow();
    const viewport=this.hostPort.viewport(); const width = Math.max(1, viewport.width), height = Math.max(1, viewport.height);
    this.viewportWidth=width;this.viewportHeight=height;
    this.rig.resize(width, height);
    this.renderer.setSize(width, height, false);
  }

  projectCell(x: number, z: number): { x: number; y: number } {
    this.camera.updateMatrixWorld();
    const projected = new THREE.Vector3(x, 0, z).project(this.camera);
    return { x: (projected.x + 1) * this.viewportWidth / 2, y: (1 - projected.y) * this.viewportHeight / 2 };
  }

  protected updateResources(world: World, newMap: boolean,frame?:SceneResourceFrame): void {
    const immutable=this.immutableWorlds.has(world);
    if(immutable&&readPreparedNaturalFrame(world)){
      const prepared=this.preparedNaturalPresentation;
      const resetNatural=newMap||!prepared.active;
      const result=prepared.readScene(world,resetNatural,frame)!;
      if(!result.changed)return;
      this.plants.update(world,resetNatural,prepared.changes);
      this.resources.update(world,resetNatural,prepared.changes,frame,prepared.appearance);
      this.overview.update(world,resetNatural,prepared.changes,prepared.appearance);return;
    }
    const resetNatural=newMap||this.preparedNaturalPresentation.active;
    this.preparedNaturalPresentation.clear();
    const scene=immutable&&readSceneResourceFrame(frame,world)
      ?this.naturalPresentation.readScene(world,resetNatural,true)
      :this.naturalPresentation.read(world,resetNatural,immutable);
    if(!scene)return;
    const compact=!isNaturalSceneWorld(scene);
    if(compact&&!scene.changed)return;
    const view=compact?world:scene;
    this.plants.update(view,resetNatural,this.naturalPresentation.changes);
    if(readSceneResourceFrame(frame,world)){
      this.resources.update(world,resetNatural,this.naturalPresentation.changes,frame,this.naturalPresentation.appearance);
      // Overview owns the same crop/cluster exclusion already; it can receive
      // the complete current World without a second global filtered array.
      this.overview.update(world,resetNatural,this.naturalPresentation.changes,this.naturalPresentation.appearance);return;
    }
    const visible=compact
      ?{...world,resources:world.resources.filter(resource=>!isResidentCrop(resource)&&!isClusterPlantSpecies(resource.species))}
      :{...view,resources:view.resources.filter(resource=>!isClusterPlantSpecies(resource.species))};
    this.resources.update(visible,resetNatural,this.naturalPresentation.changes,undefined,this.naturalPresentation.appearance); this.overview.update(visible,resetNatural,this.naturalPresentation.changes,this.naturalPresentation.appearance);
  }

  protected buildStructures(world: World): void {
    const prepared=this.preparedStructures;
    if(prepared?.world===world)this.doors.updateNative(world,this.wallCutaway,false,prepared.doors,prepared.axes,prepared.gateAxes);
    else this.doors.update(world,this.wallCutaway);this.timber.update(world,this.wallCutaway);this.furniturePresentation.update(world,this.structureGroup,this.wallCutaway,this.boxes,this.structureSignature.flowerChanges(),this.immutableWorlds.has(world));this.structureSignature.ackFurnitureBuild(); }

  protected buildJobs(world: World): void {
    if(!this.confirmedIntents){buildJobMarkers(world,this.jobGroup,this.wallCutaway,this.boxes);return;}
    this.confirmedJobMarkers.updatePhysical(world,this.wallCutaway);
    this.confirmedJobMarkers.updateIntentions(this.confirmedIntents.jobs,this.wallCutaway,world);
    this.confirmedJobsSource=this.confirmedIntents.jobs;
    this.confirmedJobMarkers.present(this.jobGroup,this.boxes);
  }

  /** Runs in the existing RAF, never gated by the actor playhead or 200 ms.
   * Producers share the original resident batches; only intentions are newer. */
  private presentConfirmedIntents():void {
    const intents=this.confirmedIntents,world=this.world,previous=this.presentedIntentFields;
    if(!intents||!world||!(this.confirmedIntentsDirty||this.confirmedSurfaceDirty||this.confirmedPathDirty||this.confirmedDesignationsDirty))return;
    const first=!previous,surface=this.confirmedSurfaceDirty,known=(cell:number)=>knownCell256(world,cell);
    if(this.confirmedJobsSource!==intents.jobs||surface){
      this.confirmedJobMarkers.updateIntentions(intents.jobs,this.wallCutaway,world);
      this.confirmedJobMarkers.present(this.jobGroup,this.boxes);this.confirmedJobsSource=intents.jobs;
    }
    let zonesChanged=false;
    if(first||surface||previous.stockpiles!==intents.stockpiles||previous.home!==intents.home||previous.snowClearArea!==intents.snowClearArea){
      this.buildStorage(world);zonesChanged=true;
    }
    if(first||surface||previous.growingZones!==intents.growingZones)zonesChanged=this.updateGrowingZones(false)||zonesChanged;
    if(first||surface||previous.allowedAreas!==intents.allowedAreas)
      zonesChanged=this.allowedAreaLayer.updateIntents(world,intents.allowedAreas,this.allowedAreaTarget,false,known)||zonesChanged;
    if(first||surface||previous.roofBuild!==intents.roofBuild||previous.roofRemove!==intents.roofRemove)
      zonesChanged=this.roofs.updateAreas(world,intents.roofBuild,intents.roofRemove,this.boxes,false,known)||zonesChanged;
    if(first||surface||this.confirmedDesignationsDirty||previous.jobs!==intents.jobs||previous.roofBuild!==intents.roofBuild||previous.roofRemove!==intents.roofRemove)
      this.designations.update(world,intents);
    if(this.pawns.feedbackSource&&(first||this.confirmedPathDirty||previous.routes!==intents.routes))
      this.actionFeedback.updateConfirmedPath(intents.routes,world,this.selectedPawns,this.pawns.feedbackSource,this.actorScene297?.humans);
    this.presentedIntentFields=intents;
    this.confirmedIntentsDirty=this.confirmedSurfaceDirty=this.confirmedPathDirty=this.confirmedDesignationsDirty=false;
    if(zonesChanged){this.zonesTintDirty=true;this.refreshZonesTint();}
  }

  protected buildStorage(world: World): void {
    const intents=this.confirmedIntents;
    const { cells } = storageZonePlacements(world.width, intents?intents.stockpiles.filter(cell=>knownCell256(world,cell.z*world.width+cell.x)):world.stockpiles,world);
    const home: Placement[] = [];
    if(this.tool==='home'||this.tool==='remove-home')for(const i of ((intents?intents.home:world.home)??[]).filter(i=>!intents||knownCell256(world,i)))home.push({x:i%world.width,z:Math.floor(i/world.width),y:(surfaceHeightAtCell(world,i%world.width,Math.floor(i/world.width))??0)+.04,sx:1,sy:.014,sz:1,color:0x779ee6});
    if(this.tool==='snow-clear'||this.tool==='remove-snow-clear')for(const i of ((intents?intents.snowClearArea:world.snowClearArea)??[]).filter(i=>!intents||knownCell256(world,i)))home.push({x:i%world.width,z:Math.floor(i/world.width),y:(surfaceHeightAtCell(world,i%world.width,Math.floor(i/world.width))??0)+.04,sx:1,sy:.014,sz:1,color:0x86b8d7});
    this.storageTintPlacements=cells;this.homeTintPlacements=home;this.zonesTintDirty=true;
    this.boxes.set(this.storageGroup, 'storage-cells', cells, 'storage', false);
    this.boxes.set(this.storageGroup, 'storage-borders', [], 'border', false);
    this.boxes.set(this.storageGroup, 'storage-home', home, 'storage-home', false);
    setGroundOverlayRenderOrder(this.storageGroup,'storage-cells',GROUND_OVERLAY_RENDER_ORDER.storage);
    setGroundOverlayRenderOrder(this.storageGroup,'storage-home',GROUND_OVERLAY_RENDER_ORDER.home);
  }

  protected updatePiles(world: World, newMap: boolean): void {
    if (newMap) {
      clearGroup(this.pileGroup);
      this.pileChunks.clear();
      // Reserve one empty batch per spatial chunk while the map is loading.
      // First material drops then reuse compiled objects and resident buffers.
      for(let z=0;z<world.height;z+=WORLD_SCALE.chunkSize)for(let x=0;x<world.width;x+=WORLD_SCALE.chunkSize) {
        const key=`${x/WORLD_SCALE.chunkSize}:${z/WORLD_SCALE.chunkSize}`,group=new THREE.Group();
        group.name=`Material piles ${key}`;this.pileGroup.add(group);
        this.boxes.set(group,`pile:${key}`,[]);this.pileChunks.set(key,{signature:'',group});
      }
    }
    const hidden=this.pawns.hiddenPileQuantities();
    const prepared=this.immutableWorlds.has(world)?this.applicationContext?.piles.read(world,hidden,newMap):undefined;
    if(prepared){
      this.designations.updatePileIcons(world,prepared.changedChunks,prepared.activeKeys,newMap);
      for(const [key,chunk]of this.pileChunks)if(!prepared.activeKeys.has(key)&&chunk.signature!==''){this.boxes.set(chunk.group,`pile:${key}`,[]);chunk.signature='';}
      for(const change of prepared.changedChunks){const {key,signature}=change,previous=this.pileChunks.get(key);if(previous?.signature===signature)continue;
        const group=previous?.group??new THREE.Group();if(!previous)this.pileGroup.add(group);group.name=`Material piles ${key}`;
        this.boxes.set(group,`pile:${key}`,this.applicationContext!.piles.placements(prepared,change));this.pileChunks.set(key,{signature,group});
      }
      this.applicationContext!.acknowledgePiles(prepared);return;
    }
    const surfaces=pileSurfaces(world),identitySurfaces=pileIdentitySurfaces(world);
    const jobById = new Map(world.jobs.map(job => [job.id, job]));
    const cells = new Map<string, PileBundle>();
    for (const pile of world.piles) {
      const forbidden=pile.owner.type==='ground'&&!materialAllowedForPlayer256(pile),markerOnly=!!(pile.humanCorpse||pile.mechCorpse);
      if(markerOnly&&!forbidden||pile.owner.type==='grave')continue;
      if (pile.owner.type !== 'ground'&&pile.owner.type!=='job') continue;
      const quantity=pile.quantity-(hidden.get(pile.id)??0);
      if(quantity<=0)continue;
      const job = pile.owner.type === 'job' ? jobById.get(pile.owner.jobId) : undefined;
      if (pile.owner.type === 'job' && !job) continue;
      const position = pile.owner.type === 'ground' ? pile.owner : job!;
      const identitySurface=job?undefined:identitySurfaces.get(pile.id);
      const key = `${position.x}:${position.z}:${pile.item}:${job ? 'job' : 'ground'}${pile.corpse||pile.innerResource||identitySurface||markerOnly?`:${pile.id}`:''}${forbidden?':forbidden':''}`;
      const bundle = cells.get(key);
      if (bundle) bundle.quantity += quantity;
      else cells.set(key, { x: position.x, z: position.z, kind: pile.kind, item: pile.item, quantity, supplied: !!job,...(forbidden?{forbidden:true as const}:{}),...(markerOnly?{markerOnly:true as const}:{}),...(identitySurface||pile.innerResource||markerOnly?{pileId:pile.id}:{}),...(pile.innerResource?{innerResource:pile.innerResource}:{}),
        ...(pile.kind==='chunk'&&pile.owner.type==='ground'?{targetId:position.z*world.width+position.x}:{}),
        surface:job?undefined:identitySurface??surfaces.get(position.z*world.width+position.x),...(!markerOnly&&pile.kind==='corpse'?{corpseStage:corpseStage(pile,world.tick),facing:pile.corpse?.facing??0,corpse:pile.corpse}:{}) });
    }
    const chunks = new Map<string, PileBundle[]>();
    for (const bundle of cells.values()) {
      const key = `${Math.floor(bundle.x / WORLD_SCALE.chunkSize)}:${Math.floor(bundle.z / WORLD_SCALE.chunkSize)}`;
      const chunk = chunks.get(key);
      if (chunk) chunk.push(bundle); else chunks.set(key, [bundle]);
    }
    this.designations.updatePileIcons(world,[...chunks].map(([key,bundles])=>({key,bundles})),new Set(chunks.keys()),true);
    for (const [key, chunk] of this.pileChunks) if (!chunks.has(key)&&chunk.signature!=='') {
      this.boxes.set(chunk.group, `pile:${key}`, []); chunk.signature = '';
    }
    for (const [key, bundles] of chunks) {
      const signature = bundles.map(bundle => `${bundle.x}:${bundle.z}:${bundle.item}:${bundle.quantity}:${bundle.supplied}:${bundle.pileId??''}:${bundle.corpseStage??''}:${bundle.facing??0}:${bundle.innerResource?`${bundle.innerResource.species??'legacy'}:${bundle.innerResource.growth??1}:${bundle.innerResource.blight??false}`:''}:${bundle.corpse?corpseVisualMask(bundle.corpse):0}:${bundle.surface?Object.values(bundle.surface).join(','):'ground'}${bundle.forbidden?':forbidden':''}${bundle.markerOnly?':marker-only':''}`).join('|');
      const previous = this.pileChunks.get(key);
      if (previous?.signature === signature) continue;
      const group = previous?.group ?? new THREE.Group();
      if (!previous) this.pileGroup.add(group);
      group.name = `Material piles ${key}`;
      this.boxes.set(group, `pile:${key}`, pileParts(bundles));
      this.pileChunks.set(key, { signature, group });
    }
  }

  visibilityChanged():void {
    if(this.hostPort.hidden())this.cancelGraphicsMeasurement('hidden');
    if(this.presentationStopped)return;
    this.frames.reset();this.lastFrame=0;this.animationDetail.reset();
    if(!this.hostPort.hidden()&&this.received){const r=this.received,latest=this.latestCoreInput297;this.setWorld(r.world,true,r.speed,r.tracks,r.immutableSnapshot,r.coreInput297);if(latest){const phase=readNativeCorePhaseInput297(latest),full=this.coreFullInputs297.get(r.world);
      // A newer Full supersedes an older phase even in the same Native epoch.
      // Replay only the still-live phase belonging to this exact authentic Full.
      if(phase?.kind==='phase'&&full?.kind==='full'&&phase.anchor===full.anchor&&phase.world===r.world&&phase.speed===r.speed&&phase.core>=full.core)this.setCorePhase297(latest);
    }}
  }

  protected frame(now: number): void {
    if (this.disposed || this.fatalError || this.preparing) return;
    if(this.presentationStopped){this.renderer.info.reset();this.renderScene();return;}
    if(this.hasTracks){this.timeline.advance(now);const due=this.presentation.take(this.timeline.tick,this.received?.coreInput297?undefined:now,this.presentationFrame297);if(due)this.applyWorld(due);this.presentCorePhases297();}
    this.presentConfirmedIntents();
    const dtTweener297=this.lastFrame?Math.max(0,(now-this.lastFrame)/1000):0;
    const dt = Math.min(dtTweener297,.05);
    this.lastFrame = now;
    this.pawns.blend.value = this.snapshotDuration > 0 ? Math.min(1, Math.max(0, (this.hostPort.now() - this.snapshotAt) / this.snapshotDuration)) : 1;
    this.pawns.time.value = THREE.MathUtils.lerp(this.timeFrom, this.timeTo, this.pawns.blend.value);
    if(this.hasTracks && this.world) {this.pawns.time.value=(this.timeline.tick/TICKS_PER_SECOND)%(2*Math.PI);this.pawns.updateTravel(this.world,this.timeline,dtTweener297,this.received?.speed??0,this.actorScene297);}
    if (!this.hostPort.selectionActive()) {
      if (!this.areaDrag) this.moveCamera(dt);
      this.controls.update();
    }
    if (this.world) {
      const x = THREE.MathUtils.clamp(this.controls.target.x, 0, this.world.width - 1);
      const z = THREE.MathUtils.clamp(this.controls.target.z, 0, this.world.height - 1);
      this.camera.position.x += x - this.controls.target.x;
      this.camera.position.z += z - this.controls.target.z;
      this.controls.target.x = x; this.controls.target.z = z;
    }
    this.rig.constrainRoom?.();
    const confirmedPresentationTick = this.hasTracks ? this.timeline.tick : THREE.MathUtils.lerp(this.timeFrom, this.timeTo, this.pawns.blend.value) * TICKS_PER_SECOND;
    // Cosmetic clocks may follow confirmed Core; environment DATA remains the authentic Full.
    // This parameter never rewrites World.tick or grants a new simulation/UI state.
    const skyTick=confirmedPresentationTick;
    this.animationDetail.beginFrame(now,this.camera,this.viewportHeight,skyTick);
    if(this.turretTops.present(dt,this.received?.speed===0))this.invalidatePausedShadow(false);
    if(this.world&&this.pawns.presentCargo(skyTick,this.world)){
      this.invalidatePausedShadow(false);this.updatePiles(this.world,false);
    }
    if(this.pawns.feedbackSource)this.actionFeedback.syncTravel(this.pawns.feedbackSource);
    if(this.world)this.wildlife.update(this.world,this.hasTracks?this.timeline:undefined,false,this.pawns,this.actorScene297,dtTweener297,this.received?.speed??0);
    if(this.world)this.mechanoids.update(this.world,this.hasTracks?this.timeline:undefined,false,this.pawns,this.actorScene297);
    this.pawns.presentAnimations();this.wildlife.presentAnimations(this.pawns);this.mechanoids.presentAnimations(this.pawns);
    if(this.animalCargo.present(this.wildlife))this.invalidatePausedShadow(false);
    this.ropes.present(this.hasTracks?this.timeline:undefined,this.pawns,this.wildlife);
    // Continuous view motion invalidates the pause cache without cancelling the
    // running shadow deadline. Projection/layer/camera changes remain urgent.
    const urgentShadowViewChange=!this.shadowViewReady||this.shadowCamera!==this.camera||this.shadowCameraLayers!==this.camera.layers.mask||this.shadowCameraCoordinates!==this.camera.coordinateSystem||this.shadowCameraReversedDepth!==this.camera.reversedDepth||!this.shadowProjection.equals(this.camera.projectionMatrix);
    if(urgentShadowViewChange||!this.shadowView.equals(this.camera.matrixWorld)) {
      this.shadowView.copy(this.camera.matrixWorld);this.shadowProjection.copy(this.camera.projectionMatrix);
      this.shadowCamera=this.camera;this.shadowViewReady=true;
      this.shadowCameraLayers=this.camera.layers.mask;this.shadowCameraCoordinates=this.camera.coordinateSystem;this.shadowCameraReversedDepth=this.camera.reversedDepth;
      this.invalidatePausedShadow(urgentShadowViewChange);
    }
    this.refreshAreaPointer();
    // Share the confirmed presentation clock with pawn motion. Loading a save
    // restores the sky; pausing cannot continue an independent wall-clock sun.
    if (this.onAudioFrame) this.onAudioFrame({
      tick: skyTick,
      paused: this.received?.speed === 0,
      camera: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z,
        targetX: this.controls.target.x, targetZ: this.controls.target.z, span: this.rig.span, mode: this.rig.mode },
    });
    const visualWind=this.world?visualWindDirection(this.world.wind?.seed??this.world.seed,skyTick):{x:1,z:0};
    const visualWindStrength=this.world?windIntensity(this.world):0;
    if(this.world){
      this.resources.setWind(visualWindStrength,visualWind.x,visualWind.z);
      this.plants.setWind(visualWindStrength,visualWind.x,visualWind.z);
      this.grass?.setWind(visualWindStrength,visualWind.x,visualWind.z);
      this.structureVfx.setWind(visualWindStrength,visualWind.x,visualWind.z);
      this.paintedWater.setWind(visualWindStrength,visualWind.x,visualWind.z);
      this.resources.presentWind(skyTick);
      this.plants.presentWind(skyTick);
      this.grass?.presentWind(skyTick);
    }
    this.resources.presentChop(skyTick/TICKS_PER_SECOND);
    this.doors.present(skyTick);this.projectiles.present(skyTick);this.fires.present(skyTick);this.wind.present(skyTick);
    this.actionVfx.setView(this.camera);this.structureVfx.setView(this.camera,this.controls.target);
    this.actionVfx.present(skyTick);this.brawlCloud.present(skyTick);this.structureVfx.present(skyTick);this.podRescue.present(skyTick);this.orbitalDelivery.present(skyTick);
    if(this.startingArrival.present(skyTick,this.received?.world.tick??this.world?.tick??skyTick))this.invalidatePausedShadow();
    if(this.texturesEnabled)this.paintedWater.present(skyTick/TICKS_PER_SECOND);
    if(this.animationDetail.shouldSample(this.skyAnimation,(this.world?.width??1)/2,0,(this.world?.height??1)/2)){
      this.daylight.update(this.world?calendarTick(this.world,skyTick):skyTick, this.controls.target,this.world??undefined);
      if (this.dioramaEnabled) this.diorama?.presentSky(this.daylight.sample.y);
    }
    if (this.roomEnabled) this.clouds.mesh.visible = false;
    else if(this.world)this.clouds.present({seed:this.world.seed,tick:skyTick,weather:this.world.weather,camera:this.camera,
      target:this.controls.target,strength:visualWindStrength,directionX:visualWind.x,directionZ:visualWind.z,
      daylight:this.daylight.sample.daylight});
    if(this.world)this.precipitation.present({seed:this.world.seed,tick:skyTick,rainRate:weatherRainRate(this.world),
      snowRate:weatherSnowRate(this.world),camera:this.camera,target:this.controls.target,
      strength:visualWindStrength,directionX:visualWind.x,directionZ:visualWind.z,daylight:this.daylight.sample.daylight});
    const cellPixels=this.rig.pixelsPerCell(this.viewportHeight);
    if(this.graphicsStyle.reliefLod?.update(this.rig.mode,cellPixels*this.renderer.getPixelRatio()))this.invalidatePausedShadow();
    this.actionFeedback.setBarsDetailVisible(cellPixels>=18);
    this.actionVfx.setDetailVisible(true);
    this.brawlCloud.setDetailVisible(true);
    this.ropes.setDetailVisible(true);
    this.designations.present(this.camera,this.viewportHeight,cellPixels);
    this.wildlife.presentDesignations(this.camera,this.viewportHeight,cellPixels);
    const distant=this.overview.group.visible ? cellPixels<9 : cellPixels<7;
    if(distant!==this.overview.group.visible){this.landscape.needsUpdate=true;this.invalidatePausedShadow();}
    this.overview.group.visible=distant;this.terrainGroup.visible=!distant;this.resourceGroup.visible=!distant;this.plants.group.visible=!distant;
    this.structureVfx.setDistant(distant);
    if(!distant)this.structureVfx.setView(this.camera,this.controls.target);
    this.rocks.setDistant(distant);
    if(this.grass){
      if(this.grassVisible&&!distant)this.grass.present(this.camera,this.controls.target,this.rig.span,cellPixels);
      else{this.grass.mesh.visible=false;this.grass.mesh.geometry.instanceCount=0;}
    }
    this.landscape.setRetained(this.backend==='WebGPU'&&distant);
    if (this.dioramaEnabled || this.roomEnabled) this.diorama?.present(this.camera, this.controls.target, this.rig.span);
    const shadowLight=this.room?.lighting.shadowLight ?? this.daylight.light;
    const shadow=shadowLight.shadow,received=this.received;
    const cacheEligible=this.backend==='WebGPU'&&!!this.world;
    const paused=received?.speed===0&&(!this.hasTracks||this.timeline.tick>=received.world.tick)&&!this.hostPort.hidden();
    const reuseShadow=cacheEligible&&this.pausedShadow.canReuse(paused,this.camera,shadowLight,skyTick,this.pawns.blend.value,distant,this.viewportWidth,this.viewportHeight);
    const refreshShadow=!reuseShadow&&(paused||this.shadowRefresh.shouldRefresh(now,false));
    if(this.room)this.room.present(this.daylight.sample,this.camera,refreshShadow);
    else if(refreshShadow)this.daylight.fitShadow(this.camera);
    // Suppress pending continuous caster changes on skipped frames as well as
    // autoUpdate. The projection is kept with the atlas, not the live sun.
    shadow.autoUpdate=false;shadow.needsUpdate=refreshShadow;
    this.ownedOpaqueRevisions435?.preflight(this.camera,shadow);
    this.renderer.info.reset();
    this.hostPort.drawLabels(this.world, this.camera, cellPixels, this.viewportWidth, this.viewportHeight,this.environmentLighting.exploration.field.revision);
    if(this.graphicsMeasurement){
      const started=this.hostPort.now();
      try{this.renderScene();}catch(cause){this.cancelGraphicsMeasurement('render-failed');throw cause;}
      const submitted=this.hostPort.now();
      this.recordGraphicsMeasurement(submitted-started,submitted);
    }else this.renderScene();
    if(refreshShadow){
      const completed=!shadow.needsUpdate;this.shadowRefresh.capture(now,completed);
      if(cacheEligible)this.pausedShadow.capture(completed,this.camera,shadowLight,skyTick,this.pawns.blend.value,distant,this.viewportWidth,this.viewportHeight);
    }
    this.stats.drawCalls = this.renderer.info.render.drawCalls;
    this.stats.triangles = this.renderer.info.render.triangles;
    this.frames.record(now, this.hostPort.hidden());
    this.stats.fps = this.frames.fps;
    this.stats.frameMs = this.frames.meanMs;
    this.stats.frameP95 = this.frames.p95Ms;
  }

  private composeRoomBeforeRender(scene: THREE.Scene, camera: THREE.Camera): void {
    const room = this.armedRoom;
    // compileAsync also invokes scene callbacks; shadow renders reuse the scene.
    // Only the explicitly armed main draw may consume the prepared background.
    if (!room || room !== this.room || scene !== this.scene || camera !== this.camera) return;
    this.armedRoom = null;
    room.composeBackground(this.renderer);
  }

  protected renderScene(): void {
    this.staticSceneCompiler435?.syncVisibility();
    withPreparedSceneMatrices(this.scene,()=>{
    const room = this.room;
    if (!room) { this.renderer.render(this.scene, this.camera); return; }
    room.renderBackground(this.renderer, this.camera, this.controls.target, false);
    const autoClear = this.renderer.autoClear, target = this.renderer.getRenderTarget();
    this.armedRoom = room;
    this.renderer.autoClear = false;
    try { this.renderer.render(this.scene, this.camera); }
    finally {
      this.armedRoom = null;
      this.renderer.autoClear = autoClear;
      this.renderer.setRenderTarget(target);
    }
    });
  }

  protected moveCamera(dt: number): void {
    // The hidden management tables can contain hundreds of people. Avoid a
    // host-wide modal query every frame when there is no keyboard motion.
    if (!this.keys.size) return;
    if (!this.hostPort.canMoveCamera()) { this.keys.clear(); return; }
    let horizontal = 0, vertical = 0;
    if (this.keys.has('arrowleft') || this.keys.has('q') || this.keys.has('a')) horizontal--;
    if (this.keys.has('arrowright') || this.keys.has('d')) horizontal++;
    if (this.keys.has('arrowup') || this.keys.has('z') || this.keys.has('w')) vertical--;
    if (this.keys.has('arrowdown') || this.keys.has('s')) vertical++;
    if (!horizontal && !vertical) return;
    const forward = this.controls.target.clone().sub(this.camera.position).setY(0).normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const offset = right.multiplyScalar(horizontal).addScaledVector(forward, -vertical).normalize().multiplyScalar(dt * 12 * this.rig.span / (WORLD_SCALE.cameraSpan * 1.06));
    this.camera.position.add(offset); this.controls.target.add(offset);
  }

  protected pickAt(clientX:number,clientY:number, clampToMap = false): Cell | null {
    if (!this.world) return null;
    const rect = this.hostPort.surfaceRect();
    this.pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (!this.raycaster.ray.intersectPlane(this.ground, this.hit)) return null;
    let x = Math.floor(this.hit.x + 0.5), z = Math.floor(this.hit.z + 0.5);
    if (clampToMap) { x = THREE.MathUtils.clamp(x, 0, this.world.width - 1); z = THREE.MathUtils.clamp(z, 0, this.world.height - 1); }
    if (x < 0 || z < 0 || x >= this.world.width || z >= this.world.height) return null;
    return { x, z };
  }
  protected refreshAreaPointer():void {}
  private clearOrderTargets():void {
    this.resources.clearTargetPreview();this.crops.clearTargetPreview();this.plants.clearTargetPreview();
    this.boxes.clearTargetPreview();this.doors.clearTargetPreview();this.timber.clearTargetPreview();
    this.wind.clearTargetPreview();this.orderRockPreview.hide();
  }
  private updateOrderTargets(world:World,action:AreaAction,cells:readonly number[]):void {
    if(!['mine','chop','cut','harvest','deconstruct','haul-chunks','cancel'].includes(action)){this.clearOrderTargets();return;}
    this.orderTargetIndex??=new OrderTargetIndex(world);
    const targets=this.orderTargetIndex.select(action,cells.filter(i=>knownCell256(world,i)));
    this.resources.setTargetPreview(targets.resources);this.crops.setTargetPreview(targets.resources);this.plants.setTargetPreview(targets.resources);
    this.boxes.setTargetPreview(this.structureGroup,targets.structures);
    this.boxes.setTargetPreview(this.jobGroup,targets.jobs);
    for(const {group}of this.pileChunks.values())this.boxes.setTargetPreview(group,targets.chunks);
    this.doors.setTargetPreview(targets.structures);this.timber.setTargetPreview(targets.structures);this.wind.setTargetPreview(targets.structures);
    this.orderRockPreview.updateRock(world,[...targets.rocks]);
  }
  setDesignationMinCellPixels(value:number):void { this.designations.setMinCellPixels(value);this.wildlife.setDesignationMinCellPixels(value); }
  protected updateAreaPreview(): void {
    const drag = this.areaDrag, world = this.world, cell = this.hoverCell;
    if (!drag || !world) return;
    this.recreationHints.hide();this.turretRange.hide();this.turretPreviewVisible=false;this.turretPreviewSignature='';this.turretTintSurfaces=EMPTY_GROUND_OVERLAYS;
    try {
    if (!cell) {
      this.hover.visible = false; this.areaPreview.hide();this.constructionPreview.hide();
      this.surfaceTint.clearPreview();
      this.designations.clearPreview();
      this.clearOrderTargets();
      this.areaSignature = ''; this.onAreaPreview(null); return;
    }
    const action = 'allowed' in drag?drag.allowed?'allowed-expand':'allowed-shrink':'action' in drag ? drag.action : drag.kind;
    const signature = `${action}:${drag.from.x}:${drag.from.z}:${cell.x}:${cell.z}`;
    if (signature === this.areaSignature) return;
    this.areaSignature = signature;
    let bounds: { minX:number; maxX:number; minZ:number; maxZ:number }, cells: number[], skipped: number;
    if('allowed' in drag){
      bounds={minX:Math.min(drag.from.x,cell.x),maxX:Math.max(drag.from.x,cell.x),minZ:Math.min(drag.from.z,cell.z),maxZ:Math.max(drag.from.z,cell.z)};
      cells=[];for(let z=bounds.minZ;z<=bounds.maxZ;z++)for(let x=bounds.minX;x<=bounds.maxX;x++)cells.push(z*world.width+x);skipped=0;
    }else if ('action' in drag) {
      if(drag.action!=='allow'&&drag.action!=='forbid')this.areaIndex ??= buildAreaIndex(world);
      const result = queryArea(world, { type: 'area', action: drag.action, from: drag.from, to: cell, ...this.zoneTargetCommand(drag.action), ...(drag.action==='lay-floor'?{floor:this.selectedFloor}:{}) }, this.areaIndex);
      if (!result.ok) {this.hover.visible=false;this.areaPreview.hide();this.constructionPreview.hide();this.surfaceTint.clearPreview();this.designations.clearPreview();this.clearOrderTargets();this.onAreaPreview(null);return;}
      ({ bounds, cells, skipped } = result);
    } else {
      const line = constructionLineCells(drag.from, cell);
      const end = line[line.length-1]!;
      bounds = { minX:Math.min(drag.from.x,end.x), maxX:Math.max(drag.from.x,end.x), minZ:Math.min(drag.from.z,end.z), maxZ:Math.max(drag.from.z,end.z) };
      if (this.constructionIndex?.kind !== drag.kind) this.constructionIndex=buildConstructionCellIndex(world,drag.kind);
      const index=this.constructionIndex;
      cells = line.filter(position => canDesignate(world,{type:'designate',kind:drag.kind,...position,orientation:0,...(drag.material?{material:drag.material}:{})},false,index).ok)
        .map(position => position.z*world.width+position.x);
      skipped = line.length-cells.length;
    }
    const width = bounds.maxX - bounds.minX + 1, height = bounds.maxZ - bounds.minZ + 1;
    if ('kind' in drag || action === 'lay-floor' || action === 'build-roof' || action === 'build-bridge' || action === 'remove-bridge') {
      this.surfaceTint.clearPreview();
      this.designations.clearPreview();
      this.clearOrderTargets();
      const validCells = new Set(cells), valid: ConstructionPreviewSpec[] = [], invalid: ConstructionPreviewSpec[] = [];
      const positions = 'kind' in drag ? constructionLineCells(drag.from, cell)
        : Array.from({length:width*height},(_,i)=>({x:bounds.minX+i%width,z:bounds.minZ+Math.floor(i/width)}));
      for (const position of positions) {
        const spec:ConstructionPreviewSpec = { ...position, kind:action as ConstructionPreviewSpec['kind'], orientation:0,
          ...('kind' in drag && drag.material ? {material:drag.material} : {}),
          ...(action==='lay-floor'?{floor:this.selectedFloor??'wood-planks'}:{}) };
        (validCells.has(position.z*world.width+position.x)?valid:invalid).push(spec);
      }
      this.hover.visible=false;this.areaPreview.hide();
      this.constructionPreview.update(world,valid,invalid,this.wallCutaway);
      this.onAreaPreview({width,height,eligible:cells.length,skipped,line:'kind' in drag});return;
    }
    this.constructionPreview.hide();
    const color = 'allowed' in drag?(drag.allowed?world.allowedAreas?.find(a=>a.id===this.allowedAreaTarget)?.color??0x8bcef0:0xe6876a):areaPreviewColor(action as AreaAction,cells.length,skipped);
    this.hover.visible = true; this.hover.scale.set(width, height, 1);
    this.hover.position.set((bounds.minX + bounds.maxX) / 2, 0.075, (bounds.minZ + bounds.maxZ) / 2);
    const hoverMat = this.hover.material as THREE.MeshBasicNodeMaterial;
    hoverMat.opacity = 0.12; hoverMat.color.setHex(color);
    this.surfaceTint.setHover(this.hover.position.x,this.hover.position.z,width,height,color,.12);
    this.surfaceTint.setArea(world.width,bounds,cells,color);
    this.areaPreview.update(world.width,world.width*world.height,cells,color,world.snow?SNOW_OVERLAY_LIFT:0);
    if('allowed' in drag){this.designations.clearPreview();this.clearOrderTargets();}
    else {this.designations.updatePreview(world,action as AreaAction,cells);this.updateOrderTargets(world,action as AreaAction,cells);}
    this.onAreaPreview({ width, height, eligible: cells.length, skipped, line:'kind' in drag });
    } finally {this.refreshGroundOverlays();}
  }
  protected updateHover(): void {
    if(this.preparing)return;
    try {
    this.hostPort.title('');
    if (this.areaDrag) { this.updateAreaPreview(); return; }
    this.surfaceTint.clearPreview();
    if(this.world&&this.hoverCell&&!knownPosition256(this.world,this.hoverCell)){
      this.recreationHints.hide();this.turretRange.hide();this.clearOrderTargets();this.constructionPreview.hide();this.hover.visible=false;
      this.hostPort.title(this.tool==='mine'?'Miner cette zone':UNDISCOVERED_CELL_LABEL_256);return;
    }
    this.updateTurretPreview();
    const cell = this.hoverCell;
    this.recreationHints.update(this.world, cell && (this.tool==='horseshoes'||this.tool==='install'&&this.furniturePlacement?.kind==='horseshoes'||this.tool==='select'&&this.world?.structures.some(s=>s.kind==='horseshoes'&&s.x===cell.x&&s.z===cell.z)) ? cell : undefined,this.tool==='select');
    const television=this.tool==='select'?this.world?.structures.find(s=>s.kind==='tube-television'&&cell&&footprintCells(s).some(c=>c.x===cell.x&&c.z===cell.z)):undefined;
    if(this.world&&cell&&(this.tool==='tube-television'||television||this.tool==='install'&&this.furniturePlacement?.kind==='tube-television'))this.recreationHints.television(this.world,{...(television??cell),orientation:television?.orientation??this.placementRotation},this.tool==='select');
    const turbine=(this.tool==='wind-turbine'||this.tool==='install'&&this.furniturePlacement?.kind==='wind-turbine')&&cell?{...cell,orientation:this.placementRotation}:this.tool==='select'?this.world?.structures.find(s=>s.kind==='wind-turbine'&&cell&&footprintCells(s).some(c=>c.x===cell.x&&c.z===cell.z)):undefined;
    if(this.world&&turbine)this.recreationHints.wind(this.world,turbine,this.tool==='select');
    const vent=this.tool==='select'&&cell?this.world?.structures.find(s=>s.kind==='vent'&&s.x===cell?.x&&s.z===cell?.z):undefined;
    if(cell&&(this.tool==='vent'||vent))this.recreationHints.vent(cell,vent?.orientation??this.placementRotation,this.tool==='select'?this.world??undefined:undefined);
    const cooler=this.tool==='select'?this.world?.structures.find(s=>s.kind==='cooler'&&s.x===cell?.x&&s.z===cell?.z):undefined;
    if(cell&&(this.tool==='cooler'||cooler||this.tool==='install'&&this.furniturePlacement?.kind==='cooler'))this.recreationHints.cooler(cell,cooler?.orientation??this.placementRotation,this.tool==='select'?this.world??undefined:undefined);
    const sunLamp=this.tool==='select'?this.world?.structures.find(s=>s.kind==='sun-lamp'&&s.x===cell?.x&&s.z===cell?.z):undefined;
    if(this.world&&cell&&(this.tool==='sun-lamp'||sunLamp||this.tool==='install'&&this.furniturePlacement?.kind==='sun-lamp'))this.recreationHints.sunLamp(this.world,cell,this.tool==='select');
    this.hover.visible = !!cell&&this.tool!=='select';
    if(this.tool==='select'){this.constructionPreview.hide();this.hostPort.title('');return;}
    if (!cell || !this.world) {this.constructionPreview.hide();return;}
    if(this.tool==='replant-tree'){
      const pile=this.world.piles.find(p=>p.id===this.treePlacementId),reason=replantTreeReason(this.world,pile,cell);
      const valid=reason===undefined,color=valid?0x9dd9ca:0xe46f58,material=this.hover.material as THREE.MeshBasicNodeMaterial;
      this.hover.scale.set(1,1,1);this.hover.position.set(cell.x,(surfaceHeightAtCell(this.world,cell.x,cell.z)??0)+.055,cell.z);material.color.setHex(color);material.opacity=.55;
      this.surfaceTint.setHover(cell.x,cell.z,1,1,color,material.opacity);this.hostPort.title(reason??'Replanter cet arbre ici');
      if(pile&&isMinifiedTree(pile))this.constructionPreview.updateTree(this.world,pile.innerResource,cell,valid);else this.constructionPreview.hide();
      return;
    }
    const kind=this.tool==='install'&&this.furniturePlacement?this.furniturePlacement.kind:this.tool in STRUCTURE_DEFINITIONS?this.tool as JobKind:'wall';
    const cells = footprintCells({ ...cell, kind, orientation: this.placementRotation });
    const minX=Math.min(...cells.map(c=>c.x)),maxX=Math.max(...cells.map(c=>c.x)),minZ=Math.min(...cells.map(c=>c.z)),maxZ=Math.max(...cells.map(c=>c.z));
    this.hover.scale.set(maxX-minX+1, maxZ-minZ+1, 1);
    this.hover.position.set((minX+maxX)/2, (surfaceHeightAtCell(this.world,cell.x,cell.z)??0)+.055, (minZ+maxZ)/2);
    if(this.tool==='allowed-expand'||this.tool==='allowed-shrink'){
      const color=this.tool==='allowed-shrink'?0xe6876a:this.world.allowedAreas?.find(a=>a.id===this.allowedAreaTarget)?.color??0x8bcef0;
      const material=this.hover.material as THREE.MeshBasicNodeMaterial;material.color.setHex(color);material.opacity=.55;
      this.surfaceTint.setHover(cell.x,cell.z,1,1,color,material.opacity);this.constructionPreview.hide();return;
    }
    if (isAreaAction(this.tool) && this.tool!=='lay-floor' && this.tool!=='build-roof' && this.tool!=='build-bridge' && this.tool!=='remove-bridge') {
      let color=0x8bcef0;
      if(ZONE_TOOLS.has(this.tool)||this.tool==='allow'||this.tool==='forbid'){
        if(this.tool!=='allow'&&this.tool!=='forbid')this.areaIndex??=buildAreaIndex(this.world);
        const result=queryArea(this.world,{type:'area',action:this.tool,from:cell,to:cell,...this.zoneTargetCommand(this.tool)},this.areaIndex);
        color=areaPreviewColor(this.tool,result.ok?result.cells.length:0,result.ok?result.skipped:1);
      }
      const material=this.hover.material as THREE.MeshBasicNodeMaterial;material.color.setHex(color);material.opacity=.55;
      this.surfaceTint.setHover(this.hover.position.x,this.hover.position.z,this.hover.scale.x,this.hover.scale.y,color,material.opacity);
      this.constructionPreview.hide(); return;
    }
    const placeable=this.tool in STRUCTURE_DEFINITIONS||['mine','uninstall','deconstruct','chop','harvest','cut'].includes(this.tool);
    const validity = this.tool==='build-roof'?queryArea(this.world,{type:'area',action:'build-roof',from:cell,to:cell}):this.tool==='lay-floor'||this.tool==='remove-floor'||this.tool==='build-bridge'||this.tool==='remove-bridge'?canDesignate(this.world,{type:'designate',kind:this.tool,...cell,...this.tool==='lay-floor'?{floor:this.selectedFloor}:{}}):this.tool==='install'&&this.furniturePlacement?installCommand(this.world,{type:'install',structureId:this.furniturePlacement.id,...cell,orientation:['torch-lamp','sun-lamp','standing-lamp','small-sculpture','large-sculpture'].includes(this.furniturePlacement.kind)?0:this.placementRotation},true):placeable
      ? canDesignate(this.world, { type:'designate',kind:this.tool as JobKind,...cell,...(this.constructionMaterial?{material:this.constructionMaterial}:{}),orientation:this.tool==='mini-turret'||this.tool==='sandbags'||this.tool==='solar-generator'||this.tool==='geothermal-generator'||this.tool==='power-conduit'||this.tool==='power-switch'||this.tool==='wood-generator'||this.tool==='chemfuel-generator'||this.tool==='torch-lamp'||this.tool==='sun-lamp'||this.tool==='standing-lamp'||this.tool==='door'||this.tool==='autodoor'||this.tool==='passive-cooler'?0:this.placementRotation }) : undefined;
    const invalidPlacement=validity?.ok===false||this.tool==='build-roof'&&validity!==undefined&&'cells' in validity&&validity.cells.length===0;
    const color = invalidPlacement ? 0xe46f58 : this.tool === 'cancel' || this.tool === 'remove-stockpile' ? 0xe6876a : this.tool === 'select' ? 0xf9ebae : 0x9dd9ca;
    (this.hover.material as THREE.MeshBasicNodeMaterial).color.setHex(color);
    if (this.tool in STRUCTURE_DEFINITIONS || this.tool==='lay-floor'||this.tool==='build-roof'||this.tool==='build-bridge'||this.tool==='remove-bridge'||this.tool==='install'&&this.furniturePlacement) {
      const orientation:Orientation = this.tool==='install'
        ? ['torch-lamp','sun-lamp','standing-lamp','small-sculpture','large-sculpture'].includes(kind)?0:this.placementRotation
        : ['torch-lamp','mini-turret','sandbags','solar-generator','geothermal-generator','power-conduit','power-switch','wood-generator','chemfuel-generator','sun-lamp','standing-lamp','door','autodoor','passive-cooler'].includes(this.tool)?0:this.placementRotation;
      const spec:ConstructionPreviewSpec={...cell,kind:(this.tool==='install'?kind:this.tool) as ConstructionPreviewSpec['kind'],orientation,
        ...(this.constructionMaterial?{material:this.constructionMaterial}:{}),
        ...(this.tool==='lay-floor'?{floor:this.selectedFloor??'wood-planks'}:{}),
        ...(this.tool==='install'?{furniture:this.furniturePlacement}:{})};
      this.hover.visible=false;
      this.constructionPreview.update(this.world,invalidPlacement?[]:[spec],invalidPlacement?[spec]:[],this.wallCutaway);
    } else {this.constructionPreview.hide();
      const material=this.hover.material as THREE.MeshBasicNodeMaterial;material.opacity=.55;
      this.surfaceTint.setHover(this.hover.position.x,this.hover.position.z,this.hover.scale.x,this.hover.scale.y,color,material.opacity);
    }
    } finally {this.refreshGroundOverlays();}
  }
  dispose(): void {
    if (this.disposed) return;
    if(this.treeTextureTimer){clearTimeout(this.treeTextureTimer);this.treeTextureTimer=undefined;}
    if(this.sharedSurfacePreparation){
      if(!this.disposeAfterPreparation){
        this.closingPresentation=true;this.sharedSurfaceEpoch++;this.renderer.setAnimationLoop(null);
        const preparation=this.sharedSurfacePreparation;
        this.disposeAfterPreparation=preparation.catch(()=>{}).then(()=>{if(this.sharedSurfacePreparation===preparation)this.sharedSurfacePreparation=undefined;this.dispose();});
      }
      return;
    }
    this.closingPresentation=true;
    this.cancelGraphicsMeasurement('renderer-disposed');
    this.releaseCalmFullFrame297();this.presentation.clear();this.pendingCore297.length=0;this.latestCoreInput297=undefined;
    this.confirmedIntentReader?.clear();this.confirmedIntents=this.presentedIntentFields=undefined;
    this.confirmedJobMarkers.clear();this.confirmedJobsSource=undefined;
    this.armedRoom = null;
    this.diorama?.dispose(); this.diorama = null;
    this.room?.dispose(); this.room = null;
    this.hostPort.disposeSelection();
    if (this.hostPort.selectionReady() && this.rig && this.hover) this.cancelDesignation();
    this.areaPreview.dispose();
    this.turretRange.dispose();
    this.recreationHints.dispose();
    this.orderRockPreview.dispose();
    this.constructionPreview.dispose();
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.hostPort.disconnectResize();
    this.rig?.dispose();
    this.hostPort.removeInputListeners();
    this.ownedOpaqueRevisions435?.dispose();this.staticSceneCompiler435?.dispose();
    this.geysers.dispose();this.boxes.dispose();this.snowSurface.dispose();
    this.roofs.dispose();
    this.timber.dispose();
    this.hygiene.dispose();
    this.actionFeedback.dispose();
    this.actionVfx.dispose();
    this.brawlCloud.dispose();
    this.structureVfx.dispose();
    this.podRescue.dispose();this.orbitalDelivery.dispose();
    this.startingArrival.dispose();
    this.hostPort.disposeLabels();
    this.overview.dispose();
    this.deepResources.dispose();
    this.rocks.dispose();
    this.crops.dispose();
    this.plants.dispose();
    if(this.grass){this.grass.mesh.removeFromParent();this.grass.dispose();this.grass=null;}
    this.surfaceTint.dispose();
    this.resources.dispose();
    const treeCleanupErrors:unknown[]=[];
    for(const owner of [...(this.bakedTreeOwner?[this.bakedTreeOwner]:[]),...(this.quarantinedTreeCatalogs??[])])try{owner.dispose();}catch(error){treeCleanupErrors.push(error);}
    if(!treeCleanupErrors.length){this.bakedTreeOwner=undefined;this.quarantinedTreeCatalogs=undefined;}
    this.preparedNaturalPresentation.clear();
    this.sceneResources.clear();
    this.structurePreparation?.clear();this.preparedStructures=undefined;
    this.furniturePresentation.clear();this.structureSignature.clear();this.storageSignature.clear();this.homeSignature.clear();
    this.pawns.dispose();
    this.doors.dispose();this.projectiles.dispose();this.fires.dispose();this.wind.dispose();this.animalCargo.dispose();this.wildlife.dispose();this.mechanoids.dispose();this.ropes.dispose();this.designations.dispose();

    for (const group of [this.terrainGroup, this.resourceGroup, this.structureGroup, this.jobGroup, this.storageGroup, this.pileGroup]) clearGroup(group);
    this.pileChunks.clear();this.applicationContext?.clear();
    this.staticMaterial.dispose();
    this.terrainPlainMaterial.dispose();
    this.terrainPaintMaterial.dispose();this.terrainPaintTexture.dispose();this.terrainPaintStaging.dispose();
    this.texturedStaticMaterial.dispose();this.staticPaint.dispose();
    this.waterMaterial.dispose();
    this.paintedWater.dispose();
    this.clouds.dispose();
    this.precipitation.dispose();
    this.hover?.geometry.dispose(); (this.hover?.material as THREE.Material | undefined)?.dispose();
    this.objectSelection?.geometry.dispose();(this.objectSelection?.material as THREE.Material | undefined)?.dispose();
    this.daylight?.dispose();
    this.environmentLighting.dispose();
    this.graphicsStyle.dispose();
    this.renderer.onDeviceLost = () => {};
    this.renderer.onError = () => {};
    if (!this.rendererLifetime.closed) { this.rendererLifetime.closed = true; this.rendererDisposal=Promise.resolve(this.renderer.dispose()); }
    this.hostPort.removeSurface();
    if(treeCleanupErrors.length)throw new AggregateError(treeCleanupErrors,'Detached tree owner cleanup failed');
  }
}
