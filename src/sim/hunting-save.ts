import { equippedWeapon } from './equipment-rules.ts';
import { isColonist } from './affiliation.ts';
import {animalClaimed} from './animal-rest-state.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import type { World } from './types.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
export function validHuntingTask(v:unknown,version:number,tick:number):boolean {
  return v===undefined||version>=79&&object(v)&&keys(v,['animalId','startedAt','phase','progress',...(version>=378?['forced378']:[])])
    &&(!Object.hasOwn(v,'forced378')||version>=378&&v.forced378===true)&&int(v.animalId,1)&&int(v.startedAt,0,tick)
    &&['stalk','finish','collect'].includes(String(v.phase))&&int(v.progress,0,18)&&(v.phase==='finish'||v.progress===0);
}
export function validateHunting(w:World,version:number):string[] {
  const errors:string[]=[],h=w.hunting,b=w.butchery,claimed=new Set<number>();
  if(h!==undefined&&!(version>=79&&object(h)&&keys(h,['targets','completed'])&&int(h.completed)&&Array.isArray(h.targets)&&h.targets.length<=256
    &&h.targets.every((id,i,a)=>int(id,1)&&(!i||a[i-1]!<id)&&(w.wildlife?.animals.some(x=>x.id===id)||w.piles.some(x=>x.id===id&&x.kind==='corpse')))))errors.push('Invalid hunting designations.');
  if(b!==undefined&&!(version>=79&&object(b)&&keys(b,['completed','meat','leather'])&&int(b.completed)&&int(b.meat)&&int(b.leather)))errors.push('Invalid butchery ledger.');
  if(errors.length)return errors;
  for(const p of w.pawns){
    if(version>=79?!int(p.priorities.hunt,0,4):(p.priorities as any).hunt!==undefined)errors.push('Invalid hunting priority for schema.');
    const t=p.hunting;if(!validHuntingTask(t,version,w.tick)){errors.push('Invalid hunting task.');continue;}if(!t)continue;
    if(!isColonist(p)||p.priorities.hunt===0&&!(version>=378&&t.forced378===true&&!backgroundWorkRefusal(p,'hunt'))||p.draft||p.mental?.crisis||p.need||p.haul||p.cooking||p.research||p.ward||p.feed||p.tend||p.rescue||p.equipmentTask||p.jobId!==null||p.melee||p.flee||p.recreation.task||p.orders.active!==null||['dead','downed','sleeping','eating','resting','recreating'].includes(p.state)||!equippedWeapon(w,p))errors.push('Hunting conflicts with another activity.');
    const a=w.wildlife?.animals.find(a=>a.id===t.animalId),corpse=w.piles.find(i=>i.id===t.animalId&&i.kind==='corpse');
    if(claimed.has(t.animalId)||!a&&!corpse||t.phase!=='collect'&&!h?.targets.includes(t.animalId)||t.phase==='collect'&&a?.state!=='dead'&&!corpse)errors.push('Invalid hunted owner or target.');
    if(version>=378&&animalClaimed(w,t.animalId,p.id))errors.push('Hunted animal conflicts with another service owner.');
    if(t.phase==='finish'&&(a?.state!=='downed'&&a?.state!=='dead'||p.path.length||p.moveCooldown>0||(a?.motion?.end??0)>w.tick))errors.push('Invalid hunting finish.');
    if(p.shooting?.order&&!p.shooting.order.hunt)errors.push('Hunter owns another shooting order.');
    claimed.add(t.animalId);
  }
  return errors;
}
