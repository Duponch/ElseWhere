import {caveLightSources256} from './cave-flora-256.ts';
import { isPowerActive } from './power-rules.ts';
import { SUN_LAMP_RADIUS,SUN_LAMP_OVERLIGHT_RADIUS,sunLampActive } from './sun-lamp.ts';
import type { Structure, World } from './types.ts';
import { peekStructureMembershipToken } from './structure-navigation.ts';

export interface LightSource {cell:number;radius:number;red:number;green:number;blue:number;overlightRadius?:number}

/** Core 1.6.4871 glower channels. Warm sources share a red maximum, allowing
 * the scalar fast path; the powered machining table is blue-dominant. */
const memberKinds=new Set<Structure['kind']>(['glow-pod','torch-lamp','campfire','electric-crematorium','electric-smelter','wood-generator','chemfuel-generator','standing-lamp','sun-lamp','machining-table']);
export const isStructureLightMember=(kind:Structure['kind']):boolean=>memberKinds.has(kind);
/** Same predicates and stable source ordering, with already selected members. */
function structureLightSources(world:World,members:readonly Structure[]):LightSource[] {
  return members.flatMap(s=>{
    const cell=s.z*world.width+s.x;
    if(s.kind==='glow-pod')return [{cell,radius:6,red:113,green:141,blue:117}];
    if(s.kind==='torch-lamp'&&s.fuel?.ticks)return [{cell,radius:10,red:184,green:136,blue:83}];
    if(s.kind==='campfire'&&s.fuel?.ticks)return [{cell,radius:10,red:252,green:187,blue:113}];
    if(s.kind==='electric-crematorium'&&isPowerActive(s))return [{cell,radius:6,red:217,green:112,blue:33}];
    if(s.kind==='electric-smelter'&&isPowerActive(s))return [{cell,radius:6,red:217,green:112,blue:33}];
    if(s.kind==='wood-generator'&&isPowerActive(s))return [{cell,radius:6,red:217,green:112,blue:33}];
    if(s.kind==='chemfuel-generator'&&isPowerActive(s))return [{cell,radius:6,red:80,green:112,blue:180}];
    if(s.kind==='standing-lamp'&&isPowerActive(s))return [{cell,radius:12,red:214,green:148,blue:94}];
    if(s.kind==='sun-lamp'&&sunLampActive(world,s))return [{cell,radius:SUN_LAMP_RADIUS,red:370,green:370,blue:370,overlightRadius:SUN_LAMP_OVERLIGHT_RADIUS}];
    if(s.kind==='machining-table'&&isPowerActive(s))return [{cell,radius:5,red:73,green:123,blue:138}];
    return [];
  });
}
export function lightSourcesFromMembers(world:World,members:readonly Structure[],caves:readonly LightSource[]):LightSource[] {return structureLightSources(world,members).concat([...caves]).sort((a,b)=>a.cell-b.cell);}
/* Light member structures in source order, cached by the shared structure
 * membership token (kinds/positions are immutable). Activity (fuel, power,
 * sun lamp state) is still evaluated live on every call. Non-member kinds
 * contribute no source, so the result is identical to scanning every
 * structure, including the stable order of equal cells after sorting. */
const membersByToken=new WeakMap<object,readonly Structure[]>();
function lightMembers(world:World):readonly Structure[] {
  // Only an existing index is used (see peekStructureMembershipToken).
  const token=peekStructureMembershipToken(world);if(!token)return world.structures.filter(s=>memberKinds.has(s.kind));
  let members=membersByToken.get(token);
  if(!members){members=world.structures.filter(s=>memberKinds.has(s.kind));membersByToken.set(token,members);}
  return members;
}
export function lightSources(world:World,includeCavePlants=true):LightSource[] {return structureLightSources(world,lightMembers(world)).concat(includeCavePlants?[...caveLightSources256(world)]:[]).sort((a,b)=>a.cell-b.cell);}
