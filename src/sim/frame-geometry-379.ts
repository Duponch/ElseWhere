import {isConduitKind} from './conduit-kinds-382.ts';
import {footprintCells} from './definitions.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import type {Job,World} from './types.ts';

export interface FrameGeometry379 {
 readonly byCell:ReadonlyMap<number,readonly Job[]>;
 readonly standDenied:ReadonlySet<number>;
}
interface Capture extends FrameGeometry379 {readonly owner:object;readonly version:number;readonly width:number;readonly height:number;readonly count:number;readonly first:Job|undefined;readonly last:Job|undefined}
const versions=new WeakMap<readonly Job[],number>(),captures=new WeakMap<readonly Job[],Capture>();
/** Actual blueprint→frame commits. Positions, kind/category and footprint
 * changes must use this producer too. Ordinary live job membership is append
 * or whole-array replacement; public readers never reuse its witness. */
export function markFrameGeometryChanged379(world:Pick<World,'jobs'>):void {versions.set(world.jobs,(versions.get(world.jobs)??0)+1);}
function build(world:World,owner:object):Capture {
 const byCell=new Map<number,Job[]>(),standDenied=new Set<number>();
 for(const job of world.jobs)if(job.construction==='frame'&&job.kind!=='lay-floor'&&job.kind!=='build-bridge')for(const c of footprintCells(job)){
  const i=c.z*world.width+c.x,rows=byCell.get(i);if(rows)rows.push(job);else byCell.set(i,[job]);
  if(!isConduitKind(job.kind))standDenied.add(i);
 }
 const source=world.jobs;return {owner,version:versions.get(source)??0,width:world.width,height:world.height,count:source.length,first:source[0],last:source[source.length-1],byCell,standDenied};
}
export function captureFrameGeometry379(world:World):FrameGeometry379|undefined {
 const source=world.jobs,owner=terrainJournalReadOwner();
 if(!owner||Object.getPrototypeOf(source)!==Array.prototype){captures.delete(source);return;}
 if(!Number.isInteger(world.width)||!Number.isInteger(world.height)||world.width<=0||world.height<=0)return;
 let capture=captures.get(source);
 if(!capture||capture.owner!==owner||capture.version!==(versions.get(source)??0)||capture.width!==world.width||capture.height!==world.height||capture.count!==source.length||capture.first!==source[0]||capture.last!==source[source.length-1]){capture=build(world,owner);captures.set(source,capture);}
 if(verifyTerrainWriteCaches){
  const expected=build(world,owner);if(expected.byCell.size!==capture.byCell.size||expected.standDenied.size!==capture.standDenied.size)throw Error('Unmarked frame membership/geometry write');
  for(const [i,rows] of expected.byCell){const actual=capture.byCell.get(i);if(!actual||actual.length!==rows.length||rows.some((j,k)=>j!==actual[k]))throw Error('Unmarked frame geometry/order write');}
  for(const i of expected.standDenied)if(!capture.standDenied.has(i))throw Error('Unmarked frame category write');
 }
 return capture;
}
