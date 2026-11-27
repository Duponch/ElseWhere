import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import {itemGeometry} from '../src/render/item-presentation';
import {pileParts} from '../src/render/pile-parts';
import {pileIdentitySurfaces} from '../src/render/pile-surfaces';
import {SHELF_ITEM_SCALE,SHELF_LEVELS,shelfParts} from '../src/render/shelf-presentation';
import {createItemGeometry} from '../src/render/item-geometry';
import type {Structure,MaterialPile} from '../src/sim/types';

test.each([0,1,2,3]as const)('all shelf levels retain ground item dimensions and clear the next board at orientation %i',orientation=>{
  const world=createWorld(428,32),shelf:Structure={id:world.nextId++,kind:'small-shelf',x:12,z:12,orientation,footprint:'standard',material:'wood'};
  world.structures=[shelf];world.piles=[0,1,2].map(():MaterialPile=>({id:world.nextId++,item:'granite-blocks',kind:'blocks',quantity:75,owner:{type:'ground',x:shelf.x,z:shelf.z}}));
  expect(SHELF_ITEM_SCALE).toBe(1);const supports=pileIdentitySurfaces(world),ground=itemGeometry('granite-blocks',75,shelf),model=shelfParts(shelf,0x123456,0x654321);
  expect(model).toHaveLength(8);expect(model.slice(0,3).map(part=>part.y+part.sy!/2)).toEqual(SHELF_LEVELS);
  for(let level=0;level<3;level++){
    const surface=supports.get(world.piles[level]!.id)!,parts=pileParts([{x:shelf.x,z:shelf.z,item:'granite-blocks',kind:'blocks',quantity:75,supplied:false,surface}]);
    expect(parts.map(part=>[part.sx,part.sy,part.sz])).toEqual(ground.map(part=>[part.sx,part.sy,part.sz]));
    const top=Math.max(...parts.map(part=>part.y+part.sy!/2));if(level<2)expect(top+.02).toBeLessThan(SHELF_LEVELS[level+1]!-.07);
  }
});

test('thick short trunk sections retain the existing nine pieces, cylinder topology and personalized bark/end-grain charts',()=>{
  const parts=itemGeometry('wood',75),bodies=parts.filter(part=>part.sx!>.1),ends=parts.filter(part=>part.sx!<.025);
  expect(parts).toHaveLength(9);expect(bodies).toHaveLength(3);expect(ends).toHaveLength(6);
  for(const part of bodies){expect([part.sx,part.sy,part.sz]).toEqual([.72,.22,.22]);expect(part.surfaceDesign).toBe(43);expect(part.shape).toBe('item-log');}
  for(const part of ends)expect(part.surfaceDesign).toBe(53);
  const shape=createItemGeometry('item-log');try{expect(shape.index!.count).toBe(96);const top=Math.max(...parts.map(part=>part.y+shape.boundingBox!.max.y*part.sy!));expect(top).toBeLessThan(SHELF_LEVELS[1]!-SHELF_LEVELS[0]!-.07);}finally{shape.dispose();}
});
