import {expect,test} from 'vitest';
import {applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index.ts';
import {ORE_DEFINITIONS,validOre} from '../src/sim/ore.ts';
import {generateSiteOres,SITE_MINERALS} from '../src/sim/site-ores.ts';
import {geologicalField} from '../src/sim/geology.ts';
import {resolveSite} from '../src/sim/site.ts';
import {addGroundMaterial} from '../src/sim/materials.ts';
import {adoptDeepResources,addDeepDeposit} from '../src/sim/deep-resources.ts';
import {quoteTrade} from '../src/sim/trade-goods.ts';
import {tradingAtContact} from '../src/sim/trade-contact.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {rockInspection} from '../src/ui/geology-inspection.ts';
import {modelIconUrl} from '../src/ui/pictograms.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';
import {miningCamp} from './scenarios/mining.ts';
import {visitorTradeFixture} from './scenarios/visitors.ts';
import {preparedCassandraExpedition} from './scenarios/secondary-incidents-v379.ts';

const silver=(w:World)=>w.piles.filter(p=>p.item==='silver');
function until(w:World,done:()=>boolean,limit=2200):void {
  for(let i=0;i<limit&&!done();i++)stepWorld(w);
  expect(done(),`tick ${w.tick}: ${JSON.stringify(w.pawns.map(p=>({id:p.id,state:p.state})))}`).toBe(true);
}
function historical242(w:World):World {
  const old=structuredClone(w);
  // The fixture is newly generated today. Substitute only prospective surface
  // ore before using it as a historical witness; monetary/deep silver stays.
  for(const map of [old,old.secondarySite?.map])if(map)for(const tile of map.tiles)if(tile.ore==='silver')tile.ore='gold';
  (old as {schemaVersion:number}).schemaVersion=242;return old;
}

test('silver occupies its existing rare mineral occasions with no simulation RNG or ID allocation',()=>{
  expect(SITE_MINERALS.find(m=>m.id==='silver')).toEqual({id:'silver',weight:.1,min:4,max:12});
  const seed=2,site=resolveSite(seed,{hilliness:'small-hills'}),stoneAt=geologicalField(seed,site.stones);
  const world:Pick<World,'seed'|'width'|'height'|'tiles'>={seed,width:250,height:250,tiles:Array.from({length:250*250},()=>({terrain:'rock',stone:site.stones[0]!}))};
  const report=generateSiteOres(world,site,stoneAt),veins=report.occasions.filter(o=>o.mineral==='silver');
  expect(report.requested).toBe(50);expect(veins.length).toBeGreaterThan(0);
  for(const vein of veins){
    expect(vein.requested).toBeGreaterThanOrEqual(4);expect(vein.requested).toBeLessThanOrEqual(12);expect(vein.cells).toHaveLength(vein.requested);
    for(const i of vein.cells)expect(world.tiles[i]).toEqual({terrain:'rock',ore:'silver',stone:stoneAt(i%world.width,Math.floor(i/world.width))});
  }
  expect(ORE_DEFINITIONS.silver).toMatchObject({hp:1500,yield:40,item:'silver'});
  expect(validOre({terrain:'rock',ore:'silver'},242)).toBe(false);expect(validOre({terrain:'rock',ore:'silver'},243)).toBe(true);
  expect(validOre({terrain:'grass',ore:'silver'},243)).toBe(false);
  expect(rockInspection({terrain:'rock',ore:'silver'})?.description).toContain('40 argent');
  expect(modelIconUrl('mountain-silver')).toBe('/assets/ui/elsewhere/pictograms-20261107/mountain-silver.svg');
});

test('a prepared finite camp mines neutral40 silver, resumes damage exactly, then physically stores and spends its own product',()=>{
  const {world:w,pawnId,traderId}=visitorTradeFixture(),pawn=w.pawns.find(p=>p.id===pawnId)!,trader=w.pawns.find(p=>p.id===traderId)!;
  const cell=11*w.width+11;w.tiles[cell]={terrain:'rock',stone:'granite',ore:'silver'};
  pawn.priorities.mine=1;pawn.priorities.haul=2;
  // This source preparation supplies ore only. The fixture has no colonial
  // money; trader currency remains his finite inventory throughout.
  expect(silver(w).filter(p=>p.owner.type==='ground')).toEqual([]);
  expect(applyCommand(w,{type:'designate',kind:'mine',x:11,z:11}).ok).toBe(true);
  until(w,()=>!!w.tiles[cell]!.miningDamage);
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  until(w,()=>w.tiles[cell]!.terrain==='rough-stone');stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  expect(silver(w).filter(p=>p.owner.type==='ground').reduce((n,p)=>n+p.quantity,0)).toBe(40);
  expect(applyCommand(w,{type:'stockpile',x:19,z:15,enabled:true,filters:{wood:false,food:false,silver:true}}).ok).toBe(true);
  until(w,()=>silver(w).some(p=>p.owner.type==='ground'&&p.owner.x===19&&p.owner.z===15&&p.quantity===40));
  const stored=w.piles.find(p=>p.item==='silver'&&p.owner.type==='ground')!;
  expect(applyCommand(w,{type:'order-trade',pawnId,traderId}).ok).toBe(true);
  until(w,()=>tradingAtContact(w,pawn,trader));
  const medicine=w.piles.find(p=>p.item==='medicine'&&p.owner.type==='inventory'&&p.owner.pawnId===traderId)!;
  expect(medicine).toBeDefined();const lines=[{pileId:medicine.id,quantity:1}],quote=quoteTrade(w,pawnId,traderId,lines);
  expect(quote.ok).toBe(true);if(!quote.ok)throw Error(quote.reason);
  expect(quote.net).toBeGreaterThan(0);expect(quote.net).toBeLessThanOrEqual(40);
  const total=silver(w).reduce((n,p)=>n+p.quantity,0),merchant=silver(w).filter(p=>p.owner.type==='inventory').reduce((n,p)=>n+p.quantity,0);
  expect(applyCommand(w,{type:'trade-execute',pawnId,traderId,lines,quote:quote.signature,acceptShortfall:false}).ok).toBe(true);
  expect(silver(w).reduce((n,p)=>n+p.quantity,0)).toBe(total);
  expect(w.piles.find(p=>p.id===stored.id)?.quantity??0).toBe(40-quote.net);
  expect(silver(w).filter(p=>p.owner.type==='inventory').reduce((n,p)=>n+p.quantity,0)).toBe(merchant+quote.net);
  expect(w.trade!.bought.medicine).toBe(1);expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});

test('strict242 migration preserves currency, deep silver and both maps without generating a surface vein',()=>{
  const {w}=preparedCassandraExpedition();addGroundMaterial(w,'silver',40,{x:4,z:4},'silver');
  adoptDeepResources(w);expect(addDeepDeposit(w,'silver',[{x:5,z:5}])).toBe(1);
  const old=historical242(w),migrated=deserializeWorld(JSON.stringify(old));
  expect(migrated).toEqual({...old,schemaVersion:SCHEMA_VERSION});
  for(const where of ['home','secondary'] as const){
    const bad=structuredClone(old),map=where==='home'?bad:bad.secondarySite!.map;
    map.tiles[0]={terrain:'rock',stone:'granite',ore:'silver'};
    expect(()=>deserializeWorld(JSON.stringify(bad))).toThrow(/version242/);
  }
  const malformed=structuredClone(old);malformed.secondarySite!.map.tiles[0]={terrain:'rock',ore:'gold',miningDamage:1520};
  expect(()=>deserializeWorld(JSON.stringify(malformed))).toThrow(/version242/);
});

test('surface silver survives confirmed checkpoint/delta and historical future ore is rejected without replacing the current view',()=>{
  const w=miningCamp(),cell=11*w.width+11,encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder();
  expect(decoder.adopt(structuredClone(encoder.encode(w,0,1))).status).toBe('applied');
  w.tiles[cell]={terrain:'rock',stone:'granite',ore:'silver',miningDamage:80,miningYield:80/1500};
  const delta=structuredClone(encoder.encode(w,0,1));expect(delta.kind).toBe('delta');
  const adopted=decoder.adopt(delta);expect(adopted.status).toBe('applied');if(adopted.status!=='applied')throw Error('Expected delta');expect(adopted.world.tiles[cell]).toEqual(w.tiles[cell]);
  const checkpoint=structuredClone(new SnapshotEncoder().encode(w,0,1));(checkpoint.world as {schemaVersion:number}).schemaVersion=242;
  expect(new SnapshotDecoder().adopt(checkpoint).status).toBe('resync');
  const old=historical242(miningCamp()),historicalEncoder=new SnapshotEncoder(),historicalDecoder=new SnapshotDecoder();
  const base=structuredClone(historicalEncoder.encode(old,0,1)),shown=historicalDecoder.adopt(base);expect(shown.status).toBe('applied');if(shown.status!=='applied')throw Error('Historical checkpoint');const prior=structuredClone(shown.world.tiles[cell]);
  old.tiles[cell]={terrain:'rock',stone:'granite',ore:'silver'};
  expect(historicalDecoder.adopt(structuredClone(historicalEncoder.encode(old,0,1))).status).toBe('resync');
  expect(shown.world.tiles[cell]).toEqual(prior);
});
