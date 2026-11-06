import {isSchema256Or257} from './schema-compatibility-257.ts';
/** Original deterministic local sprayer. Ten Core substeps per real local tick.
 * Persistent phase is an explicit continuation adaptation: Core respawn resets
 * its unsaved sprayer. Camera-dependent fleck draws are presentation only here. */
import {healthRandom} from './health.ts';
import {combineWorldSeed} from './world-generation-random.ts';
import {caveRadialPattern256} from './local-cave-radial-256.ts';
import {footprintCells} from './definitions.ts';
import {START_STRUCTURE_PHYSICS_256} from './player-start-physics-256.ts';
import {setSnowDepth,snowDepthAt} from './snow-surface.ts';
import {validLocalGeyserState256} from './local-geyser-save-256.ts';
import {harvestedGeothermalGeyserIds264} from './geothermal-state-264.ts';
import type {ThermalLayout} from './thermal-topology.ts';
import type {GeyserWorld256,NaturalGeyser256} from './local-geyser-state-256.ts';
import {structureMembershipToken} from './structure-navigation.ts';
const f=Math.fround;
/** Air can exist outdoors and on water. Full buildings/natural solids alone
 * have no Room; pathfinding/standability are deliberately not room predicates. */
/* Full-fill cells depend only on structure kinds and footprints (immutable),
 * so the set is cached per shared structure membership token. */
const geyserFullCellsByToken256=new WeakMap<object,ReadonlySet<number>>();
export function geyserFullCells256(world:GeyserWorld256):ReadonlySet<number> {
 const token=structureMembershipToken(world);let cached=geyserFullCellsByToken256.get(token);
 if(!cached){cached=computeGeyserFullCells256(world);geyserFullCellsByToken256.set(token,cached);}
 return cached;
}
function computeGeyserFullCells256(world:GeyserWorld256):ReadonlySet<number> {
 const cells=new Set<number>();
 for(const s of world.structures){const facts=START_STRUCTURE_PHYSICS_256[s.kind];if(!facts)throw Error('Unknown actual geyser thermal building');if(facts.fullFill&&!facts.door)for(const c of footprintCells(s))cells.add(c.z*world.width+c.x);}
 return cells;
}
export function geyserHasRoom256(world:GeyserWorld256,cell:number,full:ReadonlySet<number>):boolean {
 const tile=world.tiles[cell];return !!tile&&tile.terrain!=='rock'&&!tile.collapsedRock&&!full.has(cell);
}
/** Core CellsAdjacent8Way order around the actual North2x2 rectangle. */
export function geyserAdjacentCells256(width:number,height:number,g:Pick<NaturalGeyser256,'x'|'z'>):number[] {
 const cells:number[]=[],add=(x:number,z:number)=>{if(x>=0&&z>=0&&x<width&&z<height)cells.push(z*width+x);};
 for(let x=g.x-1;x<=g.x+2;x++)add(x,g.z-1);
 for(let z=g.z;z<=g.z+2;z++)add(g.x+2,z);
 for(let x=g.x+1;x>=g.x-1;x--)add(x,g.z+2);
 for(let z=g.z+1;z>=g.z;z--)add(g.x-1,z);
 return cells;
}
/** Called once AFTER actual thermal reconciliation/exchange on a true local
 * step. Layout must include prospective Full footprints/collapsed rocks (see
 * named topology patch); never substitute a fake room or an outdoor fallback. */
export function advanceLocalGeysers256(world:GeyserWorld256,layout:ThermalLayout):void {
 const state=world.geysers;if(!state)return;
 if(!isSchema256Or257(world.schemaVersion)||world.site?.revision!==3||!validLocalGeyserState256(state,world.width,world.height,state.atTick,world.nextId))throw Error('Invalid actual geyser owner');
 if(world.tick===state.atTick)return;
 if(world.tick!==state.atTick+1)throw Error('Geyser phase requires one real local step, never catch-up');
 if(world.tiles.length!==world.width*world.height||state.items.length&&!world.snow)throw Error('Actual geyser surface/snow owner absent');
 if(layout.indices.length!==world.tiles.length||layout.rooms.length!==(world.thermal?.regions.length??0)||layout.rooms.some((r,i)=>r.cells.length!==world.thermal!.regions[i]!.cells.length))throw Error('Geyser heat requires actual reconciled thermal regions');
 const harvested=harvestedGeothermalGeyserIds264(world);
 let full:ReadonlySet<number>|undefined;const rng={rng:world.rng};
 const items=state.items.map(g=>({...g})),temperatures=(world.thermal?.regions??[]).map(r=>r.temperature),snow=new Map<number,number>();
 const integer=(lo:number,hi:number)=>lo+Math.floor(healthRandom(rng)*(hi-lo+1));
 const pushHeat=(g:NaturalGeyser256)=>{
  const fullCells=full??=geyserFullCells256(world);let cell=g.z*world.width+g.x;
  if(!geyserHasRoom256(world,cell,fullCells)){const candidates=geyserAdjacentCells256(world.width,world.height,g).filter(c=>geyserHasRoom256(world,c,fullCells));if(!candidates.length)return;cell=candidates[integer(0,candidates.length-1)]!;}
  const room=layout.indices[cell]!;if(room<0)return; // actual outdoor Room receives no retained heat
  const count=world.thermal!.regions[room]!.cells.length;if(!count)throw Error('Empty actual geyser room');
  // Existing product thermal domain retains its1000°C serialization bound.
  temperatures[room]=Math.min(1000,f(temperatures[room]!+f(40/count)));
 };
 const start=(g:NaturalGeyser256)=>{
  const x=g.x+integer(0,1),z=g.z+integer(0,1),radial=caveRadialPattern256(4);
  for(let i=0;i<radial.count;i++){const [dx,dz]=radial.offsets[i]!,nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=world.width||nz>=world.height)continue;
   const cell=nz*world.width+nx,fall=f(f(1-f(f(Math.sqrt(dx*dx+dz*dz))/4))*f(-.06));
   snow.set(cell,Math.max(0,f((snow.get(cell)??snowDepthAt(world,cell))+fall)));
  }
 };
 for(let core=state.atTick*10+1;core<=world.tick*10;core++)for(const g of items){
  if(harvested.has(g.id))continue;
  if(g.sprayTicksLeft>0){g.sprayTicksLeft--;if((core+combineWorldSeed(g.id,169495093))%20===0)pushHeat(g);if(g.sprayTicksLeft===0)g.ticksUntilSpray=integer(500,2000);}
  else if(--g.ticksUntilSpray===0){start(g);g.sprayTicksLeft=integer(200,500);}
 }
 // All authority checks precede commit. Existing snow owner/cache receives the
 // negative depth; no second snow clock or replacement Tile object is created.
 for(const [cell,depth] of snow)setSnowDepth(world,cell,depth);
 for(let i=0;i<temperatures.length;i++)world.thermal!.regions[i]!.temperature=temperatures[i]!;
 for(let i=0;i<items.length;i++)Object.assign(state.items[i]!,items[i]);
 world.rng=rng.rng;state.atTick=world.tick;
}
