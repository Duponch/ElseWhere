import {splicePileEntries} from './pile-identity-directory.ts';
import {mechRaidGroups261} from './mechanical-raid-groups-261.ts';
import {validBombWaveShape} from './bomb-state.ts';
import {validAnimalDeathExplosionOwner256} from './animal-death-provenance-v256.ts';
import { captureHumanOwners } from './human-owners.ts';
import type { World } from './types.ts';

type RecordObject=Record<string,unknown>;
type Patch={original:RecordObject;before:string;after:RecordObject};
const encoded=(value:unknown)=>JSON.stringify(value);
const writableSlot=(o:object,key:PropertyKey)=>{const d=Object.getOwnPropertyDescriptor(o,key);return d?Object.hasOwn(d,'value')&&d.writable===true:Object.isExtensible(o)&&!(key in o);};
const replace=(target:RecordObject,source:RecordObject)=>{
  for(const key of Object.keys(target))if(!Object.hasOwn(source,key))delete target[key];
  Object.assign(target,source);
};

/** True-trigger projection only. Terrain, structures and resources are
 * borrowed read-only; actors, piles and reserved jobs can
 * change under the existing medical/release producers. Original identities
 * are retained at adoption, including carried patients and dropped Things. */
export function spikeTrapImpactProjection(world:World){
  const pairs:{original:RecordObject;draft:RecordObject;before:string}[]=[];
  const clone=<T extends object>(original:T):T=>{
    const draft=structuredClone(original);
    pairs.push({original:original as RecordObject,draft:draft as RecordObject,before:encoded(original)});
    return draft;
  };
  const view:World={...world,pawns:world.pawns.map(clone),piles:world.piles.map(clone),
    jobs:world.jobs.map(j=>j.reservedBy===null?j:clone(j)),packed:world.packed.map(p=>p.owner.type==='pawn'?clone(p):p),events:[...world.events]};
  if(world.wildlife)view.wildlife={...world.wildlife,...world.wildlife.hiveLords?{hiveLords:structuredClone(world.wildlife.hiveLords)}:{},animals:world.wildlife.animals.map(clone)};
  view.structures=world.structures.map(s=>s.caveHive?clone(s):s);
  if(world.mechanoids)view.mechanoids=world.mechanoids.map(clone);
  // Death memories also belong to actual off-map living owners. Never create
  // a synthetic owner or overwrite a trip/container when adopting a memory.
  if(world.scout&&'pawn' in world.scout)view.scout={...world.scout,pawn:clone(world.scout.pawn)};
  if(world.commercialTrip&&'pawn' in world.commercialTrip)view.commercialTrip={...world.commercialTrip,pawn:clone(world.commercialTrip.pawn)};
  if(world.group&&'members' in world.group)view.group={...world.group,members:world.group.members.map(clone)};
  captureHumanOwners(view); // Owner/clock failures happen before any real write.
  if(world.economy)view.economy=structuredClone(world.economy);
  const mechPrimary=world.raids?.mechActive,mechExtras=world.raids?.extraMechActive261,mechOwners=mechRaidGroups261(world);
  const sameMechanicalOwners=()=>world.raids?.mechActive===mechPrimary&&world.raids?.extraMechActive261===mechExtras&&mechRaidGroups261(world).length===mechOwners.length&&mechRaidGroups261(world).every((g,i)=>g===mechOwners[i]);
  if(world.raids)view.raids={...world.raids,...mechPrimary?{mechActive:structuredClone(mechPrimary)}:{},...mechExtras!==undefined?{extraMechActive261:structuredClone(mechExtras)}:{}};
  const roots=['pawns','piles','jobs','packed','wildlife','mechanoids','structures','resources','tiles','events','economy','raids','destroyed','scout','commercialTrip','group','bombWaves','thermal'] as const;
  const refs=roots.map(key=>[key,world[key]] as const);
  const nextId=world.nextId,schemaVersion=world.schemaVersion;
  const collections=[world.pawns,world.piles,world.jobs,world.packed,world.wildlife?.animals,world.mechanoids,
    world.group&&'members' in world.group?world.group.members:undefined];
  const identities=collections.map(a=>a?[...a]:undefined);
  // Capacity/claims may be read on every nearby cell during involuntary drops.
  // Keep snapshots of those dependencies without cloning the map geometry.
  const dependencies=[world.pawns,world.piles,world.jobs,world.packed,world.wildlife?.animals,world.mechanoids,
    world.economy,world.raids?.mechActive,world.raids?.extraMechActive261,world.raids?.active,world.raids?.extraActive261,world.destroyed,world.bombWaves,world.thermal,world.wildlife?.hiveLords];
  const before=dependencies.map(encoded);
  return {view,finish:()=>{
    const patches:Patch[]=pairs.filter(p=>encoded(p.draft)!==p.before).map(p=>({...p,after:p.draft}));
    const originalIds=new Set(world.piles.map(p=>p.id)),draftIds=new Set(view.piles.map(p=>p.id));
    const removedPiles=world.piles.filter(p=>!draftIds.has(p.id));
    // Only a true new256 clinical animal death may allocate a Flame wave.
    // No new pile/job/person is accepted by this retained impact transaction.
    const priorWaves=world.bombWaves??[],draftWaves=view.bombWaves??[],newWaves=draftWaves.slice(priorWaves.length);
    if(view.piles.some(p=>!originalIds.has(p.id))||priorWaves.some((wave,index)=>draftWaves[index]!==wave)
      ||view.nextId!==world.nextId+newWaves.length||newWaves.some((wave,index)=>world.schemaVersion<256||wave.id!==world.nextId+index||!wave.animalDeath||!validBombWaveShape(wave,world.schemaVersion)||!validAnimalDeathExplosionOwner256(view,wave)))throw new RangeError('Spike impact allocated an unauthorised Thing');
    const wavesChanged=newWaves.length>0,thermalChanged=encoded(view.thermal)!==encoded(world.thermal);
    const hiveLordsChanged=encoded(view.wildlife?.hiveLords)!==encoded(world.wildlife?.hiveLords);
    const eventsChanged=encoded(view.events)!==encoded(world.events);
    const economyChanged=encoded(view.economy)!==encoded(world.economy);
    const groupChanged=encoded(view.raids?.mechActive)!==encoded(world.raids?.mechActive);
    const extraMechChanged=encoded(view.raids?.extraMechActive261)!==encoded(world.raids?.extraMechActive261);
    const humanLordChanged=encoded(view.raids?.active)!==encoded(world.raids?.active);
    const extraLordsChanged=encoded(view.raids?.extraActive261)!==encoded(world.raids?.extraActive261);
    const destroyedChanged=encoded(view.destroyed)!==encoded(world.destroyed);
    let used=false;
    return {adopt:()=>{
      if(used||world.nextId!==nextId||world.schemaVersion!==schemaVersion||refs.some(([key,ref])=>world[key]!==ref)||!sameMechanicalOwners()
        ||world.raids&&(groupChanged&&!writableSlot(world.raids,'mechActive')||extraMechChanged&&!writableSlot(world.raids,'extraMechActive261'))
        ||collections.some((a,i)=>a&&(a.length!==identities[i]!.length||a.some((item,n)=>item!==identities[i]![n])))
        ||dependencies.some((d,i)=>encoded(d)!==before[i])
        ||patches.some(p=>encoded(p.original)!==p.before))return false;
      used=true;
      for(const p of patches)replace(p.original,p.after);
      for(const p of removedPiles){const i=world.piles.indexOf(p);if(i>=0)splicePileEntries(world.piles,i,1);}
      if(hiveLordsChanged&&world.wildlife)world.wildlife.hiveLords=view.wildlife?.hiveLords;
      if(eventsChanged)world.events.splice(0,world.events.length,...view.events);
      if(economyChanged)world.economy=view.economy;
      if(groupChanged&&world.raids)world.raids.mechActive=view.raids?.mechActive;
      if(extraMechChanged&&world.raids)world.raids.extraMechActive261=view.raids?.extraMechActive261;
      if(humanLordChanged&&world.raids)world.raids.active=view.raids?.active;
      if(extraLordsChanged&&world.raids)world.raids.extraActive261=view.raids?.extraActive261;
      if(destroyedChanged)world.destroyed=view.destroyed;
      if(wavesChanged){world.bombWaves=view.bombWaves;world.nextId=view.nextId;}
      if(thermalChanged){if(view.thermal)world.thermal=view.thermal;else delete world.thermal;}
      return true;
    }};
  }};
}
