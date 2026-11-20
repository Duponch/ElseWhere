import { startShortCircuitDischarge } from './bomb-system.ts';
import {journalLetter352,cell352} from './letter-producers-352.ts';
import { FireContent } from './fire-content.ts';
import { startFire } from './fire.ts';
import { ensureFireState } from './fire-rules.ts';
import { BATTERY_ENERGY_SCALE,batteryQuanta,batteryWattDays,drainBatteryWattDays } from './power-battery.ts';
import { powerWatts } from './power-rules.ts';
import { empStructureActive } from './emp-state.ts';
import { connectedPowerGroups,PowerTopologyCache } from './power-topology.ts';
import { TICKS_PER_DAY,type Cell,type Structure,type World } from './types.ts';

export const SHORT_CIRCUIT_COOLDOWN=8*TICKS_PER_DAY;
export interface ShortCircuitReport {
  at:number;conduitId:number;center:Cell;energyWd:number;flameRadius:number;bombRadius?:number;
  outcome:'fire'|'discharge';ignited?:boolean;
}
export interface ShortCircuitCalendar {
  adoptedAt:number;count:number;lastStart?:number;last?:ShortCircuitReport;
}
interface Candidate {conduit:Structure;parts:Structure[]}

/** Core chooses from conduits, so a larger network owns more tickets. The
 * placed array order and local incident PRNG adapt Core's lister/Rand order. */
function candidates(world:World):Candidate[] {
  const topology=new PowerTopologyCache().read(world),active=new Map<number,Structure[]>();
  for(const parts of connectedPowerGroups(world,topology))if(parts.some(s=>
    s.battery?batteryQuanta(s.battery)>0&&!empStructureActive(s,world.tick*10):powerWatts(s,world)>0)) {
    const net=topology.netOf.get(parts[0]!.id);if(net!==undefined)active.set(net,parts);
  }
  return world.structures.flatMap(conduit=>{
    if(conduit.kind!=='power-conduit')return [];
    const net=topology.netOf.get(conduit.id),parts=net===undefined?undefined:active.get(net);
    return parts?[{conduit,parts}]:[];
  });
}
export function adoptShortCircuits(world:World):void {
  if(world.schemaVersion<201||!world.gameProfile||!world.miscIncidents||world.miscIncidents.shortCircuits)return;
  world.miscIncidents.shortCircuits={adoptedAt:world.tick,count:0};
}
function calendarEligible(world:World):boolean {
  const state=world.miscIncidents?.shortCircuits;
  return world.schemaVersion>=201&&!!world.gameProfile&&!!state&&state.count<Number.MAX_SAFE_INTEGER&&
    (state.lastStart===undefined||world.tick-state.lastStart>=SHORT_CIRCUIT_COOLDOWN);
}
export function eligibleShortCircuit(world:World):boolean {
  return calendarEligible(world)&&candidates(world).length>0;
}
function announce(world:World,report:ShortCircuitReport):void {
  const message=report.outcome==='discharge'
    ?`Zzztt ! Court-circuit : ${Math.round(report.energyWd)} Wj déchargés du réseau${report.bombRadius===undefined?'':', avec une forte explosion'}.`
    :report.ignited?'Zzztt ! Un court-circuit a déclenché un incendie près d’un conduit.'
    :'Zzztt ! Un court-circuit s’est produit près d’un conduit, sans départ de feu.';
  world.events.push({tick:world.tick,type:'need',message});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
}
/** Selected tickets arrive with their own seed. Admission/selection never
 * advances World RNG, and a rejected explosion cannot debit a battery. */
export function resolveSelectedShortCircuit(world:World,seed:number):boolean {
  if(!calendarEligible(world)||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)return false;
  const choices=candidates(world);if(!choices.length)return false;
  let rng=(seed>>>0)||1;
  const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;rng>>>=0;return rng/0x100000000;};
  const {conduit,parts}=choices[Math.floor(random()*choices.length)]!,state=world.miscIncidents!.shortCircuits!;
  const batteries=parts.filter(s=>!!s.battery);
  let report:ShortCircuitReport;
  // The threshold belongs to each battery, not their combined reserve.
  if(batteries.some(s=>batteryWattDays(s.battery!)>20)) {
    const energyQuanta=batteries.reduce((sum,s)=>sum+batteryQuanta(s.battery!),0),energyWd=energyQuanta/BATTERY_ENERGY_SCALE;
    const loss=(world.fires?.ledger.batteryEnergyLost??0)+energyQuanta;
    if(!Number.isSafeInteger(energyQuanta*2)||!Number.isSafeInteger(loss*2))return false;
    const flameRadius=Math.max(1.5,Math.min(14.9,Math.sqrt(energyWd)*.05));
    const bombRadius=flameRadius>3.5?flameRadius*.3:undefined;
    if(!startShortCircuitDischarge(world,conduit,flameRadius,bombRadius,(seed>>>0)||1))return false;
    let spentQuanta=0;
    for(const battery of batteries) {
      const quantity=batteryQuanta(battery.battery!);
      drainBatteryWattDays(battery.battery!,quantity/BATTERY_ENERGY_SCALE);
      spentQuanta+=quantity-batteryQuanta(battery.battery!);
    }
    ensureFireState(world).ledger.batteryEnergyLost+=spentQuanta;
    report={at:world.tick,conduitId:conduit.id,center:{x:conduit.x,z:conduit.z},energyWd,flameRadius,
      ...bombRadius===undefined?{}:{bombRadius},outcome:'discharge'};
  } else {
    const content=new FireContent(world),cells:Cell[]=[];
    for(let z=Math.max(0,conduit.z-3);z<=Math.min(world.height-1,conduit.z+3);z++)
      for(let x=Math.max(0,conduit.x-3);x<=Math.min(world.width-1,conduit.x+3);x++) {
        const cell={x,z};if((x-conduit.x)**2+(z-conduit.z)**2<=9&&content.line(conduit,cell)&&content.chance(cell)>0)cells.push(cell);
      }
    const center=cells.length?cells[Math.floor(random()*cells.length)]!:{x:conduit.x,z:conduit.z};
    const ignited=cells.length>0&&startFire(world,center,.1+random()*1.65);
    report={at:world.tick,conduitId:conduit.id,center,energyWd:0,flameRadius:0,outcome:'fire',ignited};
  }
  state.count++;state.lastStart=world.tick;state.last=report;announce(world,report);journalLetter352(world,'negative','Court-circuit',[cell352(report.center)]);return true;
}
