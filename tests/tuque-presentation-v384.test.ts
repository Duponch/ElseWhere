import {expect,test} from 'vitest';
import {APPAREL,newApparelState} from '../src/sim/apparel-rules.ts';
import {apparelAppearance,APPAREL_CARGO,foldedApparel} from '../src/render/character-apparel.ts';
import {pawnGeometry,TUQUE_DYE,FLAK_HELMET_DYE} from '../src/render/pawn-geometry.ts';
import {itemGeometry} from '../src/render/item-presentation.ts';
import {itemPortraitSvg} from '../src/render/item-portrait.ts';
import {PawnLayer} from '../src/render/PawnLayer.ts';
import {portraitDataUrl} from '../src/ui/pawn-portrait.ts';
import {appearanceOf} from '../src/sim/pawn-appearance.ts';
import {modelIconUrl} from '../src/ui/pictograms.ts';
import {tuqueWorkshopV384} from './scenarios/tuque-v384.ts';
import type {MaterialPile} from '../src/sim/types.ts';

test('tuque cloth/wool share original resident head geometry, preserve bare face and use distinct existing actor codes',()=>{
  const {world:w,pawnId}=tuqueWorkshopV384(),pawn=w.pawns.find(p=>p.id===pawnId)!;const before=JSON.stringify(w);
  const geometry=pawnGeometry(),dye=geometry.getAttribute('dye'),bone=geometry.getAttribute('boneId');let cap=0,flak=0;
  for(let i=0;i<dye.count;i++){if(dye.getX(i)===TUQUE_DYE){cap++;expect(bone.getX(i)).toBe(1);}if(dye.getX(i)===FLAK_HELMET_DYE)flak++;}
  expect(cap).toBe(58);expect(flak).toBeGreaterThan(60);expect(geometry.getAttribute('position').count).toBe(3190);geometry.dispose();
  const layer=new PawnLayer(),portraits:string[]=[];
  for(const [item,code,tuque] of [['cloth-tuque',6,1],['muffalo-wool-tuque',8,2]] as const){
    const pile:MaterialPile={id:w.nextId,kind:'apparel',item,quantity:1,owner:{type:'apparel',pawnId},apparel:newApparelState(item)},look=apparelAppearance([pile]);
    expect(look).toMatchObject({tuque,helmet:false,reconHelmet:false,silhouette:0});expect(foldedApparel(item)[0]!.color).toBe(APPAREL[item].color);expect(APPAREL_CARGO[item]).toBeGreaterThan(81);
    w.piles.push(pile);layer.update(w,1,true);expect(layer.feedbackSource!.getAttribute('aEquipment').getZ(0)).toBe(code);w.piles.pop();
    const svg=decodeURIComponent(portraitDataUrl(appearanceOf(pawn,w.seed),look).split(',')[1]!);expect(svg).toContain(`data-tuque="${tuque}"`);expect(svg).toContain('data-recon-helmet="false"');portraits.push(svg);
  }
  expect(portraits[0]).not.toBe(portraits[1]);expect(JSON.stringify(w)).toBe(before);layer.dispose();
});

test('ground, carried and UI icons reuse authored cap geometry including its unfinished item',()=>{
  for(const item of ['cloth-tuque','muffalo-wool-tuque','unfinished-tuque'] as const){
    const parts=itemGeometry(item,1);expect(parts).toHaveLength(2);expect(parts.map(p=>p.shape)).toEqual(['item-helmet','item-disc']);
    expect(itemPortraitSvg(item)).toContain('<path ');expect(modelIconUrl('item-'+item)).toBe(`/assets/ui/elsewhere/pictograms-20261107/item-${item}.svg`);
  }
  expect(modelIconUrl('item-cloth-shirt')).toContain('/pictograms-20261107/');expect(new Set(Object.values(APPAREL_CARGO)).size).toBe(Object.keys(APPAREL_CARGO).length);
});
