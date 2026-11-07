import {preparedSchema256} from './helpers/legacy-fixture-guards.ts';
import {afterEach,expect,test,vi} from 'vitest';
import {ancientMonumentCells256,ANCIENT_MONUMENT_KINDS_256} from '../src/sim/ancient-monument-props-256';
import {ancientMonumentParts256,ancientMonumentPartsForStructure256} from '../src/render/ancient-monument-parts-256';
import {ancientMonumentDescription256} from '../src/ui/ancient-monument-inspection-256';
import {buildingLabels} from '../src/ui/building-labels';
import {modelIconUrl} from '../src/ui/pictograms';
import {updateBurialControls} from '../src/ui/burial-controls';
import {createWorld} from '../src/sim/engine';
import type {Command,Structure} from '../src/sim/types';
const prop=(kind:typeof ANCIENT_MONUMENT_KINDS_256[number],orientation:Structure['orientation']=0):Structure=>({id:42,kind,x:10,z:10,orientation,footprint:'standard',material:'marble-blocks'});
test('five actual silhouettes stay inside their real GenAdj occupied cells, including all sarcophagus rotations',()=>{
 const signatures=new Set<string>();
 for(const kind of ANCIENT_MONUMENT_KINDS_256)for(const orientation of kind==='sarcophagus'?([0,1,2,3] as const):([0] as const)){
  const s=prop(kind,orientation),before=structuredClone(s),parts=ancientMonumentPartsForStructure256(s),cells=ancientMonumentCells256(kind,s,orientation);
  expect(s).toEqual(before);expect(parts.length).toBeGreaterThan(3);
  const minX=Math.min(...cells.map(c=>c.x))-.5,maxX=Math.max(...cells.map(c=>c.x))+.5,minZ=Math.min(...cells.map(c=>c.z))-.5,maxZ=Math.max(...cells.map(c=>c.z))+.5;
  for(const b of parts){
   expect(b.targetId).toBe(s.id);expect(b.key).toBe(s.id);expect(b.color).toBeTypeOf('number');
   expect(b.y-(b.sy??1)/2).toBeGreaterThanOrEqual(0);
   const a=b.ry??0,c=Math.cos(a),n=Math.sin(a);
   for(const dx of [-1,1])for(const dz of [-1,1]){
    const x=b.x+dx*(b.sx??1)/2*c+dz*(b.sz??1)/2*n,z=b.z+dz*(b.sz??1)/2*c-dx*(b.sx??1)/2*n;
    expect(x).toBeGreaterThanOrEqual(minX-1e-9);expect(x).toBeLessThanOrEqual(maxX+1e-9);
    expect(z).toBeGreaterThanOrEqual(minZ-1e-9);expect(z).toBeLessThanOrEqual(maxZ+1e-9);
   }
  }
  if(orientation===0)signatures.add(JSON.stringify(parts.map(p=>[p.sx,p.sy,p.sz,p.y])));
 }
 expect(signatures.size).toBe(5);
});
test('ordinary furniture remains separate, batching retains actual IDs and Stuff changes only pigment',()=>{
 const a=prop('urn'),b={...a,id:91,x:12,material:'steel' as const};
 const before=structuredClone([a,b]),parts=ancientMonumentParts256({structures:[a,b]});
 expect([a,b]).toEqual(before);expect(new Set(parts.map(p=>p.targetId))).toEqual(new Set([42,91]));
 const wood=ancientMonumentPartsForStructure256({...a,material:'steel'}),stone=ancientMonumentPartsForStructure256(a);
 expect(wood.map(({color,...p})=>p)).toEqual(stone.map(({color,...p})=>p));expect(wood.map(p=>p.color)).not.toEqual(stone.map(p=>p.color));
 expect(ancientMonumentPartsForStructure256({...a,kind:'grave'})).toEqual([]);
});
test('real names/icons and factual inspection expose support/minification without fabricated art or contents',()=>{
 for(const kind of ANCIENT_MONUMENT_KINDS_256){
  expect(buildingLabels[kind]).toBeTruthy();expect(modelIconUrl(kind)).toBe(`/assets/ui/elsewhere/pictograms-20261107/${kind}.svg`);
  expect(ancientMonumentDescription256(prop(kind))).not.toMatch(/auteur|récit|occupé|qualité/i);
 }
 expect(ancientMonumentDescription256(prop('column'))).toContain('Soutient le toit');
 expect(ancientMonumentDescription256(prop('stele-grand'))).toContain('Support lourd');
 expect(ancientMonumentDescription256(prop('urn'))).toContain('Désinstallable');
 expect(ancientMonumentDescription256({...prop('urn'),kind:'grave'})).toBeUndefined();
});
/** Minimal DOM boundary fixture, no native layout/input or gameplay claimed. */
class ElementFixture {
 children:ElementFixture[]=[];dataset:Record<string,string>={};id='';className='';type='';value='';hidden=false;disabled=false;checked=false;
 onchange:(()=>void)|null=null;onclick:(()=>void)|null=null;private text='';
 set textContent(v:string){this.text=v;this.children=[];}get textContent():string{return this.text+this.children.map(c=>c.textContent).join(' ');}
 set innerHTML(_v:string){throw Error('No saved string HTML');}
 append(...nodes:(ElementFixture|string)[]){for(const n of nodes){if(typeof n==='string'){const t=new ElementFixture();t.textContent=n;this.children.push(t);}else this.children.push(n);}}
 replaceChildren(){this.children=[];this.text='';}
 querySelectorAll(selector:string):ElementFixture[]{const all=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);if(selector==='*')return all;const data=/^\[data-([a-z-]+)(?:="([^"]*)")?\]$/.exec(selector);return all.filter(n=>selector.startsWith('#')?n.id===selector.slice(1):!!data&&Object.hasOwn(n.dataset,data[1]!.replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase()))&&(data[2]===undefined||n.dataset[data[1]!.replace(/-([a-z])/g,(_,c:string)=>c.toUpperCase())]===data[2]));}
 querySelector(selector:string){return this.querySelectorAll(selector)[0]??null;}
}
afterEach(()=>vi.unstubAllGlobals());
test('confirmed sarcophagus opens existing assignment/policy controls and sends its real ID, old255 refuses its kind',()=>{
 vi.stubGlobal('document',{activeElement:null,createElement:()=>new ElementFixture()});
 // Declared empty UI fixture only. No generated ruin, corpse or burial is claimed.
 const w=createWorld(77,32,32);preparedSchema256(w);const s={...prop('sarcophagus'),grave:{colonists:true,strangers:false}};w.structures=[s];
 const host=new ElementFixture(),sent:Command[]=[];updateBurialControls(host as unknown as HTMLElement,w,s,c=>sent.push(c));
 expect(host.textContent).toContain('Sarcophage vide');expect(host.textContent).toContain('Attribuer le sarcophage');expect(sent).toEqual([]);
 const choice=host.querySelector('#grave-assignment')!;choice.value=String(w.pawns[0]!.id);choice.onchange!();
 expect(sent[0]).toEqual({type:'assign-grave',graveId:s.id,pawnId:w.pawns[0]!.id});
 const filters=host.querySelectorAll('[data-grave-filter]');filters[1]!.checked=true;filters[1]!.onchange!();
 expect(sent[1]).toEqual({type:'grave-policy',graveId:s.id,colonists:true,strangers:true});
 Object.assign(w,{schemaVersion:255});updateBurialControls(host as unknown as HTMLElement,w,s,c=>sent.push(c));expect(host.querySelector('#burial-controls')!.hidden).toBe(true);expect(sent).toHaveLength(2);
});
