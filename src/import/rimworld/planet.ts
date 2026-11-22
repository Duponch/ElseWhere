/** Rebuilds the save's planet as an Elsewhere geographic draft: the same
 * tiles (biome, relief, elevation, temperature, rainfall, swampiness, river
 * distance), the same rivers and roads, the cave modifiers, the same factions
 * (names, relations) and their settlements on the same tiles. Elsewhere then
 * creates its own faction leaders; the player's colony tile is the save's. */
import type {RwsSave,RwsSettlement} from './rws-save.ts';
import {shortHashTable} from './short-hash.ts';
import {BIOME_MAP,HILLINESS_MAP,RIVER_MAP,ROAD_MAP,MUTATOR_MAP,FACTION_MAP,worldScale} from './map-world.ts';
import {isDropped,lookup} from './mapping.ts';
import {cropSurfaceCells,generateCoveredSurfaceMesh,surfaceVisibilityAxis,WORLD_SURFACE_RADIUS} from '../../sim/world-surface-mesh.ts';
import {stableWorldSeedHash,validateWorldClimateSettings} from '../../sim/world-climate-settings.ts';
import type {WorldPhysicalSurface,WorldSurfaceTile} from '../../sim/world-surface-geography.ts';
import type {WorldRoadLink} from '../../sim/world-roads.ts';
import {visibleWorldRivers} from '../../sim/world-roads.ts';
import {worldBiomeCanSettle} from '../../sim/world-biome-properties.ts';
import {worldGenerationKey,validWorldGenerationSettings,type ConfigurableWorldFaction,type WorldGenerationSettings} from '../../sim/world-generation-settings.ts';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../../sim/world-faction-generation.ts';
import {WorldGenerationRandom,combineWorldSeed} from '../../sim/world-generation-random.ts';
import {worldRelationKind256,WORLD_FACTION_DEFINITIONS_256} from '../../sim/world-faction-catalog.ts';
import type {GeographicWorldDraft256} from '../../sim/world-geographic-draft.ts';
import {SCHEMA_VERSION} from '../../sim/types.ts';
import type {ImportNotes} from './notes.ts';

export interface PlanetImport {draft:GeographicWorldDraft256;homeTile:number;factionIds:Map<string,number>}
const f=Math.fround;

/** Returns undefined (with a note) when the planet cannot be rebuilt tile by
 * tile; the caller then falls back to a seed-based planet. */
export function rebuildPlanet(save:RwsSave,notes:ImportNotes):PlanetImport|undefined {
 const world=save.world,grid=world?.grid;
 if(!world||!grid){notes.lost('world','Grille du monde absente de la sauvegarde.');return undefined;}
 const coverage=world.coverage??0.3,settings={coverage:Math.round(coverage*100)/100,rainfall:worldScale(world.rainfall),temperature:worldScale(world.temperature),population:worldScale(world.population),factions:[]} as unknown as WorldGenerationSettings;
 if(!validateWorldClimateSettings({coverage:settings.coverage,rainfall:settings.rainfall,temperature:settings.temperature,population:settings.population})){notes.lost('world',`Réglages du monde non pris en charge (couverture ${coverage}).`);return undefined;}
 const cells=cropSurfaceCells(generateCoveredSurfaceMesh(settings.coverage,10,true),settings.coverage,surfaceVisibilityAxis(settings.coverage),true);
 if(cells.length!==grid.tiles){notes.lost('world',`Le maillage d’Elsewhere a ${cells.length} cases pour cette couverture, la sauvegarde ${grid.tiles} : planète régénérée à partir de la graine.`);return undefined;}
 const biomeNames=shortHashTable(Object.keys(BIOME_MAP));
 const tiles:WorldSurfaceTile[]=new Array(cells.length);let unknownBiome=0;
 for(let id=0;id<cells.length;id++){
  const cell=cells[id]!,name=biomeNames.get(grid.biome[id]!),m=lookup(BIOME_MAP,name);
  const biome=m&&!isDropped(m)?m.to:'ocean';if(!m||isDropped(m))unknownBiome++;
  tiles[id]={id,center:cell.center,corners:cell.corners,neighbours:cell.neighbours,biome,hilliness:HILLINESS_MAP[grid.hilliness[id]!]??'flat',
   elevation:f(grid.elevation[id]!),meanTemperature:f(grid.temperature[id]!),rainfall:f(grid.rainfall[id]!),swampiness:f(grid.swampiness[id]!),rivers:[],riverDistance:grid.riverDistance[id]!};
 }
 if(unknownBiome)notes.adapted('world',`${unknownBiome} cases de biome inconnu deviennent de l’océan.`);
 notes.mapped('world',`Planète reconstruite case par case : ${cells.length} cases (biome, relief, altitude, température, pluie, marécages).`);
 const riverNames=shortHashTable(Object.keys(RIVER_MAP)),roadNames=shortHashTable(Object.keys(ROAD_MAP));
 const roads:WorldRoadLink[][]=tiles.map(()=>[]);let rivers=0,roadCount=0,badLinks=0;
 for(const link of grid.rivers){
  const m=lookup(RIVER_MAP,riverNames.get(link.def)),from=tiles[link.origin],to=from?.neighbours[link.neighbourIndex];
  if(!m||isDropped(m)||!from||to===undefined){badLinks++;continue;}
  if(from.rivers.some(r=>r.neighbour===to))continue;
  from.rivers.push({neighbour:to,river:m.to});tiles[to]!.rivers.push({neighbour:from.id,river:m.to});rivers++;
 }
 for(const link of grid.roads){
  const m=lookup(ROAD_MAP,roadNames.get(link.def)),from=tiles[link.origin],to=from?.neighbours[link.neighbourIndex];
  if(!m||isDropped(m)||!from||to===undefined){badLinks++;continue;}
  if(roads[from.id]!.some(r=>r.neighbour===to))continue;
  roads[from.id]!.push({neighbour:to,road:m.to});roads[to]!.push({neighbour:from.id,road:m.to});roadCount++;
 }
 notes.mapped('world',`${rivers} tronçons de rivière et ${roadCount} tronçons de route repris.`);
 if(badLinks)notes.lost('world',`${badLinks} tronçons de rivière ou de route illisibles.`);
 const seedText=world.seed??'',surface:WorldPhysicalSurface={revision:3,radius:WORLD_SURFACE_RADIUS,seedText,generationSeed:stableWorldSeedHash(seedText)>>>0,
  settings:{coverage:settings.coverage,rainfall:settings.rainfall,temperature:settings.temperature,population:settings.population},tiles,geometryRevision:2};
 // Modifiers: mountain, river and coast follow the tile; caves come from the save.
 const mutatorNames=shortHashTable(Object.keys(MUTATOR_MAP)),caves=new Set<number>(),dropped=new Map<string,number>();
 for(const m of grid.mutators){const name=mutatorNames.get(m.def),map=lookup(MUTATOR_MAP,name);if(map&&!isDropped(map)&&map.to===2)caves.add(m.tile);else if(name&&map&&isDropped(map))dropped.set(name,(dropped.get(name)??0)+1);}
 const mutators=tiles.map(tile=>{
  let code=tile.hilliness==='mountainous'||tile.hilliness==='impassable'?1:0;
  if(worldBiomeCanSettle(tile.biome)&&tile.neighbours.some(n=>tiles[n]?.biome==='ocean'))code|=8;
  if(visibleWorldRivers(tile).length)code|=4;
  if(caves.has(tile.id)&&(tile.hilliness==='mountainous'||tile.hilliness==='large-hills'))code|=2;
  return code;
 });
 notes.mapped('world',`Modificateurs de terrain : grottes reprises sur ${mutators.filter(c=>c&2).length} cases ; montagne, rivière et côte déduites de chaque case.`);
 for(const [name,count] of dropped)notes.lost('world',`Modificateur ${name} (${count} cases) : absent d’Elsewhere.`);
 // Factions: same definitions in the save's order, then names, relations and settlements.
 const foreignSave=save.factions.filter(fa=>{const m=lookup(FACTION_MAP,fa.def);return m&&!isDropped(m)&&!WORLD_FACTION_DEFINITIONS_256[m.to].player;});
 settings.factions=foreignSave.map(fa=>(lookup(FACTION_MAP,fa.def) as {to:ConfigurableWorldFaction}).to);
 for(const fa of save.factions)if(!lookup(FACTION_MAP,fa.def)||isDropped(lookup(FACTION_MAP,fa.def)!))notes.lost('factions',`Faction ${fa.name??fa.def} (${fa.def}) : définition absente d’Elsewhere.`);
 if(!validWorldGenerationSettings(settings)){notes.lost('factions','Liste de factions non admise par Elsewhere : factions régénérées par défaut.');(settings as WorldGenerationSettings).factions=['OutlanderCivil','OutlanderRough','TribeCivil','TribeRough','TribeSavage','Pirate','Mechanoid','Insect','Ancients','AncientsHostile'];foreignSave.length=0;}
 const rootSeed=surface.generationSeed;
 const foreign=generateForeignWorldFactions256({version:SCHEMA_VERSION,tick:0,tiles,selection:settings.factions,population:settings.population,nextFactionId:1,nextSettlementId:1,nextThingId:1,random:new WorldGenerationRandom(combineWorldSeed(rootSeed,777998381))});
 if(!foreign.ok){notes.lost('factions',`Création des factions refusée : ${foreign.reason}`);return undefined;}
 const draftFactions=foreign.draft,factionIds=new Map<string,number>();
 foreignSave.forEach((fa,i)=>{const instance=draftFactions.factions[i]!;factionIds.set(fa.loadId,instance.id);if(fa.name&&!WORLD_FACTION_DEFINITIONS_256[instance.def].fixedName&&fa.name.length<=80)instance.name=fa.name;});
 notes.mapped('factions',`${foreignSave.length} factions reprises avec leur nom ; chefs de faction recréés par Elsewhere.`);
 // Settlements of the save replace the generated ones.
 const playerFaction=save.playerFaction,colonyObject=save.worldObjects.find(o=>save.maps[0]&&`WorldObject_${o.id}`===save.maps[0].parent);
 const homeTile=colonyObject?.tile??-1;
 if(!(homeTile>=0&&homeTile<tiles.length)){notes.lost('world','Case de la colonie introuvable dans la sauvegarde.');return undefined;}
 const settlements:RwsSettlement[]=save.worldObjects.filter(o=>o.cls==='Settlement'&&o.faction!==playerFaction&&o.tile!==homeTile);
 const placed=new Set<number>();let nextSettlementId=1,keptSettlements=0,otherObjects=0;
 draftFactions.settlements=[];
 for(const s of settlements){
  const factionId=s.faction?factionIds.get(s.faction):undefined,faction=draftFactions.factions.find(fa=>fa.id===factionId);
  if(!faction||faction.hidden||placed.has(s.tile)){continue;}
  draftFactions.settlements.push({id:nextSettlementId++,factionId:faction.id,tile:s.tile,name:(s.name??`Colonie ${nextSettlementId}`).slice(0,80),postId:null});placed.add(s.tile);keptSettlements++;
 }
 draftFactions.nextSettlementId=nextSettlementId;
 for(const o of save.worldObjects)if(o.cls!=='Settlement')otherObjects++;
 notes.mapped('factions',`${keptSettlements} colonies étrangères replacées sur leur case.`);
 if(otherObjects)notes.lost('world',`${otherObjects} autres objets du monde (sites de quête, épaves, vaisseau…) : non recréés.`);
 // Relations between foreign factions.
 const byId=new Map(save.factions.map(fa=>[fa.loadId,fa]));
 for(const rel of draftFactions.relations){
  const a=[...factionIds].find(([,id])=>id===rel.aId)?.[0],b=[...factionIds].find(([,id])=>id===rel.bId)?.[0];
  const saved=a&&b?byId.get(a)?.relations.find(r=>r.other===b):undefined;
  const defA=draftFactions.factions.find(fa=>fa.id===rel.aId)!.def,defB=draftFactions.factions.find(fa=>fa.id===rel.bId)!.def;
  if(saved&&!WORLD_FACTION_DEFINITIONS_256[defA].permanentEnemy&&!WORLD_FACTION_DEFINITIONS_256[defB].permanentEnemy){rel.goodwill=Math.max(-100,Math.min(100,Math.round(saved.goodwill)));rel.kind=worldRelationKind256(rel.goodwill);}
 }
 const playerSave=save.factions.find(fa=>fa.loadId===playerFaction),playerName=(playerSave?.name??'Colonie importée').slice(0,80)||'Colonie importée';
 const playerDef=playerSave&&lookup(FACTION_MAP,playerSave.def)&&!isDropped(lookup(FACTION_MAP,playerSave.def)!)&&(lookup(FACTION_MAP,playerSave.def) as {to:string}).to==='PlayerTribe'?'PlayerTribe':'PlayerColony';
 const completed=completeWorldFactionRegistry256({version:SCHEMA_VERSION,draft:draftFactions,playerDef,name:playerName,postWorldRandom:new WorldGenerationRandom(rootSeed)});
 if(!completed.ok){notes.lost('factions',`Faction du joueur refusée : ${completed.reason}`);return undefined;}
 const registry=completed.registry;
 // Player goodwill toward each foreign faction, from the save.
 let goodwills=0;
 for(const rel of registry.relations){
  const other=rel.aId===registry.playerFactionId?rel.bId:rel.bId===registry.playerFactionId?rel.aId:undefined;if(other===undefined)continue;
  const load=[...factionIds].find(([,id])=>id===other)?.[0],saved=load?playerSave?.relations.find(r=>r.other===load):undefined;
  const def=registry.factions.find(fa=>fa.id===other)!.def;
  if(saved&&!WORLD_FACTION_DEFINITIONS_256[def].permanentEnemy){rel.goodwill=Math.max(-100,Math.min(100,Math.round(saved.goodwill)));rel.kind=worldRelationKind256(rel.goodwill);goodwills++;}
 }
 factionIds.set(playerFaction??'player',registry.playerFactionId);
 notes.mapped('factions',`Bonne volonté envers ${goodwills} factions reprise ; « ${playerName} » est la faction du joueur.`);
 const draft:GeographicWorldDraft256={revision:1,key:worldGenerationKey(seedText,settings),surface,roads,settings,factions:registry,nextThingId:foreign.nextThingId,mutators};
 return {draft,homeTile,factionIds};
}
