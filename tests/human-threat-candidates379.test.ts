import {afterEach,expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {Pawn,World} from '../src/sim/types';
import {beginHumanThreatCandidates379,humanThreatCandidates379} from '../src/sim/human-threat-candidates-379';
import {hostileCandidates,hostileTarget,activeCombatThreat} from '../src/sim/combat-target';
import {threatQueries} from '../src/sim/threats';
import {startBerserk} from '../src/sim/mental-break';
import {finishMentalBreak} from '../src/sim/mental-state';
import {createPrisonerState} from '../src/sim/prisoner-state';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal';

afterEach(()=>setTerrainWriteCacheVerification(false));
function fixture(){
 const w=createWorld(47,16,16),base=w.pawns[0]!;w.structures=[];w.jobs=[];w.resources=[];w.piles=[];w.tiles=w.tiles.map(()=>({terrain:'grass'}));
 w.pawns=Array.from({length:40},(_,i):Pawn=>({...structuredClone(base),id:w.nextId++,x:i%12+2,z:Math.floor(i/12)+2,state:'idle',orders:{active:null,queue:[]},need:null,cooking:null}));
 return w;
}
const fullHostiles=(w:World,p:Pawn)=>w.pawns.filter(t=>hostileTarget(p,t)&&activeCombatThreat(t));
function compare(w:World):void {
 for(const p of w.pawns){
  expect(hostileCandidates(w,p)).toEqual(fullHostiles(w,p));
  expect(threatQueries(w).anyNearby(p)).toBe(threatQueries({...w} as World).anyNearby(p));
 }
}
test('phase candidates preserve source order through live state/position, prisoner and neutral-faction transitions',()=>{
 const w=fixture(),owner={},[observer,foreign,prisoner,neutral]=w.pawns;
 foreign!.faction='outlaws';prisoner!.prisoner=createPrisonerState(w,prisoner!);neutral!.faction='outlanders';
 setTerrainWriteCacheVerification(true);
 withJournalTerrainReadScope(owner,()=>{
  const close=beginHumanThreatCandidates379(w);
  try{
   expect(humanThreatCandidates379(w,observer!)).toEqual([foreign,prisoner,neutral]);compare(w);
   foreign!.state='sleeping';foreign!.x=15;compare(w);foreign!.state='idle';foreign!.x=3;
   prisoner!.prisoner!.breakout={rng:1,active:{startedAt:w.tick,initiatorId:prisoner!.id}};compare(w);
   neutral!.faction='outlaws';compare(w);neutral!.prisoner=createPrisonerState(w,neutral!);compare(w);
   delete neutral!.prisoner;neutral!.faction='colony';compare(w);
   w.pawns=w.pawns.filter(p=>p!==foreign);compare(w);
   w.pawns.push({...structuredClone(observer!),id:w.nextId++,faction:'outlaws'});compare(w);
  }finally{close();}
 });
 expect(humanThreatCandidates379(w,observer!)).toBe(w.pawns);
});
test('the actual berserk commit enrolls a formerly ordinary human before the next observer; recovery and unusual observers remain live',()=>{
 const w=fixture(),owner={},observer=w.pawns[0]!,aggressor=w.pawns[25]!;
 setTerrainWriteCacheVerification(true);
 withJournalTerrainReadScope(owner,()=>{
  const close=beginHumanThreatCandidates379(w);
  try{
   expect(humanThreatCandidates379(w,observer)).toEqual([]);expect(startBerserk(w,aggressor)).toBe(true);
   expect(hostileCandidates(w,observer)).toEqual([aggressor]);expect(humanThreatCandidates379(w,aggressor)).toBe(w.pawns);compare(w);
   finishMentalBreak(w,aggressor);compare(w);
   observer.meleeThreat={attackerId:aggressor.id,atCore:w.tick*10};
   aggressor.x=observer.x;aggressor.z=observer.z;
   expect(threatQueries(w).hostiles(observer)).toEqual([aggressor]);expect(threatQueries(w).anyNearby(observer)).toBe(true);
  }finally{close();}
 });
});
test('ordinary observers skip unrelated humans after one phase capture; public/mutable and nested scopes retain the full query',()=>{
 const w=fixture(),owner={},observer=w.pawns[0]!,bystander=w.pawns[12]!;let positionReads=0;
 const x=bystander.x;Object.defineProperty(bystander,'x',{configurable:true,enumerable:true,get(){positionReads++;return x;}});
 withJournalTerrainReadScope(owner,()=>{
  const close=beginHumanThreatCandidates379(w);
  try{
   expect(humanThreatCandidates379(w,observer)).toEqual([]);
   for(let i=0;i<30;i++)expect(threatQueries(w).anyNearby(observer)).toBe(false);expect(positionReads).toBe(0);
   const other={...w,pawns:[{...structuredClone(observer),id:w.nextId++,faction:'outlaws' as const}]} as World,inner=beginHumanThreatCandidates379(other);
   try{expect(hostileCandidates(other,observer)).toEqual(other.pawns);}finally{inner();}
   expect(humanThreatCandidates379(w,observer)).toEqual([]);
  }finally{close();}
 });
 expect(threatQueries(w).anyNearby(observer)).toBe(false);expect(positionReads).toBeGreaterThan(0);
 // Without the closed owner even an explicitly begun phase does not admit a cache.
 const close=beginHumanThreatCandidates379(w);try{expect(humanThreatCandidates379(w,observer)).toBe(w.pawns);}finally{close();}
});
