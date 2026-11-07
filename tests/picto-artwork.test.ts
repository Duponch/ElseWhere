import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {ITEM_DEFINITIONS} from '../src/sim/items';
import {toolDefinitions} from '../src/ui3d/native-catalog';
import {PICTOGRAM_IDS,modelIconUrl} from '../src/ui/pictograms';
import {researchProjects} from '../src/ui/research-projects';
import {pictoArtwork,pictoSvg} from '../src/ui/picto-artwork';

describe('Adult hand pictogram catalogue',()=>{
 it('has authored artwork for every delivered object, tool and UI pictogram',()=>{
  const missing=[...toolDefinitions.map(x=>x.id),...researchProjects.map(x=>x.id),...Object.keys(ITEM_DEFINITIONS).map(x=>'item-'+x),...PICTOGRAM_IDS].filter(id=>!pictoArtwork(id));
  expect(missing).toEqual([]);
 });
 it('keeps useful variants distinguishable in monochrome',()=>{
  const ink=(id:string)=>pictoArtwork(id)!.strokes.map(s=>s.points);
  for(const pair of [['bed','double-bed'],['door','autodoor'],['heater','cooler'],['table','table-long'],['table','table-square'],['shelf','small-shelf'],['wind-turbine','wood-generator'],['faune','animaux'],['recherches','drug-lab'],['ground-scanner','orbital-beacon'],['item-steel-longsword','item-steel-spear'],['item-plasteel-knife','item-steel-longsword'],['item-survival-meal','item-simple-meal'],['item-nutrient-paste-meal','item-simple-meal']])expect(ink(pair[0]!)).not.toEqual(ink(pair[1]!));
 });
 it('uses each weapon material pigment instead of painting wooden blades as metal',()=>{
  for(const family of ['longsword','spear','mace'])for(const material of ['wood','steel','gold']){
   const id=`${material}-${family}`,definition=ITEM_DEFINITIONS[id as keyof typeof ITEM_DEFINITIONS];
   const pigment='#'+definition.color.toString(16).padStart(6,'0');
   expect(pictoArtwork('item-'+id)!.strokes.some(s=>s.fill===pigment),id).toBe(true);
  }
 });
 it('delivers every item and tool URL as a standalone authored SVG',()=>{
  for(const id of [...toolDefinitions.map(x=>x.id),...Object.keys(ITEM_DEFINITIONS).map(x=>'item-'+x)]){
   const svg=readFileSync(new URL('../public'+modelIconUrl(id),import.meta.url),'utf8');
   expect(svg,id).toContain(`data-pictogram="${id}"`);expect(svg,id).toContain('data-art="adult-hand-20261107"');expect(svg,id).toContain('<path');
  }
 });
 it('exports transparent deterministic vector ink with finite, bounded coordinates',()=>{
  for(const id of ['mine','architecte','bed','remove-growing','item-rice']){
   expect(pictoSvg(id)).toBe(pictoSvg(id));expect(pictoSvg(id)).toContain('data-art="adult-hand-20261107"');
   for(const s of pictoArtwork(id)!.strokes)for(const [x,y]of s.points){expect(Number.isFinite(x+y)).toBe(true);expect(x).toBeGreaterThanOrEqual(0);expect(x).toBeLessThanOrEqual(64);expect(y).toBeGreaterThanOrEqual(0);expect(y).toBeLessThanOrEqual(64);}
  }
  for(const id of ['__proto__','constructor','future-unknown'])expect(pictoArtwork(id)).toBeUndefined();
 });
});
