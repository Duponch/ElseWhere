import {expect,test} from 'vitest';
import {frameAt,frameCosts,FRAME_SEARCH_COST} from '../src/sim/construction-costs.ts';
import {captureFrameGeometry379,markFrameGeometryChanged379} from '../src/sim/frame-geometry-379.ts';
import {canStandAt} from '../src/sim/furniture-travel.ts';
import {footprintContains,footprintCells} from '../src/sim/definitions.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import type {Job,World} from '../src/sim/types.ts';

const job=(id:number,kind:Job['kind'],x:number,z:number):Job=>({id,kind,x,z,orientation:1,footprint:'standard',construction:'blueprint',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
const fixture=():World=>({schemaVersion:379,width:8,height:8,tiles:Array.from({length:64},()=>({terrain:'grass'})),structures:[],pawns:[],piles:[],jobs:[job(1,'table',2,2),job(2,'power-conduit',4,4)]}) as unknown as World;
function compare(w:World):void {
 const expected=new Map<number,number>();for(const j of w.jobs)if(j.construction==='frame'&&j.kind!=='lay-floor'&&j.kind!=='build-bridge')for(const c of footprintCells(j))expected.set(c.z*w.width+c.x,FRAME_SEARCH_COST);
 expect(frameCosts(w)).toEqual(expected.size?expected:undefined);
 for(let z=-1;z<=8;z++)for(let x=-1;x<=8;x++){
  expect(frameAt(w,{x,z})).toBe(w.jobs.some(j=>j.construction==='frame'&&j.kind!=='lay-floor'&&j.kind!=='build-bridge'&&footprintContains(j,{x,z})));
  if(x>=0&&z>=0&&x<8&&z<8)expect(canStandAt(w,{x,z})).toBe(!w.jobs.some(j=>j.construction==='frame'&&j.kind!=='power-conduit'&&j.kind!=='lay-floor'&&j.kind!=='build-bridge'&&footprintContains(j,{x,z})));
 }
}

test('owned frame lookup follows committed promotions, footprints and category changes while retaining old snapshots',()=>{
 const w=fixture();withJournalTerrainReadScope({},()=>{
  compare(w);const first=captureFrameGeometry379(w)!;
  w.jobs[0]!.construction='frame';markFrameGeometryChanged379(w);compare(w);const costs=frameCosts(w)!,kept=new Map(costs);
  expect(captureFrameGeometry379(w)).not.toBe(first);
  w.jobs[1]!.construction='frame';markFrameGeometryChanged379(w);compare(w);expect(frameAt(w,{x:4,z:4})).toBe(true);expect(canStandAt(w,{x:4,z:4})).toBe(true);
  w.jobs[0]!.x=5;w.jobs[0]!.orientation=2;markFrameGeometryChanged379(w);compare(w);
  w.jobs[0]!.kind='lay-floor';markFrameGeometryChanged379(w);compare(w);expect(costs).toEqual(kept);
  w.jobs=w.jobs.filter(j=>j.id!==2);compare(w);
 });
});

test('public same-array frame, cell, kind, order and removal edits remain exhaustive without marks',()=>{
 const w=fixture(),owner={};withJournalTerrainReadScope(owner,()=>compare(w));
 w.jobs[0]!.construction='frame';w.jobs[0]!.x=3;compare(w);
 w.jobs[0]!.kind='bed';w.jobs[0]!.orientation=3;compare(w);
 w.jobs.splice(0,1,{...job(3,'stool',6,6),construction:'frame'});w.jobs.reverse();compare(w);
 withJournalTerrainReadScope(owner,()=>compare(w));
 w.jobs=[];expect(frameCosts(w)).toBeUndefined();
});
