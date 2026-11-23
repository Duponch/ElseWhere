import { expect,test } from 'vitest';
import { createWorld } from '../src/sim/engine.ts';
import type { Structure } from '../src/sim/types.ts';
import { StructureVfxLayer } from '../src/render/StructureVfxLayer.ts';
import { WindLayer } from '../src/render/WindLayer.ts';
import { mapHoverLines } from '../src/ui/map-hover-readout.ts';
import { powerInspection } from '../src/ui/power-inspection.ts';

function structure(kind:Structure['kind'],id:number,x=8,z=8):Structure {
  return {id,kind,x,z,orientation:0,footprint:'standard',power:{on:true,parentId:null}};
}

test('a breakdown reads as a mechanical fault and switches off resident work effects',()=>{
  const world=createWorld(14401,24,24),generator=structure('wood-generator',900);
  generator.fuel={ticks:100,burned:0,autoRefuel:true};
  world.structures=[generator];world.resources=[];
  const layer=new StructureVfxLayer();
  layer.adopt(world,true);
  expect(layer.glow.activeCount).toBe(1);
  expect(layer.smoke.geometry.instanceCount).toBe(10); // Current structural generator profile, distinct from ground-fire puffs.
  const smokeGeometry=layer.smoke.geometry,smokeMaterial=layer.smoke.material;
  generator.breakdown={brokenAt:world.tick}; // Even a stale on bit may not illuminate a failed appliance.
  layer.adopt(world);
  expect(layer.glow.activeCount).toBe(2);
  expect(layer.smoke.geometry.instanceCount).toBe(0);
  expect(layer.smoke.geometry).toBe(smokeGeometry);expect(layer.smoke.material).toBe(smokeMaterial);
  expect(layer.group.children).toHaveLength(2); // Shared status and smoke draws only.
  expect(powerInspection(world,generator)).toContain('Panne mécanique');
  expect(powerInspection(world,generator)).toContain('1 composant ordinaire');
  expect(powerInspection(world,generator,true)).toBe(' · Panne mécanique.');
  // Core MouseoverReadout lists the building by its label; the breakdown is
  // told by the inspector (interactions note).
  expect(mapHoverLines(world,generator)).toContain('Générateur à bois');
  const version=layer.glow.instanceMatrix.version;
  layer.present(world.tick+.5);layer.adopt(world);
  expect(layer.glow.instanceMatrix.version).toBe(version);
  delete generator.breakdown;generator.power!.on=false;layer.adopt(world);
  expect(layer.glow.activeCount).toBe(0);
  expect(layer.smoke.geometry.instanceCount).toBe(0);
  generator.power!.on=true;layer.adopt(world);
  expect(layer.glow.activeCount).toBe(1);expect(layer.smoke.geometry.instanceCount).toBe(10);
  expect(layer.smoke.geometry).toBe(smokeGeometry);expect(layer.smoke.material).toBe(smokeMaterial);
  layer.dispose();
});

test('a broken wind turbine stops its retained blades despite an old powered bit',()=>{
  const world=createWorld(14402,24,24),turbine=structure('wind-turbine',901);
  turbine.wind={cachedWatts:1200,autoCut:false,updateCounter:0};
  world.structures=[turbine];
  const layer=new WindLayer();layer.adopt(world,true);
  const speed=layer.mesh.geometry.getAttribute('windCurrent');
  expect(speed.getZ(0)).toBeGreaterThan(0);
  turbine.breakdown={brokenAt:world.tick};layer.adopt(world);
  expect(speed.getZ(0)).toBe(0);
  layer.dispose();
});

test('all eleven breakdownable buildings share one resident status draw',()=>{
  const world=createWorld(14403,80,20);
  const kinds:Structure['kind'][]=['wood-generator','wind-turbine','battery','solar-generator','electric-tailor-bench','machining-table','electric-stove','fabrication-bench','autodoor','heater','cooler'];
  world.structures=kinds.map((kind,i)=>({...structure(kind,1000+i,7+i*6),breakdown:{brokenAt:world.tick}}));
  const layer=new StructureVfxLayer();layer.adopt(world,true);
  expect(layer.glow.activeCount).toBe(kinds.length*2);
  expect(layer.group.children).toHaveLength(2);
  layer.dispose();
});
