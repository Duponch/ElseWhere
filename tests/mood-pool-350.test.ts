import {expect,test,vi} from 'vitest';
import {applyCommand,createWorld,stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {moodThoughts} from '../src/sim/mood.ts';
import {updateMentalBreak,startMoodPoolBreak350} from '../src/sim/mental-break.ts';
import {mentalState} from '../src/sim/mental-state.ts';
import {MENTAL_CRISIS_CATALOG} from '../src/sim/mental-catalog.ts';
import {insultCandidates350,minorPoolOptions350,ownRoomRoot350} from '../src/sim/mental-breaks-350.ts';
import {gainMoodPoolMemory350,isMoodPool350} from '../src/sim/mood-pool-350.ts';
import {psychicActive350,resolveSelectedPsychic350,eligiblePsychic350,validPsychic350} from '../src/sim/psychic-emanation-350.ts';
import {adoptMiscIncidents,miscLotteryRows329} from '../src/sim/cassandra-misc.ts';
import {weatherConditionInspection,weatherConditionLabel} from '../src/ui/weather-inspection.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {opinionCauses,opinionOf} from '../src/sim/social-state.ts';
import {nuzzleHourChance350} from '../src/sim/nuzzle-350.ts';
import {damageAnimalWithBullet} from '../src/sim/wildlife-health.ts';
import {fixtureBuilding} from './scenarios/deconstruction.ts';
import {rescueCamp} from './scenarios/rescue.ts';
import {recruitmentUiFixture} from './scenarios/prison-camp.ts';
import {animalHaulingCamp459} from './scenarios/animal-hauling-v459.ts';
import {newBuildingFuel} from '../src/sim/fuel.ts';
import {addGroundMaterial} from '../src/sim/materials.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,TICKS_PER_DAY,type Pawn,type World} from '../src/sim/types.ts';

vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));

const valid=(w:World)=>expect(validateWorld(w),`tick ${w.tick}`).toEqual([]);
const thought=(w:World,p:Pawn,prefix:string)=>moodThoughts(w,p).find(t=>t.id.startsWith(prefix));
const idle={handle:0,clean:0,firefight:0,warden:0,basic:0,hunt:0,research:0,patient:0,bedrest:0,doctor:0,art:0,craft:0,mine:0,gather:0,build:0,haul:0,grow:0,cook:0} as Pawn['priorities'];
const reload=(w:World)=>deserializeWorld(serializeWorld(w));
function until(w:World,done:()=>boolean,limit:number,what:string){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done(),`${what} by tick ${w.tick}`).toBe(true);}

/** Prepared fixture: grass, three idle adults, a walled and roofed 5×5
 * bedroom with a door around (20..24, 20..24) and the first pawn's bed in it. */
function camp(version=SCHEMA_VERSION as number):World {
 const w=createWorld(350,40,40);
 w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
 w.pawns=w.pawns.slice(0,3);expect(w.pawns).toHaveLength(3);
 const xs=[10,12,14];
 w.pawns.forEach((p,i)=>{Object.assign(p,{hunger:100,rest:100,x:xs[i],z:10});p.priorities={...idle};delete p.background;delete p.traits;});
 room(w,20,20,24,24,{x:22,z:19});
 const bed=fixtureBuilding(w,'bed',22,22);w.pawns[0]!.bedId=bed.id;
 w.schemaVersion=version as typeof SCHEMA_VERSION;refreshStock(w);return w;
}
function room(w:World,x0:number,z0:number,x1:number,z1:number,door?:{x:number;z:number}):void {
 for(let x=x0-1;x<=x1+1;x++)for(let z=z0-1;z<=z1+1;z++){
  if(x>=x0&&x<=x1&&z>=z0&&z<=z1)continue;
  if(door&&door.x===x&&door.z===z)w.structures.push({id:w.nextId++,kind:'door',x,z,orientation:0,footprint:'standard',material:'wood',door:newDoorState(w.tick)});
  else w.structures.push({id:w.nextId++,kind:'wall',x,z,orientation:0,footprint:'standard'});
 }
 const roof:number[]=[];for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)roof.push(z*w.width+x);
 w.roofing={constructed:[...(w.roofing?.constructed??[]),...roof].sort((a,b)=>a-b),build:[],remove:[],cursor:0};
}
/** States of the mental stream whose first draw passes the break MTB check
 * at `level` (the next draws are free): one break per seed, no search. */
function breakSeeds(level:number,count:number):number[] {
 const chance=150/([4,.8,.5][level]!*60000),seeds:number[]=[];
 for(let s=1;seeds.length<count;s++){let n=s;n^=n<<13;n^=n>>>17;n^=n<<5;if((n>>>0)/0x100000000<chance)seeds.push(s);}
 return seeds;
}
/** One real updateMentalBreak decision at its sampled tick with this stream. */
function breakWith(w:World,p:Pawn,seed:number,below:[number,number,number]):string|undefined {
 while((w.tick+p.id)%15!==0)stepWorld(w);
 const m=mentalState(p);m.below=[...below];m.cooldown=0;delete m.crisis;p.mood=1;w.rng=seed;
 updateMentalBreak(w,p);return p.mental?.crisis?.kind;
}

test('Core minor pool: own room, both sprees, food binge 0.8 of 2.8 over many real decisions',()=>{
 const w=camp(),[p]=w.pawns as [Pawn];
 // The Core def order and weights; each break's admission is real.
 expect(ownRoomRoot350(w,p)).toEqual({x:22,z:22});
 expect(insultCandidates350(w,p,true)!.map(t=>t.id)).toEqual([w.pawns[1]!.id,w.pawns[2]!.id]);
 expect(minorPoolOptions350(w,p)!.map(o=>[o.kind,o.weight])).toEqual([['food-binge',.8],['sad-wander',.5],['wander-own-room',.5],['insulting-spree',.5],['targeted-insulting-spree',.5]]);
 expect(['psychotic-wander','wander-own-room','insulting-spree','targeted-insulting-spree'].map(k=>MENTAL_CRISIS_CATALOG[k as 'wander-own-room'])).toMatchObject([
  {intensity:1,weight:1,minCore:70000,maxCore:90000,recoveryMtb:.166},{intensity:0,weight:.5,minCore:40000,maxCore:60000},{intensity:0,weight:.5,minCore:25000,maxCore:45000},{intensity:0,weight:.5,minCore:25000,maxCore:45000}]);
 while((w.tick+p.id)%15!==0)stepWorld(w);
 const base=serializeWorld(w),counts=new Map<string,number>(),seeds=breakSeeds(0,1000);
 for(const seed of seeds){const c=structuredClone(w),q=c.pawns[0]!;const kind=breakWith(c,q,seed,[2100,0,0]);expect(kind).toBeDefined();counts.set(kind!,(counts.get(kind!)??0)+1);}
 const share=(k:string)=>(counts.get(k)??0)/seeds.length;
 expect(share('food-binge')).toBeGreaterThan(.8/2.8-.045);expect(share('food-binge')).toBeLessThan(.8/2.8+.045);
 for(const k of ['sad-wander','wander-own-room','insulting-spree','targeted-insulting-spree']){expect(share(k)).toBeGreaterThan(.5/2.8-.045);expect(share(k)).toBeLessThan(.5/2.8+.045);}
 // The same seeds at 349 keep the old pool: food binge or sad wander only.
 const old=deserializeWorld(asOldSchema(base,349));expect(old.schemaVersion).toBe(SCHEMA_VERSION);
 Object.assign(old,{schemaVersion:349});const kinds=new Set<string>();
 for(const seed of seeds.slice(0,200)){const c=structuredClone(old),q=c.pawns[0]!;kinds.add(breakWith(c,q,seed,[2100,0,0])!);}
 expect([...kinds].sort()).toEqual(['food-binge','sad-wander']);
},120000);

test('a major break without alcohol or tantrum targets is a psychotic wander that walks, survives sleep and reloads',()=>{
 const w=camp(),[p]=w.pawns as [Pawn];
 // No structure is breakable within reach outside the walls: tantrum needs two targets.
 const seed=breakSeeds(1,1)[0]!;
 expect(breakWith(w,p,seed,[2100,2100,0])).toBe('psychotic-wander');
 valid(w);expect(w.events.at(-1)?.message).toContain('errance psychotique');
 const start={x:p.x,z:p.z},cells=new Set<string>();
 for(let i=0;i<400;i++){stepWorld(w);cells.add(`${p.x},${p.z}`);if(p.motion?.coreMove297)expect(p.motion.coreMoveWalk297).toBe(true);}
 expect(cells.size).toBeGreaterThan(3);expect(p.mental?.crisis?.kind).toBe('psychotic-wander');expect([p.x,p.z]).not.toEqual([start.x,start.z]);valid(w);
 // An ordinary sleep keeps the break (no recoverFromSleep); a sad wander ends.
 const copy=reload(w),q=copy.pawns[0]!;expect(copy).toEqual(w);
 q.state='sleeping';q.need={kind:'sleep',phase:'sleep',bedId:null,target:{x:q.x,z:q.z}};q.path=[];
 updateMentalBreak(copy,q);expect(q.mental?.crisis?.kind).toBe('psychotic-wander');
 // It ends at its Core maximum (90 000 ticks), with catharsis.
 p.mental!.crisis!.age=89970;for(let i=0;i<3&&p.mental?.crisis;i++)stepWorld(w);
 expect(p.mental?.crisis).toBeUndefined();expect(p.mental?.catharsis).toHaveLength(1);valid(w);
});

test('hiding in one\'s room walks into the bedroom and waits there; an insulting spree insults its targets',()=>{
 const w=camp(),[p,a,b]=w.pawns as [Pawn,Pawn,Pawn];
 expect(startMoodPoolBreak350(w,p,'wander-own-room',{root:ownRoomRoot350(w,p)!})).toBe(true);
 until(w,()=>p.x>=20&&p.x<=24&&p.z>=20&&p.z<=24,800,'reaches the bedroom');valid(w);
 for(let i=0;i<300;i++){stepWorld(w);if(!p.motion||p.motion.end<=w.tick)expect(p.x>=20&&p.x<=24&&p.z>=19&&p.z<=24).toBe(true);}
 expect(p.mental?.crisis).toMatchObject({kind:'wander-own-room',root:{x:22,z:22}});
 expect(reload(w)).toEqual(w);
 // Insulting spree: a target drawn by distance, Insulted opinion and mood.
 const s=camp(),[bully,x,y]=s.pawns as [Pawn,Pawn,Pawn];
 expect(startMoodPoolBreak350(s,bully,'insulting-spree',{candidates:insultCandidates350(s,bully,true)!})).toBe(true);
 const c=bully.mental!.crisis!;expect(c.kind).toBe('insulting-spree');expect([x.id,y.id]).toContain((c as {insultTargetId:number}).insultTargetId);
 until(s,()=>[x,y].some(t=>t.social?.memories.some(m=>m.kind==='insult'&&m.otherId===bully.id)),600,'first insult');valid(s);
 const victim=[x,y].find(t=>t.social?.memories.some(m=>m.kind==='insult'))!;
 expect(opinionCauses(victim,bully.id,s.tick,s).find(k=>k.kind==='insult')!.value).toBeLessThan(0);
 expect(thought(s,victim,`insult-${bully.id}`)?.offset).toBe(-5);
 expect(s.events.some(e=>e.message.includes('insulte')&&e.message.includes('pendant sa crise'))).toBe(true);
 // At most one insult per 1 200 Core ticks.
 const insults=()=>[x,y].reduce((n,t)=>n+(t.social?.memories.filter(m=>m.kind==='insult'&&m.otherId===bully.id).length??0),0);
 const first=insults();stepWorld(s,100);expect(insults()).toBe(first);
 expect(reload(s)).toEqual(s);
 // Targeted spree: follows one non-prisoner person; ends early only after an insult.
 const t=camp(),[tb,t1]=t.pawns as [Pawn,Pawn];
 expect(startMoodPoolBreak350(t,tb,'targeted-insulting-spree',{candidates:insultCandidates350(t,tb,false)!})).toBe(true);
 const tc=tb.mental!.crisis! as {kind:string;insultTargetId:number;insulted:boolean};
 expect(tc.kind).toBe('targeted-insulting-spree');expect(tc.insulted).toBe(false);
 tb.mental!.crisis!.age=25020;const rng=t.rng;updateMentalBreak(t,tb);expect(t.rng).toBe(rng);expect(tb.mental?.crisis).toBeDefined();
 until(t,()=>tc.insulted,600,'targeted insult');valid(t);void t1;void a;void b;
});

test('a psychic drone gives its thought to the drawn gender only, shows as a map condition and ends',()=>{
 const w=createScenarioWorld(42,64,'crashlanded');
 until(w,()=>w.pawns.filter(x=>x.faction===undefined||x.faction==='colony').length>=3&&!w.startingArrival,3000,'the landing');
 adoptMiscIncidents(w);const state=w.miscIncidents!;expect(state).toBeDefined();
 const colonists=w.pawns.filter(x=>(x.faction??'colony')==='colony');expect(colonists.length).toBeGreaterThanOrEqual(3);
 const gender=(x:Pawn)=>x.appearance?.sex??'none';
 // Both rows can fire from 350 and have an effect; at 349 they stay tickets without effect.
 const rows=miscLotteryRows329(w,state).filter(row=>row.id==='psychic-drone'||row.id==='psychic-soothe');
 expect(rows.every(row=>!!row.resolve&&row.eligible!())).toBe(true);
 const old=structuredClone(w);Object.assign(old,{schemaVersion:349});
 expect(miscLotteryRows329(old,old.miscIncidents!).filter(row=>row.id.startsWith('psychic')).every(row=>!row.resolve&&!row.eligible)).toBe(true);
 // Draws: duration first, then the gender of a free colonist.
 const draws=[.5,.4];expect(resolveSelectedPsychic350(w,'drone',()=>draws.shift()!,state)).toBe(true);
 const free=w.pawns.filter(x=>(x.faction??'colony')==='colony'&&!x.prisoner&&!x.visitor);
 const c=psychicActive350(w)!;expect(c).toMatchObject({kind:'drone',level:'low',gender:gender(free[Math.floor(.4*free.length)]!)});
 const hit=colonists.filter(x=>gender(x)===c.gender),missed=colonists.filter(x=>gender(x)!==c.gender);expect(hit.length).toBeGreaterThan(0);
 const q=hit[0]!;
 expect(c.endCore-c.startCore).toBe(Math.round(Math.fround(Math.fround(.75)+Math.fround(Math.fround(1)*Math.fround(.5)))*60000));
 expect(eligiblePsychic350(w,'soothe',state)).toBe(false);
 for(const x of hit)expect(thought(w,x,'psychic-')).toMatchObject({label:'Bourdonnement psychique faible',offset:-12});
 for(const x of missed)expect(thought(w,x,'psychic-')).toBeUndefined();
 expect(weatherConditionInspection(w).find(x=>x.kind==='psychic')?.title).toBe(`Bourdonnement psychique faible (${c.gender==='female'?'femmes':c.gender==='male'?'hommes':'personnes sans genre'})`);
 expect(weatherConditionLabel(w)).toContain('Bourdonnement psychique');
 valid(w);expect(reload(w)).toEqual(w);
 const bad=JSON.parse(serializeWorld(w));bad.miscIncidents.psychic350.level='soothe';expect(()=>deserializeWorld(JSON.stringify(bad))).toThrow();
 const future=JSON.parse(asOldSchema(serializeWorld(w),349));future.miscIncidents.psychic350={...state.psychic350};expect(()=>deserializeWorld(JSON.stringify(future))).toThrow();
 // The thought pushes the mood down through the ordinary need steps.
 const before=q.mood;stepWorld(w,150);expect(q.mood).toBeLessThan(before);
 // Prepared shortcut: the condition's end is brought to the next ticks, not played for 1.25 days.
 state.psychic350!.endCore=w.tick*10+15;stepWorld(w,3);
 expect(w.miscIncidents!.psychic350).toBeUndefined();expect(thought(w,q,'psychic-')).toBeUndefined();
 expect(w.events.some(e=>e.message==='Le bourdonnement psychique prend fin.')).toBe(true);
 // 15 days before the same incident again; the soothe has its own clock.
 expect(eligiblePsychic350(w,'drone',state)).toBe(false);expect(eligiblePsychic350(w,'soothe',state)).toBe(true);
 expect(resolveSelectedPsychic350(w,'soothe',()=>.9,state)).toBe(true);
 const soothe=psychicActive350(w)!;for(const x of colonists)expect(thought(w,x,'psychic-')?.offset).toBe(gender(x)===soothe.gender?16:undefined);
 // (This direct resolve counted no Misc opportunity; only the condition's own shape is checked here.)
 expect(validPsychic350(state as unknown as Record<string,unknown>,SCHEMA_VERSION,w.tick)).toBe(true);
});

/** One cook, a fuelled stove with a repeating meal bill, rice and two food
 * storage cells: the cook works the bill at the stove's work cell. */
function kitchen(version:number,stool:boolean):{w:World;cook:Pawn} {
 const w=createWorld(350,40,40);
 w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
 w.pawns=w.pawns.slice(0,1);const cook=w.pawns[0]!;Object.assign(cook,{hunger:100,rest:100,x:10,z:10});delete cook.background;delete cook.traits;
 cook.priorities={...idle,cook:1};cook.skills.cooking={level:10,xp:0,dailyXp:0,passion:0};
 const station={id:w.nextId++,kind:'fueled-stove' as const,x:10,z:16,orientation:0 as const,footprint:'standard' as const,material:'steel' as const,bills:[],fuel:newBuildingFuel('fueled-stove')};
 station.fuel.ticks=12000;w.structures.push(station);addGroundMaterial(w,'food',70,{x:12,z:18},'rice');
 if(stool)fixtureBuilding(w,'stool',10,15);
 for(const x of [14,15])expect(applyCommand(w,{type:'stockpile',enabled:true,x,z:10,filters:{wood:false,food:true}}).ok).toBe(true);
 expect(applyCommand(w,{type:'bill-add',structureId:station.id,recipe:'simple-meal'}).ok).toBe(true);
 const bill=station.bills[0]! as import('../src/sim/cooking-types.ts').CookingBill;
 expect(applyCommand(w,{type:'bill-update',structureId:station.id,billId:bill.id,settings:{...bill,mode:'forever'}}).ok).toBe(true);
 refreshStock(w);Object.assign(w,{schemaVersion:version});return {w,cook};
}
test('a chair on the work cell of a production bench gives comfort while cooking, only from 350',()=>{
 const run=(version:number,stool:boolean)=>{
  const {w,cook}=kitchen(version,stool);cook.comfort=0;let worked=0;
  for(let i=0;i<400;i++){stepWorld(w);if(cook.cooking?.phase==='work'){worked++;expect([cook.x,cook.z]).toEqual([10,15]);}}
  expect(worked).toBeGreaterThan(60);return cook.comfort;
 };
 const seated=run(SCHEMA_VERSION,true);expect(seated).toBeGreaterThan(5);
 expect(run(SCHEMA_VERSION,false)).toBe(0);
 expect(run(349,true)).toBe(0);
});

test('small thoughts: rescued me and hospital room, a released healthy prisoner, the lover\'s opinion',()=>{
 // RescuedMe: +15 opinion of the rescuer, 30 days; the patient lies in a hospital.
 const w=rescueCamp(),[doctor,patient]=w.pawns as [Pawn,Pawn];
 const bed=w.structures.find(s=>s.kind==='bed')!;room(w,bed.x-1,bed.z-1,bed.x+1,bed.z+1,{x:bed.x,z:bed.z-2});refreshStock(w);
 until(w,()=>patient.need?.kind==='sleep'&&patient.need.bedId===bed.id&&patient.x===bed.x&&patient.z===bed.z,1500,'rescued into the medical bed');valid(w);
 expect(opinionCauses(patient,doctor.id,w.tick,w).find(c=>c.kind==='rescued-me')).toMatchObject({value:15,label:'M’a secouru',count:1});
 expect(opinionCauses(patient,doctor.id,w.tick+28*TICKS_PER_DAY,w).find(c=>c.kind==='rescued-me')!.value).toBeLessThan(15);
 expect(thought(w,patient,'hospital-patient-room')?.label).toMatch(/^Hôpital/);
 expect(reload(w)).toEqual(w);
 // ReleasedHealthyPrisoner: every free colonist, +2 for six days.
 const f=recruitmentUiFixture(),r=f.world,warden=r.pawns[0]!,prisoner=r.pawns[2]!;
 warden.priorities.warden=1;expect(applyCommand(r,{type:'prisoner-mode',patientId:prisoner.id,mode:'release'})).toEqual({ok:true});
 until(r,()=>prisoner.prisoner?.releasedAt!==undefined,1500,'release');valid(r);
 const colonists=r.pawns.filter(q=>q!==prisoner&&q.faction===undefined||q.faction==='colony');
 for(const q of colonists)if(q!==prisoner)expect(thought(r,q,'mood350-released-prisoner')).toMatchObject({offset:2,label:'Prisonnier libéré'});
 expect(reload(r)).toEqual(r);
 // OpinionOfMyLover: 0.1 × opinion of the partner.
 const l=camp(),[u,v]=l.pawns as [Pawn,Pawn];
 l.relationships={links:[{kind:'lover',aId:Math.min(u.id,v.id),bId:Math.max(u.id,v.id),recordedAt:0}]};
 const opinion=opinionOf(u,v.id,l.tick,l);expect(opinion).not.toBe(0);
 expect(thought(l,u,'opinion-of-lover')).toMatchObject({offset:opinion<0?Math.min(.1*opinion,-1):Math.max(.1*opinion,1)});
});

test('a pet nuzzles a colonist by its hourly chance; a bonded pet\'s death is mourned; a sleeper is disturbed by walkers',()=>{
 const f=animalHaulingCamp459(),w=f.world,h=f.handler,a=f.animal;
 expect(a.wander).toBeDefined();
 until(w,()=>!!h.roomMemories?.some(m=>m.kind==='nuzzled'),25000,'a nuzzle');valid(w);
 expect(thought(w,h,'mood350-nuzzled')).toMatchObject({offset:4,label:'Câlin d’un animal'});
 expect(w.events.some(e=>e.message.includes('vient se frotter contre'))).toBe(true);
 // The hour of the nuzzle passed the species' 1/12 chance.
 expect(nuzzleHourChance350(w.seed,a.id,a.wander!.nuzzle350!.tryCore,12)).toBe(true);
 expect(reload(w)).toEqual(w);
 // Stacks of three at 4, 6, 7.
 const n=structuredClone(h);n.roomMemories=[];for(let i=0;i<4;i++)gainMoodPoolMemory350(n,'nuzzled',w.tick+i);
 expect(n.roomMemories.filter(m=>m.kind==='nuzzled')).toHaveLength(3);
 // BondedAnimalDied: -8 for twenty days.
 a.startingPet={revision:1,name:'Pistache',bondedPawnId:h.id,obedience:{steps:3,wanted:true}};valid(w);
 damageAnimalWithBullet(w,a,{part:'heart',damage:50});expect(a.state).toBe('dead');
 stepWorld(w);expect(thought(w,h,'mood350-bonded-animal-died')).toMatchObject({offset:-8});
 stepWorld(w,3);expect(h.roomMemories!.filter(m=>m.kind==='bonded-animal-died')).toHaveLength(1);valid(w);
 // SleepDisturbed: a colonist walks back and forth in the room of a sleeper.
 const s=camp(),[sleeper,walker]=s.pawns as [Pawn,Pawn];
 Object.assign(sleeper,{x:22,z:22,state:'sleeping',need:{kind:'sleep',phase:'sleep',bedId:sleeper.bedId,target:{x:22,z:22}},rest:10});
 Object.assign(walker,{x:20,z:20});expect(applyCommand(s,{type:'draft',pawnIds:[walker.id],enabled:true}).ok).toBe(true);
 for(let i=0;i<40&&!sleeper.roomMemories?.some(m=>m.kind==='sleep-disturbed');i++){
  const target=i%2?{x:20,z:20}:{x:24,z:24};
  expect(applyCommand(s,{type:'draft-move',pawnIds:[walker.id],target,queue:false}).ok).toBe(true);
  for(let k=0;k<60&&(walker.x!==target.x||walker.z!==target.z);k++)stepWorld(s);
 }
 expect(thought(s,sleeper,'mood350-sleep-disturbed')).toMatchObject({offset:-1,label:'Sommeil perturbé'});valid(s);
});

test('saves keep the new states strictly; nothing changes below 350; a 349 save migrates by number only',()=>{
 const w=camp(),[p,q]=w.pawns as [Pawn,Pawn];
 gainMoodPoolMemory350(p,'sleep-disturbed',w.tick);gainMoodPoolMemory350(p,'released-prisoner',w.tick,999);
 expect(startMoodPoolBreak350(w,q,'insulting-spree',{candidates:insultCandidates350(w,q,true)!})).toBe(true);
 valid(w);const text=serializeWorld(w);expect(serializeWorld(deserializeWorld(text))).toBe(text);
 // Strict shapes: a future field or a broken record is refused.
 const bad=JSON.parse(text);bad.pawns[0].roomMemories[0].otherId=5;expect(()=>deserializeWorld(JSON.stringify(bad))).toThrow();
 const badCrisis=JSON.parse(text);badCrisis.pawns[1].mental.crisis.insultTargetId=badCrisis.pawns[1].id;expect(()=>deserializeWorld(JSON.stringify(badCrisis))).toThrow();
 // A 349 save holding these is refused; a clean 349 save migrates by number only.
 const future=JSON.parse(text);future.schemaVersion=349;expect(()=>deserializeWorld(JSON.stringify(future))).toThrow();
 const clean=camp(),migrated=deserializeWorld(asOldSchema(serializeWorld(clean),349));
 expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(serializeWorld(migrated)).toBe(serializeWorld(clean));
 expect(migrated.pawns.some(x=>x.roomMemories||x.social?.memories.some(m=>m.kind==='rescued-me'))).toBe(false);
 // Below 350 the same world gives none of these thoughts, draws or memories.
 const old=camp(349),[op]=old.pawns as [Pawn];expect(isMoodPool350(old.schemaVersion)).toBe(false);
 expect(ownRoomRoot350(old,op)).toBeDefined();expect(startMoodPoolBreak350(old,op,'wander-own-room',{root:{x:22,z:22}})).toBe(false);
 const rng=old.rng;stepWorld(old,200);
 expect(old.pawns.some(x=>x.roomMemories?.some(m=>['sleep-disturbed','nuzzled'].includes(m.kind)))).toBe(false);
 expect(moodThoughts(old,op).some(t=>t.id.startsWith('psychic-')||t.id.startsWith('mood350-')||t.id.startsWith('hospital-')||t.id.startsWith('opinion-of-lover'))).toBe(false);
 void rng;
});
