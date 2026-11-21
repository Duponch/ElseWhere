import {describe,expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine';
import {enableCassandraRaids,INTRO_RAID_TICK} from '../src/sim/cassandra-raids';
import {newCorePathBudget297} from '../src/sim/core-path-budget-297';
import {adoptFluIncidents} from '../src/sim/flu-incidents';
import {crashlandedProfile} from '../src/sim/game-profile';
import {injurePawn} from '../src/sim/health';
import {advanceQuests} from '../src/sim/quests';
import {advanceRaids} from '../src/sim/raids';
import {captureGroupMass} from '../src/sim/group-capture';
import {freightGroup} from '../src/sim/group-freight';
import {addGroundMaterial} from '../src/sim/materials';
import {lyingPatient} from '../src/sim/care-access';
import {currentMedicalBed} from '../src/sim/hospital-medical-stats';
import {pasteHoppers} from '../src/sim/nutrient-paste';
import {planetHomeCivilCore,tileHour} from '../src/sim/planet-navigation';
import {serializeWorld} from '../src/sim/serialization';
import type {TradeRequest284} from '../src/sim/trade-request-state-284';
import {SCHEMA_VERSION,TICKS_PER_DAY,type World} from '../src/sim/types';
import {coreAlertPriority} from '../src/ui/alert-priority';
import {toolDefinitions} from '../src/ui/layout';
import {GLOBAL_TOOL_HOTKEYS,MAIN_TAB_HOTKEYS,ORDERS_PALETTE_HOTKEYS,ZONES_PALETTE_HOTKEYS,globalHotkeyTool,mainTabHotkey,paletteHotkeyTool} from '../src/ui/main-tab-hotkeys';
import {objectNotificationTarget,personNotificationTarget} from '../src/ui/notification-focus';
import {readStatusAlerts} from '../src/ui/status-alerts';
import {AlertActivationTracker,readNativeAlertRows} from '../src/ui3d/native-alert-list';
import {QUEST_EXPIRES_SOON_CORE_TICKS,readNativeDomainAlerts,readQuestExpiresSoon} from '../src/ui3d/native-domain-alerts';
import {reorganizationCamp256} from './helpers/group-reorganization-v256';
import {pasteCamp} from './helpers/nutrient-paste-v282';
import {surgeryCamp} from './helpers/surgery-v192';
import {careCamp} from './scenarios/care';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction';
import {medicalCamp} from './scenarios/health';
import {rescueCamp} from './scenarios/rescue';

/** Alerts lot C: the occasional Core RimWorld 1.6 alerts and the main-tab
 * keys, read on World states built with the scenario helpers. Readers are pure. */
const row=(w:World,key:string)=>readStatusAlerts(w).find(r=>r.key===key);
const has=(w:World,key:string)=>readStatusAlerts(w).some(r=>r.key===key);
const until=(w:World,done:()=>boolean,limit:number)=>{for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done(),`not reached at tick ${w.tick}`).toBe(true);};
const actor=(w:World,id:number)=>w.pawns.find(p=>p.id===id)!;

describe('occasional Core alerts on real World states',()=>{
  test('a nutrient paste dispenser without a cardinal hopper is High until a hopper is built beside it',()=>{
    const f=pasteCamp(0),w=f.world,builder=w.pawns[0]!,dispenser=w.structures.find(s=>s.id===f.dispenserId)!;
    builder.priorities.build=1;
    expect(has(w,'paste-dispenser-hopper')).toBe(false);
    // The colonist deconstructs the only hopper: the dispenser is left without one.
    expect(applyCommand(w,{type:'designate',kind:'deconstruct',x:12,z:13}).ok).toBe(true);
    until(w,()=>!w.structures.some(s=>s.kind==='hopper'),3000);
    const alert=row(w,'paste-dispenser-hopper')!;
    expect(alert).toMatchObject({text:'Distributeur sans trémie',targets:[objectNotificationTarget('structure',dispenser.id,dispenser)]});
    expect(coreAlertPriority(alert)).toBe('high');
    // A diagonal hopper does not feed it (Core AdjCellsCardinalInBounds), as for the simulation.
    const diagonal=fixtureBuilding(w,'hopper',dispenser.x-1,dispenser.z-1);
    expect(pasteHoppers(w,dispenser)).toEqual([]);expect(has(w,'paste-dispenser-hopper')).toBe(true);
    w.structures=w.structures.filter(s=>s!==diagonal);
    // A new hopper on the same edge, built by the colonist from delivered steel.
    addGroundMaterial(w,'steel',15,{x:9,z:15});
    expect(applyCommand(w,{type:'designate',kind:'hopper',x:12,z:13,material:'steel'}).ok).toBe(true);
    until(w,()=>w.structures.some(s=>s.kind==='hopper'),6000);
    expect(pasteHoppers(w,dispenser)).toHaveLength(1);expect(has(w,'paste-dispenser-hopper')).toBe(false);
  });

  test('a patient lying in bed for an operation is Medium only while a doctor is available, until operated',()=>{
    const c=surgeryCamp(),w=c.world;
    expect(applyCommand(w,{type:'surgery-request',pawnId:c.patientId,part:'left-arm'})).toEqual({ok:true});
    expect(has(w,'awaiting-operation')).toBe(false); // not yet in bed
    until(w,()=>lyingPatient(actor(w,c.patientId)),900);
    expect(currentMedicalBed(w,actor(w,c.patientId))).toBeDefined();
    expect(has(w,'awaiting-operation')).toBe(false); // nobody has the Doctor work: no available doctor
    expect(applyCommand(w,{type:'priority',pawnId:c.doctorId,work:'doctor',value:1}).ok).toBe(true);
    const alert=row(w,'awaiting-operation')!;
    expect(alert).toMatchObject({text:'1 patient en attente d’opération',targets:[personNotificationTarget(w,c.patientId)],tab:'health'});
    expect(alert.explanation).toContain('Patient');expect(coreAlertPriority(alert)).toBe('medium');
    until(w,()=>!actor(w,c.patientId).surgeryRequest,6000);
    expect(has(w,'awaiting-operation')).toBe(false);
  });

  test('no doctor while a colonist needs tending is High; a Doctor priority clears it',()=>{
    const w=careCamp(),[doctor,patient]=w.pawns;
    expect(has(w,'need-doctor')).toBe(false);
    expect(applyCommand(w,{type:'priority',pawnId:doctor!.id,work:'doctor',value:0}).ok).toBe(true);
    const alert=row(w,'need-doctor')!;
    expect(alert).toMatchObject({text:'Médecin nécessaire',targets:[personNotificationTarget(w,patient!.id)],context:{panel:'work'},tab:'health'});
    expect(coreAlertPriority(alert)).toBe('high');
    // The patient walks to the medical bed by itself; the wound still waits for a doctor.
    until(w,()=>!!currentMedicalBed(w,patient!),1500);
    expect(row(w,'need-doctor')?.targets).toEqual([personNotificationTarget(w,patient!.id)]);
    expect(applyCommand(w,{type:'priority',pawnId:doctor!.id,work:'doctor',value:1}).ok).toBe(true);
    expect(has(w,'need-doctor')).toBe(false);
  });

  test('a downed colonist in bed counts only when hungry, and a downed doctor is no doctor',()=>{
    const w=rescueCamp(),[rescuer,patient]=w.pawns;
    until(w,()=>!!currentMedicalBed(w,patient!),2500);
    expect(patient!.state).toBe('downed');
    // Medical care off: nothing to tend, only Core's "down in bed and hungry" case remains.
    patient!.medicalCare='none';patient!.hunger=90;
    expect(applyCommand(w,{type:'priority',pawnId:rescuer!.id,work:'doctor',value:0}).ok).toBe(true);
    expect(has(w,'need-doctor')).toBe(false);
    patient!.hunger=20; // below Core's Hungry threshold (24 %)
    expect(row(w,'need-doctor')?.targets).toEqual([personNotificationTarget(w,patient!.id)]);
    expect(applyCommand(w,{type:'priority',pawnId:rescuer!.id,work:'doctor',value:1}).ok).toBe(true);
    expect(has(w,'need-doctor')).toBe(false);
    rescuer!.state='downed'; // a doctor on the ground cannot tend
    expect(has(w,'need-doctor')).toBe(true);
  });

  test('mining designations with no miner are High, pointing at the first order, until a miner is enabled',()=>{
    const w=medicalCamp(1),miner=w.pawns[0]!;miner.priorities.mine=1;
    const [x,z]=[miner.x+1,miner.z];
    for(const dx of [0,1])w.tiles[z*w.width+x+dx]={terrain:'rock',stone:'sandstone'};
    expect(applyCommand(w,{type:'area',action:'mine',from:{x,z},to:{x:x+1,z}}).ok).toBe(true);
    const first=w.jobs.find(j=>j.kind==='mine')!;
    expect(has(w,'need-miner')).toBe(false);
    miner.priorities.mine=0; // the player's Work tab setting
    const alert=row(w,'need-miner')!;
    expect(alert).toMatchObject({text:'Mineur nécessaire',targets:[objectNotificationTarget('job',first.id,first)],context:{panel:'work'}});
    expect(coreAlertPriority(alert)).toBe('high');
    miner.state='downed';miner.priorities.mine=1;expect(has(w,'need-miner')).toBe(true); // a miner on the ground does not count
    miner.state='idle';expect(has(w,'need-miner')).toBe(false);
    until(w,()=>!w.jobs.some(j=>j.kind==='mine'),6000);
    miner.priorities.mine=0;
    expect(has(w,'need-miner')).toBe(false); // nothing designated any more
  });

  test('a selected project without its bench is Medium and opens Research; Core ignores power',()=>{
    const w=deconstructionCamp(2);w.research={project:null,points:0};
    expect(has(w,'need-research-bench')).toBe(false);
    w.research.project='complex-clothing';
    expect(row(w,'need-research-bench')).toMatchObject({text:'Bureau de recherche nécessaire',targets:[],context:{panel:'research'}});
    expect(coreAlertPriority(row(w,'need-research-bench')!)).toBe('medium');
    fixtureBuilding(w,'research-bench',8,8);
    expect(has(w,'need-research-bench')).toBe(false);
    w.research.project='multi-analyzer'; // needs the hi-tech bench
    expect(row(w,'need-research-bench')?.text).toBe('Bureau de recherche avancé nécessaire');
    const advanced=fixtureBuilding(w,'hi-tech-research-bench',12,8);Object.assign(advanced,{material:'steel',power:{on:false,parentId:null}});
    expect(has(w,'need-research-bench')).toBe(false);
  });
});

/** A prepared away caravan of the world registry (group-reorganization-v256):
 * its phase, stop, pause and load are declared here; no journey is claimed. */
function caravan(){
  const f=reorganizationCamp256(false);f.g.phase='stationary';f.g.stop={kind:'stationary'};
  const hour=()=>tileHour(f.w.planet!,f.g.tile,planetHomeCivilCore(f.w)),night=()=>hour()<6||hour()>22;
  const at=(wanted:boolean)=>{for(let i=0;i<48&&night()!==wanted;i++)f.w.tick+=TICKS_PER_DAY/48;expect(night()).toBe(wanted);};
  return {...f,night,at};
}

describe('caravans',()=>{
  test('a caravan standing still is idle (Medium) by day, not at night, paused, marching or with a member down',()=>{
    const {w,g,at}=caravan();
    at(false);
    const idle=row(w,'caravan-idle')!;
    expect(idle).toMatchObject({text:'Caravane inactive',targets:[],context:{panel:'world',worldTab:'group'}});
    expect(coreAlertPriority(idle)).toBe('medium');expect(has(w,'immobile-caravan')).toBe(false);
    g.paused=true;expect(has(w,'caravan-idle')).toBe(false); // Core: a paused caravan cannot move, so it is not idle
    g.paused=false;
    g.phase='travelling';g.stop=null;g.segment={from:g.tile,to:g.tile+1,totalCore:100,remainingCore:50};
    expect(has(w,'caravan-idle')).toBe(false); // marching
    g.segment=null;g.stop={kind:'unreachable',destination:g.tile+1};
    expect(has(w,'caravan-idle')).toBe(true); // stopped by an unreachable destination: free to take another route
    g.phase='at-site';g.stop={kind:'at-site'};expect(has(w,'caravan-idle')).toBe(true);
    g.phase='awaiting-entry';g.stop={kind:'awaiting-entry'};expect(has(w,'caravan-idle')).toBe(false);
    g.phase='stationary';g.stop={kind:'stationary'};
    g.members[0]!.state='downed';expect(has(w,'caravan-idle')).toBe(false); // Elsewhere's march stops for a member down
    g.members[0]!.state='idle';
    at(true);expect(has(w,'caravan-idle')).toBe(false); // Caravan.NightResting
  });

  test('an overloaded caravan is Critical and never idle, whatever it is doing; unloading clears it',()=>{
    const {w,g,at}=caravan();
    at(false);expect(has(w,'immobile-caravan')).toBe(false);
    const load={id:w.nextId++,kind:'steel' as const,item:'steel' as const,quantity:600,owner:{type:'inventory' as const,pawnId:g.members[0]!.id}};
    g.items.push(load);
    const mass=captureGroupMass(g.members,g.items,freightGroup(g),SCHEMA_VERSION,g.packed,g.animalOwners?.members)!;expect(mass.grams).toBeGreaterThan(mass.capacityGrams);
    const immobile=row(w,'immobile-caravan')!;
    expect(immobile).toMatchObject({text:'Caravane immobilisée',targets:[],context:{panel:'world',worldTab:'group'}});
    expect(immobile.explanation).toContain('kg');expect(coreAlertPriority(immobile)).toBe('critical');
    expect(has(w,'caravan-idle')).toBe(false);
    g.phase='at-site';g.stop={kind:'at-site'};expect(has(w,'immobile-caravan')).toBe(true);
    g.items=g.items.filter(p=>p!==load);
    expect(has(w,'immobile-caravan')).toBe(false);expect(has(w,'caravan-idle')).toBe(true);
  });
});

/** Prepared Cassandra colony from quests-v183; the offer is the real producer's.
 * The declared clock jumps refresh the physical path budget before any step. */
function asylumOffer(){
  const w=deconstructionCamp(3);
  w.scenario={id:'crashlanded',revision:1,landing:{x:16,z:16}};w.gameProfile=crashlandedProfile();
  enableCassandraRaids(w);adoptFluIncidents(w);
  expect(applyCommand(w,{type:'enable-quests'})).toMatchObject({ok:true});
  w.tick=INTRO_RAID_TICK;advanceRaids(w);
  const intro=w.raids!.active!;injurePawn(w,w.pawns.find(p=>p.id===intro.members[0])!,'brain','crush',99000);advanceRaids(w);
  w.tick=w.quests!.nextCheck;advanceQuests(w);w.corePathBudget297=newCorePathBudget297(w.tick);
  const quest=w.quests!.entries[0]!;expect(quest.status).toBe('offered');
  return {w,quest};
}
function tradeRequest(w:World,id:number,offeredAtCore:number,offerExpiresAtCore:number):TradeRequest284 {
  return {id,homeMapId:0,settlementId:1,factionId:1,giverId:1,tile:0,settlementName:`Rive ${id}`,offeredAtCore,offerExpiresAtCore,durationCore:720000,
    family:'component',quantity:2,baseMarketValue:10,wealth:{basis:'known-material-v1',value:0,items:0,structures:0,floors:0,unpricedPiles:0,unpricedPacked:0,unpricedStructures:0,unpricedPawns:0},rewardBudget:250,
    options:[],dismissed:false,status:'offered',cleanup:[]} as unknown as TradeRequest284;
}

describe('offers about to expire (Alert_QuestExpiresSoon)',()=>{
  test('an asylum offer raises one High row that opens Quests; accepting or letting it expire clears it',()=>{
    const {w,quest}=asylumOffer();
    const rows=readNativeAlertRows(w,undefined),alert=rows.find(r=>r.key==='domain:quest-expires-soon')!;
    expect(alert.priority).toBe('high');expect(alert.domain?.action).toEqual({kind:'quests',questId:quest.id});
    expect(alert.text).toMatch(/^Offre expirant dans /);expect(alert.domain?.body).toContain(quest.name);
    // The offer is no lasting row: before its last day it lives in the letter and Quests.
    expect(rows.some(r=>r.key===`domain:quest:${quest.id}`)).toBe(false);
    const accepted=structuredClone(w);
    expect(applyCommand(accepted,{type:'answer-quest',questId:quest.id,accept:true}).ok).toBe(true);
    expect(readQuestExpiresSoon(accepted)).toBeUndefined();
    expect(readNativeDomainAlerts(accepted).some(r=>r.key===`domain:quest:${quest.id}`)).toBe(true); // the pursuit to come
    // At the end of the offer there is no time left: no alert, then the producer expires it.
    w.tick=quest.expiresAt;expect(readQuestExpiresSoon(w)).toBeUndefined();
    advanceQuests(w);expect(w.quests!.entries[0]!.status).toBe('expired');expect(readQuestExpiresSoon(w)).toBeUndefined();
  });

  test('a trade request is alerted only during its last Core day, dismissed or expired offers never',()=>{
    const w=deconstructionCamp(1);w.tick=10_000;
    const request=tradeRequest(w,7,50_000,w.tick*10+QUEST_EXPIRES_SOON_CORE_TICKS);
    w.tradeRequests284={revision:1,adoptedAtCore:1000,nextId:8,entries:[request]} as unknown as World['tradeRequests284'];
    expect(readQuestExpiresSoon(w)).toBeUndefined(); // exactly one day left: not yet (Core: strictly under 60 000)
    expect(readNativeDomainAlerts(w).some(r=>r.key==='domain:trade-request:7')).toBe(false);
    w.tick+=1;
    expect(readQuestExpiresSoon(w)).toMatchObject({priority:'high',severity:'warning',action:{kind:'quests',requestId:7}});
    request.dismissed=true;expect(readQuestExpiresSoon(w)).toBeUndefined();request.dismissed=false;
    w.tick=request.offerExpiresAtCore/10;expect(readQuestExpiresSoon(w)).toBeUndefined();
    // The soonest offer wins; on a tie, the newest one (Core display order).
    w.tick=10_001;
    const later=tradeRequest(w,8,60_000,request.offerExpiresAtCore),sooner=tradeRequest(w,9,40_000,request.offerExpiresAtCore-100);
    w.tradeRequests284!.entries.push(later);
    expect(readQuestExpiresSoon(w)?.action).toEqual({kind:'quests',requestId:8});
    w.tradeRequests284!.entries.push(sooner);
    expect(readQuestExpiresSoon(w)?.action).toEqual({kind:'quests',requestId:9});
    // No alert at all during the first 600 Core ticks.
    w.tick=50;w.tradeRequests284!.entries=[tradeRequest(w,10,0,500+QUEST_EXPIRES_SOON_CORE_TICKS-1)];
    expect(readQuestExpiresSoon(w)).toBeUndefined();
  });
});

describe('priorities and the list',()=>{
  test('lot C rows take their Core priority and order: Critical, then High, then Medium',()=>{
    for(const [key,priority] of [['immobile-caravan','critical'],['need-doctor','high'],['need-miner','high'],['paste-dispenser-hopper','high'],
      ['awaiting-operation','medium'],['need-research-bench','medium'],['caravan-idle','medium']] as const)expect(coreAlertPriority({key})).toBe(priority);
    const rows=['caravan-idle','need-research-bench','need-miner','immobile-caravan','paste-dispenser-hopper'].map(key=>({key,priority:coreAlertPriority({key})}));
    expect(new AlertActivationTracker().update(rows,true).ordered.map(r=>r.key)).toEqual(['immobile-caravan','need-miner','paste-dispenser-hopper','caravan-idle','need-research-bench']);
  });

  test('reading the lot C alerts never mutates the World',()=>{
    const c=surgeryCamp(),w=c.world;w.research={project:'complex-clothing',points:0};
    expect(applyCommand(w,{type:'surgery-request',pawnId:c.patientId,part:'left-arm'}).ok).toBe(true);
    const before=serializeWorld(w);
    readStatusAlerts(w);readNativeAlertRows(w,undefined);readQuestExpiresSoon(w);
    expect(serializeWorld(w)).toBe(before);
  });
});

describe('main-tab and designator keys (Core KeyBindings and MainButtonDefs)',()=>{
  test('Tab and F1 to F9 open the Core main tabs',()=>{
    expect(MAIN_TAB_HOTKEYS).toEqual({Tab:'architect',F1:'work',F2:'schedule',F3:'assign',F4:'animals',F5:'wildlife',F6:'research',F7:'quests',F8:'world',F9:'history'});
    expect(mainTabHotkey('F7')).toBe('quests');expect(mainTabHotkey('F10')).toBeUndefined();expect(mainTabHotkey('toString')).toBeUndefined();
  });

  test('C cancels and X deconstructs everywhere; the open palette uses Core letters, shown on its tiles',()=>{
    expect(globalHotkeyTool('c')).toBe('cancel');expect(globalHotkeyTool('X')).toBe('deconstruct');
    expect(Object.values(GLOBAL_TOOL_HOTKEYS)).not.toContain('chop');
    expect(paletteHotkeyTool('orders','b')).toBe('chop');expect(paletteHotkeyTool('orders','H')).toBe('harvest');
    expect(paletteHotkeyTool('zones','b')).toBe('stockpile');expect(paletteHotkeyTool(undefined,'b')).toBeUndefined();
    expect(paletteHotkeyTool('orders','F1')).toBeUndefined();
    for(const [palette,table] of [['orders',ORDERS_PALETTE_HOTKEYS],['zones',ZONES_PALETTE_HOTKEYS]] as const){
      const letters=Object.keys(table);expect(new Set(Object.values(table)).size).toBe(letters.length);
      for(const [letter,tool] of Object.entries(table)){
        const definition=toolDefinitions.find(t=>t.id===tool)!;expect(definition,tool).toBeDefined();
        // Cancel and deconstruct belong to Orders but Core lists them in every category.
        if(tool!=='cancel'&&tool!=='deconstruct'){expect(definition.category).toBe(palette);expect(definition.key).toBe(letter.toUpperCase());}
      }
    }
    for(const tool of Object.values(GLOBAL_TOOL_HOTKEYS))expect(toolDefinitions.some(t=>t.id===tool),tool).toBe(true);
  });
});
