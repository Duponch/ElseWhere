import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {stubReferenceBakeToSink} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
import {PawnLayer} from '../src/render/PawnLayer';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {ExplorationMask256} from '../src/render/ExplorationMask256';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';

// The pinned runtime exposes WGSL generation, while its bundled declaration
// intentionally leaves these inspection fields opaque. Keep this boundary
// limited to the actual fields read by this CPU contract.
interface InspectionBuilder {
  scene:THREE.Scene;
  camera:THREE.Camera;
  material:THREE.Material;
  lightsNode:THREE.LightsNode;
  build():unknown;
  varyings:{name:string;type:string;needsInterpolation:boolean}[];
  vertexShader:string;
  getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[];
  getBindings():{bindings:{name:string;visibility:number;isSampledTexture?:boolean;texture?:THREE.Texture}[]}[];
}
const InspectionBuilderConstructor=THREE.WGSLNodeBuilder as unknown as new(object:THREE.Object3D,renderer:THREE.WebGPURenderer)=>InspectionBuilder;

/** Actual pinned WGSL generation only. The canvas and feature metadata are
 * inert CPU boundaries: never init(), compileAsync(), render(), requestDevice,
 * World, Engine, Worker or a fabricated GPU pipeline. Stub paint pixels do not
 * qualify appearance; actual source pixels and Native drawing are separate. */
test('painted contours and four real Origami human graphs fit varying, attribute and vertex-buffer device budgets',()=>{
  const canvas={width:960,height:600,style:{}} as HTMLCanvasElement;
  const renderer=new THREE.WebGPURenderer({canvas});
  const initialization=vi.spyOn(renderer,'init').mockImplementation(()=>{throw new Error('CPU WGSL inspection must never initialize a renderer or request a device');});
  // Read-only builder capability answers, with no renderer/device admission.
  renderer.hasFeature=()=>false;
  Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});
  Reflect.set(renderer.backend,'renderer',renderer);
  const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami'}),exploration=new ExplorationMask256();
  const layer=withGraphicsStyle(context,()=>new PawnLayer(material=>exploration.configure(material)));
  const invoke=(name:string,...args:unknown[])=>Reflect.apply(Reflect.get(layer,name),layer,args);
  try{
    for(const name of ['smithingGeometry','maceGeometry','longswordGeometry','spearGeometry'])Reflect.set(layer,name,true);
    context.registerHumanAppearance({skin:0xe0b18d,hair:0x4a3222,shirt:0x3b6e8c});
    invoke('createPawnMesh',1);
    const mesh=Reflect.get(layer,'pawnMesh') as THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshStandardNodeMaterial>;
    mesh.geometry.instanceCount=1;
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(0xffffff,3),hemisphere=new THREE.HemisphereLight(0xffffff,0x808080,2);
    scene.add(mesh,sun,hemisphere);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
    const inspect=(object:THREE.Mesh,material:THREE.NodeMaterial,label:string)=>{
      const builder=new InspectionBuilderConstructor(object,renderer);
      builder.scene=scene;builder.camera=camera;builder.material=material;builder.lightsNode=new THREE.LightsNode().setLights([sun,hemisphere]);builder.build();
      const varyings=builder.varyings.filter(varying=>varying.needsInterpolation);
      expect(varyings.length,`${label} varyings: ${varyings.map(varying=>varying.name).join(', ')}`).toBeLessThanOrEqual(16);
      // Pinned RenderObject.getAttributes() resolves node-owned attributes first
      // and deduplicates the underlying interleaved buffer, not attribute names.
      // Counting only geometry.attributes would miss graph-owned streams; an
      // attribute-location check alone hid the old cargo 10-buffer regression.
      const attributes=builder.getAttributesArray().flatMap(nodeAttribute=>{
        const attribute=nodeAttribute.node?.attribute??object.geometry.getAttribute(nodeAttribute.name);
        return attribute===undefined?[]:[{name:nodeAttribute.name,attribute}];
      });
      const buffers=new Set(attributes.map(({attribute})=>attribute instanceof THREE.InterleavedBufferAttribute?attribute.data:attribute));
      const details=`${label}: ${attributes.map(({name,attribute})=>`${name}(${attribute.itemSize})`).join(', ')}; ${buffers.size} vertex buffers`;
      expect(attributes.length,details).toBeGreaterThan(0);expect(attributes.length,details).toBeLessThanOrEqual(16);expect(buffers.size,details).toBeLessThanOrEqual(8);
      // These recipes use explicit vec1..vec4 streams. A stock matrix would
      // occupy several shader locations and require separate accounting.
      for(const {attribute}of attributes)expect(attribute.itemSize,details).toBeLessThanOrEqual(4);
      expect(builder.vertexShader).toContain('VaryingsStruct');
      expect(builder.vertexShader).not.toContain('v_origamiInkStroke');
      const textures=new Set(builder.getBindings().flatMap(group=>group.bindings).filter(binding=>binding.isSampledTexture));
      for(const [stage,bit]of [['vertex',1],['fragment',2]] as const){
        const visible=[...textures].filter(binding=>(binding.visibility&bit)!==0);
        expect(visible.length,`${label} ${stage} sampled textures: ${visible.map(binding=>binding.name).join(', ')}`).toBeLessThanOrEqual(16);
      }
      return {builder,varyings,attributes,buffers};
    };
    const assertPaintedContour=(brush:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshStandardNodeMaterial>,pose:THREE.Node|null,label:string)=>{
      expect(brush,label).toBeInstanceOf(THREE.Mesh);expect(brush,label).not.toBeInstanceOf(THREE.LineSegments);
      expect(brush.material,label).toBeInstanceOf(THREE.MeshStandardNodeMaterial);
      expect(brush.material.transparent,label).toBe(true);expect(brush.material.vertexNode,label).toBeNull();
      expect(brush.material.positionNode,label).toBe(pose);expect(brush.material.normalNode,label).not.toBeNull();
      expect(brush.material.userData.origamiBrush,label).toBe(true);expect(brush.material.userData.origamiUnlitContour,label).not.toBe(true);
      expect(brush.geometry.userData.origamiBrushPrebuilt,label).toBe(true);
      const vertices=brush.geometry.index?.count??brush.geometry.getAttribute('position').count;
      expect(vertices,label).toBeGreaterThan(0);expect(vertices%3,label).toBe(0);
      for(const key of ['referenceBrushBasePositions','referenceBrushWidthOffsets','referenceBrushRoughOffsets'])expect(brush.geometry.userData[key],label).toHaveLength(brush.geometry.getAttribute('position').count*3);
    };
    for(const key of ['plainMaterial','texturedMaterial','nativePlainMaterial','nativeTexturedMaterial']){
      const material=Reflect.get(layer,key) as THREE.MeshStandardNodeMaterial;mesh.material=material;
      const {builder,varyings}=inspect(mesh,material,key);
      expect(varyings.filter(varying=>varying.name==='v_pawnBloodBind')).toHaveLength(1);
      expect(varyings.find(varying=>varying.name==='v_pawnBloodBind')!.type).toBe('vec4');
      expect(varyings.filter(varying=>varying.name==='v_pawnOrigamiTraits')).toHaveLength(1);
      expect(builder.vertexShader).toContain('v_pawnBloodBind');
      if(key.toLowerCase().includes('textured'))expect(varyings.find(varying=>varying.name==='v_origamiPaintProfile')?.type).toBe('vec2');
      const line=Reflect.get(layer,'origamiLineMesh') as THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshStandardNodeMaterial>;
      invoke('selectOrigamiPosition',material.positionNode);invoke('syncOrigamiInstances');
      assertPaintedContour(line,material.positionNode,`${key} painted contours`);expect(line.geometry.instanceCount).toBe(1);
      inspect(line,line.material,`${key} painted contours`);
    }
    const restoreCargo=layer.prepareCargoForCompile();
    try{
      for(const key of ['cargoContour','partialCargoContour']){
        const binding=Reflect.get(layer,key) as {line:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.MeshStandardNodeMaterial>}|undefined;
        expect(binding,`${key} must use the real helper contour`).toBeDefined();const line=binding!.line;
        const source=Reflect.get(layer,key==='cargoContour'?'cargoMesh':'partialCargoMesh') as THREE.Mesh;
        const material=(Array.isArray(source.material)?source.material[0]:source.material) as THREE.NodeMaterial;
        assertPaintedContour(line,material.positionNode,`${key} painted contours`);
        expect(line.geometry.getAttribute('position').count).toBeGreaterThan(0);expect(line.geometry.instanceCount).toBeGreaterThan(0);expect(line.visible).toBe(true);
        const {attributes}=inspect(line,line.material,key);
        const endpoints=attributes.filter(({attribute})=>!(attribute instanceof THREE.InstancedBufferAttribute)&&!(attribute instanceof THREE.InterleavedBufferAttribute&&attribute.data instanceof THREE.InstancedInterleavedBuffer));
        // The actual cargo shader reads several endpoint fields. All must share
        // one packed source stream; the former separate fields exceeded eight
        // buffers even though their sixteen attribute locations still fitted.
        expect(endpoints.length,`${key} must exercise multiple actual endpoint fields`).toBeGreaterThan(1);
        const endpointBuffers=new Set(endpoints.map(({attribute})=>attribute instanceof THREE.InterleavedBufferAttribute?attribute.data:attribute));
        expect(endpointBuffers.size,`${key} static endpoints must remain packed`).toBe(1);
      }
    }finally{restoreCargo();}
  }finally{
    layer.dispose();exploration.dispose();context.dispose();
    try{
      expect(initialization).not.toHaveBeenCalled();
      expect(Reflect.get(renderer,'_initialized')).toBe(false);
      // Pinned r186 dispose() unconditionally calls async setAnimationLoop(),
      // which initializes a cold renderer even for null. This CPU-only object
      // owns no GPU allocations and must not enter that lifecycle. Its real
      // getters were used by WGSL generation; all test-owned resources above
      // are released explicitly. No successful initialization is fabricated.
    }finally{initialization.mockRestore();}
  }
});
