import * as THREE from 'three/webgpu';
import {Fn,attribute,cameraPosition,cameraViewMatrix,texture,uniform,uv,vec2,vec3,vec4,renderGroup} from 'three/tsl';
import {pawnPresentationPose} from './pawn-presentation';
import {perspectiveDetailRange,screenSpriteScale} from './map-overlay-detail';
import {DESIGNATION_MIN_CELL_PIXELS,DESIGNATION_ICON_PIXELS} from './DesignationIconLayer';
import type {SceneTextureLoader} from './scene-render-ports';
import {pictogramSvg} from '../ui/pictograms';

/** One atlas/read and the existing per-species marker batch for both orders. */
export const ANIMAL_DESIGNATION_ATLAS_URL='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="192" height="96" viewBox="0 0 128 64">'+
  ['slaughter','target'].map((id,index)=>pictogramSvg(id).replace('<svg ',`<svg x="${index*64}" y="0" `).replace('width="96" height="96"','width="64" height="64"')).join('')+'</svg>');
function fallbackAtlas():THREE.DataTexture {
 const width=32,height=16,data=new Uint8Array(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const u=x%16,v=y,slot=Math.floor(x/16),radius=Math.hypot(u-7.5,v-7.5);
  const ink=slot===0?(u>=3&&u<=7&&v>=5&&v<=13||u>=5&&u<=12&&v>=3&&v<=7):Math.abs(radius-4.5)<1||Math.abs(u-7.5)<.8||Math.abs(v-7.5)<.8;
  if(ink){const at=(y*width+x)*4;data.set(slot===0?[170,184,192,255]:[200,90,66,255],at);}
 }
 const map=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);map.magFilter=map.minFilter=THREE.LinearFilter;return map;
}

/** Shared view uniforms and one original icon; no work query on camera frames. */
export class AnimalSlaughterMarkerStyle {
  private readonly fallback=fallbackAtlas();
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
    load?.(ANIMAL_DESIGNATION_ATLAS_URL,image=>{
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
export function animalSlaughterMarkerMaterial(clock:Parameters<typeof pawnPresentationPose>[0],style:AnimalSlaughterMarkerStyle,height:number|THREE.Node<'float'>,binder?:THREE.Node,headAnchor?:()=>THREE.Node<'vec3'>):THREE.SpriteNodeMaterial {
  const material=new THREE.SpriteNodeMaterial({transparent:true,depthTest:false,depthWrite:false,alphaTest:.12});
  const anchor=Fn(()=>{
    binder?.toStack();
    if(headAnchor)return headAnchor();
    const pose=pawnPresentationPose(clock);
    return vec3(pose.x,pose.y.add(attribute('aScale','float').mul(height)).add(.5),pose.z);
  })();
  material.positionNode=anchor;
  const depth=cameraViewMatrix.mul(vec4(anchor,1)).z.negate();
  const inRange=style.limited.lessThan(.5).or(cameraPosition.sub(anchor).length().lessThan(style.range)).and(depth.greaterThan(0));
  material.scaleNode=vec2(style.scale).mul(style.perspective.greaterThan(.5).select(depth,1))
    .mul(inRange.select(1,0)).mul(attribute('aSlaughter','float').greaterThan(0).select(1,0)).mul(style.enabled);
  material.colorNode=style.icon.sample(vec2(uv().x.add(attribute('aSlaughter','float').sub(1).max(0)).mul(.5),uv().y));
  return material;
}
/** Each species shares its body's resident trajectory attributes. Flags change
 * on confirmed snapshots only; movement is evaluated by the same GPU node. */
export function animalSlaughterMarker(source:THREE.InstancedBufferGeometry,clock:Parameters<typeof pawnPresentationPose>[0],style:AnimalSlaughterMarkerStyle,height:number,material:THREE.SpriteNodeMaterial=animalSlaughterMarkerMaterial(clock,style,height)):THREE.Mesh {
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,-.5,.5,0,.5,.5,0],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,0,1,1,1],2));geometry.setIndex([0,1,2,2,1,3]);
  for(const name of ['aFrom','aTo','aTravel','aScale','aAnimal'])if(source.hasAttribute(name))geometry.setAttribute(name,source.getAttribute(name));
  geometry.setAttribute('aSlaughter',new THREE.InstancedBufferAttribute(new Float32Array(source.getAttribute('aFrom').count),1).setUsage(THREE.StaticDrawUsage));
  geometry.instanceCount=0;
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Domestic slaughter — shared GPU trajectories';mesh.frustumCulled=false;mesh.renderOrder=5;mesh.visible=false;
  return mesh;
}
