import {afterEach,expect,test,vi} from 'vitest';
import {itemGeometry,itemCargoKind} from '../src/render/item-presentation';
import {cargoGeometry,pawnGeometry,selectCargoGeometryKinds,type CargoGeometryRange} from '../src/render/pawn-geometry';
import {weaponVisual} from '../src/render/weapon-shape';
import {itemPortraitSvg,itemPortraitDataUrl} from '../src/render/item-portrait';
import {modelIconUrl} from '../src/ui/pictograms';
import {billControls,updateBillControls,plasteelKnifeRecipeDescription} from '../src/ui/bill-controls';
import {updateUnfinishedInspection} from '../src/ui/unfinished-inspection';
import {newCookingBill} from '../src/sim/cooking-bills';
import {smithingWorkTotal267} from '../src/sim/smithing-content-267';
import {deconstructionCamp} from './scenarios/deconstruction';
import type {Command,MaterialPile,Structure} from '../src/sim/types';

// Small DOM substitute, following the existing UI tests; no jsdom dependency.
class UiNode444 {
 readonly dataset:Record<string,string>={};children:(UiNode444|string)[]=[];
 textContent='';className='';id='';title='';value='';type='';min='';max='';step='';
 checked=false;hidden=false;disabled=false;onclick:(()=>void)|null=null;
 constructor(readonly tag:string){}
 append(...nodes:(UiNode444|string)[]){this.children.push(...nodes);}
 setAttribute(_key:string,_value:string){}
 addEventListener(_event:string,_listener:()=>void){}
 remove(){}
 set innerHTML(value:string){
  if(value!=='<p></p><button class="secondary-action">Annuler cet ouvrage</button>')throw Error('Unexpected markup');
  const button=new UiNode444('button');button.textContent='Annuler cet ouvrage';this.children=[new UiNode444('p'),button];
 }
 all():UiNode444[]{return this.children.flatMap(node=>typeof node==='string'?[]:[node,...node.all()]);}
 querySelectorAll<T=UiNode444>(selector:string):T[]{
  const data=/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);
  return this.all().filter(node=>{
   if(!data)return node.tag===selector;
   const key=data[1]!.replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase());
   return Object.hasOwn(node.dataset,key)&&(data[2]===undefined||node.dataset[key]===data[2]);
  }) as T[];
 }
 querySelector<T=UiNode444>(selector:string):T|null{return this.querySelectorAll<T>(selector)[0]??null;}
}
function dom444(){vi.stubGlobal('document',{createElement:(tag:string)=>new UiNode444(tag)});}
afterEach(()=>vi.unstubAllGlobals());

test('unfinished knife keeps a bare tang and blunt blank, while the existing finished model and both icons agree',()=>{
 const original=structuredClone(weaponVisual('plasteel-knife')),finished=itemGeometry('plasteel-knife',1),blank=itemGeometry('unfinished-knife',1);
 expect(finished).toHaveLength(4);expect(blank).toHaveLength(2);
 expect(blank.map(p=>[p.sx,p.sy,p.sz])).toEqual([original!.parts[0]!,original!.parts[2]!].map(p=>[p.size[0],p.size[2],p.size[1]]));
 expect(new Set(blank.map(p=>p.color)).size).toBe(1);expect(blank).not.toEqual(finished);
 expect(weaponVisual('plasteel-knife')).toEqual(original);
 for(const item of ['unfinished-knife','plasteel-knife'] as const){
  const svg=itemPortraitSvg(item);expect(svg).toContain('<path');expect(svg).not.toContain('NaN');
  expect(modelIconUrl(`item-${item}`)).toBe(`/assets/ui/elsewhere/pictograms-20261107/item-${item}.svg`);
 }
 expect(itemPortraitSvg('unfinished-knife')).not.toBe(itemPortraitSvg('plasteel-knife'));
});

test('the new blank uses a finite resident cargo range without extending either ordinary pawn rig',()=>{
 const cargo=cargoGeometry(),ordinary=pawnGeometry(),armored=pawnGeometry(true);
 try{
  expect(ordinary.getAttribute('position').count).toBe(3190);expect(armored.getAttribute('position').count).toBe(3720);
  const kind=itemCargoKind('unfinished-knife'),range=(cargo.userData.cargoRangesByKind as Record<number,CargoGeometryRange>)[kind]!;
  expect(range.count).toBe(72);expect(kind).not.toBe(itemCargoKind('plasteel-knife'));
  const position=cargo.getAttribute('position'),normal=cargo.getAttribute('normal'),types=cargo.getAttribute('cargoKind');
  for(let i=range.start;i<range.start+range.count;i++){
   expect(types.getX(i)).toBe(kind);
   for(const value of [position.getX(i),position.getY(i),position.getZ(i),normal.getX(i),normal.getY(i),normal.getZ(i)])expect(Number.isFinite(value)).toBe(true);
   expect(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))).toBeCloseTo(1,5);
  }
  selectCargoGeometryKinds(cargo,new Set([kind]));expect(cargo.groups).toEqual([range]);expect(cargo.instanceCount).toBe(0);
 }finally{cargo.dispose();ordinary.dispose();armored.dispose();}
});

test('all three real station menus send the recipe, expose only checked plasteel and preserve explicit bill settings',()=>{
 dom444();const w=deconstructionCamp(),sent:Command[]=[];
 for(const kind of ['crafting-spot','fueled-smithy','electric-smithy'] as const){
  const station:Structure={id:w.nextId++,kind,x:10,z:10,orientation:0,footprint:'standard',bills:[]};
  const menu=billControls(station,c=>sent.push(c)) as unknown as UiNode444;
  updateBillControls(menu as unknown as ParentNode,station,w);
  const add=menu.querySelector('[data-add-recipe="make-plasteel-knife"]')!;
  expect(add).not.toBeNull();expect(add.hidden).toBe(false);expect(add.disabled).toBe(false);
  expect(add.title).toBe(plasteelKnifeRecipeDescription);expect(add.title).toContain('sans niveau minimum');expect(add.title).toContain('aucune recherche de recette');
  expect(add.title).toContain('efficacité de base 50 %');expect(add.title).not.toMatch(/ticks|Core|locaux/);
  add.onclick!();expect(sent.at(-1)).toEqual({type:'bill-add',structureId:station.id,recipe:'make-plasteel-knife'});
  station.bills=[newCookingBill(w.nextId++,'make-plasteel-knife')];
  const form=billControls(station,c=>sent.push(c)) as unknown as UiNode444;
  expect(form.all().filter(node=>node.className==='bill-cost').map(node=>node.textContent)).toEqual([plasteelKnifeRecipeDescription]);
  const materials=form.all().filter(node=>node.tag==='input'&&node.type==='checkbox'&&node.dataset.field!=='suspended');
  expect(materials.map(node=>[node.dataset.field,node.checked])).toEqual([['plasteel',true]]);
  form.querySelector('[data-apply-bill]')!.onclick!();expect(sent.at(-1)).toMatchObject({type:'bill-update',structureId:station.id,billId:station.bills[0]!.id,settings:{filters:{plasteel:true},mode:'times',target:1,destination:'stockpile'}});
 }
});

test('the generic unfinished inspection reads knife author, engaged material and progress and sends the existing cancellation',()=>{
 dom444();const w=deconstructionCamp(),author=w.pawns[0]!,panel=new UiNode444('div'),sent:Command[]=[];
 author.name='<img src=x>';const pile:MaterialPile={id:w.nextId++,kind:'unfinished',item:'unfinished-knife',quantity:1,owner:{type:'ground',x:10,z:10},smithingWork:{recipe:'make-plasteel-knife',material:'plasteel',authorId:author.id,progress:smithingWorkTotal267('make-plasteel-knife','plasteel')/2,parts:[{item:'plasteel',quantity:30}]}};
 const before=structuredClone(w);
 updateUnfinishedInspection(panel as unknown as HTMLElement,w,pile,c=>sent.push(c));
 expect(panel.querySelector('p')!.textContent).toContain('50 %');expect(panel.querySelector('p')!.textContent).toContain('<img src=x>');expect(panel.querySelector('p')!.textContent).toContain('30 plastacier');
 expect(panel.querySelector('img')).toBeNull();panel.querySelector('button')!.onclick!();expect(sent).toEqual([{type:'cancel-unfinished',itemId:pile.id}]);expect(w).toEqual(before);
});
