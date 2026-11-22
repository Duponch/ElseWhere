/** World generation steps 300 and 400 as RimWorld 1.6 runs them
 * (`WorldGenStep_AncientSites`, `WorldGenStep_AncientRoads`), rewritten from
 * the decompiled algorithms with the game's random generator, precision,
 * sort and path search, so that a planet generated with the game's terrain
 * gets the game's ancient roads.
 *
 * Step 300, seed part 976 238 715: `RoundRandom(tiles / 100 000 × Range(10, 20))`
 * sites, each `TileFinder.RandomSettlementTileFor(layer, no faction)` (the
 * sites are not world objects: two may share a tile or be neighbours).
 *
 * Step 400 (seed part 773 428 712, no random draw): path costs at tick 0;
 * from every ordered pair of sites (i, j), a chain starts at site i heading
 * towards site j and repeatedly keeps the sites still within 15° of the
 * current heading, moves to the nearest one and takes its heading; the chains
 * are sorted longest first with the game's unstable sort; each chain of at
 * least 4 sites that shares no site with a chain already drawn is drawn, each
 * of its segments along the world path search cut at 1.5 × the segment's
 * distance × 12 000 and dropped when longer than 1.5 × that distance in tiles;
 * a segment's links become ancient highways where a road already exists,
 * ancient roads elsewhere.
 *
 * Pure apart from the `roads` workspace the caller hands over. */
import {VerseRand,hashCombineInt} from './verse-rand.ts';
import {monoIntrospectiveSort} from './mono-sort.ts';
import {pickWorldSettlementTile,type SettlementRandom,type SettlementTile} from './world-settlement-placement.ts';
import {createCoreWorldPathing} from './world-core-pathing.ts';
import {coreHeadingFromTo} from './world-core-geometry.ts';
import {overlayWorldRoad,type WorldRoadLink} from './world-roads.ts';
import {WORLD_SURFACE_RADIUS} from './world-surface-mesh.ts';
import type {WorldSurfaceTile} from './world-surface-geography.ts';
const f=Math.fround;
export const ANCIENT_SITES_SEED_PART=976238715;
const MAXIMUM_SITE_CURVE=15,MAXIMUM_SEGMENT_CURVINESS=1.5;
export interface CoreAncientProgress {phase:'ancient-sites'|'ancient-roads';completed:number;total:number}
/** `Verse.Rand` seen through the settlement tile picker's interface. */
export function settlementRandomOf(random:VerseRand):SettlementRandom {
 return {integer:(min,max)=>random.range(min,max),float:(min,max)=>random.rangeFloat(min,max),value:()=>random.value};
}
/** `GenMath.RoundRandom(value)`: the integer part, plus one with the
 * fractional part's chance. */
export function verseRoundRandom(value:number,random:VerseRand):number {
 value=f(value);const whole=Math.trunc(value);return whole+(random.value<value%1?1:0);
}
/** Step 300. The tiles chosen, in order; a failed search keeps tile 0, as the
 * game does (it logs an error). */
export function* generateCoreAncientSites(tiles:readonly SettlementTile[],rootSeed:number):Generator<CoreAncientProgress,number[],void> {
 const random=new VerseRand(hashCombineInt(rootSeed,ANCIENT_SITES_SEED_PART)),picker=settlementRandomOf(random);
 // The argument is one expression (tiles / 100 000 × range), rounded once.
 const count=verseRoundRandom(f(f(tiles.length)/100000*random.rangeFloat(10,20)),random),sites:number[]=[];
 for(let i=0;i<count;i++){sites.push(pickWorldSettlementTile(tiles,picker,{settlementTiles:new Set()}).tile);yield {phase:'ancient-sites',completed:i+1,total:count};}
 return sites;
}
/** `GenerateProspectiveRoads`: one chain per ordered pair of sites. */
export function coreAncientChains(tiles:readonly Pick<WorldSurfaceTile,'center'>[],sites:readonly number[],distance:(a:number,b:number)=>number):number[][] {
 const headings=new Map<number,number>(),count=tiles.length;
 const heading=(from:number,to:number)=>{
  if(from===to)return 0;
  const key=from*count+to;let value=headings.get(key);
  if(value===undefined){value=coreHeadingFromTo(tiles[from]!.center,tiles[to]!.center,WORLD_SURFACE_RADIUS);headings.set(key,value);}
  return value;
 };
 const chains:number[][]=[];
 for(let i=0;i<sites.length;i++)for(let j=0;j<sites.length;j++){
  const chain=[sites[i]!];let remaining:readonly number[]=sites,current=sites[i]!,bearing=heading(sites[i]!,sites[j]!);
  for(;;){
   const from=current;
   remaining=remaining.filter(id=>id!==from&&Math.abs(f(heading(from,id)-bearing))<MAXIMUM_SITE_CURVE);
   if(!remaining.length)break;
   // `MinBy`: the first smallest distance.
   let best=remaining[0]!,bestDistance=distance(from,best);
   for(let k=1;k<remaining.length;k++){const d=distance(from,remaining[k]!);if(d<bestDistance){best=remaining[k]!;bestDistance=d;}}
   bearing=heading(from,best);current=best;chain.push(current);
  }
  chains.push(chain);
 }
 return chains;
}
/** Step 400 on `roads` (links added in place). */
export function* generateCoreAncientRoads(tiles:readonly WorldSurfaceTile[],difficulty:Float32Array,sites:readonly number[],roads:WorldRoadLink[][]):Generator<CoreAncientProgress,void,void> {
 const pathing=createCoreWorldPathing(tiles,difficulty,roads),chains=coreAncientChains(tiles,sites,pathing.distance);
 monoIntrospectiveSort(chains,(a,b)=>-(a.length<b.length?-1:a.length>b.length?1:0));
 const used=new Set<number>();
 for(let i=0;i<chains.length;i++){
  const chain=chains[i]!;
  if(chain.some(id=>used.has(id)))continue;
  if(chain.length<4)break;
  for(const id of chain)used.add(id);
  for(let j=0;j<chain.length-1;j++){
   const from=chain[j]!,to=chain[j+1]!,limit=f(pathing.distance(from,to)*MAXIMUM_SEGMENT_CURVINESS),cutoff=f(limit*12000);
   const path=pathing.findPath(from,to,cost=>cost>cutoff);
   // Compared in double: the distance times 1.5 is not stored.
   if(!path||path.nodesReversed.length>pathing.distance(from,to)*MAXIMUM_SEGMENT_CURVINESS)continue;
   const nodes=path.nodesReversed;
   for(let k=0;k<nodes.length-1;k++){const a=nodes[k]!,b=nodes[k+1]!;overlayWorldRoad(tiles,roads,a,b,roads[a]!.some(link=>link.neighbour===b)?'ancient-asphalt-highway':'ancient-asphalt-road');}
  }
  yield {phase:'ancient-roads',completed:i+1,total:chains.length};
 }
}
