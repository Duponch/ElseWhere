import {describe,it,expect} from 'vitest';
import {BESTIARY_PAINT_DESCRIPTORS} from '../src/render/origami/bestiary-paint-descriptors';
import {BASE_REFERENCE_PAINT_DESCRIPTORS,PROTECTED_REFERENCE_PAINT_DESCRIPTORS,bestiaryPaintProfile,humanBaseProfileIds,registerReferencePaintProfile} from '../src/render/origami/reference-profiles';
import {REFERENCE_PAINT_DESCRIPTORS} from '../src/render/origami/reference-paint-seeds';
import {HUMAN_REFERENCE_PIGMENTS} from '../src/render/origami/human-reference';

describe('static bestiary paint metadata, no Canvas or renderer',()=>{
 it('retains the protected43 virtual IDs/configs/seeds before new declarations',()=>{
  expect(PROTECTED_REFERENCE_PAINT_DESCRIPTORS).toHaveLength(43);
  expect(PROTECTED_REFERENCE_PAINT_DESCRIPTORS[0]?.key).toBe('generic-gouache');
  REFERENCE_PAINT_DESCRIPTORS.forEach((descriptor,index)=>expect(PROTECTED_REFERENCE_PAINT_DESCRIPTORS[index+1]).toEqual(descriptor));
  expect(humanBaseProfileIds()).toEqual([34,35,36,37,38,39,40,41,42]);
  HUMAN_REFERENCE_PIGMENTS.forEach((config,index)=>expect(PROTECTED_REFERENCE_PAINT_DESCRIPTORS[index+34]?.config).toEqual(config));
  PROTECTED_REFERENCE_PAINT_DESCRIPTORS.forEach((descriptor,index)=>{
   expect(BASE_REFERENCE_PAINT_DESCRIPTORS[index]).toEqual(descriptor);
   expect(registerReferencePaintProfile(descriptor.key,descriptor.config)).toBe(index);
  });
 });
 it('registers all45 distinct source identities before a context snapshot',()=>{
  expect(BESTIARY_PAINT_DESCRIPTORS).toHaveLength(45);expect(BASE_REFERENCE_PAINT_DESCRIPTORS).toHaveLength(88);
  BESTIARY_PAINT_DESCRIPTORS.forEach((descriptor,index)=>{
   const id=43+index;expect(bestiaryPaintProfile(descriptor.sourceKey)).toBe(id);expect(bestiaryPaintProfile(descriptor.key)).toBe(id);
   expect(BASE_REFERENCE_PAINT_DESCRIPTORS[id]).toEqual(descriptor);
   expect(descriptor.config.strokeCount).toBe(340);expect(Number.isSafeInteger(descriptor.seed)).toBe(true);expect(descriptor.refreshSeed).toBeUndefined();
  });
 });
 it('keeps shared old names separate when their source RNG/configuration differs',()=>{
  const old=PROTECTED_REFERENCE_PAINT_DESCRIPTORS.find(descriptor=>descriptor.key==='matCharcoalGouache')!,newId=bestiaryPaintProfile('matCharcoalGouache');
  expect(newId).toBe(43);expect(BASE_REFERENCE_PAINT_DESCRIPTORS[newId]?.seed).toBe(2014722395637);
  expect(BASE_REFERENCE_PAINT_DESCRIPTORS[newId]?.seed).not.toBe(old.seed);
  expect(BASE_REFERENCE_PAINT_DESCRIPTORS[newId]?.config).not.toEqual(old.config);
 });
 it('rejects unknown bestiary keys instead of silently sampling generic0',()=>{
  expect(()=>bestiaryPaintProfile('not-a-source-material')).toThrow('Unknown bestiary');
 });
});
