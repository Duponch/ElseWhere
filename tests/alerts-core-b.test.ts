import {describe,expect,test} from 'vitest';
import {createWorld,stepWorld} from '../src/sim/engine';
import {enableWildlife} from '../src/sim/wildlife';
import {adultAgeTicks} from '../src/sim/animal-life';
import {PEN_ANIMALS,animalPenAt,invalidateAnimalPens,penRegion} from '../src/sim/animal-pens';
import {animalSpecies,type AnimalSpeciesId} from '../src/sim/animal-species';
import {newDoorState} from '../src/sim/door-rules';
import {IMMUNE_DISEASE_UNIT} from '../src/sim/immune-diseases-rules';
import {BLOOD_UNIT} from '../src/sim/injury-rules';
import {createMedicalRecord} from '../src/sim/injury-state';
import {MALNUTRITION_UNIT,malnutritionRate} from '../src/sim/malnutrition';
import {addGroundMaterial,addMaterial,refreshStock} from '../src/sim/materials';
import type {Structure,World} from '../src/sim/types';
import type {WildAnimal} from '../src/sim/wildlife-state';
import {coreAlertPriority} from '../src/ui/alert-priority';
import {animalTicksStarving,readPenViews} from '../src/ui/core-animal-alerts';
import {lowestTemperatureComing} from '../src/ui/core-needs-alerts';
import {actorNotificationTarget,objectNotificationTarget} from '../src/ui/notification-focus';
import {readStatusAlerts} from '../src/ui/status-alerts';
import {AlertActivationTracker,readNativeAlertRows} from '../src/ui3d/native-alert-list';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction';
import {recruitmentUiFixture} from './scenarios/prison-camp';

/** Alerts lot B: Core RimWorld 1.6 needs, health, animal and clothing alerts,
 * read on World states built with the scenario helpers. Readers are pure. */
const row=(w:World,key:string)=>readStatusAlerts(w).find(r=>r.key===key);
const has=(w:World,key:string)=>readStatusAlerts(w).some(r=>r.key===key);
const DAY=6000;
const naked=(w:World)=>{w.piles=w.piles.filter(p=>p.owner.type!=='apparel');};
const wear=(w:World,pawnId:number,item:string)=>{addMaterial(w,'apparel',1,{type:'apparel',pawnId},item as never);return w.piles.at(-1)!;};

describe('needs and health',()=>{
  test('exhaustion (High) lists free colonists whose rest is under 1 %',()=>{
    const w=deconstructionCamp(3),[a,b]=w.pawns;
    expect(has(w,'exhaustion')).toBe(false);
    a!.rest=.5;b!.rest=1;
    const tired=row(w,'exhaustion')!;
    expect(tired).toMatchObject({text:'Colon épuisé',targets:[actorNotificationTarget(a!.id)],tab:'needs'});
    expect(coreAlertPriority(tired)).toBe('high');
    b!.rest=0;expect(row(w,'exhaustion')?.text).toBe('2 colons épuisés');
    a!.rest=40;b!.rest=40;expect(has(w,'exhaustion')).toBe(false);
  });

  test('low medicine (High) counts stored medicine after 2.5 days, against 2 per colonist',()=>{
    const w=deconstructionCamp(3);w.tick=14_999;
    expect(has(w,'low-medicine')).toBe(false);
    w.tick=15_000;
    const none=row(w,'low-medicine')!;expect(none.text).toBe('Aucun médicament en réserve');expect(coreAlertPriority(none)).toBe('high');
    addGroundMaterial(w,'medicine',5,{x:3,z:3},'herbal-medicine');
    expect(row(w,'low-medicine')?.text).toBe('Aucun médicament en réserve'); // on the ground, not in storage
    w.stockpiles.push({id:w.nextId++,x:3,z:3,priority:2,capacity:75,filters:{wood:false,food:false}});
    const low=row(w,'low-medicine')!;expect(low.text).toBe('Réserve de médicaments faible');expect(low.explanation).toContain('au moins 6');
    w.stockpiles.push({id:w.nextId++,x:3,z:4,priority:2,capacity:75,filters:{wood:false,food:false}});
    addGroundMaterial(w,'medicine',1,{x:3,z:4},'medicine');
    expect(has(w,'low-medicine')).toBe(false); // 6 ≥ 2 × 3
  });

  test('tattered apparel (Medium) follows the damaged-apparel thought: a worn piece under half its hit points',()=>{
    const w=deconstructionCamp(2),[a,b]=w.pawns;naked(w);
    const shirt=wear(w,a!.id,'cloth-shirt');wear(w,b!.id,'cloth-shirt');
    expect(has(w,'tattered-apparel')).toBe(false);
    shirt.apparel!.hitPoints=49;
    const ragged=row(w,'tattered-apparel')!;
    expect(ragged).toMatchObject({text:'Vêtements abîmés',targets:[actorNotificationTarget(a!.id)]});
    expect(coreAlertPriority(ragged)).toBe('medium');
    shirt.apparel!.hitPoints=50;expect(has(w,'tattered-apparel')).toBe(false);
  });

  test('boredom (Medium): low recreation and bored of every kind on the map, until a new kind is built',()=>{
    const w=deconstructionCamp(2),[a]=w.pawns;
    for(const kind of ['solitary','social'] as const){a!.recreation.tolerance[kind]=60;a!.recreation.bored[kind]=true;}
    a!.recreation.level=50;expect(has(w,'boredom')).toBe(false); // recreation above 24 % outside a recreation hour
    a!.recreation.level=10;
    const bored=row(w,'boredom')!;
    expect(bored.targets).toEqual([actorNotificationTarget(a!.id)]);expect(coreAlertPriority(bored)).toBe('medium');
    expect(bored.explanation).toContain('contemplation');
    a!.recreation.level=50;a!.schedule.fill('recreation');expect(has(w,'boredom')).toBe(true); // Core: in a joy hour
    fixtureBuilding(w,'horseshoes',6,6);expect(has(w,'boredom')).toBe(false); // a kind it is not bored of
  });

  test('batteries (Medium) are needed beside solar or wind power, not beside a battery or a geothermal generator',()=>{
    const w=deconstructionCamp(1);
    expect(has(w,'need-batteries')).toBe(false);
    fixtureBuilding(w,'solar-generator',4,4);
    const need=row(w,'need-batteries')!;expect(coreAlertPriority(need)).toBe('medium');expect(need.context).toEqual({panel:'architect',category:'power'});
    const battery=fixtureBuilding(w,'battery',8,4);expect(has(w,'need-batteries')).toBe(false);
    w.structures=w.structures.filter(s=>s!==battery);fixtureBuilding(w,'geothermal-generator',12,4);expect(has(w,'need-batteries')).toBe(false);
  });

  test('life-threatening conditions (Critical) cover blood loss, malnutrition, temperature, heart and prisoners; immunity clears a disease',()=>{
    const w=deconstructionCamp(3),[a,b,c]=w.pawns;
    for(const p of [a!,b!,c!])p.health=createMedicalRecord(w.tick);
    a!.health!.bloodLoss=.59*BLOOD_UNIT;expect(has(w,'life-threatening')).toBe(false);
    a!.health!.bloodLoss=.6*BLOOD_UNIT;
    let threat=row(w,'life-threatening')!;
    expect(threat).toMatchObject({text:'Personne en danger de mort',targets:[actorNotificationTarget(a!.id)],tab:'health'});
    expect(coreAlertPriority(threat)).toBe('critical');expect(threat.explanation).toContain('perte de sang');
    b!.health!.hypothermia=620_000_000;
    c!.health!.animalAgeConditions={revision:1,nextId:2,cases:[{id:1,kind:'HeartAttack',severity:.4} as never]};
    threat=row(w,'life-threatening')!;
    expect(threat.text).toBe('3 personnes en danger de mort');
    expect(threat.explanation).toContain('hypothermie');expect(threat.explanation).toContain('crise cardiaque');
    // One Core alert replaces the former per-disease urgent rows.
    const malaria={bornAt:w.tick,severity:910_000_000,immunity:0,luck:1_000_000};
    a!.health!.bloodLoss=0;b!.health!.hypothermia=0;c!.health!.animalAgeConditions={revision:1,nextId:2,cases:[]};a!.health!.immuneDiseases={malaria};
    expect(row(w,'life-threatening')?.explanation).toContain('paludisme');
    expect(readStatusAlerts(w).some(r=>r.key.endsWith('-critical'))).toBe(false);
    malaria.immunity=IMMUNE_DISEASE_UNIT;expect(has(w,'life-threatening')).toBe(false);
    expect(has(w,'malaria')).toBe(true); // the ordinary disease row stays
  });

  test('a prisoner with extreme malnutrition is a culprit of the life-threatening alert',()=>{
    const {world:w,patientId}=recruitmentUiFixture(),prisoner=w.pawns.find(p=>p.id===patientId)!;
    prisoner.health=createMedicalRecord(w.tick);prisoner.health.malnutrition=.8*MALNUTRITION_UNIT-1;
    expect(has(w,'life-threatening')).toBe(false);
    prisoner.health.malnutrition=.8*MALNUTRITION_UNIT;
    expect(row(w,'life-threatening')?.targets).toEqual([actorNotificationTarget(patientId)]);
  });

  test('warm clothes (High): coldest coming temperature under 5 °C and colonists not dressed for it',()=>{
    const w=deconstructionCamp(3),[a,b,c]=w.pawns;naked(w);
    w.climate={revision:1,profile:'boreal-reference',adoptedAt:0,calendarOrigin:0};
    w.tick=15*DAY; // third twelfth of the year: the next three twelfths stay mild
    expect(lowestTemperatureComing(w)).toBeGreaterThanOrEqual(5);expect(has(w,'need-warm-clothes')).toBe(false);
    w.tick=40*DAY; // autumn: the coming twelfths fall well under 5 °C
    const lowest=lowestTemperatureComing(w);expect(lowest).toBeLessThan(-10);
    const cold=row(w,'need-warm-clothes')!;
    expect(cold.targets).toEqual([a!,b!,c!].map(p=>actorNotificationTarget(p.id)));expect(coreAlertPriority(cold)).toBe('high');
    // A muffalo wool parka and tuque bring the comfortable minimum under the forecast.
    wear(w,a!.id,'muffalo-wool-parka');wear(w,a!.id,'muffalo-wool-tuque');
    expect(row(w,'need-warm-clothes')?.targets).toEqual([b!,c!].map(p=>actorNotificationTarget(p.id)));
    // Core 1.6.4871 never subtracts spare warm sets in storage: wearing them is what counts.
    w.stockpiles.push({id:w.nextId++,x:3,z:3,priority:2,capacity:75,filters:{wood:false,food:false}});
    w.stockpiles.push({id:w.nextId++,x:3,z:4,priority:2,capacity:75,filters:{wood:false,food:false}});
    addGroundMaterial(w,'apparel',1,{x:3,z:3},'muffalo-wool-parka');addGroundMaterial(w,'apparel',1,{x:3,z:4},'muffalo-wool-parka');
    expect(row(w,'need-warm-clothes')?.targets).toHaveLength(2);
    for(const p of [b!,c!]){wear(w,p.id,'muffalo-wool-parka');wear(w,p.id,'muffalo-wool-tuque');}
    expect(has(w,'need-warm-clothes')).toBe(false);
  });
});

/** A 32² camp with a fenced 5×5 pen (gate on the west side), a handler and one
 * colony animal of a rope-managed species. */
function penCamp(species:AnimalSpeciesId='muffalo'){
  // Built without commands (a raw createWorld clock, like the deconstruction camp).
  const w=createWorld(81733,32,32);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.jobs=[];w.structures=[];w.piles=[];w.stockpiles=[];w.growingZones=[];w.pawns=w.pawns.slice(0,2);
  for(const p of w.pawns){p.hunger=100;p.rest=100;p.recreation.level=100;p.bedId=null;for(const key of Object.keys(p.priorities) as (keyof typeof p.priorities)[])p.priorities[key]=0;}
  w.pawns[0]!.x=4;w.pawns[0]!.z=10;w.pawns[1]!.x=8;w.pawns[1]!.z=6;
  w.resources.push({id:w.nextId++,kind:'berries',x:10,z:10,amount:10,growth:1,growthTick:w.tick});enableWildlife(w,1);w.resources=[];
  const handler=w.pawns[0]!,animal=w.wildlife!.animals[0]!;
  handler.priorities.handle=1;
  const add=(kind:Structure['kind'],x:number,z:number):Structure=>{
    const s:Structure={id:w.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'wood'};
    if(kind==='fence-gate')s.door=newDoorState(w.tick);
    if(kind==='pen-marker')s.pen={accepted:[...PEN_ANIMALS]};
    w.structures.push(s);return s;
  };
  for(let x=14;x<=20;x++){add('fence',x,14);add('fence',x,20);}
  for(let z=15;z<20;z++){add(z===17?'fence-gate':'fence',14,z);add('fence',20,z);}
  const marker=add('pen-marker',17,17);
  Object.assign(animal,{species,sex:'female',ageTicks:adultAgeTicks(species),x:4,z:4,food:animalSpecies(species).nutrition,rest:1,state:'idle',path:[],motion:undefined,nextDecision:w.tick+80});
  animal.domestic={since:w.tick,care:'herbal',tameness:5,nextDecay:w.tick+45000,lastTraining:w.tick};
  refreshStock(w);
  return {w,handler,animal,marker,add};
}
const starve=(a:WildAnimal,intervals:number)=>{a.food=0;a.health={...createMedicalRecord(0),malnutrition:intervals*malnutritionRate(a.id)};};

describe('animals and pens',()=>{
  test('a rope-managed animal outside any pen needs one; a pen accepting it and a handler clear the alert',()=>{
    const {w,handler,animal,marker}=penCamp();
    const savedPen=marker.pen;w.structures=w.structures.filter(s=>s!==marker);
    const need=row(w,'animal-pen-needed')!;
    expect(need.targets).toEqual([actorNotificationTarget(animal.id)]);expect(coreAlertPriority(need)).toBe('medium');
    w.structures.push(marker);
    expect(has(w,'animal-pen-needed')).toBe(false); // a pen accepts it and a handler can lead it there
    handler.priorities.handle=0;
    expect(row(w,'animal-pen-needed')?.explanation).toContain('Dressage'); // no handler: Core still lists it
    handler.priorities.handle=1;marker.pen={accepted:savedPen!.accepted.filter(s=>s!=='muffalo')};
    expect(has(w,'animal-pen-needed')).toBe(true); // the only pen refuses its species
    marker.pen=savedPen;Object.assign(animal,{x:16,z:16});
    expect(animalPenAt(w,16,16)?.closed).toBe(true);handler.priorities.handle=0;
    expect(has(w,'animal-pen-needed')).toBe(false); // inside the pen
    animal.domestic=undefined;Object.assign(animal,{x:4,z:4});expect(has(w,'animal-pen-needed')).toBe(false); // wild animals are not managed
  });

  test('a pen whose fence has a hole is not enclosed until it is closed again',()=>{
    const {w,marker,add}=penCamp();
    expect(has(w,'animal-pen-not-enclosed')).toBe(false);
    const segment=w.structures.find(s=>s.kind==='fence'&&s.x===20&&s.z===17)!;
    w.structures.splice(w.structures.indexOf(segment),1);
    const open=row(w,'animal-pen-not-enclosed')!;
    expect(open.targets).toEqual([objectNotificationTarget('structure',marker.id,marker)]);expect(coreAlertPriority(open)).toBe('medium');
    add('fence',20,17);expect(has(w,'animal-pen-not-enclosed')).toBe(false);
    // A gate held open opens the pen too (the memo reads its live state).
    // In-place door changes invalidate the simulation's pens, as its mutators do.
    const gate=w.structures.find(s=>s.kind==='fence-gate')!;gate.door!.holdOpen=true;gate.door!.open=true;invalidateAnimalPens(w);
    expect(has(w,'animal-pen-not-enclosed')).toBe(true);
    gate.door!.holdOpen=false;gate.door!.open=false;invalidateAnimalPens(w);expect(has(w,'animal-pen-not-enclosed')).toBe(false);
  });

  test('a wild predator inside an enclosed pen is signalled; outside it is not',()=>{
    const {w}=penCamp(),fox=w.wildlife!.animals[0]!;
    Object.assign(fox,{species:'red-fox',x:4,z:4});fox.domestic=undefined;
    expect(has(w,'predator-in-pen')).toBe(false);
    Object.assign(fox,{x:18,z:18});
    const intruder=row(w,'predator-in-pen')!;
    expect(intruder.text).toBe(`Prédateur dans un enclos : ${animalSpecies('red-fox').label}`);
    expect(intruder.targets).toEqual([actorNotificationTarget(fox.id)]);expect(coreAlertPriority(intruder)).toBe('medium');
  });

  test('a penned animal starving in its pen: the simulation grows its malnutrition past 2 500 Core ticks',()=>{
    const {w,handler,animal}=penCamp();handler.priorities.handle=0;
    Object.assign(animal,{x:17,z:16,food:0,nextDecision:w.tick+5});
    expect(has(w,'penned-animal-hungry')).toBe(false);
    let steps=0;
    while(animalTicksStarving(animal)<=2_500&&steps<400){stepWorld(w);steps++;}
    expect(animalTicksStarving(animal)).toBeGreaterThan(2_500);
    expect(penRegion(w,w.structures.find(s=>s.kind==='pen-marker')!.id)?.cells.has(Math.floor(animal.z)*w.width+Math.floor(animal.x))).toBe(true);
    const hungry=row(w,'penned-animal-hungry')!;
    expect(hungry.targets).toEqual([actorNotificationTarget(animal.id)]);expect(coreAlertPriority(hungry)).toBe('medium');
    animal.food=1;expect(has(w,'penned-animal-hungry')).toBe(false); // fed: no longer starving
  });

  test('colony animals starving for 30 000 Core ticks (5 000 when pregnant) are signalled',()=>{
    const {w,animal}=penCamp();
    starve(animal,200);expect(has(w,'starvation-animals')).toBe(false); // exactly 30 000
    starve(animal,201);
    const starving=row(w,'starvation-animals')!;
    expect(starving.targets).toEqual([actorNotificationTarget(animal.id)]);expect(coreAlertPriority(starving)).toBe('medium');
    starve(animal,34);expect(has(w,'starvation-animals')).toBe(false);
    animal.pregnancy={fatherId:animal.id+1000,progress:1};expect(has(w,'starvation-animals')).toBe(true); // 5 100 > 5 000
    animal.domestic=undefined;expect(has(w,'starvation-animals')).toBe(false); // a wild animal is not the colony's
  });

  test('pen regions are reused across published snapshots and recomputed when a barrier changes',()=>{
    const {w,marker}=penCamp(),published=():World=>({...w,structures:[...w.structures]});
    const first=readPenViews(published())[0]!;expect(first.marker.id).toBe(marker.id);expect(first.region?.closed).toBe(true);
    expect(readPenViews(published())[0]!.region).toBe(first.region); // same barriers: same region object
    const segment=w.structures.find(s=>s.kind==='fence'&&s.x===14&&s.z===15)!;
    w.structures=w.structures.filter(s=>s!==segment);
    expect(readPenViews(published())[0]!.region?.closed).toBe(false);
  });
});

describe('priority order and purity',()=>{
  test('lot B alerts take their Core priority in the native list and reading never mutates the World',()=>{
    const w=deconstructionCamp(3),[a,b]=w.pawns;w.tick=15_000;
    for(const p of w.pawns)p.health=createMedicalRecord(w.tick);
    a!.health!.bloodLoss=.7*BLOOD_UNIT;b!.rest=0;fixtureBuilding(w,'solar-generator',4,4);
    const before=JSON.stringify(w);
    const rows=readNativeAlertRows(w,undefined,1);
    for(const [key,priority] of [['life-threatening','critical'],['exhaustion','high'],['low-medicine','high'],['need-batteries','medium']] as const)
      expect(rows.find(r=>r.key===key)?.priority).toBe(priority);
    const keys=new AlertActivationTracker().update(rows,true).ordered.map(r=>r.key);
    expect(keys[0]).toBe('life-threatening');
    expect(keys.indexOf('exhaustion')).toBeLessThan(keys.indexOf('need-batteries'));
    expect(keys.indexOf('low-medicine')).toBeLessThan(keys.indexOf('need-batteries'));
    expect(JSON.stringify(w)).toBe(before);
  });
});
