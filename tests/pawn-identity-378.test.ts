import {describe,expect,it} from 'vitest';
import {applyCommand,createWorld,stepWorld} from '../src/sim/engine.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {captureHumanOwners} from '../src/sim/human-owners.ts';
import {ancientHumanNameLabel256} from '../src/sim/ancient-human-name-256.ts';
import {validNativeHumanField256} from '../src/sim/native-human-identity-256.ts';
import {finalizeBanishedDepartures378} from '../src/sim/pawn-identity-378.ts';
import {validPawnIdentity378} from '../src/sim/pawn-identity-state-378.ts';
import {validateBanishedDepartures378,validBanishedDeparturesHeader378} from '../src/sim/pawn-banish-save-378.ts';
import {wouldBeLeftToDie378} from '../src/sim/banish-risk-378.ts';
import {newWeaponState} from '../src/sim/equipment-rules.ts';
import {newApparelState} from '../src/sim/apparel-rules.ts';
import {moodThoughts} from '../src/sim/mood.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {registryCamp,preparedMap} from './helpers/world-maps-v255.ts';
import {registeredMap,registeredMapId,flushRegisteredMap} from '../src/sim/world-map-context.ts';
import {detachMapOwners,captureLostOwners} from '../src/sim/world-lost-owners.ts';
import {validLostArchiveShape} from '../src/sim/world-lost-save.ts';
import {createWorldUiModels} from './helpers/native-pregame-world-site-model.ts';
import {prepareGeographicPhysicalMap256} from '../src/sim/geographic-map-physical-256.ts';
import {initialWorldRegistry} from '../src/sim/world-map-context.ts';
import {initialWorldPawns256} from '../src/sim/world-pawn-state-256.ts';
import {startingPawn} from '../src/sim/starting-pawns.ts';
import {bindBornHumanFaction259} from '../src/sim/world-affiliation-259.ts';
import {actualCampRemovalAbsCore256} from '../src/sim/world-pawn-map-removed-256.ts';
import {captureWorldPawnHumans256} from '../src/sim/world-pawn-human-capture-256.ts';
import type {MaterialPile,World} from '../src/sim/types.ts';

function fixture(){
 const w=createWorld(378,20,20),p=w.pawns[0]!,other=w.pawns[1]!;
 w.tiles=w.tiles.map(()=>({terrain:'soil' as const}));w.structures=[];w.jobs=[];w.resources=[];
 for(const q of w.pawns){q.jobId=null;q.need=null;q.haul=null;q.cooking=null;q.path=[];q.motion=null;q.moveCooldown=0;q.bedId=null;delete q.bedSlot;q.orders={active:null,queue:[]};q.planCooldown=0;}
 p.x=10;p.z=10;return {w,p,other};
}
function goods(w:World,pawnId:number){
 const weapon:MaterialPile={id:w.nextId++,kind:'weapon',item:'revolver',quantity:1,owner:{type:'equipment',pawnId},weapon:newWeaponState('revolver')};
 const apparel:MaterialPile={id:w.nextId++,kind:'apparel',item:'cloth-tuque',quantity:1,owner:{type:'apparel',pawnId},apparel:newApparelState('cloth-tuque')};
 const inventory:MaterialPile={id:w.nextId++,kind:'wood',item:'wood',quantity:7,owner:{type:'inventory',pawnId}};
 w.piles.push(weapon,apparel,inventory);return [weapon,apparel,inventory];
}
describe('Core4871 Bio rename and banishment, schema378',()=>{
 it('renames a native nickname without changing legal names, identity, body, gear or relationships',()=>{
  const {w,p}=fixture(),n={first:'Ada',nick:'Forge',last:'Lenoir',nickSet:true};p.nativeHuman={revision:1,gender:'Female',name:n,biologicalCoreRemainder:0};p.name=ancientHumanNameLabel256(n);
  const identity=p.id,age=structuredClone(p.age),gear=goods(w,p.id),relationships=JSON.stringify(w.relationships),appearance=structuredClone(p.appearance);
  expect(applyCommand(w,{type:'pawn-rename',pawnId:p.id,nick:'  Rivet  ',title:'Artisane'})).toEqual({ok:true});
  expect(p.nativeHuman.name).toEqual({...n,nick:'Rivet'});expect(validNativeHumanField256(p,378)).toBe(true);expect(p.identity378).toEqual({revision:1,title:'Artisane'});
  expect(p.id).toBe(identity);expect(p.age).toEqual(age);expect(p.appearance).toEqual(appearance);expect(JSON.stringify(w.relationships)).toBe(relationships);for(const item of gear)expect(w.piles).toContain(item);
  expect(applyCommand(w,{type:'pawn-rename',pawnId:p.id,nick:'',title:''})).toEqual({ok:true});expect(p.nativeHuman.name.nick).toBe('Ada');expect(p.nativeHuman.name.nickSet).toBe(false);expect(p.identity378).toBeUndefined();
 });
 it('validates single-name edits and refuses malformed input before changing the original',()=>{
  const {w,p}=fixture();for(const nick of ['', '             ','😀','A'.repeat(17),'A\nB']){const before=JSON.stringify(w);expect(applyCommand(w,{type:'pawn-rename',pawnId:p.id,nick,title:''}).ok).toBe(false);expect(JSON.stringify(w)).toBe(before);}
  expect(applyCommand(w,{type:'pawn-rename',pawnId:p.id,nick:'Éloïse-3',title:''}).ok).toBe(true);expect(p.name).toBe('Éloïse-3');expect(p.nativeHuman).toBeUndefined();
 });
 it('banishes through real movement and transfers the same full body and possessions at the border',()=>{
  const {w,p,other}=fixture(),items=goods(w,p.id),relations=JSON.stringify(w.relationships),before={x:p.x,z:p.z};refreshStock(w);
  expect(validateWorld(w)).toEqual([]);expect(applyCommand(w,{type:'pawn-banish',pawnId:p.id})).toEqual({ok:true});
  expect({x:p.x,z:p.z}).toEqual(before);expect(w.pawns).toContain(p);expect(p.faction).toBe('outlanders');expect(p.identity378?.banishedAt).toBe(0);expect(other.roomMemories).toContainEqual({kind:'colonist-banished',stage:0,expiresAt:36000,otherId:p.id});
  expect(other.bereavement).toBeUndefined();expect(other.familyBereavement).toBeUndefined();expect(JSON.stringify(w.relationships)).toBe(relations);
  const inTransit=deserializeWorld(serializeWorld(w));for(let i=0;i<600&&w.pawns.includes(p);i++)stepWorld(w);
  expect(w.pawns).not.toContain(p);const departure=w.banishedDepartures378![0]!;expect(departure.pawn).toBe(p);expect(p.x===0||p.z===0||p.x===w.width-1||p.z===w.height-1).toBe(true);
  expect(departure.items).toEqual(items);for(const item of items){expect(departure.items).toContain(item);expect(w.piles).not.toContain(item);}
  expect(captureHumanOwners(w).byId.get(p.id)).toMatchObject({pawn:p,kind:'banished-departure',status:'departed'});expect(validateWorld(w)).toEqual([]);
  const resumed=deserializeWorld(serializeWorld(w));expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  for(let i=0;i<600&&inTransit.pawns.some(q=>q.id===p.id);i++)stepWorld(inTransit);expect(serializeWorld(inTransit)).toBe(serializeWorld(w));
 });
 it('keeps a blocked or downed colonist physically present and cannot banish twice',()=>{
  const {w,p}=fixture();p.state='downed';const before=JSON.stringify(w);expect(applyCommand(w,{type:'pawn-banish',pawnId:p.id}).ok).toBe(false);expect(JSON.stringify(w)).toBe(before);p.state='idle';
  for(const [i,pile] of w.piles.filter(pile=>pile.owner.type==='ground').entries())pile.owner={type:'ground',x:2+i%12,z:2+Math.floor(i/12)};
  w.tiles=w.tiles.map((tile,i)=>i%w.width===0||i%w.width===w.width-1||i<w.width||i>=w.width*(w.height-1)?{terrain:'rock' as const,stone:'granite' as const}:tile);
  expect(applyCommand(w,{type:'pawn-banish',pawnId:p.id}).ok).toBe(true);const banished=JSON.stringify(w);expect(applyCommand(w,{type:'pawn-banish',pawnId:p.id}).ok).toBe(false);expect(JSON.stringify(w)).toBe(banished);
  for(let i=0;i<25;i++)stepWorld(w);expect(w.pawns).toContain(p);expect(w.banishedDepartures378).toBeUndefined();expect(validateWorld(w)).toEqual([]);
 });
 it('uses mortal-risk thoughts with explicit banishment provenance while preserving a living relative',()=>{
  const {w,p,other}=fixture();w.relationships={links:[{kind:'spouse',aId:Math.min(p.id,other.id),bId:Math.max(p.id,other.id),recordedAt:0}]};p.health=createMedicalRecord(0);p.health.flu={bornAt:0,severity:833_000_000,immunity:0,luck:1_000_000};
  expect(wouldBeLeftToDie378(w,p)).toBe(true);expect(applyCommand(w,{type:'pawn-banish',pawnId:p.id}).ok).toBe(true);
  expect(other.familyBereavement?.[0]).toMatchObject({otherId:p.id,kind:'spouse-died',banishedToDie378:true});expect(p.health.death).toBeUndefined();expect(p.state).not.toBe('dead');expect(w.relationships.links).toHaveLength(1);
  expect(moodThoughts(w,other).find(t=>t.id==='mood350-colonist-banished-to-die')?.offset).toBe(-6);other.traits=['psychopath'];expect(moodThoughts(w,other).some(t=>t.id==='mood350-colonist-banished-to-die')).toBe(false);
 });
 it('retains a banished original’s existing grief, biological age and numeric needs through save and full departure',()=>{
  const {w,p,other}=fixture();w.relationships={links:[{kind:'spouse',aId:Math.min(p.id,other.id),bId:Math.max(p.id,other.id),recordedAt:0}]};other.health=createMedicalRecord(0);other.health.flu={bornAt:0,severity:833_000_000,immunity:0,luck:1_000_000};
  expect(applyCommand(w,{type:'pawn-banish',pawnId:other.id}).ok).toBe(true);expect(p.bereavement?.length).toBeGreaterThan(0);
  const carried=structuredClone({age:p.age,recreation:p.recreation,hunger:p.hunger,rest:p.rest,blood:p.health,bills:p.surgeryRequest,bereavement:p.bereavement,family:p.familyBereavement,memories:p.roomMemories});
  expect(applyCommand(w,{type:'pawn-banish',pawnId:p.id}).ok).toBe(true);expect(validateWorld(w)).toEqual([]);expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
  expect({age:p.age,recreation:p.recreation,hunger:p.hunger,rest:p.rest,blood:p.health,bills:p.surgeryRequest,bereavement:p.bereavement,family:p.familyBereavement,memories:p.roomMemories}).toEqual(carried);
  p.x=0;p.z=10;finalizeBanishedDepartures378(w);expect(w.banishedDepartures378?.some(d=>d.pawn===p)).toBe(true);expect(validateWorld(w)).toEqual([]);expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
 });
 it('strictly rejects future/hidden/accessor identity fields and registers duplicate archived owners',()=>{
  const {w,p}=fixture();p.identity378={revision:1,title:'Artisane'};
  expect(validPawnIdentity378(p,377,w.tick)).toBe(false);expect(validPawnIdentity378(p,380,w.tick)).toBe(false);expect(validPawnIdentity378(p,378,w.tick)).toBe(true);
  let reads=0;expect(validPawnIdentity378(Object.defineProperty({},'identity378',{get(){reads++;throw Error();},enumerable:true}),378,0)).toBe(false);expect(reads).toBe(0);
  expect(applyCommand(w,{type:'pawn-banish',pawnId:p.id}).ok).toBe(true);p.x=0;p.z=10;finalizeBanishedDepartures378(w);expect(w.banishedDepartures378).toHaveLength(1);
  expect(validBanishedDeparturesHeader378(w,377)).toBe(false);expect(validBanishedDeparturesHeader378(w,380)).toBe(false);
  expect(validateBanishedDepartures378(w,378,new Set([p.id]))).toContain('Duplicate or invalid banishment Thing identity.');
  w.banishedDepartures378!.push(w.banishedDepartures378![0]!);expect(()=>captureHumanOwners(w)).toThrow();expect(validateWorld(w).length).toBeGreaterThan(0);
 });
 it('keeps the complete frozen departure through actual map-owner compaction on abandonment',()=>{
  const root=registryCamp(),map=preparedMap(root,52,'camp'),p=map.pawns[0]!;root.worldMaps!.selectedMapId=registeredMapId(map)!;
  expect(applyCommand(map,{type:'pawn-banish',pawnId:p.id}).ok).toBe(true);p.x=0;p.z=1;p.motion=null;p.moveCooldown=0;finalizeBanishedDepartures378(map);
  expect(map.banishedDepartures378).toHaveLength(1);const compact=detachMapOwners(map,registeredMapId(map)!,52),owner=compact.humans.find(h=>h.id===p.id)!;
  expect(owner.pawn).toBe(p);expect(owner.kind).toBe('banished-departure');expect(owner.clock).toBe(map.banishedDepartures378![0]!.tick);expect(validLostArchiveShape(compact,root.tick,root.nextId,378,root)).toBe(true);
  root.worldGroups!.abandonedContents.push(compact);root.worldMaps!.sites=root.worldMaps!.sites.filter(s=>s.id!==compact.mapId);expect(captureLostOwners(root).byId.get(p.id)?.pawn).toBe(p);
 });
 it('moves the same original into the actual Free WorldPawn owner on a declared reduced geographic component',()=>{
  // This reduced92-cell fixture establishes the real geographic runtime and
  // clock/registry transaction, not a generated normal250 campaign/save claim.
  const model=createWorldUiModels(),planet=model.baseWorld.planet!;if(planet.revision!==3)throw Error('Actual geographic fixture absent');
  const w=prepareGeographicPhysicalMap256({planet,factions:model.baseWorld.worldFactions!,tile:model.homeTile,width:32,height:32,tick:0,calendarOrigin:90000,nextId:model.baseWorld.nextId,rng:123456,definitionContext:{isStartingMap:true,mapInitializing:true,tutorial:false,usedRectCells:new Set()}}).world;
  initialWorldRegistry(w);w.worldPawns=initialWorldPawns256();w.worldMaps!.calendarOrigin=w.climate!.calendarOrigin;
  const p=startingPawn(w.nextId++,'Départ préparé',0,15,0,80,w.seed,0,378);w.pawns.push(p);expect(bindBornHumanFaction259(w,p,w.worldFactions!.playerFactionId)).toBe(true);
  const items=goods(w,p.id),absolute=actualCampRemovalAbsCore256(w,w),identity=p.id,age=structuredClone(p.age);
  expect(applyCommand(w,{type:'pawn-banish',pawnId:p.id}).ok).toBe(true);expect(p.worldAffiliation259?.factionId).toBeNull();
  finalizeBanishedDepartures378(w);expect(w.banishedDepartures378).toBeUndefined();expect(w.pawns).not.toContain(p);const row=w.worldPawns.owners.find(row=>row.actor.id===identity)!;
  expect(row.actor).toBe(p);expect(row.items).toEqual(items);for(const item of items)expect(row.items).toContain(item);expect(row).toMatchObject({kind:'human',originMapId:0,entryKind261:'map-exit',enteredAtAbsCore:absolute,free:true,everColonist:true});
  expect(row.factionId).not.toBe(w.worldFactions!.playerFactionId);expect(p.age).toEqual(age);expect(captureWorldPawnHumans256(w).byId.get(p.id)?.pawn).toBe(p);expect(captureHumanOwners(w).people.get(p.id)).toMatchObject({name:p.name,status:'departed'});expect(captureHumanOwners(w).byId.has(p.id)).toBe(false);
 });
});
