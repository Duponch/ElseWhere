import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {RwsLocalCoordinates} from '../src/import/rimworld/local-coordinates.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {readRwsSave,readThing} from '../src/import/rimworld/rws-save.ts';
import type {ImportContext} from '../src/import/rimworld/convert.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {configureImportedBill,coreRecipe,importHaulDesignations,importProductionBills,importUnfinishedWorks} from '../src/import/rimworld/convert-production.ts';
import {storageSettingsFromCore,filterItemIds} from '../src/import/rimworld/colony-filters.ts';
import {importConstructionPlans} from '../src/import/rimworld/convert-construction.ts';
import {importAllowedAreas} from '../src/import/rimworld/convert-allowed-areas.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {createWorld,canDesignate} from '../src/sim/engine.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {groundCapacity} from '../src/sim/ground-placement.ts';
import {validateWorld} from '../src/sim/serialization.ts';
import {storageAccepts} from '../src/sim/storage-filters.ts';
import {smithingWorkTotal267} from '../src/sim/smithing-content-267.ts';

function context():ImportContext{
 const save=readRwsSave(readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8'));
 const map=save.maps[0]!,world=createWorld(5119,map.width,map.height);
 map.things.splice(0);map.areas.splice(0);
 return {save,map,w:world,notes:new ImportNotes(),geographic:false,thingIds:new Map(),coordinates:new RwsLocalCoordinates(map.width,map.height),blocked:new Set(),pendingChunks:[],
  index:c=>c.z*world.width+c.x,inside:c=>c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height} as ImportContext;
}
describe('RimWorld imported production orders',()=>{
 it('retains the Scribe zero for a completed repeat bill, worker assignment and exact radius',()=>{
  const bill=newCookingBill(8,'duster');
  const source=parseXml('<li><repeatMode>RepeatCount</repeatMode><pawnRestriction>Thing_Human41</pawnRestriction><allowedSkillRange>5~12</allowedSkillRange><ingredientSearchRadius>26.5</ingredientSearchRadius><suspended>True</suspended><storeMode>DropOnFloor</storeMode><ingredientFilter><allowedDefs><li>Cloth</li><li>WoolBison</li></allowedDefs></ingredientFilter><hpRange>0.6~1</hpRange><qualityRange>Good~Legendary</qualityRange><includeEquipped>True</includeEquipped></li>');
  configureImportedBill(bill,source,'Make_Apparel_Duster',new Map([['Human41',71]]));
  expect(bill).toMatchObject({mode:'times',target:0,suspended:true,worker:{pawnId:71,skillMin:5,skillMax:12},radius:26.5,destination:'drop',filters:{cloth:true,'bison-wool':true,'muffalo-wool':false},apparelCount:{hpMin:60,hpMax:100,qualityMin:'good',qualityMax:'legendary',includeEquipped:true,includeTainted374:false}});
  expect(validBillSettings(bill,bill.recipe)).toBe(true);
 });
 it('keeps stock targets and real hysteresis instead of restarting the automatic pause',()=>{
  const b=newCookingBill(9,'cook-fine-meal-bulk');
  configureImportedBill(b,parseXml('<li><repeatMode>TargetCount</repeatMode><targetCount>150</targetCount><pauseWhenSatisfied>True</pauseWhenSatisfied><paused>True</paused><unpauseWhenYouHave>145</unpauseWhenYouHave><ingredientFilter><allowedDefs><li>RawRice</li><li>Meat_Bison</li></allowedDefs></ingredientFilter></li>'),'CookMealFineBulk',new Map());
  expect(b).toMatchObject({mode:'until',target:150,suspended:false,filters:{rice:true,'bison-meat':true,potato:false},reservePause:{enabled:true,paused:true,resumeAt:145}});
  expect(validBillSettings(b,b.recipe)).toBe(true);
 });
 it('retains fixed inputs omitted from Core variable-Stuff whitelist',()=>{
  const b=newCookingBill(1,'make-flak-helmet');
  configureImportedBill(b,parseXml('<li><repeatCount>3</repeatCount><ingredientFilter><allowedDefs><li>Steel</li></allowedDefs></ingredientFilter></li>'),'Make_Apparel_AdvancedHelmet',new Map());
  expect(b.filters).toMatchObject({steel:true,plasteel:true,component:true});
  expect(validBillSettings(b,b.recipe)).toBe(true);
 });
 it('does not add new material choices when a source stone type was selected',()=>{
  const b=newCookingBill(1,'stone-blocks');
  configureImportedBill(b,parseXml('<li><repeatMode>Forever</repeatMode><ingredientFilter><allowedDefs><li>ChunkGranite</li></allowedDefs></ingredientFilter></li>'),'Make_StoneBlocksGranite',new Map());
  expect(b.filters).toEqual({'granite-chunk':true,'limestone-chunk':false,'marble-chunk':false,'sandstone-chunk':false,'slate-chunk':false});
 });
 it('accounts for a substituted bulk recipe only in repeat-count mode',()=>{
  const b=newCookingBill(1,'make-pemmican');
  expect(configureImportedBill(b,parseXml('<li><repeatMode>RepeatCount</repeatMode><repeatCount>2</repeatCount></li>'),'Make_PemmicanBulk',new Map())).not.toHaveLength(0);
  expect(b.target).toBe(8);
  configureImportedBill(b,parseXml('<li><repeatMode>TargetCount</repeatMode><targetCount>250</targetCount></li>'),'Make_PemmicanBulk',new Map());
  expect(b.target).toBe(250);
  expect(coreRecipe('Make_BionicLeg')).toBeUndefined();
 });
 it('retains bill order, distinct references and omitted recipe count on a real station',()=>{
  const ctx=context(),w=ctx.w,id=w.nextId++;
  // Only the station/recipe guard is relevant to this cold conversion unit.
  w.structures.push({kind:'campfire',id,x:1,z:1,orientation:0,footprint:'standard',material:'wood',bills:[]});
  const t=readThing(parseXml('<thing Class="Building_WorkTable"><def>Campfire</def><id>Campfire42</id><pos>(1,0,1)</pos><billStack><bills><li><recipe>CookMealSimple</recipe><loadID>10</loadID><repeatCount>3</repeatCount></li><li><recipe>BurnDrugs</recipe><loadID>11</loadID></li><li><recipe>CookMealSimpleBulk</recipe><loadID>12</loadID><repeatMode>Forever</repeatMode></li></bills></billStack></thing>'));
  ctx.map.things.push(t);ctx.thingIds.set(t.id,id);importProductionBills(ctx);
  expect(w.structures.at(-1)?.bills?.map(b=>[b.recipe,b.mode,b.target])).toEqual([['simple-meal','times',3],['cook-simple-meal-bulk','forever',0]]);
  expect(ctx.notes.before.get('production')).toBe(3);expect(ctx.notes.after.get('production')).toBe(2);
  expect(ctx.thingIds.get('Bill_CookMealSimple_10')).not.toBeUndefined();
 });
});
describe('RimWorld storage filters and production owners',()=>{
 it('expands Stuff-independent apparel/weapon/corpse filters into exact item admissions',()=>{
  const node=parseXml('<settings><priority>Critical</priority><filter><allowedDefs><li>Apparel_Duster</li><li>Gun_Revolver</li><li>Corpse_Bison</li><li>Apparel_AdvancedHelmet</li><li>RawRice</li></allowedDefs><allowedHitPointsPercents>0.51~0.95</allowedHitPointsPercents><allowedQualityLevels>Good~Masterwork</allowedQualityLevels><disallowedSpecialFilters><li>AllowRotten</li></disallowedSpecialFilters></filter></settings>');
  const s=storageSettingsFromCore(node)!;
  expect(s).toMatchObject({priority:5,quality:{min:'good',max:'masterwork'},hitPoints:{min:51,max:95},allowRotten:false,filters:{apparel:true,weapon:true,corpse:true,food:true}});
  expect(s.items).toMatchObject({'cloth-duster':true,'bison-wool-duster':true,revolver:true,'bison-corpse':true,'flak-helmet':true,'plasteel-flak-helmet':true,rice:true});
  expect(storageAccepts(s,'cloth-shirt')).toBe(false);expect(storageAccepts(s,'cloth-duster')).toBe(true);expect(storageAccepts(s,'bolt-action-rifle')).toBe(false);
  expect(filterItemIds('Corpse_Human')).toEqual(['human-corpse']);
 });
 it('preserves a partial frame and its paid material owner using ordinary job rules',()=>{
  const ctx=context(),w=ctx.w;
  const i=w.tiles.findIndex((_,i)=>canDesignate(w,{type:'designate',kind:'wall',material:'wood',x:i%w.width,z:Math.floor(i/w.width),orientation:0}).ok);
  expect(i).toBeGreaterThanOrEqual(0);
  const local={x:i%w.width,z:Math.floor(i/w.width)},p=ctx.coordinates.cell(local);
  ctx.map.things.push(readThing(parseXml(`<thing Class="Frame"><def>Frame_Wall</def><id>Frame_Wall1</id><pos>(${p.x},0,${p.z})</pos><stuff>WoodLog</stuff><resourceContainer><innerList><li><def>WoodLog</def><stackCount>2</stackCount></li></innerList></resourceContainer></thing>`)));
  importConstructionPlans(ctx);
  const id=ctx.thingIds.get('Frame_Wall1'),job=w.jobs.find(j=>j.id===id);
  expect(job).toMatchObject({...local,kind:'wall',material:'wood',construction:'frame',escrow:{wood:2,food:0},progress:0});
  expect(w.piles.filter(p=>p.owner.type==='job'&&p.owner.jobId===job?.id).reduce((s,p)=>s+p.quantity,0)).toBe(2);
  expect(validateWorld(w)).toEqual([]);
 });
 it('retains an actual workpiece with author, embedded inputs and paid work',()=>{
  const ctx=context(),w=ctx.w;
  const i=w.tiles.findIndex((_,i)=>groundCapacity(w,{x:i%w.width,z:Math.floor(i/w.width)},'unfinished-duster')>=1);
  const local={x:i%w.width,z:Math.floor(i/w.width)},p=ctx.coordinates.cell(local);
  const owner=w.pawns[0]!.id;ctx.thingIds.set('Human42',owner);
  ctx.map.things.push(readThing(parseXml(`<thing Class="UnfinishedThing"><def>UnfinishedApparel</def><id>UnfinishedApparel7</id><pos>(${p.x},0,${p.z})</pos><stuff>WoolBison</stuff><creator>Thing_Human42</creator><recipe>Make_Apparel_Duster</recipe><workLeft>3573.22</workLeft><ingredients><li><def>WoolBison</def><stackCount>80</stackCount></li></ingredients></thing>`)));
  importUnfinishedWorks(ctx);
  const pile=w.piles.find(v=>v.id===ctx.thingIds.get('UnfinishedApparel7'));
  expect(pile).toMatchObject({item:'unfinished-duster',quantity:1,owner:{type:'ground',...local},unfinished:{recipe:'duster',authorId:owner,material:'bison-wool',units:80,parts:[75,5],progress:6426780}});
  expect(validateWorld(w)).toEqual([]);
 });
 it('retains an inactive Core helmet with exact paid steel and creator without unlocking a recipe; classifies unsupported works',()=>{
  const ctx=context(),w=ctx.w;
  const i=w.tiles.findIndex((_,i)=>groundCapacity(w,{x:i%w.width,z:Math.floor(i/w.width)},'unfinished-simple-helmet')>=1);
  const local={x:i%w.width,z:Math.floor(i/w.width)},p=ctx.coordinates.cell(local),authorId=w.pawns[0]!.id;
  ctx.thingIds.set('Human42',authorId);
  const add=(def:string,id:string,recipe:string,stuff:string,parts:string)=>ctx.map.things.push(readThing(parseXml(`<thing Class="UnfinishedThing"><def>${def}</def><id>${id}</id><pos>(${p.x},0,${p.z})</pos><stuff>${stuff}</stuff><creator>Thing_Human42</creator><recipe>${recipe}</recipe><workLeft>7.23086071</workLeft><ingredients>${parts}</ingredients></thing>`)));
  add('UnfinishedArmor','Helmet1','Make_Apparel_SimpleHelmet','Steel','<li><def>Steel</def><stackCount>40</stackCount></li>');
  add('UnfinishedWeapon','Axe1','Make_MeleeWeapon_BreachAxe','Uranium','<li><def>Uranium</def><stackCount>50</stackCount></li>');
  importUnfinishedWorks(ctx);
  const pile=w.piles.find(v=>v.id===ctx.thingIds.get('Helmet1'));
  expect(pile).toMatchObject({item:'unfinished-simple-helmet',quantity:1,owner:{type:'ground',...local},smithingWork:{recipe:'make-simple-helmet',authorId,material:'steel',parts:[{item:'steel',quantity:40}],progress:Math.round(smithingWorkTotal267('make-simple-helmet','steel')-7230.86071)}});
  expect(ctx.thingIds.has('Axe1')).toBe(false);expect(ctx.notes.before.get('production')).toBe(2);expect(ctx.notes.after.get('production')).toBe(1);
  expect(validateWorld(w)).toEqual([]);
 });
 it('marks a designated actual chunk and does not guess an unresolved reference',()=>{
  const ctx=context(),w=ctx.w;
  const i=w.tiles.findIndex((_,i)=>groundCapacity(w,{x:i%w.width,z:Math.floor(i/w.width)},'granite-chunk')>=1);
  const cell={x:i%w.width,z:Math.floor(i/w.width)},owner={type:'ground' as const,...cell};
  addMaterial(w,'chunk',1,owner,'granite-chunk');
  const p=w.piles.find(v=>v.item==='granite-chunk'&&v.owner.type==='ground'&&v.owner.x===cell.x&&v.owner.z===cell.z)!;
  ctx.thingIds.set('ChunkGranite42',p.id);
  for(const ix of ctx.map.node.children.map((n,i)=>n.name==='designationManager'?i:-1).reverse())if(ix>=0)ctx.map.node.children.splice(ix,1);
  ctx.map.node.children.push(parseXml('<designationManager><allDesignations><li><def>Haul</def><target>Thing_ChunkGranite42</target></li><li><def>Haul</def><target>Thing_ChunkGranite43</target></li></allDesignations></designationManager>'));
  importHaulDesignations(ctx);expect(p.haulRequested).toBe(true);
  expect(ctx.notes.messages.some(m=>m.kind==='lost'&&m.text.includes('1 désignations'))).toBe(true);
 });
 it('preserves a reflected named custom area and its original player restriction',()=>{
  const ctx=context(),w=ctx.w,owner=w.pawns[0]!.id,bytes=new Uint8Array(Math.ceil(w.width*w.height/8));
  for(const i of [1,w.width+2])bytes[i>>3]!|=1<<(i&7);
  const xml=parseXml(`<li Class="Area_Allowed"><ID>7</ID><label>Patio</label><color>RGBA(0.2,0.4,1.0,1.0)</color><innerGrid><arr>${Buffer.from(bytes).toString('base64')}</arr></innerGrid></li>`);
  ctx.map.areas.push(xml);
  ctx.map.things.push(readThing(parseXml('<thing Class="Pawn"><def>Human</def><id>Human42</id><playerSettings><allowedAreas><keys><li>Map_0</li></keys><values><li>Area_Allowed_7</li></values></allowedAreas></playerSettings></thing>')));
  ctx.thingIds.set('Human42',owner);importAllowedAreas(ctx);
  expect(w.allowedAreas).toHaveLength(1);
  expect(w.allowedAreas?.[0]).toMatchObject({label:'Patio',color:0x3366ff,cells:[ctx.coordinates.index(w.width+2),ctx.coordinates.index(1)]});
  expect(w.pawns[0]!.allowedAreaId).toBe(w.allowedAreas![0]!.id);
 });
});
