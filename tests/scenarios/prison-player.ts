import { backgroundWorkRefusal } from '../../src/sim/colonist-backgrounds.ts';
import { isColonist } from '../../src/sim/affiliation.ts';
import { canDesignate } from '../../src/sim/engine.ts';
import { footprintCells,STRUCTURE_DEFINITIONS } from '../../src/sim/definitions.ts';
import { deliveredMaterial,requiredMaterial } from '../../src/sim/construction-materials.ts';
import { medicalWorkRefusal } from '../../src/sim/health-rules.ts';
import { equippedWeapon } from '../../src/sim/equipment-rules.ts';
import { treatmentTarget,urgentTreatment } from '../../src/sim/care-rules.ts';
import { needsAssistedFeeding } from '../../src/sim/feeding-rules.ts';
import { wantsRescue } from '../../src/sim/rescue.ts';
import { medicalBleed } from '../../src/sim/injury-state.ts';
import { medicalCare } from '../../src/sim/medicine-rules.ts';
import { queryOrderOptions } from '../../src/sim/player-orders.ts';
import { blockedCells } from '../../src/sim/pathfinding.ts';
import { prisonBedValid } from '../../src/sim/prison-space.ts';
import { isPowerActive } from '../../src/sim/power-rules.ts';
import { energyDecisions,energySummary,type EnergyPlayerState } from './energy-player.ts';
import { survivorPlan } from './survivor-player.ts';
import { crashlandedDecisions } from './crashlanded-player.ts';
import type { Decision } from './colony-player.ts';
import type { Cell,DesignateCommand,Pawn,World,WorkType } from '../../src/sim/types.ts';

export interface CaptureObservation {id:number;name:string;downedAt:number;injuries:number;bloodLoss:number;capturedAt?:number;recruitedAt?:number;lostAt?:number;outcome?:'dead'|'departed'}
/** A player's notebook, never fields injected into World. */
export interface PrisonPlayerState {
  startTick:number;origin:Cell;campAnchor:Cell;initialColonists:number[];initialPeople:number[];
  energy:EnergyPlayerState;targetId?:number;recruitId?:number;milestones:Record<string,number>;
  attempts:CaptureObservation[];conversations:number;fedCaptive:number;recruitMeals:number;recruitWorkTicks:number;recruitSleepTicks:number;
}
const at=(a:Cell,x:number,z:number):Cell=>({x:a.x+x,z:a.z+z});
export const prisonPlan=(s:Pick<PrisonPlayerState,'origin'>)=>({origin:s.origin,from:s.origin,to:at(s.origin,4,4),door:at(s.origin,2,4),bed:at(s.origin,2,2)});
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const living=(w:World)=>w.pawns.filter(p=>isColonist(p)&&p.state!=='dead');
const WOOD_BUFFER=160,WOOD_BATCH=6;
function woodSupply(w:World,planned:readonly Decision[]=[]){
  const available=w.piles.filter(p=>p.item==='wood'&&(p.owner.type==='ground'||p.owner.type==='pawn')).reduce((n,p)=>n+p.quantity,0);
  let missingConstruction=w.jobs.filter(j=>j.kind in STRUCTURE_DEFINITIONS).reduce((n,j)=>n+Math.max(0,requiredMaterial(j,'wood')-deliveredMaterial(w,j,'wood')),0);
  const known=new Set(w.jobs.map(j=>`${j.kind}:${j.x}:${j.z}`));
  for(const d of planned){const c=d.command;if(c.type!=='designate'||!(c.kind in STRUCTURE_DEFINITIONS))continue;
    const key=`${c.kind}:${c.x}:${c.z}`;if(!known.has(key)){known.add(key);missingConstruction+=requiredMaterial(c,'wood');}
  }
  return {available,missingConstruction,target:missingConstruction+WOOD_BUFFER};
}
/** The old camp's radius is not a resource boundary. Follow visible unmet
 * construction costs and a bounded stock buffer, then choose the nearest trees
 * in the colonists' real accessible component. Orders never create timber. */
export function prisonWoodDecisions(w:World,anchor:Cell,planned:readonly Decision[]=[]):Decision[] {
  const supply=woodSupply(w,planned);if(supply.available>=supply.target)return [];
  const blocked=blockedCells(w),seen=new Uint8Array(w.tiles.length),queue=living(w).filter(p=>!medicalWorkRefusal(p)).map(p=>p.z*w.width+p.x);
  for(const i of queue)seen[i]=1;
  for(let k=0;k<queue.length;k++){const i=queue[k]!,x=i%w.width;for(const n of [x>0?i-1:-1,x+1<w.width?i+1:-1,i>=w.width?i-w.width:-1,i+w.width<w.tiles.length?i+w.width:-1])if(n>=0&&!seen[n]&&!blocked[n]){seen[n]=1;queue.push(n);}}
  const trees=w.resources.filter(r=>r.kind==='tree'&&seen[r.z*w.width+r.x]).sort((a,b)=>(a.x-anchor.x)**2+(a.z-anchor.z)**2-((b.x-anchor.x)**2+(b.z-anchor.z)**2)||a.id-b.id);
  const engaged=new Set(w.jobs.filter(j=>j.kind==='chop').map(j=>j.z*w.width+j.x));
  const newlyOccupied=new Set<number>();
  for(const d of planned)if(d.command.type==='designate'){
    if(d.command.kind==='chop')engaged.add(d.command.z*w.width+d.command.x);
    else for(const c of footprintCells(d.command))newlyOccupied.add(c.z*w.width+c.x);
  }
  const pending=trees.filter(r=>engaged.has(r.z*w.width+r.x));
  let expected=pending.reduce((n,r)=>n+r.amount,0),remaining=WOOD_BATCH-pending.length;
  const out:Decision[]=[];
  for(const r of trees){
    if(remaining<=0||supply.available+expected>=supply.target)break;
    const index=r.z*w.width+r.x;if(engaged.has(index)||newlyOccupied.has(index))continue;
    const command:DesignateCommand={type:'designate',kind:'chop',x:r.x,z:r.z};
    if(!canDesignate(w,command).ok)continue;
    out.push({reason:'Couper les arbres accessibles les plus proches pour couvrir les chantiers et maintenir un tampon de bois.',command});
    expected+=r.amount;remaining--;
  }
  return out;
}
export function newPrisonPlayer(w:World,energy:EnergyPlayerState):PrisonPlayerState {
  if(energy.stage!=='done')throw Error('Prison continuation requires the completed energy notebook, not a second construction experiment.');
  const a=survivorPlan(w,true).anchor,occupied=new Set<number>();
  for(const s of [...w.structures,...w.jobs])for(const c of footprintCells(s))occupied.add(c.z*w.width+c.x);
  for(const c of w.stockpiles)occupied.add(c.z*w.width+c.x);
  for(const zone of w.growingZones)for(const i of zone.cells)occupied.add(i);
  for(const p of w.piles)if(p.owner.type==='ground')occupied.add(p.owner.z*w.width+p.owner.x);
  const blocked=blockedCells(w),seen=new Uint8Array(blocked.length),queue=living(w).map(p=>p.z*w.width+p.x);
  for(const i of queue)seen[i]=1;
  for(let k=0;k<queue.length;k++){const i=queue[k]!,x=i%w.width;for(const n of [x>0?i-1:-1,x+1<w.width?i+1:-1,i>=w.width?i-w.width:-1,i+w.width<w.tiles.length?i+w.width:-1])if(n>=0&&!blocked[n]&&!seen[n]){seen[n]=1;queue.push(n);}}
  const candidates:Cell[]=[];
  // Later bed rows preserve the three historical beds as the camp's anchor.
  for(let z=a.z+2;z<Math.min(w.height-6,a.z+34);z++)for(let x=Math.max(2,a.x-25);x<Math.min(w.width-6,a.x+25);x++)candidates.push({x,z});
  candidates.sort((l,r)=>(l.x+2-a.x)**2+(l.z+2-a.z)**2-((r.x+2-a.x)**2+(r.z+2-a.z)**2)||l.z-r.z||l.x-r.x);
  const origin=candidates.find(c=>{for(let dz=-1;dz<=5;dz++)for(let dx=-1;dx<=5;dx++){const i=(c.z+dz)*w.width+c.x+dx;if(!seen[i]||occupied.has(i)||w.tiles[i]!.terrain==='rock'||w.tiles[i]!.terrain==='water')return false;}return true;});
  if(!origin)throw Error('No accessible 5×5 prison and surrounding aisle near the reached colony; inspect this checkpoint.');
  return {startTick:w.tick,origin,campAnchor:{...a},initialColonists:living(w).map(p=>p.id),initialPeople:w.pawns.map(p=>p.id),energy:structuredClone(energy),milestones:{},attempts:[],conversations:0,fedCaptive:0,recruitMeals:0,recruitWorkTicks:0,recruitSleepTicks:0};
}
export function observePrison(w:World,s:PrisonPlayerState):void {
  const plan=prisonPlan(s),bed=w.structures.find(b=>b.kind==='bed'&&same(b,plan.bed));
  const mark=(key:string,yes:boolean)=>{if(yes&&s.milestones[key]===undefined)s.milestones[key]=w.tick;};
  if(s.milestones.prisonReady===undefined)mark('prisonReady',!!bed?.prisoner&&prisonBedValid(w,bed));
  for(const p of w.pawns)if(!s.initialPeople.includes(p.id)&&!isColonist(p)&&p.state==='downed'&&!p.prisoner&&!s.attempts.some(a=>a.id===p.id))s.attempts.push({id:p.id,name:p.name,downedAt:w.tick,injuries:p.health?.injuries.length??0,bloodLoss:p.health?.bloodLoss??0});
  for(const attempt of s.attempts){const p=w.pawns.find(p=>p.id===attempt.id);if(!p||p.state==='dead'){attempt.lostAt??=w.tick;attempt.outcome=p?'dead':'departed';}if(p?.prisoner)attempt.capturedAt??=p.prisoner.capturedAt;if(p?.recruitment)attempt.recruitedAt??=p.recruitment.recruitedAt;}
  if(s.targetId!==undefined){const current=w.pawns.find(p=>p.id===s.targetId);if(!current||current.state==='dead'){delete s.targetId;}}
  if(s.targetId===undefined&&s.recruitId===undefined&&s.milestones.prisonReady){
    const target=w.pawns.filter(p=>!s.initialPeople.includes(p.id)&&!isColonist(p)&&p.state==='downed'&&!p.prisoner)
      .sort((l,r)=>(l.health?medicalBleed(l.health):0)-(r.health?medicalBleed(r.health):0)||l.id-r.id)[0];
    if(target)s.targetId=target.id;
  }
  const p=w.pawns.find(p=>p.id===s.targetId);
  mark('newRaidDowned',s.targetId!==undefined);mark('captureStarted',w.pawns.some(a=>a.rescue?.capture&&a.rescue.patientId===s.targetId));mark('captureCarried',w.pawns.some(a=>a.rescue?.capture&&a.rescue.patientId===s.targetId&&a.rescue.phase==='carry'));mark('captured',!!p?.prisoner);mark('firstConversation',w.pawns.some(a=>a.ward?.kind==='chat'&&a.ward.patientId===s.targetId&&a.ward.phase==='rapport'));
  if(p?.recruitment&&isColonist(p)){s.recruitId=p.id;mark('recruited',true);}
  const recruit=w.pawns.find(p=>p.id===s.recruitId);
  if(recruit){if(recruit.state==='working'||recruit.haul||recruit.ward)s.recruitWorkTicks++;if(recruit.state==='sleeping')s.recruitSleepTicks++;mark('colonistBed',recruit.bedId===bed?.id&&!bed?.prisoner&&!bed?.medical);}
}
function availableActor(p:Pawn):boolean {
  return isColonist(p)&&!medicalWorkRefusal(p)&&!p.draft&&!p.mental?.crisis&&!p.interruptedCargo&&!p.collapsePending&&!p.rescue&&!p.tend&&!p.feed&&!p.ward&&p.need?.kind!=='eat'&&p.hunger>30&&p.rest>25;
}
/** Reuse only visible weapons physically left by previous fights. A manual
 * equip order claims the real item and can interrupt ordinary civilian work. */
function prisonArmDecisions(w:World):Decision[] {
  const people=living(w).filter(p=>availableActor(p)&&!p.equipmentTask&&p.orders.active===null&&!equippedWeapon(w,p))
    .sort((a,b)=>b.skills.shooting.level-a.skills.shooting.level||a.id-b.id);
  for(const p of people){
    const weapons=w.piles.filter(i=>i.kind==='weapon'&&i.owner.type==='ground').sort((a,b)=>{
      const x=a.owner as Cell,y=b.owner as Cell;return (x.x-p.x)**2+(x.z-p.z)**2-((y.x-p.x)**2+(y.z-p.z)**2)||a.id-b.id;
    });
    for(const item of weapons)if(item.owner.type==='ground'&&queryOrderOptions(w,p.id,item.owner).some(o=>o.enabled&&o.equipmentItemId===item.id))return [
      ...(item.weapon?.forbidden?[{reason:'Autoriser ce revolver déjà abandonné au sol par un ancien assaillant.',command:{type:'weapon-permission' as const,itemId:item.id,allowed:true}}]:[]),
      {reason:'Équiper la personne encore sans arme avec ce revolver réel avant une prochaine attaque.',command:{type:'order-equipment',pawnId:p.id,itemId:item.id,action:'equip',queue:false}},
    ];
  }
  return [];
}
/** Rally on the visible raid letter, not its future deadline. Nearby grouped
 * defenders support each other instead of leaving one colon alone in melee. */
function prisonDefenseDecisions(w:World,s:PrisonPlayerState):Decision[]|undefined {
  const people=living(w).filter(p=>p.state!=='downed'&&!p.mental?.crisis);
  if(w.raids?.active?.phase==='assault'){
    const undrafted=people.filter(p=>!p.draft).map(p=>p.id);
    if(undrafted.length)return [{reason:'Mobiliser les personnes valides dès la lettre du raid pour les rassembler et protéger les civils.',command:{type:'draft',pawnIds:undrafted,enabled:true}}];
    const armed=people.filter(p=>equippedWeapon(w,p)),unarmed=people.filter(p=>!equippedWeapon(w,p));
    const holdFire=armed.filter(p=>p.draft?.holdFire).map(p=>p.id);
    if(holdFire.length)return [{reason:'Autoriser les défenseurs équipés à tirer sur les assaillants.',command:{type:'fire-at-will',pawnIds:holdFire,enabled:true}}];
    const shelter=unarmed.filter(p=>!p.draft?.target).map(p=>p.id);
    if(shelter.length)return [{reason:'Mettre les personnes non armées à l’abri dans le logement existant.',command:{type:'draft-move',pawnIds:shelter,target:at(s.campAnchor,2,3),queue:false}}];
    const rally=armed.filter(p=>!p.draft?.target).map(p=>p.id);
    if(rally.length)return [{reason:'Rassembler les défenseurs dans la cour du camp pour un soutien mutuel, sans poursuivre les assaillants seuls.',command:{type:'draft-move',pawnIds:rally,target:at(s.campAnchor,7,3),queue:false}}];
    return [];
  }
  const drafted=people.filter(p=>p.draft).map(p=>p.id);
  if(drafted.length)return [{reason:'Les assaillants se retirent : démobiliser pour secourir les blessés sans poursuivre au bord de carte.',command:{type:'draft',pawnIds:drafted,enabled:false}}];
}
/** An injured but capable survivor may be the only person able to rescue a
 * bleeding companion. Contextual orders still validate every real service. */
function prisonMedicalDecisions(w:World):Decision[] {
  const people=living(w),bleeding=(p:Pawn)=>p.health?medicalBleed(p.health):0;
  const patients=people.filter(p=>wantsRescue(p)||treatmentTarget(p)||needsAssistedFeeding(p))
    .sort((a,b)=>Number(urgentTreatment(b))-Number(urgentTreatment(a))||bleeding(b)-bleeding(a)||Number(b.state==='downed')-Number(a.state==='downed')||a.hunger-b.hunger||a.id-b.id);
  const doctors=people.filter(p=>!medicalWorkRefusal(p)&&!p.draft&&!p.mental?.crisis&&!p.interruptedCargo&&!p.collapsePending&&!p.tend&&!p.feed&&!p.rescue&&!p.ward&&p.need?.kind!=='eat'&&p.hunger>5&&p.rest>5)
    .sort((a,b)=>Number(urgentTreatment(a))-Number(urgentTreatment(b))||bleeding(a)-bleeding(b)||b.skills.medicine.level-a.skills.medicine.level||a.id-b.id);
  for(const p of patients)for(const actor of doctors){
    if(p===actor)continue;
    if(w.pawns.some(enemy=>!isColonist(enemy)&&!enemy.prisoner&&enemy.state!=='dead'&&enemy.state!=='downed'&&Math.hypot(enemy.x-p.x,enemy.z-p.z)<15))continue;
    const options=queryOrderOptions(w,actor.id,p),rescue=options.some(o=>o.enabled&&o.rescuePatientId===p.id),tend=options.some(o=>o.enabled&&o.tendPatientId===p.id),feed=options.some(o=>o.enabled&&o.feedPatientId===p.id);
    if(!rescue&&!tend&&!feed)continue;
    if(actor.priorities.doctor!==1)return [{reason:'Donner priorité aux secours avec un médecin encore capable, même s’il doit ensuite recevoir des soins.',command:{type:'priority',pawnId:actor.id,work:'doctor',value:1}}];
    return [{reason:rescue?'Secourir le compagnon à terre dans un vrai lit avant de reprendre les travaux.':tend?'Interrompre la convalescence ou le travail du soignant apte pour traiter le compagnon blessé.':'Apporter un vrai repas au compagnon alité.',command:{type:rescue?'order-rescue':tend?'order-tend':'order-feed',pawnId:actor.id,patientId:p.id,queue:false}}];
  }
  return [];
}
/** Only current letters, downed people, access queries and visible stocks guide
 * this policy. It never reads the next raid deadline or alters its population. */
export function prisonDecisions(w:World,s:PrisonPlayerState):Decision[] {
  // Animal rage is a visible combat letter too. Resolve its physical shelter
  // and defense before raid demobilisation or any direct bedside order.
  if(w.wildlife?.animals.some(a=>a.manhunter&&a.state!=='dead'&&a.state!=='downed'))return crashlandedDecisions(w);
  const defense=prisonDefenseDecisions(w,s);if(defense!==undefined)return defense;
  const medical=prisonMedicalDecisions(w);if(medical.length)return medical;
  const arms=prisonArmDecisions(w);
  const base=w.raids?.active?[]:energyDecisions(w,s.energy),people=living(w),plan=prisonPlan(s),target=w.pawns.find(p=>p.id===s.targetId);
  if(base.some(d=>['order-tend','order-feed','order-rescue'].includes(d.command.type)))return base;
  const out:Decision[]=[...arms],population=people.length,mealTarget=3*population,electricReady=w.structures.some(q=>q.kind==='electric-stove'&&isPowerActive(q));
  // Adapt the common food notebook once, so it cannot alternate 9 and 12 meals.
  const bills=new Map<string,Decision>();
  for(const d of base){const c=d.command;if(c.type==='bill-update'){
    const station=w.structures.find(q=>q.id===c.structureId),bill=station?.bills?.find(b=>b.id===c.billId);
    const command=bill?.recipe==='simple-meal'?{...c,settings:{...c.settings,target:mealTarget,suspended:station?.kind==='fueled-stove'?electricReady:c.settings.suspended}}:c;
    bills.set(`${c.structureId}:${c.billId}`,{...d,command});
  }else out.push(d);}
  for(const d of bills.values()){
    const c=d.command;if(c.type!=='bill-update')continue;const bill=w.structures.find(q=>q.id===c.structureId)?.bills?.find(b=>b.id===c.billId);
    if(!bill||bill.mode!==c.settings.mode||bill.target!==c.settings.target||bill.suspended!==c.settings.suspended||bill.radius!==c.settings.radius||bill.destination!==c.settings.destination||Object.entries(c.settings.filters).some(([item,value])=>(bill.filters as Record<string,unknown>)[item]!==value))out.push(d);
  }
  // Existing bills may already match the old policy, so population growth also
  // produces the missing update directly, retaining filters and suspension.
  for(const station of w.structures)for(const bill of station.bills??[])if(bill.recipe==='simple-meal'&&bill.target!==mealTarget&&!bills.has(`${station.id}:${bill.id}`))out.push({reason:'Prévoir trois repas par personne avec les mêmes ingrédients et postes.',command:{type:'bill-update',structureId:station.id,billId:bill.id,settings:{mode:'until',target:mealTarget,suspended:station.kind==='fueled-stove'?electricReady:bill.suspended,filters:{...bill.filters},radius:bill.radius,destination:bill.destination}}});
  // A player never assigns a work type the person's past forbids.
  const priority=(p:Pawn,work:WorkType,value:number,reason:string)=>{if(p.priorities[work]!==value&&!backgroundWorkRefusal(p,work))out.push({reason,command:{type:'priority',pawnId:p.id,work,value}});};
  const cook=[...people].sort((a,b)=>(b.skills.cooking?.level??0)-(a.skills.cooking?.level??0)||a.id-b.id)[0]!;
  const warden=[...people].filter(p=>p!==cook).sort((a,b)=>(b.skills.social?.level??0)-(a.skills.social?.level??0)||a.id-b.id)[0]??cook;
  priority(warden,'warden',1,'Confier les repas et conversations au geôlier, en conservant un cuisinier distinct.');
  for(const p of people)priority(p,'doctor',1,'Garder les soins actifs pendant les constructions et la captivité.');
  const designate=(kind:DesignateCommand['kind'],c:Cell,orientation:0|2=0)=>{const footprint=kind==='bed'?[c,at(c,0,-1)]:[c];if(out.some(d=>d.command.type==='designate'&&footprint.some(cell=>same(cell,d.command as Cell))))return;const command:DesignateCommand={type:'designate',kind,...c,material:'wood',orientation};if(canDesignate(w,command).ok)out.push({reason:'Construire et dégager une vraie prison avec les matériaux du camp.',command});};
  for(let dz=0;dz<5;dz++)for(let dx=0;dx<5;dx++)if(dx===0||dx===4||dz===0||dz===4)designate(dx===2&&dz===4?'door':'wall',at(plan.origin,dx,dz));
  designate('bed',plan.bed,2);
  for(const tree of w.resources.filter(r=>r.kind==='tree'&&r.x>plan.origin.x&&r.x<plan.to.x&&r.z>plan.origin.z&&r.z<plan.to.z&&!same(r,plan.bed)&&!same(r,at(plan.bed,0,-1))))designate('chop',tree);
  const boundaries=w.structures.filter(q=>['wall','door'].includes(q.kind)&&q.x>=plan.origin.x&&q.x<=plan.to.x&&q.z>=plan.origin.z&&q.z<=plan.to.z).length;
  const bed=w.structures.find(q=>q.kind==='bed'&&same(q,plan.bed));
  if(boundaries===16){
    const indices=Array.from({length:25},(_,i)=>(plan.origin.z+Math.floor(i/5))*w.width+plan.origin.x+i%5),roof=new Set(w.roofing?.build),home=new Set(w.home);
    if(indices.some(i=>!roof.has(i)))out.push({reason:'Couvrir la cellule après construction de ses supports.',command:{type:'area',action:'build-roof',from:plan.from,to:plan.to}});
    if(indices.some(i=>!home.has(i)))out.push({reason:'Entretenir la cellule et sa porte.',command:{type:'area',action:'home',from:plan.from,to:plan.to}});
    if(bed&&!bed.prisoner&&s.recruitId===undefined)out.push({reason:'Réserver le lit de la pièce fermée à un captif.',command:{type:'prison-bed',bedId:bed.id,enabled:true}});
  }
  if(target&&!target.prisoner&&!isColonist(target)&&target.state==='downed'&&bed?.prisoner&&!w.pawns.some(p=>p.rescue?.patientId===target.id)){
    const carriers=people.filter(availableActor).sort((a,b)=>(a.x-target.x)**2+(a.z-target.z)**2-((b.x-target.x)**2+(b.z-target.z)**2)||a.id-b.id);
    for(const actor of carriers)if(queryOrderOptions(w,actor.id,target).some(o=>o.enabled&&o.capturePatientId===target.id))return [{reason:'Capturer cet assaillant réellement mis à terre par le combat, sans attendre sa récupération.',command:{type:'order-capture',pawnId:actor.id,patientId:target.id,queue:false}}];
  }
  if(target?.prisoner){
    if(medicalCare(target)!=='industrial')out.push({reason:'Autoriser les médicaments physiques pour les blessures du captif.',command:{type:'medical-care',pawnId:target.id,care:'industrial'}});
    if(target.foodPolicyId!==w.foodPolicies[0]!.id)out.push({reason:'Autoriser les aliments disponibles au captif.',command:{type:'food-policy-assign',pawnId:target.id,policyId:w.foodPolicies[0]!.id}});
    if(target.prisoner.mode!=='recruit')out.push({reason:'Demander les conversations de recrutement sans raccourcir leur rythme.',command:{type:'prisoner-mode',patientId:target.id,mode:'recruit'}});
    const doctors=people.filter(availableActor).sort((a,b)=>b.skills.medicine.level-a.skills.medicine.level||a.id-b.id);
    for(const actor of doctors){const options=queryOrderOptions(w,actor.id,target),tend=options.find(o=>o.enabled&&o.tendPatientId===target.id),feed=options.find(o=>o.enabled&&o.feedPatientId===target.id);
      if(tend)return [{reason:'Traiter au chevet les lésions réellement reçues avant les entretiens.',command:{type:'order-tend',pawnId:actor.id,patientId:target.id,queue:false}}];
      if(feed)return [{reason:'Nourrir physiquement le captif qui doit rester au lit.',command:{type:'order-feed',pawnId:actor.id,patientId:target.id,queue:false}}];
    }
  }
  const recruit=w.pawns.find(p=>p.id===s.recruitId);
  if(recruit&&bed){
    if(bed.prisoner)out.push({reason:'Après son adhésion, convertir la cellule en chambre ordinaire.',command:{type:'prison-bed',bedId:bed.id,enabled:false}});
    else if(bed.medical)out.push({reason:'Rendre le couchage à un usage personnel.',command:{type:'medical-bed',bedId:bed.id,enabled:false}});
    else if(recruit.bedId!==bed.id)out.push({reason:'Attribuer un vrai lit à la quatrième personne.',command:{type:'assign-bed',bedId:bed.id,pawnId:recruit.id}});
    priority(recruit,'haul',1,'Confier le rangement des récoltes et matériaux à la nouvelle personne.');
    priority(recruit,'grow',2,'Faire participer la nouvelle personne au potager.');
  }
  out.push(...prisonWoodDecisions(w,s.campAnchor,out));
  // One ordered setting per key: the prison policy's final staffing wins over
  // the common three-person notebook without conflicting commands in a batch.
  const keys=new Map<string,Decision>();const plain:Decision[]=[];
  for(const d of out){const c=d.command;if(c.type==='priority')keys.set(`${c.pawnId}:${c.work}`,d);else plain.push(d);}
  return [...keys.values(),...plain];
}
export function prisonSummary(w:World,s:PrisonPlayerState){
  const target=w.pawns.find(p=>p.id===s.targetId),plan=prisonPlan(s),bed=w.structures.find(q=>q.kind==='bed'&&same(q,plan.bed));
  const trees=w.resources.filter(r=>r.kind==='tree'),cuts=new Set(w.jobs.filter(j=>j.kind==='chop').map(j=>j.z*w.width+j.x)),pending=trees.filter(r=>cuts.has(r.z*w.width+r.x));
  const wood={...woodSupply(w),pendingCuts:pending.length,pendingYield:pending.reduce((n,r)=>n+r.amount,0),remainingTrees:trees.length,nearestTreeDistance:trees.length?Math.sqrt(trees.reduce((n,r)=>Math.min(n,(r.x-s.campAnchor.x)**2+(r.z-s.campAnchor.z)**2),Infinity)):null};
  return {tick:w.tick,day:w.tick/6000,origin:s.origin,campAnchor:survivorPlan(w,true).anchor,milestones:{...s.milestones},attempts:s.attempts.map(a=>({...a})),prisonBed:bed?{id:bed.id,prisoner:!!bed.prisoner,medical:!!bed.medical}:null,
    wood,
    target:target?{id:target.id,name:target.name,state:target.state,x:target.x,z:target.z,hunger:target.hunger,rest:target.rest,bedId:target.bedId,health:target.health,prisoner:target.prisoner,recruitment:target.recruitment}:null,
    colonists:living(w).map(p=>({id:p.id,name:p.name,state:p.state,hunger:p.hunger,rest:p.rest,bedId:p.bedId,priorities:p.priorities,ward:p.ward})),conversations:s.conversations,fedCaptive:s.fedCaptive,recruitMeals:s.recruitMeals,recruitWorkTicks:s.recruitWorkTicks,recruitSleepTicks:s.recruitSleepTicks,energy:energySummary(w,s.energy)};
}
