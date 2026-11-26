import {afterEach,expect,test,vi} from 'vitest';
import {SnapshotEncoder} from '../src/bridge/snapshots';
import {TerrainJournalSnapshotEncoder} from '../src/bridge/terrain-journal-encoder';
import {SourceMotionPhasePublisher297} from '../src/bridge/source-motion-phase-publisher-297';
import {captureOrdinaryPileSource379,ordinaryPileSourceVersion379,markPileContentWrite379,invalidateOrdinaryPileSources379} from '../src/sim/ordinary-pile-source-379';
import {setResourceJournalVerification} from '../src/sim/resource-mutation-journal';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {assignPileOwner,markPileWrite} from '../src/sim/pile-index';
import {addMaterial} from '../src/sim/materials';
import {setMaterialForbidden256} from '../src/sim/material-permission-256';
import {mergeThingDamage} from '../src/sim/thing-damage-rules';
import {fixture} from './resident-presentation-fixtures-v427';
import type {MaterialPile} from '../src/sim/types';

class ClosedEncoder extends TerrainJournalSnapshotEncoder {protected override usesClosedResourceJournal=true;}
class ProbePublisher extends SourceMotionPhasePublisher297 {
 baseline(pile:MaterialPile,previous?:Readonly<MaterialPile>){return this.captureFullPileBaseline297(pile,previous);}
 same(pile:MaterialPile,previous:Readonly<MaterialPile>){return this.samePilePresentation297(pile,previous);}
 patch(pile:MaterialPile){return this.capturePilePatch297(pile);}
}
afterEach(()=>{vi.restoreAllMocks();setResourceJournalVerification(false);invalidateOrdinaryPileSources379();});
function pair(){
 const world=fixture(),owner={},full=new SnapshotEncoder({structureDelta:true,minimumStructures:0,plantLifeDelta:true,pileRotDelta:true}),closed=new ClosedEncoder(owner);
 const send=()=>{const expected=structuredClone(full.encode(world,0,6)),actual=structuredClone(closed.encode(world,0,6));expect(actual).toStrictEqual(expected);return actual;};
 return {world,owner,full,closed,send};
}

test('actual merge, owner, damage and permission writers keep closed Full packets exact',()=>{
 const h=pair(),pile=h.world.piles[0]!;h.send();const first=ordinaryPileSourceVersion379(pile,h.owner);expect(first).toBeDefined();
 withJournalTerrainReadScope(h.owner,()=>addMaterial(h.world,'wood',2,{...pile.owner},'wood'));expect(pile.quantity).toBe(12);expect(ordinaryPileSourceVersion379(pile,h.owner)).not.toBe(first);h.send();
 withJournalTerrainReadScope(h.owner,()=>assignPileOwner(pile,{type:'pawn',pawnId:h.world.pawns[0]!.id}));h.send();
 withJournalTerrainReadScope(h.owner,()=>mergeThingDamage(pile,2,40,150));h.send();
 withJournalTerrainReadScope(h.owner,()=>setMaterialForbidden256(pile,true));h.send();
 withJournalTerrainReadScope(h.owner,()=>setMaterialForbidden256(pile,false));h.send();
 withJournalTerrainReadScope(h.owner,()=>{markPileContentWrite379(pile).foodPoison=undefined;});h.send();
 withJournalTerrainReadScope(h.owner,()=>{delete markPileContentWrite379(pile).foodPoison;});h.send();
});

test('retained ordinary pile comparison walks zero source keys; public discovery remains exhaustive',()=>{
 const h=pair(),pile=h.world.piles[0]!;h.send();const original=Object.keys;let keys=0;
 const spy=vi.spyOn(Object,'keys').mockImplementation((value:object)=>{if(value===pile)keys++;return original(value);});
 h.closed.encode(h.world,0,6);expect(keys).toBe(0);h.full.encode(h.world,0,6);expect(keys).toBeGreaterThan(0);spy.mockRestore();
 const reader=new ProbePublisher(h.owner),copy=reader.baseline(pile);keys=0;
 const again=vi.spyOn(Object,'keys').mockImplementation((value:object)=>{if(value===pile)keys++;return original(value);});
 for(let i=0;i<128;i++)expect(reader.same(pile,copy)).toBe(true);expect(keys).toBe(0);again.mockRestore();
});

test('rot clocks remain exact in Full deltas while private phase baselines ignore rot only',()=>{
 const h=pair(),pile:MaterialPile={id:h.world.piles[0]!.id,kind:'food',item:'berries',quantity:10,owner:{type:'ground',x:4,z:4},rot:{progress:0,atTick:0}};h.world.piles=[pile];h.send();
 const reader=new ProbePublisher(h.owner),copy=reader.baseline(pile);pile.rot={progress:1,atTick:1,rate:.5};
 const packet=h.send();if(packet.kind==='delta')expect(packet.piles?.rotClock).toStrictEqual(new Float64Array([pile.id,1,1,.5]));
 expect(reader.same(pile,copy)).toBe(true);expect(reader.baseline(pile,copy)).toBe(copy);
 withJournalTerrainReadScope(h.owner,()=>{markPileContentWrite379(pile).quantity--;});
 expect(reader.same(pile,copy)).toBe(false);expect(reader.patch(pile).pile).toStrictEqual(pile);h.send();
});

test('unknown transactions, complex components and replacement objects retain complete discovery',()=>{
 const h=pair(),pile=h.world.piles[0]!;h.send();markPileWrite();pile.quantity++;h.send();
 withJournalTerrainReadScope(h.owner,()=>{markPileContentWrite379(pile).weapon=undefined;});h.send();expect(ordinaryPileSourceVersion379(pile,h.owner)).toBeUndefined();
 pile.quantity++;h.send();delete pile.weapon;invalidateOrdinaryPileSources379();h.send();
 h.world.piles=[{...pile,quantity:pile.quantity+1}];h.send();
 expect(captureOrdinaryPileSource379({...pile,apparel:undefined},h.owner)).toBeUndefined();
});

test('independent checking catches an unmarked ordinary pile field before reuse',()=>{
 setResourceJournalVerification(true);const h=pair();h.send();h.world.piles[0]!.quantity++;
 expect(()=>h.closed.encode(h.world,0,6)).toThrow('Unmarked ordinary pile source write');invalidateOrdinaryPileSources379();
 expect(h.closed.encode(h.world,0,6).kind).toBe('checkpoint');
});

test('receiver write hooks preserve native evaluation order, coercion, assignment and postfix results',()=>{
 const run=(wrapped:boolean)=>{
  const events:string[]=[];let value=3;const target={get quantity(){events.push('get');return value;},set quantity(next:number){events.push('set:'+next);value=next;}};
  const receiver=()=>{events.push('receiver');return target;};
  const old=wrapped?markPileContentWrite379(receiver()).quantity++:receiver().quantity++;
  const assigned=wrapped?markPileContentWrite379(receiver()).quantity+=(events.push('rhs'),2):receiver().quantity+=(events.push('rhs'),2);
  return {events,old,assigned,value};
 };
 expect(run(true)).toStrictEqual(run(false));
});
