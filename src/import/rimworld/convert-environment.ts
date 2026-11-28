/** Explicit local import owners. All old clocks stay at their actual local
 * epoch; imported durations/physical quantities use fields already supported
 * by the simulation. No omitted state is manufactured for reporting. */
import type {ImportContext} from './convert.ts';
import {type RwsThing,ushortGrid} from './rws-save.ts';
import {child,items,num,text,type XmlNode} from './xml.ts';
import {shortHashTable} from './short-hash.ts';
import type {Resource,Tile} from '../../sim/types.ts';
import {rockMaxHP} from '../../sim/mining-rules.ts';
import {resourceMaxHp} from '../../sim/thing-damage-rules.ts';
import {validInitialPlantAge256} from '../../sim/initial-plant-age-256.ts';
import {validPlantLife} from '../../sim/plant-life-save.ts';
import {PLANT_LIFE_INTERVAL,createPlantLife} from '../../sim/plant-life.ts';
import {isForestrySpecies291} from '../../sim/forestry-content-291.ts';
import {effectiveCore297} from '../../sim/core-phase-297.ts';
import {validWildFloraState256} from '../../sim/wild-plant-runtime-256.ts';
import {FILTH_MAP} from './map-items.ts';
import {ensureFilth,type FilthFeet,type FilthKind} from '../../sim/filth-rules.ts';
import {validFilthFeet} from '../../sim/filth-save.ts';
import {DAYLILY_DEFINITION,validateDaylilyState} from '../../sim/flower-pot.ts';
import {snowFullCells,terrainRetainsSnow} from '../../sim/snow-surface.ts';
import {invalidateTerrainJournal} from '../../sim/terrain-mutation-journal.ts';
import {adoptWeather} from '../../sim/weather.ts';
import {reconcileTemperature} from '../../sim/temperature.ts';
import {validateWeather} from '../../sim/weather-save.ts';
import type {WeatherKind} from '../../sim/weather-definitions.ts';
import {adoptDeepResources,deepResourceKindAvailable,type DeepResourceCell,type DeepResourceKind} from '../../sim/deep-resources.ts';

const safeInteger=(n:number|undefined,min=0):n is number=>n!==undefined&&Number.isSafeInteger(n)&&n>=min;

export function importMineableCondition(ctx:ImportContext,tile:Tile,thing:RwsThing):void {
 const hp=thing.hp;if(!safeInteger(hp,1))return;
 const max=rockMaxHP(tile);
 if(hp<max){
  tile.miningDamage=max-hp;
  // RimWorld's contribution from previous strokes is not saved in this
  // corresponding owner; leave the existing neutral-yield convention.
 }
 if(tile.mineable)ctx.thingIds.set(thing.id,tile.mineable.id);
 ctx.notes.def('mineable-state',`${thing.def} (points de vie)`,hp<=max?'exact':'adapted',undefined,
  hp>max?'Maximum de points de vie différent.':undefined);
}

export function importPlantCondition(ctx:ImportContext,plant:Resource,thing:RwsThing):void {
 const {w,notes}=ctx,max=resourceMaxHp(plant);
 if(safeInteger(thing.hp,1)&&max>0){
  if(thing.hp<max)plant.damage=max-thing.hp;
  notes.def('plant-state','Points de vie',thing.hp<=max?'exact':'adapted',undefined,thing.hp>max?'Maximum différent dans Elsewhere.':undefined);
 }
 const age=num(thing.node,'age')??0,life=plant.plantLife,unlit=num(thing.node,'unlitTicks')??0;
 if(safeInteger(age)&&life){
  // With the actual game clock restored, a plant's past can be represented
  // by the age already observed at its native staggered frontier. A wild
  // plant can additionally retain pre-map age and Core-tick remainder via
  // the bounded initial-age offset. No invented negative local date.
  const template=createPlantLife(w,plant),last=template.nextCheck-PLANT_LIFE_INTERVAL,
        climateAt=w.climate?.adoptedAt??0,oldest=Math.max(0,last-climateAt),desired=Math.floor(age/10);
  const observed=Math.min(oldest,desired),since=observed>0?last-observed:w.tick;
  const sown=text(thing.node,'sown')==='True',sownTree=sown&&plant.kind==='tree'&&isForestrySpecies291(plant.species);
  const common={...template,since,age:observed,darkTicks:Math.min(observed,Math.max(0,Math.floor(unlit/10)))};
  const remainder=age-observed*10;
  const exactCandidate={...plant,plantLife:{...common,...remainder>0?{initialAgeCore:remainder}:{}},...sownTree?{sown291:true as const}:{}};
  const ordinary={...plant,...sownTree?{sown291:true as const}:{},plantLife:{...common,...sownTree?{bornAt:since}:{}}};
  if(!sownTree&&validInitialPlantAge256(exactCandidate,w.schemaVersion)&&validPlantLife(exactCandidate,w.schemaVersion,w)){
   plant.plantLife=exactCandidate.plantLife;notes.def('plant-state','Âge','exact');
  }else if(validPlantLife(ordinary,w.schemaVersion,w)){
   plant.plantLife=ordinary.plantLife;if(sownTree)plant.sown291=true;
   notes.def('plant-state','Âge',remainder===0?'exact':observed>0?'adapted':'dropped',undefined,remainder>0?'Partie de l’âge antérieure à la carte ou reste Core non représentable pour cette plante.':undefined);
  }else notes.def('plant-state','Âge','dropped',undefined,'Décalage d’âge non représentable par cette horloge de plante.');
  if(unlit>0){
   const preserved=(plant.plantLife?.darkTicks??0)*10;
   notes.def('plant-state','Temps sans lumière',preserved===unlit?'exact':preserved>0?'adapted':'dropped',undefined,preserved!==unlit?'Historique sombre antérieur à la carte ou précision Core non représentable.':undefined);
  }
 }else if(safeInteger(age,1))notes.def('plant-state','Âge','dropped',undefined,'Horloge de végétation absente de cette carte.');
 const leafless=num(thing.node,'madeLeaflessTick');
 if(leafless!==undefined&&leafless>=0&&ctx.save.ticksGame-leafless<60000){
  const l=plant.plantLife,elapsed=(ctx.save.ticksGame-leafless)/10;
  const desired=Math.floor((effectiveCore297(w)-Math.max(0,ctx.save.ticksGame-leafless))/10),phase=(plant.id+1)%PLANT_LIFE_INTERVAL;
  const at=desired-((desired-phase)%PLANT_LIFE_INTERVAL+PLANT_LIFE_INTERVAL)%PLANT_LIFE_INTERVAL;
  let kept=false;
  if(l&&at>=l.since&&at>=0&&w.tick-at<6000){
   const candidate={...plant,plantLife:{...l,leaflessAt:at}};
   if(validPlantLife(candidate,w.schemaVersion,w)){plant.plantLife=candidate.plantLife;notes.def('plant-state','Sans feuilles',elapsed===w.tick-at?'exact':'adapted');kept=true;}
  }
  if(!kept)notes.def('plant-state','Sans feuilles','dropped',undefined,'Décalage de dépérissement antérieur à l’horloge locale.');
 }
 if(unlit>0&&!life)notes.def('plant-state','Temps sans lumière','dropped',undefined,'Horloge de végétation absente de cette carte.');
}

/** Native Core WildPlantSpawner aggregate and partially evaluated cycle. A
 * fresh generation pass is unnecessary when these original counters exist. */
export function importWildFloraSnapshot(ctx:ImportContext):boolean {
 const {w,map,notes}=ctx,raw=child(map.node,'wildPlantSpawner');
 if(w.site?.revision!==3||!raw)return false;
 const saved=(key:string)=>num(raw,key),cycle=saved('cycleIndex'),desired=saved('calculatedWholeMapNumDesiredPlants'),desiredTmp=saved('calculatedWholeMapNumDesiredPlantsTmp'),
  fertile=saved('calculatedWholeMapNumNonZeroFertilityCells'),fertileTmp=saved('calculatedWholeMapNumNonZeroFertilityCellsTmp');
 if(cycle===undefined||desired===undefined||desiredTmp===undefined||fertile===undefined||fertileTmp===undefined){
  notes.def('plant-state','Horloge de renouvellement sauvage','dropped',undefined,'Agrégats absents ou incomplets.');return false;
 }
 const state={revision:2 as const,cycleIndex:cycle,desired:Math.fround(desired),desiredTmp:Math.fround(desiredTmp),fertile,fertileTmp,hasCalculated:true,lastTick:w.tick};
 if(!validWildFloraState256(state,w,w.schemaVersion)){
  notes.def('plant-state','Horloge de renouvellement sauvage','dropped',undefined,'Agrégats hors du domaine valide.');return false;
 }
 w.flora=state;
 notes.def('plant-state','Horloge de renouvellement sauvage','exact','index du cycle, agrégats de fertilité et densité');
 notes.adapted('plant-state','Les compteurs sauvages sont importés ; la séquence future de tirages et l’ordre de parcours du repère local ne sont pas encore prouvés identiques.');
 return true;
}

/** Actual filth carried by a walking creature contributes future footprints.
 * It belongs to that original actor, not a second ground filth entity. */
export function importActorFilthFeet(ctx:ImportContext,owner:{filthFeet?:FilthFeet},node:XmlNode,family:'animals'|'pawn-state'):void {
 const raw=child(node,'filth');if(!raw)return;
 const last=text(raw,'lastTerrainFilthDef'),kinds=new Map<FilthKind,number>();
 for(const f of items(raw,'carriedFilth')){
  const source=text(f,'def')??'',kind=Object.hasOwn(FILTH_MAP,source)?FILTH_MAP[source]:undefined,thickness=num(f,'thickness')??1;
  if(!kind||kind==='rock-rubble'||kind==='building-rubble'||!Number.isSafeInteger(thickness)||thickness<1){
   ctx.notes.def(family,'Saleté portée : '+source,'dropped',undefined,'Type de saleté porté non représentable.');continue;
  }
  const total=(kinds.get(kind)??0)+thickness;kinds.set(kind,Math.min(5,total));
  ctx.notes.def(family,'Saleté portée : '+source,total>5?'adapted':'exact',kind,total>5?'Accumulation limitée à cinq.':undefined);
 }
 const state:FilthFeet={carried:[...kinds].map(([kind,thickness])=>({kind,thickness})),...last==='Filth_Dirt'?{lastTerrain:'dirt' as const}:{}};
 const nonempty=state.carried.length>0||state.lastTerrain!==undefined;
 if(last&&last!=='Filth_Dirt')ctx.notes.def(family,'Dernier sol sale : '+last,'dropped',undefined,'Le modèle des empreintes ne mémorise que la terre.');
 if(validFilthFeet(state,ctx.w.schemaVersion)){ensureFilth(ctx.w);owner.filthFeet=state;}
 else if(nonempty)ctx.notes.def(family,'Saleté portée','dropped',undefined,'Ensemble de saletés incompatible.');
}

/** A daylily is owned by its existing pot, not a second on-map resource. */
export function importPottedDaylily(ctx:ImportContext,thing:RwsThing,pots:ReadonlyMap<number,import('../../sim/types.ts').Structure>):boolean {
 const {w,notes}=ctx;if(!thing.pos)return false;
 const pot=pots.get(ctx.index(ctx.coordinates.cell(thing.pos)));
 if(!pot?.flower||pot.flower.plant)return false;
 const rawGrowth=num(thing.node,'growth')??0;
 const plant={species:'daylily' as const,sownAt:w.tick,lastTick:w.tick,growth:Math.max(.0001,Math.min(1,rawGrowth)),
  ageCore:Math.max(0,Math.floor(num(thing.node,'age')??0)),unlitCore:Math.max(0,Math.floor(num(thing.node,'unlitTicks')??0)),
  hitPoints:Math.max(0,Math.min(DAYLILY_DEFINITION.maxHitPoints,thing.hp??DAYLILY_DEFINITION.maxHitPoints))};
 if(validateDaylilyState(plant,w.tick).length)return false;
 pot.flower={...pot.flower,plant};
 notes.countAfter('plants');notes.def('plants',thing.def,rawGrowth===plant.growth&&thing.hp===plant.hitPoints?'exact':'adapted','daylily');
 return true;
}

export function importSnow(ctx:ImportContext):void {
 const {w,map,notes,coordinates}=ctx,grid=map.grids.snow;if(!grid)return;
 const full=snowFullCells(w);let kept=0,dropped=0;
 for(let source=0;source<grid.length;source++){
  const value=grid[source]!;if(!value)continue;
  const index=coordinates.index(source),tile=w.tiles[index]!;
  if(!w.snow||full.has(index)||!terrainRetainsSnow(tile.terrain,!!tile.bridge)){dropped++;continue;}
  // SnowGrid uses a ushort over [0,1], round-to-nearest on write and
  // single-precision division on read. Preserve that decoded float.
  tile.snowDepth=Math.fround(value/65535);kept++;
 }
 if(kept){invalidateTerrainJournal(w.tiles);notes.def('snow','Neige (profondeur)','exact',undefined,undefined,kept);}
 if(dropped)notes.def('snow','Neige (profondeur)','dropped',undefined,'Support de neige non admis par Elsewhere.',dropped);
}

const deepDefs=new Map<string,DeepResourceKind>([['Steel','steel'],['Gold','gold'],['Silver','silver'],['Plasteel','plasteel'],['Uranium','uranium'],['Jade','jade']]);
const deepNames=shortHashTable(deepDefs.keys());
export function importDeepResources(ctx:ImportContext):void {
 const {map,w,notes,coordinates}=ctx,grid=child(map.node,'deepResourceGrid'),n=map.width*map.height;
 const defs=ushortGrid(grid,'defGrid',n),counts=ushortGrid(grid,'countGrid',n);
 if(!defs||!counts)return;
 adoptDeepResources(w);const cells:DeepResourceCell[]=[];
 for(let i=0;i<n;i++){
  const count=counts[i]!;if(!count)continue;
  const name=deepNames.get(defs[i]!)??`#${defs[i]}`,item=deepDefs.get(name);
  notes.countBefore('deep-resources');
  if(!w.deepResources||!deepResourceKindAvailable(item,w.schemaVersion)||count>300){
   notes.def('deep-resources',name,'dropped',undefined,`Gisement de ${count} unités : type ou quantité non représentable.`);continue;
  }
  cells.push({index:coordinates.index(i),item,count});notes.countAfter('deep-resources');notes.def('deep-resources',name,'exact',item);
 }
 if(w.deepResources)w.deepResources.cells=cells.sort((a,b)=>a.index-b.index);
}

const WEATHER_MAP:Readonly<Record<string,WeatherKind>>={Clear:'clear',Fog:'fog',Rain:'rain',DryThunderstorm:'dry-thunderstorm',RainyThunderstorm:'rainy-thunderstorm',FoggyRain:'foggy-rain',SnowGentle:'snow-gentle',SnowHard:'snow-hard'};
export function importWeather(ctx:ImportContext):void {
 const {w,map,notes}=ctx,raw=child(map.node,'weatherManager'),value=text(raw,'curWeather');
 if(!value)return;
 const before=w.weather;adoptWeather(w);
 const current=WEATHER_MAP[value],prior=text(raw,'lastWeather')??value,previous=WEATHER_MAP[prior],age=num(raw,'curWeatherAge')??0,duration=num(map.node,'weatherDecider/curWeatherDuration');
 if(!current||!previous||!safeInteger(age)||!safeInteger(duration,1)){
  if(!before)delete w.weather;
  notes.def('weather',value,'dropped',undefined,'Types ou durée météo non représentables.');return;
 }
 w.weather={...w.weather!,current,previous,ageCore:age,durationCore:duration};
 if(validateWeather(w,w.schemaVersion).length){
  if(before)w.weather=before;else delete w.weather;
  notes.def('weather',value,'dropped',undefined,'Horloges météo non admises par le modèle courant.');return;
 }
 notes.def('weather',value,'exact',current,'Météo actuelle/précédente et durée conservées.');
 notes.adapted('weather','Le flux aléatoire météo et la surveillance des incendies restent ceux de la simulation Elsewhere.');
}

/** TemperatureVacuumSaveLoad writes 16 fractional steps per degree with
 * an unsigned bias of 32768. In Core every cell of a room has the same
 * value. Reconcile our *actual* reconstructed room geometry first. If a
 * missing wall merges several Core rooms, use the existing volume-weighted
 * mixing rule and disclose the information loss, not a fabricated uniform
 * outside temperature. */
export function importThermalTemperatures(ctx:ImportContext):void {
 const {map,w,notes,coordinates}=ctx;
 const grid=ushortGrid(child(map.node,'temperatureCache'),'temperatures',w.width*w.height);
 if(!grid)return;
 delete w.thermal;reconcileTemperature(w);
 const regions=(w as import('../../sim/types.ts').World).thermal?.regions??[];
 let exact=0,adapted=0,unrepresented=0,cells=0;
 for(const region of regions){
  let total=0,first:number|undefined,uniform=true,valid=true;
  for(const index of region.cells){
   const temperature=(grid[coordinates.index(index)]!-32768)/16;
   if(temperature< -273.15||temperature>1000){valid=false;break;}
   if(first===undefined)first=temperature;else if(temperature!==first)uniform=false;
   total+=temperature;
  }
  if(!valid){unrepresented++;continue;}
  region.temperature=total/region.cells.length;cells+=region.cells.length;
  if(uniform)exact++;else adapted++;
 }
 if(exact)notes.def('weather','Température de pièce','exact',undefined,'Valeur réellement sauvegardée.',exact);
 if(adapted)notes.def('weather','Température de pièce','adapted',undefined,'Géométrie de pièce différente ; mélange pondéré des cellules d’origine.',adapted);
 if(unrepresented)notes.def('weather','Température de pièce','dropped',undefined,'Valeur en dehors du domaine de température.',unrepresented);
 if(cells)notes.mapped('weather',`${cells} cellules de pièces : températures importées.`);
}
