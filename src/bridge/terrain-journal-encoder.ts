/** Internal fixed-Worker lane only. Public mutable SnapshotEncoder always
 * constructs the full cache, including on arrays observed by this module. */
import {SnapshotEncoder,type SnapshotMessage} from './snapshots.ts';
import {TileSnapshotCache,type TileDelta} from './tile-snapshot-cache.ts';
import {captureTerrainJournal,readTerrainJournal,type TerrainJournalCursor} from '../sim/terrain-mutation-journal.ts';
import type {Tile,World} from '../sim/types.ts';

class JournalTileSnapshotCache extends TileSnapshotCache {
 private cursor:TerrainJournalCursor|undefined;
 private capturedLength=0;
 override reset(tiles:readonly Tile[]):void {
  const next=captureTerrainJournal(tiles);
  try{super.reset(tiles);this.capturedLength=tiles.length;this.cursor=next;}catch(error){this.cursor=undefined;throw error;}
 }
 override diff(tiles:readonly Tile[]):TileDelta[] {
  // A legitimate map resize receives an Encoder checkpoint. Keep the complete
  // public codec's standalone length behavior until then, including its sparse
  // array histories; a changed length is never certified as a partial edge.
  if(tiles.length!==this.capturedLength){this.cursor=undefined;return super.diff(tiles);}
  const changes=this.cursor&&readTerrainJournal(tiles,this.cursor),next=changes?.cursor??captureTerrainJournal(tiles);
  try{const delta=this.diffAt(tiles,changes?.indices);this.cursor=next;return delta;}catch(error){this.cursor=undefined;throw error;}
 }
}
export class TerrainJournalSnapshotEncoder extends SnapshotEncoder<true> {
 private requireCheckpoint=false;
 // Even a small colony needs exact structure edges: a literal replacement
 // invalidates MAIN's topology/support readers on every ordinary publication.
 constructor(){super({structureDelta:true,minimumStructures:0,plantLifeDelta:true});}
 protected override createTileCache():TileSnapshotCache {return new JournalTileSnapshotCache();}
 protected forcePublicationCheckpoint():void {this.requireCheckpoint=true;}
 override encode(world:World,stepMs:number,speed:number,checkpoint=false):SnapshotMessage<true> {
  // A late codec exception can already have changed its private value cache.
  // The runtime stops fatally; any explicit caller retry must send a complete
  // checkpoint rather than infer rollback from an unadvanced journal cursor.
  try{const packet=super.encode(world,stepMs,speed,checkpoint||this.requireCheckpoint);this.requireCheckpoint=false;return packet;}
  catch(error){this.requireCheckpoint=true;throw error;}
 }
}
