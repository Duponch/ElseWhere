import {expect,test} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {APPAREL,APPAREL_MATERIALS,newApparelState,armorPiece,apparelDuration,apparelInsulation,apparelMoveFactor,conflictsWith,type ApparelItem} from '../src/sim/apparel-rules.ts';
import {SMITHING_APPAREL_ITEMS267,smithingApparelStuff267,smithingApparelUnits267,smithingApparelWorkCore267,smithingApparelBaseValue267,type SmithingApparel267} from '../src/sim/smithing-apparel-267.ts';
import {smithingUnits267,smithingWorkTicks267,smithingProduct267} from '../src/sim/smithing-content-267.ts';
import {createDefaultApparelPolicyRegistry,validApparelPolicy,apparelPolicyAllows,chooseApparelReplacement,APPAREL_POLICY_MATERIALS267} from '../src/sim/apparel-policy.ts';
import {validApparelShape} from '../src/sim/apparel-save.ts';
import {apparelProtection} from '../src/sim/apparel-protection.ts';
import {addMaterial,reservedSource} from '../src/sim/materials.ts';
import {pileMarketValue,tradeRefusal} from '../src/sim/trade-prices.ts';
import {commercialItemMassGrams,commercialPawnMass} from '../src/sim/commercial-mass.ts';
import {groupCaravanUnitMass256} from '../src/sim/group-caravan-mass-256.ts';
import {pileMaxHp,pileFlammability} from '../src/sim/thing-damage-rules.ts';
import {deteriorationExposure} from '../src/sim/deterioration-rules.ts';
import {advanceApparelWear} from '../src/sim/apparel-renewal.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import type {MaterialPile,World,WorkType} from '../src/sim/types.ts';

const pile=(item:ApparelItem,id=1):MaterialPile=>({id,item,kind:'apparel',quantity:1,owner:{type:'ground',x:3,z:4},apparel:newApparelState(item)});
const ROWS=[
 ['wood-plate-armor',188,170,26600,.486,.486,.36,300,15000,1],
 ['steel-plate-armor',290,170,38000,.81,.405,.54,460,15000,.4],
 ['plasteel-plate-armor',810,170,83600,1.026,.495,.585,1830,15000,0],
 ['uranium-plate-armor',725,170,72200,.972,.486,.585,1280,15000,0],
 ['silver-plate-armor',205,1700,38000,.648,.324,.324,1835,15000,.4],
 ['gold-plate-armor',174,1700,34200,.648,.324,.324,17125,15000,.4],
 ['steel-simple-helmet',100,40,3200,.45,.225,.3,87.52,2000,.4],
 ['plasteel-simple-helmet',280,40,7040,.57,.275,.325,385,2000,0],
 ['uranium-simple-helmet',250,40,6080,.54,.27,.325,260,2000,0],
 ['silver-simple-helmet',70,400,3200,.36,.18,.18,410,2000,.4],
 ['gold-simple-helmet',60,400,2880,.36,.18,.18,4010,2000,.4],
] as const;

test.each(ROWS)('%s preserves material-specific HP, protection, unrounded work/value, fixed mass and physical flammability',(item,hp,units,core,sharp,blunt,heat,market,mass,flammability)=>{
 const p=pile(item),d=APPAREL[item],recipe=item.endsWith('-plate-armor')?'make-plate-armor':'make-simple-helmet',stuff=smithingApparelStuff267(item);
 expect(d.stuff).toBe(stuff);expect(p.apparel).toEqual({quality:'normal',hitPoints:hp});expect(d.material).toBeUndefined();
 expect(validApparelShape(p as unknown as Record<string,unknown>,267)).toBe(true);expect(validApparelShape(p as unknown as Record<string,unknown>,266)).toBe(false);
 expect(smithingProduct267(recipe,stuff)).toBe(item);expect(smithingUnits267(recipe,stuff)).toBe(units);expect(smithingApparelUnits267(item)).toBe(units);
 expect(smithingWorkTicks267(recipe,stuff)*10).toBeCloseTo(core,8);expect(smithingApparelWorkCore267(item)).toBeCloseTo(core,8);
 expect(d.hitPoints).toBe(hp);expect(pileMaxHp(p)).toBe(hp);expect(pileMaxHp(p,266)).toBe(0);
 expect(armorPiece(p).ratings.sharp).toBeCloseTo(sharp,6);expect(armorPiece(p).ratings.blunt).toBeCloseTo(blunt,6);expect(armorPiece(p).ratings.heat).toBeCloseTo(heat,6);
 expect(pileMarketValue(p)).toBeCloseTo(market,6);expect(commercialItemMassGrams(item,267)).toBe(mass);expect(groupCaravanUnitMass256(item,true,267)).toBe(mass);
 expect(commercialItemMassGrams(item,266)).toBeUndefined();expect(groupCaravanUnitMass256(item,true,266)).toBeUndefined();expect(pileFlammability(p)).toBe(flammability);
 p.apparel!.quality='legendary';expect(p.apparel!.hitPoints).toBe(hp);expect(armorPiece(p).ratings.sharp).toBeCloseTo(Math.min(2,sharp*1.8),6);
 expect(apparelInsulation(p).cold).toBeCloseTo((item.endsWith('-plate-armor')?(stuff==='wood'?8:3):.45)*1.8,6);expect(apparelInsulation(p).heat).toBe(0);
 expect(commercialItemMassGrams(item,267)).toBe(mass);expect(tradeRefusal(p,'sell',0)).toBeUndefined();
});

test('armor Stuff does not admit textile recipes or enrich historical policy defaults; future filters remain strict',()=>{
 expect(APPAREL_MATERIALS).not.toContain('steel');expect(APPAREL_MATERIALS).not.toContain('wood');expect(Object.hasOwn(APPAREL,'steel-shirt')).toBe(false);
 expect(()=>smithingProduct267('make-simple-helmet','wood')).toThrow();expect(SMITHING_APPAREL_ITEMS267).toHaveLength(11);
 // Registries as at schemas 266/267: without the schema 308 leather and wool garments.
 const old=createDefaultApparelPolicyRegistry(true,true,true,true,true,false,false),current=createDefaultApparelPolicyRegistry(true,true,true,true,true,true,false);
 expect(old.apparelPolicies.every(p=>validApparelPolicy(p,266))).toBe(true);expect(old.apparelPolicies[0]!.allowedItems).not.toContain('steel-plate-armor');expect(old.apparelPolicies[0]!.allowedMaterials).not.toContain('steel');
 const policy=current.apparelPolicies[0]!,garment=pile('steel-plate-armor');
 expect(validApparelPolicy(policy,267)).toBe(true);expect(validApparelPolicy(policy,266)).toBe(false);expect(apparelPolicyAllows(policy,{...garment,item:'steel-plate-armor',apparel:garment.apparel!})).toBe(true);
 expect(apparelPolicyAllows({...policy,allowedMaterials:policy.allowedMaterials.filter(m=>m!=='steel')},{id:1,item:'steel-plate-armor',apparel:garment.apparel!})).toBe(false);
 expect(validApparelPolicy({...policy,allowedMaterials:[...APPAREL_POLICY_MATERIALS267,'jade'] as never},267)).toBe(false);
 const gold=pile('gold-plate-armor');gold.apparel!.quality='legendary';
 expect(pileMarketValue(gold)).toBe(20125);expect(smithingApparelBaseValue267('gold-plate-armor')).toBeCloseTo(17123.12,6);
});

/** Current small camp and finite prepared wardrobe; no clock jump, acquisition,
 * completed wear, damage or missing historical permission is invented. */
function camp(){
 const w=deconstructionCamp(2);w.stockpiles=[];w.packed=[];
 for(const p of w.pawns){for(const work of Object.keys(p.priorities) as WorkType[])p.priorities[work]=0;p.apparelAutomation=false;p.recreation.level=100;p.mood=90;delete p.background;delete p.traits;}
 return w;
}
function add(w:World,item:ApparelItem,worn=false){addMaterial(w,'apparel',1,worn?{type:'apparel',pawnId:w.pawns[0]!.id}:{type:'ground',x:3+w.piles.filter(p=>p.owner.type==='ground').length,z:4},item);return w.piles.at(-1)!;}
function exact(w:World){expect(validateWorld(w)).toEqual([]);const text=serializeWorld(w),copy=deserializeWorld(text);expect(serializeWorld(copy)).toBe(text);return copy;}

test('real timed replacement reserves one original, removes conflicting layers at contact, reloads mid-wear and preserves cloth/armor identity',()=>{
 const w=camp(),p=w.pawns[0]!,shirt=add(w,'cloth-shirt',true),pants=add(w,'cloth-pants',true),vest=add(w,'flak-vest',true),duster=add(w,'cloth-duster',true),plate=add(w,'steel-plate-armor'),helmet=add(w,'steel-simple-helmet');
 plate.apparel!.quality='excellent';plate.apparel!.hitPoints=211;helmet.apparel!.hitPoints=91;
 expect(conflictsWith(plate,shirt)).toBe(false);expect(conflictsWith(plate,pants)).toBe(false);expect(conflictsWith(plate,vest)).toBe(true);expect(conflictsWith(plate,duster)).toBe(true);
 expect(apparelDuration(w,p,plate,'wear')).toBe(138);expect(applyCommand(w,{type:'order-equipment',pawnId:p.id,itemId:plate.id,action:'wear',queue:false}).ok).toBe(true);
 expect(reservedSource(w,plate.id)).toBe(1);expect(applyCommand(w,{type:'order-equipment',pawnId:w.pawns[1]!.id,itemId:plate.id,action:'wear',queue:false}).ok).toBe(false);
 for(let i=0;i<300&&(p.equipmentTask?.progress??0)<20;i++)stepWorld(w);
 expect(p.equipmentTask?.progress).toBe(20);expect(plate.owner.type).toBe('ground');expect(duster.owner.type).toBe('ground');expect(vest.owner.type).toBe('apparel');
 if(plate.owner.type!=='ground')throw Error('Actual garment ground owner missing');expect(Math.abs(p.x-plate.owner.x)+Math.abs(p.z-plate.owner.z)).toBeLessThanOrEqual(1);
 const copy=exact(w),cp=copy.pawns.find(a=>a.id===p.id)!,rng=w.rng,next=w.nextId;
 for(let i=0;i<180&&w.piles.find(a=>a.id===plate.id)!.owner.type!=='apparel';i++){stepWorld(w);stepWorld(copy);}
 expect(plate.owner).toEqual({type:'apparel',pawnId:p.id});expect(serializeWorld(copy)).toBe(serializeWorld(w));expect(cp.equipmentTask).toBeUndefined();
 expect(plate.apparel).toEqual({quality:'excellent',hitPoints:211,forced:true});expect(w.piles.find(i=>i.id===vest.id)).toBe(vest);expect(vest.owner.type).toBe('ground');
 expect(shirt.owner.type).toBe('apparel');expect(pants.owner.type).toBe('apparel');expect(w.rng).toBe(rng);expect(w.nextId).toBe(next);expect(apparelMoveFactor(w,p)).toBeCloseTo(3.8/4.6);
 expect(commercialPawnMass(p,w.piles,w.schemaVersion)!.grams).toBe(15800);
 expect(applyCommand(w,{type:'order-equipment',pawnId:p.id,itemId:helmet.id,action:'wear',queue:false}).ok).toBe(true);
 for(let i=0;i<80&&helmet.owner.type!=='apparel';i++)stepWorld(w);expect(helmet.owner.type).toBe('apparel');expect(helmet.apparel!.hitPoints).toBe(91);
 const policy=createDefaultApparelPolicyRegistry(true,true,true,true,true,true).apparelPolicies[0]!;
 expect(chooseApparelReplacement({...policy,allowedItems:policy.allowedItems.filter(i=>i!==plate.item)},[{id:plate.id,item:plate.item as SmithingApparel267,apparel:plate.apparel!}],[])).toBeNull();
 const full=new SnapshotEncoder().encode(w,0,0),adopted=new SnapshotDecoder().adopt(structuredClone(full));expect(adopted.status).toBe('applied');exact(w);
});

test('protection covers shoulders/legs but not hands/feet or the face; HP wear and outdoor deterioration use the original instance',()=>{
 const w=camp(),p=w.pawns[0]!,plate=add(w,'plasteel-plate-armor',true),helmet=add(w,'steel-simple-helmet',true),hp=plate.apparel!.hitPoints;
 expect(APPAREL[plate.item as ApparelItem].coverage.parts).toContain('left-shoulder');expect(APPAREL[plate.item as ApparelItem].coverage.parts).toContain('left-leg');
 for(const part of ['left-hand','left-foot'] as const)expect(APPAREL[plate.item as ApparelItem].coverage.parts).not.toContain(part);
 expect(APPAREL[helmet.item as ApparelItem].coverage.parts).not.toContain('nose');expect(APPAREL[helmet.item as ApparelItem].coverage.parts).not.toContain('jaw');
 const protection=apparelProtection(w,p,'sharp',0,()=>0);expect(protection.protect!('torso',12).amount).toBe(0);expect(plate.apparel!.hitPoints).toBe(hp);protection.commit();expect(plate.apparel!.hitPoints).toBe(hp-3);
 expect(armorPiece(plate).ratings).toEqual(armorPiece({...plate,apparel:{...plate.apparel!,hitPoints:1}}).ratings);
 const wear=advanceApparelWear({nextWearAt:6000,rng:1},6000,[{id:plate.id,apparel:plate.apparel!}]);expect(wear.changes[0]!.id).toBe(plate.id);expect(wear.changes[0]!.remaining).toBeLessThan(plate.apparel!.hitPoints);
 const exposed=pile('wood-plate-armor');expect(deteriorationExposure(w,exposed).baseRate).toBe(2);expect(deteriorationExposure({...w,schemaVersion:266 as World['schemaVersion']},exposed).status).toBe('out-of-scope');
 exact(w);
});
