import { isColonist } from './affiliation.ts';
import { enableAndInitializeWork, initializesWorkLikeCore302 } from './work-initialization.ts';
import {finalizeInitialWorldRegistry} from './world-map-context.ts';
import {initializeSnowSurface} from './snow-surface.ts';
import { resolveStartingSite,type StartingWorld } from './starting-world.ts';
import { adoptStartingSiteClimate } from './site-climate.ts';
import { isPlant,plantGrowth } from './plants.ts';
import { createPlantLife } from './plant-life.ts';
import { adoptWeather } from './weather.ts';
import { adoptWind } from './wind.ts';
import { ensureFireState } from './fire-rules.ts';
import { ARRIVING_CRASHLANDED_REVISION } from './scenario-definitions.ts';
import { prepareStartingArrival } from './starting-arrival.ts';
import { adoptColonyEconomy } from './colony-economy.ts';
import { enableVisitors } from './visitors.ts';
import { enableArrivals } from './arrivals.ts';
import { enableCassandraRaids } from './cassandra-raids.ts';
import { adoptFluIncidents } from './flu-incidents.ts';
import { adoptMiscIncidents } from './cassandra-misc.ts';
import { crashlandedProfile } from './game-profile.ts';
import { setupEncounter } from './encounter-scenario.ts';
import { generateWorld } from './generation.ts';
import { generateSiteWorld } from './site-generation.ts';
import { resolveSite,type SiteOptions } from './site.ts';
import { nearbyGround } from './ground-placement.ts';
import { enableHeatwaves } from './heatwave.ts';
import { ITEM_DEFINITIONS,type ItemId } from './items.ts';
import { validMapDimension } from './map-config.ts';
import { addMaterial } from './materials.ts';
import { blockedCells } from './pathfinding.ts';
import { enableRaids } from './raids.ts';
import { AIR_CONDITIONING_COST,CLOTHING_RESEARCH_COST,COMPLEX_FURNITURE_RESEARCH_COST,STONECUTTING_RESEARCH_COST } from './research.ts';
import { DEFAULT_SCENARIO,isScenarioId,SCENARIOS,SCENARIO_REVISION,type ScenarioId } from './scenario-definitions.ts';
import { startingPawn } from './starting-pawns.ts';
import { materializeStartingCandidate,previewStartingParty,validStartingParty,type StartingParty } from './starting-candidates.ts';
import { initializeCampBackgrounds } from './background-generation.ts';
import { initializeCampRelationships } from './relationship-generation.ts';
import { replaceRelationshipLinks } from './relationship-runtime.ts';
import { crashlandedHumanAge } from './human-age.ts';
import { initializeCampTraits } from './traits.ts';
import { adoptEnvironment } from './environment-step.ts';
import type { Cell,World } from './types.ts';
import { enableBiomeWildlife,enableWildlife } from './wildlife.ts';

/** Available contents only. Missing Crashlanded items are not replaced by
 * additional revolvers, steel, food or a wild animal claimed as a pet. */
const SUPPLIES:readonly (readonly [ItemId,number])[]=[['wood',300],['steel',450],['component',30],['survival-meal',50],['medicine',30],['revolver',1],['flak-vest',1]];
const GROUND_STACKS=SUPPLIES.reduce((sum,[item,n])=>sum+Math.ceil(n/ITEM_DEFINITIONS[item].stackLimit),0);
const point=(w:World,i:number):Cell=>({x:i%w.width,z:Math.floor(i/w.width)});

/** Cardinal connectivity proves accessibility under our stricter diagonal
 * corner rule. These buffers belong only to this new-world decision. */
function largestComponent(world:World):number[] {
  const blocked=blockedCells(world),seen=new Uint8Array(blocked.length),queue=new Int32Array(blocked.length);
  let largest:number[]=[];
  for(let start=0;start<blocked.length;start++) {
    if(blocked[start]||seen[start])continue;
    let end=1,reachesBorder=false;queue[0]=start;seen[start]=1;
    for(let cursor=0;cursor<end;cursor++) {
      const index=queue[cursor]!,x=index%world.width,z=Math.floor(index/world.width);
      if(x===0||z===0||x===world.width-1||z===world.height-1)reachesBorder=true;
      for(const next of [z>0?index-world.width:-1,x+1<world.width?index+1:-1,z+1<world.height?index+world.width:-1,x>0?index-1:-1]) {
        if(next<0||blocked[next]||seen[next])continue;
        seen[next]=1;queue[end++]=next;
      }
    }
    if(reachesBorder&&end>largest.length)largest=Array.from(queue.subarray(0,end));
  }
  return largest;
}

/** Find room in the largest border-connected component for real people and
 * every stock stack, without clearing terrain. Failure never publishes a world. */
function landingSite(world:World,stacks=GROUND_STACKS):{landing:Cell;cells:Cell[]} {
  const resources=new Set([...world.resources.map(r=>r.z*world.width+r.x),...world.piles.filter(p=>p.owner.type==='ground').map(p=>p.owner.type==='ground'?p.owner.z*world.width+p.owner.x:-1)]),cx=(world.width-1)/2,cz=(world.height-1)/2;
  const distance=(i:number)=>(i%world.width-cx)**2+(Math.floor(i/world.width)-cz)**2;
  const candidates=largestComponent(world).filter(i=>!resources.has(i)).sort((a,b)=>distance(a)-distance(b)||a-b);
  for(const index of candidates) {
    const landing=point(world,index),cells=nearbyGround(world,landing).filter(c=>!resources.has(c.z*world.width+c.x));
    if(cells.length>=3+stacks)return {landing,cells};
  }
  throw new Error('Aucun point d’arrivée accessible ne peut accueillir les survivants et leurs réserves.');
}

function survivalStart(world:World,commerce=false,party?:StartingParty):{landing:Cell;pawnIds:number[];transportedPileIds:number[]} {
  const firstPile=world.piles.length,pawnIds:number[]=[];
  const supplies:readonly (readonly [ItemId,number])[]=commerce?[...SUPPLIES,['silver',800],['bolt-action-rifle',1],['plasteel-knife',1]]:SUPPLIES;
  const stacks=supplies.reduce((n,[item,q])=>n+Math.ceil(q/ITEM_DEFINITIONS[item].stackLimit),0);
  const {landing,cells}=landingSite(world,stacks);
  for(const [index,name] of ['Ada','Noé','Mina'].entries()) {
    const cell=cells[index]!,pawn=party?materializeStartingCandidate(party.seed,party.selected[index]!,world.nextId++,cell.x,cell.z,world.schemaVersion):startingPawn(world.nextId++,name,cell.x,cell.z,index,55,world.seed,0,world.schemaVersion);
    if(commerce&&!party)pawn.age=crashlandedHumanAge(world.seed,pawn.id,pawn.age!);
    world.pawns.push(pawn);
    pawnIds.push(pawn.id);
    addMaterial(world,'apparel',1,{type:'apparel',pawnId:pawn.id},'cloth-shirt');
  }
  let cursor=3;
  for(const [item,quantity] of supplies) {
    const definition=ITEM_DEFINITIONS[item];
    for(let remaining=quantity;remaining>0;) {
      const moved=Math.min(remaining,definition.stackLimit);
      addMaterial(world,definition.kind,moved,{type:'ground',...cells[cursor++]!},item);
      remaining-=moved;
    }
  }
  world.research={project:null,points:CLOTHING_RESEARCH_COST,completedAt:0,airConditioning:{points:AIR_CONDITIONING_COST,completedAt:0}};
  return {landing,pawnIds,transportedPileIds:world.piles.slice(firstPile).filter(p=>p.item!=='wood'&&p.item!=='steel').map(p=>p.id)};
}

/** The only application factory. Loading an existing save must not call this
 * function: scenario population, supplies and technologies are creation-only. */
export function createScenarioWorld(seed:number,size:number,id:ScenarioId=DEFAULT_SCENARIO,siteOptions?:SiteOptions,startingParty?:StartingParty,startingWorld?:StartingWorld,surface?:'snow-phased-v1'):World {
  if(surface!==undefined&&surface!=='snow-phased-v1')throw new Error('Surface inconnue.');
  if(!isScenarioId(id))throw new Error('Scénario inconnu.');
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('La graine doit être un entier de 0 à 4 294 967 295.');
  if(!validMapDimension(size)||size<SCENARIOS[id].minSize)throw new Error('Taille de carte incompatible avec ce scénario.');
  if(siteOptions!==undefined&&id!=='crashlanded')throw new Error('Ce scénario ne permet pas de choisir un site.');
  if(startingParty!==undefined&&(!validStartingParty(startingParty)||id!=='crashlanded'))throw new Error('Le choix des trois colons est invalide pour ce scénario.');
  if(startingWorld!==undefined&&id!=='crashlanded')throw new Error('Ce scénario ne permet pas de choisir un monde.');
  const selectedSite=startingWorld===undefined?undefined:resolveStartingSite(startingWorld);
  if(selectedSite&&(seed!==selectedSite.seed||siteOptions?.biome!==selectedSite.site.biome||siteOptions?.hilliness!==selectedSite.site.hilliness))throw new Error('Le terrain demandé ne correspond pas au lieu sélectionné.');
  const natural=id==='survivors'||id==='crashlanded';
  const site=id==='crashlanded'?resolveSite(seed,{hilliness:'small-hills',...siteOptions,biome:siteOptions?.biome??'temperate-forest'}):undefined;
  const world=site?generateSiteWorld(seed,size,size,site):natural?generateWorld(seed,size,size,'temperate-survivors-v1'):generateWorld(seed,size,size);
  if(site)world.site=site;
  const start=natural?survivalStart(world,id==='crashlanded',startingParty):undefined;
  const landing=start?.landing??{x:Math.floor(size/2),z:Math.floor(size/2)};
  if(id==='sentry')setupEncounter(world);
  else {
    initializeCampTraits(world);
    if(id==='crashlanded'){world.gameProfile=crashlandedProfile();world.research!.stonecutting={points:STONECUTTING_RESEARCH_COST,completedAt:0};world.research!.complexFurniture={points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:0};enableCassandraRaids(world);adoptFluIncidents(world);adoptMiscIncidents(world);}
    else {enableArrivals(world);enableRaids(world);enableHeatwaves(world);}
    if(site?.revision===2)enableBiomeWildlife(world,site.biome);else if(natural)enableWildlife(world,undefined,'natural');else enableWildlife(world);
  }
  initializeCampBackgrounds(world);
  // The starting colonists of a real start join the player faction
  // (EnableAndInitialize), once their backgrounds and skills are final. The
  // teaching camp and the armed encounter keep their historical setup.
  if(natural&&initializesWorkLikeCore302(world.schemaVersion))for(const pawn of world.pawns)if(isColonist(pawn))enableAndInitializeWork(pawn);
  world.scenario={id,revision:id==='crashlanded'?(selectedSite?ARRIVING_CRASHLANDED_REVISION:SCENARIOS.crashlanded.revision):SCENARIO_REVISION,landing};
  if(selectedSite){
    world.planet=selectedSite.planet;
    if(!adoptStartingSiteClimate(world,selectedSite.climate))throw new Error('Le climat du site de départ est invalide.');
    for(const plant of world.resources)if(isPlant(plant)){
      plant.growth=plantGrowth(world,plant);plant.growthTick=world.tick;plant.plantLife=createPlantLife(world,plant);
    }
    adoptWeather(world);adoptWind(world);ensureFireState(world);
  }else if(natural)adoptEnvironment(world);
  if(id==='crashlanded'){enableVisitors(world,true);adoptColonyEconomy(world);}
  if(startingParty){
    const preview=previewStartingParty(startingParty.seed,startingParty.selected);
    const allocated=new Map(startingParty.selected.map((candidate,index)=>[candidate.serial,world.pawns[index]!.id]));
    const links=preview.relationships.links.map(link=>{
      const a=allocated.get(link.aId)!,b=allocated.get(link.bId)!;
      return {...link,aId:Math.min(a,b),bId:Math.max(a,b)};
    });
    if(links.length&&!replaceRelationshipLinks(world,links))throw new Error('Les relations initiales contredisent les colons choisis.');
  }else initializeCampRelationships(world);
  if(selectedSite&&start)prepareStartingArrival(world,start.pawnIds,start.transportedPileIds);
  if(surface==='snow-phased-v1'||site?.biome==='tundra')initializeSnowSurface(world);
  finalizeInitialWorldRegistry(world);return world;
}
