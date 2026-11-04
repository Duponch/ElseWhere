import * as THREE from 'three/webgpu';
import {attribute,positionLocal,uv} from 'three/tsl';
import {FLORA_DEFINITIONS,PLANT_SPECIES} from '../sim/biome-flora';
import {STRUCTURE_DEFINITIONS} from '../sim/definitions';
import {constructionMaterials} from '../sim/construction-materials';
import {ITEM_DEFINITIONS,type ItemId} from '../sim/items';
import {PLANT_DEFINITIONS,harvestable} from '../sim/plants';
import {FLOOR_DEFINITIONS,type FloorKind} from '../sim/flooring';
import {STONE_KINDS,STONE_LABELS} from '../sim/geology';
import {ORE_DEFINITIONS} from '../sim/ore';
import type {Resource,Structure,StructureKind,Tile} from '../sim/types';
import {buildingLabels} from '../ui/building-labels';
import {ResourceLayer} from '../render/ResourceLayer';
import {TreeBakeOwner,type OwnedTreeCatalog} from '../render/origami/TreeBakeOwner';
import {AtlasBuildQuarantineError} from '../render/origami/baked/atlas-cache';
import {PlantClusterLayer} from '../render/PlantClusterLayer';
import type {PreparedPlantAtlasStage} from '../render/origami/baked/plants/PlantAtlasSurface';
import {CropLayer} from '../render/CropLayer';
import {BoxBatches} from '../render/BoxBatches';
import {FurniturePresentation} from '../render/FurnitureLayer';
import {DoorLayer} from '../render/DoorLayer';
import {WindLayer} from '../render/WindLayer';
import {TimberCladdingLayer,timberCladdingParts} from '../render/TimberCladdingLayer';
import {doorLeafParts} from '../render/door-parts';
import {miniTurretTopPartsForStructure} from '../render/mini-turret-parts';
import {windBladeParts} from '../render/wind-blade-parts';
import {floorPartsForKind} from '../render/HygieneLayer';
import {bridgePartsForCell} from '../render/bridge-parts';
import {TERRAIN_COLORS,buildTerrain} from '../render/TerrainLayer';
import {RockLayer} from '../render/RockLayer';
import {ROCK_INDICES} from '../render/RockSurface';
import {geyserParts256} from '../render/GeyserLayer256';
import {ITEM_VISUAL_IDS} from '../render/item-presentation';
import {pileParts} from '../render/pile-parts';
import {createItemGeometry,ITEM_SHAPES,type ItemShape} from '../render/item-geometry';
import {createChunkGeometry,isSmallChunk} from '../render/chunk-shape';
import {createSandbagGeometry} from '../render/sandbag-parts';
import {createSurfaceMaterial} from '../render/SurfaceMaterials';
import {createStylizedSurfaceTexture} from '../render/stylized-surfaces';
import {withGraphicsStyle,type GraphicsStyleContext} from '../render/graphics-style';
import {ReferenceFloraLibrary} from '../render/origami/resource-flora';
import {compileNaturalSurfaceModels,naturalStroke} from '../render/surfaces/NaturalSurfaceModels';
import {applySharedPaintSurface} from '../render/surfaces/SharedPaintSurface';
import {attachFaceStrokeGpuRetirement} from '../render/surfaces/FaceStrokeTable';
import type {Placement} from '../render/primitives';
import {mergedInstances,type ResourceRangeData} from '../render/StaticGeometry';
import type {CatalogCollection,CatalogItem,CatalogSection,CatalogStatus} from './asset-catalog-types';

/** Only the inputs read by the readonly presentation factories below. Empty
 * owner lists disable unrelated contextual attachments. These records are not
 * admitted simulation state and have neither a clock owner nor persistence. */
interface PreviewEnvironmentRecord {
  schemaVersion:number;seed:number;width:number;height:number;tick:number;
  resources:Resource[];structures:Structure[];tiles:Tile[];
  jobs:never[];piles:never[];packed:never[];growingZones:never[];pawns:never[];
  animals:never[];research:never[];beds:never[];items:never[];home:never[];stockpiles:never[];
  site:{biome:'temperate-forest'};filth:{items:never[]};
}
function presentationRecord(width:number,height:number,resources:Resource[]=[],structures:Structure[]=[]):PreviewEnvironmentRecord {
  return {schemaVersion:301,seed:123,width,height,tick:0,resources,structures,
    tiles:Array.from({length:width*height},():Tile=>({terrain:'soil'})),
    jobs:[],piles:[],packed:[],growingZones:[],pawns:[],animals:[],research:[],beds:[],items:[],home:[],stockpiles:[],
    site:{biome:'temperate-forest'},filth:{items:[]},
  };
}
/** Adapter for existing presentation signatures: preserves the actual producer
 * and its receiver, without claiming this partial record is a valid World. */
function previewCall<T>(owner:object|undefined,producer:(...args:never[])=>T,record:PreviewEnvironmentRecord,...args:unknown[]):T {
  return Reflect.apply(producer,owner,[record,...args]);
}

const ITEM_KIND_LABELS:Readonly<Record<string,string>>={
  'ai-core':'Cœurs d’IA',book:'Livres',prosthesis:'Prothèses',wort:'Moût',beer:'Bière',jade:'Jade',plant:'Végétaux transportables',
  chemfuel:'Biocarburant',neutroamine:'Neutroamine',silver:'Argent',wood:'Bois',food:'Nourriture',chunk:'Fragments rocheux',steel:'Acier',gold:'Or',uranium:'Uranium',plasteel:'Plastacier',
  'advanced-component':'Composants avancés',blocks:'Blocs taillés',component:'Composants',medicine:'Médicaments',weapon:'Armes',apparel:'Vêtements et armures',textile:'Textiles et cuirs',unfinished:'Objets inachevés',
};
function section(id:string,label:string,note:string):CatalogSection{return {id,label,note,group:new THREE.Group(),items:[],missing:[]};}
function item(id:string,label:string,status:CatalogStatus,bounds:THREE.Box3,note?:string):CatalogItem {
  const position=bounds.getCenter(new THREE.Vector3());position.y=bounds.max.y+.15;
  return {id,label,status,note,position,bounds};
}

/** Places already-authored, isolated preview groups by actual local bounds. */
class ShelfLayout {
  private x=0;private z=0;private rowDepth=0;
  constructor(private readonly maxWidth=48,private readonly gap=1.6){}
  add(group:THREE.Group,bounds:THREE.Box3):THREE.Box3 {
    const size=bounds.getSize(new THREE.Vector3()),width=Math.max(.8,size.x),depth=Math.max(.8,size.z);
    if(this.x>0&&this.x+width>this.maxWidth){this.x=0;this.z+=this.rowDepth+this.gap;this.rowDepth=0;}
    const translation=new THREE.Vector3(this.x-bounds.min.x,-Math.min(0,bounds.min.y),this.z-bounds.min.z);
    group.position.add(translation);this.x+=width+this.gap;this.rowDepth=Math.max(this.rowDepth,depth);
    return bounds.clone().translate(translation);
  }
}

/** Bounds use the same real shape factories as the batches; no replacement
 * model is drawn for missing definitions. These temporary shapes are CPU only. */
class PlacementBounds {
  private readonly shapes=new Map<string,THREE.BufferGeometry>();
  private readonly object=new THREE.Object3D();
  add(bounds:THREE.Box3,p:Placement,geometry?:THREE.BufferGeometry):void {
    let shape=geometry;
    if(!shape){
      const key=p.shape==='rounded-rock'?(isSmallChunk(p.key,p.sx)?'small-rock':'rounded-rock'):p.shape??'box';
      shape=this.shapes.get(key);
      if(!shape){shape=key==='box'?new THREE.BoxGeometry(1,1,1):key==='sandbag'?createSandbagGeometry():key==='rounded-rock'||key==='small-rock'?createChunkGeometry(key==='small-rock'):(ITEM_SHAPES as readonly string[]).includes(key)?createItemGeometry(key as ItemShape):new THREE.BoxGeometry(1,1,1);shape.computeBoundingBox();this.shapes.set(key,shape);}
    }
    shape.computeBoundingBox();
    this.object.position.set(p.x,p.y,p.z);this.object.rotation.set(0,p.ry??0,0);this.object.scale.set(p.sx??1,p.sy??1,p.sz??1);this.object.updateMatrix();
    bounds.union(shape.boundingBox!.clone().applyMatrix4(this.object.matrix));
  }
  parts(parts:readonly Placement[]):THREE.Box3{const bounds=new THREE.Box3();for(const p of parts)this.add(bounds,p);return bounds;}
  dispose():void{for(const shape of this.shapes.values())shape.dispose();this.shapes.clear();}
}

function resourceBounds(group:THREE.Group):Map<number,THREE.Box3> {
  const byId=new Map<number,THREE.Box3>(),point=new THREE.Vector3();
  group.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||object.userData.referenceCompanion)return;
    const data=object.userData.resourceRanges as ResourceRangeData|undefined;if(!data)return;
    const positions=object.geometry.getAttribute('position');
    for(const range of data.ranges){const id=range.id<0?Math.floor(-range.id/2):range.id,bounds=byId.get(id)??new THREE.Box3();
      for(let i=range.vertexStart;i<range.vertexStart+range.vertexCount;i++)bounds.expandByPoint(point.fromBufferAttribute(positions,i));byId.set(id,bounds);
    }
  });return byId;
}
function instanceBounds(mesh:THREE.InstancedMesh,slot:number):THREE.Box3 {
  mesh.geometry.computeBoundingBox();const transform=new THREE.Matrix4();mesh.getMatrixAt(slot,transform);return mesh.geometry.boundingBox!.clone().applyMatrix4(transform);
}

/** The same game tree owner, attached to an existing gallery ResourceLayer.
 * Caller must hold the renderer and detach Source before terminal disposal. */
export function createCatalogTreePreparation(context:GraphicsStyleContext,resources:ResourceLayer,refreshInventory:()=>void){
    let disposed=false,preparingTrees=false,treeGeneration=0,treeOwner:TreeBakeOwner|undefined,treeFallback:string|undefined;const quarantinedTrees=new Set<OwnedTreeCatalog>();
    return {
      treeStatus:()=>({layer:resources.bakedTreeStatus(),cache:treeOwner?.snapshot()??null,reason:treeFallback??null,scope:'Same TreeBakeOwner/ResourceLayer as the game; isolated presentation records and actual stock gallery lights, no Core/World or simulation.'}),
      invalidatePreparedTrees(){if(disposed)return;if(preparingTrees)throw Error('Catalog trees are still preparing');treeGeneration++;if(treeOwner){const transaction=resources.setTreeAssetCatalog(undefined);transaction.commit();treeOwner.invalidate();}treeFallback=undefined;refreshInventory();},
      async prepareTrees(renderer:THREE.WebGPURenderer,camera:THREE.Camera,lightingScene:THREE.Scene,assertPreparationCurrent:()=>void){
        if(disposed||preparingTrees)throw Error('Catalog tree preparation is unavailable');
        if(!context.origami||context.reliefEnabled||context.wearEnabled){treeFallback='positive-effects-or-default-style';return;}
        if(Reflect.get(renderer.backend,'isWebGPUBackend')!==true){treeFallback='webgpu-required';return;}
        const demand=resources.treeBakeDemand();if(!demand.models.length)return;
        const MiB=1024*1024,owner=treeOwner??=new TreeBakeOwner({cpuBytes:128*MiB,gpuBytes:512*MiB});if(!owner.needsPreparation(demand))return;
        const paint=context.prepareAtlasPaint();preparingTrees=true;const generation=treeGeneration;let published=false,candidate:OwnedTreeCatalog|undefined,staging:ReturnType<ResourceLayer['prepareTreeAssetCatalog']>|undefined;
        const assertCurrent=()=>{assertPreparationCurrent();paint.assertCurrent();if(disposed||generation!==treeGeneration||!demand.isCurrent())throw Error('Catalog tree preparation superseded');};
        try{
          assertCurrent();candidate=await owner.prepare(renderer,context,demand,paint,assertCurrent);assertCurrent();if(!candidate)return;
          // The same persistent Lambert graph uses the actual gallery lights.
          staging=resources.prepareTreeAssetCatalog(candidate,()=>{});const warmup=new THREE.Group();warmup.add(...staging.warmup);
          await renderer.compileAsync(warmup,camera,lightingScene);assertCurrent();
          const transaction=staging.publish();published=true;
          try{transaction.commit();const retired=owner.adopt(candidate);retired?.dispose();candidate=undefined;}
          catch(error){throw new AggregateError([error],'Catalog tree publication transfer failed');}
          treeFallback=undefined;refreshInventory();
        }catch(error){if(error instanceof AggregateError||error instanceof AtlasBuildQuarantineError){if(candidate){quarantinedTrees.add(candidate);candidate=undefined;}throw error;}assertCurrent();owner.refuse(demand,error);treeFallback=error instanceof Error?error.message:String(error);refreshInventory();}
        finally{preparingTrees=false;const errors:unknown[]=[];try{staging?.dispose();}catch(error){errors.push(error);}if(candidate&&published)quarantinedTrees.add(candidate);else try{candidate?.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Catalog tree staged cleanup failed');}
      },
      get preparing(){return preparingTrees;},
      dispose(){if(disposed)return;if(preparingTrees)throw Error('Wait for catalog tree preparation before disposal');disposed=true;treeGeneration++;const errors:unknown[]=[];for(const owner of [...quarantinedTrees,...(treeOwner?[treeOwner]:[])])try{owner.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Catalog tree owner cleanup failed');},
    };
}

/** The unbound reference still uses its real seven source parts. Its model,
 * face addresses and Lambert body survive every texture change. Only the
 * optional physical wear owns a separate, strictly-positive effect resource. */
export function createCatalogReferenceAcacia(context:GraphicsStyleContext){
 const library=new ReferenceFloraLibrary(false,false),recipe=library.recipe('acacia'),models=compileNaturalSurfaceModels(recipe.parts.map(part=>part.geometry)),group=new THREE.Group(),material=createSurfaceMaterial('diffuse',0xffffff,{vertexColors:false});
 material.userData.rendererOwned=true;
 const paintOwner=`catalog-reference-acacia:${group.uuid}`;context.requirePaint(paintOwner,recipe.parts.map(part=>part.profileId));
 const body=mergedInstances(group,recipe.parts.map((part,index)=>({geometry:models.geometries[index]!.clone(),items:[{x:0,y:0,z:0,key:index,color:part.baseColor,referenceColor:part.baseColor,profile:part.profileId,rawGeometry:true}]})),material,true,true,true)!;
 const paint=attribute('origamiPaint','vec4'),profile=paint.w.mod(128),surface=attribute('surfaceUv','vec4');
 applySharedPaintSurface(material,{context,base:attribute('color','vec3'),pastel:attribute('color','vec3'),faceUv:surface.xy,profile,includeGeneric:true,stroke:naturalStroke(context,models.stroke,paint.w.div(128).floor(),surface.zw)});
 body.name='Reference acacia — shared opaque surface';body.geometry.computeBoundingBox();
 let wear:THREE.Mesh|undefined,wearMaterial:THREE.MeshStandardNodeMaterial|undefined,wearLibrary:ReferenceFloraLibrary|undefined,releaseWear:(()=>void)|undefined,closed=false;
 const clearWear=()=>{releaseWear?.();releaseWear=undefined;wear?.removeFromParent();wear?.geometry.dispose();wear=undefined;wearMaterial?.dispose();wearMaterial=undefined;wearLibrary?.dispose();wearLibrary=undefined;};
 const refreshWear=()=>{
  clearWear();if(!context.wearEnabled)return;
  wearLibrary=new ReferenceFloraLibrary(true,true);const parts=wearLibrary.recipe('acacia').parts;
  wearMaterial=context.createWearMaterial(positionLocal.add(attribute('origamiWearExpand','vec3').mul(context.contourSpan)),uv());wearMaterial.userData.rendererOwned=true;
  wear=mergedInstances(group,parts.filter(part=>part.wear).map(part=>({geometry:part.wear!.clone(),items:[{x:0,y:0,z:0}]})),wearMaterial,false,true,true);
  if(wear){wear.name='Reference acacia — optional physical wear';releaseWear=context.trackEdgeObject(wear,'wear');}
 };
 refreshWear();const releaseRefresh=context.trackSharedSurfaceRefresh(refreshWear);
 return{group,body,bounds:body.geometry.boundingBox!.clone(),dispose(){if(closed)return;closed=true;releaseRefresh();clearWear();attachFaceStrokeGpuRetirement(models.stroke,[body.geometry]);body.removeFromParent();body.geometry.dispose();material.dispose();models.dispose();library.dispose();context.releasePaint(paintOwner);}};
}

export function createEnvironmentAssetCatalog(context:GraphicsStyleContext):CatalogCollection {
  return withGraphicsStyle(context,()=>{
    const sections:CatalogSection[]=[],dispose:(()=>void)[]=[],boundsReader=new PlacementBounds();
    const paint=createStylizedSurfaceTexture('vegetation');
    const plain=createSurfaceMaterial('diffuse',0xffffff,{vertexColors:true});
    const painted=createSurfaceMaterial('diffuse',0xffffff,{vertexColors:true,map:paint});
    plain.userData.rendererOwned=painted.userData.rendererOwned=true;
    const boxes=new BoxBatches();dispose.push(()=>boxes.dispose(),()=>plain.dispose(),()=>painted.dispose(),()=>paint.dispose());

    // All wild species, including the two actual resident grass batches.
    const wild=section('plants-wild','Végétation sauvage','Toutes les espèces du catalogue, à maturité. Les deux textures partagent les mêmes modèles.');
    const plants:Resource[]=PLANT_SPECIES.map((species,index)=>({id:1000+index,kind:FLORA_DEFINITIONS[species].kind,species,x:4+(index%8)*7,z:4+Math.floor(index/8)*7,amount:1,growth:1}));
    const wildRecord=presentationRecord(64,40,plants),resourceGroup=new THREE.Group(),resources=new ResourceLayer(resourceGroup,plain,painted,undefined,{pastelTexture:paint,configure:()=>{}}),clusters=new PlantClusterLayer(plain,painted,undefined,paint);wild.group.add(resourceGroup,clusters.group);
    previewCall(resources,resources.update,wildRecord,true,undefined,undefined,{read:()=>({size:1,ripe:true,leafless:false}),harvestable:(r:Resource)=>previewCall(undefined,harvestable,wildRecord,r)});previewCall(clusters,clusters.update,wildRecord,true);
    const clusterSlots=Reflect.get(clusters,'slots') as Map<number,{index:number}>,clusterMesh=Reflect.get(clusters,'mesh') as THREE.InstancedMesh;
    const refreshWildInventory=()=>{
    const byId=resourceBounds(wild.group);
    wild.items.length=0;wild.missing!.length=0;
    for(const plant of plants){const slot=clusterSlots.get(plant.id);if(slot)byId.set(plant.id,instanceBounds(clusterMesh,slot.index));const bounds=byId.get(plant.id);
      if(!bounds||bounds.isEmpty()){wild.missing!.push({id:plant.species!,label:FLORA_DEFINITIONS[plant.species!].label,reason:'Aucun modèle affichable produit pour cette espèce.'});continue;}
      const status:CatalogStatus=context.origami?'origami':'default';
      wild.items.push(item(`plant:${plant.species}`,FLORA_DEFINITIONS[plant.species!].label,status,bounds,'Modèle commun ; texture et contours selon les options.'));
    }
    };refreshWildInventory();
    sections.push(wild);dispose.push(()=>resources.dispose(),()=>clusters.dispose());

    // A source asset already authored in the reference module, deliberately
    // unbound to any simulation species. The recipe compiles the same seven
    // source parts and their physical face-coplanar wear, without a Resource.
    const unbound=section('plants-unbound','Végétation — référence non encore liée','Modèle source disponible, sans espèce correspondante dans le catalogue du jeu.');
    const acacia=createCatalogReferenceAcacia(context),referenceBounds=new ShelfLayout(28).add(acacia.group,acacia.bounds);unbound.group.add(acacia.group);
    unbound.items.push(item('reference:acacia','Acacia — référence non encore liée','reference',referenceBounds,'Sept pièces originales et surfaces communes ; aucune espèce ajoutée au jeu.'));
    sections.push(unbound);dispose.push(()=>acacia.dispose());

    // Six resident crops plus the existing medicinal-plant resource recipe.
    const crops=section('plants-crops','Cultures','Les sept cultures existantes, sans semis ni progression du temps.');
    const cropKinds=['rice','potato','corn','cotton','haygrass','hops','healroot'] as const;
    const cropRecords:Resource[]=cropKinds.map((kind,index)=>({id:2000+index,kind,x:2+index*3,z:2,amount:1,growth:1}));
    const cropRecord=presentationRecord(24,6,cropRecords),cropLayer=new CropLayer(plain,painted,paint),medicinalGroup=new THREE.Group(),medicinal=new ResourceLayer(medicinalGroup,plain,painted,undefined,{pastelTexture:paint,configure:()=>{}});crops.group.add(medicinalGroup,cropLayer.group);
    previewCall(cropLayer,cropLayer.update,cropRecord,true);previewCall(medicinal,medicinal.update,cropRecord,true,undefined,undefined,{read:()=>({size:1,ripe:true,leafless:false}),harvestable:(r:Resource)=>previewCall(undefined,harvestable,cropRecord,r)});
    const cropBounds=resourceBounds(crops.group),cropBatches=Reflect.get(cropLayer,'batches') as {kind:string;mesh:THREE.InstancedMesh;slots:Map<number,number>}[];
    for(const resource of cropRecords){const batch=cropBatches.find(candidate=>candidate.kind===resource.kind),slot=batch?.slots.get(resource.id);if(batch&&slot!==undefined)cropBounds.set(resource.id,instanceBounds(batch.mesh,slot));
      const bounds=cropBounds.get(resource.id);if(bounds&&!bounds.isEmpty())crops.items.push(item(`crop:${resource.kind}`,PLANT_DEFINITIONS[resource.kind as keyof typeof PLANT_DEFINITIONS].label,context.origami?'origami':'default',bounds,'Modèle de culture commun aux deux textures.'));
      else crops.missing!.push({id:resource.kind,label:resource.kind,reason:'Aucune géométrie de culture produite.'});
    }
    sections.push(crops);dispose.push(()=>cropLayer.dispose(),()=>medicinal.dispose());

    // Each definition gets its complete real static assembly and representative
    // permitted stuff. Shared BoxBatches are namespaced, not recreated per asset.
    const buildings=section('buildings','Constructions et mobilier','Une représentation par définition, avec un matériau autorisé. Portes fermées, machines inactives ; les effets passagers sont exclus.');
    const buildingLayout=new ShelfLayout(56,2),buildingKinds=Object.keys(STRUCTURE_DEFINITIONS) as StructureKind[];
    for(const [ordinal,kind]of buildingKinds.entries()){
      const label=buildingLabels[kind];
      if(kind==='insect-hive'||kind==='glow-pod'){buildings.missing!.push({id:`building:${kind}`,label,reason:'Définition présente ; pas d’aperçu dédié disponible dans ce catalogue.'});continue;}
      const permitted=constructionMaterials(kind),material=permitted.includes('wood')?'wood':permitted.includes('steel')?'steel':permitted.includes('cloth')?'cloth':permitted[0];
      const structure:Structure={id:3000+ordinal,kind,x:8,z:8,orientation:0,footprint:'standard',...(material?{material}:{}),power:{on:false,parentId:null},...(kind==='door'||kind==='autodoor'||kind==='fence-gate'?{door:{open:false,holdOpen:false,forbidden:false,changedAt:0,from:0,closeAt:null,lastTouch:-12}}:{})};
      const record=presentationRecord(24,24,[],[structure]),group=new THREE.Group(),captured:Placement[]=[];
      const presentation=new FurniturePresentation();
      const sink:Pick<BoxBatches,'set'|'furnitureStamp'|'patchFurniture'|'patchFurnitureBatch'>={
        set(target,key,parts,style='solid',shadows=true){captured.push(...parts);if(parts.length)boxes.set(target,key==='sandbags'?'sandbags':`catalog:${kind}:${key}`,parts,style,shadows);},
        furnitureStamp:()=>boxes.furnitureStamp(),patchFurniture:()=>false,patchFurnitureBatch:()=>false,
      };
      previewCall(presentation,presentation.update,record,group,false,sink);presentation.clear();
      const bounds=boundsReader.parts(captured);
      if(kind==='wall'&&material==='wood'){
        const timber=new TimberCladdingLayer();previewCall(timber,timber.update,record,false,true);group.add(timber.group);dispose.push(()=>timber.dispose());
        const parts=previewCall(undefined,timberCladdingParts,record,false);for(const p of parts.walls)boundsReader.add(bounds,p,timber.wallGeometry);for(const p of parts.eaves)boundsReader.add(bounds,p,timber.eaveGeometry);
      }
      if(kind==='door'||kind==='autodoor'||kind==='fence-gate'){
        const doors=new DoorLayer();previewCall(doors,doors.update,record,false,true);doors.present(0);group.add(doors.group);dispose.push(()=>doors.dispose());for(const p of previewCall(undefined,doorLeafParts,record,false))boundsReader.add(bounds,p);
      }
      if(kind==='mini-turret'){
        const top=miniTurretTopPartsForStructure(structure);boxes.set(group,'catalog:turret-top',top);for(const p of top)boundsReader.add(bounds,p);
      }
      if(kind==='wind-turbine'){
        const wind=new WindLayer();previewCall(wind,wind.adopt,record,true);wind.present(0);group.add(wind.group);dispose.push(()=>wind.dispose());
        for(const p of windBladeParts(structure)){
          const matrix=new THREE.Matrix4().makeTranslation(p.x,p.y,p.z).multiply(new THREE.Matrix4().makeRotationY(p.ry??0)).multiply(new THREE.Matrix4().makeRotationZ(p.rz)).multiply(new THREE.Matrix4().makeScale(p.sx!,p.sy!,p.sz!));
          bounds.union(new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5)).applyMatrix4(matrix));
        }
      }
      if(bounds.isEmpty()){buildings.missing!.push({id:`building:${kind}`,label,reason:'Les constructeurs graphiques n’ont produit aucun assemblage visible.'});continue;}
      const placed=buildingLayout.add(group,bounds);buildings.group.add(group);
      const stuff=material?` · ${ITEM_DEFINITIONS[material as ItemId]?.label??material}`:'';
      const status:CatalogStatus=context.origami?'origami':'default';
      buildings.items.push(item(`building:${kind}`,label+stuff,status,placed,'Forme habituelle commune aux deux textures ; peinture et contours selon les options.'));
    }
    sections.push(buildings);

    // All non-corpse item IDs, including every chunk, stack, weapon and textile.
    // Dedicated actor corpse rigs are supplied by the actor catalog collection.
    const itemKinds=[...new Set(ITEM_VISUAL_IDS.map(id=>ITEM_DEFINITIONS[id].kind))];
    for(const kind of itemKinds){
      const entry=section(`items-${kind}`,ITEM_KIND_LABELS[kind]??kind,'Tous les objets de ce type ; formes et empilements réels, sans inventaire de colonie.');
      const ids=ITEM_VISUAL_IDS.filter(id=>ITEM_DEFINITIONS[id].kind===kind),placements:Placement[]=[];const layout=new ShelfLayout(28,1.5);
      for(const id of ids){
        const definition=ITEM_DEFINITIONS[id],parts=pileParts([{x:0,z:0,kind:definition.kind,item:id,quantity:definition.stackLimit,supplied:false}]);
        const bounds=boundsReader.parts(parts);
        if(bounds.isEmpty()){entry.missing!.push({id:`item:${id}`,label:definition.label,reason:'Aucun modèle d’objet produit.'});continue;}
        const anchor=new THREE.Group(),placed=layout.add(anchor,bounds),offset=anchor.position;
        placements.push(...parts.map(p=>({...p,x:p.x+offset.x,y:p.y+offset.y,z:p.z+offset.z})));
        entry.items.push(item(`item:${id}`,definition.label,context.origami?'origami':'default',placed,'Forme d’objet commune aux deux textures.'));
      }
      if(placements.length)boxes.set(entry.group,`pile:catalog:${kind}`,placements);sections.push(entry);
    }

    const surfaces=section('surfaces-built','Sols, pavages et pont','Échantillons des revêtements existants, disposés sur une grille de catalogue.');
    const surfaceLayout=new ShelfLayout(28,1.2),surfaceParts:Placement[]=[];
    for(const floor of Object.keys(FLOOR_DEFINITIONS) as FloorKind[]){
      const parts=floorPartsForKind(floor,0,0),bounds=boundsReader.parts(parts),anchor=new THREE.Group(),placed=surfaceLayout.add(anchor,bounds),offset=anchor.position;
      surfaceParts.push(...parts.map(p=>({...p,x:p.x+offset.x,y:p.y+offset.y,z:p.z+offset.z})));
      surfaces.items.push(item(`floor:${floor}`,FLOOR_DEFINITIONS[floor].label,'default',placed));
    }
    {const parts=bridgePartsForCell(0,0),bounds=boundsReader.parts(parts),anchor=new THREE.Group(),placed=surfaceLayout.add(anchor,bounds),offset=anchor.position;surfaceParts.push(...parts.map(p=>({...p,x:p.x+offset.x,y:p.y+offset.y,z:p.z+offset.z})));surfaces.items.push(item('surface:bridge','Pont en bois','default',placed));}
    boxes.set(surfaces.group,'catalog:surfaces',surfaceParts);sections.push(surfaces);

    // Small, manually selected one-cell samples, never a generated landscape.
    const terrains=section('surfaces-natural','Surfaces naturelles','Une case isolée par surface ; aucune carte ni paysage n’est généré.');
    const terrainLayout=new ShelfLayout(28,1.2),terrainMaterial=createSurfaceMaterial('diffuse',0xffffff,{vertexColors:true}),waterMaterial=createSurfaceMaterial('physical',0xffffff,{vertexColors:true,roughness:.45,metalness:.08});
    terrainMaterial.userData.rendererOwned=waterMaterial.userData.rendererOwned=true;dispose.push(()=>terrainMaterial.dispose(),()=>waterMaterial.dispose());
    for(const terrain of Object.keys(TERRAIN_COLORS) as Tile['terrain'][]){
      const record=presentationRecord(1,1);record.tiles[0]={terrain,stone:'granite'};
      const group=new THREE.Group();previewCall(undefined,buildTerrain,record,group,terrainMaterial,waterMaterial,false);
      const bounds=new THREE.Box3().setFromObject(group),placed=terrainLayout.add(group,bounds);terrains.group.add(group);
      terrains.items.push(item(`terrain:${terrain}`,terrain,'default',placed));
      dispose.push(()=>{group.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});group.clear();});
    }
    sections.push(terrains);

    // The exact RockLayer cell/pigment writers, without its map-sized basal slab.
    const rocks=section('rocks-minerals','Roches et minerais','Cinq roches naturelles et sept minerais, exposés séparément.');
    const rockLayout=new ShelfLayout(28,1.6),rockLayer=new RockLayer();
    const rockCases=[...STONE_KINDS.map(stone=>({id:stone,label:STONE_LABELS[stone],tile:{terrain:'rock',stone} as Tile})),...Object.entries(ORE_DEFINITIONS).map(([ore,definition])=>({id:ore,label:definition.label,tile:{terrain:'rock',ore} as Tile}))];
    // One real sparse RockLayer supplies the model, material and stroke bank.
    // Views omit its basal slab without substituting a material that expects
    // different vertex fields. The partial record remains a preview adapter.
    const rockRecord=presentationRecord(3,rockCases.length*3);
    rockCases.forEach((sample,index)=>{rockRecord.tiles[(index*3+1)*3+1]=sample.tile;});
    previewCall(rockLayer,rockLayer.update,rockRecord,true);
    const source=rockLayer.mesh.geometry,sourceIndex=source.index!,point=new THREE.Vector3(),rockViews:THREE.BufferGeometry[]=[];
    if(rockLayer.stats.indexCount!==36+rockCases.length*ROCK_INDICES)throw Error('Isolated catalog rock slots differ from actual writer output');
    for(const [index,sample]of rockCases.entries()){
      const geometry=new THREE.BufferGeometry();for(const[name,a]of Object.entries(source.attributes))geometry.setAttribute(name,a);
      const indices=Uint32Array.from({length:ROCK_INDICES},(_,i)=>sourceIndex.getX(36+index*ROCK_INDICES+i));geometry.setIndex(new THREE.BufferAttribute(indices,1));
      const bounds=new THREE.Box3(),positions=geometry.getAttribute('position');for(const vertex of indices)bounds.expandByPoint(point.fromBufferAttribute(positions,vertex));geometry.boundingBox=bounds;geometry.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
      rockViews.push(geometry);const group=new THREE.Group(),mesh=new THREE.Mesh(geometry,rockLayer.mesh.material);mesh.name='Catalog rock — shared sparse source';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
      const placed=rockLayout.add(group,bounds);rocks.group.add(group);rocks.items.push(item('rock:'+sample.id,sample.label,'default',placed));
    }
    dispose.push(()=>{rockLayer.attachSurfaceGpuRetirement(rockViews);for(const geometry of rockViews)geometry.dispose();rockLayer.dispose();});

    sections.push(rocks);
    const naturalProps=section('natural-objects','Objets naturels','Modèles naturels fixes ; les effets passagers sont exclus.');
    const geyserParts=geyserParts256([{id:5000,x:0,z:0}]),geyserGroup=new THREE.Group(),geyserBounds=boundsReader.parts(geyserParts);
    boxes.set(geyserGroup,'catalog:natural-geyser',geyserParts);const geyserPlaced=new ShelfLayout(28).add(geyserGroup,geyserBounds);naturalProps.group.add(geyserGroup);
    naturalProps.items.push(item('natural:geyser','Geyser naturel','default',geyserPlaced));sections.push(naturalProps);
    boundsReader.dispose();
    let disposed=false,preparingPlants=false;const treePreparation=createCatalogTreePreparation(context,resources,refreshWildInventory);
    const stagePlants=async(renderer:THREE.WebGPURenderer,camera:THREE.Camera,lightingScene:THREE.Scene,assertCurrent:()=>void):Promise<PreparedPlantAtlasStage|undefined>=>{
      if(disposed||preparingPlants)throw Error('Catalog plants preparation unavailable');if(Reflect.get(renderer.backend,'isWebGPUBackend')!==true||!context.origami||context.reliefEnabled||context.wearEnabled||!clusters.hasPendingAtlasResources())return;
      preparingPlants=true;let stage:PreparedPlantAtlasStage|undefined,delivered=false;
      try{stage=await clusters.prepareAtlasResources(renderer,context.prepareAtlasPaint(),assertCurrent);assertCurrent();if(!stage)return;await renderer.compileAsync(clusters.group,camera,lightingScene);assertCurrent();const prepared=stage;stage=undefined;delivered=true;let closed=false;return{commit:()=>prepared.commit(),rollback:()=>prepared.rollback(),dispose:()=>{if(closed)return;closed=true;try{prepared.dispose();}finally{preparingPlants=false;}}};}
      catch(error){stage?.rollback();throw error;}finally{if(!delivered){try{stage?.dispose();}finally{preparingPlants=false;}}}
    };
    return {sections,stagePlants,prepareTrees:treePreparation.prepareTrees,invalidatePreparedTrees:treePreparation.invalidatePreparedTrees,treeStatus:treePreparation.treeStatus,dispose(){if(disposed)return;if(treePreparation.preparing||preparingPlants)throw Error('Wait for catalog surface preparation before disposal');disposed=true;const errors:unknown[]=[];for(let i=dispose.length-1;i>=0;i--)try{dispose[i]!();}catch(error){errors.push(error);}for(const entry of sections)entry.group.clear();if(!errors.length)try{treePreparation.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Catalog environment cleanup failed; tree owner retained on Source cleanup failure');}};
  });
}
