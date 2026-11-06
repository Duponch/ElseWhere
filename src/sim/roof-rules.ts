import {caveRadialPattern256} from './local-cave-radial-256.ts';
import { isRoomDoor } from './door-rules.ts';
import type { Job, World } from './types.ts';

/** One physical roof per cell. Absence of natural remains historical data. */
export interface NaturalRoofState256 {thin:number[];thick:number[]}
export interface RoofingState { constructed: number[]; build: number[]; remove: number[]; cursor: number; natural?:NaturalRoofState256 }
export type RoofKind='constructed'|'natural-thin'|'natural-thick';
function containsRoofCell(cells:readonly number[]|undefined,index:number):boolean {
 let low=0,high=(cells?.length??0)-1;while(low<=high){const mid=(low+high)>>>1,value=cells![mid]!;if(value===index)return true;if(value<index)low=mid+1;else high=mid-1;}return false;
}
export function roofKindAt(world:Pick<World,'roofing'>,index:number):RoofKind|undefined {
 const r=world.roofing;if(containsRoofCell(r?.constructed,index))return 'constructed';if(containsRoofCell(r?.natural?.thin,index))return 'natural-thin';if(containsRoofCell(r?.natural?.thick,index))return 'natural-thick';return undefined;
}
/** Decision/snapshot work only, never a frame scan or maintained world index. */
export function roofCoverage(world:Pick<World,'roofing'>):readonly number[] {
 const r=world.roofing;if(!r)return [];if(!r.natural)return r.constructed;
 const sources=[r.constructed,r.natural.thin,r.natural.thick],at=[0,0,0],out:number[]=[];
 for(;;){let selected=-1,value=Infinity;for(let i=0;i<3;i++){const candidate=sources[i]![at[i]!]??Infinity;if(candidate<value){selected=i;value=candidate;}}if(selected<0)return out;out.push(value);at[selected]++;}
}
/* Roof cell arrays are never mutated in place once they belong to a World
 * (every edit assigns a new sorted array), so the derived Set is cached by the
 * identity and length of the three source arrays. Consumers only read it. */
const roofSetCache=new WeakMap<object,{constructed:readonly number[];thin:readonly number[]|undefined;thick:readonly number[]|undefined;lengths:number;cells:ReadonlySet<number>}>();
const EMPTY_ROOFS:ReadonlySet<number>=new Set<number>();
export const roofCells=(world:Pick<World,'roofing'>):ReadonlySet<number>=>{
 const r=world.roofing;if(!r)return EMPTY_ROOFS;
 const thin=r.natural?.thin,thick=r.natural?.thick,lengths=r.constructed.length+(thin?.length??-1)*65536+(thick?.length??-1)*4294967296;
 const cached=roofSetCache.get(r);
 if(cached&&cached.constructed===r.constructed&&cached.thin===thin&&cached.thick===thick&&cached.lengths===lengths)return cached.cells;
 const cells=new Set(roofCoverage(world));roofSetCache.set(r,{constructed:r.constructed,thin,thick,lengths,cells});return cells;
};
export const ROOF_WORK_TICKS = 4; // ceil(65 Core ticks / 1.7 / 10), neutral construction.
export const isRoofJob = (j: Pick<Job|import('./types.ts').Structure, 'kind'>): boolean => j.kind === 'build-roof' || j.kind === 'remove-roof';
export const isRoofArea = (action: string): action is 'build-roof'|'remove-roof'|'ignore-roof' => ['build-roof', 'remove-roof', 'ignore-roof'].includes(action);
export const roofIndex = (w: Pick<World, 'width'>, c: {x:number;z:number}): number => c.z * w.width + c.x;
export function isRoofed(world:Pick<World,'roofing'>,index:number):boolean {return roofKindAt(world,index)!==undefined;}

/** One synchronous decision only; recreate after changing roofs or supports. */
export class RoofContext {
  readonly roof: Set<number>;
  readonly constructed:Set<number>;
  readonly thin:Set<number>;
  readonly thick:Set<number>;
  readonly build: Set<number>;
  readonly remove: Set<number>;
  private supportCells?:Uint8Array;
  private builtHolders?:Set<number>;
  private seen?:Uint32Array;
  private readonly queue = new Int32Array(225);
  private stamp = 0;
  private readonly width: number;
  private readonly height: number;
  private readonly world:World;
  constructor(world: World) {
    this.world=world;
    this.width = world.width; this.height = world.height;
    this.constructed=new Set(world.roofing?.constructed);this.thin=new Set(world.roofing?.natural?.thin);this.thick=new Set(world.roofing?.natural?.thick);
    this.roof = new Set(roofCoverage(world)); this.build = new Set(world.roofing?.build); this.remove = new Set(world.roofing?.remove);
  }
  /** Most roof intentions already cover finished cells. Capture supports only
   * if this synchronous decision actually asks a support question. As before,
   * callers must discard the context before any world mutation. */
  get holders():Uint8Array {
    if(this.supportCells)return this.supportCells;
    const world=this.world,cells=this.supportCells=new Uint8Array(world.tiles.length);
    for(let i=0;i<world.tiles.length;i++)if(world.tiles[i]!.terrain==='rock')cells[i]=1;
    for(const s of world.structures)if(s.kind==='wall'||s.kind==='column'||isRoomDoor(s.kind))cells[roofIndex(world,s)]=1;
    return cells;
  }
  /** Synchronous sparse support reads avoid scanning every natural wall for
   * one mining stroke. The existing dense getter remains for room-wide work. */
  holds(index:number):boolean {
    if(this.world.tiles[index]?.terrain==='rock')return true;
    this.builtHolders??=new Set(this.world.structures.filter(s=>s.kind==='wall'||s.kind==='column'||isRoomDoor(s.kind)).map(s=>roofIndex(this.world,s)));
    return this.builtHolders.has(index);
  }
  private adjacent(at:number):number[]{
    const x=at%this.width,z=Math.floor(at/this.width),out:number[]=[];
    if(z+1<this.height)out.push(at+this.width);if(x+1<this.width)out.push(at+1);if(z>0)out.push(at-this.width);if(x>0)out.push(at-1);return out;
  }
  /** Only components reached from the actual changed holder/roof. A found
   * holder terminates this search; no full mountain traversal on that path. */
  floatingNear(roots:readonly number[]):Set<number>{
    const connected=new Set<number>(),floating=new Set<number>();
    for(const root of roots)for(const start of [...this.adjacent(root),root]){
      if(!this.roof.has(start)||connected.has(start)||floating.has(start))continue;
      const queue=[start],seen=new Set(queue);let held=false;
      for(let head=0;head<queue.length;head++){
        const at=queue[head]!,adj=this.adjacent(at);
        if(connected.has(at)||this.holds(at)||adj.some(i=>this.holds(i))){held=true;break;}
        for(const next of adj)if(this.roof.has(next)&&!seen.has(next)){seen.add(next);queue.push(next);}
      }
      for(const at of queue)(held?connected:floating).add(at);
    }return floating;
  }
  unsupportedNear(root:number):number[]{
    const x=root%this.width,z=Math.floor(root/this.width),pattern=caveRadialPattern256(Math.fround(6.9)),out:number[]=[];
    for(let n=0;n<pattern.count;n++){const [dx,dz]=pattern.offsets[n]!,nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=this.width||nz>=this.height)continue;
      const at=nz*this.width+nx;if(this.roof.has(at)&&!this.supported(at))out.push(at);}
    return out;
  }
  /** Core's 6.9-radius flood through roof cells, with the root assumed roofed.
   * A nearby support behind an unroofed gap is not sufficient. */
  supported(root: number, assumeRoof = false): boolean {
    const seen=this.seen??=new Uint32Array(this.width*this.height);
    const width = this.width, height = this.height, rx = root % width, rz = Math.floor(root / width);
    const stamp = ++this.stamp; let head = 0, tail = 1;
    this.queue[0] = root; seen[root] = stamp;
    while (head < tail) {
      const at = this.queue[head++]!, x = at % width, z = Math.floor(at / width);
      if (this.holds(at)) return true;
      for (let direction = 0; direction < 4; direction++) {
        const nx = x + (direction === 0 ? -1 : direction === 1 ? 1 : 0), nz = z + (direction === 2 ? -1 : direction === 3 ? 1 : 0);
        if (nx < 0 || nz < 0 || nx >= width || nz >= height || (nx-rx)**2 + (nz-rz)**2 > 6.9**2) continue;
        const index = nz * width + nx;
        if (this.holds(index)) return true;
        if (seen[index] !== stamp && (this.roof.has(index) || assumeRoof && !this.remove.has(index))) {
          seen[index] = stamp; this.queue[tail++] = index;
        }
      }
    }
    return false;
  }
  /** Removal only discards floating components. A connected detour may leave
   * the construction radius; that does not make voluntary removal a collapse. */
  connectedRoofs(): Set<number> {
    const connected=new Set<number>(), queue:number[]=[];
    const neighbors=(at:number):number[]=>{
      const x=at%this.width,z=Math.floor(at/this.width),out:number[]=[];
      if(x>0)out.push(at-1);if(x+1<this.width)out.push(at+1);
      if(z>0)out.push(at-this.width);if(z+1<this.height)out.push(at+this.width);
      return out;
    };
    for(const at of this.roof)if(this.holders[at]||neighbors(at).some(i=>this.holders[i])){connected.add(at);queue.push(at);}
    for(let head=0;head<queue.length;head++)for(const next of neighbors(queue[head]!)) {
      if(this.roof.has(next)&&!connected.has(next)){connected.add(next);queue.push(next);}
    }
    return connected;
  }
}

export function roofJobWanted(world: World, job: Job, context: RoofContext): boolean {
  const index = roofIndex(world, job);
  return job.kind === 'remove-roof' ? context.remove.has(index) && context.roof.has(index) && !context.thick.has(index)
    : context.build.has(index) && !context.roof.has(index) && context.supported(index);
}
