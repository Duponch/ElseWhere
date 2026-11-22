/** Tile-by-tile comparison of a RimWorld save's planet with a planet that
 * Elsewhere generates from the same seed string and settings. Developer tool
 * (`scripts/planet-parity.ts`), pure TypeScript: nothing here is used by the
 * game itself.
 *
 * Generated values are quantized exactly as the game writes its surface layer
 * (facts read from `SurfaceLayer.TilesToRawData`, no code copied): elevation
 * rounded to the metre (land at least 1 m), temperature to the tenth of a
 * degree, rainfall to the millimetre, swampiness to 1/255, each rounding half
 * to even, with the game's runtime precision (`src/sim/verse-rand.ts`). Two
 * planets match on a field when these saved integers are equal. */
import type {RwsSave,RwsWorldGrid} from './rws-save.ts';
import {shortHashTable} from './short-hash.ts';
import {BIOME_MAP,RIVER_MAP,ROAD_MAP,MUTATOR_MAP,worldScale} from './map-world.ts';
import {isDropped} from './mapping.ts';
import {num as xmlNumber,items} from './xml.ts';
import type {WorldRoadLink} from '../../sim/world-roads.ts';
import type {WorldFactionRegistry256} from '../../sim/world-faction-state.ts';
import type {ConfigurableWorldFaction} from '../../sim/world-generation-settings.ts';
import type {WorldSurfaceTile} from '../../sim/world-surface-geography.ts';
import type {WorldRelief} from '../../sim/world-climate-evaluation.ts';
import type {WorldClimateSettings,ClimateSetting,WorldCoverage} from '../../sim/world-climate-settings.ts';

const f=Math.fround;
/** Round half to even, as the game's integer rounding of a float. */
export function roundHalfEven(value:number):number {
 const lower=Math.floor(value),part=value-lower;
 return part<.5?lower:part>.5?lower+1:lower%2===0?lower:lower+1;
}
const clampInt=(v:number,min:number,max:number)=>v<min?min:v>max?max:v;
const RELIEF_CODES:Readonly<Record<WorldRelief,number>>={flat:1,'small-hills':2,'large-hills':3,mountainous:4,impassable:5};
const RELIEF_NAMES=['Undefined','Flat','SmallHills','LargeHills','Mountainous','Impassable'] as const;
const CORE_BIOME_BY_ELSEWHERE=new Map<string,string>(Object.entries(BIOME_MAP).flatMap(([core,m])=>isDropped(m)?[]:[[m.to as string,core] as [string,string]]));

/** The saved integers of a planet's surface layer, field by field. */
export interface PlanetColumns {
 readonly tiles:number;
 /** Core biome definition names (`?` when unknown). */
 readonly biome:readonly string[];
 /** Metres as saved (raw value − 8192). */
 readonly elevation:Int32Array;
 /** 1 Flat … 5 Impassable. */
 readonly hilliness:Uint8Array;
 /** Tenths of a degree above −300 °C, as saved. */
 readonly temperature:Int32Array;
 /** Millimetres per year. */
 readonly rainfall:Int32Array;
 /** Swampiness × 255. */
 readonly swampiness:Int32Array;
 readonly riverDistance:Int32Array|null;
 /** Undirected river links `low-high` → Core river definition name. */
 readonly rivers:ReadonlyMap<string,string>|null;
}

/** World settings of a save, as the generators take them. */
export interface SavePlanetSettings {
 seed:string;coverage:WorldCoverage;rawCoverage:number;settings:WorldClimateSettings;pollution:number;
 rainfallName:string;temperatureName:string;populationName:string;gameVersion:string;
 /** Faction definitions chosen at world creation, in order (`info/factions`). */
 factions:string[];
}
export function savePlanetSettings(save:RwsSave):SavePlanetSettings {
 const world=save.world;if(!world)throw Error('Sauvegarde sans monde.');
 const raw=world.coverage??.3,coverage=([.3,.5,1] as const).find(c=>Math.abs(c-raw)<1e-6);
 if(coverage===undefined)throw Error(`Couverture ${raw} non prise en charge.`);
 return {seed:world.seed??'',coverage,rawCoverage:raw,pollution:xmlNumber(world.node,'info/pollution')??0,
  settings:{coverage,rainfall:worldScale(world.rainfall) as ClimateSetting,temperature:worldScale(world.temperature) as ClimateSetting,population:worldScale(world.population) as ClimateSetting},
  rainfallName:world.rainfall??'Normal',temperatureName:world.temperature??'Normal',populationName:world.population??'Normal',gameVersion:save.meta.gameVersion,
  factions:items(world.node,'info/factions').map(n=>n.text.trim()).filter(Boolean)};
}

const linkKey=(a:number,b:number)=>a<b?`${a}-${b}`:`${b}-${a}`;
/** Saved columns. `neighbours` resolves the saved river links (origin tile and
 * neighbour index); without it the river links are not compared. */
export function saveColumns(grid:RwsWorldGrid,neighbours?:(tile:number)=>readonly number[]):PlanetColumns {
 const names=shortHashTable(Object.keys(BIOME_MAP)),n=grid.tiles;
 const temperature=new Int32Array(n),swampiness=new Int32Array(n),elevation=new Int32Array(n),rainfall=new Int32Array(n);
 for(let i=0;i<n;i++){
  // The reader turned the saved integers into values; recover them exactly.
  elevation[i]=grid.elevation[i]!;temperature[i]=Math.round((grid.temperature[i]!+300)*10);
  rainfall[i]=grid.rainfall[i]!;swampiness[i]=Math.round(grid.swampiness[i]!*255);
 }
 let rivers:Map<string,string>|null=null;
 if(neighbours){
  const riverNames=shortHashTable(Object.keys(RIVER_MAP));rivers=new Map();
  for(const link of grid.rivers){const to=neighbours(link.origin)[link.neighbourIndex];if(to!==undefined)rivers.set(linkKey(link.origin,to),riverNames.get(link.def)??'?');}
 }
 return {tiles:n,biome:Array.from(grid.biome,h=>names.get(h)??'?'),elevation,hilliness:Uint8Array.from(grid.hilliness),temperature,rainfall,swampiness,riverDistance:Int32Array.from(grid.riverDistance),rivers};
}

const CORE_RIVER_BY_ELSEWHERE=new Map<string,string>(Object.entries(RIVER_MAP).flatMap(([core,m])=>isDropped(m)?[]:[[m.to as string,core] as [string,string]]));
/** Generated tiles quantized as the game saves them. */
export function surfaceColumns(tiles:readonly WorldSurfaceTile[]):PlanetColumns {
 const n=tiles.length,elevation=new Int32Array(n),hilliness=new Uint8Array(n),temperature=new Int32Array(n),rainfall=new Int32Array(n),swampiness=new Int32Array(n),riverDistance=new Int32Array(n);
 const rivers=new Map<string,string>(),biome:string[]=new Array(n);
 for(let i=0;i<n;i++){
  const t=tiles[i]!,e=f(t.elevation);
  // `RoundToInt(x + 8192f)` and `RoundToInt((t + 300f) * 10f)`: the game's
  // runtime evaluates each argument in double and rounds it to float once.
  elevation[i]=clampInt(roundHalfEven(f((e<=0?e:Math.max(e,1))+8192)),0,65535)-8192;
  hilliness[i]=RELIEF_CODES[t.hilliness];
  temperature[i]=clampInt(roundHalfEven(f((f(t.meanTemperature)+300)*10)),0,65535);
  rainfall[i]=clampInt(roundHalfEven(f(t.rainfall)),0,65535);
  swampiness[i]=clampInt(roundHalfEven(f(f(t.swampiness)*255)),0,255);
  riverDistance[i]=t.riverDistance;biome[i]=CORE_BIOME_BY_ELSEWHERE.get(t.biome)??'?';
  for(const link of t.rivers)rivers.set(linkKey(i,link.neighbour),CORE_RIVER_BY_ELSEWHERE.get(link.river)??'?');
 }
 return {tiles:n,biome,elevation,hilliness,temperature,rainfall,swampiness,riverDistance,rivers};
}

export interface NumericFieldParity {
 field:string;unit:string;compared:number;exact:number;
 /** Absolute differences in the field's unit: quantiles and maximum. */
 p50:number;p90:number;p99:number;max:number;meanSigned:number;
 /** Share of tiles within each absolute tolerance (unit of the field). */
 within:{tolerance:number;share:number}[];
}
export interface CategoricalFieldParity {field:string;compared:number;exact:number;confusion:{save:string;generated:string;count:number}[]}
export interface RiverParity {saveLinks:number;generatedLinks:number;sameLink:number;sameLinkAndRiver:number;riverDistanceExact:number}
export interface PlanetParityReport {
 tiles:number;sameTileCount:boolean;
 numeric:NumericFieldParity[];categorical:CategoricalFieldParity[];rivers:RiverParity|null;
 /** Tiles where biome, elevation, relief, temperature, rainfall and swampiness all match. */
 allFieldsExact:number;
}

function numericParity(field:string,unit:string,scale:number,save:Int32Array,generated:Int32Array,tolerances:readonly number[]):NumericFieldParity {
 const n=Math.min(save.length,generated.length),diffs=new Float64Array(n);let exact=0,sum=0;
 for(let i=0;i<n;i++){const d=(generated[i]!-save[i]!)/scale;diffs[i]=Math.abs(d);sum+=d;if(d===0)exact++;}
 const sorted=diffs.slice().sort(),q=(p:number)=>n?sorted[Math.min(n-1,Math.floor(p*(n-1)))]!:0;
 return {field,unit,compared:n,exact,p50:q(.5),p90:q(.9),p99:q(.99),max:n?sorted[n-1]!:0,meanSigned:n?sum/n:0,
  within:tolerances.map(tolerance=>{let k=0;for(let i=0;i<n;i++)if(diffs[i]!<=tolerance+1e-9)k++;return {tolerance,share:n?k/n:0};})};
}
function categoricalParity(field:string,save:ArrayLike<string|number>,generated:ArrayLike<string|number>,name:(v:string|number)=>string):CategoricalFieldParity {
 const n=Math.min(save.length,generated.length),cells=new Map<string,number>();let exact=0;
 for(let i=0;i<n;i++){const a=name(save[i]!),b=name(generated[i]!);if(a===b)exact++;const key=`${a}\u0000${b}`;cells.set(key,(cells.get(key)??0)+1);}
 return {field,compared:n,exact,confusion:[...cells].map(([k,count])=>{const [s,g]=k.split('\u0000') as [string,string];return {save:s,generated:g,count};}).sort((a,b)=>b.count-a.count)};
}
export function comparePlanetColumns(save:PlanetColumns,generated:PlanetColumns):PlanetParityReport {
 const n=Math.min(save.tiles,generated.tiles);
 const numeric=[
  numericParity('elevation','m',1,save.elevation,generated.elevation,[1,10,100]),
  numericParity('temperature','°C',10,save.temperature,generated.temperature,[.1,1,5]),
  numericParity('rainfall','mm',1,save.rainfall,generated.rainfall,[1,10,100]),
  numericParity('swampiness','%',2.55,save.swampiness,generated.swampiness,[.5,5,20]),
 ];
 const categorical=[
  categoricalParity('biome',save.biome,generated.biome,v=>String(v)),
  categoricalParity('hilliness',save.hilliness,generated.hilliness,v=>RELIEF_NAMES[v as number]??String(v)),
 ];
 let rivers:RiverParity|null=null;
 if(save.rivers&&generated.rivers&&save.riverDistance&&generated.riverDistance){
  let sameLink=0,sameRiver=0,distance=0;
  for(const [k,def] of save.rivers){const g=generated.rivers.get(k);if(g!==undefined){sameLink++;if(g===def)sameRiver++;}}
  for(let i=0;i<n;i++)if(save.riverDistance[i]===generated.riverDistance[i])distance++;
  rivers={saveLinks:save.rivers.size,generatedLinks:generated.rivers.size,sameLink,sameLinkAndRiver:sameRiver,riverDistanceExact:distance};
 }
 let all=0;
 for(let i=0;i<n;i++)if(save.biome[i]===generated.biome[i]&&save.elevation[i]===generated.elevation[i]&&save.hilliness[i]===generated.hilliness[i]&&save.temperature[i]===generated.temperature[i]&&save.rainfall[i]===generated.rainfall[i]&&save.swampiness[i]===generated.swampiness[i])all++;
 return {tiles:n,sameTileCount:save.tiles===generated.tiles,numeric,categorical,rivers,allFieldsExact:all};
}

const pct=(k:number,n:number)=>n?`${(100*k/n).toFixed(2)} %`:'—';
const num=(v:number)=>Number.isInteger(v)?String(v):v.toFixed(2);
/** Plain text, numbers only (developer tool). */
export function formatPlanetParity(report:PlanetParityReport,confusionRows=12):string {
 const lines:string[]=[];
 lines.push(`cases comparées : ${report.tiles}${report.sameTileCount?'':' (nombres de cases différents)'}`);
 lines.push(`toutes les colonnes exactes : ${report.allFieldsExact} (${pct(report.allFieldsExact,report.tiles)})`);
 for(const c of report.categorical){
  lines.push(`${c.field} : exact ${c.exact} (${pct(c.exact,c.compared)})`);
  const wrong=c.confusion.filter(x=>x.save!==x.generated).slice(0,confusionRows);
  if(wrong.length)lines.push(`  écarts principaux (sauvegarde → Elsewhere) : ${wrong.map(x=>`${x.save}→${x.generated} ${x.count}`).join(', ')}`);
 }
 for(const v of report.numeric){
  lines.push(`${v.field} : exact ${v.exact} (${pct(v.exact,v.compared)}) ; |écart| ${v.unit} p50 ${num(v.p50)}, p90 ${num(v.p90)}, p99 ${num(v.p99)}, max ${num(v.max)} ; écart moyen ${v.meanSigned.toFixed(3)}`);
  lines.push(`  ${v.within.map(w=>`≤ ${w.tolerance} ${v.unit} : ${(100*w.share).toFixed(2)} %`).join(' ; ')}`);
 }
 if(report.rivers){const r=report.rivers;lines.push(`rivières : ${r.saveLinks} tronçons dans la sauvegarde, ${r.generatedLinks} générés ; même tronçon ${r.sameLink} (${pct(r.sameLink,r.saveLinks)}), même rivière ${r.sameLinkAndRiver} ; distance à la rivière exacte ${pct(r.riverDistanceExact,report.tiles)}`);}
 return lines.join('\n');
}
/** Biome confusion as a full table (rows: save, columns: generated). */
export function biomeConfusionTable(report:PlanetParityReport):string {
 const biome=report.categorical.find(c=>c.field==='biome');if(!biome)return '';
 const rows=[...new Set(biome.confusion.map(c=>c.save))].sort(),cols=[...new Set(biome.confusion.map(c=>c.generated))].sort();
 const cell=new Map(biome.confusion.map(c=>[`${c.save}|${c.generated}`,c.count]));
 const width=Math.max(...cols.map(c=>c.length),6),pad=(s:string)=>s.padStart(width);
 const out=[`${''.padEnd(20)}${cols.map(pad).join(' ')}`];
 for(const r of rows)out.push(`${r.padEnd(20)}${cols.map(c=>pad(String(cell.get(`${r}|${c}`)??''))).join(' ')}`);
 return out.join('\n');
}

/** World objects of a complete generated world (roads, foreign settlements,
 * caves) against the save's. */
export interface WorldObjectParity {
 roads:{saveLinks:number;generatedLinks:number;sameLink:number;sameLinkAndRoad:number};
 /** Ancient asphalt roads and highways only (step 400): later steps never
  * replace them (lower priority), so the save's ancient links are exactly
  * that step's output. */
 ancientRoads:{saveLinks:number;generatedLinks:number;sameLink:number;sameLinkAndRoad:number};
 settlements:{save:number;generated:number;sameTile:number;sameTileAndFaction:number};
 caves:{save:number;generated:number;same:number};
}
const CORE_ROAD_BY_ELSEWHERE=new Map<string,string>(Object.entries(ROAD_MAP).flatMap(([core,m])=>isDropped(m)?[]:[[m.to as string,core] as [string,string]]));
type RoadLinkParity={saveLinks:number;generatedLinks:number;sameLink:number;sameLinkAndRoad:number};
/** Road links of the save and of a generated world, keyed by tile pair,
 * valued by Core road definition name. */
function roadLinkMaps(grid:RwsWorldGrid,neighbours:(tile:number)=>readonly number[],roads:readonly (readonly WorldRoadLink[])[]):{saveRoads:Map<string,string>;generatedRoads:Map<string,string>} {
 const roadNames=shortHashTable(Object.keys(ROAD_MAP)),saveRoads=new Map<string,string>(),generatedRoads=new Map<string,string>();
 for(const link of grid.roads){const to=neighbours(link.origin)[link.neighbourIndex];if(to!==undefined)saveRoads.set(linkKey(link.origin,to),roadNames.get(link.def)??'?');}
 roads.forEach((links,from)=>{for(const link of links)generatedRoads.set(linkKey(from,link.neighbour),CORE_ROAD_BY_ELSEWHERE.get(link.road)??'?');});
 return {saveRoads,generatedRoads};
}
const isAncientRoad=(def:string|undefined)=>def==='AncientAsphaltRoad'||def==='AncientAsphaltHighway';
function ancientRoadParity(saveRoads:ReadonlyMap<string,string>,generatedRoads:ReadonlyMap<string,string>):RoadLinkParity {
 let saveLinks=0,generatedLinks=0,sameLink=0,sameLinkAndRoad=0;
 for(const def of generatedRoads.values())if(isAncientRoad(def))generatedLinks++;
 for(const [k,def] of saveRoads){if(!isAncientRoad(def))continue;saveLinks++;const g=generatedRoads.get(k);if(isAncientRoad(g)){sameLink++;if(g===def)sameLinkAndRoad++;}}
 return {saveLinks,generatedLinks,sameLink,sameLinkAndRoad};
}
/** Ancient roads and highways (step 400) of the save against generated road
 * links: links of either ancient type, then of the same type. */
export function compareAncientRoads(save:RwsSave,neighbours:(tile:number)=>readonly number[],roads:readonly (readonly WorldRoadLink[])[]):RoadLinkParity {
 const grid=save.world?.grid;if(!grid)throw Error('Sauvegarde sans grille du monde.');
 const {saveRoads,generatedRoads}=roadLinkMaps(grid,neighbours,roads);
 return ancientRoadParity(saveRoads,generatedRoads);
}
export function compareWorldObjects(save:RwsSave,neighbours:(tile:number)=>readonly number[],roads:readonly (readonly WorldRoadLink[])[],registry:WorldFactionRegistry256,mutators:readonly number[]):WorldObjectParity {
 const grid=save.world?.grid;if(!grid)throw Error('Sauvegarde sans grille du monde.');
 const {saveRoads,generatedRoads}=roadLinkMaps(grid,neighbours,roads);
 let sameLink=0,sameRoad=0;for(const [k,def] of saveRoads){const g=generatedRoads.get(k);if(g!==undefined){sameLink++;if(g===def)sameRoad++;}}
 const factionDef=new Map(save.factions.map(fa=>[fa.loadId,fa.def]));
 const saveSettlements=new Map<number,string>();
 for(const o of save.worldObjects)if(o.cls==='Settlement'&&o.faction&&o.faction!==save.playerFaction)saveSettlements.set(o.tile,factionDef.get(o.faction)??'?');
 const defById=new Map(registry.factions.map(fa=>[fa.id,fa.def as string]));
 let sameTile=0,sameFaction=0;
 for(const s of registry.settlements){const def=saveSettlements.get(s.tile);if(def!==undefined){sameTile++;if(def===defById.get(s.factionId))sameFaction++;}}
 const mutatorNames=shortHashTable(Object.keys(MUTATOR_MAP)),saveCaves=new Set<number>();
 for(const m of grid.mutators)if(mutatorNames.get(m.def)==='Caves')saveCaves.add(m.tile);
 let generatedCaves=0,sameCaves=0;mutators.forEach((code,tile)=>{if(code&2){generatedCaves++;if(saveCaves.has(tile))sameCaves++;}});
 return {roads:{saveLinks:saveRoads.size,generatedLinks:generatedRoads.size,sameLink,sameLinkAndRoad:sameRoad},
  ancientRoads:ancientRoadParity(saveRoads,generatedRoads),
  settlements:{save:saveSettlements.size,generated:registry.settlements.length,sameTile,sameTileAndFaction:sameFaction},
  caves:{save:saveCaves.size,generated:generatedCaves,same:sameCaves}};
}
export function formatWorldObjectParity(p:WorldObjectParity):string {
 return [`routes anciennes : ${p.ancientRoads.saveLinks} tronçons dans la sauvegarde, ${p.ancientRoads.generatedLinks} générés ; même tronçon ${p.ancientRoads.sameLink} (${pct(p.ancientRoads.sameLink,p.ancientRoads.saveLinks)}), même type ${p.ancientRoads.sameLinkAndRoad}`,
  `routes : ${p.roads.saveLinks} tronçons dans la sauvegarde, ${p.roads.generatedLinks} générés ; même tronçon ${p.roads.sameLink} (${pct(p.roads.sameLink,p.roads.saveLinks)}), même route ${p.roads.sameLinkAndRoad}`,
  `colonies étrangères : ${p.settlements.save} dans la sauvegarde, ${p.settlements.generated} générées ; même case ${p.settlements.sameTile} (${pct(p.settlements.sameTile,p.settlements.save)}), même faction ${p.settlements.sameTileAndFaction}`,
  `grottes : ${p.caves.save} dans la sauvegarde, ${p.caves.generated} générées ; mêmes cases ${p.caves.same} (${pct(p.caves.same,p.caves.save)})`].join('\n');
}
/** The save's faction list when every entry is one Elsewhere generates. */
export function saveFactionSelection(factions:readonly string[]):ConfigurableWorldFaction[]|null {
 const known=['OutlanderCivil','OutlanderRough','TribeCivil','TribeRough','TribeSavage','Pirate','Mechanoid','Insect','Ancients','AncientsHostile'];
 return factions.every(x=>known.includes(x))?[...factions] as ConfigurableWorldFaction[]:null;
}

/** Step 500 with the game's names (lot 3): faction names by creation order,
 * the first faction's first settlement, settlements by tile and name. */
export interface FactionNameParity {
 /** Non-player factions compared by creation order; fixed names (no draw)
  * counted apart. */
 factions:{compared:number;sameName:number;fixedNames:number;sameDrawnName:number};
 /** The first faction and the settlement it creates before its leader (the
  * save's settlement of that faction with the smallest identifier). */
 first:{sameName:boolean;settlementInSave:boolean;sameTile:boolean;sameTileAndName:boolean}|null;
 settlements:{save:number;generated:number;sameTile:number;sameTileAndName:number};
 /** Step-500 stream position (count of draws already taken) when the first
  * faction's leader starts; null when no leader was drawn. */
 leaderStart:number|null;
}
export function compareFactionNames(save:RwsSave,registry:WorldFactionRegistry256,fixedNameDefs:ReadonlySet<string>,leaderStart:number|null):FactionNameParity {
 const saveFactions=save.factions.filter(fa=>fa.loadId!==save.playerFaction),generated=registry.factions.filter(fa=>fa.id!==registry.playerFactionId);
 const compared=Math.min(saveFactions.length,generated.length);let sameName=0,fixedNames=0,sameDrawnName=0;
 for(let i=0;i<compared;i++){const fixed=fixedNameDefs.has(generated[i]!.def);if(fixed)fixedNames++;if(saveFactions[i]!.name===generated[i]!.name){sameName++;if(!fixed)sameDrawnName++;}}
 const saveSettlements=new Map<number,string|undefined>();
 for(const o of save.worldObjects)if(o.cls==='Settlement'&&o.faction&&o.faction!==save.playerFaction)saveSettlements.set(o.tile,o.name);
 let sameTile=0,sameTileAndName=0;
 for(const s of registry.settlements)if(saveSettlements.has(s.tile)){sameTile++;if(saveSettlements.get(s.tile)===s.name)sameTileAndName++;}
 let first:FactionNameParity['first']=null;
 if(compared>0){
  const f0=saveFactions[0]!,g0=generated[0]!;
  const saved=save.worldObjects.filter(o=>o.cls==='Settlement'&&o.faction===f0.loadId).sort((a,b)=>Number(a.id)-Number(b.id))[0];
  const made=registry.settlements.find(s=>s.factionId===g0.id);
  const sameTile=!!saved&&!!made&&saved.tile===made.tile;
  first={sameName:f0.name===g0.name,settlementInSave:!!saved,sameTile,sameTileAndName:sameTile&&saved!.name===made!.name};
 }
 return {factions:{compared,sameName,fixedNames,sameDrawnName},first,settlements:{save:saveSettlements.size,generated:registry.settlements.length,sameTile,sameTileAndName},leaderStart};
}
const yes=(v:boolean)=>v?'oui':'non';
/** Numbers and yes/no only: no name is printed. */
export function formatFactionNameParity(p:FactionNameParity,language:string):string {
 const lines=[`factions (noms du jeu, langue ${language}) :`];
 if(p.first)lines.push(`  première faction : même nom ${yes(p.first.sameName)} ; sa première colonie : ${p.first.settlementInSave?`même case ${yes(p.first.sameTile)}, même case et même nom ${yes(p.first.sameTileAndName)}`:'absente de la sauvegarde'}`);
 lines.push(`  noms de faction identiques : ${p.factions.sameName} / ${p.factions.compared} (dont ${p.factions.fixedNames} noms fixes ; noms tirés identiques ${p.factions.sameDrawnName} / ${p.factions.compared-p.factions.fixedNames})`);
 lines.push(`  colonies étrangères : ${p.settlements.save} dans la sauvegarde, ${p.settlements.generated} générées ; même case ${p.settlements.sameTile}, même case et même nom ${p.settlements.sameTileAndName}`);
 if(p.leaderStart!==null)lines.push(`  premier chef : commence au tirage ${p.leaderStart+1} du flux de l'étape 500 (${p.leaderStart} tirages déjà pris) — choix du genre de chef, puis PawnGenerator, non porté : la suite quitte le flux du jeu`);
 return lines.join('\n');
}
