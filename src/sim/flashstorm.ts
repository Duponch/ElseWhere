import { captureStandability } from './furniture-travel.ts';
import {extremeWeatherAllowed382} from './game-profile.ts';
import {journalLetter352,cell352} from './letter-producers-352.ts';
import { isRoofed } from './roof-rules.ts';
import { TICKS_PER_DAY,type Cell,type World } from './types.ts';

export const FLASHSTORM_COOLDOWN=15*TICKS_PER_DAY;
export const FLASHSTORM_RAIN_DELAY=3000;

export interface FlashstormActive {
  start:number;end:number;endCore:number;center:Cell;radius:number;
  lastCoreTick:number;nextStrikeCore:number;strikes:number;
}
export interface FlashstormState {
  revision:1;rng:number;storms:number;totalStrikes:number;
  lastStart:number;lastEnd:number;active?:FlashstormActive;
}

function random(state:FlashstormState):number {
  let value=state.rng;
  value^=value<<13;value^=value>>>17;value^=value<<5;
  state.rng=value>>>0;
  return state.rng/0x100000000;
}
/** Unity's RoundToInt resolves exact half-integers toward the even integer. */
function roundToEven(value:number):number {
  const floor=Math.floor(value),fraction=value-floor;
  return fraction>.5||fraction===.5&&floor%2!==0?floor+1:floor;
}
function emit(world:World,message:string):void {
  world.events.push({tick:world.tick,type:'need',message});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
}
/** One short-lived spatial capture. The callback can destroy buildings, so a
 * strike discards it before any subsequent due attempt. */
function admissible(world:World):(cell:Cell)=>boolean {
  const stand=captureStandability(world),trees=new Set<number>();
  for(const resource of world.resources)if(resource.kind==='tree'||resource.kind==='rock')trees.add(resource.z*world.width+resource.x);
  return cell=>stand(cell)&&!trees.has(cell.z*world.width+cell.x)&&!isRoofed(world,cell.z*world.width+cell.x);
}
function chooseCenter(world:World,state:FlashstormState,radius:number):Cell {
  const valid=admissible(world),minimum=Math.floor(Math.PI*radius*radius/2);
  let center:Cell={x:8,z:8};
  for(let attempt=0;attempt<10;attempt++){
    center={x:8+Math.floor(random(state)*(world.width-16)),z:8+Math.floor(random(state)*(world.height-16))};
    let count=0;
    const x0=Math.max(0,center.x-radius),x1=Math.min(world.width-1,center.x+radius);
    const z0=Math.max(0,center.z-radius),z1=Math.min(world.height-1,center.z+radius);
    countCells:for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)
      if((x-center.x)**2+(z-center.z)**2<=radius*radius&&valid({x,z})&&++count>=minimum)break countCells;
    if(count>=minimum)break;
  }
  return center;
}

export function eligibleFlashstorm(world:World):boolean {
  if(!world.gameProfile||!extremeWeatherAllowed382(world)||!world.miscIncidents||!world.weather||world.width<=16||world.height<=16||
    world.flashstorm?.active||world.flashstorm&&world.tick-world.flashstorm.lastStart<FLASHSTORM_COOLDOWN)return false;
  return Number.isSafeInteger(world.tick*10+6000)&&Number.isSafeInteger(world.tick+601+FLASHSTORM_RAIN_DELAY)&&
    world.weather.lightningCount<=Number.MAX_SAFE_INTEGER-20&&
    (!world.flashstorm||world.flashstorm.storms<Number.MAX_SAFE_INTEGER&&world.flashstorm.totalStrikes<=Number.MAX_SAFE_INTEGER-20);
}

/** The Misc selector has already committed its ticket and supplied its seed.
 * Rejected tickets cannot draw from this private stream. */
export function resolveSelectedFlashstorm(world:World,seed:number):boolean {
  if(!eligibleFlashstorm(world)||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)return false;
  const state:FlashstormState=world.flashstorm??{revision:1,rng:(seed>>>0)||1,storms:0,totalStrikes:0,lastStart:world.tick,lastEnd:world.tick};
  // Each incident has its own stream, derived from the committed Misc draw.
  state.rng=(seed>>>0)||1;
  const start=world.tick,endCore=start*10+roundToEven(4500+random(state)*1500);
  const end=Math.floor(endCore/10)+1;
  const radius=45+Math.floor(random(state)*16);
  const center=chooseCenter(world,state,radius);
  state.storms++;state.lastStart=start;state.lastEnd=end;
  state.active={start,end,endCore,center,radius,lastCoreTick:start*10,nextStrikeCore:start*10,strikes:0};
  world.flashstorm=state;
  emit(world,'Orage de foudre : protégez le foyer et préparez les équipes d’extinction.');
  journalLetter352(world,'threat-small','Orage de foudre',[cell352(center)]);
  return true;
}

export function preventsRain(world:World):boolean {
  const state=world.flashstorm;
  return !!state&&(!!state.active||world.tick<state.lastEnd+FLASHSTORM_RAIN_DELAY);
}

/** Ten Core decisions per local tick, with the Core strict `>` deadline.
 * Rejected candidates retry next Core tick without moving the deadline. */
export function advanceFlashstorm(world:World,lightning:(cell:Cell,coreTick:number)=>void):void {
  const state=world.flashstorm,active=state?.active;if(!state||!active)return;
  const now=world.tick*10;
  if(now<=active.lastCoreTick)return;
  let valid:((cell:Cell)=>boolean)|undefined;
  for(let core=active.lastCoreTick+1;core<=Math.min(now,active.endCore);core++){
    if(core<=active.nextStrikeCore||active.strikes>=20)continue;
    const angle=random(state)*Math.PI*2,distance=random(state)*active.radius;
    const cell={x:Math.round(active.center.x+Math.cos(angle)*distance),z:Math.round(active.center.z+Math.sin(angle)*distance)};
    valid??=admissible(world);
    if(!valid(cell))continue;
    active.strikes++;state.totalStrikes++;
    active.nextStrikeCore=core+320+Math.floor(random(state)*481);
    lightning(cell,core);
    valid=undefined;
  }
  active.lastCoreTick=now;
  if(world.tick>=active.end){delete state.active;emit(world,'L’orage de foudre se termine ; les incendies éventuels continuent.');}
}
