import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization';
import {addMaterial,refreshStock} from '../src/sim/materials';
import {constructFreshInitialWildAnimal256} from '../src/sim/initial-animal-constructor-256';
import {INITIAL_ANIMAL_FACTS_256} from '../src/sim/initial-animal-data-256';
import {WorldGenerationRandom} from '../src/sim/world-generation-random';
import {enableWildlife} from '../src/sim/wildlife';
import {TAMENESS_DECAY} from '../src/sim/animal-handling';
import {animalNutritionMax} from '../src/sim/animal-life';
import {eggBoxContent374,eggBoxLayChoice374} from '../src/sim/egg-box-374';
import {EGG_BOX_374,EGG_BOX_EXTRACT_TICKS_374} from '../src/sim/egg-box-state-374';
import {eggBoxInspection374Text} from '../src/ui/egg-box-inspection-374';
import {constructionRecipe,validConstructionMaterial} from '../src/sim/construction-materials';
import {STRUCTURE_DEFINITIONS} from '../src/sim/definitions';
import {structureMaxHp} from '../src/sim/thing-damage-rules';
import {groupPackedMassGrams258} from '../src/sim/group-freight-mass-258';
import {architectToolAvailable} from '../src/ui/architect-availability';
import {apparelPolicyAllows,chooseApparelReplacement,DEFAULT_APPAREL_POLICY,type ApparelPolicy} from '../src/sim/apparel-policy';
import {newApparelState,type ApparelItem} from '../src/sim/apparel-rules';
import {countedApparelProducts278,newApparelCountFilter278,validApparelCountFilter278} from '../src/sim/apparel-count-278';
import {newCookingBill} from '../src/sim/cooking-bills';
import {deconstructionCamp} from './scenarios/deconstruction';
import {asNumberOnly,asOldSchema} from './scenarios/old-schema';
import {SCHEMA_VERSION,type Command,type MaterialPile,type Pawn,type Structure,type World} from '../src/sim/types';
import type {WildAnimal} from '../src/sim/wildlife-state';

/** Declared fixture: the 32² legacy camp of the deconstruction tests, one
 * free colonist (Transport, Construction), a few storage cells and one tame
 * adult female turkey made by the ordinary initial-animal constructor. Her
 * egg progress is set ready to lay; everything after is played by stepWorld. */
const valid=(w:World)=>expect(validateWorld(w),`tick ${w.tick}`).toEqual([]);
function until(w:World,done:()=>boolean,limit=1500,check=true):number {let i=0;for(;i<limit&&!done();i++){stepWorld(w);if(check)valid(w);}expect(done(),`after ${i} steps`).toBe(true);return i;}
const ok=(w:World,c:Command)=>expect(applyCommand(w,c),JSON.stringify(c)).toMatchObject({ok:true});
const eggsOf=(w:World)=>w.piles.filter(p=>p.item.startsWith('turkey-egg'));
const totalEggs=(w:World)=>eggsOf(w).reduce((n,p)=>n+p.quantity,0);
function camp(){
 const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
 w.stockpiles=[];w.growingZones=[];w.packed=[];delete w.wildlife;delete w.raids;delete w.arrivals;delete w.heatwaves;
 Object.assign(pawn,{name:'Porteuse',x:6,z:6,hunger:100,rest:100});pawn.recreation.level=100;pawn.apparelAutomation=false;
 for(const key of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[key]=0;
 pawn.priorities.haul=1;pawn.priorities.build=1;
 // The stream seed+1 of the ordinary constructor draws an adult female (seed 42 a male).
 const random=new WorldGenerationRandom(w.seed+1),made=constructFreshInitialWildAnimal256({fact:INITIAL_ANIMAL_FACTS_256.Turkey,id:w.nextId,cell:{x:20,z:20},tick:w.tick,random});
 if(made.status!=='ready')throw Error(made.reason);
 const hen=made.animal;w.nextId++;
 if(hen.sex!=='female'||!hen.eggLayer||hen.health)throw Error('Declared hen stream changed.');
 hen.domestic={since:w.tick,care:'herbal',tameness:5,nextDecay:w.tick+TAMENESS_DECAY};
 enableWildlife(w,0);w.wildlife!.animals.push(hen);
 for(const [x,z] of [[4,26],[5,26],[6,26]] as const)ok(w,{type:'stockpile',x,z,enabled:true,filters:{wood:true,food:true}});
 refreshStock(w);
 return {w,pawn,hen};
}
function box(w:World,x:number,z:number,material:'wood'|'steel'='wood'):Structure {
 const s={id:w.nextId++,kind:'egg-box',x,z,orientation:0,footprint:'standard',material} as Structure;w.structures.push(s);return s;
}
function fill(w:World,s:Structure,quantity:number,item='turkey-egg-unfertilized'):MaterialPile {
 const pile={id:w.nextId++,kind:'food',item,quantity,owner:{type:'egg-box374',structureId:s.id},rot:{progress:0,atTick:w.tick}} as MaterialPile;w.piles.push(pile);return pile;
}
const ready=(hen:WildAnimal)=>{hen.eggLayer!.progress=1;hen.food=animalNutritionMax(hen);hen.rest=1;hen.nextDecision=0;};

test('a tame hen walks to the egg box, waits on it and lays inside; the inspector shows the content',()=>{
 const {w,hen}=camp(),b=box(w,24,22);ready(hen);
 const choice=eggBoxLayChoice374(w,hen,'turkey-egg-unfertilized');
 expect(choice?.goals).toEqual([{x:24,z:22}]);
 until(w,()=>!!eggBoxContent374(w,b.id));
 const pile=eggBoxContent374(w,b.id)!;
 expect(pile.owner).toEqual({type:'egg-box374',structureId:b.id});
 expect(pile.quantity).toBe(1);expect(pile.item).toBe('turkey-egg-unfertilized');
 expect(eggsOf(w).filter(p=>p.owner.type==='ground')).toEqual([]);
 expect(hen.x===b.x&&hen.z===b.z).toBe(true);
 expect(eggBoxInspection374Text(w,b)).toContain('× 1 / 25');
});

const inStorage=(w:World,p:MaterialPile)=>p.owner.type==='ground'&&w.stockpiles.some(z=>z.x===(p.owner as {x:number}).x&&z.z===(p.owner as {z:number}).z);
test('a full box is skipped: she lays on the ground; a box full on arrival makes her lay beside it',()=>{
 const {w,hen,pawn}=camp(),b=box(w,24,22);fill(w,b,EGG_BOX_374.stackLimit);ready(hen);pawn.priorities.haul=0;
 expect(eggBoxLayChoice374(w,hen,'turkey-egg-unfertilized')).toBeUndefined();
 until(w,()=>eggsOf(w).some(p=>p.owner.type==='ground'));
 expect(eggBoxContent374(w,b.id)!.quantity).toBe(25);
 // The box accepted her at the choice, then filled before she laid.
 const second=camp(),b2=box(second.w,24,22);fill(second.w,b2,24);ready(second.hen);second.pawn.priorities.haul=0;
 until(second.w,()=>second.hen.eggLay?.box374===b2.id);
 eggBoxContent374(second.w,b2.id)!.quantity=25;
 until(second.w,()=>eggsOf(second.w).some(p=>p.owner.type==='ground'));
 const ground=eggsOf(second.w).find(p=>p.owner.type==='ground')!,cell=ground.owner as {x:number;z:number};
 expect(Math.max(Math.abs(cell.x-24),Math.abs(cell.z-22))).toBe(1);
 expect(eggBoxContent374(second.w,b2.id)!.quantity).toBe(25);
});

test('a hauler empties a box of 20 eggs: touch, 120 Core ticks, drop near, then carries to storage; eggs are conserved',()=>{
 const {w,pawn}=camp(),b=box(w,10,8),pile=fill(w,b,20);
 expect(totalEggs(w)).toBe(20);
 until(w,()=>pawn.haul?.eggBox374!==undefined);
 expect(pawn.haul).toMatchObject({sourcePileId:pile.id,quantity:10,phase:'pickup',destination:{type:'stockpile'}});
 const at=w.tick;let dropped=-1;
 until(w,()=>{if(dropped<0&&pile.owner.type==='ground')dropped=w.tick;return eggsOf(w).some(p=>inStorage(w,p));});
 expect(dropped-at).toBeGreaterThanOrEqual(EGG_BOX_EXTRACT_TICKS_374);
 expect(eggBoxContent374(w,b.id)).toBeUndefined();
 expect(totalEggs(w)).toBe(20);
 // Beyond the carry of ten, the rest lies near the box and is hauled like any item.
 until(w,()=>eggsOf(w).every(p=>inStorage(w,p)),3000);
 expect(totalEggs(w)).toBe(20);
});

test('below the threshold the box is not emptied; a deconstructed box drops its eggs near its cell, same identity',()=>{
 const {w,pawn}=camp(),b=box(w,10,8),pile=fill(w,b,19);
 for(let i=0;i<200;i++){stepWorld(w);valid(w);}
 expect(pawn.haul).toBeNull();expect(eggBoxContent374(w,b.id)).toBe(pile);
 ok(w,{type:'designate',kind:'deconstruct',x:10,z:8,targetId:b.id});
 until(w,()=>!w.structures.some(s=>s.id===b.id),3000);
 expect(w.piles.find(p=>p.id===pile.id)?.owner.type).toBe('ground');
 expect(w.piles.find(p=>p.id===pile.id)?.quantity).toBe(19);
});

test('the egg box has the Core EggBox facts and is built from Architect with 20 wood; nothing before 374',()=>{
 expect(EGG_BOX_374).toMatchObject({stuff:20,coreWork:2000,maxHitPoints:50,mass:3,stackLimit:25,minCountToEmpty:20,maxSearchRadius:30,layCoreTicks:500,extractCoreTicks:120});
 expect(constructionRecipe({kind:'egg-box',material:'wood'})).toEqual({ingredients:[{item:'wood',quantity:20}],work:140,coreWork:1400});
 expect(constructionRecipe({kind:'egg-box',material:'steel'})).toEqual({ingredients:[{item:'steel',quantity:20}],work:200,coreWork:2000});
 expect(['wood','steel','granite-blocks','cloth'].map(m=>validConstructionMaterial('egg-box',m,374))).toEqual([true,true,false,false]);
 expect(validConstructionMaterial('egg-box','wood',373)).toBe(false);
 expect(STRUCTURE_DEFINITIONS['egg-box']).toMatchObject({width:1,depth:1,blocksMovement:false});
 expect(structureMaxHp({kind:'egg-box',material:'steel'} as Structure)).toBe(50);
 expect(groupPackedMassGrams258({building:{kind:'egg-box'}} as never,374)).toBe(3000);
 const {w,pawn}=camp();delete w.wildlife;pawn.priorities.haul=0;
 expect(architectToolAvailable(w,'egg-box')).toBe(true);
 addMaterial(w,'wood',20,{type:'ground',x:8,z:10},'wood');refreshStock(w);
 const old=structuredClone(w);(old as {schemaVersion:number}).schemaVersion=373;
 const before=JSON.stringify(old);expect(applyCommand(old,{type:'designate',kind:'egg-box',material:'wood',x:12,z:10}).ok).toBe(false);expect(JSON.stringify(old)).toBe(before);
 expect(architectToolAvailable(old,'egg-box')).toBe(false);
 ok(w,{type:'designate',kind:'egg-box',material:'wood',x:12,z:10});
 until(w,()=>w.structures.some(s=>s.kind==='egg-box'),4000);
 expect(w.structures.find(s=>s.kind==='egg-box')).toMatchObject({x:12,z:10,material:'wood',footprint:'standard'});
 expect(w.piles.filter(p=>p.item==='wood').reduce((n,p)=>n+p.quantity,0)).toBe(0);
});

const shirt=(w:World,p:Pawn,tainted:boolean,owner:MaterialPile['owner']={type:'apparel',pawnId:p.id}):MaterialPile=>{
 const id=w.nextId;addMaterial(w,'apparel',1,owner,'cloth-shirt');const pile=w.piles.find(q=>q.id===id)!;pile.apparel!.corpseWear284=tainted;return pile;
};
test('the tainted apparel filter of a policy: Core default allowed, refused on demand, copied, and respected by automatic dressing',()=>{
 const garment=(id:number,tainted:boolean)=>({id,item:'cloth-shirt' as ApparelItem,apparel:{...newApparelState('cloth-shirt' as ApparelItem,undefined,374),corpseWear284:tainted}});
 const refusing:ApparelPolicy={...DEFAULT_APPAREL_POLICY,taintedAllowed374:false};
 expect(apparelPolicyAllows(DEFAULT_APPAREL_POLICY,garment(1,true))).toBe(true);
 expect(apparelPolicyAllows(refusing,garment(1,true))).toBe(false);
 expect(apparelPolicyAllows(refusing,garment(1,false))).toBe(true);
 // A worn tainted piece not allowed is taken off; a tainted candidate is never chosen.
 expect(chooseApparelReplacement(refusing,[garment(1,true)],[])).toEqual({action:'remove',wornId:1,reason:'policy'});
 expect(chooseApparelReplacement(refusing,[],[{...garment(2,true),stored:true,reachable:true,reserved:false}])).toBeNull();
 const {w,pawn}=camp();delete w.wildlife;
 const worn=shirt(w,pawn,true);
 const policy=w.apparelPolicies!.find(p=>p.id===pawn.apparelPolicyId)!;
 expect(policy.taintedAllowed374).toBeUndefined();
 const update=(allowTainted374?:boolean):Command=>({type:'apparel-policy-update',policyId:policy.id,allowedItems:[...policy.allowedItems],allowedMaterials:[...policy.allowedMaterials],minQuality:policy.minQuality,maxQuality:policy.maxQuality,minHitPointsPercent:policy.minHitPointsPercent,maxHitPointsPercent:policy.maxHitPointsPercent,...allowTainted374===undefined?{}:{allowTainted374}} as Command);
 ok(w,update(false));
 expect(w.apparelPolicies!.find(p=>p.id===policy.id)!.taintedAllowed374).toBe(false);
 ok(w,update());expect(w.apparelPolicies!.find(p=>p.id===policy.id)!.taintedAllowed374).toBe(false);
 ok(w,{type:'apparel-policy-copy',policyId:policy.id,label:'Sans vêtements de mort'} as Command);
 expect(w.apparelPolicies!.at(-1)).toMatchObject({label:'Sans vêtements de mort',taintedAllowed374:false});
 valid(w);
 expect(deserializeWorld(serializeWorld(w)).apparelPolicies!.find(p=>p.id===policy.id)!.taintedAllowed374).toBe(false);
 // Strict below 374: the field and the command field are refused.
 expect(deserializeWorld(asOldSchema(serializeWorld(w),373)).apparelPolicies!.every(p=>!Object.hasOwn(p,'taintedAllowed374'))).toBe(true);
 const raw=JSON.parse(serializeWorld(w)) as {schemaVersion:number};raw.schemaVersion=373;
 expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow(/373/);
 // The colonist takes the tainted shirt off by itself.
 pawn.apparelAutomation=true;pawn.nextApparelCheckAt=w.tick;
 until(w,()=>!(worn.owner.type==='apparel'&&worn.owner.pawnId===pawn.id),600);
 expect(worn.apparel!.corpseWear284).toBe(true);
 ok(w,update(true));expect(Object.hasOwn(w.apparelPolicies!.find(p=>p.id===policy.id)!,'taintedAllowed374')).toBe(false);
});

test('bills counting apparel: Core includeTainted, false on a new bill; an older filter keeps its count',()=>{
 const {w,pawn}=camp();delete w.wildlife;
 shirt(w,pawn,false,{type:'ground',x:4,z:26});shirt(w,pawn,true,{type:'ground',x:5,z:26});
 const bill=newCookingBill(w.nextId++,'shirt',SCHEMA_VERSION);
 expect(bill.apparelCount).toEqual({...newApparelCountFilter278(373),includeTainted374:false});
 expect(newApparelCountFilter278(373)).toEqual({hpMin:0,hpMax:100,qualityMin:'awful',qualityMax:'legendary',includeEquipped:false});
 expect(countedApparelProducts278(w,bill)).toBe(1);
 bill.apparelCount!.includeTainted374=true;expect(countedApparelProducts278(w,bill)).toBe(2);
 const legacy=newCookingBill(w.nextId++,'shirt',373);
 expect(Object.hasOwn(legacy.apparelCount!,'includeTainted374')).toBe(false);
 expect(countedApparelProducts278(w,legacy)).toBe(2);
 expect(validApparelCountFilter278({...newApparelCountFilter278(),includeTainted374:false},373)).toBe(false);
 expect(validApparelCountFilter278({...newApparelCountFilter278(),includeTainted374:false},374)).toBe(true);
 expect(validApparelCountFilter278({...newApparelCountFilter278(),includeTainted374:1},374)).toBe(false);
});

test('fertilized eggs keep incubating in the box: new eggs join the stack, then the chicks hatch around the box',()=>{
 const {w,hen,pawn}=camp(),b=box(w,24,22);pawn.priorities.haul=0;
 hen.eggLayer!.fertilizations=1;hen.eggLayer!.fatherId=hen.id-1;ready(hen);
 until(w,()=>!!eggBoxContent374(w,b.id));
 const pile=eggBoxContent374(w,b.id)!;
 expect(pile.item).toBe('turkey-egg-fertilized');expect(pile.egg).toMatchObject({motherId:hen.id,faction:'player',atTick:w.tick});
 const before=pile.egg!.progress;stepWorld(w);valid(w);expect(pile.egg!.progress).toBeGreaterThan(before);
 const animals=w.wildlife!.animals.length;pile.egg!.progress=1;
 until(w,()=>!w.piles.includes(pile),20);
 const chicks=w.wildlife!.animals.slice(animals);
 expect(chicks).toHaveLength(1);
 expect(Math.max(Math.abs(chicks[0]!.x-24),Math.abs(chicks[0]!.z-22))).toBeLessThanOrEqual(3);
 expect(chicks[0]!.domestic).toBeDefined();
});

test('save and reload while a hen walks to the box and while a hauler extracts: the continuation is identical',()=>{
 const {w,hen,pawn}=camp(),b=box(w,24,22);fill(w,b,19);ready(hen);pawn.priorities.haul=0;
 until(w,()=>hen.eggLay?.box374===b.id&&hen.path.length>2);
 let copy=deserializeWorld(serializeWorld(w));
 for(let i=0;i<120;i++){stepWorld(w);stepWorld(copy);}
 expect(serializeWorld(copy)).toBe(serializeWorld(w));
 expect(eggBoxContent374(w,b.id)!.quantity).toBe(20);
 pawn.priorities.haul=1;
 until(w,()=>(pawn.haul?.eggBox374??0)>=5);
 copy=deserializeWorld(serializeWorld(w));
 for(let i=0;i<80;i++){stepWorld(w);stepWorld(copy);}
 expect(serializeWorld(copy)).toBe(serializeWorld(w));
 expect(totalEggs(w)).toBe(20);
});

test('strict saves: egg box content, laying target and extraction are refused before 374 and when malformed',()=>{
 const {w,hen}=camp(),b=box(w,24,22);const pile=fill(w,b,3);valid(w);
 const bad=(mutate:(raw:World)=>void)=>{const raw=JSON.parse(serializeWorld(w)) as World;mutate(raw);return validateWorld(raw);};
 expect(bad(raw=>{raw.piles.find(p=>p.id===pile.id)!.quantity=28;})).toContain('Invalid egg box content.');
 expect(bad(raw=>{raw.piles.find(p=>p.id===pile.id)!.item='wood' as never;})).not.toEqual([]);
 expect(bad(raw=>{raw.piles.push({...raw.piles.find(p=>p.id===pile.id)!,id:raw.nextId++});})).toContain('Egg box holds several stacks.');
 expect(bad(raw=>{raw.structures=raw.structures.filter(s=>s.id!==b.id);})).toContain('Egg box content without its installed box.');
 expect(bad(raw=>{(raw.piles.find(p=>p.id===pile.id)! as {owner:unknown}).owner={type:'egg-box374',structureId:b.id,extra:1};})).not.toEqual([]);
 expect(bad(raw=>{raw.wildlife!.animals.find(a=>a.id===hen.id)!.eggLay={target:{x:3,z:3},progress:0,box374:b.id};raw.wildlife!.animals.find(a=>a.id===hen.id)!.eggLayer!.progress=1;})).toContain('Invalid egg box laying target.');
 expect(bad(raw=>{raw.pawns[0]!.haul={sourcePileId:pile.id,quantity:3,phase:'pickup',destination:{type:'stockpile',stockpileId:raw.stockpiles[0]!.id},carryPileId:null,eggBox374:12};})).toContain('Invalid egg box extraction.');
 expect(bad(raw=>{raw.pawns[0]!.haul={sourcePileId:pile.id,quantity:3,phase:'pickup',destination:{type:'stockpile',stockpileId:raw.stockpiles[0]!.id},carryPileId:null};})).toContain('Egg box eggs hauled without extraction.');
 // Before 374 the box itself is refused: the migration validates the 373 save first.
 const raw=JSON.parse(serializeWorld(w)) as {schemaVersion:number};raw.schemaVersion=373;
 expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow(/373/);
});

test('373 → 374 changes the number only; below 374 a tame hen ignores an egg box exactly as if there were none',()=>{
 const {w}=camp();
 const plain=serializeWorld(w);
 expect(serializeWorld(deserializeWorld(asOldSchema(plain,373)))).toBe(asNumberOnly(plain,373));
 expect(deserializeWorld(asOldSchema(plain,373)).schemaVersion).toBe(SCHEMA_VERSION);
 // Two identical 373 worlds, one with an egg box placed in it (a runtime world, never saved).
 const old=JSON.parse(asOldSchema(plain,373)) as World,withBox=structuredClone(old);
 const henOf=(x:World)=>x.wildlife!.animals[0]!;ready(henOf(old));ready(henOf(withBox));
 box(withBox,24,22);old.nextId=withBox.nextId;
 for(let i=0;i<400;i++){stepWorld(old);stepWorld(withBox);}
 expect(eggsOf(old).length).toBeGreaterThan(0);
 const strip=(x:World)=>JSON.stringify({...x,structures:x.structures.filter(s=>s.kind!=='egg-box')});
 expect(strip(withBox)).toBe(strip(old));
 expect(eggsOf(withBox).every(p=>p.owner.type==='ground')).toBe(true);
});

