import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {readRwsSave,readThing} from '../src/import/rimworld/rws-save.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {convertRwsSave} from '../src/import/rimworld/convert.ts';
import {medicalCamp} from './scenarios/health.ts';
import {fixturePower} from './scenarios/power.ts';
import {shortCircuitColony} from './helpers/short-circuit-v266.ts';
import {constructionRecipe,validConstructionMaterial} from '../src/sim/construction-materials.ts';
import {structureMaxHp,structureFlammability} from '../src/sim/thing-damage-rules.ts';
import {damageStructure} from '../src/sim/thing-damage.ts';
import {structureBeauty} from '../src/sim/room-beauty.ts';
import {captureWorldProjectileTargets} from '../src/sim/projectile-world.ts';
import {isPowerTransmitter,sharesConstructionLayer} from '../src/sim/power-grid.ts';
import {PowerTopologyCache} from '../src/sim/power-topology.ts';
import {isElectrical,newPowerState} from '../src/sim/power-rules.ts';
import {eligibleShortCircuit} from '../src/sim/short-circuit.ts';
import {electricalParts} from '../src/render/electrical-parts.ts';
import {constructionPreviewParts} from '../src/render/construction-preview-parts.ts';
import {HiddenConduitOverlay382,hiddenConduitMarks382} from '../src/render/HiddenConduitOverlay382.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {SnapshotDecoder,SnapshotEncoder} from '../src/bridge/snapshots.ts';
import {canDesignate,applyCommand,stepWorld} from '../src/sim/engine.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import type {Structure,World} from '../src/sim/types.ts';

const wire=(w:World,kind:Structure['kind'],x:number,z:number):Structure=>{
 const s:Structure={id:w.nextId++,kind,x,z,orientation:0,footprint:'standard',material:'steel',power:newPowerState(kind)};w.structures.push(s);return s;
};

it('retains the native hidden definition, health, zero beauty and invisible non-edifice behavior',()=>{
 const w=medicalCamp(),s=wire(w,'hidden-conduit',10,10);
 expect(constructionRecipe(s)).toEqual({ingredients:[{item:'steel',quantity:2}],work:28,coreWork:280});
 expect(validConstructionMaterial(s.kind,'steel',381)).toBe(false);expect(validConstructionMaterial(s.kind,'steel',382)).toBe(true);
 expect(structureMaxHp(s)).toBe(100);expect(structureFlammability(s)).toBe(0);expect(structureBeauty(s)).toBe(0);
 expect(isPowerTransmitter(s.kind)&&isElectrical(s.kind)).toBe(true);
 expect(sharesConstructionLayer(s.kind,'wall',382)).toBe(false);expect(sharesConstructionLayer(s.kind,'power-conduit',382)).toBe(true);
 expect(sharesConstructionLayer(s.kind,s.kind,382)).toBe(true);
 const before=serializeWorld(w);for(const cause of ['fire','melee','bullet','bomb','roof'] as const)expect(damageStructure(w,s,120,cause)).toBe(true);
 expect(serializeWorld(w)).toBe(before);expect(captureWorldProjectileTargets(w).anchor(`structure:${s.id}`)).toBeUndefined();
 expect(electricalParts(w).filter(p=>p.targetId===s.id)).toEqual([]);
 expect(electricalParts(w,false,[s],true)).not.toHaveLength(0);
 expect(constructionPreviewParts(w,[{kind:s.kind,x:12,z:12,material:'steel'}]).boxes).not.toHaveLength(0);
 expect(validateWorld(w)).toEqual([]);expect(serializeWorld(deserializeWorld(before))).toBe(before);
 const snapshot=new SnapshotDecoder().adopt(structuredClone(new SnapshotEncoder().encode(w,0,1)));expect(snapshot.status).toBe('applied');
 // Core RoofCollapserImmediate additionally kills all destroyable survivors
 // before spawning the collapsed rock, despite their ordinary immunity.
 expect(damageStructure(w,s,99999,'roof-thick')).toBe(true);expect(w.structures).not.toContain(s);expect(w.piles).toHaveLength(0);
});

it('transmits energy without becoming a short-circuit ticket (normal neighboring wire still eligible)',()=>{
 const w=shortCircuitColony(false),g=fixturePower(w,'wood-generator',8,10),hidden=wire(w,'hidden-conduit',10,10);
 expect(new PowerTopologyCache().read(w).groups).toEqual([[g.id,hidden.id]]);expect(eligibleShortCircuit(w)).toBe(false);
 const visible=wire(w,'power-conduit',11,10);expect(new PowerTopologyCache().read(w).groups).toEqual([[g.id,hidden.id,visible.id]]);expect(eligibleShortCircuit(w)).toBe(true);
});

it('only reveals known hidden conduits in one optional electrical overlay, which hides and reopens without changing owners',()=>{
 const w=medicalCamp(),s=wire(w,'hidden-conduit',10,10);wire(w,'power-conduit',11,10);
 const layer=new HiddenConduitOverlay382();
 try{
  const before=serializeWorld(w);expect(hiddenConduitMarks382(w)).toHaveLength(2);
  layer.update(w);expect(layer.mesh.visible).toBe(true);expect(layer.mesh.activeCount).toBe(2);
  layer.hide();expect(layer.mesh.visible).toBe(false);layer.update(w);expect(layer.mesh.visible).toBe(true);
  expect(serializeWorld(w)).toBe(before);
  // Fog is only authoritative on actual geographic maps.
  w.site={revision:3} as NonNullable<World['site']>;w.exploration={revision:1};
  w.tiles[s.z*w.width+s.x]!.fogged=true;layer.update(w);expect(layer.mesh.activeCount).toBe(0);expect(layer.mesh.visible).toBe(false);
 }finally{layer.dispose();}
});

it('constructs a distinct hidden wire using real delivery and construction',()=>{
 const w=medicalCamp(),p=w.pawns[0]!;p.priorities.build=1;p.priorities.haul=1;
 addGroundMaterial(w,'steel',20,{x:p.x+1,z:p.z},'steel');refreshStock(w);
 const cmd={type:'designate' as const,kind:'hidden-conduit' as const,x:p.x+2,z:p.z,material:'steel' as const};
 expect(canDesignate(w,cmd).ok).toBe(true);expect(applyCommand(w,cmd).ok).toBe(true);
 for(let i=0;i<500&&!w.structures.some(s=>s.kind==='hidden-conduit');i++)stepWorld(w);
 const s=w.structures.find(s=>s.kind==='hidden-conduit');expect(s).toBeDefined();expect(s?.power).toEqual({on:false,parentId:null});
 expect(validateWorld(w)).toEqual([]);
});

it('imports a hidden conduit under a wall without substituting a normal wire or losing hit points',()=>{
 const source=readRwsSave(readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8'));
 source.maps[0]!.things.push(readThing(parseXml('<thing Class="Building"><def>HiddenConduit</def><id>Hidden101</id><map>0</map><pos>(2,0,2)</pos><health>73</health></thing>')));
 const imported=convertRwsSave(source,{planet:false}),w=imported.world,s=w.structures.find(s=>s.id===imported.thingIds.get('Hidden101'));
 expect(s).toMatchObject({kind:'hidden-conduit',damage:27,material:'steel'});
 expect(w.structures.some(b=>b.kind==='wall'&&b.x===s?.x&&b.z===s?.z)).toBe(true);
 expect(validateWorld(w)).toEqual([]);expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});
