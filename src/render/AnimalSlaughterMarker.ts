import * as THREE from 'three/webgpu';
import {Fn,attribute,cameraPosition,cameraViewMatrix,texture,uniform,uv,vec2,vec3,vec4,renderGroup} from 'three/tsl';
import {pawnPresentationPose} from './pawn-presentation';
import {perspectiveDetailRange,screenSpriteScale} from './map-overlay-detail';
import {DESIGNATION_MIN_CELL_PIXELS,DESIGNATION_ICON_PIXELS} from './DesignationIconLayer';
import type {SceneTextureLoader} from './scene-render-ports';

/** Shared view uniforms and one original icon; no work query on camera frames. */
export class AnimalSlaughterMarkerStyle {
  private readonly fallback=new THREE.DataTexture(new Uint8Array([130,150,176,255]),1,1,THREE.RGBAFormat);
  readonly icon=texture(this.fallback);
  readonly scale=uniform(1).setGroup(renderGroup);
  readonly range=uniform(1e8).setGroup(renderGroup);
  readonly limited=uniform(1).setGroup(renderGroup);
  readonly perspective=uniform(0).setGroup(renderGroup);
  readonly enabled=uniform(1).setGroup(renderGroup);
  private pixels=DESIGNATION_MIN_CELL_PIXELS;
  private loaded?:THREE.Texture;
  private disposed=false;
  constructor(load?:SceneTextureLoader){
    this.fallback.needsUpdate=true;
    load?.('/assets/ui/elsewhere/v309/slaughter.svg',image=>{
      if(this.disposed){image.dispose();return;}
      image.colorSpace=THREE.SRGBColorSpace;image.minFilter=image.magFilter=THREE.LinearFilter;
      this.loaded=image;this.icon.value=image;
    },undefined,()=>{});
  }
  setMinCellPixels(pixels:number):void {
    this.pixels=Number.isFinite(pixels)&&pixels>=0?pixels:DESIGNATION_MIN_CELL_PIXELS;
    this.limited.value=this.pixels===0?0:1;
  }
  present(camera:THREE.OrthographicCamera|THREE.PerspectiveCamera,height:number,cellPixels:number):void {
    this.enabled.value=height>0&&(this.pixels===0||cellPixels>=this.pixels)?1:0;
    this.scale.value=screenSpriteScale(camera,height,DESIGNATION_ICON_PIXELS);
    const perspective=camera instanceof THREE.PerspectiveCamera;
    this.perspective.value=perspective?1:0;
    this.range.value=perspective&&this.pixels>0?Math.min(1e30,perspectiveDetailRange(camera,height,this.pixels)):1e8;
  }
  dispose():void {this.disposed=true;this.fallback.dispose();this.loaded?.dispose();}
}

/** The marker program: the same anchor and scale graph for every species. A
 * shared program passes its object-bound height and the binder writing the
 * drawn species' resources (placed in the anchor, read by both nodes). */
export function animalSlaughterMarkerMaterial(clock:Parameters<typeof pawnPresentationPose>[0],style:AnimalSlaughterMarkerStyle,height:number|THREE.Node<'float'>,binder?:THREE.Node):THREE.SpriteNodeMaterial {
  const material=new THREE.SpriteNodeMaterial({transparent:true,depthTest:false,depthWrite:false,alphaTest:.12});
  const anchor=Fn(()=>{
    binder?.toStack();
    const pose=pawnPresentationPose(clock);
    return vec3(pose.x,pose.y.add(attribute('aScale','float').mul(height)).add(.5),pose.z);
  })();
  material.positionNode=anchor;
  const depth=cameraViewMatrix.mul(vec4(anchor,1)).z.negate();
  const inRange=style.limited.lessThan(.5).or(cameraPosition.sub(anchor).length().lessThan(style.range)).and(depth.greaterThan(0));
  material.scaleNode=vec2(style.scale).mul(style.perspective.greaterThan(.5).select(depth,1))
    .mul(inRange.select(1,0)).mul(attribute('aSlaughter','float')).mul(style.enabled);
  material.colorNode=style.icon.sample(uv());
  return material;
}
/** Each species shares its body's resident trajectory attributes. Flags change
 * on confirmed snapshots only; movement is evaluated by the same GPU node. */
export function animalSlaughterMarker(source:THREE.InstancedBufferGeometry,clock:Parameters<typeof pawnPresentationPose>[0],style:AnimalSlaughterMarkerStyle,height:number,material:THREE.SpriteNodeMaterial=animalSlaughterMarkerMaterial(clock,style,height)):THREE.Mesh {
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,-.5,.5,0,.5,.5,0],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));geometry.setIndex([0,1,2,2,1,3]);
  for(const name of ['aFrom','aTo','aTravel','aScale'])geometry.setAttribute(name,source.getAttribute(name));
  geometry.setAttribute('aSlaughter',new THREE.InstancedBufferAttribute(new Float32Array(source.getAttribute('aFrom').count),1).setUsage(THREE.StaticDrawUsage));
  geometry.instanceCount=0;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Domestic slaughter — shared GPU trajectories';mesh.frustumCulled=false;mesh.renderOrder=5;mesh.visible=false;
  return mesh;
}
