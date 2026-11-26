import {afterEach,expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {Pawn,World,Job} from '../src/sim/types';
import type {WildAnimal} from '../src/sim/wildlife-state';
import {beginSourceReservationCandidates379,sourceReservationCandidates379} from '../src/sim/source-reservation-candidates-379';
import {reservedSource,reservedSourcesByPile,createSourceReservationRead379} from '../src/sim/materials';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal';

afterEach(()=>setTerrainWriteCacheVerification(false));
const haul=(sourcePileId:number,quantity:number)=>({sourcePileId,quantity,phase:'pickup' as const,carryPileId:null,destination:{type:'aside' as const,x:1,z:1}});
function fixture(){
 const w=createWorld(42,16,16),base=w.pawns[0]!;
 w.pawns=Array.from({length:80},(_,i):Pawn=>({...structuredClone(base),id:w.nextId++,x:i%12+1,z:1+Math.floor(i/12),state:'idle',need:null,haul:null,cooking:null,orders:{active:null,queue:[]},recreation:{...base.recreation,task:null}}));
 const animals=Array.from({length:130},(_,i):WildAnimal=>({id:w.nextId++,species:'hare',sex:'female',x:i%10,z:Math.floor(i/10),ageTicks:1000,food:.1,rest:1,state:'idle',path:[],nextDecision:0}));
 w.wildlife={profile:'temperate-hares-v1',rng:1,animals,eatenPlants:0,eatenNutrition:0,eatenItems:0};w.jobs=[];w.piles=[];w.structures=[];
 delete w.scout;delete w.commercialTrip;delete w.group;return w;
}
test('reservation candidate directory advances at actual rotated actor turns and retains exact source-order folding',()=>{
 const w=fixture(),owner={},id=w.nextId++,p=w.pawns[11]!,q=w.pawns[1]!,r=w.pawns[4]!,animals=w.wildlife!.animals,a=animals[29]!,b=animals[5]!;
 p.haul=haul(id,1e16);r.orders.queue=[haul(id,1)];b.meal={kind:'pile',id,quantity:3,progress:0};
 const expected=()=>({single:reservedSource({...w} as World,id),batch:[...reservedSourcesByPile({...w} as World)]});
 const check=()=>{const oracle=expected();expect(reservedSource(w,id)).toBe(oracle.single);expect([...reservedSourcesByPile(w)]).toEqual(oracle.batch);expect(createSourceReservationRead379(w,[id])(id)).toBe(oracle.single);};
 setTerrainWriteCacheVerification(true);
 withJournalTerrainReadScope(owner,()=>{
  const scope=beginSourceReservationCandidates379(w);
  try{
   expect(sourceReservationCandidates379(w)!.people).toEqual([r,p]);expect(sourceReservationCandidates379(w)!.animals).toEqual([b]);check();
   scope.human(q);q.haul=haul(id,.2);q.orders.queue=[haul(id,.3)];check();
   scope.human(r);expect(sourceReservationCandidates379(w)!.people).toEqual([q,r,p]);r.orders.queue=[];check();
   scope.human(p);p.haul=null;scope.human(w.pawns[22]!);expect(sourceReservationCandidates379(w)!.people).toEqual([q,w.pawns[22]!]);check();
   scope.animal(a);a.meal={kind:'pile',id,quantity:7,progress:0};check();scope.animal(b);delete b.meal;check();
   scope.animal(animals[0]!);expect(sourceReservationCandidates379(w)!.animals).toEqual([animals[0],a]);check();
   const j={id:w.nextId++,kind:'replant-tree',tree:{kind:'replant',phase:'pickup',sourcePileId:id},reservedBy:p.id} as Job;
   w.jobs.push(j);w.pawns=[...w.pawns.slice(1),w.pawns[0]!];check();
  }finally{scope.close();}
 });
 expect(sourceReservationCandidates379(w)).toBeUndefined();check();
});
test('closed directory detects a new off-turn source claim rather than silently omitting it',()=>{
 const w=fixture(),owner={},p=w.pawns[0]!,q=w.pawns[1]!;setTerrainWriteCacheVerification(true);
 withJournalTerrainReadScope(owner,()=>{const scope=beginSourceReservationCandidates379(w);try{scope.human(p);expect(sourceReservationCandidates379(w)!.people).toEqual([p]);q.haul=haul(1,2);expect(()=>reservedSource(w,1)).toThrow(/decision boundary/);}finally{scope.close();}});
 expect(reservedSource(w,1)).toBe(2);
});
