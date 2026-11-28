import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import type {World} from '../src/sim/types.ts';
import {validateMechanoids} from '../src/sim/mechanoid-save.ts';
import {mechanicalDuty256,sleepingTempleMech256} from '../src/sim/temple-mech-duty-256.ts';
import {ImportContext} from '../src/import/rimworld/convert.ts';
import {readRwsSave,readThing} from '../src/import/rimworld/rws-save.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {coreMechanoidPart,importRwsMechanoids} from '../src/import/rimworld/convert-mechanoids.ts';

const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
const context=()=>{
 const save=readRwsSave(fixture),w=createWorld(17,20,20);
 w.pawns=[];w.structures=[];w.worldMaps={nextLordId:9} as World['worldMaps'];
 return new ImportContext(save,save.maps[0]!,w,new ImportNotes(),true);
};
const mech=(def:string,id:string,extra='',pos='(10, 0, 10)')=>readThing(parseXml(`<thing Class="Pawn"><def>${def}</def><id>${id}</id><pos>${pos}</pos>${extra}</thing>`));

describe('RWS original mechanical actors',()=>{
 it('uses Core preorder, including the non-interleaved sensor indexes',()=>{
  expect(coreMechanoidPart('lancer','Lancer',5)).toBe('lancer-right-sight-sensor');
  expect(coreMechanoidPart('lancer','Lancer',6)).toBe('lancer-left-hearing-sensor');
  expect(coreMechanoidPart('scyther','Scyther',11)).toBe('scyther-left-blade');
  expect(coreMechanoidPart('pikeman','Pikeman',16)).toBe('pikeman-right-rear-foot');
  expect(coreMechanoidPart('lancer','Scyther',5)).toBeUndefined();
 });
 it('replaces generated substitutes with the original actors and their real sleeping assault group',()=>{
  const ctx=context(),w=ctx.w,lancer=mech('Mech_Lancer','Lancer1','<wokeUpTick>0</wokeUpTick><wakeUpSignalTag>CompCanBeDormant.WakeUp</wakeUpSignalTag><mindState><duty><def>AssaultColony</def></duty></mindState>');
  ctx.map.things.push(lancer,mech('Mech_CentipedeBurner','Burner1','','(13, 0, 10)'));
  ctx.map.node.children.push(parseXml('<lordManager><lords><li><ownedPawns><li>Thing_Lancer1</li><li>Thing_Burner1</li></ownedPawns><lordJob Class="LordJob_AssaultColony"/><curLordToilIdx>0</curLordToilIdx><ticksInToil>12305756</ticksInToil></li></lords></lordManager>'));
  w.mechanoids=[{id:w.nextId++,mechKind:'scyther',x:15,z:15,path:[],heading:0,state:'idle',moveCooldown:0,planCooldown:0}];
  w.tiles[9*20+10]={terrain:'soil-natural',fogged:true};
  importRwsMechanoids(ctx);
  expect(w.mechanoids).toHaveLength(1);const a=w.mechanoids![0]!;
  expect(a).toMatchObject({mechKind:'lancer',x:10,z:9,heading:Math.PI,state:'idle',temple:{group:9,madeAtCore:0,awakeAtCore:null,goal:null}});
  expect(ctx.thingIds.get('Lancer1')).toBe(a.id);expect(ctx.thingIds.get('Burner1')).toBeUndefined();
  expect(w.worldMaps?.nextLordId).toBe(10);expect(sleepingTempleMech256(a)).toBe(true);
  expect(validateMechanoids(w)).toEqual([]);
  expect([...ctx.notes.tallies.get('colonists')!.values()].find(x=>x.def==='Mech_CentipedeBurner')?.status).toBe('dropped');
 });
 it('retains a localized injury and removes only the outermost missing limb; no raid invented for an unrelated lord',()=>{
  const ctx=context(),w=ctx.w;
  ctx.map.things.push(mech('Mech_Lancer','Lancer2',`<rot>1</rot><healthTracker><healthState>Mobile</healthState><hediffSet><hediffs>
   <li Class="Hediff_Injury"><def>Gunshot</def><part><body>Lancer</body><index>5</index></part><severity>2.5</severity></li>
   <li Class="Hediff_MissingPart"><def>MissingBodyPart</def><part><body>Lancer</body><index>17</index></part></li>
   <li Class="Hediff_MissingPart"><def>MissingBodyPart</def><part><body>Lancer</body><index>18</index></part></li>
  </hediffs></hediffSet></healthTracker>`));
  w.tiles[9*20+10]={terrain:'soil-natural'};
  importRwsMechanoids(ctx);const a=w.mechanoids![0]!;
  expect(a.heading).toBe(Math.PI/2);expect(a.temple).toBeUndefined();expect(mechanicalDuty256(w,a)).toBeUndefined();
  expect(a.health?.injuries).toMatchObject([{part:'lancer-right-sight-sensor',kind:'gunshot',severity:2500}]);
  expect(a.health?.missing).toMatchObject([{part:'lancer-right-arm'}]);expect(validateMechanoids(w)).toEqual([]);
 });
});
