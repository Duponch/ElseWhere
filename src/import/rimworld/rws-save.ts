/** Structured reading of a RimWorld 1.6 save (`.rws`, XML). Facts about the
 * format were read from the game (no code copied): compressed grids are
 * base64 of raw DEFLATE data, cells in row order `z * width + x`, values as
 * little-endian 16-bit definition short hashes; bit grids are packed least
 * significant bit first; references to things are `Thing_<id>`. */
import {parseXml,child,children,at,text,num,items,dictionary,isNull,type XmlNode} from './xml.ts';
import {savedBytes,readUint16Column,readInt32Column} from './bytes.ts';
import {shortHashTable} from './short-hash.ts';

export const CORE_PACKAGE_ID='ludeon.rimworld';
export interface RwsCell {x:number;z:number}
export interface RwsThing {
 readonly node:XmlNode;readonly cls:string;readonly def:string;readonly id:string;
 readonly pos:RwsCell|null;readonly rot:number;readonly stuff?:string;readonly hp?:number;
 readonly quality?:string;readonly stack:number;readonly faction?:string;readonly forbidden:boolean;
}
export interface RwsGrids {
 readonly terrainTop:Uint16Array|null;readonly terrainUnder:Uint16Array|null;readonly terrainFoundation:Uint16Array|null;
 readonly color:Uint16Array|null;readonly roofs:Uint16Array|null;readonly snow:Uint16Array|null;
 readonly fog:Uint8Array|null;readonly compressedThings:Uint16Array|null;
}
export interface RwsMap {
 readonly node:XmlNode;readonly index:number;readonly width:number;readonly height:number;
 readonly parent?:string;readonly grids:RwsGrids;readonly things:RwsThing[];
 readonly zones:XmlNode[];readonly areas:XmlNode[];
}
export interface RwsWorldGrid {
 readonly tiles:number;readonly subdivisions:number;readonly viewAngle:number;
 readonly biome:Uint16Array;readonly elevation:Int32Array;readonly hilliness:Uint8Array;readonly temperature:Float32Array;
 readonly rainfall:Uint16Array;readonly swampiness:Float32Array;readonly riverDistance:Uint8Array;
 readonly rivers:{origin:number;neighbourIndex:number;def:number}[];readonly roads:{origin:number;neighbourIndex:number;def:number}[];
 readonly mutators:{tile:number;def:number}[];
}
export interface RwsSettlement {readonly id:string;readonly tile:number;readonly faction?:string;readonly name?:string;readonly cls:string;readonly def?:string}
export interface RwsFaction {
 readonly loadId:string;readonly def:string;readonly name?:string;readonly hidden:boolean;readonly leader?:string;
 readonly relations:{other:string;goodwill:number;kind:string}[];readonly defeated:boolean;
}
export interface RwsSave {
 readonly root:XmlNode;readonly game:XmlNode;
 readonly meta:{gameVersion:string;modIds:string[];modNames:string[]};
 readonly ticksGame:number;readonly gameStartAbsTick:number;
 readonly storyteller?:string;readonly difficulty?:string;readonly scenario?:string;
 readonly research:{progress:Map<string,number>;current?:string};
 readonly world?:{node:XmlNode;name?:string;seed?:string;coverage?:number;rainfall?:string;temperature?:string;population?:string;grid:RwsWorldGrid|null};
 readonly factions:RwsFaction[];readonly worldObjects:RwsSettlement[];
 readonly maps:RwsMap[];
 /** Load ID of the player faction (`Faction_N`), from the factions list. */
 readonly playerFaction?:string;
}

const parseCell=(value:string|undefined):RwsCell|null=>{
 if(!value)return null;const m=/\(\s*(-?\d+)\s*,\s*-?\d+\s*,\s*(-?\d+)\s*\)/.exec(value);return m?{x:Number(m[1]),z:Number(m[2])}:null;
};
export function parseSize(value:string|undefined):{width:number;height:number}|null {
 const c=parseCell(value);return c?{width:c.x,height:c.z}:null;
}
/** `86845,0` (tile id and planet layer) or a plain integer. */
export function parseTile(value:string|undefined):number|undefined {
 if(!value)return undefined;const n=Number(value.split(',')[0]);return Number.isSafeInteger(n)&&n>=0?n:undefined;
}
function bytesAt(node:XmlNode|undefined,label:string):Uint8Array|null {
 const deflated=child(node,label+'Deflate');if(deflated&&deflated.text.trim())return savedBytes(deflated.text,true);
 const plain=child(node,label);if(plain&&plain.text.trim())return savedBytes(plain.text,false);
 return null;
}
function ushortGrid(node:XmlNode|undefined,label:string,cells:number):Uint16Array|null {
 const bytes=bytesAt(node,label);if(!bytes)return null;if(bytes.length<cells*2)throw Error(`Grille ${label} trop courte (${bytes.length} octets pour ${cells} cases).`);return readUint16Column(bytes,cells);
}
function bitGrid(node:XmlNode|undefined,label:string,cells:number):Uint8Array|null {
 const bytes=bytesAt(node,label);if(!bytes)return null;const out=new Uint8Array(cells);
 for(let i=0;i<cells;i++)out[i]=(bytes[i>>3]??0)>>(i&7)&1;return out;
}

export function readThing(node:XmlNode,cls=node.attrs?.Class??''):RwsThing {
 const def=text(node,'def')??'',stackText=num(node,'stackCount');
 const health=num(node,'health'),stuff=text(node,'stuff'),quality=text(node,'quality'),faction=text(node,'faction');
 return {node,cls,def,id:text(node,'id')??'',pos:parseCell(text(node,'pos')),rot:num(node,'rot')??0,
  ...stuff?{stuff}:{},...health!==undefined?{hp:health}:{},...quality?{quality}:{},stack:stackText??1,...faction?{faction}:{},forbidden:text(node,'forbidden')==='True'};
}

function readWorldGrid(world:XmlNode):RwsWorldGrid|null {
 const layers=dictionary(at(world,'grid/layers'));
 const surface=layers.map(([,v])=>v).find(v=>text(v,'def')==='Surface'||text(v,'isRootSurface')==='True');
 if(!surface)return null;
 const biomeBytes=bytesAt(surface,'tileBiome');if(!biomeBytes)return null;
 const tiles=biomeBytes.length>>1,biome=readUint16Column(biomeBytes,tiles);
 const column16=(label:string)=>{const b=bytesAt(surface,label);return b&&b.length>=tiles*2?readUint16Column(b,tiles):new Uint16Array(tiles);};
 const column8=(label:string)=>{const b=bytesAt(surface,label);const out=new Uint8Array(tiles);if(b)out.set(b.subarray(0,tiles));return out;};
 const elevationRaw=column16('tileElevation'),temperatureRaw=column16('tileTemperature'),swampRaw=column8('tileSwampiness');
 const elevation=new Int32Array(tiles),temperature=new Float32Array(tiles),swampiness=new Float32Array(tiles);
 for(let i=0;i<tiles;i++){elevation[i]=elevationRaw[i]!-8192;temperature[i]=temperatureRaw[i]!/10-300;swampiness[i]=swampRaw[i]!/255;}
 const links=(prefix:'tileRiver'|'tileRoad')=>{
  const o=bytesAt(surface,prefix+'Origins'),a=bytesAt(surface,prefix+'Adjacency'),d=bytesAt(surface,prefix+'Def');
  if(!o||!a||!d)return [];const origins=readInt32Column(o),defs=readUint16Column(d);
  return Array.from(origins,(origin,i)=>({origin,neighbourIndex:a[i]!,def:defs[i]!}));
 };
 const mt=bytesAt(surface,'tileMutatorTiles'),md=bytesAt(surface,'tileMutatorDefs');
 const mutators=mt&&md?Array.from(readInt32Column(mt),(tile,i)=>({tile,def:readUint16Column(md)[i]!})):[];
 return {tiles,subdivisions:num(surface,'subdivisions')??0,viewAngle:num(surface,'viewAngle')??0,biome,elevation,hilliness:column8('tileHilliness'),temperature,
  rainfall:column16('tileRainfall'),swampiness,riverDistance:column8('tileRiverDistances'),rivers:links('tileRiver'),roads:links('tileRoad'),mutators};
}

function readMap(node:XmlNode,index:number):RwsMap {
 const size=parseSize(text(node,'mapInfo/size'));if(!size||size.width<1||size.height<1)throw Error('Taille de carte illisible dans la sauvegarde.');
 const cells=size.width*size.height,terrain=child(node,'terrainGrid');
 const grids:RwsGrids={
  terrainTop:ushortGrid(terrain,'topGrid',cells),terrainUnder:ushortGrid(terrain,'underGrid',cells),terrainFoundation:ushortGrid(terrain,'foundationGrid',cells),
  color:ushortGrid(terrain,'colorGrid',cells),roofs:ushortGrid(child(node,'roofGrid'),'roofs',cells),snow:ushortGrid(child(node,'snowGrid'),'depthGrid',cells),
  fog:bitGrid(child(node,'fogGrid'),'fogGrid',cells),compressedThings:ushortGrid(node,'compressedThingMap',cells),
 };
 const things=children(child(node,'things'),'thing').map(t=>readThing(t));
 const parent=text(node,'mapInfo/parent');
 return {node,index,width:size.width,height:size.height,...parent?{parent}:{},grids,things,zones:items(node,'zoneManager/allZones'),areas:items(node,'areaManager/areas')};
}

/** Reads the whole save. Throws a French message when the text is not a
 * RimWorld save. Compatibility (version, DLC, mods) is checked separately by
 * `saveCompatibility` so a report can still describe a refused save. */
export function readRwsSave(source:string):RwsSave {
 const root=parseXml(source);
 if(root.name!=='savegame')throw Error('Ce fichier n’est pas une sauvegarde RimWorld (.rws).');
 const meta=child(root,'meta'),game=child(root,'game');
 if(!game)throw Error('La sauvegarde ne contient pas de partie.');
 const list=(path:string)=>items(meta,path).map(n=>n.text.trim()).filter(Boolean);
 const research=new Map<string,number>();
 for(const [k,v] of dictionary(at(game,'researchManager/progress'))){const key=k.text.trim(),value=Number(v.text.trim());if(key&&Number.isFinite(value))research.set(key,value);}
 const worldNode=child(game,'world'),info=child(worldNode,'info');
 const factions:RwsFaction[]=items(worldNode,'factionManager/allFactions').map(f=>({
  loadId:`Faction_${text(f,'loadID')??'0'}`,def:text(f,'def')??'',...text(f,'name')?{name:text(f,'name')!}:{},hidden:text(f,'hidden')==='True',
  ...text(f,'leader')?{leader:text(f,'leader')!}:{},defeated:text(f,'defeated')==='True',
  relations:items(f,'relations').map(r=>({other:text(r,'other')??'',goodwill:num(r,'goodwill')??0,kind:text(r,'kind')??'Neutral'})),
 }));
 const worldObjects:RwsSettlement[]=items(worldNode,'worldObjects/worldObjects').flatMap(o=>{
  const tile=parseTile(text(o,'tile'));if(tile===undefined)return [];
  return [{id:text(o,'ID')??'',tile,cls:o.attrs?.Class??'',...text(o,'def')?{def:text(o,'def')!}:{},...text(o,'faction')?{faction:text(o,'faction')!}:{},...text(o,'nameInt')?{name:text(o,'nameInt')!}:{}}];
 });
 const playerFaction=factions.find(f=>f.def==='PlayerColony'||f.def==='PlayerTribe')?.loadId;
 const storyteller=text(game,'storyteller/def'),difficulty=text(game,'storyteller/difficulty'),scenario=text(game,'scenario/name');
 const world=worldNode?{node:worldNode,...text(info,'name')?{name:text(info,'name')!}:{},...text(info,'seedString')?{seed:text(info,'seedString')!}:{},
  ...num(info,'planetCoverage')!==undefined?{coverage:num(info,'planetCoverage')!}:{},...text(info,'overallRainfall')?{rainfall:text(info,'overallRainfall')!}:{},
  ...text(info,'overallTemperature')?{temperature:text(info,'overallTemperature')!}:{},...text(info,'overallPopulation')?{population:text(info,'overallPopulation')!}:{},
  grid:readWorldGrid(worldNode)}:undefined;
 const currentResearch=text(game,'researchManager/currentProj');
 return {root,game,meta:{gameVersion:text(meta,'gameVersion')??'',modIds:list('modIds'),modNames:list('modNames')},
  ticksGame:num(game,'tickManager/ticksGame')??0,gameStartAbsTick:num(game,'tickManager/gameStartAbsTick')??0,
  ...storyteller?{storyteller}:{},...difficulty?{difficulty}:{},...scenario?{scenario}:{},
  research:{progress:research,...currentResearch?{current:currentResearch}:{}},...world?{world}:{},factions,worldObjects,
  maps:items(game,'maps').map((m,i)=>readMap(m,i)),...playerFaction?{playerFaction}:{}};
}

/** Clear refusal reasons for a save the importer cannot handle. */
export function saveCompatibility(save:RwsSave):{ok:boolean;reasons:string[]} {
 const reasons:string[]=[];
 const version=/^(\d+)\.(\d+)/.exec(save.meta.gameVersion);
 if(!version||Number(version[1])!==1||Number(version[2])!==6)reasons.push(`Version ${save.meta.gameVersion||'inconnue'} : seul RimWorld 1.6 est pris en charge.`);
 const extra=save.meta.modIds.map((id,i)=>({id,name:save.meta.modNames[i]??id})).filter(m=>m.id.toLowerCase()!==CORE_PACKAGE_ID);
 const dlc=extra.filter(m=>m.id.toLowerCase().startsWith('ludeon.rimworld.'));
 const mods=extra.filter(m=>!m.id.toLowerCase().startsWith('ludeon.rimworld.'));
 if(!save.meta.modIds.some(id=>id.toLowerCase()===CORE_PACKAGE_ID))reasons.push('Le jeu de base (Core) est absent de la liste des modules.');
 if(dlc.length)reasons.push(`Extensions non prises en charge : ${dlc.map(m=>m.name).join(', ')}. Seul le jeu de base est importable.`);
 if(mods.length)reasons.push(`Mods non pris en charge : ${mods.map(m=>m.name).join(', ')}.`);
 if(!save.maps.length)reasons.push('La sauvegarde ne contient aucune carte (caravane seule) : rien à importer.');
 return {ok:reasons.length===0,reasons};
}

/** Decodes a short-hash grid against the given definition names. Unknown
 * non-zero values are kept as `undefined` and counted by the caller. */
export function decodeDefGrid(grid:Uint16Array|null,names:Iterable<string>):{values:(string|undefined)[];unknown:Map<number,number>} {
 const table=shortHashTable(names),unknown=new Map<number,number>(),values:(string|undefined)[]=[];
 if(!grid)return {values,unknown};
 for(let i=0;i<grid.length;i++){const h=grid[i]!;if(!h){values.push(undefined);continue;}const name=table.get(h);if(name===undefined)unknown.set(h,(unknown.get(h)??0)+1);values.push(name);}
 return {values,unknown};
}

/** `Thing_Human862` → `Human862`. */
export const referencedThingId=(value:string|undefined):string|undefined=>value?value.replace(/^Thing_/,''):undefined;
export {isNull};
