import type {Pawn,World,WorldEvent} from '../sim/types';
import {isColonist} from '../sim/affiliation';
import {ConfirmedJournalCursor,personalJournalKind,pawnNamePattern,journalPictogram,type JournalPictogram} from '../ui/journal-events';

export const JOURNAL_BUBBLE_LIMITS=Object.freeze({visible:8,pending:80,perPawn:3,durationMs:4500});
export interface PawnJournalNotice {readonly serial:number;readonly pawnId:number;readonly name:string;readonly text:string;readonly icon:JournalPictogram;readonly eventTick:number;readonly expiresAt:number;readonly summarized?:number}
type Pending=Omit<PawnJournalNotice,'expiresAt'>;

/** Transient, confirmed presentation only. The saved bounded journal remains
 * authoritative. Timers use real presentation time, including while paused. */
export class PawnJournalFeedback {
  private readonly cursor=new ConfirmedJournalCursor();
  private visible:PawnJournalNotice[]=[];
  private pending:Pending[]=[];
  private overflow=new Map<number,{notice:Pending;count:number}>();
  private serial=0;private mapKey:string|undefined;private confirmedTick=-Infinity;private enabled=true;private closed=false;
  private published='';
  private nextExpiry=Infinity;
  private timer:ReturnType<typeof setTimeout>|undefined;
  constructor(private readonly changed:(notices:readonly PawnJournalNotice[])=>void,private readonly now:()=>number=()=>performance.now()){}
  setEnabled(enabled:boolean):void{if(this.enabled===enabled)return;this.enabled=enabled;this.clear();}
  private clear():void{if(this.timer!==undefined)clearTimeout(this.timer);this.timer=undefined;this.nextExpiry=Infinity;this.visible=[];this.pending=[];this.overflow.clear();this.cursor.clear();this.publish();}
  private publish():void{const key=this.visible.map(n=>n.serial).join(',');if(key===this.published)return;this.published=key;this.changed(this.visible);}
  adopt(world:World,reset=false,immutableSnapshot=false):void {
    if(this.closed)return;
    const map=world.campaignMap,mapKey=JSON.stringify([world.seed,world.width,world.height,map?.revision===2?map.activeMapId:map?.active??'home']);
    if(reset||this.mapKey!==mapKey||world.tick<this.confirmedTick){this.clear();this.mapKey=mapKey;reset=true;}
    this.confirmedTick=world.tick;
    if(!this.enabled)return;
    const fresh=this.cursor.read(world.events,world.tick,reset,immutableSnapshot).filter(event=>personalJournalKind(event)!==undefined);
    if(!fresh.length&&!this.visible.length&&!this.pending.length&&!this.overflow.size)return;
    // IDs remain the anchors after admission. Names are used only to resolve
    // legacy text events, and a homonym never grants an actor identity.
    const people=new Map(world.pawns.map(p=>[p.id,p]));
    const valid=(notice:Pending)=>{const p=people.get(notice.pawnId);return !!p&&p.name===notice.name&&isColonist(p)&&!p.prisoner&&p.state!=='dead';};
    const before=this.visible.length+this.pending.length+this.overflow.size;
    this.visible=this.visible.filter(valid);this.pending=this.pending.filter(valid);for(const[id,value]of this.overflow)if(!valid(value.notice))this.overflow.delete(id);
    if(!fresh.length){if(before!==this.visible.length+this.pending.length+this.overflow.size)this.pump();return;}
    const names=new Map<string,number>();
    for(const p of world.pawns){const key=p.name.normalize('NFC').toLocaleLowerCase('fr-FR');names.set(key,(names.get(key)??0)+1);}
    const candidates=world.pawns.filter(p=>isColonist(p)&&!p.prisoner&&p.state!=='dead'&&names.get(p.name.normalize('NFC').toLocaleLowerCase('fr-FR'))===1).map(p=>({pawn:p,named:pawnNamePattern(p.name)}));
    for(const event of fresh){
      const matches=candidates.flatMap(candidate=>{const match=candidate.named.exec(event.message);return match?[{pawn:candidate.pawn,at:match.index,end:match.index+match[0].length}]:[];});
      // A short name contained in a longer real name is not another speaker.
      const independent=matches.filter(a=>!matches.some(b=>b!==a&&a.at>=b.at&&a.end<=b.end)).sort((a,b)=>a.at-b.at||a.pawn.id-b.pawn.id);
      const pawn=independent[0]?.pawn;if(pawn)this.enqueue(pawn,event);
    }
    this.pump();
  }
  private enqueue(pawn:Pawn,event:WorldEvent):void {
    const notice:Pending={serial:++this.serial,pawnId:pawn.id,name:pawn.name,text:event.message,icon:journalPictogram(event),eventTick:event.tick};
    if(this.pending.length<JOURNAL_BUBBLE_LIMITS.pending&&this.pending.filter(n=>n.pawnId===pawn.id).length<JOURNAL_BUBBLE_LIMITS.perPawn){this.pending.push(notice);return;}
    const existing=this.overflow.get(pawn.id);if(existing){existing.count++;return;}
    if(this.overflow.size<80)this.overflow.set(pawn.id,{notice,count:1});
    else{const first=this.overflow.values().next().value!;first.count++;}
  }
  private pump():void {
    if(this.closed)return;
    const now=this.now();this.visible=this.visible.filter(notice=>notice.expiresAt>now);
    const owners=new Set(this.visible.map(n=>n.pawnId));
    while(this.visible.length<JOURNAL_BUBBLE_LIMITS.visible){
      let at=this.pending.findIndex(n=>!owners.has(n.pawnId));
      let next:Pending|undefined;
      if(at>=0)next=this.pending.splice(at,1)[0];
      else{const overflow=[...this.overflow.values()].find(value=>!owners.has(value.notice.pawnId));if(overflow){this.overflow.delete(overflow.notice.pawnId);next={...overflow.notice,text:`${overflow.count} autre${overflow.count===1?'':'s'} événement${overflow.count===1?'':'s'} dans le Journal.`,summarized:overflow.count};}}
      if(!next)break;
      owners.add(next.pawnId);this.visible.push({...next,expiresAt:now+JOURNAL_BUBBLE_LIMITS.durationMs});
    }
    this.publish();
    if(this.timer!==undefined)clearTimeout(this.timer);this.timer=undefined;
    this.nextExpiry=this.visible.length?Math.min(...this.visible.map(n=>n.expiresAt)):Infinity;
    if(this.visible.length){const delay=Math.max(1,this.nextExpiry-now);this.timer=setTimeout(()=>{this.timer=undefined;this.pump();},delay);}
  }
  /** One scalar gate handles background-tab timer throttling on return. */
  advance():void{if(this.nextExpiry!==Infinity&&this.now()>=this.nextExpiry)this.pump();}
  snapshot(){return{visible:[...this.visible],pending:this.pending.length,summarized:[...this.overflow.values()].reduce((n,v)=>n+v.count,0),enabled:this.enabled};}
  dispose():void{if(this.closed)return;this.clear();this.closed=true;}
}
