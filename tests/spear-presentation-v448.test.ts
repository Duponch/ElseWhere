import {expect,test} from 'vitest';
import {SPEAR_ITEMS_272,spearColor272} from '../src/sim/spear-content-272';
import {SPEAR_PARTS272,SPEAR_DYE272,spearStrikeActivity272} from '../src/render/spear-parts272';
import {itemGeometry,itemCargoKind} from '../src/render/item-presentation';
import {pawnGeometry,cargoGeometry,type CargoGeometryRange} from '../src/render/pawn-geometry';
import {WEAPON_VISUALS,RESIDENT_WEAPON_VISUALS269,weaponVisual} from '../src/render/weapon-shape';
import {PawnLayer} from '../src/render/PawnLayer';
import {AnimationDetail} from '../src/render/AnimationDetail';
import {ActorAnimationCache} from '../src/render/ActorAnimationCache';
import {samplePawnRig} from '../src/render/actor-animation-sampling';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {appearanceOf} from '../src/sim/pawn-appearance';
import {apparelAppearance} from '../src/render/character-apparel';
import {portraitDataUrl} from '../src/ui/pawn-portrait';
import {itemPortraitDataUrl} from '../src/render/item-portrait';
import {modelIconUrl} from '../src/ui/pictograms';
import {itemInformation} from '../src/ui/item-information';
import {STORAGE_FILTER_TREE,storageNodeLeaves} from '../src/ui/storage-filter-tree';
import {newWeaponState,type WeaponItem} from '../src/sim/equipment-rules';
import {newApparelState} from '../src/sim/apparel-rules';
import {deconstructionCamp} from './scenarios/deconstruction';
import type {MaterialPile,World} from '../src/sim/types';
import {OrthographicCamera,type Mesh,type MeshStandardNodeMaterial,type BufferGeometry} from 'three/webgpu';

const weapon=(w:World,item:WeaponItem):MaterialPile=>({id:w.nextId++,item,kind:'weapon',quantity:1,owner:{type:'equipment',pawnId:w.pawns[0]!.id},weapon:newWeaponState(item)});
function fixture(){const w=deconstructionCamp();w.piles=[];w.packed=[];return {w,p:w.pawns[0]!};}

test('six spear pigments reuse one authored pole on ground/cargo and preserve the ordinary rig cost',()=>{
 const plain=pawnGeometry(),old=pawnGeometry(true,true,true),spear=pawnGeometry(false,false,false,true),all=pawnGeometry(true,true,true,true),cargo=cargoGeometry();
 try{
  expect(WEAPON_VISUALS).toHaveLength(4);expect(RESIDENT_WEAPON_VISUALS269.filter(v=>v.dye===SPEAR_DYE272)).toHaveLength(1);expect(SPEAR_PARTS272).toHaveLength(7);
  expect(plain.getAttribute('position').count).toBe(3190);expect(old.getAttribute('position').count).toBe(4152);expect(spear.getAttribute('position').count).toBe(3442);expect(all.getAttribute('position').count).toBe(4404);
  const dye=all.getAttribute('dye'),normals=all.getAttribute('normal');let count=0;for(let i=0;i<dye.count;i++)if(dye.getX(i)===SPEAR_DYE272){count++;expect(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))).toBeCloseTo(1,5);}expect(count).toBe(252);expect(Math.max(...all.index!.array)).toBeLessThan(dye.count);
  const ranges=cargo.userData.cargoRangesByKind as Record<number,CargoGeometryRange>,shapes=[];
  for(const item of SPEAR_ITEMS_272){
   expect(weaponVisual(item)?.dye).toBe(SPEAR_DYE272);expect(weaponVisual(item)?.parts[0]?.color).toBe(spearColor272(item));expect(itemGeometry(item)).toHaveLength(7);expect(ranges[itemCargoKind(item)]?.count).toBe(252);
   expect(modelIconUrl(`item-${item}`)).toBe(`/assets/ui/elsewhere/pictograms-20261107/item-${item}.svg`);shapes.push(itemGeometry(item).map(({color,...part})=>part));
  }
  for(const shape of shapes)expect(shape).toEqual(shapes[0]);expect(new Set(SPEAR_ITEMS_272.map(i=>weaponVisual(i)!.parts[0]!.color)).size).toBe(6);
  expect(itemGeometry('unfinished-spear')).toHaveLength(2);expect(ranges[itemCargoKind('unfinished-spear')]?.count).toBe(72);expect(modelIconUrl('item-unfinished-spear')).toBe('/assets/ui/elsewhere/pictograms-20261107/item-unfinished-spear.svg');
 }finally{for(const geometry of [plain,old,spear,all,cargo])geometry.dispose();}
});

test.each([['spear','sword','armor','mace'],['mace','armor','sword','spear']] as const)('resident extension order %s/%s/%s/%s retains shared attributes and the existing mesh',(...order)=>{
 const {w}=fixture(),layer=new PawnLayer(),geometries:BufferGeometry[]=[],disposals=new Map<BufferGeometry,number>();
 try{
  layer.update(w,1,true);const original=layer.feedbackSource!,mesh=layer.group.children.find(n=>n.name==='Colonists — procedural eight-bone GPU rig') as Mesh,material=mesh.material as MeshStandardNodeMaterial,children=layer.group.children.length;
  const shared=new Map(['aFrom','aTo','aTravel','aCargo','aMotion','aEquipment','aShape','aFire'].map(n=>[n,original.getAttribute(n)]));
  const remember=(g:BufferGeometry)=>{geometries.push(g);disposals.set(g,0);g.addEventListener('dispose',()=>disposals.set(g,disposals.get(g)!+1));};remember(original);
  const ground=weapon(w,'steel-spear');ground.owner={type:'ground',x:4,z:4};w.piles=[ground];layer.update(w,1,false);expect(layer.feedbackSource).toBe(original);ground.owner={type:'pawn',pawnId:w.pawns[0]!.id};layer.update(w,1,false);expect(layer.feedbackSource).toBe(original);w.piles=[];
  for(const family of order){
   if(family!=='armor')w.piles=w.piles.filter(p=>p.owner.type!=='equipment');
   if(family==='armor')w.piles.push({id:w.nextId++,item:'steel-plate-armor',kind:'apparel',quantity:1,owner:{type:'apparel',pawnId:w.pawns[0]!.id},apparel:newApparelState('steel-plate-armor')});
   else w.piles.push(weapon(w,family==='spear'?'steel-spear':family==='sword'?'steel-longsword':'steel-mace'));
   layer.update(w,1,false);const current=layer.feedbackSource!;expect(current).not.toBe(geometries.at(-1));remember(current);for(const [name,attribute]of shared)expect(current.getAttribute(name),name).toBe(attribute);
   expect(mesh.material).toBe(material);expect(layer.group.children).toHaveLength(children);expect(current.instanceCount).toBe(1);
  }
  const complete=layer.feedbackSource!;expect(complete.getAttribute('position').count).toBe(4404);
  for(const item of SPEAR_ITEMS_272){w.piles=w.piles.filter(p=>p.owner.type!=='equipment');w.piles.push(weapon(w,item));layer.update(w,1,false);expect(layer.feedbackSource).toBe(complete);}
  expect([...disposals.values()]).toEqual(geometries.map(()=>0));
 }finally{layer.dispose();}
 for(const g of geometries)expect(disposals.get(g)).toBe(1);
});

test('three confirmed spear gestures use direct/cached timelines while the body sampler and authoritative world remain unchanged',()=>{
 const {w,p}=fixture(),detail=new AnimationDetail(),layer=new PawnLayer(undefined,detail),timeline=new MotionTimeline(),cache=new ActorAnimationCache(new AnimationDetail());cache.ensureCapacity(1);
 const camera=new OrthographicCamera(-22.5,22.5,22.5,-22.5,.1,1000);camera.position.set(0,20,20);camera.lookAt(0,0,0);camera.updateProjectionMatrix();let now=0;
 try{
  for(const item of ['steel-spear','gold-spear'] as const)for(const enabled of [false,true])for(const [suffix,activity]of [['shaft-blunt',11],['shaft-poke',12],['point',13],['natural',0]] as const){
   w.piles=[weapon(w,item)];detail.setSettings({enabled,nearPixels:96,farPixels:0,middleHz:12});const tool=(suffix==='natural'?'left-fist':`${item}-${suffix}`) as NonNullable<NonNullable<typeof p.melee>['strike']>['tool'];
   p.melee={order:null,strike:{atCore:w.tick*10,untilCore:w.tick*10+156,targetId:null,tool,outcome:'miss'}};const before=structuredClone(w);layer.update(w,1,now===0);const geometry=layer.feedbackSource!;
   expect(geometry.getAttribute('aEquipment').getX(0)).toBe(7+(SPEAR_ITEMS_272.indexOf(item)+1)/8);expect(geometry.getAttribute('aMotion').getY(0)).toBe(activity);
   timeline.adopt(w.tick,0,[],now,true);timeline.advance(now);layer.updateTravel(w,timeline);detail.beginFrame(now,camera,720,timeline.tick);layer.presentAnimations();expect(layer.animationCache.get(0,1,3)).toBe(enabled?1:0);if(enabled)expect(layer.animationCache.get(0,4,2)).toBe(activity);
   const root={x:0,y:0,z:0,yaw:0},clock=w.tick/6+.125;samplePawnRig(cache,0,geometry,root,clock,clock);const body=Array.from({length:16},(_,j)=>Array.from({length:4},(_,k)=>cache.get(0,j+8,k)));
   geometry.getAttribute('aMotion').setY(0,0);samplePawnRig(cache,0,geometry,root,clock,clock);expect(Array.from({length:16},(_,j)=>Array.from({length:4},(_,k)=>cache.get(0,j+8,k)))).toEqual(body);
   expect(w).toEqual(before);now+=100;
  }
  expect(spearStrikeActivity272('steel-spear-point','gold-spear')).toBe(0);expect(spearStrikeActivity272('steel-longsword-tip','steel-spear')).toBe(0);
 }finally{cache.dispose();layer.dispose();}
});

test('paused spear pose invalidates on a changed tool/start and reuses the same confirmed signature',()=>{
 const {w,p}=fixture(),layer=new PawnLayer();w.piles=[weapon(w,'steel-spear')];p.melee={order:null,strike:{atCore:w.tick*10,untilCore:w.tick*10+156,targetId:null,tool:'steel-spear-point',outcome:'miss'}};
 try{
  layer.update(w,1,true);const cache=layer.animationCache,retain=()=>cache.set(0,1,1,0,0,1);retain();layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(1);
  p.melee!.strike!.tool='steel-spear-shaft-poke';layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(0);expect(layer.feedbackSource!.getAttribute('aMotion').getY(0)).toBe(12);retain();layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(1);
  p.melee!.strike!.atCore-=10;layer.update(w,1,false);expect(cache.get(0,1,3)).toBe(0);
 }finally{layer.dispose();}
});

test('portraits, storage and item information expose the actual spear pigment, contact tools and quality-only point penetration',()=>{
 const {w,p}=fixture(),identity=appearanceOf(p,w.seed),look=apparelAppearance(),urls=SPEAR_ITEMS_272.map(item=>{const url=portraitDataUrl(identity,look,item),svg=decodeURIComponent(url.split(',')[1]!);expect(svg).toContain(`data-weapon="${item}"`);expect(svg).toContain('<polygon');expect(svg).not.toContain('NaN');return svg.replace(/data-weapon="[^"]*"/,'');});expect(new Set(urls).size).toBe(6);
 const branches=STORAGE_FILTER_TREE.find(n=>n.id==='weapons')!.children!,melee=branches.find(n=>n.id==='melee')!,ranged=branches.find(n=>n.id==='ranged')!;
 for(const item of SPEAR_ITEMS_272){expect(storageNodeLeaves(melee)).toContain(item);expect(storageNodeLeaves(ranged)).not.toContain(item);const pile=weapon(w,item);pile.weapon!.quality='excellent';const info=itemInformation(pile,w),value=(label:string)=>info.rows.find(r=>r.label===label)?.value;
  expect(value('Pénétration de la pointe')).toBe('60 %');expect(value('Hampe · coup')).toContain('contondants');expect(value('Hampe · poussée')).toContain('poussée');expect(value('Masse unitaire')).toContain('2');expect(JSON.stringify(info)).not.toMatch(/DPS|dégâts par seconde|ticks/i);
 }
});
