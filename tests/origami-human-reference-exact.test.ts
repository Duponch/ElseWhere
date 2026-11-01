import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {buildOrigamiHumanReference,HUMAN_REFERENCE_PIGMENTS,type OrigamiHumanPart} from '../src/render/origami/human-reference';
import {origamiHumanGeometry,origamiHumanParts,HUMAN_REFERENCE_SCALE,ORIGAMI_HUMAN_BIND,ORIGAMI_DUSTER_DYE,ORIGAMI_PARKA_DYE} from '../src/render/origami/human-geometry';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {pawnGeometry} from '../src/render/pawn-geometry';

// Independent literal user source, including the original helper algorithms.
// Only edge decorators are inert in this geometry oracle; the paint and edge
// modules have their own independent source oracles.
const helpers=readFileSync(new URL('./fixtures/origami-animal-source.html-fragment.txt',import.meta.url),'utf8');
const original=readFileSync(new URL('./fixtures/origami-human-source.html-fragment.txt',import.meta.url),'utf8');
const originalEdges=readFileSync(new URL('./fixtures/origami-edge-source.html-fragment.txt',import.meta.url),'utf8');
type RefMesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
const buildOriginal=new Function('THREE','registerGouacheMat','kraftEdgeMaterial','allCardboardEdgeLines','createPhysicalEdgeWearMesh',helpers+'\n'+original+'\nreturn buildRimWorldColonist;')(
  THREE,(config:{baseColor:string})=>{const material=new THREE.MeshBasicMaterial({color:config.baseColor});material.userData.sourceConfig=config;return material;},new THREE.LineBasicMaterial(),[],()=>null,
) as (preset:Record<string,string>)=>THREE.Group;
function meshes(group:THREE.Group):RefMesh[]{const result:RefMesh[]=[];group.updateMatrixWorld(true);group.traverse(object=>{if(object instanceof THREE.Mesh)result.push(object as RefMesh);});return result;}
function disposeOriginal(group:THREE.Group):void {group.traverse(object=>{if(object instanceof THREE.Mesh||object instanceof THREE.LineSegments)object.geometry.dispose();});}
function disposeCompiled(geometry:THREE.BufferGeometry):void {geometry.userData.origamiLines?.dispose();geometry.userData.origamiWear?.dispose();geometry.dispose();}
function comparePart(actual:OrigamiHumanPart,expected:RefMesh):void {
  const center=new THREE.Vector3().setFromMatrixPosition(expected.matrixWorld);
  actual.at.forEach((coordinate,index)=>expect(coordinate).toBeCloseTo(center.getComponent(index),12));
  // BoxGeometry's supplied normals and the source's recomputed normals differ
  // only in IEEE zero signs. Normalize signed zero, with no numeric tolerance.
  const unsignedZero=(value:number)=>value===0?0:value;
  for(const name of ['position','normal','uv'])expect(Array.from(actual.geometry.getAttribute(name).array,unsignedZero),`${actual.id} ${name}`).toEqual(Array.from(expected.geometry.getAttribute(name).array,unsignedZero));
  expect(HUMAN_REFERENCE_PIGMENTS[actual.profile]).toEqual(expected.material.userData.sourceConfig);
}

describe('Origami humans use the actual supplied colonist artwork',()=>{
  it('pins the original human constructor independently of the port',()=>{
    expect(createHash('sha256').update(original).digest('hex')).toBe('fb696e2614dc21f57b818a3f5118fd3e4f18805e6020926dc10effaecdc303ed');
  });

  it('preserves authored head, nose, ears, eyes, torso, upper arms, separate hands and boots exactly',()=>{
    const source=buildOriginal({}),expected=meshes(source),actual=buildOrigamiHumanReference();
    const mapping:Record<string,number>={
      'reference-torso':0,'reference-head':1,'reference-nose':2,
      'reference-left-eye':3,'reference-left-ear':4,'reference-right-eye':5,'reference-right-ear':6,
      'reference-left-upper-arm':7,'reference-left-hand':8,'reference-right-upper-arm':9,'reference-right-hand':10,
      'reference-left-boot':12,'reference-right-boot':14,
    };
    for(const [id,index]of Object.entries(mapping))comparePart(actual.find(part=>part.id===id)!,expected[index]);
    const nose=actual.find(part=>part.id==='reference-nose')!;nose.geometry.computeBoundingBox();
    expect(nose.at[2]+nose.geometry.boundingBox!.max.z).toBeGreaterThan(.21);
    for(const side of ['left','right']){
      const hand=actual.find(part=>part.id===`reference-${side}-hand`)!;
      expect(hand.pivot[1]).toBe(1.12);expect(hand.at[1]).toBe(.82);expect(hand.dye).toBe(2);
      const boot=actual.find(part=>part.id===`reference-${side}-boot`)!;expect(boot.dye).toBe(3);
    }
    actual.forEach(part=>part.geometry.dispose());disposeOriginal(source);
  });

  it('splits trousers only at their authored face midpoint and retains the original paint range',()=>{
    const actual=buildOrigamiHumanReference();
    for(const side of ['left','right']){
      const upper=actual.find(part=>part.id===`reference-${side}-trouser-upper`)!,lower=actual.find(part=>part.id===`reference-${side}-trouser-lower`)!;
      expect(upper.bone).toBe(side==='left'?4:5);expect(lower.bone).toBe(side==='left'?6:7);
      for(const [part,bottom,top,vBottom,vTop]of [[upper,.35,.56,.5,1],[lower,.14,.35,0,.5]] as const){
        part.geometry.computeBoundingBox();expect(part.at[1]+part.geometry.boundingBox!.min.y).toBeCloseTo(bottom,7);expect(part.at[1]+part.geometry.boundingBox!.max.y).toBeCloseTo(top,7);
        const uv=part.geometry.getAttribute('uv'),normal=part.geometry.getAttribute('normal'),values:number[]=[];
        for(let i=0;i<uv.count;i++)if(Math.abs(normal.getY(i))<.9)values.push(uv.getY(i));
        expect(Math.min(...values)).toBe(vBottom);expect(Math.max(...values)).toBe(vTop);
      }
    }
    actual.forEach(part=>part.geometry.dispose());
  });

  it('uses source coat and hair pieces only as real duster and existing hair identities',()=>{
    const sheriff=buildOriginal({role:'sheriff'}),sheriffMeshes=meshes(sheriff),medic=buildOriginal({role:'medic'}),medicMeshes=meshes(medic),actual=origamiHumanParts(true,true,true,true);
    comparePart(actual.find(part=>part.id==='apparel-duster-left')!,sheriffMeshes[1]);
    comparePart(actual.find(part=>part.id==='apparel-duster-right')!,sheriffMeshes[2]);
    comparePart(actual.find(part=>part.id==='apparel-duster-back')!,sheriffMeshes[3]);
    // Find the source medic's crown and bun by their source local dimensions
    // and world center, independent of the production hair array.
    const at=(mesh:RefMesh,y:number,z:number)=>Math.abs(mesh.matrixWorld.elements[13]-y)<1e-9&&Math.abs(mesh.matrixWorld.elements[14]-z)<1e-9;
    comparePart(actual.find(part=>part.id==='identity-hair-0')!,medicMeshes.find(mesh=>at(mesh,1.60,-.02))!);
    comparePart(actual.find(part=>part.id==='identity-hair-7')!,medicMeshes.find(mesh=>at(mesh,1.58,-.26))!);
    expect(actual.filter(part=>part.id.startsWith('identity-hair-')).map(part=>part.dye)).toEqual(Array.from({length:15},(_,i)=>100+i));
    expect(actual.filter(part=>part.id.startsWith('identity-beard-')).map(part=>part.dye)).toEqual(Array.from({length:5},(_,i)=>200+i));
    expect(actual.some(part=>/bandana|badge|medbox|bedroll|pack|lamp/i.test(part.id))).toBe(false);
    expect(actual.filter(part=>part.id.startsWith('apparel-duster-')&&part.dye===ORIGAMI_DUSTER_DYE)).toHaveLength(3);
    expect(actual.filter(part=>part.id.startsWith('weapon-')).some(part=>part.dye===ORIGAMI_DUSTER_DYE||part.dye===ORIGAMI_PARKA_DYE)).toBe(false);
    expect(actual.some(part=>part.dye===ORIGAMI_PARKA_DYE)).toBe(true);
    actual.forEach(part=>part.geometry.dispose());disposeOriginal(sheriff);disposeOriginal(medic);
  });

  it('packs real source geometry, source UV and paint profile into the existing eight-bone batch',()=>{
    const geometry=origamiHumanGeometry(true,true,true,true),position=geometry.getAttribute('position') as THREE.InterleavedBufferAttribute,traits=geometry.getAttribute('pawnRigTraits') as THREE.InterleavedBufferAttribute,uv=geometry.getAttribute('uv') as THREE.InterleavedBufferAttribute;
    expect(traits.data).toBe(position.data);expect(uv.data).toBe(position.data);expect(traits.itemSize).toBe(3);
    expect(geometry.getAttribute('origamiPaintUv')).toBe(uv);expect(geometry.instanceCount).toBe(0);
    const bones=new Set<number>(),dye=geometry.getAttribute('dye'),pivot=geometry.getAttribute('bindPivot'),profile=geometry.getAttribute('origamiMaterialProfile');
    for(let i=0;i<position.count;i++){
      expect(Number.isFinite(position.getX(i)+position.getY(i)+position.getZ(i))).toBe(true);
      expect(traits.getY(i)).toBe(dye.getX(i));expect(traits.getZ(i)).toBe(profile.getX(i));expect(Number.isInteger(profile.getX(i))).toBe(true);bones.add(traits.getX(i));
      if(dye.getX(i)<=-30&&dye.getX(i)>=-32){expect(traits.getX(i)).toBe(3);expect(pivot.getX(i)).toBeCloseTo(ORIGAMI_HUMAN_BIND.shoulderX);expect(pivot.getY(i)).toBeCloseTo(ORIGAMI_HUMAN_BIND.shoulderY);}
    }
    expect([...bones].sort()).toEqual([0,1,2,3,4,5,6,7]);
    const range=geometry.userData.origamiHumanParts.find((part:{id:string})=>part.id==='reference-nose');
    let maxZ=-Infinity;for(let i=range.start;i<range.start+range.count;i++)maxZ=Math.max(maxZ,position.getZ(i));
    expect(maxZ).toBeCloseTo(.22*HUMAN_REFERENCE_SCALE,7);disposeCompiled(geometry);
  });

  it('bakes source physical lines and wear with the same rig and exact authored base/expansion streams',()=>{
    const createOriginalWear=new Function('THREE','currentEdgeWearPct','physicalEdgeWearMaterial','currentEdgeOpacityPct','allPhysicalEdgeMeshes',originalEdges+'\nreturn createPhysicalEdgeWearMesh;')(THREE,75,new THREE.MeshBasicMaterial(),65,[]) as (surface:THREE.BufferGeometry,edges:THREE.BufferGeometry)=>THREE.Mesh;
    const source=buildOriginal({}),torso=meshes(source)[0],sourceLines=new THREE.EdgesGeometry(torso.geometry,22),sourceWear=createOriginalWear(torso.geometry,sourceLines),compiled=origamiHumanGeometry();
    const lines=compiled.userData.origamiLines as THREE.InstancedBufferGeometry,wear=compiled.userData.origamiWear as THREE.InstancedBufferGeometry;
    const localPoint=new THREE.Vector3(),expectedLine=sourceLines.getAttribute('position'),actualLine=lines.getAttribute('position');
    for(let i=0;i<expectedLine.count;i++){
      localPoint.fromBufferAttribute(expectedLine,i).applyMatrix4(torso.matrixWorld).multiplyScalar(HUMAN_REFERENCE_SCALE);
      expect(actualLine.getX(i)).toBe(Math.fround(localPoint.x));expect(actualLine.getY(i)).toBe(Math.fround(localPoint.y));expect(actualLine.getZ(i)).toBe(Math.fround(localPoint.z));
    }
    const sourcePosition=sourceWear.geometry.getAttribute('position'),actualWear=wear.getAttribute('position'),sourceUV=sourceWear.geometry.getAttribute('uv'),actualUV=wear.getAttribute('uv');
    const base=wear.userData.referenceWearBasePositions as Float32Array,expand=wear.userData.referenceWearExpandDirections as Float32Array,sourceBase=sourceWear.geometry.userData.basePosArray as Float32Array,sourceExpand=sourceWear.geometry.userData.expandDirArray as Float32Array;
    for(let i=0;i<sourcePosition.count;i++){
      localPoint.fromBufferAttribute(sourcePosition,i).applyMatrix4(torso.matrixWorld).multiplyScalar(HUMAN_REFERENCE_SCALE);
      expect(actualWear.getX(i)).toBe(Math.fround(localPoint.x));expect(actualWear.getY(i)).toBe(Math.fround(localPoint.y));expect(actualWear.getZ(i)).toBe(Math.fround(localPoint.z));
      expect(actualUV.getX(i)).toBe(sourceUV.getX(i));expect(actualUV.getY(i)).toBe(sourceUV.getY(i));
      for(let component=0;component<3;component++){
        expect(base[i*3+component]).toBe(Math.fround((sourceBase[i*3+component]+torso.position.getComponent(component))*HUMAN_REFERENCE_SCALE));
        expect(expand[i*3+component]===Math.fround(sourceExpand[i*3+component]*HUMAN_REFERENCE_SCALE)).toBe(true);
      }
    }
    for(const companion of [lines,wear]){expect(companion.instanceCount).toBe(0);expect(companion.getAttribute('pawnRigTraits').itemSize).toBe(3);expect(companion.getAttribute('bindPivot').count).toBe(companion.getAttribute('position').count);}
    expect(base.length).toBe(actualWear.count*3);expect(expand.length).toBe(base.length);
    sourceLines.dispose();sourceWear.geometry.dispose();disposeOriginal(source);disposeCompiled(compiled);
  });

  it('selects the new human branch only in Origami and preserves default bytes',()=>{
    const context=new GraphicsStyleContext(),plain=pawnGeometry(true,true,true,true),explicit=withGraphicsStyle(context,()=>pawnGeometry(true,true,true,true));
    for(const name of Object.keys(plain.attributes))expect(Array.from(plain.getAttribute(name).array)).toEqual(Array.from(explicit.getAttribute(name).array));
    expect(Array.from(plain.index!.array)).toEqual(Array.from(explicit.index!.array));
    context.preferences.style='origami';const folded=withGraphicsStyle(context,()=>pawnGeometry());
    expect(folded.userData.origamiHumanReference).toBe(true);expect(plain.hasAttribute('origamiMaterialProfile')).toBe(false);
    plain.dispose();explicit.dispose();disposeCompiled(folded);context.dispose();
  });
});
