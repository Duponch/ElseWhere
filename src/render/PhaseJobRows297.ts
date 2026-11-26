import type {Job,World} from '../sim/types';
import type {CoreHumanPose297} from '../bridge/core-phase-projection-297';

interface Entry {order:number;job:Job|null}
interface Winner {first:number;job:Job}
export interface PhaseJobRowsView297 {readonly rows:World['jobs'];readonly byId:ReadonlyMap<number,Job>}

/** The actual frontier pose journal owns job replacements. Preserve the Full
 * order, last pose wins duplicate job overrides, and append new jobs in the
 * order of the first referencing pose, exactly like historical posedWorld.
 * Old array endpoints stay intact; this lookup is used only synchronously
 * during the latest phase application. */
export class PhaseJobRows297 {
 private base:World|undefined;
 private rows:World['jobs']=[];
 private readonly byId=new Map<number,Job>();
 private readonly originals=new Map<number,number>();
 private readonly ordinals=new Map<number,number>();
 private readonly entries=new Map<number,Entry>();
 private readonly members=new Map<number,Map<number,Entry>>();
 private readonly winners=new Map<number,Winner>();
 private readonly counts={changedOwners:0,changedJobs:0,rebuilds:0,clones:0,reused:0};
 metrics(){return {...this.counts};}
 clear():void {this.base=undefined;this.rows=[];this.byId.clear();this.originals.clear();this.ordinals.clear();this.entries.clear();this.members.clear();this.winners.clear();}
 read(base:World,poses:ReadonlyMap<number,CoreHumanPose297>,changes:ReadonlyMap<number,CoreHumanPose297>):PhaseJobRowsView297|undefined{
  if(this.base!==base){this.clear();this.base=base;this.rows=base.jobs;
   for(let i=0;i<base.jobs.length;i++){const j=base.jobs[i]!;if(this.originals.has(j.id)){this.clear();return;}this.originals.set(j.id,i);this.ordinals.set(j.id,i);this.byId.set(j.id,j);}
   changes=poses;
  }
  const affected=new Set<number>();
  for(const [id,pose]of changes){
   const job=pose.job as Job|null,prior=this.entries.get(id);
   if(prior?.job===job)continue;
   this.counts.changedOwners++;
   if(prior?.job){const previous=this.members.get(prior.job.id)!;previous.delete(id);if(!previous.size)this.members.delete(prior.job.id);affected.add(prior.job.id);}
   const entry={order:prior?.order??this.entries.size,job};this.entries.set(id,entry);
   if(job){let next=this.members.get(job.id);if(!next){next=new Map();this.members.set(job.id,next);}next.set(id,entry);affected.add(job.id);}
  }
  const writes=new Map<number,Job>();let rebuild=false;
  for(const id of affected){
   const before=this.winners.get(id);let first=Infinity,last=-1,job:Job|undefined;
   for(const member of this.members.get(id)?.values()??[]){first=Math.min(first,member.order);if(member.order>last){last=member.order;job=member.job!;}}
   if(job)this.winners.set(id,{first,job});else this.winners.delete(id);
   const original=this.originals.get(id),next=job??(original===undefined?undefined:base.jobs[original]);
   if(original===undefined&&(!before!==!job||before&&job&&before.first!==first))rebuild=true;
   if(next!==this.byId.get(id)){this.counts.changedJobs++;if(next){this.byId.set(id,next);writes.set(id,next);}else this.byId.delete(id);}
  }
  if(rebuild){
   this.counts.rebuilds++;this.rows=base.jobs.map(j=>this.byId.get(j.id)!);this.ordinals.clear();for(const[id,i]of this.originals)this.ordinals.set(id,i);
   const extras=[...this.winners].filter(([id])=>!this.originals.has(id)).sort((a,b)=>a[1].first-b[1].first);
   for(const[id,entry]of extras){this.ordinals.set(id,this.rows.length);this.rows.push(entry.job);}
  }else if(writes.size){this.counts.clones++;const rows=this.rows.slice();for(const[id,job]of writes){const at=this.ordinals.get(id);if(at===undefined){this.clear();return;}rows[at]=job;}this.rows=rows;}
  else this.counts.reused++;
  return {rows:this.rows,byId:this.byId};
 }
}
