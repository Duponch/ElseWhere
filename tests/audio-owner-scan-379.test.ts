import {expect,test} from 'vitest';
import {AudioCueRecorder} from '../src/bridge/audio-cues.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {createWorld} from '../src/sim/index.ts';
import {appendStructureEntries} from '../src/sim/structure-navigation.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import type {Job,Structure,World} from '../src/sim/types.ts';
import {ResidentCollectionJournal379} from '../src/bridge/resident-collection-journal-379.ts';
import type {ResourceStructureCandidate} from '../src/bridge/snapshots.ts';
import {ResidentContinuousStructures379,MACHINE_LOOP_STRUCTURES} from '../src/audio/continuous.ts';

test('closed door membership preserves the exhaustive audio stream and source-order queue cap across appends, completion and replacement',()=>{
 const initial=createWorld(379126,32,32);
 initial.structures=[];
 const structure=(world:World,i:number,kind:Structure['kind']):Structure=>({id:world.nextId++,kind,x:i%30+1,z:Math.floor(i/30)+1,orientation:0,footprint:'standard',...(kind==='door'||kind==='fence-gate'||kind==='autodoor'?{door:newDoorState(world.tick)}:{})});
 for(let i=0;i<80;i++)initial.structures.push(structure(initial,i,i%2?'wall':i%6===0?'door':i%6===2?'fence-gate':'autodoor'));
 const job:Job={id:initial.nextId++,kind:'wall',x:22,z:22,orientation:0,footprint:'standard',status:'active',reservedBy:initial.pawns[0]!.id,progress:1,escrow:{wood:0,food:0}};
 initial.jobs=[job];
 const strict=structuredClone(initial),resident=structuredClone(initial),a=new AudioCueRecorder(),b=new AudioCueRecorder(),owner={};
 const compare=()=>{a.capture(strict);withJournalTerrainReadScope(owner,()=>b.capture(resident));const expected=a.drain();expect(b.drain()).toEqual(expected);return expected;};
 const edit=(run:(world:World)=>void)=>{run(strict);withJournalTerrainReadScope(owner,()=>run(resident));};
 expect(compare()).toEqual([]);
 // Completion and lots of doors share the same global cap and ordering.
 edit(world=>{world.tick++;world.jobs=[];appendStructureEntries(world,{...structure(world,0,'wall'),x:22,z:22});for(const s of world.structures)if(s.door)s.door.open=true;});
 expect(compare()).toHaveLength(32);
 edit(world=>{world.tick++;for(const s of world.structures)if(s.door)s.door.open=false;});
 expect(compare()).toHaveLength(32);
 // An append preserves the earlier directory while adding the new door in
 // canonical order. Fresh loaded/open state itself makes no cue.
 edit(world=>{world.tick++;appendStructureEntries(world,structure(world,99,'door'));});
 expect(compare()).toEqual([]);
 edit(world=>{world.tick++;world.structures.at(-1)!.door!.open=true;});
 expect(compare().some(cue=>cue.kind==='door.open')).toBe(true);
 edit(world=>{world.tick++;world.structures=world.structures.filter(s=>s.kind!=='wall').reverse();for(const s of world.structures)if(s.door)s.door.open=!s.door.open;});
 expect(compare()).toHaveLength(32);
});

test('audio structure census uses resident membership and live rows, with exact order and full fallback',()=>{
 const w=createWorld(379127,32,32);w.structures=[];
 for(let i=0;i<48;i++)w.structures.push({id:w.nextId++,kind:i%9===0?'wind-turbine':i%7===0?'campfire':'wall',x:i%24+2,z:2+Math.floor(i/24),orientation:0,footprint:'standard'});
 const journal=new ResidentCollectionJournal379('structures'),census=new ResidentContinuousStructures379(),slots=(world:World)=>new Map(world.structures.map((s,i)=>[s.id,i]));
 const matching=(world:World)=>world.structures.filter(s=>s.kind==='campfire'||MACHINE_LOOP_STRUCTURES.has(s.kind));
 let prev=w,revision=1;journal.reset(w,1,revision,slots(w));expect(census.read(w)).toEqual(matching(w));expect(census.read(w)).toBe(census.read(w));
 function step(world:World,edge:ResourceStructureCandidate|undefined){journal.append(prev,world,1,++revision,slots(world),edge);prev=world;expect(census.read(world)).toEqual(matching(world));}
 const removed=w.structures[0]!,updated:Structure={...w.structures[7]!,fuel:{ticks:12,burned:0,autoRefuel:true}},added:Structure={id:w.nextId++,kind:'wood-generator',x:30,z:30,orientation:0,footprint:'standard'};
 const structures=w.structures.filter(s=>s.id!==removed.id).map(s=>s.id===updated.id?updated:s).concat(added),next={...w,structures};
 step(next,{beforeCount:w.structures.length,afterCount:structures.length,removed:[{id:removed.id,beforeOrdinal:0}],added:[{id:added.id,afterOrdinal:structures.length-1}],updated:[{id:updated.id,afterOrdinal:structures.findIndex(s=>s.id===updated.id)}]});
 step({...next,structures:structures.slice().reverse()},undefined);
 const publicWorld=structuredClone(next);expect(census.read(publicWorld)).toBe(publicWorld.structures);
});
