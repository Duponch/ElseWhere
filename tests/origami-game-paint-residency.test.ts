import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {GAME_UNUSED_BESTIARY_SOURCE_KEYS,GAME_USED_BESTIARY_DESCRIPTORS,GAME_USED_BESTIARY_SOURCE_KEYS,GAME_REQUIRED_VIRTUAL_IDS78,createGamewideVirtualPool78} from '../src/render/origami/game-paint-residency';
import {BESTIARY_PAINT_DESCRIPTORS} from '../src/render/origami/bestiary-paint-descriptors';
import {BASE_REFERENCE_PAINT_DESCRIPTORS,PROTECTED_REFERENCE_PAINT_DESCRIPTORS,bestiaryPaintProfile,humanVariantDescriptor} from '../src/render/origami/reference-profiles';
import {ADAPTATION_PAINT_DESCRIPTORS} from '../src/render/origami/bestiary-adaptation-paint';
import {buildBestiaryAnimal,BESTIARY_ANIMAL_SPECIES} from '../src/render/origami/bestiary-registry';

// Reads the actual corrected source factories, independently of the residency
// exclusion list. Geometry only: no Canvas, renderer, rigs or simulation.
let actual:ReadonlyMap<string,readonly number[]>|undefined;
function usage():ReadonlyMap<string,readonly number[]>{
 if(actual)return actual;
 const result=new Map<string,readonly number[]>();
 for(const species of BESTIARY_ANIMAL_SPECIES){
  const group=buildBestiaryAnimal(species,true);if(!group)throw Error('Missing presentation: '+species);
  const ids=new Set<number>(),geometries=new Set<THREE.BufferGeometry>();
  try{
   group.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    geometries.add(object.geometry);if(Array.isArray(object.material))throw Error('Unexpected material array');
    const id:unknown=object.material.userData.referencePaintIndex;
    if(typeof id!=='number'||!Number.isInteger(id)||id<43||id>=88)throw Error('Unknown bestiary paint');
    ids.add(id);
   });
   result.set(species,[...ids].sort((a,b)=>a-b));
  }finally{
   group.traverse(object=>{if(object instanceof THREE.Mesh)geometries.add(object.geometry);});
   for(const geometry of geometries)geometry.dispose();group.clear();
   // The registry owns its shared CPU materials.
  }
 }
 actual=result;return result;
}
describe('gamewide paint residency',()=>{
 it('partitions45 static identities into35 actual materials and10 unrequested identities',()=>{
  expect(GAME_USED_BESTIARY_DESCRIPTORS).toHaveLength(35);expect(GAME_UNUSED_BESTIARY_SOURCE_KEYS).toHaveLength(10);
  expect(new Set([...GAME_USED_BESTIARY_SOURCE_KEYS,...GAME_UNUSED_BESTIARY_SOURCE_KEYS]).size).toBe(45);
  expect(GAME_USED_BESTIARY_DESCRIPTORS).toEqual(BESTIARY_PAINT_DESCRIPTORS.filter(descriptor=>!GAME_UNUSED_BESTIARY_SOURCE_KEYS.some(key=>key===descriptor.sourceKey)));
  for(const descriptor of GAME_USED_BESTIARY_DESCRIPTORS)expect(BESTIARY_PAINT_DESCRIPTORS.find(source=>source.key===descriptor.key)).toBe(descriptor);
 });
 it('preserves every protected ID and all45 new virtual identities',()=>{
  expect(GAME_REQUIRED_VIRTUAL_IDS78.slice(0,43)).toEqual(Array.from({length:43},(_,id)=>id));
  expect(BASE_REFERENCE_PAINT_DESCRIPTORS.slice(0,43)).toEqual(PROTECTED_REFERENCE_PAINT_DESCRIPTORS);
  BESTIARY_PAINT_DESCRIPTORS.forEach((descriptor,index)=>expect(bestiaryPaintProfile(descriptor.sourceKey)).toBe(43+index));
 });
 it('matches the exact independent material union of all35+7 corrected presentation factories',()=>{
  expect(usage().size).toBe(42);
  const union=[...new Set([...usage().values()].flat())].sort((a,b)=>a-b);
  expect(union).toEqual([...GAME_REQUIRED_VIRTUAL_IDS78.slice(43)].sort((a,b)=>a-b));
 });
 it('includes all13 adaptation pigment references without creating new identities',()=>{
  expect(ADAPTATION_PAINT_DESCRIPTORS).toHaveLength(13);
  for(const descriptor of ADAPTATION_PAINT_DESCRIPTORS)expect(GAME_USED_BESTIARY_DESCRIPTORS).toContain(descriptor);
 });
 it('plans78 pigments and77 face templates once, so every animal arrival needs no paint admission',()=>{
  const pool=createGamewideVirtualPool78(),plan=pool.plan();expect(plan.entries).toHaveLength(78);expect(plan.bankShapes[0]?.depth).toBe(78);expect(plan.faceDepth).toBe(77);pool.commit(plan);
  for(const [species,ids]of usage()){pool.requireProfiles('active:'+species,ids);expect(pool.plan().entries).toHaveLength(0);}
  for(let id=0;id<43;id++)expect(pool.resolve(id)?.[0]).toBe(id);
 });
 it('keeps dynamic human rows virtual and admits only their newly requested pigment',()=>{
  const pool=createGamewideVirtualPool78();pool.commit(pool.plan());const skin=pool.registerHumanProfile(humanVariantDescriptor(0,0x123456));
  const row=pool.registerHumanRow([skin,35,36,37,38,39,40,41,42,36,36,36]);pool.requireHumanRow('pawn:7',row);
  const plan=pool.plan();expect(plan.entries).toHaveLength(1);expect(plan.entries[0]?.virtualId).toBe(skin);expect(plan.entries[0]?.pigmentLayer).toBe(78);expect(pool.humanRowsData()[0]).toBe(skin);expect(skin).toBeGreaterThanOrEqual(88);
 });
 it('requires the gamewide set as metadata only and retains the10 unrequested static identities',()=>{
  const pool=createGamewideVirtualPool78();expect(pool.stats().virtualCount).toBe(88);expect(pool.stats().requiredCount).toBe(78);expect(pool.stats().residentCount).toBe(0);expect(pool.stats().metadataBytes).toBe(0);expect(pool.stats().physicalPixelCpuBytes).toBe(0);
  for(const key of GAME_UNUSED_BESTIARY_SOURCE_KEYS){const id=bestiaryPaintProfile(key);expect(pool.id('best46:'+key)).toBe(id);expect(pool.resolve(id)).toBeUndefined();}
 });
});
