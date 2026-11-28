import { FLU_CHECK_INTERVAL,fluFirstCheck382 } from './flu-incidents.ts';
import type { World } from './types.ts';

const object=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min:number,max=Number.MAX_SAFE_INTEGER):value is number=>
  Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;

/** Earlier schemas cannot smuggle in future incidents; every V127
 * Crashlanded profile carries its own strictly prospective disease clock. */
export function validFluIncidents(world:World,version:number):boolean {
  const raw:unknown=world.fluIncidents;
  // Schema 347: the Tutor has no disease comp; the clock is born at its handover.
  if(version<127||!world.gameProfile||world.gameProfile.storyteller==='tutor')return raw===undefined;
  const first=fluFirstCheck382(world);
  if(!object(raw)||Object.keys(raw).length!==(Object.hasOwn(raw,'immuneDiseases')?8:7)||!Object.keys(raw).every(key=>
    ['profile','rng','nextCheck','checks','fluDraws','episodes','cases',...(version>=207?['immuneDiseases']:[])].includes(key)))return false;
  if(Object.hasOwn(raw,'immuneDiseases')){
    const extension=raw.immuneDiseases;
    if(version<207||!object(extension)||Object.keys(extension).length!==5||!Object.keys(extension).every(key=>
      ['adoptedAt','rng','draws','episodes','cases'].includes(key))||!integer(extension.adoptedAt,1,world.tick)
      ||!integer(extension.rng,1,0xffffffff))return false;
    const opportunities=Math.max(0,Math.floor((world.tick-Math.max(first,
      Math.ceil(extension.adoptedAt/FLU_CHECK_INTERVAL)*FLU_CHECK_INTERVAL))/FLU_CHECK_INTERVAL)+1);
    if(!integer(extension.draws,0,Math.min(Number(raw.checks),opportunities))
      ||!integer(extension.episodes,0,extension.draws)||!integer(extension.cases,extension.episodes)
      ||extension.episodes===0&&extension.cases!==0)return false;
  }
  const next=Math.max(first,(Math.floor(world.tick/FLU_CHECK_INTERVAL)+1)*FLU_CHECK_INTERVAL);
  return raw.profile==='cassandra-flu-v1'&&integer(raw.rng,1,0xffffffff)
    &&integer(raw.nextCheck,next,next)&&integer(raw.checks,0,Math.max(0,Math.floor((world.tick-first)/FLU_CHECK_INTERVAL)+1))
    &&integer(raw.fluDraws,0,Number(raw.checks))&&integer(raw.episodes,0,Number(raw.fluDraws))
    &&integer(raw.cases,Number(raw.episodes));
}
