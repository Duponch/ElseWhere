/** Step 1: reads a RimWorld save and says, family by family, what Elsewhere
 * can represent (exact), what it adapts (and how), and what it leaves out.
 * No Elsewhere world is built; this runs in a browser worker or in Node. */
import {readRwsSave,saveCompatibility,decodeDefGrid,readThing,type RwsSave,type RwsThing} from './rws-save.ts';
import {items as listItems,text,num,at,child} from './xml.ts';
import {ImportNotes,type Family} from './notes.ts';
import {lookup,mappingStatus,isDropped,type DefMapping} from './mapping.ts';
import {TERRAIN_MAP,ROOF_MAP,ROCK_MAP,COMPRESSED_CHUNKS} from './map-terrain.ts';
import {PLANT_MAP,DEAD_PLANT_MAP,zonePlant} from './map-plants.ts';
import {RWS_MECH_KIND} from './convert-mechanoids.ts';
import {BUILDING_MAP} from './map-buildings.ts';
import {ITEM_MAP,APPAREL_MAP,WEAPON_MAP,STUFF_MAP,FILTH_MAP,knownItemGapOrigin} from './map-items.ts';
import {minifiable} from '../../sim/furniture-rules.ts';
import {extractTreeDefinition} from '../../sim/tree-transfer-rules.ts';
import {coreRecipe} from './convert-production.ts';
import type {GapOrigin} from './gap-origin.ts';
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

function tally<T>(notes:ImportNotes,family:Family,def:string,m:DefMapping<T>|undefined,describe:(to:T)=>string=String,count=1,origin?:GapOrigin):void {
 notes.countBefore(family,count);
 notes.def(family,def,mappingStatus(m),m&&!isDropped(m)?describe(m.to):undefined,m?isDropped(m)?m.drop:m.adapt:'Définition inconnue d’Elsewhere : non importée.',count,origin);
}
function analyzeGear(notes:ImportNotes,t:RwsThing):boolean {
 const label=t.stuff?`${t.def} (${t.stuff})`:t.def;
 if(Object.hasOwn(APPAREL_MAP,t.def)){
  if(t.def==='Apparel_AdvancedHelmet'&&t.stuff==='Plasteel')tally(notes,'apparel',label,{to:'plasteel-flak-helmet'});
  else{const m=lookup(APPAREL_MAP,t.def)!;tally(notes,'apparel',label,m,to=>'family' in to?to.family:'armor' in to?to.armor:to.item,1,mappingStatus(m)==='exact'?undefined:'model');}
  return true;
 }
 if(Object.hasOwn(WEAPON_MAP,t.def)){
  if(t.def==='MeleeWeapon_Knife'&&t.stuff==='Plasteel')tally(notes,'weapons',label,{to:'plasteel-knife'});
  else{const m=lookup(WEAPON_MAP,t.def)!;tally(notes,'weapons',label,m,to=>'family' in to?to.family:to.item,1,mappingStatus(m)==='exact'?undefined:'model');}
  return true;
 }
 return false;
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
   if(t.cls==='Filth'){
    const kind=Object.hasOwn(FILTH_MAP,t.def)?FILTH_MAP[t.def]:undefined;
    tally(notes,'items',t.def,kind?{to:kind}:{drop:'Type de saleté distinct absent du modèle.'},String,1,kind?undefined:'model');continue;
   }
   if(t.cls==='Plant'){tally(notes,'plants',t.def,lookup(PLANT_MAP,t.def),to=>'wild' in to?to.wild:'crop' in to?to.crop:to.pot);continue;}
   if(Object.hasOwn(DEAD_PLANT_MAP,t.def)){tally(notes,'plants',t.def,lookup(DEAD_PLANT_MAP,t.def));continue;}
   if(Object.hasOwn(ROCK_MAP,t.def)){tally(notes,'terrain',t.def,lookup(ROCK_MAP,t.def),to=>to.ore?`minerai ${to.ore}`:`roche ${to.stone}`);continue;}
   if(t.cls==='Frame'||t.cls.startsWith('Blueprint')){
    const source=t.def.replace(/^(?:Frame|Blueprint)_/,''),building=lookup(BUILDING_MAP,source);
    if((t.cls==='Frame'||t.cls==='Blueprint_Build')&&building&&!isDropped(building))
     tally(notes,'production',t.def,{to:building.to.kind,adapt:'Type de chantier représentable ; emplacement, coût et matières livrées à valider avec le monde converti.'},String,1,'unresolved');
    else tally(notes,'production',t.def,{drop:'Type de chantier ou blueprint sans propriétaire représentable.'},String,1,'model');
    continue;
   }
   if(t.def==='SteamGeyser'){
    notes.def('buildings',t.def,'adapted','geyser','Geyser naturel repris par son propriétaire de carte sur une carte géographique ; phase de vapeur réinitialisée.');continue;
   }
   if(Object.hasOwn(BUILDING_MAP,t.def)||t.cls.startsWith('Building')){
    const m=lookup(BUILDING_MAP,t.def);tally(notes,'buildings',t.def,m,to=>to.kind);
    if(t.stuff&&m&&!isDropped(m))tally(notes,'buildings',`matière ${t.stuff}`,lookup(STUFF_MAP,t.stuff),to=>to.construction??'aucune');
    continue;
   }
   if(t.cls==='Corpse'){
    const race=t.def.replace(/^Corpse_/,''),species=lookup(ANIMAL_MAP,race);
    if(race==='Human'||species&&!isDropped(species))tally(notes,'items',t.def,{to:race==='Human'?'human-corpse':(species as {to:string}).to,adapt:'Type de corps pris en charge ; identité morte, cause clinique et âge à valider avant l’adoption.'},String,1,'unresolved');
    else tally(notes,'items',t.def,{drop:'Type de corps sans équivalent.'},String,1,'model');
    continue;
   }
   if(t.cls==='RectTrigger'||t.cls.startsWith('SignalAction'))continue;
   if(t.def==='MinifiedThing'){
    const inner=listItems(at(t.node,'innerContainer/innerList'))[0],label=text(inner,'def'),m=label?lookup(BUILDING_MAP,label):undefined;
    if(!label)tally(notes,'items',t.def,{drop:'Bâtiment intérieur original absent.'},String,1,'source');
    else if(!m||isDropped(m)||!minifiable(m.to.kind))tally(notes,'items',`MinifiedThing (${label})`,{drop:'Bâtiment absent ou non minifiable.'},String,1,m?'model':'unresolved');
    else tally(notes,'items',`MinifiedThing (${label})`,{to:m.to.kind,adapt:'Bâtiment minifiable ; les propriétaires et données d’état seront contrôlés pendant la conversion.'},String,1,'unresolved');
    continue;
   }
   if(t.def==='MinifiedTree'){
    const inner=listItems(at(t.node,'innerContainer/innerList'))[0],label=text(inner,'def'),m=label?lookup(PLANT_MAP,label):undefined;
    if(!inner)tally(notes,'items',t.def,{drop:'Plante intérieure originale absente.'},String,1,'source');
    else if(m&&!isDropped(m)&&'wild' in m.to&&extractTreeDefinition({kind:'tree',species:m.to.wild}))tally(notes,'items',t.def,{to:'minified-tree',adapt:'Arbre compatible ; la chronologie réelle de son emballage sera validée.'},String,1,'unresolved');
    else tally(notes,'items',t.def,{drop:'Espèce d’arbre emballé non représentée.'},String,1,m?'model':'unresolved');
    continue;
   }
   if(t.cls==='UnfinishedThing'||t.def.startsWith('Unfinished')){
    const raw=text(t.node,'recipe'),recipe=coreRecipe(raw),creator=text(t.node,'creator');
    if(!raw||!creator||num(t.node,'workLeft')===undefined)tally(notes,'production',t.def,{drop:'Recette, créateur ou progression originale absents.'},String,1,'source');
    else if(!recipe)tally(notes,'production',t.def,{drop:'Recette de l’ouvrage sans équivalent courant.'},String,1,'model');
    else tally(notes,'production',t.def,{to:recipe,adapt:'Recette compatible ; les matières, le créateur et la progression seront contrôlés avant l’adoption.'},String,1,'unresolved');
    continue;
   }
   if(analyzeGear(notes,t))continue;
   tally(notes,'items',t.def,lookup(ITEM_MAP,t.def),String,1,knownItemGapOrigin(t.def));
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
  if(!m&&race.startsWith('Mech_')){const kind=RWS_MECH_KIND[race];tally(notes,'colonists',race,kind?{to:kind}:{drop:NON_COLONIST_NOTE.mechanoid});return;}
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
 for(const a of listItems(at(node,'apparel/wornApparel/innerList'))){const t=readThing(a);if(!analyzeGear(notes,t))tally(notes,'apparel',t.def,undefined);}
 for(const e of listItems(at(node,'equipment/equipment/innerList'))){const t=readThing(e);if(!analyzeGear(notes,t))tally(notes,'weapons',t.def,undefined);}
}
