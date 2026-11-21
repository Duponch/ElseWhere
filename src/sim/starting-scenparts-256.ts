import {isSchema256Or257} from './schema-compatibility-257.ts';
/** Creation-only extraction of the DELIVERED partial Crashlanded profile.
 * Operates on the actual unpublished geographic World and actual850 start.
 * No terrain generator, largest-component relocation or migration is called. */
import {requireOriginalStartingRoster256,consumeOriginalStartingRoster256,type StartingOriginalRoster256} from './starting-original-roster-256.ts';
import {materializeStartingCandidate,previewStartingParty,validStartingParty,type StartingParty} from './starting-candidates.ts';
import {prepareStartingArrival} from './starting-arrival.ts';
import {ARRIVING_CRASHLANDED_REVISION} from './scenario-definitions.ts';
import {captureGeographicGenerationReachability256} from './geographic-generation-reachability-256.ts';
import {validGeographicSiteBinding256} from './site-geographic-256.ts';
import {nearbyGround,groundCapacity,createGroundCapacityReader} from './ground-placement.ts';
import {groundOccupancyAllows} from './occupancy.ts';
import {canStandAt} from './furniture-travel.ts';
import {ITEM_DEFINITIONS,type ItemId} from './items.ts';
import {addMaterial} from './materials.ts';
import {replaceRelationshipLinks} from './relationship-runtime.ts';
import {crashlandedProfile,tutorialMode347} from './game-profile.ts';
import {validGameProfile} from './game-profile-save.ts';
import {enableCassandraRaids} from './cassandra-raids.ts';
import {adoptFluIncidents} from './flu-incidents.ts';
import {adoptMiscIncidents} from './cassandra-misc.ts';
import {enableVisitors} from './visitors.ts';
import {adoptColonyEconomy} from './colony-economy.ts';
import {AIR_CONDITIONING_COST,CLOTHING_RESEARCH_COST,COMPLEX_FURNITURE_RESEARCH_COST,STONECUTTING_RESEARCH_COST} from './research.ts';
import {isColonist} from './affiliation.ts';
import type {WorldGenerationRandom} from './world-generation-random.ts';
import {grantClassicStartResearch343} from './crashlanded-start-343.ts';
import type {Cell,World} from './types.ts';
export const STARTING_SCENPARTS_SEED_PART_256=1561683158;
/** Exact delivered order, intentionally distinct from a complete Core scenario. */
export const STARTING_SCENPARTS_SUPPLIES_256:readonly (readonly [ItemId,number])[]=Object.freeze([
 ['wood',300],['steel',450],['component',30],['survival-meal',50],['medicine',30],['revolver',1],['flak-vest',1],['silver',800],['bolt-action-rifle',1],['plasteel-knife',1],
]);
export interface StartingScenPartsReceipt256 {
 readonly profile:'delivered-crashlanded-geographic-v1';readonly start850:number;
 readonly pawnIds:readonly number[];readonly groundPileIds:readonly number[];
 readonly transportedPileIds:readonly number[];readonly podIds:readonly number[];
 readonly random:Readonly<{seed:number;counter:number}>;
}
function requireFresh(world:World,start850:number,party:StartingParty):void {
 const player=world.worldFactions?.factions.find(f=>f.id===world.worldFactions!.playerFactionId);
 if(!isSchema256Or257(world.schemaVersion)||world.tick!==0||world.site?.revision!==3||world.planet?.revision!==3||world.climate?.revision!==4||world.site.tileId!==world.planet.homeTile||!validGeographicSiteBinding256(world)||player?.def!=='PlayerColony'||!validStartingParty(party))throw Error('Starting scenario requires the actual fresh geographic colony, chosen party and player faction');
 if(!Number.isSafeInteger(world.nextId)||world.nextId<1)throw Error('Invalid actual starting identity frontier');
 if(!Number.isSafeInteger(start850)||start850<0||start850>=world.width*world.height||world.tiles.length!==world.width*world.height)throw Error('Missing actual850 player start');
 // An empty tick0 save is not an implicit admission to acquire this profile.
 // ROOT calls this only while constructing its unpublished new World.
 for(const key of ['scenario','startingArrival','gameProfile','research','raids','visitors','fluIncidents','miscIncidents','economy']as const)if(Object.hasOwn(world,key))throw Error('Starting profile already exists; no replacement or enrichment');
 if(world.worldMaps||world.worldGroups||world.pawns.some(isColonist))throw Error('Cannot apply starting possessions to an existing colony');
}
/** Preserve the existing conservative arrival placement around the actual
 * chosen start. The Core DropCellFinder/roof punch algorithm is not claimed.
 * Every accepted cell is still the real map's Standable, open-ground cell. */
function arrivalCells(world:World,start850:number):{landing:Cell;people:Cell[];stacks:{item:ItemId;quantity:number;cell:Cell}[]} {
 const landing={x:start850%world.width,z:Math.floor(start850/world.width)},capture=captureGeographicGenerationReachability256(world);
 if(!capture.physical.standable(start850)||!canStandAt(world,landing))throw Error('The actual850 start is no longer Standable; it cannot be relocated');
 const occupied=new Set<number>([
  ...world.resources.map(r=>r.z*world.width+r.x),
  ...world.piles.flatMap(p=>p.owner.type==='ground'?[p.owner.z*world.width+p.owner.x]:[]),
  ...world.packed.flatMap(p=>p.owner.type==='ground'?[p.owner.z*world.width+p.owner.x]:[]),
  ...world.pawns.map(p=>p.z*world.width+p.x),
  ...world.wildlife?.animals.filter(a=>a.state!=='dead').map(a=>a.z*world.width+a.x)??[],
 ]);
 const cells=nearbyGround(world,landing,12).filter(c=>{
  const i=c.z*world.width+c.x;return !occupied.has(i)&&capture.physical.standable(i)&&!capture.physical.roofed(i)&&canStandAt(world,c)&&capture.canReach(start850,i,'closed')&&groundOccupancyAllows(world,c);
 });
 if(cells.length<3)throw Error('The actual850 start has no three available capsule cells');
 const people=cells.slice(0,3),reserved=new Set(people.map(c=>c.z*world.width+c.x)),reader=createGroundCapacityReader(world),stacks:{item:ItemId;quantity:number;cell:Cell}[]=[];
 for(const [item,count]of STARTING_SCENPARTS_SUPPLIES_256){let remaining=count;while(remaining){
  const quantity=Math.min(remaining,ITEM_DEFINITIONS[item].stackLimit),cell=cells.find(c=>!reserved.has(c.z*world.width+c.x)&&groundCapacity(world,c,item,undefined,undefined,reader)>=quantity);
  if(!cell)throw Error('The actual850 neighborhood cannot hold the delivered starting profile without clearing or merging');
  reserved.add(cell.z*world.width+cell.x);stacks.push({item,quantity,cell});remaining-=quantity;
 }}
 if(world.piles.length+stacks.length+3>32768||!Number.isSafeInteger(world.nextId+stacks.length+9))throw Error('Starting identity or pile capacity exhausted');
 return {landing,people,stacks};
}
/** ROOT owns the creation transaction: discard the unpublished candidate on
 * any unexpected downstream failure, and validate the whole World before ACK.
 * The supplied875 stream is never replaced or reseeded. This extraction keeps
 * the existing deterministic placement/birth channels, hence consumes no875
 * draws itself; it does not claim Core875 counter-equivalence. */
export function applyStartingScenParts256(world:World,input:{start850:number;startingParty:StartingParty},random:WorldGenerationRandom):StartingScenPartsReceipt256 {
 requireFresh(world,input.start850,input.startingParty);const plan=arrivalCells(world,input.start850),party=input.startingParty;
 // Complete placement and identity bounds are checked before the first write.
 const pawnIds:number[]=[],firstPile=world.piles.length;
 for(let index=0;index<3;index++){
  const cell=plan.people[index]!,pawn=materializeStartingCandidate(party.seed,party.selected[index]!,world.nextId++,cell.x,cell.z,world.schemaVersion);
  world.pawns.push(pawn);pawnIds.push(pawn.id);addMaterial(world,'apparel',1,{type:'apparel',pawnId:pawn.id},'cloth-shirt');
 }
 for(const stack of plan.stacks)addMaterial(world,ITEM_DEFINITIONS[stack.item].kind,stack.quantity,{type:'ground',...stack.cell},stack.item);
 const created=world.piles.slice(firstPile),transported=created.filter(p=>p.item!=='wood'&&p.item!=='steel').map(p=>p.id),ground=created.filter(p=>p.item==='wood'||p.item==='steel').map(p=>p.id);
 world.research={project:null,points:CLOTHING_RESEARCH_COST,completedAt:0,airConditioning:{points:AIR_CONDITIONING_COST,completedAt:0},stonecutting:{points:STONECUTTING_RESEARCH_COST,completedAt:0},complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:0}};
 world.gameProfile=crashlandedProfile();world.scenario={id:'crashlanded',revision:ARRIVING_CRASHLANDED_REVISION,landing:plan.landing};
 enableCassandraRaids(world);adoptFluIncidents(world);adoptMiscIncidents(world);enableVisitors(world,true);
 const preview=previewStartingParty(party.seed,party.selected,world.schemaVersion),allocated=new Map(party.selected.map((candidate,index)=>[candidate.serial,pawnIds[index]!]));
 const links=preview.relationships.links.map(link=>{const a=allocated.get(link.aId)!,b=allocated.get(link.bId)!;return {...link,aId:Math.min(a,b),bId:Math.max(a,b)};});
 if(!replaceRelationshipLinks(world,[...world.relationships?.links??[],...links]))throw Error('Chosen starting relationships conflict with the actual existing people');
 // Do not initializeCamp* on unrelated NPCs; chosen candidates already own
 // their advertised traits, age, background, appearance and bounded skills.
 adoptColonyEconomy(world);prepareStartingArrival(world,pawnIds,transported);
 const arrival=world.startingArrival;if(!arrival||arrival.phase==='opened')throw Error('Actual starting capsule owner was not prepared');
 return Object.freeze({profile:'delivered-crashlanded-geographic-v1',start850:input.start850,pawnIds:Object.freeze(pawnIds),groundPileIds:Object.freeze(ground),transportedPileIds:Object.freeze(transported),podIds:Object.freeze(arrival.pods.map(p=>p.id)),random:random.state});
}

/** New geographic UI path only. All eight real originals already exist before
 * terrain. This875 transfers the same chosen three; no preview/materialize,
 * faction replacement, relation regeneration or allocator reset occurs here.
 * The constructor delivers no held gear: keep the existing three875 shirts,
 * without inventing any possessions for the five left-behind originals. */
export function applyStartingOriginalScenParts256(world:World,input:{start850:number;roster:StartingOriginalRoster256},random:WorldGenerationRandom):StartingScenPartsReceipt256 {
 const roster=input.roster;
 requireOriginalStartingRoster256(world,roster);
 const selected=roster.selected.map(e=>e.descriptor) as StartingParty['selected'];
 requireFresh(world,input.start850,{version:1,seed:roster.seed,selected});
 const plan=arrivalCells(world,input.start850),firstPile=world.piles.length,pawnIds:number[]=[];
 for(let i=0;i<roster.selected.length;i++){
  const pawn=roster.selected[i]!.pawn,cell=plan.people[i]!;
  pawn.x=cell.x;pawn.z=cell.z;world.pawns.push(pawn);pawnIds.push(pawn.id);
  addMaterial(world,'apparel',1,{type:'apparel',pawnId:pawn.id},'cloth-shirt');
 }
 for(const stack of plan.stacks)addMaterial(world,ITEM_DEFINITIONS[stack.item].kind,stack.quantity,{type:'ground',...stack.cell},stack.item);
 const created=world.piles.slice(firstPile),transported=created.filter(p=>p.item!=='wood'&&p.item!=='steel').map(p=>p.id),ground=created.filter(p=>p.item==='wood'||p.item==='steel').map(p=>p.id);
 world.research={project:null,points:CLOTHING_RESEARCH_COST,completedAt:0,airConditioning:{points:AIR_CONDITIONING_COST,completedAt:0},stonecutting:{points:STONECUTTING_RESEARCH_COST,completedAt:0},complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:0}};
 world.gameProfile=crashlandedProfile();world.scenario={id:'crashlanded',revision:ARRIVING_CRASHLANDED_REVISION,landing:plan.landing};
 enableCassandraRaids(world);adoptFluIncidents(world);adoptMiscIncidents(world);enableVisitors(world,true);adoptColonyEconomy(world);
 prepareStartingArrival(world,pawnIds,transported);consumeOriginalStartingRoster256(world,roster);
 const arrival=world.startingArrival;if(!arrival||arrival.phase==='opened')throw Error('Actual original capsule owner was not prepared');
 return Object.freeze({profile:'delivered-crashlanded-geographic-v1',start850:input.start850,pawnIds:Object.freeze(pawnIds),groundPileIds:Object.freeze(ground),transportedPileIds:Object.freeze(transported),podIds:Object.freeze(arrival.pods.map(p=>p.id)),random:random.state});
}

/** Existing delivered systems metadata, deliberately distinct from the newly
 * faithful875 possessions/arrival. Initial human birth/research/storyteller
 * tuning remains an explicit adaptation; no Core global completion is claimed. */
export function adoptDeliveredStartingSystems256(world:World,landing:Cell):void {
 if(!isSchema256Or257(world.schemaVersion)||world.tick!==0||world.site?.revision!==3||world.planet?.revision!==3||!world.startingArrival||Object.hasOwn(world,'gameProfile')&&!validGameProfile(world.gameProfile,Math.max(256,Number(world.schemaVersion)),{id:'crashlanded'})||['scenario','research','raids','visitors','fluIncidents','miscIncidents','economy'].some(k=>Object.hasOwn(world,k)))throw Error('Starting systems already owned');
 world.research={project:null,points:CLOTHING_RESEARCH_COST,completedAt:0,airConditioning:{points:AIR_CONDITIONING_COST,completedAt:0},stonecutting:{points:STONECUTTING_RESEARCH_COST,completedAt:0},complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:0}};
 grantClassicStartResearch343(world);
 world.gameProfile??=crashlandedProfile();world.scenario={id:'crashlanded',revision:ARRIVING_CRASHLANDED_REVISION,landing:{...landing}};
 // Schema 347: the Tutor has no storyteller comps. Its raid agenda is born
 // (silent until the handover, it carries the tutorial raid); the disease,
 // incident and visitor calendars are born at the handover.
 enableCassandraRaids(world);if(!tutorialMode347(world)){adoptFluIncidents(world);adoptMiscIncidents(world);enableVisitors(world,true);}adoptColonyEconomy(world);
}
