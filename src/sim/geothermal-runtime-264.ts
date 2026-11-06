/** Original deterministic geothermal sprayer; no dependence on electrical
 * output, breakdown, EMP, weather or camera, and no natural snow callback. */
import {healthRandom} from './health.ts';
import {combineWorldSeed} from './world-generation-random.ts';
import {geyserFullCells256,geyserHasRoom256} from './local-geyser-runtime-256.ts';
import {validGeothermalState264,harvestedGeothermalGeyserIds264} from './geothermal-state-264.ts';
import type {ThermalLayout} from './thermal-topology.ts';
import type {Structure,World} from './types.ts';
import { structuresOfKind } from './structure-navigation.ts';
const f=Math.fround;

/** The full 6x6 volume has 28 distinct surrounding air cells. */
export function geothermalAdjacentCells264(width:number,height:number,s:Pick<Structure,'x'|'z'>):number[] {
 const cells:number[]=[],add=(x:number,z:number)=>{if(x>=0&&z>=0&&x<width&&z<height)cells.push(z*width+x);};
 for(let x=s.x-1;x<=s.x+6;x++)add(x,s.z-1);
 for(let z=s.z;z<=s.z+6;z++)add(s.x+6,z);
 for(let x=s.x+5;x>=s.x-1;x--)add(x,s.z+6);
 for(let z=s.z+5;z>=s.z;z--)add(s.x-1,z);
 return cells;
}

/** Root invokes this once after the true local thermal reconciliation. Every
 * admission precedes mutation; jumps never replay unknown historical heat. */
export function advanceGeothermalGenerators264(world:World,layout:ThermalLayout):void {
 const sources=[...structuresOfKind(world,'geothermal-generator')];if(!sources.length)return;
 harvestedGeothermalGeyserIds264(world);
 for(const s of sources){const phase=s.geothermal!;if(!validGeothermalState264(phase,phase.atTick,world.nextId)||phase.atTick!==world.tick&&phase.atTick!==world.tick-1)throw Error('Geothermal phase requires one real local step, never catch-up');}
 if(layout.indices.length!==world.tiles.length||layout.rooms.length!==(world.thermal?.regions.length??0)||layout.rooms.some((r,i)=>r.cells.length!==world.thermal!.regions[i]!.cells.length))throw Error('Geothermal heat requires actual reconciled thermal regions');
 const advancing=sources.filter(s=>s.geothermal!.atTick!==world.tick);if(!advancing.length)return;
 const states=advancing.map(s=>({...s.geothermal!})),temperatures=new Map<number,number>(),rng={rng:world.rng};
 let full:ReadonlySet<number>|undefined;
 const integer=(lo:number,hi:number)=>lo+Math.floor(healthRandom(rng)*(hi-lo+1));
 const pushHeat=(s:Structure)=>{
  const fullCells=full??=geyserFullCells256(world);let cell=s.z*world.width+s.x;
  if(!geyserHasRoom256(world,cell,fullCells)){
   const candidates=geothermalAdjacentCells264(world.width,world.height,s).filter(c=>geyserHasRoom256(world,c,fullCells));
   if(!candidates.length)return;cell=candidates[integer(0,candidates.length-1)]!;
  }
  const room=layout.indices[cell]!;if(room<0)return;
  const region=world.thermal!.regions[room]!,count=region.cells.length;if(!count)throw Error('Empty actual geothermal room');
  temperatures.set(room,Math.min(1000,f((temperatures.get(room)??region.temperature)+f(40/count))));
 };
 for(let core=(world.tick-1)*10+1;core<=world.tick*10;core++)for(let i=0;i<advancing.length;i++){
  const s=advancing[i]!,phase=states[i]!;
  if(phase.sprayTicksLeft>0){
   phase.sprayTicksLeft--;if((core+combineWorldSeed(s.id,169495093))%20===0)pushHeat(s);
   if(phase.sprayTicksLeft===0)phase.ticksUntilSpray=integer(500,2000);
  }else if(--phase.ticksUntilSpray===0)phase.sprayTicksLeft=integer(200,500);
 }
 for(const [room,temperature] of temperatures)world.thermal!.regions[room]!.temperature=temperature;
 for(let i=0;i<advancing.length;i++)Object.assign(advancing[i]!.geothermal!,states[i],{atTick:world.tick});
 world.rng=rng.rng;
}
