import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {animalCarrier,animalCarriedOrClaimed,animalServiceIds,createWildlifeAnimalCarrierReader,createWildlifeAnimalServicesReader,releaseAnimalRescue} from '../src/sim/animal-rest-state.ts';
import {advanceAnimalHealth} from '../src/sim/wildlife-health.ts';
import {createMedicalRecord,addResolvedInjury} from '../src/sim/injury-state.ts';
import {animalNutritionMax} from '../src/sim/animal-life.ts';
import {groupAnimalCarrier256} from '../src/sim/group-animal-formation-256.ts';
import {emptyGroupLedger} from '../src/sim/group-loading.ts';
import type {PreparingGroup} from '../src/sim/group-capture.ts';
import type {Pawn,World} from '../src/sim/types.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';

// Query-only prepared fixtures can deliberately contain conflicting services,
// so precedence and source order remain tested even on malformed ownership.
function scalar(w:World,id:number):Pawn|undefined {
  return w.pawns.find(p=>p.shipCasketTask277?.action==='carry'&&(p.shipCasketTask277.phase==='carry'||p.shipCasketTask277.phase==='closing')&&p.shipCasketTask277.patient?.kind==='animal'&&p.shipCasketTask277.patient.id===id)
    ??w.pawns.find(p=>p.animalRescue?.animalId===id&&p.animalRescue.phase==='carry'||p.animalHandling?.kind==='release'&&p.animalHandling.phase==='carry'&&p.animalHandling.animalId===id)
    ??(w.schemaVersion>=256?groupAnimalCarrier256(w,id):undefined);
}
function fixture(){
  const w=createWorld(18,16,16),[first,second,third]=w.pawns as [Pawn,Pawn,Pawn];
  const a:WildAnimal={id:w.nextId++,species:'hare',sex:'female',ageTicks:6000,x:5,z:5,food:.2,rest:1,state:'downed',path:[],nextDecision:w.tick};
  w.wildlife={profile:'temperate-hares-v1',rng:17,animals:[a],eatenPlants:0,eatenNutrition:0,eatenItems:0};
  return {w,first,second,third,a};
}
const rescue=(p:Pawn,id:number,phase:'approach'|'carry'='carry')=>{p.animalRescue={animalId:id,spotId:1,phase};};
const casket=(p:Pawn,id:number,phase:'approach'|'carry'|'closing'='carry')=>{p.shipCasketTask277={action:'carry',casketId:2,patient:{kind:'animal',id},phase,progressCore:0,lastWorkedAt:0};};
function agree(w:World,read:(id:number)=>Pawn|undefined,id:number,expected?:Pawn):void {
  const before=JSON.stringify(w);
  expect(read(id)).toBe(expected);expect(animalCarrier(w,id)).toBe(expected);expect(scalar(w,id)).toBe(expected);
  expect(JSON.stringify(w)).toBe(before);
}

test.each([false,true])('wildlife carrier lookup preserves kind precedence and first pawn order, reversed=%s',reversed=>{
  const {w,first,second,third,a}=fixture();
  first.animalHandling={kind:'release',phase:'carry',animalId:a.id,sourcePileId:0,carryPileId:null,quantity:0,step:0,progress:0};
  rescue(second,a.id);casket(third,a.id,'closing');casket(second,a.id,'approach');
  if(reversed)w.pawns.reverse();
  const read=createWildlifeAnimalCarrierReader(w);
  agree(w,read,a.id,third);agree(w,read,a.id+1);
  delete third.shipCasketTask277;
  agree(w,read,a.id,reversed?second:first);
  casket(second,a.id,'closing');agree(w,read,a.id,second);
  second.shipCasketTask277!.patient={kind:'human',id:a.id};
  agree(w,read,a.id,reversed?second:first);
});

test('a real rescue release and subsequent handover stay visible inside the same wildlife reader',()=>{
  const {w,first,second,a}=fixture();rescue(first,a.id);rescue(second,a.id,'approach');
  first.motion={from:{x:5,z:5},to:{x:6,z:5},start:w.tick,end:w.tick+2,speedFactor:1,terrainDelay:0};
  const read=createWildlifeAnimalCarrierReader(w),rng=w.rng,nextId=w.nextId;
  agree(w,read,a.id,first);releaseAnimalRescue(w,first);
  expect(a.motion).toEqual(first.motion);expect(first.animalRescue).toBeUndefined();
  agree(w,read,a.id);second.animalRescue!.phase='carry';agree(w,read,a.id,second);
  delete second.animalRescue;agree(w,read,a.id);
  expect(w.rng).toBe(rng);expect(w.nextId).toBe(nextId);
});

test('group gathering, handler changes and cancellation are read live even without initial human candidates',()=>{
  const {w,first,second,a}=fixture(),read=createWildlifeAnimalCarrierReader(w);
  const group:PreparingGroup={id:1,startedAt:w.tick,destination:1,phase:'gathering',memberIds:[first.id,second.id],rendezvous:{x:5,z:5},meeting:[],manifest:[],cursor:0,exits:[],ledger:emptyGroupLedger(),animalPreparation:{revision:1,lines:[{animalId:a.id,handlerId:first.id,mode:'carry',gathered:false}]}};
  w.group=group;agree(w,read,a.id);
  const line=group.animalPreparation!.lines[0]!;line.gathered=true;agree(w,read,a.id,first);
  line.handlerId=second.id;agree(w,read,a.id,second);
  line.mode='lead';agree(w,read,a.id);line.mode='carry';agree(w,read,a.id,second);
  delete w.group;agree(w,read,a.id);
});

test('public calls and a new decision scope see direct same-tick additions, replacement and reordered pawns',()=>{
  const {w,first,second,a}=fixture(),tick=w.tick;
  agree(w,createWildlifeAnimalCarrierReader(w),a.id);
  rescue(first,a.id);agree(w,createWildlifeAnimalCarrierReader(w),a.id,first);
  const replacement:Pawn={...first,animalRescue:{animalId:a.id,spotId:1,phase:'approach'}};
  w.pawns[0]=replacement;agree(w,createWildlifeAnimalCarrierReader(w),a.id);
  replacement.animalRescue!.phase='carry';rescue(second,a.id);w.pawns.reverse();
  agree(w,createWildlifeAnimalCarrierReader(w),a.id,second);
  w.pawns=w.pawns.filter(p=>p!==second);agree(w,createWildlifeAnimalCarrierReader(w),a.id,replacement);
  expect(w.tick).toBe(tick);
});

test('wildlife service queries preserve live claims, cancellations and targets without changing the world',()=>{
  const {w,first,second,third,a}=fixture(),other=a.id+1;
  first.animalHandling={kind:'lead',phase:'approach',animalId:a.id,ropees:[other],gatherId:other+1,sourcePileId:0,carryPileId:null,quantity:0,step:0,progress:0};
  second.animalCare={animalId:other+2,spot:{x:4,z:5},phase:'approach',progress:0};
  third.animalFeed={animalId:other+3,spot:{x:4,z:5},sourcePileId:1,carryPileId:null,quantity:1,phase:'pickup',progress:0};
  const read=createWildlifeAnimalServicesReader(w);
  const agree=()=>{
    const before=JSON.stringify(w);
    for(let id=a.id;id<=other+5;id++){
      expect(read.humanService(id)).toBe(w.pawns.some(p=>animalServiceIds(p).includes(id)));
      expect(read.carriedOrClaimed(id)).toBe(animalCarriedOrClaimed(w,id));
      expect(read.carrier(id)).toBe(animalCarrier(w,id));
    }
    expect(JSON.stringify(w)).toBe(before);
  };
  agree();first.animalHandling.ropees=[];delete first.animalHandling.gatherId;agree();
  first.animalHandling.animalId=other+4;second.animalCare.animalId=a.id;third.animalFeed.phase='feed';agree();
  delete first.animalHandling;delete second.animalCare;delete third.animalFeed;agree();
  // An owner that had no human service at entry can become a group handler.
  w.group={id:1,startedAt:w.tick,destination:1,phase:'gathering',memberIds:[first.id],rendezvous:{x:5,z:5},meeting:[],manifest:[],cursor:0,exits:[],ledger:emptyGroupLedger(),animalPreparation:{revision:1,lines:[{animalId:a.id,handlerId:first.id,mode:'carry',gathered:false}]}};
  agree();w.group.animalPreparation!.lines[0]!.gathered=true;agree();delete w.group;agree();
});

test.each([false,true])('health with pass carrier lookup matches live ownership and full clinical/RNG state, carried=%s',carried=>{
  const {w,first,a}=fixture();w.tick=60;
  a.state='sleeping';a.food=animalNutritionMax(a)*.5;a.health={...createMedicalRecord(59),body:'hare'};
  addResolvedInjury(a.health,'left-front-leg','bruise',500,()=>.999999);
  if(carried)rescue(first,a.id);
  const copy=structuredClone(w),other=copy.wildlife!.animals[0]!;
  advanceAnimalHealth(w,a);
  advanceAnimalHealth(copy,other,undefined,createWildlifeAnimalServicesReader(copy).carrier);
  expect(copy).toEqual(w);
});
