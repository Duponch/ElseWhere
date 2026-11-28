import {knownCell256} from '../sim/exploration-visibility-256';
import * as THREE from 'three/webgpu';
import { deepScannerOverlayPowered } from '../sim/deep-resources';
import type { Structure,World } from '../sim/types';
import { BoxMesh,configureBoxMaterial } from './BoxMesh';
import {GROUND_OVERLAY_RENDER_ORDER,groundOverlayRect,type GroundOverlayRect} from './ground-overlay-surfaces';

export interface DeepResourceContext {selectedId?:number;selectedStructure?:Structure;placement?:string}
export type DeepResourceOverlayCell=NonNullable<World['deepResources']>['cells'][number]&{selected:boolean};

/** Only discovered, remaining reserves are projected. Selection changes their
 * emphasis, never their quantity or the set of discoverable resources. */
export function deepResourceOverlayCells(world:World,context:DeepResourceContext):DeepResourceOverlayCell[]{
  const selected=context.selectedStructure??(context.selectedId===undefined?undefined:world.structures.find(s=>s.id===context.selectedId));
  if(context.placement!=='deep-drill'&&selected?.kind!=='deep-drill'&&selected?.kind!=='ground-scanner')return [];
  if(!deepScannerOverlayPowered(world))return [];
  return (world.deepResources?.cells??[]).filter(c=>c.count>0&&knownCell256(world,c.index)).map(c=>({...c,selected:selected?.kind==='deep-drill'&&
    (c.index%world.width-selected.x)**2+(Math.floor(c.index/world.width)-selected.z)**2<=2.6**2}));
}

const palette={steel:0x77b5ad,silver:0xc4d9dc,gold:0xd7b56b,plasteel:0x9ab5dd,uranium:0x777d73,jade:0x79a996};

/** A resident flat instanced overlay, rebuilt from published cells only when
 * their values or display context change. No scene objects per reserve. */
export class DeepResourceLayer {
  readonly material=new THREE.MeshBasicNodeMaterial({transparent:true,opacity:.53,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
  private readonly base=new THREE.PlaneGeometry(.86,.86).rotateX(-Math.PI/2);
  readonly mesh:BoxMesh;
  surfaces:readonly GroundOverlayRect[]=[];
  private signature='';
  private revision=0;
  private readonly matrix=new THREE.Matrix4();
  private readonly color=new THREE.Color();
  private readonly highlight=new THREE.Color(0xf1dda0);

  constructor(){configureBoxMaterial(this.material);this.mesh=new BoxMesh(this.base,this.material,16);this.mesh.renderOrder=GROUND_OVERLAY_RENDER_ORDER.deep;this.mesh.activeCount=0;}

  update(world:World,context:DeepResourceContext):boolean {
    const cells=deepResourceOverlayCells(world,context);
    const signature=`${world.width}:${world.height}:${context.selectedId??''}:${context.placement??''}:`+cells.map(c=>`${c.index}:${c.item}:${c.count}:${Number(c.selected)}`).join('|');
    if(signature===this.signature)return false;
    this.signature=signature;this.revision++;
    if(cells.length>this.mesh.instanceMatrix.count)this.mesh.allocate(this.base,Math.min(world.width*world.height,2**Math.ceil(Math.log2(Math.max(16,cells.length)))));
    this.mesh.activeCount=cells.length;
    const surfaces:GroundOverlayRect[]=[];
    for(let i=0;i<cells.length;i++){
      const c=cells[i]!;
      this.matrix.makeTranslation(c.index%world.width,.078,Math.floor(c.index/world.width));this.mesh.setMatrixAt(i,this.matrix);
      this.color.setHex(palette[c.item]);if(c.selected)this.color.lerp(this.highlight,.55);
      this.mesh.setColorAt(i,this.color);
      const x=c.index%world.width,z=Math.floor(c.index/world.width),half=Math.fround(.86)/2;
      surfaces.push(groundOverlayRect(x-half,z-half,x+half,z+half,this.color,this.material.opacity));
    }
    this.surfaces=surfaces;
    this.mesh.instanceMatrix.needsUpdate=true;this.mesh.colorBuffer.needsUpdate=true;this.mesh.computeBoundingSphere();
    return true;
  }

  prepareForCompile():()=>void {
    const mesh=this.mesh,geometry=mesh.geometry,revision=this.revision;
    const count=geometry.instanceCount,visible=mesh.visible,culled=mesh.frustumCulled,sphere=mesh.boundingSphere.clone(),first=mesh.instanceMatrix.array.slice(0,16);
    if(count===0){mesh.setMatrixAt(0,this.matrix.identity());mesh.activeCount=1;mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
    mesh.visible=true;mesh.frustumCulled=false;
    return ()=>{
      mesh.frustumCulled=culled;if(this.revision!==revision||mesh.geometry!==geometry)return;
      if(count===0){mesh.instanceMatrix.array.set(first,0);mesh.instanceMatrix.needsUpdate=true;}
      geometry.instanceCount=count;mesh.visible=visible;mesh.boundingSphere.copy(sphere);
    };
  }

  dispose():void {this.mesh.removeFromParent();this.mesh.dispose();this.base.dispose();this.material.dispose();}
}
