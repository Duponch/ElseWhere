import {FireContent} from './fire-content.ts';
import {groundFire} from './fire-rules.ts';
import {captureRoomQuality} from './room-quality.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {structureAnchors,structureById} from './structure-navigation.ts';
import {carrierOf} from './rescue-state.ts';
import {footprintCells} from './definitions.ts';
import type {Pawn,World} from './types.ts';

/* Schema 368: the Pyromaniac's situational thought (Thoughts_Situation_Traits.xml
 * PyromaniacNearFire, ThoughtWorker_PyromaniacNearFlames, FireUtility.
 * NumFiresAt and IsBurning). The two other Pyromaniac thoughts need an
 * incendiary weapon, which this game does not have (pyromaniac-368). Kept
 * apart from the spree: the mood readers never import the fire producers. */

/** ThoughtWorker_PyromaniacNearFlames (PyromaniacNearFire, +2 per fire,
 * stackLimit 4, MoodMultiplier the count): the cells within 8 of the pawn,
 * not fogged, in its own room, each counting FireUtility.NumFiresAt (every
 * burning thing there, the static fire included, and a lit campfire or
 * torch). Not valid while despawned (carried, in a caravan, suspended). */
export function pyromaniacFiresNear368(w:World,p:Pawn):number {
  if(p.cryptosleepHeldAt271!==undefined||p.shipCryptosleepHeldAt277!==undefined||carrierOf(w,p.id))return 0;
  const at=p.motion&&p.motion.end>w.tick?p.motion.from:p,width=w.width;
  const topology=captureRoomQuality(w).topology,start=at.z*width+at.x,room=topology.labelAt(start);
  if(room===undefined||room===-1)return 0;
  const fires=w.fires?.items??[],statics=new Map<number,number>(),attached=new Map<number,number>();
  for(const f of fires){
    if(groundFire(f)){const i=f.z*width+f.x;statics.set(i,(statics.get(i)??0)+1);continue;}
    const holder=f.attachedPawnId!==undefined?w.pawns.find(q=>q.id===f.attachedPawnId):w.wildlife?.animals.find(a=>a.id===f.attachedAnimalId);
    if(holder){const i=holder.z*width+holder.x;attached.set(i,(attached.get(i)??0)+1);}
  }
  // Things at a static fire, and the other cells of a burning larger building.
  let content:FireContent|undefined,filth:Map<number,number>|undefined;const spread=new Map<number,number>();
  if(statics.size){
    content=new FireContent(w);filth=new Map();
    for(const f of w.filth?.items??[]){const i=f.z*width+f.x;if(statics.has(i))filth.set(i,(filth.get(i)??0)+1);}
    const seen=new Set<object>();
    // A built building only: an item (a minified one) has a single cell.
    for(const i of statics.keys())for(const t of content.allTargets({x:i%width,z:Math.floor(i/width)}))if(t.kind==='structure'&&!seen.has(t.value)&&structureById(w,t.value.id)===t.value){
      seen.add(t.value);
      for(const c of footprintCells(t.value)){const j=c.z*width+c.x;if(!statics.has(j))spread.set(j,(spread.get(j)??0)+1);}
    }
  }
  const anchors=structureAnchors(w);let count=0;
  for(let dz=-8;dz<=8;dz++)for(let dx=-8;dx<=8;dx++){
    const x=at.x+dx,z=at.z+dz;
    if(dx*dx+dz*dz>64||x<0||z<0||x>=width||z>=w.height)continue;
    const i=z*width+x;
    if(room===-2?i!==start:topology.labelAt(i)!==room)continue;
    if(foggedCell256(w,i))continue;
    const fire=statics.get(i)??0,burning=attached.get(i)??0;
    // The static fire itself, every thing standing in it, the attached fires
    // there (a static fire is in their cell), the burning pawns and animals.
    if(fire)count+=fire+content!.allTargets({x,z}).length+(filth!.get(i)??0)+burning;
    count+=burning+(spread.get(i)??0);
    for(const s of anchors.anchoredAt(x,z))if((s.kind==='campfire'||s.kind==='torch-lamp')&&s.fuel?.ticks)count++;
    if(count>=4)return 4;
  }
  return count;
}
export interface PyromaniacThought368 {readonly id:string;readonly label:string;readonly offset:number;readonly kind:'situation';readonly description:string}
export function pyromaniacNearFireThought368(w:World,p:Pawn):PyromaniacThought368|undefined {
  if(!p.traits?.includes('pyromaniac'))return;
  const n=pyromaniacFiresNear368(w,p);if(!n)return;
  return {id:'pyromaniac-near-fire',label:n===1?'Beau feu':`Beau feu ×${n}`,offset:2*n,kind:'situation',description:'Les flammes toutes proches, dans la même pièce, enchantent ce pyromane : +2 par feu, au plus quatre.'};
}
