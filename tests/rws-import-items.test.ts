import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {convertRwsSave,ImportContext,placeGear} from '../src/import/rimworld/convert.ts';
import {readRwsSave,readThing} from '../src/import/rimworld/rws-save.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {placeRwsMaterial,placeRwsPacked,importRwsFilth,importRwsCarried,importRwsGearExtras,resolveRwsArtAuthor,bindRwsEggParents} from '../src/import/rimworld/convert-items.ts';
import {analyzeRwsSave} from '../src/import/rimworld/analyze.ts';
import {groundCapacity,groundPilesAt} from '../src/sim/ground-placement.ts';
import {shelfAt} from '../src/sim/shelf-storage.ts';
import {terrainAcceptsFilth256} from '../src/sim/natural-terrain-runtime-256.ts';
import {validateFilth} from '../src/sim/filth-save.ts';
import {filthCheckPeriod} from '../src/sim/filth-rules.ts';
import {validatePreservation} from '../src/sim/food-preservation-save.ts';
import {validateThingDamage} from '../src/sim/fire-save.ts';
import {validateInterruptedCargo} from '../src/sim/interrupted-cargo.ts';
import {validatePackedFurnitureRecords} from '../src/sim/furniture-transfer-save.ts';
import {validEggPile256} from '../src/sim/animal-egg-save-v256.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {validateWorld,serializeWorld,deserializeWorld} from '../src/sim/serialization.ts';
import {importRwsCorpses} from '../src/import/rimworld/import-corpses.ts';
import {validateCorpses} from '../src/sim/corpse-save.ts';
import {validateBurials,validHumanBodyShape} from '../src/sim/burial-save.ts';
import {humanLimbVisualMask} from '../src/render/human-anatomy-presentation.ts';
import {corpsePartAbsent,validCorpseConsumption} from '../src/sim/corpse-anatomy.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {at} from '../src/import/rimworld/xml.ts';
import {animalPartId256} from '../src/sim/animal-anatomy-v256.ts';

const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
function context(){
 const save=readRwsSave(fixture),conversion=convertRwsSave(save,{planet:false});
 const ctx=new ImportContext(save,save.maps[0]!,conversion.world,new ImportNotes(),false);
 for(const [source,id] of conversion.thingIds)ctx.thingIds.set(source,id);
 return ctx;
}
const thing=(xml:string)=>readThing(parseXml(xml));
function free(ctx:ImportContext){
 const w=ctx.w;
 return w.tiles.map((_,i)=>({x:i%w.width,z:Math.floor(i/w.width)}))
  .find(c=>!shelfAt(w,c)&&!groundPilesAt(w,c).length&&groundCapacity(w,c,'wood')>=1)!;
}
describe('RimWorld physical item adoption',()=>{
 it('does not report already implemented trace/packed/corpse owners as missing features during the preliminary analysis',()=>{
  const save=readRwsSave(fixture),map=save.maps[0]!;
  map.things.push(thing('<thing Class="Filth"><def>Filth_Ash</def><id>Ash</id></thing>'),thing('<thing Class="Filth"><def>Filth_AnimalFilth</def><id>UnknownTrace</id></thing>'),
   thing('<thing Class="MinifiedThing"><def>MinifiedThing</def><innerContainer><innerList><li><def>Table1x2c</def></li></innerList></innerContainer></thing>'),
   thing('<thing Class="Corpse"><def>Corpse_Human</def></thing>'),thing('<thing><def>TextBook</def></thing>'));
  const rows=[...(analyzeRwsSave(save).notes.tallies.get('items')?.values()??[])];
  expect(rows.find(r=>r.def==='Filth_Ash')).toMatchObject({status:'exact',to:'ash'});
  expect(rows.find(r=>r.def==='Filth_AnimalFilth')).toMatchObject({status:'dropped',origin:'model'});
  expect(rows.find(r=>r.def==='MinifiedThing (Table1x2c)')).toMatchObject({status:'adapted',to:'table'});
  expect(rows.find(r=>r.def==='Corpse_Human')).toMatchObject({status:'adapted',to:'human-corpse'});
  expect(rows.find(r=>r.def==='TextBook')).toMatchObject({status:'dropped',origin:'model'});
 });
 it('attributes an existing artwork only to the unique complete actual source name',()=>{
  const ctx=context(),p=ctx.w.pawns.find(p=>p.name.startsWith('Alma'))!;
  expect(resolveRwsArtAuthor(ctx,`<color=#aabbcc>Alma 'Fourmi' Rivière</color>`)).toBe(p);
  expect(resolveRwsArtAuthor(ctx,'Alma')).toBeUndefined();
  ctx.w.pawns.push({...p,id:1_000_000});ctx.thingIds.set('SecondActualAuthor',1_000_000);
  expect(resolveRwsArtAuthor(ctx,`Alma 'Fourmi' Rivière`)).toBeUndefined();
 });
 it('restores the per-stack age, contamination, damage and independent inventory identities',()=>{
  const ctx=context(),w=ctx.w,pawnId=w.pawns[0]!.id,owner={type:'inventory' as const,pawnId};
  const a=placeRwsMaterial(ctx,thing('<thing><def>MealFine</def><id>A</id><stackCount>2</stackCount><health>49</health><rotProg>82917.82</rotProg><poisonPct>0.013</poisonPct><cause>FilthyKitchen</cause></thing>'),owner)!;
  const b=placeRwsMaterial(ctx,thing('<thing><def>MealFine</def><id>B</id><stackCount>3</stackCount><health>50</health><rotProg>18000</rotProg></thing>'),owner)!;
  expect(a).toMatchObject({owner,item:'fine-meal',quantity:2,rot:{progress:82917.82/10,atTick:w.tick},foodPoison:{fraction:.013,cause:'filthy-kitchen'},damage:1});
  expect(b).toMatchObject({owner,item:'fine-meal',quantity:3,rot:{progress:1800,atTick:w.tick}});
  expect(a.id).not.toEqual(b.id);expect(ctx.thingIds.get('A')).toEqual(a.id);
  expect(validatePreservation(w,w.schemaVersion)).toEqual([]);expect(validateThingDamage(w,w.schemaVersion)).toEqual([]);
 });
 it('imports fertilised eggs with original progress and permission, not ordinary eggs',()=>{
  const ctx=context(),w=ctx.w,owner={type:'ground' as const,...free(ctx)};
  const egg=placeRwsMaterial(ctx,thing(`<thing><def>EggDuckFertilized</def><id>EggA</id><stackCount>11</stackCount><gestateProgress>0.920208097</gestateProgress><hatcheeFaction>${ctx.save.playerFaction}</hatcheeFaction><forbidden>True</forbidden></thing>`),owner)!;
  expect(egg).toMatchObject({owner,item:'duck-egg-fertilized',quantity:11,eggForbidden:true,egg:{progress:.920208097,temperatureDamage:0,faction:'player',atTick:w.tick}});
  expect(validEggPile256(egg,w.schemaVersion,w.tick,w.nextId)).toBe(true);refreshStock(w);expect(validateWorld(w)).toEqual([]);
 });
 it('supports late parent binding without bypassing the native inventory restrictions',()=>{
  const save=readRwsSave(fixture),map=save.maps[0]!,human=map.things.find(t=>t.id==='Human1')!;
  at(human.node,'inventory/innerContainer/innerList')!.children.push(parseXml(`<li Class="ThingWithComps"><def>EggDuckFertilized</def><id>LateEgg</id><hatcheeFaction>${save.playerFaction}</hatcheeFaction><hatcheeParent>Thing_LateDuck</hatcheeParent><gestateProgress>0.2</gestateProgress></li>`));
  map.things.push(thing(`<thing Class="Pawn"><def>Duck</def><id>LateDuck</id><pos>(15,0,3)</pos><kindDef>Duck</kindDef><gender>Female</gender><faction>${save.playerFaction}</faction><ageTracker><ageBiologicalTicks>6000000</ageBiologicalTicks><growth>1</growth></ageTracker></thing>`));
  const result=convertRwsSave(save,{planet:false}),w=result.world,duck=result.thingIds.get('LateDuck')!;
  expect(duck).toBeDefined();
  expect(result.thingIds.has('LateEgg')).toBe(false); // Native colonist inventory does not admit eggs.
  expect([...result.notes.tallies.get('items')!.values()].find(v=>v.def==='EggDuckFertilized (inventaire)')).toMatchObject({status:'dropped',origin:'model'});
  const ctx=new ImportContext(save,map,w,new ImportNotes(),false);
  const egg=placeRwsMaterial(ctx,readThing(at(human.node,'inventory/innerContainer/innerList')!.children.at(-1)!),{type:'ground',...free(ctx)})!;
  expect(egg.egg?.motherId).toBeUndefined();ctx.thingIds.set('LateDuck',duck);bindRwsEggParents(ctx);
  expect(egg.egg).toMatchObject({motherId:duck,progress:.2});
  refreshStock(w);expect(validateWorld(w)).toEqual([]);
 });
 it('keeps the real novel title, flavor, health and quality from its joy factor',()=>{
  const ctx=context(),w=ctx.w,owner={type:'ground' as const,...free(ctx)};
  const novel=placeRwsMaterial(ctx,thing('<thing><def>Novel</def><id>BookA</id><health>59</health><title>Titre original</title><descriptionFlavor>Texte enregistré du roman.</descriptionFlavor><joyFactor>1.20000005</joyFactor></thing>'),owner)!;
  expect(novel).toMatchObject({owner,item:'novel',kind:'book',quantity:1,damage:1,book:{revision:1,quality:'awful',title:'Titre original',description:'Texte enregistré du roman.'}});
  refreshStock(w);expect(validateWorld(w)).toEqual([]);
 });
 it('retains the supported active flak tint without pretending a foreign custom hue is representable',()=>{
  const ctx=context(),owner={type:'ground' as const,...free(ctx)};
  const source=thing('<thing><def>Apparel_FlakPants</def><id>TintedPants</id><color>RGBA(0.620, 0.620, 0.620, 1.000)</color><colorActive>True</colorActive></thing>');
  const pile=placeGear(ctx,source,owner)!;
  importRwsGearExtras(ctx,source,pile);
  expect(pile.apparel?.birthColor).toEqual({r:Math.fround(.62),g:Math.fround(.62),b:Math.fround(.62)});
  const foreign=thing('<thing><def>Apparel_FlakPants</def><id>ForeignTint</id><color>RGBA(0.900, 0.200, 0.300, 1.000)</color><colorActive>True</colorActive></thing>');
  const changed=placeGear(ctx,foreign,{type:'ground',...free(ctx)})!;
  importRwsGearExtras(ctx,foreign,changed);expect(changed.apparel?.birthColor).toBeUndefined();
 });
 it('keeps actual traces in their reflected cell rather than scattering/regenerating them',()=>{
  const ctx=context(),w=ctx.w,local=free(ctx),source=ctx.coordinates.cell(local);
  expect(terrainAcceptsFilth256(w.tiles[ctx.index(local)]!)).toBe(true);
  ctx.map.things.push(thing(`<thing Class="Filth"><def>Filth_Ash</def><id>Trace</id><pos>(${source.x},0,${source.z})</pos><thickness>3</thickness><growTick>${Math.max(0,ctx.save.ticksGame-42)}</growTick><disappearAfterTicks>650000</disappearAfterTicks></thing>`));
  importRwsFilth(ctx);
  const trace=w.filth!.items.find(f=>f.id===ctx.thingIds.get('Trace'))!;
  expect(trace).toMatchObject({...local,kind:'ash',thickness:3});
  expect(validateFilth(w,w.schemaVersion)).toEqual([]);
 });
 it('anchors old filth deadlines to the macro clock when importing a physical substep',()=>{
  const ctx=context(),w=ctx.w,period=filthCheckPeriod(w);
  w.phaseCore297=8;
  const macro=w.tick*10;
  const index=w.tiles.findIndex((tile,i)=>{
   const phase=(Math.imul(i,1103515245)>>>0)%period,delta=(phase-macro%period+period)%period;
   return delta>0&&delta<=8&&terrainAcceptsFilth256(tile);
  });
  expect(index).toBeGreaterThanOrEqual(0);
  const cell=ctx.coordinates.cell({x:index%w.width,z:Math.floor(index/w.width)});
  ctx.map.things.push(thing(`<thing Class="Filth"><def>Filth_Ash</def><id>OldTrace</id><pos>(${cell.x},0,${cell.z})</pos><growTick>${ctx.save.ticksGame-42}</growTick><disappearAfterTicks>650000</disappearAfterTicks></thing>`));
  importRwsFilth(ctx);
  const trace=w.filth!.items.find(f=>f.id===ctx.thingIds.get('OldTrace'))!;
  expect(trace.nextCheckCore).toBeGreaterThan(macro);expect(trace.nextCheckCore).toBeLessThanOrEqual(macro+period);
  expect(validateFilth(w,w.schemaVersion)).toEqual([]);
 });
 it('imports a real minified table, its inner material/quality and its outer owner',()=>{
  const ctx=context(),w=ctx.w,owner={type:'ground' as const,...free(ctx)};
  const packed=placeRwsPacked(ctx,thing('<thing Class="MinifiedThing"><def>MinifiedThing</def><id>Pack</id><innerContainer><innerList><li Class="Building"><def>Table1x2c</def><id>ActualTable</id><pos>(5,0,9)</pos><rot>2</rot><stuff>WoodLog</stuff><quality>Good</quality><health>10</health></li></innerList></innerContainer></thing>'),owner)!;
  expect(packed).toMatchObject({owner,building:{kind:'table',orientation:0,material:'wood',quality:'good'}});
  expect(ctx.thingIds.get('Pack')).toEqual(packed.building.id);expect(ctx.thingIds.get('ActualTable')).toEqual(packed.building.id);
  expect(validatePackedFurnitureRecords([packed],w,w.schemaVersion,new Set<number>())).toEqual([]);
 });
 it('preserves a minified tree original, frozen true growth and remaining lifetime',()=>{
  const ctx=context(),w=ctx.w,owner={type:'ground' as const,...free(ctx)};
  const pile=placeRwsMaterial(ctx,thing(`<thing Class="MinifiedTree"><def>MinifiedTree</def><id>TreePack</id><health>90</health><ticksTillDeath>415000</ticksTillDeath><innerContainer><innerList><li Class="Plant"><def>Plant_TreeOak</def><id>ActualOak</id><pos>(6,0,7)</pos><despawnedTick>${ctx.save.ticksGame-5000}</despawnedTick><health>190</health><growth>0.7</growth></li></innerList></innerContainer></thing>`),owner)!;
  const note=JSON.stringify([...ctx.notes.tallies.values()].flatMap(x=>[...x.values()]));
  expect(pile,note).toMatchObject({item:'minified-tree',kind:'plant',owner,quantity:1,damage:10,innerResource:{kind:'tree',species:'oak',x:6,z:w.height-1-7,growth:.7,growthTick:w.tick-500},plantPack:{packedAt:w.tick-500,expiresAt:w.tick+41500}});
  expect(ctx.thingIds.get('ActualOak')).toBe(pile.innerResource!.id);expect(ctx.thingIds.get('TreePack')).toBe(pile.id);
  expect(w.resources.some(r=>r.id===pile.innerResource!.id)).toBe(false);
  refreshStock(w);expect(validateWorld(w)).toEqual([]);
 });
 it('retains actual in-hand cargo as an interrupted holder, with no invented job',()=>{
  const ctx=context(),w=ctx.w,source=ctx.map.things.find(t=>t.def==='Human'&&ctx.thingIds.has(t.id))!,p=w.pawns.find(p=>p.id===ctx.thingIds.get(source.id))!;
  source.node.children.push(parseXml('<carryTracker><innerContainer><innerList><li Class="ThingWithComps"><def>Hay</def><id>HayCarry</id><stackCount>24</stackCount><rotProg>42000</rotProg></li></innerList></innerContainer></carryTracker>'));
  importRwsCarried(ctx);refreshStock(w);
  const cargo=w.piles.find(p=>p.id===ctx.thingIds.get('HayCarry'))!;
  expect(cargo).toMatchObject({owner:{type:'pawn',pawnId:p.id},quantity:24,rot:{progress:4200,atTick:w.tick}});
  expect(p.interruptedCargo).toBe(true);expect(p.jobId).toBe(null);expect(p.haul).toBe(null);
  expect(validateInterruptedCargo(w)).toEqual([]);expect(validateWorld(w)).toEqual([]);
 });
 it('binds an actual animal corpse reference to the saved dead owner, condition and chronology',()=>{
  const ctx=context(),w=ctx.w,now=ctx.save.ticksGame;
  // Detached import can preserve a death earlier than the current clock.
  // The rest of this synthetic fixture is not simulated in this domain test.
  w.tick=Math.floor(now/10);w.phaseCore297=now%10;
  const world=at(ctx.save.game,'world')!;
  const consumedCore=now-2003;
  const absent=(index:number)=>`<li Class="Hediff_MissingPart"><def>MissingBodyPart</def><tickAdded>${consumedCore}</tickAdded><lastInjury>Bite</lastInjury>${index===20?'<isFresh>True</isFresh>':''}<part><body>QuadrupedAnimalWithPawsAndTail</body><index>${index}</index></part></li>`;
  world.children.push(parseXml(`<worldPawns><pawnsDead><li Class="Pawn"><def>Hare</def><id>ActualDeadHare</id><gender>Female</gender><ageTracker><ageBiologicalTicks>6000000</ageBiologicalTicks><growth>1</growth></ageTracker><healthTracker><healthState>Dead</healthState><hediffSet><hediffs><li><def>BloodLoss</def><severity>1</severity></li>${absent(20)}${absent(21)}</hediffs></hediffSet></healthTracker></li></pawnsDead></worldPawns>`));
  const local=free(ctx),source=ctx.coordinates.cell(local);
  ctx.map.things.push(thing(`<thing Class="Corpse"><def>Corpse_Hare</def><id>ActualCorpse</id><pos>(${source.x},0,${source.z})</pos><timeOfDeath>${now-2400}</timeOfDeath><rotProg>1350</rotProg><health>87</health><forbidden>True</forbidden><innerContainer><contentsLookMode>Reference</contentsLookMode><innerList><li>Thing_ActualDeadHare</li></innerList></innerContainer></thing>`));
  importRwsCorpses(ctx);
  const pile=w.piles.find(p=>p.id===ctx.thingIds.get('ActualCorpse'))!;
  expect(pile,JSON.stringify([...ctx.notes.tallies.values()].flatMap(m=>[...m.values()]))).toMatchObject({owner:{type:'ground',...local},item:'hare-corpse',quantity:1,damage:13,forbidden:true,rot:{progress:135,atTick:w.tick},corpse:{species:'hare',sex:'female',ageTicks:600000,ageCoreRemainder:0,health:{death:{tick:w.tick-240,cause:'blood-loss'}}}});
  expect(ctx.thingIds.get('ActualDeadHare')).toBe(pile.id);
  expect(pile.corpse?.health.missing).toEqual([]);
  expect(pile.corpse?.consumedParts).toEqual([{part:animalPartId256('QuadrupedAnimalWithPawsAndTail',20),atTick:Math.floor(consumedCore/10),atCore382:consumedCore}]);
  expect(corpsePartAbsent(pile.corpse!,animalPartId256('QuadrupedAnimalWithPawsAndTail',21))).toBe(true);
  expect(validCorpseConsumption(pile.corpse!,w.tick,381)).toBe(false);
  expect(ctx.notes.summary('health').exact).toBeGreaterThanOrEqual(3);
  expect(w.wildlife?.animals.some(a=>a.id===pile.id)).toBe(false);
  expect(validateCorpses(w,w.schemaVersion)).toEqual([]);
 });
 it('requires actual fatal evidence and does not fabricate a cause for a dead animal',()=>{
  const ctx=context(),w=ctx.w,source=ctx.coordinates.cell(free(ctx)),id=w.nextId;
  ctx.map.things.push(thing(`<thing Class="Corpse"><def>Corpse_Hare</def><id>UnexplainedCorpse</id><pos>(${source.x},0,${source.z})</pos><timeOfDeath>${ctx.save.ticksGame}</timeOfDeath><innerContainer><innerList><li Class="Pawn"><def>Hare</def><id>UnexplainedHare</id><ageTracker><ageBiologicalTicks>6000000</ageBiologicalTicks><growth>1</growth></ageTracker><healthTracker><healthState>Dead</healthState><hediffSet><hediffs/></hediffSet></healthTracker></li></innerList></innerContainer></thing>`));
  importRwsCorpses(ctx);
  expect(w.nextId).toBe(id);expect(ctx.thingIds.has('UnexplainedCorpse')).toBe(false);
  expect(ctx.notes.summary('items').dropped).toBe(1);
 });
 it('retains a genuinely buried human body, dead identity and frozen soil-holder rot',()=>{
  const ctx=context(),w=ctx.w,now=ctx.save.ticksGame,cell=free(ctx),source=ctx.coordinates.cell(cell);
  w.tick=Math.floor(now/10);w.phaseCore297=now%10;
  const graveId=w.nextId++;
  w.structures.push({id:graveId,kind:'grave',...cell,orientation:0,footprint:'standard',grave:{colonists:true,strangers:true}});
  ctx.thingIds.set('SavedGrave',graveId);
  const consumedCore=now-2003,absent=Array.from({length:9},(_,i)=>`<li Class="Hediff_MissingPart"><def>MissingBodyPart</def><tickAdded>${consumedCore}</tickAdded><lastInjury>Bite</lastInjury>${i===0?'<isFresh>True</isFresh>':''}<part><body>Human</body><index>${46+i}</index></part></li>`).join('');
  const inner=`<li Class="Pawn"><def>Human</def><id>TrueDeadHuman</id><faction>${ctx.save.playerFaction}</faction><gender>Female</gender><name Class="NameTriple"><first>Alice</first><nick>Alice</nick><last>Test</last></name><ageTracker><ageBiologicalTicks>90000000</ageBiologicalTicks></ageTracker><healthTracker><healthState>Dead</healthState><hediffSet><hediffs><li><def>BloodLoss</def><severity>1</severity></li>${absent}</hediffs></hediffSet></healthTracker></li>`;
  const body=`<li Class="Corpse"><def>Corpse_Human</def><id>TrueHumanCorpse</id><timeOfDeath>${now-3000}</timeOfDeath><health>100</health><rotProg>1500</rotProg><innerContainer><innerList>${inner}</innerList></innerContainer></li>`;
  ctx.map.things.push(thing(`<thing Class="Building"><def>Grave</def><id>SavedGrave</id><pos>(${source.x},0,${source.z})</pos><innerContainer><innerList>${body}</innerList></innerContainer></thing>`));
  importRwsCorpses(ctx);
  const corpse=w.piles.find(p=>p.id===ctx.thingIds.get('TrueHumanCorpse'))!,pawn=w.pawns.find(p=>p.id===ctx.thingIds.get('TrueDeadHuman'))!;
  const failure=JSON.stringify([...ctx.notes.tallies.values()].flatMap(m=>[...m.values()]));
  expect(corpse,failure).toMatchObject({owner:{type:'grave',graveId},kind:'corpse',item:'human-corpse',rot:{progress:150,atTick:w.tick,rate:0}});
  expect(pawn,failure).toMatchObject({state:'dead',body:{pileId:corpse.id,observedAt:w.tick-300},health:{death:{tick:w.tick-300,cause:'blood-loss'}}});
  expect(pawn.health?.missing).toEqual([]);
  expect(pawn.body?.consumedParts382).toEqual([{part:'left-leg',atTick:Math.floor(consumedCore/10),atCore382:consumedCore}]);
  expect(humanLimbVisualMask(pawn)).toBe(4);
  expect(validHumanBodyShape(pawn.body,381,w.tick,pawn.health)).toBe(false);
  expect(validHumanBodyShape({...pawn.body,consumedParts382:[{part:'left-leg',atTick:w.tick+1}]},w.schemaVersion,w.tick,pawn.health)).toBe(false);
  expect(w.structures.find(s=>s.id===graveId)?.grave?.corpseId).toBe(corpse.id);
  expect(validateBurials(w,w.schemaVersion)).toEqual([]);
  refreshStock(w);expect(validateWorld(w)).toEqual([]);
  const saved=serializeWorld(w);expect(serializeWorld(deserializeWorld(saved))).toBe(saved);
  const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();
  const adopted=decoder.adopt(structuredClone(encoder.encode(w,0,6)));
  expect(adopted.status).toBe('applied');if(adopted.status==='applied')expect(adopted.world.pawns.find(p=>p.id===pawn.id)?.body).toEqual(pawn.body);
 });
});
