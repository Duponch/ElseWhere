import {expect,test} from 'vitest';
import {generateWorld} from '../src/sim/generation';
import {adoptSiteClimate} from '../src/sim/site-climate';
import {advancePlantLife,createPlantLife} from '../src/sim/plant-life';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {setTerrainWriteCacheVerification,verifyTerrainWriteCaches} from '../src/sim/terrain-mutation-journal';
import type {Resource,World} from '../src/sim/types';
import {markResourceArrayChanged} from '../src/sim/resource-mutation-journal';

function fixture(){
  const w=generateWorld(42,16,16);w.resources=[];w.structures=[];w.jobs=[];w.piles=[];w.packed=[];
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));delete w.roofing;delete w.thermal;adoptSiteClimate(w);
  for(let i=0;i<24;i++)w.resources.push(plant(w,400+i*19));
  w.resources.push({id:2001,kind:'rock',x:1,z:1,amount:1});
  return w;
}
function plant(w:World,id:number):Resource {
  const p:Resource={id,kind:'rice',x:2+id%10,z:3,amount:6,growth:.5,growthTick:0};
  p.plantLife=createPlantLife(w,p,true);return p;
}
const layout={rooms:[],doors:[],indices:new Int32Array(256).fill(-1)};

test('closed plant-life buckets equal a fresh capture through removal, append, reorder, replacement and edited old arrays',()=>{
  const w=fixture(),owner={},before=verifyTerrainWriteCaches;setTerrainWriteCacheVerification(true);
  try{
    for(let tick=1;tick<=450;tick++){
      w.tick=tick;
      if(tick%29===0)w.resources=w.resources.filter((_,i)=>i!==2);
      else if(tick%31===0)w.resources=[...w.resources,plant(w,3000+tick)];
      else if(tick===73)w.resources=[...w.resources].reverse();
      else if(tick===101)w.resources=w.resources.map((p,i)=>i===1?structuredClone(p):p);
      else if(tick===125){w.resources.splice(2,1);w.resources=[...w.resources];}
      else if(tick===151)w.resources=[...w.resources,w.resources[1]!];
      else if(tick===153)w.resources=w.resources.filter((_,i)=>i!==w.resources.length-1);
      else w.resources=[...w.resources];
      // Each clone has no derived index, so its real advance builds every
      // bucket from scratch. Same due order, fields, resources and RNG.
      const cold=structuredClone(w);advancePlantLife(cold,layout);
      withJournalTerrainReadScope(owner,()=>advancePlantLife(w,layout));
      expect(w,`tick ${tick}`).toStrictEqual(cold);expect(w.rng).toBe(cold.rng);
    }
  }finally{setTerrainWriteCacheVerification(before);}
});

test('public replacement observes changed phases and newly eligible plants; ownership transitions rebuild',()=>{
  const w=fixture(),owner={};
  advancePlantLife(w,layout);
  w.tick=1;w.resources[0]!.plantLife!.nextCheck=1;
  const rock=w.resources.at(-1)!;rock.kind='rice';rock.plantLife=createPlantLife(w,rock);rock.plantLife.nextCheck=1;
  w.resources=[...w.resources];
  const cold=structuredClone(w);advancePlantLife(cold,layout);advancePlantLife(w,layout);
  expect(w).toStrictEqual(cold);expect(rock.plantLife.nextCheck).toBe(201);
  w.tick=2;w.resources[0]!.plantLife!.nextCheck=2;
  const next=structuredClone(w);advancePlantLife(next,layout);
  withJournalTerrainReadScope(owner,()=>advancePlantLife(w,layout));expect(w).toStrictEqual(next);
});

test('unknown array replacement rebuilds an edited phase against the complete schedule',()=>{
  const w=fixture(),owner={},before=verifyTerrainWriteCaches;
  withJournalTerrainReadScope(owner,()=>advancePlantLife(w,layout));
  w.resources[0]!.plantLife!.nextCheck+=1;w.resources=[...w.resources];
  setTerrainWriteCacheVerification(true);
  try{const cold=structuredClone(w);advancePlantLife(cold,layout);withJournalTerrainReadScope(owner,()=>advancePlantLife(w,layout));expect(w).toStrictEqual(cold);}
  finally{setTerrainWriteCacheVerification(before);}
});

test('certified removal and append reuse phase membership without iterating the complete source',()=>{
  const w=fixture(),owner={};withJournalTerrainReadScope(owner,()=>advancePlantLife(w,layout));
  const before=w.resources,removed=before[2]!,appended=plant(w,5000);let iterations=0;
  const next=before.filter(p=>p!==removed).concat(appended);
  w.resources=new Proxy(next,{get(target,key,receiver){if(key===Symbol.iterator)iterations++;return Reflect.get(target,key,receiver);}});
  markResourceArrayChanged(w,before,[appended],[removed]);
  withJournalTerrainReadScope(owner,()=>advancePlantLife(w,layout));expect(iterations).toBe(0);
  const cold=structuredClone({...w,resources:next});w.tick=1;cold.tick=1;
  advancePlantLife(cold,layout);withJournalTerrainReadScope(owner,()=>advancePlantLife(w,layout));
  expect({...w,resources:next}).toStrictEqual(cold);
});
