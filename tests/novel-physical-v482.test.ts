import {expect,test} from 'vitest';
import {copyNovelBook295,generateNovelBook295,isNovelBook295,novelJoyFactor295,NOVEL_JOY_FACTORS_295} from '../src/sim/book-state-295.ts';
import {WEAPON_QUALITIES} from '../src/sim/equipment-rules.ts';
import {ITEM_DEFINITIONS,legacyItem} from '../src/sim/items.ts';
import {orbitalStock,orbitalRandom} from '../src/sim/orbital-stock.ts';
import {createOrbitalShip} from '../src/sim/orbital.ts';
import {orbitalDraftPiles,orbitalTake} from '../src/sim/orbital-transfer.ts';
import {orbitalItemRefusal,quoteOrbitalTrade} from '../src/sim/orbital-rules.ts';
import {tradeRefusal,pileMarketValue,tradeUnitPrice} from '../src/sim/trade-prices.ts';
import {commercialItemMassGrams} from '../src/sim/commercial-mass.ts';
import {copyPileCondition} from '../src/sim/pile-condition.ts';
import {addMaterial,addGroundMaterial,depositMaterialPart,transferPile,materialCanFit,reservedSource,reservedSourcesByPile} from '../src/sim/materials.ts';
import {pileMaxHp,pileFlammability} from '../src/sim/thing-damage-rules.ts';
import {damagePile} from '../src/sim/thing-damage.ts';
import {DETERIORATION_RATES} from '../src/sim/deterioration-content.ts';
import {deteriorationExposure} from '../src/sim/deterioration-rules.ts';
import {storageConditionAccepts,storageConditionKey} from '../src/sim/storage-condition.ts';
import {colonyWealth} from '../src/sim/colony-wealth.ts';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {emptyLandscape} from '../src/sim/generation.ts';
import {prepareNovelScenario482,purchaseNovelScenario482} from './scenarios/novel-v482.ts';
import type {NovelBook295} from '../src/sim/book-state-295.ts';
import type {MaterialPile,World,Command,MaterialOwner} from '../src/sim/types.ts';
import type {OrbitalKind,OrbitalShip} from '../src/sim/orbital-state.ts';

const book=(quality:NovelBook295['quality']='normal'):NovelBook295=>({...generateNovelBook295(101,()=>.5),quality});
const original=(id=101):MaterialPile=>({id,item:'novel',kind:'book',quantity:1,owner:{type:'ground',x:4,z:4},book:book()});
function command(w:World,c:Command){const r=applyCommand(w,c);if(!r.ok)throw Error(`${c.type}: ${r.reason}`);}
function until(w:World,done:()=>boolean,limit=400){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done()).toBe(true);}
const purchase=()=>purchaseNovelScenario482(32,'bulk',false);
const landed=()=>purchaseNovelScenario482();

test('Novel state has its own data-only metadata, seven joy qualities and one generic HP authority',()=>{
 expect(ITEM_DEFINITIONS.novel).toMatchObject({kind:'book',stackLimit:1,nutrition:0});
 const p=original();expect(isNovelBook295(p.book)).toBe(true);expect(p.weapon).toBeUndefined();expect(p.apparel).toBeUndefined();
 expect(pileMaxHp(p,295)).toBe(60);expect(pileMaxHp(p,294)).toBe(0);expect(pileFlammability(p)).toBe(1);
 expect(commercialItemMassGrams('novel',295)).toBe(500);expect(commercialItemMassGrams('novel',294)).toBeUndefined();
 expect(WEAPON_QUALITIES.map(novelJoyFactor295)).toEqual(NOVEL_JOY_FACTORS_295);
 expect(()=>legacyItem('book')).toThrow();
});

test('strict metadata guard rejects future fields and accessors without reading them',()=>{
 let gets=0;const accessor={...book()};Object.defineProperty(accessor,'title',{enumerable:true,get(){gets++;return 'Unsafe';}});
 const hidden={...book()};Object.defineProperty(hidden,'title',{value:'Hidden',enumerable:false});
 const values=[null,[],{...book(),revision:2},{...book(),title:' '},{...book(),title:'A\nB'},{...book(),description:''},{...book(),quality:'fine'},{...book(),hitPoints:60},{...book(),quest:true},{...book(),[Symbol('future')]:true},accessor,hidden,Object.assign(Object.create({future:true}),book())];
 for(const value of values)expect(isNovelBook295(value)).toBe(false);
 expect(gets).toBe(0);expect(isNovelBook295(Object.assign(Object.create(null),book()))).toBe(true);
});

test('commercial generation consumes exactly two private draws and persists original identity-derived fiction',()=>{
 const qualities=[];
 for(const [u,v] of [[.5,0],[Math.exp(-2),.25],[Math.exp(-2),.75],[1/4294967296,.25]] as const){let calls=0;const draws=[u,v];const b=generateNovelBook295(55,()=>draws[calls++]!);expect(calls).toBe(2);expect(isNovelBook295(b)).toBe(true);qualities.push(b.quality);}
 expect(qualities).toEqual(['normal','excellent','normal','masterwork']);
 const first=generateNovelBook295(55,()=>.5),same=generateNovelBook295(55,()=>.5),other=generateNovelBook295(56,()=>.5);
 expect(first).toEqual(same);expect([other.title,other.description]).not.toEqual([first.title,first.description]);
 const copied=copyNovelBook295(first);expect(copied).toEqual(first);expect(copied).not.toBe(first);
 let calls=0;expect(()=>generateNovelBook295(0,()=>{calls++;return .5;})).toThrow();expect(calls).toBe(0);
 expect(()=>generateNovelBook295(55,()=>1)).toThrow();
});

test.each(['bulk','exotic'] as const)('future %s stock appends one indivisible Novel after all historical draws and IDs',kind=>{
 // Historical stock-input witness only; World models schema295 to 337 (schema
 // 338 adds the orbital chemfuel, garments and prostheses, see trade-fidelity-338).
 const old={...emptyLandscape(482,32,32),schemaVersion:294} as unknown as World,current={...emptyLandscape(482,32,32),schemaVersion:337} as unknown as World;old.nextId=current.nextId=200;
 const ship:OrbitalShip={id:100,kind,name:'Declared stock fixture',arrivedAt:0,departAt:4000,announced:true},before=structuredClone(ship),a={rng:12345},b={rng:12345};
 const oldPiles=orbitalStock(old,ship,a),newPiles=orbitalStock(current,ship,b);
 expect(newPiles.slice(0,-1)).toEqual(oldPiles);expect(newPiles.at(-1)).toMatchObject({id:old.nextId,item:'novel',kind:'book',quantity:1,owner:{type:'orbital-ship',shipId:100}});
 expect(isNovelBook295(newPiles.at(-1)!.book)).toBe(true);expect(current.nextId).toBe(old.nextId+1);
 const expected={rng:a.rng};orbitalRandom(expected);orbitalRandom(expected);expect(b.rng).toBe(expected.rng);expect(old.rng).toBe(482);expect(current.rng).toBe(482);expect(ship).toEqual(before);
 expect(oldPiles.some(p=>p.item==='novel')).toBe(false);
});

test('book copies retain metadata and explicit zero damage without aliasing transactional drafts',()=>{
 const p={...original(),damage:0,forbidden:true as const},w=emptyLandscape(482,32,32);w.piles=[p];
 const condition=copyPileCondition(p);expect(condition).toEqual({forbidden:true,book:p.book,damage:0});expect(condition.book).not.toBe(p.book);
 const draft=orbitalDraftPiles(w);expect(draft).toEqual(w.piles);expect(draft[0]!.book).not.toBe(p.book);expect(draft[0]!.owner).not.toBe(p.owner);
 draft[0]!.book!.title='Titre différent';draft[0]!.damage=7;expect(p.book!.title).not.toBe('Titre différent');expect(p.damage).toBe(0);
});

test('an overflowing future stock refuses the whole ship without partial book, identities or RNG',()=>{
 const f=prepareNovelScenario482(),w=f.world;w.nextId=Number.MAX_SAFE_INTEGER-2;const before=JSON.stringify(w);
 expect(createOrbitalShip(w,'bulk')).toBeUndefined();expect(JSON.stringify(w)).toBe(before);
});

test('quality, damage, wealth and storage use the book state independently of merchant permissions',()=>{
 const p=original();for(let i=0;i<WEAPON_QUALITIES.length;i++){p.book=book(WEAPON_QUALITIES[i]!);expect(pileMarketValue(p)).toBe([80,120,160,200,240,400,800][i]);}
 p.book=book();p.damage=24;expect(pileMarketValue(p)).toBeCloseTo(80);expect(tradeUnitPrice(p,'buy',0)).toBe(112);
 expect(storageConditionAccepts({quality:{min:'good',max:'legendary'}},p)).toBe(false);
 expect(storageConditionAccepts({hitPoints:{min:60,max:60}},p)).toBe(true);expect(storageConditionAccepts({hitPoints:{min:61,max:100}},p)).toBe(false);
 const key=storageConditionKey(p);p.damage=25;expect(storageConditionKey(p)).not.toBe(key);p.damage=24;
 expect(tradeRefusal(p,'sell',0)).toMatch(/visiteur/i);
 const f=prepareNovelScenario482(),w=f.world,before=colonyWealth(w).items;const local={...p,id:w.nextId++,owner:{type:'ground' as const,x:4,z:4}};w.piles.push(local);expect(colonyWealth(w).items-before).toBeCloseTo(pileMarketValue(local)!);
 expect(pileMarketValue({...p,book:undefined})).toBeUndefined();expect(pileMarketValue({...p,damage:60})).toBeUndefined();expect(pileMarketValue({...p,apparel:{quality:'normal',hitPoints:60}})).toBeUndefined();
 for(const kind of ['bulk','exotic'] as OrbitalKind[]){const ship={...w.orbital!.ships[0]!,kind};expect(orbitalItemRefusal(p,'sell',w,ship)).toBeUndefined();expect(orbitalItemRefusal(p,'buy',w,ship)).toBeUndefined();}
});

test('ground and carried transfers retain the same original, cannot split, merge or mint a generic Novel',()=>{
 const f=prepareNovelScenario482(),w=f.world,p=w.pawns[0]!,one=original(w.nextId++),two={...original(w.nextId++),owner:{type:'ground' as const,x:5,z:4}};w.piles.push(one,two);
 const id=one.id,before=w.nextId;expect(transferPile(w,one,{type:'pawn',pawnId:p.id})).toBe(true);expect(w.nextId).toBe(before);expect(w.piles.find(p=>p.id===id)).toBe(one);
 expect(depositMaterialPart(w,one,{x:5,z:4},1)).toBe(false);expect(two.quantity).toBe(1);expect(one.owner).toEqual({type:'pawn',pawnId:p.id});
 expect(depositMaterialPart(w,one,{x:6,z:4},.5)).toBe(false);expect(depositMaterialPart(w,one,{x:6,z:4},1)).toBe(true);expect(one.id).toBe(id);expect(one.quantity).toBe(1);expect(w.nextId).toBe(before);
 const intact=JSON.stringify(w);for(const owner of [{type:'job',jobId:1},{type:'equipment',pawnId:p.id},{type:'apparel',pawnId:p.id},{type:'grave',graveId:1}] as MaterialOwner[])expect(transferPile(w,one,owner)).toBe(false);
 expect(()=>addMaterial(w,'book',1,{type:'ground',x:7,z:4},'novel')).toThrow(/original/i);expect(()=>addGroundMaterial(w,'book',1,{x:7,z:4},'novel')).toThrow(/original/i);expect(JSON.stringify(w)).toBe(intact);
 expect(materialCanFit(w,'book',1,{type:'ground',x:7,z:4},'novel')).toBe(false);
 w.nextId=Number.MAX_SAFE_INTEGER;expect(transferPile(w,one,{type:'pawn',pawnId:p.id})).toBe(true);expect(transferPile(w,one,{type:'ground',x:7,z:4})).toBe(true);expect(w.nextId).toBe(Number.MAX_SAFE_INTEGER);
});

test('direct orbital transfer refuses book fragmentation and invalid owners atomically',()=>{
 const f=prepareNovelScenario482(),w=f.world,pile=w.piles.find(p=>p.id===f.ids.bookId)!,before=JSON.stringify(w);
 expect(orbitalTake(w,pile.id,.5,{type:'ground',x:4,z:4})).toBe(false);
 for(const owner of [{type:'job',jobId:1},{type:'equipment',pawnId:f.ids.readerId},{type:'apparel',pawnId:f.ids.readerId},{type:'grave',graveId:1}] as MaterialOwner[])expect(orbitalTake(w,pile.id,1,owner)).toBe(false);
 expect(JSON.stringify(w)).toBe(before);const id=pile.id;expect(orbitalTake(w,id,1,{type:'ground',x:4,z:4})).toBe(true);expect(w.piles.find(p=>p.id===id)).toBe(pile);expect(pile.quantity).toBe(1);
});

test('environmental damage consumes the unique physical book without repair or copied HP fields',()=>{
 const f=prepareNovelScenario482(),w=f.world,pile=w.piles.find(p=>p.id===f.ids.bookId)!;
 expect(orbitalTake(w,pile.id,1,{type:'ground',x:4,z:4})).toBe(true);expect(DETERIORATION_RATES.novel).toBe(5);
 expect(deteriorationExposure(w,pile)).toMatchObject({baseRate:5,rate:5,status:'outside'});
 expect(damagePile(w,pile,7,'deterioration')).toBe(true);expect(pile.damage).toBe(7);expect(Object.hasOwn(pile.book!,'hitPoints')).toBe(false);
 expect(transferPile(w,pile,{type:'pawn',pawnId:f.ids.readerId})).toBe(true);expect(deteriorationExposure(w,pile).rate).toBe(0);expect(pile.damage).toBe(7);
 expect(damagePile(w,pile,53,'bullet')).toBe(true);expect(w.piles.some(p=>p.id===pile.id)).toBe(false);expect(w.destroyed!.items!.novel).toBe(1);
});

test('a real paid purchase, capsule, ordinary haul and reload keep the same Novel from stock to storage',()=>{
 const f=purchase(),w=f.world,id=f.ids.bookId,p=w.pawns.find(p=>p.id===f.ids.readerId)!;
 expect(w.piles.find(p=>p.id===id)!.owner.type).toBe('orbital-cargo');expect(w.piles.filter(p=>p.item==='silver'&&p.owner.type==='ground').reduce((n,p)=>n+p.quantity,0)).toBe(f.baseline.silver-f.paid);
 expect(deserializeWorld(serializeWorld(w))).toEqual(w);until(w,()=>w.orbital!.pending.length===0,20);
 const pile=w.piles.find(p=>p.id===id)!;expect(pile.owner.type).toBe('ground');expect(pile.book).toEqual(f.baseline.book);expect(p.skills.intellectual!.xp).toBe(f.baseline.intellectual!.xp);
 command(w,{type:'priority',pawnId:p.id,work:'haul',value:3});command(w,{type:'order-haul',pawnId:p.id,target:{type:'pile',pileId:id},queue:false});
 until(w,()=>p.haul?.phase==='deliver',300);expect(p.haul!.carryPileId).toBe(id);expect(w.piles.find(p=>p.id===id)!.owner).toEqual({type:'pawn',pawnId:p.id});
 until(w,()=>p.haul===null,500);expect(w.piles.find(p=>p.id===id)).toMatchObject({quantity:1,book:f.baseline.book,owner:{type:'ground',...f.cells.storage}});expect(w.piles.filter(p=>p.item==='novel')).toHaveLength(1);
 expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});

test('a changed saved book invalidates its quote while unchanged repeated quotes create no new book or draws',()=>{
 const f=prepareNovelScenario482(),w=f.world,p=w.pawns[0]!,id=f.ids.bookId;
 command(w,{type:'order-orbital-trade',pawnId:p.id,shipId:f.ids.shipId,consoleId:f.ids.consoleId});until(w,()=>p.orbitalTrade?.phase==='ready',200);
 const lines=[{pileId:id,quantity:1}],before=JSON.stringify(w),q=quoteOrbitalTrade(w,p.id,f.ids.shipId,lines),again=quoteOrbitalTrade(w,p.id,f.ids.shipId,lines);expect(again).toEqual(q);expect(JSON.stringify(w)).toBe(before);if(!q.ok)throw Error(q.reason);
 w.piles.find(p=>p.id===id)!.book!.description+=' Une annotation ancienne.';const changed=JSON.stringify(w);
 expect(applyCommand(w,{type:'orbital-trade-execute',pawnId:p.id,shipId:f.ids.shipId,lines,quote:q.signature,acceptShortfall:false}).ok).toBe(false);expect(JSON.stringify(w)).toBe(changed);
});

test('pickup reserves the single original in both material readers and releases the claim once carried',()=>{
 const f=landed(),w=f.world,p=w.pawns[0]!,id=f.ids.bookId;
 command(w,{type:'read-book-295',pawnId:p.id,bookId:id});expect(p.recreation.task?.activity).toBe('read');
 expect(reservedSource(w,id)).toBe(1);expect(reservedSourcesByPile(w).get(id)).toBe(1);expect(reservedSource(w,id,p.id)).toBe(0);expect(reservedSourcesByPile(w,p.id).get(id)).toBeUndefined();
 until(w,()=>p.recreation.task?.activity==='read'&&p.recreation.task.stage!=='pickup',400);
 expect(w.piles.find(p=>p.id===id)!.owner).toEqual({type:'pawn',pawnId:p.id});expect(reservedSource(w,id)).toBe(0);expect(reservedSourcesByPile(w).get(id)).toBeUndefined();
});
