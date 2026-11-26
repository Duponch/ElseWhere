import {captureShipCasketHumans277} from './ship-casket-state-277.ts';
import {ancientCasketHumanOwnersForWorld256} from './ancient-casket-state-256.ts';
import {cryptosleepHumanOwnersForWorld271} from './cryptosleep-state-271.ts';
/** Human owner capture shared by runtime and save guards.
 * Root owns final types, guards and caps. Terminal freezes at its real death tick.
 * Preconditions: owner/container/Thing shapes already validated on REAL World.
 * This capture registers no Thing IDs and never turns a reference into an owner.
 */
import type {MaterialPile,Pawn,World} from './types.ts';
import { appendCampaignPeople } from './campaign-people.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import type {RelationshipPeople,RelationshipPerson} from './relationship-state.ts';
import type {GroupDepartureBaseline,GroupLoss,GroupState} from './group-state.ts';

export type HumanOwnerKind='map'|'world-lost'|'ancient-casket'|'player-casket'|'ship-casket'|'starting-pod'|'scout-away'|'commercial-away'|'group-away'|'group-loss'
  |'visitor-departure'|'pod-departure'|'banished-departure'|'raid-departure'|'prison-departure'|'world-pawn'|'caravan-encounter';
export type HumanSimulation='local'|'world'|'frozen'|'identity-only';
export type HumanPlace={kind:'map'}|{kind:'ancient-casket';casketId:number}|{kind:'player-casket';casketId:number}|{kind:'ship-casket';casketId:number}|{kind:'starting-pod';podId:number}|{kind:'planet';tile:number}|{kind:'legacy-trip'}|{kind:'archive'}|{kind:'world-pawn'};
export interface HumanOwnerSlot {
  readonly id:number;readonly name:string;readonly kind:HumanOwnerKind;
  readonly simulation:HumanSimulation;readonly place:HumanPlace;
  readonly status:RelationshipPerson['status'];readonly deathAt?:number;
  /** Actual validation clock: personal tick for new group, departure.tick for
   * archives, real clinical death tick for terminal. No world.tick fallback. */
  readonly validationTick:number;
  readonly pawn?:Pawn; // Original reference, absent for simple departure identities.
  readonly items:readonly MaterialPile[];readonly packed:readonly PackedFurniture[];
  readonly groupId?:number;readonly lossAt?:number;
  readonly lastPersonalTick?:number; // Only when explicitly owned by the new live group.
}
export interface HumanOwnerCensus {
  worldPawnOwned?:number;worldPawnLiving?:number;worldPawnDead?:number;
  localOwned:number;localLiving:number;localDead:number;
  containedOwned:number;containedLiving:number;containedPiles:number;
  containedPacked?:number;
  legacyAwayOwned:number;legacyAwayLiving:number;
  groupAwayOwned:number;groupAwayLiving:number;terminalOwned:number;
  frozenPawnArchives:number;simpleDepartureIdentities:number;knownHumans:number;
  /** Raw physical container counts. Separate Thing capture rejects item collisions. */
  mapPiles:number;legacyTravelPiles:number;groupTravelPiles:number;terminalPiles:number;
  archivedPiles:number;postPiles:number;archivedPacked:number;
}
export interface HumanOwnershipCapture {
  readonly byId:ReadonlyMap<number,HumanOwnerSlot>;readonly people:RelationshipPeople;
  readonly slots:readonly HumanOwnerSlot[];
  readonly pawnOwners:readonly HumanOwnerSlot[]; // Includes frozen full Pawn owners.
  readonly local:readonly HumanOwnerSlot[];readonly away:readonly HumanOwnerSlot[];
  readonly contained:readonly HumanOwnerSlot[];
  readonly terminals:readonly HumanOwnerSlot[];readonly frozen:readonly HumanOwnerSlot[];
  readonly census:Readonly<HumanOwnerCensus>;
  readonly group?:Readonly<{id:number;phase:GroupState['phase'];lastPersonalTick?:number;baseline?:Readonly<GroupDepartureBaseline>}>;
}
export interface ExplicitWorldHumanOwners {
  readonly group?:GroupState;readonly losses?:readonly GroupLoss[];
}
export class HumanOwnerError extends Error {
  readonly code:string;
  constructor(code:string,message:string){super(message);this.code=code;this.name='HumanOwnerError';}
}
const fail=(code:string,message:string):never=>{throw new HumanOwnerError(code,message);};
const STATES=['idle','moving','working','sleeping','hungry','eating','recreating','resting','downed','dead'];
const belongsTo=(pile:MaterialPile,pawnId:number)=>'pawnId' in pile.owner&&pile.owner.pawnId===pawnId
  &&['pawn','inventory','equipment','apparel'].includes(pile.owner.type);
/** One scan per actual item container. Keys are references, not human registrations;
 * duplicates in arrays remain occurrences for the separate Thing guard. */
function indexHumanPossessions(items:readonly MaterialPile[]):ReadonlyMap<number,readonly MaterialPile[]> {
  const index=new Map<number,MaterialPile[]>();
  for(const pile of items)if('pawnId' in pile.owner&&belongsTo(pile,pile.owner.pawnId)){
    const owned=index.get(pile.owner.pawnId)??[];owned.push(pile);index.set(pile.owner.pawnId,owned);
  }
  return index;
}

/** Domain-only inspection of original full Pawn owners. Preconditions and
 * identity/clock validation remain with the existing owner guards/capture.
 * References and identity-only departures are excluded; no possessions are read. */
export function everyHumanPawnOwner(realWorld:World,predicate:(pawn:Pawn,kind:HumanOwnerKind)=>boolean,explicit:ExplicitWorldHumanOwners={}):boolean {
  for(const pawn of realWorld.pawns)if(!predicate(pawn,'map'))return false;
  for(const held of ancientCasketHumanOwnersForWorld256(realWorld))if(!predicate(held.pawn,'ancient-casket'))return false;
  for(const held of cryptosleepHumanOwnersForWorld271(realWorld))if(!predicate(held.pawn,'player-casket'))return false;
  for(const held of captureShipCasketHumans277(realWorld))if(!predicate(held.pawn,'ship-casket'))return false;
  if(realWorld.startingArrival&&realWorld.startingArrival.phase!=='opened')for(const pod of realWorld.startingArrival.pods)
    if(!predicate(pod.pawn,'starting-pod'))return false;
  const scout=realWorld.scout,commercial=realWorld.commercialTrip;
  if(scout&&'pawn' in scout&&!predicate(scout.pawn,'scout-away'))return false;
  if(commercial&&'pawn' in commercial&&!predicate(commercial.pawn,'commercial-away'))return false;
  const group=explicit.group??realWorld.group;
  if(group&&'members' in group)for(const pawn of group.members)if(!predicate(pawn,'group-away'))return false;
  for(const loss of explicit.losses??realWorld.groupLosses??[])if(!predicate(loss.pawn,'group-loss'))return false;
  for(const departure of realWorld.visitors?.departed??[])if(!predicate(departure.pawn,'visitor-departure'))return false;
  for(const departure of realWorld.podRescues?.departed??[])if(!predicate(departure.pawn,'pod-departure'))return false;
  for(const departure of realWorld.banishedDepartures378??[])if(!predicate(departure.pawn,'banished-departure'))return false;
  return true;
}

/** Ephemeral capture. Do not cache across any mutation or use scoutRegistryView.
 * Formation/unloading memberIds, offers, raid members/lost and relationships
 * are REFERENCES: ignored as owners. They are checked later against this result.
 */
export function captureHumanOwners(realWorld:World,explicit:ExplicitWorldHumanOwners={},includeCampaignKnowledge=true):HumanOwnershipCapture {
  if(!Number.isSafeInteger(realWorld.tick)||realWorld.tick<0||!Number.isSafeInteger(realWorld.nextId)||realWorld.nextId<1)
    fail('world-clock','Missing or invalid authoritative World clock/nextId.');
  const byId=new Map<number,HumanOwnerSlot>(),people=new Map<number,RelationshipPerson>(),slots:HumanOwnerSlot[]=[];
  const clock=(tick:number,label:string)=>{if(!Number.isSafeInteger(tick)||tick<0||tick>realWorld.tick)fail('owner-clock',`Invalid actual clock for ${label}.`);};
  const add=(slot:HumanOwnerSlot)=>{
    // Shared Pawn bound is raw1..80. Capture never trims/normalizes a name;
    // archive-specific48/80 and blank guards remain their prior owner guards.
    if(!Number.isSafeInteger(slot.id)||slot.id<1||slot.id>=realWorld.nextId||typeof slot.name!=='string'||slot.name.length<1||slot.name.length>80)
      fail('human-identity',`Invalid human identity at ${slot.kind}.`);
    clock(slot.validationTick,slot.kind);
    // Reject even if the two slots point to the same JS Pawn object.
    if(byId.has(slot.id))fail('duplicate-human-owner',`Human ${slot.id} occurs in ${byId.get(slot.id)!.kind} and ${slot.kind}.`);
    const frozen=Object.freeze(slot);byId.set(slot.id,frozen);slots.push(frozen);
    people.set(slot.id,{id:slot.id,name:slot.name,status:slot.status,...slot.deathAt!==undefined?{deathAt:slot.deathAt}:{}});
  };
  const addPawn=(pawn:Pawn,kind:HumanOwnerKind,simulation:HumanSimulation,place:HumanPlace,tick:number,
    items:readonly MaterialPile[],packed:readonly PackedFurniture[]=[],extra:Partial<Pick<HumanOwnerSlot,'groupId'|'lossAt'|'lastPersonalTick'>>={})=>{
    if(!pawn||!STATES.includes(pawn.state)||Object.hasOwn(pawn,'mechKind')
      ||pawn.health!==undefined&&(!pawn.health||typeof pawn.health!=='object'||Array.isArray(pawn.health)||pawn.health.body!==undefined))
      fail('pawn-shape',`Missing or non-human original Pawn for ${kind}.`);
    const deathAt=pawn.health?.death?.tick;
    if(deathAt!==undefined&&(!Number.isSafeInteger(deathAt)||deathAt<0||deathAt>tick))
      fail('death-clock',`Invalid clinical death clock at ${kind}.`);
    const dead=pawn.state==='dead'||deathAt!==undefined;
    if(kind==='starting-pod'&&dead)fail('starting-owns-dead','Initial capsule requires its original living human.');
    if(kind==='group-away'&&dead)fail('group-owns-dead','Group living roster still owns a dead human; complete the terminal transfer before capture.');
    if(kind==='group-loss'&&(pawn.state!=='dead'||deathAt===undefined))
      fail('missing-terminal-death','New terminal requires the real dead Pawn and clinical death clock; do not invent either.');
    const status=dead?'dead':kind==='map'?'present':kind==='starting-pod'||kind==='ancient-casket'||kind==='player-casket'||kind==='ship-casket'||simulation==='world'?'away':'departed';
    add({id:pawn.id,name:pawn.name,kind,simulation,place,validationTick:tick,pawn,status,
      ...deathAt!==undefined?{deathAt}:{},items:Object.freeze([...items]),packed:Object.freeze([...packed]),...extra});
  };
  const localPossessions=indexHumanPossessions(realWorld.piles);
  for(const pawn of realWorld.pawns)addPawn(pawn,'map','local',{kind:'map'},realWorld.tick,localPossessions.get(pawn.id)??[]);
  const casketOwners=ancientCasketHumanOwnersForWorld256(realWorld);
  for(const held of casketOwners)addPawn(held.pawn,held.kind,held.simulation,held.place,held.validationTick,held.items);
  const playerCasketOwners=cryptosleepHumanOwnersForWorld271(realWorld);
  for(const held of playerCasketOwners)addPawn(held.pawn,held.kind,held.simulation,held.place,held.validationTick,held.items,held.packed);
  const shipCasketOwners=captureShipCasketHumans277(realWorld);
  for(const held of shipCasketOwners)addPawn(held.pawn,held.kind,held.simulation,held.place,held.validationTick,held.items,held.packed);
  const arrival=realWorld.startingArrival;
  if(arrival&&arrival.phase!=='opened')for(const pod of arrival.pods){
    if(arrival.personalTick!==0)fail('starting-personal-clock','Initial capsule requires its explicit personal tick zero.');
    addPawn(pod.pawn,'starting-pod','frozen',{kind:'starting-pod',podId:pod.id},arrival.personalTick,
      indexHumanPossessions(pod.items).get(pod.pawn.id)??[]);
  }
  const scout=realWorld.scout;
  if(scout&&'pawn' in scout)addPawn(scout.pawn,'scout-away','world',{kind:'legacy-trip'},realWorld.tick,scout.items);
  const commercial=realWorld.commercialTrip;
  if(commercial&&'pawn' in commercial)addPawn(commercial.pawn,'commercial-away','world',{kind:'legacy-trip'},realWorld.tick,commercial.items);
  const group=explicit.group??realWorld.group;
  let groupView:HumanOwnershipCapture['group'];
  if(group)groupView=Object.freeze({id:group.id,phase:group.phase});
  if(group&&'members' in group){
    // Group shape/living/pile ownership and planet bounds remain root's guards.
    if(!Number.isSafeInteger(group.lastPersonalTick)||group.lastPersonalTick<group.departedAt)
      fail('missing-personal-clock','New group needs its explicit lastPersonalTick; sparse health records do not infer it.');
    clock(group.lastPersonalTick,'group personal owner');
    const b=group.baseline;
    if(!b||typeof b!=='object'||Array.isArray(b)||!b.cargo||typeof b.cargo!=='object'||Array.isArray(b.cargo)
      ||[b.food,b.silver,b.medicine,b.component,b.cargo.cloth,b.cargo['muffalo-wool']].some(n=>!Number.isSafeInteger(n)||n<0))
      fail('missing-departure-baseline','New group needs the actual conserved departure baseline; never rebuild it from contact ledger or current inventory.');
    groupView=Object.freeze({id:group.id,phase:group.phase,lastPersonalTick:group.lastPersonalTick,
      baseline:Object.freeze({...b,cargo:Object.freeze({...b.cargo})})});
    const groupPossessions=indexHumanPossessions(group.items);
    for(const pawn of group.members)addPawn(pawn,'group-away','world',{kind:'planet',tile:group.tile},group.lastPersonalTick,
      groupPossessions.get(pawn.id)??[],(group.packed??[]).filter(pack=>pack.owner.type==='inventory'&&pack.owner.pawnId===pawn.id),{groupId:group.id,lastPersonalTick:group.lastPersonalTick});
  }
  for(const loss of explicit.losses??realWorld.groupLosses??[]){
    clock(loss.tick,'group-loss clinical death');
    if(loss.pawn?.health?.death?.tick!==loss.tick)
      fail('terminal-clock','Terminal loss.tick must equal its real clinical death and validation clock.');
    addPawn(loss.pawn,'group-loss','frozen',{kind:'planet',tile:loss.tile},loss.tick,loss.items,loss.packed??[],{groupId:loss.groupId,lossAt:loss.tick});
  }
  for(const departure of realWorld.visitors?.departed??[])addPawn(departure.pawn,'visitor-departure','frozen',{kind:'archive'},departure.tick,departure.items,departure.packed??[]);
  for(const departure of realWorld.podRescues?.departed??[])addPawn(departure.pawn,'pod-departure','frozen',{kind:'archive'},departure.tick,departure.items,departure.packed??[]);
  for(const departure of realWorld.banishedDepartures378??[])addPawn(departure.pawn,'banished-departure','frozen',{kind:'archive'},departure.tick,departure.items,departure.packed);
  for(const departure of realWorld.raids?.departed??[])add({id:departure.pawnId,name:departure.name,kind:'raid-departure',simulation:'identity-only',
    place:{kind:'archive'},status:'departed',validationTick:departure.tick,items:Object.freeze([...departure.items]),packed:[]});
  for(const departure of realWorld.prisonDepartures??[])add({id:departure.pawnId,name:departure.name,kind:'prison-departure',simulation:'identity-only',
    place:{kind:'archive'},status:'departed',validationTick:departure.tick,items:Object.freeze([...departure.items]),packed:[]});
  // Other maps contribute knowledge, not foreign spatial owners. Their own
  // complete guards retain the actual owning context for jobs and possessions.
  if(includeCampaignKnowledge)appendCampaignPeople(realWorld,people);
  const select=(predicate:(slot:HumanOwnerSlot)=>boolean)=>Object.freeze(slots.filter(predicate));
  const isContained=(s:HumanOwnerSlot)=>s.kind==='starting-pod'||s.kind==='ancient-casket'||s.kind==='player-casket'||s.kind==='ship-casket';
  const local=select(s=>s.kind==='map'),away=select(s=>s.simulation==='world'),contained=select(isContained),terminals=select(s=>s.kind==='group-loss'),
    frozen=select(s=>s.kind!=='group-loss'&&!isContained(s)&&(s.simulation==='frozen'||s.simulation==='identity-only'));
  const legacy=away.filter(s=>s.kind!=='group-away'),groupAway=away.filter(s=>s.kind==='group-away'),archives=frozen;
  const countLiving=(list:readonly HumanOwnerSlot[])=>list.filter(s=>s.status!=='dead').length;
  const census:HumanOwnerCensus={localOwned:local.length,localLiving:countLiving(local),localDead:local.length-countLiving(local),
    containedOwned:contained.length,containedLiving:countLiving(contained),containedPiles:(arrival&&arrival.phase!=='opened'?arrival.pods.reduce((n,p)=>n+p.items.length,0):0)+casketOwners.reduce((n,h)=>n+h.items.length,0)+playerCasketOwners.reduce((n,h)=>n+h.items.length,0)+shipCasketOwners.reduce((n,h)=>n+h.items.length,0),
    ...(playerCasketOwners.length||shipCasketOwners.length?{containedPacked:playerCasketOwners.reduce((n,h)=>n+h.packed.length,0)+shipCasketOwners.reduce((n,h)=>n+h.packed.length,0)}:{}),
    legacyAwayOwned:legacy.length,legacyAwayLiving:countLiving(legacy),groupAwayOwned:groupAway.length,groupAwayLiving:countLiving(groupAway),terminalOwned:terminals.length,
    frozenPawnArchives:archives.filter(s=>!!s.pawn).length,simpleDepartureIdentities:archives.filter(s=>!s.pawn).length,knownHumans:people.size,
    mapPiles:realWorld.piles.length,legacyTravelPiles:legacy.reduce((n,s)=>n+s.items.length,0),groupTravelPiles:group&&'members' in group?group.items.length:0,
    terminalPiles:(explicit.losses??realWorld.groupLosses??[]).reduce((n,l)=>n+l.items.length,0),archivedPiles:archives.reduce((n,s)=>n+s.items.length,0),
    postPiles:realWorld.worldMaps?0:realWorld.civilianPost?.stock.length??0,archivedPacked:archives.reduce((n,s)=>n+s.packed.length,0)};
  return Object.freeze({byId,people,slots:Object.freeze(slots),pawnOwners:select(s=>s.pawn!==undefined),local,away,contained,terminals,frozen,census:Object.freeze(census),...groupView?{group:groupView}:{}});
}

// Deliberately absent:
// - registerThingIds: old guards already register their own archives/items.
// - Human cap arithmetic: raw census leaves local/live/retained categories distinct.
// - Invented terminal clock/cause, synthetic Pawn for simple identities, archive ticks.
// - Contact/navigation/jobs/stock projection for world/frozen owners.
// - Offers, graph endpoints, raid lists or source IDs registered as fresh owners.
// - Item collision validation: a separate complete Thing-ownership stage checks
//   every occurrence before reference guards; no Set deduplication is performed here.
