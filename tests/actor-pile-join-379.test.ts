import {afterEach,expect,test,vi} from 'vitest';
import {ActorPileJoinOwner379} from '../src/bridge/actor-pile-join-379';
import {captureActorPhaseDependencies297,captureActorPhaseDependenciesWithResourceJoin297} from '../src/bridge/actor-phase-dependencies-297';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {appendPileEntries,filterPileEntries,splicePileEntries,markPileMembershipChanged} from '../src/sim/pile-identity-directory';
import {assignPileOwner} from '../src/sim/pile-index';
import {invalidateOrdinaryPileSources379,markPileContentWrite379} from '../src/sim/ordinary-pile-source-379';
import {setResourceJournalVerification} from '../src/sim/resource-mutation-journal';
import {enableWildlife} from '../src/sim/wildlife';
import {fixture} from './resident-presentation-fixtures-v427';
import type {MaterialPile} from '../src/sim/types';

afterEach(()=>{vi.restoreAllMocks();setResourceJournalVerification(false);invalidateOrdinaryPileSources379();});
function setup(){
 const world=fixture(),owner={},join=new ActorPileJoinOwner379(owner),pawn=world.pawns[0]!;
 const pile=():MaterialPile=>({id:world.nextId++,kind:'wood',item:'wood',quantity:10,owner:{type:'ground',x:4,z:4}});
 world.piles=Array.from({length:1800},pile);
 const held=world.piles[0]!,meal=world.piles[1]!,gear=world.piles[3]!,apparel:MaterialPile={id:world.nextId++,kind:'apparel',item:'flak-vest',quantity:1,owner:{type:'apparel',pawnId:pawn.id},apparel:{quality:'normal',hitPoints:10,birthColor:{r:.4,g:.4,b:.4}}};
 held.owner={type:'pawn',pawnId:pawn.id};gear.owner={type:'equipment',pawnId:pawn.id};world.piles.push(apparel);
 enableWildlife(world,0);const animalId=world.nextId++,animal={id:animalId,species:'hare' as const,sex:'female' as const,x:4,z:4,ageTicks:1000,food:1,rest:1,state:'eating' as const,path:[],nextDecision:1,meal:{kind:'pile' as const,id:meal.id,quantity:1,progress:0}};
 world.wildlife!.animals.push(animal);
 return {world,owner,join,pawn,held,meal,gear,apparel,pile,mutate:<T>(fn:()=>T)=>withJournalTerrainReadScope(owner,fn)};
}
test('actor dependency join visits only relevant rows and tracks actual owner writes, meals, order and complex nested changes',()=>{
 const h=setup(),capture=()=>captureActorPhaseDependenciesWithResourceJoin297(h.world,undefined,undefined,h.join.capture(h.world)),compare=()=>expect(capture().data).toStrictEqual(captureActorPhaseDependencies297(h.world).data);
 compare();expect(h.join.capture(h.world)!.rows).toEqual([h.held,h.gear,h.apparel]);
 const cold=h.world.piles[1200]!,other=h.pile();const iteration=vi.spyOn(h.world.piles,Symbol.iterator);
 h.mutate(()=>{assignPileOwner(cold,{type:'pawn',pawnId:h.pawn.id});markPileContentWrite379(h.held).quantity--;h.apparel.apparel!.birthColor!.r=.7;});
 const warm=capture();expect(iteration).not.toHaveBeenCalled();iteration.mockRestore();expect(warm.data).toStrictEqual(captureActorPhaseDependencies297(h.world).data);
 expect(h.join.capture(h.world)!.rows).toEqual([h.held,h.gear,cold,h.apparel]);
 h.mutate(()=>{
  assignPileOwner(h.held,{type:'ground',x:5,z:4});
  assignPileOwner(other,{type:'equipment',pawnId:h.pawn.id});appendPileEntries(h.world.piles,other);
  h.world.piles=filterPileEntries(h.world.piles,p=>p!==h.meal&&p!==h.gear);
 });compare();expect(h.join.capture(h.world)!.byId(h.meal.id)).toBeUndefined();expect(h.join.capture(h.world)!.rows).toEqual([cold,h.apparel,other]);
 h.mutate(()=>{const moved=splicePileEntries(h.world.piles,h.world.piles.indexOf(h.held),1)[0]!;splicePileEntries(h.world.piles,1,0,moved);});compare();
 // A duplicate is deliberately not certified, preserving Array.find's first
 // match and the dependency capture's original source ordering.
 h.world.piles=[...h.world.piles,{...cold}];expect(h.join.capture(h.world)).toBeUndefined();compare();
});
test('checking mode detects an unmarked ordinary owner write and membership replacement',()=>{
 const h=setup();h.join.capture(h.world);setResourceJournalVerification(true);
 const cold=h.world.piles[22]!;cold.owner={type:'pawn',pawnId:h.pawn.id};
 expect(()=>h.join.capture(h.world)).toThrow('Unmarked actor pile join write');h.mutate(()=>markPileContentWrite379(cold));expect(h.join.capture(h.world)!.rows.includes(cold)).toBe(true);
 h.world.piles[25]=h.pile();expect(()=>h.join.capture(h.world)).toThrow('Unmarked actor pile join write');
 markPileMembershipChanged(h.world.piles);expect(h.join.capture(h.world)!.byId(h.world.piles[25]!.id)).toBe(h.world.piles[25]);
});
