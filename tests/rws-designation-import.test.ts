import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {readRwsSave,readThing} from '../src/import/rimworld/rws-save.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {importRwsDesignations} from '../src/import/rimworld/import-designations.ts';
import {importActiveJobs} from '../src/import/rimworld/import-active-jobs.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {RwsLocalCoordinates} from '../src/import/rimworld/local-coordinates.ts';
import type {ImportContext} from '../src/import/rimworld/convert.ts';
import {medicalCamp,controlledInjury} from './scenarios/health.ts';
import {fixtureBuilding} from './scenarios/deconstruction.ts';
import {fixturePower} from './scenarios/power.ts';
import {serializeWorld,deserializeWorld,validateWorld,stepWorld} from '../src/sim/index';
import {addMaterial} from '../src/sim/materials.ts';
import {reconcilePower} from '../src/sim/power.ts';
import type {Cell,Resource,Structure} from '../src/sim/types.ts';

function context(count=1):ImportContext {
 const save=readRwsSave(readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8')),w=medicalCamp(count);
 const map={...save.maps[0]!,node:parseXml('<li/>'),width:w.width,height:w.height,things:[]};
 return {save,map,w,notes:new ImportNotes(),geographic:false,thingIds:new Map(),coordinates:new RwsLocalCoordinates(w.width,w.height),blocked:new Set(),pendingChunks:[],index:c=>c.z*w.width+c.x,inside:c=>c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height} as ImportContext;
}
const raw=(ctx:ImportContext,c:Cell)=>`(${c.x},0,${ctx.w.height-1-c.z})`;
const target=(def:string,t:string)=>`<li><def>${def}</def><target>${t}</target></li>`;
const designs=(ctx:ImportContext,...entries:string[])=>ctx.map.node.children.push(parseXml(`<designationManager><allDesignations>${entries.join('')}</allDesignations></designationManager>`));
const source=(ctx:ImportContext,def:string,id:string,targetId:number)=>{ctx.thingIds.set(id,targetId);ctx.map.things.push(readThing(parseXml(`<thing><def>${def}</def><id>${id}</id></thing>`)));};
const check=(ctx:ImportContext)=>{expect(validateWorld(ctx.w)).toEqual([]);expect(validateWorld(deserializeWorld(serializeWorld(ctx.w)))).toEqual([]);};

it('imports actual local cells and exact object owners as native pending jobs, not completed changes',()=>{
 const ctx=context(),w=ctx.w;
 const mine={x:18,z:18},smoothWall={x:19,z:18},smoothFloor={x:20,z:18},removeFloor={x:21,z:18},foundation={x:22,z:18};
 w.tiles[ctx.index(mine)]={terrain:'rock',stone:'granite'};w.tiles[ctx.index(smoothWall)]={terrain:'rock',stone:'granite'};
 w.tiles[ctx.index(smoothFloor)]={terrain:'rough-stone',stone:'granite'};w.tiles[ctx.index(removeFloor)]={terrain:'grass',floor:'wood-planks'};w.tiles[ctx.index(foundation)]={terrain:'water-shallow',bridge:true};
 const rice:Resource={id:w.nextId++,x:19,z:20,kind:'rice',amount:6,growth:1,growthTick:w.tick};
 const tree:Resource={id:w.nextId++,x:20,z:20,kind:'tree',amount:46};
 const extract:Resource={id:w.nextId++,x:21,z:20,kind:'tree',amount:46};
 w.resources=[rice,tree,extract];source(ctx,'Plant_Rice','Rice1',rice.id);source(ctx,'Plant_TreeOak','Oak1',tree.id);source(ctx,'Plant_TreeOak','Oak2',extract.id);
 const wall:Structure=fixtureBuilding(w,'wall',18,22),stool:Structure=fixtureBuilding(w,'stool',20,22);wall.material='wood';stool.material='wood';source(ctx,'Wall','Wall1',wall.id);source(ctx,'Stool','Stool1',stool.id);
 designs(ctx,target('Mine',raw(ctx,mine)),target('SmoothWall',raw(ctx,smoothWall)),target('SmoothFloor',raw(ctx,smoothFloor)),target('RemoveFloor',raw(ctx,removeFloor)),target('RemoveFoundation',raw(ctx,foundation)),target('HarvestPlant','Thing_Rice1'),target('CutPlant','Thing_Oak1'),target('ExtractTree','Thing_Oak2'),target('Deconstruct','Thing_Wall1'),target('Uninstall','Thing_Stool1'));
 importRwsDesignations(ctx);expect(w.jobs.map(j=>j.kind)).toEqual(['mine','smooth-wall','smooth-floor','remove-floor','remove-bridge','harvest','cut','extract-tree','deconstruct','uninstall']);
 expect(w.jobs.find(j=>j.kind==='mine')).toMatchObject({...mine,status:'pending',reservedBy:null});
 expect(w.jobs.find(j=>j.kind==='harvest')?.plantTarget).toEqual({resourceId:rice.id});expect(w.jobs.find(j=>j.kind==='cut')?.plantTarget).toEqual({resourceId:tree.id});
 expect(w.jobs.find(j=>j.kind==='extract-tree')?.tree).toMatchObject({kind:'extract',resourceId:extract.id});
 expect(w.jobs.find(j=>j.kind==='deconstruct')?.deconstruction?.structureId).toBe(wall.id);expect(w.jobs.find(j=>j.kind==='uninstall')?.furniture?.structureId).toBe(stool.id);
 expect(w.tiles[ctx.index(mine)]!.terrain).toBe('rock');expect(w.tiles[ctx.index(foundation)]!.bridge).toBe(true);expect(w.structures).toContain(wall);expect(w.structures).toContain(stool);check(ctx);
});

it('restores a real switch intention only when Flick exists and rebinds a corpse to its human identity',()=>{
 const ctx=context(2),w=ctx.w,p=w.pawns[1]!;
 const lamp=fixturePower(w,'standing-lamp',20,20),other=fixturePower(w,'standing-lamp',22,20);reconcilePower(w);
 ctx.thingIds.set('Lamp1',lamp.id);ctx.map.things.push(readThing(parseXml('<thing><def>StandingLamp</def><id>Lamp1</id><wantSwitchOn>False</wantSwitchOn></thing>')));
 ctx.thingIds.set('Lamp2',other.id);ctx.map.things.push(readThing(parseXml('<thing><def>StandingLamp</def><id>Lamp2</id><wantSwitchOn>False</wantSwitchOn></thing>')));
 addMaterial(w,'apparel',1,{type:'apparel',pawnId:p.id},'cloth-shirt');controlledInjury(w,p,'heart',15000);stepWorld(w);const body=w.piles.find(pile=>pile.humanCorpse?.pawnId===p.id)!;
 source(ctx,'Corpse_Human','Body1',body.id);designs(ctx,target('Flick','Thing_Lamp1'),target('Strip','Thing_Body1'),target('MineVein',raw(ctx,{x:24,z:20})),target('CutPlant','Thing_missing'),target('PaintBuilding','Thing_Lamp2'));
 importRwsDesignations(ctx);
 expect(w.jobs.filter(j=>j.kind==='flick')).toHaveLength(1);expect(w.jobs.find(j=>j.kind==='flick')?.flick).toMatchObject({structureId:lamp.id,on:false});expect(lamp.power?.switchOn).not.toBe(false);expect(other.power?.switchOn).not.toBe(false);
 expect(w.strip351).toMatchObject([{targetId:p.id,dead:true}]);expect(ctx.notes.before.get('designations')).toBe(5);expect(ctx.notes.after.get('designations')).toBe(2);check(ctx);
});

it('preserves distinct adjacent plan owners, hidden state, labels and reflected cells',()=>{
 const ctx=context(),w=ctx.w;
 const plan=(id:number,label:string,color:string,cells:Cell[],hidden=false)=>`<li><ID>${id}</ID><label>${label}</label><baseLabel>Plan</baseLabel><color>${color}</color>${hidden?'<hidden>True</hidden>':''}<cells>${cells.map(c=>`<li>${raw(ctx,c)}</li>`).join('')}</cells></li>`;
 const a=[{x:13,z:13},{x:14,z:13}],b=[{x:15,z:13}],c=[{x:19,z:21},{x:19,z:22}];
 ctx.map.node.children.push(parseXml(`<planManager><allPlans>${plan(2,'Plan 2','PlanBlue',b)}${plan(1,'Plan 1','PlanBlue',a,true)}${plan(3,'Jardin','PlanRed',c)}${plan(4,'Plan 4','PlanYellow',[{x:13,z:13}])}${plan(5,'Plan 5','PlanPink',[{x:25,z:20},{x:25,z:22}])}</allPlans></planManager>`));
 importRwsDesignations(ctx);
 expect(w.plans369?.plans).toEqual([{id:1,n:1,color:'blue',hidden:true,cells:a.map(ctx.index.bind(ctx))},{id:2,n:2,color:'blue',cells:b.map(ctx.index.bind(ctx))},{id:3,n:3,color:'red',cells:c.map(ctx.index.bind(ctx))}]);
 // Nearby same-colour plans must not merge by replaying drawing commands.
 expect(w.plans369?.nextId).toBe(4);expect(ctx.notes.before.get('designations')).toBe(5);expect(ctx.notes.after.get('designations')).toBe(3);check(ctx);
});

it('resumes active harvest on its imported exact designation, without duplicating that job',()=>{
 const ctx=context(),w=ctx.w,p=w.pawns[0]!,targetCell={x:17,z:16};p.x=17;p.z=17;p.priorities.gather=1;
 const rice:Resource={id:w.nextId++,kind:'rice',...targetCell,amount:6,growth:1,growthTick:w.tick};w.resources=[rice];source(ctx,'Plant_Rice','Rice1',rice.id);
 designs(ctx,target('HarvestPlant','Thing_Rice1'));importRwsDesignations(ctx);const id=w.jobs[0]!.id,nextId=w.nextId;
 ctx.thingIds.set('Human1',p.id);ctx.map.things.push(readThing(parseXml(`<thing Class="Pawn"><def>Human</def><id>Human1</id><jobs><curJob><def>Harvest</def><targetA>Thing_Rice1</targetA></curJob><curDriver><curToilIndex>5</curToilIndex><workDone>30.42</workDone></curDriver></jobs></thing>`)));
 importActiveJobs(ctx);expect(w.jobs).toHaveLength(1);expect(w.jobs[0]).toMatchObject({id,kind:'harvest',status:'active',reservedBy:p.id,progress:3,workRemainder:420});expect(p.jobId).toBe(id);expect(w.nextId).toBe(nextId);check(ctx);
});
