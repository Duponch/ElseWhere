import { violentWorkRefusal } from '../../src/sim/colonist-backgrounds.ts';
import { meleeContact,meleePlaces } from '../../src/sim/melee-space.ts';
import { meleeTools } from '../../src/sim/melee-statistics.ts';
import { medicallyStopped } from '../../src/sim/health-rules.ts';
import { carrierOf } from '../../src/sim/rescue-state.ts';
import { equippedWeapon } from '../../src/sim/equipment-rules.ts';
import { isColonist } from '../../src/sim/affiliation.ts';
import { queryOrderOptions } from '../../src/sim/player-orders.ts';
import type { World } from '../../src/sim/types.ts';
import type { Decision } from './colony-player.ts';
import { canDesignate, queryArea } from '../../src/sim/index.ts';
import { isGrowingTerrain } from '../../src/sim/soil.ts';
import { footprintCells } from '../../src/sim/definitions.ts';
import { blockedCells,reachableCells,routeToJob,routeCost } from '../../src/sim/pathfinding.ts';
import { plantGrowth } from '../../src/sim/plants.ts';
import { installCommand } from '../../src/sim/furniture-commands.ts';
import { treatmentTarget, urgentTreatment } from '../../src/sim/care-rules.ts';
import { medicalBleed } from '../../src/sim/injury-state.ts';
import { medicalWorkRefusal } from '../../src/sim/health-rules.ts';
import { needsAssistedFeeding } from '../../src/sim/feeding-rules.ts';
import { wantsRescue } from '../../src/sim/rescue.ts';
import { isForcedConsuming } from '../../src/sim/consuming.ts';
import { shotPlan,shootingQueries } from '../../src/sim/shooting.ts';
import type { Cell, DesignateCommand } from '../../src/sim/types.ts';
import { survivorDecisions, survivorPlan, survivorSummary } from './survivor-player.ts';

export const crashlandedThreatActive=(w:World):boolean=>!!w.raids?.active||!!w.raids?.mechActive||!!w.wildlife?.animals.some(a=>a.manhunter&&a.state!=='dead'&&a.state!=='downed');

/** Same ordinary camp policy, with preparation using actual weapon and vest.
 * Visible raids and animal-rage letters both suspend ordinary work and care. */
export function crashlandedDecisions(w:World):Decision[] {
  const people=w.pawns.filter(p=>isColonist(p)&&p.state!=='dead'&&p.state!=='downed'&&!p.mental?.crisis);
  const defender=people.find(p=>!violentWorkRefusal(p)&&!!equippedWeapon(w,p));
  const angry=w.wildlife?.animals.filter(a=>a.manhunter&&a.state!=='dead'&&a.state!=='downed')??[];
  if(angry.length){
    const shelter=shelterDecisions(w,people,defender,angry,'L’alerte signale un animal en rage : interrompre les travaux et les ordres de soins avant de rejoindre l’abri.',true);
    if(shelter.drafting)return shelter.out;
    const camp=survivorPlan(w,true),out=shelter.out;
    if(defender){
      if(defender.draft?.holdFire)out.push({reason:'Autoriser le défenseur équipé à tirer sur la menace animale réelle.',command:{type:'fire-at-will',pawnIds:[defender.id],enabled:true}});
      const target=[...angry].sort((a,b)=>(a.x-defender.x)**2+(a.z-defender.z)**2-(b.x-defender.x)**2-(b.z-defender.z)**2||a.id-b.id)[0]!;
      if(defender.shooting?.order?.targetId!==target.id&&!defender.melee?.order){
        const physical=blockedCells(w,true);
        const atContact=meleeContact(w,defender,target,physical);
        const meleeHere=atContact&&!violentWorkRefusal(defender)&&!medicallyStopped(defender)&&defender.state!=='sleeping'
          &&!defender.need&&!defender.collapsePending&&!carrierOf(w,defender.id)&&meleeTools(w,defender).length>0
          &&meleePlaces(w,defender,target).some(c=>c.x===defender.x&&c.z===defender.z);
        if(meleeHere) {
          out.push({reason:'L’animal hostile est au contact : combattre depuis la place effectivement atteinte, sans tir interdit ni poursuite anticipée.',command:{type:'melee',pawnIds:[defender.id],targetId:target.id}});
          return out;
        }
        const plan=shotPlan(w,defender,target.id,shootingQueries(w));
        if(!('reason' in plan))out.push({reason:'Viser l’animal en rage depuis la position effectivement atteinte.',command:{type:'shoot',pawnIds:[defender.id],targetId:target.id}});
        else if(!defender.draft?.target&&(defender.x!==camp.pin.x||defender.z!==camp.pin.z))out.push({reason:'Rejoindre le poste de défense devant l’entrée avec l’arme réellement équipée.',command:{type:'draft-move',pawnIds:[defender.id],target:camp.pin,queue:false}});
      }
    }
    return out;
  }
  if(w.raids?.active||w.raids?.mechActive) {
    if(defender&&!defender.draft)return [{reason:'La lettre annonce une attaque : mobiliser la personne équipée du revolver.',command:{type:'draft',pawnIds:[defender.id],enabled:true}}];
    if(defender?.draft?.holdFire)return [{reason:'Autoriser le tir contre les assaillants qui approchent.',command:{type:'fire-at-will',pawnIds:[defender.id],enabled:true}}];
    if(defender)return [];
    // The armed defender is down: the others shelter as from an angry animal
    // (with no position to read for mechanoids: no fetch, rescue or meal).
    const raiders=w.raids?.mechActive?undefined:w.pawns.filter(p=>!!p.raid&&!p.raid.exiting&&p.state!=='dead'&&p.state!=='downed');
    return shelterDecisions(w,people,undefined,raiders,'Le défenseur est à terre : interrompre les travaux et rejoindre l’abri.',false).out;
  }
  const drafted=people.filter(p=>p.draft).map(p=>p.id);
  if(drafted.length)return [{reason:'L’assaut est terminé : reprendre les activités civiles et les soins.',command:{type:'draft',pawnIds:drafted,enabled:false}}];
  const beds=accessibleBedDecisions(w);if(beds!==undefined)return beds;
  const medical=medicalDecisions(w);if(medical.length)return medical;
  const out=[...survivorDecisions(w,true),...foodInfrastructureDecisions(w)],candidate=defender??[...people].sort((a,b)=>b.skills.shooting.level-a.skills.shooting.level||a.id-b.id)[0];
  if(!candidate||candidate.equipmentTask||candidate.orders.active!==null||candidate.need||candidate.hunger<50||candidate.rest<40)return out;
  const wanted=defender?'flak-vest':'revolver';
  if(w.piles.some(i=>i.item===wanted&&(i.owner.type==='equipment'||i.owner.type==='apparel')&&i.owner.pawnId===candidate.id))return out;
  const item=w.piles.find(i=>i.item===wanted&&i.owner.type==='ground'&&queryOrderOptions(w,candidate.id,i.owner).some(o=>o.equipmentItemId===i.id&&o.enabled));
  if(item)out.push({reason: wanted==='revolver'?'Préparer la défense avec le revolver réellement fourni.':'Enfiler le gilet avant de reprendre le travail.',command:{type:'order-equipment',pawnId:candidate.id,itemId:item.id,action:wanted==='revolver'?'equip':'wear',queue:false}});
  return out;
}

type Colonist=World['pawns'][number];
const farFrom=(threats:readonly Cell[],c:Cell,cells:number)=>threats.every(a=>Math.max(Math.abs(a.x-c.x),Math.abs(a.z-c.z))>=cells);

/** Everyone but the armed defender shelters in the room from `threats`
 * (undefined: positions unknown): drafted first (a decision of its own), then
 * the downed defender's weapon fetched, the downed rescued and (`meals`: an
 * animal that stays outside, not raiders who come in) the hungry fed while the
 * threats are far, and the others walked inside. */
function shelterDecisions(w:World,people:readonly Colonist[],defender:Colonist|undefined,threats:readonly Cell[]|undefined,draftReason:string,meals:boolean):{drafting:boolean;out:Decision[]} {
  const fetch=defender||!threats?undefined:groundWeaponFetch(w,people,threats);
  const inactive=people.filter(p=>!p.draft&&p!==fetch?.pawn);
  if(inactive.length)return {drafting:true,out:[{reason:draftReason,command:{type:'draft',pawnIds:inactive.map(p=>p.id),enabled:true}}]};
  const camp=survivorPlan(w,true),out:Decision[]=[];
  const inside=(c:Cell)=>c.x>camp.room.from.x&&c.x<camp.room.to.x&&c.z>camp.room.from.z&&c.z<camp.room.to.z;
  if(fetch){
    // Equipping is an undrafted order: undraft first, then pick the weapon up.
    const p=fetch.pawn;
    if(p.draft)out.push({reason:'Le défenseur est à terre et la menace s’est éloignée de son arme : démobiliser le meilleur tireur restant pour la ramasser.',command:{type:'draft',pawnIds:[p.id],enabled:false}});
    else if(!p.equipmentTask){
      const option=queryOrderOptions(w,p.id,{x:fetch.x,z:fetch.z}).find(o=>o.enabled&&o.equipmentItemId===fetch.weapon.id&&o.equipmentAction==='equip');
      out.push(option?{reason:'Ramasser et équiper l’arme du défenseur à terre.',command:{type:'order-equipment',pawnId:p.id,itemId:fetch.weapon.id,action:'equip',queue:false}}
        :{reason:'L’arme tombée n’est pas accessible : revenir à l’abri.',command:{type:'draft',pawnIds:[p.id],enabled:true}});
    }
  }
  const sheltered=people.filter(p=>p!==defender&&p!==fetch?.pawn&&!!p.draft);
  if(threats)out.push(...shelterCareDecisions(w,sheltered,threats,meals));
  const busy=(p:typeof people[number])=>!!p.rescue||isForcedConsuming(p)||out.some(d=>'pawnId' in d.command&&d.command.pawnId===p.id);
  for(const [i,p] of sheltered.entries())if(!inside(p)&&!p.draft?.target&&!busy(p)){
    out.push({reason:'Rejoindre physiquement l’intérieur de l’abri et laisser la porte se refermer.',command:{type:'draft-move',pawnIds:[p.id],target:{x:camp.anchor.x+1+i%3,z:camp.anchor.z+3},queue:false}});
  }
  return {drafting:false,out};
}


/** The armed defender is down and the weapon lies on the ground: the best
 * remaining shooter fetches it while every threat is at least 8 cells from
 * it, as a player would before going out. */
function groundWeaponFetch(w:World,people:readonly Colonist[],threats:readonly Cell[]):{pawn:Colonist;weapon:World['piles'][number];x:number;z:number}|undefined {
  const weapon=w.piles.find(i=>i.item==='revolver'&&i.owner.type==='ground');
  if(!weapon||weapon.owner.type!=='ground')return;
  const {x,z}=weapon.owner;if(!farFrom(threats,{x,z},8))return;
  const pawn=people.filter(p=>!violentWorkRefusal(p)&&!medicallyStopped(p)&&!p.rescue&&!isForcedConsuming(p))
    .sort((a,b)=>b.skills.shooting.level-a.skills.shooting.level||a.id-b.id)[0];
  return pawn&&{pawn,weapon,x,z};
}

/** While colonists shelter from a threat, the player still sends one
 * of them, drafted, to bring in a downed colonist, or to eat when hungry, if
 * every threat is at least 10 cells from the patient or the food: RimWorld's
 * drafted pawns neither eat nor rescue on their own. */
/** Cooked meals first, then the survival rations kept for emergencies and
 * journeys, then raw food. */
const mealRank=(item:string)=>item==='survival-meal'?1:item.includes('meal')?0:2;
function shelterCareDecisions(w:World,sheltered:readonly Colonist[],threats:readonly Cell[],meals:boolean):Decision[] {
  const out:Decision[]=[],free=sheltered.filter(p=>!p.rescue&&!isForcedConsuming(p)&&!p.need&&!p.collapsePending&&!carrierOf(w,p.id));
  const patients=w.pawns.filter(p=>isColonist(p)&&p.state==='downed'&&wantsRescue(p)&&!carrierOf(w,p.id)&&farFrom(threats,p,10));
  for(const patient of patients)for(const doctor of free){
    if(out.some(d=>'pawnId' in d.command&&d.command.pawnId===doctor.id))continue;
    const rescue=queryOrderOptions(w,doctor.id,patient).find(o=>o.enabled&&o.rescuePatientId===patient.id);
    if(rescue){out.push({reason:'La menace s’est éloignée du blessé : le ramener sur un lit de l’abri.',command:{type:'order-rescue',pawnId:doctor.id,patientId:patient.id,queue:false}});break;}
  }
  for(const p of meals?free:[]){
    if(p.hunger>=25||out.some(d=>'pawnId' in d.command&&d.command.pawnId===p.id))continue;
    const meals=w.piles.filter(i=>i.kind==='food'&&i.owner.type==='ground'&&farFrom(threats,i.owner as Cell,10))
      .sort((a,b)=>{const ca=a.owner as Cell,cb=b.owner as Cell;return mealRank(a.item)-mealRank(b.item)||Math.max(Math.abs(ca.x-p.x),Math.abs(ca.z-p.z))-Math.max(Math.abs(cb.x-p.x),Math.abs(cb.z-p.z))||a.id-b.id;});
    for(const meal of meals){
      const cell=meal.owner as Cell,option=queryOrderOptions(w,p.id,{x:cell.x,z:cell.z}).find(o=>o.enabled&&o.consumePileId===meal.id);
      if(option){out.push({reason:'Le colon à l’abri a faim et la menace est loin de la nourriture : aller manger, toujours mobilisé.',command:{type:'order-consume',pawnId:p.id,pileId:meal.id,queue:false}});break;}
    }
  }
  return out;
}

/** Older reached checkpoints have their bed heads against the north wall.
 * Turn the same objects in place, one at a time, before resuming construction.
 * Newly created camps already use orientation 2. No fourth bed is invented. */
function accessibleBedDecisions(w:World):Decision[]|undefined {
  if(w.jobs.some(j=>j.furniture?.kind==='bed'))return [];
  const bed=w.structures.filter(s=>s.kind==='bed'&&s.orientation===0).sort((a,b)=>a.x-b.x||a.id-b.id)[0];
  if(!bed)return;
  const command={type:'install' as const,structureId:bed.id,x:bed.x,z:bed.z+1,orientation:2 as const};
  return installCommand(w,command,true).ok?[{reason:'Retourner ce lit sur sa même emprise pour ouvrir le chevet sur l’allée, sans ajouter de couchage.',command}]:[];
}

/** A player reacts to visible injuries after the fighting, rather than waiting
 * for automatic work to interrupt every unrelated activity. The contextual
 * order validates the actual bedside, medicine/food access and reservations. */
function medicalDecisions(w:World):Decision[] {
  const colonists=w.pawns.filter(p=>isColonist(p)&&p.state!=='dead');
  const bleeding=(p:typeof colonists[number])=>p.health?medicalBleed(p.health):0;
  const patients=colonists.filter(p=>treatmentTarget(p)||needsAssistedFeeding(p)||wantsRescue(p))
    .sort((a,b)=>Number(urgentTreatment(b))-Number(urgentTreatment(a))||bleeding(b)-bleeding(a)||a.hunger-b.hunger||a.id-b.id);
  if(!patients.length)return [];
  // A doctor already tending is redirected, as a player would, to an urgent
  // patient who bleeds more than the one being tended.
  const top=patients[0]!,tendingLess=(p:typeof colonists[number])=>!!p.tend&&urgentTreatment(top)&&p.tend.patientId!==top.id
    &&bleeding(top)>bleeding(colonists.find(c=>c.id===p.tend!.patientId)??top);
  const doctors=colonists.filter(p=>!p.draft&&!p.mental?.crisis&&!medicalWorkRefusal(p)&&!p.interruptedCargo&&!p.collapsePending
    &&(!p.tend||tendingLess(p))&&!p.feed&&!p.rescue&&p.need?.kind!=='eat'&&!urgentTreatment(p)
    // A bleeding patient is cared for by a doctor who is hungry or tired but
    // not yet starving or exhausted.
    &&(urgentTreatment(top)?p.hunger>12&&p.rest>10:p.hunger>30&&p.rest>20))
    .sort((a,b)=>Number(!!treatmentTarget(a))-Number(!!treatmentTarget(b))||bleeding(a)-bleeding(b)||b.skills.medicine.level-a.skills.medicine.level||a.id-b.id);
  let priority:Decision|undefined;
  for(const patient of patients)for(const doctor of doctors){
    if(patient===doctor||doctor.tend&&patient!==top)continue;
    // The priority and the care order go together, as a player gives both at once.
    const setPriority:Decision[]=doctor.priorities.doctor!==1?[{reason:'Confier les soins au meilleur médecin actuellement apte, avant les travaux ordinaires.',command:{type:'priority',pawnId:doctor.id,work:'doctor',value:1}}]:[];
    const options=queryOrderOptions(w,doctor.id,patient);
    const rescue=options.find(o=>o.enabled&&o.rescuePatientId===patient.id);
    if(rescue)return [...setPriority,{reason:'Secourir le blessé vers un vrai lit accessible.',command:{type:'order-rescue',pawnId:doctor.id,patientId:patient.id,queue:false}}];
    const tend=options.find(o=>o.enabled&&o.tendPatientId===patient.id);
    if(tend)return [...setPriority,{reason:'Faire traiter les blessures au chevet dès la fin du combat, en interrompant au besoin le travail ordinaire.',command:{type:'order-tend',pawnId:doctor.id,patientId:patient.id,queue:false}}];
    const feed=options.find(o=>o.enabled&&o.feedPatientId===patient.id);
    if(feed)return [...setPriority,{reason:'Apporter physiquement un aliment autorisé au patient qui a faim pendant sa convalescence.',command:{type:'order-feed',pawnId:doctor.id,patientId:patient.id,queue:false}}];
    priority??=setPriority[0];
  }
  return priority?[priority]:[];
}


/** Additional fields are chosen from visible terrain near the actual camp.
 * They remain ordinary player designations; no trees, stones or stacks vanish. */
function nextField(w:World):{from:Cell;to:Cell}|undefined {
  const a=survivorPlan(w,true).anchor,occupied=new Set<number>();
  const blocked=blockedCells(w),reachable=new Uint8Array(blocked.length),start=(a.z+3)*w.width+a.x+2,queue=[start];reachable[start]=1;
  for(let cursor=0;cursor<queue.length;cursor++){
    const n=queue[cursor]!,x=n%w.width,z=Math.floor(n/w.width);
    for(const next of [x>0?n-1:-1,x+1<w.width?n+1:-1,z>0?n-w.width:-1,z+1<w.height?n+w.width:-1])if(next>=0&&!blocked[next]&&!reachable[next]){reachable[next]=1;queue.push(next);}
  }
  for(const zone of w.growingZones)for(const cell of zone.cells)occupied.add(cell);
  for(const s of [...w.jobs,...w.structures])for(const c of footprintCells(s))occupied.add(c.z*w.width+c.x);
  for(const r of w.resources)if(r.kind==='rock')occupied.add(r.z*w.width+r.x);
  for(const p of w.piles)if(p.owner.type==='ground')occupied.add(p.owner.z*w.width+p.owner.x);
  for(const p of w.stockpiles)occupied.add(p.z*w.width+p.x);
  // Keep the shelter, covered yard, workstations and their approaches free.
  for(let z=a.z-2;z<=a.z+7;z++)for(let x=a.x-1;x<=a.x+14;x++)occupied.add(z*w.width+x);
  const candidates:Cell[]=[];
  for(let z=Math.max(1,a.z-18);z<=Math.min(w.height-5,a.z+18);z++)for(let x=Math.max(1,a.x-18);x<=Math.min(w.width-7,a.x+18);x++)candidates.push({x,z});
  candidates.sort((l,r)=>(l.x-a.x)**2+(l.z-a.z)**2-((r.x-a.x)**2+(r.z-a.z)**2)||l.z-r.z||l.x-r.x);
  for(const from of candidates) {
    const to={x:from.x+5,z:from.z+3};let good=true;
    for(let z=from.z;z<=to.z&&good;z++)for(let x=from.x;x<=to.x;x++)if(!reachable[z*w.width+x]||occupied.has(z*w.width+x)||!isGrowingTerrain(w.tiles[z*w.width+x]!.terrain)){good=false;break;}
    if(!good)continue;
    const q=queryArea(w,{type:'area',action:'growing',from,to});if(q.ok&&q.skipped===0&&q.cells.length===24)return {from,to};
  }
}

function foodInfrastructureDecisions(w:World):Decision[] {
  const p=survivorPlan(w,true),a=p.anchor,out:Decision[]=[];
  const stove=w.structures.find(s=>s.kind==='fueled-stove');
  if(!stove)return out;
  const supports=[{x:a.x+6,z:a.z-1},{x:a.x+13,z:a.z-1},{x:a.x+6,z:a.z+6},{x:a.x+13,z:a.z+6}];
  const designate=(kind:DesignateCommand['kind'],cell:Cell,reason:string)=>{
    const command:DesignateCommand={type:'designate',kind,...cell,material:'wood',orientation:0};
    if(canDesignate(w,command).ok)out.push({reason,command});
  };
  for(const c of supports)designate('wall',c,'Construire les quatre supports du toit de la réserve et des ateliers.');
  if(supports.every(c=>w.structures.some(s=>s.kind==='wall'&&s.x===c.x&&s.z===c.z))) {
    const from={x:a.x+6,z:a.z-1},to={x:a.x+13,z:a.z+6};
    const roofs=new Set(w.roofing?.build),home=new Set(w.home);let needsRoof=false,needsHome=false;
    for(let z=from.z;z<=to.z;z++)for(let x=from.x;x<=to.x;x++){needsRoof ||= !roofs.has(z*w.width+x);needsHome ||= !home.has(z*w.width+x);}
    if(needsRoof)out.push({reason:'Couvrir les vrais stocks et postes, sans prétendre les réfrigérer.',command:{type:'area',action:'build-roof',from,to}});
    if(needsHome)out.push({reason:'Entretenir les supports de la réserve couverte.',command:{type:'area',action:'home',from,to}});
  }
  designate('butcher-table',{x:a.x+11,z:a.z+5},'Construire une table de boucherie après la cuisinière.');
  const butcher=w.structures.find(s=>s.kind==='butcher-table');
  if(butcher&&!butcher.bills?.length)out.push({reason:'Préparer la facture de dépouillement, sans inventer de viande.',command:{type:'bill-add',structureId:butcher.id,recipe:'butcher-creature'}});
  if(butcher) {
    const corpseCell=[{x:a.x+11,z:a.z+6},{x:a.x+10,z:a.z+6},{x:a.x+12,z:a.z+6},{x:a.x+11,z:a.z+7}].find(c=>{
      const query=queryArea(w,{type:'area',action:'stockpile',from:c,to:c});return query.ok&&query.skipped===0&&query.cells.length===1&&!w.stockpiles.some(s=>s.x===c.x&&s.z===c.z);
    });
    if(!w.stockpiles.some(s=>s.filters.corpse)&&corpseCell)out.push({reason:'Prévoir une case de dépouille séparée des aliments.',command:{type:'stockpile',...corpseCell,enabled:true,filters:{wood:false,food:false,corpse:true},priority:2,capacity:1}});
    else if(w.stockpiles.some(s=>s.filters.corpse)&&!(w.hunting?.completed??0)&&!(w.butchery?.completed??0)&&!w.hunting?.targets.length&&w.piles.some(p=>p.item==='simple-meal')) {
      const hunter=w.pawns.find(p=>isColonist(p)&&p.state!=='dead'&&p.state!=='downed'&&!p.draft&&!p.mental?.crisis&&!p.need&&p.hunger>55&&p.rest>55&&!!equippedWeapon(w,p));
      // Wildlife can roam beyond the old 35-cell camp ring. Choose a real
      // reachable target from the armed hunter's position; the engine still
      // performs its own shot-position search, pursuit and corpse transport.
      const reach=hunter?reachableCells(w,hunter,blockedCells(w),new Set<number>()):undefined;
      const target=reach?w.wildlife?.animals.filter(animal=>animal.state!=='dead'&&!animal.domestic)
        .flatMap(animal=>{const path=routeToJob(w,animal,reach,true);return path?[{animal,cost:routeCost(w,path,reach)}]:[];})
        .sort((l,r)=>l.cost-r.cost||l.animal.id-r.animal.id)[0]?.animal:undefined;
      if(hunter&&target){
        if(hunter.priorities.hunt!==1)out.push({reason:'Confier une seule chasse à la personne armée et reposée.',command:{type:'priority',pawnId:hunter.id,work:'hunt',value:1}});
        out.push({reason:'Obtenir une vraie dépouille pour la première boucherie, sans épuiser la faune.',command:{type:'hunt',animalId:target.id,enabled:true}});
      }
    }
  }
  // Diversify only after the primary rice field has actually supplied stock.
  // Existing secondary zones continue their policy through saves and harvests.
  const zones=[...w.growingZones].sort((l,r)=>l.id-r.id);
  const harvestedRice=w.piles.some(q=>q.item==='rice'&&q.quantity>0);
  if(harvestedRice||zones.length>1)for(const [index,plant] of [[1,'potato'],[2,'corn']] as const) {
    const zone=zones[index];
    if(zone&&zone.plant!==plant)out.push({reason:`Diversifier une petite parcelle avec ${plant==='potato'?'des pommes de terre':'du maïs'}, en conservant les plants déjà présents.`,command:{type:'growing-policy',zoneId:zone.id,plant,allowSow:true,allowCut:true}});
    if(!zone){const area=nextField(w);if(area)out.push({reason:'Ajouter une parcelle de 24 cases après la première production de riz.',command:{type:'area',action:'growing',...area}});break;}
  }
  return out;
}

export function crashlandedSummary(w:World) {
  const roof=new Set(w.roofing?.constructed),amount=(item:string)=>w.piles.reduce((n,p)=>n+(p.item===item?p.quantity:0),0);
  return {...survivorSummary(w),
    foodChain:{coveredStockCells:w.stockpiles.filter(s=>roof.has(s.z*w.width+s.x)).length,
      stations:w.structures.filter(s=>s.kind==='fueled-stove'||s.kind==='electric-stove'||s.kind==='butcher-table').map(s=>({id:s.id,kind:s.kind,fuel:s.fuel,roofed:footprintCells(s).every(c=>roof.has(c.z*w.width+c.x)),bills:s.bills})),
      plants:['rice','potato','corn'].map(kind=>({kind,count:w.resources.filter(r=>r.kind===kind).length,mature:w.resources.filter(r=>r.kind===kind&&plantGrowth(w,r)>=1).length,meanGrowth:(()=>{const plants=w.resources.filter(r=>r.kind===kind);return plants.length?plants.reduce((n,r)=>n+plantGrowth(w,r),0)/plants.length:0;})()})),
      zones:w.growingZones.map(z=>({id:z.id,plant:z.plant,cells:z.cells.length,allowSow:z.allowSow})),
      raw:{rice:amount('rice'),potato:amount('potato'),corn:amount('corn'),berries:amount('berries'),meat:amount('hare-meat')},butchered:w.butchery?.completed??0}}
}
