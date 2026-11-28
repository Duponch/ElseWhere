import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {extremeWeatherAllowed382} from './game-profile.ts';
import {journalLetter352} from './letter-producers-352.ts';
import {homeIncidentsBlocked261} from './temp-map-incidents-261.ts';
import {TICKS_PER_DAY,type World} from './types.ts';
import {TOXIC_FALLOUT_FIRST_DAY294,TOXIC_FALLOUT_COOLDOWN_DAYS294,TOXIC_FALLOUT_MIN_CORE294,TOXIC_FALLOUT_MAX_CORE294,toxicFalloutCellsPerCore294} from './toxic-fallout-state-294.ts';

function emit(world:World,message:string):void {
  world.events.push({tick:world.tick,type:'need',message});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
}
/** First played adoption only. Migration/read/selection never call this. */
export function adoptToxicFallout294(world:World):void {
  if((Number(world.schemaVersion)!==294&&(Number(world.schemaVersion)!==295&&(Number(world.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(world.schemaVersion)))))||!world.gameProfile||!world.miscIncidents||homeIncidentsBlocked261(world)||world.miscIncidents.toxicFallout)return;
  world.miscIncidents.toxicFallout={adoptedAt:world.tick,count:0};
}
export function eligibleToxicFallout294(world:World):boolean {
  const state=world.miscIncidents?.toxicFallout;
  // Core's difficulty-specific disabledWhen flag applies before selecting the ticket.
  return (Number(world.schemaVersion)===294||(Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion)))))&&!!world.gameProfile&&extremeWeatherAllowed382(world)&&!!state&&!homeIncidentsBlocked261(world)&&!state.active&&
    world.tick>=TOXIC_FALLOUT_FIRST_DAY294*TICKS_PER_DAY&&world.tick>=state.adoptedAt&&
    Number.isSafeInteger(world.tick*10+TOXIC_FALLOUT_MAX_CORE294)&&state.count<Number.MAX_SAFE_INTEGER&&
    (state.lastStart===undefined||world.tick-state.lastStart>=TOXIC_FALLOUT_COOLDOWN_DAYS294*TICKS_PER_DAY);
}
/** The existing Misc lottery owns this selected ticket. A failed eligibility
 * consumes neither a duration nor a new environmental stream. */
export function resolveSelectedToxicFallout294(world:World,seed:number):boolean {
  if(!eligibleToxicFallout294(world)||!Number.isSafeInteger(seed)||seed<1||seed>0xffffffff)return false;
  const state=world.miscIncidents!.toxicFallout!,startCore=world.tick*10;
  let rng=seed>>>0;rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;rng>>>=0;
  // The stream is local; the FloatRange day arithmetic and final rounding
  // retain native single precision and RoundToInt's even-half convention.
  const f=Math.fround,days=f(f(2.5)+f(f(8)*f(rng/0x100000000))),core=f(days*f(60000)),lower=Math.floor(core);
  const duration=core-lower===.5?lower+lower%2:Math.round(core);
  const area=world.width*world.height,visits=toxicFalloutCellsPerCore294(area);
  state.active={startCore,endCore:startCore+duration,rng,cursor:((startCore%area)*visits)%area};
  state.lastStart=world.tick;state.count++;
  emit(world,'Retombées toxiques : mettez les habitants et les animaux à l’abri sous un toit. Les cultures et les objets laissés dehors sont exposés. Surveillez la toxicité dans Santé.');
  journalLetter352(world,'threat-small','Retombées toxiques');
  return true;
}
/** Run after the local step's real clinical/environmental owners. End is
 * inclusive in Core time; a partial final step receives no later exposure. */
export function finishToxicFallout294(world:World):void {
  const state=world.miscIncidents?.toxicFallout;
  if((Number(world.schemaVersion)!==294&&(Number(world.schemaVersion)!==295&&(Number(world.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(world.schemaVersion)))))||!state?.active||world.tick*10<=state.active.endCore)return;
  delete state.active;
  emit(world,'Les retombées toxiques se dissipent. Les expositions cessent ; les intoxications, les pertes de cultures et la pourriture déjà acquises demeurent.');
}
