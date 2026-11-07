import {expect,test} from 'vitest';
import {LONGSWORD_ITEMS_270,LONGSWORD_DEFINITIONS_270,longswordMaterial270,longswordColor270} from '../src/sim/longsword-content-270';
import {newWeaponState,type WeaponItem} from '../src/sim/equipment-rules';
import {newApparelState} from '../src/sim/apparel-rules';
import {newCookingBill} from '../src/sim/cooking-bills';
import {itemGeometry,itemCargoKind} from '../src/render/item-presentation';
import {pawnGeometry,cargoGeometry,type CargoGeometryRange} from '../src/render/pawn-geometry';
import {WEAPON_VISUALS,RESIDENT_WEAPON_VISUALS269,weaponVisual} from '../src/render/weapon-shape';
import {LONGSWORD_PARTS270,LONGSWORD_DYE270,longswordStrikeActivity270} from '../src/render/longsword-parts270';
import {PawnLayer} from '../src/render/PawnLayer';
import {ActorAnimationCache} from '../src/render/ActorAnimationCache';
import {AnimationDetail} from '../src/render/AnimationDetail';
import {samplePawnRig} from '../src/render/actor-animation-sampling';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {apparelAppearance} from '../src/render/character-apparel';
import {appearanceOf} from '../src/sim/pawn-appearance';
import {portraitDataUrl} from '../src/ui/pawn-portrait';
import {itemPortraitDataUrl} from '../src/render/item-portrait';
import {modelIconUrl} from '../src/ui/pictograms';
import {STORAGE_FILTER_TREE,storageNodeLeaves} from '../src/ui/storage-filter-tree';
import {longswordRecipeDescription270} from '../src/ui/bill-controls';
import {itemInformation} from '../src/ui/item-information';
import {deconstructionCamp} from './scenarios/deconstruction';
import type {MaterialPile,World} from '../src/sim/types';
import {OrthographicCamera,type Mesh,type MeshStandardNodeMaterial,type BufferGeometry} from 'three/webgpu';

// Prepared publication fixtures; these do not claim acquisition through play.
function fixture(){const w=deconstructionCamp();w.pawns=[w.pawns[0]!];w.piles=[];w.packed=[];return {w,p:w.pawns[0]!};}
const weapon=(w:World,item:WeaponItem):MaterialPile=>({id:w.nextId++,item,kind:'weapon',quantity:1,owner:{type:'equipment',pawnId:w.pawns[0]!.id},weapon:newWeaponState(item)});
const armor=(w:World):MaterialPile=>({id:w.nextId++,item:'steel-plate-armor',kind:'apparel',quantity:1,owner:{type:'apparel',pawnId:w.pawns[0]!.id},apparel:newApparelState('steel-plate-armor')});

test('six sword pigments share one original family and old ordinary, armor and mace counts remain exact',()=>{
 expect(WEAPON_VISUALS).toHaveLength(4);expect(RESIDENT_WEAPON_VISUALS269.filter(v=>v.dye===LONGSWORD_DYE270)).toHaveLength(1);
 const plain=pawnGeometry(),oldArmor=pawnGeometry(true),oldMace=pawnGeometry(false,true),sword=pawnGeometry(false,false,true),all=pawnGeometry(true,true,true),cargo=cargoGeometry();
 try{
  expect(plain.getAttribute('position').count).toBe(3190);expect(oldArmor.getAttribute('position').count).toBe(3720);
  expect(oldMace.getAttribute('position').count).toBe(3406);expect(sword.getAttribute('position').count).toBe(3406);expect(all.getAttribute('position').count).toBe(4152);
  const dye=all.getAttribute('dye'),normal=all.getAttribute('normal');let family=0;
  for(let i=0;i<dye.count;i++)if(dye.getX(i)===LONGSWORD_DYE270){family++;expect(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))).toBeCloseTo(1,5);}
  expect(family).toBe(216);expect(Math.max(...all.index!.array)).toBeLessThan(dye.count);
  const ranges=cargo.userData.cargoRangesByKind as Record<number,CargoGeometryRange>;
  const shapes=LONGSWORD_ITEMS_270.map(item=>{
   const model=itemGeometry(item,1);expect(model).toHaveLength(6);expect(ranges[itemCargoKind(item)]!.count).toBe(216);
   expect(weaponVisual(item)!.dye).toBe(LONGSWORD_DYE270);expect(weaponVisual(item)!.parts[0]!.color).toBe(longswordColor270(item));
   expect(modelIconUrl(`item-${item}`)).toBe(`/assets/ui/elsewhere/pictograms-20261107/item-${item}.svg`);return model.map(({color,...part})=>part);
  });
  for(const shape of shapes)expect(shape).toEqual(shapes[0]);
  expect(new Set(LONGSWORD_ITEMS_270.map(item=>weaponVisual(item)!.parts[0]!.color)).size).toBe(6);
  expect(itemGeometry('unfinished-longsword')).toHaveLength(2);expect(ranges[itemCargoKind('unfinished-longsword')]!.count).toBe(72);
  expect(modelIconUrl('item-unfinished-longsword')).toBe('/assets/ui/elsewhere/pictograms-20261107/item-unfinished-longsword.svg');expect(LONGSWORD_PARTS270).toHaveLength(6);
 }finally{for(const g of [plain,oldArmor,oldMace,sword,all,cargo])g.dispose();}
});

test.each([['sword','armor','mace'],['armor','mace','sword'],['mace','sword','armor']] as const)('extension order %s / %s / %s preserves shared GPU attributes and adds each family once',(first,second,third)=>{
 const {w}=fixture(),layer=new PawnLayer(),geometries:BufferGeometry[]=[],disposals=new Map<BufferGeometry,number>();
 try{
  layer.update(w,1,true);const original=layer.feedbackSource!,actor=layer.group.children.find(n=>n.name==='Colonists — procedural eight-bone GPU rig') as Mesh;
  const material=actor.material as MeshStandardNodeMaterial,children=layer.group.children.length;
  expect(actor.castShadow).toBe(true);expect(material.positionNode).not.toBeNull();
  const shared=new Map(['aFrom','aTo','aTravel','aCargo','aMotion','aEquipment','aShape','aFire'].map(name=>[name,original.getAttribute(name)]));
  function remember(g:BufferGeometry){geometries.push(g);disposals.set(g,0);g.addEventListener('dispose',()=>disposals.set(g,disposals.get(g)!+1));}
  remember(original);
  const ground=weapon(w,'steel-longsword');ground.owner={type:'ground',x:4,z:4};w.piles=[ground];layer.update(w,1,false);expect(layer.feedbackSource).toBe(original);
  ground.owner={type:'pawn',pawnId:w.pawns[0]!.id};layer.update(w,1,false);expect(layer.feedbackSource).toBe(original);w.piles=[];
  for(const family of [first,second,third]){
   // Only one equipped weapon at a time; geometry survives a weapon swap.
   if(family!=='armor')w.piles=w.piles.filter(p=>p.owner.type!=='equipment');
   w.piles.push(family==='armor'?armor(w):weapon(w,family==='sword'?'steel-longsword':'steel-mace'));
   layer.update(w,1,false);const extended=layer.feedbackSource!;remember(extended);
   expect(extended).not.toBe(geometries.at(-2));expect(extended.instanceCount).toBe(1);
   for(const [name,attribute]of shared)expect(extended.getAttribute(name),name).toBe(attribute);
   expect(actor.material).toBe(material);expect(layer.group.children).toHaveLength(children);expect([...disposals.values()]).toEqual(geometries.map(()=>0));
  }
  const complete=layer.feedbackSource!;expect(complete.getAttribute('position').count).toBe(4152);
  for(const item of LONGSWORD_ITEMS_270){w.piles=w.piles.filter(p=>p.owner.type!=='equipment');w.piles.push(weapon(w,item));layer.update(w,1,false);expect(layer.feedbackSource).toBe(complete);}
  w.piles=[];layer.update(w,1,false);expect(layer.feedbackSource).toBe(complete);
 }finally{layer.dispose();}
 for(const g of geometries)expect(disposals.get(g)).toBe(1);
});

test('all confirmed sword tools retain their activity through real paused timeline frames on direct and cached paths',()=>{
 const {w,p}=fixture(),detail=new AnimationDetail(),layer=new PawnLayer(undefined,detail),timeline=new MotionTimeline();
 const camera=new OrthographicCamera(-22.5,22.5,22.5,-22.5,.1,1000);camera.position.set(0,20,20);camera.lookAt(0,0,0);camera.updateProjectionMatrix();let now=0;
 try{
  for(const [index,item]of LONGSWORD_ITEMS_270.entries())for(const enabled of [false,true]){
   w.piles=[weapon(w,item)];detail.setSettings({enabled,nearPixels:96,farPixels:0,middleHz:12});
   for(const [suffix,activity]of [['handle',8],['tip',9],['edge',10],['natural',0]] as const){
    const tool=(suffix==='natural'?'left-fist':`${item}-${suffix}`) as NonNullable<NonNullable<typeof p.melee>['strike']>['tool'];
    p.melee={order:null,strike:{atCore:w.tick*10,untilCore:w.tick*10+172,targetId:null,tool,outcome:'miss'}};
    const before=structuredClone(w);layer.update(w,1,now===0);const g=layer.feedbackSource!;
    expect(g.getAttribute('aEquipment').getX(0)).toBe(6+(index+1)/8);expect(g.getAttribute('aMotion').getY(0)).toBe(activity);
    timeline.adopt(w.tick,0,[],now,true);timeline.advance(now);layer.time.value=timeline.tick/6;layer.updateTravel(w,timeline);
    expect(g.getAttribute('aMotion').getY(0)).toBe(activity);expect(g.getAttribute('aMotion').getZ(0)).toBe(8);
    detail.beginFrame(now,camera,720,timeline.tick);layer.presentAnimations();expect(layer.animationCache.get(0,1,3)).toBe(enabled?1:0);
    if(enabled)expect(layer.animationCache.get(0,4,2)).toBe(activity);
    now+=100;timeline.advance(now);layer.updateTravel(w,timeline);detail.beginFrame(now,camera,720,timeline.tick);layer.presentAnimations();
    expect(g.getAttribute('aMotion').getY(0)).toBe(activity);expect(w).toEqual(before);now+=100;
   }
  }
  expect(longswordStrikeActivity270('steel-longsword-tip','gold-longsword')).toBe(0);expect(longswordStrikeActivity270('steel-mace-head','steel-longsword')).toBe(0);
 }finally{layer.dispose();}
});

test('sword activity selects only its rigid weapon pose and preserves the ordinary body sampler',()=>{
 const {w,p}=fixture(),layer=new PawnLayer(),cache=new ActorAnimationCache(new AnimationDetail());cache.ensureCapacity(1);
 try{
  for(const item of LONGSWORD_ITEMS_270){w.piles=[weapon(w,item)];
   for(const suffix of ['handle','tip','edge'] as const){
    const material=LONGSWORD_DEFINITIONS_270[longswordMaterial270(item)];
    p.melee={order:null,strike:{atCore:w.tick*10,untilCore:w.tick*10+Math.round(156*material.cooldownMultiplier),targetId:null,tool:`${item}-${suffix}`,outcome:'miss'}};
    layer.update(w,1,false);const g=layer.feedbackSource!,root={x:0,y:0,z:0,yaw:0},clock=w.tick/6+.125;
    samplePawnRig(cache,0,g,root,clock,clock);const rows=Array.from({length:16},(_,j)=>Array.from({length:4},(_,k)=>cache.get(0,j+8,k)));
    g.getAttribute('aMotion').setY(0,0);samplePawnRig(cache,0,g,root,clock,clock);
    expect(Array.from({length:16},(_,j)=>Array.from({length:4},(_,k)=>cache.get(0,j+8,k)))).toEqual(rows);
   }
  }
 }finally{cache.dispose();layer.dispose();}
});

test('a paused retained sword pose invalidates on tool or strike start and reuses an unchanged signature',()=>{
 const {w,p}=fixture(),layer=new PawnLayer();w.piles=[weapon(w,'steel-longsword')];
 p.melee={order:null,strike:{atCore:w.tick*10,untilCore:w.tick*10+156,targetId:null,tool:'steel-longsword-tip',outcome:'miss'}};
 try{
  layer.update(w,1,true);const cache=layer.animationCache,retain=()=>cache.set(0,1,1,0,0,1);
  retain();layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(1);
  p.melee!.strike!.tool='steel-longsword-edge';layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(0);expect(layer.feedbackSource!.getAttribute('aMotion').getY(0)).toBe(10);
  retain();layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(1);
  p.melee!.strike!.atCore-=10;layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(0);
  retain();p.melee!.strike!.tool='steel-longsword-handle';layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(0);
  retain();w.tick++;layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(1);
  retain();p.melee!.strike!.tool='left-fist';layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(0);expect(layer.feedbackSource!.getAttribute('aMotion').getY(0)).toBe(0);
 }finally{layer.dispose();}
});

test('six sword portraits have distinct pigments and cache keys alongside the historical weapons',()=>{
 const {w,p}=fixture(),identity=appearanceOf(p,w.seed),look=apparelAppearance(),urls:string[]=[];
 for(const item of LONGSWORD_ITEMS_270){const url=portraitDataUrl(identity,look,item),svg=decodeURIComponent(url.split(',')[1]!);urls.push(url);
  expect(svg).toContain(`data-weapon="${item}"`);expect(svg).not.toContain('NaN');expect(svg).toContain('<polygon');expect(portraitDataUrl(identity,look,item)).toBe(url);
 }
 expect(new Set(urls).size).toBe(6);
 for(const item of ['steel-mace','plasteel-knife','revolver']){expect(urls).not.toContain(portraitDataUrl(identity,look,item));}
});

test('storage and forge descriptions expose swords as melee and explain the actual cost and requirements',()=>{
 const weapons=STORAGE_FILTER_TREE.find(node=>node.id==='weapons')!,melee=weapons.children!.find(node=>node.id==='melee')!,ranged=weapons.children!.find(node=>node.id==='ranged')!;
 for(const item of LONGSWORD_ITEMS_270){expect(storageNodeLeaves(melee)).toContain(item);expect(storageNodeLeaves(ranged)).not.toContain(item);}
 expect(storageNodeLeaves(melee)).toContain('steel-mace');expect(storageNodeLeaves(ranged)).toContain('revolver');
 expect(newCookingBill(1,'make-longsword').filters).toEqual({wood:false,steel:true,plasteel:true,uranium:true,silver:false,gold:false});
 expect(longswordRecipeDescription270).toContain('100');expect(longswordRecipeDescription270).toContain('1 000');expect(longswordRecipeDescription270).toContain('Artisanat 5');expect(longswordRecipeDescription270).toContain('recherche Lames longues');expect(longswordRecipeDescription270).not.toMatch(/ticks|Core|local/i);
});

test('sword information uses its material, quality and all three nominal tools without a promised damage cadence',()=>{
 const {w}=fixture(),steel=weapon(w,'steel-longsword'),uranium=weapon(w,'uranium-longsword');steel.weapon!.quality='excellent';uranium.weapon!.quality='poor';
 for(const [pile,sharp,blunt,bladeCooldown,handleCooldown]of [[steel,'27,6','10,8','2,6 s','2 s'],[uranium,'22,77','12,15','2,87 s','2,2 s']] as const){
  const info=itemInformation(pile,w),value=(label:string)=>info.rows.find(row=>row.label===label)?.value;
  expect(value('Pointe')).toContain(sharp);expect(value('Tranchant')).toContain(sharp);expect(value('Manche')).toContain(blunt);
  expect(value('Matière')).toBe(LONGSWORD_DEFINITIONS_270[longswordMaterial270(pile.item as typeof LONGSWORD_ITEMS_270[number])].label);
  expect(value('Masse unitaire')).toContain('2');expect(value('Récupération de base')).toContain(bladeCooldown);expect(value('Récupération de base')).toContain(handleCooldown);
  expect(JSON.stringify(info)).not.toMatch(/dégâts par seconde|DPS|ticks/i);
 }
});
