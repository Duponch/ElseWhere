import {structureFamily379} from './structure-family-379.ts';
/** Prospective generator sprayer. Persisting its phase is the same declared
 * continuation adaptation as the natural geyser; Core resets unsaved sprayers. */
import type {NaturalGeyser256} from './local-geyser-state-256.ts';
import type {Structure,World} from './types.ts';

export interface GeothermalState264 {geyserId:number;atTick:number;ticksUntilSpray:number;sprayTicksLeft:number}
export const GEOTHERMAL_POWER_WATTS_264=3600;
export const GEOTHERMAL_WIDTH_264=6;
const fields=['geyserId','atTick','ticksUntilSpray','sprayTicksLeft'] as const;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const integer=(v:unknown,lo:number,hi:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const ownsData=(v:object,k:string):boolean=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&Object.hasOwn(d,'value')&&d.enumerable===true;};

export function validGeothermalState264(value:unknown,tick:number,nextId:number):value is GeothermalState264 {
 if(!integer(tick,0,Math.floor(Number.MAX_SAFE_INTEGER/10))||!integer(nextId,1,2147483647)||!plain(value)||Reflect.ownKeys(value).length!==fields.length||!fields.every(k=>ownsData(value,k)))return false;
 const wait=value.ticksUntilSpray,left=value.sprayTicksLeft;
 return value.atTick===tick&&integer(value.geyserId,1,nextId-1)&&integer(wait,0,2000)&&integer(left,0,500)&&(left>0?wait===0:wait>0);
}

/** The natural 2x2 anchor is the Core Position. Our 6x6 uses its lower corner,
 * hence this exact offset; an arbitrary overlap is never an association. */
export function geothermalGeyser264(world:Pick<World,'geysers'>,building:Pick<Structure,'x'|'z'>):NaturalGeyser256|undefined {
 return world.geysers?.items.find(g=>g.x===building.x+2&&g.z===building.z+2);
}

export function createGeothermalState264(world:World,building:Structure):GeothermalState264 {
 const geyser=geothermalGeyser264(world,building);
 if(Number(world.schemaVersion)<264||world.site?.revision!==3||building.kind!=='geothermal-generator'||building.orientation!==0||building.footprint!=='standard'||building.x<0||building.z<0||building.x+6>world.width||building.z+6>world.height||!geyser||world.structures.some(s=>s!==building&&s.kind==='geothermal-generator'&&s.geothermal?.geyserId===geyser.id))throw Error('Geothermal generator requires its exact unharvested natural geyser');
 return {geyserId:geyser.id,atTick:world.tick,ticksUntilSpray:500,sprayTicksLeft:0};
}

/** One bounded structure pass per physical step, never a geyser search for
 * every actor or substep. The natural owner and its paused timers are retained. */
export function harvestedGeothermalGeyserIds264(world:World):ReadonlySet<number> {
 const ids=new Set<number>();
 for(const s of structureFamily379(world,'geothermal-generators',kind=>kind==='geothermal-generator'))if(s.kind==='geothermal-generator'){
  const state=s.geothermal,g=geothermalGeyser264(world,s);
  if(Number(world.schemaVersion)<264||world.site?.revision!==3||!state||!validGeothermalState264(state,state.atTick,world.nextId)||!g||g.id!==state.geyserId||s.orientation!==0||s.footprint!=='standard'||ids.has(g.id))throw Error('Invalid actual geothermal geyser association');
  ids.add(g.id);
 }
 return ids;
}

/** Called after the ordinary save shape checks. Local-map callers use this
 * same guard with their own clock/geology; packed and terminal owners can never
 * contain this fixed building, even when its phase would otherwise be valid. */
export function validGeothermalWorld264(world:World,version:number=world.schemaVersion):boolean {
 const seen=new Set<number>();
 for(const s of world.structures){
  if(s.kind!=='geothermal-generator'){if(Object.hasOwn(s,'geothermal'))return false;continue;}
  if(!ownsData(s,'geothermal'))return false;
  if(!plain(s.power)||Reflect.ownKeys(s.power).length!==2||!ownsData(s.power,'on')||!ownsData(s.power,'parentId')||typeof s.power.on!=='boolean'||s.power.parentId!==null||Object.hasOwn(s,'battery'))return false;
  const state=s.geothermal,g=geothermalGeyser264(world,s);
  if(version<264||world.site?.revision!==3||s.orientation!==0||s.footprint!=='standard'||s.material!=='steel'||Object.hasOwn(s,'quality')||Object.hasOwn(s,'fuel')||s.x<0||s.z<0||s.x+6>world.width||s.z+6>world.height||!validGeothermalState264(state,world.tick,world.nextId)||!g||g.id!==state.geyserId||seen.has(g.id))return false;
  seen.add(g.id);
 }
 for(const j of world.jobs)if(j.kind==='geothermal-generator'&&(version<264||world.site?.revision!==3||j.material!=='steel'||j.orientation!==0||j.footprint!=='standard'||Object.hasOwn(j,'quality')||Object.hasOwn(j,'fuel')||j.x<0||j.z<0||j.x+6>world.width||j.z+6>world.height||!geothermalGeyser264(world,j))||Object.hasOwn(j,'geothermal')||[j.fixBreakdown,j.deconstruction,j.furniture,j.repair].some(v=>v&&Object.hasOwn(v,'geothermal'))||version<264&&(j.kind==='geothermal-generator'||j.fixBreakdown?.kind==='geothermal-generator'||j.deconstruction?.kind==='geothermal-generator'||j.furniture?.kind==='geothermal-generator'))return false;
 const packed=(records:readonly {building:Structure}[]|undefined):boolean=>(records??[]).every(p=>!Object.hasOwn(p,'geothermal')&&p.building.kind!=='geothermal-generator'&&!Object.hasOwn(p.building,'geothermal'));
 if(!packed(world.packed)||world.group&&'packed' in world.group&&!packed(world.group.packed)||world.groupLosses?.some(l=>!packed(l.packed)))return false;
 for(const records of [world.visitors?.departed??[],world.podRescues?.departed??[]])for(const departure of records)if(!packed(departure.packed))return false;
 for(const j of world.jobs)if(j.kind==='geothermal-generator'&&(Object.hasOwn(j,'power')||Object.hasOwn(j,'battery')))return false;
 const groups=world.worldGroups;
 if(world.worldPawns?.owners.some(o=>!packed(o.packed)))return false;
 if(groups&&(groups.groups.some(g=>'packed' in g.state&&!packed(g.state.packed))||groups.losses.some(l=>!packed(l.packed))||groups.animalLosses?.some(l=>!packed(l.packed))||groups.abandonedPawns.some(p=>!packed(p.packed))||groups.abandonedContents.some(c=>c.humans.some(p=>!packed(p.packed))||c.animals.some(a=>!packed(a.packed)))))return false;
 const campaign=world.campaignMap;
 if(campaign?.revision===2&&(campaign.groups.some(g=>'packed' in g.state&&!packed(g.state.packed))||campaign.groupLosses.some(l=>!packed(l.packed))||campaign.animalLosses?.some(l=>!packed(l.packed))))return false;
 return true;
}
