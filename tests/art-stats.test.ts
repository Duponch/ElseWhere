import { describe,expect,it } from 'vitest';
import {
  isSculptureKind,isSculptureMaterial,sculptureBeauty,sculptureMaxHitPoints,
  sculptureWorkToMakeCore,
} from '../src/sim/furniture-stats.ts';
import { BeautyMapCache,structureBeauty } from '../src/sim/room-beauty.ts';
import { structureRoomMarketValue,structureRoomStandable } from '../src/sim/room-market-value.ts';
import { structureFlammability,structureLeavesResources,structureMaxHp } from '../src/sim/thing-damage-rules.ts';
import { constructionRecipe,validConstructionMaterial } from '../src/sim/construction-materials.ts';
import { footprintCells,footprintContains } from '../src/sim/definitions.ts';
import { FURNITURE_TRAVEL } from '../src/sim/furniture-travel.ts';
import { OCCUPANCY } from '../src/sim/occupancy.ts';
import { minifiable } from '../src/sim/furniture-rules.ts';
import type { Structure,StructureKind } from '../src/sim/types.ts';

const building=(kind:string,material:Structure['material']='wood',quality:Structure['quality']='normal',damage=0):Structure=>({
  id:1,kind:kind as StructureKind,x:0,z:0,orientation:0,footprint:'standard',material,quality,...(damage?{damage}:{}),
});

describe('sculptures et atelier Core 1.6.4871',()=>{
  it('construit seulement l’atelier 3×1 avec ses deux compositions et quatre orientations',()=>{
    expect(validConstructionMaterial('art-bench','wood',103)).toBe(false);
    expect(validConstructionMaterial('art-bench','wood',104)).toBe(true);
    expect(validConstructionMaterial('art-bench','steel',104)).toBe(true);
    expect(validConstructionMaterial('art-bench','marble-blocks',104)).toBe(false);
    expect(constructionRecipe({kind:'art-bench',material:'wood'})).toMatchObject({ingredients:[{item:'wood',quantity:75},{item:'steel',quantity:50}],coreWork:1750,work:175});
    expect(constructionRecipe({kind:'art-bench',material:'steel'})).toMatchObject({ingredients:[{item:'steel',quantity:125}],coreWork:2500,work:250});
    for(const orientation of [0,1,2,3] as const){
      const bench={kind:'art-bench' as const,x:5,z:5,orientation};
      const cells=footprintCells(bench);
      expect(cells).toHaveLength(3);
      for(const cell of cells)expect(footprintContains(bench,cell)).toBe(true);
    }
  });

  it('rend les sculptures transportables et installables, sans recette de construction',()=>{
    for(const kind of ['small-sculpture','large-sculpture'] as const){
      expect(validConstructionMaterial(kind,'marble-blocks',104)).toBe(true);
      expect(validConstructionMaterial(kind,'cloth',104)).toBe(false);
      expect(constructionRecipe({kind,material:'wood'}).ingredients).toEqual([{item:'wood',quantity:kind==='small-sculpture'?50:100}]);
      expect(footprintCells({kind,x:5,z:5,orientation:0})).toEqual([{x:5,z:5}]);
      expect(minifiable(kind)).toBe(true);
      expect(FURNITURE_TRAVEL[kind].stand).toBe(false);
      expect(OCCUPANCY[kind].store).toBe(false);
    }
    expect(minifiable('art-bench')).toBe(true);
  });
  it('garde les deux tailles, les sept matières produites et WorkToMake distinct du travail de construction',()=>{
    expect(isSculptureKind('small-sculpture')).toBe(true);
    expect(isSculptureKind('large-sculpture')).toBe(true);
    expect(isSculptureKind('art-bench')).toBe(false);
    for(const material of ['wood','steel','granite-blocks','limestone-blocks','marble-blocks','sandstone-blocks','slate-blocks'])
      expect(isSculptureMaterial(material),material).toBe(true);
    expect(isSculptureMaterial('cloth')).toBe(false);
    expect(isSculptureMaterial('light-leather')).toBe(false);
    expect(sculptureWorkToMakeCore('small-sculpture','wood')).toBe(12600);
    expect(sculptureWorkToMakeCore('large-sculpture','steel')).toBe(30000);
    expect(sculptureWorkToMakeCore('small-sculpture','marble-blocks')).toBe(20700);
    expect(sculptureWorkToMakeCore('large-sculpture','granite-blocks')).toBe(39000);
  });

  it('applique matière puis qualité et l’arrondi Core seulement au-delà de 100 beauté',()=>{
    expect(sculptureBeauty(building('small-sculpture','wood','awful'))).toBe(-5);
    // Schema 311: Core FinalizeValue rounds Beauty to an integer (midpoint to even), 68.5 → 68.
    expect(sculptureBeauty(building('small-sculpture','marble-blocks'))).toBe(68);
    expect(sculptureBeauty(building('small-sculpture','marble-blocks'),310)).toBe(68.5);
    expect(sculptureBeauty(building('small-sculpture','sandstone-blocks'))).toBeCloseTo(55,8);
    expect(sculptureBeauty(building('large-sculpture','marble-blocks'))).toBe(135);
    expect(sculptureBeauty(building('large-sculpture','marble-blocks','good'))).toBe(270);
    expect(sculptureBeauty(building('large-sculpture','marble-blocks','legendary'))).toBe(1090);
    expect(structureBeauty(building('small-sculpture','steel','excellent'))).toBe(150);
    expect(structureBeauty(building('art-bench','wood'))).toBe(0);
  });

  it('compte une sculpture posée une seule fois dans la carte dérivée',()=>{
    const sculpture=building('small-sculpture','marble-blocks');
    const map=new BeautyMapCache().read({width:2,height:1,tiles:[{terrain:'soil'},{terrain:'soil'}],structures:[sculpture]});
    expect(map.thingsAtIndex(0)).toBe(68);
    expect(map.thingsAtIndex(1)).toBe(0);
  });

  it('module les PV et le feu par matière, sans facteur de qualité sur les PV',()=>{
    expect(sculptureMaxHitPoints('small-sculpture','wood')).toBe(59);
    expect(structureMaxHp(building('small-sculpture','wood'))).toBe(59);
    expect(structureMaxHp(building('large-sculpture','granite-blocks','legendary'))).toBe(255);
    expect(structureMaxHp(building('art-bench','wood'))).toBe(117);
    expect(structureMaxHp(building('art-bench','steel'))).toBe(180);
    expect(structureFlammability(building('small-sculpture','marble-blocks'))).toBe(0);
    expect(structureFlammability(building('large-sculpture','steel'))).toBe(.4);
    expect(structureLeavesResources(building('small-sculpture'))).toBe(true);
  });

  it('calcule valeur de matière, WorkToMake, qualité et état avant l’arrondi unitaire',()=>{
    expect(structureRoomMarketValue(building('small-sculpture','wood'))).toBeCloseTo(105.36,8);
    expect(structureRoomMarketValue(building('large-sculpture','wood'))).toBeCloseTo(195.6,8);
    expect(structureRoomMarketValue(building('small-sculpture','marble-blocks'))).toBeCloseTo(119.52,8);
    expect(structureRoomMarketValue(building('small-sculpture','marble-blocks','good'))).toBeCloseTo(149.4,8);
    expect(structureRoomMarketValue(building('large-sculpture','marble-blocks'))).toBe(215);
    expect(structureRoomMarketValue(building('small-sculpture','wood','normal',30))).toBeCloseTo(105.36*(29/59*.2),8);
    expect(structureRoomMarketValue(building('art-bench','wood'))).toBeCloseTo(191.3,8);
    expect(structureRoomStandable('art-bench' as StructureKind)).toBe(false);
    expect(structureRoomStandable('small-sculpture' as StructureKind)).toBe(false);
  });
});
