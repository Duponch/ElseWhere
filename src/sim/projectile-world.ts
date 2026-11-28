import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {landedStartingPods256} from './starting-pod-damage-256.ts';
import { FRAME_SHOT_FILL,resourceShotFill,SHOT_LAYER,STRUCTURE_SHOT_FILL,itemShotFill,structureShotLayer } from './combat-content.ts';
import { isRoomDoor } from './door-rules.ts';
import { footprintCells } from './definitions.ts';
import type { Cell,StructureKind,World } from './types.ts';
import type { ProjectileScene,ProjectileTarget } from './projectile-rules.ts';
import { animalBodySize } from './animal-life.ts';
import {combatCell297,type LivingTargetKey} from './combat-target.ts';
import {effectiveCore297} from './core-phase-297.ts';

export interface WorldProjectileTargets {
  readonly width:number;readonly height:number;readonly capturedAt:number;
  anchor(key:string):Cell|undefined;
  /** Read-only covering volumes; used by a batch's fresh movable overlay. */
  covers(cell:Cell,layer:number):boolean;
  /** Explicit relation snapshot for THIS launcher. Membership means both have
   * factions and are non-hostile; no inference from being in world.pawns. */
  scene(friendlyPawnIds:ReadonlySet<number>,friendlyFireFactor:number,friendlyTargetKeys?:ReadonlySet<LivingTargetKey>):ProjectileScene;
}
const PREFIX=['','structure','frame','resource','pile','packed','pawn','animal','mech','starting-pod'] as const;
const EMPTY:readonly ProjectileTarget[]=Object.freeze([]);

/** Captures all current map candidates, including zero-fill targetable objects.
 * No retained World references. Recreate after any mutation, share per unchanged
 * synchronous batch, never per pawn or frame. This is not the best-cover grid.
 * Numeric columns and lazy immutable records avoid a JS object per plant. */
export function captureWorldProjectileTargets(world:World):WorldProjectileTargets {
  const {width,height,tick:capturedAt}=world,n=width*height;
  const pods=landedStartingPods256(world);
  const capacity=pods.length+world.structures.length+world.jobs.length+world.resources.length+world.piles.length+world.packed.length+world.pawns.length+(world.schemaVersion>=77?world.wildlife?.animals.length??0:0)+(world.schemaVersion>=194?world.mechanoids?.length??0:0)+1;
  const ids=new Float64Array(capacity),fills=new Float64Array(capacity),bodySizes=new Float64Array(capacity),xs=new Int32Array(capacity),zs=new Int32Array(capacity);
  const kinds=new Uint8Array(capacity),layers=new Uint8Array(capacity),flags=new Uint8Array(capacity),heads=new Int32Array(n),rocks=new Uint8Array(n);
  const links=[0],next=[0],byId=new Map<number,Map<number,number>>(),ranges=PREFIX.map(()=>({start:0,end:0,ordered:true})),footprints=new Map<number,readonly Cell[]>();
  const records=new Map<number,ProjectileTarget>(),cellRecords=new Map<number,readonly ProjectileTarget[]>();let count=0;
  const inBounds=(c:Cell)=>Number.isInteger(c.x)&&Number.isInteger(c.z)&&c.x>=0&&c.z>=0&&c.x<width&&c.z<height;
  const cellIndex=(x:number,z:number)=>z*width+x;
  for(let i=0;i<n;i++)if(world.tiles[i].terrain==='rock')rocks[i]=1;
  const link=(slot:number,x:number,z:number)=>{if(!Number.isInteger(x)||!Number.isInteger(z)||x<0||z<0||x>=width||z>=height)return;const i=cellIndex(x,z);links.push(slot);next.push(heads[i]);heads[i]=links.length-1;};
  const append=(kind:number,id:number,x:number,z:number,fill:number,layer:number,state=0,cells?:readonly Cell[],bodySize=0)=>{
    const slot=++count;ids[slot]=id;xs[slot]=x;zs[slot]=z;fills[slot]=fill;bodySizes[slot]=bodySize;layers[slot]=layer;kinds[slot]=kind;flags[slot]=state;
    const range=ranges[kind];if(!range.start)range.start=slot;
    if(range.end&&id<=ids[range.end-1])range.ordered=false;range.end=slot+1;
    if(cells){const copy=cells.map(c=>({x:c.x,z:c.z}));footprints.set(slot,copy);for(const c of copy)link(slot,c.x,c.z);}else link(slot,x,z);
  };
  for(const s of world.structures)if(s.kind!=='hidden-conduit')append(1,s.id,s.x,s.z,STRUCTURE_SHOT_FILL[s.kind],structureShotLayer(s.kind),isRoomDoor(s.kind)&&s.door?.open?1:0,footprintCells(s));
  for(const j of world.jobs)if(j.construction==='frame')append(2,j.id,j.x,j.z,FRAME_SHOT_FILL,structureShotLayer((j.furniture?.kind??j.kind) as StructureKind),0,footprintCells(j));
  // Decorative pebbles are not actual chunks or destructible Core objects yet.
  for(const r of world.resources)if(r.kind!=='rock')append(3,r.id,r.x,r.z,resourceShotFill(r),r.kind==='tree'?SHOT_LAYER.building:SHOT_LAYER.lowPlant);
  for(const p of world.piles)if(p.owner.type==='ground')append(4,p.id,p.owner.x,p.owner.z,itemShotFill(p.item),SHOT_LAYER.item);
  // Preserve the current package's zero cover profile; do not give its inner
  // furniture footprint/fill to the map. Object damage is still unimplemented.
  for(const p of world.packed)if(p.owner.type==='ground')append(5,p.building.id,p.owner.x,p.owner.z,0,SHOT_LAYER.item);
  const spatialCore297=isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):0;
  const carried=new Set(world.pawns.filter(p=>p.rescue?.phase==='carry').map(p=>p.rescue!.patientId));
  for(const p of world.pawns)if(p.state!=='dead'&&!p.health?.death&&!carried.has(p.id)){const c=combatCell297(Number(world.schemaVersion),p,spatialCore297);append(6,p.id,c.x,c.z,0,SHOT_LAYER.pawn,['sleeping','resting','downed'].includes(p.state)?0:2);}
  if(world.schemaVersion>=77)for(const a of world.wildlife?.animals??[])if(a.state!=='dead')append(7,a.id,a.x,a.z,0,SHOT_LAYER.pawn,['sleeping','downed'].includes(a.state)?0:2,undefined,animalBodySize(a));
  if(world.schemaVersion>=194)for(const m of world.mechanoids??[])if(m.state!=='dead'&&!m.health?.death)append(8,m.id,m.x,m.z,0,SHOT_LAYER.pawn,m.state==='downed'?0:2,undefined,1);
  for(const p of pods)append(9,p.id,p.cell.x,p.cell.z,0,SHOT_LAYER.item);
  const coveredAt=(slot:number,c:Cell)=>{
    if(!inBounds(c))return false;const i=cellIndex(c.x,c.z);
    if(rocks[i]&&SHOT_LAYER.building>=layers[slot])return true;
    for(let entry=heads[i];entry;entry=next[entry]) {const other=links[entry];if(other!==slot&&fills[other]>.99&&layers[other]>=layers[slot])return true;}
    return false;
  };
  const materialize=(slot:number):ProjectileTarget=>{
    let record=records.get(slot);if(record)return record;
    if(slot<0) {
      const i=-slot-1,cell=Object.freeze({x:i%width,z:Math.floor(i/width)});let covered=false;
      for(let entry=heads[i];entry;entry=next[entry]){const other=links[entry];if(fills[other]>.99&&layers[other]>=SHOT_LAYER.building){covered=true;break;}}
      record=Object.freeze({key:`rock:${i}`,cell,kind:'object',covered,fill:1,openDoor:false});
    } else {
      const cell=Object.freeze({x:xs[slot],z:zs[slot]}),cells=footprints.get(slot),covered=cells?cells.every(c=>coveredAt(slot,c)):coveredAt(slot,cell);
      const base={key:`${PREFIX[kinds[slot]]}:${ids[slot]}`,cell,covered,fill:fills[slot],openDoor:!!(flags[slot]&1)};
      record=kinds[slot]>=6&&kinds[slot]<=8?Object.freeze({...base,kind:'pawn',bodySize:kinds[slot]===7?bodySizes[slot]:1,standing:!!(flags[slot]&2),friendly:false}):Object.freeze({...base,kind:'object'});
    }
    records.set(slot,record);return record;
  };
  const lookup=(key:string):ProjectileTarget|undefined=>{
    const parts=key.split(':');if(parts.length!==2)return;
    const id=Number(parts[1]);if(!Number.isSafeInteger(id)||id<0||String(id)!==parts[1])return;
    if(parts[0]==='rock')return id<n&&rocks[id]?materialize(-id-1):undefined;
    const kind=PREFIX.indexOf(parts[0] as typeof PREFIX[number]);if(kind<=0||!ranges[kind].start)return;
    // Verify ascending IDs while capturing instead of assuming World order.
    // Ordered kinds need no hash index, including the first cover-anchor lookup.
    const range=ranges[kind];
    if(range.ordered){let lo=range.start,hi=range.end;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(ids[mid]<id)lo=mid+1;else hi=mid;}return lo<range.end&&ids[lo]===id?materialize(lo):undefined;}
    // Unordered kinds retain exact lookup without sorting World or its snapshot.
    let index=byId.get(kind);if(!index){index=new Map();for(let s=ranges[kind].start;s<ranges[kind].end;s++)index.set(ids[s],s);byId.set(kind,index);}
    const slot=index.get(id);return slot?materialize(slot):undefined;
  };
  const at=(cell:Cell):readonly ProjectileTarget[]=>{
    if(!inBounds(cell))return EMPTY;const i=cellIndex(cell.x,cell.z);let values=cellRecords.get(i);if(values)return values;
    const slots:number[]=[];for(let entry=heads[i];entry;entry=next[entry])slots.push(links[entry]);
    // Registration order is not persisted. Use source category then safe ID;
    // never truncate IDs to 32 bits or depend on World array order.
    slots.sort((a,b)=>kinds[a]-kinds[b]||ids[a]-ids[b]);
    const candidates=slots.map(materialize);if(rocks[i])candidates.unshift(materialize(-i-1));
    values=candidates.length?Object.freeze(candidates):EMPTY;cellRecords.set(i,values);return values;
  };
  return Object.freeze({width,height,capturedAt,anchor:(key:string)=>lookup(key)?.cell,
    covers(cell:Cell,layer:number):boolean {
      if(!inBounds(cell))return false;const i=cellIndex(cell.x,cell.z);
      if(rocks[i]&&SHOT_LAYER.building>=layer)return true;
      for(let entry=heads[i];entry;entry=next[entry]){const s=links[entry];if(fills[s]>.99&&layers[s]>=layer)return true;}return false;
    },
    scene(friendlyPawnIds:ReadonlySet<number>,friendlyFireFactor:number,friendlyTargetKeys:ReadonlySet<LivingTargetKey>=new Set()):ProjectileScene {
      if(!Number.isFinite(friendlyFireFactor)||friendlyFireFactor<0||friendlyFireFactor>1)throw new RangeError('Invalid friendly fire factor');
      const friendly=new Set(friendlyPawnIds),typed=new Set(friendlyTargetKeys),view=new Map<string,ProjectileTarget>(),cells=new Map<number,readonly ProjectileTarget[]>();
      const relate=(target:ProjectileTarget):ProjectileTarget=>{
        if(target.kind!=='pawn'||!(target.key.startsWith('pawn:')&&friendly.has(Number(target.key.slice(5))))&&!typed.has(target.key as LivingTargetKey))return target;
        let record=view.get(target.key);if(!record){record=Object.freeze({...target,friendly:true});view.set(target.key,record);}return record;
      };
      return Object.freeze({width,height,friendlyFireFactor,
        target(key:string){const target=lookup(key);return target&&relate(target);},
        at(cell:Cell){if(!inBounds(cell))return EMPTY;const i=cellIndex(cell.x,cell.z);let list=cells.get(i);if(!list){const original=at(cell);list=original.length?Object.freeze(original.map(relate)):EMPTY;cells.set(i,list);}return list;},
      });
    },
  });
}
