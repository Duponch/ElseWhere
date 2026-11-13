import {expect} from 'vitest';
import {createWorld,validateWorld} from '../src/sim/index.ts';
import {advanceWorldCore297} from '../src/sim/engine.ts';
import {setActualView301} from '../src/sim/actual-view-301.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {initialSkills} from '../src/sim/skills.ts';
import {constructionSiteFree} from '../src/sim/construction-rules.ts';
import type {Job,Pawn,World} from '../src/sim/types.ts';
/** Explicit controlled, unplayed constructor scenario. No campaign RAW is
 * loaded, no frame/toil history is installed, and every subsequent Core is
 * advanced by the real candidate Engine. */
export function fixture(wide=false){
 const w=createWorld(42,32,32);expect(Number(w.schemaVersion)).toBe(319);
 for(const p of w.pawns){
  p.hunger=100;p.rest=100;p.recreation.level=100;p.schedule.fill('work');
  for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
 }
 const p=w.pawns[0]!;p.skills=initialSkills(8);delete p.background;delete p.traits;
 p.priorities.build=1;
 let position:{x:number;z:number}|undefined;
 const offsets=wide?[{dx:0,dz:0},{dx:1,dz:0},{dx:0,dz:-1},{dx:1,dz:-1}]:[{dx:0,dz:0},{dx:1,dz:0}];
 for(let z=3;z<27&&!position;z++)for(let x=3;x<27;x++){
  if(offsets.every(({dx,dz})=>w.tiles[(z+dz)*w.width+x+dx]!.terrain==='soil'&&!w.resources.some(r=>r.x===x+dx&&r.z===z+dz)&&!w.structures.some(s=>s.x===x+dx&&s.z===z+dz)&&!w.piles.some(s=>s.owner.type==='ground'&&s.owner.x===x+dx&&s.owner.z===z+dz)&&!w.pawns.some(a=>a!==p&&a.x===x+dx&&a.z===z+dz)&&!w.wildlife?.animals.some(a=>a.x===x+dx&&a.z===z+dz))){position={x,z};break;}
 }
 expect(position).toBeDefined();p.x=position!.x;p.z=position!.z;p.state='working';p.path=[];p.moveCooldown=0;delete p.motion;delete p.idleWander300;
 const j:Job={id:w.nextId++,kind:'wall',material:'wood',construction:'frame',x:p.x+1,z:p.z,orientation:0,footprint:'standard',status:'active',reservedBy:p.id,progress:0,escrow:{wood:0,food:0}};
 w.jobs.push(j);p.jobId=j.id;addMaterial(w,'wood',5,{type:'job',jobId:j.id},'wood');
 expect(constructionSiteFree(w,j,p.id)).toBe(true);
 w.rng=0x12345678;
 expect(setActualView301(w,{mapId:0,minX:0,minZ:0,maxX:31,maxZ:31,zoomBand:0})).toBe(true);
 expect(validateWorld(w)).toEqual([]);
 return {w,p,j};
}
export const play=(w:World,n:number)=>{for(let i=0;i<n;i++)advanceWorldCore297(w);};
