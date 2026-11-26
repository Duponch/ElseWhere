import {readSnapshotStructureChanges,readSnapshotTileChanges} from '../bridge/snapshot-changes';
import {readResidentCollectionChanges379} from '../bridge/resident-collection-changes-379';
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
 * use a complete primitive comparison. No topology is inferred from tick alone. */
export class SceneLightTopology {
  private readonly cold=new RoomTopologyCache();
  private previous?:World;
  private topology?:RoomTopology;
  /** Only real room barriers own a projection. Non-barriers may change dense
   * membership without changing the ordered barrier codes or the topology. */
  private barriers:string[]=[];
  private barrierIds=new Map<number,string>();
  private structureCount=0;
  private readonly counts={journalReads:0,journalRows:0,fullReads:0,fullRows:0};
  metrics379(){return{...this.counts};}
  private rocks=new Uint8Array(0);
  private width=0;
  private height=0;
  private valid=false;

  read(world:World):RoomTopology {
    const before=this.previous,valid=this.valid;this.previous=undefined;this.valid=false;
    const sameMap=this.width===world.width&&this.height===world.height;
    const changes=before&&before!==world&&sameMap
      &&this.structureCount===world.structures.length?readSnapshotStructureChanges(before,world):undefined;
    const tileChanges=changes?.tileIndices??(before&&before!==world&&sameMap?readSnapshotTileChanges(before,world):undefined);
    let changed=!valid||!this.topology||!sameMap;
    let barrierProof=false,barrierChanged=false;
    const proof=valid&&before&&before!==world&&sameMap?readResidentCollectionChanges379(before,world,'structures'):undefined;
    if(proof&&proof.before.count===this.structureCount&&proof.after.count===world.structures.length){
      const touched=new Set<number>(),membership=new Set<number>();for(const edge of proof.edges){for(const row of edge.removed){touched.add(row.id);membership.add(row.id);}for(const row of edge.added){touched.add(row.id);membership.add(row.id);}for(const row of edge.updated)touched.add(row.id);}
      barrierProof=true;this.counts.journalReads++;
      for(const id of touched){const source=proof.after.source(id),row=source===undefined?undefined:world.structures[source];this.counts.journalRows++;
        if(source===undefined&&proof.after.capturedSource(id)!==undefined||source!==undefined&&row?.id!==id){barrierProof=false;break;}
        const old=this.barrierIds.get(id)??'',next=row?barrier(row,world.width):'';
        // A barrier removed and reborn in skipped edges can move in source
        // order even if its endpoint code is identical. Rebuild that ordered
        // capture, exactly as for an explicit reorder (no journal witness).
        if(old!==next||membership.has(id)&&(old!==''||next!==''))barrierChanged=true;
      }
    }else if(valid&&changes&&before){
      barrierProof=true;
      for(const i of changes.structureIndices){const row=world.structures[i];if(!row||before.structures[i]?.id!==row.id){barrierProof=false;break;}
        if(barrier(row,world.width)!==(this.barrierIds.get(row.id)??''))barrierChanged=true;
      }
    }
    if(!barrierProof||barrierChanged){
      // Unknown/public/backward/checkpoint endpoints observe every primitive;
      // the actual flattened barrier sequence still proves a no-op when
      // only unrelated buildings were added, removed or reordered.
      const barriers:string[]=[],ids=new Map<number,string>();this.counts.fullReads++;this.counts.fullRows+=world.structures.length;
      for(const row of world.structures){const code=barrier(row,world.width);if(code){barriers.push(code);ids.set(row.id,code);}}
      if(barriers.length!==this.barriers.length||barriers.some((value,i)=>value!==this.barriers[i]))changed=true;
      this.barriers=barriers;this.barrierIds=ids;
    }
    if(tileChanges&&this.rocks.length===world.tiles.length){
      for(const i of tileChanges){
        const next=world.tiles[i]!.terrain==='rock'?1:0;
        if(next!==this.rocks[i]){changed=true;this.rocks[i]=next;}
      }
    }else{
      // A plain loop: Uint8Array.from with a mapping function walks the tiles
      // through the iterator protocol (about 4 ms on a 325x325 map).
      const tiles=world.tiles,rocks=new Uint8Array(tiles.length);
      if(rocks.length!==this.rocks.length)changed=true;
      for(let i=0;i<tiles.length;i++){
        const next=tiles[i]!.terrain==='rock'?1:0;rocks[i]=next;
        if(next!==this.rocks[i])changed=true;
      }
      this.rocks=rocks;
    }
    if(changed)this.topology=this.cold.read(world);
    this.previous=world;this.width=world.width;this.height=world.height;this.structureCount=world.structures.length;this.valid=true;
    return this.topology!;
  }
}
