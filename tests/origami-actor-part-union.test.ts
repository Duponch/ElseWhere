import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {ActorPartUnionIndex,HumanPartUnionReader,createActorPartUnionIndex,readHumanPartUnion,readAnimalPartUnion} from '../src/render/origami/actor-part-union';
import {origamiHumanGeometry} from '../src/render/origami/human-geometry';
import {origamiAnimalPresentationGeometry} from '../src/render/origami/animal-geometry';
import {createRigBrushGeometry} from '../src/render/origami/rig-brush';

function humanOwners(rows:readonly {hair?:number;beard?:number;body?:number;weapon?:number;outfit?:number;worn?:number;activity?:number;cargo?:number}[]):THREE.InstancedBufferGeometry {
 const g=new THREE.InstancedBufferGeometry(),shape=new Float32Array(rows.length*4),equipment=new Float32Array(rows.length*4),motion=new Float32Array(rows.length*4),cargo=new Float32Array(rows.length*4);
 rows.forEach((r,i)=>{shape.set([r.body??0,0,r.hair??0,r.beard??0],i*4);equipment.set([r.weapon??0,r.outfit??0,r.worn??0,0],i*4);motion.set([0,r.activity??0,0,0],i*4);cargo[i*4]=r.cargo??0;});
 for(const [name,values]of [['aShape',shape],['aEquipment',equipment],['aMotion',motion],['aCargo',cargo]] as const)g.setAttribute(name,new THREE.InstancedBufferAttribute(values,4));g.instanceCount=rows.length;return g;
}
function humanTriangles(dyes:readonly number[]):THREE.InstancedBufferGeometry {
 const g=new THREE.InstancedBufferGeometry(),positions:number[]=[],traits:number[]=[];
 dyes.forEach((dye,triangle)=>{positions.push(triangle,0,0,triangle+1,0,0,triangle,1,0);for(let i=0;i<3;i++)traits.push(0,dye,0);});
 g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('pawnRigTraits',new THREE.Float32BufferAttribute(traits,3));return g;
}
function selected(c:ActorPartUnionIndex):number[]{return Array.from(c.geometry.index!.array).slice(0,c.geometry.drawRange.count);}
function animalOwners(rows:readonly {absent:number;posture:number}[]):THREE.InstancedBufferGeometry {
 const g=new THREE.InstancedBufferGeometry(),biology=new Float32Array(rows.length*3),state=new Float32Array(rows.length*4);rows.forEach((row,i)=>{biology.set([1,0,row.absent],i*3);state.set([0,0,row.posture,0],i*4);});g.setAttribute('aBiology',new THREE.InstancedBufferAttribute(biology,3));g.setAttribute('aAnimal',new THREE.InstancedBufferAttribute(state,4));return g;
}
describe('actor family union removes only triangles hidden for every existing owner',()=>{
 it('does nothing at the disabled/Default boundary and never disposes owner geometry or attributes',()=>{
  const plain=new THREE.InstancedBufferGeometry();expect(createActorPartUnionIndex(plain,'human',false)).toBeUndefined();expect(plain.index).toBeNull();expect(Object.keys(plain.attributes)).toEqual([]);plain.dispose();
  const g=humanTriangles([0,100]),controller=new ActorPartUnionIndex(g,'human');let disposed=0;g.addEventListener('dispose',()=>disposed++);const position=g.getAttribute('position');controller.dispose();controller.dispose();expect(disposed).toBe(0);expect(g.getAttribute('position')).toBe(position);expect(Array.from(g.index!.array)).toEqual([0,1,2,3,4,5]);g.dispose();expect(disposed).toBe(1);
 });
 it('caches actual owner visibility rows across palette/ready/phase changes and refreshes when a tool signal changes',()=>{
  const g=humanTriangles([-30,-31,-32,100]),controller=new ActorPartUnionIndex(g,'human'),owners=humanOwners([{hair:1,activity:-30,weapon:1.25,beard:1}]),reader=new HumanPartUnionReader();
  try{controller.reconcile(reader.read(owners,1));expect(selected(controller)).toEqual([0,1,2,9,10,11]);expect(reader.stats.rowEvaluations).toBe(1);const before=reader.stats.rowEvaluations;(owners.getAttribute('aShape') as THREE.InstancedBufferAttribute).setW(0,1+32*105);(owners.getAttribute('aEquipment') as THREE.InstancedBufferAttribute).setX(0,1.75);(owners.getAttribute('aMotion') as THREE.InstancedBufferAttribute).setW(0,19000);controller.reconcile(reader.read(owners,1));expect(reader.stats.rowEvaluations).toBe(before);expect(reader.stats.rowHits).toBe(1);(owners.getAttribute('aMotion') as THREE.InstancedBufferAttribute).setY(0,-31);controller.reconcile(reader.read(owners,1));expect(selected(controller)).toEqual([3,4,5,9,10,11]);expect(reader.stats.rowEvaluations).toBe(before+1);(owners.getAttribute('aCargo') as THREE.InstancedBufferAttribute).setX(0,1);controller.reconcile(reader.read(owners,1));expect(selected(controller)).toEqual([9,10,11]);(owners.getAttribute('aCargo') as THREE.InstancedBufferAttribute).setX(0,0);controller.reconcile(reader.read(owners,1));expect(selected(controller)).toEqual([3,4,5,9,10,11]);}finally{controller.dispose();g.dispose();owners.dispose();}
 });
 it('normalizes corpse stage exactly once and restores a reused living slot while palette rows remain independent',()=>{
  const g=humanTriangles([0,100,200,-1]),controller=new ActorPartUnionIndex(g,'human'),owners=humanOwners([{body:20,hair:1,beard:32*91+1,weapon:1}]),reader=new HumanPartUnionReader();
  try{controller.reconcile(reader.read(owners,1));expect(selected(controller)).toEqual([0,1,2]);const shape=owners.getAttribute('aShape') as THREE.InstancedBufferAttribute;shape.setX(0,0);controller.reconcile(reader.read(owners,1));expect(selected(controller)).toEqual(Array.from({length:12},(_,i)=>i));const evaluations=reader.stats.rowEvaluations;shape.setW(0,32*4+1);controller.reconcile(reader.read(owners,1));expect(selected(controller)).toHaveLength(12);expect(reader.stats.rowEvaluations).toBe(evaluations);}finally{controller.dispose();g.dispose();owners.dispose();}
 });
 it('preserves triangle/index order, exact source vertex IDs and unchanged attribute objects',()=>{
  const g=humanTriangles([0,100,101,200]),original=new THREE.BufferAttribute(new Uint16Array([2,0,1,5,3,4,8,6,7,11,9,10]),1);g.setIndex(original);const position=g.getAttribute('position'),traits=g.getAttribute('pawnRigTraits'),controller=new ActorPartUnionIndex(g,'human'),owners=humanOwners([{hair:1}]);
  try{controller.reconcile(readHumanPartUnion(owners,1));expect(selected(controller)).toEqual([2,0,1,5,3,4]);expect(g.index).toBe(original);expect(g.getAttribute('position')).toBe(position);expect(g.getAttribute('pawnRigTraits')).toBe(traits);const version=original.version;expect(controller.reconcile(readHumanPartUnion(owners,1))).toBe(false);expect(original.version).toBe(version);controller.dispose();expect(Array.from(original.array)).toEqual([2,0,1,5,3,4,8,6,7,11,9,10]);}finally{controller.dispose();g.dispose();owners.dispose();}
 });
 it('evaluates crossed hair/helmet and parka/hood conditions per owner before taking the union',()=>{
  const g=humanTriangles([100,101,200,-6,-7,-8,-40,-41,-2,-12]),controller=new ActorPartUnionIndex(g,'human');
  const owners=humanOwners([{hair:1,beard:1,body:0,outfit:4,worn:2},{hair:2,beard:32*15,outfit:3,worn:1}]);
  try{controller.reconcile(readHumanPartUnion(owners,2));expect(selected(controller)).toEqual([3,4,5,6,7,8,12,13,14,18,19,20,21,22,23,24,25,26]);}finally{controller.dispose();g.dispose();owners.dispose();}
 });
 it('keeps actual weapon/tool tags, vest flags, palette bits and corpse stage independent',()=>{
  const g=humanTriangles([-1,-4,-5,-9,-30,-31,-32,100,200]),controller=new ActorPartUnionIndex(g,'human'),owners=humanOwners([{weapon:1.75,activity:-31,hair:1,beard:32*83+1}]);
  try{controller.reconcile(readHumanPartUnion(owners,1));expect(selected(controller)).toEqual([0,1,2,15,16,17,21,22,23,24,25,26]);(owners.getAttribute('aCargo') as THREE.InstancedBufferAttribute).setX(0,1);controller.reconcile(readHumanPartUnion(owners,1));expect(selected(controller)).toEqual([0,1,2,21,22,23,24,25,26]);(owners.getAttribute('aShape') as THREE.InstancedBufferAttribute).setX(0,20);controller.reconcile(readHumanPartUnion(owners,1));expect(selected(controller)).toEqual([]);}finally{controller.dispose();g.dispose();owners.dispose();}
 });
 it('has no45-owner cap and handles reorder, all-parts union, uncertain data and empty ownership conservatively',()=>{
  const g=humanTriangles([0,100,101,200,201]),controller=new ActorPartUnionIndex(g,'human'),owners=humanOwners(Array.from({length:500},(_,i)=>({hair:i%2?1:2,beard:i%2?1:2})));
  try{controller.reconcile(readHumanPartUnion(owners,500));expect(selected(controller)).toEqual(Array.from({length:15},(_,i)=>i));const shape=owners.getAttribute('aShape') as THREE.InstancedBufferAttribute;for(let i=0;i<500;i++)shape.setXYZW(i,0,0,0,0);controller.reconcile(readHumanPartUnion(owners,500));expect(selected(controller)).toEqual([0,1,2]);shape.setZ(499,NaN);controller.reconcile(readHumanPartUnion(owners,500));expect(selected(controller)).toHaveLength(15);controller.reconcile(readHumanPartUnion(owners,0));expect(selected(controller)).toHaveLength(0);}finally{controller.dispose();g.dispose();owners.dispose();}
 });
 it('temporarily warms all original primitives and restores the latest adoption after nested warm scopes',()=>{
  const g=humanTriangles([0,100,101]),controller=new ActorPartUnionIndex(g,'human'),first=humanOwners([{hair:1}]),second=humanOwners([{hair:2}]);
  try{controller.reconcile(readHumanPartUnion(first,1));const a=controller.prepareForCompile(),b=controller.prepareForCompile();expect(g.drawRange.count).toBe(9);controller.reconcile(readHumanPartUnion(second,1));a();expect(g.drawRange.count).toBe(9);b();expect(selected(controller)).toEqual([0,1,2,6,7,8]);b();expect(selected(controller)).toEqual([0,1,2,6,7,8]);}finally{controller.dispose();g.dispose();first.dispose();second.dispose();}
 });
 it('retains shared clinical parts unless all owners lack them, and mixed live/dead eyes retain both states',()=>{
  const g=new THREE.InstancedBufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(5*9),3));const words:number[]=[];for(const [bit,eye]of [[0,-1],[4,-1],[8,-1],[16,0],[16,1]])for(let i=0;i<3;i++)words.push(0,bit,0,eye);g.setAttribute('animalPart',new THREE.Float32BufferAttribute(words,4));const controller=new ActorPartUnionIndex(g,'animal'),owners=animalOwners([{absent:4,posture:0},{absent:12,posture:2}]);
  try{controller.reconcile(readAnimalPartUnion(owners,2));expect(selected(controller)).toEqual([0,1,2,6,7,8,9,10,11,12,13,14]);(owners.getAttribute('aAnimal') as THREE.InstancedBufferAttribute).setZ(1,1);controller.reconcile(readAnimalPartUnion(owners,2));expect(selected(controller)).toEqual([0,1,2,6,7,8,9,10,11]);}finally{controller.dispose();g.dispose();owners.dispose();}
 });
 it('keeps real compiled family inputs and reduces absent styles without expanding indexed brush strips',()=>{
  const body=origamiHumanGeometry(true,true,true,true),brush=createRigBrushGeometry(body),wear=body.userData.origamiWear as THREE.InstancedBufferGeometry,owners=humanOwners([{hair:51}]);const controllers=[body,brush,wear].map(g=>new ActorPartUnionIndex(g,'human'));
  try{const state=readHumanPartUnion(owners,1);for(const controller of controllers){controller.reconcile(state);expect(controller.stats.selectedIndexEntries).toBeLessThan(controller.stats.sourceIndexEntries);expect(controller.stats.selectedReferencedVertices).toBeLessThan(controller.stats.sourceReferencedVertices);expect(controller.geometry.getAttribute('position').count).toBe(controller.sourceVertexCount);}expect(brush.index).not.toBeNull();}finally{for(const controller of controllers)controller.dispose();for(const g of [body,brush,wear,body.userData.origamiLines as THREE.BufferGeometry])g.dispose();owners.dispose();}
 });
 it('removes the real resident corpse crosses from a living animal family, restoring them for dead owners',()=>{
  const body=origamiAnimalPresentationGeometry(2,'deer')!,controller=new ActorPartUnionIndex(body,'animal'),owners=animalOwners([{absent:0,posture:0},{absent:0,posture:0}]);
  try{controller.reconcile(readAnimalPartUnion(owners,2));expect(controller.stats.sourceIndexEntries-controller.stats.selectedIndexEntries).toBe(144);(owners.getAttribute('aAnimal') as THREE.InstancedBufferAttribute).setZ(1,2);controller.reconcile(readAnimalPartUnion(owners,2));expect(controller.stats.selectedIndexEntries).toBe(controller.stats.sourceIndexEntries);}finally{controller.dispose();for(const g of [body,body.userData.origamiLines as THREE.BufferGeometry,body.userData.origamiWear as THREE.BufferGeometry])g.dispose();owners.dispose();}
 });
});
