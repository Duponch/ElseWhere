import {knownPosition256,knownPile256,knownBuilding256} from './exploration-readers-256';
import {mapObjectExists} from './map-object-selection';
import type { Cell,MaterialPile,World } from '../sim/types';
import type { MapObjectSelection } from './map-object-selection';

/** UI identity survives snapshots and a person's conversion into a physical body. */
export type NotificationTarget =
  | { key:string;kind:'actor';id:number }
  | { key:string;kind:'object';object:MapObjectSelection;cell:Cell }
  | { key:string;kind:'cell';cell:Cell };

/** Each notification owns its cursor. A removed last target advances to the next
 * surviving member of the previous ring before considering newly added targets.
 * `previous` walks the same ring backwards (right click on a Core alert). */
export class NotificationFocusCycle {
  private cursors=new Map<string,{last:string;ring:string[]}>();
  next(key:string,targets:readonly NotificationTarget[]):NotificationTarget|undefined {return this.step(key,targets,1);}
  previous(key:string,targets:readonly NotificationTarget[]):NotificationTarget|undefined {return this.step(key,targets,-1);}
  private step(key:string,targets:readonly NotificationTarget[],direction:1|-1):NotificationTarget|undefined {
    const unique=[...new Map(targets.map(target=>[target.key,target])).values()];
    if(!unique.length)return;
    const cursor=this.cursors.get(key),index=cursor?unique.findIndex(target=>target.key===cursor.last):-1;
    let next=direction>0?unique[0]!:unique.at(-1)!;
    if(index>=0)next=unique[(index+direction+unique.length)%unique.length]!;
    else if(cursor){
      const oldIndex=cursor.ring.indexOf(cursor.last),size=cursor.ring.length;
      for(let offset=1;offset<=size;offset++){
        const successor=cursor.ring[((oldIndex+direction*offset)%size+size)%size];
        const found=unique.find(target=>target.key===successor);
        if(found){next=found;break;}
      }
    }
    this.cursors.set(key,{last:next.key,ring:unique.map(target=>target.key)});return next;
  }
  reset():void {this.cursors.clear();}
}

export const actorNotificationTarget=(id:number):NotificationTarget=>({key:`actor:${id}`,kind:'actor',id});
export const objectNotificationTarget=(kind:MapObjectSelection['kind'],id:number,cell:Cell,key=`${kind}:${id}`):NotificationTarget=>({key,kind:'object',object:{kind,id},cell:{x:cell.x,z:cell.z}});
export const cellNotificationTarget=(key:string,cell:Cell):NotificationTarget=>({key,kind:'cell',cell:{x:cell.x,z:cell.z}});

/** Carried bodies focus their real carrier; buried bodies focus the actual grave.
 * Lost/consumed bodies have no map target, never their old actor coordinates. */
export function pileNotificationTarget(world:World,pile:MaterialPile,key=`pile:${pile.id}`):NotificationTarget|undefined {
  if(!knownPile256(world,pile))return;
  if(pile.owner.type==='ground')return objectNotificationTarget('pile',pile.id,pile.owner,key);
  if(pile.owner.type==='pawn'){const id=pile.owner.pawnId;return world.pawns.some(p=>p.id===id)?{...actorNotificationTarget(id),key}:undefined;}
  if(pile.owner.type==='grave'){
    const graveId=pile.owner.graveId,grave=world.structures.find(s=>s.id===graveId);
    if(grave)return objectNotificationTarget('structure',grave.id,grave,key);
  }
}
export function personNotificationTarget(world:World,id:number):NotificationTarget|undefined {
  const pawn=world.pawns.find(p=>p.id===id);
  if(!pawn){
    const casket=world.structures.find(s=>s.kind==='cryptosleep-casket'&&s.cryptosleep?.human?.id===id
      ||s.kind==='ship-cryptosleep-casket'&&s.shipCryptosleep277?.occupant?.kind==='human'&&s.shipCryptosleep277.occupant.pawn.id===id);
    return casket&&knownBuilding256(world,casket)?objectNotificationTarget('structure',casket.id,casket):undefined;
  }
  if(pawn.state!=='dead')return knownPosition256(world,pawn)?actorNotificationTarget(id):undefined;
  if(pawn.body?.lostAt!==undefined)return;
  const pile=world.piles.find(p=>p.humanCorpse?.pawnId===id);
  if(pile)return pileNotificationTarget(world,pile,`actor:${id}`);
  // A dead actor waiting for a free floor cell is still rendered at its real pose.
  if(pawn.body?.pileId===undefined&&knownPosition256(world,pawn))return actorNotificationTarget(id);
}

export type FocusNotification=(target:NotificationTarget)=>void;

/** Resolve against this accepted map, never stale notification coordinates. */
export function knownNotificationTarget256(world:World,target:NotificationTarget):boolean {
 if(target.kind==='cell')return knownPosition256(world,target.cell);
 if(target.kind==='object')return mapObjectExists(world,target.object);
 const actor=world.pawns.find(p=>p.id===target.id)??world.wildlife?.animals.find(a=>a.id===target.id)??world.mechanoids?.find(m=>m.id===target.id);
 return !!actor&&knownPosition256(world,actor);
}
