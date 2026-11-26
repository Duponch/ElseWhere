import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import {applyCommand,createWorld,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index';
import {SCHEMA_VERSION,type World} from '../src/sim/types';
import {crashlandedProfile} from '../src/sim/game-profile';
import {LETTER_ARCHIVE_LIMIT_352,LETTER_CLASSES_352,LETTER_STACK_LIMIT_352,isLetter352,letterPauses352,letterStackRows352,sendLetter352,stackLetters352,validLetters352,type Letter352,type LetterClass352,type LetterPauseMode352} from '../src/sim/letters-352';
import {UrgentThreatDelivery,UrgentThreatObserver,validUrgentThreatSnapshot} from '../src/bridge/urgent-threats';
import {enableWildlife} from '../src/sim/wildlife';
import {resolveSelectedAurora305,resolveSelectedFarmAnimals305,resolveSelectedSelfTame305} from '../src/sim/misc-incidents-305';
import {adoptMiscIncidents,MISC_FIRST_CHECK} from '../src/sim/cassandra-misc';
import {adoptWorldIncidents,resolveSelectedSolarFlare,WORLD_FIRST_CHECK} from '../src/sim/cassandra-world';
import {resolveSelectedResourcePod305} from '../src/sim/resource-pods-305';
import {celestialGlow305} from '../src/sim/misc-incidents-305';
import {startBerserk,startSadWander,startAlcoholBinge265} from '../src/sim/mental-break';
import {enableRaids} from '../src/sim/raids';
import {createRaidGroup} from '../src/sim/raid-spawn';
import {adoptCropBlights,resolveSelectedCropBlight} from '../src/sim/crop-blight-incident';
import {rollManhunterOnTameFail348} from '../src/sim/animal-manhunter-revenge-348';
import {constructFreshInitialWildAnimal256} from '../src/sim/initial-animal-constructor-256';
import {INITIAL_ANIMAL_FACTS_256} from '../src/sim/initial-animal-data-256';
import {WorldGenerationRandom} from '../src/sim/world-generation-random';
import {legacyHumanAge} from '../src/sim/human-age';
import {arriveTraderCaravan332} from '../src/sim/visitors';
import {deconstructionCamp} from './scenarios/deconstruction';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {buildNativePanel} from '../src/ui3d/native-panels';
import {asOldSchema} from './scenarios/old-schema';
import {isMaplessCampaign} from '../src/sim/world-map-state';

/* Core RimWorld 1.6 letters (schema 352): LetterDefs, LetterStack,
 * Letter/ChoiceLetter/BundleLetter, Archive, MainTabWindow_History and
 * Prefs.AutomaticPauseMode, with the producers Elsewhere already has. */

const stack=(w:World)=>stackLetters352(w.letters352);
const last=(w:World)=>stack(w).at(-1);
const classes=(w:World)=>stack(w).map(l=>l.cls);
const ok=(w:World,command:Parameters<typeof applyCommand>[1])=>{const r=applyCommand(w,command);expect(r,JSON.stringify(r)).toMatchObject({ok:true});return r;};
const refused=(w:World,command:unknown)=>{const before=JSON.stringify(w);const r=applyCommand(w,command as Parameters<typeof applyCommand>[1]);expect(r.ok).toBe(false);expect(JSON.stringify(w)).toBe(before);};
const roundTrip=(w:World)=>deserializeWorld(serializeWorld(w));
/** A storyteller profile makes a legacy createWorld unsavable: only the
 * incident producers that need it get one, without a save check. */
function colony(seed=352,size=24,profile=false):World {
 const w=createWorld(seed,size,size);
 if(profile){w.gameProfile=crashlandedProfile();delete w.heatwaves;adoptWorldIncidents(w);}
 return w;
}
/** The V181 scene, migrated once: its colonist dies of blood loss at the
 * first real tick. Each use deserializes the current-schema text. */
let v181Text:string|undefined;
const v181=()=>deserializeWorld(v181Text??=serializeWorld(deserializeWorld(readFileSync(new URL('../public/test-saves/v181/deuil-et-souvenirs.json',import.meta.url),'utf8'))));
const SLOW=600_000;
const send=(w:World,cls:LetterClass352,title=`Lettre ${cls}`)=>sendLetter352(w,{cls,title,text:`Texte de ${title}.`,targets:[{kind:'cell',x:1,z:2}]})!;

describe('producers send the letter Core sends, with its class',()=>{
 it('storyteller incidents: aurora, self-tame, farm animals and resource pods are PositiveEvent letters; a solar flare a NegativeEvent one',()=>{
  const night=(w:World,from:number)=>{for(let t=Math.ceil(from/100)*100;t<from+12000;t+=100)if(celestialGlow305(w,t)<=.5&&celestialGlow305(w,t+500)<=.5)return t;throw Error('no night');};
  const aurora=colony(352,24,true);aurora.tick=night(aurora,WORLD_FIRST_CHECK);
  expect(resolveSelectedAurora305(aurora,()=>.5)).toBe(true);
  expect(last(aurora)).toMatchObject({cls:'positive',title:'Aurore',tick:aurora.tick,targets:[]});
  expect(last(aurora)!.text).toBe(aurora.events.at(-1)!.message);

  const tame=colony(353,40,false);enableWildlife(tame,6);
  expect(resolveSelectedSelfTame305(tame,()=>0)).toBe(true);
  const tamed=tame.wildlife!.animals.find(a=>a.domestic)!;
  expect(last(tame)).toMatchObject({cls:'positive',title:'Animal apprivoisé',targets:[{kind:'actor',id:tamed.id}]});

  const farm=colony(354,40,false);enableWildlife(farm,0);
  let done=false;for(let seed=1;seed<40&&!done;seed++)done=resolveSelectedFarmAnimals305(farm,seed);
  expect(done).toBe(true);
  expect(last(farm)).toMatchObject({cls:'positive',title:'Animaux de ferme'});
  expect(last(farm)!.targets.length).toBeGreaterThanOrEqual(2);

  const pods=colony(355,40,true);adoptMiscIncidents(pods);
  const state=pods.miscIncidents!;pods.tick=MISC_FIRST_CHECK;state.nextCheck=pods.tick+100;state.introDone=true;state.opportunities=1;state.checks=1;
  expect(resolveSelectedResourcePod305(pods,1234)).toBe(true);
  expect(last(pods)).toMatchObject({cls:'positive',title:'Capsules de fret',targets:[{kind:'cell',...state.resourcePod305!.cell}]});

  const flare=colony(356,24,true);flare.tick=WORLD_FIRST_CHECK;
  expect(resolveSelectedSolarFlare(flare)).toBe(true);
  expect(last(flare)).toMatchObject({cls:'negative',title:'Éruption solaire'});
  for(const w of [tame,farm])expect(validateWorld(w)).toEqual([]);
 });

 it('mental breaks: berserk is a ThreatSmall letter, a sad wander a NegativeEvent one, a drug binge sends none (no beginLetter)',()=>{
  const w=colony(357);const [a,b,c]=w.pawns;
  expect(startBerserk(w,a!)).toBe(true);
  expect(last(w)).toMatchObject({cls:'threat-small',targets:[{kind:'actor',id:a!.id}]});
  expect(last(w)!.title).toBe(`Fureur violente : ${a!.name}`);
  expect(startSadWander(w,b!)).toBe(true);
  expect(last(w)).toMatchObject({cls:'negative',title:`Errance triste : ${b!.name}`});
  const before=stack(w).length;
  if(c&&startAlcoholBinge265(w,c,undefined,true))expect(stack(w).length).toBe(before);
  expect(validateWorld(w)).toEqual([]);
 });

 it('a raid is a ThreatBig letter aimed at its raiders; a crop blight a NegativeEvent one aimed at the first sick plant',()=>{
  const raid=deconstructionCamp(1);enableRaids(raid);
  const group=createRaidGroup(raid,{count:2,sites:[{x:0,z:12},{x:0,z:13}],random:{rng:raid.raids!.rng}})!;
  expect(group).not.toBeNull();
  expect(last(raid)).toMatchObject({cls:'threat-big',targets:group.members.map(id=>({kind:'actor',id}))});
  expect(last(raid)!.title).toMatch(/^Raid/);

  const blight=createWorld(358,32,32);
  blight.tiles=blight.tiles.map(()=>({terrain:'grass'}));blight.resources=[];blight.structures=[];blight.jobs=[];blight.piles=[];blight.packed=[];blight.growingZones=[];blight.stockpiles=[];blight.events=[];
  blight.gameProfile=crashlandedProfile();blight.tick=MISC_FIRST_CHECK;adoptMiscIncidents(blight);adoptCropBlights(blight);
  const plant={id:blight.nextId++,kind:'rice' as const,x:10,z:10,amount:6,growth:.5,growthTick:blight.tick};blight.resources.push(plant);
  let fired=false;for(let seed=1;seed<200&&!fired;seed++)fired=resolveSelectedCropBlight(blight,seed);
  expect(fired).toBe(true);
  expect(last(blight)).toMatchObject({cls:'negative',title:'Fléau des cultures',targets:[{kind:'cell',x:10,z:10}]});
 });

 it('a colonist death is a Death letter, through a real tick (V181 scene)',()=>{
  const world=v181();
  expect(world.letters352).toBeUndefined();
  stepWorld(world);
  const dead=world.pawns.find(p=>p.state==='dead')!;
  expect(last(world)).toMatchObject({cls:'death',title:`Décès : ${dead.name}`,targets:[{kind:'cell',x:dead.x,z:dead.z}],tick:world.tick});
  expect(LETTER_CLASSES_352.death.def).toBe('Death');
  expect(validateWorld(world)).toEqual([]);
 },SLOW);

 it('a trader caravan on a real campaign is a PositiveEvent letter held by the campaign, with its map',()=>{
  const w=deserializeWorld(readFileSync('public/test-saves/v419/les-eclaircies.json','utf8'));
  for(let i=0;i<40&&!arriveTraderCaravan332(w);i++)stepWorld(w);
  const letter=stack(w).find(l=>l.title==='Caravane marchande')!;
  expect(letter).toMatchObject({cls:'positive'});
  expect(letter.mapId).toBe(w.worldMaps!.rootMapId);
  expect(letter.targets.every(t=>t.kind==='actor'&&w.pawns.some(p=>p.id===t.id))).toBe(true);
  const loaded=roundTrip(w);
  expect(stack(loaded)).toEqual(stack(w));
  expect(serializeWorld(loaded)).toBe(serializeWorld(w));
 },120_000);
});

describe('a manhunter pack is a big threat',()=>{
 it('a failed tame enrages one animal (ThreatSmall); with its awake packmates it is a pack (ThreatBig), as Pawn_MindState',()=>{
  const base=createWorld(81733,32,32);
  base.tiles=base.tiles.map(()=>({terrain:'grass'}));base.resources=[];base.jobs=[];base.structures=[];base.piles=[];base.stockpiles=[];base.growingZones=[];base.pawns=base.pawns.slice(0,1);
  const tamer=base.pawns[0]!;tamer.age=legacyHumanAge();delete tamer.health;Object.assign(tamer,{x:4,z:10});
  enableWildlife(base,0);base.wildlife!.animals=[];
  const spawn=(x:number,z:number)=>{const made=constructFreshInitialWildAnimal256({fact:INITIAL_ANIMAL_FACTS_256.Emu,id:base.nextId,cell:{x,z},tick:base.tick,random:new WorldGenerationRandom(base.seed+base.nextId)});
   if(made.status!=='ready')throw Error(made.reason);base.nextId++;Object.assign(made.animal,{state:'idle',path:[],nextDecision:base.tick+80});delete made.animal.motion;base.wildlife!.animals.push(made.animal);return made.animal;};
  spawn(5,10);spawn(6,11);
  const seen=new Map<LetterClass352,Letter352>();
  for(let i=1;i<400&&seen.size<2;i++){
   const w=structuredClone(base);w.rng=(Math.imul(i,0x9e3779b1)>>>0)||1;
   if(!rollManhunterOnTameFail348(w,w.wildlife!.animals[0]!,w.pawns[0]!))continue;
   const letter=last(w)!;seen.set(letter.cls,letter);
   const enraged=w.wildlife!.animals.filter(a=>a.manhunter).length;
   expect(letter.cls).toBe(enraged>1?'threat-big':'threat-small');
   expect(letter.title).toBe('Vengeance animale');
  }
  expect([...seen.keys()].sort()).toEqual(['threat-big','threat-small']);
  expect(letterPauses352('threat-big','major')).toBe(true);
 });
});

describe('automatic pause (Prefs.AutomaticPauseMode, a player preference)',()=>{
 it('each class pauses as its Core LetterDef pauseMode: ThreatBig on major, ThreatSmall on any threat, the others on any letter',()=>{
  const expected:Record<LetterPauseMode352,LetterClass352[]>={never:[],major:['threat-big'],'any-threat':['threat-big','threat-small'],'any-letter':Object.keys(LETTER_CLASSES_352) as LetterClass352[]};
  for(const [mode,pausing] of Object.entries(expected) as [LetterPauseMode352,LetterClass352[]][])for(const cls of Object.keys(LETTER_CLASSES_352) as LetterClass352[]){
   const w=colony(360),observer=new UrgentThreatObserver(),delivery=new UrgentThreatDelivery();observer.bootstrap(w);
   expect(observer.lettersChanged(w)).toBe(false);
   send(w,cls);
   expect(observer.lettersChanged(w)).toBe(true);
   expect(observer.capture(w,mode),`${mode} ${cls}`).toBe(pausing.includes(cls));
   expect(observer.lettersChanged(w)).toBe(false);
   const snapshot=observer.snapshot();
   expect(validUrgentThreatSnapshot(snapshot,w.tick,pausing.includes(cls)?0:1)).toBe(true);
   expect(delivery.accepts(snapshot,w.tick,pausing.includes(cls)?0:1)).toBe(true);
   expect(delivery.commit(snapshot,w.tick)?.rows).toEqual([{site:'home',kind:'letter',totalArrivals:1,lastTick:w.tick,lastCount:1,delta:1}]);
  }
 });

 it('fixed modern owner reads the exact producer letter ledger without the obsolete episode census',()=>{
  for(const mode of ['never','major','any-threat','any-letter'] as const){
   const w=colony(360),strict=new UrgentThreatObserver(),fixed=new UrgentThreatObserver(true);
   strict.bootstrap(w);fixed.bootstrap(w);
   for(const cls of Object.keys(LETTER_CLASSES_352) as LetterClass352[]){
    send(w,cls);
    strict.prepareMaps(w);fixed.prepareMaps(w);
    expect(fixed.lettersChanged(w)).toBe(strict.lettersChanged(w));
    expect(fixed.capture(w,mode)).toBe(strict.capture(w,mode));
    expect(fixed.snapshot()).toEqual(strict.snapshot());
    expect(fixed.capture(w,mode)).toBe(strict.capture(w,mode));
   }
   fixed.bootstrap(w);strict.bootstrap(w);
   expect(fixed.capture(w,mode)).toBe(strict.capture(w,mode));
   expect(fixed.snapshot()).toEqual(strict.snapshot());
  }
 });

 it('through a real tick: a death letter pauses only on "any letter"; a load adopts the stack silently',()=>{
  for(const mode of ['never','major','any-threat','any-letter'] as const){
   const w=v181(),observer=new UrgentThreatObserver();observer.bootstrap(w);
   stepWorld(w);
   expect(observer.capture(w,mode)).toBe(mode==='any-letter');
   // Bootstrapping again (a load) never pauses for letters already received.
   const loaded=roundTrip(w),fresh=new UrgentThreatObserver();fresh.bootstrap(loaded);
   expect(fresh.lettersChanged(loaded)).toBe(false);expect(fresh.capture(loaded,'any-letter')).toBe(false);
  }
 },SLOW);
});

describe('reading and dismissing are player commands',()=>{
 it('open marks the letter read, dismiss takes it out of the stack; the archive keeps it; malformed commands are refused',()=>{
  const w=colony(361),a=send(w,'threat-big'),b=send(w,'neutral');
  expect(stack(w).map(l=>l.id)).toEqual([a,b]);
  ok(w,{type:'letter-open',id:a});
  expect(w.letters352!.archive.find(e=>e.id===a)).toMatchObject({read:true});
  ok(w,{type:'letter-open',id:a});
  ok(w,{type:'letter-dismiss',id:a});
  expect(stack(w).map(l=>l.id)).toEqual([b]);
  expect(w.letters352!.archive.map(e=>e.id)).toEqual([a,b]);
  refused(w,{type:'letter-dismiss',id:a});
  for(const bad of [{type:'letter-open'},{type:'letter-open',id:'1'},{type:'letter-open',id:b,extra:1},{type:'letter-dismiss',id:999},{type:'archive-pin',id:b},{type:'archive-pin',id:b,pinned:1},{type:'journal-pin',tick:0,journal:'job',message:'Aucune ligne.'}])refused(w,bad);
  // The simulation is untouched: same next ticks with or without the commands.
  const twin=structuredClone(w);ok(w,{type:'letter-open',id:b});
  stepWorld(w,20);stepWorld(twin,20);
  const strip=(x:World)=>{const c=structuredClone(x);delete c.letters352;return JSON.stringify(c);};
  expect(strip(w)).toBe(strip(twin));
  expect(validateWorld(w)).toEqual([]);
 });

 it('the History messages tab lists the archive, opens letters and pins entries through the commands',()=>{
  const w=colony(362);const a=send(w,'positive','Bonne nouvelle');
  w.events.push({tick:w.tick,type:'job',message:'Une ligne du journal.'});
  let page:NativePage;
  const state:NativeUiState={world:w,epoch:1,panel:'history',category:'structure',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
  const noop=()=>{},opened:number[]=[];
  const actions:NativeUiActions={command:vi.fn(async c=>applyCommand(w,c)),openLetter352:id=>opened.push(id),readState:()=>state,showPage:next=>{page=next;},refresh:noop,panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop};
  page=buildNativePanel(state,actions)!;
  const control=(id:string):NativeControl=>{const c=[...(page.actions??[]),...page.rows.flatMap(r=>r.controls??[])].find(c=>c.id===id);if(!c)throw Error(`Missing ${id}`);return c;};
  expect(page.rows.find(r=>r.id===`archive-${a}`)).toMatchObject({value:'Bonne nouvelle'});
  void control(`archive-open-${a}`).onActivate();expect(opened).toEqual([a]);
  return (async()=>{
   await control(`archive-pin-${a}`).onActivate();
   expect(w.letters352!.pinned).toEqual([a]);
   const index=w.events.length-1;
   await control(`event-pin-${index}`).onActivate();
   const copy=w.letters352!.archive.find(e=>!isLetter352(e))!;
   expect(copy).toMatchObject({journal:'job',message:'Une ligne du journal.',tick:w.tick});
   expect(w.letters352!.pinned).toEqual([a,copy.id]);
   page=buildNativePanel(state,actions)!;
   expect(control(`event-pin-${index}`).disabled).toBe(true);
   expect(validateWorld(w)).toEqual([]);
  })();
 });
});

describe('the stack and the archive',()=>{
 it('overflow folds the oldest letters into one bundle row, as LetterStack.LettersOnGUI',()=>{
  const letters=Array.from({length:6},(_,i)=>({id:i+1,tick:0,cls:'neutral' as const,title:`L${i+1}`,text:'',targets:[]}));
  expect(letterStackRows352(letters.slice(0,4),4)).toEqual({bundle:[],shown:letters.slice(0,4)});
  const folded=letterStackRows352(letters,4);
  expect(folded.bundle.map(l=>l.id)).toEqual([1,2,3]);expect(folded.shown.map(l=>l.id)).toEqual([4,5,6]);
  expect(letterStackRows352(letters,1)).toEqual({bundle:letters,shown:[]});
 });

 it('the archive keeps 200 unpinned entries: pinned entries and letters still in the stack are never culled',()=>{
  const w=colony(363),first=send(w,'neutral','Première'),second=send(w,'neutral','Deuxième');
  ok(w,{type:'archive-pin',id:first,pinned:true});
  ok(w,{type:'letter-dismiss',id:first});ok(w,{type:'letter-dismiss',id:second});
  const ids:number[]=[];
  for(let i=0;i<230;i++){ids.push(send(w,'positive',`Lettre ${i}`));if(i<227)ok(w,{type:'letter-dismiss',id:ids[i]!});}
  const pinned=new Set(w.letters352!.pinned),stacked=new Set(w.letters352!.stack);
  expect(stacked).toEqual(new Set(ids.slice(227)));
  expect(w.letters352!.archive.filter(e=>!pinned.has(e.id)&&!stacked.has(e.id)).length).toBe(LETTER_ARCHIVE_LIMIT_352);
  expect(w.letters352!.archive.some(e=>e.id===first)).toBe(true);
  expect(w.letters352!.archive.some(e=>e.id===second)).toBe(false);
  expect(w.letters352!.archive.length).toBe(LETTER_ARCHIVE_LIMIT_352+1+3);
  // Unpinning makes the oldest entry cullable again.
  ok(w,{type:'archive-pin',id:first,pinned:false});
  expect(w.letters352!.archive.some(e=>e.id===first)).toBe(false);
  expect(validateWorld(w)).toEqual([]);
  // An unread stack never grows past its bound; the oldest letter stays archived.
  const full=colony(364);for(let i=0;i<LETTER_STACK_LIMIT_352+5;i++)send(full,'neutral');
  expect(full.letters352!.stack.length).toBe(LETTER_STACK_LIMIT_352);
  expect(full.letters352!.stack[0]).toBe(6);
  expect(validateWorld(full)).toEqual([]);
 });

 it('letters, read flags, pins and journal copies survive save and reload; the save is strictly validated',()=>{
  const w=colony(365),a=send(w,'threat-small'),b=send(w,'death');
  w.events.push({tick:w.tick,type:'need',message:'Ligne gardée.'});
  ok(w,{type:'letter-open',id:a});ok(w,{type:'archive-pin',id:b,pinned:true});
  ok(w,{type:'journal-pin',tick:w.tick,journal:'need',message:'Ligne gardée.'});
  const text=serializeWorld(w),loaded=deserializeWorld(text);
  expect(loaded.letters352).toEqual(w.letters352);expect(serializeWorld(loaded)).toBe(text);
  const bad=(edit:(state:Record<string,any>)=>void)=>{const raw=JSON.parse(text);edit(raw.letters352);expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow(/letters/);};
  bad(s=>{s.archive[0].cls='letter';});
  bad(s=>{s.stack.push(999);});
  bad(s=>{s.pinned.push(s.pinned[0]);});
  bad(s=>{s.next=1;});
  bad(s=>{s.archive[0].targets.push({kind:'cell',x:-1,z:0});});
  bad(s=>{s.archive[0].extra=true;});
  bad(s=>{s.revision=2;});
  bad(s=>{s.archive[0].tick=999_999;});
  // The archive keeps the order of creation ticks (Core Archive.Add sorts by tick).
  const entry=(id:number,tick:number)=>({id,tick,journal:'job',message:'Ligne.'});
  expect(validLetters352({tick:10,letters352:{revision:1,next:3,stack:[],pinned:[],archive:[entry(1,4),entry(2,5)]}},SCHEMA_VERSION)).toBe(true);
  expect(validLetters352({tick:10,letters352:{revision:1,next:3,stack:[],pinned:[],archive:[entry(1,5),entry(2,4)]}},SCHEMA_VERSION)).toBe(false);
  expect(validLetters352({tick:0,letters352:w.letters352},351)).toBe(false);
  const hidden={tick:w.tick};Object.defineProperty(hidden,'letters352',{value:w.letters352,enumerable:false});
  expect(validLetters352(hidden,SCHEMA_VERSION)).toBe(false);
  // A campaign whose last map was abandoned keeps its letters (envelope only).
  const mapless=(schemaVersion:number)=>({schemaVersion,tick:42,rng:1,nextId:1,letters352:{revision:1,next:1,stack:[],archive:[],pinned:[]},
   worldMaps:{revision:1,rootMapId:null,selectedMapId:null,nextMapId:1,campaignSeed:42,mapSize:{width:250,height:250},sites:[],retired:[]},
   worldGroups:{revision:1,selectedGroupId:null,groups:[],losses:[],legacyTravellers:[],events:[],abandonedPawns:[],abandonedContents:[]}});
  expect(isMaplessCampaign(mapless(352))).toBe(true);expect(isMaplessCampaign(mapless(351))).toBe(false);
 });
});

describe('older games',()=>{
 it('below 352 nothing changes: no letter, the same events, journal and state through real ticks',()=>{
  const now=v181(),old=v181();(old as {schemaVersion:number}).schemaVersion=351;
  stepWorld(now,30);stepWorld(old,30);
  expect(old.letters352).toBeUndefined();expect(stack(now).length).toBeGreaterThan(0);
  const strip=(x:World)=>{const c=structuredClone(x) as Partial<World>;delete c.letters352;delete c.schemaVersion;return JSON.stringify(c);};
  expect(strip(old)).toBe(strip(now));
  expect(old.events).toEqual(now.events);
  // Producers and commands are inert below 352.
  const w=colony(366);(w as {schemaVersion:number}).schemaVersion=351;
  expect(sendLetter352(w,{cls:'threat-big',title:'Raid',text:''})).toBeUndefined();
  expect(startBerserk(w,w.pawns[0]!)).toBe(true);
  expect(w.letters352).toBeUndefined();
  expect(applyCommand(w,{type:'letter-open',id:1}).ok).toBe(false);
 },SLOW);

 it('a 351 save migrates by number only: an empty stack, nothing given retroactively; a 351 save holding letters is refused',()=>{
  const w=colony(367);startBerserk(w,w.pawns[0]!);
  const current=serializeWorld(w);
  const migrated=deserializeWorld(asOldSchema(current,351));
  expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(migrated.letters352).toBeUndefined();
  expect(migrated.events).toEqual(w.events);
  expect(validateWorld(migrated)).toEqual([]);
  // After migration the producers write letters as usual.
  expect(startSadWander(migrated,migrated.pawns[1]!)).toBe(true);
  expect(classes(migrated)).toEqual(['negative']);
  const raw=JSON.parse(current);raw.schemaVersion=351;
  expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow();
 });
});
