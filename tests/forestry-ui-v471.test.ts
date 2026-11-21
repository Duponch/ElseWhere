import {afterEach,expect,test,vi} from 'vitest';
import {growingControls,growingCultureChoices,growingCultureHelp} from '../src/ui/growing-controls.ts';
import {CROP_KINDS} from '../src/sim/crops.ts';
import {TREE_SOWING_COST_291} from '../src/sim/forestry-content-291.ts';
import type {Command,GrowingZone,World} from '../src/sim/types.ts';
import {researchProjects} from '../src/ui/research-projects.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';

/** Small authored DOM port, not a browser/layout substitute. Commands remain
 * observations here; the native route separately proves real pointer input. */
class ForestryNode {
  children:(ForestryNode|string)[]=[];id='';className='';value='';checked=false;type='';
  private text='';private listeners=new Map<string,(()=>void)[]>();
  constructor(readonly tag:string){}
  set textContent(value:string){this.text=value;this.children=[];}
  get textContent():string{return this.text+this.children.map(c=>typeof c==='string'?c:c.textContent).join('');}
  set innerHTML(_value:string){throw Error('Forest controls must retain literal labels.');}
  append(...children:(ForestryNode|string)[]){this.children.push(...children);}
  addEventListener(name:string,listener:()=>void){const rows=this.listeners.get(name)??[];rows.push(listener);this.listeners.set(name,rows);}
  emit(name:string){for(const listener of this.listeners.get(name)??[])listener();}
  nodes():ForestryNode[]{return this.children.flatMap(c=>typeof c==='string'?[]:[c,...c.nodes()]);}
  field(id:string){return this.nodes().find(n=>n.id===id)!;}
}
afterEach(()=>vi.unstubAllGlobals());
function fixture(biome='temperate-forest',researched=true){
  const world=deconstructionCamp(1,32);world.schemaVersion=291 as World['schemaVersion'];
  world.site={revision:2,biome:biome as import('../src/sim/biome-flora').BiomeId,hilliness:'flat',river:'none',stones:['granite','limestone']};
  world.research={points:0,project:null,...(researched?{treeSowing291:{points:TREE_SOWING_COST_291,completedAt:world.tick}}:{})};
  const zone:GrowingZone={id:world.nextId++,cells:[12*world.width+12],plant:'rice',allowSow:true,allowCut:true};world.growingZones=[zone];
  return {world,zone};
}
function render(world:World,zone:GrowingZone){
  vi.stubGlobal('document',{createElement:(tag:string)=>new ForestryNode(tag)});
  const sent:Command[]=[],before=JSON.stringify(world);
  const root=growingControls(zone,command=>sent.push(command),world) as unknown as ForestryNode;
  expect(JSON.stringify(world)).toBe(before);expect(sent).toEqual([]);
  return {root,sent,select:root.field('growing-plant')};
}

// Schema 358: devilstrand is listed only once its research is complete.
const GROUND_CROPS=CROP_KINDS.filter(kind=>kind!=='devilstrand');
test('forest choices follow potential biome flora even when no tree is physically present',()=>{
  const cases=[['temperate-forest',['oak','poplar']],['boreal-forest',['poplar','pine','birch']],['tropical-rainforest',['bamboo','cecropia','palm','teak']],['desert',['saguaro','drago']],['ice-sheet',[]]] as const;
  for(const [biome,trees] of cases){const {world,zone}=fixture(biome);expect(world.resources).toEqual([]);const before=JSON.stringify(world);
    expect(growingCultureChoices(zone,world),biome).toEqual([...GROUND_CROPS,...trees]);expect(JSON.stringify(world)).toBe(before);
  }
});

test('unresearched, historical, unknown-biome and context-free controls retain the existing crops',()=>{
  const {world,zone}=fixture('temperate-forest',false);
  expect(growingCultureChoices(zone,world)).toEqual(GROUND_CROPS);
  world.research!.treeSowing291={points:TREE_SOWING_COST_291};expect(growingCultureChoices(zone,world)).toEqual(GROUND_CROPS);
  world.research!.treeSowing291.completedAt=world.tick;world.schemaVersion=290 as World['schemaVersion'];expect(growingCultureChoices(zone,world)).toEqual(GROUND_CROPS);
  world.schemaVersion=291 as World['schemaVersion'];delete world.site;expect(growingCultureChoices(zone,world)).toEqual(GROUND_CROPS);
  expect(growingCultureChoices(zone)).toEqual(GROUND_CROPS);
});

test('hydroponic choices never offer trees, including after research in a forest biome',()=>{
  const {world,zone}=fixture();zone.basinId=99;
  expect(growingCultureChoices(zone,world)).toEqual(['rice','potato','cotton','healroot','hops']);
  expect(growingCultureChoices(zone)).toEqual(['rice','potato','cotton','healroot','hops']);
  const {root}=render(world,zone);expect(root.textContent).toContain('70 W');expect(root.textContent).not.toContain('Essences indigènes disponibles');
});

test('an absent capable planter does not hide researched choices or fabricate completed sowing',()=>{
  const {world,zone}=fixture();world.pawns=[];
  const {root,select}=render(world,zone);
  expect(select.children.filter((n):n is ForestryNode=>n instanceof ForestryNode).map(n=>n.value)).toEqual([...GROUND_CROPS,'oak','poplar']);
  expect(root.textContent).toContain('compétence du cultivateur');expect(world.resources).toEqual([]);expect(world.jobs).toEqual([]);
});

test('changing an essence sends only the actual shared policy and keeps the world unchanged until publication',()=>{
  const {world,zone}=fixture(),before=JSON.stringify(world),{root,select,sent}=render(world,zone);
  select.value='poplar';select.emit('change');
  expect(sent).toEqual([{type:'growing-policy',zoneId:zone.id,plant:'poplar',allowSow:true,allowCut:true}]);
  expect(JSON.stringify(world)).toBe(before);expect(zone.plant).toBe('rice');expect(world.resources).toEqual([]);
  expect(root.textContent).toContain('Culture 6');expect(root.textContent).toContain('400 ticks');
  root.field('growing-allowSow').checked=false;root.field('growing-allowSow').emit('change');
  expect(sent[1]).toEqual({type:'growing-policy',zoneId:zone.id,plant:'poplar',allowSow:false,allowCut:true});
  root.field('growing-allowCut').checked=false;root.field('growing-allowCut').emit('change');
  expect(sent[2]).toEqual({type:'growing-policy',zoneId:zone.id,plant:'poplar',allowSow:false,allowCut:false});expect(JSON.stringify(world)).toBe(before);
});

test('locked and treeless contexts explain the actual reason without granting a research or a tree',()=>{
  const locked=fixture('temperate-forest',false),before=JSON.stringify(locked.world),a=render(locked.world,locked.zone);
  expect(a.root.textContent).toContain('1 000 points');expect(a.root.textContent).toContain('Culture 6');expect(JSON.stringify(locked.world)).toBe(before);
  const none=fixture('ice-sheet'),b=render(none.world,none.zone);expect(b.root.textContent).toContain('Aucune essence');
});

test('forest help distinguishes real work, weighted growth, native spacing and automatic mature cutting',()=>{
  const {world}=fixture(),before=JSON.stringify(world),help=growingCultureHelp('poplar',world);
  for(const text of ['Culture 6','recherche','indigène','sans toit','hors hydroponie','400 ticks','croissance pondérée','huit cases','propre zone','coupe automatique','finition'])expect(help).toContain(text);
  expect(growingCultureHelp('saguaro',world)).toContain('15 bois');expect(growingCultureHelp('oak',world)).toContain('46 bois');
  expect(growingCultureHelp('hops')).toContain('Culture 3');expect(growingCultureHelp('healroot')).toContain('Plantes 8');expect(JSON.stringify(world)).toBe(before);
});

test('research explanation exposes the real gate and never promises hydroponic or instantaneous trees',()=>{
  const project=researchProjects.find(p=>p.id==='tree-sowing')!;
  expect(project.cost).toBe(1000);expect(project.detail).toContain('indigènes');expect(project.detail).toContain('Culture 6');expect(project.detail).toContain('Aucun arbre en hydroponie');
});
