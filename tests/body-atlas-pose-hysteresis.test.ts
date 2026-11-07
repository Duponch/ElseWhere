/** Actual PawnLayer pose aggregate rule for the colonists' body atlas. The
 * atlas owner is a TEST double (status/readiness only): no GPU, no bake. */
import {expect,test} from 'vitest';
import {PawnLayer} from '../src/render/PawnLayer';

function layer(origami:boolean){
  const atlas={ready:false,status(){return {ready:this.ready};}};
  const owner:object=Object.assign(Object.create(PawnLayer.prototype),{bodyAtlas:atlas,graphics:{origami},bodyAtlasAllRigid:undefined,bodyAtlasReadmitAt:undefined});
  const observe=(allRigid:boolean,now:number)=>Reflect.apply(Reflect.get(owner,'observeBodyAtlasPoseAggregate') as (rigid:boolean,now:number)=>boolean,owner,[allRigid,now]);
  return {atlas,observe};
}

test('a pose leaving the rigid class falls back at once while the atlas is drawn, and only once',()=>{
  const {atlas,observe}=layer(true);
  expect(observe(true,0)).toBe(false);atlas.ready=true;
  expect(observe(false,10)).toBe(true);
  atlas.ready=false;
  expect(observe(false,20)).toBe(false);expect(observe(false,30)).toBe(false);
});

test('the atlas returns only after six seconds of stable rigid poses; a new kneel cancels the wait without preparing',()=>{
  const {observe}=layer(true);
  expect(observe(false,0)).toBe(false);
  expect(observe(true,1000)).toBe(false);expect(observe(true,6999)).toBe(false);
  // A colonist kneels again: the atlas is not drawn, nothing to prepare.
  expect(observe(false,7000)).toBe(false);
  expect(observe(true,8000)).toBe(false);expect(observe(true,13999)).toBe(false);
  expect(observe(true,14000)).toBe(true);
  expect(observe(true,20000)).toBe(false);
});

test('an atlas already in service is not prepared again, and the default style never prepares on poses',()=>{
  const gouache=layer(true);gouache.atlas.ready=true;
  expect(gouache.observe(true,0)).toBe(false);expect(gouache.observe(true,6000)).toBe(false);
  const plain=layer(false);
  expect(plain.observe(false,0)).toBe(false);expect(plain.observe(true,10)).toBe(false);expect(plain.observe(true,60000)).toBe(false);expect(plain.observe(false,60010)).toBe(false);
});
