import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import type { PowerParentReader } from './power-parent-validation.ts';
import type { StagingGeometryReader } from './staging-validation.ts';
import type { ValidationIdentityContext,ValidationIdentityMembership } from './validation-identities.ts';
import { legacyPlantGrowth } from './plants.ts';
import {isForestrySpecies291,treeSowingUnlocked291,forestNativeSpecies291,isGrowingPlantInVersion291} from './forestry-content-291.ts';
import { isGrowingTerrain } from './soil.ts';
import { footprintCells } from './definitions.ts';
import { validConstructionMaterial } from './construction-materials.ts';
import { HYDROPONICS_RESEARCH_COST } from './research.ts';
import { validatePower } from './power-save.ts';
import { sharesConstructionLayer } from './power-grid.ts';
import type { Structure,Terrain,World } from './types.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const hydro=(v:unknown):v is Record<string,unknown>=>record(v)&&v.kind==='hydroponics-basin';
const hydroCrops=['rice','potato','cotton','healroot','hops','tinctoria'];
const hydroCropInVersion=(kind:string,version:number):boolean=>hydroCrops.includes(kind)&&(kind!=='hops'||version>=265)&&(kind!=='tinctoria'||version>=382);
export const hydroponicPlantAllowed=(world:World,basinId:number,plant:{kind:string;x:number;z:number}):boolean=>
  world.schemaVersion>=203&&hydroCropInVersion(plant.kind,world.schemaVersion)&&world.growingZones.some(z=>z.basinId===basinId&&z.cells.includes(plant.z*world.width+plant.x));

/** One hydroponics contract for saves and accepted snapshot candidates. It is
 * scoped to the new content; historical soil zones keep their old validators. */
export function validateHydroponics(world:World,version:number,powerTopology?:PowerParentReader,identities?:ValidationIdentityContext,spatial?:StagingGeometryReader):string[] {
  const errors:string[]=[],raw=world as unknown as Record<string,unknown>;
  const structures=Array.isArray(raw.structures)?raw.structures:[],jobs=Array.isArray(raw.jobs)?raw.jobs:[],zones=Array.isArray(raw.growingZones)?raw.growingZones:[];
  const basins=structures.filter(hydro),plans=jobs.filter(hydro),linked=zones.filter(z=>record(z)&&Object.hasOwn(z,'basinId'));
  const research=record(raw.research)?raw.research:undefined,progress=research?.hydroponics;
  const packed=Array.isArray(raw.packed)?raw.packed:[];
  const hasPacked=packed.some(p=>record(p)&&hydro(p.building));
  const referenced=jobs.some(j=>record(j)&&[j.furniture,j.deconstruction,j.flick,j.fixBreakdown,j.repair].some(hydro));
  const hasResearch=!!research&&(Object.hasOwn(research,'hydroponics')||research.project==='hydroponics');
  if(!basins.length&&!plans.length&&!linked.length&&!hasPacked&&!referenced&&!hasResearch)return errors;
  if(version<203)return ['Future hydroponics content.'];
  if(hasResearch&&(!integer(raw.tick)||!record(progress)||Object.keys(progress).some(k=>k!=='points'&&k!=='completedAt')||!integer(progress.points,0,HYDROPONICS_RESEARCH_COST)
    ||(progress.completedAt===undefined?progress.points===HYDROPONICS_RESEARCH_COST:!integer(progress.completedAt,0,world.tick)||progress.points!==HYDROPONICS_RESEARCH_COST||research?.project==='hydroponics')))errors.push('Invalid hydroponics research.');
  if(!basins.length&&!plans.length&&!linked.length&&!hasPacked&&!referenced)return errors;
  // The same entry point also sees raw snapshot/save candidates. Establish
  // collection records before any geometry or owner traversal in this domain.
  const records=(value:unknown):boolean=>{
    if(!Array.isArray(value))return false;
    for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i)||!record(value[i]))return false;
    return true;
  };
  if(!integer(raw.width,1)||!integer(raw.height,1)||!Number.isSafeInteger(Number(raw.width)*Number(raw.height))||!integer(raw.nextId,1)||!integer(raw.tick)
    ||!['pawns','resources','structures','jobs','piles','stockpiles','growingZones'].every(k=>k==='resources'?(identities?.resourceRecords(world)??records(raw[k])):records(raw[k]))
    ||!Array.isArray(raw.tiles)||world.tiles.length!==world.width*world.height)return ['Invalid hydroponics world collections or dimensions.'];
  if(raw.packed!==undefined&&!Array.isArray(raw.packed)||packed.some(p=>!record(p)||!record(p.building)||!record(p.owner)))errors.push('Invalid hydroponics ownership collections.');
  if(hasPacked||jobs.some(j=>{if(!record(j)||(j.kind!=='install'&&j.kind!=='uninstall'))return false;const target=j.furniture;
    return record(target)&&(target.kind==='hydroponics-basin'||basins.some(b=>b.id===target.structureId));}))errors.push('Hydroponics basins cannot be packed or installed.');
  if((!record(progress)||progress.points!==HYDROPONICS_RESEARCH_COST||!integer(progress.completedAt,0,world.tick))&&
    (plans.length||referenced||(world.developerTest381===true?basins.some(b=>!developerResearchPlacement381(world,b)):basins.length)))errors.push('Locked hydroponics basin.');
  const basinById=new Map<number,Record<string,unknown>>(),geometry=new Map<number,number[]>();
  for(const b of [...basins,...plans]){
    if(!integer(b.id,1,world.nextId-1)||!integer(b.x,0,world.width-1)||!integer(b.z,0,world.height-1)||!integer(b.orientation,0,3)
      ||b.footprint!=='standard'||!validConstructionMaterial(b.kind,b.material,version)){errors.push('Invalid hydroponics basin.');continue;}
    const cells=footprintCells(b as unknown as Structure);
    if(cells.some(c=>{const tile=world.tiles[c.z*world.width+c.x];return c.x<0||c.z<0||c.x>=world.width||c.z>=world.height||!record(tile)||typeof tile.terrain!=='string'||['water','rock'].includes(tile.terrain);} ))errors.push('Invalid hydroponics footprint or terrain.');
    if(basins.includes(b)){
      if(Object.keys(b).some(k=>!['id','kind','x','z','orientation','footprint','material','power','damage'].includes(k))||b.damage!==undefined&&!integer(b.damage,1,179))errors.push('Invalid hydroponics building state.');
      if(basinById.has(b.id))errors.push('Duplicate hydroponics basin.');
      basinById.set(b.id,b);geometry.set(b.id,cells.map(c=>c.z*world.width+c.x).sort((a,b)=>a-b));
    }else if(Object.hasOwn(b,'power'))errors.push('Blueprint cannot supply hydroponics power.');
  }
  const linkedBasins=new Set<number>(),linkedCells=new Map<number,number>(),zoneIds=new Set<number>(),zoneCounts=new Map<number,number>();
  for(const z of zones)if(record(z)&&integer(z.id,1))zoneCounts.set(z.id,(zoneCounts.get(z.id)??0)+1);
  let occupiedIds:ValidationIdentityMembership;
  if(identities)occupiedIds=identities.hydro(world);
  else {
    const legacyIds=new Set<number>();
    for(const array of [world.pawns,world.resources,world.structures,world.jobs,world.piles,world.stockpiles])for(const v of array)legacyIds.add(v.id);
    occupiedIds=legacyIds;
  }
  for(const z of linked){
    if(!record(z))continue;
    const cells=integer(z.basinId,1,world.nextId-1)?geometry.get(z.basinId):undefined;
    if(Object.keys(z).some(k=>!['id','basinId','cells','plant','allowSow','allowCut'].includes(k))||!integer(z.id,1,world.nextId-1)||occupiedIds.has(z.id)||zoneIds.has(z.id)||zoneCounts.get(z.id)!==1
      ||!cells||linkedBasins.has(Number(z.basinId))||z.id===z.basinId||!hydroCropInVersion(String(z.plant),version)||typeof z.allowSow!=='boolean'||typeof z.allowCut!=='boolean'
      ||!Array.isArray(z.cells)||z.cells.length!==4||z.cells.some((c,i)=>!integer(c,0,world.width*world.height-1)||c!==cells[i])){errors.push('Invalid hydroponics growing zone.');continue;}
    zoneIds.add(z.id);linkedBasins.add(Number(z.basinId));for(const c of cells)linkedCells.set(c,z.id);
  }
  for(const b of basins)if(!linkedBasins.has(Number(b.id)))errors.push('Hydroponics basin lacks its unique growing zone.');
  for(const b of plans)if(integer(b.x)&&integer(b.z)&&integer(b.orientation,0,3)){
    const cells=footprintCells(b as unknown as Structure).map(c=>c.z*world.width+c.x);
    if(zones.some(z=>record(z)&&Array.isArray(z.cells)&&z.cells.some(c=>cells.includes(Number(c)))))errors.push('Growing zone overlaps hydroponics construction.');
  }
  // Native snapshot validation needs only overlapping occurrences. Index the
  // historical linear cell numbers once, including edge aliases. An occurrence
  // index (not object identity or thing ID) preserves duplicate error counts.
  // Standalone raw validation keeps its historical traversal and property reads.
  let overlapOccurrences:Map<number,number[]>|undefined;
  for(const b of basins){
    const cells=geometry.get(Number(b.id));if(!cells)continue;
    if(powerTopology){
      if(!overlapOccurrences){
        overlapOccurrences=new Map();
        for(let ordinal=0;ordinal<structures.length;ordinal++){
          const other=structures[ordinal];
          if(!record(other)||!sharesConstructionLayer('hydroponics-basin',other.kind,version)
            ||!integer(other.orientation,0,3)||!integer(other.x,0,world.width-1)||!integer(other.z,0,world.height-1))continue;
          for(const c of footprintCells(other as unknown as Structure)){
            const index=c.z*world.width+c.x,entries=overlapOccurrences.get(index);
            if(entries)entries.push(ordinal);else overlapOccurrences.set(index,[ordinal]);
          }
        }
      }
      const overlapping=new Set<number>();
      for(const cell of cells)for(const ordinal of overlapOccurrences.get(cell)??[])
        if(structures[ordinal]!==b)overlapping.add(ordinal);
      for(const _ordinal of overlapping)errors.push('Hydroponics overlaps another structure.');
    }else{
      for(const other of structures)if(record(other)&&other!==b&&sharesConstructionLayer(b.kind,other.kind,version)){
        if(!integer(other.orientation,0,3)||!integer(other.x,0,world.width-1)||!integer(other.z,0,world.height-1))continue;
        if(footprintCells(other as unknown as Structure).some(c=>cells.includes(c.z*world.width+c.x)))errors.push('Hydroponics overlaps another structure.');
      }
    }
  }
  for(const z of zones)if(record(z)&&Array.isArray(z.cells)&&z.cells.some(c=>linkedCells.has(Number(c))&&linkedCells.get(Number(c))!==z.id))errors.push('Growing zone overlaps hydroponics.');
  for(const s of world.stockpiles)if(linkedCells.has(s.z*world.width+s.x))errors.push('Storage overlaps hydroponics.');
  for(const p of world.piles)if(p.owner?.type==='ground'&&linkedCells.has(p.owner.z*world.width+p.owner.x))errors.push('Ground item overlaps hydroponics.');
  for(const p of packed)if(record(p)&&record(p.owner)&&p.owner.type==='ground'&&linkedCells.has(Number(p.owner.z)*world.width+Number(p.owner.x)))errors.push('Packed item overlaps hydroponics.');
  if(spatial?.hydroOverlapCount){
    const count=spatial.hydroOverlapCount(linkedCells);
    for(let i=0;i<count;i++)errors.push('Unsupported plant overlaps hydroponics.');
  }else for(const r of world.resources)if(linkedCells.has(r.z*world.width+r.x)&&!hydroCropInVersion(r.kind,version))errors.push('Unsupported plant overlaps hydroponics.');
  for(const j of jobs)if(record(j)&&zoneIds.has(Number(j.growingZoneId))){
    const z=linked.find(z=>record(z)&&z.id===j.growingZoneId),index=Number(j.z)*world.width+Number(j.x);
    if(!record(z)||!Array.isArray(z.cells)||!['sow','cut','harvest','chop'].includes(String(j.kind))||!integer(j.x,0,world.width-1)||!integer(j.z,0,world.height-1)
      ||!z.cells.includes(index)&&!(j.kind==='chop'&&z.cells.some(c=>Math.abs(Number(c)%world.width-Number(j.x))+Math.abs(Math.floor(Number(c)/world.width)-Number(j.z))===1)))errors.push('Invalid hydroponics growing job.');
  }
  if(!errors.length&&basins.length)errors.push(...validatePower(world,version,'hydroponics-basin',powerTopology));
  return errors;
}

export function initializeFarming(world: World): void {
  // Settle the old lighting contract once, without aging existing bushes again.
  for (const plant of world.resources) if (plant.kind === 'berries') {
    plant.growth = legacyPlantGrowth(world, plant); plant.growthTick = world.tick;
  }
  (world as unknown as { schemaVersion: number }).schemaVersion = 8; world.environment = 'temperate-equinox-v1';
  world.growingZones = []; world.growingCursor = 0;
  for (const pawn of world.pawns) pawn.priorities.grow = 2;
}

/** Guard untrusted additions before the main validator follows any references. */
export function validateFarming(input: Record<string, unknown>, size: number, ids: Set<number>): string[] {
  const errors: string[] = validateHydroponics(input as unknown as World,Number(input.schemaVersion)), occupied = new Set<number>();
  const int = (n: unknown, min: number, max = Number.MAX_SAFE_INTEGER): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= min && n <= max;
  if (input.environment !== 'temperate-equinox-v1' || !int(input.growingCursor, 0, size - 1)) errors.push('Invalid growing environment or cursor.');
  if (!Array.isArray(input.growingZones) || input.growingZones.length > size) return [...errors, 'Invalid growing zones.'];
  const zoneIds = new Set<number>();
  for (const value of input.growingZones) {
    if (!value || typeof value !== 'object') { errors.push('Invalid growing zone.'); continue; }
    const zone = value as Record<string, unknown>;
    if (!int(zone.id, 1, (input.nextId as number) - 1) || ids.has(zone.id)) errors.push('Invalid or duplicate growing zone ID.');
    else { ids.add(zone.id); zoneIds.add(zone.id); }
    if (!isGrowingPlantInVersion291(zone.plant, Number(input.schemaVersion)) || typeof zone.allowSow !== 'boolean' || typeof zone.allowCut !== 'boolean' || !Array.isArray(zone.cells) || !zone.cells.length || zone.cells.length > size) { errors.push('Invalid growing policy or cells.'); continue; }
    if(isForestrySpecies291(zone.plant)&&((Number(input.schemaVersion)!==291&&(Number(input.schemaVersion)!==292&&(Number(input.schemaVersion)!==293&&(Number(input.schemaVersion)!==294&&(Number(input.schemaVersion)!==295&&(Number(input.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(input.schemaVersion))))))))||zone.basinId!==undefined||!treeSowingUnlocked291(input as unknown as World)||!forestNativeSpecies291(input as unknown as World).includes(zone.plant)))errors.push('Locked or non-indigenous forest growing policy.');
    let previous = -1;
    for (const cell of zone.cells) {
      if (!int(cell, 0, size - 1) || cell <= previous || occupied.has(cell)) errors.push('Unordered, overlapping or invalid growing cell.');
      else {
        occupied.add(cell);
        const tile = (input.tiles as {terrain:string}[])[cell];
        if (!tile || zone.basinId===undefined&&!isGrowingTerrain(tile.terrain as Terrain)) errors.push('Growing zone on incompatible terrain.');
      }
      previous = cell as number;
    }
  }
  for (const value of input.jobs as Record<string, unknown>[]) {
    if (value.growingZoneId !== undefined && (!int(value.growingZoneId, 1) || !zoneIds.has(value.growingZoneId) || !['chop', 'cut', 'harvest', 'sow'].includes(value.kind as string))) errors.push('Invalid growing job association.');
    if (value.kind === 'sow' && value.growingZoneId === undefined && value.flowerPotId === undefined) errors.push('Sowing requires a growing zone or flower pot.');
    if (value.growingZoneId !== undefined && zoneIds.has(value.growingZoneId as number)) {
      const zone = (input.growingZones as {id:number;cells:number[]}[]).find(z=>z.id===value.growingZoneId)!;
      const cell = (value.z as number) * (input.width as number) + (value.x as number);
      if (!zone.cells.includes(cell) && !((Number(input.schemaVersion)===291||(Number(input.schemaVersion)===292||(Number(input.schemaVersion)===293||(Number(input.schemaVersion)===294||(Number(input.schemaVersion)===295||(Number(input.schemaVersion)===296||isCorePhysicalSchema297(Number(input.schemaVersion))))))))&&(value.kind==='cut'||value.kind==='chop')?zone.cells.some(c=>Math.max(Math.abs(c%(input.width as number)-(value.x as number)),Math.abs(Math.floor(c/(input.width as number))-(value.z as number)))===1):value.kind === 'chop' && zone.cells.some(c => Math.abs(c % (input.width as number) - (value.x as number)) + Math.abs(Math.floor(c / (input.width as number)) - (value.z as number)) === 1))) errors.push('Growing job outside its zone.');
    }
  }
  for (const value of input.stockpiles as Record<string, unknown>[]) if (occupied.has((value.z as number) * (input.width as number) + (value.x as number))) errors.push('Storage overlaps growing zone.');
  return errors;
}
import {developerResearchPlacement381} from './developer-import-381.ts';
