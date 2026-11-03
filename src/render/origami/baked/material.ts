import * as THREE from 'three/webgpu';
import {attribute,texture} from 'three/tsl';

export interface OpaqueAtlasMaterial<T extends THREE.Texture=THREE.DataTexture> {
  material:THREE.MeshStandardNodeMaterial;
  texture:T;
  bytes:number;
  dispose():void;
}
const decode=Float64Array.from({length:256},(_,i)=>{const x=i/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});
const encode=(x:number)=>Math.max(0,Math.min(255,Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055))));

/** Preparation-only mip construction. The finite chain keeps chart gutters
 * isolated at the admitted zooms; it does not promise an unlimited distant LOD. */
export function opaqueAtlasMipmaps(data:Uint8Array,width:number,height:number,levels:number):{data:Uint8Array;width:number;height:number}[]{
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>4096||height>4096||data.length!==width*height*4)throw Error('Opaque atlas dimensions/buffer refused');
  if(!Number.isSafeInteger(levels)||levels<1||levels>5||width%(2**(levels-1))||height%(2**(levels-1)))throw Error('Opaque atlas requires a bounded aligned mip chain');
  for(let i=3;i<data.length;i+=4)if(data[i]!==255)throw Error('Opaque atlas contains transparency');
  const mips=[{data,width,height}];
  for(let level=1;level<levels;level++){
    const source=mips[level-1]!,w=source.width/2,h=source.height/2,out=new Uint8Array(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const a=(y*2*source.width+x*2)*4,b=a+4,c=a+source.width*4,d=c+4,at=(y*w+x)*4;
      for(let channel=0;channel<3;channel++)out[at+channel]=encode((decode[source.data[a+channel]!]!+decode[source.data[b+channel]!]!+decode[source.data[c+channel]!]!+decode[source.data[d+channel]!]!)/4);
      out[at+3]=255;
    }
    mips.push({data:out,width:w,height:h});
  }
  return mips;
}

/** One opaque body, one color sample. No pigment/paper/coverage/ink graph,
 * derivative-built paint metric, separate stroke draw or relief resource. */
export function createOpaqueAtlasMaterial(data:Uint8Array,width:number,height:number,levels=4):OpaqueAtlasMaterial{
  const mips=opaqueAtlasMipmaps(data,width,height,levels);
  const map=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.UnsignedByteType);
  map.name='Origami prototype — precomposed opaque color';
  map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;
  map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
  map.generateMipmaps=false;map.mipmaps=mips;map.needsUpdate=true;
  const material=new THREE.MeshStandardNodeMaterial({roughness:.88,metalness:.02,flatShading:true,transparent:false,depthWrite:true,depthTest:true});
  material.name='Origami prototype — one opaque textured body';
  material.colorNode=texture(map,attribute('bakedUv','vec2')).rgb;
  material.normalNode=null;
  let disposed=false;
  return{material,texture:map,bytes:mips.reduce((sum,mip)=>sum+mip.data.byteLength,0),dispose(){if(disposed)return;disposed=true;material.dispose();map.dispose();}};
}

/** GPU preparation already owns a finite SRGB render-target mip chain. Keep
 * its RT owner alive rather than disposing its texture as a stand-alone map.
 * The runtime color/lighting graph is the same stock one-lookup PBR as above. */
export function createOpaqueAtlasMaterialFromTexture<T extends THREE.Texture>(map:T,bytes:number,releaseTexture:()=>void):OpaqueAtlasMaterial<T>{
  if(!Number.isSafeInteger(bytes)||bytes<1||map.colorSpace!==THREE.SRGBColorSpace||map.flipY||map.generateMipmaps||map.mipmaps.length<1)throw Error('Prepared opaque GPU texture contract refused');
  const material=new THREE.MeshStandardNodeMaterial({roughness:.88,metalness:.02,flatShading:true,transparent:false,depthWrite:true,depthTest:true});
  material.name='Origami prototype — one opaque textured body';
  material.colorNode=texture(map,attribute('bakedUv','vec2')).rgb;material.normalNode=null;
  let disposed=false;
  return{material,texture:map,bytes,dispose(){if(disposed)return;disposed=true;const errors:unknown[]=[];for(const close of [()=>material.dispose(),releaseTexture])try{close();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Opaque GPU atlas disposal failed');}};
}
