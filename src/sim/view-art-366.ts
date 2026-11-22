import { isBedKind } from './bed-kinds.ts';
import { deconstructionReserved } from './deconstruction-rules.ts';
import { footprintCells, STRUCTURE_DEFINITIONS } from './definitions.ts';
import { isRoomDoor } from './door-rules.ts';
import { furnitureQuality, isSculptureKind, sculptureBeauty, SCULPTURE_DEFINITIONS } from './furniture-stats.ts';
import { comfortableTemperature } from './heat-rules.ts';
import { pawnBody } from './health-rules.ts';
import { inJoyTableRing354, joyTableRing354 } from './joy-tables-354.ts';
import { sharedLightEnvironmentCache } from './light-environment.ts';
import { naturalTerrainWalkable256 } from './natural-terrain-movement-256.ts';
import { cellIndex, routeCost, routeToCell, type Reachability } from './pathfinding.ts';
import { RECREATION_DURATION, type OrdinaryRecreationTask } from './recreation-rules.ts';
import { isRoofed, roofIndex } from './roof-rules.ts';
import { captureStructureNavigation, filteredStructures } from './structure-navigation.ts';
import { outdoorTemperature } from './temperature.ts';
import { toxicFalloutActive294 } from './toxic-fallout-state-294.ts';
import { volcanicWinterActive310 } from './volcanic-winter-state-310.ts';
import { weatherRainRate } from './weather.ts';
import type { WorkEnvironment, WorkEnvironmentCache } from './work-environment.ts';
import { newWorkEnvironmentCache } from './work-environment-registry.ts';
import type { Cell, Pawn, Structure, World } from './types.ts';

/* RimWorld 1.6.4871, schema 366: the ViewArt joy giver (JoyGivers.xml:
 * JoyGiver_ViewArt, baseChance 1, joyKind Meditative, requiredCapacities
 * Sight) and its job (Jobs_Joy.xml: JobDriver_ViewArt, joyDuration 4000).
 * Only the sculptures (SculptureBase, CompProperties_Art canBeEnjoyedAsArt)
 * can be viewed. Nothing here runs or draws below 366, and a colony without
 * a sculpture never adds the giver: the joy giver list is unchanged. */
export const isViewArtSchema366=(version:unknown):boolean=>Number(version)>=366;
export const VIEW_ART_BASE_CHANCE_366=1;
/** JobDef ViewArt joyDuration 4000 Core ticks, ten Core ticks per local tick. */
export const VIEW_ART_DURATION_366=RECREATION_DURATION;
/** StatDef JoyGainFactor (Stats_Building_Special.xml): base 1, StatPart_Quality. */
const QUALITY_JOY_366:Readonly<Record<string,number>>=Object.freeze({awful:.76,poor:.88,normal:1,good:1.12,excellent:1.24,masterwork:1.4,legendary:1.8});

/** JoyGiver.CanBeGivenTo: the required Sight capacity. */
export const viewArtCapable366=(pawn:Pawn):boolean=>pawnBody(pawn).capacities.sight>0;

const environments=new WeakMap<World,WorkEnvironmentCache>();
function environment(world:World):WorkEnvironment {
  let cache=environments.get(world);if(!cache){cache=newWorkEnvironmentCache(sharedLightEnvironmentCache(world));environments.set(world,cache);}
  return cache.read(world);
}
/** Thing.Faction == Faction.OfPlayer: a structure without a faction field is the colony's own. */
const playerOwned=(world:World,s:Structure):boolean=>!Object.hasOwn(s,'factionId')||s.factionId===undefined||s.factionId!==null&&s.factionId===world.worldFactions?.playerFactionId;

/** JoyUtility.EnjoyableOutsideNow(pawn): rain rate under 0.25, no game
 * condition forbidding it (toxic fallout, volcanic winter), and the outdoor
 * temperature inside the pawn's comfortable range. */
export function enjoyableOutsideNow366(world:World,pawn:Pawn):boolean {
  if(weatherRainRate(world)>=.25)return false;
  if(toxicFalloutActive294(world)||volcanicWinterActive310(world))return false;
  const range=comfortableTemperature(world,pawn),outside=outdoorTemperature(world);
  return outside>=range.min&&outside<=range.max;
}

/** RoomRoleDef.avoidViewingArtIfUnowned (Bedroom, Barracks, PrisonCell,
 * PrisonBarracks, Hospital): such a room's art is viewed only by the pawn
 * whose own room it is (Pawn_Ownership.OwnedRoom, Room.Owners). Elsewhere's
 * room roles count every bed, medical and prisoner ones included, as a
 * bedroom (one bed) or barracks (several): an unowned medical bed keeps a
 * hospital avoided, as in Core. A barracks has no owner as soon as more than
 * one of its beds has one. */
function roomAllowsArt(world:World,env:WorkEnvironment,pawn:Pawn,s:Structure):boolean {
  const space=env.topology.at(s.x,s.z);
  if(space?.kind!=='space')return false;
  const role=env.room(s)?.role;
  if(role!=='bedroom'&&role!=='barracks')return true;
  const inRoom=(b:Structure)=>footprintCells(b).some(c=>{const r=env.topology.at(c.x,c.z);return r?.kind==='space'&&r.id===space.id;});
  const own=pawn.bedId===null||pawn.bedId===undefined?undefined:world.structures.find(b=>b.id===pawn.bedId&&isBedKind(b.kind));
  if(!own||!inRoom(own))return false;
  if(role==='barracks'){
    const owned=new Set<number>();for(const p of world.pawns)if(p.bedId!==null&&p.bedId!==undefined)owned.add(p.bedId);
    let beds=0;for(const b of world.structures)if(isBedKind(b.kind)&&owned.has(b.id)&&inRoom(b))beds++;
    if(beds>1)return false;
  }
  return true;
}

/** The sculptures one pawn may view (JoyGiver_ViewArt.TryGiveJob validator),
 * reachability excepted: it is searched after the weighted draw. Player
 * faction, roofed unless outdoors is enjoyable now, not fogged, not
 * forbidden (an installed sculpture has no CompForbiddable: only the allowed
 * area forbids it), reserved by nobody else (Reserve, one viewer), not
 * claimed by a deconstruction, and a room the pawn may view art in.
 * `undefined` below 366 or without any sculpture. */
export function viewArtCandidates366(world:World,pawn:Pawn,allowed:(cell:Cell)=>boolean):Structure[]|undefined {
  if(!isViewArtSchema366(world.schemaVersion))return undefined;
  const sculptures=filteredStructures(world,'sculptures-366',s=>isSculptureKind(s.kind));
  if(!sculptures.length)return undefined;
  const viewed=new Set<number>();
  for(const p of world.pawns)if(p.id!==pawn.id&&p.recreation?.task?.activity==='view-art'&&p.recreation.task.buildingId!==null)viewed.add(p.recreation.task.buildingId);
  let outside:boolean|undefined,env:WorkEnvironment|undefined;
  const out:Structure[]=[];
  for(const s of sculptures){
    if(viewed.has(s.id)||!playerOwned(world,s)||deconstructionReserved(world,s.id,pawn.id))continue;
    if(world.tiles[s.z*world.width+s.x]?.fogged)continue;
    if(!isRoofed(world,roofIndex(world,s))&&!(outside??=enjoyableOutsideNow366(world,pawn)))continue;
    if(!footprintCells(s).every(allowed))continue;
    if(!roomAllowsArt(world,env??=environment(world),pawn,s))continue;
    out.push(s);
  }
  return out;
}

/** TryRandomElementByWeight weight: Mathf.Max(Beauty, 0.5). */
export const viewArtWeight366=(world:World,s:Structure):number=>Math.max(sculptureBeauty(s,world.schemaVersion),.5);

/** JobDriver_ViewArt.WaitTickAction: Beauty over the def's abstract Beauty
 * (stuff and quality over the bare base, 0 if not positive), times the
 * building's JoyGainFactor (1 with its quality), as JoyUtility.JoyTickCheckEnd. */
export function viewArtGainFactor366(world:World,s:Structure|undefined):number {
  if(!s||!isSculptureKind(s.kind))return 0;
  const ratio=sculptureBeauty(s,world.schemaVersion)/SCULPTURE_DEFINITIONS[s.kind].beauty;
  return (ratio>0?ratio:0)*QUALITY_JOY_366[furnitureQuality(s.quality)]!;
}

/** TouchPathEndModeUtility.IsCornerTouchAllowed: a diagonal cell touches the
 * sculpture only if one of the two cells between them is walkable and holds
 * no door. */
function cornerOpen(world:World,cell:Cell,at:(cell:Cell)=>readonly Structure[]):boolean {
  if(cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height)return false;
  const tile=world.tiles[cell.z*world.width+cell.x]!;
  if(!(tile.bridge||tile.floor||naturalTerrainWalkable256(tile.terrain)))return false;
  for(const s of at(cell))if(isRoomDoor(s.kind)||s.kind==='fence-gate'||(STRUCTURE_DEFINITIONS as Readonly<Record<string,{blocksMovement?:boolean}|undefined>>)[s.kind]?.blocksMovement)return false;
  return true;
}
/** PathEndMode.Touch around the sculpture: the 8-way ring of its occupied
 * rect, a corner cell only if the corner touch is allowed. */
export function viewArtTouchCell366(world:World,s:Structure,cell:Cell,at?:(cell:Cell)=>readonly Structure[]):boolean {
  const cells=footprintCells(s);
  if(!inJoyTableRing354(cells,cell))return false;
  const xs=cells.map(c=>c.x),zs=cells.map(c=>c.z);
  const fx=Math.min(Math.max(cell.x,Math.min(...xs)),Math.max(...xs)),fz=Math.min(Math.max(cell.z,Math.min(...zs)),Math.max(...zs));
  if(fx===cell.x||fz===cell.z)return true;
  const read=at??(()=>{const g=captureStructureNavigation(world);return (c:Cell)=>g.at(c);})();
  return cornerOpen(world,{x:cell.x,z:fz},read)||cornerOpen(world,{x:fx,z:cell.z},read);
}

/** Running or saved task: a sculpture still here, not claimed by a
 * deconstruction, and the viewer on a touch cell (FailOnDestroyedNullOrForbidden,
 * FailOnCannotTouch). Weather and the room are admission conditions only. */
export function viewArtSiteValid366(world:World,task:OrdinaryRecreationTask,sculpture:Structure|undefined):boolean {
  return isViewArtSchema366(world.schemaVersion)&&!!sculpture&&isSculptureKind(sculpture.kind)&&sculpture.id===task.buildingId&&task.seatId===undefined
    &&!deconstructionReserved(world,sculpture.id)&&viewArtTouchCell366(world,sculpture,task.target);
}

export interface ViewArtChoice366 {task:OrdinaryRecreationTask;path:Cell[]}
/** One sculpture by weight, then the nearest reachable touch cell (Touch
 * path end). An unreachable sculpture is dropped and another drawn among the
 * rest, so the choice follows Core's weights among the reachable ones.
 * 'pending' waits for the shared navigation budget. */
export function chooseViewArt366(world:World,sculptures:readonly Structure[],io:{standable:(cell:Cell)=>boolean;reserved:ReadonlySet<number>;search:(goals:ReadonlySet<number>)=>Reachability|null;random:()=>number}):ViewArtChoice366|'pending'|null {
  const pool=[...sculptures];
  let geometry:ReturnType<typeof captureStructureNavigation>|undefined;
  const at=(c:Cell)=>(geometry??=captureStructureNavigation(world)).at(c);
  while(pool.length){
    const weights=pool.map(s=>viewArtWeight366(world,s));
    let draw=io.random()*weights.reduce((sum,w)=>sum+w,0),index=0;
    for(;index<pool.length-1;index++){draw-=weights[index]!;if(draw<0)break;}
    const sculpture=pool.splice(index,1)[0]!;
    const cells=joyTableRing354(footprintCells(sculpture)).filter(c=>c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height
      &&!io.reserved.has(cellIndex(world,c.x,c.z))&&io.standable(c)&&viewArtTouchCell366(world,sculpture,c,at));
    if(!cells.length)continue;
    const reach=io.search(new Set(cells.map(c=>cellIndex(world,c.x,c.z))));
    if(!reach)return 'pending';
    let best:{target:Cell;path:Cell[];cost:number}|undefined;
    for(const target of cells){
      const path=routeToCell(world,target,reach);if(!path)continue;
      const cost=routeCost(world,path,reach);
      if(!best||cost<best.cost)best={target,path,cost};
    }
    if(!best)continue;
    return {task:{activity:'view-art',buildingId:sculpture.id,target:best.target,phase:'travel',elapsed:0},path:best.path};
  }
  return null;
}
