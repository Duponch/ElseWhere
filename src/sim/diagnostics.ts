import {idleWanderTask300} from './idle-wander-300.ts';
import { clearingDuration } from './gathering.ts';
import { clearanceOutputPending,workOutputPending } from './construction-plants.ts';
import { workProgress } from './work-progress.ts';
import { extractTreeDefinition } from './tree-transfer-rules.ts';
import { isMinifiedTree } from './tree-transfer-state.ts';
import { jobDuration } from './farming.ts';
import { workPriority } from './work-types.ts';
import { prisonBreakActive } from './prison-break-state.ts';
import { carrierOf } from './rescue-state.ts';
import { PRODUCTION_RECIPES, productionTaskTotal, taskRecipe } from './production-recipes.ts';
import { deconstructionAvailable } from './deconstruction-rules.ts';
import { constructionObstruction, constructionSiteFree, isConstruction } from './construction-rules.ts';
import { constructionRecipe, deliveredMaterial } from './construction-materials.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { reservedDestination } from './materials.ts';
import { workType } from './work-types.ts';
import { COOK_TICKS, INGREDIENT_UNITS } from './cooking-bills.ts';
import { REFUEL_WORK_TICKS } from './fuel.ts';
import { TURRET_RELOAD_WORK_TICKS } from './mini-turret-reload.ts';
import {captureFoodReadability,type FoodReadability} from './food-readability.ts';
import { mentalCrisisStatus } from './mental-presentation.ts';
import type { Job, JobDiagnostic, Pawn, World } from './types.ts';

// Pure presentation queries. No navigation flood or world mutation.
export function queryJobStatus(world: World, job: Job): JobDiagnostic {
  const costs = constructionRecipe(job).ingredients;
  const required = costs.reduce((n,c) => n+c.quantity,0), delivered = costs.reduce((n,c) => n+deliveredMaterial(world,job,c.item),0);
  const queued=job.reservedBy===null?undefined:world.pawns.find(p=>p.id===job.reservedBy&&p.orders.queue.includes(job.id));
  if(queued)return {code:'working',reason:`Réservé dans la file de ${queued.name}.`,delivered,required};
  if(world.schemaVersion>=235&&job.kind==='cut'&&job.flowerPotId===undefined&&job.status==='active'){
    const worker=world.pawns.find(p=>p.id===job.reservedBy&&p.jobId===job.id);
    const source=world.resources.find(r=>job.plantTarget?r.id===job.plantTarget.resourceId:r.x===job.x&&r.z===job.z);
    if(source&&worker?.state==='working'&&workOutputPending(job,jobDuration(world,job)))
      return {code:source.blight?'working':'blocked',reason:source.blight?'Coupe effectuée ; retrait de la plante infectée en attente.':'Attend de la place pour les produits de la coupe.',delivered,required};
  }
  // The same confirmed output boundary covers construction and roof clearing.
  // Replanting uses the same paid output boundary from V352 onward.
  if (job.status === 'active' && job.clearance) {
    const plant = world.resources.find(r => r.id === job.clearance!.resourceId);
    const worker = world.pawns.find(p => p.id === job.reservedBy && p.jobId === job.id);
    if (plant && worker?.state === 'working' && clearanceOutputPending(job, clearingDuration(plant)))
      return {code:'blocked',reason:'Attend de la place pour les produits du dégagement.',delivered,required};
  }
  if(job.kind==='extract-tree'||job.kind==='replant-tree'){
    const task=job.tree,worker=world.pawns.find(p=>p.id===job.reservedBy&&p.jobId===job.id);
    const waiting=():JobDiagnostic=>{const enabled=world.pawns.some(p=>workPriority(p,workType(job))>0);return {code:enabled?'ready':'waiting-worker',reason:enabled?'Prêt ; attend un colon disponible et un accès.':'Travail désactivé pour tous les colons.',delivered,required};};
    if(!task)return {code:'blocked',reason:'La désignation de l’arbre est indisponible.',delivered,required};
    if(task.kind==='extract'){
      const resource=world.resources.find(r=>r.id===task.resourceId),definition=resource&&extractTreeDefinition(resource);
      if(!resource||!definition)return {code:'blocked',reason:'L’arbre à déraciner est indisponible.',delivered,required};
      if(!worker)return waiting();
      const percentage=Math.min(99,Math.floor(100*workProgress(job)/definition.workCore));
      return {code:'working',reason:worker.state==='working'?`Déracinement de ${definition.label.toLowerCase()} par ${worker.name} (${percentage} %).`:`${worker.name} rejoint ${definition.label.toLowerCase()} pour le déraciner.`,delivered,required};
    }
    const pile=world.piles.find(p=>p.id===task.sourcePileId);
    if(!pile||!isMinifiedTree(pile)||pile.innerResource.id!==task.resourceId)return {code:'blocked',reason:'L’arbre déraciné est indisponible.',delivered,required};
    const definition=extractTreeDefinition(pile.innerResource),label=definition?.label.toLowerCase()??'l’arbre';
    const plant=job.clearance&&world.resources.find(r=>r.id===job.clearance!.resourceId);
    if(plant&&worker){
      const percentage=Math.min(99,Math.floor(100*workProgress(job.clearance!)/clearingDuration(plant)));
      return {code:'clearing',reason:worker.state==='working'?`Dégagement de la plante par ${worker.name} avant replantation (${percentage} %).`:`${worker.name} rejoint la plante pour dégager l’emplacement de replantation.`,delivered,required};
    }
    if(task.phase==='pickup')return worker?{code:'working',reason:`${worker.name} rejoint ${label} déraciné pour le replanter.`,delivered,required}:waiting();
    if(!worker||pile.owner.type!=='pawn'||pile.owner.pawnId!==worker.id||task.carryPileId!==pile.id)return {code:'blocked',reason:'Attend le porteur de l’arbre déraciné.',delivered,required};
    if(task.phase==='carry')return {code:'delivering',reason:`${worker.name} transporte ${label} vers son emplacement de replantation.`,delivered,required};
    const percentage=task.durationCore&&task.durationCore>0?Math.min(99,Math.floor(100*task.workCore/task.durationCore)):undefined;
    return {code:'working',reason:worker.state==='working'&&percentage!==undefined?`Replantation de ${label} par ${worker.name} (${percentage} %).`:`${worker.name} prépare l’emplacement de replantation.`,delivered,required};
  }
  if(job.kind==='deconstruct'&&!deconstructionAvailable(world,job,job.reservedBy??undefined))return {code:'blocked',reason:'Attend la fin de l’utilisation du bâtiment.',delivered,required};
  if(isConstruction(job)){
    const {plant,pile,pack}=constructionObstruction(world,job);
    const clearer = job.clearance && world.pawns.find(p => p.id === job.reservedBy && p.jobId === job.id);
    const clearedPlant = clearer && world.resources.find(resource => resource.id === job.clearance!.resourceId);
    if (clearedPlant && clearer) {
      const percentage = Math.min(99, Math.floor(100 * workProgress(job.clearance!) / clearingDuration(clearedPlant)));
      return {code:'clearing',reason:clearer.state === 'working' ? `Dégagement de la plante par ${clearer.name} (${percentage} %).` : `${clearer.name} rejoint la plante pour dégager le chantier.`,delivered,required};
    }
    if(plant||pile||pack)return {code:'clearing',reason:pack?'Attend le déplacement du meuble emballé hors de l’emprise.':plant?'Attend la coupe de la plante qui gêne le chantier.':`Attend le déplacement de ${pile!.quantity} unités hors de l’emprise.`,delivered,required};
    if(!constructionSiteFree(world,job,job.reservedBy??undefined))return {code:'blocked',reason:'Attend la libération de l’emprise par un colon en place ou en mouvement.',delivered,required};
  }
  if (job.reservedBy !== null) {
    const worker = world.pawns.find(p => p.id === job.reservedBy && p.jobId === job.id);
    return {code:'working',reason:worker?.state === 'working'
      ? `${isConstruction(job) ? 'Assemblage' : 'Travail'} en cours (${Math.min(99, Math.floor(100 * workProgress(job) / jobDuration(world, job)))} %).`
      : 'Travail attribué à un colon.',delivered,required};
  }
  if (required > delivered) {
    const shipping = reservedDestination(world, { type: 'job', jobId: job.id });
    return { code: shipping ? 'delivering' : 'missing-materials', reason: shipping ? `Livraison en cours : ${costs.map(c=>`${deliveredMaterial(world,job,c.item)}/${c.quantity} ${ITEM_DEFINITIONS[c.item].label}`).join(" + ")}.` : `Attend ${costs.filter(c=>deliveredMaterial(world,job,c.item)<c.quantity).map(c=>`${c.quantity-deliveredMaterial(world,job,c.item)} ${ITEM_DEFINITIONS[c.item].label}`).join(" + ")} ; vérifier Construction/Transport et l’accès.`, delivered, required };
  }
  if(job.kind==='electric-stove'&&!world.pawns.some(p=>workPriority(p,'build')>0&&p.skills.construction.level>=4))return {code:'waiting-worker',reason:'Construction 4 nécessaire pour terminer la cuisinière électrique.',delivered,required};
  if(job.kind==='cooler'&&!world.pawns.some(p=>workPriority(p,'build')>0&&p.skills.construction.level>=5))return {code:'waiting-worker',reason:'Construction 5 nécessaire pour terminer le climatiseur.',delivered,required};
  const enabled = world.pawns.some(pawn => job.kind==='install'?workPriority(pawn,'build')>0||workPriority(pawn,'haul')>0:workPriority(pawn,workType(job))>0);
  return { code: enabled ? 'ready' : 'waiting-worker', reason: enabled ? 'Prêt ; attend un colon disponible et un accès.' : 'Travail désactivé pour tous les colons.', delivered, required };
}
export function queryPawnStatus(world: World, pawn: Pawn, foodReadability?:FoodReadability): { code: string; reason: string } {
  if(pawn.bombRefuge)return {code:'bomb-refuge',reason:`${pawn.melee?.strike?'Termine sa récupération physique avant de fuir':pawn.motion&&pawn.motion.end>world.tick?'Rejoint son refuge':'Attend hors du rayon'} contre l’explosion de la mini-tourelle ${pawn.bombRefuge.sourceId} · refuge (${pawn.bombRefuge.target.x}, ${pawn.bombRefuge.target.z}).`};
  if(pawn.allowedAreaReturn)return {code:'allowed-area-return',reason:`Rejoint la zone autorisée ${world.allowedAreas?.find(a=>a.id===pawn.allowedAreaId)?.label??''}.`};
  if(pawn.surgery){const t=pawn.surgery,name=world.pawns.find(p=>p.id===t.patientId)?.name??'un patient';return {code:'surgery',reason:`${t.phase==='pickup'?'Collecte une dose pour':t.phase==='approach'?'Rejoint le chevet de':'Opère'} ${name}.`};}
  if(pawn.state!=='dead'&&pawn.health?.anesthetic)return {code:'anesthetic',reason:pawn.state==='downed'?'Sous anesthésie.':'L’anesthésie se dissipe.'};
  if(pawn.mental?.crisis)return {code:'mental-break',reason:mentalCrisisStatus(world,pawn)};
  if(pawn.shooting)return {code:'shooting',reason:pawn.shooting.stance?.phase==='cooldown'?'Récupère après son tir.':pawn.shooting.order?.auto?.kind==='response'?'Riposte civile à une menace proche.':'Vise une cible depuis sa position.'};
  if(pawn.melee)return {code:'melee',reason:pawn.melee.strike?'Récupère après sa frappe.':'Rejoint ou frappe sa cible au contact.'};
  if(pawn.equipmentTask)return {code:'equipment',reason:({equip:'Rejoint son arme avant de l’équiper.',drop:'Dépose son arme au sol.',wear:pawn.state==='working'?'Enfile son vêtement.':'Rejoint le vêtement au sol.',remove:'Retire son vêtement avant de le déposer.'})[pawn.equipmentTask.action]};
  const carrier=carrierOf(world,pawn.id);
  if(carrier)return {code:'carried-patient',reason:`Transporté par ${carrier.name} vers un lit.`};
  if(pawn.ward){const t=pawn.ward,name=world.pawns.find(p=>p.id===t.patientId)?.name??'le prisonnier';return {code:'warden',reason:t.kind==='food'?`${t.phase==='pickup'?'Prélève':'Apporte'} un repas pour ${name}.`:`${t.phase==='approach'?'Rejoint':'Discute avec'} ${name}.`};}
  if(pawn.animalFeed)return {code:'animal-feed',reason:`${pawn.animalFeed.phase==='pickup'?'Prélève une portion pour':pawn.animalFeed.phase==='deliver'?'Apporte une portion à':'Nourrit'} l’animal ${pawn.animalFeed.animalId}.`};
  if(pawn.animalRescue)return {code:'animal-rescue',reason:pawn.animalRescue.phase==='carry'?`Porte l’animal ${pawn.animalRescue.animalId} vers son emplacement de couchage.`:`Rejoint l’animal ${pawn.animalRescue.animalId} pour le secourir.`};
  if(pawn.feed)return {code:'feed',reason:`${pawn.feed.phase==='pickup'?'Prélève une portion pour':pawn.feed.phase==='deliver'?'Apporte une portion à':'Nourrit'} ${world.pawns.find(p=>p.id===pawn.feed!.patientId)?.name??'un patient'}.`};
    if(pawn.tend){
      const t=pawn.tend,target=t.patientId===pawn.id?'ses propres blessures':world.pawns.find(p=>p.id===t.patientId)?.name??'un patient';
      const supply=t.medicine?`avec ${ITEM_DEFINITIONS[t.medicine.item].label.toLowerCase()}`:'sans médicament';
      return {code:'tend',reason:t.phase==='pickup'?`Prélève ${ITEM_DEFINITIONS[t.medicine!.item].label.toLowerCase()} pour ${target}.`:t.phase==='find-medicine'?`Recherche une nouvelle dose pour ${target}.`:`${t.phase==='tend'?'Soigne':'Rejoint'} ${target} ${supply}.`};
    }
  if(pawn.state==='resting'){
    const visitor=world.pawns.find(other=>other.recreation.task?.activity==='visit-sick'&&other.recreation.task.phase==='active'&&other.recreation.task.patientId===pawn.id);
    return {code:'patient',reason:visitor?`Reçoit la visite de ${visitor.name} au lit.`:pawn.medicalSleep?'Dort pendant sa récupération médicale.':'Attend des soins ou récupère au lit, éveillé.'};
  }
  if(pawn.rescue)return {code:pawn.rescue.capture?'capture':'rescue',reason:`${pawn.rescue.phase==='carry'?'Porte':'Rejoint'} ${world.pawns.find(p=>p.id===pawn.rescue!.patientId)?.name??'un patient'} pour ${pawn.rescue.capture?'le capturer':'le secourir'}.`};
  if(pawn.state==='dead')return {code:'dead',reason:'Décédé ; dépouille conservée sur place. Le transport et les sépultures ne sont pas encore disponibles.'};
  if(pawn.state==='downed')return {code:'downed',reason:'Incapacité médicale : ne peut pas agir. Consultez ses blessures et ses capacités dans Santé.'};
  const commercial=world.commercialTrip;
  if(commercial&&'pawnId' in commercial&&commercial.pawnId===pawn.id)return {code:'commercial',reason:commercial.phase==='loading'?`Charge les provisions et l’argent (${commercial.cursor}/${commercial.manifest.length} piles).`:commercial.phase==='leaving'?'Rejoint la bordure pour gagner le comptoir civil.':`Dépose au contact les possessions rapportées (${commercial.pendingPileIds.length} piles restantes).`};
  if(pawn.prisoner&&!pawn.need)return {code:'prisoner',reason:prisonBreakActive(pawn)?'Révolte de prison : force le passage et cherche à quitter la carte.':pawn.prisoner.escape?'Cherche à quitter la carte par une ouverture.':'Prisonnier : attend nourriture, repos ou visite du geôlier.'};
  if(pawn.interruptedCargo)return {code:'interrupted-cargo',reason:'Travail interrompu ; cargaison conservée. Libérez une case de sol proche pour permettre son dépôt.'};
  if(pawn.recreation.task) {
    const task=pawn.recreation.task, patient=task.activity==='visit-sick'?world.pawns.find(other=>other.id===task.patientId):undefined;
    if(task.activity==='read')return {code:'recreation',reason:task.stage==='pickup'?'Va chercher un roman.':task.stage==='seat'?'Rejoint une place pour lire.':task.stage==='return'?'Range le roman après lecture.':task.phase==='active'?'Lit un roman.':'Rejoint une place pour lire.'};
    if(task.activity==='party')return {code:'recreation',reason:task.phase==='travel'?'Se rend à la fête.':'Participe à la fête.'};
    if(task.activity==='visit-sick')return {code:'recreation',reason:task.phase==='travel'?`Se rend au chevet de ${patient?.name??'un patient'}.`:`Rend visite à ${patient?.name??'un patient'} (${Math.round(pawn.recreation.level)} % de loisirs).`};
    if(task.activity==='social-relax')return {code:'recreation',reason:task.phase==='travel'?'Rejoint un point de rencontre.':`Se détend au point de rencontre (${Math.round(pawn.recreation.level)} % de loisirs).`};
    const activity=task.activity==='horseshoes'?'jouer aux fers à cheval':task.activity==='chess'?'jouer aux échecs':task.activity==='watch-television'?'regarder la télévision':'observer le ciel';
    return {code:'recreation',reason:task.phase==='travel'?`Rejoint une place pour ${activity}.`:`Prend le temps de ${activity} (${Math.round(pawn.recreation.level)} %).`};
  }
  if(pawn.heatRefuge)return {code:'thermal-refuge',reason:pawn.state==='moving'?'Rejoint un refuge à température confortable.':'Attend dans un refuge thermique pour récupérer.'};
  if(pawn.research)return {code:'research',reason:pawn.state==='working'?`Recherche ${world.research?.project==='drug-production'?'Production de drogues':world.research?.project==='medicine-production'?'Production de médicaments':world.research?.project==='gun-turrets'?'Tourelles automatiques':world.research?.project==='air-conditioning'?'Climatisation':'Vêtements complexes'} au bureau.`:'Rejoint son bureau de recherche.'};
  if(pawn.cooking) {
    const task=pawn.cooking,recipe=PRODUCTION_RECIPES[taskRecipe(task)];
    if(task.phase==='interrupted')return {code:'cooking-interrupted',reason:'Ingrédient perdu ; attend une case libre pour déposer la cargaison restante.'};
    if(task.phase==='work')return {code:'cooking',reason:`${task.recipe==='cremate-corpse'?'Incinère une dépouille':task.recipe==='smelt-weapon'?'Fond une arme':task.recipe==='make-medicine'?'Fabrique un médicament':task.recipe==='small-sculpture'||task.recipe==='large-sculpture'?'Sculpte une œuvre':task.recipe==='butcher-creature'?'Dépèce une créature':task.recipe==='shirt'?'Confectionne une chemise':task.recipe==='tribalwear'?'Confectionne une tenue tribale':task.recipe==='stone-blocks'?'Taille des blocs de pierre':taskRecipe(task)==='simple-meal'?'Prépare un repas simple':`Production : ${recipe.label.toLowerCase()}`} (${Math.floor(task.progress/productionTaskTotal(world,task)*100)} %).`};
    if(task.phase==='output')return {code:'cooking-output',reason:task.storageId===null?'Porte le produit fabriqué vers un dépôt au sol.':'Porte le produit fabriqué vers sa réserve.'};
    if(task.ingredients.some(i=>i.item==='unfinished-tribalwear'||i.item==='unfinished-shirt'))return {code:'gathering-ingredients',reason:'Reprend son ouvrage inachevé au poste.'};
    const placed=task.ingredients.filter(i=>i.stage==='placed').reduce((n,i)=>n+i.quantity,0);
    return {code:'gathering-ingredients',reason:placed===recipe.units?'Ingrédients rassemblés ; rejoint sa place au poste.':`Rassemble les ingrédients (${placed}/${recipe.units} déposés au poste).`};
  }
  if(pawn.haul?.destination.type==='fuel') {
    const task=pawn.haul;
    return {code:'refueling',reason:task.phase==='pickup'?`Va prélever ${task.quantity} bois pour le combustible.`:task.serviceProgress?`Ravitaille le bâtiment (${Math.floor(task.serviceProgress/REFUEL_WORK_TICKS*100)} %).`:`Porte ${task.quantity} bois vers le bâtiment.`};
  }
  if(pawn.haul?.destination.type==='turret') {
    const task=pawn.haul;
    return {code:'turret-reload',reason:task.phase==='pickup'?`Prélève ${task.quantity} acier pour le canon.`:task.serviceProgress!==undefined?`Réarme le canon au contact (${Math.floor(task.serviceProgress/TURRET_RELOAD_WORK_TICKS*100)} %).`:`Porte ${task.quantity} acier vers la mini-tourelle.`};
  }
  if (pawn.need?.kind === 'eat') return { code: pawn.need.phase, reason: pawn.need.phase === 'pickup' ? 'Va chercher une portion réservée.' : pawn.need.phase === 'choose-spot' ? 'Cherche une place pour manger sa portion.' : pawn.need.phase === 'travel' ? 'Porte sa portion vers sa place réservée.' : `Mange la portion tenue en main (${Math.floor(pawn.need.progress / 50 * 100)} %).` };
  if (pawn.need?.kind === 'sleep') return { code: pawn.need.phase, reason: pawn.need.phase === 'travel' ? pawn.need.bedId === null ? 'Libère le lit et cherche une place au sol.' : 'Se rend à son lit réservé.' : pawn.need.bedId === null ? 'Dort au sol ; aucun lit utilisable ou épuisement.' : 'Dort dans son lit.' };
  if(pawn.hunting)return {code:pawn.hunting.phase,reason:pawn.hunting.phase==='collect'?'Récupère la dépouille de sa chasse.':pawn.hunting.phase==='finish'?'Achève au contact un lièvre à terre.':'Chasse : cherche une position de tir accessible.'};
  if(pawn.haul?.whole)return {code:pawn.haul.phase,reason:pawn.haul.phase==='pickup'?'Rejoint un meuble emballé réservé.':pawn.haul.destination.type==='aside'?'Déplace le meuble entier pour dégager l’emplacement.':'Porte le meuble entier vers sa réserve.'};
  if (pawn.haul) return { code: pawn.haul.phase, reason: pawn.haul.destination.type === 'aside' ? `Libère ${pawn.haul.destination.constructionId===undefined?'les cultures':'le chantier'} : ${pawn.haul.quantity} unités à déplacer.` : pawn.haul.phase === 'pickup' ? `Va prélever ${pawn.haul.quantity} unités réservées.` : `Porte ${pawn.haul.quantity} unités vers ${pawn.haul.destination.type === 'job' ? 'un chantier' : 'le stockage'}.` };
  if (pawn.jobId !== null) return { code: 'working', reason: pawn.state === 'moving' ? 'Se rend à son travail.' : 'Travaille sur sa cible.' };
  if (pawn.state === 'sleeping') return { code: 'sleeping', reason: 'Se repose.' };
  const idle300=Number(world.schemaVersion)===300?idleWanderTask300(pawn):undefined;
  if(idle300)return {code:idle300.kind==='wait'?'idle-wander-wait':'idle-wander-move',reason:idle300.kind==='wait'?'Attend sans rien faire.':'Erre.'};
  if (pawn.state === 'hungry') {
    const food=(foodReadability??captureFoodReadability(world)).byPawn.get(pawn.id);
    if(food?.status==='blocked')return {code:'food-policy-blocked',reason:'Aucun aliment autorisé parmi les piles fraîches au sol ou dans sa propre main examinées sur cette carte. Vérifier Assignations ou produire un aliment autorisé ; accès et réservations non évalués.'};
    if(food?.status==='paste-unchecked')return {code:'food-source-unchecked',reason:'Aucune pile autorisée constatée ; le régime autorise la pâte et un distributeur est présent, mais sa production et son accès ne sont pas évalués.'};
    return { code: 'hungry', reason: 'Faim critique ; attend de la nourriture autorisée et accessible.' };
  }
  return { code: world.jobs.length ? 'waiting' : 'idle', reason: world.jobs.length ? 'Aucun travail actuellement admissible : priorités, matériaux ou accès à vérifier.' : 'Aucun travail admissible actuellement.' };
}
