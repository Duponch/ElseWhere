import {revokeActorRecordSource297} from './actor-record-source-297.ts';
import {isSchema286OrLater} from './schema-compatibility-257.ts';
import {prepareLinkedStorageRemoval286} from './linked-storage-plan-286.ts';
import {isShelfKind} from './shelf-storage.ts';
import {registeredCampaign} from './world-map-context.ts';
import {removalWritesMutable259,removalWritesApplied259,sealRemovalOriginal259} from './map-removal-writes-259.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import type {Structure,World} from './types.ts';

export interface LinkedCasketVanish286 {
 current():boolean;
 /** Consumed with the parent's original JSON/clock checks before any write. */
 begin():void;
 /** Policy-only phase after the parent's admitted suspension/custody writes. */
 commit():void;
}
export type LinkedCasketVanishResult286={ok:false;reason:string}|{ok:true;plan:LinkedCasketVanish286};

/** Destruction of held possessions only. Ejection, holder death, travel and
 * MapRemoved retention do not enter this path. No effective policy changes. */
export function prepareLinkedCasketVanish286(world:World,casket:Structure,key:'cryptosleep'|'shipCryptosleep277',packs:readonly PackedFurniture[]):LinkedCasketVanishResult286 {
 const no=(reason:string):LinkedCasketVanishResult286=>({ok:false,reason});
 try{
  const linked=packs.filter(p=>isShelfKind(p.building.kind)&&p.building.shelf?.linked286);
  if(!isSchema286OrLater(world.schemaVersion)||!linked.length){let begun=false,done=false;return {ok:true,plan:{current:()=>!begun&&!done,begin(){if(begun||done)throw Error('Repeated empty casket storage phase');begun=true;},commit(){if(!begun||done)throw Error('Unadmitted empty casket storage phase');done=true;}}};}
  const root=registeredCampaign(world),tick=world.tick,holderField=Object.getOwnPropertyDescriptor(casket,key);
  if(!holderField||!Object.hasOwn(holderField,'value')||holderField.enumerable!==true||holderField.writable!==true)return no('Le détenteur du caisson ne peut pas être remplacé.');
  const holder=holderField.value,packedField=holder&&typeof holder==='object'?Object.getOwnPropertyDescriptor(holder,'packed'):undefined;
  if(!packedField||!Object.hasOwn(packedField,'value')||packedField.value!==packs)return no('Les meubles doivent appartenir au véritable caisson détruit.');
  const removal=prepareLinkedStorageRemoval286(root,linked.map(p=>p.building.id));if(!removal.ok)return removal;
  if(removal.changedCellIds.length)return no('La destruction ne peut pas changer les réglages effectifs du stockage.');
  const writes=removal.writes.map(w=>Object.freeze({...w})),rootField=Object.getOwnPropertyDescriptor(root,'linkedStorage286');
  // A future plan must not smuggle hauling/settings writes into this phase.
  if(writes.some(w=>w.object===root?w.key!=='linkedStorage286':w.key!=='linked286'||w.present))return no('La destruction du caisson doit retirer seulement les liens concernés.');
  const bounded={registry:root.linkedStorage286,states:writes.filter(w=>w.object!==root).map(w=>w.object),desired:writes.map(w=>w.value)},seal=sealRemovalOriginal259(bounded,[],writes);
  const holderCurrent=()=>{const now=Object.getOwnPropertyDescriptor(casket,key),packed=Object.getOwnPropertyDescriptor(holder,'packed');return !!now&&Object.hasOwn(now,'value')&&now.value===holder&&now.enumerable===holderField.enumerable&&now.writable===true&&now.configurable===holderField.configurable&&!!packed&&Object.hasOwn(packed,'value')&&packed.value===packs;};
  const rootCurrent=()=>{const now=Object.getOwnPropertyDescriptor(root,'linkedStorage286');return rootField?!!now&&Object.hasOwn(now,'value')&&now.value===rootField.value&&now.enumerable===rootField.enumerable&&now.writable===rootField.writable&&now.configurable===rootField.configurable:!now;};
  const sameContext=()=>registeredCampaign(world)===root&&world.tick===tick&&root.tick===tick&&isSchema286OrLater(root.schemaVersion);
  let begun=false,done=false;
  const current=()=>!begun&&!done&&sameContext()&&world.structures.includes(casket)&&holderCurrent()&&rootCurrent()&&removal.current()&&seal(0)&&removalWritesMutable259(writes);
  if(!current())return no('Les propriétaires des étagères du caisson ont changé.');
  return {ok:true,plan:{current,
   begin(){if(!current())throw Error('Stale casket linked-storage admission');begun=true;},
   commit(){
    // The casket may already have left structures and its original actor and
    // possessions may have resumed their clocks. Only the declared policy
    // leaves/registry remain under this bounded phase seal, not the old full
    // casket JSON. The parent checked that original JSON before begin().
    if(!begun||done||!sameContext()||!holderCurrent()||!rootCurrent()||!seal(0)||!removalWritesMutable259(writes))throw Error('Stale admitted casket storage recipients');
    for(const w of writes){revokeActorRecordSource297(w.object);if(w.present){if(Object.hasOwn(w.object,w.key)){if(!Reflect.set(w.object,w.key,w.value))throw Error('Admitted casket storage write failed');}else Object.defineProperty(w.object,w.key,{value:w.value,writable:true,enumerable:true,configurable:true});}else if(!Reflect.deleteProperty(w.object,w.key))throw Error('Admitted casket storage deletion failed');}
    done=true;if(!seal(2)||!removalWritesApplied259(writes))throw Error('Unexpected casket storage retirement result');
   },
  }};
 }catch(error){return no(error instanceof Error?error.message:String(error));}
}
