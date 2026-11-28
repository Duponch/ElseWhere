import type {PackedFurniture} from './furniture-rules.ts';
import { isColonist } from './affiliation.ts';
import { deepWorkSpot } from './deep-drilling-rules.ts';
import { serviceCell } from './service-reservations.ts';
import { deepResourceKindAvailable } from './deep-resources.ts';
import type { World } from './types.ts';

const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const finite=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,required:string[],optional:string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const kinds=['deep-drill','ground-scanner'];

/** One transport/file contract for acquired reserves, building work and real
 * operator claims. Temporary power, light and roof conditions reconcile in play. */
export function validDeepDrillingTransport(w:World,version:number,packedRecords?:readonly PackedFurniture[],clock?:number):boolean;
export function validDeepDrillingTransport(w:Pick<World,'tick'|'width'|'height'|'nextId'>,version:number,packedRecords:readonly PackedFurniture[],clock?:number):boolean;
export function validDeepDrillingTransport(w:World|Pick<World,'tick'|'width'|'height'|'nextId'>,version:number,packedRecords?:readonly PackedFurniture[],clock:number=w.tick):boolean {
  const local='structures'in w?w:undefined;if(!packedRecords&&!local)return false;
  try {
    const archived=packedRecords?[]:[...(local!.visitors?.departed??[]),...(local!.podRescues?.departed??[])];
    const buildings=packedRecords?packedRecords.map(p=>({s:p.building,tick:clock})):[...local!.structures.map(s=>({s,tick:w.tick})),...(local!.packed??[]).map(p=>({s:p.building,tick:w.tick})),
      ...archived.flatMap(d=>(d.packed??[]).map(p=>({s:p.building,tick:d.tick})))];
    if(!packedRecords&&(archived.some(d=>Object.hasOwn(d.pawn,'deepWork'))||local!.jobs.some(j=>Object.hasOwn(j,'deepDrill')||Object.hasOwn(j,'deepScanner'))))return false;
    if(version<215&&packedRecords)return buildings.every(({s})=>!kinds.includes(s.kind)&&!Object.hasOwn(s,'deepDrill')&&!Object.hasOwn(s,'deepScanner'));
    if(version<215)return !Object.hasOwn(local!,'deepResources')
      &&local!.pawns.every(p=>!Object.hasOwn(p,'deepWork'))
      &&[...buildings.map(p=>p.s),...local!.jobs].every(s=>!kinds.includes(s.kind)&&!Object.hasOwn(s,'deepDrill')&&!Object.hasOwn(s,'deepScanner'));
    if(!packedRecords){
    const state:unknown=local!.deepResources;
    if(state!==undefined){
      if(!obj(state)||!keys(state,['adoptedAt','rng','discoveries','cells'])||!int(state.adoptedAt,0,w.tick)
        ||!int(state.rng,1,0xffffffff)||!int(state.discoveries)||!Array.isArray(state.cells)||state.cells.length>w.width*w.height)return false;
      let last=-1;
      for(const c of state.cells){
        if(!obj(c)||!keys(c,['index','item','count'])||!int(c.index,0,w.width*w.height-1)||c.index<=last
          ||!deepResourceKindAvailable(c.item,version)||!int(c.count,1,300))return false;
        last=c.index;
      }
    }else if(Object.hasOwn(local!,'deepResources'))return false;
    }
    for(const {s,tick} of buildings){
      const drill:unknown=s.deepDrill,scanner:unknown=s.deepScanner;
      if(Object.hasOwn(s,'deepDrill')){
        if(s.kind!=='deep-drill'||!obj(drill)||!keys(drill,['progress','yieldPct','rng'],['lastUsedAt'])
          ||!finite(drill.progress,0,10000)||!finite(drill.yieldPct,0,2)||!int(drill.rng,1,0xffffffff)
          ||drill.lastUsedAt!==undefined&&!int(drill.lastUsedAt,0,tick))return false;
      }
      if(Object.hasOwn(s,'deepScanner')){
        if(s.kind!=='ground-scanner'||!obj(scanner)||!keys(scanner,['daysWorking'],['lastScanAt','lastUserSpeed'])
          ||!finite(scanner.daysWorking,0,6.01)||scanner.lastScanAt!==undefined&&!int(scanner.lastScanAt,0,tick)
          ||scanner.lastUserSpeed!==undefined&&!finite(scanner.lastUserSpeed,.1,100)
          ||(scanner.lastScanAt===undefined)!==(scanner.lastUserSpeed===undefined))return false;
      }
    }
    if(packedRecords)return true;
    const claimed=new Set<number>(),spots=new Set<number>();
    for(const p of local!.pawns){
      if(!Object.hasOwn(p,'deepWork'))continue;
      if(!local!.deepResources)return false;
      const t:unknown=p.deepWork;
      if(!obj(t)||!keys(t,['structureId','spot','kind'])||!int(t.structureId,1,w.nextId-1)||!['drill','scan'].includes(String(t.kind))
        ||!obj(t.spot)||!keys(t.spot,['x','z'])||!int(t.spot.x,0,w.width-1)||!int(t.spot.z,0,w.height-1))return false;
      const s=local!.structures.find(s=>s.id===t.structureId),spot=t.spot.z*w.width+t.spot.x;
      if(!s||s.kind!==(t.kind==='drill'?'deep-drill':'ground-scanner')||claimed.has(s.id)||spots.has(spot))return false;
      const expected=deepWorkSpot(s);
      if(expected.x!==t.spot.x||expected.z!==t.spot.z||p.state==='working'&&(p.x!==t.spot.x||p.z!==t.spot.z||p.path.length||p.moveCooldown>0||(p.motion?.end??0)>w.tick))return false;
      // Match the file reader's active-service census. Admission reservations
      // also cover queued work and may waive an urgent bedside visitor.
      for(const other of local!.pawns)if(other!==p){
        const cell=serviceCell(other,local!);if(cell&&cell.x===t.spot.x&&cell.z===t.spot.z)return false;
      }
      claimed.add(s.id);spots.add(spot);
      if(!isColonist(p)||p.prisoner||p.visitor||p.raid||p.podRescue||p.draft||p.mental?.crisis||p.interruptedCargo
        ||p.jobId!==null||p.haul||p.need||p.cooking||p.research||p.hunting||p.animalHandling||p.animalCare||p.animalFeed
        ||p.rescue||p.tend||p.surgery||p.feed||p.ward||p.equipmentTask||p.burial||p.cleaning||p.firefighting
        ||p.shooting||p.melee||p.flee||p.tactics||p.burning||p.heatRefuge||p.bombRefuge||p.trade
        ||p.recreation.task||p.orders.active!==null||!['moving','working'].includes(p.state)
        ||local!.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))return false;
      if(p.priorities[t.kind==='drill'?'mine':'research']===0)return false;
    }
    return true;
  }catch{return false;}
}
