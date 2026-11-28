import {describe,it,expect,beforeAll} from 'vitest';
import {readFileSync} from 'node:fs';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {convertRwsSave} from '../src/import/rimworld/convert.ts';
import {at,items,parseXml,type XmlNode} from '../src/import/rimworld/xml.ts';
import {validateWorld,serializeCampaignUnchecked,deserializeCampaign} from '../src/sim/serialization.ts';
import {memoryOffset} from '../src/sim/social-state.ts';
import {SCHEMA_VERSION} from '../src/sim/types.ts';

const append=(node:XmlNode,string:string)=>node.children.push(parseXml(string));
const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
describe('Imported Core human original state',()=>{
 let conversion:ReturnType<typeof convertRwsSave>,a:ReturnType<typeof convertRwsSave>['world']['pawns'][number],b:typeof a;
 beforeAll(()=>{
  const save=readRwsSave(fixture),human=save.maps[0]!.things.filter(t=>t.def==='Human');
  const alma=human[0]!.node,bruno=human[1]!.node;
  append(alma,'<genes><endogenes><li><def>Skin_Melanin8</def><overriddenByGene>null</overriddenByGene></li></endogenes></genes>');
  append(at(bruno,'story')!,'<title>Gardien</title>');
  append(at(bruno,'story')!,'<skinColorBase>RGBA(0.5, 0.25, 0.0, 1.0)</skinColorBase>');
  append(bruno,'<style><beardDef>LongDutch</beardDef></style>');
  append(at(bruno,'healthTracker/hediffSet/hediffs')!,'<li Class="HediffWithComps"><def>CryptosleepSickness</def><severity>1</severity><ticksToDisappear>10135</ticksToDisappear><disappearsAfterTicks>11509</disappearsAfterTicks><seed>333633634</seed></li>');
  at(bruno,'ageTracker/ageBiologicalTicks')!.text='90000007';
  const skill=items(bruno,'skills/skills')[0]!;
  at(skill,'xpSinceLastLevel')!.text='-2.5';append(skill,'<xpSinceMidnight>321.75</xpSinceMidnight>');
  append(bruno,'<playerSettings><medCare>Best</medCare><selfTend>True</selfTend><hostilityResponse>Attack</hostilityResponse></playerSettings>');
  append(bruno,'<timetable><times>'+Array.from({length:24},(_,i)=>`<li>${i===3?'Work':i===8?'Joy':'Anything'}</li>`).join('')+'</times></timetable>');
  append(bruno,'<needs><needs><li><def>Outdoors</def><curLevel>0.75</curLevel></li><li><def>RoomSize</def><curLevel>0.375</curLevel></li></needs></needs>');
  const joy='<li><def>Joy</def><curLevel>0.54</curLevel><tolerances><vals>'+[.6,.5,0,.2,.1,0,0,.15,0,.25].map(v=>`<li>${v}</li>`).join('')+'</vals></tolerances><bored><vals>'+['True','False','False','False','False','False','False','False','False','False'].map(v=>`<li>${v}</li>`).join('')+'</vals></bored></li>';
  append(at(bruno,'needs/needs')!,joy);
  append(bruno,'<outfits><curOutfit>ApparelPolicy_Custom_5</curOutfit><overrideHandler><forcedAps><li>Thing_Apparel_Pants304</li></forcedAps></overrideHandler></outfits>');
  append(bruno,'<foodRestriction><curRestriction>FoodPolicy_Custom_2</curRestriction></foodRestriction>');
  append(bruno,'<drugs><curAssignedDrugs>DrugPolicy_Custom_3</curAssignedDrugs></drugs>');
  append(bruno,'<reading><curAssignment>ReadingPolicy_None_5</curAssignment></reading>');
  append(save.game,'<outfitDatabase><outfits><li><id>5</id><label>Tenue d’essai</label><filter><disallowedSpecialFilters><li>AllowDeadmansApparel</li></disallowedSpecialFilters><allowedDefs><li>Apparel_Pants</li><li>Apparel_AdvancedHelmet</li></allowedDefs><allowedHitPointsPercents>0.55~1</allowedHitPointsPercents><allowedQualityLevels>Good~Legendary</allowedQualityLevels></filter></li></outfits></outfitDatabase>');
  append(save.game,'<foodRestrictionDatabase><foodRestrictions><li><id>2</id><label>Repas</label><filter><allowedDefs><li>MealSimple</li><li>RawRice</li></allowedDefs></filter></li></foodRestrictions></foodRestrictionDatabase>');
  append(save.game,'<drugPolicyDatabase><policies><li><id>3</id><label>Essai</label><drugs><li><drug>Beer</drug><allowedForJoy>True</allowedForJoy><allowScheduled>True</allowScheduled><daysFrequency>2</daysFrequency><takeToInventory>1</takeToInventory></li><li><drug>Penoxycyline</drug><allowScheduled>True</allowScheduled><daysFrequency>5</daysFrequency></li></drugs></li></policies></drugPolicyDatabase>');
  append(save.game,'<readingPolicyDatabase><readingPolicies><li><id>5</id><label>Pas de lecture</label><defFilter><allowedDefs /></defFilter></li></readingPolicies></readingPolicyDatabase>');
  append(alma,'<social><directRelations><li><def>Lover</def><otherPawn>Thing_Human2</otherPawn></li></directRelations></social>');
  append(bruno,'<social><directRelations><li><def>Lover</def><otherPawn>Thing_Human1</otherPawn></li></directRelations></social>');
  const mood=items(alma,'needs/needs').find(n=>at(n,'def')?.text==='Mood')!;
  append(mood,`<thoughts><memories><memories>
  <li><def>AteFineMeal</def><age>30000</age></li>
  <li><def>AteInImpressiveDiningRoom</def><stageIndex>5</stageIndex><age>15000</age></li>
  <li><def>Nuzzled</def><age>10000</age></li>
  <li><def>DeepTalk</def><age>1080000</age><opinionOffset>15</opinionOffset><otherPawn>Thing_Human2</otherPawn></li>
  <li><def>Chitchat</def><age>1000</age><opinionOffset>5</opinionOffset><otherPawn>Thing_Human2</otherPawn></li>
  <li><def>DeepTalk</def><age>1000</age><opinionOffset>5</opinionOffset><otherPawn>Thing_Absent42</otherPawn></li>
  </memories></memories></thoughts>`);
  conversion=convertRwsSave(save,{planet:false});a=conversion.world.pawns.find(p=>p.name.startsWith('Alma'))!;b=conversion.world.pawns.find(p=>p.name.startsWith('Bruno'))!;
 });
 it('retains structured name, title, beard, skin, raw Core biological remainder and daily skill debt',()=>{
  expect(a.nativeHuman?.name).toMatchObject({first:'Alma',nick:'Fourmi',last:'Rivière'});
  expect(a.appearance?.skinColor).toBe(0x825b30);
  expect(b.identity378).toEqual({revision:1,title:'Gardien'});
  expect(b.nativeHuman?.biologicalCoreRemainder).toBe(7);
  expect(b.appearance).toMatchObject({beard:'LongDutch',skinColor:0x804000});
  expect(b.skills.shooting).toMatchObject({level:10,xp:-2500,dailyXp:321750});
  expect(b.health?.cryptosleepSickness).toEqual({remainingCore:10135,initialCore:11509,noiseSeed:333633634});
  expect(a.health?.flu?.severity).toBe(200000000);
  expect(b.outdoors359).toBe(.75);expect(b.roomSize345?.level).toBe(.375);
  expect(b.recreation.tolerance.solitary).toBe(60);expect(b.recreation.bored.solitary).toBe(true);
  expect(b.recreation.tolerance.reading).toBe(25);expect(b.recreation.tolerance.chemical).toBe(15);
  expect(b.medicalCare).toBe('best');expect(b.selfTend).toBe(true);
  expect(b.hostilityResponse).toBe('attack');
  expect(b.schedule[3]).toBe('work');expect(b.schedule[8]).toBe('recreation');
 });
 it('imports actual policy IDs, allowed definitions, ranges and assignments without dropping the default owner',()=>{
  const w=conversion.world;
  expect(b.apparelPolicyId).toBe(5);expect(b.foodPolicyId).toBe(2);expect(b.drugPolicyId).toBe(3);expect(b.readingPolicy295).toBe(2);
  const outfit=w.apparelPolicies!.find(p=>p.id===5)!;
  expect(outfit).toMatchObject({minQuality:'good',minHitPointsPercent:.55,taintedAllowed374:false});
  expect(outfit.allowedItems).toContain('cloth-pants');expect(outfit.allowedItems).toContain('plasteel-flak-helmet');
  expect(w.foodPolicies.find(p=>p.id===2)?.allowed).toEqual(['simple-meal','rice']);
  expect(w.drugPolicies!.find(p=>p.id===3)).toMatchObject({beer:{allowScheduled:true,daysFrequency:2,takeToInventory:1},penoxycyline337:{allowScheduled:true,daysFrequency:5}});
  expect(w.piles.find(p=>p.owner.type==='apparel'&&p.owner.pawnId===b.id)?.apparel?.forced).toBe(true);
  expect(w.foodPolicies.some(p=>p.id===1)).toBe(true);expect(w.apparelPolicies!.some(p=>p.id===1)).toBe(true);
 });
 it('retains a single real relation and exact remaining meal/room durations; records old social memory as adapted',()=>{
  const w=conversion.world;
  // Core omits startTicks when the actual start is tick zero.
  expect(w.relationships?.links).toEqual([{kind:'lover',aId:Math.min(a.id,b.id),bId:Math.max(a.id,b.id),recordedAt:0}]);
  expect(a.memories).toEqual([{kind:'ate-fine-meal',expiresAt:w.tick+3000}]);
  expect(a.roomMemories).toEqual(expect.arrayContaining([{kind:'dining',stage:5,expiresAt:w.tick+4500},{kind:'nuzzled',stage:0,expiresAt:w.tick+5000}]));
  const deep=a.social?.memories.find(m=>m.kind==='deep-talk')!;
  expect(deep.otherId).toBe(b.id);expect(memoryOffset(deep,w.tick)).toBeCloseTo(5);
  expect(a.social?.memories).toHaveLength(2);
  expect(conversion.notes.summary('social').adapted).toBeGreaterThan(0);
  expect(conversion.notes.summary('social').dropped).toBeGreaterThan(0);
 });
 it('is admitted as a world and round-trips at the current schema',()=>{
  const w=conversion.world;expect(w.schemaVersion).toBe(SCHEMA_VERSION);
  expect(validateWorld(w)).toEqual([]);
  const json=serializeCampaignUnchecked(w);expect(serializeCampaignUnchecked(deserializeCampaign(json))).toBe(json);
 });
});
