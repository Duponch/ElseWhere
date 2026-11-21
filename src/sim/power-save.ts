import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {isShipCasketKind277} from './ship-casket-content-277.ts';
import {isSchema275OrLater,isSchema276OrLater} from './schema-compatibility-257.ts';
import {isShipAddedKind276,isShipOrientation276} from './ship-part-content-276.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import type { PowerParentReader } from './power-parent-validation.ts';
import { isElectrical,isFlickable,isPowerTrader } from './power-rules.ts';
import { isPowerConnector,isPowerTransmitter } from './power-grid.ts';
import { BATTERY_CAPACITY } from './power-battery.ts';
import { PowerTopologyCache, validPowerParent } from './power-topology.ts';
import { isBlockMaterial } from './building-materials.ts';
import type { StructureKind,World } from './types.ts';

export function validatePower(world:World,version:number,onlyKind?:StructureKind,topologyCache?:PowerParentReader,packedRecords?:readonly PackedFurniture[]):string[];
export function validatePower(world:Pick<World,'tick'>,version:number,onlyKind:undefined,topologyCache:undefined,packedRecords:readonly PackedFurniture[]):string[];
export function validatePower(world:World|Pick<World,'tick'>,version:number,onlyKind?:StructureKind,topologyCache?:PowerParentReader,packedRecords?:readonly PackedFurniture[]):string[] {
  const local='structures'in world?world:undefined;if(!packedRecords&&!local)return ['Power requires an actual map or explicit packed records.'];
  const errors:string[]=[],topology=packedRecords?undefined:(topologyCache??new PowerTopologyCache()).read(local!);
  for(const s of packedRecords?packedRecords.map(p=>p.building):[...local!.structures,...(local!.packed??[]).map(p=>p.building)]) {
    if(onlyKind!==undefined&&s.kind!==onlyKind)continue;
    const p=s.power,packed=!!packedRecords||!local!.structures.includes(s);
    const battery=s.battery;
    if(s.kind==='battery'){
      if(version<85||!battery||typeof battery!=='object'||Array.isArray(battery)||Object.keys(battery).some(k=>k!=='stored'&&(k!=='half'||version<87))||!Number.isSafeInteger(battery.stored)||battery.stored<0||battery.stored>BATTERY_CAPACITY||battery.half!==undefined&&(battery.half!==true||battery.stored===BATTERY_CAPACITY))errors.push('Invalid battery energy.');
    }else if(battery!==undefined)errors.push('Unexpected battery energy.');
    if(isShipAddedKind276(s.kind)||isShipCasketKind277(s.kind)){
      // Native passive transmitter, using the existing local grid adapter.
      // No supply, consumer state, switch, minification or power parent.
      if(!(isShipCasketKind277(s.kind)?isSchema277OrLater(version):isSchema276OrLater(version))||packed||s.material!=='steel'||s.footprint!=='standard'||!isShipOrientation276(s.orientation)
        ||!p||typeof p!=='object'||Array.isArray(p)||Object.getPrototypeOf(p)!==Object.prototype||Reflect.ownKeys(p).length!==2
        ||!['on','parentId'].every(k=>{const d=Object.getOwnPropertyDescriptor(p,k);return !!d?.enumerable&&Object.hasOwn(d,'value');})
        ||p.on!==false||p.parentId!==null)errors.push('Invalid passive ship-part transmitter.');
      continue;
    }
    if(!isElectrical(s.kind)){if(p!==undefined)errors.push('Unexpected power state.');continue;}
    if(s.kind==='ship-reactor'&&!isSchema275OrLater(version)||s.kind==='electric-smithy'&&version<267||s.kind==='geothermal-generator'&&version<264||s.kind==='electric-crematorium'&&version<225||s.kind==='electric-smelter'&&version<222||['biofuel-refinery','chemfuel-generator'].includes(s.kind)&&version<218||s.kind==='nutrient-paste-dispenser'&&version<217||['orbital-beacon','comms-console'].includes(s.kind)&&version<216||s.kind==='vitals-monitor'&&version<211||s.kind==='hydroponics-basin'&&version<203||s.kind==='mini-turret'&&version<193||s.kind==='tube-television'&&version<190||s.kind==='sun-lamp'&&version<177||s.kind==='wall-lamp'&&version<363||s.kind==='machining-table'&&version<101||['hi-tech-research-bench','multi-analyzer','fabrication-bench'].includes(s.kind)&&version<123||s.kind==='autodoor'&&version<143||version<42||s.kind==='electric-stove'&&version<84||s.kind==='electric-tailor-bench'&&version<90||['battery','solar-generator','power-conduit','power-switch'].includes(s.kind)&&version<85||['heater','wind-turbine'].includes(s.kind)&&version<87||!p||typeof p!=='object'||Array.isArray(p)||typeof p.on!=='boolean'||s.kind!=='ship-reactor'&&s.kind!=='electric-smithy'&&s.kind!=='electric-crematorium'&&s.kind!=='electric-smelter'&&s.kind!=='biofuel-refinery'&&s.kind!=='nutrient-paste-dispenser'&&s.kind!=='comms-console'&&s.kind!=='deep-drill'&&s.kind!=='ground-scanner'&&s.kind!=='vitals-monitor'&&s.kind!=='hydroponics-basin'&&s.kind!=='tube-television'&&s.kind!=='cooler'&&s.kind!=='electric-stove'&&s.kind!=='electric-tailor-bench'&&s.kind!=='machining-table'&&s.kind!=='hi-tech-research-bench'&&s.kind!=='fabrication-bench'&&s.kind!=='battery'&&s.kind!=='wind-turbine'&&s.kind!=='wall-lamp'&&s.orientation!==0
      ||s.footprint!=='standard'||(s.kind==='autodoor'?!(s.material==='wood'||s.material==='steel'||isBlockMaterial(s.material)):s.kind==='electric-tailor-bench'?!['wood','steel'].includes(s.material??''):s.kind==='electric-crematorium'?!isBlockMaterial(s.material):s.material!=='steel')||Object.keys(p).some(k=>!['on','parentId',...(version>=85&&isFlickable(s.kind)&&(s.kind!=='electric-tailor-bench'||version>=181)?['switchOn']:[])].includes(k))
      ||p.switchOn!==undefined&&typeof p.switchOn!=='boolean'||p.switchOn===false&&p.on
      ||!(p.parentId===null||Number.isSafeInteger(p.parentId)&&p.parentId>0)) {errors.push('Invalid electrical state.');continue;}
    if(isPowerTransmitter(s.kind)&&p.parentId!==null||!isPowerTrader(s.kind)&&p.on||packed&&(p.on||p.parentId!==null))errors.push('Invalid power owner.');
    if(!packedRecords&&isPowerConnector(s.kind)&&(s.kind!=='electric-tailor-bench'||version>=181)&&(p.on&&p.parentId===null||p.parentId!==null&&!validPowerParent(topology!,s,p.parentId)))errors.push('Invalid electrical parent.');
  }
  if(packedRecords)return errors;
  for(const j of local!.jobs)if('power' in j||'battery' in j)errors.push('Blueprint cannot supply power.');
  return errors;
}
