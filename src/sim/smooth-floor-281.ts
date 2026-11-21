import {isSchema281OrLater} from './schema-compatibility-257.ts';
import {smoothFloorSourceStone281,SMOOTHED_STONE_TERRAIN_281} from './smooth-floor-terrain-281.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {START_STRUCTURE_PHYSICS_256} from './player-start-physics-256.ts';
import {naturalTerrainWalkable256} from './natural-terrain-movement-256.ts';
import {footprintContains} from './definitions.ts';
import {pawnBody,medicalWorkRefusal} from './health-rules.ts';
import {isColonist} from './affiliation.ts';
import {workPriority} from './work-types.ts';
import {constructionSpeed,learnSkill,XP_SCALE} from './skills.ts';
import {workSpeedInspirationFactor360} from './inspirations-360.ts';
import {advanceWork,workProgress} from './work-progress.ts';
import {setSnowDepth,snowDepthAt} from './snow-surface.ts';
import {removeFilth} from './filth.ts';
import {markTerrainCellChanged} from './terrain-mutation-journal.ts';
import type {BodyAssessment} from './body-capacities.ts';
import type {StructureNavigationGeometry} from './structure-navigation.ts';
import type {Cell,CommandResult,Job,Pawn,World} from './types.ts';

export const SMOOTH_FLOOR_CORE_WORK_281=2800;
export const SMOOTH_FLOOR_WORK_281=SMOOTH_FLOOR_CORE_WORK_281/10;
const inside=(w:World,c:Cell)=>Number.isInteger(c.x)&&Number.isInteger(c.z)&&c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height;

/** Live local admission shared by commands, providers and save guards. A
 * partial edifice, pile or person is not a blanket refusal. Other designated
 * work may coexist until a real terrain/edifice change retires this mandate. */
export function smoothFloorReason281(w:World,c:Cell,ignoreJobId?:number,geometry?:Pick<StructureNavigationGeometry,'at'>):string|undefined {
  if(!isSchema281OrLater(w.schemaVersion))return 'Cette partie ne permet pas le lissage des sols.';
  if(!inside(w,c))return 'Case hors de la carte.';
  const i=c.z*w.width+c.x,t=w.tiles[i];
  if(foggedCell256(w,i))return 'Cette cellule n’est pas encore découverte.';
  if(c.x<10||c.z<10||c.x>=w.width-10||c.z>=w.height-10)return 'Le lissage exige une case située à au moins dix cases du bord.';
  if(t?.terrain==='smoothed-stone')return 'Ce sol est déjà lissé.';
  if(t?.floor||t?.bridge)return 'Retirez le revêtement avant de lisser.';
  if(!t||!smoothFloorSourceStone281(t))return t?.terrain==='rock'?'Dégagez d’abord la roche.':'Ce terrain ne peut pas être lissé.';
  if((geometry?.at(c)??w.structures).some(s=>{const f=START_STRUCTURE_PHYSICS_256[s.kind];return !f||f.fullFill&&f.passability===2&&(!!geometry||footprintContains(s,c));}))return 'Un édifice plein et infranchissable occupe cette case.';
  // Current jobs are already unique by authority admission / the save Set.
  // Rechecking all intents for each current job would make large areas O(N²).
  if(ignoreJobId===undefined&&w.jobs.some(j=>j.kind==='smooth-floor'&&j.x===c.x&&j.z===c.z))return 'Un ordre de lissage existe déjà sur cette case.';
  return undefined;
}
export function canDesignateSmoothFloor281(w:World,c:Cell,ignoreJobId?:number,geometry?:Pick<StructureNavigationGeometry,'at'>):CommandResult {
  const reason=smoothFloorReason281(w,c,ignoreJobId,geometry);
  return reason?{ok:false,code:inside(w,c)?'incompatible-resource':'out-of-bounds',reason}:{ok:true};
}

/** Core Touch corners use walkability, not our stricter stopping/standing
 * policy. PassThroughOnly furniture/chunks do not close an orthogonal corner. */
function openTouchCorner281(w:World,c:Cell,geometry?:Pick<StructureNavigationGeometry,'at'>):boolean {
  return inside(w,c)&&naturalTerrainWalkable256(w.tiles[c.z*w.width+c.x]!.terrain)
    &&!(geometry?.at(c)??w.structures).some(s=>{const f=START_STRUCTURE_PHYSICS_256[s.kind];return !f||(f.passability===2||f.door)&&(!!geometry||footprintContains(s,c));});
}
export function canTouchSmoothFloor281(w:World,actor:Cell,target:Cell,geometry?:Pick<StructureNavigationGeometry,'at'>):boolean {
  if(!inside(w,actor)||!inside(w,target))return false;
  const dx=Math.abs(actor.x-target.x),dz=Math.abs(actor.z-target.z);
  return dx<=1&&dz<=1&&(!dx||!dz||openTouchCorner281(w,{x:actor.x,z:target.z},geometry)||openTouchCorner281(w,{x:target.x,z:actor.z},geometry));
}

/** Delivered WorkSpeedGlobal factors are neutral apart from real worker glow.
 * This new stat has Sight weight .3; historical ConstructionSpeed keeps .2.
 * Local fixed-point work adapts Core float work rather than claiming bit parity. */
export function smoothingSpeed281(p:Pawn,glow:number,body?:BodyAssessment):number {
  const c=(body??pawnBody(p)).capacities,light=c.sight===0?1:.8+.2*Math.max(0,Math.min(1,glow/.3));
  return Math.max(.1,light*constructionSpeed(p)*c.manipulation*(.7+.3*Math.min(1,c.sight))*workSpeedInspirationFactor360(p));
}

/** The active Job owns fractional progress; a real release resets it. The
 * caller owns removal of the completed intent and normal actor cleanup. */
export function advanceSmoothFloor281(w:World,p:Pawn,j:Job,glow:number,body?:BodyAssessment,geometry?:Pick<StructureNavigationGeometry,'at'>):boolean {
  if(j.kind!=='smooth-floor'||!w.jobs.includes(j)||j.status!=='active'||j.reservedBy!==p.id||p.jobId!==j.id
    ||!isColonist(p)||p.prisoner||!workPriority(p,'build')||medicalWorkRefusal(p)||p.moveCooldown>0||(p.motion?.end??0)>w.tick
    ||smoothFloorReason281(w,j,j.id,geometry)||!canTouchSmoothFloor281(w,p,j,geometry))return false;
  p.path=[];p.state='working';
  // Native order: stat first, work, learning, surface clearing, then effect.
  const rate=smoothingSpeed281(p,glow,body);advanceWork(j,rate*1.7);
  learnSkill(p.skills.construction,XP_SCALE,p);
  const index=j.z*w.width+j.x;if(snowDepthAt(w,index)>0)setSnowDepth(w,index,0);
  if(workProgress(j)<SMOOTH_FLOOR_WORK_281)return false;
  const tile=w.tiles[index]!;
  // Synchronous commit retains this real substrate and all unconsumed Things.
  w.tiles[index]={...tile,terrain:SMOOTHED_STONE_TERRAIN_281};markTerrainCellChanged(w.tiles,index);
  for(const filth of [...w.filth?.items??[]])if(filth.x===j.x&&filth.z===j.z)removeFilth(w,filth);
  return true;
}
