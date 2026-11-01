import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {registeredCampaign,registeredMap,registeredMapId,hasLoadedRoot} from './world-map-context.ts';
import {isColonist} from './affiliation.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isPlayerCasket271} from './cryptosleep-state-271.ts';
import {captureShipCasketHumans277,captureShipCasketAnimals277} from './ship-casket-state-277.ts';
import {pileMarketValue} from './trade-prices.ts';
import {structureRoomMarketValue} from './room-market-value.ts';
import {animalMarketValue261} from './caravan-animal-value-261.ts';
import {summaryHealthPercent,type WeightedWorldThreatInput298} from './threat-points.ts';
import type {World,Pawn,MaterialPile} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {PackedFurniture} from './furniture-rules.ts';

export interface KnownWorldThreatDiagnostics298 {
 readonly model:'known-world-partial298';
 readonly unpricedHumanIds:readonly number[];readonly unpricedAnimalIds:readonly number[];readonly unpricedHistoricalPawnIds:readonly number[];
 readonly unpricedPileIds:readonly number[];readonly unpricedPackedIds:readonly number[];
 readonly unpricedStructureIds:readonly number[];readonly unknownReleaseAnimalIds:readonly number[];
 readonly homeSamples:readonly {mapId:number;sampledAt:number;wealth:number}[];
 readonly adaptation:{mapId:number;days:number;scope:'existing-local-model-not-global-history'};
}
export type KnownWorldThreatCapture298={ok:false;reason:string}|{ok:true;
 readonly input:WeightedWorldThreatInput298;readonly diagnostics:KnownWorldThreatDiagnostics298;current():boolean};
const alive=(p:Pawn|WildAnimal)=>p.state!=='dead'&&!p.health?.death;
const free=(p:Pawn)=>alive(p)&&isColonist(p)&&!p.prisoner&&!p.visitor;
/** A finite dependency closure, never a World/tiles traversal. Descriptors and
 * original object identity are checked again before the real payment commit. */
function seal(value:unknown,active=new Set<object>()):()=>boolean {
 if(!value||typeof value!=='object')return ()=>true;if(active.has(value))return ()=>false;
 active.add(value);const proto=Object.getPrototypeOf(value),keys=Reflect.ownKeys(value),fields=keys.map(key=>{const d=Object.getOwnPropertyDescriptor(value,key)!;const data=Object.hasOwn(d,'value');return {key,d,data,child:data?seal(d.value as unknown,active):()=>false};});active.delete(value);
 return ()=>Object.getPrototypeOf(value)===proto&&Reflect.ownKeys(value).length===keys.length&&fields.every(({key,d,data,child})=>{const n=Object.getOwnPropertyDescriptor(value,key);return data&&!!n&&n.value===d.value&&n.enumerable===d.enumerable&&n.configurable===d.configurable&&n.writable===d.writable&&child();});
}
const domains=(w:Pick<World,'pawns'|'structures'|'piles'|'packed'|'wildlife'|'economy'>)=>[w.pawns,w.structures,w.piles,w.packed,w.wildlife,w.economy] as const;

/** Read only at a real paid gesture. Home wealth remains its existing501-macro
 * sample; no recount/adoption, terrain scan, RNG draw or global adapter exists.
 * Missing prices/Release evidence are explicit lower-bound diagnostics. */
export function captureKnownWorldThreat298(payer:World):KnownWorldThreatCapture298 {
 const fail=(reason:string):Extract<KnownWorldThreatCapture298,{ok:false}>=>({ok:false,reason});
 const root=registeredCampaign(payer),maps=root.worldMaps,sites=maps?.sites,rootMapId=maps?.rootMapId,groups=root.worldGroups,rows=groups?.groups;
 const core=effectiveCore297(payer),tick=root.tick,payerMapId=registeredMapId(payer);
 if(!isSchema298OrLater(Number(root.schemaVersion))||payerMapId===undefined||!payer.economy)return fail('Le modèle économique réel du payeur est indisponible.');
 const adaptation=payer.economy.adaptationDays,sources:unknown[]=[],guards:(()=>boolean)[]=[];
 const captures:{world:World;kind:string;mapId:number}[]=[];
 if(maps){
  const refs=maps.sites.slice(),layout=refs.map(s=>({ref:s,id:s.id,kind:s.kind,tile:s.tile,map:s.map}));
  guards.push(()=>root.worldMaps===maps&&maps.rootMapId===rootMapId&&maps.sites===sites&&sites!.length===refs.length&&layout.every((v,i)=>sites![i]===v.ref&&v.ref.id===v.id&&v.ref.kind===v.kind&&v.ref.tile===v.tile&&v.ref.map===v.map));
  for(const site of refs){
   const world=registeredMap(root,site.id),body=site.id===maps.rootMapId&&hasLoadedRoot(root)?root:site.map;
   if(!world||!body||!('pawns'in body))return fail('Une carte réelle n’a plus son propriétaire économique.');
   const values=domains(world),original=domains(body);sources.push(...values,...original);
   guards.push(()=>domains(world).every((v,i)=>v===values[i])&&domains(body).every((v,i)=>v===original[i]));
   captures.push({world,kind:site.kind,mapId:site.id});
  }
 }else{
  if(!hasLoadedRoot(root)||root!==payer)return fail('Le foyer mono-carte réel est indisponible.');
  const values=domains(root);sources.push(...values);guards.push(()=>!root.worldMaps&&domains(root).every((v,i)=>v===values[i]));
  captures.push({world:root,kind:'settlement',mapId:0});
 }
 const groupRefs=rows?.slice()??[];sources.push(rows);
 guards.push(()=>root.worldGroups===groups&&groups?.groups===rows&&(!rows||rows.length===groupRefs.length&&rows.every((r,i)=>r===groupRefs[i])));
 const humanIds=new Set<number>(),animalIds=new Set<number>(),pileIds=new Set<number>(),packedIds=new Set<number>();
 const unpricedHumans=new Set<number>(),unpricedAnimals=new Set<number>(),unpricedHistoricalPawns=new Set<number>(),unpricedPiles=new Set<number>(),unpricedPacked=new Set<number>(),unpricedStructures=new Set<number>(),unknownRelease=new Set<number>();
 const homeSamples:{mapId:number;sampledAt:number;wealth:number}[]=[];
 let knownWealth=0,colonistContribution=0;
 const addHuman=(p:Pawn,held=false)=>{
  if(humanIds.has(p.id)||animalIds.has(p.id)||pileIds.has(p.id)||packedIds.has(p.id))throw Error('Un humain possède deux propriétaires World.');humanIds.add(p.id);
  if(free(p))colonistContribution+=(held ? .3 : 1)*(.35+.65*(p.health?summaryHealthPercent(p.health):1));
 };
 const addAnimal=(a:WildAnimal)=>{
  if(animalIds.has(a.id)||humanIds.has(a.id)||pileIds.has(a.id)||packedIds.has(a.id))throw Error('Un animal possède deux propriétaires World.');animalIds.add(a.id);
  if(alive(a)&&a.domestic){
   // Release is not implemented by the delivered training tracker. Never infer
   // assignability from learned Haul/Obedience or invent a generic true.
   unknownRelease.add(a.id);
  }
 };
 const pileValue=(p:MaterialPile)=>{
  if(pileIds.has(p.id)||humanIds.has(p.id)||animalIds.has(p.id)||packedIds.has(p.id))throw Error('Une possession possède deux propriétaires World.');pileIds.add(p.id);
  const unit=p.kind==='chunk'?0:p.kind==='unfinished'?undefined:pileMarketValue(p);
  if(unit===undefined){unpricedPiles.add(p.id);return 0;}return unit*p.quantity;
 };
 const packedValue=(p:PackedFurniture)=>{
  const id=p.building.id;if(packedIds.has(id)||pileIds.has(id)||humanIds.has(id)||animalIds.has(id))throw Error('Un meuble minifié possède deux propriétaires World.');packedIds.add(id);
  try{return structureRoomMarketValue(p.building);}catch(error){if(!(error instanceof RangeError))throw error;unpricedPacked.add(id);return 0;}
 };
 const animalValue=(a:WildAnimal)=>{const value=animalMarketValue261(a);if(value.ok)return value.value;unpricedAnimals.add(a.id);return 0;};
 try{
  for(const {world,kind,mapId} of captures){
   const held=world.structures.filter(isPlayerCasket271).flatMap(s=>s.cryptosleep.human?[{pawn:s.cryptosleep.human,items:s.cryptosleep.items,packed:s.cryptosleep.packed}]:[]);
   held.push(...captureShipCasketHumans277(world).map(h=>({pawn:h.pawn,items:[...h.items],packed:[...h.packed]})));
   const heldAnimals=captureShipCasketAnimals277(world).map(h=>h.animal);
   for(const p of world.pawns)addHuman(p);for(const h of held)addHuman(h.pawn,true);
   const animals=[...world.wildlife?.animals??[],...heldAnimals];for(const a of animals)addAnimal(a);
   if(kind==='settlement'){
    const economy=world.economy;if(!economy)return fail('La richesse connue d’un véritable foyer est indisponible.');
    const wealth=economy.wealth;if(!Number.isFinite(wealth.knownStorytellerWealth)||wealth.knownStorytellerWealth<0)return fail('La richesse échantillonnée d’un foyer est invalide.');
    knownWealth+=wealth.knownStorytellerWealth;homeSamples.push({mapId,sampledAt:economy.sampledAt,wealth:wealth.knownStorytellerWealth});
    for(const id of wealth.unpricedPawnIds){if(animals.some(a=>a.id===id))unpricedAnimals.add(id);else if([...world.pawns,...held.map(h=>h.pawn)].some(p=>p.id===id))unpricedHumans.add(id);else unpricedHistoricalPawns.add(id);}
    for(const id of wealth.unpricedPileIds)unpricedPiles.add(id);for(const id of wealth.unpricedPackedIds)unpricedPacked.add(id);for(const id of wealth.unpricedStructureIds)unpricedStructures.add(id);
    // Register current physical possession identities without recounting or
    // repricing the retained home sample. A cached value is not another owner.
    for(const p of [...world.piles,...held.flatMap(h=>h.items)]){if(pileIds.has(p.id)||humanIds.has(p.id)||animalIds.has(p.id)||packedIds.has(p.id))throw Error('Une possession possède deux propriétaires World.');pileIds.add(p.id);}
    for(const p of [...world.packed,...held.flatMap(h=>h.packed)]){const id=p.building.id;if(packedIds.has(id)||pileIds.has(id)||humanIds.has(id)||animalIds.has(id))throw Error('Un meuble minifié possède deux propriétaires World.');packedIds.add(id);}
   }else{
    const eligible=new Set([...world.pawns,...held.map(h=>h.pawn)].filter(free).map(p=>p.id));
    for(const p of [...world.piles,...held.flatMap(h=>h.items)])if(['equipment','apparel','inventory'].includes(p.owner.type)&&'pawnId'in p.owner&&eligible.has(p.owner.pawnId))knownWealth+=pileValue(p);
    for(const p of [...world.packed,...held.flatMap(h=>h.packed)])if(p.owner.type==='inventory'&&eligible.has(p.owner.pawnId))knownWealth+=packedValue(p);
    for(const a of animals)if(alive(a)&&a.domestic)knownWealth+=animalValue(a);
   }
  }
  for(const row of groupRefs){const g=row.state;if(!('members'in g))continue;
   for(const p of g.members)addHuman(p);for(const a of g.animalOwners?.members??[])addAnimal(a);
   // This registry owns player-controlled formations. Captives' actual gear
   // counts, while their own Pawn market value does not. Human values are not
   // represented by the known-value model, including the native slave*.75.
   let wealth=0;for(const p of g.items)wealth+=pileValue(p);for(const p of g.packed??[])wealth+=packedValue(p);
   for(const p of g.members)if(alive(p)&&isColonist(p)&&!p.visitor)unpricedHumans.add(p.id);
   for(const a of g.animalOwners?.members??[])if(alive(a)&&a.domestic)wealth+=animalValue(a);
   knownWealth+=wealth*.7;
  }
 }catch(error){return fail(error instanceof Error?error.message:'Les propriétaires World ne sont pas cohérents.');}
 if(!Number.isFinite(knownWealth)||knownWealth<0)return fail('La somme de richesse World est invalide.');
 const sourceSeal=seal(sources),input:WeightedWorldThreatInput298={knownWealth,colonistContribution,animalHealthPower:0,elapsedDays:tick/6000,adaptationDays:adaptation,seedBucket:Math.floor(tick/250)};
 const diagnostics:KnownWorldThreatDiagnostics298={model:'known-world-partial298',unpricedHumanIds:[...unpricedHumans],unpricedAnimalIds:[...unpricedAnimals],unpricedHistoricalPawnIds:[...unpricedHistoricalPawns],unpricedPileIds:[...unpricedPiles],unpricedPackedIds:[...unpricedPacked],unpricedStructureIds:[...unpricedStructures],unknownReleaseAnimalIds:[...unknownRelease],homeSamples,adaptation:{mapId:payerMapId,days:adaptation,scope:'existing-local-model-not-global-history'}};
 return {ok:true,input,diagnostics,current:()=>isSchema298OrLater(Number(root.schemaVersion))&&registeredCampaign(payer)===root&&registeredMapId(payer)===payerMapId&&root.tick===tick&&effectiveCore297(payer)===core&&payer.economy?.adaptationDays===adaptation&&guards.every(g=>g())&&sourceSeal()};
}
