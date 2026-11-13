import {memoryAge271,validSuspendedMemory271} from './suspended-memory-271.ts';
import { DEEP_TALK_DURATION,RECRUITED_ME_DURATION,RECRUITED_ME_OPINION } from './social-state.ts';
import { TICKS_PER_DAY,type World,type Pawn } from './types.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,lo:number,hi=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const interactionKind=(v:unknown,version:number)=>v==='chitchat'||v==='deep-talk'||version>=86&&v==='rapport'||version>=125&&(v==='slight'||v==='insult')||version>=134&&v==='kind-words';
const lastKind=(v:unknown,version:number)=>interactionKind(v,version)||version>=195&&(v==='romance-attempt'||v==='breakup');
const memoryKind=(v:unknown,version:number)=>interactionKind(v,version)||version>=125&&(v==='fight-cathartic'||v==='fight-angering')||version>=319&&v==='recruited-me';
const validOffset=(kind:unknown,offset:unknown):boolean=>typeof offset==='number'&&Number.isFinite(offset)&&(
  kind==='slight'?offset<0&&offset>=-6.850000001:
  kind==='insult'?offset<0&&offset>=-20.550000001:
  kind==='fight-cathartic'?offset===38:
  kind==='fight-angering'?offset===-22:
  kind==='recruited-me'?offset===RECRUITED_ME_OPINION:
  offset>0&&offset<=(kind==='chitchat'?Number.MAX_SAFE_INTEGER:kind==='rapport'?2.740000001:20.550000001));
export function validateHumanSocial(p:Pawn,version:number,tick:number,ids:ReadonlySet<number>,localPawns:readonly Pawn[],civilTick=tick):string[] {
  const errors:string[]=[];
    const s:unknown=p.social;if(s===undefined)return [];
    if(version<70||!object(s)||Object.keys(s).some(k=>!['rng','wants','last','memories',...(version>=125?['fight']:[])].includes(k))||!integer(s.rng,1,0xffffffff)||s.wants!==undefined&&s.wants!==true||!Array.isArray(s.memories)||s.memories.length>(version>=134?2400:version>=125?2100:version>=86?900:600)){errors.push('Invalid social state.');return errors;}
    const other=(id:unknown)=>integer(id,1)&&id!==p.id&&ids.has(id);
    const l=s.last;if(l!==undefined&&(!object(l)||Object.keys(l).some(k=>!['otherId','kind','tick','initiated'].includes(k))||!other(l.otherId)||!lastKind(l.kind,version)||!integer(l.tick,0,tick)||typeof l.initiated!=='boolean'))errors.push('Invalid last interaction.');
    const fight=s.fight;
    if(fight!==undefined){
      if(version<125||!object(fight)||Object.keys(fight).some(k=>!['opponentId','startedAt'].includes(k))||!other(fight.opponentId)||!integer(fight.startedAt,0,tick))errors.push('Invalid social fight.');
      else {
        const opponent=localPawns.find(q=>q.id===fight.opponentId),reply=opponent?.social?.fight;
        if(!reply||reply.opponentId!==p.id||reply.startedAt!==fight.startedAt)errors.push('Non-reciprocal social fight.');
      }
    }
    const counts=new Map<string,number>();let chats=0,deep=0,rapport=0,kindWords=0,slight=0,insult=0,cathartic=0,angering=0;
    for(const m of s.memories){
      if(!object(m)||Object.keys(m).some(k=>!['otherId','kind','at','offset','suspendedTicks'].includes(k))||!validSuspendedMemory271(m,version,tick,Number(m.at))||!other(m.otherId)||!memoryKind(m.kind,version)||!integer(m.at,0,civilTick)||!validOffset(m.kind,m.offset)||memoryAge271(m,m.at,tick)>=(m.kind==='chitchat'?TICKS_PER_DAY:m.kind==='recruited-me'?RECRUITED_ME_DURATION:DEEP_TALK_DURATION)){errors.push('Invalid social memory.');continue;}
      const key=`${m.otherId}:${m.kind}`,count=(counts.get(key)??0)+1;counts.set(key,count);
      if(count>(m.kind==='chitchat'||m.kind==='recruited-me'?1:m.kind==='rapport'?50:m.kind==='fight-cathartic'||m.kind==='fight-angering'?5:10))errors.push('Too many social memories for one person.');
      if(m.kind==='chitchat')chats++;else if(m.kind==='rapport')rapport++;else if(m.kind==='kind-words')kindWords++;else if(m.kind==='slight')slight++;else if(m.kind==='insult')insult++;else if(m.kind==='fight-cathartic')cathartic++;else if(m.kind==='fight-angering')angering++;else deep++;
    }
    if(chats>300||deep>300||rapport>300||kindWords>300||slight>300||insult>300||cathartic>300||angering>300)errors.push('Too many social memories of one kind.');

  return errors;
}
export function validateSocial(world:World,version:number,knownIds:ReadonlySet<number>=new Set(world.pawns.map(p=>p.id))):string[] {
  return world.pawns.flatMap(p=>validateHumanSocial(p,version,world.tick,knownIds,world.pawns));
}
