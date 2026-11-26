import {treeCargoCenterY} from './tree-presentation';
import type { MaterialPile, World } from '../sim/types';
import { pileSurfaces,pileIdentitySurfaces,type PileSurface } from './pile-surfaces';
import {storageCellById} from '../sim/shelf-storage';

export const CARGO_HANDOFF_TICKS = 1.5;

export type CargoAnchor = { x:number;y:number;z:number;yaw:number };
export type CargoHandoff = {
  pawnId:number; pile:MaterialPile; direction:'pickup'|'drop'; start:number; end:number;
  from:CargoAnchor; to:CargoAnchor; groundScale:number; targetPileId?:number; partial?:boolean;
};

function groundAnchor(world:World,pile:MaterialPile,surfaces:ReadonlyMap<number,PileSurface>,identities:ReadonlyMap<number,PileSurface>):CargoAnchor|undefined {
  const owner=pile.owner;
  const cell=owner.type==='ground'?owner:owner.type==='job'?world.jobs.find(job=>job.id===owner.jobId):undefined;
  if(!cell)return;
  const surface=owner.type==='ground'?identities.get(pile.id)??surfaces.get(cell.z*world.width+cell.x):undefined;
  return {x:cell.x+(surface?.x??(owner.type==='job'?(pile.kind==='wood'?-.12:.2):0)),y:(surface?.y??0)+(pile.item==='minified-tree'?treeCargoCenterY(pile.innerResource)*(surface?.scale??1):.15),
    z:cell.z+(surface?.z??(owner.type==='job'?.16:0)),yaw:0};
}

function deliveryCell(previous:World,world:World,pawnId:number):{type:'ground';x:number;z:number}|{type:'job';jobId:number}|undefined {
  const pawn=previous.pawns.find(p=>p.id===pawnId),current=world.pawns.find(p=>p.id===pawnId);
  const haul=pawn?.haul?.destination;
  if(haul?.type==='job')return {type:'job',jobId:haul.jobId};
  if(haul?.type==='aside')return {type:'ground',x:haul.x,z:haul.z};
  if(haul?.type==='stockpile'){
    const zone=storageCellById(world,haul.stockpileId);
    if(zone)return {type:'ground',x:zone.x,z:zone.z};
  }
  if(haul?.type==='hopper'){
    const hopper=world.structures.find(s=>s.id===haul.structureId&&s.kind==='hopper');
    if(hopper)return {type:'ground',x:hopper.x,z:hopper.z};
  }
  if(pawn?.cooking?.phase==='output'){
    const zone=pawn.cooking.storageId===null?undefined:storageCellById(world,pawn.cooking.storageId);
    if(zone)return {type:'ground',x:zone.x,z:zone.z};
    const cell=current?.cooking?.actionCell??pawn.cooking.actionCell;
    if(cell)return {type:'ground',x:cell.x,z:cell.z};
  }
  return;
}

function atDelivery(pile:MaterialPile,cell:NonNullable<ReturnType<typeof deliveryCell>>):boolean {
  return pile.owner.type===cell.type&&(cell.type==='ground'&&pile.owner.type==='ground'
    ?pile.owner.x===cell.x&&pile.owner.z===cell.z
    :cell.type==='job'&&pile.owner.type==='job'&&pile.owner.jobId===cell.jobId);
}

function pileDirectory(piles:readonly MaterialPile[]):Map<number,MaterialPile> {
  const result=new Map<number,MaterialPile>();
  for(let i=0;i<piles.length;i++){const pile=piles[i]!;result.set(pile.id,pile);}
  return result;
}

/** Snapshot-only visual transfer ledger. Piles remain authoritative and selectable;
 * only the quantity drawn in their resident chunk waits for the cargo to land. */
export class CargoHandoffs {
  readonly active=new Map<number,CargoHandoff>();
  clear():void {this.active.clear();}
  hiddenQuantity(pileId:number):number {
    let amount=0;
    for(const item of this.active.values())if(item.direction==='drop'&&item.targetPileId===pileId)amount+=item.pile.quantity;
    return amount;
  }
  hiddenQuantities():ReadonlyMap<number,number> {
    const result=new Map<number,number>();
    for(const item of this.active.values())if(item.direction==='drop'&&item.targetPileId!==undefined)
      result.set(item.targetPileId,(result.get(item.targetPileId)??0)+item.pile.quantity);
    return result;
  }
  complete(tick:number):boolean {
    let changed=false;
    for(const [id,item] of this.active)if(tick>=item.end){this.active.delete(id);changed||=item.direction==='drop';}
    return changed;
  }
  adopt(previous:World|undefined,world:World,tick:number,animate:boolean,hand:(pawnId:number)=>CargoAnchor|undefined):void {
    if(!previous||!animate){this.clear();return;}
    this.complete(tick);
    if(previous.piles===world.piles&&this.active.size===0)return;
    const oldCarried=new Map<number,MaterialPile>(),nowCarried=new Map<number,MaterialPile>();
    for(let i=0;i<previous.piles.length;i++){const pile=previous.piles[i]!;if(pile.owner.type==='pawn'&&!pile.humanCorpse)oldCarried.set(pile.owner.pawnId,pile);}
    for(let i=0;i<world.piles.length;i++){const pile=world.piles[i]!;if(pile.owner.type==='pawn'&&!pile.humanCorpse)nowCarried.set(pile.owner.pawnId,pile);}
    let currentGround:{surfaces:ReturnType<typeof pileSurfaces>;identities:ReturnType<typeof pileIdentitySurfaces>}|undefined;
    const groundNow=()=>currentGround??={surfaces:pileSurfaces(world),identities:pileIdentitySurfaces(world)};
    let after:Map<number,MaterialPile>|undefined;
    for(const [id,item] of this.active){
      const targetId=item.targetPileId;
      const target=targetId===undefined?undefined:this.active.size===1
        ?world.piles.findLast(pile=>pile.id===targetId)
        :(after??=pileDirectory(world.piles)).get(targetId);
      if(item.direction==='drop'&&(!target||target.owner.type!=='ground'&&target.owner.type!=='job'||
          nowCarried.get(id)?.id!==oldCarried.get(id)?.id&&nowCarried.has(id))||
        item.direction==='pickup'&&nowCarried.get(id)?.id!==item.pile.id||
        item.partial&&oldCarried.get(id)?.id===nowCarried.get(id)?.id&&
          (nowCarried.get(id)?.quantity??Infinity)<(oldCarried.get(id)?.quantity??0)){this.active.delete(id);continue;}
      if(item.direction==='drop'&&target){
        // A lower-ID pile can leave its tier, or the shelf can retire, during
        // this short transfer. Land at the confirmed support instead of its
        // old height; derive supports only while a transfer actually needs them.
        const {surfaces,identities}=groundNow(),to=groundAnchor(world,target,surfaces,identities);
        if(!to){this.active.delete(id);continue;}
        const surface=target.owner.type==='ground'?identities.get(target.id)??surfaces.get(target.owner.z*world.width+target.owner.x):undefined;
        item.to=to;item.groundScale=(surface?.scale??1)*(target.item==='minified-tree'?1:.8);
      }
    }
    let transfer=false;
    for(const [id,old] of oldCarried){
      const current=nowCarried.get(id);
      if(!this.active.has(id)&&(!current||current.id!==old.id||current.quantity<old.quantity)){transfer=true;break;}
    }
    if(!transfer)for(const id of nowCarried.keys()){
      if(!oldCarried.has(id)&&!this.active.has(id)){transfer=true;break;}
    }
    if(!transfer)return;
    // Retain both identity snapshots before invoking the hand-position reader.
    // A publication with no new transfer needs only its carried-pile rows.
    const before=pileDirectory(previous.piles);
    after??=pileDirectory(world.piles);
    const previousSurfaces=pileSurfaces(previous),previousIdentities=pileIdentitySurfaces(previous),{surfaces:currentSurfaces,identities:currentIdentities}=groundNow();
    const claimed=new Map<number,number>();
    for(const [pawnId,pile] of oldCarried){
      if(this.active.has(pawnId))continue;
      const retained=nowCarried.get(pawnId);
      if(retained&&retained.id!==pile.id||retained&&retained.quantity>=pile.quantity)continue;
      const amount=retained?pile.quantity-retained.quantity:pile.quantity;
      if(amount<=0)continue;
      const same=after.get(pile.id);
      let target=!retained&&same&&(same.owner.type==='ground'||same.owner.type==='job')?same:undefined;
      if(!target){
        const cell=deliveryCell(previous,world,pawnId);
        const candidates=cell?world.piles.filter(q=>q.item===pile.item&&atDelivery(q,cell)&&
          q.quantity-(before.get(q.id)?.quantity??0)-(claimed.get(q.id)??0)>=amount):[];
        if(candidates.length===1)target=candidates[0];
      }
      const from=hand(pawnId),to=target&&groundAnchor(world,target,currentSurfaces,currentIdentities);
      if(!from||!to||!target)continue;
      claimed.set(target.id,(claimed.get(target.id)??0)+amount);
      const surface=target.owner.type==='ground'?currentIdentities.get(target.id)??currentSurfaces.get(target.owner.z*world.width+target.owner.x):undefined;
      this.active.set(pawnId,{pawnId,pile:{...pile,quantity:amount},direction:'drop',start:tick,end:tick+CARGO_HANDOFF_TICKS,from,to,
        groundScale:(surface?.scale??1)*(pile.item==='minified-tree'?1:.8),targetPileId:target.id,partial:!!retained});
    }
    for(const [pawnId,pile] of nowCarried){
      if(oldCarried.has(pawnId)||this.active.has(pawnId))continue;
      const oldSame=before.get(pile.id);
      const pawn=world.pawns.find(p=>p.id===pawnId);
      const sourceId=pawn?.haul?.sourcePileId??(pawn?.need?.kind==='eat'?pawn.need.sourcePileId:undefined)
        ??pawn?.animalFeed?.sourcePileId??pawn?.feed?.sourcePileId??pawn?.tend?.medicine?.sourcePileId??pawn?.animalCare?.medicine?.sourcePileId
        ??pawn?.animalHandling?.sourcePileId??(pawn?.ward?.kind==='food'?pawn.ward.sourcePileId:undefined);
      const remembered=previous.piles.find(q=>q.id===sourceId&&q.owner.type==='ground'&&q.item===pile.item);
      const source=oldSame?.owner.type==='ground'?oldSame:remembered;
      const from=source&&groundAnchor(previous,source,previousSurfaces,previousIdentities);
      if(!from)continue;
      const surface=source?.owner.type==='ground'?previousIdentities.get(source.id)??previousSurfaces.get(source.owner.z*previous.width+source.owner.x):undefined;
      this.active.set(pawnId,{pawnId,pile,direction:'pickup',start:tick,end:tick+CARGO_HANDOFF_TICKS,from,
        to:{x:0,y:0,z:0,yaw:0},groundScale:(surface?.scale??1)*(pile.item==='minified-tree'?1:.8)});
    }
  }
}
