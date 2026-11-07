import {expect,test} from 'vitest';
import {MACE_ITEMS_269,MACE_DEFINITIONS_269,maceMaterial269,maceColor269} from '../src/sim/mace-content-269';
import {newWeaponState,type WeaponItem} from '../src/sim/equipment-rules';
import {newApparelState} from '../src/sim/apparel-rules';
import {newCookingBill} from '../src/sim/cooking-bills';
import {itemGeometry,itemCargoKind} from '../src/render/item-presentation';
import {pawnGeometry,cargoGeometry,type CargoGeometryRange} from '../src/render/pawn-geometry';
import {WEAPON_VISUALS,RESIDENT_WEAPON_VISUALS269,weaponVisual} from '../src/render/weapon-shape';
import {MACE_PARTS269,MACE_DYE269,maceStrikeActivity269} from '../src/render/mace-parts269';
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
import {maceRecipeDescription269} from '../src/ui/bill-controls';
import {itemInformation} from '../src/ui/item-information';
import {deconstructionCamp} from './scenarios/deconstruction';
import type {MaterialPile,World} from '../src/sim/types';
import {OrthographicCamera,type Mesh,type MeshStandardNodeMaterial,type BufferGeometry} from 'three/webgpu';

// Prepared publication fixtures, never presented as acquired/equipped in play.
function fixture(){const w=deconstructionCamp();w.pawns=[w.pawns[0]!];w.piles=[];w.packed=[];return {w,p:w.pawns[0]!};}
const weapon=(w:World,item:WeaponItem):MaterialPile=>({id:w.nextId++,item,kind:'weapon',quantity:1,owner:{type:'equipment',pawnId:w.pawns[0]!.id},weapon:newWeaponState(item)});
const armor=(w:World):MaterialPile=>({id:w.nextId++,item:'steel-plate-armor',kind:'apparel',quantity:1,owner:{type:'apparel',pawnId:w.pawns[0]!.id},apparel:newApparelState('steel-plate-armor')});

test('six material piles and cargo ranges reuse one original mace family while ordinary rigs keep their old exact counts',()=>{
 expect(WEAPON_VISUALS).toHaveLength(4);expect(RESIDENT_WEAPON_VISUALS269.filter(v=>v.dye===MACE_DYE269)).toHaveLength(1);
 const plain=pawnGeometry(),oldArmor=pawnGeometry(true),mace=pawnGeometry(false,true),both=pawnGeometry(true,true),cargo=cargoGeometry();
 try{
  expect(plain.getAttribute('position').count).toBe(3190);expect(oldArmor.getAttribute('position').count).toBe(3720);
  expect(mace.getAttribute('position').count).toBe(3190+216);expect(both.getAttribute('position').count).toBe(3720+216);
  const dye=both.getAttribute('dye'),normal=both.getAttribute('normal');let family=0;
  for(let i=0;i<dye.count;i++)if(dye.getX(i)===MACE_DYE269){family++;expect(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))).toBeCloseTo(1,5);}
  expect(family).toBe(216);expect(Math.max(...both.index!.array)).toBeLessThan(dye.count);
  const ranges=cargo.userData.cargoRangesByKind as Record<number,CargoGeometryRange>;
  const shapes=MACE_ITEMS_269.map(item=>{
   const model=itemGeometry(item,1);expect(model).toHaveLength(6);expect(ranges[itemCargoKind(item)]!.count).toBe(216);
   expect(weaponVisual(item)!.dye).toBe(MACE_DYE269);expect(weaponVisual(item)!.parts[0]!.color).toBe(maceColor269(item));
   expect(modelIconUrl(`item-${item}`)).toBe(`/assets/ui/elsewhere/pictograms-20261107/item-${item}.svg`);return model.map(({color,...part})=>part);
  });
  for(const shape of shapes)expect(shape).toEqual(shapes[0]);
  expect(new Set(MACE_ITEMS_269.map(item=>weaponVisual(item)!.parts[0]!.color)).size).toBe(6);
  expect(itemGeometry('unfinished-mace')).toHaveLength(2);expect(ranges[itemCargoKind('unfinished-mace')]!.count).toBe(72);
  expect(modelIconUrl('item-unfinished-mace')).toBe('/assets/ui/elsewhere/pictograms-20261107/item-unfinished-mace.svg');expect(MACE_PARTS269).toHaveLength(6);
 }finally{for(const g of [plain,oldArmor,mace,both,cargo])g.dispose();}
});

test.each([['mace','armor'],['armor','mace']] as const)('first %s then %s extends each family once and preserves shared buffers and shadow material',(first,second)=>{
 const {w}=fixture(),layer=new PawnLayer(),geometries:BufferGeometry[]=[],disposals=new Map<BufferGeometry,number>();
 try{
  layer.update(w,1,true);const original=layer.feedbackSource!,actor=layer.group.children.find(n=>n.name==='Colonists — procedural eight-bone GPU rig') as Mesh;
  const material=actor.material as MeshStandardNodeMaterial,children=layer.group.children.length;
  expect(actor.castShadow).toBe(true);expect(material.positionNode).not.toBeNull();
  const shared=new Map(['aFrom','aTo','aTravel','aCargo','aMotion','aEquipment','aShape','aFire'].map(name=>[name,original.getAttribute(name)]));
  function remember(g:BufferGeometry){geometries.push(g);disposals.set(g,0);g.addEventListener('dispose',()=>disposals.set(g,disposals.get(g)!+1));}
  remember(original);
  // Ground and inventory objects do not cause a worn-rig expansion.
  const ground=weapon(w,'steel-mace');ground.owner={type:'ground',x:4,z:4};w.piles=[ground];layer.update(w,1,false);expect(layer.feedbackSource).toBe(original);
  w.piles=[];
  for(const family of [first,second]){
   w.piles.push(family==='mace'?weapon(w,'steel-mace'):armor(w));layer.update(w,1,false);const extended=layer.feedbackSource!;remember(extended);
   expect(extended).not.toBe(geometries.at(-2));expect(extended.instanceCount).toBe(1);
   for(const [name,attribute]of shared)expect(extended.getAttribute(name),name).toBe(attribute);
   expect(actor.material).toBe(material);expect(layer.group.children).toHaveLength(children);expect([...disposals.values()]).toEqual(geometries.map(()=>0));
  }
  const complete=layer.feedbackSource!;expect(complete.getAttribute('position').count).toBe(3936);
  for(const item of MACE_ITEMS_269){w.piles=w.piles.filter(p=>p.owner.type!=='equipment');w.piles.push(weapon(w,item));layer.update(w,1,false);expect(layer.feedbackSource).toBe(complete);}
  w.piles=[];layer.update(w,1,false);expect(layer.feedbackSource).toBe(complete);
 }finally{layer.dispose();}
 for(const g of geometries)expect(disposals.get(g)).toBe(1);
});

test('confirmed material/tool codes are exact and cached activity never changes the ordinary body pose or invents a natural-attack mace strike',()=>{
 const {w,p}=fixture(),layer=new PawnLayer(),cache=new ActorAnimationCache(new AnimationDetail());cache.ensureCapacity(1);
 try{
  for(const [index,item]of MACE_ITEMS_269.entries()){
   w.piles=[weapon(w,item)];layer.update(w,1,index===0);const g=layer.feedbackSource!,equipment=g.getAttribute('aEquipment');
   expect(equipment.getX(0)).toBe(5+(index+1)/8);expect(equipment.getY(0)).toBe(0);
   const material=MACE_DEFINITIONS_269[maceMaterial269(item)];
   for(const [tool,activity]of [[`${item}-head`,6],[`${item}-handle`,7],['left-fist',0]] as const){
    p.melee={order:null,strike:{atCore:w.tick*10,untilCore:w.tick*10+Math.round(120*material.cooldownMultiplier),targetId:null,tool:tool as NonNullable<NonNullable<typeof p.melee>['strike']>['tool'],outcome:'miss'}};
    const before=structuredClone(w);layer.update(w,1,false);expect(g.getAttribute('aMotion').getY(0)).toBe(activity);
    const pose=g.getAttribute('aMotion').getZ(0);expect(pose).toBe(8);
    const root={x:0,y:0,z:0,yaw:0},clock=w.tick/6+.125;samplePawnRig(cache,0,g,root,clock,clock);
    expect(cache.get(0,4,2)).toBe(activity);expect(cache.get(0,3,3)).toBeCloseTo(1,5);
    const rows=Array.from({length:16},(_,j)=>Array.from({length:4},(_,k)=>cache.get(0,j+8,k)));
    g.getAttribute('aMotion').setY(0,0);samplePawnRig(cache,0,g,root,clock,clock);
    expect(Array.from({length:16},(_,j)=>Array.from({length:4},(_,k)=>cache.get(0,j+8,k)))).toEqual(rows);expect(w).toEqual(before);
   }
  }
  expect(maceStrikeActivity269('steel-mace-head','gold-mace')).toBe(0);expect(maceStrikeActivity269('knife-blade','steel-mace')).toBe(0);
  delete p.melee;
  for(const [item,code]of [['revolver',1],['bolt-action-rifle',2],['plasteel-knife',3],['emp-launcher',4]] as const){w.piles=[weapon(w,item)];layer.update(w,1,false);expect(layer.feedbackSource!.getAttribute('aEquipment').getX(0)).toBe(code);}
 }finally{cache.dispose();layer.dispose();}
});

test('portraits preserve all six pigments at the same resting attachment and retain distinct old weapon cache keys',()=>{
 const {w,p}=fixture(),identity=appearanceOf(p,w.seed),look=apparelAppearance(),urls:string[]=[];
 for(const item of MACE_ITEMS_269){
  const url=portraitDataUrl(identity,look,item),svg=decodeURIComponent(url.split(',')[1]!);urls.push(url);
  expect(svg).toContain(`data-weapon="${item}"`);expect(svg).not.toContain('NaN');expect(svg).toContain('<polygon');expect(portraitDataUrl(identity,look,item)).toBe(url);
 }
 expect(new Set(urls).size).toBe(6);
 for(const item of ['plasteel-knife','revolver']){const svg=decodeURIComponent(portraitDataUrl(identity,look,item).split(',')[1]!);expect(svg).toContain(`data-weapon="${item}"`);expect(urls).not.toContain(portraitDataUrl(identity,look,item));}
});

test('a retained mace pose invalidates on tool/start changes but not the next clock tick or an unchanged publication',()=>{
 const {w,p}=fixture(),layer=new PawnLayer();w.piles=[weapon(w,'steel-mace')];
 p.melee={order:null,strike:{atCore:w.tick*10,untilCore:w.tick*10+120,targetId:null,tool:'steel-mace-head',outcome:'miss'}};
 try{
  layer.update(w,1,true);const cache=layer.animationCache;
  const retain=()=>cache.set(0,1,1,0,0,1);
  retain();layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(1);
  // Physical time/reach advance under the ordinary sampler, not the signature.
  w.tick++;layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(1);
  p.melee!.strike!.tool='steel-mace-handle';layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(0);expect(layer.feedbackSource!.getAttribute('aMotion').getY(0)).toBe(7);
  retain();layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(1);
  p.melee!.strike!.atCore=w.tick*10;layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(0);
  retain();p.melee!.strike!.tool='left-fist';layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(0);expect(layer.feedbackSource!.getAttribute('aMotion').getY(0)).toBe(0);
  // Existing weapons keep their prior signature: new timing is mace-only.
  w.piles=[weapon(w,'revolver')];p.melee!.strike!.tool='grip';layer.update(w,1,false);retain();w.tick++;p.melee!.strike!.atCore=w.tick*10;layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(1);
 }finally{layer.dispose();}
});

test('the actual confirmed timeline/frame path preserves head and handle activity into direct and cached presentation',()=>{
 const {w,p}=fixture(),detail=new AnimationDetail(),layer=new PawnLayer(undefined,detail),timeline=new MotionTimeline();
 const camera=new OrthographicCamera(-22.5,22.5,22.5,-22.5,.1,1000);camera.position.set(0,20,20);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
 w.piles=[weapon(w,'steel-mace')];let now=0;
 try{
  for(const enabled of [false,true])for(const [tool,activity]of [['steel-mace-head',6],['steel-mace-handle',7],['left-fist',0]] as const){
   detail.setSettings({enabled,nearPixels:96,farPixels:0,middleHz:12});
   p.melee={order:null,strike:{atCore:w.tick*10,untilCore:w.tick*10+120,targetId:null,tool,outcome:'miss'}};
   const before=structuredClone(w);layer.update(w,1,now===0);const g=layer.feedbackSource!;
   expect(g.getAttribute('aMotion').getY(0)).toBe(activity);
   timeline.adopt(w.tick,0,[],now,true);timeline.advance(now);
   layer.time.value=timeline.tick/6;layer.updateTravel(w,timeline);
   expect(g.getAttribute('aMotion').getY(0)).toBe(activity);expect(g.getAttribute('aMotion').getZ(0)).toBe(8);
   detail.beginFrame(now,camera,720,timeline.tick);layer.presentAnimations();
   expect(layer.animationCache.get(0,1,3)).toBe(enabled?1:0);
   if(enabled)expect(layer.animationCache.get(0,4,2)).toBe(activity);
   now+=100;timeline.advance(now);layer.updateTravel(w,timeline);detail.beginFrame(now,camera,720,timeline.tick);layer.presentAnimations();
   expect(g.getAttribute('aMotion').getY(0)).toBe(activity);expect(w).toEqual(before);now+=100;
  }
 }finally{layer.dispose();}
});

test('stockage classifies six maces as melee only and forge costs/default material permissions have no internal time units',()=>{
 const weapons=STORAGE_FILTER_TREE.find(node=>node.id==='weapons')!,melee=weapons.children!.find(node=>node.id==='melee')!,ranged=weapons.children!.find(node=>node.id==='ranged')!;
 for(const item of MACE_ITEMS_269){expect(storageNodeLeaves(melee)).toContain(item);expect(storageNodeLeaves(ranged)).not.toContain(item);}
 expect(storageNodeLeaves(melee)).toContain('plasteel-knife');expect(storageNodeLeaves(ranged)).toContain('revolver');
 expect(newCookingBill(1,'make-mace').filters).toEqual({wood:false,steel:true,plasteel:true,uranium:true,silver:false,gold:false});
 expect(maceRecipeDescription269).toContain('50');expect(maceRecipeDescription269).toContain('500');expect(maceRecipeDescription269).toContain('Artisanat 3');expect(maceRecipeDescription269).toContain('recherche Forge');expect(maceRecipeDescription269).not.toMatch(/ticks|Core|local/i);
});

test('selected mace facts use real material and quality with nominal attacks, mass and recovery instead of promised damage per second',()=>{
 const {w}=fixture(),steel=weapon(w,'steel-mace'),uranium=weapon(w,'uranium-mace');steel.weapon!.quality='excellent';uranium.weapon!.quality='poor';
 for(const [pile,head,handle,recovery]of [[steel,'18,84','10,8','2 s'],[uranium,'21,19','12,15','2,2 s']] as const){
  const before=structuredClone(pile),info=itemInformation(pile),row=(label:string)=>info.rows.find(r=>r.label===label)!;
  expect(row('Masse unitaire').value).toBe('1.25 kg');expect(row('Tête').value).toContain(head);expect(row('Manche').value).toContain(handle);expect(row('Récupération de base').value).toBe(recovery);
  expect(row('Tête').description).toContain('avant protections et choix du coup');expect(row('Récupération de base').description).toContain('pas une cadence');expect(info.rows.map(r=>r.value).join(' ')).not.toMatch(/Core|ticks/);expect(pile).toEqual(before);
 }
});
