import {hasPartyMemoryField292} from './party-memories-292.ts';
import {isSchema299OrLater} from './schema-compatibility-257.ts';
import {validCouplePawnContext285} from './couple-save-285.ts';
import {hasCoupleFields285} from './couple-owner-save-285.ts';
import {isSchema271OrLater} from './schema-compatibility-257.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {hostedCaptive259} from './group-human-admission-259.ts';
import {validWorldAffiliationForeignKeys259} from './world-affiliation-259.ts';
import {validateGroupPackedComponents258} from './group-packed-components-258.ts';
import {regularGroupFreightItem258,validLoadedGroupFreight258} from './group-freight-contract-258.ts';
import {validGroupAdmission257,validGroupHumanPreparation257} from './group-human-admission-257.ts';
import {validToxicBuildupTransport256} from './toxic-buildup-save-256.ts';
import {validGroupAnimalPreparation256,validGroupAnimalOwners256} from './group-animal-save-256.ts';
import {groupPhysicalPawns256} from './group-mixed-pawns-256.ts';
import {validGroupCaravanCarryPawnField256} from './group-caravan-carry-256.ts';
import {validCaravanBedrollPacks256} from './group-bedroll-capture-256.ts';
import {validPreparingGroupPacked256} from './group-packed-save-256.ts';
import {planetTile,planetTileCount} from './planet-geography-256.ts';
import {groupDestinationValid} from './group-capture.ts';
import {groupCaravanPileMass256} from './group-caravan-mass-256.ts';
import {validProspectiveGroupSegment256} from './group-route-interval-256.ts';
import {validPawnMapAreaBindings,mapAreaReferences} from './pawn-map-areas.ts';
import type {GroupMemberOrigin} from './group-reorganization-state.ts';
import {validGroupTravel,validGroupReorganization,validGroupMemberOrigin,groupReorganizationBalance} from './group-reorganization-save.ts';
import {groupMemberOriginAuthority,groupPersonValidationView} from './group-member-origin.ts';
import {boundWorldGroup,groupOriginMapTile,projectionAllowsFilth,registeredCampaign} from './world-map-context.ts';
import {GROUP_FREIGHT_SCHEMA,groupItemMassGrams} from './group-freight.ts';
import {validGroupFreightShape} from './group-freight-save.ts';
/** Raw owner/phase guard. No projected World, registration or mutation. */
import {validGroupProvisionsShape} from './group-provisions-save.ts';
import type { GroupState } from './group-state.ts';
import { GROUP_MAX_MEMBERS,GROUP_MAX_LOSSES } from './group-state.ts';
import type { MaterialPile,Pawn,World } from './types.ts';
import { validatePawnRecordShape,validateAwayPawnRecordShape } from './pawn-record-save.ts';
import { validatePileRecordShape } from './material-record-save.ts';
import { validateRecreationRecordShape } from './recreation-save.ts';
import { validateHumanSocial } from './social-save.ts';
import { validHumanBereavement } from './bereavement-save.ts';
import { validMentalShape } from './mental-save.ts';
import { captureHumanOwners } from './human-owners.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { medicalStatus } from './injury-state.ts';
import { pawnBody } from './health-rules.ts';
import { isColonist } from './affiliation.ts';
import { validPlanetRoute } from './planet-navigation.ts';
import type { PlanetState } from './planet-state.ts';
import { validatePlanet } from './planet-save.ts';
import { validatedPlanetFor,type PlanetValidationContext } from './planet-validation-context.ts';
import { validSchedule } from './schedule.ts';
import { APPAREL_POLICY_INTERVAL } from './apparel-renewal.ts';
import { validFilthFeet } from './filth-save.ts';
import { pileMaxHp } from './thing-damage-rules.ts';
import { validAnesthetic } from './anesthetic.ts';
import { conflictsWith,isApparelItem } from './apparel-rules.ts';
import { isPerishable,ROT_DAYS,ticksUntilRot } from './food-preservation.ts';
import { TICKS_PER_DAY } from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>{
  const actual=Reflect.ownKeys(v);return required.every(k=>Object.hasOwn(v,k))&&actual.every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k)));
};
const dense=(v:unknown,min:number,max:number):v is unknown[]=>{
  if(!Array.isArray(v)||v.length<min||v.length>max)return false;
  const actual=Reflect.ownKeys(v);return actual.length===v.length+1&&actual.every(k=>k==='length'||typeof k==='string'&&int(Number(k),0,v.length-1)&&String(Number(k))===k);
};
const unique=(v:readonly unknown[])=>new Set(v).size===v.length;
const oneOf=(v:unknown,allowed:readonly string[]):v is string=>typeof v==='string'&&allowed.includes(v);
const LEDGER=['foodLoaded','foodConsumed','medicineUsed','silverLoaded','silverPaid','silverEarned','cargoLoaded','sold','bought'];
const BASELINE=['food','silver','cargo','medicine','component'];
const COMMON=['id','startedAt','destination','ledger','phase'];
const PREPARING=['memberIds','rendezvous','meeting','manifest','cursor','exits'];
const AWAY=['members','items','departedAt','lastPersonalTick','baseline','entry','tile','route','segment','paused','stop'];
const PASSIVE_PAWN=['partyMemories292','coupleClock285','coupleMemories285','age','appearance','roomMemories','filthFeet','recruitment','social','bereavement','familyBereavement','romanceMemories','deathThoughts',
  'traits','background','mental','faction','hostilityResponse','careDisabled','medicalCare','selfTend','health','apparelPolicyId',
  'apparelAutomation','nextApparelCheckAt','deniedJoining','originQuestId','podRescue','motion',
  'lastAttack','meleeThreat','disturbance','droppedWeaponId','allowedAreaId'];
const REQUIRED_PAWN=['id','name','x','z','skills','orders','recreation','foodPolicyId','schedule','restZeroTicks','collapsePending',
  'hunger','rest','mood','comfort','beauty','memories','jobId','haul','cooking','need','bedId','needCooldown','state','priorities','path','moveCooldown','planCooldown'];
const PILE_KEYS=['id','kind','item','quantity','owner'];
const PILE_OPTIONAL=['foodPoison','damage','apparel','weapon','rot'];
const pair=(v:unknown,a:string,b:string)=>object(v)&&keys(v,[a,b])&&int(v[a])&&int(v[b]);
function ledger(v:unknown):boolean {
  return object(v)&&keys(v,LEDGER)&&LEDGER.filter(k=>!['cargoLoaded','sold','bought'].includes(k)).every(k=>int(v[k]))
    &&pair(v.cargoLoaded,'cloth','muffalo-wool')&&pair(v.sold,'cloth','muffalo-wool')&&pair(v.bought,'medicine','component');
}
function baseline(v:unknown,provisioned=false,freighted=false):boolean {
  return object(v)&&keys(v,[...BASELINE,...provisioned?['pemmican']:[],...freighted?['freight']:[]])&&(!freighted||pair(v.freight,'wood','steel'))&&(!provisioned||int(v.pemmican))&&['food','silver','medicine','component'].every(k=>int(v[k]))&&pair(v.cargo,'cloth','muffalo-wool');
}
const total=(values:readonly number[]):number|undefined=>{let n=0;for(const value of values){n+=value;if(!Number.isSafeInteger(n))return undefined;}return n;};

export function validateGroupState(world:World,version:number):string[] {
  const raw=world as unknown as Record<string,unknown>;
  if(version<=195)return ['group','groupLosses'].some(k=>Object.hasOwn(raw,k))?['Future group owner in historical schema.']:[];
  if(raw.group===undefined&&raw.groupLosses===undefined)return [];
  if(!int(world.tick)||!int(world.nextId,1)||validatePlanet(raw.planet,world,version).length||raw.planet===undefined)return ['Invalid group planet authority.'];
  return validateGroupOwners(world,version,world.planet!);
}
/** Composition uses a real validated context, checked again by raw values.
 * No bool can bypass geography; the standalone wrapper remains complete. */
export function validateGroupStateWithPlanet(world:World,version:number,context:PlanetValidationContext):string[] {
  const raw=world as unknown as Record<string,unknown>;
  if(version<=195)return ['group','groupLosses'].some(k=>Object.hasOwn(raw,k))?['Future group owner in historical schema.']:[];
  if(raw.group===undefined&&raw.groupLosses===undefined)return [];
  if(!int(world.tick)||!int(world.nextId,1))return ['Invalid group planet authority.'];
  const planet=validatedPlanetFor(context,world,version);
  if(!planet)return ['Invalid group planet authority.'];
  return validateGroupOwners(world,version,planet);
}
/** Only the existing actual263 escape receipt may own a stationary caravan
 * without a split/reform birth. Other validators already check every original,
 * origin context, clinical/clock boundary and inventory equation. No migration,
 * historical fallback, new birth or default receipt is installed here. */
export function validStationaryRetreat263(world:World,g:GroupState):boolean {
 if(!isSchema263OrLater(Number(world.schemaVersion))||world.group!==g||!('members'in g)||g.phase!=='stationary'||g.admission?.revision!==2||!g.travel||!g.reorganization||g.reorganization.birth!==undefined)return false;
 const r=boundWorldGroup(world),receipt=r?.retreat261,admission=r?.encounters261;
 if(!r||r.state!==g||r.localMapId!==null||!object(receipt)||!keys(receipt,['revision','autoJoinable'])||receipt.revision!==1||receipt.autoJoinable!==true||!object(admission)||!keys(admission,['revision'])||admission.revision!==1)return false;
 if(g.reorganization.memberOrigins.some(o=>!Number.isSafeInteger(o.enteredAtAbsCore)||o.enteredAtAbsCore!<0)||g.animalOwners?.origins.some(o=>!Number.isSafeInteger(o.enteredAtAbsCore)||o.enteredAtAbsCore!<0))return false;
 const root=registeredCampaign(world),allowed=(kind:string)=>kind==='foreign-settlement'||kind==='quest-site'||kind==='battlefield';
 if(root.worldMaps){
  if(!root.worldGroups?.groups.includes(r))return false;
  const source=root.worldMaps.sites.find(s=>s.id===r.originMapId)??root.worldMaps.retired.find(s=>s.id===r.originMapId);
  return !!source&&allowed(source.kind)&&source.tile===g.originTile;
 }
 // MAIN reads its admitted transport only. The row is the original metadata
 // object retained by groupViews; a copied record or state is not authority.
 const m=world.campaignMap?.revision===2?world.campaignMap:undefined,row=m?.groups.find(row=>row.id===g.id);
 if(!m||!row||row.state!==g||row.originMapId!==r.originMapId||row.localMapId!==null||row.context!==r.context||row.retreat261!==receipt||row.encounters261!==admission||row.originTile!==g.originTile)return false;
 const live=m.maps.find(s=>s.id===r.originMapId);
 if(live)return allowed(live.kind)&&live.tile===g.originTile;
 // The existing retired-origin scalar is captured from the true retired map.
 // It proves ID/tile/removal, not a graphical claim about that former kind.
 return !!m.worldPawnOrigins?.some(s=>s.mapId===r.originMapId&&s.tile===g.originTile);
}

function validateGroupOwners(world:World,version:number,planet:PlanetState,referencesOnly=false):string[] {
  const raw=world as unknown as Record<string,unknown>,errors:string[]=[];
  const fail=(message:string)=>errors.push(message);
  const group=raw.group,losses=raw.groupLosses;
  const originPresent=object(group)&&Object.hasOwn(group,'originTile');
  const provisioned=object(group)&&Object.hasOwn(group,'provisions');
  const freighted=object(group)&&Object.hasOwn(group,'freight');
  const admissionPresent=object(group)&&Object.hasOwn(group,'admission');
  const commonKeys=[...COMMON,...admissionPresent&&version>=257?['admission']:[],...freighted?['freight']:[],...originPresent&&version>=240?['originTile']:[],...provisioned?['provisions']:[]];
  const point=(v:unknown)=>object(v)&&keys(v,['x','z'])&&int(v.x,0,world.width-1)&&int(v.z,0,world.height-1);
  const place=(v:unknown)=>int(v,0,planetTileCount(planet)-1)&&groupDestinationValid(planet,v);
  const thing=(v:unknown)=>int(v,1,world.nextId-1);
  const groupId=(v:unknown)=>int(v,1,planet.nextGroupId-1);
  const ids=(v:unknown,min=1,max=version>=256?world.nextId-1:GROUP_MAX_MEMBERS)=>dense(v,min,max)&&unique(v)&&v.every(thing);
  const localById=new Map(world.pawns.map(p=>[p.id,p]));
  const owners:{pawn:Pawn;clock:number}[]=[],ownerIds=new Set<number>(),pileIds=new Set<number>();
  const retained=new Map<number,MaterialPile[]>();
  // A terminal keeps its historical policy IDs at death. Only a living owner
  // must still resolve those IDs in the current, separately numbered registries.
  function person(v:unknown,clock:number,dead:boolean,origin?:GroupMemberOrigin,admission:import('./group-state.ts').GroupAdmission257|undefined=object(group)?group.admission as import('./group-state.ts').GroupAdmission257|undefined:undefined):v is Pawn {
    const personWorld=groupPersonValidationView(world,origin);
    if(!object(v)||!keys(v,REQUIRED_PAWN,[...PASSIVE_PAWN,...Number(version)===301?['jobTickDelta301']:[],...isSchema299OrLater(version)?['lastIngestAtCore299']:[],...isSchema271OrLater(version)?['hiveDefeatSuspendedTicks271']:[],...version>=266?['caravanRest']:[],...version>=265?['drugPolicyId']:[],...(version===259||version===260||(version===261||(Number(version)===262||isSchema263OrLater(Number(version)))))?['worldAffiliation259','prisonerHistory259',...admission?.revision===2?['prisoner']:[]]:[],...version>=256?['mapAreas','caravanCarrySick','mapBed','arrivalRotation','hiveDefeats','nativeHuman']:[]])||!thing(v.id)||ownerIds.has(v.id)||localById.has(v.id)
      ||!int(v.x,0,personWorld.width-1)||!int(v.z,0,personWorld.height-1))return false;
    if(!oneOf(v.state,['idle','resting','downed',...(dead?['dead']:[])])||dead!==(v.state==='dead')
      ||v.jobId!==null||v.haul!==null||v.cooking!==null||v.need!==null||v.bedId!==null||v.moveCooldown!==0||v.planCooldown!==0
      ||!dense(v.path,0,0)||v.motion!==undefined&&v.motion!==null||!object(v.orders)||!keys(v.orders,['active','queue'])
      ||v.orders.active!==null||!dense(v.orders.queue,0,0)||!object(v.recreation)||v.recreation.task!==null
      ||!validSchedule(v.schedule)||!int(v.restZeroTicks,0,4500)||typeof v.collapsePending!=='boolean'
      ||v.collapsePending&&(Number(v.rest)>=.01||v.restZeroTicks<=100)||personWorld.restRules==='legacy'&&(v.restZeroTicks!==0||v.collapsePending)
      ||!int(v.foodPolicyId,1,personWorld.nextFoodPolicyId-1)||!dead&&!personWorld.foodPolicies.some(policy=>policy.id===v.foodPolicyId)
      ||object(v.social)&&Object.hasOwn(v.social,'fight')||object(v.mental)&&Object.hasOwn(v.mental,'crisis')&&!(version>=256&&object(v.mental.crisis)&&v.mental.crisis.kind==='confused-wander'&&v.mental.crisis.target===null&&Number(v.mental.crisis.waitUntil)<=clock))return false;
    if(!validGroupCaravanCarryPawnField256(v,version)||version>=256&&!validPawnMapAreaBindings(v as unknown as Pawn,personWorld,false))return false;
    const originId=origin?.originMapId??boundWorldGroup(world)?.originMapId;
    const areaIds=originId===undefined?[]:mapAreaReferences(world)?.get(originId)??[];
    const shape=version>=256?validateAwayPawnRecordShape(v,personWorld,version,clock,new Set(areaIds)):validatePawnRecordShape(v,personWorld,version,clock);
    if(shape.length){errors.push(...shape.map(e=>`Group pawn ${v.id}: ${e}`));return false;}
    if(!validMentalShape(v.mental,version,clock,personWorld.width,personWorld.height)||validateRecreationRecordShape(v,version,clock).length
      ||v.filthFeet!==undefined&&(!personWorld.filth&&!projectionAllowsFilth(personWorld)||!validFilthFeet(v.filthFeet,version))
      ||v.deniedJoining!==undefined&&(!dense(v.deniedJoining,1,5)||!v.deniedJoining.every((at,i,all)=>int(at,clock+1,clock+6*TICKS_PER_DAY)&&(i===0||at>(all[i-1] as number)))))return false;
    const p=v as unknown as Pawn;if(!validToxicBuildupTransport256(p,version,clock))return false;
    const assigned=p.apparelPolicyId!==undefined||p.apparelAutomation!==undefined||p.nextApparelCheckAt!==undefined;
    if(assigned&&(!int(p.apparelPolicyId,1,(personWorld.nextApparelPolicyId??0)-1)||!dead&&!personWorld.apparelPolicies?.some(policy=>policy.id===p.apparelPolicyId)
      ||typeof p.apparelAutomation!=='boolean'||!int(p.nextApparelCheckAt,0,clock+APPAREL_POLICY_INTERVAL.max)))return false;
    if((!isColonist(p)||p.prisoner)&&!((version===259||version===260||(version===261||(Number(version)===262||isSchema263OrLater(Number(version)))))&&admission?.revision===2&&hostedCaptive259(world,p))||!validWorldAffiliationForeignKeys259(p,world.worldFactions)||p.health&&(p.health.body!==undefined||medicalCivilTick271(p.health)!==clock)
      ||(dead?(!p.health?.death||p.health.death.tick!==clock):!!p.health?.death))return false;
    // Passive owners have no spatial vomiting driver. A healthy departure
    // cannot export an episode, and ordinary disease remains a clinical record.
    if(p.health&&(!validAnesthetic(p.health.anesthetic,p.health.tick,true,p.id%20,medicalCivilTick271(p.health),version)
      ||(p.health.foodPoisoning?.vomit||p.health.cryptosleepSickness?.vomit)!==undefined||p.health.flu?.vomit!==undefined||p.health.immuneDiseases?.malaria?.vomit!==undefined))return false;
    if(p.lastAttack&&(!thing(p.lastAttack.targetId)||p.lastAttack.targetId===p.id)
      ||p.meleeThreat&&(!thing(p.meleeThreat.attackerId)||p.meleeThreat.attackerId===p.id)
      ||p.droppedWeaponId!==undefined&&!thing(p.droppedWeaponId))return false;
    const status=p.health?medicalStatus(p.health,pawnBody(p)):'mobile';
    if(dead?status!=='dead':(status==='downed')!==(p.state==='downed'))return false;
    ownerIds.add(p.id);owners.push({pawn:p,clock});return true;
  }
  function piles(v:unknown,people:ReadonlySet<number>,clock:number,max:number,freight=false,animalOrigins?:readonly GroupMemberOrigin[]):v is MaterialPile[] {
    if(!dense(v,0,max))return false;
    const counts=new Map<number,number>(),equipment=new Set<number>(),worn=new Map<number,MaterialPile[]>();
    const originalAnimalHeaders=animalOrigins?new Map(animalOrigins.map(o=>[o.pawnId,o.context])):undefined;
    for(const item of v){
      if(!object(item)||!keys(item,PILE_KEYS,version>=235?[...PILE_OPTIONAL,'innerResource','plantPack',...(version>=256?['egg','eggForbidden','forbidden']:[])]:PILE_OPTIONAL)||!thing(item.id)||pileIds.has(item.id)
        ||!object(item.owner)||!keys(item.owner,['type','pawnId'])||!people.has(item.owner.pawnId as number)
        ||!oneOf(item.owner.type,['inventory','equipment','apparel']))return false;
      const animalHeader=originalAnimalHeaders?.get(item.owner.pawnId as number);
      const shape=validatePileRecordShape(item,animalHeader?{...animalHeader,tick:clock,nextId:world.nextId}:world,version,clock);
      if(shape.length){errors.push(...shape.map(e=>`Group pile ${item.id}: ${e}`));return false;}
      if((version>=256?groupCaravanPileMass256(item as unknown as MaterialPile,freight,version):groupItemMassGrams(item.item as MaterialPile['item'],freight,version))===undefined)return false;
      const pile=item as unknown as MaterialPile;
      if(item.damage!==undefined&&(pile.apparel||pile.weapon||!int(item.damage,1,pileMaxHp(pile,version)-1)))return false;
      if(isPerishable(pile.item)){
        const rot=item.rot;
        if(!object(rot)||!keys(rot,['progress','atTick'],['rate'])||!int(rot.atTick,0,clock)
          ||typeof rot.progress!=='number'||!Number.isFinite(rot.progress)||rot.progress<0||rot.progress>=ROT_DAYS[pile.item]*TICKS_PER_DAY
          ||rot.rate!==undefined&&(typeof rot.rate!=='number'||!Number.isFinite(rot.rate)||rot.rate<0||rot.rate>=1)
          ||ticksUntilRot(pile,clock)<=0)return false;
      }else if(item.rot!==undefined)return false;
      const owner=item.owner.pawnId as number,count=(counts.get(owner)??0)+1;
      if(item.owner.type==='equipment'){
        if(pile.kind!=='weapon'||equipment.has(owner)||pile.weapon?.forbidden)return false;equipment.add(owner);
      }else if(item.owner.type==='apparel'){
        const previous=worn.get(owner)??[];
        if(pile.kind!=='apparel'||!isApparelItem(pile.item)||pile.apparel?.forbidden||previous.some(p=>conflictsWith(p,pile)))return false;
        previous.push(pile);worn.set(owner,previous);
      }
      if(version<256&&count>256)return false;counts.set(owner,count);pileIds.add(item.id as number);
    }
    return true;
  }
  if(losses!==undefined){
    if(!dense(losses,0,version>=256?world.nextId-1:GROUP_MAX_LOSSES))return ['Invalid group loss array.'];
    for(const loss of losses){
      if(!object(loss)||!keys(loss,['groupId','tile','tick','pawn','items'],version>=256?['memberOrigin','packed',...version>=257?['admission']:[]]:[])||!groupId(loss.groupId)||!place(loss.tile)
        ||Object.hasOwn(loss,'admission')&&(!object(loss.admission)||!validGroupAdmission257(loss.admission,version))||!int(loss.tick,planet.adoptedAt,world.tick)||loss.memberOrigin!==undefined&&(version<256||!object(loss.pawn)||!validGroupMemberOrigin(loss.memberOrigin,loss.pawn.id as number,world.nextId,o=>groupMemberOriginAuthority(world,o),version))||!person(loss.pawn,loss.tick,true,loss.memberOrigin as GroupMemberOrigin|undefined,loss.admission as import('./group-state.ts').GroupAdmission257|undefined))return ['Invalid terminal group person.',...errors];
      if(!validCaravanBedrollPacks256(loss.packed,[loss.pawn as Pawn],world.nextId,version,Number(loss.tick)))return ['Invalid terminal packed owners.'];if(!referencesOnly)errors.push(...validateGroupPackedComponents258(world,(loss.packed??[]) as import('./furniture-rules.ts').PackedFurniture[],version,Number(loss.tick)));for(const pack of (loss.packed??[]) as import('./furniture-rules.ts').PackedFurniture[]){if(pileIds.has(pack.building.id)||ownerIds.has(pack.building.id))return ['Duplicate terminal packed identity.'];pileIds.add(pack.building.id);}
      const id=(loss.pawn as Pawn).id;
      if(!piles(loss.items,new Set([id]),loss.tick,version>=256?world.nextId-1:256,version>=GROUP_FREIGHT_SCHEMA))return ['Invalid terminal group possessions.',...errors];
      const existing=retained.get(loss.groupId as number)??[];existing.push(...loss.items);retained.set(loss.groupId as number,existing);
    }
  }
  if(group!==undefined){
    if(!object(group)||!validGroupAdmission257(group.admission,version)||Object.hasOwn(group,'admission')&&!object(group.admission))return ['Invalid or future group admission.'];
    if(!validGroupProvisionsShape(group,version))return ['Invalid or future group provisions.'];
    if(!validGroupFreightShape(group,version))return ['Invalid or future group freight.'];
    const freight=freighted&&object(group)?group.freight as Record<string,number>:undefined;
    const provisions=provisioned&&object(group)?group.provisions as Record<string,number>:undefined;
    if(originPresent&&(version<240||!object(group)||!place(group.originTile)||group.originTile===planet.homeTile
      ||group.originTile!==(version>=255&&boundWorldGroup(world)?groupOriginMapTile(world):world.expeditionSite?.tile??world.secondarySite?.tile??(world.campaignMap?.revision===undefined?world.campaignMap?.secondaryTile:undefined))))return ['Invalid group origin map.'];
    if(!object(group)||!groupId(group.id)||!int(group.startedAt,planet.adoptedAt,world.tick)||!place(group.destination)||!ledger(group.ledger))
      return ['Invalid group identity or ledger.'];
    if(oneOf(group.phase,['gathering','loading','leaving'])){
      if(!keys(group,[...commonKeys,...PREPARING],version>=256?['bedrollLoading','travelPreparation','animalPreparation',...version>=257?['humanPreparation']:[]]:[])||!ids(group.memberIds)||!point(group.rendezvous)
        ||!dense(group.meeting,(group.memberIds as number[]).length,(group.memberIds as number[]).length)
        ||!dense(group.exits,(group.memberIds as number[]).length,(group.memberIds as number[]).length)
        ||!dense(group.manifest,0,version>=256?world.nextId-1:512)||!int(group.cursor,0,group.manifest.length))return ['Invalid group formation shape.'];
      if(!validGroupHumanPreparation257(group.humanPreparation,world,group as unknown as import('./group-capture.ts').PreparingGroup,version,referencesOnly))return ['Invalid or future human formation.'];
      const preparation=Object.getOwnPropertyDescriptor(group,'travelPreparation');
      if(preparation&&(version<256||!Object.hasOwn(preparation,'value')||!preparation.enumerable||preparation.value!==true))return ['Invalid new formation travel contract.'];
      if(!validPreparingGroupPacked256(group as unknown as import('./group-capture.ts').PreparingGroup,world,version,referencesOnly))return ['Invalid formation packed source or receipt.'];
      if(!validGroupAnimalPreparation256(group as unknown as import('./group-capture.ts').PreparingGroup,world,version,referencesOnly))return ['Invalid physical animal formation.'];
      const members=group.memberIds as number[];
      if(members.some(id=>!localById.has(id)&&(!referencesOnly||!world.campaignPeople?.some(p=>p.id===id&&p.status==='away'))))return ['Missing local formation member.'];
      const roster=new Set<number>(),cells=new Set<string>();
      for(const meeting of group.meeting){
        if(!object(meeting)||!keys(meeting,['pawnId','cell'])||!members.includes(meeting.pawnId as number)||roster.has(meeting.pawnId as number)||!point(meeting.cell))return ['Invalid group meeting roster.'];
        const c=meeting.cell as unknown as {x:number;z:number},r=group.rendezvous as unknown as {x:number;z:number},key=`${c.x}:${c.z}`;
        if(cells.has(key)||version<256&&Math.max(Math.abs(c.x-r.x),Math.abs(c.z-r.z))>2)return ['Invalid group meeting cells.'];
        roster.add(meeting.pawnId as number);cells.add(key);
      }
      roster.clear();cells.clear();
      for(const exit of group.exits){
        if(!object(exit)||!keys(exit,['pawnId','cell'])||!members.includes(exit.pawnId as number)||roster.has(exit.pawnId as number)||!(exit.cell===null||point(exit.cell)))return ['Invalid group exit roster.'];
        roster.add(exit.pawnId as number);
        if(exit.cell!==null){const c=exit.cell as unknown as {x:number;z:number},key=`${c.x}:${c.z}`;
          if(cells.has(key)||!(c.x===0||c.z===0||c.x===world.width-1||c.z===world.height-1))return ['Invalid group exit cells.'];cells.add(key);}
      }
      if(group.phase==='gathering'&&group.cursor!==0||group.phase==='leaving'&&(group.cursor!==group.manifest.length||(group as unknown as import('./group-capture.ts').PreparingGroup).manifest.some(l=>l.animalCarrierId!==undefined&&!l.deliveredToAnimal)))return ['Invalid group contact frontier.'];
      const future=new Map<number,{item:string;quantity:number}>(),carried=new Set<number>(),loaded={food:0,pemmican:0,silver:0,cloth:0,'muffalo-wool':0,wood:0,steel:0};
      for(let i=0;i<group.manifest.length;i++){
        const line:unknown=group.manifest[i];
        if(!object(line)||!keys(line,['pileId','quantity','item','carrierId'],[...i<(group.cursor as number)?['carriedPileId']:[],...version>=256&&group.travelPreparation===true?['animalCarrierId',...i<(group.cursor as number)?['deliveredToAnimal']:[]]:[]])
          ||!thing(line.pileId)||!members.includes(line.carrierId as number)||!(version>=258&&group.travelPreparation===true&&typeof line.item==='string'&&Object.hasOwn(ITEM_DEFINITIONS,line.item)&&regularGroupFreightItem258(line.item as MaterialPile['item'],version)||oneOf(line.item,['survival-meal','silver','cloth','muffalo-wool',...provisioned?['pemmican']:[],...freighted?['wood','steel']:[]])||version>=256&&group.travelPreparation===true&&typeof line.item==='string'&&Object.hasOwn(ITEM_DEFINITIONS,line.item)&&ITEM_DEFINITIONS[line.item as MaterialPile['item']].nutrition>0)
          ||!int(line.quantity,1,ITEM_DEFINITIONS[line.item as MaterialPile['item']].stackLimit))return ['Invalid group manifest row.'];
        if(Object.hasOwn(line,'animalCarrierId')){const preparing=group as unknown as import('./group-capture.ts').PreparingGroup;if(!thing(line.animalCarrierId)||!preparing.animalPreparation?.lines.some(a=>a.animalId===line.animalCarrierId))return ['Invalid animal cargo recipient.'];if(Object.hasOwn(line,'deliveredToAnimal')&&line.deliveredToAnimal!==true)return ['Invalid animal delivery receipt.'];}else if(Object.hasOwn(line,'deliveredToAnimal'))return ['Animal delivery without recipient.'];
        if(i<(group.cursor as number)){
          if(!thing(line.carriedPileId)||carried.has(line.carriedPileId))return ['Invalid group pickup receipt.'];carried.add(line.carriedPileId);
          const key=line.item==='survival-meal'?'food':line.item as 'silver'|'cloth'|'muffalo-wool'|'pemmican'|'wood'|'steel';if(Object.hasOwn(loaded,key))loaded[key]+=line.quantity;
        }else{const old=future.get(line.pileId)??{item:line.item as string,quantity:0};if(old.item!==line.item)return ['Conflicting group source item.'];old.quantity+=line.quantity;future.set(line.pileId,old);}
      }
      if(!referencesOnly)for(const [id,line] of future){const pile=world.piles.find(p=>p.id===id);if(!pile||pile.owner.type!=='ground'||pile.item!==line.item||pile.foodPoison||pile.quantity<line.quantity)return ['Invalid future group source ownership.'];}
      if(!referencesOnly&&!validLoadedGroupFreight258(group as unknown as import('./group-capture.ts').PreparingGroup,new Map(world.piles.map(p=>[p.id,p])),version))return ['Invalid actual freight pickup receipt.'];
      if(provisions&&(provisions.pemmicanLoadedUnits!==loaded.pemmican||provisions.pemmicanConsumedUnits!==0||provisions.pemmicanSpoiledUnits!==0))return ['Invalid formation pemmican contact ledger.'];
      if(freight&&(freight.woodLoaded!==loaded.wood||freight.steelLoaded!==loaded.steel))return ['Invalid formation freight contact ledger.'];
      const l=group.ledger as unknown as GroupState['ledger'];
      if(!Object.values(loaded).every(Number.isSafeInteger)||l.foodLoaded!==loaded.food||l.silverLoaded!==loaded.silver
        ||l.cargoLoaded.cloth!==loaded.cloth||l.cargoLoaded['muffalo-wool']!==loaded['muffalo-wool']||l.foodConsumed!==0||l.medicineUsed!==0
        ||l.silverPaid!==0||l.silverEarned!==0||l.sold.cloth!==0||l.sold['muffalo-wool']!==0||l.bought.medicine!==0||l.bought.component!==0)return ['Invalid formation contact ledger.'];
    }else if(group.phase==='unloading'){
      if(!keys(group,[...commonKeys,'memberIds','pendingPileIds'],version>=256?['pendingPackedIds','animalIds']:[])||!ids(group.memberIds)||!ids(group.pendingPileIds,version>=256?0:1,version>=256?world.nextId-1:256*GROUP_MAX_MEMBERS))return ['Invalid group unloading shape.'];
      const members=group.memberIds as number[];
      const unloadingOwners=new Set([...members,...(Array.isArray(group.animalIds)?group.animalIds:[]) as number[]]);if(Object.hasOwn(group,'animalIds')&&(version<256||!ids(group.animalIds)||unloadingOwners.size!==members.length+(group.animalIds as number[]).length||!referencesOnly&&(group.animalIds as number[]).some(id=>!world.wildlife?.animals.some(a=>a.id===id))))return ['Invalid animal unloading roster.'];
      if(group.pendingPackedIds!==undefined&&(version<256||!ids(group.pendingPackedIds,1,world.nextId-1))||!(group.pendingPileIds as number[]).length&&!(Array.isArray(group.pendingPackedIds)&&group.pendingPackedIds.length))return ['Invalid packed unloading references.'];
      if(!referencesOnly&&Array.isArray(group.pendingPackedIds)&&group.pendingPackedIds.some(id=>!world.packed.some(p=>p.building.id===id&&p.owner.type==='inventory'&&unloadingOwners.has(p.owner.pawnId))))return ['Invalid packed unloading ownership.'];
      if(!referencesOnly&&(members.some(id=>!localById.has(id))||(group.pendingPileIds as number[]).some(id=>!world.piles.some(p=>p.id===id&&p.owner.type==='inventory'&&unloadingOwners.has(p.owner.pawnId)))))return ['Invalid group unloading possession.'];
    }else if(oneOf(group.phase,['travelling','at-site','awaiting-entry',...version>=256?['stationary']:[]])){
      if(!keys(group,[...commonKeys,...AWAY],version>=256?['reorganization','travel','packed','animalOwners']:[])||!dense(group.members,1,version>=256?world.nextId-1:GROUP_MAX_MEMBERS)||!baseline(group.baseline,provisioned,freighted)||!point(group.entry)
        ||!int(group.departedAt,group.startedAt as number,world.tick)||group.lastPersonalTick!==world.tick||!place(group.tile)
        ||typeof group.paused!=='boolean'||!dense(group.route,1,version>=255?planetTileCount(planet):162))return ['Invalid away group shape or clock.'];
      const prospective=group as unknown as Extract<GroupState,{members:Pawn[]}>;
      if((group.travel!==undefined||group.packed!==undefined)&&group.reorganization===undefined||!validGroupTravel(group.travel,version)||!validGroupReorganization(group.reorganization,prospective,version,world.tick,world.nextId,o=>groupMemberOriginAuthority(world,o),source=>{const local=boundWorldGroup(world),projected=world.campaignMap?.revision===2?world.campaignMap.groups.find(r=>r.id===prospective.id):undefined;return source===(local?.originMapId??projected?.originMapId);}))return ['Invalid or future group reorganization/travel.'];
      if(prospective.admission?.revision===2&&(!prospective.reorganization||prospective.reorganization.memberOrigins.some(o=>o.enteredAtAbsCore===undefined)||prospective.animalOwners?.origins.some(o=>o.enteredAtAbsCore===undefined)))return ['Prospective caravan lost a true exit receipt.'];
      if(!validGroupAnimalOwners256(prospective,world,version,o=>groupMemberOriginAuthority(world,o)))return ['Invalid actual animal owners.'];
      for(const a of prospective.animalOwners?.members??[]){if(ownerIds.has(a.id)||localById.has(a.id)||world.wildlife?.animals.some(b=>b.id===a.id))return ['Duplicate animal original.'];ownerIds.add(a.id);}
      for(const p of group.members)if(!person(p,world.tick,false,object(p)?prospective.reorganization?.memberOrigins.find(o=>o.pawnId===p.id):undefined))return ['Invalid away group person.',...errors];
      if(admissionPresent&&!prospective.members.some(p=>isColonist(p)&&!p.prisoner&&!p.visitor&&(!p.worldAffiliation259||p.worldAffiliation259.hostFactionId===null)&&!p.health?.death&&p.state!=='dead'))return ['Away group lacks a free player owner.'];
      if(!validCaravanBedrollPacks256(group.packed,groupPhysicalPawns256(prospective),world.nextId,version,world.tick))return ['Invalid away packed owners.'];if(!referencesOnly)errors.push(...validateGroupPackedComponents258(world,(group.packed??[]) as import('./furniture-rules.ts').PackedFurniture[],version));for(const pack of (group.packed??[]) as import('./furniture-rules.ts').PackedFurniture[]){if(pileIds.has(pack.building.id)||ownerIds.has(pack.building.id))return ['Duplicate away packed identity.'];pileIds.add(pack.building.id);}
      const people=new Set(groupPhysicalPawns256(prospective).map(p=>p.id));
      if(!piles(group.items,people,world.tick,version>=256?world.nextId-1:32768-world.piles.length,freighted||!!prospective.reorganization,prospective.animalOwners?.origins))return ['Invalid away group possessions.',...errors];
      if((group.items as MaterialPile[]).some(p=>{const o=p.owner;return 'pawnId'in o&&prospective.animalOwners?.members.some(a=>a.id===o.pawnId)&&o.type!=='inventory';}))return ['Animal possession is not an inventory.'];
      const segment=group.segment;
      if(segment!==null&&(!object(segment)||!keys(segment,['from','to','totalCore','remainingCore'])||segment.from!==group.tile||!place(segment.to)
        ||!planetTile(planet,group.tile as number)!.neighbours.includes(segment.to as number)||(prospective.travel?!validProspectiveGroupSegment256(segment as unknown as import('./group-state.ts').GroupSegment,version):!int(segment.totalCore,1,30000)||!int(segment.remainingCore,0,segment.totalCore))))return ['Invalid group captured segment.'];
      const from=object(segment)?segment.to as number:group.tile as number;
      if(!validPlanetRoute(planet,group.route as number[],from,group.destination as number))return ['Invalid persisted group route.'];
      const stop=group.stop;
      if(stop!==null){
        if(!object(stop))return ['Invalid group stop.'];
        if(oneOf(stop.kind,['paused','night','at-site','awaiting-entry',...version>=256?['stationary']:[]])){if(!keys(stop,['kind']))return ['Invalid group stop shape.'];}
        else if(stop.kind==='incapacity'){if(!keys(stop,['kind','pawnIds'])||!ids(stop.pawnIds)||(stop.pawnIds as number[]).some(id=>!people.has(id)))return ['Invalid group incapacity stop.'];}
        else if(stop.kind==='overload'){if(!keys(stop,['kind','grams','capacityGrams'])||!int(stop.grams)||!int(stop.capacityGrams)||stop.grams<=stop.capacityGrams)return ['Invalid group overload stop.'];}
        else if(stop.kind==='unreachable'){if(!keys(stop,['kind','destination'])||stop.destination!==group.destination)return ['Invalid group blocked destination.'];}
        else return ['Unknown group stop.'];
      }
      if(group.phase==='stationary'&&(!prospective.travel||!prospective.reorganization?.birth&&!validStationaryRetreat263(world,prospective))||group.phase!=='travelling'&&(segment!==null||group.tile!==group.destination||group.route.length!==1||!object(stop)||stop.kind!==group.phase)
        ||group.phase==='awaiting-entry'&&group.tile!==planet.homeTile||group.phase==='at-site'&&group.tile===planet.homeTile)return ['Invalid group arrival frontier.'];
      if((losses as unknown[]|undefined)?.some(loss=>object(loss)&&loss.groupId===group.id&&(loss.tick as number)<(group.departedAt as number)))return ['Group loss predates its departure.'];
      const all=[...(group.items as MaterialPile[]),...(retained.get(group.id as number)??[])],b=group.baseline as unknown as Extract<GroupState,{members:Pawn[]}>['baseline'],l=group.ledger as unknown as GroupState['ledger'];
      const amount=(item:string)=>total(all.filter(p=>p.owner.type==='inventory'&&p.item===item).map(p=>p.quantity));
      const equations:[string,bigint][]=[...(freight?[['wood',BigInt(b.freight!.wood)] as [string,bigint],['steel',BigInt(b.freight!.steel)] as [string,bigint]]:[]),...(provisions?[['pemmican',BigInt(b.pemmican!)-BigInt(provisions.pemmicanConsumedUnits!)-BigInt(provisions.pemmicanSpoiledUnits!)] as [string,bigint]]:[]),['survival-meal',BigInt(b.food)-BigInt(l.foodConsumed)],['silver',BigInt(b.silver)+BigInt(l.silverEarned)-BigInt(l.silverPaid)],
        ['cloth',BigInt(b.cargo.cloth)-BigInt(l.sold.cloth)],['muffalo-wool',BigInt(b.cargo['muffalo-wool'])-BigInt(l.sold['muffalo-wool'])],
        ['medicine',BigInt(b.medicine)+BigInt(l.bought.medicine)-BigInt(l.medicineUsed)],['component',BigInt(b.component)+BigInt(l.bought.component)]];
      if(prospective.reorganization?!groupReorganizationBalance(prospective,prospective.reorganization,(losses??[]) as unknown as import('./group-state.ts').GroupLoss[]):equations.some(([item,expected])=>{const actual=amount(item);return expected<0n||expected>BigInt(Number.MAX_SAFE_INTEGER)||actual===undefined||BigInt(actual)!==expected;}))return ['Invalid group baseline conservation.'];
    }else return ['Unknown group phase.'];
  }
  // Contextual memory references use one real capture after all new shapes.
  try{const capture=captureHumanOwners(world),known=new Set(capture.people.keys());
    for(const {pawn,clock} of owners){errors.push(...validateHumanSocial(pawn,version,clock,known,world.pawns));
      if((hasCoupleFields285(pawn)||hasPartyMemoryField292(pawn))&&!validCouplePawnContext285(pawn,{version,tick:clock,nextId:world.nextId,knownHumanIds:known}))fail('Invalid passive group couple clock or memory.');
      if(!validHumanBereavement(pawn.bereavement,pawn,version,clock,capture.people))fail('Invalid group death memory.');
      if(pawn.state!=='dead'&&pawn.droppedWeaponId!==undefined&&(capture.byId.get(pawn.id)?.items.some(i=>i.owner.type==='equipment')
        ||!world.piles.some(i=>i.id===pawn.droppedWeaponId&&i.kind==='weapon'&&i.owner.type==='ground')))fail('Invalid group remembered weapon.');}
  }catch{fail('Invalid group human namespace.');}
  return errors;
}

/** Batch all literal owner contexts after ONE immutable planet witness check. */
export function validateGroupContextsWithPlanet(authority:World,views:readonly {world:World;referencesOnly?:boolean}[],version:number,context?:PlanetValidationContext):string[] {const planet=context?validatedPlanetFor(context,authority,version):validatePlanet(authority.planet,authority,version).length?undefined:authority.planet;if(!planet)return views.some(v=>v.world.group||v.world.groupLosses?.length)?['Invalid group planet authority.']:[];const errors:string[]=[];for(const v of views){if(v.world.planet!==authority.planet||v.world.tick!==authority.tick||v.world.nextId!==authority.nextId||v.world.schemaVersion!==authority.schemaVersion)return ['Group metadata disagrees with campaign authority.'];errors.push(...validateGroupOwners(v.world,version,planet,v.referencesOnly));}return errors;}
