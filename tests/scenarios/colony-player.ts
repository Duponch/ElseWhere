import { huntingDecisions } from './hunting-player.ts';
import { textileDecisions } from './textile-player.ts';
import { opinionOf } from '../../src/sim/social-state.ts';
import { breakThresholds,globalLearningFactor } from '../../src/sim/traits.ts';
import { learningFactor } from '../../src/sim/skills.ts';
import { isColonist } from '../../src/sim/affiliation.ts';
import { raidDefenseDecisions } from './raid-player.ts';
import { moodThoughts,moodTarget,moodFrozen } from '../../src/sim/mood.ts';
export { encounterDecisions } from './encounter-player.ts';
import { powerDecisions } from './power-player.ts';
import { componentDecisions } from './components-player.ts';
import { coolingDecisions } from './cooling-player.ts';
import { stonecuttingDecisions } from './stonecutting-player.ts';
import { roofingDecisions } from './roofing-player.ts';
import { WorkEnvironmentCache } from '../../src/sim/work-environment.ts';
import { outdoorTemperature, TemperatureView } from '../../src/sim/temperature.ts';
import { cookingSpot } from '../../src/sim/cooking-bills.ts';
import { miningDecisions } from './mining-player.ts';
import { installCommand } from '../../src/sim/furniture-commands.ts';
import { queryOrderOptions } from '../../src/sim/player-orders.ts';
import { planCookingOrder } from '../../src/sim/player-cooking.ts';
import { isCookingOrder } from '../../src/sim/order-types.ts';
import { PRODUCTION_RECIPES } from '../../src/sim/production-recipes.ts';
import { plantGrowth, plantTemperatureFactor } from '../../src/sim/plants.ts';
import { availableNutrition } from '../../src/sim/items.ts';
import { spoiledUnits } from '../../src/sim/food-preservation.ts';
import { canDesignate } from '../../src/sim/engine.ts';
import { planHaulOrder } from '../../src/sim/player-hauling.ts';
import { requiredMaterial } from '../../src/sim/construction-materials.ts';
import { footprintCells, STRUCTURE_DEFINITIONS } from '../../src/sim/definitions.ts';
import type { Command, DesignateCommand, World } from '../../src/sim/types.ts';

export interface Decision { reason: string; command: Command }
const environmentCaches=new WeakMap<World,WorkEnvironmentCache>();
function environmentSummary(world:World) {
  let cache=environmentCaches.get(world);if(!cache){cache=new WorkEnvironmentCache();environmentCaches.set(world,cache);}
  const env=cache.read(world);
  const temperatures=new TemperatureView(world),plants=world.resources.filter(r=>r.kind==='rice'||r.kind==='berries');
  return {
    hunting:{completed:world.hunting?.completed??0,designated:world.hunting?.targets.length??0,butchered:world.butchery?.completed??0,meatProduced:world.butchery?.meat??0,leatherProduced:world.butchery?.leather??0,corpses:world.piles.filter(p=>p.kind==='corpse').length,spots:world.structures.filter(s=>s.kind==='butcher-spot').length},
    wildlife:world.wildlife?{population:world.wildlife.animals.length,injured:world.wildlife.animals.filter(a=>!!a.health).length,downed:world.wildlife.animals.filter(a=>a.state==='downed').length,dead:world.wildlife.animals.filter(a=>a.state==='dead').length,eatenPlants:world.wildlife.eatenPlants,eatenNutrition:world.wildlife.eatenNutrition,eatenItems:world.wildlife.eatenItems,feeding:world.wildlife.animals.filter(a=>a.state==='eating').length,sleeping:world.wildlife.animals.filter(a=>a.state==='sleeping').length}:undefined,
    plantClimate:{slowed:plants.filter(p=>plantTemperatureFactor(temperatures.at(world,p))<1).length,thermalAnchors:plants.filter(p=>p.growthThermalFactor!==undefined).length},
    thermal:{outdoors:outdoorTemperature(world.tick),retainedCells:(world.thermal?.regions??[]).reduce((n,r)=>n+r.cells.length,0),temperatures:(world.thermal?.regions??[]).map(r=>r.temperature)},
    workplaces:world.structures.filter(s=>s.kind==='campfire'||s.kind==='stonecutter').map(s=>({id:s.id,kind:s.kind,role:env.room(s)?.role,...env.production(s,cookingSpot(s))})),
    lighting:world.pawns.map(p=>({id:p.id,cellLight:env.lightAt(p),cellFactor:env.speedAt(p),moving:p.motion!==null&&p.motion!==undefined&&p.motion.end>world.tick,travelFactor:p.motion?.speedFactor??1})),
  };
}

/** First observation, after designations are acknowledged: an ordinary player
 * asks one well-rested worker to get the first two nearby lots of building wood. */
export function playerFocusDecisions(world:World):Decision[] {
  if(world.tick>=250)return [];
  const pawn=world.pawns.find(p=>p.priorities.gather>0&&p.hunger>50&&p.rest>50&&!p.need&&p.orders.active===null&&!p.orders.queue.length&&!p.priorityWork);
  if(!pawn)return [];
  const orders:Decision[]=world.jobs.filter(j=>j.kind==='chop'&&j.reservedBy===null)
    .sort((a,b)=>Math.hypot(a.x-pawn.x,a.z-pawn.z)-Math.hypot(b.x-pawn.x,b.z-pawn.z)||a.id-b.id).slice(0,2)
    .map((job,index)=>({reason:'Prioriser les premiers lots de bois pour installer le camp.',command:{type:'order-job',pawnId:pawn.id,jobId:job.id,queue:index>0}}));
  const carrier=world.pawns.find(p=>p!==pawn&&p.priorities.haul>0&&p.hunger>50&&p.rest>50);
  if(carrier) {
    const blockedBed=world.jobs.find(j=>j.kind==='bed'&&queryOrderOptions(world,carrier.id,j).some(o=>o.enabled&&(o.label.startsWith('Couper la plante')||o.haulTarget?.type==='clear')));
    if(blockedBed) {
      const option=queryOrderOptions(world,carrier.id,blockedBed).find(o=>o.enabled&&(o.label.startsWith('Couper la plante')||o.haulTarget?.type==='clear'))!;
      orders.push({reason:'Dégager le couchage prioritaire.',command:option.haulTarget?{type:'order-haul',pawnId:carrier.id,target:option.haulTarget,queue:false}:{type:'order-job',pawnId:carrier.id,jobId:blockedBed.id,queue:false}});
    }
    const job=!blockedBed?world.jobs.find(j=>j.kind==='bed'&&planHaulOrder(world,carrier,{type:'job',jobId:j.id}).task):undefined;
    if(job)orders.push({reason:'Livrer en priorité le premier couchage.',command:{type:'order-haul',pawnId:carrier.id,target:{type:'job',jobId:job.id},queue:false}});
    const pile=world.piles.find(p=>p.kind==='food'&&p.owner.type==='ground'&&planHaulOrder(world,carrier,{type:'pile',pileId:p.id}).task);
    if(pile)orders.push({reason:'Ranger les rations après la livraison.',command:{type:'order-haul',pawnId:carrier.id,target:{type:'pile',pileId:pile.id},queue:!!job||!!blockedBed}});
  }
  return orders;
}

/** Deliberately ordinary, bounded player policy, not a perfect-play optimizer.
 * Reads visible colony state, never writes it or injects inventory/needs.
 * Both the fast simulation and the real UI journey execute these intentions.
 */
export function playerDecisions(world: World, options: { bulkMeals?: boolean } = {}): Decision[] {
  const colonists=world.pawns.filter(p=>isColonist(p)&&p.state!=='dead');
  if(world.raids?.active||world.raids?.last&&colonists.some(p=>p.draft))return raidDefenseDecisions(world);
  const cx = Math.floor(world.width / 2), cz = Math.floor(world.height / 2);
  const out: Decision[] = [...coolingDecisions(world),...powerDecisions(world),...textileDecisions(world),...huntingDecisions(world)];
  for(const s of world.structures)if((s.kind==='wall'||s.kind==='door')&&!world.home?.includes(s.z*world.width+s.x))out.push({reason:'Inclure les ouvrages du camp dans le foyer entretenu.',command:{type:'area',action:'home',from:{x:s.x,z:s.z},to:{x:s.x,z:s.z}}});
  if(world.arrivals?.pending)out.push({reason:'Accueillir une quatrième personne ; différer la croissance suivante pour stabiliser le camp.',command:{type:'answer-arrival',offerId:world.arrivals.pending.id,accept:colonists.length<4}});
  const gun=world.piles.find(p=>p.kind==='weapon'&&p.owner.type==='ground'),armed=world.piles.some(p=>p.owner.type==='equipment');
  const recruit=colonists[2];
  if(armed){
    const used=new Set<number>();
    for(const pawn of colonists){
      if(pawn.mental?.crisis||pawn.equipmentTask||pawn.orders.active!==null||pawn.need||pawn.hunger<50||pawn.rest<40)continue;
      const worn=world.piles.filter(i=>i.owner.type==='apparel'&&i.owner.pawnId===pawn.id);
      const wanted=pawn===recruit&&!worn.some(i=>i.item==='flak-vest')?'flak-vest':!worn.some(i=>i.item==='cloth-shirt'||i.item==='cloth-tribalwear')?'cloth-shirt':undefined;
      const garment=world.piles.find(i=>i.item===wanted&&i.owner.type==='ground'&&!used.has(i.id)&&queryOrderOptions(world,pawn.id,i.owner).some(o=>o.equipmentItemId===i.id&&o.enabled));
      if(garment){used.add(garment.id);out.push({reason:'Enfiler les vêtements du camp, avec gilet de protection pour la recrue armée.',command:{type:'order-equipment',pawnId:pawn.id,itemId:garment.id,action:'wear',queue:false}});}
    }
  }
  if(!armed&&gun&&recruit&&!recruit.equipmentTask&&recruit.orders.active===null&&queryOrderOptions(world,recruit.id,gun.owner as {x:number;z:number}).some(o=>o.equipmentItemId===gun.id&&o.enabled))
    out.push({reason:'Équiper le revolver initial avant de reprendre les travaux du camp.',command:{type:'order-equipment',pawnId:recruit.id,itemId:gun.id,action:'equip',queue:false}});
  for(const dx of [-1,1]){
    const x=cx+dx,z=cz+4;
    if(!world.stockpiles.some(s=>s.x===x&&s.z===z))out.push({reason:'Conserver les médicaments près des couchages, dans deux piles dédiées.',command:{type:'stockpile',x,z,enabled:true,filters:{wood:false,food:false,medicine:true},priority:2,capacity:25}});
  }
  // Ordinary player choice: the cook's night is shifted one hour earlier.
  // Keep eight intended sleep hours; actual rest still depends on bed and needs.
  if (world.structures.filter(s => s.kind === 'bed').length >= 3) {
    const cook = colonists[2];
    if (cook) for (const [hour, assignment] of [[5, 'anything'], [21, 'sleep']] as const) if (cook.schedule[hour] !== assignment)
      out.push({reason: 'Décaler le sommeil de la cuisinière pour préparer le matin.', command: {type: 'schedule-paint', pawnId: cook.id, hours: [hour], assignment}});
  }
  // Visible personality informs a normal preventive choice, never a need injection.
  for(const p of colonists)if(p.traits?.includes('nervous')&&p.schedule[20]!=='recreation')out.push({reason:'Prévoir une heure de loisirs avant la nuit pour le colon nerveux.',command:{type:'schedule-paint',pawnId:p.id,hours:[20],assignment:'recreation'}});
  const priorities = [{ craft:3, mine:2, gather: 1, build: 3, haul: 2, grow: 2, cook:3 }, { craft:2, mine:2, gather: 3, build: 1, haul: 2, grow: 3, cook:3 }, { craft:3, mine:3, gather: 2, build: 3, haul: 2, grow: 2, cook:1 }] as const;
  const builder=colonists.reduce((best,p)=>!best||(p.skills.construction.level>best.skills.construction.level||p.skills.construction.level===best.skills.construction.level&&learningFactor(p.skills.construction,p)>learningFactor(best.skills.construction,best))?p:best,colonists[0]);
  colonists.forEach((pawn, i) => {
    for (const work of ['gather', 'build', 'haul', 'grow','cook','craft','mine'] as const) if (pawn.priorities[work] !== (work==='build'?(pawn===builder?1:3):priorities[i % 3]![work])) {
      out.push({ reason: 'Affecter le meilleur bâtisseur selon sa compétence, départager par apprentissage et répartir les autres travaux.', command: { type: 'priority', pawnId: pawn.id, work, value: work==='build'?(pawn===builder?1:3):priorities[i % 3]![work] } });
    }
  });
  const plans: DesignateCommand[] = [
    ...[[-3, 2], [0, 2], [3, 2]].map(([x, z]) => ({ type: 'designate' as const, kind: 'bed' as const, x: cx + x!, z: cz + z!, orientation: 0 as const })),
    ...colonists.slice(3).map((_,i)=>({type:'designate' as const,kind:'bed' as const,x:cx-3+(i%3)*3,z:cz+6+Math.floor(i/3)*3,orientation:0 as const})),
    { type: 'designate', kind: 'table', x: cx, z: cz - 2, orientation: 1 },
    { type:'designate',kind:'horseshoes',x:cx+2,z:cz-3 },
    { type:'designate',kind:'campfire',x:cx-1,z:cz-1,orientation:0 },
    ...[[0, -3], [1, -3], [0, -1]].map(([x, z]) => ({ type: 'designate' as const, kind: 'stool' as const, x: cx + x!, z: cz + z! })),
    ...[-3, 3].flatMap(x => [-3, -2, -1].map(z => ({ type: 'designate' as const, kind: 'wall' as const, x: cx + x, z: cz + z }))),
  ];
  if(world.tick>=6000)plans.push({type:'designate',kind:'door',material:'wood',x:cx-3,z:cz,orientation:0});
  if(world.deconstructed.count===0) {
    const temporary={type:'designate' as const,kind:'wall' as const,x:cx+4,z:cz-1};
    if(world.structures.some(s=>s.x===temporary.x&&s.z===temporary.z)&&world.tick>=6000) {
      if(canDesignate(world,{...temporary,kind:'deconstruct'}).ok)out.push({reason:'Ouvrir le passage du camp après la première journée.',command:{...temporary,kind:'deconstruct'}});
    } else plans.push(temporary);
  }
  const pin=world.structures.find(s=>s.kind==='horseshoes'&&s.x===cx+2&&s.z===cz-3);
  if(world.tick>=6000) {
    const storage={x:cx+4,z:cz};
    if(!world.stockpiles.some(s=>s.x===storage.x&&s.z===storage.z))out.push({reason:'Préparer une réserve pour les meubles retirés.',command:{type:'stockpile',...storage,enabled:true,filters:{wood:false,food:false,furniture:true},priority:2,capacity:1}});
    if(pin){const c={type:'designate' as const,kind:'uninstall' as const,x:pin.x,z:pin.z};if(canDesignate(world,c).ok)out.push({reason:'Retirer le jeu pour réorganiser le camp.',command:c});}
    const stored=world.packed.find(p=>p.building.kind==='horseshoes'&&p.owner.type==='ground'&&p.owner.x===storage.x&&p.owner.z===storage.z);
    if(stored){const c={type:'install' as const,structureId:stored.building.id,x:cx+4,z:cz-3,orientation:0 as const};if(installCommand(world,c,true).ok)out.push({reason:'Réinstaller le piquet après son rangement en réserve.',command:c});}
  }
  for (const plan of plans) {
    if(plan.kind==='horseshoes'&&(world.structures.some(s=>s.kind==='horseshoes')||world.packed.some(p=>p.building.kind==='horseshoes')))continue;
    // Beds first, dining next, then an open windbreak. No claim of a roofed room.
    if (plan.kind !== 'bed' && world.structures.filter(s => s.kind === 'bed').length < 3) continue;
    if (plan.kind === 'wall' && world.structures.filter(s => s.kind === 'stool').length < 3) continue;
    if (canDesignate(world, plan).ok) out.push({ reason: 'Aménager progressivement le camp sans fermer son passage central.', command: plan });
  }
  for (const [dx, dz, food] of [[-2, 0, false], [-2, 1, false], [2, 1, true], [2, 0, true], [2, -1, true],[-1,1,true],[0,1,true],[1,1,true]] as const) {
    const x = cx + dx, z = cz + dz;
    if (!world.stockpiles.some(s => s.x === x && s.z === z)) out.push({ reason: 'Séparer le bois et les aliments près du camp.', command: { type: 'stockpile', x, z, enabled: true, filters: { wood: !food, food }, priority: 2, capacity: 75 } });
  }
  const ingredientSeat=world.structures.find(s=>s.kind==='stool'&&s.x===cx&&s.z===cz-1);
  if(ingredientSeat&&!world.stockpiles.some(z=>z.x===ingredientSeat.x&&z.z===ingredientSeat.z))out.push({reason:'Garder une petite réserve alimentaire sur le tabouret près du feu.',command:{type:'stockpile',x:ingredientSeat.x,z:ingredientSeat.z,enabled:true,filters:{wood:false,food:true},priority:2,capacity:75}});
  for(const fire of world.structures.filter(s=>s.kind==='campfire')) {
    if(!options.bulkMeals) {
      const bill=fire.bills?.[0];
      if(!bill)out.push({reason:'Installer une première recette de repas simple au feu de camp.',command:{type:'bill-add',structureId:fire.id}});
      else if(bill.mode!=='until'||bill.target!==colonists.length*2)out.push({reason:'Maintenir environ deux repas préparés par colon en réserve.',command:{type:'bill-update',structureId:fire.id,billId:bill.id,settings:{...bill,mode:'until',target:colonists.length*2}}});
      else if(!world.piles.some(p=>p.item==='simple-meal')) {
        const cook=colonists.find(p=>p.priorities.cook>0&&p.hunger>35&&p.rest>35&&!p.cooking&&!p.haul&&!p.need&&p.jobId===null&&p.orders.active===null&&!p.orders.queue.length&&!p.priorityWork&&planCookingOrder(world,p,fire.id).order);
        if(cook)out.push({reason:'Prioriser un repas quand la réserve de repas préparés est vide.',command:{type:'order-cook',pawnId:cook.id,structureId:fire.id,queue:false}});
      }
      continue;
    }
    const bills=fire.bills??[],bulk=bills.find(b=>b.recipe==='cook-simple-meal-bulk'),single=bills.find(b=>b.recipe==='simple-meal');
    // A new fire receives x4 first. On a resumed fire, bill-move changes only
    // priority and leaves every active or queued cooking task untouched.
    if(!bulk)out.push({reason:'Prévoir quatre repas simples lorsque les quarante ingrédients sont accessibles.',command:{type:'bill-add',structureId:fire.id,recipe:'cook-simple-meal-bulk'}});
    if(!single)out.push({reason:'Garder une cuisson unitaire de secours lorsque le lot de quatre est impossible.',command:{type:'bill-add',structureId:fire.id,recipe:'simple-meal'}});
    if(bulk)for(let index=bills.indexOf(bulk);index>0;index--)
      out.push({reason:'Donner priorité au lot de quatre sans interrompre la cuisson en cours.',command:{type:'bill-move',structureId:fire.id,billId:bulk.id,direction:-1}});
    const target=colonists.length*2;
    for(const bill of [bulk,single])if(bill) {
      const inputs=PRODUCTION_RECIPES[bill.recipe].inputs;
      const complete=inputs.every(item=>typeof bill.filters[item]==='boolean');
      const engaged=world.pawns.some(p=>p.cooking?.stationId===fire.id&&p.cooking.billId===bill.id
        ||p.orders.queue.some(o=>isCookingOrder(o)&&o.cooking.stationId===fire.id&&o.cooking.billId===bill.id));
      // bill-update releases active work in the simulation, so wait until it
      // finishes even when the only missing setting is the target count.
      if(!engaged&&(bill.mode!=='until'||bill.target!==target||!complete))
        out.push({reason:'Maintenir le même nombre de portions par les deux factures et leurs filtres complets.',command:{type:'bill-update',structureId:fire.id,billId:bill.id,settings:{mode:'until',target,suspended:bill.suspended,filters:Object.fromEntries(inputs.map(item=>[item,bill.filters[item]??true])),radius:bill.radius,destination:bill.destination}}});
    }
    // Let the normal planner select x4 when possible and fall through to the
    // unit bill when fewer than forty usable units can be reserved. A direct
    // order is only sent to an idle cook, never over another active task.
    if(bulk&&single&&bills[0]===bulk&&!world.piles.some(p=>p.item==='simple-meal')) {
      const cook=colonists.find(p=>p.state==='idle'&&p.priorities.cook>0&&p.hunger>35&&p.rest>35&&!p.cooking&&!p.haul&&!p.need&&p.jobId===null&&p.orders.active===null&&!p.orders.queue.length&&!p.priorityWork&&planCookingOrder(world,p,fire.id).order);
      if(cook)out.push({reason:'Prioriser une cuisson réalisable lorsque la réserve de repas préparés est vide.',command:{type:'order-cook',pawnId:cook.id,structureId:fire.id,queue:false}});
    }
  }
  if (!world.growingZones.length && world.structures.filter(s => s.kind === 'bed').length === 3) out.push({reason:'Semer un premier potager près du camp, tout en continuant à cueillir pendant sa croissance.',command:{type:'area',action:'growing',from:{x:cx-2,z:cz+5},to:{x:cx+2,z:cz+7}}});
  for(const pawn of colonists)if(pawn.schedule[19]!=='recreation'||pawn.schedule[20]!=='recreation')out.push({reason:'Réserver une plage de loisirs du soir, sans remplacer le repos nocturne.',command:{type:'schedule-paint',pawnId:pawn.id,hours:[19,20],assignment:'recreation'}});
  // Prepare the workshop after the first actual steel extraction, without
  // granting material or replacing the camp's food/bed priorities.
  if(world.tick>=6000&&world.piles.some(p=>p.item==='steel'&&p.quantity>=30)&&!world.structures.some(s=>s.kind==='stonecutter')&&!world.jobs.some(j=>j.kind==='stonecutter')&&!world.packed.some(p=>p.building.kind==='stonecutter')) {
    for(let dz=-4;dz<=4;dz++) {
      const command={type:'designate',kind:'stonecutter',material:'wood',x:cx-6,z:cz+dz,orientation:0} as const;
      if(canDesignate(world,command).ok){out.push({reason:'Préparer un atelier de taille avec le bois du camp et l’acier extrait.',command});break;}
    }
  }
  const outstandingWood = [...world.jobs, ...out.flatMap(d => d.command.type === 'designate' ? [{...d.command,material:d.command.kind==='butcher-spot'||d.command.kind==='crafting-spot'?undefined:d.command.kind in STRUCTURE_DEFINITIONS?d.command.material??'wood' as const:undefined}] : [])].reduce((n,j) => n + requiredMaterial(j,'wood'), 0);
  // New plans can overlap trees: their builder will clear the footprint. Do not
  // queue a second gathering order there in the same batch of player commands.
  const newlyPlanned=new Set(out.flatMap(d=>d.command.type==='designate'?footprintCells(d.command).map(c=>c.z*world.width+c.x):[]));
  const nearby = [...world.resources].filter(r => Math.abs(r.x-cx) + Math.abs(r.z-cz) <= 28).sort((a,b) => Math.abs(a.x-cx)+Math.abs(a.z-cz)-(Math.abs(b.x-cx)+Math.abs(b.z-cz)) || a.id-b.id);
  const prepared=world.piles.filter(p=>p.item==='simple-meal').reduce((n,p)=>n+p.quantity,0);
  const ingredients=world.piles.filter(p=>p.item==='rice'||p.item==='berries'||p.item==='hare-meat').reduce((n,p)=>n+p.quantity,0);
  // Preserve travel rations once cooking provides a buffer; lift the restriction
  // if that buffer runs out. This is a player decision, never a hunger override.
  const nutritionWithoutRations=world.piles.reduce((n,p)=>n+(p.item==='simple-meal' ? p.quantity*.9 : p.item==='berries'||p.item==='rice'||p.item==='hare-meat' ? p.quantity*.05 : 0),0);
  const reserveRations=prepared>=colonists.length*2;
  for(const pawn of colonists) {
    const policyId=reserveRations?3:nutritionWithoutRations<colonists.length*.8?1:pawn.foodPolicyId;
    if(pawn.foodPolicyId!==policyId)out.push({reason:policyId===3?'Conserver les rations de voyage tant que la cuisine assure les repas.':'Autoriser les rations de secours lorsque la réserve fraîche baisse.',command:{type:'food-policy-assign',pawnId:pawn.id,policyId}});
  }
  const cookingDemand=world.structures.some(s=>s.kind==='campfire')?Math.max(0,(colonists.length*2-prepared)*10-ingredients):0;
  for (const [kind, required] of [['tree', Math.max(40, outstandingWood + 20) - world.stock.wood], ['berries', Math.max(cookingDemand,(colonists.length * 1.6 - availableNutrition(world)) * (world.foodRules === 'legacy' ? 100 / 35 : 20))]] as const) {
    const action = kind === 'tree' ? 'chop' : 'harvest';
    let planned = nearby.filter(r => r.kind === kind && world.jobs.some(j => j.x === r.x && j.z === r.z)).reduce((n,r) => n+r.amount,0);
    for (const resource of nearby) {
      if (resource.kind !== kind || newlyPlanned.has(resource.z*world.width+resource.x) || (kind === 'berries' && plantGrowth(world,resource) < 1) || planned >= required) continue;
      const command: DesignateCommand = { type: 'designate', kind: action, x: resource.x, z: resource.z };
      if (canDesignate(world, command).ok) { out.push({ reason: kind === 'tree' ? 'Prévoir le bois des chantiers et une petite marge.' : 'Renouveler la réserve alimentaire avant la pénurie.', command }); planned += resource.amount; }
    }
  }
  out.push(...miningDecisions(world),...componentDecisions(world),...stonecuttingDecisions(world),...roofingDecisions(world));
  return out;
}

export function colonySummary(world: World) {
  const fields=new Set(world.growingZones.flatMap(z=>z.cells));
  const occupied=new Map<number,number>();
  for(const p of world.pawns){const cell=p.z*world.width+p.x;occupied.set(cell,(occupied.get(cell)??0)+1);}
  return { textile:{plants:world.resources.filter(r=>r.kind==='cotton').length,fields:world.growingZones.filter(z=>z.plant==='cotton').length,cloth:world.piles.reduce((n,p)=>n+(p.item==='cloth'?p.quantity:0),0)},barriers:{destroyed:world.destroyed??null,damaged:world.structures.filter(s=>s.damage).map(s=>({id:s.id,damage:s.damage})),homeCells:world.home?.length??0},tick: world.tick, foodPolicies: world.pawns.map(p=>p.foodPolicyId), restRules: world.restRules, scheduledSleepHours: world.pawns.map(p=>p.schedule.filter(s=>s==='sleep').length), spoiled: { ...world.spoiled }, crops: world.resources.filter(r=>r.kind==='rice').length, growingCells:fields.size,
    power:world.structures.filter(s=>s.power).map(s=>({kind:s.kind,on:s.power!.on,parent:s.power!.parentId,fuel:s.fuel?.ticks??null})),
    mining:{componentsInBuildings:world.structures.reduce((n,s)=>n+requiredMaterial(s,'component'),0),components:world.piles.reduce((n,p)=>n+(p.item==='component'?p.quantity:0),0),componentsStored:world.piles.reduce((n,p)=>n+(p.item==='component'&&p.owner.type==='ground'&&world.stockpiles.some(s=>s.filters.component&&p.owner.type==='ground'&&s.x===p.owner.x&&s.z===p.owner.z)?p.quantity:0),0),blocks:world.piles.reduce((n,p)=>n+(p.kind==='blocks'?p.quantity:0),0),blocksStored:world.piles.reduce((n,p)=>n+(p.kind==='blocks'&&p.owner.type==='ground'&&world.stockpiles.some(s=>s.filters.blocks&&p.owner.type==='ground'&&s.x===p.owner.x&&s.z===p.owner.z)?p.quantity:0),0),steelInBuildings:world.structures.reduce((n,s)=>n+requiredMaterial(s,'steel'),0),steel:world.piles.reduce((n,p)=>n+(p.item==='steel'?p.quantity:0),0),steelStored:world.piles.reduce((n,p)=>n+(p.item==='steel'&&p.owner.type==='ground'&&world.stockpiles.some(s=>s.filters.steel&&p.owner.type==='ground'&&s.x===p.owner.x&&s.z===p.owner.z)?p.quantity:0),0),cells:world.tiles.filter(t=>t.terrain==='rough-stone').length,chunks:world.piles.filter(p=>p.kind==='chunk').length,stored:world.piles.filter(p=>p.kind==='chunk'&&p.owner.type==='ground'&&world.stockpiles.some(s=>s.filters.chunk&&p.owner.type==='ground'&&s.x===p.owner.x&&s.z===p.owner.z)).length},
    mood:world.pawns.map(p=>{const thoughts=moodThoughts(world,p);return {id:p.id,level:p.mood,target:moodTarget(thoughts),frozen:moodFrozen(p),crisis:p.mental?.crisis??null,exposure:p.mental?.below??[0,0,0],causes:thoughts.map(t=>({id:t.id,offset:t.offset,expiresAt:t.expiresAt}))};}),
    recreation:world.pawns.map(p=>({level:p.recreation.level,tolerance:{...p.recreation.tolerance},bored:{...p.recreation.bored}})),
    apparel:world.piles.filter(p=>p.kind==='apparel').map(p=>({id:p.id,item:p.item,owner:p.owner,apparel:p.apparel})),
    equipment:world.piles.filter(p=>p.kind==='weapon').map(p=>({id:p.id,item:p.item,owner:p.owner,weapon:p.weapon})),
    medicalBeds:world.structures.filter(s=>s.kind==='bed'&&s.medical).length,
    medicines:{total:world.piles.reduce((n,p)=>n+(p.kind==='medicine'?p.quantity:0),0),stored:world.piles.reduce((n,p)=>n+(p.kind==='medicine'&&p.owner.type==='ground'&&world.stockpiles.some(s=>s.filters.medicine&&p.owner.type==='ground'&&s.x===p.owner.x&&s.z===p.owner.z)?p.quantity:0),0),policies:world.pawns.map(p=>p.medicalCare??'dry')},
    health:world.pawns.map(p=>({id:p.id,state:p.state,rescue:p.rescue??null,tend:p.tend??null,feed:p.feed??null,hunger:p.hunger,medicalRest:p.need?.kind==='sleep'?p.need.medical??null:null,treated:p.health?.injuries.filter(i=>i.tended!==undefined).length??0,medicineXp:p.skills.medicine.xp,bedUse:p.need?.kind==='sleep'?p.need.bedId:null,injuries:p.health?.injuries.length??0,gunshots:p.health?.injuries.filter(i=>i.kind==='gunshot').length??0,missing:p.health?.missing.length??0,bloodLoss:p.health?.bloodLoss??0})),
    social:world.pawns.map(p=>({id:p.id,skill:p.skills.social??null,last:p.social?.last??null,opinions:world.pawns.filter(q=>q!==p).map(q=>({id:q.id,value:opinionOf(p,q.id,world.tick)}))})),
    personality:world.pawns.map(p=>({id:p.id,traits:p.traits??[],learning:globalLearningFactor(p),breakThresholds:breakThresholds(p)})),
    skills:world.pawns.map(p=>({id:p.id,...structuredClone(p.skills)})),
    combat:{shooters:world.pawns.filter(p=>p.shooting?.order).length,flights:world.projectiles?.filter(p=>!p.arrival).length??0,impacts:world.projectiles?.filter(p=>p.arrival?.effect==='pawn').length??0},
    interruptedCargo:world.pawns.filter(p=>p.interruptedCargo).map(p=>({id:p.id,state:p.state,pile:world.piles.find(q=>q.owner.type==='pawn'&&q.owner.pawnId===p.id)?.id??null,furniture:world.packed.find(q=>q.owner.type==='pawn'&&q.owner.pawnId===p.id)?.building.id??null})),
    furnitureTransit:world.pawns.filter(p=>p.motion&&p.motion.end>world.tick&&(p.motion.terrainDelay??0)>0).length,
    furnitureExits:world.pawns.filter(p=>p.transitExit).length,
    roofing:{constructed:world.roofing?.constructed.length??0,planned:world.roofing?.build.length??0,removal:world.roofing?.remove.length??0},
    ...environmentSummary(world),
    sharedPawnCells:[...occupied.values()].filter(count=>count>1).length,
    playerOrders:world.pawns.map(p=>({active:p.orders.active,queued:p.orders.queue.length,priority:p.priorityWork??null})),
    obstructedGrowingCells:world.piles.filter(p=>p.owner.type==='ground'&&fields.has(p.owner.z*world.width+p.owner.x)).length,
    clearing:world.pawns.filter(p=>p.haul?.destination.type==='aside').length,
    construction: {blueprints:world.jobs.filter(j=>j.construction==='blueprint').length,frames:world.jobs.filter(j=>j.construction==='frame').length,clearingPlants:world.jobs.filter(j=>j.clearance).length,clearingPiles:world.pawns.filter(p=>p.haul?.destination.type==='aside'&&p.haul.destination.constructionId!==undefined).length},
    structures: Object.fromEntries(['wood-generator','standing-lamp','passive-cooler','bed','table','stool','wall','campfire','horseshoes','stonecutter','door'].map(kind => [kind,world.structures.filter(s=>s.kind===kind).length])), preparedMeals:world.piles.filter(p=>p.item==='simple-meal').reduce((n,p)=>n+p.quantity,0), stock: { ...world.stock }, pending: world.jobs.length, minimumFood: Math.min(...world.pawns.map(p=>p.hunger)), minimumRest: Math.min(...world.pawns.map(p=>p.rest)) };
}

export {woodAccount} from './wood-account.ts';
export function foodAccount(world: World): number {
  // Produced units remain accounted for even after spoilage; this is a ledger,
  // not the edible stock used by the player's decisions. Subtract the separate
  // animal-to-food producer so existing balances compare initial food + harvest;
  // this does not remove losses, consumption or the 10-to-1 recipe transform.
  return world.piles.filter(p=>{
    // An orbital trader's stock belongs to the ship, not to the colony.
    if(p.kind!=='food'||p.owner.type==='orbital-ship') return false;
    const owner=p.owner;
    return !('pawnId' in owner)||!!world.pawns.find(q=>q.id===owner.pawnId&&isColonist(q));
  }).reduce((n,p)=>n+p.quantity,0) + spoiledUnits(world) - (world.butchery?.meat??0);
}

/** A first look around the landing site, then return before building the camp. */
export function playerArrivalDecisions(world:World):Decision[] {
  const p=world.pawns[0]!;
  return [
    {reason:'Mobiliser un colon pour reconnaître le terrain proche.',command:{type:'draft',pawnIds:[p.id],enabled:true}},
    {reason:'Marcher à proximité du camp.',command:{type:'draft-move',pawnIds:[p.id],target:{x:p.x+2,z:p.z+1},queue:false}},
    {reason:'Revenir au camp par un ordre en file.',command:{type:'draft-move',pawnIds:[p.id],target:{x:p.x,z:p.z},queue:true}},
  ];
}
export function playerArrivalComplete(world:World):boolean {
  const p=world.pawns[0]!,d=p.draft;
  return !!d?.target&&!d.queue.length&&p.moveCooldown===0&&p.x===d.target.x&&p.z===d.target.z;
}
