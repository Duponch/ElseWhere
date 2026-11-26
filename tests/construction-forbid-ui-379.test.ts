import {expect,test} from 'vitest';
import {applyCommand} from '../src/sim/engine';
import {mapObjectActions,mapObjectGroupActions,mapSelectionShortcut} from '../src/ui/map-object-actions';
import {designationIconInstances} from '../src/render/DesignationIconLayer';
import {createClosedMainMapIntentReader} from '../src/render/closed-main-map-intents';
import type {Command,World} from '../src/sim/types';
import {medicalCamp} from './scenarios/health';

function fixture(){const world=medicalCamp(),at=[{x:8,z:8},{x:9,z:8}];for(const cell of at)expect(applyCommand(world,{type:'designate',kind:'wall',material:'wood',...cell}).ok).toBe(true);return {world,jobs:world.jobs.slice(),selected:world.jobs.map(j=>({kind:'job' as const,id:j.id}))};}
function apply(world:World,commands:readonly Command[]){for(const command of commands)expect(applyCommand(world,command)).toMatchObject({ok:true});}

test('a selected ghost has both cancel and the native forbid gizmo; F changes the actual permission, not its identity, and repaints the cross at the same tick',()=>{
 const {world,jobs,selected}=fixture(),job=jobs[0]!,selection=selected[0]!,tick=world.tick;
 const reader=createClosedMainMapIntentReader(),before=reader.read(world);
 expect(mapObjectActions(world,selection).map(a=>a.id)).toEqual(['material-permission','cancel']);
 const forbid=mapSelectionShortcut(world,[selection],'f')!;
 expect(forbid.label).toBe('Interdire');expect(forbid.commands).toEqual([{type:'construction-forbid-379',jobId:job.id,forbidden:true}]);
 apply(world,forbid.commands);expect(world.tick).toBe(tick);expect(world.jobs.find(j=>j.id===job.id)).toBe(job);expect(job.forbidden379).toBe(true);
 expect(reader.read(world)).not.toBe(before);expect(designationIconInstances(world)).toContainEqual({x:job.x,y:1.08,z:job.z,icon:83});
 const allow=mapSelectionShortcut(world,[selection],'f')!;expect(allow.label).toBe('Autoriser');apply(world,allow.commands);
 expect(world.jobs.find(j=>j.id===job.id)).toBe(job);expect(job.forbidden379).toBeUndefined();expect(reader.read(world)).toBe(before);
 expect(designationIconInstances(world).some(icon=>icon.icon===83)).toBe(false);
});

test('grouped construction permission follows the existing mixed-gizmo rule, while the area forbid tool does not designate ghost buildings',()=>{
 const {world,jobs,selected}=fixture();apply(world,[{type:'construction-forbid-379',jobId:jobs[0]!.id,forbidden:true}]);
 const mixed=mapObjectGroupActions(world,selected).find(a=>a.id==='material-permission')!;
 expect(mixed.commands).toEqual([{type:'construction-forbid-379',jobId:jobs[1]!.id,forbidden:true}]);apply(world,mixed.commands);
 apply(world,mapSelectionShortcut(world,selected,'f')!.commands);expect(jobs.every(j=>!j.forbidden379)).toBe(true);
 applyCommand(world,{type:'area',action:'forbid',from:{x:8,z:8},to:{x:9,z:8}});expect(jobs.every(j=>!j.forbidden379)).toBe(true);
 const historic={...world,schemaVersion:378 as typeof world.schemaVersion};expect(mapSelectionShortcut(historic,selected,'f')).toBeUndefined();
});
