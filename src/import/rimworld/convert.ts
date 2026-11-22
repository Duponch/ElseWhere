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
import {importPeople} from './convert-pawns.ts';
import {footprintCells} from '../../sim/definitions.ts';
import {builtDoorState,isPassageDoor} from '../../sim/door-rules.ts';
import {isElectrical,newPowerState} from '../../sim/power-rules.ts';
import {newBatteryState} from '../../sim/power-battery.ts';
import {reconcilePower} from '../../sim/power.ts';
import {newHeaterState} from '../../sim/heater.ts';
import {newCoolerState} from '../../sim/cooler.ts';
import {isFueledBuilding,newBuildingFuel,fuelLimit} from '../../sim/fuel.ts';
import {stationRecipes} from '../../sim/production-recipes.ts';
import {newShelfStorage} from '../../sim/shelf-storage.ts';
import {initialGrave} from '../../sim/burial.ts';
import {penAnimalsForVersion} from '../../sim/animal-pens.ts';
import {createFlowerPotState} from '../../sim/flower-pot.ts';
import {newVentState} from '../../sim/vent.ts';
import {initialSpikeTrapState} from '../../sim/spike-trap-state.ts';
import {newMiniTurretState} from '../../sim/mini-turret-state.ts';
import {newFermentationState265} from '../../sim/fermentation-state-265.ts';
import {initializeHydroponicBasin} from '../../sim/hydroponics.ts';
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
 constructor(readonly save:RwsSave,readonly map:RwsMap,readonly w:World,readonly notes:ImportNotes,readonly geographic:boolean){}
 index(c:Cell){return c.z*this.w.width+c.x;}
 inside(c:Cell){return c.x>=0&&c.z>=0&&c.x<this.w.width&&c.z<this.w.height;}
}

/** Main entry: refuses an incompatible save with a French message. */
export function convertRwsSave(save:RwsSave,options:ConvertOptions={}):RwsConversion {
 const compatibility=saveCompatibility(save);
 if(!compatibility.ok)throw Error(compatibility.reasons.join(' '));
 const notes=new ImportNotes(),map=save.maps[0]!;
 if(save.maps.length>1)notes.lost('world',`${save.maps.length-1} cartes supplémentaires (camps, sites) : seule la carte de la colonie est importée.`);
 const stage=options.onStage??(()=>{});
 const base=createBaseWorld(save,notes,{planet:options.planet??true,onStage:stage,...options.names?{names:options.names}:{}}),w=base.world;
 const ctx=new ImportContext(save,map,w,notes,base.planetMode!=='none');
 clearLocalContent(ctx);
 stage('terrain');importTerrain(ctx);
 stage('buildings');importBuildings(ctx);
 stage('plants');importPlants(ctx);
 stage('people');importPeople(ctx);
 assignSculptureAuthors(ctx);
 stage('items');importGroundItems(ctx);
 stage('zones');importZones(ctx);
 stage('research');importResearch(ctx);
 importCalendar(ctx);
 stage('finish');finalize(ctx);
 return {world:w,notes,planetMode:base.planetMode,thingIds:ctx.thingIds};
}

// ---- Emptying the generated local map ----------------------------------------------
function clearLocalContent(ctx:ImportContext):void {
 const w=ctx.w,removed=new Set(w.pawns.map(p=>p.id));
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
 const rockThings=new Map<number,string>();
 for(const t of map.things)if(t.pos&&Object.hasOwn(ROCK_MAP,t.def))rockThings.set(ctx.index(t.pos),t.def);
 const dominantStone=(()=>{const n=new Map<string,number>();for(const v of compressed.values)if(v&&ROCK_MAP[v]&&!isDropped(ROCK_MAP[v]!)&&(ROCK_MAP[v] as {to:RockSpec}).to.stone)n.set(v,(n.get(v)??0)+1);const best=[...n].sort((a,b)=>b[1]-a[1])[0]?.[0];return best?(ROCK_MAP[best] as {to:RockSpec}).to.stone!:'granite';})();
 const natural=(name:string|undefined,cell:number):{tile:Tile;status:ReturnType<typeof mappingStatus>;note?:string}=>{
  const m=lookup(TERRAIN_MAP,name);
  if(!m||isDropped(m)||m.to.kind!=='ground')return {tile:{terrain:ctx.geographic?'soil-natural':'soil-natural'},status:m?mappingStatus(m):'unknown'};
  const spec=m.to;return {tile:{terrain:spec.terrain,...spec.stone?{stone:spec.stone}:spec.terrain==='rough-stone'||spec.terrain==='smoothed-stone'?{stone:dominantStone}:{}},status:mappingStatus(m),...m.adapt?{note:m.adapt}:{}};
 };
 let floors=0,rocks=0,ores=0,bridges=0;
 for(let i=0;i<cells;i++){
  const topName=top.values[i],m=lookup(TERRAIN_MAP,topName);let tile:Tile;
  if(m&&!isDropped(m)&&(m.to.kind==='floor'||m.to.kind==='bridge')){
   const base=natural(under.values[i],i).tile;
   if(m.to.kind==='floor'){tile={...base,floor:m.to.floor};floors++;}else if(terrainBridgeable256(base.terrain,w.schemaVersion)){tile={...base,bridge:true};bridges++;}else tile=base;
   if(isWaterTerrain(tile.terrain)&&m.to.kind==='floor'){delete tile.floor;}
  }else if(m&&!isDropped(m)){tile=natural(topName,i).tile;}
  else{tile=natural(under.values[i],i).tile;}
  // Natural rock and ore.
  const rockName=compressed.values[i]&&Object.hasOwn(ROCK_MAP,compressed.values[i]!)?compressed.values[i]:rockThings.get(i);
  if(topName&&!rockName)notes.def('terrain',topName,mappingStatus(m),describeTerrain(m?.['to' as keyof typeof m] as TerrainSpec|undefined),m&&'adapt' in m?m.adapt:m&&isDropped(m)?m.drop:undefined);
  if(rockName){
   const rm=ROCK_MAP[rockName]!;notes.def('terrain',rockName,mappingStatus(rm),isDropped(rm)?undefined:rm.to.ore?`minerai ${rm.to.ore}`:`roche ${rm.to.stone}`,isDropped(rm)?rm.drop:undefined);
   if(!isDropped(rm)){
    const stone=rm.to.stone??tile.stone??dominantStone,revealed=tile.terrain==='rough-stone'||tile.terrain==='smoothed-stone'?'rough-stone':isNaturalGround(tile.terrain)?tile.terrain:'rough-stone';
    tile={terrain:'rock',stone,...rm.to.ore?{ore:rm.to.ore}:{}};
    if(ctx.geographic)tile.mineable={id:w.nextId++,def:mineableDef(rm.to,stone),terrain:revealed as never};
    if(rm.to.ore)ores++;else rocks++;
   }
  }
  w.tiles[i]=tile;
 }
 notes.mapped('terrain',`${cells} cases : ${floors} sols construits, ${bridges} ponts, ${rocks} cases de roche, ${ores} cases de minerai.`);notes.countBefore('terrain',cells);notes.countAfter('terrain',cells);
 // Chunks of the compressed grid become ordinary stone chunks on the ground.
 let chunks=0;
 for(let i=0;i<cells;i++){const name=compressed.values[i];if(name&&(COMPRESSED_CHUNKS as readonly string[]).includes(name)){ctx.pendingChunks.push({cell:i,def:name});chunks++;}}
 if(chunks)notes.mapped('items',`${chunks} morceaux de roche du sol repris.`);
 // Roofs.
 const roofing=w.roofing!,constructed:number[]=[],thin:number[]=[],thick:number[]=[];
 for(let i=0;i<cells;i++){const name=roofs.values[i];if(!name)continue;const r=lookup(ROOF_MAP,name);notes.def('roofs',name,mappingStatus(r),r&&!isDropped(r)?r.to:undefined);if(!r||isDropped(r))continue;
  if(r.to==='constructed'||!ctx.geographic)constructed.push(i);else(r.to==='thin'?thin:thick).push(i);}
 roofing.constructed=constructed;if(roofing.natural){roofing.natural.thin=thin;roofing.natural.thick=thick;}
 if(!ctx.geographic&&thin.length+thick.length===0&&roofs.values.some(v=>v==='RoofRockThin'||v==='RoofRockThick'))notes.adapted('roofs','Toits de roche : deviennent des toits construits (carte sans planète).');
 // Fog of war over undiscovered cells.
 if(map.grids.fog&&!ctx.geographic&&map.grids.fog.some(v=>v))notes.lost('terrain','Brouillard des zones inexplorées : sans planète, Elsewhere n’a pas d’exploration ; toute la carte est découverte.');
 if(map.grids.fog&&ctx.geographic){let fogged=0;for(let i=0;i<cells;i++)if(map.grids.fog[i]){w.tiles[i]!.fogged=true;fogged++;}if(fogged)notes.mapped('terrain',`${fogged} cases encore inexplorées restent dans le brouillard.`);}
 if(map.grids.snow&&map.grids.snow.some(v=>v>0))notes.lost('terrain','Neige au sol : non reprise (elle se reformera avec la météo).');
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
const ROT_DIR=[[0,1],[1,0],[0,-1],[-1,0]] as const;
/** Cells the game's building covers (size at rotation North, centre position). */
function coreOccupied(pos:Cell,rot:number,size:readonly [number,number]):Cell[] {
 let w=size[0],d=size[1],cx=pos.x,cz=pos.z;
 if(w===1&&d===1)return [{x:cx,z:cz}];
 if(rot===1||rot===3)[w,d]=[d,w];
 const adjust:readonly (readonly [number,number])[]=[[0,0],[0,-1],[-1,-1],[-1,0]];const [ax,az]=adjust[rot&3]!;
 if(w%2===0)cx+=ax;if(d%2===0)cz+=az;
 const minX=cx-Math.floor((w-1)/2),minZ=cz-Math.floor((d-1)/2),out:Cell[]=[];
 for(let z=0;z<d;z++)for(let x=0;x<w;x++)out.push({x:minX+x,z:minZ+z});return out;
}
const cellKey=(c:Cell)=>`${c.x},${c.z}`;
function placeFootprint(kind:StructureKind,pos:Cell,rot:number,size:readonly [number,number]):{x:number;z:number;orientation:0|1|2|3;exact:boolean}|undefined {
 const target=new Set(coreOccupied(pos,rot,size).map(cellKey)),orientations=[rot&3,...[0,1,2,3].filter(o=>o!==(rot&3))] as (0|1|2|3)[];
 const candidates=[...target].map(k=>{const [x,z]=k.split(',').map(Number);return {x:x!,z:z!};});
 for(const o of orientations)for(const c of [pos,...candidates]){
  const cells=footprintCells({kind,x:c.x,z:c.z,orientation:o,footprint:'standard'} as never);
  if(cells.length===target.size&&cells.every(cell=>target.has(cellKey(cell))))return {x:c.x,z:c.z,orientation:o,exact:o===(rot&3)};
 }
 return undefined;
}
const BLOCKING=new Set<StructureKind>(['wall','door','autodoor','fence','fence-gate','sandbags']);
function importBuildings(ctx:ImportContext):void {
 const {map,w,notes}=ctx,occupied=new Map<number,Structure>();
 const structures:{thing:RwsThing;spec:BuildingSpec}[]=[];
 for(const t of map.things){
  if(!t.pos)continue;
  if(t.cls==='Frame'||t.cls.startsWith('Blueprint')){notes.def('buildings',t.def,'dropped',undefined,CONSTRUCTION_NOTE);continue;}
  if(Object.hasOwn(ROCK_MAP,t.def)||Object.hasOwn(PLANT_MAP,t.def)||t.cls==='Plant'||t.cls==='Pawn'||t.cls==='Filth')continue;
  const m=lookup(BUILDING_MAP,t.def);if(!m){if(isBuildingClass(t.cls))notes.def('buildings',t.def,'unknown',undefined,'Bâtiment inconnu : non importé.');continue;}
  notes.countBefore('buildings');
  if(isDropped(m)){notes.def('buildings',t.def,'dropped',undefined,m.drop);continue;}
  structures.push({thing:t,spec:m.to});
 }
 // Walls and doors first (wall lamps need their wall), wall lamps last: in
 // the game they hang over furniture, in Elsewhere they take their cell.
 const rank=(k:StructureKind)=>BLOCKING.has(k)?0:k==='wall-lamp'?2:1;
 structures.sort((a,b)=>rank(a.spec.kind)-rank(b.spec.kind));
 for(const {thing:t,spec} of structures){
  const m=BUILDING_MAP[t.def]!,placed=placeFootprint(spec.kind,t.pos!,t.rot,spec.size);
  if(!placed){notes.def('buildings',t.def,'dropped',spec.kind,'Emprise impossible à reproduire dans Elsewhere.');continue;}
  const s=buildStructure(ctx,t,spec.kind,placed);if(!s)continue;
  const cells=footprintCells(s);
  if(cells.some(c=>!ctx.inside(c)||occupied.has(ctx.index(c))&&spec.kind!=='power-conduit'&&occupied.get(ctx.index(c))!.kind!=='power-conduit'||w.tiles[ctx.index(c)]!.terrain==='rock'||isWaterTerrain(w.tiles[ctx.index(c)]!.terrain)&&!w.tiles[ctx.index(c)]!.bridge)){
   notes.def('buildings',t.def,'dropped',spec.kind,spec.kind==='wall-lamp'?'Lampe murale au-dessus d’un meuble : Elsewhere ne superpose pas une lampe et un meuble ; lampe omise.':'Emplacement occupé ou sur roche/eau dans Elsewhere.');continue;
  }
  w.structures.push(s);for(const c of cells){if(spec.kind!=='power-conduit'||!occupied.has(ctx.index(c)))occupied.set(ctx.index(c),s);if(BLOCKING.has(spec.kind))ctx.blocked.add(ctx.index(c));}
  if(spec.kind==='hydroponics-basin')initializeHydroponicBasin(w,s);
  if(spec.kind==='firefoam-popper')initializeFirefoamPopper290(w,s);
  ctx.thingIds.set(t.id,s.id);notes.countAfter('buildings');
  const adaptNote=['adapt' in m?m.adapt:undefined,placed.exact?undefined:'Orientation adaptée pour garder la même emprise.'].filter(Boolean).join(' ');
  notes.def('buildings',t.def,adaptNote?'adapted':'exact',spec.kind,adaptNote||undefined);
 }
 if(w.structures.some(s=>s.kind==='wind-turbine'))adoptWind(w);
}
const isBuildingClass=(cls:string)=>cls.startsWith('Building')||cls==='Building';
function buildStructure(ctx:ImportContext,t:RwsThing,kind:StructureKind,placed:{x:number;z:number;orientation:0|1|2|3}):Structure|undefined {
 const w=ctx.w,s:Structure={id:w.nextId++,kind,x:placed.x,z:placed.z,orientation:isPassageDoor(kind)?0:placed.orientation,footprint:'standard'};
 // Material from stuff, validated by Elsewhere's own rules.
 const allowed=constructionMaterials(kind);
 if(allowed.length){
  const stuff=t.stuff?lookup(STUFF_MAP,t.stuff):undefined,wanted=stuff&&!isDropped(stuff)?stuff.to.construction:undefined;
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
 if(isFueledBuilding(kind)){s.fuel=newBuildingFuel(kind);const saved=num(t.node,'fuel');if(saved!==undefined&&saved>0)s.fuel.ticks=Math.min(fuelLimit(kind),Math.max(s.fuel.ticks,Math.round(fuelLimit(kind)*Math.min(1,saved/fuelCapacity(kind)))));}
 if(stationRecipes(s).length||kind==='campfire')s.bills=[];
 if(isPassageDoor(kind))s.door=builtDoorState(w,s);
 if(kind==='shelf'||kind==='small-shelf')s.shelf=newShelfStorage(footprintCells(s).map(()=>w.nextId++),w.schemaVersion);
 if(t.node&&text(t.node,'forOwnerType')==='Prisoner'&&(kind==='bed'||kind==='double-bed'||kind==='bedroll'))s.prisoner=true;
 if(text(t.node,'forOwnerType')==='Prisoner'||text(t.node,'medical')==='True')ctx.notes.def('buildings',`${t.def} (lit de prisonnier ou médical)`,'adapted',kind,'Usage du lit repris quand Elsewhere le connaît.');
 if(text(t.node,'medical')==='True'&&(kind==='bed'||kind==='double-bed'))s.medical=true;
 // Hit points: the save's current value against Elsewhere's maximum.
 const max=structureMaxHp(s,w.schemaVersion);
 if(t.hp!==undefined&&max>0&&t.hp<max){const damage=Math.round(max-t.hp);if(damage>0)s.damage=Math.min(max-1,damage);}
 return s;
}
const QUALITY_KINDS=new Set<StructureKind>(['bed','hospital-bed','double-bed','bedroll','sarcophagus','table','stool','dining-chair','armchair','end-table','dresser','table-square','table-long','flower-pot','chess-table','billiards-table','game-of-ur-board','poker-table','table-large','double-bedroll','couch']);
/** Fuel capacity of the game's fueled buildings (fuel units), to keep the fill ratio. */
const fuelCapacity=(kind:StructureKind)=>kind==='wood-generator'?75:kind==='chemfuel-generator'?30:kind==='campfire'?20:kind==='torch-lamp'?20:kind==='passive-cooler'?50:50;

/** Sculptures keep their author when the author is an imported colonist. */
function assignSculptureAuthors(ctx:ImportContext):void {
 const {w,map,notes}=ctx,byStructure=new Map<number,RwsThing>();
 for(const t of map.things){const id=ctx.thingIds.get(t.id);if(id!==undefined)byStructure.set(id,t);}
 const humans=w.pawns.filter(p=>(p.faction??'colony')==='colony');
 w.structures=w.structures.filter(s=>{
  if(s.kind!=='small-sculpture'&&s.kind!=='large-sculpture')return true;
  const author=(text(byStructure.get(s.id)?.node,'authorName')??'').replace(/<[^>]*>/g,'');
  const match=humans.find(p=>author&&p.name.split(/[ «»]+/).filter(Boolean).some(part=>part.length>2&&author.includes(part)))??humans[0];
  if(!match){notes.def('buildings','Sculpture','dropped',s.kind,'Aucun colon importé pour en être l’auteur.');return false;}
  s.art={authorId:match.id,createdAt:w.tick};
  if(!author||!humans.some(p=>p===match&&author.includes(p.name.split(' ')[0]!)))notes.adapted('buildings','Sculpture : auteur absent de la colonie, attribuée à un colon importé.');
  return true;
 });
}

// ---- Plants -----------------------------------------------------------------------------
function importPlants(ctx:ImportContext):void {
 const {map,w,notes}=ctx,taken=new Set<number>(),roofed=new Set([...w.roofing?.constructed??[],...w.roofing?.natural?.thin??[],...w.roofing?.natural?.thick??[]]);
 // Structures per cell: a plant is kept under one only where Elsewhere's own
 // rules admit it (crops over conduits, light plants under furniture that
 // keeps plants, sleeping spots, hydroponics basins).
 const structuresAt=new Map<number,StructureKind[]>();
 for(const s of w.structures)for(const c of footprintCells(s)){const i=ctx.index(c);(structuresAt.get(i)??structuresAt.set(i,[]).get(i)!).push(s.kind);}
 const admitted=(kind:StructureKind,r:Pick<World['resources'][number],'kind'|'species'>)=>kind==='hydroponics-basin'&&!r.species||conduitKeepsPlant(kind,r.kind)||
  kind!=='flower-pot'&&isConstructionLightPlant(r)&&!constructionFinalWipesPlants(kind)||kind==='animal-sleeping-spot'||kind==='sleeping-spot'&&r.kind!=='tree';
 for(const t of map.things){
  if(!t.pos)continue;
  if(Object.hasOwn(DEAD_PLANT_MAP,t.def)){notes.countBefore('plants');notes.def('plants',t.def,'dropped',undefined,(DEAD_PLANT_MAP[t.def] as {drop:string}).drop);continue;}
  if(t.cls!=='Plant')continue;notes.countBefore('plants');
  const m=lookup(PLANT_MAP,t.def);if(!m||isDropped(m)){notes.def('plants',t.def,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Plante inconnue.');continue;}
  const i=ctx.index(t.pos),tile=w.tiles[i]!,growth=Math.max(0,Math.min(1,num(t.node,'growth')??1));
  const probe='wild' in m.to?{kind:FLORA_DEFINITIONS[m.to.wild].kind,species:m.to.wild}:{kind:m.to.crop};
  const conflict=taken.has(i)?'une autre plante occupe déjà la case':(structuresAt.get(i)??[]).some(k=>!admitted(k,probe))?'un bâtiment occupe la case dans Elsewhere':tile.terrain==='rock'?'la case est de la roche':tile.floor?'la case a un sol construit':isWaterTerrain(tile.terrain)?'la case est de l’eau':undefined;
  if(conflict){notes.def('plants',t.def,'dropped',undefined,`Case incompatible : ${conflict}.`);continue;}
  let r;
  if('wild' in m.to){
   const kind=m.to.wild;
   if(!w.flora&&w.site?.revision!==3){notes.def('plants',t.def,'dropped',kind,'Plante sauvage : une carte sans planète n’a pas de flore naturelle dans Elsewhere.');continue;}
   if(roofed.has(i)&&isTree(kind)){notes.def('plants',t.def,'dropped',kind,'Arbre sous un toit : non admis dans Elsewhere.');continue;}
   r=createWildPlantResource256(w,w.nextId,t.pos.x,t.pos.z,kind,growth,false);
   if(!r){notes.def('plants',t.def,'dropped',kind,'Plante refusée par Elsewhere à cet endroit.');continue;}
   w.nextId++;
  }else{
   const crop=m.to.crop;r={id:w.nextId++,kind:crop,x:t.pos.x,z:t.pos.z,amount:PLANT_DEFINITIONS[crop].yield,growth,growthTick:w.tick} as World['resources'][number];
   r.plantLife=createPlantLife(w,r);
  }
  // Plant life clocks belong to a world with a climate; a plain map has none.
  if(!w.climate)delete r.plantLife;
  w.resources.push(r);taken.add(i);ctx.thingIds.set(t.id,r.id);notes.countAfter('plants');
  notes.def('plants',t.def,mappingStatus(m),'wild' in m.to?m.to.wild:m.to.crop,'adapt' in m?m.adapt:undefined);
 }
}
const TREES=new Set(['oak','poplar','pine','birch','saguaro','drago','bamboo','cecropia','cypress','maple','palm','teak','willow']);
const isTree=(s:string)=>TREES.has(s);

// ---- Items on the ground, in shelves ----------------------------------------------------
function importGroundItems(ctx:ImportContext):void {
 const {map,w,notes}=ctx;
 const place=(def:string,quantity:number,cell:Cell,forbidden:boolean,thing?:RwsThing)=>{
  const m=lookup(ITEM_MAP,def);notes.countBefore('items');
  if(!m||isDropped(m)){notes.def('items',def,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Objet inconnu : non importé.',1);return;}
  const item=m.to,kind=ITEM_DEFINITIONS[item].kind as MaterialKind;
  const total=Math.max(1,Math.round(quantity));
  try{
   const before=w.piles.length;
   if(total<=ITEM_DEFINITIONS[item].stackLimit&&canAdd(w,cell,item)&&materialCanFit(w,kind,total,{type:'ground',...cell},item))addMaterial(w,kind,total,{type:'ground',...cell},item);
   else addGroundMaterial(w,kind,total,cell,item);
   const created=w.piles.slice(before).concat(w.piles.filter(p=>p.item===item&&p.owner.type==='ground'&&p.owner.x===cell.x&&p.owner.z===cell.z));
   if(forbidden)for(const p of new Set(created))setMaterialForbidden256(p,true);
   if(thing)ctx.thingIds.set(thing.id,created[0]?.id??-1);
   notes.countAfter('items');notes.def('items',def,mappingStatus(m),item,'adapt' in m?m.adapt:undefined,1);
  }catch(error){notes.def('items',def,'dropped',item,`Aucune place admise par Elsewhere près de cette case (${error instanceof Error?error.message.slice(0,80):''}).`,1);}
 };
 for(const t of map.things){
  if(!t.pos||t.cls==='Pawn'||t.cls==='Plant'||t.cls==='Filth'||isBuildingClass(t.cls)||t.cls==='Frame'||t.cls.startsWith('Blueprint')||Object.hasOwn(DEAD_PLANT_MAP,t.def)||Object.hasOwn(ROCK_MAP,t.def))continue;
  if(t.cls==='Corpse'){notes.countBefore('items');notes.def('items',t.def,'dropped',undefined,'Cadavre : non importé.');continue;}
  if(t.cls==='RectTrigger'||t.cls.startsWith('SignalAction'))continue;
  if(Object.hasOwn(APPAREL_MAP,t.def)||Object.hasOwn(WEAPON_MAP,t.def)){placeGear(ctx,t,{type:'ground',...t.pos});continue;}
  place(t.def,t.stack,t.pos,t.forbidden,t);
 }
 for(const c of ctx.pendingChunks.splice(0))place(c.def,1,{x:c.cell%w.width,z:Math.floor(c.cell/w.width)},false);
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
 const before=w.piles.length;
 try{
  if(owner.type==='ground'&&!(canAdd(w,owner,resolved.item as ItemId)&&materialCanFit(w,isApparel?'apparel':'weapon',1,owner,resolved.item as ItemId)))addGroundMaterial(w,isApparel?'apparel':'weapon',1,owner,resolved.item as ItemId);
  else addMaterial(w,isApparel?'apparel':'weapon',1,owner,resolved.item as ItemId);
 }catch(error){notes.def(family,t.def,'dropped',resolved.item,`Refusé par Elsewhere (${error instanceof Error?error.message.slice(0,80):''}).`);return undefined;}
 const pile=w.piles.slice(before).find(p=>p.item===resolved.item)??w.piles.at(-1)!;
 const quality=t.quality?QUALITY_MAP[t.quality]:undefined;
 const state=pile.apparel??pile.weapon;
 if(state){if(quality)state.quality=quality;if(t.hp!==undefined){const max=state.hitPoints;state.hitPoints=Math.max(1,Math.min(max,Math.round(t.hp)));}}
 if(pile.apparel&&text(t.node,'wornByCorpse')==='True'&&'corpseWear284' in pile.apparel)pile.apparel.corpseWear284=true;
 if(t.forbidden&&owner.type==='ground')setMaterialForbidden256(pile,true);
 ctx.thingIds.set(t.id,pile.id);notes.countAfter(family);
 notes.def(family,t.stuff?`${t.def} (${t.stuff})`:t.def,resolved.note?'adapted':'exact',resolved.item,resolved.note);
 return pile;
}
type Resolved={item:string;note?:string}|{drop:string;status:'dropped'|'unknown'};
function resolveApparel(t:RwsThing):Resolved {
 const m=lookup(APPAREL_MAP,t.def);if(!m)return {drop:'Vêtement inconnu.',status:'unknown'};if(isDropped(m))return {drop:m.drop,status:'dropped'};
 const notes:string[]=m.adapt?[m.adapt]:[],stuff=t.stuff?lookup(STUFF_MAP,t.stuff):undefined;
 if('item' in m.to)return {item:m.to.item,...notes.length?{note:notes.join(' ')}:{}};
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
function resolveWeapon(t:RwsThing):Resolved {
 const m=lookup(WEAPON_MAP,t.def);if(!m)return {drop:'Arme inconnue.',status:'unknown'};if(isDropped(m))return {drop:m.drop,status:'dropped'};
 const notes:string[]=m.adapt?[m.adapt]:[];if('item' in m.to)return {item:m.to.item,...notes.length?{note:notes.join(' ')}:{}};
 const stuff=t.stuff?lookup(STUFF_MAP,t.stuff):undefined;let metal=stuff&&!isDropped(stuff)?stuff.to.metal:undefined;
 if(!metal){notes.push(`Matière ${t.stuff??'inconnue'} absente pour cette arme : acier.`);metal='steel';}
 return {item:`${metal}-${m.to.family}`,...notes.length?{note:notes.join(' ')}:{}};
}

// ---- Zones and areas ------------------------------------------------------------------------
function storageSettings(node:XmlNode|undefined):{filters:StorageFilters;items:Partial<Record<ItemId,boolean>>;priority:number}|undefined {
 if(!node)return undefined;
 const allowed=listItems(at(node,'filter/allowedDefs')).map(n=>n.text.trim());
 const filters:StorageFilters={wood:false,food:false},items:Partial<Record<ItemId,boolean>>={};
 for(const def of allowed){const m=lookup(ITEM_MAP,def);if(!m||isDropped(m))continue;items[m.to]=true;(filters as Record<string,boolean>)[ITEM_DEFINITIONS[m.to].kind]=true;}
 for(const def of allowed)if(Object.hasOwn(APPAREL_MAP,def)&&!isDropped(APPAREL_MAP[def]!))filters.apparel=true;else if(Object.hasOwn(WEAPON_MAP,def)&&!isDropped(WEAPON_MAP[def]!))filters.weapon=true;
 return {filters,items,priority:STORAGE_PRIORITY[text(node,'priority')??'Normal']??2};
}
function importZones(ctx:ImportContext):void {
 const {map,w,notes}=ctx,used=new Set<number>(),blocked=new Set(w.structures.flatMap(s=>s.kind==='power-conduit'?[]:footprintCells(s).map(c=>ctx.index(c))));
 const parseCell=(s:string)=>{const m=/\(\s*(-?\d+)\s*,\s*-?\d+\s*,\s*(-?\d+)\s*\)/.exec(s);return m?{x:Number(m[1]),z:Number(m[2])}:undefined;};
 for(const zone of map.zones){
  const cls=zone.attrs?.Class??'',m=lookup(ZONE_MAP,cls),label=text(zone,'label')??cls;
  notes.countBefore('zones');
  if(!m||isDropped(m)){notes.def('zones',cls,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Zone inconnue.');continue;}
  const cells=listItems(zone,'cells').map(n=>parseCell(n.text)).filter((c):c is Cell=>!!c&&ctx.inside(c));
  if(m.to==='stockpile'){
   const settings=storageSettings(child(zone,'settings'))??{filters:{wood:true,food:true},items:{},priority:2};
   let zoneId:number|undefined,kept=0;
   for(const c of cells){const i=ctx.index(c),tile=w.tiles[i]!;if(used.has(i)||blocked.has(i)||tile.terrain==='rock'||WATER.has(tile.terrain))continue;
    const id=w.nextId++;zoneId??=id;const cell:StockpileCell={id,x:c.x,z:c.z,filters:{...settings.filters},priority:settings.priority,capacity:ITEM_DEFINITIONS.silver.stackLimit,zoneId,...Object.keys(settings.items).length?{items:{...settings.items}}:{}};
    w.stockpiles.push(cell);used.add(i);kept++;}
   notes.def('zones',cls,kept===cells.length?'exact':'adapted','zone de stockage',kept===cells.length?undefined:`${cells.length-kept} cases sur ${cells.length} non admises (mur, roche, eau).`);
   if(kept)notes.countAfter('zones');
  }else{
   const plant=zonePlant(text(zone,'plantDefToGrow'));
   if(!plant||isDropped(plant)){notes.def('zones',`${cls} (${text(zone,'plantDefToGrow')??'?'})`,'dropped',undefined,plant&&isDropped(plant)?`Champ abandonné : ${plant.drop}`:'Plante du champ inconnue.');continue;}
   const allowSow=text(zone,'allowSow')!=='False',allowCut=text(zone,'allowCut')!=='False';
   // A zone that may cut but not sow harvests whatever grows there in
   // Elsewhere; a wild plant with no product would give an invalid harvest.
   const wildNoProduct=new Set(!allowSow&&allowCut?w.resources.filter(r=>r.species&&FLORA_DEFINITIONS[r.species].product===null).map(r=>ctx.index(r)):[]);
   const ok=cells.map(c=>ctx.index(c)).filter(i=>!used.has(i)&&!blocked.has(i)&&!wildNoProduct.has(i)&&!w.tiles[i]!.floor&&w.tiles[i]!.terrain!=='rock'&&!WATER.has(w.tiles[i]!.terrain));
   const wildRemoved=cells.filter(c=>wildNoProduct.has(ctx.index(c))).length;
   if(wildRemoved)notes.adapted('zones',`${label} : ${wildRemoved} cases couvertes d’herbes sauvages retirées du champ (semis désactivé, récolte permise : Elsewhere y lancerait une récolte impossible).`);
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
  s.shelf.settings={...s.shelf.settings,filters:{...settings.filters},priority:settings.priority,...Object.keys(settings.items).length?{items:{...settings.items}}:{}};
 }
 // Areas.
 for(const area of map.areas){
  const cls=area.attrs?.Class??'',m=lookup(AREA_MAP,cls);
  if(!m||isDropped(m)){notes.def('zones',cls,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Aire inconnue.');continue;}
  const grid=child(area,'innerGrid'),deflated=child(grid,'arrDeflate'),plain=child(grid,'arr');
  if(!deflated&&!plain){continue;}
  const bytes=savedBytes((deflated??plain)!.text,!!deflated),cells:number[]=[];
  for(let i=0;i<w.width*w.height;i++)if((bytes[i>>3]??0)>>(i&7)&1)cells.push(i);
  if(m.to==='home'){if(cells.length)w.home=cells;notes.def('zones',cls,'exact',`zone domestique (${cells.length} cases)`);}
  else if(m.to==='snow-clear'){if(cells.length){w.snowClearArea=cells;notes.def('zones',cls,'exact','zone de déneigement');}}
  else notes.def('zones',`${cls} ${text(area,'label')??''}`.trim(),'dropped',undefined,'Aire autorisée personnalisée : non reprise dans cette étape.');
 }
}

// ---- Research -------------------------------------------------------------------------------
function importResearch(ctx:ImportContext):void {
 const {save,w,notes}=ctx;w.research??={project:null,points:0};
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
 if(current&&!isDropped(current)&&done.has(current.to)&&readProjectProgress(w.research,current.to)?.completedAt===undefined)w.research.project=current.to;
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
  notes.def('time','Compteur de la partie','adapted','repart de la création','Le temps écoulé depuis le début de la partie n’est pas repris : les horloges internes d’Elsewhere repartent de la création.');
 }catch(error){notes.lost('time',`Date non reprise (${error instanceof Error?error.message:String(error)}).`);}
}

// ---- Final reconciliation -----------------------------------------------------------------------
function finalize(ctx:ImportContext):void {
 const w=ctx.w;
 refreshStock(w);reconcilePower(w);invalidateTerrainJournal(w.tiles);
 if(w.home)w.home=[...new Set(w.home)].sort((a,b)=>a-b);
}
