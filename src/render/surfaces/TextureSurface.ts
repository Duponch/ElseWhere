/** Shared Lambert surface. Assets, UV addressing and baked-palette encoding
 * are data; models, poses, lighting and material graphs never depend on a
 * texture-style label. Texture owners outlive every surface borrowing them. */
import * as THREE from 'three/webgpu';
import {attribute,buffer,int,mix,sharedUniformGroup,texture,uniform,uv,varying,vec3} from 'three/tsl';

export const TEXTURE_SURFACE_SLOT_COUNT=64;
export interface TextureSurfaceSlot {readonly layer:number;readonly paletteBaked:boolean}

export interface TextureSurfaceAssets {
 readonly texture:THREE.Texture;
 readonly uvAddress:'raw'|'chart';
 /** Stable model/surface IDs address these rows at the vertex stage. Layers
  * may change with a resident cohort without rewriting model geometry. */
 readonly slots:readonly TextureSurfaceSlot[];
 readonly assertCurrent?:()=>void;
}
export interface TextureSurfaceOptions {
 readonly positionNode?:THREE.NodeMaterial['positionNode'];
 readonly castShadowPositionNode?:THREE.NodeMaterial['castShadowPositionNode'];
 readonly receivedShadowPositionNode?:THREE.NodeMaterial['receivedShadowPositionNode'];
 readonly rawUv?:THREE.Node<'vec2'>;
 readonly chartUv?:THREE.Node<'vec3'>;
 readonly color?:THREE.Node<'vec3'>;
 readonly baseline?:THREE.Node<'vec3'>;
 /** Configure fresh materials exactly once, before any graph is compiled. */
 readonly configure?:(material:THREE.MeshLambertNodeMaterial)=>void;
}
export function validateTextureSurfaceAssets(stage:TextureSurfaceAssets):void {
 stage.assertCurrent?.();
 const t=stage.texture,image=t.image as {width?:number;height?:number;depth?:number}|undefined;
 if(!(t.isArrayTexture||t instanceof THREE.DataArrayTexture)||t.type!==THREE.UnsignedByteType||t.format!==THREE.RGBAFormat||t.flipY||!image||!Number.isSafeInteger(image.width)||!Number.isSafeInteger(image.height)||!Number.isSafeInteger(image.depth)||Number(image.width)<1||Number(image.height)<1||Number(image.depth)<2||t.magFilter!==THREE.LinearFilter||t.minFilter!==THREE.LinearMipmapLinearFilter||t.wrapS!==THREE.ClampToEdgeWrapping||t.wrapT!==THREE.ClampToEdgeWrapping||(t.colorSpace!==THREE.NoColorSpace&&t.colorSpace!==THREE.SRGBColorSpace)||(stage.uvAddress!=='raw'&&stage.uvAddress!=='chart')||stage.slots.length!==TEXTURE_SURFACE_SLOT_COUNT||stage.slots.some(row=>!Number.isSafeInteger(row.layer)||row.layer<0||row.layer>=Number(image.depth)||typeof row.paletteBaked!=='boolean'))throw Error('TextureSurface requires a live filtered RGBA8 array and64 valid model-slot rows');
}
function snapshot(stage:TextureSurfaceAssets):Readonly<TextureSurfaceAssets>{return Object.freeze({...stage,slots:Object.freeze(stage.slots.map(row=>Object.freeze({...row})))});}
function disposeMaterials(materials:readonly THREE.Material[]):void {
 const failures:unknown[]=[];for(const m of materials)try{m.dispose();}catch(error){failures.push(error);}
 if(failures.length)throw new AggregateError(failures,'TextureSurface material cleanup failed');
}
/** One texture sample and one Lambert graph for every compatible asset set.
 * setAssets is synchronous: validation completes before any published field
 * changes. It owns neither the textures nor any geometry or renderer hook.
 * OFF selects plainMaterial, whose graph contains no texture sample. */
export function createTextureSurface(initial:TextureSurfaceAssets,options:TextureSurfaceOptions={}) {
 validateTextureSurfaceAssets(initial);
 // Both bindings share one explicitly versioned group. BufferNode has no
 // render/frame update callback; unlike UniformArrayNode it never repacks the
 //64 rows at render time. NodeManager.updateGroup skips unchanged versions.
 const assetsGroup=sharedUniformGroup('textureSurfaceAssets',0,null),rows=new Float32Array(TEXTURE_SURFACE_SLOT_COUNT*4);
 const writeRows=(stage:TextureSurfaceAssets)=>{for(let i=0;i<TEXTURE_SURFACE_SLOT_COUNT;i++){rows[i*4]=stage.slots[i]!.layer;rows[i*4+1]=stage.slots[i]!.paletteBaked?1:0;}};writeRows(initial);
 const address=uniform(initial.uvAddress==='chart'?1:0).setGroup(assetsGroup),lookup=buffer(rows,'vec4',TEXTURE_SURFACE_SLOT_COUNT).setGroup(assetsGroup);
 const raw=options.rawUv??uv(),chart=options.chartUv??attribute('bakedUv','vec3'),color=options.color??attribute('color','vec3'),baseline=options.baseline??attribute('origamiPaint','vec4').xyz;
 const xy=varying(mix(raw,chart.xy,address),'v_textureSurfaceUv');
 // Model writers guarantee integer slots0..63, constant across each triangle.
 // Three's installed declarations omit BufferNode's generic element chaining.
 // The real cold WGSL contract exercises this same supported runtime method.
 const table=lookup as typeof lookup&{element(index:THREE.Node<'int'>):THREE.Node<'vec4'>};
 const row=table.element(int(chart.z));
 const layer=varying(row.x,'v_textureSurfaceLayer').setInterpolation('flat','first');
 const tint=varying(color.div(mix(vec3(1),baseline.max(vec3(.00001)),row.y)),'v_textureSurfaceTint');
 const sampleNode=texture(initial.texture,xy).depth(int(layer));
 const material=new THREE.MeshLambertNodeMaterial({flatShading:true,vertexColors:false}),plainMaterial=new THREE.MeshLambertNodeMaterial({flatShading:true,vertexColors:false}),materials=[material,plainMaterial];
 let current=snapshot(initial),closed=false;
 try {
  material.colorNode=sampleNode.rgb.mul(tint);plainMaterial.colorNode=color;
  for(const m of materials){m.positionNode=options.positionNode??null;m.castShadowPositionNode=options.castShadowPositionNode??null;m.receivedShadowPositionNode=options.receivedShadowPositionNode??null;m.userData.rendererOwned=true;options.configure?.(m);}
 }catch(error){try{disposeMaterials(materials);}catch(cleanup){throw new AggregateError([error,cleanup],'TextureSurface configuration and cleanup failed');}throw error;}
 return{material,plainMaterial,sampleNode,
  get assets():Readonly<TextureSurfaceAssets>{return current;},
  setAssets(stage:TextureSurfaceAssets):void {
   if(closed)throw Error('TextureSurface is disposed');validateTextureSurfaceAssets(stage);
   // No callbacks/awaits occur between these writes. Scene owners publish only
   // after upload/warmup, then release their previous texture lease separately.
   const next=snapshot(stage);sampleNode.value=next.texture;address.value=next.uvAddress==='chart'?1:0;writeRows(next);assetsGroup.needsUpdate=true;current=next;
  },
  dispose():void {if(closed)return;closed=true;disposeMaterials(materials);},
 };
}

/** Exact data copy, not a raster/resample or colorspace conversion. Both layers
 * contain the original64-square neutral pastel map by default; animal coats
 * explicitly keep their native256-square map. Source crops stay in UV.
 * CPU/GPU nominal bytes are32768/43688 for64,524288/699048 for256.
 * The returned texture is owned by the caller, independently of the source. */
export function copyPastelTextureToArray(source:THREE.DataTexture,size:64|256=64):THREE.DataArrayTexture {
 const image=source.image;
 if((size!==64&&size!==256)||image.width!==size||image.height!==size||!(image.data instanceof Uint8Array)||image.data.length!==size*size*4||source.format!==THREE.RGBAFormat||source.type!==THREE.UnsignedByteType||source.colorSpace!==THREE.NoColorSpace||source.flipY||source.magFilter!==THREE.LinearFilter||source.minFilter!==THREE.LinearMipmapLinearFilter||!source.generateMipmaps||source.mipmaps.length)throw Error('Exact unflipped '+size+'-square RGBA8 NoColorSpace pastel source required');
 const data=new Uint8Array(image.data.length*2);data.set(image.data);data.set(image.data,image.data.length);
 const out=new THREE.DataArrayTexture(data,size,size,2);out.colorSpace=source.colorSpace;out.wrapS=source.wrapS;out.wrapT=source.wrapT;out.magFilter=source.magFilter;out.minFilter=source.minFilter;out.generateMipmaps=true;out.flipY=false;out.anisotropy=source.anisotropy;out.needsUpdate=true;return out;
}
