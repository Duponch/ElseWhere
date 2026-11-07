import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {itemGeometry,itemCargoKind,ITEM_VISUAL_IDS} from '../src/render/item-presentation';
import {modelIconUrl} from '../src/ui/pictograms';
import {itemInformation} from '../src/ui/item-information';
import {pemmicanRecipeDescription,updateBillControls} from '../src/ui/bill-controls';
import {researchProjects} from '../src/ui/research-projects';
import {readResearchReadiness} from '../src/ui/research-readiness';
import {STORAGE_FILTER_TREE,STORAGE_LEAVES,storageNodeLeaves} from '../src/ui/storage-filter-tree';
import {PEMMICAN_RESEARCH_COST,RESEARCH_SCALE} from '../src/sim/research';
import {ROT_DAYS} from '../src/sim/food-preservation';
import {addMaterial} from '../src/sim/materials';
import {deconstructionCamp} from './scenarios/deconstruction';
import {pemmicanWorkshopV389} from './scenarios/pemmican-v389';
import {newCookingBill} from '../src/sim/cooking-bills';

test('V389 original pemmican pile reuses bounded resident shapes and a separate original icon',()=>{
  const parts=itemGeometry('pemmican');expect(parts).toHaveLength(8);
  expect(parts.filter(p=>p.shape==='item-nugget')).toHaveLength(5);expect(parts.filter(p=>p.shape==='item-disc')).toHaveLength(3);
  for(const p of parts){expect([p.x,p.y,p.z,p.sx,p.sy,p.sz].every(Number.isFinite)).toBe(true);expect(p.sy).toBeGreaterThan(0);}
  expect(parts).not.toEqual(itemGeometry('survival-meal'));expect(parts).not.toEqual(itemGeometry('kibble'));
  expect(itemGeometry('pemmican',1).length).toBe(parts.length);expect(itemGeometry('pemmican',100000).length).toBe(parts.length);
  expect(ITEM_VISUAL_IDS).toContain('pemmican');expect(itemCargoKind('pemmican')).toBeGreaterThanOrEqual(200);
  const url=modelIconUrl('item-pemmican');expect(url).toBe('/assets/ui/elsewhere/pictograms-20261107/item-pemmican.svg');
  const svg=readFileSync(new URL(`../public${url}`,import.meta.url),'utf8');expect(svg).toContain('<title>Pemmican</title>');expect(svg).toContain('<path');expect(svg).not.toMatch(/<image|(?:href|src)=/);
});

test('V389 one Plats storage leaf, factual recipe and information without implying caravan rations',()=>{
  const meals=STORAGE_FILTER_TREE.find(n=>n.id==='foods')!.children!.find(n=>n.id==='meals')!;
  expect(storageNodeLeaves(meals)).toContain('pemmican');expect(STORAGE_LEAVES.filter(id=>id==='pemmican')).toHaveLength(1);
  expect(pemmicanRecipeDescription).toContain('5 viandes animales + 5 végétaux → 16 pemmicans');expect(pemmicanRecipeDescription).toContain('lait exclu');
  const w=deconstructionCamp(0);addMaterial(w,'food',16,{type:'ground',x:8,z:8},'pemmican');
  const before=JSON.stringify(w),info=itemInformation(w.piles.at(-1)!);
  expect(info.title).toBe('Pemmican');expect(info.rows).toContainEqual(expect.objectContaining({label:'Nutrition',value:'0.05'}));
  expect(info.rows).toContainEqual(expect.objectContaining({label:'Conservation',value:`${ROT_DAYS.pemmican} jours`}));
  expect(info.rows.find(r=>r.label==='Usage')!.description).toContain('toujours des repas de survie');expect(JSON.stringify(w)).toBe(before);
});

test('V389 research node reads actual integer micro-points, distinct placement and schema admission',()=>{
  const w=deconstructionCamp(0),node=researchProjects.find(p=>p.id==='pemmican')!;
  expect(node.cost).toBe(PEMMICAN_RESEARCH_COST/RESEARCH_SCALE);expect(node.cost).toBe(500);
  expect(researchProjects.filter(p=>p.x===node.x&&p.y===node.y)).toHaveLength(1);
  w.research={project:null,points:0,pemmican:{points:499*RESEARCH_SCALE}};
  expect(node.progress(w)!.points).toBe(499*RESEARCH_SCALE);expect(node.detail).toContain('Le lait est exclu');
  const before=JSON.stringify(w),current=readResearchReadiness(w),old=structuredClone(w);Object.assign(old,{schemaVersion:247});
  expect(readResearchReadiness(old).remainingCount).toBe(current.remainingCount-1);expect(JSON.stringify(w)).toBe(before);
});

test('V389 add-menu hides unresearched recipes while preserving existing bills and their diagnostics',()=>{
  const f=pemmicanWorkshopV389(),w=f.world,station=w.structures.find(s=>s.id===f.stationId)!;
  // A saved bill is a separate subject from the menu used to add a new bill.
  const bill=newCookingBill(w.nextId++,'make-pemmican');station.bills=[bill];
  const buttons=['simple-meal','make-pemmican','tuque'].map(recipe=>({dataset:{addRecipe:recipe},hidden:false,disabled:false,title:''}));
  const status={textContent:''},reason={textContent:''},form={hidden:false,dataset:{dirty:'1'},querySelector(selector:string){
    if(selector==='[data-bill-status]')return status;if(selector==='[data-bill-reason]')return reason;throw Error(selector);
  }};
  const root={querySelectorAll:()=>buttons,querySelector:(selector:string)=>selector===`[data-bill="${bill.id}"]`?form:null};
  const before=JSON.stringify(w);updateBillControls(root as unknown as ParentNode,station,w);
  expect(buttons[0]).toMatchObject({hidden:false,disabled:false});expect(buttons[1]).toMatchObject({hidden:true,disabled:true});
  expect(buttons[2]).toMatchObject({hidden:true,disabled:true});expect(form.hidden).toBe(false);expect(status.textContent.toLowerCase()).toContain('pemmican');
  expect(reason.textContent.length).toBeGreaterThan(0);expect(JSON.stringify(w)).toBe(before);
  const known=structuredClone(w);known.research!.pemmican={points:PEMMICAN_RESEARCH_COST,completedAt:known.tick};
  updateBillControls(root as unknown as ParentNode,known.structures.find(s=>s.id===f.stationId)!,known);
  expect(buttons[1]).toMatchObject({hidden:false,disabled:false});expect(buttons[2]).toMatchObject({hidden:true,disabled:true});
  expect(form.hidden).toBe(false);expect(buttons[1]!.title).toBe(pemmicanRecipeDescription);
});
