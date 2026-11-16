import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import type { World } from './types.ts';

const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const dataKeys=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[]):boolean=>
  required.every(k=>Object.hasOwn(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k))&&Object.getOwnPropertyDescriptor(v,k)!.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const coreTick=(v:unknown):boolean=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
/** Schema 347 tutorial record: Core ticks only, each mark at most once;
 * `ended` says whether the ChooseStoryteller handover happened. */
export function validTutorialState347(value:unknown,ended:boolean,tick?:number):boolean {
  if(!record(value)||!dataKeys(value,['revision'],['potatoesAtCore','steelLumpAtCore','raidAtCore','endedAtCore'])||value.revision!==1)return false;
  const limit=tick===undefined?Number.MAX_SAFE_INTEGER:tick*10+9;
  for(const key of ['potatoesAtCore','steelLumpAtCore','raidAtCore','endedAtCore'] as const)if(Object.hasOwn(value,key)&&(!coreTick(value[key])||Number(value[key])>limit))return false;
  return ended===Object.hasOwn(value,'endedAtCore');
}
/** Do not infer current choices from an old scenario's name or possessions. */
export function validGameProfile(value:unknown,version:number,scenario:unknown,expedition=false,nonStartingSettlement=false,tick?:number):boolean {
  if(value===undefined)return !record(scenario)||scenario.id!=='crashlanded';
  // The campaign difficulty is shared. A true later geographic settlement has
  // no replayed arrival scenario; its actual birth/registry supplies this fact.
  const later=version>=259&&nonStartingSettlement&&scenario===undefined;
  if(version<82||!record(value)||!(expedition&&version>=240)&&!later&&(!record(scenario)||scenario.id!=='crashlanded'))return false;
  if(value.revision!==1||value.saveMode!=='reloadable'||version<347&&Object.hasOwn(value,'tutorial347'))return false;
  // Schema 347: the Core tutorial profile, then the same game after its
  // handover to Cassandra. Older saves only ever had the normal profile.
  if(version>=347&&Object.hasOwn(value,'tutorial347')){
    if(!dataKeys(value,['revision','storyteller','difficulty','saveMode','tutorial347']))return false;
    const tutor=value.storyteller==='tutor'&&value.difficulty==='community-builder',handed=value.storyteller==='cassandra-partial'&&value.difficulty==='adventure-story';
    return (tutor||handed)&&validTutorialState347(value.tutorial347,handed,tick);
  }
  return Object.keys(value).length===4&&Object.keys(value).every(k=>['revision','storyteller','difficulty','saveMode'].includes(k))&&
    value.storyteller==='cassandra-partial'&&value.difficulty==='adventure-story';
}
export function validateGameProfile(world:World,temporaryTarget263=false):string[] {
  if(temporaryTarget263&&isSchema263OrLater(Number(world.schemaVersion)))return [];
  if(!world.gameProfile||world.expeditionSite&&world.schemaVersion>=240)return [];
  const tutorial=world.gameProfile.tutorial347;
  if(tutorial&&!validTutorialState347(tutorial,world.gameProfile.storyteller!=='tutor',world.tick))return ['Invalid or future tutorial record.'];
  // The Tutor has no storyteller comps: no calendar of its incidents exists
  // before the handover (the raid calendar stays, silent, for the tutor raid).
  if(world.gameProfile.storyteller==='tutor'&&(['fluIncidents','miscIncidents','smallIncidents','visitors','quests','podRescues'] as const).some(k=>world[k]!==undefined))return ['The Tutor storyteller has no incident calendar.'];
  return world.arrivals!==undefined||world.heatwaves!==undefined||world.raids?.profile!=='cassandra-raids-v1'?['Core creation profile must retain its own incident calendar.']:[];
}
