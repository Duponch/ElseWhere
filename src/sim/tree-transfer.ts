import {assignPileOwner} from './pile-index.ts';
import {geyserBlocksPlantOrFloor256} from './local-geyser-state-256.ts';
import {travelPieces} from './travel-timing.ts';
import {gatherResource,clearingDuration,plantWorkGrowthFactor256} from './gathering.ts';
import {clearanceOutputPending} from './construction-plants.ts';
import {retainClearingWorkAfterOutputRefusal} from './plant-retirement.ts';
import {advanceWork,workProgress,resetWork} from './work-progress.ts';
import {extractTreeDefinition,treePackLive,treePackExpiry271} from './tree-transfer-rules.ts';
import {isMinifiedTree,type MinifiedTreePile,type TreeJob,type TreeCommand} from './tree-transfer-state.ts';
import {advanceTreeTransfer} from './tree-transfer-runtime.ts';
import {planTreeExpiry,commitTreeExpiry,planPendingTreeExpiry,commitPendingTreeExpiry,type TreeHost,type TreePileRef,type TreeExpiryOutputPlan} from './tree-transfer-atomic.ts';
import {isHaulOrder} from './order-types.ts';
import {constructionHaulId} from './construction-rules.ts';
import {cancelGroupPreparation} from './group-authority.ts';
import {captureTreeOccurrences} from './tree-transfer-owners.ts';
import {captureHumanOwners} from './human-owners.ts';
import {plantGrowth,choppable,harvestable,isPlant,plantCanYieldNow} from './plants.ts';
import {plantWorkRate,plantWorkSpeed} from './plant-skills.ts';
import {planGroundPlacement,groundCapacity,nearbyGround} from './ground-placement.ts';
import {addMaterial,materialIdentityCount,refreshStock,reservedSource} from './materials.ts';
import {isColonist} from './affiliation.ts';
import {medicalWorkRefusal,pawnBody} from './health-rules.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import {allowedAreaReason} from './allowed-area-state.ts';
import {isRoofed,isRoofJob} from './roof-rules.ts';
import {soilFertility} from './soil.ts';
import {siteClimateDefinition} from './site-climate.ts';
import {FLORA_DEFINITIONS} from './biome-flora.ts';
import {footprintCells} from './definitions.ts';
import {planSelectedDrops,releaseAssignments,releaseWork} from './work-release.ts';
import {interruptWork} from './interrupted-cargo.ts';
import {canStopAt,inBounds} from './pathfinding.ts';
import {PLANT_LIFE_INTERVAL} from './plant-life.ts';
import type {Cell,World,Pawn,Job,Resource,MaterialPile,MaterialOwner,CommandResult} from './types.ts';
export {extractTreeDefinition,treeSelectable} from './tree-transfer-rules.ts';
export {isMinifiedTree} from './tree-transfer-state.ts';
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
export const isPlantDesignationJob=(j:Pick<Job|import('./types.ts').Structure,'kind'>):boolean=>['chop','cut','harvest','extract-tree'].includes(j.kind);
export const isTreeJob=(j:Job):j is TreeJob=>j.kind==='extract-tree'||j.kind==='replant-tree';
export const treeJobsForResource=(w:World,id:number):Job[]=>w.jobs.filter(j=>j.tree?.resourceId===id||j.plantTarget?.resourceId===id);
export function treeWorkTarget(w:World,j:Job):Cell|undefined {
  if(j.tree?.kind==='extract'){const r=w.resources.find(r=>r.id===j.tree!.resourceId);return r?{x:r.x,z:r.z}:j;}
  if(j.tree?.kind==='replant'&&j.tree.phase==='pickup'){const task=j.tree;const p=w.piles.find(p=>p.id===task.sourcePileId);return p?.owner.type==='ground'?p.owner:j;}
  return j.tree?j:undefined;
}
export function extractTreeReason(w:World,r:Resource|undefined):string|undefined {
  if(w.schemaVersion<235)return 'Extraction indisponible dans cet ancien schéma.';
  if(!r||!w.resources.includes(r)||!extractTreeDefinition(r))return 'Cet arbre ne peut pas être déraciné puis replanté.';
  if(w.jobs.some(j=>j.tree?.kind==='extract'&&j.tree.resourceId===r.id))return 'Cet arbre possède déjà cet ordre.';
}
export function replantTreeReason(w:World,p:MaterialPile|undefined,c:Cell,exceptJob?:number):string|undefined {
  if(geyserBlocksPlantOrFloor256(w,c))return 'Un geyser empêche la plantation.';
  if(w.schemaVersion<235||!p||!w.piles.includes(p)||!isMinifiedTree(p)||!extractTreeDefinition(p.innerResource))return 'Aucun arbre déraciné disponible.';
  if(!treePackLive(p,w.tick))return 'Cet arbre déraciné est mort.';
  if(!inBounds(w,c.x,c.z)||!Number.isSafeInteger(c.x)||!Number.isSafeInteger(c.z))return 'Emplacement hors carte.';
  const tile=w.tiles[c.z*w.width+c.x];
  if(!tile||tile.floor||soilFertility(tile.terrain)<.7)return 'Le terrain manque de fertilité pour cet arbre.';
  if(isRoofed(w,c.z*w.width+c.x))return 'Cet arbre exige un emplacement sans toit.';
  const climate=siteClimateDefinition(w),max=p.innerResource.species?FLORA_DEFINITIONS[p.innerResource.species].maxGrowthTemperature:58;
  if(climate.meanTemperature-climate.amplitude>max||climate.meanTemperature+climate.amplitude<0)return 'Le climat annuel ne permet pas cet arbre.';
  if(exceptJob===undefined&&(p.owner.type!=='ground'||reservedSource(w,p.id)>0))return 'Cet arbre doit etre au sol et libre.';
  if(w.resources.some(r=>same(r,c)&&(r.kind==='tree'||r.kind==='rock')))return 'Dégagez la plante existante avant de replanter ici.';
  if(w.structures.some(s=>footprintCells(s).some(e=>same(e,c)))||w.packed.some(x=>x.owner.type==='ground'&&same(x.owner,c)))return 'Un ouvrage ou objet occupe cet emplacement.';
  if(w.jobs.some(j=>j.id!==exceptJob&&!isPlantDesignationJob(j)&&!isRoofJob(j)&&footprintCells(j).some(e=>same(e,c))))return 'Un autre plan occupe cet emplacement.';
  if(w.jobs.some(j=>j.id!==exceptJob&&j.tree?.kind==='replant'&&j.tree.sourcePileId===p.id))return 'Cet arbre possède déjà un plan de replantation.';
}
export function treeJobReason(w:World,j:Job,pawn?:Pawn):string|undefined {
  if(!isTreeJob(j)||!j.tree||w.schemaVersion<235)return 'Ordre d’arbre invalide.';
  if(pawn){
    if(!isColonist(pawn)||pawn.prisoner||pawn.draft||pawn.visitor||pawn.raid||pawn.podRescue&&pawn.podRescue.admittedAt===undefined)return 'Ce colon ne peut pas effectuer ce travail.';
    const reason=medicalWorkRefusal(pawn)??backgroundWorkRefusal(pawn,j.tree.kind==='extract'?'gather':'grow');if(reason)return reason;
    if(pawn.mental?.crisis||pawn.burning||pawn.bombRefuge||pawn.heatRefuge||pawn.tactics||pawn.stun&&(pawn.stun.untilCore>w.tick*10))return 'Ce colon doit d’abord récupérer.';
    const area=allowedAreaReason(w,pawn,j);if(area)return area;
  }
  if(j.tree.kind==='extract'){
    const tree=w.resources.find(r=>r.id===j.tree!.resourceId);
    if(!tree||!extractTreeDefinition(tree)||!same(tree,j))return 'L’arbre original a disparu.';
    if(w.jobs.some(other=>other!==j&&other.status==='active'&&other.reservedBy!==null&&(other.clearance?.resourceId===tree.id||other.plantTarget?.resourceId===tree.id||isPlantDesignationJob(other)&&same(other,tree))))return 'Cet arbre est réservé par un autre travail.';
    return;
  }
  const task=j.tree,pile=w.piles.find(p=>p.id===task.sourcePileId);
  const reason=replantTreeReason(w,pile,j,j.id);if(reason)return reason;
  if(!pile||!isMinifiedTree(pile)||pile.innerResource.id!==task.resourceId)return 'La cargaison originale a disparu.';
  if(task.phase==='pickup'){
    if(pile.owner.type!=='ground')return 'Cet arbre est encore porté.';
    if(reservedSource(w,pile.id,pawn?.id,j.id)>0)return 'Cet arbre est réservé par un transport.';
    if(pawn){const area=allowedAreaReason(w,pawn,pile.owner);if(area)return area;}
  }else if(!pawn||pile.owner.type!=='pawn'||pile.owner.pawnId!==pawn.id||task.carryPileId!==pile.id)return 'Le portage original a été interrompu.';
}
export function applyTreeCommand(w:World,c:TreeCommand):CommandResult|undefined {
  if(c.type!=='extract-tree'&&c.type!=='replant-tree')return;
  if(!Number.isSafeInteger(w.nextId+1)||w.jobs.length>=w.width*w.height*3)return {ok:false,reason:'Limite des ordres ou identités atteinte.'};
  let job:TreeJob;
  if(c.type==='extract-tree'){
    if(!Number.isSafeInteger(c.resourceId)||c.resourceId<1)return {ok:false,reason:'Identité d’arbre invalide.'};
    const tree=w.resources.find(r=>r.id===c.resourceId),reason=extractTreeReason(w,tree);if(reason)return {ok:false,reason};
    const replacing=w.jobs.filter(j=>isPlantDesignationJob(j)&&same(j,tree!)),ids=new Set(replacing.map(j=>j.id));
    const actors=w.pawns.filter(actor=>actor.jobId!==null&&(ids.has(actor.jobId)||w.jobs.some(j=>j.id===actor.jobId&&j.clearance?.resourceId===tree!.id)));
    if(actors.some(actor=>(actor.motion?.end??0)>w.tick&&(w.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===actor.id)||w.packed.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===actor.id))))return {ok:false,reason:'Attendez le contact physique avant de remplacer cet ordre.'};
    const drops=planSelectedDrops(w,ids,new Set(actors.map(p=>p.id)));if(!drops)return {ok:false,reason:'Aucune place pour conserver la cargaison de cet ordre.'};
    for(const actor of actors)if(!releaseWork(w,actor,drops))throw Error('Preflighted tree replacement could not drop cargo');
    w.jobs=w.jobs.filter(j=>!ids.has(j.id));for(const j of w.jobs)if(j.clearance?.resourceId===tree!.id)delete j.clearance;
    for(const actor of w.pawns)actor.orders.queue=actor.orders.queue.filter(o=>typeof o!=='number'||!ids.has(o));
    job={id:w.nextId++,kind:'extract-tree',x:tree!.x,z:tree!.z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},tree:{kind:'extract',resourceId:tree!.id}};
  }else{
    if(!Number.isSafeInteger(c.pileId)||c.pileId<1)return {ok:false,reason:'Identité d’arbre déraciné invalide.'};
    const pile=w.piles.find(p=>p.id===c.pileId),reason=replantTreeReason(w,pile,c);if(reason)return {ok:false,reason};
    if(pile!.owner.type!=='ground'||reservedSource(w,pile!.id)>0)return {ok:false,reason:'Cet arbre doit être au sol et libre.'};
    job={id:w.nextId++,kind:'replant-tree',x:c.x,z:c.z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},tree:{kind:'replant',sourcePileId:pile!.id,resourceId:pile!.innerResource!.id,phase:'pickup',carryPileId:null,workCore:0}};
  }
  w.jobs.push(job);for(const actor of w.pawns)if(actor.jobId===null&&!actor.haul)actor.planCooldown=0;return {ok:true};
}
const contact=(w:World,p:Pawn,c:Cell)=>Math.abs(p.x-c.x)+Math.abs(p.z-c.z)===1&&!p.path.length&&p.moveCooldown===0&&(!p.motion||p.motion.end<=w.tick)&&canStopAt(w,p);
function finish(w:World,j:TreeJob):void {
  const actor=w.pawns.find(p=>p.id===j.reservedBy);w.jobs=w.jobs.filter(x=>x!==j);
  if(actor){actor.jobId=null;actor.orders.active=null;actor.path=[];actor.state='idle';actor.planCooldown=0;}
  w.events.push({tick:w.tick,type:'job',message:j.tree.kind==='extract'?'Un arbre original a été déraciné.':'Un arbre original a été replanté.'});if(w.events.length>80)w.events.shift();
}
export function removeTreeClaims(w:World,resourceId:number,wrapperId?:number,completedJobId?:number):void {
  const removed=new Set(w.jobs.filter(j=>(wrapperId!==undefined?j.tree?.kind==='replant'&&j.tree.sourcePileId===wrapperId:false)||isPlantDesignationJob(j)&&(j.tree?.resourceId===resourceId||j.plantTarget?.resourceId===resourceId||w.resources.find(r=>r.id===resourceId&&same(r,j)))).map(j=>j.id));
  for(const p of w.pawns){if(p.jobId!==null&&p.jobId!==completedJobId&&removed.has(p.jobId))interruptWork(w,p);p.orders.queue=p.orders.queue.filter(o=>typeof o!=='number'||!removed.has(o));}
  w.jobs=w.jobs.filter(j=>!removed.has(j.id));for(const j of w.jobs)if(j.clearance?.resourceId===resourceId){for(const p of w.pawns)if(p.jobId===j.id){if(!releaseWork(w,p))interruptWork(w,p);}delete j.clearance;j.reservedBy=null;j.status='pending';}
}
/** Expiry is an exact custody boundary, not a voluntary global interruption. */
function removeExpiredTreeClaims(w:World,resourceId:number,wrapperId:number):void {
  const ids=new Set(w.jobs.filter(j=>j.tree?.resourceId===resourceId||j.plantTarget?.resourceId===resourceId).map(j=>j.id));
  const matchingHaul=(h:NonNullable<Pawn['haul']>)=>h.sourcePileId===wrapperId||h.carryPileId===wrapperId||ids.has(constructionHaulId(h.destination)??-1);
  for(const p of w.pawns){
    const held=w.piles.some(i=>i.id===wrapperId&&i.owner.type==='pawn'&&i.owner.pawnId===p.id);
    if(p.jobId!==null&&ids.has(p.jobId)||p.haul&&matchingHaul(p.haul)||held&&!p.interruptedCargo){
      releaseAssignments(w,p);delete p.priorityWork;
      if(held)p.interruptedCargo=true;else delete p.interruptedCargo;
    }
    p.orders.queue=p.orders.queue.filter(o=>typeof o==='number'?!ids.has(o):!isHaulOrder(o)||!matchingHaul(o));
  }
  w.jobs=w.jobs.filter(j=>!ids.has(j.id));
  const g=w.group;if(g?.phase==='unloading'&&g.pendingPileIds.includes(wrapperId)&&!w.piles.some(i=>i.id===wrapperId)){
    g.pendingPileIds=g.pendingPileIds.filter(id=>id!==wrapperId);if(!g.pendingPileIds.length)cancelGroupPreparation(w);
  }
}
function hostFor(w:World,refs?:readonly TreePileRef[]):TreeHost {
  const find=(id:number):TreePileRef|undefined=>refs?.find(r=>r.pile.id===id)??(()=>{const pile=w.piles.find(p=>p.id===id);return pile&&isMinifiedTree(pile)?{pile,container:'map',clock:w.tick,active:true}:undefined;})();
  return {
    get tick(){return w.tick;},set tick(v){w.tick=v;},get nextId(){return w.nextId;},set nextId(v){w.nextId=v;},get rng(){return w.rng;},set rng(v){w.rng=v;},
    resource:id=>w.resources.find(r=>r.id===id),resourceIsExact:r=>w.resources.includes(r),pile:find,job:id=>w.jobs.find(j=>j.id===id&&isTreeJob(j)) as TreeJob|undefined,
    extractionReady:(j,r)=>!treeJobReason(w,j,w.pawns.find(p=>p.id===j.reservedBy)),
    extractionCell:(r,j)=>{const view={...w,resources:w.resources.filter(x=>x!==r)};return nearbyGround(view,r).find(c=>groundCapacity(view,c,'minified-tree',j.reservedBy??undefined)>=1);},
    replantReady:(j,p)=>!treeJobReason(w,j,w.pawns.find(x=>x.id===j.reservedBy))&&j.tree.kind==='replant'&&j.tree.phase==='prepare'&&j.tree.workCore>=(j.tree.durationCore??Infinity)&&!!w.pawns.find(x=>x.id===j.reservedBy&&contact(w,x,j)),
    idsAvailable:(n,retiring)=>{
      const container=retiring?(retiring.container==='map'?w.piles:retiring.container as MaterialPile[]):w.piles;
      return Number.isSafeInteger(n)&&n>=0&&Number.isSafeInteger(w.nextId+n)
                &&(!retiring||container.includes(retiring.pile))&&container.length+n-(retiring?1:0)+(w.schemaVersion>=236&&retiring&&retiring.container!=='map'?w.piles.length:0)<=32768;
    },
    removeResource:r=>{w.resources=w.resources.filter(x=>x!==r);},addResource:r=>{w.resources=[...w.resources,r];},addGroundTree:p=>{w.piles=[...w.piles,p];},
    removePile:ref=>{const local=ref.container==='map',container=local?w.piles:ref.container as MaterialPile[];const index=container.indexOf(ref.pile);if(index<0)throw Error('Original tree container lost');container.splice(index,1);if(local)w.piles=[...w.piles];},
    expiryYieldFactor:()=>1, // Existing clone difficulty does not alter plant yield.
    expiryOutput:(ref,quantity)=>{
      const p=ref.pile,local=ref.container==='map',container=local?w.piles:ref.container as MaterialPile[];
      const owner=p.owner,actor=local&&(owner.type==='pawn'||owner.type==='inventory')?w.pawns.find(a=>a.id===owner.pawnId):undefined;
      const origin=owner.type==='ground'?owner:actor?treeHeldPosition(actor,w.tick):undefined;
      if(local&&origin){
        const view={...w,piles:w.piles.filter(x=>x!==p)},parts=planGroundPlacement(view,quantity,origin,'wood');if(!parts)return;
        const outputs=parts.map(part=>({owner:{type:'ground' as const,...part.cell},quantity:part.quantity}));
        return {outputs,newIds:parts.reduce((n,part)=>n+materialIdentityCount(view,part.quantity,{type:'ground',...part.cell},'wood'),0),token:{container,owner:p.owner,local}};
      }
      const count=Math.ceil(quantity/75);
      if(w.schemaVersion>=236&&owner.type==='inventory'){
        const sameOwner=(i:MaterialPile)=>'pawnId' in i.owner&&i.owner.pawnId===owner.pawnId;
        const other=container.filter(i=>i!==p&&sameOwner(i));
        if(other.length+count>256)return;
        // Existing group overload is a total-mass travel state, not a new
        // per-owner expiry rejection. Closed owner catalogues remain strict.

      }
      const outputs=[];for(let remaining=quantity;remaining>0;remaining-=75)outputs.push({owner:{...p.owner},quantity:Math.min(75,remaining)});
      return {outputs,newIds:outputs.length,token:{container,owner:p.owner,local}};
    },
    expiryOutputStillValid:(ref,plan)=>{const token=plan.token as {container:MaterialPile[];owner:MaterialOwner;local:boolean};return (token.local?w.piles:token.container).includes(ref.pile)&&JSON.stringify(ref.pile.owner)===JSON.stringify(token.owner);},
    commitExpiryOutput:(ref,plan)=>{const token=plan.token as {container:MaterialPile[];local:boolean};for(const output of plan.outputs){if(token.local)addMaterial(w,'wood',output.quantity,output.owner,'wood');else token.container.push({id:w.nextId++,kind:'wood',item:'wood',quantity:output.quantity,owner:{...output.owner}});}},
    removeTreeClaims:(id,wrapper,completed,expiry)=>{if(expiry&&w.schemaVersion>=236&&wrapper!==undefined)removeExpiredTreeClaims(w,id,wrapper);else removeTreeClaims(w,id,wrapper,completed);},finish:j=>finish(w,j),growth:r=>plantGrowth(w,r),
    reconcileReplantedGrowth:r=>{delete r.growthThermalFactor;delete r.growthLight;},
  };
}
export function processTreeWork(w:World,p:Pawn,j:Job,move:(target:Cell,touch:boolean)=>void,speed=1):void {
  if(!isTreeJob(j))return;
  if(w.schemaVersion>=236&&j.tree.kind==='replant'&&j.status==='active'&&j.reservedBy===p.id&&p.jobId===j.id){
    const sourcePileId=j.tree.sourcePileId,pile=w.piles.find(i=>i.id===sourcePileId);
    // The dispatcher after actors owns this exact death boundary. Neither
    // new work nor a global interruption may consume foreign queued orders.
    if(pile&&isMinifiedTree(pile)&&!pile.plantPack.pendingExpiry&&w.tick>=treePackExpiry271(pile))return;
  }
  const body=pawnBody(p);
  const obstruction=j.tree.kind==='replant'&&j.tree.phase!=='pickup'?w.resources.find(r=>same(r,j)):undefined;
  if(obstruction){
    if(obstruction.kind==='tree'||obstruction.kind==='rock'||treeJobReason(w,j,p)){interruptWork(w,p);return;}
    if(!contact(w,p,j)){move(j,false);return;}
    j.clearance??={resourceId:obstruction.id,progress:0};p.path=[];p.state='working';
    const duration=clearingDuration(obstruction),outputPending=clearanceOutputPending(j,duration);
    if(outputPending&&p.planCooldown>0)return;
    if(!outputPending)advanceWork(j.clearance,plantWorkRate(p,body,plantCanYieldNow(w,obstruction))*speed*plantWorkGrowthFactor256(w,obstruction));
    if(outputPending||workProgress(j.clearance)>=duration){
      if(gatherResource(w,obstruction,'cut',j.id,p)===null){retainClearingWorkAfterOutputRefusal(j,duration);p.planCooldown=20;}
      else delete j.clearance;
    }
    return;
  }
  advanceTreeTransfer(hostFor(w),p,j,{
    permitted:(actor,job)=>!treeJobReason(w,job,actor),contact:(actor,c)=>contact(w,actor,c),move,
    stop:actor=>interruptWork(w,actor),plantSpeed:actor=>plantWorkSpeed(actor,body)*speed,
    learnPlants:actor=>{plantWorkRate(actor,body,true);},
    pickupWhole:(actor,job)=>{if(job.tree.kind!=='replant')return false;const task=job.tree;const pile=w.piles.find(x=>x.id===task.sourcePileId);if(!pile||pile.owner.type!=='ground'||!contact(w,actor,pile.owner)||w.piles.some(x=>x.owner.type==='pawn'&&x.owner.pawnId===actor.id)||w.packed.some(x=>x.owner.type==='pawn'&&x.owner.pawnId===actor.id))return false;assignPileOwner(pile,{type:'pawn',pawnId:actor.id});return true;},
    destinationReady:(actor,job)=>!treeJobReason(w,job,actor),
  });
  if(j.tree.kind==='replant')j.progress=j.tree.workCore;
}
/** Actual current held position; the actor's captured arrival cell is not used before contact. */
export function treeHeldPosition(p:Pick<Pawn,'x'|'z'|'motion'>,tick:number):Cell {
  const m=p.motion;if(!m||tick>=m.end)return {x:p.x,z:p.z};
  const pieces=travelPieces(m),piece=pieces.find(s=>tick>=s.start&&tick<=s.end)??(tick<pieces[0]!.start?pieces[0]:pieces.at(-1))!;
  const local=piece.end===piece.start?1:Math.max(0,Math.min(1,(tick-piece.start)/(piece.end-piece.start)));
  const fraction=(piece.fromFraction??0)+((piece.toFraction??1)-(piece.fromFraction??0))*local;
  return {x:Math.round(piece.from.x+(piece.to.x-piece.from.x)*fraction),z:Math.round(piece.from.z+(piece.to.z-piece.from.z)*fraction)};
}
function releaseLostTreeCarrier(w:World,pile:MaterialPile):void {
  for(const p of w.pawns){
    if(p.haul&&(p.haul.sourcePileId===pile.id||p.haul.carryPileId===pile.id))interruptWork(w,p);
    if(pile.owner.type==='pawn'&&pile.owner.pawnId===p.id&&p.interruptedCargo
      &&!w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)&&!w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))delete p.interruptedCargo;
  }
}
export function destroyMinifiedTree(w:World,pile:MaterialPile):boolean {
  if(!isMinifiedTree(pile)||!w.piles.includes(pile))return false;
  const ref:TreePileRef={pile,container:'map',clock:w.tick,active:true},host=hostFor(w);
  const plan=planTreeExpiry(host,ref,true);if(!plan||!commitTreeExpiry(host,plan))return false;
  releaseLostTreeCarrier(w,pile);
  refreshStock(w);return true;
}
const treeExpiryDomains=new WeakMap<World,{collections:readonly MaterialPile[][];lengths:readonly number[];present:boolean}>();
export function advanceMinifiedTrees(w:World):void {
  if(w.schemaVersion<235)return;
  const collections=[w.piles,...(w.group&&'members' in w.group?[w.group.items]:[]),...(w.scout&&'pawn' in w.scout?[w.scout.items]:[]),...(w.commercialTrip&&'pawn' in w.commercialTrip?[w.commercialTrip.items]:[])];
  let domain=treeExpiryDomains.get(w);
  if(!domain||domain.collections.length!==collections.length||collections.some((c,i)=>c!==domain!.collections[i]||c.length!==domain!.lengths[i])){
    domain={collections,lengths:collections.map(c=>c.length),present:collections.some(c=>c.some(isMinifiedTree))};treeExpiryDomains.set(w,domain);
  }
  if(!domain.present)return;
  const refs:TreePileRef[]=[];
  for(const container of collections)for(const pile of container)if(isMinifiedTree(pile))refs.push({pile,container:container===w.piles?'map':container,clock:w.tick,active:true});
  const host=hostFor(w,refs);
  for(const ref of refs)if(w.tick>=treePackExpiry271(ref.pile)){
    const pending=ref.pile.plantPack.pendingExpiry;
    if(pending&&w.tick<pending.retryAt)continue;
    const plan=planTreeExpiry(host,ref);
    if(plan&&commitTreeExpiry(host,plan)){
      releaseLostTreeCarrier(w,ref.pile);treeExpiryDomains.delete(w);
      w.events.push({tick:w.tick,type:'job',message:pending?'Les restes de l’arbre mort ont été déposés.':'Un arbre deracine est mort; ses restes sont conserves.'});
    }else if(w.schemaVersion>=236){
      if(pending)ref.pile.plantPack={...ref.pile.plantPack,pendingExpiry:{quantity:pending.quantity,retryAt:w.tick+20}};
      else {
        const death=planPendingTreeExpiry(host,ref);if(!death||!commitPendingTreeExpiry(host,death))throw Error('Expired tree death transaction lost its original');
        w.events.push({tick:w.tick,type:'job',message:'Un arbre déraciné est mort ; ses restes attendent une place.'});
      }
    }else throw Error('Expired tree has no atomic physical output');
    if(w.events.length>80)w.events.shift();
  }
  refreshStock(w);
}
