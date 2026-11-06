import {isShipPartKind276} from './ship-part-content-276.ts';
import {PEN_ANIMALS_256} from './animal-domestic-v256.ts';
import {isAnimalSpeciesInVersion} from './animal-species.ts';
import type { AnimalSpeciesId } from './animal-species.ts';
import { footprintCells } from './definitions.ts';
import { isPassageDoor } from './door-rules.ts';
import { filteredStructures,structureMembershipToken,structuresOfKind} from './structure-navigation.ts';
import type { Cell, Structure, World } from './types.ts';

export const PEN_ANIMALS:readonly AnimalSpeciesId[] = Object.freeze(['deer','gazelle','muffalo','dromedary',...PEN_ANIMALS_256]);
export const penAnimalsForVersion=(version:number):readonly AnimalSpeciesId[]=>PEN_ANIMALS.filter(id=>isAnimalSpeciesInVersion(id,version));

/** A marker names a connected area of real map cells, never a food counter. */
export interface PenRegion {
  markerId:number;
  closed:boolean;
  accessible:boolean;
  cells:ReadonlySet<number>;
}
interface CachedRegion { cells:Set<number>; access:Cell[]; closed:boolean }
interface PenCache {
  scannedAt:number;
  signature:string;
  /** Exact fast path: membership token and door hold states of the signature inputs. */
  token?:object;
  holds?:Uint8Array;
  regions:Map<number,PenRegion>;
  access:Map<number,readonly Cell[]>;
  at:Map<number,PenRegion>;
  count:number;
}
const caches=new WeakMap<World,PenCache>();
const adjacent=(i:number,width:number,height:number):number[]=>{
  const x=i%width,z=Math.floor(i/width),out:number[]=[];
  if(x>0)out.push(i-1);if(x+1<width)out.push(i+1);
  if(z>0)out.push(i-width);if(z+1<height)out.push(i+width);
  return out;
};
const terrainPassable=(world:World,i:number):boolean=>{
  const t=world.tiles[i]?.terrain;
  return t!==undefined&&t!=='rock'&&t!=='water';
};
const penBarrier=(s:Structure):boolean=>
  isShipPartKind276(s.kind)||s.kind==='geothermal-generator'||s.kind==='wall'||s.kind==='cooler'||s.kind==='vent'||s.kind==='fence'
  ||isPassageDoor(s.kind)&&!(s.door?.holdOpen&&s.door.open);
const passage=(s:Structure):boolean=>isPassageDoor(s.kind);

/** Mutators call this when a barrier changes within a tick; idle ticks reuse
 * the previously flooded regions after one cheap structural signature. */
export function invalidateAnimalPens(world:World):void { caches.delete(world); }

const penSignatureInput=(s:Structure):boolean=>isShipPartKind276(s.kind)||s.kind==='geothermal-generator'||s.kind==='wall'||s.kind==='cooler'||s.kind==='vent'||s.kind==='fence'||passage(s)||s.kind==='pen-marker';
const holdOpen=(s:Structure):number=>s.door?.holdOpen&&s.door.open?1:0;
/* The signature reads only immutable facts (id, kind, position) of the
 * structures selected by penSignatureInput (a kind-only predicate) plus each
 * one's door hold state, so the selected list is cached per membership token
 * and an unchanged token with unchanged hold states proves an equal signature. */
function signatureInputs(world:World):readonly Structure[] {return filteredStructures(world,'animal-pen-signature',penSignatureInput);}
function holdStates(inputs:readonly Structure[]):Uint8Array {const out=new Uint8Array(inputs.length);for(let i=0;i<inputs.length;i++)out[i]=holdOpen(inputs[i]!);return out;}
function sameHoldStates(previous:Uint8Array|undefined,inputs:readonly Structure[]):boolean {
  if(!previous||previous.length!==inputs.length)return false;
  for(let i=0;i<inputs.length;i++)if(previous[i]!==holdOpen(inputs[i]!))return false;
  return true;
}
function signature(world:World):string {
  const parts:string[]=[];
  for(const s of signatureInputs(world))parts.push(`${s.id}:${s.kind}:${s.x}:${s.z}:${holdOpen(s)}`);
  return parts.join('|');
}

function build(world:World,oldSignature:string):PenCache {
  const width=world.width,height=world.height,size=width*height;
  const blocked=new Uint8Array(size),passages:Structure[]=[];
  for(let i=0;i<size;i++)if(!terrainPassable(world,i))blocked[i]=1;
  for(const s of world.structures){
    if(penBarrier(s))for(const cell of footprintCells(s))blocked[cell.z*width+cell.x]=1;
    if(passage(s))passages.push(s);
  }
  const component=new Int32Array(size);component.fill(-1);
  const byComponent:CachedRegion[]=[];
  const regions=new Map<number,PenRegion>(),access=new Map<number,readonly Cell[]>(),at=new Map<number,PenRegion>();
  const markers=[...structuresOfKind(world,'pen-marker')].sort((a,b)=>a.id-b.id);
  for(const marker of markers){
    const origin=marker.z*width+marker.x;
    if(blocked[origin])continue;
    let id=component[origin],region:CachedRegion;
    if(id<0){
      id=byComponent.length;
      const cells=new Set<number>(),queue=[origin];component[origin]=id;
      let closed=true;
      for(let cursor=0;cursor<queue.length;cursor++){
        const current=queue[cursor]!,x=current%width,z=Math.floor(current/width);
        cells.add(current);
        if(x===0||z===0||x===width-1||z===height-1)closed=false;
        for(const next of adjacent(current,width,height))if(!blocked[next]&&component[next]<0){component[next]=id;queue.push(next);}
      }
      const entries:Cell[]=[];
      for(const gate of passages){
        if(gate.door?.forbidden)continue;
        const gateId=gate.z*width+gate.x;
        const neighbours=adjacent(gateId,width,height);
        const inside=neighbours.filter(i=>cells.has(i));
        const outside=neighbours.some(i=>!cells.has(i)&&!blocked[i]);
        if(inside.length&&outside)for(const i of inside)entries.push({x:i%width,z:Math.floor(i/width)});
      }
      region={cells,access:entries,closed};byComponent.push(region);
    }else region=byComponent[id]!;
    const view:PenRegion={markerId:marker.id,closed:region.closed,accessible:region.access.length>0,cells:region.cells};
    regions.set(marker.id,view);access.set(marker.id,region.access);
    for(const i of region.cells)if(!at.has(i))at.set(i,view);
  }
  return {scannedAt:world.tick,signature:oldSignature,regions,access,at,count:world.structures.length};
}
function capture(world:World):PenCache {
  const previous=caches.get(world);
  if(previous?.scannedAt===world.tick&&previous.count===world.structures.length)return previous;
  const token=structureMembershipToken(world),inputs=signatureInputs(world);
  if(previous&&previous.token===token&&sameHoldStates(previous.holds,inputs)){previous.scannedAt=world.tick;previous.count=world.structures.length;return previous;}
  const key=signature(world);
  if(previous?.signature===key){previous.scannedAt=world.tick;previous.count=world.structures.length;previous.token=token;previous.holds=holdStates(inputs);return previous;}
  const next=build(world,key);next.token=token;next.holds=holdStates(inputs);caches.set(world,next);return next;
}
export const penRegion=(world:World,markerId:number):PenRegion|undefined=>capture(world).regions.get(markerId);
export const animalPenAt=(world:World,x:number,z:number):PenRegion|undefined=>capture(world).at.get(z*world.width+x);
/** Interior arrival cells immediately after a real door or fence gate. */
export const penAccessCells=(world:World,markerId:number):readonly Cell[]=>capture(world).access.get(markerId)??[];
