import {homeAnimalThreatPoints329} from './animal-threat-points-329.ts';
import { freeColonist } from './colony-economy.ts';
import { cropBlightable,infectCrop } from './plant-blight.ts';
import { RoomTopologyCache } from './room-topology.ts';
import { computeThreatPoints,summaryHealthPercent } from './threat-points.ts';
import { TICKS_PER_DAY,type World } from './types.ts';

export const CROP_BLIGHT_COOLDOWN=30*TICKS_PER_DAY;
export interface CropBlightCalendar {adoptedAt:number;count:number;lastStart?:number}

/** Core's point-scaled incident radius. The existing storyteller owns points;
 * a profile without an adopted economy uses its minimum 35-point envelope. */
export function cropBlightIncidentPoints(world:World):number {
  if(!world.economy)return 35;
  const colonists=world.pawns.filter(freeColonist);
  return computeThreatPoints({timeFactorWholeDays:world.schemaVersion>=328,animalPoints:homeAnimalThreatPoints329(world),knownWealth:world.economy.wealth.knownStorytellerWealth,
    freeColonists:colonists.length,colonistHealthSum:colonists.reduce((n,p)=>n+(p.health?summaryHealthPercent(p.health):1),0),
    elapsedDays:world.tick/TICKS_PER_DAY,adaptationDays:world.economy.adaptationDays,seedBucket:Math.floor(world.tick/250)}).points;
}
export function cropBlightRadiusFactor(points:number):number {
  if(points<=100)return .6;
  if(points<=500)return .6+(points-100)/400*.4;
  return points<2000?1+(points-500)/1500:2;
}
export function cropBlightInitialChance(distance:number,radiusFactor:number):number {
  const scaled=distance/radiusFactor;
  return scaled<=8?1:scaled<=11?1-(scaled-8)/3*.7:0;
}

/** First played adoption only; historical elapsed time creates no lottery. */
export function adoptCropBlights(world:World):void {
  if(world.schemaVersion<205||!world.gameProfile||!world.miscIncidents||world.miscIncidents.cropBlights||!Number.isSafeInteger(world.tick)||world.tick<0)return;
  world.miscIncidents.cropBlights={adoptedAt:world.tick,count:0};
}
function calendarEligible(world:World):boolean {
  const state=world.miscIncidents?.cropBlights;
  return world.schemaVersion>=205&&!!world.gameProfile&&!!state&&state.count<Number.MAX_SAFE_INTEGER&&
    world.tick>=state.adoptedAt&&Number.isSafeInteger(world.tick+TICKS_PER_DAY)&&
    (state.lastStart===undefined||world.tick-state.lastStart>=CROP_BLIGHT_COOLDOWN);
}
export function eligibleCropBlight(world:World):boolean {
  return calendarEligible(world)&&world.resources.some(p=>p.species===undefined&&cropBlightable(world,p));
}

/** Candidate order adapts Core's plant lister. All choices and per-plant seeds
 * use this selected ticket's stream, never the simulation World RNG. The room
 * restriction applies to this incident, not to later plant propagation. */
export function resolveSelectedCropBlight(world:World,seed:number):boolean {
  if(!calendarEligible(world)||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)return false;
  const candidates=world.resources.filter(p=>p.species===undefined&&cropBlightable(world,p));
  if(!candidates.length)return false;
  let rng=(seed>>>0)||1;
  const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;rng>>>=0;return rng/0x100000000;};
  const root=candidates[Math.floor(random()*candidates.length)]!,topology=new RoomTopologyCache().read(world),room=topology.at(root.x,root.z);
  if(room?.kind!=='space')return false;
  const factor=cropBlightRadiusFactor(cropBlightIncidentPoints(world)),radius=11*factor;
  const selected=candidates.filter(p=>{
    if(p.kind!==root.kind||topology.at(p.x,p.z)!==room)return false;
    const distance=Math.hypot(p.x-root.x,p.z-root.z);
    if(distance>radius)return false;
    const chance=cropBlightInitialChance(distance,factor);
    // Core Rand.Chance(1) consumes no random value.
    return chance>=1||chance>0&&random()<chance;
  });
  let infected=0;
  for(const plant of selected)if(infectCrop(world,plant,Math.floor(random()*0x100000000)||1))infected++;
  if(!infected)return false;
  const state=world.miscIncidents!.cropBlights!;state.count++;state.lastStart=world.tick;
  world.events.push({tick:world.tick,type:'need',message:`Fléau des cultures : ${infected} plante${infected===1?'':'s'} touchée${infected===1?'':'s'}. La croissance et la récolte sont bloquées ; coupez les plantes malades pour limiter la propagation, y compris dans les bacs hydroponiques.`});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
  return true;
}
