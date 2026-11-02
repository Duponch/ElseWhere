import {describe,it,expect} from 'vitest';
import {referenceCoverageKey} from '../src/render/origami/reference-coverage';
import {BASE_REFERENCE_PAINT_DESCRIPTORS,humanVariantDescriptor} from '../src/render/origami/reference-profiles';
import type {ReferencePaintDescriptor} from '../src/render/origami/reference-paint-library';

describe('paper and face-coverage recipes share across real palette variants',()=>{
 it('keeps all dynamic human RGB palettes within the same bounded source template pool',()=>{
  const initial=new Set(BASE_REFERENCE_PAINT_DESCRIPTORS.map(referenceCoverageKey)),dynamic=new Set(initial);
  for(let color=0;color<512;color++)for(let category=0;category<9;category++)dynamic.add(referenceCoverageKey(humanVariantDescriptor(category,(color*123457)&0xffffff)));
  // The completed bestiary added45 namespaced profiles to the protected43.
  // One RGB-only pair shares a coverage template; human colors add none.
  expect(BASE_REFERENCE_PAINT_DESCRIPTORS).toHaveLength(88);expect(initial.size).toBe(87);
  expect(dynamic).toEqual(initial);expect(dynamic.size).toBeLessThanOrEqual(256);
 });
 it('ignores only RGB values, rather than optional color branches or source RNG boundaries',()=>{
  const descriptor:ReferencePaintDescriptor={key:'authored',seed:5320559487764549,sourceIndex:12,config:{baseColor:'#aa7733',secondaryColor:'#886622',accentColor:'#eeeeee',strokeCount:240,strokeStyle:'wavy',gradientTip:{color:'#dddddd'},flankStripe:{bellyColor:'#ffffff',stripeColor:'#000000'}}};
  const same:ReferencePaintDescriptor={...descriptor,key:'another RGB palette',config:{...descriptor.config,baseColor:'#000000',secondaryColor:'#abcdef',accentColor:'#123456',gradientTip:{color:'#fedcba'},flankStripe:{bellyColor:'#123456',stripeColor:'#abcdef'}}};
  expect(referenceCoverageKey(same)).toBe(referenceCoverageKey(descriptor));
  const changes:ReferencePaintDescriptor[]=[{...descriptor,seed:descriptor.seed+1013},{...descriptor,sourceIndex:13},
   ...[{secondaryColor:null},{accentColor:null},{strokeCount:241},{strokeStyle:'coarse'},{gradientTip:null},{flankStripe:null},{kraftEdgeWear:false}].map(change=>({...descriptor,config:{...descriptor.config,...change}}))];
  for(const changed of changes)expect(referenceCoverageKey(changed)).not.toBe(referenceCoverageKey(descriptor));
 });
 it('normalizes the actual literal defaults and never truncates large painter seeds to32 bits',()=>{
  const original:ReferencePaintDescriptor={key:'one',seed:1337,config:{}},defaults:ReferencePaintDescriptor={...original,config:{strokeStyle:'fur',strokeCount:340,kraftEdgeWear:true,secondaryColor:null,accentColor:null,gradientTip:null,flankStripe:null}};
  expect(referenceCoverageKey(original)).toBe(referenceCoverageKey(defaults));expect(referenceCoverageKey({...original,seed:1337+2**32})).not.toBe(referenceCoverageKey(original));
  expect(()=>referenceCoverageKey({...original,seed:NaN})).toThrow();expect(()=>referenceCoverageKey({...original,config:{strokeCount:Infinity}})).toThrow();
 });
});
