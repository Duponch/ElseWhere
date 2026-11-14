import {bindBornHumanFaction259} from './world-affiliation-259.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {materializeStartingCandidate,type StartingCandidateDescriptor} from './starting-candidates.ts';
import {validStartingOriginalRequest256,type StartingOriginalRequest256} from './starting-original-request-256.ts';
import {generateStartingCandidateRelationships} from './relationship-generation.ts';
import {relationshipLinkCompare,type RelationshipState,type RelationshipPerson} from './relationship-state.ts';
import {validateRelationships} from './relationship-save.ts';
import {initialWorldPawns256,type WorldPawnsState256,type WorldPawnOwner256} from './world-pawn-state-256.ts';
import {preparePassedToWorld256} from './world-pawn-transition-256.ts';
import {plainWorldPawnData256} from './world-pawn-save-256.ts';
import {validateDetachedPawnRecordShape} from './pawn-record-save.ts';
import {validatePawnHealthRecord} from './health-save.ts';
import type {WorldFactionRegistry256} from './world-faction-state.ts';
import type {WorldGroupRecord} from './world-map-state.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import type {Pawn,MaterialPile,World} from './types.ts';
export interface StartingOriginal256 {readonly serial:number;readonly descriptor:StartingCandidateDescriptor;readonly pawn:Pawn;readonly items:MaterialPile[];readonly packed:PackedFurniture[]}
export interface StartingOriginalRoster256 {
 readonly birthModel:'delivered-starting-candidate-birth-v1';readonly seed:number;readonly nextId:number;readonly selected:readonly StartingOriginal256[];readonly reserves:readonly StartingOriginal256[];readonly all:readonly StartingOriginal256[];
 readonly factions:WorldFactionRegistry256;readonly relationships:RelationshipState;readonly worldPawns:WorldPawnsState256;
}
interface RosterOwner256 {stage:'prepared'|'consumed';source:readonly string[];context:WorldGroupRecord['context'];request:string}
const attachedWorlds=new WeakMap<World,StartingOriginalRoster256>();
const owners=new WeakMap<StartingOriginalRoster256,RosterOwner256>();
/** These are ACTUAL pre-map headers/owners from the world draft, not a local
 * World with fabricated cells. Caller owns the unpublished creation operation. */
export interface StartingRosterBirthContext256 {version?:256|257|258|259|260|261|262|263|264|265|266|267|268|269|270|271|272|273|274|275|276|277|278|279|280|281|282|283|284|285|286|287|288|289|290|291|292|293|294|295|296|297|298|299|300|301|302|303|304|305|306|307|308|309|310|311|312|313|314|315|316|317|318|319|320|321|322|323|324|325|326|327|328|329|330|331;nextId:number;factions:WorldFactionRegistry256;relationships?:RelationshipState;knownPeople:ReadonlyMap<number,RelationshipPerson>;knownThingIds:ReadonlySet<number>;context:WorldGroupRecord['context'];absoluteCore:number}
/** Adapted constructor, called ONCE per final chooser entry before terrain.
 * Hash birth channels are the existing delivered model. No Rand counter is
 * manufactured, and this is explicitly NOT the complete Core PawnGenerator. */
export function constructDeliveredStartingOriginalRoster256(request:StartingOriginalRequest256,input:StartingRosterBirthContext256):StartingOriginalRoster256 {
 if(!validStartingOriginalRequest256(request)||!Number.isSafeInteger(input.nextId)||input.nextId<1||!Number.isSafeInteger(input.nextId+8)||!Number.isSafeInteger(input.absoluteCore)||input.absoluteCore<0||!plainWorldPawnData256(input.context))throw Error('Invalid actual initial roster frontier');
 const version=input.version??256;
 const player=input.factions.factions.find(f=>f.id===input.factions.playerFactionId);if(player?.def!=='PlayerColony')throw Error('Actual PlayerColony faction is required');
 const bySerial=new Map<number,StartingOriginal256>();let nextId=input.nextId;
 // UI reordering cannot allocate a different identity. Earlier chooser rerolls
 // are descriptors in this adapted model, not unrecorded physical births.
 for(const d of request.roster.slice().sort((a,b)=>a.serial-b.serial)){
  if(input.knownThingIds.has(nextId))throw Error('Initial roster allocator collides with a true existing Thing');
  const pawn=materializeStartingCandidate(request.seed,d,nextId++,0,0,version);if(!bindBornHumanFaction259({schemaVersion:version,worldFactions:input.factions},pawn,player.id))throw Error('Actual starting faction binding failed');const entry:StartingOriginal256=Object.freeze({serial:d.serial,descriptor:Object.freeze({...d}),pawn,items:[],packed:[]});
  const c={...input.context,tick:0,nextId};const errors=[...validateDetachedPawnRecordShape(pawn as unknown as Record<string,unknown>,c,version,0),...validatePawnHealthRecord(pawn,{...c,schemaVersion:version})];if(errors.length)throw Error('Adapted original constructor refused: '+errors[0]);bySerial.set(d.serial,entry);
 }
 const ordered=request.roster.map(d=>bySerial.get(d.serial)!),selected=ordered.slice(0,3),reserves=ordered.slice(3),allocated=new Map(ordered.map(e=>[e.serial,e.pawn.id]));
 // Read only the existing originals' ages; this helper accepts identity/age
 // data and does not construct another Pawn. Preserve advertised chooser graph.
 const previewLinks=generateStartingCandidateRelationships(request.seed,selected.map(e=>({id:e.serial,age:e.pawn.age}))).links;
 const additions=previewLinks.map(link=>{const a=allocated.get(link.aId)!,b=allocated.get(link.bId)!;return {...link,aId:Math.min(a,b),bId:Math.max(a,b)};});
 const relationships:RelationshipState={links:[...(input.relationships?.links??[]),...additions].sort(relationshipLinkCompare)},people=new Map(input.knownPeople);
 for(const e of ordered){if(people.has(e.pawn.id))throw Error('Original starter also has an existing human owner');people.set(e.pawn.id,{id:e.pawn.id,name:e.pawn.name,status:'away'});}
 const graphErrors:string[]=[];if(!validateRelationships(relationships,{tick:0,nextId,people},256,graphErrors))throw Error('Actual initial relationship graph refused: '+graphErrors[0]);
 const worldPawns=initialWorldPawns256();
 // This is a newly-created PRIVATE owner, not the active campaign. On any
 // failure ROOT discards this whole roster/candidate; no old save was touched.
 for(const e of reserves){const row:WorldPawnOwner256={kind:'human',actor:e.pawn,items:e.items,packed:e.packed,factionId:player.id,originMapId:null,context:structuredClone(input.context),clockCore:0,enteredAtAbsCore:input.absoluteCore,mode:'active',keepForever:true,startingPawnLeftBehind:true};
  const plan=preparePassedToWorld256(worldPawns,row,input.factions,{float:()=>{throw Error('StartingPawnLeftBehind must not consume faction RNG');}});if(!plan.ok)throw Error(plan.reason);plan.commit();
 }
 const roster:StartingOriginalRoster256=Object.freeze({birthModel:'delivered-starting-candidate-birth-v1',seed:request.seed,nextId,selected:Object.freeze(selected),reserves:Object.freeze(reserves),all:Object.freeze(ordered),factions:input.factions,relationships,worldPawns});
 owners.set(roster,{stage:'prepared',source:ordered.map(e=>JSON.stringify({pawn:e.pawn,items:e.items,packed:e.packed})),context:structuredClone(input.context),request:JSON.stringify(request)});return roster;
}
/** Validate actual reference binding before the first875 write. Never accepts
 * a UI-provided token, a same-looking owner copy, or an old World replacement. */
export function requireOriginalStartingRoster256(world:World,roster:StartingOriginalRoster256):void {
 const owner=owners.get(roster);if(!owner||owner.stage!=='prepared'||world.tick!==0||!isSchema256Or257(world.schemaVersion)||world.worldFactions!==roster.factions||world.worldPawns!==roster.worldPawns||world.relationships!==roster.relationships||world.nextId<roster.nextId)throw Error('Actual pre-map original roster binding is missing or consumed');
 if(world.seed!==owner.context.seed||world.width!==owner.context.width||world.height!==owner.context.height)throw Error('Roster birth header does not match the actual generated map');
 for(let i=0;i<roster.all.length;i++){const e=roster.all[i]!;if(JSON.stringify({pawn:e.pawn,items:e.items,packed:e.packed})!==owner.source[i])throw Error('A starting original changed during map generation');}
 if(roster.worldPawns.owners.length!==5||roster.reserves.some((e,i)=>roster.worldPawns.owners[i]?.actor!==e.pawn||!roster.worldPawns.owners[i]?.keepForever||!roster.worldPawns.owners[i]?.startingPawnLeftBehind)||roster.selected.some(e=>roster.worldPawns.owners.some(r=>r.actor===e.pawn)))throw Error('Initial eight originals have contradictory owners');
 if(roster.selected.some(e=>e.items.length||e.packed.length))throw Error('Actual starting possessions need their complete capsule owner representation');
}
/** Called only after true Pawn/item transfer into actual starting capsules. */
export function consumeOriginalStartingRoster256(world:World,roster:StartingOriginalRoster256):void {
 const owner=owners.get(roster),arrival=world.startingArrival;if(!owner||owner.stage!=='prepared'||!arrival||arrival.phase==='opened'||roster.selected.some((e,i)=>arrival.pods[i]?.pawn!==e.pawn))throw Error('Original starting capsule adoption did not conserve the chosen three');owner.stage='consumed';
}

/** Final factory/worker guard: no same-looking replacement of any original. */
export function requireConsumedStartingOriginalRoster256(world:World,roster:StartingOriginalRoster256):void {
 const owner=owners.get(roster),arrival=world.startingArrival;
 if(!owner||owner.stage!=='consumed'||world.worldFactions!==roster.factions||world.worldPawns!==roster.worldPawns||world.relationships!==roster.relationships||!arrival||arrival.phase==='opened'||arrival.pods.length!==3||arrival.pods.some((p,i)=>p.pawn!==roster.selected[i]?.pawn)||world.nextId<roster.nextId||roster.worldPawns.owners.length!==5||roster.reserves.some((e,i)=>roster.worldPawns.owners[i]?.actor!==e.pawn))throw Error('Initial creation replaced an original or its true owner');
}

/** Factory insertion immediately AFTER physical terrain has allocated its own
 * true IDs. Do not copy draft.nextThingId over that frontier. Only neutral,
 * unpublished, owner-free creation state can accept this prepared roster. */
export function attachStartingOriginalRoster256(world:World,roster:StartingOriginalRoster256):void {
 const owner=owners.get(roster);
 if(!owner||owner.stage!=='prepared'||!isSchema256Or257(world.schemaVersion)||world.tick!==0||world.site?.revision!==3||world.planet?.revision!==3||world.worldFactions!==roster.factions||world.nextId<roster.nextId||world.seed!==owner.context.seed||world.width!==owner.context.width||world.height!==owner.context.height||Object.hasOwn(world,'worldPawns')||Object.hasOwn(world,'relationships')||Object.hasOwn(world,'startingArrival')||world.pawns.some(p=>roster.all.some(e=>e.pawn.id===p.id)))throw Error('Cannot attach initial originals to an existing owner or mismatched generated map');
 for(let i=0;i<roster.all.length;i++){const e=roster.all[i]!;if(JSON.stringify({pawn:e.pawn,items:e.items,packed:e.packed})!==owner.source[i])throw Error('Starting original changed before actual map adoption');}
 if(roster.worldPawns.owners.length!==5||roster.reserves.some((e,i)=>roster.worldPawns.owners[i]?.actor!==e.pawn||!roster.worldPawns.owners[i]?.keepForever||!roster.worldPawns.owners[i]?.startingPawnLeftBehind)||roster.selected.some(e=>e.items.length||e.packed.length||roster.worldPawns.owners.some(r=>r.actor===e.pawn)))throw Error('Original roster owners changed before adoption');
 world.worldPawns=roster.worldPawns;world.relationships=roster.relationships;
 requireOriginalStartingRoster256(world,roster);attachedWorlds.set(world,roster);
}

/** Actual worker consumer after factory completion. A World copied from an old
 * campaign, an unconsumed roster, or a different selection cannot pass. */
export function requireOriginalStartingWorld256(world:World,request:StartingOriginalRequest256):void {
 const roster=attachedWorlds.get(world),owner=roster&&owners.get(roster);
 if(!validStartingOriginalRequest256(request)||!roster||!owner||owner.request!==JSON.stringify(request))throw Error('Factory did not use the actual eight-entry starting request');
 requireConsumedStartingOriginalRoster256(world,roster);
}
