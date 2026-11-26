import {expect,test} from 'vitest';
import {PlantSpatialRegions256} from '../src/sim/wild-plant-spatial-regions-256.ts';
import {createPlantGenerationRegions256,plantRegionsNear256,touchablePlantRegions256} from '../src/sim/wild-plant-regions-256.ts';

test('chunk-local flora storage preserves full-map components, neighbours, contacts and float sums',()=>{
  for(const [width,height] of [[1,1],[11,13],[12,12],[13,25],[37,29]]){
    const count=width!*height!,types=Uint8Array.from({length:count},(_,c)=>c%31===0?2:c%19===0?3:c%17===0?0:c%23===0?4:1),bases=Float32Array.from({length:count},(_,c)=>(c%11)/7),walk=Uint8Array.from(types,v=>v===1||v===3?1:0);
    const cold=createPlantGenerationRegions256(width!,height!,types,bases),spatial=new PlantSpatialRegions256(width!,height!,c=>types[c]!,c=>bases[c]!);
    // Reverse discovery also covers lazy chunks first reached at their edges.
    for(let c=count-1;c>=0;c--){
      const expected=cold.regions[cold.at[c]!],actual=spatial.regionAt(c);
      expect(actual&&{...actual,id:0,neighbours:[]}).toEqual(expected&&{...expected,id:0,neighbours:[]});
    }
    for(const cell of [0,Math.floor(count/2),count-1])for(const radius of [0,7,12,25.5,40]){
      const expected=plantRegionsNear256(cold,cell,radius),actual=spatial.near(cell,radius);
      expect(actual.map(r=>r.cells[0])).toEqual(expected.map(r=>r.cells[0]));
      for(const region of actual)for(const plant of [cell,Math.max(0,cell-1),Math.min(count-1,cell+width!+1)]){
        const touching=touchablePlantRegions256(cold,plant,walk);
        expect(spatial.touches(plant,region,c=>!!walk[c])).toBe(touching.some(id=>cold.regions[id]!.cells[0]===region.cells[0]));
      }
    }
  }
});

test('flora chunk capture still rejects invalid cells in row order before component discovery',()=>{
  const reads:number[]=[],spatial=new PlantSpatialRegions256(13,13,c=>{reads.push(c);return c===4?5:1;},()=>1);
  expect(()=>spatial.regionAt(0)).toThrow('Invalid spatial plant region cell');
  expect(reads).toEqual([0,1,2,3,4]);
});
