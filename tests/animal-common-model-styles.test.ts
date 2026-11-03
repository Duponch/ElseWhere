/** Real WildlifeLayer/medical/animation producers. Canvas paint is a sink;
 * no device, pixels, simulation step or interstyle performance claim. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const s=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:s.stubResidentPaintToSink};});
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {AnimationDetail} from '../src/render/AnimationDetail';
import type {ActorAnimationCache} from '../src/render/ActorAnimationCache';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {ANIMAL_SPECIES_IDS,type AnimalSpeciesId} from '../src/sim/animal-species';
import {adultAgeTicks} from '../src/sim/animal-life';
import {attachGeneratedAnimalGrowth256,validAnimalGrowthTracker256} from '../src/sim/animal-growth-runtime-256';
import {initializeAnimalEggLayer256} from '../src/sim/animal-egg-local-v256';
import {animalCombatCamp} from './scenarios/animal-combat';
import {createAnimalMedicalRecord256} from '../src/sim/animal-clinical-age-v256';
import {medicalModel} from '../src/sim/body-model';
import {addResolvedInjury} from '../src/sim/injury-state';
import {HP_UNIT} from '../src/sim/injury-rules';
import {corpseVisualMask} from '../src/render/corpse-presentation';
import type {WildAnimal} from '../src/sim/wildlife-state';

type Mesh=THREE.Mesh<THREE.InstancedBufferGeometry,THREE.NodeMaterial>;
function body(layer:WildlifeLayer,species:string){const mesh=layer.mesh.children.find(o=>o.name===`Wild ${species} — GPU rig`);if(!(mesh instanceof THREE.Mesh))throw Error('Missing real species rig '+species);return mesh as Mesh;}
function values(g:THREE.BufferGeometry,name:string){const a=g.getAttribute(name);return Array.from({length:a.count},(_,v)=>Array.from({length:a.itemSize},(_,c)=>a.getComponent(v,c)));}
function owner(style:'default'|'origami'){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style,impasto:0,wear:0}),flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),requirePaint=vi.spyOn(context,'requirePaint'),brush=vi.spyOn(context,'prepareBrushGeometry'),lighting=new EnvironmentLighting(),detail=new AnimationDetail(),layer=withGraphicsStyle(context,()=>new WildlifeLayer(lighting.configure,undefined,detail));
 return{context,flush,requirePaint,brush,lighting,detail,layer,dispose(){layer.dispose();lighting.dispose();context.dispose();flush.mockRestore();requirePaint.mockRestore();brush.mockRestore();}};
}
function rigs(layer:WildlifeLayer){return Reflect.get(layer,'rigs') as {species:string;mesh:Mesh;plainMaterial:THREE.MeshStandardNodeMaterial;texturedMaterial:THREE.MeshStandardNodeMaterial;animationCache:ActorAnimationCache}[];}
/** Renderer fixture with the same fresh scalar record boundary as wildlife.ts
 * addAnimal (which is private). No copied tracker/mind/clinical/job state, no
 * simulated spawn or RNG claim. Run its actual growth+mind and egg initializers
 * once. Zero nutrition is valid even for the smallest newborn species. */
function freshAnimal(species:AnimalSpeciesId,index:number,ageTicks:number,world:{tick:number;schemaVersion:number}):WildAnimal{
 const animal:WildAnimal={id:900+index,species,sex:'female',ageTicks,food:0,rest:1,x:2+index%25,z:2+Math.floor(index/25),state:index%4===0?'sleeping':'idle',path:[],nextDecision:world.tick+100};
 attachGeneratedAnimalGrowth256(animal,world.tick*10,world.schemaVersion);initializeAnimalEggLayer256(animal);expect(validAnimalGrowthTracker256(animal,world.schemaVersion,world.tick)).toBe(true);expect(animal.wander).toEqual({revision:1,nextMoveOrderIsWait:false});return animal;
}

test('all53 active animals share corrected geometry, clinical owners, native/cached poses and growth across styles; Default keeps coat surfaces without Origami companions or bake admission',()=>{
 let world=animalCombatCamp();world.resources=[];world.piles=[];world.wildlife!.animals=ANIMAL_SPECIES_IDS.map((species,i)=>freshAnimal(species,i,adultAgeTicks(species),world));world.nextId=Math.max(world.nextId,1000);
 const legacy=owner('default'),origami=owner('origami'),camera=new THREE.OrthographicCamera(-16,16,16,-16,.1,100);camera.position.set(20,20,20);camera.lookAt(16,0,16);camera.updateMatrixWorld();
 const compare=()=>{
  const before=JSON.stringify(world);for(const o of [legacy,origami])o.layer.update(world,undefined,true);expect(JSON.stringify(world)).toBe(before);
  for(const species of ANIMAL_SPECIES_IDS){const a=body(legacy.layer,species),b=body(origami.layer,species);expect(a.visible,species).toBe(true);expect(a.geometry.instanceCount,species).toBe(1);expect(b.geometry.instanceCount,species).toBe(1);expect(a.geometry.userData.origamiReference,species).toBe(b.geometry.userData.origamiReference);expect(a.geometry.userData.origamiReference,species).toBeTruthy();
   for(const field of ['position','normal','color','animalPart','bindPivot','uv','aFrom','aTo','aTravel','aAnimal','aBiology','aCarrier','aCorpseHandoff','aCorpseFrom','aCorpseTo'])expect(values(a.geometry,field),species+'/'+field).toEqual(values(b.geometry,field));
   expect(Array.from(a.geometry.index!.array),species+'/indices').toEqual(Array.from(b.geometry.index!.array));expect(a.geometry.drawRange,species+'/active range').toEqual(b.geometry.drawRange);
   const material=a.material as THREE.MeshStandardNodeMaterial;expect(material).toBeInstanceOf(THREE.MeshStandardNodeMaterial);expect(material.roughness).toBe(.93);expect(material.metalness).toBe(0);expect(material.normalNode).toBeNull();expect(material.positionNode).not.toBeNull();expect(material.colorNode).not.toBeNull();const coats:THREE.Texture[]=[];material.colorNode!.traverse(n=>{if(n instanceof THREE.TextureNode)coats.push(n.value);});expect(coats.some(t=>t.name.startsWith('Pastel animal coat — ')),species+'/actual Legacy coat').toBe(true);expect(a.children.some(m=>m instanceof THREE.Mesh&&(m.material as THREE.Material).userData.origamiBrush)).toBe(false);expect(a.geometry.hasAttribute('bakedUv')).toBe(false);expect(a.geometry.userData.origamiWear).toBeUndefined();
  }
  expect(legacy.layer.bakedStatus()).toMatchObject({eligible:false,pending:false,published:[]});expect(legacy.requirePaint).not.toHaveBeenCalled();expect(legacy.brush).not.toHaveBeenCalled();
 };
 try{
  expect(ANIMAL_SPECIES_IDS).toHaveLength(53);compare();const adultScales=ANIMAL_SPECIES_IDS.map(s=>body(legacy.layer,s).geometry.getAttribute('aScale').getX(0)),deerActive=body(legacy.layer,'deer').geometry.drawRange.count;
  // A real localized injury removes an existing outside silhouette part; the
  // renderer consumes the resulting medical record and packed mask unchanged.
  const deer=world.wildlife!.animals.find(a=>a.species==='deer')!,health=deer.health=createAnimalMedicalRecord256(world,deer),model=medicalModel(health);
  const part=model.parts.find(p=>p.parent!==null&&p.id.endsWith('-ear'))?.id;if(!part)throw Error('Actual deer ear owner missing');addResolvedInjury(health,part,'cut',model.byId[part].hp*HP_UNIT+HP_UNIT,()=>.999999);expect(health.missing.some(m=>m.part===part)).toBe(true);
  // A fresh renderer snapshot contains genuinely younger generated originals.
  // Changing age alone would leave the authoritative adult growthTracker intact.
  // Keep the injured adult/medical clock; reconstruct only the healthy owners.
  world={...world,wildlife:{...world.wildlife!,animals:world.wildlife!.animals.map((animal,i)=>animal===deer?animal:freshAnimal(animal.species,i,Math.floor(adultAgeTicks(animal.species)*.4),world))}};world.wildlife!.animals[1]!.state='dead';
  compare();expect(ANIMAL_SPECIES_IDS.some((s,i)=>body(legacy.layer,s).geometry.getAttribute('aScale').getX(0)<adultScales[i]!)).toBe(true);expect(body(legacy.layer,'deer').geometry.drawRange.count).toBeLessThan(deerActive);const mask=corpseVisualMask({animalId:deer.id,species:deer.species,sex:deer.sex,ageTicks:deer.ageTicks,health});expect(mask).toBeGreaterThan(0);expect(body(legacy.layer,'deer').geometry.getAttribute('aBiology').getZ(0)).toBe(mask);
  for(const viewport of [10000,32*(legacy.detail.nearPixels.value+legacy.detail.farPixels.value)/2]){
   const before=JSON.stringify(world);for(const o of [legacy,origami]){o.detail.beginFrame(123,camera,viewport,world.tick);o.layer.presentAnimations();}expect(JSON.stringify(world)).toBe(before);
   const left=rigs(legacy.layer),right=rigs(origami.layer);if(viewport===10000)expect(left.every(r=>r.animationCache.get(0,1,3)===0)).toBe(true);else expect(left.some(r=>r.animationCache.get(0,1,3)===1)).toBe(true);for(let i=0;i<left.length;i++){const a=left[i]!,b=right[i]!;expect(a.species).toBe(b.species);for(let cell=0;cell<64;cell++)for(let c=0;c<4;c++)expect(a.animationCache.get(0,cell,c),a.species+'/cache/'+cell).toBe(b.animationCache.get(0,cell,c));}
  }
  // The existing texture toggle selects actual plain/coat materials; it does
  // not swap the shared bind geometry or create an atlas/brush owner in Default.
  const geometries=ANIMAL_SPECIES_IDS.map(s=>body(legacy.layer,s).geometry);legacy.layer.setTexturesEnabled(false);for(const rig of rigs(legacy.layer))expect(rig.mesh.material).toBe(rig.plainMaterial);legacy.layer.setTexturesEnabled(true);for(const rig of rigs(legacy.layer))expect(rig.mesh.material).toBe(rig.texturedMaterial);expect(ANIMAL_SPECIES_IDS.map(s=>body(legacy.layer,s).geometry)).toEqual(geometries);expect(legacy.requirePaint).not.toHaveBeenCalled();expect(legacy.brush).not.toHaveBeenCalled();
 }finally{origami.dispose();legacy.dispose();}
},60000);
