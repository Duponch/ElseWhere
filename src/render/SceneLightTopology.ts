import {readSnapshotStructureChanges} from '../bridge/snapshot-changes';
import {roomBarrierValue,roomBarrierCells} from '../sim/room-barriers.ts';
import {RoomTopologyCache,type RoomTopology} from '../sim/room-topology';
import type {Structure,World} from '../sim/types';

// Match RoomTopologyCache's ordered barrier inputs, including overlap precedence.
function barrier(s:Structure,width:number):string {
  const value=roomBarrierValue(s.kind);
  if(!value)return '';
  return roomBarrierCells(s).map(c=>(c.z*width+c.x)*3+value).join(',');
}

/** Owned only by MAIN's fixed immutable readers. A valid journal allows local
 * input checks; RAW, repeated mutable objects, checkpoints and missing history
 * use the complete historical reader. No topology is inferred from tick alone. */
export class SceneLightTopology {
  private readonly cold=new RoomTopologyCache();
  private previous?:World;
  private topology?:RoomTopology;
  private barriers:string[]=[];
  private rocks=new Uint8Array(0);

  read(world:World):RoomTopology {
    const before=this.previous;
    const changes=before&&before!==world&&before.width===world.width&&before.height===world.height
      &&this.barriers.length===world.structures.length?readSnapshotStructureChanges(before,world):undefined;
    this.previous=undefined;
    let changed=!changes;
    if(changes){
      for(const i of changes.structureIndices){
        const next=barrier(world.structures[i]!,world.width);
        if(next!==this.barriers[i]){changed=true;this.barriers[i]=next;}
      }
      for(const i of changes.tileIndices){
        const next=world.tiles[i]!.terrain==='rock'?1:0;
        if(next!==this.rocks[i]){changed=true;this.rocks[i]=next;}
      }
    }else{
      this.barriers=world.structures.map(s=>barrier(s,world.width));
      // A plain loop: Uint8Array.from with a mapping function walks the tiles
      // through the iterator protocol (about 4 ms on a 325x325 map).
      const tiles=world.tiles,rocks=new Uint8Array(tiles.length);
      for(let i=0;i<tiles.length;i++)if(tiles[i]!.terrain==='rock')rocks[i]=1;
      this.rocks=rocks;
    }
    if(changed)this.topology=this.cold.read(world);
    this.previous=world;
    return this.topology!;
  }
}
