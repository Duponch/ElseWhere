import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isColonist} from './affiliation.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {planetGeography256} from './planet-geography-256.ts';
import {geographicAverageTileSize256} from './planet-route-256.ts';
import {worldSurfaceApproxDistance} from './world-surface-distances.ts';
import {canPlaceWorldSettlement,type SettlementAdmission} from './world-settlement-placement.ts';
import {worldBiomeCanSettle} from './world-biome-properties.ts';
import type {CampaignState,LocalMapState} from './world-map-state.ts';
import type {Pawn,World} from './types.ts';
import type {WorldSurfaceTile} from './world-surface-geography.ts';

interface ActualHome298 {mapId:number;tile:number;body:World|LocalMapState;pawns:Pawn[]}
export type PaidAiSiteTile298=
 |{ok:false;reason:string}
 |{ok:true;tile:number;originMapId:number;originTile:number;mode:'geodesic'|'near-passable'|'near-any';current():boolean};
const no=(reason:string):Extract<PaidAiSiteTile298,{ok:false}>=>({ok:false,reason});
const passable=(tile:WorldSurfaceTile)=>worldBiomeCanSettle(tile.biome)&&tile.hilliness!=='impassable';
const free=(p:Pawn)=>isColonist(p)&&!p.prisoner&&p.state!=='dead'&&!p.health?.death;
/** Find.Maps order is represented by the actual retained map registry order.
 * A downed/free colonist still counts; contact skill/needs are irrelevant. */
function eligibleHomes(root:CampaignState):ActualHome298[]{
 const maps=root.worldMaps,homes:ActualHome298[]=[];
 if(!maps){
  if(root.planet?.revision===3&&'pawns'in root&&root.pawns.some(free))homes.push({mapId:0,tile:root.planet.homeTile,body:root,pawns:root.pawns});
  return homes;
 }
 for(const site of maps.sites){
  if(site.kind!=='settlement'||site.tile===null)continue;
  const body=site.id===maps.rootMapId?root:site.map;
  if(body&&'pawns'in body&&body.pawns.some(free))homes.push({mapId:site.id,tile:site.tile,body,pawns:body.pawns});
 }
 return homes;
}
/** Paid-only query, once per actual Worker gesture. It does not mutate Root,
 * create geography, choose a payer, alter a natural calendar, or own any Thing.
 * The caller supplies its private draft RNG; refusal commits no draw to Root. */
export function preparePaidAiSiteTile298(root:CampaignState,paidCore:number,draw:()=>number):PaidAiSiteTile298{
 if(!isSchema298OrLater(Number(root.schemaVersion))||root.planet?.revision!==3||!root.worldFactions||!root.worldSites263||effectiveCore297(root)!==paidCore)return no('Actual298 paid Site geography and physical frontier required');
 const planet=root.planet,maps=root.worldMaps,factions=root.worldFactions,sites=root.worldSites263,homes=eligibleHomes(root);
 if(!homes.length)return no('No actual loaded player home has a free colonist');
 const roll=draw();if(!Number.isFinite(roll)||roll<0||roll>=1)return no('Invalid private Site origin draw');
 const home=homes[Math.floor(roll*homes.length)]!;
 let owner:ReturnType<typeof planetGeography256>,average:number;
 try{owner=planetGeography256(planet);average=geographicAverageTileSize256(planet);}catch{return no('Actual geographic navigation must already be prepared at its cold boundary');}
 const tiles=owner.surface.tiles,count=tiles.length;
 if(!Number.isSafeInteger(home.tile)||home.tile<0||home.tile>=count||!passable(tiles[home.tile]!))return no('Actual player home is not on its passable geographic surface');
 const occupied=new Set<number>(),settlements=new Set<number>(),peaceTalks=new Set<number>();
 const add=(set:Set<number>,tile:number|null|undefined)=>{if(typeof tile==='number')set.add(tile);};
 for(const row of maps?.sites??[]){add(occupied,row.tile);if(row.kind==='settlement')add(settlements,row.tile);}
 if(!maps){occupied.add(planet.homeTile);settlements.add(planet.homeTile);}
 for(const row of factions.settlements){settlements.add(row.tile);occupied.add(row.tile);}
 for(const row of sites.entries)if(!('closed'in row)||!row.closed){occupied.add(row.tile);if(row.kind==='peace-talks')peaceTalks.add(row.tile);}
 for(const row of maps?.retired??[])if(row.markerUntilCore!==undefined&&row.markerUntilCore>paidCore)add(occupied,row.tile);
 const admission:SettlementAdmission={settlementTiles:settlements,mapCreationBlockedTiles:occupied,peaceTalkTiles:peaceTalks};
 // Current local camps are map parents; this paid query conservatively never
 // reuses an occupied camp tile. No native camp-reuse equivalence is claimed.
 const valid=(id:number)=>!occupied.has(id)&&canPlaceWorldSettlement(tiles,id,admission);
 const region=new Uint8Array(count),queue:number[]=[home.tile];region[home.tile]=1;
 for(let head=0;head<queue.length;head++)for(const next of tiles[queue[head]!]!.neighbours)if(!region[next]&&passable(tiles[next]!)){region[next]=1;queue.push(next);}
 const candidates:number[]=[];
 for(let id=0;id<count;id++){
  if(!region[id]||!valid(id))continue;
  const distance=worldSurfaceApproxDistance(tiles[home.tile]!.center,tiles[id]!.center,average);
  if(distance>=7&&distance<=27)candidates.push(id);
 }
 const chooseUniform=(ids:readonly number[])=>{const value=draw();return Number.isFinite(value)&&value>=0&&value<1?ids[Math.floor(value*ids.length)]:undefined;};
 const f=Math.fround,distances=new Int16Array(count);
 function near(traverseImpassable:boolean):number|undefined{
  distances.fill(-1);queue.length=0;queue.push(home.tile);distances[home.tile]=0;
  const rows:{id:number;weight:number}[]=[];let total=0;
  for(let head=0;head<queue.length;head++){
   const id=queue[head]!,distance=distances[id]!;
   if(distance>=7&&valid(id)){const weight=f(1-f(f(distance-7)/f(20+.01)));if(weight>0){rows.push({id,weight});total=f(total+weight);}}
   if(distance===27)continue;
   for(const next of tiles[id]!.neighbours)if(distances[next]===-1&&(traverseImpassable||passable(tiles[next]!))){distances[next]=distance+1;queue.push(next);}
  }
  if(!rows.length||!(total>0))return;
  const value=draw();if(!Number.isFinite(value)||value<0||value>=1)return;
  const threshold=f(f(value)*total);let cumulative=0;
  for(const row of rows){cumulative=f(cumulative+row.weight);if(cumulative>=threshold)return row.id;}
  return rows.at(-1)!.id;
 }
 let tile:number|undefined,mode:Extract<PaidAiSiteTile298,{ok:true}>['mode']='geodesic';
 if(candidates.length)tile=chooseUniform(candidates);
 else{mode='near-passable';tile=near(false);if(tile===undefined){mode='near-any';tile=near(true);}}
 if(tile===undefined)return no('No actual unoccupied settlement-valid Site tile was found');
 const chosenTile=tile;
 const current=()=>{try{
  if(!isSchema298OrLater(Number(root.schemaVersion))||effectiveCore297(root)!==paidCore||root.planet!==planet||root.worldMaps!==maps||root.worldFactions!==factions||root.worldSites263!==sites||planetGeography256(planet)!==owner)return false;
  const live=eligibleHomes(root);
  return live.length===homes.length&&live.every((row,i)=>{const prior=homes[i]!;return row.mapId===prior.mapId&&row.tile===prior.tile&&row.body===prior.body&&row.pawns===prior.pawns;});
 }catch{return false;}};
 return {ok:true,tile:chosenTile,originMapId:home.mapId,originTile:home.tile,mode,current};
}