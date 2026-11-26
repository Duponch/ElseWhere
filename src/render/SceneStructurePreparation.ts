import { ConfirmedStructurePresentationSignature } from './ConfirmedStructurePresentationSignature';
import type { Structure, World } from '../sim/types';
import { doorOrientations, isRoomDoor } from '../sim/door-rules';
import { penBoundaryAxes } from './pen-parts';
import { readSnapshotStructureChanges,readSnapshotTileChanges } from '../bridge/snapshot-changes';

export type SceneStructureGeometry=Pick<Structure,'id'|'kind'|'x'|'z'|'orientation'|'footprint'>;
type Capture=SceneStructureGeometry&{effect:boolean};
const effectKinds=new Set<string>(['firefoam-popper','electric-crematorium','electric-smelter','mini-turret','autodoor','machining-table','fabrication-bench','electric-stove',
  'fueled-stove','hi-tech-research-bench','multi-analyzer','battery','biofuel-refinery','chemfuel-generator',
  'wood-generator','campfire','torch-lamp']);
const effect=(s:Structure)=>effectKinds.has(s.kind)||!!s.casketWick||!!s.breakdown||!!s.emp;
const doorScoreKind=(kind:unknown)=>kind==='wall'||kind==='vent'||isRoomDoor(kind);
const penBoundaryKind=(kind:Structure['kind'])=>kind==='fence'||kind==='fence-gate'||kind==='wall'||isRoomDoor(kind);
const solidDoorTerrain=(terrain:World['tiles'][number]['terrain'])=>terrain==='rock'||terrain==='water';
const capture=(s:Structure,old?:Capture):Capture=>{
  const id=s.id,kind=s.kind,x=s.x,z=s.z,orientation=s.orientation,footprint=s.footprint,active=effect(s);
  return old&&old.id===id&&old.kind===kind&&Object.is(old.x,x)&&Object.is(old.z,z)&&old.orientation===orientation&&old.footprint===footprint&&old.effect===active
    ?old:{id,kind,x,z,orientation,footprint,effect:active};
};

/** Projection owned by the closed MAIN renderer, never an admission capability.
 * The journal proves which ordinals changed, not that arbitrary Worlds are
 * immutable. The caller must own all readers for this instance's lifetime. */
export class SceneStructurePreparation {
  constructor(private readonly geometry?:(world:World,captures:readonly SceneStructureGeometry[],changed:boolean,visited:number)=>void){}
  readonly signature=new ConfirmedStructurePresentationSignature();
  #world:World|undefined;
  #captures:Capture[]=[];
  #doors:number[]=[];
  #effects:number[]=[];
  #jobs='';
  #axes:ReadonlyMap<number,0|1>=new Map();
  #gateAxes:ReadonlyMap<number,0|1>=new Map();
  #axesKey='';
  #doorInput='';
  #penInput='';
  #doorRows:Capture[]=[];
  #penRows:Capture[]=[];
  #doorNeighbors=new Set<number>();

  clear():void {
    this.#world=undefined;this.#captures=[];this.#doors=[];this.#effects=[];
    this.#jobs='';this.#axes=new Map();this.#gateAxes=new Map();this.#axesKey='';
    this.#doorInput=this.#penInput='';this.#doorRows=[];this.#penRows=[];this.#doorNeighbors.clear();
  }

  read(world:World,reset=false) {
    const previous=this.#world;
    const sameMap=previous&&previous.seed===world.seed&&previous.width===world.width&&previous.height===world.height;
    const changes=!reset&&sameMap&&previous!==world&&this.#captures.length===world.structures.length
      ?readSnapshotStructureChanges(previous,world):undefined;
    let indices=changes?.structureIndices;
    if(indices)for(const i of indices)if(this.#captures[i]?.id!==world.structures[i]?.id){indices=undefined;break;}
    // Mark invalid before the first consumer read. A throw never leaves an old
    // World as the base for partially updated captures.
    this.#world=undefined;
    let topology=reset||!sameMap||this.#captures.length!==world.structures.length,subjects=topology,geometry=topology;
    const update=(i:number):void=>{
      const s=world.structures[i]!,old=this.#captures[i],next=capture(s,old);
      if(!old||old.kind!==next.kind||old.x!==next.x||old.z!==next.z)topology=true;
      if(!old||old.kind!==next.kind||old.effect!==next.effect)subjects=true;
      if(!old||old.id!==next.id||old.kind!==next.kind||!Object.is(old.x,next.x)||!Object.is(old.z,next.z)||old.orientation!==next.orientation||old.footprint!==next.footprint)geometry=true;
      this.#captures[i]=next;
    };
    if(indices)for(const i of indices)update(i);
    else {
      // A checkpoint or missing structure suffix still reads EVERY primitive.
      // It need not rebuild support maps, gate axes and memberships when that
      // complete comparison proves their inputs unchanged.
      for(let i=0;i<world.structures.length;i++)update(i);
      this.#captures.length=world.structures.length;
    }
    if(subjects){
      this.#doors=[];this.#effects=[];
      for(let i=0;i<this.#captures.length;i++){
        const c=this.#captures[i]!;
        if(isRoomDoor(c.kind)||c.kind==='fence-gate')this.#doors.push(i);
        if(c.effect)this.#effects.push(i);
      }
    }
    // A physically unrelated building must not rebuild either boundary census.
    // Keep the exact relevant member order: duplicate-cell precedence follows
    // the literal readers, even though valid saves have unique footprints.
    let doorChanged=reset||!sameMap,penChanged=doorChanged;
    if(topology){
      const doorRows=this.#captures.filter(c=>doorScoreKind(c.kind)),penRows=this.#captures.filter(c=>penBoundaryKind(c.kind));
      const doorInput=doorRows.map(s=>`${s.kind}:${s.x}:${s.z}`).join('|'),penInput=penRows.map(s=>`${s.x}:${s.z}`).join('|');
      if(doorInput!==this.#doorInput){doorChanged=true;this.#doorInput=doorInput;}
      if(penInput!==this.#penInput){penChanged=true;this.#penInput=penInput;}
      this.#doorRows=doorRows;this.#penRows=penRows;
      if(doorChanged){
        const neighbors=new Set<number>(),add=(x:number,z:number)=>{if(x>=0&&z>=0&&x<world.width&&z<world.height)neighbors.add(z*world.width+x);};
        for(const door of doorRows)if(isRoomDoor(door.kind)){add(door.x-1,door.z);add(door.x+1,door.z);add(door.x,door.z-1);add(door.x,door.z+1);}
        this.#doorNeighbors=neighbors;
      }
    }
    // Jobs (including vents) participate in the exact score and source order.
    const jobs=world.jobs.filter(j=>doorScoreKind(j.kind)).map(j=>`${j.kind}:${j.x}:${j.z}`).join('|');
    const tiles=changes?.tileIndices??(!reset&&sameMap&&previous!==world?readSnapshotTileChanges(previous,world):undefined);
    const changedDoorTerrain=tiles&&previous?tiles.some(i=>this.#doorNeighbors.has(i)&&solidDoorTerrain(previous.tiles[i]!.terrain)!==solidDoorTerrain(world.tiles[i]!.terrain)):true;
    if(doorChanged||jobs!==this.#jobs||changedDoorTerrain){
      this.#axes=doorOrientations({...world,structures:this.#doorRows});
      this.#axesKey=[...this.#axes].join(':');
    }
    if(penChanged)this.#gateAxes=penBoundaryAxes({...world,structures:this.#penRows});
    this.geometry?.(world,this.#captures,geometry,indices?.length??this.#captures.length);
    this.#jobs=jobs;this.#world=world;
    return {
      world,indices,axes:this.#axes,axesKey:this.#axesKey,gateAxes:this.#gateAxes,
      doors:this.#doors.map(i=>world.structures[i]!),effects:this.#effects.map(i=>world.structures[i]!),
    };
  }
}
