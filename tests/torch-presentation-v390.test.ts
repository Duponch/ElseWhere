import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {torchLampParts} from '../src/render/torch-lamp-parts';
import {FireLayer} from '../src/render/FireLayer';
import {StructureVfxLayer} from '../src/render/StructureVfxLayer';
import {SceneStructurePreparation} from '../src/render/SceneStructurePreparation';
import {vfxAppearance} from './helpers/structure-appearance-v299';
import {constructionPreviewParts} from '../src/render/construction-preview-parts';
import {updateFireControls} from '../src/ui/fire-controls';
import {architectToolAvailable} from '../src/ui/architect-availability';
import {placementMaterial} from '../src/ui/construction-controls';
import {toolDefinitions} from '../src/ui/layout';
import {ARCHITECT_ICON_URLS,ARCHITECT_ICON_MAPPING} from '../src/ui/architect-icons';
import {newBuildingFuel} from '../src/sim/fuel';
import {deconstructionCamp} from './scenarios/deconstruction';
import type {Structure} from '../src/sim/types';

function prepared(){const w=deconstructionCamp(0),torch:Structure={id:w.nextId++,kind:'torch-lamp',x:8,z:8,orientation:0,footprint:'standard',material:'wood',fuel:newBuildingFuel('torch-lamp')};w.structures=[torch];return {w,torch};}
test('V390 static wooden torch remains bounded and identical when empty, using the existing furniture model port',()=>{
  const {w,torch}=prepared(),before=JSON.stringify(w),parts=torchLampParts(w);expect(parts).toHaveLength(8);
  for(const p of parts){expect(p.targetId).toBe(torch.id);expect([p.x,p.y,p.z,p.sx,p.sy,p.sz].every(Number.isFinite)).toBe(true);expect(p.y-p.sy!/2).toBeGreaterThanOrEqual(0);expect(p.y+p.sy!/2).toBeLessThan(1);}
  const ghost=constructionPreviewParts({...w,structures:[]},[{kind:'torch-lamp',x:8,z:8,orientation:0,material:'wood',key:77}]);
  expect(ghost.boxes).toEqual(parts.map(p=>({...p,targetId:-1,key:77})));expect(JSON.stringify(w)).toBe(before);
  torch.fuel!.ticks=0;expect(torchLampParts(w)).toEqual(parts);
});
test('V390 a fuel transition adds/removes one torch flame without replacing resident attributes',()=>{
  const {w,torch}=prepared(),layer=new FireLayer();torch.fuel!.ticks=0;layer.adopt(w,true);
  const g=layer.mesh.geometry,a=g.getAttribute('firePosition'),position=g.getAttribute('position'),normal=g.getAttribute('normal'),indices=g.index;
  expect(a.getW(0)).toBe(0);torch.fuel!.ticks=1;torch.fuel!.burnRemainder=4;layer.adopt(w);
  expect(g.getAttribute('firePosition')).toBe(a);expect(a.getW(0)).toBeCloseTo(.23);expect(a.getY(0)).toBeCloseTo(.89);
  torch.fuel!.ticks=0;torch.fuel!.burnRemainder=0;layer.adopt(w);expect(a.getW(0)).toBe(0);
  expect(layer.mesh.geometry).toBe(g);expect(g.getAttribute('position')).toBe(position);expect(g.getAttribute('normal')).toBe(normal);expect(g.index).toBe(indices);layer.dispose();
});
test('V390 fuel inspection distinguishes refill from a switch and does not mutate fuel or its remainder',()=>{
  const {torch}=prepared(),label={textContent:''},root={querySelector:()=>label};const before=JSON.stringify(torch);
  updateFireControls(root as unknown as ParentNode,torch);expect(label.textContent).toContain('Allumée');expect(label.textContent).toContain('20.0 / 20 bois');
  expect(label.textContent).toContain('2 bois/jour au sec');expect(label.textContent).toContain('aucun interrupteur');expect(JSON.stringify(torch)).toBe(before);
  torch.fuel!.ticks=0;updateFireControls(root as unknown as ParentNode,torch);expect(label.textContent).toContain('Éteinte');
});
test('V390 the prepared effect subject list preserves RAW/native torch plume transitions',()=>{
  const {w,torch}=prepared(),capture=new SceneStructurePreparation(),raw=new StructureVfxLayer(),native=new StructureVfxLayer();
  try{for(const ticks of [1,0,6000]){
    torch.fuel!.ticks=ticks;const data=capture.read(w);
    expect(data.effects.map(s=>s.id)).toContain(torch.id);
    raw.adopt(w);native.adoptNative(w,false,data.axes,data.effects);
    expect(vfxAppearance(native)).toStrictEqual(vfxAppearance(raw));
  }}finally{raw.dispose();native.dispose();}
});
test('V390 architect admission and the original SVG stay separate from electrical lamps and historical atlas cells',()=>{
  const {w}=prepared(),old=structuredClone(w);Object.assign(old,{schemaVersion:248});
  expect(architectToolAvailable(old,'torch-lamp')).toBe(false);expect(architectToolAvailable(w,'torch-lamp')).toBe(true);
  expect(placementMaterial('torch-lamp','steel')).toBe('wood');expect(toolDefinitions.find(t=>t.id==='torch-lamp')).toMatchObject({category:'furniture',title:'Lampe-torche'});
  expect(ARCHITECT_ICON_MAPPING['torch-lamp']).toEqual(ARCHITECT_ICON_MAPPING['standing-lamp']);
  const url=ARCHITECT_ICON_URLS['torch-lamp']!;expect(url).toBe('/assets/ui/elsewhere/pictograms-20261107/torch-lamp.svg');expect(url).not.toBe(ARCHITECT_ICON_URLS['standing-lamp']);
  const svg=readFileSync(new URL(`../public${url}`,import.meta.url),'utf8');expect(svg).toContain('<title>Lampe-torche</title>');expect(svg).toContain('<path');expect(svg).not.toMatch(/<image|(?:href|src)=/);
});
