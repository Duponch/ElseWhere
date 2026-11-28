import {isConduitKind} from '../../sim/conduit-kinds-382.ts';
/** Converts a read RimWorld save into an Elsewhere World at the current
 * schema, with no new field: what Elsewhere cannot hold is adapted or left
 * out, and every such case is counted in the notes. */
import type {World,Structure,Cell,Tile,StockpileCell,GrowingZone,MaterialPile,Pawn,StructureKind,StorageFilters,MaterialKind} from '../../sim/types.ts';
import {saveCompatibility,decodeDefGrid,type RwsSave,type RwsThing,type RwsMap} from './rws-save.ts';
import {items as listItems,text,num,at,child,type XmlNode} from './xml.ts';
import {savedBytes} from './bytes.ts';
import {ImportNotes} from './notes.ts';
import {isDropped,lookup,mappingStatus} from './mapping.ts';
import {TERRAIN_MAP,ROOF_MAP,ROCK_MAP,COMPRESSED_CHUNKS,type TerrainSpec,type RockSpec} from './map-terrain.ts';
import {PLANT_MAP,DEAD_PLANT_MAP,zonePlant} from './map-plants.ts';
import {BUILDING_MAP,CONSTRUCTION_NOTE,type BuildingSpec} from './map-buildings.ts';
import {ITEM_MAP,STUFF_MAP,APPAREL_MAP,WEAPON_MAP,QUALITY_MAP} from './map-items.ts';
import {RESEARCH_MAP,STORAGE_PRIORITY,ZONE_MAP,AREA_MAP} from './map-colony.ts';
import {createBaseWorld} from './base-world.ts';
import {RwsLocalCoordinates,placeRwsFootprint,orientGeneratedImportBase} from './local-coordinates.ts';
import {importNaturalGeysers,admitImportedStructureOwner,importBuildingSnapshot,restoreImportedPowerState,importDeferredBuildingState} from './convert-building-state.ts';
import {importPeople} from './convert-pawns.ts';
import {placeRwsMaterial,placeRwsPacked,importRwsFilth,importRwsEggBoxContents,importRwsCarried,importRwsGearExtras,resolveRwsArtAuthor} from './convert-items.ts';
import {importMineableCondition,importPlantCondition,importPottedDaylily,importSnow,importDeepResources,importWeather,importThermalTemperatures} from './convert-environment.ts';
import {importHistory} from './convert-history.ts';
import {adoptRwsClock,finalizeRwsClock,reportRwsLifetimeLimits} from './import-clock.ts';
import {importRwsWorldQuests} from './import-world-quests.ts';
import {importActiveJobs} from './import-active-jobs.ts';
import {importRwsDesignations} from './import-designations.ts';
import {auditImportedReservations} from './import-reservation-audit.ts';
import {captureDeveloperImport381} from './developer-test-import.ts';
import {importAnimalJobs} from './import-animal-jobs.ts';
import {importAnimalDesignations} from './import-animal-jobs.ts';
import {importRwsCorpses} from './import-corpses.ts';
import {importRwsMechanoids} from './convert-mechanoids.ts';
import {importWorldPeople} from './import-world-people.ts';
import {importHumanSocial} from './import-human-social.ts';
import {importProductionBills,importHaulDesignations,importUnfinishedWorks} from './convert-production.ts';
import {importConstructionPlans} from './convert-construction.ts';
import {importAllowedAreas} from './convert-allowed-areas.ts';
import {footprintCells} from '../../sim/definitions.ts';
import {sharesConstructionLayer,surfacePriority382} from '../../sim/power-grid.ts';
import {occupancyOf} from '../../sim/occupancy.ts';
import {builtDoorState,isPassageDoor} from '../../sim/door-rules.ts';
import {designateRoofArea} from '../../sim/roofing.ts';
import {isElectrical,newPowerState} from '../../sim/power-rules.ts';
import {newBatteryState} from '../../sim/power-battery.ts';
import {reconcilePower} from '../../sim/power.ts';
import {newHeaterState} from '../../sim/heater.ts';
import {newCoolerState} from '../../sim/cooler.ts';
import {isFueledBuilding,newBuildingFuel} from '../../sim/fuel.ts';
import {stationRecipes} from '../../sim/production-recipes.ts';
import {newShelfStorage} from '../../sim/shelf-storage.ts';
import {initialGrave} from '../../sim/burial.ts';
import {PEN_ANIMALS,animalPenAt,invalidateAnimalPens,penAnimalsForVersion} from '../../sim/animal-pens.ts';
import {createFlowerPotState} from '../../sim/flower-pot.ts';
import {newVentState} from '../../sim/vent.ts';
import {initialSpikeTrapState} from '../../sim/spike-trap-state.ts';
import {newMiniTurretState} from '../../sim/mini-turret-state.ts';
import {newFermentationState265} from '../../sim/fermentation-state-265.ts';
import {initializeHydroponicBasin,hydroponicBasinAt} from '../../sim/hydroponics.ts';
import {hydroponicPlantAllowed} from '../../sim/farming-save.ts';
import {admitImportedNaturalBuilding,importCollapsedRock,importGatheringPolicy,importHydroponicPolicy} from './convert-natural-buildings.ts';
import {importRwsHiveOwners} from './convert-hive-owners.ts';
import {initializeFirefoamPopper290} from '../../sim/firefoam-290.ts';
import {newWindTurbineState,adoptWind} from '../../sim/wind.ts';
import {structureMaxHp} from '../../sim/thing-damage-rules.ts';
import {validConstructionMaterial,constructionMaterials,type ConstructionMaterial} from '../../sim/construction-materials.ts';
import {createWildPlantResource256} from '../../sim/wild-plant-acquisition-v256.ts';
import {createPlantLife} from '../../sim/plant-life.ts';
import {PLANT_DEFINITIONS} from '../../sim/plants.ts';
import {FLORA_DEFINITIONS} from '../../sim/biome-flora.ts';
import {conduitKeepsPlant} from '../../sim/power-construction.ts';
import {isConstructionLightPlant,constructionFinalWipesPlants} from '../../sim/construction-plants.ts';
import {addMaterial,addGroundMaterial,refreshStock,materialCanFit} from '../../sim/materials.ts';
import {ITEM_DEFINITIONS,type ItemId} from '../../sim/items.ts';
import {setMaterialForbidden256} from '../../sim/material-permission-256.ts';
import {invalidateTerrainJournal} from '../../sim/terrain-mutation-journal.ts';
import {projectProgress,readProjectProgress,researchCost,researchPrerequisite,RESEARCH_SCALE,type ResearchProject} from '../../sim/research.ts';
import {terrainBridgeable256} from '../../sim/natural-terrain-runtime-256.ts';
import {createGeographicSiteClimate256,climateDate} from '../../sim/site-climate.ts';

import type {CoreFactionNames} from '../../sim/world-faction-core-names.ts';

export interface ConvertOptions {
 /** Only the separate, explicitly enabled developer-test import path. */
 developerTest?:boolean;
 /** Rebuild the save's planet and place the colony on its tile (default true). */
 planet?:boolean;
 /** Called at the start of each conversion stage (progress display); the long
  * colony stage also reports its advance (`part`, 0..1). */
 onStage?:(stage:RwsConvertStage,part?:number)=>void;
 /** The game's name data (read by a Node tool from an installed game, never
  * stored): when the planet must be regenerated from the seed, its factions
  * and settlements are named as the game names them. */
 names?:CoreFactionNames;
}
/** Conversion stages, in order; `planet` and `colony` only with a planet. */
export type RwsConvertStage='planet'|'colony'|'terrain'|'buildings'|'plants'|'people'|'items'|'zones'|'research'|'finish';
export interface RwsConversion {world:World;notes:ImportNotes;planetMode:'save'|'seed'|'none';thingIds:Map<string,number>}

export class ImportContext {
 readonly thingIds=new Map<string,number>();
 readonly blocked=new Set<number>();
 readonly pendingChunks:{cell:number;def:string}[]=[];
 readonly coordinates:RwsLocalCoordinates;
 constructor(readonly save:RwsSave,readonly map:RwsMap,readonly w:World,readonly notes:ImportNotes,readonly geographic:boolean,readonly factionIds?:ReadonlyMap<string,number>){this.coordinates=new RwsLocalCoordinates(map.width,map.height);}
 /** Index and bounds of an already converted LOCAL cell. The source reader
  * never changes its own coordinates; use coordinates.cell/index first. */
 index(c:Cell){return c.z*this.w.width+c.x;}
 inside(c:Cell){return c.x>=0&&c.z>=0&&c.x<this.w.width&&c.z<this.w.height;}
}

/** Main entry: refuses an incompatible save with a French message. */
export function convertRwsSave(save:RwsSave,options:ConvertOptions={}):RwsConversion {
 const compatibility=saveCompatibility(save);
 if(!compatibility.ok)throw Error(compatibility.reasons.join(' '));
 const notes=new ImportNotes(),map=save.maps[0]!;
 if(save.maps.length>1){
  notes.lost('world',`${save.maps.length-1} cartes supplémentaires (camps, sites) : seule la carte de la colonie est importée.`);
  notes.def('world','Cartes secondaires','dropped',undefined,'ElseWhere possède un registre multicarte ; l’importeur RWS ne compose pas encore les cartes et leurs propriétaires secondaires.',save.maps.length-1,'importer');
 }
 const stage=options.onStage??(()=>{});
 const base=createBaseWorld(save,notes,{planet:options.planet??true,onStage:stage,...options.names?{names:options.names}:{}}),w=base.world;
 const ctx=new ImportContext(save,map,w,notes,base.planetMode!=='none',base.planet?.factionIds);
 clearLocalContent(ctx);
 adoptRwsClock(ctx);
 importCalendar(ctx);
 orientGeneratedImportBase(w,ctx.coordinates);
 stage('terrain');importTerrain(ctx);
 stage('buildings');importBuildings(ctx);
 importSnow(ctx);
 stage('plants');importPlants(ctx);
 stage('people');importPeople(ctx);
 importRwsCorpses(ctx);
 importWorldPeople(ctx);
 const localHumans=map.things.flatMap(thing=>{
  if(thing.cls!=='Pawn'||thing.def!=='Human')return [];
  const id=ctx.thingIds.get(thing.id),pawn=w.pawns.find(p=>p.id===id);
  return pawn?[{thing,pawn}]:[];
 });
 importHumanSocial(ctx,localHumans);
 importRwsMechanoids(ctx);
 importRwsHiveOwners(ctx);
 assignSculptureAuthors(ctx);
 importDeferredBuildingState(ctx);
 stage('items');importGroundItems(ctx);
 importRwsFilth(ctx);
 importRwsEggBoxContents(ctx);
 importRwsCarried(ctx);
 stage('zones');importZones(ctx);
 importAllowedAreas(ctx);
 stage('research');importResearch(ctx);
 importProductionBills(ctx,options.developerTest===true);
 importHaulDesignations(ctx);
 importUnfinishedWorks(ctx);
 importConstructionPlans(ctx);
 importRwsDesignations(ctx);
 importDeepResources(ctx);
 importWeather(ctx);
 importHistory(ctx);
 stage('finish');finalize(ctx);
 importThermalTemperatures(ctx);
 finalizeRwsClock(ctx);
 importRwsWorldQuests(ctx);
 const conversion:RwsConversion={world:w,notes,planetMode:base.planetMode,thingIds:ctx.thingIds};
 // Strict task-domain validation must see genuine evidence for the other
 // already installed test bills; they must not invalidate an unrelated
 // UNLOCKED task. This never grants research or an active locked task.
 if(options.developerTest===true)captureDeveloperImport381(conversion,false);
 importAnimalDesignations(ctx);
 importActiveJobs(ctx);
 importAnimalJobs(ctx);
 auditImportedReservations(ctx);
 reportRwsLifetimeLimits(ctx);
 // These normal command APIs restore the source intent, not new player
 // actions. Their temporary command log must not masquerade as history.
 w.events=[];
 // The explicit outer entry point separately admits & labels the final
 // candidate, after checking its ordinary validation would still refuse it.
 if(options.developerTest===true){delete w.developerTest381;delete w.developerPlacements381;}
 return conversion;
}

// ---- Emptying the generated local map ----------------------------------------------
function clearLocalContent(ctx:ImportContext):void {
 const w=ctx.w,removed=new Set(w.pawns.map(p=>p.id));
 if(w.startingArrival){
  if(w.startingArrival.phase!=='opened')for(const pod of w.startingArrival.pods)removed.add(pod.pawn.id);
  // A synthetic arrival is NOT part of the RimWorld source. Use the existing
  // non-physical crashlanded provenance rather than invent an opened receipt.
  // The geographic scenario, difficulty and map authority remain available.
  delete w.startingArrival;
  if(w.scenario?.id==='crashlanded'&&w.scenario.revision===10)w.scenario={...w.scenario,revision:9};
  ctx.notes.adapted('time','Arrivée provisoire de la colonie de conversion abandonnée ; aucun contenu généré des capsules conservé.');
 }
 w.pawns=[];w.piles=[];w.resources=[];w.structures=[];w.jobs=[];w.stockpiles=[];w.growingZones=[];w.growingCursor=0;w.packed=[];
 // Generated animals, insect groups and flying ducks belong to the generated map.
 if(w.wildlife){w.wildlife.animals=[];if(w.wildlife.hiveLords)w.wildlife.hiveLords=[];if(w.wildlife.flyers)w.wildlife.flyers=[];}
 if(w.relationships)w.relationships.links=w.relationships.links.filter(l=>!removed.has(l.aId)&&!removed.has(l.bId));
 if(w.worldGroups)w.worldGroups.lostMemories=w.worldGroups.lostMemories.filter(m=>!removed.has(m.receiverId));
 delete w.home;delete w.snowClearArea;delete w.allowedAreas;
 if(w.filth)w.filth.items=[];
 if(w.fires)w.fires.items=[];
 w.roofing={constructed:[],build:[],remove:[],cursor:0,...ctx.geographic?{natural:{thin:[],thick:[]}}:{}};
 w.events=[];
}

// ---- Terrain, rock, roofs, fog ------------------------------------------------------
function importTerrain(ctx:ImportContext):void {
 const {map,w,notes}=ctx,cells=w.width*w.height;
 const terrainNames=Object.keys(TERRAIN_MAP),top=decodeDefGrid(map.grids.terrainTop,terrainNames),under=decodeDefGrid(map.grids.terrainUnder,terrainNames);
 const rockNames=[...Object.keys(ROCK_MAP),...COMPRESSED_CHUNKS],compressed=decodeDefGrid(map.grids.compressedThings,rockNames);
 const roofs=decodeDefGrid(map.grids.roofs,Object.keys(ROOF_MAP));
 for(const [hash,count] of [...top.unknown,...under.unknown])notes.def('terrain',`#${hash}`,'unknown',undefined,'Terrain inconnu : sol naturel.',count);
 // Rock things outside the compressed grid (damaged rock, mined ore…).
 const rockThings=new Map<number,RwsThing>();
 for(const t of map.things)if(t.pos&&Object.hasOwn(ROCK_MAP,t.def))rockThings.set(ctx.index(ctx.coordinates.cell(t.pos)),t);
 const dominantStone=(()=>{const n=new Map<string,number>();for(const v of compressed.values)if(v&&ROCK_MAP[v]&&!isDropped(ROCK_MAP[v]!)&&(ROCK_MAP[v] as {to:RockSpec}).to.stone)n.set(v,(n.get(v)??0)+1);const best=[...n].sort((a,b)=>b[1]-a[1])[0]?.[0];return best?(ROCK_MAP[best] as {to:RockSpec}).to.stone!:'granite';})();
 const natural=(name:string|undefined,cell:number):{tile:Tile;status:ReturnType<typeof mappingStatus>;note?:string}=>{
  const m=lookup(TERRAIN_MAP,name);
  if(!m||isDropped(m)||m.to.kind!=='ground')return {tile:{terrain:ctx.geographic?'soil-natural':'soil-natural'},status:m?mappingStatus(m):'unknown'};
  const spec=m.to;return {tile:{terrain:spec.terrain,...spec.stone?{stone:spec.stone}:spec.terrain==='rough-stone'||spec.terrain==='smoothed-stone'?{stone:dominantStone}:{}},status:mappingStatus(m),...m.adapt?{note:m.adapt}:{}};
 };
 let floors=0,rocks=0,ores=0,bridges=0;
 for(let i=0;i<cells;i++){
  const source=ctx.coordinates.index(i),topName=top.values[source],m=lookup(TERRAIN_MAP,topName);let tile:Tile;
  if(m&&!isDropped(m)&&(m.to.kind==='floor'||m.to.kind==='bridge')){
   const base=natural(under.values[source],i).tile;
   if(m.to.kind==='floor'){tile={...base,floor:m.to.floor};floors++;}else if(terrainBridgeable256(base.terrain,w.schemaVersion)){tile={...base,bridge:true};bridges++;}else tile=base;
   if(isWaterTerrain(tile.terrain)&&m.to.kind==='floor'){delete tile.floor;}
  }else if(m&&!isDropped(m)){tile=natural(topName,i).tile;}
  else{tile=natural(under.values[source],i).tile;}
  // Natural rock and ore.
  const rockThing=rockThings.get(i),rockName=compressed.values[source]&&Object.hasOwn(ROCK_MAP,compressed.values[source]!)?compressed.values[source]:rockThing?.def;
  if(topName&&!rockName)notes.def('terrain',topName,mappingStatus(m),describeTerrain(m?.['to' as keyof typeof m] as TerrainSpec|undefined),m&&'adapt' in m?m.adapt:m&&isDropped(m)?m.drop:undefined);
  if(rockName){
   const rm=ROCK_MAP[rockName]!;
   const localAdapt=!isDropped(rm)&&!ctx.geographic&&(rm.to.collapsed||rm.to.smoothed);
   notes.def('terrain',rockName,localAdapt?'adapted':mappingStatus(rm),isDropped(rm)?undefined:rm.to.collapsed?'éboulis':rm.to.ore?`minerai ${rm.to.ore}`:`roche ${rm.to.stone}`,isDropped(rm)?rm.drop:localAdapt?'Propriétaire de roche géographique absent : roche ordinaire.':undefined);
   if(!isDropped(rm)){
    const stone=rm.to.stone??tile.stone??dominantStone,revealed=tile.terrain==='rough-stone'||tile.terrain==='smoothed-stone'?'rough-stone':isNaturalGround(tile.terrain)?tile.terrain:'rough-stone';
    if(rm.to.collapsed&&ctx.geographic){tile=importCollapsedRock(ctx,tile,rockThing);}
    else{
     tile={terrain:'rock',stone,...rm.to.ore?{ore:rm.to.ore}:{}};
     if(ctx.geographic){tile.mineable={id:w.nextId++,def:mineableDef(rm.to,stone),terrain:revealed as never};if(rm.to.smoothed)tile.smoothedWall367=true;}
     if(rockThing)importMineableCondition(ctx,tile,rockThing);
    }
    if(rockThing?.id&&tile.mineable)ctx.thingIds.set(rockThing.id,tile.mineable.id);
    if(rm.to.ore)ores++;else rocks++;
   }
  }
  w.tiles[i]=tile;
 }
 notes.mapped('terrain',`${cells} cases : ${floors} sols construits, ${bridges} ponts, ${rocks} cases de roche, ${ores} cases de minerai.`);notes.countBefore('terrain',cells);notes.countAfter('terrain',cells);
 // Chunks of the compressed grid become ordinary stone chunks on the ground.
 let chunks=0;
 for(let i=0;i<cells;i++){const name=compressed.values[ctx.coordinates.index(i)];if(name&&(COMPRESSED_CHUNKS as readonly string[]).includes(name)){ctx.pendingChunks.push({cell:i,def:name});chunks++;}}
 if(chunks)notes.mapped('items',`${chunks} morceaux de roche du sol repris.`);
 // Roofs.
 const roofing=w.roofing!,constructed:number[]=[],thin:number[]=[],thick:number[]=[];
 for(let i=0;i<cells;i++){const name=roofs.values[ctx.coordinates.index(i)];if(!name)continue;const r=lookup(ROOF_MAP,name);notes.def('roofs',name,mappingStatus(r),r&&!isDropped(r)?r.to:undefined);if(!r||isDropped(r))continue;
  if(r.to==='constructed'||!ctx.geographic)constructed.push(i);else(r.to==='thin'?thin:thick).push(i);}
 roofing.constructed=constructed;if(roofing.natural){roofing.natural.thin=thin;roofing.natural.thick=thick;}
 if(!ctx.geographic&&thin.length+thick.length===0&&roofs.values.some(v=>v==='RoofRockThin'||v==='RoofRockThick'))notes.adapted('roofs','Toits de roche : deviennent des toits construits (carte sans planète).');
 // Fog of war over undiscovered cells.
 if(map.grids.fog&&!ctx.geographic&&map.grids.fog.some(v=>v))notes.lost('terrain','Brouillard des zones inexplorées : sans planète, Elsewhere n’a pas d’exploration ; toute la carte est découverte.');
 if(map.grids.fog&&ctx.geographic){let fogged=0;for(let i=0;i<cells;i++)if(map.grids.fog[ctx.coordinates.index(i)]){w.tiles[i]!.fogged=true;fogged++;}if(fogged)notes.mapped('terrain',`${fogged} cases encore inexplorées restent dans le brouillard.`);}
 invalidateTerrainJournal(w.tiles);
}
const WATER=new Set(['water','water-shallow','water-deep','ocean-shallow','ocean-deep','river-shallow','river-chest-deep','marsh']);
const isWaterTerrain=(t:string)=>WATER.has(t);
const isNaturalGround=(t:string)=>t!=='rock'&&t!=='smoothed-stone'&&t!=='packed-dirt'&&!['grass','soil','water'].includes(t);
function mineableDef(spec:RockSpec,stone:string):never {
 const ore=spec.ore;const def=ore==='steel'?'MineableSteel':ore==='silver'?'MineableSilver':ore==='gold'?'MineableGold':ore==='uranium'?'MineableUranium':ore==='plasteel'?'MineablePlasteel':ore==='jade'?'MineableJade':ore==='machinery'?'MineableComponentsIndustrial':stone[0]!.toUpperCase()+stone.slice(1);
 return def as never;
}
function describeTerrain(spec:TerrainSpec|undefined):string|undefined {
 if(!spec)return undefined;return spec.kind==='floor'?`sol ${spec.floor}`:spec.kind==='bridge'?'pont':`${spec.terrain}${spec.stone?` (${spec.stone})`:''}`;
}

// ---- Buildings ------------------------------------------------------------------------
const BLOCKING=new Set<StructureKind>(['wall','door','autodoor','fence','fence-gate','sandbags','barricade']);
function importBuildings(ctx:ImportContext):void {
 const {map,w,notes}=ctx,occupied=new Map<number,Structure>(),attachments=new Map<number,Structure[]>();
 importNaturalGeysers(ctx);
 const structures:{thing:RwsThing;spec:BuildingSpec}[]=[];
 for(const t of map.things){
  if(!t.pos)continue;
  if(t.def==='SteamGeyser')continue;
  if(t.cls==='Frame'||t.cls.startsWith('Blueprint')){if(t.cls!=='Frame'&&t.cls!=='Blueprint_Build')notes.def('buildings',t.def,'dropped',undefined,CONSTRUCTION_NOTE);continue;}
  if(Object.hasOwn(ROCK_MAP,t.def)||Object.hasOwn(PLANT_MAP,t.def)||t.cls==='Plant'||t.cls==='Pawn'||t.cls==='Filth')continue;
  const m=lookup(BUILDING_MAP,t.def);if(!m){if(isBuildingClass(t.cls))notes.def('buildings',t.def,'unknown',undefined,'Bâtiment inconnu : non importé.');continue;}
  notes.countBefore('buildings');
  if(isDropped(m)){notes.def('buildings',t.def,'dropped',undefined,m.drop);continue;}
  structures.push({thing:t,spec:m.to});
 }
 // Walls and doors first (wall lamps need their wall), then floor buildings,
 // then independent attachments. Never replace the primary floor owner.
 const rank=(k:StructureKind)=>BLOCKING.has(k)?0:k==='wall-lamp'?2:1;
 structures.sort((a,b)=>rank(a.spec.kind)-rank(b.spec.kind));
 for(const {thing:t,spec} of structures){
  const m=BUILDING_MAP[t.def]!,placed=placeRwsFootprint(ctx.coordinates,spec.kind,t.pos!,t.rot,spec.size);
  if(!placed){notes.def('buildings',t.def,'dropped',spec.kind,'Emprise impossible à reproduire dans Elsewhere.');continue;}
  const s=buildStructure(ctx,t,spec.kind,placed);if(!s)continue;
  const cells=footprintCells(s);
  if(cells.some(c=>{
   if(!ctx.inside(c))return true;
   const i=ctx.index(c),other=occupied.get(i),tile=w.tiles[i]!;
   return tile.terrain==='rock'||isWaterTerrain(tile.terrain)&&!tile.bridge||!!other&&(spec.kind==='wall-lamp'||other.kind==='wall-lamp'?sharesConstructionLayer(other.kind,s.kind,w.schemaVersion,other.orientation,s.orientation):!isConduitKind(spec.kind)&&!isConduitKind(other.kind))||spec.kind==='wall-lamp'&&(attachments.get(i)?.some(a=>sharesConstructionLayer(a.kind,s.kind,w.schemaVersion,a.orientation,s.orientation))??false);
  })){
   notes.def('buildings',t.def,'dropped',spec.kind,spec.kind==='wall-lamp'?'Applique murale : cellule pleine, terrain incompatible ou face déjà occupée.':'Emplacement occupé ou sur roche/eau dans Elsewhere.');continue;
  }
  if(!admitImportedStructureOwner(ctx,t,s)||!admitImportedNaturalBuilding(ctx,t,s))continue;
  w.structures.push(s);for(const c of cells){const i=ctx.index(c),old=occupied.get(i);if(!old||surfacePriority382(s.kind,w.schemaVersion)>=surfacePriority382(old.kind,w.schemaVersion))occupied.set(i,s);if(s.kind==='wall-lamp'){const list=attachments.get(i);if(list)list.push(s);else attachments.set(i,[s]);}if(BLOCKING.has(spec.kind))ctx.blocked.add(i);}
  importGatheringPolicy(ctx,t,s);
  if(spec.kind==='hydroponics-basin'){initializeHydroponicBasin(w,s);importHydroponicPolicy(ctx,t,s);}
  if(spec.kind==='firefoam-popper')initializeFirefoamPopper290(w,s);
  ctx.thingIds.set(t.id,s.id);notes.countAfter('buildings');
  const adaptNote=['adapt' in m?m.adapt:undefined,placed.exact?undefined:'Orientation adaptée pour garder la même emprise.'].filter(Boolean).join(' ');
  notes.def('buildings',t.def,adaptNote?'adapted':'exact',spec.kind,adaptNote||undefined);
 }
 if(w.structures.some(s=>s.kind==='wind-turbine'))adoptWind(w);
}
const isBuildingClass=(cls:string)=>cls.startsWith('Building')||cls==='Building';
export function buildStructure(ctx:ImportContext,t:RwsThing,kind:StructureKind,placed:{x:number;z:number;orientation:0|1|2|3}):Structure|undefined {
 const w=ctx.w,s:Structure={id:w.nextId++,kind,x:placed.x,z:placed.z,orientation:isPassageDoor(kind)?0:placed.orientation,footprint:'standard'};
 // Material from stuff, validated by Elsewhere's own rules.
 const allowed=constructionMaterials(kind);
 if(allowed.length){
  const stuff=t.stuff?lookup(STUFF_MAP,t.stuff):undefined,raw=kind==='barricade'&&t.stuff?lookup(ITEM_MAP,t.stuff):undefined,wanted=raw&&!isDropped(raw)&&validConstructionMaterial(kind,raw.to,w.schemaVersion)?raw.to as ConstructionMaterial:stuff&&!isDropped(stuff)?stuff.to.construction:undefined;
  let material:ConstructionMaterial|undefined=wanted&&validConstructionMaterial(kind,wanted,w.schemaVersion)?wanted:undefined;
  if(!material){material=allowed.find(m=>validConstructionMaterial(kind,m,w.schemaVersion));if(t.stuff&&material)ctx.notes.def('buildings',`${t.def} (${t.stuff})`,'adapted',`${kind} en ${material}`,'Matière non admise pour ce bâtiment dans Elsewhere : matière par défaut.');}
  if(material)s.material=material;
 }
 const quality=t.quality?QUALITY_MAP[t.quality]:undefined;
 if(QUALITY_KINDS.has(kind))s.quality=quality??'normal';
 if(kind==='small-sculpture'||kind==='large-sculpture'){s.quality=quality??'normal';s.orientation=0;}
 if(isElectrical(kind))s.power=newPowerState(kind);
 if(kind==='battery')s.battery=newBatteryState();
 if(kind==='heater')s.heater=newHeaterState();
 if(kind==='cooler')s.cooler=newCoolerState();
 if(kind==='vent')s.vent=newVentState();
 if(kind==='wind-turbine')s.wind=newWindTurbineState();
 if(kind==='mini-turret')s.turret=newMiniTurretState();
 if(kind==='hospital-bed')s.medical=true;
 if(kind==='grave')s.grave=initialGrave();
 if(kind==='sarcophagus')s.grave={colonists:true,strangers:false};
 if(kind==='pen-marker')s.pen={accepted:[...penAnimalsForVersion(w.schemaVersion)]};
 if(kind==='flower-pot')s.flower=createFlowerPotState();
 if(kind==='fermenting-barrel')s.fermentation=newFermentationState265();
 if(kind==='spike-trap'||kind==='ied-high-explosive'||kind==='ied-incendiary')s.spikeTrap=initialSpikeTrapState(w,s);
 if(isFueledBuilding(kind))s.fuel=newBuildingFuel(kind);
 if(stationRecipes(s).length||kind==='campfire')s.bills=[];
 if(isPassageDoor(kind))s.door=builtDoorState(w,s);
 if(kind==='shelf'||kind==='small-shelf')s.shelf=newShelfStorage(footprintCells(s).map(()=>w.nextId++),w.schemaVersion);
 if(t.node&&text(t.node,'forOwnerType')==='Prisoner'&&(kind==='bed'||kind==='double-bed'||kind==='bedroll'))s.prisoner=true;
 if(text(t.node,'forOwnerType')==='Prisoner'||text(t.node,'medical')==='True')ctx.notes.def('buildings',`${t.def} (lit de prisonnier ou médical)`,'adapted',kind,'Usage du lit repris quand Elsewhere le connaît.');
 if(text(t.node,'medical')==='True'&&(kind==='bed'||kind==='double-bed'))s.medical=true;
 importBuildingSnapshot(ctx,t,s);
 // Hit points: the save's current value against Elsewhere's maximum.
 const max=structureMaxHp(s,w.schemaVersion);
 if(t.hp!==undefined&&max>0&&t.hp<max){const damage=Math.round(max-t.hp);if(damage>0)s.damage=Math.min(max-1,damage);}
 return s;
}
const QUALITY_KINDS=new Set<StructureKind>(['bed','hospital-bed','double-bed','bedroll','sarcophagus','table','stool','dining-chair','armchair','end-table','dresser','table-square','table-long','flower-pot','chess-table','billiards-table','game-of-ur-board','poker-table','table-large','double-bedroll','couch']);

/** Sculptures keep their author when the author is an imported colonist. */
function assignSculptureAuthors(ctx:ImportContext):void {
 const {w,map,notes}=ctx,byStructure=new Map<number,RwsThing>();
 for(const t of map.things){const id=ctx.thingIds.get(t.id);if(id!==undefined)byStructure.set(id,t);}
 w.structures=w.structures.filter(s=>{
  if(s.kind!=='small-sculpture'&&s.kind!=='large-sculpture')return true;
  const source=byStructure.get(s.id),match=resolveRwsArtAuthor(ctx,text(source?.node,'authorName'));
  if(!match){
   notes.def('buildings','Sculpture','dropped',s.kind,'L’auteur original ne peut pas être lié à un propriétaire local. Le modèle exige un auteur humain, aucun auteur inventé.',1,'model');
   notes.countAfter('buildings',-1);if(source)ctx.thingIds.delete(source.id);return false;
  }
  s.art={authorId:match.id,createdAt:w.tick};
  notes.def('building-state','Auteur de sculpture','exact',undefined,'Auteur local réel retrouvé par nom complet unique.');
  return true;
 });
}

// ---- Plants -----------------------------------------------------------------------------
function importPlants(ctx:ImportContext):void {
 const {map,w,notes}=ctx,taken=new Set<number>(),roofed=new Set([...w.roofing?.constructed??[],...w.roofing?.natural?.thin??[],...w.roofing?.natural?.thick??[]]);
 // Structures per cell: a plant is kept under one only where Elsewhere's own
 // rules admit it (crops over conduits, light plants under furniture that
 // keeps plants, sleeping spots, hydroponics basins).
 const pots=new Map<number,Structure>(w.structures.filter(s=>s.kind==='flower-pot').map(s=>[ctx.index(s),s]));
 const structuresAt=new Map<number,StructureKind[]>();
 for(const s of w.structures)for(const c of footprintCells(s)){const i=ctx.index(c);(structuresAt.get(i)??structuresAt.set(i,[]).get(i)!).push(s.kind);}
 const admitted=(kind:StructureKind,r:Pick<World['resources'][number],'kind'|'species'>)=>kind==='hydroponics-basin'&&!r.species||conduitKeepsPlant(kind,r.kind)||
  kind!=='flower-pot'&&isConstructionLightPlant(r)&&!constructionFinalWipesPlants(kind)||kind==='animal-sleeping-spot'||kind==='sleeping-spot'&&r.kind!=='tree';
 for(const t of map.things){
  if(!t.pos)continue;
  const dead=Object.hasOwn(DEAD_PLANT_MAP,t.def);
  if(t.cls!=='Plant'&&!dead)continue;notes.countBefore('plants');
  const m=lookup(dead?DEAD_PLANT_MAP:PLANT_MAP,t.def);if(!m||isDropped(m)){notes.def('plants',t.def,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Plante inconnue.');continue;}
  if('pot' in m.to){if(!importPottedDaylily(ctx,t,pots))notes.def('plants',t.def,'dropped',undefined,'Aucun pot de fleurs compatible à cette case.');continue;}
  const local=ctx.coordinates.cell(t.pos),i=ctx.index(local),tile=w.tiles[i]!,growth=Math.max(0,Math.min(1,num(t.node,'growth')??1));
  const probe='wild' in m.to?{kind:FLORA_DEFINITIONS[m.to.wild].kind,species:m.to.wild}:{kind:m.to.crop};
  const basin=tile.floor&&!('wild' in m.to)&&(structuresAt.get(i)??[]).includes('hydroponics-basin')?hydroponicBasinAt(w,local):undefined;
  const hydroFloor=!!basin&&hydroponicPlantAllowed(w,basin.id,{kind:probe.kind,...local});
  const conflict=taken.has(i)?'une autre plante occupe déjà la case':(structuresAt.get(i)??[]).some(k=>!admitted(k,probe))?'un bâtiment occupe la case dans Elsewhere':tile.terrain==='rock'?'la case est de la roche':tile.floor&&!hydroFloor?'la case a un sol construit':isWaterTerrain(tile.terrain)?'la case est de l’eau':undefined;
  if(conflict){notes.def('plants',t.def,'dropped',undefined,`Case incompatible : ${conflict}.`);continue;}
  let r;
  if('wild' in m.to){
   const kind=m.to.wild;
   if(!w.flora&&w.site?.revision!==3){notes.def('plants',t.def,'dropped',kind,'Plante sauvage : une carte sans planète n’a pas de flore naturelle dans Elsewhere.');continue;}
   if(roofed.has(i)&&isTree(kind)){notes.def('plants',t.def,'dropped',kind,'Arbre sous un toit : non admis dans Elsewhere.');continue;}
   r=createWildPlantResource256(w,w.nextId,local.x,local.z,kind,growth,false);
   if(!r){notes.def('plants',t.def,'dropped',kind,'Plante refusée par Elsewhere à cet endroit.');continue;}
   w.nextId++;
  }else{
   const crop=m.to.crop;r={id:w.nextId++,kind:crop,x:local.x,z:local.z,amount:PLANT_DEFINITIONS[crop].yield,growth,growthTick:w.tick} as World['resources'][number];
   r.plantLife=createPlantLife(w,r);
  }
  // Plant life clocks belong to a world with a climate; a plain map has none.
  if(!w.climate)delete r.plantLife;
  importPlantCondition(ctx,r,t);
  w.resources.push(r);taken.add(i);ctx.thingIds.set(t.id,r.id);notes.countAfter('plants');
  notes.def('plants',t.def,mappingStatus(m),'wild' in m.to?m.to.wild:m.to.crop,'adapt' in m?m.adapt:undefined);
 }
}
const TREES=new Set(['oak','poplar','pine','birch','saguaro','drago','bamboo','cecropia','cypress','maple','palm','teak','willow']);
const isTree=(s:string)=>TREES.has(s);

// ---- Items on the ground, in shelves ----------------------------------------------------
function importGroundItems(ctx:ImportContext):void {
 const {map,w,notes}=ctx;
 for(const t of map.things){
  if(!t.pos||t.cls==='Pawn'||t.cls==='Plant'||t.cls==='Filth'||isBuildingClass(t.cls)||Object.hasOwn(BUILDING_MAP,t.def)||t.cls==='Frame'||t.cls.startsWith('Blueprint')||Object.hasOwn(DEAD_PLANT_MAP,t.def)||Object.hasOwn(ROCK_MAP,t.def))continue;
  if(t.cls==='Corpse')continue; // The dedicated physical owner importer handled it.
  if(t.cls==='RectTrigger'||t.cls.startsWith('SignalAction'))continue;
  if(t.cls==='UnfinishedThing'||t.def.startsWith('Unfinished'))continue; // Deferred until real bill identities have been rebound.
  const local=ctx.coordinates.cell(t.pos);
  if(t.def==='MinifiedThing'){placeRwsPacked(ctx,t,{type:'ground',...local});continue;}
  if(Object.hasOwn(APPAREL_MAP,t.def)||Object.hasOwn(WEAPON_MAP,t.def)){placeGear(ctx,t,{type:'ground',...local});continue;}
  placeRwsMaterial(ctx,t,{type:'ground',...local});
 }
 for(const c of ctx.pendingChunks.splice(0)){const owner={type:'ground' as const,x:c.cell%w.width,z:Math.floor(c.cell/w.width)};placeRwsMaterial(ctx,{def:c.def,id:'',cls:'',pos:null,rot:0,stack:1,forbidden:false,node:{name:'thing',text:'',children:[],attrs:{}}},owner);}
 refreshStock(w);
}
function canAdd(w:World,cell:Cell,item:ItemId):boolean {
 const t=w.tiles[cell.z*w.width+cell.x];if(!t||t.terrain==='rock'||WATER.has(t.terrain))return false;
 const shelf=w.structures.some(s=>s.shelf&&footprintCells(s).some(c=>c.x===cell.x&&c.z===cell.z));
 return shelf||!w.piles.some(p=>p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z&&p.item!==item);
}
/** Apparel or weapon pile with stuff, quality and hit points. */
export function placeGear(ctx:ImportContext,t:RwsThing,owner:MaterialPile['owner']):MaterialPile|undefined {
 const {w,notes}=ctx,isApparel=Object.hasOwn(APPAREL_MAP,t.def),family=isApparel?'apparel':'weapons';notes.countBefore(family);
 const resolved=isApparel?resolveApparel(t):resolveWeapon(t);
 if('drop' in resolved){notes.def(family,t.def,resolved.status,undefined,resolved.drop);return undefined;}
 // ResourceVerbBase horns stack in Core. Our weapon owner is individual;
 // preserve the actual count as distinct objects, with reported adaptation.
 const quantity=t.def==='ThrumboHorn'&&owner.type!=='equipment'&&owner.type!=='apparel'?t.stack:1;
 const before=w.piles.length;
 try{
  if(owner.type==='ground'&&!(canAdd(w,owner,resolved.item as ItemId)&&materialCanFit(w,isApparel?'apparel':'weapon',quantity,owner,resolved.item as ItemId)))addGroundMaterial(w,isApparel?'apparel':'weapon',quantity,owner,resolved.item as ItemId);
  else addMaterial(w,isApparel?'apparel':'weapon',quantity,owner,resolved.item as ItemId);
 }catch(error){notes.def(family,t.def,'dropped',resolved.item,`Refusé par Elsewhere (${error instanceof Error?error.message.slice(0,80):''}).`);return undefined;}
 const pile=w.piles.slice(before).find(p=>p.item===resolved.item)??w.piles.at(-1)!;
 const quality=t.quality?QUALITY_MAP[t.quality]:undefined;
 const state=pile.apparel??pile.weapon;
 if(state){if(quality)state.quality=quality;if(t.hp!==undefined){const max=state.hitPoints;state.hitPoints=Math.max(1,Math.min(max,Math.round(t.hp)));}}
 if(quantity>1)for(const horn of w.piles.slice(before)){if(horn.item!=='thrumbo-horn'||!horn.weapon)continue;horn.weapon.hitPoints=pile.weapon!.hitPoints;if(t.forbidden&&horn.owner.type==='ground')setMaterialForbidden256(horn,true);}
 if(pile.apparel&&text(t.node,'wornByCorpse')==='True'&&'corpseWear284' in pile.apparel)pile.apparel.corpseWear284=true;
 importRwsGearExtras(ctx,t,pile);
 if(t.forbidden&&owner.type==='ground')setMaterialForbidden256(pile,true);
 ctx.thingIds.set(t.id,pile.id);notes.countAfter(family);
 notes.def(family,t.stuff?`${t.def} (${t.stuff})`:t.def,resolved.note||quantity>1?'adapted':'exact',resolved.item,quantity>1?'Pile Core de cornes conservée sous formes de cornes individuelles ; références et regroupement ne sont pas identiques.':resolved.note);
 return pile;
}
type Resolved={item:string;note?:string}|{drop:string;status:'dropped'|'unknown'};
export function resolveApparel(t:RwsThing):Resolved {
 const m=lookup(APPAREL_MAP,t.def);if(!m)return {drop:'Vêtement inconnu.',status:'unknown'};if(isDropped(m))return {drop:m.drop,status:'dropped'};
 const notes:string[]=m.adapt?[m.adapt]:[],stuff=t.stuff?lookup(STUFF_MAP,t.stuff):undefined;
 if('item' in m.to){
  if(t.def==='Apparel_AdvancedHelmet'&&t.stuff==='Plasteel')return {item:'plasteel-flak-helmet'};
  if(t.def==='Apparel_AdvancedHelmet'&&t.stuff&&t.stuff!=='Steel')notes.push('Matière de casque non représentée : acier.');
  return {item:m.to.item,...notes.length?{note:notes.join(' ')}:{}};
 }
 if('armor' in m.to){
  let metal=stuff&&!isDropped(stuff)?stuff.to.metal:undefined;
  if(!metal||m.to.armor==='simple-helmet'&&metal==='wood'){notes.push('Matière d’armure absente : acier.');metal='steel';}
  return {item:`${metal}-${m.to.armor}`,...notes.length?{note:notes.join(' ')}:{}};
 }
 let material=stuff&&!isDropped(stuff)?stuff.to.apparel:undefined;if(stuff&&!isDropped(stuff)&&stuff.adapt)notes.push(stuff.adapt);
 if(!material){notes.push(`Matière ${t.stuff??'inconnue'} absente pour ce vêtement : tissu.`);material='cloth';}
 const family=m.to.family;
 if(family==='tuque'&&!['cloth','muffalo-wool','alpaca-wool','bison-wool','megasloth-wool','devilstrand'].includes(material)){notes.push('Tuque en cuir : devient en tissu.');material='cloth';}
 return {item:`${material}-${family}`,...notes.length?{note:notes.join(' ')}:{}};
}
export function resolveWeapon(t:RwsThing):Resolved {
 if(t.def==='MeleeWeapon_Knife'&&t.stuff==='Plasteel')return {item:'plasteel-knife'};
 const m=lookup(WEAPON_MAP,t.def);if(!m)return {drop:'Arme inconnue.',status:'unknown'};if(isDropped(m))return {drop:m.drop,status:'dropped'};
 const notes:string[]=m.adapt?[m.adapt]:[];if('item' in m.to)return {item:m.to.item,...notes.length?{note:notes.join(' ')}:{}};
 const stuff=t.stuff?lookup(STUFF_MAP,t.stuff):undefined;let metal=stuff&&!isDropped(stuff)?stuff.to.metal:undefined;
 if(!metal){notes.push(`Matière ${t.stuff??'inconnue'} absente pour cette arme : acier.`);metal='steel';}
 return {item:`${metal}-${m.to.family}`,...notes.length?{note:notes.join(' ')}:{}};
}

// ---- Zones and areas ------------------------------------------------------------------------
import {storageSettingsFromCore as storageSettings} from './colony-filters.ts';
function importZones(ctx:ImportContext):void {
 const {map,w,notes}=ctx,used=new Set<number>();
 const storageBlocked=new Set(w.structures.flatMap(s=>occupancyOf(s.kind)?.zones===false?footprintCells(s).map(c=>ctx.index(c)):[]));
 const parseCell=(s:string)=>{const m=/\(\s*(-?\d+)\s*,\s*-?\d+\s*,\s*(-?\d+)\s*\)/.exec(s);return m?{x:Number(m[1]),z:Number(m[2])}:undefined;};
 for(const zone of map.zones){
  const cls=zone.attrs?.Class??'',m=lookup(ZONE_MAP,cls),label=text(zone,'label')??cls;
  notes.countBefore('zones');
  if(!m||isDropped(m)){notes.def('zones',cls,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Zone inconnue.');continue;}
  const cells=listItems(zone,'cells').map(n=>parseCell(n.text)).filter((c):c is Cell=>!!c&&ctx.inside(c)).map(c=>ctx.coordinates.cell(c));
  if(m.to==='stockpile'){
   const settings=storageSettings(child(zone,'settings'))??{filters:{wood:true,food:true},items:{},priority:2};
   let zoneId:number|undefined,kept=0;
   for(const c of cells){const i=ctx.index(c),tile=w.tiles[i]!;if(used.has(i)||storageBlocked.has(i)||tile.terrain==='rock'||WATER.has(tile.terrain))continue;
    const id=w.nextId++;zoneId??=id;const cell:StockpileCell={...settings,id,x:c.x,z:c.z,filters:{...settings.filters},priority:settings.priority,capacity:ITEM_DEFINITIONS.silver.stackLimit,zoneId,items:{...settings.items}};
    w.stockpiles.push(cell);used.add(i);kept++;}
   notes.def('zones',cls,kept===cells.length?'exact':'adapted','zone de stockage',kept===cells.length?undefined:`${cells.length-kept} cases sur ${cells.length} non admises (mur, roche, eau).`);
   if(kept)notes.countAfter('zones');
  }else{
   const plant=zonePlant(text(zone,'plantDefToGrow'));
   if(!plant||isDropped(plant)){notes.def('zones',`${cls} (${text(zone,'plantDefToGrow')??'?'})`,'dropped',undefined,plant&&isDropped(plant)?`Champ abandonné : ${plant.drop}`:'Plante du champ inconnue.');continue;}
   const allowSow=text(zone,'allowSow')!=='False',allowCut=text(zone,'allowCut')!=='False';
   // Zone membership is separate from present surface occupation. The
   // grower planner will not sow on a fixed obstacle or harvest sterile
   // grass in a sow-disabled plot; keep the actual saved area.
   const ok=cells.map(c=>ctx.index(c)).filter(i=>!used.has(i)&&!storageBlocked.has(i)&&!w.tiles[i]!.floor&&w.tiles[i]!.terrain!=='rock'&&!WATER.has(w.tiles[i]!.terrain));
   if(!ok.length){notes.def('zones',cls,'dropped',undefined,'Aucune case cultivable.');continue;}
   for(const i of ok)used.add(i);
   const zoneRow:GrowingZone={id:w.nextId++,cells:ok.sort((a,b)=>a-b),plant:plant.to,allowSow,allowCut};
   w.growingZones.push(zoneRow);notes.countAfter('zones');
   notes.def('zones',`${cls} (${text(zone,'plantDefToGrow')})`,plant.adapt||ok.length<cells.length?'adapted':'exact',`champ ${plant.to}`,[plant.adapt,ok.length<cells.length?`${cells.length-ok.length} cases non cultivables retirées.`:undefined].filter(Boolean).join(' ')||undefined);
  }
 }
 // Shelves keep their storage settings.
 for(const t of map.things){
  if(t.def!=='Shelf'&&t.def!=='ShelfSmall')continue;const id=ctx.thingIds.get(t.id),s=w.structures.find(x=>x.id===id);if(!s?.shelf)continue;
  const settings=storageSettings(child(t.node,'settings'));if(!settings)continue;
  s.shelf.settings={...s.shelf.settings,...settings,filters:{...settings.filters},items:{...settings.items}};
 }
 // Areas.
 for(const area of map.areas){
  const cls=area.attrs?.Class??'',m=lookup(AREA_MAP,cls);
  if(!m||isDropped(m)){notes.def('zones',cls,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Aire inconnue.');continue;}
  const grid=child(area,'innerGrid'),deflated=child(grid,'arrDeflate'),plain=child(grid,'arr');
  if(!deflated&&!plain){continue;}
  const bytes=savedBytes((deflated??plain)!.text,!!deflated),cells:number[]=[];
  for(let i=0;i<w.width*w.height;i++){const source=ctx.coordinates.index(i);if((bytes[source>>3]??0)>>(source&7)&1)cells.push(i);}
  if(m.to==='home'){if(cells.length)w.home=cells;notes.def('zones',cls,'exact',`zone domestique (${cells.length} cases)`);}
  else if(m.to==='snow-clear'){if(cells.length){w.snowClearArea=cells;notes.def('zones',cls,'exact','zone de déneigement');}}
  else if(m.to==='build-roof'||m.to==='remove-roof'){designateRoofArea(w,cells,m.to);notes.def('zones',cls,'exact',`${m.to==='build-roof'?'zone à couvrir':'zone sans toit'} (${cells.length} cases)`);}
  else if(m.to!=='allowed')notes.def('zones',`${cls} ${text(area,'label')??''}`.trim(),'dropped',undefined,'Aire personnalisée non représentable.');
 }
}

// ---- Research -------------------------------------------------------------------------------
function importResearch(ctx:ImportContext):void {
 const {save,w,notes}=ctx;
 // Replace all provisional starting research with the actual source. Never
 // retain the synthetic ClassicStart grant after importing a nonclassic or
 // a partially researched colony. A source without points is genuinely locked.
 w.research={project:null,points:0,...w.schemaVersion>=382?{electricity:{points:0},passiveCooler:{points:0}}:{}};
 const progress=new Map<ResearchProject,{points:number;def:string}>();
 for(const [def,points] of save.research.progress){
  if(points<=0)continue;const m=lookup(RESEARCH_MAP,def);notes.countBefore('research');
  if(!m||isDropped(m)){notes.def('research',def,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Projet inconnu.');continue;}
  progress.set(m.to,{points,def});
 }
 // Prerequisites first: repeat until nothing more can be set.
 let changed=true;const done=new Set<ResearchProject>();
 while(changed){changed=false;
  for(const [project,{points,def}] of progress){
   if(done.has(project))continue;
   const cost=researchCost(project),scaled=Math.round(points*RESEARCH_SCALE);
   const complete=scaled>=cost;
   if(researchPrerequisite(w,project)!==undefined)continue;
   const record=projectProgress(w.research,project);
   if(complete){record.points=cost;record.completedAt=w.tick;}else record.points=Math.min(cost-1,scaled);
   done.add(project);changed=true;notes.countAfter('research');
   notes.def('research',def,'exact',project+(complete?' (terminé)':' (en cours)'));
  }
 }
 for(const [project,{def}] of progress)if(!done.has(project))notes.def('research',def,'dropped',project,'Prérequis d’Elsewhere non terminés : progrès non repris.');
 const current=save.research.current?lookup(RESEARCH_MAP,save.research.current):undefined;
 if(current&&!isDropped(current)&&researchPrerequisite(w,current.to)===undefined&&readProjectProgress(w.research,current.to)?.completedAt===undefined){
  // Selecting a project with no accrued points is itself real source state.
  projectProgress(w.research,current.to);w.research.project=current.to;
 }
}

// ---- Calendar ---------------------------------------------------------------------------------
function importCalendar(ctx:ImportContext):void {
 const {save,w,notes}=ctx,absCore=save.gameStartAbsTick+save.ticksGame;
 if(!ctx.geographic||!w.worldMaps||w.climate?.revision!==4||w.planet?.revision!==3){notes.lost('time','Date de la sauvegarde non reprise (carte sans planète) : calendrier d’Elsewhere par défaut.');return;}
 const civil=Math.floor(absCore/10);
 // Anchor so that the local clock now reads the save's absolute date.
 const anchor=civil-w.tick;
 try{
  const before={maps:w.worldMaps.calendarOrigin,climate:w.climate.calendarOrigin};
  w.worldMaps.calendarOrigin=anchor;
  const climate=createGeographicSiteClimate256(w.planet,w.climate.tileId,{tick:w.climate.adoptedAt,calendarOrigin:anchor});
  w.climate.calendarOrigin=climate.calendarOrigin;
  const date=climateDate(w),quadrums=['Aprimay','Jugust','Septober','Decembary'];
  notes.mapped('time',`Date reprise : jour ${date.day} de ${quadrums[date.quadrum]??date.quadrum}, année ${date.year} (${Math.floor(save.ticksGame/60000)} jours de jeu dans la sauvegarde ; ancre du calendrier ${before.maps} → ${anchor}).`);
  notes.def('time','Date du calendrier','exact',`${date.day} ${quadrums[date.quadrum]??date.quadrum} ${date.year}`);
 }catch(error){notes.lost('time',`Date non reprise (${error instanceof Error?error.message:String(error)}).`);}
}

// ---- Final reconciliation -----------------------------------------------------------------------
function finalize(ctx:ImportContext):void {
 const w=ctx.w;
 refreshStock(w);reconcilePower(w);restoreImportedPowerState(ctx);invalidateTerrainJournal(w.tiles);
 if(w.home)w.home=[...new Set(w.home)].sort((a,b)=>a-b);
 assignImportedPens(w);
}
/** RimWorld saves no pen assignment: a roamer standing in an enclosed pen
 * belongs to it (AnimalPenUtility.GetCurrentPenOf). Elsewhere keeps that
 * membership in domestic.penMarkerId, which holds the animal inside its pen;
 * without it an imported herd walked out whenever the gate opened. */
export function assignImportedPens(w:World):void {
 invalidateAnimalPens(w);
 for(const a of w.wildlife?.animals??[]){
  if(!a.domestic||a.domestic.penMarkerId!==undefined||!PEN_ANIMALS.includes(a.species))continue;
  const pen=animalPenAt(w,a.x,a.z);if(!pen?.closed)continue;
  const marker=w.structures.find(s=>s.id===pen.markerId);
  if(marker?.pen?.accepted.includes(a.species))a.domestic.penMarkerId=pen.markerId;
 }
}
