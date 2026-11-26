import type {TravelFrameWitness} from './harvest-assertions';

/** Prove a contact approach or stationary pose hands off to one confirmed edge
 * at that edge's exact start. The submitted-frame qualification uses this
 * independent proof; the historical confirmedTravelExcess stays unchanged.
 * No gameplay reader is used: both GPU curves, their observed positions,
 * clocks, junction and total arc must independently agree. */
export function confirmedContactDepartureDiagnostic(previous:TravelFrameWitness,current:TravelFrameWitness,dt:number):boolean {
 const finite=Number.isFinite,cell=(v:{x:number;z:number}|undefined)=>!!v&&finite(v.x)&&finite(v.z);
 const witness=(v:TravelFrameWitness|undefined)=>!!v&&cell(v.position)&&cell(v.from)&&cell(v.to)&&finite(v.start)&&finite(v.end)&&finite(v.time)&&finite(v.play)
  &&v.segment&&cell(v.segment.from)&&cell(v.segment.to)&&finite(v.segment.start)&&finite(v.segment.end);
 if(!witness(previous)||!witness(current)||!finite(dt)||dt<=0||dt>=100)return false;
 const p=previous,c=current,a=p.segment,b=c.segment;
 const distance=Math.hypot(c.position.x-p.position.x,c.position.z-p.position.z);
 if(distance<=dt*.013+.02)return false;
 for(const s of [a,b])if(!Number.isInteger(s.from.x)||!Number.isInteger(s.from.z)||!Number.isInteger(s.to.x)||!Number.isInteger(s.to.z)
  ||Math.max(Math.abs(s.to.x-s.from.x),Math.abs(s.to.z-s.from.z))!==1||s.end<=s.start)return false;
 // A completed grid edge, an intervening contact pose, then a departure from
 // precisely the same cell; no missing movement edge is filled in.
 if(a.end>=p.play||a.to.x!==b.from.x||a.to.z!==b.from.z||b.start<=p.play||b.start>c.play||c.play>b.end)return false;
 const EPS_POSITION=.0002,EPS_SECONDS=.0001,EPS_TICKS=.0006,ROUND_SECONDS=.000008;
 const apart=(u:{x:number;z:number},v:{x:number;z:number})=>Math.hypot(u.x-v.x,u.z-v.z);
 if(apart(p.from,a.to)>.30||apart(p.to,a.to)>.30||apart(c.from,b.from)>.30||apart(c.to,b.to)>.30)return false;
 // PawnLayer's own contact approach lasts .24 local seconds. A leg with a
 // different duration or clock cannot borrow this departure proof.
 const stationary=p.start===0&&p.end===0;
 if(stationary&&(apart(p.from,p.to)>EPS_POSITION||apart(p.from,p.position)>EPS_POSITION||apart(p.to,p.position)>EPS_POSITION||apart(c.from,p.position)>EPS_POSITION))return false;
 if(!stationary&&(p.end<=p.start||Math.abs(p.end-p.start-.24)>EPS_SECONDS)||c.end<=c.start||Math.abs(c.end-c.start-(b.end-b.start)/6)>EPS_SECONDS)return false;
 if(!stationary&&(p.time<p.start-ROUND_SECONDS||p.time>p.end+ROUND_SECONDS)||c.time<c.start-ROUND_SECONDS||c.time>c.end+ROUND_SECONDS)return false;
 const ticks=c.play-p.play,seconds=c.time-p.time;
 if(ticks<=0||seconds<=0||Math.abs(seconds-ticks/6)>EPS_SECONDS||ticks>dt*.036+EPS_TICKS||seconds>dt*.006+EPS_SECONDS)return false;
 const departure=p.time+(b.start-p.play)/6;
 if(Math.abs(departure-c.start)>ROUND_SECONDS||departure<p.time||!stationary&&(departure<p.start-ROUND_SECONDS||departure>p.end+ROUND_SECONDS))return false;
 const alpha=(time:number,start:number,end:number)=>Math.min(1,Math.max(0,(time-start)/(end-start)));
 const at=(frame:TravelFrameWitness,fraction:number)=>({x:frame.from.x+(frame.to.x-frame.from.x)*fraction,z:frame.from.z+(frame.to.z-frame.from.z)*fraction});
 const before=stationary?0:alpha(p.time,p.start,p.end),junction=stationary?0:alpha(departure,p.start,p.end),after=alpha(c.time,c.start,c.end);
 if(Math.abs(after-(c.play-b.start)/(b.end-b.start))>.0002||apart(p.position,at(p,before))>EPS_POSITION||apart(c.position,at(c,after))>EPS_POSITION)return false;
 if(apart(c.from,at(p,junction))>EPS_POSITION)return false;
 const arc=(junction-before)*apart(p.from,p.to)+after*apart(c.from,c.to);
 return junction>=before&&distance<=arc+2*EPS_POSITION;
}
