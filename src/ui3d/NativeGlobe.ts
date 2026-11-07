import * as THREE from 'three/webgpu';
import {prepareGlobeGeometry,pickGlobeTile,type GlobeGeometry,type GlobeVector} from '../ui/planet-surface';
import {prepareGlobeRivers} from '../ui/planet-river-geometry';
import {prepareGlobeRoads} from '../ui/planet-road-geometry';
import {surfaceVisibilityAxis} from '../sim/world-surface-mesh';
import type {WorldPhysicalSurface} from '../sim/world-surface-geography';
import type {WorldRoadLink} from '../sim/world-roads';

export interface NativeGlobeMarker {
  tile:number;
  label:string;
  color?:THREE.ColorRepresentation;
}
export type NativeGlobeRoads=readonly (readonly WorldRoadLink[])[];

const PIGMENTS:Readonly<Record<string,readonly [number,number,number]>>={
  ocean:[123,164,180],lake:[133,183,193],'boreal-forest':[135,158,142],
  tundra:[181,186,168],'cold-bog':[143,159,154],'ice-sheet':[223,230,225],
  'sea-ice':[200,221,223],'temperate-forest':[161,184,147],
  'temperate-swamp':[153,175,152],'tropical-rainforest':[124,167,133],
  'tropical-swamp':[129,161,143],'arid-shrubland':[196,187,142],
  desert:[219,194,149],'extreme-desert':[229,201,162],
};
const NO_ROADS:NativeGlobeRoads=Object.freeze([]);
const X_AXIS=new THREE.Vector3(1,0,0),Y_AXIS=new THREE.Vector3(0,1,0),Z_AXIS=new THREE.Vector3(0,0,1);
const LINEAR_BYTES=Uint8Array.from({length:256},(_,value)=>{
  const channel=value/255;
  return Math.round(255*(channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4));
});
interface PreparedSurface {
  readonly source:GlobeGeometry;
  readonly indices:Uint32Array;
  readonly linearColors:Uint8Array;
  /** Vertex normals of the indexed surface, computed once per owner. */
  readonly normals:Float32Array;
}
/** Only immutable physical owners and their actual road matrices key this cache. */
const preparedSurfaces=new WeakMap<WorldPhysicalSurface,WeakMap<object,PreparedSurface>>();

function prepare(surface:WorldPhysicalSurface,roads:NativeGlobeRoads):PreparedSurface {
  let owners=preparedSurfaces.get(surface);
  const cached=owners?.get(roads);
  if(cached)return cached;
  if(surface.revision!==3||surface.radius!==100||!surface.tiles.length)
    throw Error('La surface géographique du globe est invalide.');
  if(roads.length!==0&&roads.length!==surface.tiles.length)
    throw Error('Le réseau routier du globe ne correspond pas à sa surface.');
  const corners=(tile:number):readonly GlobeVector[]=>{
    const value=surface.tiles[tile];
    if(!value||value.id!==tile)throw Error('Le polygone géographique est absent.');
    return value.corners;
  };
  const source=prepareGlobeGeometry({
    tiles:surface.tiles,radius:100,corners,
    decorations:[...prepareGlobeRivers(surface.tiles,corners,100),
      ...roads.length?[prepareGlobeRoads(surface,roads)]:[]],
    pigment:id=>{
      const tile=surface.tiles[id]!,base=PIGMENTS[tile.biome]??[183,176,165];
      const shade=tile.hilliness==='impassable'?.66:tile.hilliness==='mountainous'?.77:
        tile.hilliness==='large-hills'?.88:tile.hilliness==='small-hills'?.95:1;
      return base.map(value=>Math.round(value*shade)) as [number,number,number];
    },
  });
  // The canonical polygons also serve the exact picker. GPU winding is an
  // independent copied index array: neither that picker nor World is changed.
  const indices=source.indices.slice(),faceRange=source.ranges[0]!;
  let inward=false;
  for(let index=faceRange.start;index<faceRange.start+faceRange.count;index+=3){
    const a=indices[index]!*3,b=indices[index+1]!*3,c=indices[index+2]!*3,p=source.positions;
    const abx=p[b]!-p[a]!,aby=p[b+1]!-p[a+1]!,abz=p[b+2]!-p[a+2]!;
    const acx=p[c]!-p[a]!,acy=p[c+1]!-p[a+1]!,acz=p[c+2]!-p[a+2]!;
    const dot=(aby*acz-abz*acy)*p[a]!+(abz*acx-abx*acz)*p[a+1]!+(abx*acy-aby*acx)*p[a+2]!;
    if(Math.abs(dot)<1e-15)continue;
    inward=dot<0;break;
  }
  if(inward)for(let index=faceRange.start;index<faceRange.start+faceRange.count;index+=3){
    const swap=indices[index+1]!;indices[index+1]=indices[index+2]!;indices[index+2]=swap;
  }
  // Pigments are authored in sRGB. Three's resident vertex attributes hold
  // linear channels; keep their compact byte representation and original alpha.
  const linearColors=new Uint8Array(source.colors.length);
  for(let i=0;i<linearColors.length;i+=4){
    linearColors[i]=LINEAR_BYTES[source.colors[i]!]!;
    linearColors[i+1]=LINEAR_BYTES[source.colors[i+1]!]!;
    linearColors[i+2]=LINEAR_BYTES[source.colors[i+2]!]!;
    linearColors[i+3]=source.colors[i+3]!;
  }
  const normalSource=new THREE.BufferGeometry();
  normalSource.setAttribute('position',new THREE.BufferAttribute(source.positions,3));normalSource.setIndex(new THREE.BufferAttribute(indices,1));
  normalSource.computeVertexNormals();
  const normals=(normalSource.getAttribute('normal') as THREE.BufferAttribute).array as Float32Array;
  const result={source,indices,linearColors,normals};
  if(!owners){owners=new WeakMap();preparedSurfaces.set(surface,owners);}
  owners.set(roads,result);return result;
}

/** Prepares a surface ahead (e.g. behind the loading screen) so that the
 * first page showing it does not build its geometry. Pure cache warm-up. */
export function prewarmNativeGlobe(surface:WorldPhysicalSurface,roads:NativeGlobeRoads=NO_ROADS):void {prepare(surface,roads);}

/** A resident Three globe inside the existing native scene. This class creates
 * no canvas, renderer, DOM node, SVG, CSS layout, or simulation owner. */
export class NativeGlobe extends THREE.Group {
  private readonly body=new THREE.Group();
  private readonly matte=new THREE.MeshStandardMaterial({
    color:0xffffff,vertexColors:true,roughness:1,metalness:0,flatShading:true,
    side:THREE.FrontSide,fog:false,
  });
  private readonly decorationMatte=new THREE.MeshStandardMaterial({
    color:0xffffff,vertexColors:true,roughness:1,metalness:0,flatShading:true,
    transparent:true,opacity:1,depthWrite:false,side:THREE.DoubleSide,
    forceSinglePass:true,polygonOffset:true,polygonOffsetFactor:-1,
    polygonOffsetUnits:-1,alphaTest:.001,fog:false,
  });
  private readonly surfaceMesh=new THREE.Mesh<THREE.BufferGeometry,THREE.Material[]>(
    new THREE.BufferGeometry(),[this.matte,this.decorationMatte]);
  // Uncovered portions remain plain material, with no fabricated tiles. This
  // shell also occludes the back of markers and the retained coverage cap.
  private readonly backingGeometry=new THREE.IcosahedronGeometry(.997,4);
  private readonly backingMaterial=new THREE.MeshStandardMaterial({
    color:'#7c8b87',roughness:1,metalness:0,flatShading:true,fog:false,
  });
  private readonly backing=new THREE.Mesh(this.backingGeometry,this.backingMaterial);
  private readonly selectionGeometry=new THREE.RingGeometry(.018,.028,7);
  private readonly selectionMaterial=new THREE.MeshStandardMaterial({
    color:'#fff0b2',roughness:1,metalness:0,flatShading:true,
    side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,
    polygonOffsetUnits:-2,fog:false,
  });
  private readonly selectionMarker=new THREE.Mesh(this.selectionGeometry,this.selectionMaterial);
  private readonly pinGeometry=new THREE.ConeGeometry(.012,.036,5);
  private readonly pinMaterial=new THREE.MeshStandardMaterial({
    color:0xffffff,roughness:1,metalness:0,flatShading:true,fog:false,
  });
  private pins:THREE.InstancedMesh|undefined;
  private pinCapacity=0;
  private requestedMarkers:readonly NativeGlobeMarker[]=[];
  private markerSignature='';
  private surface:WorldPhysicalSurface|undefined;
  private roads:NativeGlobeRoads=NO_ROADS;
  private prepared:PreparedSurface|undefined;
  private selected:number|null=null;
  private yaw=0;
  private pitch=0;
  private zoomFactor=1;
  private disposed=false;
  private readonly inverse=new THREE.Matrix4();
  private readonly localRay=new THREE.Ray();
  private readonly unitSphere=new THREE.Sphere(new THREE.Vector3(),1);
  private readonly point=new THREE.Vector3();
  private readonly worldPoint=new THREE.Vector3();
  private readonly direction=new THREE.Vector3();
  private readonly pitchRotation=new THREE.Quaternion();
  private readonly yawRotation=new THREE.Quaternion();
  private readonly pinMatrix=new THREE.Matrix4();
  private readonly pinRotation=new THREE.Quaternion();
  private readonly pinPosition=new THREE.Vector3();
  private readonly pinScale=new THREE.Vector3(1,1,1);
  private readonly pinColor=new THREE.Color();

  constructor(private readonly onSelect:(tileId:number)=>void){
    super();this.name='Native geography globe';this.body.name='Native globe surface frame';
    this.surfaceMesh.name='Canonical geographic surface';this.surfaceMesh.visible=false;
    this.backing.name='Uncovered globe backing';this.selectionMarker.name='Selected geographic tile';
    this.selectionMarker.visible=false;
    this.body.add(this.backing,this.surfaceMesh,this.selectionMarker);this.add(this.body);
    this.userData.nativeGlobe=true;
  }

  setSurface(surface:WorldPhysicalSurface,roads:NativeGlobeRoads=NO_ROADS):void {
    if(this.disposed)throw Error('Le globe a été fermé.');
    if(surface===this.surface&&roads===this.roads)return;
    // Validate/prepare before evicting the accepted resident surface.
    const prepared=prepare(surface,roads),geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(prepared.source.positions,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(prepared.linearColors,4,true));
    geometry.setIndex(new THREE.BufferAttribute(prepared.indices,1));
    for(const range of prepared.source.ranges)
      if(range.count)geometry.addGroup(range.start,range.count,range.transparent?1:0);
    geometry.setAttribute('normal',new THREE.BufferAttribute(prepared.normals,3));
    geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1.003);
    geometry.boundingBox=new THREE.Box3(new THREE.Vector3(-1.003,-1.003,-1.003),new THREE.Vector3(1.003,1.003,1.003));
    const changedOwner=surface!==this.surface,previous=this.surfaceMesh.geometry;
    this.surfaceMesh.geometry=geometry;this.surfaceMesh.visible=true;
    this.surface=surface;this.roads=roads;this.prepared=prepared;previous.dispose();
    if(changedOwner){
      const axis=surfaceVisibilityAxis(surface.settings.coverage),norm=Math.hypot(...axis);
      this.yaw=Math.atan2(axis[0],axis[2]);this.pitch=Math.asin(axis[1]/norm);
      this.zoomFactor=1;this.updatePose();
    }
    this.updateSelection();this.markerSignature='new-surface';this.updateMarkers();
  }

  setSelected(tile:number|null):void {
    if(this.disposed)return;
    if(tile!==null&&(!Number.isSafeInteger(tile)||tile<0))throw Error('Case sélectionnée invalide.');
    if(tile===this.selected)return;this.selected=tile;this.updateSelection();
  }

  setMarkers(markers:readonly NativeGlobeMarker[]):void {
    if(this.disposed)return;
    if(markers.some(marker=>!Number.isSafeInteger(marker.tile)||marker.tile<0||typeof marker.label!=='string'))
      throw Error('Marqueur géographique invalide.');
    this.requestedMarkers=markers.map(marker=>({...marker,
      color:marker.color instanceof THREE.Color?marker.color.clone():marker.color}));
    this.updateMarkers();
  }

  /** Angular deltas in radians; the stage converts its drag distances once. */
  rotate(dx:number,dy:number):void {
    if(this.disposed)return;
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return;
    this.yaw=(this.yaw+dx)%(Math.PI*2);
    this.pitch=THREE.MathUtils.clamp(this.pitch+dy,-Math.PI*.49,Math.PI*.49);
    this.updatePose();
  }

  /** Logarithmic zoom delta: positive values bring the globe closer. */
  zoom(delta:number):void {
    if(this.disposed||!Number.isFinite(delta))return;
    this.zoomFactor=THREE.MathUtils.clamp(this.zoomFactor*Math.exp(THREE.MathUtils.clamp(delta,-2,2)),.65,2.2);
    this.updatePose();
  }

  /** Query only, for hover/drag admission. Coverage holes return null. */
  hitTest(raycaster:THREE.Raycaster):number|null {
    if(this.disposed||!this.prepared||!this.surfaceMesh.visible)return null;
    for(let owner:THREE.Object3D|null=this;owner;owner=owner.parent)if(!owner.visible)return null;
    this.body.updateWorldMatrix(true,false);
    this.inverse.copy(this.body.matrixWorld).invert();
    this.localRay.copy(raycaster.ray).applyMatrix4(this.inverse);
    if(!this.localRay.intersectSphere(this.unitSphere,this.point))return null;
    this.worldPoint.copy(this.point).applyMatrix4(this.body.matrixWorld);
    const distance=this.worldPoint.distanceTo(raycaster.ray.origin);
    if(distance<raycaster.near||distance>raycaster.far)return null;
    this.point.normalize();
    return pickGlobeTile(this.prepared.source,[this.point.x,this.point.y,this.point.z]);
  }

  /** Commit a deliberate click. Drag/hover callers use hitTest instead. */
  pick(raycaster:THREE.Raycaster):number|null {
    const tile=this.hitTest(raycaster);
    if(tile!==null){this.setSelected(tile);this.onSelect(tile);}return tile;
  }

  dispose():void {
    if(this.disposed)return;this.disposed=true;
    this.surfaceMesh.geometry.dispose();this.matte.dispose();this.decorationMatte.dispose();
    this.backingGeometry.dispose();this.backingMaterial.dispose();
    this.selectionGeometry.dispose();this.selectionMaterial.dispose();
    if(this.pins){this.body.remove(this.pins);this.pins.dispose();this.pins=undefined;}
    this.pinGeometry.dispose();this.pinMaterial.dispose();
    this.surface=undefined;this.prepared=undefined;this.requestedMarkers=[];
    this.markerSignature='';this.body.clear();this.clear();
  }

  private updatePose():void {
    // Match the canonical globe's Rx(pitch) × Ry(−yaw) convention. The parent
    // owns placement/scale in the panel; zoom changes only this internal frame.
    this.pitchRotation.setFromAxisAngle(X_AXIS,this.pitch);
    this.yawRotation.setFromAxisAngle(Y_AXIS,-this.yaw);
    this.body.quaternion.copy(this.pitchRotation).multiply(this.yawRotation);
    this.body.scale.setScalar(this.zoomFactor);this.body.updateMatrix();
  }

  private tileDirection(tile:number,target:THREE.Vector3):boolean {
    const geometry=this.prepared?.source;if(!geometry)return false;
    const row=geometry.tileIds[tile]===tile?tile:geometry.tileIds.indexOf(tile);
    if(row<0)return false;
    target.fromArray(geometry.centres,row*3).normalize();return true;
  }

  private updateSelection():void {
    const visible=this.selected!==null&&this.tileDirection(this.selected,this.direction);
    this.selectionMarker.visible=visible;
    if(!visible)return;
    this.selectionMarker.position.copy(this.direction).multiplyScalar(1.003);
    this.selectionMarker.quaternion.setFromUnitVectors(Z_AXIS,this.direction);
    this.selectionMarker.userData.tile=this.selected;
    this.selectionMarker.updateMatrix();
  }

  private updateMarkers():void {
    if(!this.prepared)return;
    const markers=this.requestedMarkers.filter(marker=>this.tileDirection(marker.tile,this.direction));
    const signature=markers.map(marker=>{
      this.pinColor.set(marker.color??'#7e5247');
      return `${marker.tile}:${marker.label}:${this.pinColor.getHexString()}`;
    }).join('|');
    if(signature===this.markerSignature)return;
    this.markerSignature=signature;
    if(!markers.length){if(this.pins)this.pins.count=0;this.userData.markers=[];return;}
    if(markers.length>this.pinCapacity){
      this.pinCapacity=2**Math.ceil(Math.log2(Math.max(8,markers.length)));
      if(this.pins){this.body.remove(this.pins);this.pins.dispose();}
      this.pins=new THREE.InstancedMesh(this.pinGeometry,this.pinMaterial,this.pinCapacity);
      this.pins.name='Geographic object pins';this.pins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.pins.frustumCulled=false;this.body.add(this.pins);
    }
    const pins=this.pins!;
    for(let index=0;index<markers.length;index++){
      const marker=markers[index]!;this.tileDirection(marker.tile,this.direction);
      this.pinPosition.copy(this.direction).multiplyScalar(1.018);
      this.pinRotation.setFromUnitVectors(Y_AXIS,this.direction);
      this.pinMatrix.compose(this.pinPosition,this.pinRotation,this.pinScale);
      pins.setMatrixAt(index,this.pinMatrix);this.pinColor.set(marker.color??'#7e5247');pins.setColorAt(index,this.pinColor);
    }
    pins.count=markers.length;pins.instanceMatrix.needsUpdate=true;
    if(pins.instanceColor)pins.instanceColor.needsUpdate=true;
    this.userData.markers=markers.map(({tile,label})=>({tile,label}));
  }
}
