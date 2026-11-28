import { isPowerActive } from './power-rules.ts';
import { empStructureActive } from './emp-state.ts';
import { siteStones } from './geology.ts';
import { terrainSupportsAffordance256 } from './natural-terrain-runtime-256.ts';
import { hashCombineInt,murmurHashInt } from './verse-rand.ts';
import type { Cell,World } from './types.ts';

export type DeepResourceKind='steel'|'gold'|'silver'|'plasteel'|'uranium'|'jade';
export interface DeepResourceCell {index:number;item:DeepResourceKind;count:number}
export interface DeepResourceState {adoptedAt:number;rng:number;discoveries:number;cells:DeepResourceCell[]}
export const DEEP_RESOURCES:Readonly<Record<DeepResourceKind,{weight:number;portion:number;min:number;max:number}>>=Object.freeze({
  steel:{weight:4,portion:45,min:20,max:30},gold:{weight:.5,portion:8,min:1,max:4},
  silver:{weight:.5,portion:70,min:2,max:10},plasteel:{weight:1,portion:10,min:2,max:10},
  uranium:{weight:1,portion:15,min:4,max:10},jade:{weight:.5,portion:15,min:1,max:4},
});
// Historical saves have four kinds; the Core 1.6 item definitions expose six.
const LEGACY_DEEP_KINDS=['steel','gold','silver','plasteel'] as const;
const CORE_DEEP_KINDS=['silver','gold','steel','plasteel','uranium','jade'] as const;
export function deepResourceKindAvailable(item:unknown,version:number):item is DeepResourceKind {
  return typeof item==='string'&&Object.hasOwn(DEEP_RESOURCES,item)&&(version>=382||item!=='uranium'&&item!=='jade');
}
export function deepSeed(seed:number,salt:number):number {
  let n=(seed^salt)>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);
  return (n^(n>>>16))>>>0||1;
}
export function deepRandom(state:{rng:number}):number {
  let n=state.rng;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0||1;return state.rng/0x100000000;
}
export function adoptDeepResources(world:World):void {
  if(world.schemaVersion>=215&&!world.deepResources)world.deepResources={adoptedAt:world.tick,rng:deepSeed(world.seed,0x280d33f),discoveries:0,cells:[]};
}
export function deepResourceAt(world:Pick<World,'width'|'height'|'deepResources'>,cell:Cell):DeepResourceCell|undefined {
  if(cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height)return;
  const index=cell.z*world.width+cell.x,cells=world.deepResources?.cells;if(!cells)return;
  let low=0,high=cells.length-1;while(low<=high){const mid=(low+high)>>>1,c=cells[mid]!;
    if(c.index===index)return c;if(c.index<index)low=mid+1;else high=mid-1;}
}
/** Equal-distance offsets use a stable local x,z order, rather than relying on
 * the unspecified tie order of Core's List.Sort. The first21 have distance²≤5. */
export const DEEP_RADIAL:readonly Cell[]=Object.freeze(Array.from({length:121},(_,i)=>({x:i%11-5,z:Math.floor(i/11)-5}))
  .sort((a,b)=>a.x*a.x+a.z*a.z-b.x*b.x-b.z*b.z||a.x-b.x||a.z-b.z));
/** First 60 cells of Core's 25,600-entry GenRadial sort, using the game's
 * Mono introsort and reflected north (+Core Z = -ElseWhere Z). Equal-key
 * ordering depends on the full input; a stable 121-cell sort is not the
 * native sequence. The finite prefix avoids that entire sort at startup. */
export const CORE_DEEP_RADIAL_382:readonly Cell[]=Object.freeze(([
  [0,0],[1,0],[0,-1],[0,1],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1],[2,0],[-2,0],[0,-2],[0,2],[1,-2],[-1,-2],[1,2],[-1,2],[-2,-1],[2,1],[-2,1],[2,-1],
  [-2,-2],[2,2],[-2,2],[2,-2],[0,-3],[0,3],[3,0],[-3,0],[-1,-3],[-1,3],[3,1],[3,-1],[1,-3],[-3,1],[-3,-1],[1,3],[3,2],[-3,2],[3,-2],[-3,-2],[2,3],[-2,3],[-2,-3],[2,-3],
  [0,4],[-4,0],[4,0],[0,-4],[4,-1],[4,1],[-1,-4],[-4,1],[-4,-1],[1,-4],[-1,4],[1,4],[3,3],[-3,3],[-3,-3],
] as const).map(([x,z])=>Object.freeze({x,z})));
const LEGACY_DRILL_RADIAL=DEEP_RADIAL.slice(0,21),NATIVE_DRILL_RADIAL=CORE_DEEP_RADIAL_382.slice(0,21);
export function nextDeepResource(world:World,drill:Cell):({cell:Cell}&DeepResourceCell)|undefined {
  for(const offset of world.schemaVersion>=382?NATIVE_DRILL_RADIAL:LEGACY_DRILL_RADIAL){
    const cell={x:drill.x+offset.x,z:drill.z+offset.z},resource=deepResourceAt(world,cell);
    if(resource)return {...resource,cell};
  }
}
export function deepBedrock(world:Pick<World,'schemaVersion'|'site'>):boolean {
  return world.schemaVersion<382||world.site?.revision!==3||world.site.biome!=='sea-ice';
}
export function deepRockItem(world:World,cell:Cell):`${import('./geology.ts').StoneKind}-chunk`|undefined {
  if(!deepBedrock(world))return undefined;
  const tile=world.tiles[cell.z*world.width+cell.x],stones=world.site?.stones??siteStones(world.seed);
  if(world.schemaVersion>=382&&world.site?.revision===3){
    const base=tile?.mineable?.terrain??tile?.collapsedRock?.terrain??tile?.terrain;
    if(base==='rough-stone'&&tile?.stone)return `${tile.stone}-chunk`;
    // DeepDrillUtility seeds a private Verse.Rand with IntVec3.GetHashCode,
    // then takes one integer from the actual site rock list. Reflect Z back
    // to Core coordinates before hashing; do not mutate either world stream.
    const seed=hashCombineInt(hashCombineInt(hashCombineInt(0,cell.x),0),world.height-1-cell.z);
    return `${stones[Math.abs(murmurHashInt(seed,0)%stones.length)]!}-chunk`;
  }
  const stone=tile?.stone??stones[deepSeed(world.seed,cell.z*world.width+cell.x)%stones.length]!;
  return `${stone}-chunk`;
}
export function deepScannerOverlayPowered(world:World):boolean {
  return world.schemaVersion>=215&&world.structures.some(s=>s.kind==='ground-scanner'&&isPowerActive(s)&&!empStructureActive(s,world.tick*10));
}
export function addDeepDeposit(world:World,item:DeepResourceKind,cells:readonly Cell[],count=300):number {
  if(world.schemaVersion<215||!world.deepResources||!deepResourceKindAvailable(item,world.schemaVersion)||!Number.isInteger(count)||count<1||count>300)return 0;
  const occupied=new Set(world.deepResources.cells.map(c=>c.index)),added:DeepResourceCell[]=[];
  for(const c of cells){const index=c.z*world.width+c.x;
    if(!Number.isInteger(c.x)||!Number.isInteger(c.z)||c.x<0||c.z<0||c.x>=world.width||c.z>=world.height||occupied.has(index))continue;
    occupied.add(index);added.push({index,item,count});
  }
  if(added.length)world.deepResources.cells=[...world.deepResources.cells,...added].sort((a,b)=>a.index-b.index);
  return added.length;
}
function canScatter(world:World,c:Cell):boolean {
  if(c.x<5||c.z<5||c.x>=world.width-5||c.z>=world.height-5)return false;
  const tile=world.tiles[c.z*world.width+c.x];if(!tile)return false;
  if(world.schemaVersion<382)return tile.terrain!=='water'&&!deepResourceAt(world,c);
  // Core checks the impassable base water and the drill's Light affordance,
  // not the accessibility of the cell to a worker. A mineable wall is not the
  // underlying terrain; a bridge may support the drill over shallow water.
  const base=tile.mineable?.terrain??tile.collapsedRock?.terrain??tile.terrain;
  if(base==='water'||base==='water-deep'||base==='ocean-deep')return false;
  return terrainSupportsAffordance256(base===tile.terrain?tile:{...tile,terrain:base},'Light',world)&&!deepResourceAt(world,c);
}
/** Discovery uses the world's prospective private stream. Existing ore is never
 * overwritten; the clipped irregular lump may contain fewer than n cells. */
export function discoverDeepDeposit(world:World):boolean {
  const state=world.deepResources;if(!state||!Number.isSafeInteger(state.discoveries+1)||!deepBedrock(world))return false;
  const preview={rng:state.rng};let center:Cell|undefined;
  if(world.schemaVersion>=382){
    // CellFinderLoose tries at most 1,000 random interior cells, normally the
    // first. This avoids the previous whole-map traversal/allocation on every
    // discovery. On failure retain the atomic local transaction (no invalid
    // Core sentinel coordinate, nor synthetic reserve or committed RNG).
    if(world.width<20||world.height<20)return false;
    const coordinate=(size:number)=>size===20?10:10+Math.floor(deepRandom(preview)*(size-20));
    for(let i=0;i<1000;i++){
      const c={x:coordinate(world.width),z:world.height-1-coordinate(world.height)};
      if(canScatter(world,c)){center=c;break;}
    }
  }else{
    const centers:Cell[]=[];
    for(let z=10;z<world.height-10;z++)for(let x=10;x<world.width-10;x++)if(canScatter(world,{x,z}))centers.push({x,z});
    if(centers.length)center=centers[Math.floor(deepRandom(preview)*centers.length)]!;
  }
  if(!center)return false;
  const kinds=world.schemaVersion>=382?CORE_DEEP_KINDS:LEGACY_DEEP_KINDS;
  let choice=deepRandom(preview)*(world.schemaVersion>=382?7.5:6),item:DeepResourceKind=kinds[kinds.length-1]!;
  for(const kind of kinds){choice-=DEEP_RESOURCES[kind].weight;if(choice<0){item=kind;break;}}
  const def=DEEP_RESOURCES[item],n=def.min+Math.floor(deepRandom(preview)*(def.max-def.min+1));
  const lump=new Map<number,Cell>();
  const radial=world.schemaVersion>=382?CORE_DEEP_RADIAL_382:DEEP_RADIAL;
  for(let i=0;i<2*n;i++){const d=radial[i]!,c={x:center.x+d.x,z:center.z+d.z};if(c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height)lump.set(c.z*world.width+c.x,c);}
  while(lump.size>n){let minimum=5,edge:number[]=[];
    for(const [i,c] of lump){let neighbors=0;for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]])if(lump.has((c.z+dz!)*world.width+c.x+dx!))neighbors++;
      if(neighbors<minimum){minimum=neighbors;edge=[i];}else if(neighbors===minimum)edge.push(i);}
    lump.delete(edge[Math.floor(deepRandom(preview)*edge.length)]!);
  }
  const cells=[...lump.values()].filter(c=>canScatter(world,c));if(!cells.length)return false;
  addDeepDeposit(world,item,cells);state.rng=preview.rng;state.discoveries++;return true;
}
