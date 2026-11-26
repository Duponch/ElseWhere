import { workPriority } from './work-types.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import { cancelShooting } from './shooting-state.ts';
import type { Pawn,World } from './types.ts';

export interface HuntingTask {animalId:number;startedAt:number;phase:'stalk'|'finish'|'collect';progress:number;forced378?:true}
export type HuntingCommand={type:'hunt';animalId:number;enabled:boolean};
export function huntingPermission(w:World,p:Pawn,targetId:number):boolean {
  return !!p.hunting&&p.hunting.animalId===targetId&&p.hunting.phase==='stalk'&&!p.draft
    &&(workPriority(p,'hunt')>0||p.hunting.forced378===true&&!backgroundWorkRefusal(p,'hunt'))
    &&!!w.hunting?.targets.includes(targetId)&&!!w.wildlife?.animals.some(a=>a.id===targetId&&!a.domestic&&!['dead','downed'].includes(a.state));
}
export function cancelHunting(p:Pawn):void {
  if(p.shooting?.order?.hunt)cancelShooting(p);
  delete p.hunting;
}
