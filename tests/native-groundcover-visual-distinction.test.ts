import {describe,expect,it} from 'vitest';
import {appendFlora,type FloraParts} from '../src/render/flora-presentation';
import type {Resource,World} from '../src/sim/types';

// Narrow pure placement fixture, not an admitted World or played colony.
// Explicit size avoids growth/clock work; no Engine or source mutation.
const world={structures:[]} as unknown as World;
const covers=['brambles','chokevine','astragalus','dandelion','low-shrub'] as const;
function resource(species:NonNullable<Resource['species']>):Resource{return{id:71,x:5,z:8,kind:'wild-plant',species,amount:0,growth:1,growthTick:0};}
function parts(r:Resource,size=1):FloraParts{const out:FloraParts={trunks:[],crowns:[],cones:[],bushes:[],blades:[],cacti:[],fruit:[]};appendFlora(out,world,r,.7,size);return out;}

describe('nonselectable ground cover has a distinct low silhouette',()=>{
  it('retains the same real anchor, footprint and owner key while sitting below half the selectable Bush crown',()=>{
    const bush=parts(resource('bush')).bushes[0]!,bushTop=bush.y+(bush.sy??1);
    for(const species of covers){
      const r=resource(species),out=parts(r),body=out.bushes[0]!;
      expect(Object.values(out).flat()).toHaveLength(1);
      expect(body.x).toBe(r.x);expect(body.z).toBe(r.z);expect(body.key).toBe(-r.id*2);
      expect(body.sx).toBe(bush.sx);expect(body.sz).toBe(bush.sz);expect(body.ry).toBe(bush.ry);
      expect(body.y-(body.sy??1)).toBeGreaterThanOrEqual(0);
      expect(body.y+(body.sy??1)).toBeLessThan(bushTop/2);
    }
  });
  it('scales the low silhouette from the same immutable original placement and never rewrites a Resource',()=>{
    for(const species of covers){
      const r=resource(species),before=JSON.stringify(r),full=parts(r).bushes[0]!,small=parts(r,.5).bushes[0]!;
      expect(JSON.stringify(r)).toBe(before);expect(small.key).toBe(full.key);expect(small.x).toBe(full.x);expect(small.z).toBe(full.z);expect(small.color).toBe(full.color);
      expect(small.y).toBe(full.y*.5);expect(small.sx).toBe(full.sx!*.5);expect(small.sy).toBe(full.sy!*.5);expect(small.sz).toBe(full.sz!*.5);
    }
  });
});
