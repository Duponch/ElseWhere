import type { MedicalRecord } from './injury-types.ts';
import { IMMUNE_DISEASE_KINDS } from './immune-diseases-types.ts';
import { IMMUNE_DISEASE_UNIT,IMMUNE_DISEASE_TEND_OVERLAP_CORE,immuneDiseaseTendCore } from './immune-diseases-rules.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));

/** Human records only. Residual immunity and an already admitted malaria
 * vomiting episode remain valid after severity reaches zero. */
export function validImmuneDiseases(value:unknown,record:MedicalRecord,version:number):boolean {
  if(value===undefined)return true;
  if(version<207||record.body||!object(value)||!Object.keys(value).length||!keys(value,IMMUNE_DISEASE_KINDS.filter(kind=>kind!=='sleeping-sickness'||version>=309)))return false;
  for(const kind of Object.keys(value) as (typeof IMMUNE_DISEASE_KINDS[number])[]){
    const state=value[kind];
    if(!object(state)||!keys(state,['bornAt','severity','immunity','luck','tend',...(kind==='malaria'?['vomit']:[])])
      ||!integer(state.bornAt,0,record.tick)||!integer(state.severity,0,IMMUNE_DISEASE_UNIT)
      ||!integer(state.immunity,0,IMMUNE_DISEASE_UNIT)||!integer(state.luck,800_000,1_200_000)
      ||!state.severity&&!state.immunity&&!state.vomit)return false;
    const tend=state.tend;
    if(tend!==undefined&&(!state.severity||!object(tend)||!keys(tend,['quality','expiresAtCore'])
      ||!integer(tend.quality,0,1300)||!integer(tend.expiresAtCore,state.bornAt*10+immuneDiseaseTendCore(kind),
        record.tick*10+immuneDiseaseTendCore(kind)+IMMUNE_DISEASE_TEND_OVERLAP_CORE-1)))return false;
    const vomit=state.vomit;
    if(vomit!==undefined&&(!object(vomit)||!keys(vomit,['remainingCore','cell'])||!integer(vomit.remainingCore,1,899)
      ||!object(vomit.cell)||!keys(vomit.cell,['x','z'])||!integer(vomit.cell.x)||!integer(vomit.cell.z)))return false;
  }
  return true;
}
