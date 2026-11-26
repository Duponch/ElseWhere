import {workSpeedGlobal361} from './traits.ts';
import {isColonist} from './affiliation.ts';
import {medicalWorkRefusal} from './health-rules.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import {workPriority} from './work-types.ts';
import {allowedAreaAllows,captureAllowedArea} from './allowed-area-state.ts';
import {routeToBestCellByCostAndLength,canStopAt,workNeighbours,type Reachability} from './pathfinding.ts';
import {fireTouch} from './firefighting.ts';
import {biofuelProductionSpeed} from './machining.ts';
import {snowDepthAt,setSnowDepth} from './snow-surface.ts';
import {releaseWork,type DropPlan} from './work-release.ts';
import type {CleaningTask,CleaningProposal} from './cleaning.ts';
import type {NeedContext} from './needs.ts';
import type {Cell,Pawn,World} from './types.ts';
export function snowAreaHas(w:World,i:number):boolean {const a=w.snowClearArea;if(!a)return false;let lo=0,hi=a.length;while(lo<hi){const m=(lo+hi)>>>1;if(a[m]!<i)lo=m+1;else hi=m;}return a[lo]===i;}
const cell=(w:World,i:number):Cell=>({x:i%w.width,z:Math.floor(i/w.width)});
const able=(p:Pawn)=>isColonist(p)&&!p.prisoner&&!p.draft&&!p.mental?.crisis&&!p.burning&&!medicalWorkRefusal(p)&&!backgroundWorkRefusal(p,'clean')&&workPriority(p,'clean')>0;
function eligible(w:World,p:Pawn,i:number,policy:ReturnType<typeof captureAllowedArea>,reserved:ReadonlySet<number>):boolean {return snowDepthAt(w,i)>=.2&&!reserved.has(i)&&allowedAreaAllows(w,p,cell(w,i),policy);}
function reservationCapture(w:World,p:Pawn):Set<number>{return new Set(w.pawns.flatMap(q=>q!==p&&q.cleaning?.snowCell!==undefined?[q.cleaning.snowCell]:[]));}
function candidates(w:World,p:Pawn):number[]{
 if(!w.snow||!w.snowClearArea?.length||!able(p))return [];
 const policy=captureAllowedArea(w,p),reserved=reservationCapture(w,p);
 return w.snowClearArea.filter(i=>eligible(w,p,i,policy,reserved))
  .sort((a,b)=>Math.abs(a%w.width-p.x)+Math.abs(Math.floor(a/w.width)-p.z)-Math.abs(b%w.width-p.x)-Math.abs(Math.floor(b/w.width)-p.z)||a-b);
}
/** Cheap demand: no whole-snow copy or sort for each Work priority read. */
export function snowClearingWanted(w:World,p:Pawn):boolean {
 if(!w.snow||!w.snowClearArea?.length||!able(p))return false;
 const policy=captureAllowedArea(w,p),reserved=reservationCapture(w,p);
 return w.snowClearArea.some(i=>eligible(w,p,i,policy,reserved));
}
function route(w:World,target:Cell,reach:Reachability):Cell[]|null {
 const cells=[target,...workNeighbours(target,'mine')].filter(c=>fireTouch(w,c,target)&&canStopAt(w,c,reach));
 return routeToBestCellByCostAndLength(w,cells,reach);
}
/** Snow is the last Cleaning supplier, using the same actor activity/release. */
export function snowClearingProposal(w:World,p:Pawn,reach:Reachability):CleaningProposal|undefined {
 for(const i of candidates(w,p)){const target=cell(w,i),path=route(w,target,reach);if(path)return {id:i+1,target,path,task:{targets:[],snowCell:i,forced:false,phase:'approach',progress:0}};}
}
export function editSnowArea(w:World,indices:readonly number[],add:boolean,drops:DropPlan):void {
 const area=new Set(w.snowClearArea);for(const i of indices)if(add)area.add(i);else area.delete(i);
 const next=[...area].sort((a,b)=>a-b);if(next.length)w.snowClearArea=next;else delete w.snowClearArea;
 if(!add){const removed=new Set(indices);for(const p of w.pawns)if(p.cleaning?.snowCell!==undefined&&removed.has(p.cleaning.snowCell))releaseWork(w,p,drops);}
}
/** Returns undefined only for ordinary filth. No partial snow is erased. */
export function processSnowClearing(w:World,p:Pawn,t:CleaningTask,context:NeedContext):boolean|undefined {
 if(t.snowCell===undefined)return;
 const i=t.snowCell,target=cell(w,i),policy=captureAllowedArea(w,p);
 const release=()=>{delete p.cleaning;p.path=[];p.planCooldown=0;if(p.state==='working')p.state='idle';};
 if(!w.snow||!able(p)||!snowAreaHas(w,i)||!allowedAreaAllows(w,p,target,policy)||snowDepthAt(w,i)<=0){release();return false;}
 if(p.moveCooldown>0)return true;
 if(!fireTouch(w,p,target)){
  t.phase='approach';if(!p.path.length){const goals=[target,...workNeighbours(target,'mine')].filter(c=>c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height&&fireTouch(w,c,target));const reach=context.search(new Set(goals.map(c=>c.z*w.width+c.x)));if(!reach)return true;const path=route(w,target,reach);if(!path){release();p.planCooldown=20;return false;}p.path=path;}
  const last=p.path.at(-1);if(last)context.move(last,true);return true;
 }
 p.path=[];p.state='working';t.phase='clean';
 // Deliberate adaptation: true 50*current depth work, not Core's nullable zero.
 t.progress+=10*biofuelProductionSpeed(p)*workSpeedGlobal361(p);
 if(t.progress>=50*snowDepthAt(w,i)){setSnowDepth(w,i,0);release();w.events.push({tick:w.tick,type:'job',message:`${p.name} a déneigé une case.`});if(w.events.length>80)w.events.splice(0,w.events.length-80);}
 return true;
}
