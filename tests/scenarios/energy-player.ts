import { hostileTo,isColonist } from '../../src/sim/affiliation.ts';
import { equippedWeapon } from '../../src/sim/equipment-rules.ts';
import { isRoomDoor } from '../../src/sim/door-rules.ts';
import { canDesignate } from '../../src/sim/engine.ts';
import { footprintCells } from '../../src/sim/definitions.ts';
import { requiredMaterial } from '../../src/sim/construction-materials.ts';
import { researchUnlocked } from '../../src/sim/research.ts';
import { isPowerActive } from '../../src/sim/power-rules.ts';
import { batteryWattDays } from '../../src/sim/power-battery.ts';
import { solarPowerOutput } from '../../src/sim/solar-rules.ts';
import { canFlickPower } from '../../src/sim/power-flick.ts';
import { TemperatureView } from '../../src/sim/temperature.ts';
import { blockedCells } from '../../src/sim/pathfinding.ts';
import { candidateAccess } from '../../src/sim/candidate-access.ts';
import { captureStandability } from '../../src/sim/furniture-travel.ts';
import { reservedServiceCells } from '../../src/sim/service-reservations.ts';
import { CIVIL_TRANSIT_BLOCKERS } from '../../src/sim/travel.ts';
import { queryArea } from '../../src/sim/designation.ts';
import { queryOrderOptions } from '../../src/sim/player-orders.ts';
import { urgentTreatment,treatmentTarget } from '../../src/sim/care-rules.ts';
import { medicalBleed,medicalPain } from '../../src/sim/injury-state.ts';
import { BLOOD_UNIT } from '../../src/sim/injury-rules.ts';
import { FEED_HUNGER,needsAssistedFeeding } from '../../src/sim/feeding-rules.ts';
import { wantsRescue } from '../../src/sim/rescue.ts';
import { medicalWorkRefusal,pawnBody } from '../../src/sim/health-rules.ts';
import { crashlandedDecisions,crashlandedThreatActive } from './crashlanded-player.ts';
import { survivorPlan } from './survivor-player.ts';
import type { Decision } from './colony-player.ts';
import type { Cell, DesignateCommand, StructureKind, World, WorkType } from '../../src/sim/types.ts';

export type EnergyStage='construct'|'night'|'open'|'close'|'remove'|'rebuild'|'done';
/** Player notebook, saved separately from World. Only observations advance it. */
export interface EnergyPlayerState {startTick:number;origin:Cell;stage:EnergyStage;stageTick:number;initialSteel:number;initialComponents:number;milestones:Record<string,number>;nightDrainTicks:number;previousBattery:number;electricMeals:number}
const at=(a:Cell,x:number,z:number):Cell=>({x:a.x+x,z:a.z+z});
export const energyPlan=(s:Pick<EnergyPlayerState,'origin'>)=>({origin:s.origin,cooler:at(s.origin,2,0),door:at(s.origin,4,2),bench:at(s.origin,2,9),labDoor:at(s.origin,4,9),stove:at(s.origin,7,2),generator:at(s.origin,14,1),solar:at(s.origin,14,5),battery:at(s.origin,14,9),switch:at(s.origin,10,5),cut:at(s.origin,11,5),coldCell:at(s.origin,2,2)});
/** Maintain only actual installed devices at the notebook's observed sites.
 * Blueprint cells and missing assets never create Home or a repair intention. */
export function energyHomeDecisions(w:World,s:Pick<EnergyPlayerState,'origin'>):Decision[] {
  const p=energyPlan(s),home=new Set(w.home),out:Decision[]=[];
  const assets:[StructureKind,Cell][]=[['electric-stove',p.stove],['wood-generator',p.generator],['battery',p.battery],['solar-generator',p.solar],['power-switch',p.switch],['cooler',p.cooler]];
  for(const [kind,cell] of assets){
    const installed=w.structures.find(q=>q.kind===kind&&q.x===cell.x&&q.z===cell.z);
    if(!installed)continue;
    const cells=footprintCells(installed);
    if(cells.every(c=>home.has(c.z*w.width+c.x)))continue;
    out.push({reason:'Étendre le Foyer à cet appareil réellement installé pour permettre son entretien physique.',command:{type:'area',action:'home',
      from:{x:Math.min(...cells.map(c=>c.x)),z:Math.min(...cells.map(c=>c.z))},
      to:{x:Math.max(...cells.map(c=>c.x)),z:Math.max(...cells.map(c=>c.z))}}});
  }
  return out;
}
export function metalAccount(w:World,item:'steel'|'component'):number {
  // An orbital trader's stock belongs to the ship, not to the colony.
  return w.piles.reduce((n,p)=>n+(p.item===item&&p.owner.type!=='orbital-ship'?p.quantity:0),0)+w.structures.reduce((n,s)=>n+requiredMaterial(s,item),0)+w.packed.reduce((n,p)=>n+requiredMaterial(p.building,item),0)+(w.destroyed?.lost[item]??0)+(item==='steel'?w.deconstructed.lostSteel??0:w.deconstructed.lostComponents??0);
}
export function newEnergyPlayer(w:World):EnergyPlayerState {
  const camp=survivorPlan(w,true).anchor,occupied=new Set([...w.structures.flatMap(footprintCells),...w.jobs.flatMap(footprintCells),...w.stockpiles,...w.piles.flatMap(p=>p.owner.type==='ground'?[p.owner]:[])].map(c=>c.z*w.width+c.x));
  for(const zone of w.growingZones)for(const i of zone.cells)occupied.add(i);
  const candidates:Cell[]=[];
  for(let z=Math.max(2,camp.z-32);z<Math.min(w.height-14,camp.z+30);z++)for(let x=Math.max(2,camp.x-32);x<Math.min(w.width-20,camp.x+30);x++)candidates.push({x,z});
  candidates.sort((a,b)=>(a.x+6-camp.x)**2+(a.z+3-camp.z)**2-((b.x+6-camp.x)**2+(b.z+3-camp.z)**2)||a.z-b.z||a.x-b.x);
  const origin=candidates.find(a=>{for(let dz=-1;dz<13;dz++)for(let dx=-1;dx<19;dx++){const i=(a.z+dz)*w.width+a.x+dx,t=w.tiles[i]!;if(occupied.has(i)||t.terrain==='rock'||t.terrain==='water')return false;}return true;});
  if(!origin)throw Error('No ordinary 19×14 energy extension beside the existing colony; inspect the reached map.');
  return {startTick:w.tick,origin,stage:'construct',stageTick:w.tick,initialSteel:metalAccount(w,'steel'),initialComponents:metalAccount(w,'component'),milestones:{},nightDrainTicks:0,previousBattery:0,electricMeals:0};
}
export function energySummary(w:World,s:EnergyPlayerState) {
  const p=energyPlan(s),find=(kind:StructureKind,c:Cell)=>w.structures.find(q=>q.kind===kind&&q.x===c.x&&q.z===c.z),battery=find('battery',p.battery),solar=find('solar-generator',p.solar),cooler=find('cooler',p.cooler),stove=find('electric-stove',p.stove),generator=find('wood-generator',p.generator),sw=find('power-switch',p.switch);
  const coldCells=new Set<number>();for(let dz=1;dz<4;dz++)for(let dx=1;dx<4;dx++)coldCells.add((s.origin.z+dz)*w.width+s.origin.x+dx);
  return {tick:w.tick,stage:s.stage,origin:s.origin,research:w.research,batteryWd:battery?.battery?batteryWattDays(battery.battery):0,solarWatts:solar?solarPowerOutput(w,solar):0,
    batteryId:battery?.id,solarId:solar?.id,generatorId:generator?.id,generatorOn:generator?.power?.switchOn!==false,switchId:sw?.id,switchOn:sw?.power?.switchOn!==false,stoveId:stove?.id,stovePowered:!!stove&&isPowerActive(stove),coolerId:cooler?.id,coolerPowered:!!cooler&&isPowerActive(cooler),coldTemperature:new TemperatureView(w).at(w,p.coldCell),
    coldFood:w.piles.filter(q=>q.kind==='food'&&q.owner.type==='ground'&&coldCells.has(q.owner.z*w.width+q.owner.x)).map(q=>({id:q.id,item:q.item,quantity:q.quantity,rot:q.rot})),
    cablePresent:!!find('power-conduit',p.cut),conduits:w.structures.filter(q=>q.kind==='power-conduit').length,metals:{steel:metalAccount(w,'steel'),component:metalAccount(w,'component')},pawns:w.pawns.filter(isColonist).map(p=>({id:p.id,name:p.name,x:p.x,z:p.z,state:p.state,hunger:p.hunger,rest:p.rest,priorities:p.priorities,research:p.research})),wallOverlaps:w.pawns.flatMap(pawn=>[...w.structures,...w.jobs].filter(q=>q.kind==='wall'&&q.x===pawn.x&&q.z===pawn.z).map(q=>({pawnId:pawn.id,pawn:pawn.name,x:pawn.x,z:pawn.z,targetId:q.id,target:'construction' in q?q.construction:'structure'}))),jobs:w.jobs.map(j=>({id:j.id,kind:j.kind,x:j.x,z:j.z,progress:j.progress,reservedBy:j.reservedBy}))};
}
/** Observe every tick: short transitions, cold stock and night drain are not
 * inferred from a broad day checkpoint. No state in the game is changed. */
export function observeEnergy(w:World,s:EnergyPlayerState):void {
  const p=energyPlan(s),battery=w.structures.find(q=>q.kind==='battery'&&q.x===p.battery.x&&q.z===p.battery.z),solar=w.structures.find(q=>q.kind==='solar-generator'&&q.x===p.solar.x&&q.z===p.solar.z),stored=battery?.battery?batteryWattDays(battery.battery):0;
  const cooler=w.structures.find(q=>q.kind==='cooler'&&q.x===p.cooler.x&&q.z===p.cooler.z),stove=w.structures.find(q=>q.kind==='electric-stove'&&q.x===p.stove.x&&q.z===p.stove.z),gen=w.structures.find(q=>q.kind==='wood-generator'&&q.x===p.generator.x&&q.z===p.generator.z),sw=w.structures.find(q=>q.kind==='power-switch'&&q.x===p.switch.x&&q.z===p.switch.z);
  const record=(key:string,yes:boolean)=>{if(yes&&s.milestones[key]===undefined)s.milestones[key]=w.tick;};
  record('batteriesResearch',researchUnlocked(w,'batteries'));record('solarResearch',researchUnlocked(w,'solar-power'));record('charged500Wd',stored>=500);
  if(s.stage==='night'&&gen?.power?.switchOn===false&&solar&&solarPowerOutput(w,solar)===0&&stored<s.previousBattery&&!!cooler&&isPowerActive(cooler)&&!!stove&&isPowerActive(stove))s.nightDrainTicks++;
  record('nightSupply',s.nightDrainTicks>=120);s.previousBattery=stored;
  if(w.tick%50===0){const a=energySummary(w,s);record('frozenFood',a.coldTemperature<=0&&a.coldFood.some(q=>q.quantity>0&&q.rot?.rate===0));}
  const next=(stage:EnergyStage)=>{s.stage=stage;s.stageTick=w.tick;};
  if(s.stage==='construct'&&s.milestones.charged500Wd&&s.milestones.solarResearch&&cooler&&stove&&sw&&isPowerActive(cooler)&&isPowerActive(stove)&&s.electricMeals>0)next('night');
  else if(s.stage==='night'&&s.milestones.nightSupply)next('open');
  else if(s.stage==='open'&&sw?.power?.switchOn===false&&cooler&&!isPowerActive(cooler)&&stove&&!isPowerActive(stove)){record('switchCut',true);if(w.tick-s.milestones.switchCut!>=120)next('close');}
  else if(s.stage==='close'&&sw?.power?.switchOn!==false&&cooler&&isPowerActive(cooler)&&stove&&isPowerActive(stove)){record('switchRestored',true);next('remove');}
  else if(s.stage==='remove'&&!w.structures.some(q=>q.kind==='power-conduit'&&q.x===p.cut.x&&q.z===p.cut.z)&&cooler&&!isPowerActive(cooler)&&stove&&!isPowerActive(stove)){record('cableCut',true);if(w.tick-s.milestones.cableCut!>=120)next('rebuild');}
  else if(s.stage==='rebuild'&&w.structures.some(q=>q.kind==='power-conduit'&&q.x===p.cut.x&&q.z===p.cut.z)&&cooler&&isPowerActive(cooler)&&stove&&isPowerActive(stove)){record('cableRestored',true);next('done');}
}
const recoveryPatient=(p:World['pawns'][number])=>urgentTreatment(p)||wantsRescue(p)||needsAssistedFeeding(p)&&p.hunger<=FEED_HUNGER;
/** Player policy, not a Core combat/clinical threshold: stop exposing a mobile
 * defender below 75% actual consciousness, at 50% blood/day, 25% pain or 15%
 * accumulated blood loss. Reduced consciousness also shelters an already sick
 * defender before any impact; the pain threshold alone misses initial poisoning.
 * In particular, a fresh 11.6 HP leg gunshot qualifies before blood-loss fall;
 * a small isolated injury does not remove every armed defender from the line. */
export function energyRetreatNeeded(p:World['pawns'][number]):boolean {
  return p.state!=='dead'&&p.state!=='downed'&&!!p.health
    &&(pawnBody(p).capacities.consciousness<.75||medicalBleed(p.health)>=.5||medicalPain(p.health)>=.25||p.health.bloodLoss>=.15*BLOOD_UNIT);
}
/** Do not leave mobilization or a real emergency on the ordinary 250-tick
 * construction cadence. This observation does not query navigation or mutate
 * any actor, reservation, resource, clock or player notebook. */
const electricalTransition=(s:EnergyPlayerState)=>s.stage==='night'||s.stage==='open'||s.stage==='close'||s.stage==='remove'||s.stage==='rebuild';
export function energyDecisionDue(w:World,s?:EnergyPlayerState):boolean {
  return w.tick%250===0||!!s&&electricalTransition(s)&&(w.tick===s.stageTick||w.tick%20===0)
    ||w.tick%20===0&&(crashlandedThreatActive(w)
    ||w.pawns.some(p=>isColonist(p)&&p.state!=='dead'&&(!!p.draft||recoveryPatient(p))));
}
/** undefined releases the ordinary pilot; [] keeps an unresolved emergency or
 * accepted physical care from running ordinary construction scans. Issue at
 * most one admitted service, and never restart an existing care task. Hunger
 * and rest thresholds belong to the contextual provider, not a private veto. */
export function energyRecoveryDecisions(w:World):Decision[]|undefined {
  if(crashlandedThreatActive(w))return;
  const people=w.pawns.filter(p=>isColonist(p)&&p.state!=='dead');
  const drafted=people.filter(p=>p.draft&&p.state!=='downed'&&!p.mental?.crisis);
  if(drafted.length)return [{reason:'La menace est terminée : démobiliser au prochain contrôle pour rendre possibles le secours et les soins civils.',
    command:{type:'draft',pawnIds:drafted.map(p=>p.id),enabled:false}}];
  const bleeding=(p:typeof people[number])=>p.health?medicalBleed(p.health):0;
  const patients=people.filter(recoveryPatient)
    .sort((a,b)=>Number(urgentTreatment(b))-Number(urgentTreatment(a))||bleeding(b)-bleeding(a)||a.hunger-b.hunger||a.id-b.id);
  if(!patients.length)return people.some(p=>p.tend||p.rescue||p.feed)?[]:undefined;
  const doctors=people.filter(p=>!p.draft&&!p.mental?.crisis&&!medicalWorkRefusal(p)&&!p.interruptedCargo&&!p.collapsePending
    &&!p.tend&&!p.rescue&&!p.feed&&!urgentTreatment(p))
    .sort((a,b)=>Number(!!treatmentTarget(a))-Number(!!treatmentTarget(b))||bleeding(a)-bleeding(b)||b.skills.medicine.level-a.skills.medicine.level||a.id-b.id);
  for(const patient of patients){
    if(people.some(p=>p.tend?.patientId===patient.id||p.rescue?.patientId===patient.id||p.feed?.patientId===patient.id))continue;
    for(const doctor of doctors){
      if(doctor===patient)continue;
      const options=queryOrderOptions(w,doctor.id,patient);
      if(options.some(o=>o.enabled&&o.rescuePatientId===patient.id))return [{reason:'Porter le blessé vers un couchage réellement accessible dès la fin de la menace.',
        command:{type:'order-rescue',pawnId:doctor.id,patientId:patient.id,queue:false}}];
      if(options.some(o=>o.enabled&&o.tendPatientId===patient.id))return [{reason:'Faire traiter immédiatement le patient urgent par le meilleur médecin dont l’ordre est réellement admissible.',
        command:{type:'order-tend',pawnId:doctor.id,patientId:patient.id,queue:false}}];
      if(options.some(o=>o.enabled&&o.feedPatientId===patient.id))return [{reason:'Apporter physiquement un aliment admissible au patient dépendant.',
        command:{type:'order-feed',pawnId:doctor.id,patientId:patient.id,queue:false}}];
    }
  }
  return [];
}
/** One real electrical intention per observation. Publication, delivery and
 * work are separate confirmed commands; no projected job or supplied stock.
 * Hunger40/rest50 and at most three candidates are this pilot's policy. */
export function energyTransitionDecisions(w:World,s:EnergyPlayerState):Decision[] {
  if(crashlandedThreatActive(w)||w.pawns.some(p=>isColonist(p)&&p.state!=='dead'
    &&(p.draft||recoveryPatient(p)||p.tend||p.rescue||p.feed)))return [];
  const p=energyPlan(s),find=(kind:StructureKind,c:Cell)=>w.structures.find(q=>q.kind===kind&&q.x===c.x&&q.z===c.z);
  const work=(job:World['jobs'][number]):Decision[]=>{
    if(job.reservedBy!==null||w.pawns.some(actor=>actor.haul?.destination.type==='job'&&actor.haul.destination.jobId===job.id
      ||actor.orders.queue.some(o=>typeof o!=='number'&&'destination' in o&&o.destination.type==='job'&&o.destination.jobId===job.id)))return [];
    const actors=w.pawns.filter(actor=>isColonist(actor)&&!actor.prisoner&&!medicalWorkRefusal(actor)&&!actor.mental?.crisis&&!actor.draft
      &&actor.hunger>=40&&actor.rest>=50&&!actor.collapsePending&&!actor.interruptedCargo
      &&actor.jobId===null&&actor.orders.active===null&&!actor.orders.queue.length
      &&(!actor.priorityWork||actor.priorityWork.cell.x===job.x&&actor.priorityWork.cell.z===job.z)
      &&!actor.haul&&!actor.cooking&&!actor.research&&!actor.feed&&!actor.tend&&!actor.rescue&&!actor.surgery
      &&!actor.hunting&&!actor.equipmentTask&&!actor.ward&&!actor.burial&&!actor.shooting?.order&&!actor.melee?.order
      &&!(actor.need?.kind==='eat'&&actor.need.carryPileId!==null))
      .sort((a,b)=>(a.x-job.x)**2+(a.z-job.z)**2-((b.x-job.x)**2+(b.z-job.z)**2)||a.id-b.id).slice(0,3);
    for(const actor of actors){
      const options=queryOrderOptions(w,actor.id,job);
      const direct=options.find(o=>o.jobId===job.id&&o.enabled&&!o.haulTarget&&!o.cookStationId);
      if(direct)return [{reason:'Faire réaliser la manœuvre électrique publiée par une personne dont l’ordre de travail est réellement admissible.',
        command:{type:'order-job',pawnId:actor.id,jobId:job.id,queue:false}}];
      const delivery=options.find(o=>o.enabled&&o.haulTarget?.type==='job'&&o.haulTarget.jobId===job.id);
      if(delivery?.haulTarget)return [{reason:'Livrer physiquement l’acier du raccord avant de demander sa construction.',
        command:{type:'order-haul',pawnId:actor.id,target:delivery.haulTarget,queue:false}}];
    }
    return [];
  };
  const flick=(structure:World['structures'][number]|undefined,on:boolean):Decision[]|undefined=>{
    if(!structure||(structure.power?.switchOn!==false)===on)return;
    const existing=w.jobs.find(j=>j.flick?.structureId===structure.id);
    if(existing)return existing.flick!.on===on?work(existing):[];
    if(!canFlickPower(structure)||w.jobs.some(j=>(j.deconstruction?.structureId??j.furniture?.structureId)===structure.id)
      ||w.pawns.some(actor=>actor.haul?.destination.type==='fuel'&&actor.haul.destination.structureId===structure.id))return [];
    return [{reason:'Publier une commutation qui sera effectuée au contact, sans interrompre une livraison de combustible engagée.',
      command:{type:'power-flick',structureId:structure.id,on}}];
  };
  if(s.stage!=='construct'){
    const generator=flick(find('wood-generator',p.generator),false);if(generator)return generator;
  }
  const switchWork=flick(find('power-switch',p.switch),s.stage!=='open');if(switchWork)return switchWork;
  if(s.stage==='remove'){
    const cable=find('power-conduit',p.cut);if(!cable)return [];
    const job=w.jobs.find(j=>j.deconstruction?.structureId===cable.id);if(job)return work(job);
    const command:DesignateCommand={type:'designate',kind:'deconstruct',...p.cut,targetId:cable.id};
    return canDesignate(w,command).ok?[{reason:'Publier le retrait du vrai conduit, puis attendre sa coupure physique.',command}]:[];
  }
  if(s.stage==='rebuild'&&!find('power-conduit',p.cut)){
    const job=w.jobs.find(j=>j.kind==='power-conduit'&&j.x===p.cut.x&&j.z===p.cut.z);if(job)return work(job);
    if(w.pawns.some(actor=>actor.x===p.cut.x&&actor.z===p.cut.z))return [];
    const command:DesignateCommand={type:'designate',kind:'power-conduit',...p.cut,material:'steel',orientation:0};
    return canDesignate(w,command).ok?[{reason:'Publier le raccord manquant ; son acier et son travail restent à fournir physiquement.',command}]:[];
  }
  return [];
}
export function energyDecisions(w:World,s:EnergyPlayerState):Decision[] {
  const recovery=energyRecoveryDecisions(w);if(recovery!==undefined)return recovery;
  // The extra cadence performs no ordinary camp, mining or construction scan.
  if(electricalTransition(s)&&w.tick%250!==0&&!crashlandedThreatActive(w))return energyTransitionDecisions(w,s);
  const base=crashlandedDecisions(w);
  if(w.raids?.active){
    const people=w.pawns.filter(p=>isColonist(p)&&p.state!=='dead'&&p.state!=='downed'&&!p.mental?.crisis);
    if(people.some(p=>!p.draft))return [{reason:'La lettre annonce une attaque : mobiliser toutes les personnes présentes afin qu’aucune ne poursuive son travail dans la ligne de tir.',command:{type:'draft',pawnIds:people.map(p=>p.id),enabled:true}}];
    // The shared animal policy already selects its physical retreat and target.
    if(w.wildlife?.animals.some(a=>a.manhunter&&a.state!=='dead'&&a.state!=='downed'))return base;
    const camp=survivorPlan(w,true),out=[...base],armed=people.filter(p=>equippedWeapon(w,p)&&!energyRetreatNeeded(p));
    const sheltered=people.filter(p=>!equippedWeapon(w,p)||energyRetreatNeeded(p));
    const hostile=w.pawns.filter(p=>people.some(actor=>hostileTo(actor,p))&&p.state!=='dead'&&p.state!=='downed');
    const enemies=[...hostile,...(w.mechanoids??[]).filter(m=>m.state!=='dead'&&m.state!=='downed')];
    const enemyCells=enemies.flatMap(p=>[p,...p.motion&&p.motion.end>w.tick?[p.motion.from]:[]]);
    const inside=(c:Cell,a:Cell)=>c.x>a.x&&c.x<a.x+4&&c.z>a.z&&c.z<a.z+4;
    const buildings=new Map(w.structures.map(q=>[q.z*w.width+q.x,q]));
    const enclosed=(a:Cell)=>{
      // A hostile on the door can strike the interior. Its committed departure
      // also occupies the old endpoint until the edge really finishes.
      if(a.x<0||a.z<0||a.x+4>=w.width||a.z+4>=w.height
        ||enemyCells.some(c=>c.x>=a.x&&c.x<=a.x+4&&c.z>=a.z&&c.z<=a.z+4))return false;
      for(let z=0;z<5;z++)for(let x=0;x<5;x++)if(x===0||z===0||x===4||z===4){
        const cell=at(a,x,z),building=buildings.get(cell.z*w.width+cell.x);
        if(w.tiles[cell.z*w.width+cell.x]!.terrain==='rock')continue;
        if(building?.kind==='wall'||building?.kind==='cooler')continue;
        if(building&&isRoomDoor(building.kind)&&!building.door?.holdOpen&&!building.door?.forbidden)continue;
        return false;
      }
      return true;
    };
    // Recheck the actual sixteen boundary cells, including a fresh breach. The
    // other two candidates are existing energy rooms, never an instant refuge.
    const refuges=[camp.anchor,...(s?.origin?[s.origin,at(s.origin,0,7)]:[])].filter(enclosed);
    if(sheltered.length&&refuges.length){
      // One synchronous capture for this decision, not a map flood or weighted
      // route per person. Colonists share doors and faction obstacles; fighting
      // actors additionally cannot cross other actors' current melee cells.
      const blocked=blockedCells(w),combatBlocked=blocked.slice(),stands=captureStandability(w),services=reservedServiceCells(w);
      for(const c of enemyCells)blocked[c.z*w.width+c.x]=1;
      combatBlocked.set(blocked);
      for(const p of w.pawns)if(p.melee?.order&&p.state!=='dead'&&p.state!=='downed')
        for(const c of [p,...p.motion&&p.motion.end>w.tick?[p.motion.from]:[]])combatBlocked[c.z*w.width+c.x]=1;
      const bodies=new Map<number,Set<number>>(),claims=new Map<number,Set<number>>();
      const claim=(view:Map<number,Set<number>>,i:number,id:number)=>{let ids=view.get(i);if(!ids)view.set(i,ids=new Set());ids.add(id);};
      for(const p of w.pawns)if(p.state!=='dead')claim(bodies,p.z*w.width+p.x,p.id);
      for(const p of w.pawns)for(const c of [p.draft?.target,p.tactics?.post])if(c)claim(claims,c.z*w.width+c.x,p.id);
      const captures=refuges.map(a=>{
        const cells:Cell[]=[];for(let dz=1;dz<4;dz++)for(let dx=1;dx<4;dx++)cells.push(at(a,dx,dz));
        const root=cells.find(c=>stands(c)&&!blocked[c.z*w.width+c.x]);
        const fightingRoot=cells.find(c=>stands(c)&&!combatBlocked[c.z*w.width+c.x]);
        return {a,cells,reach:root?candidateAccess(w,root,blocked,CIVIL_TRANSIT_BLOCKERS,true):undefined,
          fighting:fightingRoot?candidateAccess(w,fightingRoot,combatBlocked,CIVIL_TRANSIT_BLOCKERS,true):undefined};
      });
      for(const p of sheltered){
        const onlySelf=(ids:Set<number>|undefined)=>!ids||ids.size===1&&ids.has(p.id);
        const current=p.z*w.width+p.x,free=(c:Cell)=>{const i=c.z*w.width+c.x;return stands(c)&&!blocked[i]&&!services.has(i)
          &&onlySelf(bodies.get(i))&&onlySelf(claims.get(i));};
        const connected=(r:typeof captures[number])=>{
          const reach=p.melee?.order?r.fighting:r.reach;if(!reach)return false;
          if(!p.melee?.order)return reach.has(current);
          // The actor's own cell is a valid starting point even when included
          // in the common melee mask; a legal cardinal exit suffices. Blocking
          // its old edge endpoint is conservative, never a permissive route.
          return reach.has(current)||[p.x>0?current-1:-1,p.x+1<w.width?current+1:-1,current-w.width,current+w.width]
            .some(i=>i>=0&&i<blocked.length&&reach.has(i));
        };
        let target:Cell|undefined;
        // Keep the already admitted retreat across all still-safe rooms before
        // ranking any newly available room. Otherwise a primary room becoming
        // free again reverses the physical trip to the secondary refuge.
        const accepted=p.draft?.target;
        if(accepted){
          const retained=captures.find(r=>{
            if(!inside(accepted,r.a)||!connected(r))return false;
            const reach=p.melee?.order?r.fighting!:r.reach!;
            return free(accepted)&&reach.has(accepted.z*w.width+accepted.x);
          });
          if(retained)target=accepted;
        }
        if(!target)for(const r of captures){
          if(!connected(r))continue;
          const reach=p.melee?.order?r.fighting!:r.reach!,available=(c:Cell)=>free(c)&&reach.has(c.z*w.width+c.x);
          if(inside(p,r.a)&&available(p)&&!p.motion&&!p.shooting?.order&&!p.melee?.order&&(!p.draft?.target||p.x===p.draft.target.x&&p.z===p.draft.target.z)){target={x:p.x,z:p.z};break;}
          target=r.cells.filter(available).sort((a,b)=>(a.x-p.x)**2+(a.z-p.z)**2-((b.x-p.x)**2+(b.z-p.z)**2)||a.z-b.z||a.x-b.x)[0];
          if(target)break;
        }
        if(!target)continue;
        if(!p.shooting?.order&&!p.melee?.order&&(p.draft?.target?.x===target.x&&p.draft.target.z===target.z||!p.draft?.target&&p.x===target.x&&p.z===target.z))continue;
        for(const [i,ids] of claims){ids.delete(p.id);if(!ids.size)claims.delete(i);}claim(claims,target.z*w.width+target.x,p.id);
        out.push({reason:energyRetreatNeeded(p)?'Replier le défenseur encore mobile avant sa chute, selon les seuils médicaux du pilote, vers une vraie case libre d’un abri accessible.'
          :'Rejoindre physiquement une pièce encore fermée et sans assaillant; quitter un abri percé au lieu d’y attendre au contact.',command:{type:'draft-move',pawnIds:[p.id],target,queue:false}});
      }
    }
    for(const p of armed)if(!p.shooting?.order&&!p.melee?.order&&(p.x!==camp.pin.x||p.z!==camp.pin.z)&&(!p.draft?.target||p.draft.target.x!==camp.pin.x||p.draft.target.z!==camp.pin.z))
      out.push({reason:'Rejoindre le poste réel devant le dortoir afin de couvrir la retraite avec l’arme équipée.',command:{type:'draft-move',pawnIds:[p.id],target:camp.pin,queue:false}});
    return out;
  }
  if(w.pawns.some(p=>p.draft)||base.some(d=>d.command.type.startsWith('order-tend')||d.command.type==='order-feed'||d.command.type==='order-rescue'))return base;
  const maintenance=energyHomeDecisions(w,s);if(maintenance.length)return maintenance;
  const out=base.filter(d=>d.command.type!=='priority'),p=energyPlan(s),colonists=w.pawns.filter(isColonist),builder=colonists.reduce((a,b)=>a.skills.construction.level>=b.skills.construction.level?a:b),cook=colonists.reduce((a,b)=>(a.skills.cooking?.level??0)>=(b.skills.cooking?.level??0)?a:b),grower=colonists.find(q=>q!==builder&&q!==cook)!;
  const priority=(id:number,work:WorkType,value:number)=>{if(w.pawns.find(p=>p.id===id)!.priorities[work]!==value)out.push({reason:'Conserver cuisine, potager et soins ; faire la recherche entre les repas et extraire les matériaux nécessaires.',command:{type:'priority',pawnId:id,work,value}});};
  for(const pawn of colonists)for(const [work,value] of Object.entries({build:pawn===builder?1:3,cook:pawn===cook?1:3,grow:pawn===grower?1:3,haul:2,gather:2,mine:pawn===builder?1:3,basic:1,research:pawn===cook?1:0}) as [WorkType,number][])priority(pawn.id,work,value);
  const designate=(kind:DesignateCommand['kind'],cell:Cell,material:'steel'|'wood'='steel')=>{const command:DesignateCommand={type:'designate',kind,...cell,material,orientation:0};
    // A blueprint may be admissible while a passing pawn still occupies one
    // of its cells. Wait for the next decision pulse instead of creating a
    // transient wall/pawn overlap that cannot be saved.
    if(footprintCells(command).some(c=>w.pawns.some(pawn=>pawn.x===c.x&&pawn.z===c.z)))return;
    if(canDesignate(w,command).ok)out.push({reason:'Construire l’extension énergétique avec ses vrais matériaux et accès.',command});};
  const find=(kind:StructureKind,c:Cell)=>w.structures.find(q=>q.kind===kind&&q.x===c.x&&q.z===c.z);
  designate('research-bench',p.bench,'wood');
  for(const project of ['batteries','solar-power'] as const)if(!researchUnlocked(w,project)){if(w.research?.project!==project)out.push({reason:'Rechercher les prérequis énergétiques au bureau ordinaire.',command:{type:'research-project',project}});break;}
  // A visible face can still belong to an enclosed pocket. This short-lived
  // flood proves an approach from the colonists before requesting excavation.
  let accessible:Uint8Array|undefined;
  const surface=()=>{if(accessible)return accessible;const blocked=blockedCells(w),seen=new Uint8Array(w.tiles.length),queue=colonists.map(q=>q.z*w.width+q.x);for(const i of queue)seen[i]=1;for(let k=0;k<queue.length;k++){const i=queue[k]!,x=i%w.width;for(const n of [x>0?i-1:-1,x+1<w.width?i+1:-1,i>=w.width?i-w.width:-1,i+w.width<w.tiles.length?i+w.width:-1])if(n>=0&&!seen[n]&&!blocked[n]){seen[n]=1;queue.push(n);}}return accessible=seen;};
  // Exposed veins only; successive faces become available after real mining.
  for(const [ore,item,target] of [['steel','steel',s.initialSteel+240],['machinery','component',s.initialComponents+2]] as const){
    const pending=w.jobs.filter(j=>j.kind==='mine'&&w.tiles[j.z*w.width+j.x]!.ore===ore).length;
    if(metalAccount(w,item)>=target||pending>=2)continue;
    const seen=surface(),candidates=w.tiles.flatMap((tile,i)=>tile.ore===ore?[{x:i%w.width,z:Math.floor(i/w.width)}]:[]).filter(c=>[[-1,0],[1,0],[0,-1],[0,1]].some(([dx,dz])=>{const x=c.x+dx!,z=c.z+dz!;return x>=0&&x<w.width&&z>=0&&z<w.height&&seen[z*w.width+x]===1;})).sort((a,b)=>(a.x-p.origin.x)**2+(a.z-p.origin.z)**2-((b.x-p.origin.x)**2+(b.z-p.origin.z)**2)||a.z-b.z||a.x-b.x);
    let left=2-pending;for(const c of candidates){const command:DesignateCommand={type:'designate',kind:'mine',...c};if(canDesignate(w,command).ok){out.push({reason:'Extraire physiquement acier et composants des filons exposés.',command});if(!--left)break;}}
  }
  // Two ordinary enclosed rooms, one for food and one for the research bench.
  for(const dz of [0,7]){
    for(let z=0;z<5;z++)for(let x=0;x<5;x++)if(x===0||z===0||x===4||z===4){const c=at(p.origin,x,dz+z),kind=dz===0&&x===2&&z===0?'cooler':x===4&&z===(dz===0?2:2)?'door':'wall';designate(kind,c,kind==='cooler'?'steel':'wood');}
    const boundary=w.structures.filter(q=>q.x>=p.origin.x&&q.x<=p.origin.x+4&&q.z>=p.origin.z+dz&&q.z<=p.origin.z+dz+4&&['wall','door','cooler'].includes(q.kind));
    if(boundary.length===16){const from=at(p.origin,0,dz),to=at(p.origin,4,dz+4),roof=new Set(w.roofing?.build),home=new Set(w.home);if(Array.from({length:25},(_,i)=>(from.z+Math.floor(i/5))*w.width+from.x+i%5).some(i=>!roof.has(i)))out.push({reason:'Couvrir la chambre froide et le bureau après construction des supports.',command:{type:'area',action:'build-roof',from,to}});if(!home.has(from.z*w.width+from.x))out.push({reason:'Entretenir les murs de l’extension.',command:{type:'area',action:'home',from,to}});}
  }
  // Zone painting skips a tree instead of clearing it. Clear the interior by
  // ordinary work, then extend only over newly admissible cells; a missing
  // centre cell is not evidence that the whole rectangle is still unpainted.
  for(const tree of w.resources.filter(r=>r.kind==='tree'&&r.x>p.origin.x&&r.x<p.origin.x+4&&r.z>p.origin.z&&r.z<p.origin.z+4)){
    const command:DesignateCommand={type:'designate',kind:'chop',x:tree.x,z:tree.z};
    if(canDesignate(w,command).ok)out.push({reason:'Dégager physiquement l’intérieur de la future réserve froide.',command});
  }
  const storage={type:'area' as const,action:'stockpile' as const,from:at(p.origin,1,1),to:at(p.origin,3,3),filters:{wood:false,food:true},priority:4,capacity:75},query=queryArea(w,storage);
  if(query.ok&&query.cells.length)out.push({reason:'Ranger prioritairement les denrées dans les cellules libres de la chambre froide.',command:storage});
  designate('wood-generator',p.generator);designate('electric-stove',p.stove);designate('power-switch',p.switch);
  if(researchUnlocked(w,'batteries'))designate('battery',p.battery);
  if(researchUnlocked(w,'solar-power'))designate('solar-generator',p.solar);
  for(let x=5;x<14;x++)if(x!==10&&!(x===11&&(s.stage==='remove'||s.stage==='rebuild')))designate('power-conduit',at(p.origin,x,5));
  for(const dz of [3,4])designate('power-conduit',at(p.origin,14,dz));
  const cooler=find('cooler',p.cooler),stove=find('electric-stove',p.stove);
  if(cooler&&cooler.cooler?.target!==-5)out.push({reason:'Conserver les aliments sous zéro sans modifier leurs âges.',command:{type:'cooler-target',structureId:cooler.id,target:-5}});
  if(stove&&!stove.bills?.length)out.push({reason:'Ajouter les repas simples au poste électrique.',command:{type:'bill-add',structureId:stove.id,recipe:'simple-meal'}});
  const bill=stove?.bills?.[0];if(stove&&bill){
    const filters=Object.fromEntries(Object.keys(bill.filters).map(item=>[item,false]));
    Object.assign(filters,{rice:true,berries:true,potato:true,corn:true,'hare-meat':true});
    if(bill.mode!=='until'||bill.target!==9||bill.radius!==60||bill.suspended||bill.destination!=='stockpile'||Object.keys(filters).some(item=>bill.filters[item as keyof typeof bill.filters]!==filters[item]))
      out.push({reason:'Maintenir neuf repas avec les récoltes existantes, dans la réserve froide.',command:{type:'bill-update',structureId:stove.id,billId:bill.id,settings:{mode:'until',target:9,suspended:false,radius:60,filters,destination:'stockpile'}}});
  }
  const powered=!!stove&&isPowerActive(stove);for(const wood of w.structures.filter(q=>q.kind==='fueled-stove'))for(const b of wood.bills??[])if(b.suspended!==powered)out.push({reason:powered?'Utiliser le poste électrique et conserver la cuisine au bois comme secours.':'Rétablir la cuisine au bois pendant la coupure.',command:{type:'bill-update',structureId:wood.id,billId:b.id,settings:{mode:b.mode,target:b.target,filters:{...b.filters},radius:b.radius,destination:b.destination,suspended:powered}}});
  const transition=energyTransitionDecisions(w,s);
  // Commands in the ordinary batch may give this actor a service or alter its
  // policy. Admit an explicit work order against the next confirmed World.
  if(!out.length||transition.every(d=>d.command.type!=='order-job'&&d.command.type!=='order-haul'))out.push(...transition);
  return out;
}
