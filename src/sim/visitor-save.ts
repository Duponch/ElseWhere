import {validHumanIngestionPawn299} from './human-ingestion-save-299.ts';
import {isSchema299OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validCouplePawnShape285} from './couple-save-285.ts';
import {shipCasketHumanReferences277,shipCasketTerminalParticipant277} from './ship-casket-notifications-277.ts';
import {captureShipCasketHumans277} from './ship-casket-state-277.ts';
import {memoryExpiry271,validSuspendedMemory271} from './suspended-memory-271.ts';
import {validAttackMemory} from './automatic-combat-save.ts';
import {validPrisonerStateRecord259} from './prisoner-save.ts';
import {validWorldAffiliationFields259,validWorldAffiliationForeignKeys259} from './world-affiliation-259.ts';
import { validFamilyBereavementShape } from './family-bereavement-save.ts';
import { validDeathThoughtsPawnShape } from './death-thoughts-save.ts';
import { validRomanceMemoryShape } from './romance-memories.ts';
import {validatePawnAppearance} from './pawn-appearance.ts';
import { validHumanAge } from './human-age.ts';
import { validBackground } from './colonist-backgrounds.ts';
import {validateFurniture} from './furniture-transfer-save.ts';
import {validateArtObjects} from './art-save.ts';
import {isSculptureKind} from './furniture-stats.ts';
import { validApparelShape } from './apparel-save.ts';
import { conflictsWith } from './apparel-rules.ts';
import { validDisturbance } from './disturbance-state.ts';
import { validWeaponShape } from './equipment-save.ts';
import { validMechCorpseShape } from './mechanoid-corpse-save.ts';
import { isPerishable,ROT_DAYS,rotAge } from './food-preservation.ts';
import { validateMedicalRecord } from './injury-validation.ts';
import { validFoodContamination } from './food-poisoning-save.ts';
import { validFilthFeet } from './filth-save.ts';
import { medicalStatus } from './injury-state.ts';
import { MEDICAL_CARE } from './medicine-rules.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { validSkills } from './skills-save.ts';
import { pileMaxHp } from './thing-damage-rules.ts';
import { INTRO_VISITOR_TICK,VISITOR_FLOWS,VISITOR_INTERVAL,VISITOR_YEAR,type VisitorAgendaKind } from './visitor-state.ts';
import { TICKS_PER_DAY,type Cell,type MaterialPile,type Pawn,type World } from './types.ts';
import { APPAREL_POLICY_INTERVAL } from './apparel-renewal.ts';
import { validMentalShape,validMeleeThreatShape } from './mental-save.ts';
import {validTempTravelerHeader261,visitorAgendaClock261} from './temp-travelers-save-261.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const range=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
const cell=(v:unknown,w:World):v is Cell=>object(v)&&Object.keys(v).length===2&&integer(v.x,0,w.width-1)&&integer(v.z,0,w.height-1);
const edge=(v:Cell,w:World)=>v.x===0||v.z===0||v.x===w.width-1||v.z===w.height-1;
const phases=['arriving','staying','leaving'];

/** A departure freezes the real threat record, including an already expired
 * one. Its date follows that departure rather than today's World clock.
 * Visitor exit is a macro producer (engine exitVisitor), so its captured tick
 * proves phase0. Legacy away owners likewise advance only their clinical macro
 * clock. Never borrow a live Root.phaseCore297 for these records. */
export function validArchivedMeleeThreat(value:unknown,w:{schemaVersion:number;nextId:number},tick:number):boolean {
  if(!object(value)||w.schemaVersion<192&&Object.hasOwn(value,'meleeThreat')||!validMeleeThreatShape(value.meleeThreat,w.schemaVersion,tick,isCorePhysicalSchema297(Number(w.schemaVersion))?tick*10:undefined))return false;
  const threat=value.meleeThreat;
  return threat===undefined||object(threat)&&threat.attackerId!==value.id&&integer(threat.attackerId,1,w.nextId-1);
}

/** A frozen visitor may carry its already-constructed256 wander only.
 * It is checked at the real departure clock, never expired/recovered now.
 * Older archives retain their literal no-mental contract. No crisis departs. */
export function validArchivedVisitorMental(value:unknown,w:Pick<World,'schemaVersion'|'width'|'height'>,tick:number):boolean {
  if(!object(value))return false;
  const d=Object.getOwnPropertyDescriptor(value,'mental');if(!d)return !('mental'in value);
  if(w.schemaVersion<256||!d.enumerable||!Object.hasOwn(d,'value')||!object(d.value)||!Object.hasOwn(d.value,'wander')||'crisis'in d.value)return false;
  const mental=d.value;
  if(![Object.prototype,null].includes(Object.getPrototypeOf(mental))||Reflect.ownKeys(mental).length!==4||!['below','cooldown','catharsis','wander'].every(k=>{const slot=Object.getOwnPropertyDescriptor(mental,k);return !!slot&&slot.enumerable&&Object.hasOwn(slot,'value');}))return false;
  return validMentalShape(mental,w.schemaVersion,tick,w.width,w.height);
}

/** Presence is prospective even when the value is undefined or inherited. */
export function hasVisitorMedicalGuestMarker(p:Pick<Pawn,'visitor'>):boolean {
  return !!p.visitor&&typeof p.visitor==='object'&&'medicalGuestAt' in p.visitor;
}

export function validVisitorShape(p:Record<string,unknown>,version:number,w:World):boolean {
  const v=p.visitor;if(version<88)return v===undefined;
  if(v===undefined)return true;
  if(!object(v))return false;
  const medical='medicalGuestAt' in v;
  if(medical){
    const marker=Object.getOwnPropertyDescriptor(v,'medicalGuestAt');
    if(version<237||!marker||!Object.hasOwn(marker,'value')||!marker.enumerable||!integer(marker.value,0,w.tick)
      ||Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null
      ||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'))
      ||p.faction!=='outlanders'||p.prisoner!==undefined||p.podRescue!==undefined)return false;
  }
  return Object.keys(v).length===5+(v.merchantKind!==undefined?1:0)+(medical?1:0)&&keys(v,['group','role','phase','goal','personalFoodIds',...(version>=123?['merchantKind']:[]),...(version>=237?['medicalGuestAt']:[])])&&integer(v.group,1)
    &&['traveler','visitor','trader'].includes(String(v.role))&&phases.includes(String(v.phase))&&(v.goal===null||cell(v.goal,w))
    &&(v.merchantKind===undefined||version>=123&&v.role==='trader'&&v.merchantKind==='exotic')
    &&Array.isArray(v.personalFoodIds)&&v.personalFoodIds.length<=8&&new Set(v.personalFoodIds).size===v.personalFoodIds.length&&v.personalFoodIds.every(id=>integer(id,1,w.nextId-1));
}
function validAgenda(value:unknown,kind:VisitorAgendaKind,w:Pick<World,'tick'>):boolean {
  if(!object(value)||Object.keys(value).length!==4||!keys(value,['rng','cycle','last','pending'])||!integer(value.rng,1,0xffffffff)||!integer(value.cycle,0)||!Array.isArray(value.pending))return false;
  const rule=VISITOR_FLOWS[kind],start=rule.minimum+value.cycle*VISITOR_YEAR,end=start+VISITOR_YEAR;
  return Number.isSafeInteger(end)&&start<=w.tick+VISITOR_YEAR+rule.minimum&&value.pending.length>=1&&value.pending.length<=rule.count&&integer(value.last,start,end)&&value.last===value.pending.at(-1)
    &&value.pending.every((t,i,array)=>integer(t,Math.max(start,w.tick+1),end)&&t%VISITOR_INTERVAL===0&&(!i||t-Number(array[i-1])>=rule.spacing));
}
function validArchivedPawn(value:unknown,w:World,tick:number):boolean {
  if(object(value)&&value.filthFeet!==undefined){if(w.schemaVersion<89||!validFilthFeet(value.filthFeet,w.schemaVersion))return false;const copy={...value};delete copy.filthFeet;value=copy;}
  if(object(value)&&value.appearance!==undefined&&(w.schemaVersion<109||validatePawnAppearance(value.appearance).length))return false;
  const medicalGuest=object(value)&&w.schemaVersion>=237&&hasVisitorMedicalGuestMarker(value as unknown as Pick<Pawn,'visitor'>);
  if(!object(value)||!validHumanIngestionPawn299(value,w.schemaVersion,tick*10)||!validCouplePawnShape285(value,w.schemaVersion,tick)||'coupleTask285'in value||!keys(value,[...Number(w.schemaVersion)===301?['jobTickDelta301']:[],...isSchema299OrLater(Number(w.schemaVersion))?['lastIngestAtCore299']:[],...((Number(w.schemaVersion)===292||(Number(w.schemaVersion)===293||(Number(w.schemaVersion)===294||(Number(w.schemaVersion)===295||(Number(w.schemaVersion)===296||isCorePhysicalSchema297(Number(w.schemaVersion)))))))?['partyMemories292']:[]),...(Number(w.schemaVersion)===285?['coupleClock285','coupleMemories285']:[]),...(medicalGuest?['careDisabled']:[]),...(w.schemaVersion>=223?['allowedAreaId']:[]),...(w.schemaVersion>=109?['appearance']:[]),...(w.schemaVersion>=138?['age']:[]),...(w.schemaVersion>=191?['background']:[]),...(w.schemaVersion>=192?['meleeThreat']:[]),...(w.schemaVersion>=195?['familyBereavement','romanceMemories']:[]),...(w.schemaVersion>=209?['deathThoughts']:[]),...(w.schemaVersion>=256?['mental']:[]),...w.schemaVersion>=259?['worldAffiliation259','prisonerHistory259']:[],'id','name','x','z','visitor','faction','medicalCare','skills','recreation','foodPolicyId','schedule','restZeroTicks','collapsePending','hunger','rest','mood','comfort',...(w.schemaVersion>=90?['beauty','apparelPolicyId','apparelAutomation','nextApparelCheckAt']:[]),'memories','orders','jobId','haul','cooking','need','bedId','needCooldown','state','priorities','path','moveCooldown','planCooldown','health','lastAttack','disturbance'])||!validHumanAge(value.age,w.schemaVersion)||!validBackground(value.background,w.schemaVersion,value.age as import('./human-age.ts').HumanAge|undefined)||!validArchivedMeleeThreat(value,w,tick)||!validArchivedVisitorMental(value,w,tick))return false;
  if(!validWorldAffiliationFields259(value,w.schemaVersion)||!validWorldAffiliationForeignKeys259(value as unknown as Pawn,w.worldFactions))return false;
  if(value.prisonerHistory259!==undefined&&!validPrisonerStateRecord259(value.prisonerHistory259,w.schemaVersion,{...w,tick},true))return false;
  const careValid=medicalGuest?(value.medicalCare===undefined?(value.careDisabled===undefined||value.careDisabled===true):typeof value.medicalCare==='string'&&Object.hasOwn(MEDICAL_CARE,value.medicalCare)&&value.careDisabled===undefined):value.medicalCare==='industrial';
  if(!validDeathThoughtsPawnShape(value,w.schemaVersion,tick)||!validFamilyBereavementShape(value.familyBereavement,w.schemaVersion,tick)||!validRomanceMemoryShape(value.romanceMemories,w.schemaVersion,tick))return false;
  if(!integer(value.id,1,w.nextId-1)||typeof value.name!=='string'||!value.name.trim()||value.name.length>48||!integer(value.x,0,w.width-1)||!integer(value.z,0,w.height-1)||!edge(value as unknown as Cell,w)
    ||value.faction!=='outlanders'||!careValid||value.state!=='idle'||!validVisitorShape(value,w.schemaVersion,{...w,tick})||!object(value.visitor)||value.visitor.phase!=='leaving'||value.visitor.goal!==null
    ||!['hunger','rest','mood','comfort',...(w.schemaVersion>=90?['beauty']:[])].every(k=>range(value[k],0,100))||value.collapsePending!==false||!integer(value.restZeroTicks,0)||!validSkills(value.skills,tick,w.schemaVersion)||!integer(value.foodPolicyId,1)
    ||w.schemaVersion>=90&&value.apparelPolicyId!==undefined&&(!integer(value.apparelPolicyId,1)||!w.apparelPolicies?.some(policy=>policy.id===value.apparelPolicyId)||typeof value.apparelAutomation!=='boolean'||!integer(value.nextApparelCheckAt,0,w.tick+APPAREL_POLICY_INTERVAL.max))
    ||!Array.isArray(value.schedule)||value.schedule.length!==24||!value.schedule.every(v=>['anything','work','sleep','recreation'].includes(String(v)))
    ||!object(value.orders)||Object.keys(value.orders).length!==2||value.orders.active!==null||!Array.isArray(value.orders.queue)||value.orders.queue.length!==0
    ||!['jobId','haul','cooking','need','bedId'].every(k=>value[k]===null)||!Array.isArray(value.path)||value.path.length!==0||value.moveCooldown!==0||!integer(value.needCooldown,0)||!integer(value.planCooldown,0)
    ||!object(value.priorities)||Object.keys(value.priorities).length!==15+(w.schemaVersion>=89&&value.priorities.clean!==undefined?1:0)+(w.schemaVersion>=104&&value.priorities.art!==undefined?1:0)+(w.schemaVersion>=106&&value.priorities.handle!==undefined?1:0)||!Object.keys(value.priorities).every(k=>[...(w.schemaVersion>=89?['clean']:[]),...(w.schemaVersion>=104?['art']:[]),...(w.schemaVersion>=106?['handle']:[]),'firefight','warden','basic','hunt','research','patient','bedrest','doctor','mine','gather','build','haul','grow','cook','craft'].includes(k))||!Object.values(value.priorities).every(v=>v===0))return false;
  const r=value.recreation;
  if(!object(r)||!keys(r,['level','tolerance','bored','task'])||!range(r.level,0,100)||r.task!==null||!object(r.tolerance)||!object(r.bored))return false;
  const tolerance=r.tolerance,bored=r.bored;
  const cerebral=Object.hasOwn(tolerance,'cerebral')||Object.hasOwn(bored,'cerebral');
  const social=Object.hasOwn(tolerance,'social')||Object.hasOwn(bored,'social');
  const television=Object.hasOwn(tolerance,'television')||Object.hasOwn(bored,'television');
  if(Object.keys(tolerance).length!==2+(cerebral?1:0)+(social?1:0)+(television?1:0)||Object.keys(bored).length!==2+(cerebral?1:0)+(social?1:0)+(television?1:0)||cerebral&&(w.schemaVersion<122||!range(tolerance.cerebral,0,100)||typeof bored.cerebral!=='boolean')||social&&(w.schemaVersion<124||!range(tolerance.social,0,100)||typeof bored.social!=='boolean')||television&&(w.schemaVersion<190||!range(tolerance.television,0,100)||typeof bored.television!=='boolean'||Number(tolerance.television)>50&&!bored.television||Number(tolerance.television)<30&&bored.television)||!['solitary','dexterity'].every(k=>range(tolerance[k],0,100)&&typeof bored[k]==='boolean'))return false;
  if(!Array.isArray(value.memories)||value.memories.length>(w.schemaVersion>=227?5:w.schemaVersion>=152?3:2)||new Set(value.memories.map(m=>object(m)?m.kind:null)).size!==value.memories.length||value.memories.some(m=>object(m)&&m.kind==='ate-fine-meal')&&value.memories.some(m=>object(m)&&m.kind==='ate-lavish-meal')||!value.memories.every(m=>object(m)&&Object.keys(m).length===(Object.hasOwn(m,'suspendedTicks')?3:2)&&validSuspendedMemory271(m,w.schemaVersion,tick,Number(m.expiresAt)-TICKS_PER_DAY)&&['ate-without-table','ate-raw-food',...(w.schemaVersion>=152?['ate-fine-meal']:[]),...(w.schemaVersion>=154?['ate-lavish-meal']:[]),...(w.schemaVersion>=227?['ate-nutrient-paste','ate-kibble']:[])].includes(String(m.kind))&&integer(memoryExpiry271(m,Number(m.expiresAt)),tick+1,tick+TICKS_PER_DAY)))return false;
  if(value.health!==undefined&&(validateMedicalRecord(value.health,true,true,true,true,false,false,true,true,true,true,w.schemaVersion>=89,w.schemaVersion,w.schemaVersion>=127)!==null||!object(value.health)||!integer(value.health.civilTick271??value.health.tick,0,tick)||medicalStatus(value.health as unknown as NonNullable<World['pawns'][number]['health']>)!=='mobile'))return false;
  if(!validDisturbance(value.disturbance,88,tick))return false;
  const a=value.lastAttack;if(a!==undefined&&(!validAttackMemory(a,w.schemaVersion,tick,isCorePhysicalSchema297(Number(w.schemaVersion))?tick*10:undefined)||!object(a)||!integer(a.targetId,1,w.nextId-1)||a.targetId===value.id))return false;
  return true;
}

/** New medical guests retain the same archived person and owned possessions.
 * The archive is validated at departure, never at a later live clock. */
export function validVisitorMedicalDeparture(d:import('./visitor-state.ts').VisitorDeparture,w:World):boolean {
  if(!hasVisitorMedicalGuestMarker(d.pawn))return true;
  if(!object(d)||!keys(d,['group','tick','pawn','items','packed'])||!integer(d.group,1,w.visitors?.serial??0)
    ||d.packed!==undefined&&(!Array.isArray(d.packed)||!d.packed.length||d.packed.length>32768)
    ||!integer(d.tick,w.visitors?.adoptedAt??0,w.tick)||!validArchivedPawn(d.pawn,w,d.tick)
    ||d.pawn.visitor?.group!==d.group||!integer(d.pawn.visitor.medicalGuestAt,w.visitors?.adoptedAt??0,d.tick)
    ||!Array.isArray(d.items)||d.items.length>32768||d.items.some(p=>!validExportedPile(p,d.pawn.id,d.tick,w)))return false;
  const ids=new Set<number>([d.pawn.id]),worn:MaterialPile[]=[];let equipped=0;
  for(const pile of d.items){
    if(ids.has(pile.id))return false;ids.add(pile.id);
    if(pile.owner.type==='equipment'&&++equipped>1)return false;
    if(pile.owner.type==='apparel'){if(worn.some(p=>conflictsWith(p,pile)))return false;worn.push(pile);}
  }
  for(const pack of d.packed??[]){
    if(!object(pack)||!object(pack.building)||!object(pack.owner)||!isSculptureKind(pack.building.kind)
      ||pack.owner.type!=='inventory'||pack.owner.pawnId!==d.pawn.id)return false;
    const view={...w,tick:d.tick,packed:[pack],structures:[],jobs:[],piles:[],pawns:[...w.pawns,d.pawn]};
    if(validateFurniture(view,w.schemaVersion,ids,true).length||validateFurniture(view,w.schemaVersion,new Set(),false).length
      ||validateArtObjects(view,w.schemaVersion).length)return false;
  }
  return d.pawn.visitor.personalFoodIds.every(id=>d.items.some(p=>p.id===id&&p.kind==='food'&&p.owner.type==='inventory'));
}
function validExportedPile(value:unknown,pawnId:number,tick:number,w:World):value is MaterialPile {
  if(!object(value)||!keys(value,['id','kind','item','quantity','owner','rot','apparel','weapon','damage',...(w.schemaVersion>=89?['foodPoison']:[])])||!integer(value.id,1,w.nextId-1)||typeof value.item!=='string'||w.schemaVersion<227&&['hay','kibble'].includes(value.item)||!Object.hasOwn(ITEM_DEFINITIONS,value.item)||!validFoodContamination(value.foodPoison,value.item as keyof typeof ITEM_DEFINITIONS,w.schemaVersion>=89)||!object(value.owner)||Object.keys(value.owner).length!==2||!['inventory','apparel','equipment'].includes(String(value.owner.type))||value.owner.pawnId!==pawnId)return false;
  if(!validMechCorpseShape(value,w.schemaVersion,tick))return false;
  const def=ITEM_DEFINITIONS[value.item as keyof typeof ITEM_DEFINITIONS];
  if(value.kind!==def.kind||w.schemaVersion<206&&value.item==='neutroamine'||w.schemaVersion<157&&value.item==='vegetarian-lavish-meal'||w.schemaVersion<159&&value.item==='carnivore-lavish-meal'||w.schemaVersion<156&&value.item==='carnivore-fine-meal'||w.schemaVersion<155&&value.item==='vegetarian-fine-meal'||w.schemaVersion<154&&value.item==='lavish-meal'||w.schemaVersion<152&&value.item==='fine-meal'||w.schemaVersion<123&&['gold','plasteel','advanced-component'].includes(value.item)||!integer(value.quantity,1,def.stackLimit)||!validApparelShape(value,w.schemaVersion)||!validWeaponShape(value,w.schemaVersion)||value.owner.type==='apparel'&&value.kind!=='apparel'||value.owner.type==='equipment'&&value.kind!=='weapon')return false;
  if(value.damage!==undefined&&(value.apparel!==undefined||value.weapon!==undefined||!integer(value.damage,1,pileMaxHp(value as unknown as MaterialPile)-1)))return false;
  const r=value.rot;
  if(isPerishable(value.item as keyof typeof ITEM_DEFINITIONS)){
    if(!object(r)||!keys(r,['progress','atTick','rate'])||!range(r.progress,0,Number.MAX_SAFE_INTEGER)||!integer(r.atTick,0,tick)||r.rate!==undefined&&!range(r.rate,0,1))return false;
    if(rotAge(value as unknown as MaterialPile,tick)>=ROT_DAYS[value.item as keyof typeof ROT_DAYS]*TICKS_PER_DAY)return false;
  }else if(r!==undefined)return false;
  return true;
}
/** Before migration. Includes archived identities in the same global namespace;
 * frozen medical/food ages are checked at departure, not advanced off-map. */
export function validateVisitors(w:World,version:number,ids:Set<number>):string[] {
  const state:unknown=w.visitors;
  if(version<88)return state!==undefined||w.pawns.some(p=>p.visitor)?['Legacy save contains visitor state.']:[];
  if(state===undefined)return w.pawns.some(p=>p.visitor)?['Visitor without calendar.']:[];
  const agendaClock=visitorAgendaClock261(w,version),agendaWorld={tick:agendaClock};
  const temp=object(state)&&Object.getOwnPropertyDescriptor(state,'profile')?.value==='temp-travelers261-v1';
  if(temp?!validTempTravelerHeader261(state,w,version):!object(state)||Object.keys(state).length!==9+(version>=123?1:0)||!keys(state,['profile','adoptedAt','rng','serial','introAt','traveler','visitor',...(version>=123?['exotic']:[]),'groups','departed'])||state.profile!=='cassandra-visitors-v1'||!integer(state.adoptedAt,0,w.tick)||!integer(state.rng,1,0xffffffff)||!integer(state.serial,0)
    ||state.introAt!==null&&(state.adoptedAt!==0||state.introAt!==INTRO_VISITOR_TICK||agendaClock>=INTRO_VISITOR_TICK)||!validAgenda(state.traveler,'traveler',agendaWorld)||!validAgenda(state.visitor,'visitor',agendaWorld)||version>=123&&!validAgenda(state.exotic,'exotic',agendaWorld)||!Array.isArray(state.groups)||state.groups.length>w.width*w.height||!Array.isArray(state.departed)||state.departed.length>w.width*w.height)return ['Invalid visitor calendar.'];
  const errors:string[]=[],s=w.visitors!,groups=new Set<number>(),members=new Set<number>(),departed=new Set<number>();
  if(temp&&(s.groups.some(g=>!object(g)||g.kind!=='traveler')||s.departed.some(d=>!object(d)||!object(d.pawn)||!object(d.pawn.visitor)||d.pawn.visitor.role!=='traveler')))errors.push('TempMap owner contains a non-traveler.');
  for(const d of s.departed){
    if(!object(d)||!keys(d,['group','tick','pawn','items',...(version>=105?['packed']:[])])||d.packed!==undefined&&(version<105||!Array.isArray(d.packed)||d.packed.length===0||d.packed.length>32768)||!integer(d.group,1,s.serial)||!integer(d.tick,s.adoptedAt,w.tick)||!validArchivedPawn(d.pawn,w,d.tick)||!Array.isArray(d.items)||d.items.length>32768){errors.push('Invalid frozen visitor departure.');continue;}
    const p=d.pawn;if(ids.has(p.id)||p.visitor!.group!==d.group||departed.has(p.id)){errors.push('Duplicate visitor departure identity.');continue;}ids.add(p.id);departed.add(p.id);
    const worn:MaterialPile[]=[];let equipped=0;
    for(const pile of d.items){
      if(!validExportedPile(pile,p.id,d.tick,w)||ids.has(pile.id)){errors.push('Invalid exported visitor possession.');continue;}ids.add(pile.id);
      if(pile.owner.type==='equipment'&&++equipped>1)errors.push('Duplicate exported primary equipment.');
      if(pile.owner.type==='apparel'){if(worn.some(other=>conflictsWith(other,pile)))errors.push('Conflicting exported apparel.');worn.push(pile);}
    }
    for(const pack of d.packed??[]){
      if(!object(pack)||!object(pack.building)||!object(pack.owner)||!isSculptureKind(pack.building.kind)||pack.owner.type!=='inventory'||pack.owner.pawnId!==p.id){errors.push('Invalid exported sculpture.');continue;}
      const view={...w,tick:d.tick,packed:[pack],structures:[],jobs:[],piles:[],pawns:[...w.pawns,p]};
      errors.push(...validateFurniture(view,version,ids,true),...validateFurniture(view,version,new Set(),false),...validateArtObjects(view,version));
    }
    if(!p.visitor!.personalFoodIds.every(id=>d.items.some(i=>i.id===id&&i.kind==='food'&&i.owner.type==='inventory')))errors.push('Invalid exported visitor food.');
  }
  const held277=captureShipCasketHumans277(w),cohort277=[...w.pawns,...held277.map(h=>h.pawn)];
  for(const g of s.groups){
    if(temp&&(!object(g)||!cell(g.spot,w)||!edge(g.spot,w)))errors.push('TempMap traveler has no physical edge destination.');
    if(!object(g)||!keys(g,['id','kind','members','entry','spot','phase','startedAt','arrivedAt','durationCore','hostile','reason'])||!integer(g.id,1,s.serial)||groups.has(g.id)||!['traveler','visitor'].includes(String(g.kind))||!Array.isArray(g.members)||!g.members.length||g.members.length>12||new Set(g.members).size!==g.members.length||!g.members.every(id=>integer(id,1,w.nextId-1))||!cell(g.entry,w)||!edge(g.entry,w)||!cell(g.spot,w)||!phases.includes(String(g.phase))||!integer(g.startedAt,s.adoptedAt,w.tick)||g.arrivedAt!==null&&!integer(g.arrivedAt,g.startedAt,w.tick)||typeof g.hostile!=='boolean'||(g.kind==='traveler'?g.durationCore!==0:g.durationCore<8000||g.durationCore>=22000)||!integer(g.durationCore,0)||g.phase==='staying'&&(g.arrivedAt===null||g.kind!=='visitor')||g.phase==='arriving'&&g.arrivedAt!==null||(g.phase==='leaving'?!['timeout','danger','hostile','blocked'].includes(String(g.reason)):g.reason!==undefined)){errors.push('Invalid visitor group.');continue;}
    groups.add(g.id);
    if(g.hostile&&g.reason!=='hostile')errors.push('Hostile visitor group without hostile departure.');
    for(const id of g.members){if(members.has(id)||!cohort277.some(p=>p.id===id&&p.visitor?.group===g.id)&&!s.departed.some(d=>d.pawn.id===id&&d.group===g.id)&&!shipCasketTerminalParticipant277(w,id,'human',g.id,'visitor'))errors.push('Invalid visitor group membership.');members.add(id);}
  }
  for(const p of cohort277)if(p.visitor){const v=p.visitor,g=s.groups.find(g=>g.id===v.group);
    if(!validVisitorShape(p as unknown as Record<string,unknown>,version,w)||p.faction!=='outlanders'||p.prisoner||p.raid||p.trade||p.draft||!g||!g.members.includes(p.id)||v.phase!==g.phase||g.kind==='traveler'&&v.role!=='traveler'||g.kind==='visitor'&&v.role==='traveler')errors.push('Invalid visitor mandate.');
    if(!v.personalFoodIds.every(id=>[...w.piles,...held277.find(h=>h.pawn===p)?.items??[]].some(i=>i.id===id&&i.kind==='food'&&(i.owner.type==='inventory'||i.owner.type==='pawn')&&i.owner.pawnId===p.id)))errors.push('Invalid visitor personal food ownership.');
    const admitted=version>=237&&hasVisitorMedicalGuestMarker(p);
    if(admitted&&(!g||!integer(v.medicalGuestAt,g.startedAt,w.tick)))errors.push('Invalid visitor medical admission chronology.');
    if(p.orders.active!==null||p.orders.queue.length||p.jobId!==null||p.haul||p.cooking||!admitted&&(p.bedId!==null||p.need?.kind==='sleep'&&p.need.bedId!==null))errors.push('Visitor retains colonial work or bed.');
  }
  return errors;
}
