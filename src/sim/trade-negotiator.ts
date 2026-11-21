import { isColonist } from './affiliation.ts';
import { backgroundSkillRefusal } from './colonist-backgrounds.ts';
import { medicalWorkRefusal,pawnBody } from './health-rules.ts';
import { biologicalYears } from './human-age.ts';
import { effectiveSkillLevel } from './work-types.ts';
import type { Pawn } from './types.ts';
/** Schema 338: Core FloatMenuOptionProvider_Trade and the comms console's
 * float menu (FloatMenuOptionProvider_FromThing) both admit a drafted pawn.
 * Pawn-to-pawn and caravan trade have no talking/hearing refusal: the stat
 * TradePriceImprovement only weighs both capacities. The comms console alone
 * needs CapableOf(Talking), a talking level above zero (minForCapable 0). */
export const NEGOTIATOR_SCHEMA_338=338;
export type NegotiatorChannel338='pawn'|'comms';
/** An omitted version keeps the historical refusal. */
export function negotiatorRefusal(p:Pawn,version:number=0,channel:NegotiatorChannel338='pawn'):string|undefined {
  if(!isColonist(p)||p.prisoner)return 'Choisissez un colon libre.';
  const background=backgroundSkillRefusal(p,'social');if(background)return background;
  const medical=medicalWorkRefusal(p);if(medical)return medical;
  const current=version>=NEGOTIATOR_SCHEMA_338;
  if(!current&&p.draft||p.melee?.strike||p.shooting?.stance||p.mental?.crisis||p.collapsePending||p.interruptedCargo||p.burning)return current?'Le négociateur doit être disponible.':'Le négociateur doit être disponible et démobilisé.';
  const c=pawnBody(p).capacities;
  if(!current){if(c.talking<=0||c.hearing<=0)return 'Le négociateur doit pouvoir parler et entendre.';}
  else if(channel==='comms'&&c.talking<=0)return 'Le négociateur doit pouvoir parler pour utiliser la console.';
}
/** `offset` (schema 360): an inspired trade's TradePriceImprovement +0.18,
 * added before the stat's 0.395 cap. */
export function tradeImprovement(p:Pawn,offset=0):number {
  const c=pawnBody(p).capacities;
  return Math.min(.395,Math.max(0,.015*effectiveSkillLevel(p,'social',p.skills.social?.level??0)*(.1+.9*Math.min(1,c.talking/.95))*(.1+.9*Math.min(1,c.hearing/.8))+offset));
}

/** V193 corpus: active adult owner, conscious, non-down/non-crisis, Social capable,
 * best TradePriceImprovement. Equal stats retain the local persisted owner order.
 * Civilian site permission is a separate real channel admission, not a fake Pawn.
 * Schema 338 (`version`): no talking/hearing refusal, as Core's
 * BestCaravanPawnUtility.FindBestNegotiator. */
export function bestGroupNegotiator(members:readonly Pawn[],version:number=0):Pawn|undefined {
  let best:Pawn|undefined,score=-1;
  for(const person of members){
    if(!isColonist(person)||person.prisoner||person.visitor||person.raid||person.podRescue||person.state==='dead'||person.state==='downed'||person.state==='sleeping'||person.health?.death||person.age&&biologicalYears(person.age)<18||!pawnBody(person).canBeAwake||negotiatorRefusal(person,version))continue;
    const value=tradeImprovement(person);
    if(value>score){best=person;score=value;}
  }
  return best;
}
