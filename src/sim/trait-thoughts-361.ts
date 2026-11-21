import {isGroundSleepingSpotKind} from './bed-kinds.ts';
import { isColonist } from './affiliation.ts';
import { APPAREL,type ApparelItem } from './apparel-rules.ts';
import { isBedKind } from './bed-kinds.ts';
import { BODY_PARTS } from './body-definition.ts';
import { calendarTick } from './calendar.ts';
import { equippedWeapon,isRangedWeaponItem } from './equipment-rules.ts';
import { captureRoomQuality,type RoomQualityCapture } from './room-quality.ts';
import { hourOfDay } from './schedule.ts';
import { artificialPartCount361 } from './traits.ts';
import { undergrounderThoughts362 } from './indoors-need-362.ts';
import type { MaterialPile,Pawn,World } from './types.ts';

/** Schema 361: the Core trait thoughts (Thoughts_Situation_Traits) and the
 * thoughts Core nullifies by trait (ThoughtDef.nullifyingTraits). Every
 * number below comes from Core ThoughtDefs and ThoughtWorkers. Only people
 * holding a 361 trait are concerned, so no older save reads any of it. */
interface TraitThought {readonly id:string;readonly label:string;readonly offset:number;readonly kind:'situation'|'memory';readonly description:string;readonly expiresAt?:number}
const situation=(id:string,label:string,offset:number,description:string):TraitThought=>Object.freeze({id,label,offset,kind:'situation',description});

/** Core nullifyingTraits, mapped to this game's thought ids (memories are
 * filtered when read: a trait never changes once born). */
const PSYCHOPATH_NULLIFIED=[/^death-witnessed-(ally|outsider|family)-death$/,/^death-colonist-died$/,/^death-observed-corpse$/,/^death-colonist-unburied$/,
  /^friend-died-/,/^lost-colonist-lost-/,/^lost-friend-lost-/,/^mood350-(nuzzled|released-prisoner|bonded-animal-died|bonded-animal-lost)$/,
  /^(not-)?bonded-animal-master$/,/^denied-joining$/];
const CANNIBAL_NULLIFIED=[/^death-observed-corpse$/];
/** EnvironmentDark nullifyingTraits: NightOwl and (schema 362) Undergrounder. */
const NIGHT_OWL_NULLIFIED=[/^environment-dark$/];
const ASCETIC_NULLIFIED=[/^ate-without-table$/];
const PAIN_IDS=['minor-pain','serious-pain','intense-pain','extreme-pain'];
const MASOCHIST=[situation('masochist-minor-pain','Masochiste : douleur légère',5,'Une douleur sous 15 % réjouit ce masochiste.'),situation('masochist-serious-pain','Masochiste : douleur importante',10,'Une douleur d’au moins 15 % réjouit ce masochiste.'),
  situation('masochist-intense-pain','Masochiste : douleur intense',15,'Une douleur d’au moins 40 % réjouit ce masochiste.'),situation('masochist-extreme-pain','Masochiste : douleur extrême',20,'Une douleur d’au moins 80 % comble ce masochiste.')];
const nullified=(pawn:Pawn,id:string):boolean=>{
  const t=pawn.traits!;
  return t.includes('psychopath')&&PSYCHOPATH_NULLIFIED.some(r=>r.test(id))||t.includes('cannibal')&&CANNIBAL_NULLIFIED.some(r=>r.test(id))
    ||(t.includes('night-owl')||t.includes('undergrounder'))&&NIGHT_OWL_NULLIFIED.some(r=>r.test(id))||t.includes('ascetic')&&ASCETIC_NULLIFIED.some(r=>r.test(id));
};

/** ThoughtWorker_NudistNude: nude unless an apparel covers the torso or the legs. */
export function nudeForNudist361(pawn:Pawn,items:readonly MaterialPile[]):boolean {
  for(const pile of items)if(pile.owner.type==='apparel'&&pile.owner.pawnId===pawn.id){
    const def=APPAREL[pile.item as ApparelItem];
    if(def?.coverage.parts.some(part=>BODY_PARTS[part].groups.some(g=>g==='torso'||g==='legs')))return false;
  }
  return true;
}
const BODY_MODDER=[[4,'Transhumaniste satisfait'],[7,'Transhumaniste content'],[9,'Transhumaniste ravi'],[11,'Transhumaniste enchanté'],[12,'Transhumaniste comblé'],[13,'Corps machine accompli']] as const;
const BODY_PURIST=[[-10,'Puriste mal à l’aise'],[-15,'Puriste dégoûté'],[-20,'Puriste violé dans sa chair'],[-25,'Puriste horrifié'],[-30,'Puriste en plein cauchemar'],[-35,'Puriste devenu ce qu’il hait']] as const;

/** The map-only trait thoughts (not validWhileDespawned in Core): night owl,
 * Greedy, Jealous, Ascetic. The equipped weapon is read here for Brawler. */
export interface TraitMapThoughts361 {thoughts:readonly TraitThought[];rangedWeapon:boolean}
export function traitMapThoughts361(world:World,pawn:Pawn):TraitMapThoughts361 {
  const t=pawn.traits??[],thoughts:TraitThought[]=[];
  const awake=pawn.state!=='sleeping'&&!pawn.medicalSleep;
  if(t.includes('night-owl')&&awake){
    const hour=hourOfDay(calendarTick(world));
    if(hour>=23||hour<=5)thoughts.push(situation('night-owl-night','Oiseau de nuit : la nuit',16,'Éveillé entre 23 h et 5 h, l’heure que préfère cet oiseau de nuit.'));
    else if(hour>=11&&hour<=17)thoughts.push(situation('night-owl-day','Oiseau de nuit : le jour',-10,'Éveillé entre 11 h et 17 h : cet oiseau de nuit souffre de la journée.'));
  }
  if(isColonist(pawn)&&!pawn.prisoner&&(t.includes('greedy')||t.includes('jealous')||t.includes('ascetic'))){
    const capture=captureRoomQuality(world),own=ownedRoom361(world,pawn,capture);
    if(t.includes('greedy')){
      // Stages [no room, awful, dull, mediocre, decent]: -8, -8, -8, -6, -4.
      const offset=own?[-8,-8,-6,-4][own.stage]:-8;
      if(offset!==undefined)thoughts.push(situation('greedy','Avide : chambre peu impressionnante',offset,own?'Cette chambre n’est pas à la hauteur de ses envies.':'N’a pas de chambre à lui.'));
    }
    if(t.includes('ascetic')&&own){
      const offset=own.stage<=2?[5,4,3][own.stage]!:own.stage>=5?-5:undefined;
      if(offset!==undefined)thoughts.push(situation('ascetic',offset>0?'Ascète : chambre austère':'Ascète : chambre impressionnante',offset,offset>0?'Une chambre dépouillée convient à cet ascète.':'Tant de confort gêne cet ascète.'));
    }
    if(t.includes('jealous')){
      const mine=own?.impressiveness??0;let best:{name:string;value:number}|undefined;
      for(const other of world.pawns)if(other!==pawn&&isColonist(other)&&!other.prisoner&&!other.visitor&&other.state!=='dead'){
        const room=ownedRoom361(world,other,capture);
        if(room&&room.id!==own?.id&&room.impressiveness-mine>=Math.abs(mine*.1)&&(!best||room.impressiveness>best.value))best={name:other.name,value:room.impressiveness};
      }
      if(best)thoughts.push(situation('jealous',`Jaloux de la chambre de ${best.name}`,-8,'Un autre colon a une chambre nettement plus impressionnante que la sienne.'));
    }
  }
  // Schema 362: the undergrounder's indoors need and trait thoughts (indoors-need-362).
  if(t.includes('undergrounder'))thoughts.push(...undergrounderThoughts362(world,pawn));
  const weapon=t.includes('brawler')?equippedWeapon(world,pawn):undefined;
  return {thoughts,rangedWeapon:!!weapon&&isRangedWeaponItem(weapon.item)};
}
/** Pawn_Ownership.OwnedRoom: the room of the person's own (non-medical,
 * non-prison) bed, when that room is a bedroom (one bed) with statistics. */
export function ownedRoom361(world:World,pawn:Pawn,capture:RoomQualityCapture=captureRoomQuality(world)):{id:number;stage:number;impressiveness:number}|undefined {
  if(pawn.bedId===null||pawn.bedId===undefined)return;
  const bed=world.structures.find(s=>s.id===pawn.bedId&&isBedKind(s.kind));
  if(!bed||bed.medical||bed.prisoner||isGroundSleepingSpotKind(bed.kind))return;
  const room=capture.room({x:bed.x,z:bed.z});
  return room&&room.beds===1?room:undefined;
}
export interface TraitMoodContext361 {items:readonly MaterialPile[];map361?:TraitMapThoughts361;despawned?:boolean}
/** Applied by personalMoodThoughts to a holder of a 361 trait: the trait
 * nullifications, then the trait thoughts valid off the map too. */
export function traitMoodThoughts361<T extends TraitThought>(pawn:Pawn,thoughts:readonly T[],c:TraitMoodContext361):(T|TraitThought)[] {
  const t=pawn.traits??[];
  let out:(T|TraitThought)[]=thoughts.filter(thought=>!nullified(pawn,thought.id));
  if(t.includes('masochist'))out=out.map(thought=>{const i=PAIN_IDS.indexOf(thought.id);return i<0?thought:MASOCHIST[i]!;});
  if(c.map361&&!c.despawned)out.push(...c.map361.thoughts);
  if(t.includes('nudist'))out.push(nudeForNudist361(pawn,c.items)?situation('nudist-nude','Heureux d’être nu',20,'Aucun vêtement ne couvre son torse ni ses jambes.'):situation('nudist-clothed','Vêtements contraignants',-3,'Un vêtement couvre son torse ou ses jambes.'));
  if(t.includes('brawler')&&(c.map361?c.map361.rangedWeapon:c.items.some(p=>p.owner.type==='equipment'&&p.owner.pawnId===pawn.id&&isRangedWeaponItem(p.item))))
    out.push(situation('brawler-ranged','Bagarreur armé à distance',-10,'Ce bagarreur porte une arme à distance.'));
  const parts=artificialPartCount361(pawn);
  if(t.includes('body-modder'))out.push(parts?(([offset,label])=>situation('body-modder',label,offset,`${parts} partie${parts>1?'s':''} artificielle${parts>1?'s':''}.`))(BODY_MODDER[Math.min(parts,6)-1]!):situation('body-modder-frustrated','Transhumaniste frustré',-4,'Aucune partie artificielle.'));
  if(t.includes('body-purist')&&parts)out.push((([offset,label])=>situation('body-purist',label,offset,`${parts} partie${parts>1?'s':''} artificielle${parts>1?'s':''} dans son propre corps.`))(BODY_PURIST[Math.min(parts,6)-1]!));
  return out;
}
