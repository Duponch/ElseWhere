import {isStoneKind,STONE_LABELS,type StoneKind} from './geology.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {isColonist} from './affiliation.ts';
import {workPriority} from './work-types.ts';
import {medicalWorkRefusal} from './health-rules.ts';
import {learnSkill,XP_SCALE} from './skills.ts';
import {advanceWork,workProgress} from './work-progress.ts';
import {markTerrainCellChanged} from './terrain-mutation-journal.ts';
import {smoothingSpeed281,canTouchSmoothFloor281} from './smooth-floor-281.ts';
import type {BodyAssessment} from './body-capacities.ts';
import type {StructureNavigationGeometry} from './structure-navigation.ts';
import type {Cell,CommandResult,Job,Pawn,Tile,World} from './types.ts';

/** Schema 367: smoothing natural rock walls (Core SmoothWall designation,
 * WorkGiver_ConstructSmoothWall, JobDriver_SmoothWall, SmoothableWallUtility).
 * A smoothed wall stays the same rock cell (terrain `rock`, same stone, same
 * Mineable owner) with the `smoothedWall367` flag. */
export const isSmoothWallSchema367=(version:number):boolean=>Number.isSafeInteger(version)&&version>=367;

/** JobDriver_SmoothWall.BaseWorkAmount, in Core ticks of SmoothingSpeed work. */
export const SMOOTH_WALL_CORE_WORK_367=6500;
/** Local work units: one local tick holds ten Core ticks (as V458 floors). */
export const SMOOTH_WALL_WORK_367=SMOOTH_WALL_CORE_WORK_367/10;
/** The Smoothed<Rock> defs (Various_Stone.xml): Beauty 1 (SmoothedMarble 2),
 * MarketValue 7; MaxHitPoints, mineableThing and mineableDropChance are
 * inherited from the raw rock (GraniteBase, MarbleBase...). */
export const SMOOTHED_WALL_BEAUTY_367:Readonly<Record<StoneKind,number>>=Object.freeze({granite:1,limestone:1,marble:2,sandstone:1,slate:1});
export const SMOOTHED_WALL_MARKET_VALUE_367=7;
const LABELS:Readonly<Record<StoneKind,string>>=Object.freeze({granite:'Paroi de granite lissée',limestone:'Paroi de calcaire lissée',marble:'Paroi de marbre lissée',sandstone:'Paroi de grès lissée',slate:'Paroi d’ardoise lissée'});
const CORE_DEFS:Readonly<Record<StoneKind,string>>=Object.freeze({granite:'SmoothedGranite',limestone:'SmoothedLimestone',marble:'SmoothedMarble',sandstone:'SmoothedSandstone',slate:'SmoothedSlate'});
export const smoothedWallLabel367=(stone:unknown):string=>isStoneKind(stone)?LABELS[stone]:'Paroi rocheuse lissée';
export const smoothedWallCoreDef367=(stone:unknown):string|undefined=>isStoneKind(stone)?CORE_DEFS[stone]:undefined;
export const isSmoothedWall367=(tile:Pick<Tile,'terrain'>&{smoothedWall367?:unknown}|undefined):boolean=>!!tile&&tile.terrain==='rock'&&tile.smoothedWall367===true;
/** Beauty of a smoothed wall at its cell (a full-fill building), 0 otherwise.
 * The raw rock keeps the room readers' historical value (see V367 doc). */
export const smoothedWallBeauty367=(tile:Pick<Tile,'terrain'|'stone'>&{smoothedWall367?:unknown}):number=>isSmoothedWall367(tile)&&isStoneKind(tile.stone)?SMOOTHED_WALL_BEAUTY_367[tile.stone]:0;
export const smoothedWallMarketValue367=(tile:Pick<Tile,'terrain'>&{smoothedWall367?:unknown}):number=>isSmoothedWall367(tile)?SMOOTHED_WALL_MARKET_VALUE_367:0;

/** ThingDef.IsSmoothable: the five natural stones only (they name a
 * smoothedThing). Ores, collapsed rocks and built walls have none; an
 * already smoothed wall has none either. */
export function smoothableWallTile367(tile:Tile|undefined):tile is Tile&{stone:StoneKind} {
  return !!tile&&tile.terrain==='rock'&&isStoneKind(tile.stone)&&tile.ore===undefined&&!tile.collapsedRock&&tile.smoothedWall367===undefined;
}
const inside=(w:World,c:Cell)=>Number.isInteger(c.x)&&Number.isInteger(c.z)&&c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height;

/** Designator_SmoothWalls/Designator_Smooth admission: in bounds, not fogged,
 * outside the 10-cell no-build edge, a smoothable edifice, no SmoothWall
 * designation already there. A Mine designation does not refuse it: the
 * new designation replaces it (SmoothSurfaceDesignatorUtility). */
export function smoothWallReason367(w:World,c:Cell,ignoreJobId?:number):string|undefined {
  if(!isSmoothWallSchema367(w.schemaVersion))return 'Cette partie ne permet pas le lissage des murs.';
  if(!inside(w,c))return 'Case hors de la carte.';
  const i=c.z*w.width+c.x,t=w.tiles[i];
  if(foggedCell256(w,i))return 'Cette cellule n’est pas encore découverte.';
  if(c.x<10||c.z<10||c.x>=w.width-10||c.z>=w.height-10)return 'Le lissage exige une case située à au moins dix cases du bord.';
  if(t?.smoothedWall367)return 'Ce mur est déjà lissé.';
  if(!t||t.terrain!=='rock')return 'Seul un mur de roche naturelle peut être lissé.';
  if(t.ore!==undefined)return 'Un filon de minerai ne peut pas être lissé.';
  if(t.collapsedRock)return 'Des rochers effondrés ne peuvent pas être lissés.';
  if(!isStoneKind(t.stone))return 'La nature de cette roche est inconnue.';
  if(ignoreJobId===undefined&&w.jobs.some(j=>j.kind==='smooth-wall'&&j.x===c.x&&j.z===c.z))return 'Un ordre de lissage existe déjà sur ce mur.';
  return undefined;
}
export function canDesignateSmoothWall367(w:World,c:Cell,ignoreJobId?:number):CommandResult {
  const reason=smoothWallReason367(w,c,ignoreJobId);
  return reason?{ok:false,code:inside(w,c)?'incompatible-resource':'out-of-bounds',reason}:{ok:true};
}

/** WorkGiver_ConstructSmoothWall scans the designated cell with PathEndMode
 * Touch: an orthogonal neighbour, or a diagonal one when one of the two cells
 * between is walkable without a door (TouchPathEndModeUtility on a cell). */
export function canTouchSmoothWall367(w:World,actor:Cell,target:Cell,geometry?:Pick<StructureNavigationGeometry,'at'>):boolean {
  return !(actor.x===target.x&&actor.z===target.z)&&canTouchSmoothFloor281(w,actor,target,geometry);
}

/** SmoothableWallUtility.SmoothWall: the new smoothed thing is made fresh
 * (full hit points), so a partial mining damage is not kept. The stone, its
 * Mineable owner and the fog/snow fields stay. */
function smoothTile367(w:World,index:number):void {
  const tile=w.tiles[index]!,next:Tile={...tile,smoothedWall367:true};delete next.miningDamage;
  w.tiles[index]=next;markTerrainCellChanged(w.tiles,index);
}
/** Back to the raw rock (unsmoothedThing), also made fresh. */
function unsmoothTile367(w:World,index:number):void {
  const next:Tile={...w.tiles[index]!};delete next.smoothedWall367;delete next.miningDamage;
  w.tiles[index]=next;markTerrainCellChanged(w.tiles,index);
}

// GenAdj.CardinalDirections (N, E, S, W) and DiagonalDirections, in Core order.
const CARDINAL=[[0,1],[1,0],[0,-1],[-1,0]] as const;
const DIAGONAL=[[-1,-1],[-1,1],[1,1],[1,-1]] as const;
/** SmoothableWallUtility.IsBlocked: in bounds, not walkable and an edifice
 * that is natural rock or smoothed. In Elsewhere exactly the rock cells
 * (raw, ore, collapsed or smoothed); built walls are not blocked here. */
function blocked367(w:World,x:number,z:number):boolean {
  return x>=0&&z>=0&&x<w.width&&z<w.height&&w.tiles[z*w.width+x]!.terrain==='rock';
}
/** SmoothableWallUtility.Notify_SmoothedByPawn: a smoothable neighbour wall
 * whose four sides are all blocked, two of them smoothed, and which still
 * sees open ground diagonally (an inner corner no one can touch) is smoothed
 * too, without work or experience. Returns the cells smoothed this way. */
function notifySmoothedByPawn367(w:World,index:number):number[] {
  const x=index%w.width,z=Math.floor(index/w.width),done:number[]=[];
  for(const [dx,dz] of CARDINAL){
    const ex=x+dx,ez=z+dz;if(ex<0||ez<0||ex>=w.width||ez>=w.height)continue;
    const e=ez*w.width+ex;if(!smoothableWallTile367(w.tiles[e]))continue;
    let enclosed=true,smoothed=0;
    for(const [ax,az] of CARDINAL){
      if(!blocked367(w,ex+ax,ez+az)){enclosed=false;break;}
      if(w.tiles[(ez+az)*w.width+ex+ax]!.smoothedWall367)smoothed++;
    }
    if(!enclosed||smoothed<2)continue;
    if(DIAGONAL.some(([ax,az])=>!blocked367(w,ex+ax,ez+az))){smoothTile367(w,e);done.push(e);}
  }
  return done;
}
/** SmoothableWallUtility.Notify_BuildingDestroying (KillFinalize: mined or
 * crushed): each smoothed neighbour whose four sides are still blocked (the
 * destroyed wall still counts) goes back to the raw rock. Call before the
 * smoothed wall at `index` is replaced. Nothing happens below schema 367. */
export function revertEnclosedSmoothedWalls367(w:World,index:number):void {
  if(!w.tiles[index]?.smoothedWall367)return;
  const x=index%w.width,z=Math.floor(index/w.width);
  for(const [dx,dz] of CARDINAL){
    const ex=x+dx,ez=z+dz;if(ex<0||ez<0||ex>=w.width||ez>=w.height)continue;
    const e=ez*w.width+ex;if(!isSmoothedWall367(w.tiles[e]))continue;
    if(CARDINAL.every(([ax,az])=>blocked367(w,ex+ax,ez+az)))unsmoothTile367(w,e);
  }
}

/** JobDriver_SmoothWall's work toil, one local tick (ten Core ticks): work
 * SmoothingSpeed x 1.7, then Construction learning 0.1 per Core tick, then the
 * effect when the work left reaches zero. The active Job owns its progress; a
 * real release resets it (the toil's initAction sets workLeft again). The
 * caller removes the finished job. Returns the cells smoothed, or undefined. */
export function advanceSmoothWall367(w:World,p:Pawn,j:Job,glow:number,body?:BodyAssessment,geometry?:Pick<StructureNavigationGeometry,'at'>):number[]|undefined {
  if(j.kind!=='smooth-wall'||!w.jobs.includes(j)||j.status!=='active'||j.reservedBy!==p.id||p.jobId!==j.id
    ||!isColonist(p)||p.prisoner||!workPriority(p,'build')||medicalWorkRefusal(p)||p.moveCooldown>0||(p.motion?.end??0)>w.tick
    ||smoothWallReason367(w,j,j.id)||!canTouchSmoothWall367(w,p,j,geometry))return undefined;
  p.path=[];p.state='working';
  advanceWork(j,smoothingSpeed281(p,glow,body)*1.7);
  learnSkill(p.skills.construction,XP_SCALE,p);
  if(workProgress(j)<SMOOTH_WALL_WORK_367)return undefined;
  const index=j.z*w.width+j.x;smoothTile367(w,index);
  return [index,...notifySmoothedByPawn367(w,index)];
}

/** Player-facing description of a smoothed wall (inspection). */
export function smoothedWallDescription367(tile:Tile,maxHP:number):string {
  const stone=isStoneKind(tile.stone)?STONE_LABELS[tile.stone]:'Roche';
  return `${stone} poli : ${maxHP-(tile.miningDamage??0)} / ${maxHP} PV. Beauté ${smoothedWallBeauty367(tile)} et valeur ${SMOOTHED_WALL_MARKET_VALUE_367} pour la pièce qu’il borde. Miner rend le sol rocheux ; 25 % de chance de laisser un fragment, comme la roche brute.`;
}
