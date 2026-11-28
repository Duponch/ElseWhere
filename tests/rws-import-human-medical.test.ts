import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {convertRwsSave} from '../src/import/rimworld/convert.ts';
import {at,parseXml} from '../src/import/rimworld/xml.ts';
import {validateWorld,serializeWorld,deserializeWorld} from '../src/sim/serialization.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {advanceHumanAgeAt,HUMAN_YEAR_TICKS} from '../src/sim/human-age.ts';
import {syncNativeHumanClinicalScale256} from '../src/sim/native-human-clinical-scale-256.ts';
import {nativeHumanBiologicalCore256} from '../src/sim/native-human-identity-256.ts';
import {forgetHumanMemory382,alzheimerMoodThoughts382} from '../src/sim/human-alzheimer-382.ts';
import {animalClinicalRandom256} from '../src/sim/animal-condition-medical-frontier-256.ts';

const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
const part=(index:number)=>`<part><body>Human</body><index>${index}</index></part>`;
const condition=(def:string,extra:string)=>`<li Class="HediffWithComps"><def>${def}</def>${extra}</li>`;
it('preserves actual native human hediffs, Core comp random factors and anatomical parts',()=>{
 const save=readRwsSave(fixture),node=save.maps[0]!.things.find(t=>t.id==='Human1')!.node,list=at(node,'healthTracker/hediffSet/hediffs')!;
 for(const r of [condition('HeartArteryBlockage',`${part(6)}<severity>0.0200146399</severity><tickAdded>300000</tickAdded><ageTicks>60000</ageTicks><severityPerDayNotImmuneRandomFactor>2.67916346</severityPerDayNotImmuneRandomFactor>`),condition('Asthma',`${part(8)}<severity>0.0132674491</severity><tickAdded>326000</tickAdded><ageTicks>33995</ageTicks><tendTicksLeft>393499</tendTicksLeft><tendQuality>0.285439491</tendQuality><totalTendQuality>0.285439491</totalTendQuality>`),condition('HearingLoss',`${part(19)}<severity>0.00100000005</severity>`),condition('BadBack',`${part(4)}<severity>0.00100000005</severity>`),condition('Carcinoma',`${part(47)}<severity>0.431401163</severity><ageTicks>1364</ageTicks><severityPerDayGrowingRandomFactor>0.943916321</severityPerDayGrowingRandomFactor><severityPerDayRemissionRandomFactor>1.49086118</severityPerDayRemissionRandomFactor>`)])list.children.push(parseXml(r));
 const c=convertRwsSave(save,{planet:false}),p=c.world.pawns.find(q=>q.id===c.thingIds.get('Human1'))!;
 expect(p.nativeHuman?.sourceThingId382).toBe(1);expect(p.health?.ageAilments).toBeUndefined();
 const cases=p.health?.animalAgeConditions?.cases??[];
 expect(cases.find(x=>x.kind==='HeartArteryBlockage')).toMatchObject({part:'heart',bornAt:30000,ageCore:60000,severity:Math.fround(.0200146399),severityFactor:Math.fround(2.67916346)});
 expect(cases.find(x=>x.kind==='Asthma')).toMatchObject({bornAt:32600,ageCore:33995,tend:{ticksLeft:393499,quality:Math.fround(.285439491),totalQuality:Math.fround(.285439491)}});
 expect(cases.find(x=>x.kind==='BadBack')?.part).toBe('spine');expect(cases.find(x=>x.kind==='HearingLoss')).toBeDefined();
 expect(cases.find(x=>x.kind==='Carcinoma')?.growth).toEqual({mode:0,growingFactor:Math.fround(.943916321),remissionFactor:Math.fround(1.49086118)});
 expect(validateWorld(c.world)).toEqual([]);
});

it('imports a real wound infection, immunity and anesthesia; refuses whole-body debug hediffs or a missing food source',()=>{
 const save=readRwsSave(fixture),node=save.maps[0]!.things.find(t=>t.id==='Human2')!.node,list=at(node,'healthTracker/hediffSet/hediffs')!;
 at(node,'healthTracker')!.children.push(parseXml('<immunity><imList><li><hediffDef>WoundInfection</hediffDef><source>WoundInfection</source><immunity>0.12997891</immunity></li></imList></immunity>'));
 for(const r of [condition('WoundInfection',`${part(0)}<severity>0.14374347</severity><tickAdded>348000</tickAdded><ageTicks>12000</ageTicks><tendTicksLeft>34501</tendTicksLeft><tendQuality>0.992565989</tendQuality>`),condition('Anesthetic','<severity>0.73333335</severity><tickAdded>340000</tickAdded><ageTicks>20000</ageTicks><ticksToDisappear>70000</ticksToDisappear>'),condition('Alzheimers','<severity>0.00159999763</severity><tickAdded>345000</tickAdded>'),condition('FoodPoisoning','<severity>0.2</severity><tickAdded>359000</tickAdded>')])list.children.push(parseXml(r));
 const c=convertRwsSave(save,{planet:false}),p=c.world.pawns.find(q=>q.id===c.thingIds.get('Human2'))!;
 expect(p.health?.infections).toMatchObject({immunity:129978910,cases:[{part:'torso',bornAt:34800,severity:143743470,tend:{quality:993,expiresAtCore:394501}}]});
 expect(p.health?.anesthetic).toEqual({bornAt:34000/10*10,expiresAtCore:430000,severity:733333334,remainder:2});
 expect(p.health?.animalAgeConditions?.cases.some(x=>x.kind==='Alzheimers')??false).toBe(false);expect(p.health?.foodPoisoning).toBeUndefined();
 const notes=[...(c.notes.tallies.get('health')?.values()??[])];expect(notes.some(x=>x.def==='Alzheimers'&&x.status==='dropped')).toBe(true);expect(notes.some(x=>x.def==='FoodPoisoning'&&x.status==='dropped')).toBe(true);
 expect(validateWorld(c.world)).toEqual([]);
});

it('preserves a living Alzheimer condition and simulates it with an explicit remaining deterministic model gap',()=>{
 const save=readRwsSave(fixture),node=save.maps[0]!.things.find(t=>t.id==='Human1')!.node;
 at(node,'healthTracker/hediffSet/hediffs')!.children.push(parseXml(condition('Alzheimers',`${part(15)}<severity>0.66809994</severity><ageTicks>1372</ageTicks>`)));
 const c=convertRwsSave(save,{planet:false}),p=c.world.pawns.find(q=>q.id===c.thingIds.get('Human1'))!;
 expect(p.nativeHuman).toBeDefined();expect(p.health?.animalAgeConditions?.cases.some(x=>x.kind==='Alzheimers')??false).toBe(true);
 expect([...(c.notes.tallies.get('health')?.values()??[])]).toContainEqual(expect.objectContaining({def:'Alzheimers',status:'adapted'}));
 expect(validateWorld(c.world)).toEqual([]);
 for(let i=0;i<3;i++)stepWorld(c.world);
 expect(validateWorld(c.world)).toEqual([]);
});

it('crosses a native human biological birthday without legacy ailments or a second roll',()=>{
 const c=convertRwsSave(readRwsSave(fixture),{planet:false}),p=c.world.pawns.find(q=>q.id===c.thingIds.get('Human1'))!;
 p.age!.biologicalTicks=90*HUMAN_YEAR_TICKS-1;p.age!.chronologicalTicks=Math.max(p.age!.chronologicalTicks,p.age!.biologicalTicks);
 syncNativeHumanClinicalScale256(p,nativeHumanBiologicalCore256(p));
 let draws=0;const notices:string[]=[];
 advanceHumanAgeAt(p,{tick:c.world.tick,schemaVersion:c.world.schemaVersion,random:()=>{draws++;return .99;},notice:()=>{},birthdayNotice:m=>notices.push(m)});
 expect(p.age!.biologicalTicks).toBe(90*HUMAN_YEAR_TICKS);expect(draws).toBe(9);expect(notices).toEqual([]);expect(p.health?.ageAilments).toBeUndefined();
 advanceHumanAgeAt(p,{tick:c.world.tick,schemaVersion:c.world.schemaVersion,random:()=>{draws++;return .99;},notice:()=>{}});expect(draws).toBe(9);
});

it('acquires a native birthday condition on the actual engine clinical boundary and reloads',()=>{
 const c=convertRwsSave(readRwsSave(fixture),{planet:false}),w=c.world,p=w.pawns.find(q=>q.id===c.thingIds.get('Human1'))!;
 p.age!.biologicalTicks=90*HUMAN_YEAR_TICKS-1;p.age!.chronologicalTicks=Math.max(p.age!.chronologicalTicks,p.age!.biologicalTicks);
 syncNativeHumanClinicalScale256(p,nativeHumanBiologicalCore256(p));
 const before=w.tick;let calls=0;
 // Advance through the same local birthday frontier and then the real
 // medical owner. Fixed draws select the back giver only, without rolling
 // health for any already-played year.
 advanceHumanAgeAt(p,{tick:before,schemaVersion:w.schemaVersion,random:()=>[.99,0,.99,.99,.99,.99,.99,.99,.99,.99][calls++]??.99,notice:()=>{},world:w});
 expect(p.health?.animalAgeConditions?.cases).toEqual([expect.objectContaining({kind:'BadBack',bornAt:before,part:'spine',ageCore:0})]);
 expect(p.health?.ageAilments).toBeUndefined();expect(validateWorld(w)).toEqual([]);
 stepWorld(w,1);expect(p.health?.animalAgeConditions?.cases[0]?.ageCore).toBe(10);
 expect(validateWorld(w)).toEqual([]);const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
});

it('forgets an actual individual memory and filters only situational thoughts deterministically',()=>{
 const save=readRwsSave(fixture),node=save.maps[0]!.things.find(t=>t.id==='Human1')!.node;
 at(node,'healthTracker/hediffSet/hediffs')!.children.push(parseXml(condition('Alzheimers',`${part(15)}<severity>0.9</severity><ageTicks>1372</ageTicks>`)));
 const c=convertRwsSave(save,{planet:false}),p=c.world.pawns.find(q=>q.id===c.thingIds.get('Human1'))!;
 p.deniedJoining=[c.world.tick+100,c.world.tick+200];
 p.memories=[];p.roomMemories=[];p.social=undefined;p.bereavement=[];p.deathThoughts=[];p.familyBereavement=[];p.romanceMemories=[];p.partyMemories292=[];p.coupleMemories285=[];p.hiveDefeats=[];if(p.mental)p.mental.catharsis=[];
 expect(forgetHumanMemory382(p,animalClinicalRandom256(()=>.9))).toBe(true);expect(p.deniedJoining).toEqual([c.world.tick+100]);
 expect(forgetHumanMemory382(p,animalClinicalRandom256(()=>0))).toBe(true);expect(p.deniedJoining).toBeUndefined();
 const thoughts=['memory-test','hungry','tired','uncomfortable','luxurious','ugly-environment','recreation-starved','minor-pain','environment-dark','sick','psychic-soothe','aurora','passionate-work','toxic-fallout','camp-expectations','difficulty-mood'].map((id,i)=>({id,kind:i===0?'memory' as const:'situation' as const,label:'test',description:'test',offset:1}));
 const selected=alzheimerMoodThoughts382(p,thoughts);expect(selected).toContain(thoughts[0]);expect(selected.some(t=>t.offset===0)).toBe(true);expect(selected.find(t=>t.id==='difficulty-mood')?.offset).toBe(1);expect(alzheimerMoodThoughts382(p,thoughts)).toEqual(selected);
});
