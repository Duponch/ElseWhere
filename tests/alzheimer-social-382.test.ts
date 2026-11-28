import {expect,it} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {tryApplyAnimalAgeCondition256} from '../src/sim/animal-birthday-application-256.ts';
import {animalClinicalRandom256} from '../src/sim/animal-condition-medical-frontier-256.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {opinionCauses} from '../src/sim/social-state.ts';
import {VerseRand} from '../src/sim/verse-rand.ts';

it('nullifies a situational social thought for its owner, without erasing memory opinions',()=>{
 const w=deconstructionCamp(3),p=w.pawns[0]!,a=w.pawns[1]!,b=w.pawns[2]!;
 p.traits=[];a.traits=['pretty'];b.traits=['pretty'];
 const sourceThingId382=Array.from({length:100},(_,i)=>i+1).find(id=>new VerseRand(id*31+228*139).value<.5)!;
 expect(sourceThingId382).toBeGreaterThan(0);
 p.nativeHuman={revision:1,gender:'Male',name:{first:'Paul',last:'Test',nick:'Paul',nickSet:true},biologicalCoreRemainder:0,sourceThingId382};
 const causes=(otherId:number)=>opinionCauses(p,otherId,w.tick,w);
 expect(causes(a.id).find(c=>c.kind==='trait-pretty')?.value).toBe(20);
 p.social={rng:1,memories:[{otherId:a.id,kind:'kind-words',at:w.tick,offset:15}]};
 p.health=createMedicalRecord(w.tick);p.health.humanHealthScale=1;
 expect(tryApplyAnimalAgeCondition256(p.health,'Alzheimers',animalClinicalRandom256(()=>.5)).status).toBe('applied');
 const condition=p.health.animalAgeConditions!.cases.find(c=>c.kind==='Alzheimers')!;
 condition.severity=Math.fround(.8);
 expect(causes(a.id).find(c=>c.kind==='trait-pretty')?.value).toBe(0);
 expect(causes(b.id).find(c=>c.kind==='trait-pretty')?.value).toBe(0);
 expect(causes(a.id).find(c=>c.kind==='kind-words')?.value).toBe(15);
 // Progression into the native stage changes the result, not the seed.
 condition.severity=Math.fround(.1);
 expect(causes(a.id).find(c=>c.kind==='trait-pretty')?.value).toBe(20);
});
