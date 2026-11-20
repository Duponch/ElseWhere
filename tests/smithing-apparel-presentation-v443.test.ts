import {isHatItem353} from '../src/sim/apparel-definitions';
import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import {APPAREL,newApparelState} from '../src/sim/apparel-rules';
import {SMITHING_APPAREL_ITEMS267,ARMOR_STUFFS267} from '../src/sim/smithing-apparel-267';
import {appearanceOf} from '../src/sim/pawn-appearance';
import {apparelAppearance,APPAREL_CARGO,SIMPLE_HELMET_ITEMS267} from '../src/render/character-apparel';
import {pawnGeometry,PLATE_ARMOR_DYE,SIMPLE_HELMET_DYE,FLAK_HELMET_DYE,RECON_ARMOR_DYE,TUQUE_DYE} from '../src/render/pawn-geometry';
import {PawnLayer} from '../src/render/PawnLayer';
import {itemCargoKind} from '../src/render/item-presentation';
import {portraitDataUrl} from '../src/ui/pawn-portrait';
import type {MaterialPile} from '../src/sim/types';
import type {ApparelItem} from '../src/sim/apparel-rules';

const piece=(id:number,pawnId:number,item:ApparelItem):MaterialPile=>({id,item,kind:'apparel',quantity:1,owner:{type:'apparel',pawnId},apparel:newApparelState(item)});

test('all eleven worn armor variants keep material pigment and distinct original silhouettes',()=>{
 for(const item of SMITHING_APPAREL_ITEMS267){const look=apparelAppearance([piece(10,1,item)]);
  if(item.endsWith('-plate-armor'))expect(look).toMatchObject({plateArmor:true,silhouette:6,color:APPAREL[item].color,vest:false,helmet:false});
  else expect(look).toMatchObject({simpleHelmet:true,helmet:true,reconHelmet:false,tuque:0,simpleHelmetColor:APPAREL[item].color,simpleHelmetMaterial:SIMPLE_HELMET_ITEMS267.indexOf(item as typeof SIMPLE_HELMET_ITEMS267[number])+1});
  expect(APPAREL_CARGO[item]).toBe(itemCargoKind(item));expect(APPAREL_CARGO[item]).toBeGreaterThanOrEqual(200);
 }
 expect(APPAREL_CARGO['flak-helmet']).toBe(59);expect(APPAREL_CARGO['recon-helmet']).toBe(72);expect(APPAREL_CARGO['recon-armor']).toBe(81);expect(APPAREL_CARGO['cloth-tuque']).toBe(82);expect(APPAREL_CARGO['muffalo-wool-tuque']).toBe(83);
 const distinct=Object.entries(APPAREL_CARGO).filter(([item])=>!isHatItem353(item));expect(new Set(distinct.map(([,kind])=>kind)).size).toBe(distinct.length); // 353 hats carry the cloth tuque's model
});

test('plate limbs and open simple helmet share the existing rigid bones, finite normals and index buffer',()=>{
 const g=pawnGeometry(true);try{const pos=g.getAttribute('position'),normal=g.getAttribute('normal'),dye=g.getAttribute('dye'),bone=g.getAttribute('boneId'),pivot=g.getAttribute('bindPivot');
  expect(pos.count).toBe(3720);expect(normal.count).toBe(pos.count);expect(pivot.count).toBe(pos.count);
  const plates=new Set<number>();let plateCount=0,helmetCount=0,flak=0,recon=0,tuque=0;
  for(let i=0;i<pos.count;i++){for(const v of [pos.getX(i),pos.getY(i),pos.getZ(i),normal.getX(i),normal.getY(i),normal.getZ(i)])expect(Number.isFinite(v)).toBe(true);
   if(dye.getX(i)===PLATE_ARMOR_DYE){plateCount++;plates.add(bone.getX(i));}
   if(dye.getX(i)===SIMPLE_HELMET_DYE){helmetCount++;expect(bone.getX(i)).toBe(1);expect(pivot.getY(i)).toBeCloseTo(1.04,6);expect(pos.getY(i)).toBeGreaterThan(1.28);}
   if(dye.getX(i)===FLAK_HELMET_DYE)flak++;if(dye.getX(i)===RECON_ARMOR_DYE)recon++;if(dye.getX(i)===TUQUE_DYE)tuque++;
  }
  expect(plateCount).toBe(408);expect(helmetCount).toBe(122);expect([...plates].sort()).toEqual([0,2,3,4,5,6,7]);expect(flak).toBeGreaterThan(60);expect(recon).toBeGreaterThan(100);expect(tuque).toBe(58);
  expect(g.index).not.toBeNull();for(const i of g.index!.array)expect(i).toBeLessThan(pos.count);
 }finally{g.dispose();}
});

test('confirmed actor projection packs new garments in existing attributes while keeping old codes exact',()=>{
 // Prepared publication fixture, no claim of a played manufacture/equip job.
 const w=createWorld(443,32,32),pawn=w.pawns[0]!;w.pawns=[pawn];w.piles=[];const layer=new PawnLayer();
 try{
  for(const [index,item]of SIMPLE_HELMET_ITEMS267.entries()){
   const plate=item.replace('-simple-helmet','-plate-armor') as ApparelItem;w.piles=[piece(w.nextId++,pawn.id,plate),piece(w.nextId++,pawn.id,item)];const before=structuredClone(w);
   layer.update(w,1,true);const g=layer.feedbackSource!,a=g.getAttribute('aEquipment');expect(a.itemSize).toBe(4);expect(a.getY(0)).toBe(6);expect(a.getZ(0)).toBe(10);expect(a.getW(0)).toBe((index+1)/16);expect(w).toEqual(before);
  }
  for(const [item,code]of [['flak-helmet',2],['recon-helmet',4],['cloth-tuque',6],['muffalo-wool-tuque',8]] as const){w.piles=[piece(w.nextId++,pawn.id,item)];layer.update(w,1,true);expect(layer.feedbackSource!.getAttribute('aEquipment').getZ(0)).toBe(code);}
  w.piles=[piece(w.nextId++,pawn.id,'flak-vest'),piece(w.nextId++,pawn.id,'plasteel-flak-helmet')];layer.update(w,1,true);const old=layer.feedbackSource!.getAttribute('aEquipment');expect(old.getZ(0)).toBe(3);expect(old.getW(0)).toBe(.5);
 }finally{layer.dispose();}
});

test('old colonies retain3190vertices and first worn armor extends once without replacing shared trajectories or materials',()=>{
 const w=createWorld(443,32,32),pawn=w.pawns[0]!;w.pawns=[pawn];w.piles=[];const layer=new PawnLayer();let retiredDisposals=0;
 try{
  layer.update(w,1,true);const previous=layer.feedbackSource!;expect(previous.getAttribute('position').count).toBe(3190);previous.addEventListener('dispose',()=>retiredDisposals++);
  const actor=layer.group.children.find(node=>node.name==='Colonists — procedural eight-bone GPU rig')!;
  const material=(actor as import('three/webgpu').Mesh).material,count=layer.group.children.length;
  const shared=['aFrom','aTo','aMotion','aCargo','aTravel','aEquipment','aSkin','aShape','aFire'];
  const attributes=new Map(shared.map(name=>[name,previous.getAttribute(name)]));
  // Ground/inventory armor does not expand a worn-person model.
  const plate=piece(w.nextId++,pawn.id,'wood-plate-armor');plate.owner={type:'ground',x:pawn.x,z:pawn.z};w.piles=[plate];layer.update(w,1,false);expect(layer.feedbackSource).toBe(previous);
  plate.owner={type:'apparel',pawnId:pawn.id};layer.update(w,1,false);const extended=layer.feedbackSource!;
  expect(extended).not.toBe(previous);expect(extended.getAttribute('position').count).toBe(3720);expect(extended.instanceCount).toBe(1);expect(retiredDisposals).toBe(0);
  for(const name of shared)expect(extended.getAttribute(name),name).toBe(attributes.get(name));
  expect(layer.group.children).toHaveLength(count);expect((actor as import('three/webgpu').Mesh).material).toBe(material);
  w.piles=[];layer.update(w,1,false);layer.update(w,1,true);expect(layer.feedbackSource).toBe(extended);expect(retiredDisposals).toBe(0);
 }finally{layer.dispose();}
 expect(retiredDisposals).toBe(1);
});

test('portraits project the same new geometry and material colors while preserving the visible face',()=>{
 const w=createWorld(443,32,32),pawn=w.pawns[0]!,identity=appearanceOf(pawn,w.seed);const portraits:string[]=[];
 const bare=decodeURIComponent(portraitDataUrl(identity,apparelAppearance()).split(',')[1]!);expect(bare).not.toContain('data-plate-armor');expect(bare).not.toContain('data-simple-helmet');
 for(const stuff of ARMOR_STUFFS267){const items:ApparelItem[]=[`${stuff}-plate-armor`];if(stuff!=='wood')items.push(`${stuff}-simple-helmet`);
  const look=apparelAppearance(items.map((item,i)=>piece(i+100,pawn.id,item))),svg=decodeURIComponent(portraitDataUrl(identity,look).split(',')[1]!);expect(svg).toContain('data-source="pawn-geometry"');expect(svg).toContain('data-plate-armor="true"');expect(svg).toContain('data-recon-helmet="false"');expect(svg).not.toBe(bare);expect(svg).not.toContain('NaN');
  if(stuff!=='wood'){expect(svg).toContain('data-simple-helmet="true"');expect(svg).toContain(`data-helmet-color="#${APPAREL[`${stuff}-simple-helmet`].color.toString(16).padStart(6,'0')}"`);}
  portraits.push(svg);
 }
 expect(new Set(portraits).size).toBe(6);
});
