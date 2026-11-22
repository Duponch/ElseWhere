import {describe,expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import {withdrawSowingUnderNewPlants371} from '../src/sim/wild-plant-sow-371';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization';
import {asOldSchema,numberOnlyWorld} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Job,type Pawn,type Resource,type World} from '../src/sim/types';

const sow=(id:number,x:number,z:number,reservedBy:number|null=null):Job=>({id,kind:'sow',x,z,orientation:0,footprint:'standard',growingZoneId:900,status:'pending',reservedBy,progress:0,escrow:{wood:0,food:0}});
const grass=(id:number,x:number,z:number):Resource=>({id,kind:'wild-plant',x,z,amount:1,growth:.15,growthTick:0} as Resource);
function field():{w:World;grower:Pawn;before:number} {
  const w=createWorld(42,16,16);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.structures=[];w.resources=[];w.piles=[];
  w.growingZones=[{id:900,plant:'rice',cells:Array.from({length:256},(_,i)=>i),allowSow:true,allowCut:true}];
  const grower=w.pawns[0]!;
  w.jobs=[sow(901,4,4),sow(902,5,5,grower.id),sow(903,6,6),sow(904,7,7)];grower.jobId=902;
  w.resources=[grass(905,7,7)];w.nextId=906;
  return {w,grower,before:w.nextId};
}

describe('schema 371: a new plant withdraws the sowing pending on its cell',()=>{
  test('the sowing under a new plant is removed and its grower released; other sowing stays',()=>{
    const {w,grower,before}=field();
    w.resources=[...w.resources,grass(w.nextId++,4,4),grass(w.nextId++,5,5)];
    const released:number[]=[];
    withdrawSowingUnderNewPlants371(w,before,pawn=>{released.push(pawn.id);pawn.jobId=null;});
    expect(w.jobs.map(j=>j.id)).toEqual([903,904]);
    expect(released).toEqual([grower.id]);
  });
  test('a plant that stood there before the step is not a new plant; nothing is drawn',()=>{
    const {w,before}=field();const rng=w.rng;
    withdrawSowingUnderNewPlants371(w,before,()=>{throw Error('no release');});
    expect(w.jobs.map(j=>j.id)).toEqual([901,902,903,904]);expect(w.rng).toBe(rng);
  });
  test('below 371 the step changes nothing',()=>{
    const {w,before}=field();w.schemaVersion=370 as World['schemaVersion'];
    w.resources=[...w.resources,grass(w.nextId++,4,4)];
    withdrawSowingUnderNewPlants371(w,before,()=>{throw Error('no release');});
    expect(w.jobs.map(j=>j.id)).toEqual([901,902,903,904]);
  });
  test('a 370 save migrates by its number only',()=>{
    const current=serializeWorld(createWorld(7,16,16));
    const old=JSON.parse(asOldSchema(current,370)) as Record<string,unknown>,migrated=deserializeWorld(JSON.stringify(old));
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(serializeWorld(migrated)).toBe(serializeWorld(numberOnlyWorld(old)));
  });
});
