import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {Structure,World} from '../src/sim/types';
import {TICKS_PER_DAY} from '../src/sim/types';
import {newShelfStorage} from '../src/sim/shelf-storage';
import {lightSources} from '../src/sim/light-sources';
import {caveLightSources256} from '../src/sim/cave-flora-256';
import {roofCoverage} from '../src/sim/roof-rules';
import {SceneApplicationContext} from '../src/render/SceneApplicationContext';
import {SceneResourceIndex,readSceneResourceFrame} from '../src/render/scene-resource-index';
import {RoofLayer,roofSurfaceCells} from '../src/render/RoofLayer';
import {EnvironmentLightField} from '../src/render/EnvironmentLightField';
import {pileSurfaces,pileIdentitySurfaces} from '../src/render/pile-surfaces';
import {harness} from './resident-presentation-fixtures-v427';

function fixture(){
 const w=createWorld(434,32,32);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.jobs=[];
 const structure=(kind:Structure['kind'],x:number,z:number):Structure=>({id:w.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'wood'});
 w.structures=[structure('wall',8,8),structure('small-shelf',12,12),
  {...structure('standing-lamp',10,10),power:{on:true,parentId:null}},
  {...structure('machining-table',10,10),power:{on:true,parentId:null}},
  {...structure('torch-lamp',9,10),fuel:{ticks:100,burned:0,autoRefuel:true}}];
 w.structures[1]!.shelf=newShelfStorage([w.nextId++],w.schemaVersion);
 w.roofing={constructed:[8*w.width+9],build:[],remove:[],cursor:0,natural:{thin:[4*w.width+4],thick:[5*w.width+4]}};
 w.piles=[{id:w.nextId++,kind:'wood',item:'wood',quantity:10,owner:{type:'ground',x:12,z:12}},
  {id:w.nextId++,kind:'wood',item:'wood',quantity:20,owner:{type:'ground',x:12,z:12}}];
 return harness(w);
}
function prepare(context:SceneApplicationContext,index:SceneResourceIndex,world:World,reset=false){
 const frame=index.adopt(world,reset),view=context.prepare(world,reset,null,frame);expect(view).toBeDefined();if(!view)throw Error('Admitted fixture must prepare');return view;
}

test('shared confirmed geometry and same-tick changes match literal roof/support/source inputs and public light bytes',()=>{
 const h=fixture(),context=new SceneApplicationContext(),index=new SceneResourceIndex();
 const roof=new RoofLayer(undefined,w=>context.read(w)?.roofs),field=new EnvironmentLightField(context.topology,w=>context.read(w)?.lighting),literalField=new EnvironmentLightField();
 try{
  const a=h.send(),view=prepare(context,index,a),oldSources=structuredClone(view.lighting.sources),oldSupports=context.readSupports(a)!;
  expect(view.roofs.cells).toEqual([{x:4,z:4},{x:4,z:5},{x:8,z:8},{x:9,z:8}]);expect(view.roofs.cells).toStrictEqual(roofSurfaceCells(a));expect(view.roofs.coverage).toStrictEqual(roofCoverage(a));
  expect(view.lighting.sources).toEqual([{cell:329,radius:10,red:184,green:136,blue:83},{cell:330,radius:12,red:214,green:148,blue:94},{cell:330,radius:5,red:73,green:123,blue:138}]);
  expect(context.readSupports(a)!.cells).toStrictEqual(pileSurfaces(a));expect(context.readSupports(a)!.identities).toStrictEqual(pileIdentitySurfaces(a));
  expect([...oldSupports.identities.values()].map(v=>({y:v.y,scale:v.scale,level:v.level}))).toEqual([{y:.14,scale:.55,level:0},{y:.64,scale:.55,level:1}]);
  roof.updatePhysical(a);expect(roof.mesh.geometry.getAttribute('position').getY(0)).toBeCloseTo(2.88,5);roof.updatePhysical(a,true);expect(roof.mesh.geometry.getAttribute('position').getY(0)).toBeCloseTo(.8,5);
  field.update(a);literalField.update(a);expect(field.data).toEqual(literalField.data);expect(field.bounds).toEqual(literalField.bounds);context.commit(a);
  const builds=context.metrics();h.world.structures[2]!.power!.on=false;h.world.structures[4]!.fuel!.ticks=0;h.world.roofing!.cursor++;h.world.roofing!.build=[22];
  const b=h.send(),next=prepare(context,index,b);expect(b.tick).toBe(a.tick);expect(next.lighting.sources).toEqual([{cell:330,radius:5,red:73,green:123,blue:138}]);expect(next.lighting.sources).toStrictEqual(lightSources(b));expect(context.metrics().supportBuilds).toBe(builds.supportBuilds);expect(context.metrics().roofBuilds).toBe(builds.roofBuilds);
  field.update(b);literalField.update(b);expect(field.data).toEqual(literalField.data);expect(field.bounds).toEqual(literalField.bounds);context.commit(b);
  h.world.structures[0]!.x=7;h.world.structures[1]!.orientation=1;const c=h.send(),moved=prepare(context,index,c);expect(moved.roofs.cells).toEqual([{x:4,z:4},{x:4,z:5},{x:9,z:8}]);expect(moved.roofs.cells).toStrictEqual(roofSurfaceCells(c));expect(context.readSupports(c)!.identities).toStrictEqual(pileIdentitySurfaces(c));
  expect(context.readSupports(a)).toBe(oldSupports);expect(view.lighting.sources).toStrictEqual(oldSources);context.commit(c);
  h.world.structures.push({id:h.world.nextId++,kind:'sun-lamp',x:15,z:15,orientation:0,footprint:'standard',power:{on:true,parentId:null}});
  for(const tick of [TICKS_PER_DAY*.25,TICKS_PER_DAY*.25+1,TICKS_PER_DAY*.8]){h.world.tick=Math.round(tick);const w=h.send();expect(prepare(context,index,w).lighting.sources).toStrictEqual(lightSources(w));context.commit(w);}
 }finally{roof.dispose();context.clear();index.clear();}
});

test('existing resource membership retains growth-only cave sources and preserves equal-cell source order through edits',()=>{
 const h=fixture(),context=new SceneApplicationContext(),index=new SceneResourceIndex();h.world.structures=[];h.world.resources=[
  {id:h.world.nextId++,kind:'wild-plant',species:'glowstool',x:10,z:10,amount:1,growth:.3,growthTick:h.world.tick},
  {id:h.world.nextId++,kind:'wild-plant',species:'agarilux',x:10,z:10,amount:1,growth:.3,growthTick:h.world.tick}];
 try{
  const a=h.send(),frame=index.adopt(a),first=readSceneResourceFrame(frame,a)!.caveLightSources,view=context.prepare(a,false,null,frame)!;context.commit(a);const old=structuredClone(first);
  expect(view.lighting.sources).toEqual([{cell:330,radius:5.9,red:10,green:50,blue:64},{cell:330,radius:10,red:23,green:15,blue:30}]);
  h.world.resources[0]!.growth=.8;const b=h.send(),growthFrame=index.adopt(b);expect(readSceneResourceFrame(growthFrame,b)!.caveLightSources).toBe(first);expect(context.prepare(b,false,null,growthFrame)!.lighting.sources).toStrictEqual(caveLightSources256(b));context.commit(b);
  h.world.resources.reverse();const c=h.send(),reordered=prepare(context,index,c);expect(reordered.lighting.sources).toEqual([old[1],old[0]]);expect(reordered.lighting.sources).toStrictEqual(caveLightSources256(c));context.commit(c);
  h.world.resources[0]!.x=11;h.world.resources.push({id:h.world.nextId++,kind:'wild-plant',species:'bryolux',x:9,z:10,amount:1});const d=h.send(),changed=prepare(context,index,d);expect(changed.lighting.sources.map(s=>s.cell)).toEqual([329,330,331]);expect(changed.lighting.sources).toStrictEqual(caveLightSources256(d));context.commit(d);
  h.world.resources=[];const e=h.send();expect(prepare(context,index,e).lighting.sources).toEqual([]);context.commit(e);expect(first).toStrictEqual(old);expect(view.lighting.sources).toStrictEqual(old);
 }finally{context.clear();index.clear();}
});

test('public mutable Worlds cannot prepare, while old admitted endpoints and values remain exact across same-tick geometry changes',()=>{
 const h=fixture(),context=new SceneApplicationContext(),index=new SceneResourceIndex();
 try{
  const a=h.send(),before=structuredClone(a);prepare(context,index,a);context.commit(a);const support=context.readSupports(a)!,literal=structuredClone(support);
  h.world.structures[1]!.orientation=1;h.world.piles.shift();const b=h.send();prepare(context,index,b);context.commit(b);expect(context.readSupports(a)).toBe(support);expect(support).toStrictEqual(literal);expect(context.readSupports(b)!.identities).toStrictEqual(pileIdentitySurfaces(b));
  const raw=structuredClone(b);expect(context.prepare(raw)).toBeUndefined();expect(context.read(raw)).toBeUndefined();expect(context.piles.read(raw,new Map())).toBeUndefined();const initial=pileIdentitySurfaces(raw);raw.structures[1]!.orientation=2;expect(context.prepare(raw)).toBeUndefined();expect(pileIdentitySurfaces(raw)).not.toStrictEqual(initial);expect(a).toStrictEqual(before);expect(support).toStrictEqual(literal);
  const replacement=h.send(true);prepare(context,index,replacement,true);expect(context.readSupports(replacement)!.identities).toStrictEqual(pileIdentitySurfaces(replacement));context.commit(replacement);
 }finally{context.clear();index.clear();}
});

test('a failed later consumer leaves pending pile chunks for exact retry and same-World cargo masks ACK outside apply',()=>{
 const h=fixture(),context=new SceneApplicationContext(),index=new SceneResourceIndex();
 try{
  const a=h.send();prepare(context,index,a);const initial=context.piles.read(a,new Map())!;context.acknowledgePiles(initial);context.commit(a);const oldSupports=context.readSupports(a);
  h.world.piles[0]!.quantity++;const b=h.send();prepare(context,index,b);const first=context.piles.read(b,new Map())!,held=structuredClone(first.changedChunks);expect(first.changedChunks.length).toBeGreaterThan(0);context.acknowledgePiles(first);context.abort();expect(context.read(b)).toBeUndefined();expect(context.readSupports(a)).toBe(oldSupports);
  prepare(context,index,b);const retry=context.piles.read(b,new Map())!;expect(retry.changedChunks).toStrictEqual(held);context.acknowledgePiles(retry);expect(()=>context.commit(a)).toThrow('Scene context commit');context.commit(b);expect(context.piles.read(b,new Map())!.changedChunks).toEqual([]);
  const masked=context.piles.read(b,new Map([[b.piles[0]!.id,3]]))!;expect(masked.changedChunks[0]!.bundles.map(v=>v.quantity)).toEqual([8,20]);context.acknowledgePiles(masked);expect(context.piles.read(b,new Map([[b.piles[0]!.id,3]]))!.changedChunks).toEqual([]);expect(first.changedChunks).toStrictEqual(held);
 }finally{context.clear();index.clear();}
});

test('only physical support membership changes rebuild shared support cells, and off-shelf writes retain shelf identities',()=>{
 const h=fixture(),context=new SceneApplicationContext(),index=new SceneResourceIndex();
 const adopt=()=>{const w=h.send();prepare(context,index,w);const support=context.readSupports(w)!;expect(support.cells).toStrictEqual(pileSurfaces(w));expect(support.identities).toStrictEqual(pileIdentitySurfaces(w));context.commit(w);return support;};
 try{
  const a=adopt();h.world.structures[0]!.x-=2;h.world.structures.push({id:h.world.nextId++,kind:'bed',x:18,z:18,orientation:0,footprint:'standard',material:'wood'});
  h.world.piles[0]!.quantity+=1;h.world.piles.push({id:h.world.nextId++,kind:'wood',item:'wood',quantity:5,owner:{type:'ground',x:17,z:17}});
  const b=adopt();expect(b.cells).toBe(a.cells);expect(b.identities).toBe(a.identities);
  h.world.piles.at(-1)!.owner={type:'ground',x:12,z:12};const c=adopt();expect(c.cells).toBe(a.cells);expect(c.identities).not.toBe(a.identities);expect(c.identities.size).toBe(3);expect(a.identities.size).toBe(2);
  h.world.structures[3]!.orientation=1;h.world.structures[3]!.x=14;const d=adopt();expect(d.cells).not.toBe(a.cells);expect(d.identities).toBe(c.identities);
 }finally{context.clear();index.clear();}
});
