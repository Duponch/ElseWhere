import { createWoodLedger,trackWoodStep,conservedWood } from './scenarios/wood-conservation.ts';
import { writeTestFileSync } from './test-output.ts';
import { createSimpleMealLedger, observeSimpleMealLedger } from './scenarios/simple-meal-ledger.ts';
import { enableWildlife } from '../src/sim/wildlife';
import { wildlifePopulationAccount } from './scenarios/hunting-player';

import { enableArrivals } from '../src/sim/arrivals';
import { expect, test, onTestFailed } from 'vitest';
import { createWorld, applyCommand, stepWorld, validateWorld, serializeWorld, deserializeWorld } from '../src/sim/index';
import { activeSocialFight } from '../src/sim/social-fight.ts';
import { FEED_TICKS } from '../src/sim/feeding-rules.ts';
import { medicalStatus } from '../src/sim/injury-state.ts';
import { playerArrivalDecisions,playerArrivalComplete,playerDecisions, playerFocusDecisions, colonySummary, foodAccount } from './scenarios/colony-player';
import { campChunks, campChunkNeedsHaul } from './scenarios/mining-player';
import { completedStoneOpenings, emptyStoneAmounts, pendingStoneOpenings, stoneMatter } from './scenarios/stone-balance';
import { STONE_KINDS } from '../src/sim/geology.ts';
import { storageAccepts } from '../src/sim/storage-filters.ts';

const SOCIAL_MELEE_INJURIES=new Set(['bruise','crack','crush','bite','cut','stab']);

test.each([42,93,2048])('joueur ordinaire : cinq à huit jours, graine %i, camp construit, stocks entretenus et reprise exacte', (seed) => {
  const version=process.env.VALIDATION_VERSION??'v74';
    let world = createWorld(seed, 250, 250);
    onTestFailed(()=>writeTestFileSync(`tmp/colony-failed-${version}-${seed}.json`,JSON.stringify(world)));
    if(seed===42)enableArrivals(world);
    if(seed===93)enableWildlife(world);
    const population=seed===42?4:3;
    for(const decision of playerArrivalDecisions(world))expect(applyCommand(world,decision.command)).toMatchObject({ok:true});
    for(let i=0;i<120&&!playerArrivalComplete(world);i++)stepWorld(world);
    expect(playerArrivalComplete(world)).toBe(true);expect(validateWorld(world)).toEqual([]);
    expect(applyCommand(world,{type:'draft',pawnIds:[world.pawns[0]!.id],enabled:false})).toMatchObject({ok:true});
    const initialWeapon=structuredClone(world.piles.find(p=>p.kind==='weapon')!);
    const woodLedger=createWoodLedger();const initialWood = conservedWood(world,woodLedger), initialFood = foodAccount(world);
    const initialMedicine=world.piles.filter(p=>p.kind==='medicine').reduce((n,p)=>n+p.quantity,0);
    let stoneAtLastCheck=stoneMatter(world);
    const openingsSinceCheck=emptyStoneAmounts(),inferredYields=emptyStoneAmounts();
    const stoneOpenings:{tick:number;stone:typeof STONE_KINDS[number]}[]=[];
    const checkStoneMatter=()=>{
      const now=stoneMatter(world);
      for(const stone of STONE_KINDS){
        const delta=now[stone]-stoneAtLastCheck[stone],context=JSON.stringify({seed,tick:world.tick,stone,before:stoneAtLastCheck[stone],after:now[stone],openings:openingsSinceCheck[stone]});
        expect(delta,context).toBeGreaterThanOrEqual(0);
        expect(delta,context).toBeLessThanOrEqual(20*openingsSinceCheck[stone]);
        expect(delta%20,context).toBe(0);
        inferredYields[stone]+=delta/20;
        openingsSinceCheck[stone]=0;
      }
      stoneAtLastCheck=now;
    };
    let consumed = 0, produced = 0, rationAssignments = 0, medicineUsed=0;
    const cookingLedger=createSimpleMealLedger(world.events);
    onTestFailed(()=>writeTestFileSync(`tmp/colony-ledger-failed-${version}-${seed}.json`,JSON.stringify({tick:world.tick,initialFood,consumed,produced,woodLedger,cooking:cookingLedger})));
    const recreationKinds=new Set<string>(), recreationPawns=new Set<number>();
    const meals = new Map(world.pawns.map(p=>[p.id,0])), sleep = new Map(world.pawns.map(p=>[p.id,0])), medicalBedRest=new Map(world.pawns.map(p=>[p.id,0]));
    const socialInjuries=new Map<number,Map<number,number>>();
    const temporarilyDowned=new Map<number,Set<number>>();
    const report: ReturnType<typeof colonySummary>[] = [];
    for (let t = 0; t < (seed === 42 ? 48000 : 30000); t++) {
      // Seed 42 also exercises the browser player's four-hour observation cadence.
      if (t % (seed===42?1000:250) === 0) for (const decision of playerDecisions(world,{bulkMeals:true})) {
        expect(applyCommand(world, decision.command), JSON.stringify({seed,t,decision})).toMatchObject({ok:true});
        if(decision.command.type==='food-policy-assign'&&decision.command.policyId===3)rationAssignments++;
      }
      if(t===0)for(const decision of playerFocusDecisions(world))expect(applyCommand(world,decision.command)).toMatchObject({ok:true});
      const ingesting = world.pawns.filter(p=>p.need?.kind==='eat' && p.need.phase==='ingest' && p.need.progress===49).map(p=>({id:p.id,quantity:p.need?.kind==='eat'?p.need.quantity:0}));
      const assistedIngesting=world.pawns.filter(p=>p.feed?.phase==='feed'&&p.feed.progress===FEED_TICKS-1).map(p=>({doctorId:p.id,patientId:p.feed!.patientId,quantity:p.feed!.quantity}));
      const socialOpponents=new Map<number,number>();
      for(const pawn of world.pawns){const opponentId=pawn.social?.fight?.opponentId;if(opponentId!==undefined&&activeSocialFight(world,pawn,opponentId))socialOpponents.set(pawn.id,opponentId);}
      const injuriesBefore=new Map(world.pawns.map(p=>[p.id,new Map(p.health?.injuries.map(i=>[i.id,{bornAt:i.bornAt,severity:i.severity}])??[])]));

      const moods=world.pawns.map(p=>p.mood);
      const possibleStoneOpenings=pendingStoneOpenings(world);
      trackWoodStep(world,woodLedger,()=>stepWorld(world));
      for(const stone of completedStoneOpenings(world,possibleStoneOpenings)){
        openingsSinceCheck[stone]++;
        stoneOpenings.push({tick:world.tick,stone});
      }
      for(const pawn of world.pawns)for(const injury of pawn.health?.injuries??[]){
        const previous=injuriesBefore.get(pawn.id)?.get(injury.id);
        if(previous?.bornAt===injury.bornAt&&previous.severity>=injury.severity)continue;
        const currentOpponent=pawn.social?.fight?.opponentId;
        const opponentId=socialOpponents.get(pawn.id)??(currentOpponent!==undefined&&activeSocialFight(world,pawn,currentOpponent)?currentOpponent:undefined);
        const strike=world.pawns.find(p=>p.id===opponentId)?.melee?.strike;
        const socialImpact=opponentId!==undefined&&strike?.targetId===pawn.id&&strike.outcome==='hit'
          &&Math.ceil(strike.atCore/10)===world.tick
          &&SOCIAL_MELEE_INJURIES.has(injury.kind);
        expect(socialImpact,JSON.stringify({seed,tick:world.tick,pawn:pawn.id,injury,opponentId,strike})).toBe(true);
        let allowed=socialInjuries.get(pawn.id);if(!allowed){allowed=new Map();socialInjuries.set(pawn.id,allowed);}allowed.set(injury.id,injury.bornAt);
      }
      // Mood moves toward its target at 12 (rise) / 8 (fall) per hour. From schema 301
      // it is updated as RimWorld's need interval: once per 150 Core ticks, 15 local
      // ticks at once (wellbeingLocalTicks); before, every local tick.
      const moodSteps=Number(world.schemaVersion)>=301?15:1;
      for(const [i,p] of world.pawns.entries())if(p.mood-moods[i]!>.04800001*moodSteps||p.mood-moods[i]!<-.03200001*moodSteps)throw new Error(`Mood discontinuity: seed ${seed}, tick ${world.tick}, pawn ${p.id}, ${moods[i]} -> ${p.mood}`);
      for (const event of world.events) if (event.tick === world.tick) { const match = event.message.match(/a récolté (\d+) (?:baies|riz)/); if (match) produced += Number(match[1]);if(event.message.includes(' a traité ')&&event.message.endsWith('avec Médicaments.'))medicineUsed++; }
      observeSimpleMealLedger(cookingLedger,world.events.filter(e=>e.tick===world.tick));
      for (const {id,quantity} of ingesting) if(world.events.some(e=>e.tick===world.tick&&e.message.startsWith(`${world.pawns.find(p=>p.id===id)!.name} a mangé`)&&!e.message.includes('avec l’aide'))) { meals.set(id, (meals.get(id)??0)+1); consumed += quantity; }
      const feedingEvents=world.events.filter(e=>e.tick===world.tick&&e.message.includes('avec l’aide'));
      for (const {doctorId,patientId,quantity} of assistedIngesting){
        const patient=world.pawns.find(p=>p.id===patientId)!,doctor=world.pawns.find(p=>p.id===doctorId)!;
        const eventIndex=feedingEvents.findIndex(e=>e.message.startsWith(`${patient.name} a mangé une portion (${quantity} × `)&&e.message.endsWith(`avec l’aide de ${doctor.name}.`));
        if(eventIndex>=0){feedingEvents.splice(eventIndex,1);meals.set(patientId,(meals.get(patientId)??0)+1);consumed+=quantity;}
      }
      for (const pawn of world.pawns) if (pawn.state==='sleeping' && pawn.need?.kind==='sleep' && pawn.need.bedId!==null) sleep.set(pawn.id,(sleep.get(pawn.id)??0)+1);
      for (const pawn of world.pawns) if (pawn.state==='resting' && pawn.need?.kind==='sleep' && pawn.need.bedId!==null && pawn.need.medical) medicalBedRest.set(pawn.id,(medicalBedRest.get(pawn.id)??0)+1);
      for(const pawn of world.pawns)if(pawn.state==='recreating'&&pawn.recreation.task){recreationKinds.add(pawn.recreation.task.activity);recreationPawns.add(pawn.id);}
      if (t % 50 === 0) {
        checkStoneMatter();
        const context=JSON.stringify({seed,...colonySummary(world)});
        expect(world.piles.filter(p=>p.kind==='weapon')).toHaveLength(1);expect(world.piles.find(p=>p.id===initialWeapon.id)?.weapon).toEqual(initialWeapon.weapon);
        if(t>=250)expect(world.piles.find(p=>p.id===initialWeapon.id)?.owner.type).toBe('equipment');
        expect(validateWorld(world),context).toEqual([]);expect(conservedWood(world,woodLedger),context).toBe(initialWood);
        expect(foodAccount(world)+consumed+cookingLedger.totals.unitDelta+(world.wildlife?.eatenItems??0),context).toBe(initialFood+produced);
        expect(world.pawns.every(p=>p.hunger>0 && p.rest>0),context).toBe(true);
        expect(world.pawns.every(p=>{
          const woundsAreSocial=(p.health?.injuries??[]).every(i=>socialInjuries.get(p.id)?.get(i.id)===i.bornAt);
          const poisoningCausedDowning=p.state==='downed'&&!!p.health?.foodPoisoning?.severity&&p.health.injuries.length>0
            &&woundsAreSocial&&medicalStatus(p.health)==='downed'
            &&medicalStatus({...p.health,foodPoisoning:undefined})==='mobile';
          if(poisoningCausedDowning){
            let episodes=temporarilyDowned.get(p.id);if(!episodes){episodes=new Set();temporarilyDowned.set(p.id,episodes);}
            episodes.add(p.health!.foodPoisoning!.bornAt);
          }
          return p.state!=='dead'&&!p.health?.death&&!p.health?.missing.length&&woundsAreSocial
            &&(p.state!=='downed'||poisoningCausedDowning);
        }),context).toBe(true);
        // Hunting may fire, but the ordinary player never targets its settlers.
        expect(world.pawns.every(p=>!p.shooting?.order||p.shooting.order.hunt===true),context).toBe(true);
        expect((world.projectiles??[]).every(p=>p.flight.intendedKey?.startsWith('animal:')&&p.arrival?.effect!=='pawn'),context).toBe(true);
      }
      if (world.tick % 6000 === 0) {
        if(process.env.COLONY_PROGRESS==='1')console.info(`Colony ${seed}: day ${world.tick/6000}, ${world.jobs.length} pending jobs`);
        report.push(colonySummary(world));
        for(const workplace of report.at(-1)!.workplaces) {
          expect(workplace.total).toBeGreaterThanOrEqual(.32);expect(workplace.total).toBeLessThanOrEqual(1);
          const fire=world.structures.find(s=>s.id===workplace.id);
          if(fire?.kind==='campfire'&&fire.fuel!.ticks>0)expect(workplace.lighting).toBe(1);
        }
        const saved=serializeWorld(world), resumed=deserializeWorld(saved);
        stepWorld(world,250);stepWorld(resumed,250);
        expect(serializeWorld(resumed)).toBe(serializeWorld(world));
        // Continue from the original checkpoint so the player still observes each hour.
        world=deserializeWorld(saved);
      }
    }
    checkStoneMatter();
    writeTestFileSync(`tmp/colony-final-${version}-${seed}.json`,serializeWorld(world));
    writeTestFileSync(`artifacts/colony-${version}-${seed}.json`,JSON.stringify({seed,report,woodLedger,cooking:{...cookingLedger.totals},stone:{openings:stoneOpenings,inferredYields,matter:stoneAtLastCheck},final:colonySummary(world)},null,2));
    const context=JSON.stringify({seed,report,meals:[...meals],sleep:[...sleep],medicalBedRest:[...medicalBedRest],medicineUsed});
    expect([...temporarilyDowned].every(([id,episodes])=>{const p=world.pawns.find(p=>p.id===id);return !!p&&p.state!=='dead'&&p.state!=='downed'&&!!p.health&&!p.health.death&&!p.health.missing.length&&medicalStatus(p.health)==='mobile'&&!episodes.has(p.health.foodPoisoning?.bornAt??-1);}),context).toBe(true);
    expect(report[0]!.structures,context).toMatchObject({bed:3,table:1,stool:3});
    expect(report[4]!.structures,context).toEqual({'wood-generator':1,'standing-lamp':1,'passive-cooler':0,bed:population,table:1,stool:3,wall:7,campfire:1,horseshoes:1,stonecutter:1,door:1});
    expect(report[4]!.roofing,context).toEqual({constructed:28,planned:28,removal:0});
    expect([...recreationKinds].sort(),context).toEqual(['horseshoes','skygaze','social-relax']);expect(recreationPawns.size,context).toBe(population);
    expect(cookingLedger.totals.portions,context).toBeGreaterThanOrEqual(12);
    expect(cookingLedger.totals.bulkOperations,context).toBeGreaterThanOrEqual(1);
    expect(rationAssignments,context).toBeGreaterThanOrEqual(3);
    expect(stoneOpenings.length,context).toBeGreaterThanOrEqual(4);
    expect(world.tiles.filter(t=>t.terrain==='rough-stone').length,context).toBeGreaterThanOrEqual(6);
    expect(colonySummary(world).mining.blocks,context).toBe(35);expect(colonySummary(world).mining.blocksStored,context).toBe(35);
    expect(colonySummary(world).mining.components,context).toBe(4);expect(colonySummary(world).mining.componentsStored,context).toBe(4);
    expect(colonySummary(world).mining.steel,context).toBe(50);expect(colonySummary(world).mining.steelStored,context).toBe(50);expect(colonySummary(world).mining.steelInBuildings,context).toBe(150);expect(colonySummary(world).structures.stonecutter,context).toBe(1);
    expect(colonySummary(world).mining.componentsInBuildings,context).toBe(2);
    expect(colonySummary(world).power.filter(s=>s.on),context).toHaveLength(2);
    const medicines=colonySummary(world).medicines;
    expect(initialMedicine,context).toBe(30);
    expect(medicines,context).toEqual({total:initialMedicine-medicineUsed,stored:initialMedicine-medicineUsed,policies:Array(population).fill('industrial')});
    expect(medicines.total,context).toBeGreaterThan(0);
    const chunkStockpiles=world.stockpiles.filter(s=>s.filters.chunk);
    expect(chunkStockpiles,context).toHaveLength(4);
    for(const zone of chunkStockpiles){
      const occupants=world.piles.filter(p=>p.owner.type==='ground'&&p.owner.x===zone.x&&p.owner.z===zone.z);
      expect(occupants.every(p=>p.kind==='chunk'&&storageAccepts(zone,p.item)),context).toBe(true);
      expect(occupants.reduce((n,p)=>n+p.quantity,0),context).toBeLessThanOrEqual(zone.capacity);
    }
    for(const pile of campChunks(world))if(campChunkNeedsHaul(world,pile))expect(pile.haulRequested,context).toBe(true);
    expect(world.deconstructed.count,context).toBe(1);
    expect(world.structures.find(s=>s.kind==='horseshoes')?.x,context).toBe(Math.floor(world.width/2)+4);expect(world.packed,context).toEqual([]);
    const maintenance=world.jobs.filter(j=>j.growingZoneId===undefined);
    expect(maintenance.filter(j=>j.kind!=='chop'&&j.kind!=='harvest'),context).toEqual([]);
    // Midnight is not a drained queue: prove the specific remaining resource jobs
    // finish after normal sleep, without adding orders or changing needs.
    if(maintenance.length) {
      const followup=deserializeWorld(serializeWorld(world)),ids=new Set(maintenance.map(j=>j.id));
      for(let t=0;t<6000&&followup.jobs.some(j=>ids.has(j.id));t++)stepWorld(followup);
      expect(followup.jobs.filter(j=>ids.has(j.id)),context).toEqual([]);
      expect(validateWorld(followup),context).toEqual([]);
    }
    expect(world.pawns.some(p=>p.skills.construction.xp>1000000),context).toBe(true);
    expect(world.growingZones,context).toHaveLength(2);expect(colonySummary(world).textile,context).toMatchObject({fields:1,plants:6,cloth:0}); expect(world.resources.filter(r=>r.kind==='rice').length,context).toBeGreaterThan(5); expect(world.stock.food,context).toBeGreaterThan(0);
    expect([...meals.values()].every(n=>n>=10),context).toBe(true);
    expect([...sleep].every(([id,n])=>n>0&&n+(medicalBedRest.get(id)??0)>4000),context).toBe(true);
    expect(colonySummary(world).plantClimate,context).toEqual({slowed:0,thermalAnchors:0});
    expect(colonySummary(world).apparel.filter(i=>i.owner.type==='apparel'),context).toHaveLength(population+1);
    expect(world.structures.filter(s=>s.kind==='wall'||s.kind==='door').every(s=>world.home?.includes(s.z*world.width+s.x)),context).toBe(true);
    expect(world.restRules).toBe('adult');expect(world.pawns.map(p=>p.schedule.filter(s=>s==='sleep').length)).toEqual(Array(population).fill(8));
    expect(world.pawns).toHaveLength(population);expect(meals.size).toBe(population);expect(sleep.size).toBe(population);
    if(seed===42)expect(world.arrivals?.accepted).toBe(1);
    if(seed===93){
      const hunted=colonySummary(world).hunting;
      expect(hunted,context).toMatchObject({spots:1,completed:1,butchered:1,designated:0,corpses:0});
      expect(hunted.meatProduced,context).toBeGreaterThan(0);expect(hunted.leatherProduced,context).toBeGreaterThan(0);
      expect(world.piles.filter(p=>p.item==='light-leather').reduce((n,p)=>n+p.quantity,0),context).toBe(hunted.leatherProduced);
      expect(wildlifePopulationAccount(world),context).toBe(12);
    }
    expect(world.pawns[2]!.schedule[5]).toBe('anything');expect(world.pawns[2]!.schedule[21]).toBe('sleep');
// This is a correctness journey with deep checkpoints, not a tick-time budget.
// Keep a wall-clock ceiling while separate profiling measures simulation costs.
}, 240000);
