import {expect,test} from 'vitest';
import {stripFutureContent} from './scenarios/old-schema.ts';
import {createWorld,refreshStock,stepWorld} from '../src/sim/index.ts';
import {adoptMiscIncidents} from '../src/sim/cassandra-misc.ts';
import {validMiscIncidents} from '../src/sim/cassandra-misc-save.ts';
import {validToxicFalloutCalendar294,validToxicFalloutHistoricalTransport294,validToxicFalloutRotCredit294,type ToxicFalloutRotFacts294} from '../src/sim/toxic-fallout-save-294.ts';
import {validCorpseRot} from '../src/sim/corpse-save.ts';
import {crashlandedProfile} from '../src/sim/game-profile.ts';
import {enableCassandraRaids} from '../src/sim/cassandra-raids.ts';
import {adoptFluIncidents} from '../src/sim/flu-incidents.ts';
import {createDeteriorationState} from '../src/sim/deterioration-content.ts';
import {newBreakdownCalendar} from '../src/sim/breakdowns.ts';
import {createApparelWearCalendar} from '../src/sim/apparel-renewal.ts';
import {adoptSiteClimate} from '../src/sim/site-climate.ts';
import {resolveSite} from '../src/sim/site.ts';
import {initializeWildFlora} from '../src/sim/wild-flora.ts';
import {serializeWorld,deserializeWorld,validateCampaignSchema293,validateWorld} from '../src/sim/serialization.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler.ts';
import {validToxicFalloutTransport294} from '../src/sim/toxic-fallout-transport-294.ts';
import {medicalCamp} from './scenarios/health.ts';
import {createMedicalRecord,reconcileMedicalDeath} from '../src/sim/injury-state.ts';
import {commitToxicDeath256} from '../src/sim/toxic-buildup-256.ts';
import {reconcilePawnHealth} from '../src/sim/health.ts';
import {advanceHumanCorpses} from '../src/sim/human-corpses.ts';
import {addFalloutRotAge294} from '../src/sim/toxic-fallout-environment-294.ts';
import {registryCamp} from './helpers/world-maps-v255.ts';
import {campaignOnlySummary} from '../src/sim/world-map-presentation.ts';
import {validCampaignSummary} from '../src/sim/world-map-projection-save.ts';
import {groupWorld} from '../src/sim/world-map-authority.ts';
import {validateCampaignSharedFields} from '../src/sim/campaign-shared-save.ts';
import {createDefaultApparelPolicyRegistry} from '../src/sim/apparel-policy.ts';
import {SCHEMA_VERSION,TICKS_PER_DAY,type World} from '../src/sim/types.ts';
import type {ToxicFalloutCalendar294} from '../src/sim/toxic-fallout-state-294.ts';
import * as compatibility from '../src/sim/schema-compatibility-257.ts';

const first=60*TICKS_PER_DAY;
const context={tick:first,width:32,height:32};
const parent={adoptedAt:first-1,opportunities:1};
const active=():ToxicFalloutCalendar294=>({adoptedAt:first-1,count:1,lastStart:first,active:{startCore:first*10,endCore:first*10+150000,rng:0xffffffff,cursor:1023}});
/** Explicit empty 32² fixture prepared at day60, following the weather-save
 * contract. Its physical calendars are born prospectively at that frontier;
 * no60day played campaign or past incident/environmental effects are claimed. */
function colony():World {
 const w=createWorld(481,32,32);w.pawns=[];w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];w.growingZones=[];refreshStock(w);
 w.gameProfile=crashlandedProfile();w.tick=first-1;w.scenario={id:'crashlanded',revision:8,landing:{x:4,z:4}};w.site=resolveSite(w.seed,{hilliness:'flat',biome:'boreal-forest'});
 w.deterioration=createDeteriorationState(w.seed,w.tick);w.breakdown=newBreakdownCalendar(w.seed,w.tick);w.apparelWear=createApparelWearCalendar(w.tick,(w.seed^0x0a77e1)>>>0);
 if(w.site.revision===2)initializeWildFlora(w,w.site);
 // This fixture begins at day60: use the existing prospective calendar,
 // rather than forging an unconsumed day5.4 ClassicIntro in its past.
 enableCassandraRaids(w,true);adoptFluIncidents(w);adoptSiteClimate(w);adoptMiscIncidents(w);return w;
}
function declaredActive():World {
 const w=colony();stepWorld(w,1);
 // A real single step advances every calendar. This fixed seed consumes an
 // ordinary failed category check; the condition below is explicitly declared
 // for persistence tests, with one corresponding declared Misc opportunity.
 expect(w.tick).toBe(first);expect(w.miscIncidents!.checks).toBe(1);expect(w.miscIncidents!.opportunities).toBe(0);
 Object.assign(w.miscIncidents!,{opportunities:1,toxicFallout:active()});return w;
}
/** A real terminal record and its actual indivisible body, followed by one
 * explicit age addition. This is a persistence fixture, not a played fallout. */
function creditedCorpse(){
 const w=medicalCamp(1),p=w.pawns[0]!;p.health=createMedicalRecord(w.tick);p.health.toxicBuildup={severity:1,bornAt:w.tick};reconcileMedicalDeath(p.health);commitToxicDeath256(p.health,()=>.9);reconcilePawnHealth(w,p);advanceHumanCorpses(w);
 const pile=w.piles.find(i=>i.id===p.body!.pileId)!;expect(pile?.item).toBe('human-corpse');addFalloutRotAge294(pile.rot!,w.tick,true);expect(validateWorld(w)).toEqual([]);return {w,p,pile};
}

test('293 complete campaign migration changes only the number and offers no condition or random draw',()=>{
 const w=colony(),old=JSON.parse(serializeWorld(w));old.schemaVersion=293;stripFutureContent(old,293);
 expect(validateCampaignSchema293(old)).toEqual([]);const before=JSON.stringify(old),restored=deserializeWorld(before);
 expect(JSON.parse(serializeWorld(restored))).toEqual({...old,schemaVersion:SCHEMA_VERSION});expect(JSON.stringify(old)).toBe(before);
 expect(restored.miscIncidents!.toxicFallout).toBeUndefined();expect(restored.miscIncidents!.rng).toBe(w.miscIncidents!.rng);expect(restored.rng).toBe(w.rng);
 stepWorld(restored,0);expect(restored.miscIncidents!.toxicFallout).toBeUndefined();
 stepWorld(restored,1);expect(restored.miscIncidents!.toxicFallout?.adoptedAt).toBe(restored.tick);
});

test('current exact whole reload preserves private condition RNG, full-cycle cursor and inclusive end',()=>{
 const w=declaredActive();expect(validateWorld(w)).toEqual([]);const before=serializeWorld(w),restored=deserializeWorld(before);
 expect(serializeWorld(restored)).toBe(before);expect(restored.miscIncidents!.toxicFallout).toEqual(active());
});

test('293 full validation refuses a current condition before migration and leaves the input untouched',()=>{
 const old=JSON.parse(serializeWorld(declaredActive()));old.schemaVersion=293;stripFutureContent(old,293);const before=JSON.stringify(old);
 expect(validateCampaignSchema293(old).length).toBeGreaterThan(0);expect(()=>deserializeWorld(before)).toThrow(/ToxicFallout/);expect(JSON.stringify(old)).toBe(before);
});

test.each([293,297])('ToxicFallout state never opens the historical or future schema %s',version=>{
 expect(validToxicFalloutCalendar294(active(),version,context,parent)).toBe(false);
 expect(validToxicFalloutHistoricalTransport294({world:{...context,miscIncidents:{...parent,toxicFallout:active()}}},version)).toBe(false);
});

test('all supported schema-family helpers include294/295/296 while preserving closed297 admission',()=>{
 for(const guard of Object.values(compatibility)){expect(guard(294)).toBe(true);expect(guard(295)).toBe(true);expect(guard(296)).toBe(true);expect(guard(297)).toBe(false);expect(guard(0)).toBe(false);}
 expect(validToxicFalloutCalendar294(active(),296,context,parent)).toBe(true);
 expect(validToxicFalloutHistoricalTransport294({world:{...context,miscIncidents:{...parent,toxicFallout:active()}}},296)).toBe(true);
});

test.each([150000,630000])('native duration endpoint %s Core is preserved, not rounded to a local day',duration=>{
 const value=active();value.active!.endCore=first*10+duration;expect(validToxicFalloutCalendar294(value,294,context,parent)).toBe(true);
 const endContext={...context,tick:value.active!.endCore/10};expect(validToxicFalloutCalendar294(value,294,endContext,parent)).toBe(true);
 expect(validToxicFalloutCalendar294(value,294,{...endContext,tick:endContext.tick+1},parent)).toBe(false);
});

test('absence of active state is impossible through the inclusive minimum end',()=>{
 const value=active();delete value.active;
 expect(validToxicFalloutCalendar294(value,294,{...context,tick:first+15000},parent)).toBe(false);
 expect(validToxicFalloutCalendar294(value,294,{...context,tick:first+15001},parent)).toBe(true);
});

test('count0 is prospective and owns neither a last success nor an active condition',()=>{
 const value={adoptedAt:first,count:0};expect(validToxicFalloutCalendar294(value,294,context,parent)).toBe(true);
 expect(validToxicFalloutCalendar294({...value,lastStart:undefined},294,context,parent)).toBe(false);
 expect(validToxicFalloutCalendar294({...value,active:undefined},294,context,parent)).toBe(false);
});

test('success counts require real Misc opportunities, a60day first start and90day cooldown',()=>{
 const second=first+90*TICKS_PER_DAY,value={...active(),count:2,lastStart:second,active:{...active().active!,startCore:second*10,endCore:second*10+150000}},w={...context,tick:second};
 expect(validToxicFalloutCalendar294(value,294,w,{...parent,opportunities:2})).toBe(true);
 expect(validToxicFalloutCalendar294(value,294,w,parent)).toBe(false);
 value.lastStart-=100;value.active.startCore-=1000;value.active.endCore-=1000;expect(validToxicFalloutCalendar294(value,294,w,{...parent,opportunities:2})).toBe(false);
});

test.each([
 ['future adoption',(v:ToxicFalloutCalendar294)=>{v.adoptedAt=first+1;}],
 ['retroactive adoption',(v:ToxicFalloutCalendar294)=>{v.adoptedAt=first-2;}],
 ['too early start',(v:ToxicFalloutCalendar294)=>{v.lastStart=first-100;}],
 ['non opportunity start',(v:ToxicFalloutCalendar294)=>{v.lastStart=first-1;}],
 ['missing last success',(v:ToxicFalloutCalendar294)=>{delete v.lastStart;}],
 ['wrong start unit',(v:ToxicFalloutCalendar294)=>{v.active!.startCore=first;}],
 ['short duration',(v:ToxicFalloutCalendar294)=>{v.active!.endCore=first*10+149999;}],
 ['long duration',(v:ToxicFalloutCalendar294)=>{v.active!.endCore=first*10+630001;}],
 ['zero random state',(v:ToxicFalloutCalendar294)=>{v.active!.rng=0;}],
 ['wide random state',(v:ToxicFalloutCalendar294)=>{v.active!.rng=0x100000000;}],
 ['negative cursor',(v:ToxicFalloutCalendar294)=>{v.active!.cursor=-1;}],
 ['cursor outside map',(v:ToxicFalloutCalendar294)=>{v.active!.cursor=1024;}],
 ['fractional cursor',(v:ToxicFalloutCalendar294)=>{v.active!.cursor=.5;}],
] as const)('strict condition refuses %s',(_name,mutate)=>{const value=active();mutate(value);expect(validToxicFalloutCalendar294(value,294,context,parent)).toBe(false);});

test('shared Misc opportunities count the new condition alongside older actual successes',()=>{
 const w=declaredActive();expect(validMiscIncidents(w.miscIncidents,294,w)).toBe(true);
 w.miscIncidents!.heatwaves=1;w.miscIncidents!.lastHeatwaveStart=w.tick;w.miscIncidents!.active={start:w.tick,end:w.tick+9000};
 expect(validMiscIncidents(w.miscIncidents,294,w)).toBe(false);
});

test('future getters, hidden values, explicit undefined, symbols and prototypes are rejected without reading them',()=>{
 let reads=0;const w=colony(),calendar=w.miscIncidents!;
 Object.defineProperty(calendar,'toxicFallout',{enumerable:true,configurable:true,get(){reads++;return active();}});
 expect(validMiscIncidents(calendar,293,w)).toBe(false);expect(validMiscIncidents(calendar,294,w)).toBe(false);
 expect(validToxicFalloutHistoricalTransport294(w,293)).toBe(false);expect(reads).toBe(0);
 Object.defineProperty(calendar,'toxicFallout',{enumerable:false,configurable:true,value:active()});expect(validMiscIncidents(calendar,294,w)).toBe(false);
 Object.defineProperty(calendar,'toxicFallout',{enumerable:true,configurable:true,value:undefined});expect(validMiscIncidents(calendar,293,w)).toBe(false);expect(validMiscIncidents(calendar,294,w)).toBe(false);
 const value=active();Object.defineProperty(value.active!,'rng',{enumerable:true,get(){reads++;return 1;}});expect(validToxicFalloutCalendar294(value,294,context,parent)).toBe(false);expect(reads).toBe(0);
 const symbol=active();Object.assign(symbol,{[Symbol('future')]:1});expect(validToxicFalloutCalendar294(symbol,294,context,parent)).toBe(false);
 expect(validToxicFalloutCalendar294(Object.assign(Object.create({future:true}),active()),294,context,parent)).toBe(false);
});

test('historical walker finds future calendars in original and composed local-map namespaces',()=>{
 for(const envelope of [
  {worldMaps:{sites:[{map:{...context,miscIncidents:{...parent,toxicFallout:active()}}}]}},
  {campaignMap:{maps:[{map:{...context,miscIncidents:{...parent,toxicFallout:active()}}}]}},
  {secondarySite:{map:{...context,miscIncidents:{...parent,toxicFallout:active()}}}},
 ]){expect(validToxicFalloutHistoricalTransport294({...context,...envelope},293)).toBe(false);expect(validToxicFalloutHistoricalTransport294({...context,...envelope},294)).toBe(true);}
 const cycle:Record<string,unknown>={};cycle.world=cycle;expect(validToxicFalloutHistoricalTransport294(cycle,294)).toBe(false);
});

test('checkpoint refusal is atomic for public and retained presentation, then the exact valid revision retries',()=>{
 const w=declaredActive(),valid=structuredClone(new SnapshotEncoder().encode(w,0,0));if(valid.kind!=='checkpoint')throw Error('Expected checkpoint');
 const bad=structuredClone(valid);bad.world.miscIncidents!.toxicFallout!.active!.rng=0;
 for(const receiver of [new SnapshotDecoder(),new ResidentPresentationAssembler()]){
  const refused=receiver.adopt(structuredClone(bad));expect(refused.status,receiver.constructor.name+': '+JSON.stringify(refused)).toBe('resync');const result=receiver.adopt(structuredClone(valid));expect(result.status,receiver.constructor.name+': '+(result.status==='resync'?result.reason:result.status)).toBe('applied');
  if(result.status==='applied')expect(result.world.miscIncidents!.toxicFallout).toEqual(w.miscIncidents!.toxicFallout);
 }
});

test('delta refusal preserves the retained view and retries private cursor/RNG at the identical revision',()=>{
 const w=declaredActive(),encoder=new SnapshotEncoder(),receivers=[new SnapshotDecoder(),new ResidentPresentationAssembler()],opening=structuredClone(encoder.encode(w,0,0));
 const held=receivers.map(receiver=>{const r=receiver.adopt(structuredClone(opening));if(r.status!=='applied')throw Error(receiver.constructor.name+': opening '+JSON.stringify(r));return {world:r.world,before:JSON.stringify(r.world)};});
 Object.assign(w.miscIncidents!.toxicFallout!.active!,{cursor:17,rng:918});const valid=structuredClone(encoder.encode(w,0,0));if(valid.kind!=='delta')throw Error('Expected delta');
 const bad=structuredClone(valid);bad.world.miscIncidents!.toxicFallout!.active!.cursor=1024;
 for(const [i,receiver] of receivers.entries()){
  const refused=receiver.adopt(structuredClone(bad));expect(refused.status,receiver.constructor.name+': '+JSON.stringify(refused)).toBe('resync');expect(JSON.stringify(held[i]!.world),receiver.constructor.name).toBe(held[i]!.before);
  const result=receiver.adopt(structuredClone(valid));expect(result.status,receiver.constructor.name+': '+(result.status==='resync'?result.reason:result.status)).toBe('applied');if(result.status==='applied')expect(result.world.miscIncidents!.toxicFallout!.active).toEqual(w.miscIncidents!.toxicFallout!.active);
 }
});

test('corpse age credit is exact, historical-closed and cannot replace ordinary age or a victim witness',()=>{
 const rot={progress:310,atTick:100,fallout294:300};expect(validCorpseRot(rot,100,90,294)).toBe(true);
 expect(validCorpseRot({progress:300,atTick:100,fallout294:300},100,100,294)).toBe(true);
 expect(validCorpseRot({progress:300300,atTick:100,fallout294:300300},100,90,294)).toBe(false);
 expect(validCorpseRot(rot,100,90,293)).toBe(false);expect(validCorpseRot(rot,100,90,295)).toBe(true);expect(validCorpseRot(rot,100,90,296)).toBe(true);expect(validCorpseRot(rot,100,90,297)).toBe(false);
 expect(validCorpseRot({...rot,progress:311},100,90,294)).toBe(false);expect(validCorpseRot({...rot,progress:299},100,90,294)).toBe(false);
 for(const credit of [0,-300,299,301,.3,NaN,Infinity,undefined])expect(validCorpseRot({...rot,fallout294:credit},100,90,294)).toBe(false);
 expect(validToxicFalloutRotCredit294(rot,294,false)).toBe(false);
});

test('rot credit follows only actual corpse holders and is future-closed even when hidden or an accessor',()=>{
 const rot=()=>({progress:310,atTick:100,fallout294:300});
 const holders=[{piles:[{kind:'corpse',rot:rot()}]},{pawns:[{body:{rot:rot()}}]},{wildlife:{animals:[{corpseRot:rot()}]}},{worldPawns:{owners:[{actor:{corpseRot:rot()}}]}},{worldGroups:{abandonedContents:[{animals:[{animal:{corpseRot:rot()}}]}]}},{structures:[{cryptosleep:{human:{body:{rot:rot()}}}}]}];
 for(const h of holders){expect(validToxicFalloutHistoricalTransport294(h,293)).toBe(false);expect(validToxicFalloutHistoricalTransport294(h,294)).toBe(true);}
 expect(validToxicFalloutHistoricalTransport294({piles:[{kind:'material',rot:rot()}]},294)).toBe(false);
 let reads=0;const hidden={progress:10,atTick:100};Object.defineProperty(hidden,'fallout294',{enumerable:false,get(){reads++;return 300;}});
 expect(validToxicFalloutHistoricalTransport294({piles:[{kind:'corpse',rot:hidden}]},293)).toBe(false);expect(validCorpseRot(hidden,100,90,294)).toBe(false);expect(reads).toBe(0);
});

test.each(['huge credit','progress below credit','anchor before death'] as const)('both checkpoint receivers refuse physical corpse corruption: %s',kind=>{
 const {w,pile}=creditedCorpse(),valid=structuredClone(new SnapshotEncoder().encode(w,0,0));if(valid.kind!=='checkpoint')throw Error('Expected checkpoint');
 const bad=structuredClone(valid),rot=bad.world.piles.find(i=>i.id===pile.id)!.rot!;
 if(kind==='huge credit'){rot.fallout294=300300;rot.progress=300300;}else if(kind==='progress below credit')rot.progress=299;else rot.atTick=w.tick-1;
 for(const receiver of [new SnapshotDecoder(),new ResidentPresentationAssembler()]){
  const refused=receiver.adopt(structuredClone(bad));expect(refused.status,receiver.constructor.name+': '+JSON.stringify(refused)).toBe('resync');
  const resumed=receiver.adopt(structuredClone(valid));expect(resumed.status,receiver.constructor.name+': '+(resumed.status==='resync'?resumed.reason:resumed.status)).toBe('applied');
 }
});

test.each(['huge credit','progress below credit','anchor before death'] as const)('both delta receivers preserve the predecessor after physical corpse corruption: %s',kind=>{
 const {w,pile}=creditedCorpse(),encoder=new SnapshotEncoder(),opening=structuredClone(encoder.encode(w,0,0)),receivers=[new SnapshotDecoder(),new ResidentPresentationAssembler()];
 const held=receivers.map(receiver=>{const r=receiver.adopt(structuredClone(opening));if(r.status!=='applied')throw Error(receiver.constructor.name+': '+JSON.stringify(r));return {world:r.world,before:JSON.stringify(r.world)};});
 addFalloutRotAge294(pile.rot!,w.tick,true);const valid=structuredClone(encoder.encode(w,0,0));if(valid.kind!=='delta'||!valid.piles)throw Error('Expected actual changed corpse delta');
 const bad=structuredClone(valid);if(bad.kind!=='delta'||!bad.piles)throw Error('Expected delta');const rot=bad.piles.upserted.find(i=>i.id===pile.id)!.rot!;
 if(kind==='huge credit'){rot.fallout294=300300;rot.progress=300300;}else if(kind==='progress below credit')rot.progress=599;else rot.atTick=w.tick-1;
 for(const [i,receiver] of receivers.entries()){
  const refused=receiver.adopt(structuredClone(bad));expect(refused.status,receiver.constructor.name+': '+JSON.stringify(refused)).toBe('resync');expect(JSON.stringify(held[i]!.world),receiver.constructor.name).toBe(held[i]!.before);
  const resumed=receiver.adopt(structuredClone(valid));expect(resumed.status,receiver.constructor.name+': '+(resumed.status==='resync'?resumed.reason:resumed.status)).toBe('applied');
 }
});

test('the physical transport join uses actual retained clocks and refuses clinical accessors without evaluating them',()=>{
 const make=()=>({tick:500,pawns:[{id:1,state:'dead',health:{tick:100,death:{tick:100,cause:'trauma'}},body:{observedAt:100,rot:{progress:300,atTick:100,fallout294:300}}}]});
 const raw=make();expect(validToxicFalloutTransport294(raw,294)).toBe(true);expect(validToxicFalloutTransport294(raw,293)).toBe(false);
 const held={tick:500,structures:[{cryptosleep:{heldAt:99,human:raw.pawns[0]}}]};expect(validToxicFalloutTransport294(held,294)).toBe(false);
 let reads=0;Object.defineProperty(raw.pawns[0]!.health,'scaria261',{enumerable:true,get(){reads++;return {};}});expect(validToxicFalloutTransport294(raw,294)).toBe(false);expect(reads).toBe(0);
});

test('an older retained owner clock never leaks into a sibling current-map corpse credit',()=>{
 // Bounded holder-reader unit, not a complete campaign fixture. The old world
 // owner has its true retained clock50; its sibling local body exists at100.
 const raw={tick:100,width:32,height:32,worldPawns:{owners:[{clockCore:500,actor:{id:3,state:'idle'}}]},
  pawns:[{id:1,state:'dead',health:{tick:100,death:{tick:100,cause:'trauma'}},body:{observedAt:100,pileId:2}}],
  piles:[{id:2,kind:'corpse',item:'human-corpse',quantity:1,humanCorpse:{pawnId:1},rot:{progress:300,atTick:100,fallout294:300}}]};
 const before=structuredClone(raw),facts:ToxicFalloutRotFacts294={holders:[],humans:new Map()};
 expect(validToxicFalloutHistoricalTransport294(raw,294,facts)).toBe(true);expect(facts.holders).toHaveLength(1);
 expect(facts.holders[0]!.tick,'the local sibling must retain its own campaign frontier, not the previous holder clock').toBe(100);
 expect(validToxicFalloutTransport294(raw,294)).toBe(true);expect(raw).toEqual(before);
});

test('both campaign-only receivers refuse hidden future condition owners atomically and retry the valid revision',()=>{
 const w=registryCamp(),summary=campaignOnlySummary(w);expect(summary.drugPolicies).toEqual(w.drugPolicies);expect(summary.nextDrugPolicyId).toBe(w.nextDrugPolicyId);expect(validCampaignSummary(summary)).toBe(true);
 const encoder=new SnapshotEncoder(),geographic=encoder.encodeCampaignSummary(summary,true);
 const valid={type:'campaign-only' as const,epoch:1,revision:1,stepMs:0,speed:0,urgentThreats:{generation:1,pauseRevision:0,serial:0,urgentHeld:false,rows:[]},summary:geographic.state,...geographic.geography?{geography:geographic.geography}:{}};
 let reads=0;const bad=structuredClone(valid),calendar={adoptedAt:0,opportunities:0};Object.defineProperty(calendar,'toxicFallout',{enumerable:true,get(){reads++;return {adoptedAt:0,count:0};}});Object.assign(bad.summary,{miscIncidents:calendar});
 for(const receiver of [new SnapshotDecoder(),new ResidentPresentationAssembler()]){
  const refused=receiver.adoptCampaignOnly(bad);expect(refused.status,receiver.constructor.name+': '+JSON.stringify(refused)).toBe('resync');expect(reads).toBe(0);
  const resumed=receiver.adoptCampaignOnly(structuredClone(valid));expect(resumed.status,receiver.constructor.name+': '+JSON.stringify(resumed.status==='resync'?resumed.reason:resumed.status)).toBe('applied');
 }
});

test('a pile-only human corpse delta keeps its complete unchanged Pawn roster and reloads exactly',()=>{
 const {w,p,pile}=creditedCorpse(),encoder=new SnapshotEncoder(),opening=structuredClone(encoder.encode(w,0,0)),receivers=[new SnapshotDecoder(),new ResidentPresentationAssembler()],pawnBefore=JSON.stringify(p);
 const held=receivers.map(receiver=>{const r=receiver.adopt(structuredClone(opening));if(r.status!=='applied')throw Error(receiver.constructor.name+': '+JSON.stringify(r));return {world:r.world,before:JSON.stringify(r.world)};});
 addFalloutRotAge294(pile.rot!,w.tick,true);expect(JSON.stringify(p)).toBe(pawnBefore);expect(validateWorld(w)).toEqual([]);const saved=serializeWorld(w);expect(serializeWorld(deserializeWorld(saved))).toBe(saved);
 const delta=structuredClone(encoder.encode(w,0,0));if(delta.kind!=='delta'||!delta.piles)throw Error('Expected pile-only delta');
 expect(Array.isArray(delta.world.pawns)).toBe(true);expect(JSON.stringify(delta.world.pawns.find(person=>person.id===p.id))).toBe(pawnBefore);expect(delta.piles.upserted.map(i=>i.id)).toEqual([pile.id]);
 for(const [i,receiver] of receivers.entries()){
  const r=receiver.adopt(structuredClone(delta));expect(r.status,receiver.constructor.name+': '+(r.status==='resync'?r.reason:r.status)).toBe('applied');expect(JSON.stringify(held[i]!.world),receiver.constructor.name).toBe(held[i]!.before);
  if(r.status==='applied'){expect(r.world.piles.find(i=>i.id===pile.id)!.rot).toEqual(pile.rot);expect(JSON.stringify(r.world.pawns.find(person=>person.id===p.id))).toBe(pawnBefore);}
 }
});

test.each(['removed','replaced'] as const)('a corpse-credit delta cannot borrow its prior human when the incoming owner is %s',kind=>{
 const {w,p,pile}=creditedCorpse(),encoder=new SnapshotEncoder(),opening=structuredClone(encoder.encode(w,0,0)),receivers=[new SnapshotDecoder(),new ResidentPresentationAssembler()];
 const held=receivers.map(receiver=>{const r=receiver.adopt(structuredClone(opening));if(r.status!=='applied')throw Error(receiver.constructor.name+': '+JSON.stringify(r));return {world:r.world,before:JSON.stringify(r.world)};});
 addFalloutRotAge294(pile.rot!,w.tick,true);const valid=structuredClone(encoder.encode(w,0,0));if(valid.kind!=='delta'||!valid.piles)throw Error('Expected corpse delta');const bad=structuredClone(valid);
 if(kind==='removed')bad.world.pawns=bad.world.pawns.filter(person=>person.id!==p.id);else{const replacement=bad.world.pawns.find(person=>person.id===p.id)!;delete replacement.body;replacement.state='idle';replacement.health=createMedicalRecord(w.tick);}
 for(const [i,receiver] of receivers.entries()){
  const r=receiver.adopt(structuredClone(bad));expect(r.status,receiver.constructor.name+': '+JSON.stringify(r)).toBe('resync');expect(JSON.stringify(held[i]!.world),receiver.constructor.name).toBe(held[i]!.before);
  const resumed=receiver.adopt(structuredClone(valid));expect(resumed.status,receiver.constructor.name+': '+(resumed.status==='resync'?resumed.reason:resumed.status)).toBe('applied');
 }
});

test.each(['invalid registry','missing next ID','missing registry','explicit undefined pair'] as const)('campaign-only keeps its two policy owners strict: %s',kind=>{
 const w=registryCamp(),summary=campaignOnlySummary(w);expect(validCampaignSummary(summary)).toBe(true);const encoder=new SnapshotEncoder(),geographic=encoder.encodeCampaignSummary(summary,true);
 const opening={type:'campaign-only' as const,epoch:1,revision:1,stepMs:0,speed:0,urgentThreats:{generation:1,pauseRevision:0,serial:0,urgentHeld:false,rows:[]},summary:geographic.state,...geographic.geography?{geography:geographic.geography}:{}};
 const valid={...structuredClone(opening),revision:2},bad=structuredClone(valid);
 if(kind==='invalid registry')bad.summary.drugPolicies![0]!.beer.daysFrequency=0;else if(kind==='missing next ID')delete bad.summary.nextDrugPolicyId;else if(kind==='missing registry')delete bad.summary.drugPolicies;else Object.assign(bad.summary,{drugPolicies:undefined,nextDrugPolicyId:undefined});
 for(const receiver of [new SnapshotDecoder(),new ResidentPresentationAssembler()]){
  const initial=receiver.adoptCampaignOnly(structuredClone(opening));if(initial.status!=='applied')throw Error(receiver.constructor.name+': opening '+JSON.stringify(initial));const before=JSON.stringify(initial.summary);
  const r=receiver.adoptCampaignOnly(structuredClone(bad));expect(r.status,receiver.constructor.name+': '+JSON.stringify(r)).toBe('resync');expect(JSON.stringify(initial.summary),receiver.constructor.name).toBe(before);
  const resumed=receiver.adoptCampaignOnly(structuredClone(valid));expect(resumed.status,receiver.constructor.name+': '+JSON.stringify(resumed.status==='resync'?resumed.reason:resumed.status)).toBe('applied');
 }
});

test('schema264 still refuses the two prospective policy fields in a campaign summary',()=>{
 const w=registryCamp(),summary=campaignOnlySummary(w);
 // Explicit synthetic264 recipe: only fields already represented by264 are
 // retained. Besides the265 policy pair,284 trade requests and286 linked
 // storage (including own undefined keys) never belonged to this contract.
 const keys264=new Set(['schemaVersion','tick','rng','nextId','planet','worldFactions','worldPawns','worldSites263','research','relationships','foodPolicies','nextFoodPolicyId','apparelPolicies','nextApparelPolicyId','foodRules','restRules','gameProfile','worldIncidents','civilTick','calendarOrigin','campaignSeed','mapSize','events','people','groupLosses','lossContexts','lostMemories','activeMapId','rootMapId','maxSettlements','selectedGroupId','maps','groups','incidents','bedRefs','animalLosses','retiredCamps','worldPawnOrigins','nextAncientCasketGroupId']);
 const withoutPolicies={...Object.fromEntries(Object.entries(summary).filter(([key])=>keys264.has(key))),schemaVersion:264};
 // New constructors enable the267 smithing catalogue. The diagnosed264
 // fixture instead uses its native pre267 catalogue, preserving the same two
 // initial policy IDs, labels, quality ranges and hit-point thresholds.
 Object.assign(withoutPolicies,createDefaultApparelPolicyRegistry(true,true,true,true,false,false,false));
 const view264=groupWorld(withoutPolicies as unknown as typeof summary,null),shared264=view264?validateCampaignSharedFields(view264):['No campaign-only264 view'];
 expect(validCampaignSummary(withoutPolicies),JSON.stringify({shared264,researchKeys:Object.keys(view264?.research??{}),keys:Object.keys(withoutPolicies)})).toBe(true);
 const historical={...withoutPolicies,drugPolicies:summary.drugPolicies,nextDrugPolicyId:summary.nextDrugPolicyId};
 expect(validCampaignSummary(historical)).toBe(false);
 const encoder=new SnapshotEncoder(),geographic=encoder.encodeCampaignSummary(withoutPolicies as unknown as typeof summary,true),packet={type:'campaign-only' as const,epoch:1,revision:1,stepMs:0,speed:0,urgentThreats:{generation:1,pauseRevision:0,serial:0,urgentHeld:false,rows:[]},summary:{...geographic.state,drugPolicies:summary.drugPolicies,nextDrugPolicyId:summary.nextDrugPolicyId},...geographic.geography?{geography:geographic.geography}:{}};
 for(const receiver of [new SnapshotDecoder(),new ResidentPresentationAssembler()]){const r=receiver.adoptCampaignOnly(structuredClone(packet));expect(r.status,receiver.constructor.name+': '+JSON.stringify(r)).toBe('resync');}
});
