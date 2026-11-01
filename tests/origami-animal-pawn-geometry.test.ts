import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {origamiAnimalGeometry,ORIGAMI_ANIMAL_SPECIES} from '../src/render/origami/animal-geometry';
import {animalVisualParts256} from '../src/render/animal-visual-parts-v256';
import {corpseVisualPartBit} from '../src/render/corpse-presentation';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {pawnGeometry,WORK_AXE_DYE,WORK_PICKAXE_DYE,WORK_SICKLE_DYE} from '../src/render/pawn-geometry';

function origamiPawn():THREE.InstancedBufferGeometry {
  const context=new GraphicsStyleContext();context.preferences.style='origami';
  return withGraphicsStyle(context,()=>pawnGeometry(true,true,true,true));
}

describe('Origami animals retain the resident simulation-facing rig',()=>{
  it('compiles all reference mappings into bounded batches and finite face-local UVs',()=>{
    expect(ORIGAMI_ANIMAL_SPECIES).toEqual(expect.arrayContaining(['red-fox','dromedary','hare','snow-hare','gazelle','deer','muffalo','elephant','labrador-retriever','husky','yorkshire-terrier']));
    expect(origamiAnimalGeometry(16,'not-a-species')).toBeUndefined();
    for(const species of ORIGAMI_ANIMAL_SPECIES){
      const g=origamiAnimalGeometry(16,species)!,position=g.getAttribute('position'),part=g.getAttribute('animalPart'),uv=g.getAttribute('animalPaintUv');
      expect(g.index).toBeNull();expect(position.count%3).toBe(0);expect(position.count).toBeLessThan(12000);
      expect(uv.count).toBe(position.count);expect(g.getAttribute('bindPivot').count).toBe(position.count);
      expect(g.getAttribute('aFrom').count).toBe(16);expect(g.getAttribute('aBiology').count).toBe(16);expect(g.instanceCount).toBe(0);
      const bones=new Set<number>();
      for(let i=0;i<position.count;i++){
        expect(Number.isFinite(position.getX(i)+position.getY(i)+position.getZ(i))).toBe(true);
        expect(Number.isFinite(uv.getX(i)+uv.getY(i))).toBe(true);
        expect(uv.getX(i)).toBeGreaterThanOrEqual(-.00001);expect(uv.getX(i)).toBeLessThanOrEqual(1.00001);
        expect(uv.getY(i)).toBeGreaterThanOrEqual(-.00001);expect(uv.getY(i)).toBeLessThanOrEqual(1.00001);
        bones.add(part.getX(i));
      }
      expect([...bones].sort()).toEqual([0,1,2,3]);
      g.computeBoundingBox();expect(g.boundingBox!.min.y).toBeCloseTo(0,5);expect(g.userData.origamiBodyCenter).toBeGreaterThan(0);
      g.dispose();
    }
  });

  it('keeps native anatomical bits, live/dead eyes and distinct dog phenotypes',()=>{
    const dogs=['labrador-retriever','husky','yorkshire-terrier'].map(species=>origamiAnimalGeometry(1,species)!);
    const signatures=dogs.map(g=>{g.computeBoundingBox();return [g.getAttribute('position').count,g.boundingBox!.max.x,g.boundingBox!.max.y,g.boundingBox!.max.z,g.getAttribute('color').getX(0)].join(',');});
    expect(new Set(signatures).size).toBe(3);
    for(const species of ['elephant','labrador-retriever','husky','yorkshire-terrier']){
      const g=origamiAnimalGeometry(1,species)!,parts=animalVisualParts256(species)!,part=g.getAttribute('animalPart');
      const allowed=new Set(parts.map((_,index)=>2**index));let live=0,dead=0;
      for(let i=0;i<part.count;i++){expect(allowed.has(part.getY(i)),`${species} vertex ${i}: native anatomical bit ${part.getY(i)}`).toBe(true);if(part.getW(i)===0)live++;if(part.getW(i)===1)dead++;}
      expect(live).toBeGreaterThan(0);expect(dead).toBeGreaterThan(0);g.dispose();
    }
    dogs.forEach(g=>g.dispose());
    const hare=origamiAnimalGeometry(1,'hare')!,bits=new Set(Array.from({length:hare.getAttribute('animalPart').count},(_,i)=>hare.getAttribute('animalPart').getY(i)));
    for(const side of ['left','right'] as const){expect(bits.has(corpseVisualPartBit(`${side}-front-paw`,'hare'))).toBe(true);expect(bits.has(corpseVisualPartBit(`${side}-rear-paw`,'hare'))).toBe(true);}
    hare.dispose();
    // Elephant has no native clinical Tail record. The farthest rearward
    // reference tail fold must inherit the actual torso's absence owner.
    const elephant=origamiAnimalGeometry(1,'elephant')!,points=elephant.getAttribute('position'),owners=elephant.getAttribute('animalPart');
    let tail=0;for(let i=1;i<points.count;i++)if(points.getZ(i)<points.getZ(tail))tail=i;
    expect(owners.getY(tail)).toBe(corpseVisualPartBit('torso','elephant'));elephant.dispose();
  });
});

describe('Origami pawn geometry preserves appearance and tool attachment',()=>{
  it('leaves default geometry byte-exact across an explicit default context',()=>{
    const plain=pawnGeometry(true,true,true,true),context=new GraphicsStyleContext(),explicit=withGraphicsStyle(context,()=>pawnGeometry(true,true,true,true));
    for(const name of Object.keys(plain.attributes))expect(Array.from(explicit.getAttribute(name).array)).toEqual(Array.from(plain.getAttribute(name).array));
    expect(Array.from(explicit.index!.array)).toEqual(Array.from(plain.index!.array));expect(plain.hasAttribute('origamiPaintUv')).toBe(false);
    plain.dispose();explicit.dispose();context.dispose();
  });

  it('retains each original dye/bone/pivot identity and packs paper UV in the same buffer',()=>{
    const plain=pawnGeometry(true,true,true,true),folded=origamiPawn();
    const identities=(g:THREE.BufferGeometry)=>{const dye=g.getAttribute('dye'),bone=g.getAttribute('boneId'),pivot=g.getAttribute('bindPivot');return new Set(Array.from({length:dye.count},(_,i)=>[dye.getX(i),bone.getX(i),pivot.getX(i),pivot.getY(i),pivot.getZ(i)].join(',')));};
    const old=identities(plain),next=identities(folded);for(const identity of old)expect(next.has(identity)).toBe(true);
    const vertices=folded.getAttribute('position') as THREE.InterleavedBufferAttribute,uv=folded.getAttribute('origamiPaintUv') as THREE.InterleavedBufferAttribute;
    expect(uv.data).toBe(vertices.data);expect(uv.count).toBe(vertices.count);expect(vertices.count).toBeLessThan(14000);
    expect(folded.getAttribute('uv')).toBe(uv);
    const traits=folded.getAttribute('pawnRigTraits') as THREE.InterleavedBufferAttribute;
    expect(traits.data).toBe(vertices.data);expect(traits.itemSize).toBe(2);
    const dye=folded.getAttribute('dye'),bone=folded.getAttribute('boneId'),pivot=folded.getAttribute('bindPivot');
    for(let i=0;i<vertices.count;i++){expect(traits.getX(i)).toBe(bone.getX(i));expect(traits.getY(i)).toBe(dye.getX(i));}
    for(const tag of [WORK_AXE_DYE,WORK_PICKAXE_DYE,WORK_SICKLE_DYE]){
      let count=0;for(let i=0;i<dye.count;i++)if(dye.getX(i)===tag){count++;expect(bone.getX(i)).toBe(3);expect(pivot.getX(i)).toBeCloseTo(.23);expect(pivot.getY(i)).toBeCloseTo(1.01);}
      expect(count).toBeGreaterThan(0);
    }
    plain.dispose();folded.dispose();
  });
});
