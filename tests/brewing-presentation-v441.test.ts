import {afterEach,expect,test,vi} from 'vitest';
import {createWorld} from '../src/sim/index';
import type {Structure} from '../src/sim/types';
import {BREWING_RESEARCH_COST} from '../src/sim/research';
import {initialDrugPolicies265,type DrugPolicyCommand265} from '../src/sim/alcohol-policy-265';
import {brewingParts265,fermentationStatusKey265,fermentationStatusParts265} from '../src/render/brewing-parts265';
import {cropGeometry} from '../src/render/CropLayer';
import {RESIDENT_CROP_KINDS} from '../src/render/flora-presentation';
import {constructionPreviewParts} from '../src/render/construction-preview-parts';
import {itemGeometry} from '../src/render/item-presentation';
import {researchProjects} from '../src/ui/research-projects';
import {architectToolAvailable} from '../src/ui/architect-availability';
import {ARCHITECT_ICON_URLS} from '../src/ui/architect-icons';
import {modelIconUrl} from '../src/ui/pictograms';
import {placementMaterial} from '../src/ui/construction-controls';
import {growingCultureChoices,growingCultureHelp} from '../src/ui/growing-controls';
import {STORAGE_LEAVES} from '../src/ui/storage-filter-tree';
import {brewingInspection265} from '../src/ui/brewing-inspection-265';
import {foodPolicyLayout} from '../src/ui/food-policy-controls';
import {createDrugPolicyControls265} from '../src/ui/drug-policy-controls-265';

test('all resident crop geometries including hops assemble finite compatible GPU attributes',()=>{
 for(const kind of RESIDENT_CROP_KINDS){
  const geometry=cropGeometry(kind);
  try{
   const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
   expect(positions.count,kind).toBeGreaterThan(0);expect(normals.count,kind).toBe(positions.count);expect(uv.count,kind).toBe(positions.count);
   for(const attribute of [positions,normals,uv])expect(Array.from(attribute.array).every(Number.isFinite),kind).toBe(true);
   geometry.computeBoundingBox();expect(geometry.boundingBox!.max.y,kind).toBeGreaterThan(geometry.boundingBox!.min.y);
  }finally{geometry.dispose();}
 }
});

/** Same narrow DOM-double approach as the existing policy UI tests. Only
 * static authored markup is read; a saved label must never enter innerHTML. */
class PolicyNodeFixture {
 children:PolicyNodeFixture[]=[];dataset:Record<string,string>={};attributes=new Map<string,string>();
 textContent='';value='';checked=false;disabled=false;open=false;hidden=false;max='';min='';scope='';
 onclick:(()=>void)|null=null;onchange:(()=>void)|null=null;onsubmit:((e:{preventDefault():void})=>void)|null=null;
 lookup?:Map<string,PolicyNodeFixture>;fieldsetInputs:PolicyNodeFixture[]=[];
 constructor(readonly tag='div',readonly id=''){}
 set innerHTML(_value:string){throw Error('Saved labels must remain literal.');}
 setAttribute(key:string,value:string){this.attributes.set(key,value);}removeAttribute(key:string){this.attributes.delete(key);}
 replaceChildren(...nodes:PolicyNodeFixture[]){this.children=nodes;}append(...nodes:PolicyNodeFixture[]){this.children.push(...nodes);}
 querySelector<T=PolicyNodeFixture>(selector:string):T|null{return (selector.startsWith('#')?this.lookup?.get(selector.slice(1))??null:this.querySelectorAll(selector)[0]??null) as T|null;}
 querySelectorAll<T=PolicyNodeFixture>(selector:string):T[]{if(selector==='fieldset input')return this.fieldsetInputs as unknown as T[];return this.children.flatMap(child=>[...(child.tag===selector?[child]:[]),...child.querySelectorAll<PolicyNodeFixture>(selector)]) as unknown as T[];}
 showModal(){this.open=true;}close(){this.open=false;}
}
function policyDom(){
 const nodes=new Map<string,PolicyNodeFixture>();
 for(const match of foodPolicyLayout().matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/g)){
  const node=new PolicyNodeFixture(match[1],match[2]);node.max=/\bmax="([^"]+)"/.exec(match[0])?.[1]??'';node.min=/\bmin="([^"]+)"/.exec(match[0])?.[1]??'';nodes.set(node.id,node);
 }
 const el=(id:string)=>nodes.get(id)!,root=el('assign-panel'),dialog=el('drug-policy-dialog');root.lookup=dialog.lookup=nodes;
 dialog.children=[...nodes.values()].filter(node=>node!==dialog&&node.id.startsWith('drug-'));
 dialog.fieldsetInputs=['addiction','joy','scheduled','frequency','mood','recreation','inventory'].map(id=>el(`drug-${id}`));
 vi.stubGlobal('document',{createElement:(tag:string)=>new PolicyNodeFixture(tag)});
 return {root,dialog,el};
}
afterEach(()=>vi.unstubAllGlobals());

function fixture(){
 const world=createWorld(441,32,32);world.pawns=[];world.jobs=[];world.piles=[];world.packed=[];world.resources=[];
 const brewery:Structure={id:world.nextId++,kind:'brewery',x:12,z:12,orientation:0,footprint:'standard',material:'wood',bills:[]};
 const barrel:Structure={id:world.nextId++,kind:'fermenting-barrel',x:15,z:12,orientation:0,footprint:'standard',material:'wood',fermentation:{wort:15,progress:.2,ruin:0}};
 world.structures=[brewery,barrel];return {world,brewery,barrel};
}

test('original closed models share construction previews through all four rotations',()=>{
 const {world,brewery,barrel}=fixture();
 for(const orientation of [0,1,2,3] as const){
  brewery.orientation=barrel.orientation=orientation;
  const before=JSON.stringify(world),parts=brewingParts265(world);
  expect(parts.length).toBeGreaterThan(40);expect(parts.every(p=>!p.shape)).toBe(true);
  for(const s of [brewery,barrel]){
   const model=parts.filter(p=>p.targetId===s.id),preview=constructionPreviewParts(world,[{kind:s.kind,x:s.x,z:s.z,orientation,material:'wood'}]);
   expect(preview.boxes.map(({key,targetId,...part})=>part)).toEqual(model.map(({key,targetId,...part})=>part));
   const limitX=s.kind==='brewery'&&(orientation===0||orientation===2)?1.5:.5,limitZ=s.kind==='brewery'&&(orientation===1||orientation===3)?1.5:.5;
   for(const p of model){const angle=p.ry??0,hx=Math.abs(Math.cos(angle))*p.sx!/2+Math.abs(Math.sin(angle))*p.sz!/2,hz=Math.abs(Math.sin(angle))*p.sx!/2+Math.abs(Math.cos(angle))*p.sz!/2;expect(Math.abs(p.x-s.x)+hx).toBeLessThanOrEqual(limitX+.001);expect(Math.abs(p.z-s.z)+hz).toBeLessThanOrEqual(limitZ+.001);}
  }
  expect(JSON.stringify(world)).toBe(before);
 }
});

test('barrel indicator changes only with confirmed quantity, bounded phase or ruin',()=>{
 const {barrel}=fixture(),initial=fermentationStatusParts265(barrel),key=fermentationStatusKey265(barrel);
 expect(fermentationStatusParts265(barrel)).toEqual(initial);
 barrel.fermentation!.progress=.249;expect(fermentationStatusKey265(barrel)).toBe(key);
 barrel.fermentation!.progress=1;expect(fermentationStatusKey265(barrel)).not.toBe(key);expect(fermentationStatusParts265(barrel)[0]!.color).not.toBe(initial[0]!.color);
 barrel.fermentation={wort:0,progress:0,ruin:1};expect(fermentationStatusParts265(barrel)).toHaveLength(1);
 barrel.fermentation={wort:0,progress:0,ruin:0};expect(fermentationStatusParts265(barrel)).toEqual([]);
});

test('research, crops, fixed materials and unique storage leaves expose the whole chain',()=>{
 const {world}=fixture(),node=researchProjects.find(p=>p.id==='brewing')!;
 expect(node.cost).toBe(400);expect(node.detail).toContain('25 houblons');expect(node.detail).toContain('Transport');
 expect(architectToolAvailable(world,'brewery')).toBe(false);
 world.research={points:0,project:null,brewing:{points:BREWING_RESEARCH_COST,completedAt:1}};
 for(const tool of ['brewery','fermenting-barrel'] as const){expect(architectToolAvailable(world,tool)).toBe(true);expect(placementMaterial(tool,'steel')).toBe('wood');expect(ARCHITECT_ICON_URLS[tool]).toBe(modelIconUrl(tool));}
 expect(growingCultureChoices({})).toContain('hops');expect(growingCultureChoices({basinId:100})).toContain('hops');expect(growingCultureHelp('hops')).toContain('Culture 3');
 for(const item of ['hops','wort','beer'] as const){expect(STORAGE_LEAVES.filter(id=>id===item)).toHaveLength(1);expect(itemGeometry(item,1).length).toBeGreaterThan(2);expect(modelIconUrl(`item-${item}`)).toContain('/pictograms-20261107/');}
 Object.assign(world,{schemaVersion:264});expect(architectToolAvailable(world,'brewery')).toBe(false);
});

test('inspection reads actual barrel contents without inventing transfer controls',()=>{
 const {world,brewery,barrel}=fixture(),before=JSON.stringify(world);
 expect(brewingInspection265(world,brewery)).toContain('25 houblons → 5 moûts');
 expect(brewingInspection265(world,barrel)).toContain('15 / 25 moûts');expect(JSON.stringify(world)).toBe(before);
 barrel.fermentation!.progress=1;expect(brewingInspection265(world,barrel)).toContain('15 bières prêtes');
 barrel.fermentation={wort:0,progress:0,ruin:1};expect(brewingInspection265(world,barrel)).toContain('Contenu perdu');
});

test('shared policy editor preserves saved names as text and publishes all beer settings',async()=>{
 const {world}=fixture();world.drugPolicies=initialDrugPolicies265();world.drugPolicies[0]!.name='<img src=x onerror=alert(1)>';
 const {root,dialog,el}=policyDom();root.hidden=false;
 const commands:DrugPolicyCommand265[]=[],controls=createDrugPolicyControls265(root as unknown as HTMLElement,async command=>{commands.push(command);return null;});controls.update(world);
 el('manage-drug-policies').onclick!();expect(dialog.querySelector('img')).toBeNull();expect(dialog.querySelector('option')!.textContent).toContain('<img');
 const field=(id:string)=>el(`drug-${id}`);
 field('frequency').value='2';field('mood').value='70';field('recreation').value='65';field('inventory').value='2';field('scheduled').checked=true;
 el('drug-policy-form').onsubmit!({preventDefault(){}});await Promise.resolve();
 expect(commands[0]).toMatchObject({type:'drug-policy-update',beer:{daysFrequency:2,onlyIfMoodBelow:.7,onlyIfJoyBelow:.65,takeToInventory:2,allowScheduled:true}});
 expect(field('frequency').max).toBe('25');expect(field('inventory').max).toBe('3');
});
