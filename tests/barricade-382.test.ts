import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createWorld,applyCommand,stepWorld} from '../src/sim/engine';
import {constructionMaterials,constructionRecipe,validConstructionMaterial} from '../src/sim/construction-materials';
import {structureMaxHp,structureFlammability} from '../src/sim/thing-damage-rules';
import {structureBeauty} from '../src/sim/room-beauty';
import {structureRoomMarketValue} from '../src/sim/room-market-value';
import {buildingSupportNeed256} from '../src/sim/bridge-rules';
import {STRUCTURE_SHOT_FILL} from '../src/sim/combat-content';
import {animalNavigation} from '../src/sim/wildlife-navigation';
import {furnitureDelay} from '../src/sim/furniture-travel';
import {validateWorld,serializeWorld,deserializeWorld} from '../src/sim/serialization';
import {addGroundMaterial,refreshStock} from '../src/sim/materials';
import {convertRwsSave} from '../src/import/rimworld/convert';
import {readRwsSave} from '../src/import/rimworld/rws-save';
import type {World,Structure} from '../src/sim/types';

function fixture():World {
 const w=createWorld(382,40,40);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
 const p=w.pawns[0]!;w.pawns=[p];p.x=8;p.z=8;p.path=[];p.state='idle';p.hunger=100;p.rest=100;p.recreation.level=100;
 p.schedule.fill('work');for(const k of Object.keys(p.priorities) as (keyof typeof p.priorities)[])p.priorities[k]=0;
 p.priorities.build=1;p.priorities.haul=1;p.skills.construction={level:10,xp:0,dailyXp:0,passion:0};refreshStock(w);return w;
}
it('has the genuine twelve Core Stuff variants, HP, work, beauty, fire, support and cover',()=>{
 expect(constructionMaterials('barricade')).toHaveLength(12);
 for(const material of constructionMaterials('barricade')){
   expect(validConstructionMaterial('barricade',material,381)).toBe(false);
   expect(constructionRecipe({kind:'barricade',material}).ingredients).toEqual([{item:material,quantity:5}]);
 }
 expect(validConstructionMaterial('barricade','cloth',382)).toBe(false);expect(validConstructionMaterial('wall','plasteel',382)).toBe(false);
 const b={id:1,kind:'barricade',x:20,z:20,orientation:0,footprint:'standard',material:'wood'} as Structure;
 expect(constructionRecipe(b).coreWork).toBe(224);expect(structureMaxHp(b)).toBe(195);expect(structureFlammability(b)).toBe(1);expect(structureBeauty(b)).toBe(-3);
 expect(structureMaxHp({...b,material:'plasteel'})).toBe(840);expect(structureFlammability({...b,material:'plasteel'})).toBe(0);
 expect(constructionRecipe({...b,material:'granite-blocks'}).coreWork).toBe(2060);expect(buildingSupportNeed256(b)).toBe('Light');expect(buildingSupportNeed256({...b,material:'granite-blocks'})).toBe('Heavy');
 expect(structureBeauty({...b,material:'gold'})).toBe(17);expect(structureRoomMarketValue({...b,material:'gold'})).toBeGreaterThan(50);expect(STRUCTURE_SHOT_FILL.barricade).toBe(.55);
});
it('builds a real wood barricade, slows people, fences pen animals, reloads and deconstructs without becoming a sandbag',()=>{
 const w=fixture(),target={x:20,z:20};addGroundMaterial(w,'wood',5,{x:12,z:12});refreshStock(w);
 const placed=applyCommand(w,{type:'designate',kind:'barricade',...target,material:'wood',orientation:0});expect(placed.ok,placed.ok?'':placed.reason).toBe(true);
 for(let i=0;i<3500&&!w.structures.some(s=>s.kind==='barricade');i++)stepWorld(w);
 const b=w.structures.find(s=>s.kind==='barricade')!;expect(b).toMatchObject({kind:'barricade',material:'wood',...target});
 expect(validateWorld(w)).toEqual([]);expect(furnitureDelay(w,{x:20,z:19},target)).toBeGreaterThanOrEqual(4.2);
 expect(animalNavigation(w,false,false).occupy(target)).toBe(false);expect(animalNavigation(w,false,true).occupy(target)).toBe(true);
 expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
 expect(applyCommand(w,{type:'designate',kind:'deconstruct',...target,targetId:b.id}).ok).toBe(true);
 for(let i=0;i<3500&&w.structures.includes(b);i++)stepWorld(w);
 expect(w.structures.includes(b)).toBe(false);expect(validateWorld(w)).toEqual([]);
},60000);
it('imports actual Core Barricade and Stuff without converting to sandbags',()=>{
 const raw=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');const added='<thing Class="Building"><def>Barricade</def><id>Barricade888</id><map>0</map><pos>(3, 0, 3)</pos><stuff>Uranium</stuff><health>750</health></thing>';
 const c=convertRwsSave(readRwsSave(raw.replace('</things>',added+'</things>')),{planet:false}),b=c.world.structures.find(s=>s.id===c.thingIds.get('Barricade888'))!;
 expect(b).toMatchObject({kind:'barricade',material:'uranium'});expect(b.damage).toBeUndefined();expect(validateWorld(c.world)).toEqual([]);
},60000);
