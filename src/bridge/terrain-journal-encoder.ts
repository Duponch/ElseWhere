/** Internal fixed-Worker lane only. Public mutable SnapshotEncoder always
 * constructs the full cache, including on arrays observed by this module. */
import {SnapshotEncoder,type SnapshotMessage} from './snapshots.ts';
import {TileSnapshotCache,type TileDelta} from './tile-snapshot-cache.ts';
import {captureTerrainJournal,readTerrainJournal,type TerrainJournalCursor} from '../sim/terrain-mutation-journal.ts';
import type {Tile,World,MaterialPile} from '../sim/types.ts';
import {captureResourceJournal,readResourceJournal,verifyResourceJournal,type ResourceJournalCursor} from '../sim/resource-mutation-journal.ts';
import {ResourcePublicationOrder,type ResourcePublicationCandidates} from './resource-publication-order.ts';
import {OrdinaryPilePublication379} from './ordinary-pile-publication-379.ts';
import {PileSnapshotPublication379} from './pile-snapshot-publication-379.ts';
import {StaticStructurePublication379} from './static-structure-publication-379.ts';
import {samePilePresentation297} from './actor-phase-dependencies-297.ts';
import {verifyPileIndex} from '../sim/pile-index.ts';

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
 /** Only the fixed production entry owns resources between publications.
  * Public/direct terrain encoders retain exhaustive resource discovery. */
 protected usesClosedResourceJournal=false;
 private requireCheckpoint=false;
 private resourceCursor:ResourceJournalCursor|undefined;
 private resourceOrder:ResourcePublicationOrder|undefined;
 private pendingResourceCursor:ResourceJournalCursor|undefined;
 private resourceWorld:World|undefined;
 private rebuildResourceOrder=false;
 private resourceOracle:SnapshotEncoder<true>|undefined;
 private readonly pileJournal:OrdinaryPilePublication379|undefined;
 private readonly pileSnapshot: PileSnapshotPublication379|undefined;
 private readonly staticStructures:StaticStructurePublication379|undefined;
 // Even a small colony needs exact structure edges: a literal replacement
 // invalidates MAIN's topology/support readers on every ordinary publication.
 constructor(owner?:object){super({structureDelta:true,minimumStructures:0,plantLifeDelta:true,pileRotDelta:true});this.pileJournal=owner?new OrdinaryPilePublication379(owner):undefined;this.pileSnapshot=owner?new PileSnapshotPublication379(owner):undefined;this.staticStructures=owner?new StaticStructurePublication379(owner):undefined;}
 protected override pileBaseUnchanged(pile:MaterialPile,previous:MaterialPile):boolean {
  return this.usesClosedResourceJournal&&!!this.pileJournal?.unchanged(pile,previous,()=>samePilePresentation297(pile,previous));
 }
 protected override capturedPileCopy(pile:MaterialPile,copy:MaterialPile):void {if(this.usesClosedResourceJournal)this.pileJournal?.remember(pile,copy);}
 protected override resetPileCandidates(world:World):void {if(this.usesClosedResourceJournal)this.pileSnapshot?.reset(world);}
 protected override pileCandidates(world:World){
  if(!this.usesClosedResourceJournal||!this.pileSnapshot)return;
  // With only pile-index checking enabled the ordinary complete codec does
  // its own exhaustive validation. With the independent Full oracle we can
  // verify the actual sparse result against the complete packet instead.
  const candidates=verifyPileIndex&&!verifyResourceJournal?(this.pileSnapshot.reset(world),undefined):this.pileSnapshot.prepare(world);
  if(candidates)return candidates;
  const previous=this.pileSnapshot.previousOrder();if(previous)this.restorePileOrder(previous);
 }
 protected override resetStructureCandidates(world:World):void {if(this.usesClosedResourceJournal)this.staticStructures?.reset(world);}
 protected override structureCandidates(world:World){if(this.usesClosedResourceJournal)return this.staticStructures?.prepare(world);}
 override campaignHeader(checkpoint=false){this.pileSnapshot?.clear();this.staticStructures?.clear();return super.campaignHeader(checkpoint);}
 protected override createTileCache():TileSnapshotCache {return new JournalTileSnapshotCache();}
 protected override resetResourceCandidates(world:World):void {
  if(!this.usesClosedResourceJournal)return;
  this.resourceWorld=world;this.pendingResourceCursor=captureResourceJournal(world.resources);this.rebuildResourceOrder=true;
 }
 protected override resourceCandidates(world:World):ResourcePublicationCandidates|undefined {
  if(!this.usesClosedResourceJournal)return;
  this.resourceWorld=world;
  const changes=this.resourceCursor&&readResourceJournal(world.resources,this.resourceCursor);
  this.pendingResourceCursor=changes?.cursor??captureResourceJournal(world.resources);
  const candidates=changes&&changes.membershipEdits&&this.resourceOrder?.prepare(changes.membershipEdits,changes.dirtyIds,world.resources.length);
  this.rebuildResourceOrder=!candidates;
  if(candidates)return candidates;
  // Only a gap, unknown transaction or contradiction reconstructs the old
  // published array. Ordinary remove/append edges keep the linked directory.
  if(this.resourceOrder)this.restoreResourceOrder(this.resourceOrder.publishedOrder());
  return;
 }
 protected forcePublicationCheckpoint():void {this.requireCheckpoint=true;}
 override encode(world:World,stepMs:number,speed:number,checkpoint=false):SnapshotMessage<true> {
  // A late codec exception can already have changed its private value cache.
  // The runtime stops fatally; any explicit caller retry must send a complete
  // checkpoint rather than infer rollback from an unadvanced journal cursor.
  try{
   // Enabling verification starts an independent complete cache at a common
   // checkpoint. It compares exact packets, including order and optional fields.
   if(this.usesClosedResourceJournal&&verifyResourceJournal&&!this.resourceOracle){this.resourceOracle=new SnapshotEncoder({structureDelta:true,minimumStructures:0,plantLifeDelta:true,pileRotDelta:true});this.requireCheckpoint=true;}
   if(!this.usesClosedResourceJournal||!verifyResourceJournal)this.resourceOracle=undefined;
   const force=checkpoint||this.requireCheckpoint,packet=super.encode(world,stepMs,speed,force);
   if(this.resourceOracle){
    const oracle=this.resourceOracle.encode(world,stepMs,speed,force);
    // An oracle enabled during an existing campaign starts its own numbering.
    // Normalize only this independent cache's envelope counters.
    const aligned={...oracle,epoch:packet.epoch,revision:packet.revision,...packet.kind==='delta'?{baseRevision:packet.baseRevision}:{}};
    if(!samePublication(packet,aligned)){
     if(packet.kind==='delta'&&aligned.kind==='delta'&&!samePublication(packet.piles,aligned.piles))throw Error('Unmarked ordinary pile source write or pile membership divergence');
     if(packet.kind==='delta'&&aligned.kind==='delta'&&!samePublication(packet.structures,aligned.structures))throw Error('Unmarked static structure source write or structure membership divergence');
     throw Error('Resource journal publication differs from exhaustive codec');
    }
   }
   if(this.usesClosedResourceJournal){
    if(this.rebuildResourceOrder)this.resourceOrder=ResourcePublicationOrder.capture(this.resourceWorld!.resources);
    else this.resourceOrder?.commit();
    this.resourceCursor=this.resourceOrder?this.pendingResourceCursor:undefined;
    this.pileSnapshot?.commit();
    this.staticStructures?.commit();
   }
   this.requireCheckpoint=false;return packet;
  }
  catch(error){this.resourceCursor=undefined;this.pendingResourceCursor=undefined;this.pileSnapshot?.clear();this.staticStructures?.clear();this.requireCheckpoint=true;throw error;}
 }
}
/** Exact independent packet comparison, including undefined, NaN, signed zero,
 * optional own fields and typed columns. Only the explicit oracle switch pays. */
function samePublication(a:unknown,b:unknown):boolean {
 if(Object.is(a,b))return true;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Object.getPrototypeOf(a)!==Object.getPrototypeOf(b))return false;
 const left=Reflect.ownKeys(a),right=Reflect.ownKeys(b);
 if(left.length!==right.length)return false;
 return left.every((key,index)=>right[index]===key&&samePublication((a as Record<PropertyKey,unknown>)[key],(b as Record<PropertyKey,unknown>)[key]));
}
