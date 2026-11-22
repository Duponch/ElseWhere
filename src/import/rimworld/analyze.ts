/** Step 1: reads a RimWorld save and says, family by family, what Elsewhere
 * can represent (exact), what it adapts (and how), and what it leaves out.
 * No Elsewhere world is built; this runs in a browser worker or in Node. */
import {readRwsSave,saveCompatibility,decodeDefGrid,readThing,type RwsSave} from './rws-save.ts';
import {items as listItems,text,num,at,child} from './xml.ts';
import {ImportNotes,type Family} from './notes.ts';
import {lookup,mappingStatus,isDropped,type DefMapping} from './mapping.ts';
import {TERRAIN_MAP,ROOF_MAP,ROCK_MAP,COMPRESSED_CHUNKS} from './map-terrain.ts';
import {PLANT_MAP,DEAD_PLANT_MAP,zonePlant} from './map-plants.ts';
import {BUILDING_MAP} from './map-buildings.ts';
import {ITEM_MAP,APPAREL_MAP,WEAPON_MAP,STUFF_MAP} from './map-items.ts';
import {ANIMAL_MAP,TRAIT_MAP,traitKey,closestBackgrounds,keptBackstory,INJURY_MAP,ADDED_PART_MAP,NON_COLONIST_NOTE,OTHER_HEDIFF_NOTE,CORE_WORK_TYPES} from './map-pawns.ts';
import {RESEARCH_MAP,ZONE_MAP,AREA_MAP} from './map-colony.ts';
import {BIOME_MAP,RIVER_MAP,ROAD_MAP,MUTATOR_MAP,FACTION_MAP} from './map-world.ts';
import {shortHashTable} from './short-hash.ts';
import {childhoodDefinition,adulthoodDefinition} from '../../sim/colonist-backgrounds.ts';

export interface RwsAnalysis {
 save:RwsSave;notes:ImportNotes;compatible:boolean;refusals:string[];
 summary:{version:string;mods:string[];ticks:number;days:number;storyteller?:string;difficulty?:string;scenario?:string;mapSize?:string;
  things:number;colonists:number;pawns:number;zones:number;research:number;factions:number;worldSeed?:string;coverage?:number;worldTiles?:number;playerFaction?:string};
}
export function analyzeRwsText(source:string):RwsAnalysis {return analyzeRwsSave(readRwsSave(source));}

function tally<T>(notes:ImportNotes,family:Family,def:string,m:DefMapping<T>|undefined,describe:(to:T)=>string=String,count=1):void {
 notes.countBefore(family,count);
 notes.def(family,def,mappingStatus(m),m&&!isDropped(m)?describe(m.to):undefined,m?isDropped(m)?m.drop:m.adapt:'Définition inconnue d’Elsewhere : non importée.',count);
}

export function analyzeRwsSave(save:RwsSave):RwsAnalysis {
 const notes=new ImportNotes(),compat=saveCompatibility(save),map=save.maps[0],player=save.playerFaction;
 // World.
 const grid=save.world?.grid;
 if(grid){
  const biomes=shortHashTable(Object.keys(BIOME_MAP)),counts=new Map<string,number>();
  for(const h of grid.biome){const name=biomes.get(h)??`#${h}`;counts.set(name,(counts.get(name)??0)+1);}
  for(const [name,count] of counts)tally(notes,'world',`Biome ${name}`,lookup(BIOME_MAP,name),String,count);
  const rivers=shortHashTable(Object.keys(RIVER_MAP)),roads=shortHashTable(Object.keys(ROAD_MAP)),mutators=shortHashTable(Object.keys(MUTATOR_MAP));
  for(const r of grid.rivers){const n=rivers.get(r.def)??`#${r.def}`;tally(notes,'world',`Rivière ${n}`,lookup(RIVER_MAP,n));}
  for(const r of grid.roads){const n=roads.get(r.def)??`#${r.def}`;tally(notes,'world',`Route ${n}`,lookup(ROAD_MAP,n));}
  for(const m of grid.mutators){const n=mutators.get(m.def)??`#${m.def}`;tally(notes,'world',`Modificateur ${n}`,lookup(MUTATOR_MAP,n),v=>`code ${v}`);}
 }else notes.lost('world','Grille du monde absente : la planète ne peut pas être reconstruite case par case.');
 for(const o of save.worldObjects)if(o.cls!=='Settlement')notes.def('world',`Objet du monde ${o.def??o.cls}`,'dropped',undefined,'Site de quête, épave ou vaisseau : non recréé.');
 for(const f of save.factions)tally(notes,'factions',f.def,lookup(FACTION_MAP,f.def));
 const settlements=save.worldObjects.filter(o=>o.cls==='Settlement'&&o.faction!==player).length;
 notes.mapped('factions',`${settlements} colonies étrangères sur la planète.`);
 notes.def('time','Date du calendrier','adapted','calendrier d’Elsewhere','La date est reprise ; le compteur interne de la partie repart de la création.');
 if(map){
  const terrainNames=Object.keys(TERRAIN_MAP);
  for(const grid of [map.grids.terrainTop]){const d=decodeDefGrid(grid,terrainNames),counts=new Map<string,number>();
   for(const v of d.values)if(v)counts.set(v,(counts.get(v)??0)+1);
   for(const [name,count] of counts)tally(notes,'terrain',name,lookup(TERRAIN_MAP,name),to=>to.kind==='floor'?`sol ${to.floor}`:to.kind==='bridge'?'pont':`${to.terrain}${to.stone?` (${to.stone})`:''}`,count);
   for(const [h,count] of d.unknown)tally(notes,'terrain',`#${h}`,undefined,String,count);}
  const rocks=decodeDefGrid(map.grids.compressedThings,[...Object.keys(ROCK_MAP),...COMPRESSED_CHUNKS]),rockCounts=new Map<string,number>();
  for(const v of rocks.values)if(v)rockCounts.set(v,(rockCounts.get(v)??0)+1);
  for(const [name,count] of rockCounts)if(Object.hasOwn(ROCK_MAP,name))tally(notes,'terrain',name,lookup(ROCK_MAP,name),to=>to.ore?`minerai ${to.ore}`:`roche ${to.stone}`,count);else tally(notes,'items',name,lookup(ITEM_MAP,name),String,count);
  const roofs=decodeDefGrid(map.grids.roofs,Object.keys(ROOF_MAP)),roofCounts=new Map<string,number>();
  for(const v of roofs.values)if(v)roofCounts.set(v,(roofCounts.get(v)??0)+1);
  for(const [name,count] of roofCounts)tally(notes,'roofs',name,lookup(ROOF_MAP,name),String,count);
  // Things.
  for(const t of map.things){
   if(t.cls==='Pawn'){analyzePawn(notes,t.node,t.def,t.faction,player);continue;}
   if(t.cls==='Filth'){tally(notes,'items',t.def,{drop:'Saleté : non importée.'});continue;}
   if(t.cls==='Plant'){tally(notes,'plants',t.def,lookup(PLANT_MAP,t.def),to=>'wild' in to?to.wild:to.crop);continue;}
   if(Object.hasOwn(DEAD_PLANT_MAP,t.def)){tally(notes,'plants',t.def,lookup(DEAD_PLANT_MAP,t.def));continue;}
   if(Object.hasOwn(ROCK_MAP,t.def)){tally(notes,'terrain',t.def,lookup(ROCK_MAP,t.def),to=>to.ore?`minerai ${to.ore}`:`roche ${to.stone}`);continue;}
   if(t.cls==='Frame'||t.cls.startsWith('Blueprint')){tally(notes,'buildings',t.def,{drop:'Chantier ou plan en cours : non importé.'});continue;}
   if(Object.hasOwn(BUILDING_MAP,t.def)||t.cls.startsWith('Building')){
    const m=lookup(BUILDING_MAP,t.def);tally(notes,'buildings',t.def,m,to=>to.kind);
    if(t.stuff&&m&&!isDropped(m))tally(notes,'buildings',`matière ${t.stuff}`,lookup(STUFF_MAP,t.stuff),to=>to.construction??'aucune');
    continue;
   }
   if(t.cls==='Corpse'){tally(notes,'items',t.def,{drop:'Cadavre : non importé.'});continue;}
   if(t.cls==='RectTrigger'||t.cls.startsWith('SignalAction'))continue;
   if(Object.hasOwn(APPAREL_MAP,t.def)){tally(notes,'apparel',t.stuff?`${t.def} (${t.stuff})`:t.def,lookup(APPAREL_MAP,t.def),to=>'family' in to?to.family:'armor' in to?to.armor:to.item);continue;}
   if(Object.hasOwn(WEAPON_MAP,t.def)){tally(notes,'weapons',t.stuff?`${t.def} (${t.stuff})`:t.def,lookup(WEAPON_MAP,t.def),to=>'family' in to?to.family:to.item);continue;}
   tally(notes,'items',t.def,lookup(ITEM_MAP,t.def));
  }
  for(const zone of map.zones){const cls=zone.attrs?.Class??'';tally(notes,'zones',cls,lookup(ZONE_MAP,cls));
   if(cls==='Zone_Growing'){const p=text(zone,'plantDefToGrow'),m=zonePlant(p);notes.def('zones',`champ de ${p??'?'}`,mappingStatus(m),m&&!isDropped(m)?m.to:undefined,m?isDropped(m)?m.drop:m.adapt:'Plante inconnue.');}}
  for(const area of map.areas){const cls=area.attrs?.Class??'';tally(notes,'zones',cls,lookup(AREA_MAP,cls));}
 }
 for(const [def,points] of save.research.progress)if(points>0)tally(notes,'research',def,lookup(RESEARCH_MAP,def));
 const colonists=map?map.things.filter(t=>t.cls==='Pawn'&&t.def==='Human'&&t.faction===player&&text(child(t.node,'guest'),'guestStatus')!=='Prisoner').length:0;
 return {save,notes,compatible:compat.ok,refusals:compat.reasons,summary:{version:save.meta.gameVersion,mods:save.meta.modNames,ticks:save.ticksGame,days:Math.floor(save.ticksGame/60000),
  ...save.storyteller?{storyteller:save.storyteller}:{},...save.difficulty?{difficulty:save.difficulty}:{},...save.scenario?{scenario:save.scenario}:{},
  ...map?{mapSize:`${map.width}×${map.height}`}:{},things:map?.things.length??0,colonists,pawns:map?map.things.filter(t=>t.cls==='Pawn').length:0,zones:map?.zones.length??0,
  research:[...save.research.progress.values()].filter(v=>v>0).length,factions:save.factions.length,...save.world?.seed!==undefined?{worldSeed:save.world.seed}:{},
  ...save.world?.coverage!==undefined?{coverage:save.world.coverage}:{},...grid?{worldTiles:grid.tiles}:{},...player?{playerFaction:save.factions.find(f=>f.loadId===player)?.name??player}:{}}};
}

function analyzePawn(notes:ImportNotes,node:import('./xml.ts').XmlNode,race:string,faction:string|undefined,player:string|undefined):void {
 if(race!=='Human'){
  const m=lookup(ANIMAL_MAP,race);
  if(!m&&race.startsWith('Mech_')){tally(notes,'colonists',race,{drop:NON_COLONIST_NOTE.mechanoid});return;}
  tally(notes,'animals',`${race}${faction===player?' (colonie)':' (sauvage)'}`,m);
  return;
 }
 const prisoner=text(child(node,'guest'),'guestStatus')==='Prisoner'||text(child(node,'guest'),'hostFaction')===player&&faction!==player;
 if(prisoner){tally(notes,'colonists','Prisonnier',{drop:NON_COLONIST_NOTE.prisoner});return;}
 if(faction!==player){tally(notes,'colonists','Visiteur ou ennemi',{drop:NON_COLONIST_NOTE.hostile});return;}
 tally(notes,'colonists','Colon',{to:'colon'});
 for(const tr of listItems(node,'story/traits/allTraits')){const def=text(tr,'def')??'',degree=num(tr,'degree');tally(notes,'traits',degree?`${def} (${degree})`:def,lookup(TRAIT_MAP,traitKey(def,degree)));}
 const child_=text(node,'story/childhood'),adult=text(node,'story/adulthood'),age=(num(node,'ageTracker/ageBiologicalTicks')??0)/10;
 const choice=closestBackgrounds(child_,adult,age>=20*360000);
 if(child_)notes.def('backstories',child_,keptBackstory(child_,choice.childhood)?'exact':'adapted',choice.childhood,keptBackstory(child_,choice.childhood)?`« ${childhoodDefinition(choice.childhood).label} ».`:`« ${childhoodDefinition(choice.childhood).label} » (écart ${choice.childhoodDistance}).`);
 if(adult)notes.def('backstories',adult,!choice.adulthood?'dropped':keptBackstory(adult,choice.adulthood)?'exact':'adapted',choice.adulthood,!choice.adulthood?'Âge adulte non admis.':keptBackstory(adult,choice.adulthood)?`« ${adulthoodDefinition(choice.adulthood).label} ».`:`« ${adulthoodDefinition(choice.adulthood).label} » (écart ${choice.adulthoodDistance}).`);
 notes.def('skills','Niveaux, expérience et passions (12 compétences)','exact','compétences');
 const vals=listItems(at(node,'workSettings/priorities'),'vals').length;
 notes.def('skills','Priorités de travail',vals===CORE_WORK_TYPES.length?'exact':'dropped',vals===CORE_WORK_TYPES.length?'priorités':undefined,vals===CORE_WORK_TYPES.length?undefined:'Absentes.');
 for(const h of listItems(at(node,'healthTracker/hediffSet/hediffs'))){
  const cls=h.attrs?.Class,def=text(h,'def')??'?';
  if(cls==='Hediff_Injury')tally(notes,'health',text(h,'isPermanent')==='True'?`${def} (cicatrice)`:def,lookup(INJURY_MAP,def));
  else if(cls==='Hediff_AddedPart')tally(notes,'health',def,lookup(ADDED_PART_MAP,def));
  else if(cls==='Hediff_MissingPart')tally(notes,'health','MissingBodyPart',{to:'partie manquante'});
  else if(def==='BadBack'||def==='Frail')tally(notes,'health',def,{to:def==='BadBack'?'bad-back':'frail'});
  else tally(notes,'health',def,{drop:OTHER_HEDIFF_NOTE});
 }
 for(const a of listItems(at(node,'apparel/wornApparel/innerList'))){const t=readThing(a);tally(notes,'apparel',t.stuff?`${t.def} (${t.stuff})`:t.def,lookup(APPAREL_MAP,t.def),to=>'family' in to?to.family:'armor' in to?to.armor:to.item);}
 for(const e of listItems(at(node,'equipment/equipment/innerList'))){const t=readThing(e);tally(notes,'weapons',t.stuff?`${t.def} (${t.stuff})`:t.def,lookup(WEAPON_MAP,t.def),to=>'family' in to?to.family:to.item);}
}
