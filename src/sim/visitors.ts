import {assignPileOwner} from './pile-index.ts';
import {shipCasketHumanReferences277} from './ship-casket-notifications-277.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {bindBornHumanFaction259,bornFactionForDef259} from './world-affiliation-259.ts';
import {tempMapModern261,tempMapAdoptedAtCore261,tempMapTarget261} from './temp-map-incidents-261.ts';
import { releaseAllowedAreaReturn } from './allowed-area-state.ts';
import { activeThreat,hostileTo,isColonist,isAdmittedVisitorGuest } from './affiliation.ts';
import { treatmentTarget,medicalRestNeeded } from './care-rules.ts';
import { processMedicalGuestNeeds } from './medical-guest-needs.ts';
import { newApparelState } from './apparel-rules.ts';
import { processEating } from './eating.ts';
import { adjacentTable } from './dining.ts';
import { captureStandability } from './furniture-travel.ts';
import { HEAT_UNIT } from './heat-rules.ts';
import { retryInterruptedCargo } from './interrupted-cargo.ts';
import { mealQuantity } from './items.ts';
import { processDraftSleep,type NeedContext } from './needs.ts';
import { copyPileCondition } from './pile-condition.ts';
import { freshRot } from './food-preservation.ts';
import { carrierOf } from './rescue-state.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { startingPawn } from './starting-pawns.ts';
import { generatePawnBackground } from './background-generation.ts';
import { generateExoticStock,generateVisitorStock } from './trade-stock.ts';
import { visitorArrival,visitorAtEdge,visitorExit } from './visitor-navigation.ts';
import { PLAN_INTERVAL } from './work-planner.ts';
import { consumeVisitorOpportunity,INTRO_VISITOR_TICK,newVisitorAgenda,visitorPoints,visitorRandom,type VisitorGroup,type VisitorKind } from './visitor-state.ts';
import type { MaterialPile,Pawn,World } from './types.ts';

const log=(w:World,message:string)=>{w.events.push({tick:w.tick,type:'command',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);};
export function enableVisitors(w:World,withIntro=false,prospective=false):void {
  if(w.visitors)return;
  if(tempMapModern261(w))return;
  w.visitors={profile:'cassandra-visitors-v1',adoptedAt:w.tick,rng:((w.seed^0x88c0173)>>>0)||1,serial:0,
    introAt:!prospective&&withIntro&&w.tick===0?INTRO_VISITOR_TICK:null,traveler:newVisitorAgenda(w.seed,'traveler',w.tick,prospective),visitor:newVisitorAgenda(w.seed,'visitor',w.tick,prospective),
    ...w.schemaVersion>=123?{exotic:newVisitorAgenda(w.seed,'exotic',w.tick,prospective)}:{},groups:[],departed:[]};
}
/** V122→V123 migration: discard past exotic opportunities without touching the
 * old visitor agendas, stock, actor identities, or the business RNG. */
export function adoptExoticMerchantSchedule(w:World):void {
  if(w.visitors?.profile==='cassandra-visitors-v1'&&!tempMapModern261(w)&&!w.visitors.exotic)w.visitors.exotic=newVisitorAgenda(w.seed,'exotic',w.tick);
}
/** Real Camp→Settlement commit only, never a load or an adoption. Old agendas
 * are replaced prospectively without replaying RNG or admitting past tickets. */
export function resumeProspectiveVisitorSchedule261(w:World):void {
  if((Number(w.schemaVersion)!==261&&(Number(w.schemaVersion)!==262&&!isSchema263OrLater(Number(w.schemaVersion))))||tempMapTarget261(w)||tempMapAdoptedAtCore261(w)===undefined)return;
  const s=w.visitors;if(!s){enableVisitors(w,false,true);return;}
  w.visitors={...s,profile:'cassandra-visitors-v1',introAt:null,
    traveler:newVisitorAgenda(w.seed,'traveler',w.tick,true),visitor:newVisitorAgenda(w.seed,'visitor',w.tick,true),exotic:newVisitorAgenda(w.seed,'exotic',w.tick,true)};
}
const groupOf=(w:World,p:Pawn)=>w.visitors?.groups.find(g=>g.id===p.visitor?.group);
export function visitorMayTrade(w:World,p:Pawn):boolean {
  const v=p.visitor,g=groupOf(w,p);
  return !!v&&v.role==='trader'&&v.phase!=='leaving'&&!!g&&!g.hostile&&g.phase!=='leaving'&&p.faction==='outlanders'
    &&p.state!=='dead'&&p.state!=='downed'&&p.state!=='sleeping'&&!p.need&&!p.burning&&!p.mental?.crisis&&!p.flee&&(p.stun?.untilCore??0)<=w.tick*10;
}
/** An actor aggression closes the entire visit immediately. It does not invent
 * global diplomacy, a raid mandate, or a neutral automatic counterattack. */
export function visitorGroupDanger(w:World,p:Pawn,reason:'danger'|'hostile'|'blocked'='danger'):void {
  const g=groupOf(w,p);if(!g)return;if(reason==='hostile')g.hostile=true;
  leaveGroup(w,g,reason);
}
function leaveGroup(w:World,g:VisitorGroup,reason:VisitorGroup['reason']):void {
  if(g.phase==='leaving'){if(reason==='hostile'){g.reason=reason;g.hostile=true;}return;}
  g.phase='leaving';g.reason=reason;
  for(const p of [...w.pawns,...shipCasketHumanReferences277(w)])if(p.visitor?.group===g.id){
    p.visitor.phase='leaving';p.visitor.goal=null;
    // A visit deadline changes its agenda, not an accepted medical service or
    // the captured movement of a carried guest. Departure resumes after care.
    if(isAdmittedVisitorGuest(p)&&(carrierOf(w,p.id)||p.need||treatmentTarget(p)||medicalRestNeeded(p)))continue;
    p.path=[];p.planCooldown=0;
    if(p.need?.kind==='sleep'&&p.state!=='dead'&&p.state!=='downed'){p.need=null;p.state='idle';}
  }
  log(w,reason==='timeout'?'Les visiteurs terminent leur halte et cherchent la sortie.':reason==='hostile'?'Les visiteurs interrompent les échanges après une agression et se retirent.':'Les visiteurs interrompent leur halte face au danger.');
}

/** Adult Peaceful options, Core weights20/10/10 and costs45/60/40. Their
 * biographies and equipment remain explicitly limited local profiles. */
export function groupProfiles(random:{rng:number},points:number):string[] {
  const kinds=[{name:'Villageois',cost:45,weight:20},{name:'Garde',cost:60,weight:10},{name:'Conseiller',cost:40,weight:10}],out:string[]=[];
  // MinPointsToGenerateAnything prefers the sole fighter (guard60), ×1.2.
  const maximum=Math.max(72,points<=70?35+points*15/70:50+(points-70)*50/630);
  while(points>=40&&out.length<12){const options=kinds.filter(k=>k.cost<=points&&k.cost<=maximum);let draw=visitorRandom(random)*options.reduce((n,k)=>n+k.weight,0);const chosen=options.find(k=>(draw-=k.weight)<0)??options.at(-1)!;out.push(chosen.name);points-=chosen.cost;}
  return out;
}
/** All actor IDs, stock and random draws are speculative until entry and space
 * are accepted. A refused opportunity creates neither a person nor a pile. */
function arrive(w:World,kind:VisitorKind,intro=false,exotic=false):boolean {
  const s=w.visitors!;
  if(!w.pawns.some(p=>isColonist(p)&&p.state!=='dead')||w.pawns.some(p=>p.faction==='outlaws'&&!p.prisoner&&activeThreat(p))||s.serial>=Number.MAX_SAFE_INTEGER||s.departed.length+w.pawns.length+civilianAwayCounts(w).people>=w.width*w.height)return false;
  const random={rng:exotic?((w.seed^w.tick^s.serial^0xe70c)>>>0)||1:s.rng},profiles=exotic?['Négociant exotique']:groupProfiles(random,intro?40+Math.floor(visitorRandom(random)*60):visitorPoints(random,kind));
  const arrival=visitorArrival(w,Math.floor(visitorRandom(random)*4294967296),profiles.length,kind);
  if(!profiles.length||!arrival||!civilianAdmissionFits(w,profiles.length))return false;
  const id=s.serial+1,merchant=exotic?0:kind==='visitor'&&visitorRandom(random)<.75?Math.floor(visitorRandom(random)*profiles.length):-1;
  const pawns:Pawn[]=[],piles:MaterialPile[]=[];let nextId=w.nextId;
  for(let i=0;i<profiles.length;i++){
    const factionId=(Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))&&w.worldFactions?bornFactionForDef259(w,'OutlanderCivil'):undefined;if((Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))&&w.worldFactions&&factionId===undefined)return false;
    const p=startingPawn(nextId++,`${profiles[i]} ${id}.${i+1}`,arrival.sites[i]!.x,arrival.sites[i]!.z,0,55,w.seed,w.tick,w.schemaVersion);
    p.faction='outlanders';if((Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))&&w.worldFactions&&!bindBornHumanFaction259(w,p,factionId!))return false;p.foodPolicyId=w.foodPolicies[0]!.id;
    delete p.apparelPolicyId;delete p.apparelAutomation;delete p.nextApparelCheckAt;
    for(const value of Object.values(p.skills))if(typeof value==='object'){value.level=0;value.passion=0;}
    if(w.schemaVersion>=191)generatePawnBackground(p,w.seed,profiles[i]==='Garde',i===merchant);
    for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
    p.visitor={group:id,role:kind==='traveler'?'traveler':i===merchant?'trader':'visitor',...exotic&&i===merchant?{merchantKind:'exotic' as const}:{},phase:'arriving',goal:{...arrival.parking[i]!},personalFoodIds:[]};
    piles.push({id:nextId++,kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'apparel',pawnId:p.id},apparel:newApparelState('cloth-shirt',undefined,w.schemaVersion)});
    if(i===merchant){const stock=exotic?generateExoticStock(random.rng,p.id,nextId,w.tick,w.schemaVersion):generateVisitorStock(random.rng,p.id,nextId,w.tick,w.schemaVersion);piles.push(...stock.piles);nextId=stock.nextId;random.rng=stock.rng;}
    // Preserve Core's food draw before the explicit fine→simple substitution.
    const foodDraw=visitorRandom(random),item=foodDraw<.75?'simple-meal':'survival-meal',quantity=visitorRandom(random)<5/6?3:2,foodId=nextId++;
    piles.push({id:foodId,kind:'food',item,quantity,owner:{type:'inventory',pawnId:p.id},...freshRot(item,w.tick)});p.visitor.personalFoodIds=[foodId];
    pawns.push(p);
  }
  const durationCore=kind==='visitor'?8000+Math.floor(visitorRandom(random)*14000):0;
  if(!Number.isSafeInteger(nextId)||!civilianAdmissionFits(w,profiles.length,piles.length))return false;
  w.nextId=nextId;w.pawns.push(...pawns);w.piles.push(...piles);if(!exotic)s.rng=random.rng;s.serial=id;
  s.groups.push({id,kind,members:pawns.map(p=>p.id),entry:arrival.entry,spot:arrival.spot,phase:'arriving',startedAt:w.tick,arrivedAt:null,durationCore,hostile:false});
  log(w,kind==='traveler'?`${pawns.length} passant(s) traverse(nt) la région.`:exotic?'Un négociant exotique approche de la colonie avec ses marchandises.':`${pawns.length} visiteur(s) approche(nt) de la colonie${merchant>=0?' ; un marchand porte quelques marchandises':''}.`);
  return true;
}
/** Tick controller: calendar opportunities are consumed even if blocked;
 * duration, danger and physical presence are independent from notifications. */
export function advanceVisitors(w:World):void {
  const s=w.visitors;if(!s)return;
  for(const g of s.groups){
    const members=[...w.pawns,...shipCasketHumanReferences277(w)].filter(p=>p.visitor?.group===g.id);
    for(const p of members)if(w.pawns.includes(p))p.visitor!.personalFoodIds=p.visitor!.personalFoodIds.filter(id=>w.piles.some(i=>i.id===id&&(i.owner.type==='inventory'||i.owner.type==='pawn')&&i.owner.pawnId===p.id));
    if(g.phase==='leaving')continue;
    const moving=members.filter(p=>p.state!=='dead'&&p.state!=='downed');
    const thermalCheck=Math.floor(w.tick*10/197)!==Math.floor((w.tick-1)*10/197);
    if(members.some(p=>!!p.burning||p.state==='dead'||p.state==='downed')||thermalCheck&&moving.some(p=>(p.health?.heatstroke??0)>.15*HEAT_UNIT||(p.health?.hypothermia??0)>.15*HEAT_UNIT)
      ||moving.some(p=>w.pawns.some(q=>activeThreat(q)&&hostileTo(p,q)&&(p.x-q.x)**2+(p.z-q.z)**2<=25**2))){leaveGroup(w,g,'danger');continue;}
    if(g.phase==='arriving'&&moving.length&&moving.every(p=>p.visitor!.goal&&p.x===p.visitor!.goal.x&&p.z===p.visitor!.goal.z&&p.moveCooldown===0)){
      if(g.kind==='traveler'){leaveGroup(w,g,'timeout');for(const p of moving)p.visitor!.goal={...g.spot};}
      else {g.phase='staying';g.arrivedAt=w.tick;for(const p of members)p.visitor!.phase='staying';log(w,'Les visiteurs font halte près de la colonie.');}
    }
    if(g.phase==='staying'&&(w.tick-g.arrivedAt!)*10>g.durationCore)leaveGroup(w,g,'timeout');
  }
  s.groups=s.groups.filter(g=>[...w.pawns,...shipCasketHumanReferences277(w)].some(p=>p.visitor?.group===g.id));
  // Maintain the same real groups above, but leave historical home tickets
  // literally dormant. TempMap MTB admissions own their separate shared RNG.
  if(s.profile==='temp-travelers261-v1'||tempMapModern261(w))return;
  if(s.introAt!==null&&w.tick>=s.introAt){const due=w.tick===s.introAt;s.introAt=null;if(due)arrive(w,'visitor',true);}
  if(consumeVisitorOpportunity(s.traveler,'traveler',w.tick))arrive(w,'traveler');
  if(consumeVisitorOpportunity(s.visitor,'visitor',w.tick))arrive(w,'visitor');
  if(s.exotic&&consumeVisitorOpportunity(s.exotic,'exotic',w.tick))arrive(w,'visitor',false,true);
}
function personalMeal(w:World,p:Pawn):void {
  if(p.need||p.hunger>30||!captureStandability(w)(p))return;
  const source=w.piles.find(i=>p.visitor!.personalFoodIds.includes(i.id)&&i.kind==='food'&&i.owner.type==='inventory'&&i.owner.pawnId===p.id);
  if(!source)return;
  const quantity=mealQuantity(p,source,source.quantity);if(!quantity)return;
  // Two visitors may share a physical cell, but only one may claim it as a
  // dining service. Wait before changing ownership or splitting the ration.
  if(reservedServiceCells(w,p.id).has(p.z*w.width+p.x))return;
  let carry=source;
  if(quantity<source.quantity){
    if(w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1))return;
    carry={...source,id:w.nextId++,quantity,owner:{type:'pawn',pawnId:p.id},...copyPileCondition(source)};source.quantity-=quantity;w.piles.push(carry);p.visitor!.personalFoodIds.push(carry.id);
  }else assignPileOwner(source,{type:'pawn',pawnId:p.id});
  p.need={kind:'eat',phase:'ingest',sourcePileId:source.id,carryPileId:carry.id,quantity,progress:0,dining:{target:{x:p.x,z:p.z},seatId:null,tableId:adjacentTable(w,p)?.id??null}};
  p.path=[];p.state='eating';
}
/** Called after shared physiology, burning and physical edge recovery. */
export function processVisitor(w:World,p:Pawn,ctx:NeedContext):boolean {
  if(!p.visitor)return false;
  if(p.state==='dead'||p.state==='downed'||p.moveCooldown>0||(p.motion?.end??0)>w.tick)return true;
  if(isAdmittedVisitorGuest(p)&&processMedicalGuestNeeds(w,p,ctx,true))return true;
  if(processDraftSleep(w,p,ctx))return true;
  if(p.interruptedCargo){retryInterruptedCargo(w,p);if(p.interruptedCargo){p.state='idle';return true;}}
  personalMeal(w,p);if(p.need?.kind==='eat'){processEating(w,p,ctx);return true;}
  const g=groupOf(w,p);if(!g)return true;
  if(p.visitor.phase==='staying'||visitorMayTrade(w,p)&&w.pawns.some(q=>q.trade?.traderId===p.id&&q.trade.phase==='ready')){p.path=[];p.state='idle';return true;}
  if(p.visitor.phase==='leaving'&&!p.visitor.goal){
    if(p.planCooldown>0)return true;
    p.visitor.goal=visitorExit(w,p);p.planCooldown=p.visitor.goal?0:PLAN_INTERVAL;
    if(!p.visitor.goal){p.state='idle';return true;}
  }
  const goal=p.visitor.goal;if(!goal)return true;
  if(p.x===goal.x&&p.z===goal.z){p.state='idle';return true;}
  ctx.move(goal,true);
  // A blocked saved destination must be reconsidered after normal back-off.
  if(p.visitor.phase==='leaving'&&!p.path.length&&p.moveCooldown===0&&p.planCooldown===0)p.visitor.goal=null;
  return true;
}
export function exitVisitor(w:World,p:Pawn):boolean {
  // Current263 departure freezes the original mind; an ongoing crisis must
  // keep its real local owner. Refuse before even filtering personal foods.
  if(isSchema263OrLater(Number(w.schemaVersion))&&p.mental?.crisis)return false;
  const v=p.visitor;
  // The shared ingestion/spoilage pass may remove food after calendar upkeep.
  if(v)v.personalFoodIds=v.personalFoodIds.filter(id=>w.piles.some(i=>i.id===id&&'pawnId' in i.owner&&i.owner.pawnId===p.id));
  if(!v||v.phase!=='leaving'||!visitorAtEdge(w,p)||p.need||p.moveCooldown>0||(p.motion?.end??0)>w.tick||p.state==='dead'||p.state==='downed'||p.state==='sleeping'||p.burning||carrierOf(w,p.id)||(p.stun?.untilCore??0)>w.tick*10||p.bombRefuge||p.interruptedCargo||p.equipmentDropPending||p.shooting?.stance||p.melee?.strike||isAdmittedVisitorGuest(p)&&(treatmentTarget(p)||medicalRestNeeded(p)))return false;
  const items=w.piles.filter(i=>('pawnId' in i.owner)&&i.owner.pawnId===p.id);
  if(items.some(i=>i.owner.type==='pawn')||w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))return false;
  const packed=w.packed.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===p.id);
  releaseAllowedAreaReturn(p);p.path=[];p.state='idle';p.visitor!.goal=null;p.bedId=null;delete p.bedSlot;delete p.medicalSleep;delete p.flee;delete p.tactics;delete p.shooting;delete p.melee;delete p.motion;delete p.stagger;delete p.stun;
  w.visitors!.departed.push({group:v.group,tick:w.tick,pawn:structuredClone(p),items:structuredClone(items),...packed.length?{packed:structuredClone(packed)}:{}});
  w.piles=w.piles.filter(i=>!items.includes(i));w.packed=w.packed.filter(i=>!packed.includes(i));w.pawns=w.pawns.filter(q=>q!==p);
  if(![...w.pawns,...shipCasketHumanReferences277(w)].some(q=>q.visitor?.group===v.group))w.visitors!.groups=w.visitors!.groups.filter(g=>g.id!==v.group);
  for(const q of w.pawns)if(q.trade?.traderId===p.id){delete q.trade;q.path=[];if(q.state==='moving'&&q.moveCooldown===0)q.state='idle';}
  log(w,`${p.name} quitte la carte avec ses possessions restantes.`);return true;
}
import { civilianAdmissionFits,civilianAwayCounts } from './civilian-away.ts';
