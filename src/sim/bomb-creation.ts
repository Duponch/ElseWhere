import { IED_TRAPS_357,isIedSchema357,isIedTrapKind357 } from './ied-traps-357.ts';
import { BOMB_WICK_CORE,type MiniTurretBombWave } from './bomb-state.ts';
import { captureBombCells } from './bomb-cells.ts';
import { reconcileTemperature } from './temperature.ts';
import type { BombInstigatorKey } from './mini-turret-state.ts';
import type { Structure,World } from './types.ts';
import { miniTurretExplosive } from './bomb-eligibility.ts';
export { miniTurretExplosive } from './bomb-eligibility.ts';

export function startTurretWick(w:World,s:Structure,core:number,instigatorKey?:BombInstigatorKey):void {
  if(w.schemaVersion<193||s.kind!=='mini-turret'||!s.turret||s.turret.wick||!miniTurretExplosive(s.id)||!w.structures.includes(s))return;
  if(!Number.isSafeInteger(core+BOMB_WICK_CORE))throw new RangeError('Bomb wick clock exhausted');
  s.turret.wick={startedAtCore:core,endCore:core+BOMB_WICK_CORE,...instigatorKey?{instigatorKey}:{}};
}
/** ID was reserved with the source destruction and its salvage before mutation.
 * Source has already left the map. No new loss, fuel or RNG is fabricated here. */
export function registerBombWave(w:World,source:Structure,id:number,core:number,instigatorKey?:BombInstigatorKey):MiniTurretBombWave {
  if(w.structures.includes(source))throw new Error('Bomb source must be retired before capture');
  const center={x:source.x,z:source.z},cells=captureBombCells(w,center);
  // Schema 357: TrapIED_* CompExplosive, Bomb or Flame; Flame pushes 15 heat per cell.
  const ied=isIedSchema357(w.schemaVersion)&&isIedTrapKind357(source.kind)?IED_TRAPS_357[source.kind].damage:undefined;
  const wave:MiniTurretBombWave={id,sourceId:source.id,...instigatorKey?{instigatorKey}:{},center,startedAtCore:core,advancedAtCore:core,cells,nextCell:0,damagedThingKeys:[],...ied?{ied357:{damage:ied}}:{}};
  (w.bombWaves??=[]).push(wave);w.bombWaves.sort((a,b)=>a.id-b.id);
  for(const p of w.pawns)if(p.bombRefuge?.sourceId===source.id)p.bombRefuge.endCore=Math.min(p.bombRefuge.endCore,core);
  const layout=reconcileTemperature(w),region=w.thermal?.regions[layout.indices[center.z*w.width+center.x]!];
  if(region)region.temperature=Math.min(1000,region.temperature+(ied==='flame'?15:5)*cells.length/region.cells.length);
  return wave;
}
