import type {World} from '../sim/types';
import type {PresentationSegment} from '../sim/travel-timing';

const ownedWorlds=new WeakSet<World>();
/** Called only by the closed MAIN factory's adoption boundary. Merely frozen
 * objects and public/mutable renderer inputs do not acquire this authority. */
export function ownActorPlaybackWorld435(world:World,owned:boolean):void{if(owned)ownedWorlds.add(world);else ownedWorlds.delete(world);}
export function isActorPlaybackWorld435(world:World|undefined):boolean{return!!world&&ownedWorlds.has(world);}

type Cursor={segments:readonly PresentationSegment[];index:number;tick:number};
/** Confirmed track selection is shared with endpoint publication, not a new
 * movement simulation. Replacing/trimming/correcting a track revokes its old
 * cursor. Public mutable callers retain the original linear read. */
export class ConfirmedTrackCursor435 {
 private readonly cursors=new Map<number,Cursor>();
 enabled=false;generation=0;
 readonly stats={reads:0,steps:0,restarts:0,configurations:0};
 configure(enabled:boolean,reset:boolean):void{if(reset||enabled!==this.enabled){this.cursors.clear();this.generation++;}this.enabled=enabled;this.stats.configurations++;}
 segment(tracks:ReadonlyMap<number,readonly PresentationSegment[]>,id:number,tick:number):PresentationSegment|undefined{
  this.stats.reads++;const segments=tracks.get(id);if(!segments?.length){this.cursors.delete(id);return;}
  if(!this.enabled){let current:PresentationSegment|undefined;for(const segment of segments){if(segment.start>tick)break;current=segment;}return current;}
  let cursor=this.cursors.get(id);if(!cursor||cursor.segments!==segments||tick<cursor.tick){cursor={segments,index:-1,tick};this.cursors.set(id,cursor);this.stats.restarts++;}
  while(cursor.index+1<segments.length&&segments[cursor.index+1]!.start<=tick){cursor.index++;this.stats.steps++;}cursor.tick=tick;
  return cursor.index<0?undefined:segments[cursor.index];
 }
 boundary(tracks:ReadonlyMap<number,readonly PresentationSegment[]>,id:number,tick:number):{edge:PresentationSegment|undefined;next:number}{
  const edge=this.segment(tracks,id,tick),cursor=this.cursors.get(id),segments=tracks.get(id);
  return{edge,next:segments&&cursor?segments[cursor.index+1]?.start??Infinity:Infinity};
 }
}

export interface ActorTimeline435 {
 readonly playbackEnabled435:boolean;
 readonly playbackGeneration435:number;
 playbackSegment435(id:number):PresentationSegment|undefined;
 readonly playbackOwned435?:boolean;
 readonly playbackRevision435?:number;
 playbackChanged435?(after:number):readonly number[]|undefined;
 playbackBoundary435?(id:number):{edge:PresentationSegment|undefined;next:number};
}
type ActorSource={id:number;motion?:PresentationSegment|null};
export interface PreparedActor435 {
 id:number;fallback:PresentationSegment|undefined;dependent:boolean;dirty:boolean;
 edge:PresentationSegment|undefined;phase:number;origin:number;generation:number;timeline:ActorTimeline435|undefined;
 committedEdge:PresentationSegment|undefined;committedPhase:number;committedOrigin:number;committedGeneration:number;committedTimeline:ActorTimeline435|undefined;
}

/** One resident slot per adopted actor. World-derived state/keys are evaluated
 * only on adoption or actual confirmed edge/phase/origin changes. Continuous
 * translation, turn/approach/recoil curves and existing animation sampling stay
 * on their original clocks and GPU streams. Carrier-dependent records remain
 * native on every frame; no unproved dependency equality is inferred. */
export class ActorPlayback435<A extends ActorSource> {
 private world:World|undefined;
 private source:readonly A[]|undefined;
 private slots:PreparedActor435[]=[];
 private pending:PreparedActor435[]=[];
 private owned=false;
 private readonly indices435=new Map<number,number>();
 private readonly ready435=new Set<number>();
 private readonly dependents435=new Set<number>();
 private readonly boundaries435=new PlaybackBoundaryHeap435();
 private readonly serial435:number[]=[];
 private readonly nextBoundary435:number[]=[];
 private scheduleTimeline435:ActorTimeline435|undefined;
 private scheduleGeneration435=-1;
 private scheduleRevision435=-1;
 private scheduleOrigin435=NaN;
 private scheduleTick435=-Infinity;
 private scheduleReset435=true;
 private scheduleOpen435=false;
 private scheduleActive435=false;
 retrying=false;
 readonly stats={adoptions:0,preparedActors:0,frames:0,visits:0,skips:0,dependentVisits:0,commits:0,retries:0,scheduledFrames:0,scheduledActors:0,boundaryWakes:0};
 constructor(private readonly dependent:(actor:A,index:number)=>boolean=()=>false,private readonly fallbackMotion=true){}
 prepare(world:World,actors:readonly A[],reset=false):void{
  const owned=isActorPlaybackWorld435(world);if(!reset&&this.world===world&&this.source===actors&&this.owned===owned)return;
  const stableRoster=owned&&this.owned&&this.slots.length===actors.length&&actors.every((actor,index)=>this.slots[index]!.id===actor.id);
  this.world=world;this.source=actors;this.owned=owned;this.pending.length=0;this.retrying=false;
  this.scheduleReset435=true;this.ready435.clear();this.dependents435.clear();this.boundaries435.clear();this.nextBoundary435.length=0;
  if(stableRoster){
   // Rebase all playback/spring inputs exactly as the complete prepare. The
   // ordered IDs themselves were checked and own the same resident slots.
   for(let index=0;index<actors.length;index++){const actor=actors[index]!,row=this.slots[index]!;row.fallback=this.fallbackMotion?actor.motion??undefined:undefined;row.dependent=this.dependent(actor,index);row.dirty=true;this.ready435.add(index);if(row.dependent)this.dependents435.add(index);}
   this.stats.adoptions++;this.stats.preparedActors+=actors.length;return;
  }
  this.indices435.clear();if(!owned){this.slots=[];return;}
  const previous=new Map(this.slots.map(slot=>[slot.id,slot]));
  this.slots=actors.map((actor,index)=>{const row=previous.get(actor.id)??{id:actor.id,fallback:undefined,dependent:false,dirty:true,edge:undefined,phase:-1,origin:NaN,generation:-1,timeline:undefined,committedEdge:undefined,committedPhase:-1,committedOrigin:NaN,committedGeneration:-1,committedTimeline:undefined};row.fallback=this.fallbackMotion?actor.motion??undefined:undefined;row.dependent=this.dependent(actor,index);row.dirty=true;return row;});
  this.slots.forEach((row,index)=>{this.indices435.set(row.id,index);this.ready435.add(index);if(row.dependent)this.dependents435.add(index);});
  this.stats.adoptions++;this.stats.preparedActors+=actors.length;
 }
 /** Anchored membership is unchanged; only listed slots become dirty. This is
  * called after the private Native projection has reached its playhead. */
 adoptPhase297(world:World,actors:readonly A[],indices:readonly number[]):void{
  if(!actors.length&&!this.slots.length){this.world=world;this.source=actors;return;}
  if(!this.owned||!isActorPlaybackWorld435(world)||this.slots.length!==actors.length)throw Error('Phase actor layout is not resident');
  for(const index of indices){const row=this.slots[index],actor=actors[index];if(!row||!actor||row.id!==actor.id)throw Error('Phase actor slot changed membership');}
  this.world=world;this.source=actors;
  for(const index of indices){const row=this.slots[index]!,actor=actors[index]!;row.fallback=this.fallbackMotion?actor.motion??undefined:undefined;row.dependent=this.dependent(actor,index);row.dirty=true;this.ready435.add(index);if(row.dependent)this.dependents435.add(index);else this.dependents435.delete(index);}
  this.stats.adoptions++;this.stats.preparedActors+=indices.length;
 }
 beginFrame(timeline:ActorTimeline435|undefined):boolean{
  this.retrying=this.pending.length>0||this.scheduleOpen435;if(this.retrying){for(const row of this.pending)row.dirty=true;this.pending.length=0;this.scheduleReset435=true;this.scheduleOpen435=false;this.stats.retries++;}
  const enabled=this.owned&&(!timeline||timeline.playbackEnabled435);if(enabled)this.stats.frames++;return enabled;
 }
 /** O(changes + crossed boundaries + carrier dependencies). Only the closed
  * timeline can supply this list. An escaped public Map or mutable history
  * immediately restores the original per-actor path, including absent tracks. */
 frameIndices435(timeline:ActorTimeline435|undefined,tick:number,origin:number):readonly number[]|undefined{
  this.scheduleActive435=false;
  if(!this.owned||!timeline?.playbackOwned435||!timeline.playbackBoundary435||!timeline.playbackChanged435||!Number.isFinite(tick)||!Number.isFinite(origin)){this.scheduleReset435=true;return;}
  const generation=timeline.playbackGeneration435,revision=timeline.playbackRevision435??0;
  const changes=timeline.playbackChanged435(this.scheduleRevision435);
  const reset=this.scheduleReset435||timeline!==this.scheduleTimeline435||generation!==this.scheduleGeneration435||origin!==this.scheduleOrigin435||tick<this.scheduleTick435||changes===undefined;
  if(reset){this.boundaries435.clear();this.nextBoundary435.length=0;for(let i=0;i<this.slots.length;i++)this.ready435.add(i);}
  else for(const id of changes??[]){const index=this.indices435.get(id);if(index!==undefined)this.ready435.add(index);}
  for(let event=this.boundaries435.peek();event&&event.at<=tick;event=this.boundaries435.peek()){
   this.boundaries435.pop();if(this.serial435[event.index]!==event.serial)continue;this.nextBoundary435[event.index]=Infinity;this.ready435.add(event.index);this.stats.boundaryWakes++;
  }
  for(const index of this.dependents435)this.ready435.add(index);
  const result=[...this.ready435].sort((a,b)=>a-b);this.ready435.clear();
  this.scheduleActive435=true;this.scheduleOpen435=true;this.scheduleReset435=false;this.scheduleTimeline435=timeline;this.scheduleGeneration435=generation;this.scheduleRevision435=revision;this.scheduleOrigin435=origin;this.scheduleTick435=tick;
  this.stats.scheduledFrames++;this.stats.scheduledActors+=result.length;this.stats.skips+=this.slots.length-result.length;return result;
 }
 select(index:number,timeline:ActorTimeline435|undefined,tick:number,origin:number):PreparedActor435|undefined{
  const row=this.slots[index];if(!row)throw new Error('Actor playback slot was not prepared at adoption.');
  const boundary=this.scheduleActive435?timeline?.playbackBoundary435?.(row.id):undefined;
  const edge=(boundary?boundary.edge:timeline?.playbackSegment435(row.id))??row.fallback,phase=edge?(tick<edge.start?0:tick<edge.end?1:2):-1,generation=timeline?.playbackGeneration435??0;
  if(this.scheduleActive435){const next=Math.min(boundary?.next??Infinity,edge&&edge.start>tick?edge.start:Infinity,edge&&edge.end>tick?edge.end:Infinity);
   // Continuous carrier dependencies may visit the same edge hundreds of
   // times before its endpoint. Keep the one outstanding wake, not a heap
   // entry for every RAF of an unchanged confirmed boundary.
   if(this.nextBoundary435[index]!==next){const serial=(this.serial435[index]??0)+1;this.serial435[index]=serial;this.nextBoundary435[index]=next;if(Number.isFinite(next))this.boundaries435.push({at:next,index,serial});else this.boundaries435.delete(index);}
  }
  if(!row.dirty&&!row.dependent&&row.committedEdge===edge&&row.committedPhase===phase&&row.committedOrigin===origin&&row.committedGeneration===generation&&row.committedTimeline===timeline){this.stats.skips++;return;}
  row.edge=edge;row.phase=phase;row.origin=origin;row.generation=generation;row.timeline=timeline;this.pending.push(row);this.stats.visits++;if(row.dependent)this.stats.dependentVisits++;return row;
 }
 /** Called after normal endpoint writes, upload flags and rescue copies. A
  * failed batch never commits; the next caller revokes its native key caches. */
 commit():void{for(const row of this.pending){row.committedEdge=row.edge;row.committedPhase=row.phase;row.committedOrigin=row.origin;row.committedGeneration=row.generation;row.committedTimeline=row.timeline;row.dirty=false;this.stats.commits++;}this.pending.length=0;this.scheduleOpen435=false;}
 snapshot(){return{enabled:this.owned,actors:this.slots.length,pending:this.pending.length,scheduledBoundaries:this.boundaries435.size,...this.stats};}
 clear():void{this.world=undefined;this.source=undefined;this.slots=[];this.pending=[];this.owned=false;this.retrying=false;this.indices435.clear();this.ready435.clear();this.dependents435.clear();this.boundaries435.clear();this.serial435.length=0;this.nextBoundary435.length=0;this.scheduleTimeline435=undefined;this.scheduleRevision435=-1;this.scheduleReset435=true;this.scheduleOpen435=false;this.scheduleActive435=false;}
}

type PlaybackBoundary435={at:number;index:number;serial:number};
class PlaybackBoundaryHeap435 {
 private values:PlaybackBoundary435[]=[];
 private readonly positions=new Map<number,number>();
 get size():number{return this.values.length;}
 clear():void{this.values.length=0;this.positions.clear();}
 peek():PlaybackBoundary435|undefined{return this.values[0];}
 private move(at:number,value:PlaybackBoundary435):void{this.values[at]=value;this.positions.set(value.index,at);}
 private place(at:number,value:PlaybackBoundary435):void{
  const parent=(at-1)>>1;
  if(at&&this.values[parent]!.at>value.at){while(at){const p=(at-1)>>1;if(this.values[p]!.at<=value.at)break;this.move(at,this.values[p]!);at=p;}}
  else while(2*at+1<this.values.length){let child=2*at+1;if(child+1<this.values.length&&this.values[child+1]!.at<this.values[child]!.at)child++;if(value.at<=this.values[child]!.at)break;this.move(at,this.values[child]!);at=child;}
  this.move(at,value);
 }
 push(value:PlaybackBoundary435):void{const position=this.positions.get(value.index);if(position===undefined){const at=this.values.length;this.values.push(value);this.place(at,value);}else this.place(position,value);}
 delete(index:number):void{const at=this.positions.get(index);if(at===undefined)return;const last=this.values.pop()!;this.positions.delete(index);if(at<this.values.length)this.place(at,last);}
 pop():PlaybackBoundary435|undefined{const first=this.values[0];if(first)this.delete(first.index);return first;}
}

/** Active physical recurrences remain per-frame work. A retired Float32 root
 * wakes only when a larger interpolation coefficient could change its exact
 * value, or when an explicit hit/endpoint/reset wakes its slot. */
export class ActorSpringWork435 {
 readonly active=new Set<number>();
 private readonly sleeping=new Map<number,number>();
 private readonly coefficients=new PlaybackBoundaryHeap435();
 private serial:number[]=[];
 wake(index:number):void{if(this.active.has(index))return;this.active.add(index);this.sleeping.delete(index);this.coefficients.delete(index);this.serial[index]=(this.serial[index]??0)+1;}
 sleep(index:number,coefficient:number):void{this.active.delete(index);this.sleeping.set(index,coefficient);const serial=(this.serial[index]??0)+1;this.serial[index]=serial;this.coefficients.push({at:coefficient,index,serial});}
 remove(index:number):void{this.active.delete(index);this.sleeping.delete(index);this.coefficients.delete(index);this.serial[index]=(this.serial[index]??0)+1;}
 wakeCoefficient(dt:number,speed:number):void{
  if(!Number.isFinite(dt)||!Number.isFinite(speed)||dt<0||speed<0){for(const index of this.sleeping.keys())this.wake(index);return;}
  const coefficient=speed>=5?1:Math.min(1,.09*dt*60*speed);
  for(let row=this.coefficients.peek();row&&row.at<coefficient;row=this.coefficients.peek()){this.coefficients.pop();if(this.serial[row.index]!==row.serial||!this.sleeping.has(row.index))continue;this.wake(row.index);}
 }
 clear():void{this.active.clear();this.sleeping.clear();this.coefficients.clear();this.serial.length=0;}
}
