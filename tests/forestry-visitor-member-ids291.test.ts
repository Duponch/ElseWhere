import {expect,test,vi} from 'vitest';
import {validForestryHistoricalTransport291} from '../src/sim/forestry-save-291';
import type {VisitorGroup} from '../src/sim/visitor-state';

// Declared transport projections only; never a complete World/save/played colony.
const group=():VisitorGroup=>({id:1,kind:'traveler',members:[11,12],entry:{x:0,z:0},spot:{x:4,z:4},phase:'arriving',startedAt:15000,arrivedAt:null,durationCore:1000,hostile:false});
const projection=(members:unknown=group().members)=>({world:{visitors:{groups:[{...group(),members}],departed:[]}}});

test.each([291,292,296,297,298])('Forestry%d accepts the genuine VisitorGroup numeric-ID shape without mistaking it for actors',version=>{
 expect(validForestryHistoricalTransport291(projection(),version)).toBe(true);
 expect(validForestryHistoricalTransport291({dynamic:{visitors:{groups:[group()],departed:[]}}},version)).toBe(true);
});

test('VisitorGroup IDs stay positive integers/dense own data, with no actor or sparse-table substitute',()=>{
 for(const members of [[0],[-1],[1.5],[NaN],['11'],[null],[{id:11}],{upserted:[11]}])expect(validForestryHistoricalTransport291(projection(members),298)).toBe(false);
 const hole=new Array(1);expect(validForestryHistoricalTransport291(projection(hole),298)).toBe(false);
 const get=vi.fn(()=>11),accessor:number[]=[];Object.defineProperty(accessor,'0',{enumerable:true,get});
 expect(validForestryHistoricalTransport291(projection(accessor),298)).toBe(false);expect(get).not.toHaveBeenCalled();
 const hidden:number[]=[];Object.defineProperty(hidden,'0',{enumerable:false,value:11});
 expect(validForestryHistoricalTransport291(projection(hidden),298)).toBe(false);
});

test('caravan/custody members remain objects and future Forestry fields retain their old context refusals',()=>{
 const custody=(members:unknown)=>({world:{worldGroups:{groups:[{state:{members}}]}}});
 expect(validForestryHistoricalTransport291(custody([{id:11}]),298)).toBe(true);
 expect(validForestryHistoricalTransport291(custody([11]),298)).toBe(false);
 expect(validForestryHistoricalTransport291({world:{members:[11]}},298)).toBe(false);
 for(const future of [{treeSowing291:{}},{sown291:{}}])for(const version of [290,291,298]){
  const record={...group(),...future};expect(validForestryHistoricalTransport291({world:{visitors:{groups:[record],departed:[]}}},version)).toBe(false);
 }
});
