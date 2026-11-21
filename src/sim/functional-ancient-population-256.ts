import {giveBornTraits361} from './trait-generation-361.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
/** Prospective, explicitly adapted NPC population. This is the same authored
 * person/health/equipment pipeline as existing visitors and raids, NOT a native
 * PawnGenerator receipt. Failure discards the entire unpublished map. */
import {bindBornHumanFaction259} from './world-affiliation-259.ts';
import type {WorldFactionRegistry256} from './world-faction-state.ts';
import {startingPawn} from './starting-pawns.ts';
import {generatePawnBackground} from './background-generation.ts';
import {newApparelState} from './apparel-rules.ts';
import {markCorpseWornApparel284} from './apparel-provenance-284.ts';
import {newWeaponState} from './equipment-rules.ts';
import {createMedicalRecord,addResolvedInjury,medicalStatus} from './injury-state.ts';
import {HP_UNIT} from './injury-rules.ts';
import {unpublishedAncientGeneration256,ancientGenerationCellConflict256} from './ancient-generation-frontier-256.ts';
import {ancientCasketCells256} from './ancient-casket-footprint-256.ts';
import {validAncientCasketBuilding256} from './ancient-casket-physical-256.ts';
import {terrainSupportsAffordance256} from './natural-terrain-runtime-256.ts';
import {planVanishGeneratedAncient256} from './generated-ancient-vanish-256.ts';
import {footprintCells} from './definitions.ts';
import {constructHiveInsect256} from './cave-insect-constructor-256.ts';
import {startAnimalManhunter} from './animal-manhunter.ts';
import {findAncientTempleItemCell256} from './ancient-temple-item-cell-256.ts';
import {captureStandability} from './furniture-travel.ts';
import {MAX_WILDLIFE,type WildAnimal} from './wildlife-state.ts';
import {duckPhysicalOwnerCount256} from './duck-flyer-runtime-256.ts';
import {WorldGenerationRandom} from './world-generation-random.ts';
import type {AncientCasket256,AncientHeldPile256} from './ancient-casket-state-256.ts';
import type {AncientShrinePlacement256} from './ancient-shrine-group-plan-256.ts';
import type {Cell,Pawn,World} from './types.ts';

export const FUNCTIONAL_ANCIENT_POPULATION_256='existing-npc-population-v1' as const;
export type FunctionalAncientContents256='ancient-friendly'|'ancient-incapped'|'ancient-half-eaten'|'ancient-hostile'|'slave';
export interface FunctionalAncientBirth259 {factions:WorldFactionRegistry256;factionId:number}
const contents=new Set<FunctionalAncientContents256>(['ancient-friendly','ancient-incapped','ancient-half-eaten','ancient-hostile','slave']);

/** Existing capsule profile, adapted to contusions for this authored suspended
 * population. Pain, missing parts and death still come from the medical kernel;
 * no state is assigned independently of that kernel and no tend/heal is added. */
function injuredProfile(p:Pawn,random:WorldGenerationRandom):void {
 const h=p.health;if(!h)throw Error('Actual authored injury clock must already be captured');
 for(const part of ['left-arm','right-arm','left-leg','right-leg'] as const)addResolvedInjury(h,part,'bruise',random.integer(15,17)*HP_UNIT,()=>random.value());
 addResolvedInjury(h,'torso','bruise',8*HP_UNIT,()=>random.value());
 const status=medicalStatus(h);if(status==='mobile')throw Error('Authored injured NPC profile did not produce actual medical incapacity');
 p.state=status;
}

/** Prepare one original human and every owned item, keeping the real allocator
 * private until the casket and all branch-specific actors can be committed. */
export function prepareFunctionalAncientHuman256(input:{id:number;nextId:number;cell:Cell;tick:number;contents:FunctionalAncientContents256;random:WorldGenerationRandom;birth259?:FunctionalAncientBirth259;version?:number}):{pawn:Pawn;items:AncientHeldPile256[];nextId:number} {
 const {id,cell,tick,contents:kind,random}=input;
 if(!(random instanceof WorldGenerationRandom)||!contents.has(kind)||!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(input.nextId)||input.nextId<=id||!Number.isSafeInteger(tick)||tick<0||!Number.isSafeInteger(cell.x)||!Number.isSafeInteger(cell.z)||cell.x<0||cell.z<0)throw Error('Invalid prospective functional NPC birth inputs');
 const seed=random.integerValue()>>>0,profile=random.integer(0,3),slave=kind==='slave';
 const p=startingPawn(id,`${slave?'Captif ancien':'Veilleur ancien'} ${id}`,cell.x,cell.z,profile,55,seed,tick,256);
 p.faction=kind==='ancient-hostile'?'outlaws':'outlanders';
 // Prospective creation only. The caller supplies its actual instance; the
 // old display alias is never converted into authority on an existing Pawn.
 if(input.birth259){const b=input.birth259,expected=kind==='ancient-hostile'?'AncientsHostile':'Ancients',instance=b.factions.factions.find(f=>f.id===b.factionId);if(!instance||instance.def!==expected||!bindBornHumanFaction259({schemaVersion:259,worldFactions:b.factions},p,b.factionId))throw Error('Actual ancient birth faction instance refused');}
 generatePawnBackground(p,seed,!slave);
 giveBornTraits361({schemaVersion:input.version??256,seed},p,p.faction==='outlaws',seed);
 // These neutral/hostile outsiders do not acquire a colony policy/task.
 delete p.apparelPolicyId;delete p.apparelAutomation;delete p.nextApparelCheckAt;
 const items:AncientHeldPile256[]=[];let next=input.nextId;
 const allocate=()=>{if(!Number.isSafeInteger(next+1))throw Error('Functional NPC Thing identities exhausted');return next++;};
 items.push({id:allocate(),kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'apparel',pawnId:p.id},apparel:newApparelState('cloth-shirt',undefined,input.version??256)});
 if(!slave){const weapon=profile===0?'plasteel-knife':profile===1?'revolver':'bolt-action-rifle';items.push({id:allocate(),kind:'weapon',item:weapon,quantity:1,owner:{type:'equipment',pawnId:p.id},weapon:newWeaponState(weapon)});}
 if(kind==='ancient-incapped'||kind==='ancient-half-eaten'||slave){p.health??=createMedicalRecord(tick);injuredProfile(p,random);}
 // The actual tomb loot choices remain ordinary real possessions, independent
 // of the provisional NPC biography/gear. Nonpositive component count creates
 // neither an item nor a compensating Thing identity.
 const metal=random.value()<Math.fround(.65)?'gold':'plasteel',quantity=random.integer(10,50);
 items.push({id:allocate(),kind:metal,item:metal,quantity,owner:{type:'inventory',pawnId:p.id}});
 const component=random.value()<Math.fround(.7)?'component':'advanced-component',count=random.integer(-2,4);
 if(count>0)items.push({id:allocate(),kind:component,item:component,quantity:count,owner:{type:'inventory',pawnId:p.id}});
 if(slave&&random.value()<.5){
  const h=p.health??=createMedicalRecord(tick);addResolvedInjury(h,'head','bruise',25*HP_UNIT,()=>random.value());
  if(medicalStatus(h)!=='dead')throw Error('Selected authored dead captive did not produce an actual medical death');p.state='dead';
 }
 markCorpseWornApparel284(items,p,input.version??256);
 return {pawn:p,items,nextId:next};
}

/** The true terminal Pawn is retained with one actual corpse Thing. This is a
 * fresh held birth, so rot starts at the real death/holder tick with rate zero;
 * no map placement, fake World, dropped gear or second body is manufactured. */
function retainFreshCorpse(p:Pawn,casketId:number,id:number,tick:number):AncientHeldPile256 {
 if(p.state!=='dead'||!p.health?.death||p.health.death.tick!==tick||p.body)throw Error('Actual fresh terminal human required before held corpse materialization');
 p.body={observedAt:tick,pileId:id};
 return {id,kind:'corpse',item:'human-corpse',quantity:1,owner:{type:'ancient-casket',casketId},humanCorpse:{pawnId:p.id},rot:{progress:0,atTick:tick,rate:0}};
}

/** Same unpublished real Site3 map, original casket and actual phase750 stream.
 * Existing generated props may Vanish only through their real no-product plan.
 * No conflicting live/cargo/job owner is removed to make the selected pod fit. */
export function spawnFunctionalAncientCasket256(w:World,placement:AncientShrinePlacement256,kind:FunctionalAncientContents256,groupId:number,casketId:number,random:WorldGenerationRandom,birth259?:FunctionalAncientBirth259):AncientCasket256 {
 if(!unpublishedAncientGeneration256(w,true)||!(random instanceof WorldGenerationRandom)||!contents.has(kind)||!Number.isSafeInteger(groupId)||groupId<0||!Number.isSafeInteger(casketId)||casketId<1||casketId!==w.nextId-1)throw Error('Actual unpublished functional population/casket allocator required');
 const cells=ancientCasketCells256(placement.casket.cell,placement.casket.orientation),removals=new Map<number,NonNullable<ReturnType<typeof planVanishGeneratedAncient256>>>();
 for(const c of cells){
  if(c.x<0||c.x>=w.width||c.z<0||c.z>=w.height)throw Error('Actual casket footprint leaves map');
  const cell=c.z*w.width+c.x,t=w.tiles[cell]!,conflict=ancientGenerationCellConflict256(w,cell);
  if(conflict||t.terrain==='rock'||t.collapsedRock||!terrainSupportsAffordance256(t,'Medium',w))throw Error('Actual casket cell refused: '+(conflict??'Medium substrate absent'));
  for(const s of w.structures)if(footprintCells(s).some(p=>p.x===c.x&&p.z===c.z)&&!removals.has(s.id)){const plan=planVanishGeneratedAncient256(w,cell,true);if(!plan)throw Error('Actual casket encounters an unsupported edifice owner');removals.set(s.id,plan);}
 }
 if((Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))?(!birth259||birth259.factions!==w.worldFactions):birth259!==undefined)throw Error('Actual schema259 ancient birth context required, never retrofit a prior person');
 let next=w.nextId;const pId=next++;
 const prepared=prepareFunctionalAncientHuman256({id:pId,nextId:next,cell:placement.casket.cell,tick:w.tick,contents:kind,random,version:w.schemaVersion,...birth259?{birth259}:{}});next=prepared.nextId;
 if(prepared.pawn.state==='dead'){if(!Number.isSafeInteger(next+1))throw Error('Held corpse Thing allocator exhausted');prepared.items.push(retainFreshCorpse(prepared.pawn,casketId,next++,w.tick));}
 const casket:AncientCasket256={id:casketId,kind:'ancient-cryptosleep-casket',...placement.casket.cell,orientation:placement.casket.orientation,footprint:'standard',factionId:null,casket:{revision:1,groupId,contentsKnown:false,heldAt:w.tick,humans:[prepared.pawn],animals:[],items:prepared.items}};
 if(!validAncientCasketBuilding256(casket,w.schemaVersion,{width:w.width,height:w.height,nextId:next},w.tick))throw Error('Functional population created an invalid physical casket');
 // Half-eaten retains its distinct insect branch. These are actual independently
 // spawned originals, as in the source producer, not animals frozen in casket.
 const insects:WildAnimal[]=[];
 if(kind==='ancient-half-eaten'){
  if(!w.worldPawns)throw Error('Half-eaten population requires the real retained WorldPawns owner');
  const retained=w.worldPawns.owners.flatMap(row=>row.kind==='animal'?[row.actor]:[]),count=random.integer(3,6),stand=captureStandability(w),occupied=new Set([...cells.map(c=>c.z*w.width+c.x),...w.pawns.map(p=>p.z*w.width+p.x),...(w.wildlife?.animals??[]).map(a=>a.z*w.width+a.x)]);
  if(duckPhysicalOwnerCount256(w)+count>MAX_WILDLIFE)throw Error('Actual wildlife owner cannot admit every selected half-eaten scarab');
  for(let i=0;i<count;i++){
   const cell=findAncientTempleItemCell256(placement.rect,c=>!occupied.has(c)&&stand({x:c%w.width,z:Math.floor(c/w.width)})&&!w.piles.some(p=>p.owner.type==='ground'&&p.owner.z*w.width+p.owner.x===c)&&!w.packed.some(p=>p.owner.type==='ground'&&p.owner.z*w.width+p.owner.x===c),w.width,random);
   if(cell===null)throw Error('Selected half-eaten scarab lacks a real free interior spawn cell');
   if(!Number.isSafeInteger(next+1))throw Error('Scarab Thing allocator exhausted');
   const made=constructHiveInsect256({species:'megascarab',id:next++,cell:{x:cell%w.width,z:Math.floor(cell/w.width)},tick:w.tick,random,unspawnedAnimals:retained});if(made.status!=='ready')throw Error('Actual half-eaten scarab refused: '+made.reason);
   insects.push(made.animal);occupied.add(cell);
  }
 }
 // No callback remains after these true preflights. Owner removal retains its
 // existing ID hole; no stock, leavings, seed or clinical clock is changed.
 for(const plan of removals.values())plan.commit();w.nextId=next;w.structures.push(casket);
 if(insects.length){w.wildlife??={profile:'geographic-fauna-v3',rng:w.rng,animals:[],eatenPlants:0,eatenNutrition:0,eatenItems:0};for(const a of insects){w.wildlife.animals.push(a);if(!startAnimalManhunter(w,a))throw Error('Actual half-eaten scarab cannot acquire its existing manhunter state');}}
 return casket;
}
