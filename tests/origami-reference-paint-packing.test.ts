import {describe,expect,it} from 'vitest';
import {packReferencePaintPixels} from '../src/render/origami/reference-paint-library';
import {BASE_REFERENCE_PAINT_DESCRIPTORS,humanVariantDescriptor,humanVariantProfile,referenceProfileCount} from '../src/render/origami/reference-profiles';
import {REFERENCE_FINAL_PAINT_SEED,REFERENCE_HUMAN_DESCRIPTORS,REFERENCE_PAINT_DESCRIPTORS} from '../src/render/origami/reference-paint-seeds';

describe('lossless reference paint texture packing',()=>{
  it('packs exact RGB/height and flips rows separately inside each 2x2 array layer',()=>{
    const color=new Uint8Array([
      11,12,13,255,21,22,23,255,31,32,33,255,41,42,43,255,
      51,52,53,255,61,62,63,255,71,72,73,255,81,82,83,255,
    ]);
    const bump=new Uint8Array([1,2,3,4,5,6,7,8].flatMap(height=>[height,height,height,255]));
    const originalColor=color.slice(),originalBump=bump.slice();
    expect(Array.from(packReferencePaintPixels(color,bump,2,2,2))).toEqual([
      31,32,33,3,41,42,43,4,11,12,13,1,21,22,23,2,
      71,72,73,7,81,82,83,8,51,52,53,5,61,62,63,6,
    ]);
    expect(color).toEqual(originalColor);expect(bump).toEqual(originalBump);
  });

  it('rejects nonopaque source color or bump instead of silently discarding source alpha',()=>{
    const opaque=new Uint8Array([11,12,13,255]);
    expect(()=>packReferencePaintPixels(new Uint8Array([11,12,13,254]),opaque,1,1,1)).toThrow(/opaque/);
    expect(()=>packReferencePaintPixels(opaque,new Uint8Array([11,12,13,0]),1,1,1)).toThrow(/opaque/);
  });

  it('reuses one caller-owned scratch buffer without allocating another packed layer',()=>{
    const color=new Uint8Array([11,12,13,255,21,22,23,255,31,32,33,255,41,42,43,255]);
    const bump=new Uint8Array([1,2,3,4].flatMap(height=>[height,height,height,255]));
    const scratch=new Uint8Array(16);
    expect(packReferencePaintPixels(color,bump,2,2,1,scratch)).toBe(scratch);
    expect(Array.from(scratch)).toEqual([31,32,33,3,41,42,43,4,11,12,13,1,21,22,23,2]);
    const replacement=new Uint8Array([9,10,11,12].flatMap(height=>[height,height,height,255]));
    expect(packReferencePaintPixels(color,replacement,2,2,1,scratch)).toBe(scratch);
    expect(Array.from(scratch)).toEqual([31,32,33,11,41,42,43,12,11,12,13,9,21,22,23,10]);
    expect(()=>packReferencePaintPixels(color,bump,2,2,1,new Uint8Array(4))).toThrow(/target/);
    expect(()=>packReferencePaintPixels(color,bump,2,2,1,color)).toThrow(/overlap/);
  });

  it('rejects incomplete layers and invalid dimensions while accepting an empty layer pool',()=>{
    expect(()=>packReferencePaintPixels(new Uint8Array(4),new Uint8Array(4),2,2,1)).toThrow(/complete matching/);
    expect(()=>packReferencePaintPixels(new Uint8Array(),new Uint8Array(),0,2,0)).toThrow(/dimensions/);
    expect(()=>packReferencePaintPixels(new Uint8Array(),new Uint8Array(),2,2,-1)).toThrow(/dimensions/);
    expect(packReferencePaintPixels(new Uint8Array(),new Uint8Array(),2,2,0)).toEqual(new Uint8Array());
  });
});

describe('source paint registrations and local human templates',()=>{
  it('fixes the immutable 43-profile baseline before any appearance variants',()=>{
    expect(BASE_REFERENCE_PAINT_DESCRIPTORS).toHaveLength(43);
    expect(BASE_REFERENCE_PAINT_DESCRIPTORS[0].key).toBe('generic-gouache');
    expect(Object.isFrozen(BASE_REFERENCE_PAINT_DESCRIPTORS)).toBe(true);
    expect(BASE_REFERENCE_PAINT_DESCRIPTORS.every(descriptor=>Object.isFrozen(descriptor)&&Object.isFrozen(descriptor.config))).toBe(true);
  });

  it('preserves the complete original index and source refresh seed, including human registrations',()=>{
    for(const descriptor of [...REFERENCE_PAINT_DESCRIPTORS,...REFERENCE_HUMAN_DESCRIPTORS]){
      expect(Number.isInteger(descriptor.sourceIndex)).toBe(true);
      expect(descriptor.refreshSeed).toBe(REFERENCE_FINAL_PAINT_SEED+descriptor.sourceIndex!*1013);
    }
    // The first human preset is registered between the hare and the dog;
    // deduplicating the retained material pool must not renumber this stream.
    const skin=REFERENCE_HUMAN_DESCRIPTORS.find(p=>p.key==='matSkin')!;
    const hare=REFERENCE_PAINT_DESCRIPTORS.find(p=>p.key==='matHareSand')!;
    const dog=REFERENCE_PAINT_DESCRIPTORS.find(p=>p.key==='matDogOchre')!;
    expect(skin.sourceIndex).toBeGreaterThan(hare.sourceIndex!);
    expect(skin.sourceIndex).toBeLessThan(dog.sourceIndex!);
  });

  it('creates a context-local variant descriptor without extending global metadata',()=>{
    const before=referenceProfileCount(),descriptor=humanVariantDescriptor(0,0x123456);
    const source=REFERENCE_HUMAN_DESCRIPTORS.find(p=>p.key==='matSkin')!;
    expect(referenceProfileCount()).toBe(before);
    expect(descriptor.config.baseColor).toBe('#123456');
    expect(descriptor.seed).toBe(source.seed);expect(descriptor.refreshSeed).toBe(source.refreshSeed);expect(descriptor.sourceIndex).toBe(source.sourceIndex);
    const id=humanVariantProfile(0,0x123456),count=referenceProfileCount();
    expect(humanVariantProfile(0,0x123456)).toBe(id);expect(referenceProfileCount()).toBe(count);
    expect(BASE_REFERENCE_PAINT_DESCRIPTORS).toHaveLength(43);
  });
});
