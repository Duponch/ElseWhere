import {homeIncidentsBlocked261} from './temp-map-incidents-261.ts';
import {checkpointPlantGrowth} from './plant-lighting.ts';
import {TICKS_PER_DAY,type World} from './types.ts';
import {isVolcanicWinter310,VOLCANIC_WINTER_FIRST_DAY310,VOLCANIC_WINTER_MAX_CORE310,VOLCANIC_WINTER_MIN_CORE310,VOLCANIC_WINTER_REFIRE_DAYS310} from './volcanic-winter-state-310.ts';

/* Schema 310 volcanic winter incident: selection and end. Rules in
 * volcanic-winter-state-310.ts. */
const emit=(world:World,message:string)=>{world.events.push({tick:world.tick,type:'need',message});if(world.events.length>80)world.events.splice(0,world.events.length-80);};
export function eligibleVolcanicWinter310(world:World):boolean {
  const state=world.miscIncidents;
  return !!state&&isVolcanicWinter310(Number(world.schemaVersion))&&!!world.gameProfile&&!homeIncidentsBlocked261(world)&&!state.volcanicWinter310
    &&world.tick>=VOLCANIC_WINTER_FIRST_DAY310*TICKS_PER_DAY&&Number.isSafeInteger(world.tick*10+VOLCANIC_WINTER_MAX_CORE310)
    &&(state.lastVolcanicWinterStart310===undefined||world.tick-state.lastVolcanicWinterStart310>=VOLCANIC_WINTER_REFIRE_DAYS310*TICKS_PER_DAY);
}
/** Plants keep the growth already acquired before the light changes. */
function checkpointGrowth310(world:World):void {for(const plant of world.resources)checkpointPlantGrowth(world,plant);}
/** Only an already selected Misc ticket reaches this function. */
export function resolveSelectedVolcanicWinter310(world:World,random:()=>number):boolean {
  if(!eligibleVolcanicWinter310(world))return false;
  const state=world.miscIncidents!,f=Math.fround;
  const days=f(f(7.5)+f(f(32.5)*f(random()))),core=f(days*f(60000)),lower=Math.floor(core);
  const duration=Math.min(VOLCANIC_WINTER_MAX_CORE310,Math.max(VOLCANIC_WINTER_MIN_CORE310,core-lower===.5?lower+lower%2:Math.round(core)));
  checkpointGrowth310(world);
  const startCore=world.tick*10;
  state.volcanicWinter310={startCore,endCore:startCore+duration};state.lastVolcanicWinterStart310=world.tick;state.volcanicWinters310=(state.volcanicWinters310??0)+1;
  emit(world,`Hiver volcanique : une éruption lointaine voile le ciel de cendres pendant ${(duration/60000).toFixed(1)} jours. Il fera plus froid et plus sombre, les cultures pousseront moins vite et la faune se raréfiera.`);
  return true;
}
/** Ends the condition when due; called with the Misc calendar each tick. */
export function advanceVolcanicWinter310(world:World):void {
  const state=world.miscIncidents,v=state?.volcanicWinter310;if(!state||!v||world.tick*10<v.endCore)return;
  checkpointGrowth310(world);delete state.volcanicWinter310;
  emit(world,'L’hiver volcanique se termine : le ciel s’éclaircit et les températures reviennent à la normale.');
}
