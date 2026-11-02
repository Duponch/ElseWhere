import {test,expect} from 'vitest';
import {writeTestFileSync,testOutputPath} from './test-output';
import * as THREE from 'three/webgpu';
import {ActorPartUnionIndex,HumanPartUnionReader,readAnimalPartUnion} from '../src/render/origami/actor-part-union';
import {indexExactStaticVertices} from '../src/render/origami/static-index';
import {origamiHumanGeometry} from '../src/render/origami/human-geometry';
import {origamiAnimalPresentationGeometry} from '../src/render/origami/animal-geometry';
import {createRigBrushGeometry} from '../src/render/origami/rig-brush';
import {HAIR_MASKS,BEARD_MASKS} from '../src/render/pawn-appearance-shape';
import {RESIDENT_WEAPON_VISUALS269} from '../src/render/weapon-shape';

type Row={hair:number;beard:number;weapon:number;outfit:number;worn:number;activity:number};
const empty:Row={hair:0,beard:0,weapon:0,outfit:0,worn:0,activity:0};
function owners(rows:readonly Row[]):THREE.InstancedBufferGeometry {
 const g=new THREE.InstancedBufferGeometry(),shape=new Float32Array(rows.length*4),equipment=new Float32Array(rows.length*4),motion=new Float32Array(rows.length*4);
 rows.forEach((row,i)=>{shape.set([i%5,i%12,row.hair,row.beard+32*(i%121)],i*4);equipment.set([row.weapon,row.outfit,row.worn,0],i*4);motion[i*4+1]=row.activity;});
 for(const [name,array]of [['aShape',shape],['aEquipment',equipment],['aMotion',motion],['aCargo',new Float32Array(rows.length*4)]] as const)g.setAttribute(name,new THREE.InstancedBufferAttribute(array,4));g.instanceCount=rows.length;return g;
}
function common(count:number):Row[]{const hair=[HAIR_MASKS.short,HAIR_MASKS.swept,HAIR_MASKS.bun],beard=[BEARD_MASKS.none,BEARD_MASKS.moustache,BEARD_MASKS.goatee];return Array.from({length:count},(_,i)=>({...empty,hair:hair[i%3]!,beard:beard[i%3]!,weapon:[1,2,0][i%3]!,outfit:[1,3,4][i%3]!,worn:[0,1,6][i%3]!}));}
function diverse(count:number):Row[]{const hair=Object.values(HAIR_MASKS),beard=Object.values(BEARD_MASKS);return Array.from({length:count},(_,i)=>({...empty,hair:hair[i%hair.length]!,beard:beard[i%beard.length]!,weapon:i%8,outfit:i%7,worn:i%12,activity:[0,-30,-31,-32][i%4]!}));}
function allGates(count:number):Row[]{const required=[{...empty,hair:32767,beard:31},...RESIDENT_WEAPON_VISUALS269.map(w=>({...empty,weapon:w.equipment})),...[2,3,4,5,6].map(outfit=>({...empty,outfit})),...[1,2,4,6,10].map(worn=>({...empty,worn})),...[-30,-31,-32].map(activity=>({...empty,activity}))];return Array.from({length:count},(_,i)=>required[i%required.length]!);}
function facts(union:ActorPartUnionIndex,count:number){return {residentVertices:union.sourceVertexCount,sourceIndexEntries:union.stats.sourceIndexEntries,selectedIndexEntries:union.stats.selectedIndexEntries,sourceReferencedVertices:union.stats.sourceReferencedVertices,selectedReferencedVertices:union.stats.selectedReferencedVertices,sourceElementInputs:union.stats.sourceIndexEntries*count,selectedElementInputs:union.stats.selectedIndexEntries*count,indexPatches:union.stats.indexPatches};}

test('records bounded real-factory submission counts without claiming GPU invocations or elapsed performance',()=>{
 const records:unknown[]=[];
 for(const [label,rows]of [['3-common',common(3)],['45-common',common(45)],['45-diverse-catalogue',diverse(45)],['45-all-stable-gates-worst',allGates(45)]] as const){
  const body=origamiHumanGeometry(true,true,true,true),staticIndex=indexExactStaticVertices(body),brush=createRigBrushGeometry(body),wear=body.userData.origamiWear as THREE.InstancedBufferGeometry,stream=owners(rows),reader=new HumanPartUnionReader();
  const families=[body,brush,wear].map(g=>new ActorPartUnionIndex(g,'human'));
  try{
   const state=reader.read(stream,rows.length);for(const union of families)union.reconcile(state);const repeated=reader.read(stream,rows.length);for(const union of families)expect(union.reconcile(repeated)).toBe(false);
   const values=families.map(union=>facts(union,rows.length));expect(reader.stats.rowHits).toBe(rows.length);expect(reader.stats.rowEvaluations).toBe(rows.length);
   if(label==='45-all-stable-gates-worst')for(const value of values)expect(value.selectedIndexEntries).toBe(value.sourceIndexEntries);
   else for(const value of values)expect(value.selectedIndexEntries).toBeLessThan(value.sourceIndexEntries);
   records.push({case:label,owners:rows.length,scope:'all optional equipment recipes admitted; encoded presentation rows, no World',staticIndex,families:{body:values[0],brush:values[1],wear:values[2]},cache:{...reader.stats}});
  }finally{for(const union of families)union.dispose();for(const g of [body,brush,wear,body.userData.origamiLines as THREE.BufferGeometry])g.dispose();stream.dispose();}
 }
 for(const species of ['red-fox','dromedary','hare','labrador-retriever','muffalo','gazelle','deer','elephant']){
  const count=32,body=origamiAnimalPresentationGeometry(count,species)!,staticIndex=indexExactStaticVertices(body),brush=createRigBrushGeometry(body),wear=body.userData.origamiWear as THREE.InstancedBufferGeometry;
  for(let i=0;i<count;i++){body.getAttribute('aBiology').setXYZ(i,1,0,0);body.getAttribute('aAnimal').setXYZW(i,0,0,0,i);}body.instanceCount=count;
  const families=[body,brush,wear].map(g=>new ActorPartUnionIndex(g,'animal'));
  try{
   const live=readAnimalPartUnion(body,count);for(const union of families)union.reconcile(live);const liveFacts=families.map(union=>facts(union,count));expect(liveFacts[0]!.sourceIndexEntries-liveFacts[0]!.selectedIndexEntries).toBe(144);
   body.getAttribute('aAnimal').setZ(count-1,2);const mixed=readAnimalPartUnion(body,count);for(const union of families)union.reconcile(mixed);const mixedFacts=families.map(union=>facts(union,count));for(const value of mixedFacts)expect(value.selectedIndexEntries).toBe(value.sourceIndexEntries);
   records.push({case:`${species}/32-live-and-mixed`,owners:count,scope:'encoded presentation cohort, no World',staticIndex,live:{body:liveFacts[0],brush:liveFacts[1],wear:liveFacts[2]},mixed:{body:mixedFacts[0],brush:mixedFacts[1],wear:mixedFacts[2]}});
  }finally{for(const union of families)union.dispose();for(const g of [body,brush,wear,body.userData.origamiLines as THREE.BufferGeometry])g.dispose();}
 }
 const receipt={scope:'CPU factory topology and encoded-owner selection only; no GPU timing, no FPS, no resident vertex buffer compaction',records},path='artifacts/origami-actor-part-union-counts.json';
 writeTestFileSync(path,`${JSON.stringify(receipt,null,2)}\n`);console.info('ORIGAMI_ACTOR_UNION_COUNTS',testOutputPath(path));
});
