import {PlantRegionType256,type PlantGenerationRegion256} from './wild-plant-regions-256.ts';

const f=Math.fround;
/** A synchronous renewal session, discarded before World mutation. Chunks
 * retain the original12x12 decomposition; neighbours and BFS insertion order
 * match the cold whole-map oracle. IDs use the component's first cell instead
 * of its whole-map ordinal, which does not participate in any plant rule. */
export class PlantSpatialRegions256 {
 // One integer slot per real map cell. Regions stay ordinary records, with
 // their original root/cell order; zero denotes no discovered component.
 private readonly at:Uint32Array;
 private readonly regions:(PlantGenerationRegion256|undefined)[]=[];
 private readonly slotsByChunk:number[][]=[];
 private readonly freeSlots:number[]=[];
 private readonly chunks:Uint8Array;
 private readonly chunkColumns:number;
 private readonly neighbours=new Map<number,readonly PlantGenerationRegion256[]>();
 constructor(readonly width:number,readonly height:number,private readonly typeAt:(cell:number)=>number,private readonly baseAt:(cell:number)=>number) {
  if(![width,height].every(v=>Number.isSafeInteger(v)&&v>=1&&v<=400))throw Error('Invalid spatial plant dimensions');
  this.at=new Uint32Array(width*height);this.chunkColumns=Math.ceil(width/12);
  this.chunks=new Uint8Array(this.chunkColumns*Math.ceil(height/12));
 }
 regionAt(cell:number):PlantGenerationRegion256|undefined {
  if(!Number.isSafeInteger(cell)||cell<0||cell>=this.width*this.height)throw Error('Invalid spatial plant cell');
  const resolved=this.at[cell]!;if(resolved)return this.regions[resolved-1];
  const cx=Math.floor(cell%this.width/12),cz=Math.floor(Math.floor(cell/this.width)/12),chunk=cz*this.chunkColumns+cx;
  if(!this.chunks[chunk]){
   this.chunks[chunk]=1;
   const minX=cx*12,minZ=cz*12,maxX=Math.min(this.width,minX+12),maxZ=Math.min(this.height,minZ+12),span=maxX-minX,count=span*(maxZ-minZ);
   // Chunk-local contiguous storage. Values are still captured in row order
   // before discovering any component, including invalid/None cells. Float64
   // bases preserve the old Map's numbers before the ordered float32 sum.
   const types=new Uint8Array(count),bases=new Float64Array(count),seen=new Uint8Array(count);
   for(let z=minZ;z<maxZ;z++)for(let x=minX;x<maxX;x++){
    const c=z*this.width+x,type=this.typeAt(c),base=this.baseAt(c);
    if(!Number.isInteger(type)||type<0||type>4||!Number.isFinite(base)||base<0)throw Error('Invalid spatial plant region cell');
    const local=(z-minZ)*span+x-minX;types[local]=type;bases[local]=base;
   }
   for(let local=0;local<count;local++){
    const type=types[local]!;if(type===PlantRegionType256.None||seen[local])continue;
    const root=(minZ+Math.floor(local/span))*this.width+minX+local%span;
    const cells:number[]=[],queue=[local];seen[local]=1;let x0=root%this.width,x1=x0,z0=Math.floor(root/this.width),z1=z0;
    for(let head=0;head<queue.length;head++){
     const current=queue[head]!,x=minX+current%span,z=minZ+Math.floor(current/span),c=z*this.width+x;cells.push(c);x0=Math.min(x0,x);x1=Math.max(x1,x);z0=Math.min(z0,z);z1=Math.max(z1,z);
     if(type===PlantRegionType256.Portal)continue;
     // Same south/east/north/west BFS order as adjacent(), confined to this
     // chunk just as the old local Map's missing entries confined it.
     if(z+1<maxZ&&!seen[current+span]&&types[current+span]===type){seen[current+span]=1;queue.push(current+span);}
     if(x+1<maxX&&!seen[current+1]&&types[current+1]===type){seen[current+1]=1;queue.push(current+1);}
     if(z>minZ&&!seen[current-span]&&types[current-span]===type){seen[current-span]=1;queue.push(current-span);}
     if(x>minX&&!seen[current-1]&&types[current-1]===type){seen[current-1]=1;queue.push(current-1);}
    }
    cells.sort((a,b)=>a-b);let sum=0;for(const c of cells)sum=f(sum+bases[(Math.floor(c/this.width)-minZ)*span+c%this.width-minX]!);
    const region:PlantGenerationRegion256={id:root,type,cells,minX:x0,maxX:x1,minZ:z0,maxZ:z1,baseDesired:sum,neighbours:[]};
    const slot=this.freeSlots.pop()??this.regions.length+1;
    this.regions[slot-1]=region;(this.slotsByChunk[chunk]??=[]).push(slot);
    for(const c of cells)this.at[c]=slot;
   }
  }
  const slot=this.at[cell]!;return slot?this.regions[slot-1]:undefined;
 }
 /** The actual closed plant-region owner supplies changed physical inputs
  * before the next renewal session. Components cannot cross a 12x12 chunk,
  * so only affected chunks lose their slot maps. Cached cross-chunk
  * adjacency is discarded: no retained neighbour can reference an old
  * component. Slots are recycled to bound storage over long games.
  * Never mutate a region object previously returned by a session. */
 invalidateAt(cells:readonly number[]):void {
  let changed=false;const chunks=new Set<number>();
  for(const cell of cells){
   if(!Number.isSafeInteger(cell)||cell<0||cell>=this.width*this.height)throw Error('Invalid spatial plant cell');
   const cx=Math.floor(cell%this.width/12),cz=Math.floor(Math.floor(cell/this.width)/12),chunk=cz*this.chunkColumns+cx;
   if(!this.chunks[chunk]||chunks.has(chunk))continue;
   chunks.add(chunk);this.chunks[chunk]=0;changed=true;
   for(const slot of this.slotsByChunk[chunk]??[]){this.regions[slot-1]=undefined;this.freeSlots.push(slot);}
   delete this.slotsByChunk[chunk];
   const x0=cx*12,z0=cz*12,x1=Math.min(this.width,x0+12),z1=Math.min(this.height,z0+12);
   for(let z=z0;z<z1;z++)this.at.fill(0,z*this.width+x0,z*this.width+x1);
  }
  if(changed)this.neighbours.clear();
 }
 private adjacentRegions(region:PlantGenerationRegion256):readonly PlantGenerationRegion256[] {
  let out=this.neighbours.get(region.id);
  if(!out){
   const seen=new Set<number>(),next:PlantGenerationRegion256[]=[];
   // Same south/east/north/west enumeration of each sorted component cell.
   // The prevalent internal edges are already resolved, so do not allocate
   // a neighbour array or redo regionAt's validation and chunk arithmetic.
   const consider=(adjacent:number)=>{const slot=this.at[adjacent]!,other=slot?this.regions[slot-1]:this.regionAt(adjacent);
    if(other&&other.id!==region.id&&!seen.has(other.id)){seen.add(other.id);next.push(other);}};
   for(const c of region.cells){const x=c%this.width,z=Math.floor(c/this.width);
    if(z+1<this.height)consider(c+this.width);if(x+1<this.width)consider(c+1);
    if(z>0)consider(c-this.width);if(x>0)consider(c-1);
   }
   out=next;this.neighbours.set(region.id,out);
  }
  return out;
 }
 near(cell:number,radius:number):readonly PlantGenerationRegion256[] {
  if(!Number.isFinite(radius)||radius<0)throw Error('Invalid spatial plant radius');
  const root=this.regionAt(cell);if(!root||root.type===PlantRegionType256.FreeAir)return [];
  const x=cell%this.width,z=Math.floor(cell/this.width),queue=[root],seen=new Set([root.id]),radiusSquared=f(radius*radius);
  for(let head=0;head<queue.length;head++)for(const next of this.adjacentRegions(queue[head]!)){
   if(seen.has(next.id))continue;seen.add(next.id);if(next.type===PlantRegionType256.FreeAir)continue;
   const dx=Math.max(next.minX-x,0,x-next.maxX),dz=Math.max(next.minZ-z,0,z-next.maxZ);if(dx*dx+dz*dz<=radiusSquared)queue.push(next);
  }
  return queue;
 }
 touches(cell:number,region:PlantGenerationRegion256,walkableNoDoorAt:(cell:number)=>boolean):boolean {
  const x=cell%this.width,z=Math.floor(cell/this.width);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
   const nx=x+dx,nz=z+dz;if(nx<0||nz<0||nx>=this.width||nz>=this.height)continue;
   if(dx&&dz&&!walkableNoDoorAt(z*this.width+nx)&&!walkableNoDoorAt(nz*this.width+x))continue;
   if(this.regionAt(nz*this.width+nx)?.id===region.id)return true;
  }
  return false;
 }
}
