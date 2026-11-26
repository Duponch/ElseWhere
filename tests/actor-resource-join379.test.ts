import {afterEach,expect,test} from 'vitest';
import {captureResourceJournal,closedResourceIdentityLookup,markResourceChanged,markResourceArrayChanged,invalidateResourceJournal,setResourceJournalVerification,RESOURCE_JOURNAL_CAPACITY} from '../src/sim/resource-mutation-journal';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {captureActorPhaseDependencies297,captureActorPhaseDependenciesWithResourceJoin297} from '../src/bridge/actor-phase-dependencies-297';
import {enableWildlife} from '../src/sim/wildlife';
import {fixture} from './resident-presentation-fixtures-v427';
import type {Resource} from '../src/sim/types';

afterEach(()=>setResourceJournalVerification(false));
test('closed identity join advances at actual membership writes and survives unrelated field-ring overflow',()=>{
 const world=fixture(),owner={},first=world.resources[0]!,second=world.resources[1]!;captureResourceJournal(world.resources);
 expect(closedResourceIdentityLookup(world.resources,owner)?.(second.id)).toBe(second);
 first.x++;markResourceChanged(world,first);expect(closedResourceIdentityLookup(world.resources,owner)?.(first.id)?.x).toBe(first.x);
 const added:Resource={...first,id:world.nextId++},before=world.resources;world.resources=[second,added];
 withJournalTerrainReadScope(owner,()=>markResourceArrayChanged(world,before,[added],[first]));
 let reads=0,descriptors=0;const source=world.resources;
 world.resources=new Proxy(source,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);},getOwnPropertyDescriptor(target,key){if(typeof key==='string'&&/^\d+$/.test(key))descriptors++;return Reflect.getOwnPropertyDescriptor(target,key);}});
 withJournalTerrainReadScope(owner,()=>markResourceArrayChanged(world,source,[],[]));
 const join=closedResourceIdentityLookup(world.resources,owner)!;expect(join(first.id)).toBeUndefined();expect(join(added.id)).toBe(added);expect(reads).toBe(0);expect(descriptors).toBe(0);
 for(let i=0;i<=RESOURCE_JOURNAL_CAPACITY;i++)markResourceChanged(world,added);
 expect(closedResourceIdentityLookup(world.resources,owner)?.(added.id)).toBe(added);expect(reads).toBe(0);expect(descriptors).toBe(0);
 invalidateResourceJournal(world);expect(closedResourceIdentityLookup(world.resources,owner)?.(added.id)).toBe(added);expect(descriptors).toBe(world.resources.length);
});

test('duplicates, non-own IDs, sparse arrays and unenrolled replacements refuse the join',()=>{
 const world=fixture(),owner={},first=world.resources[0]!;
 expect(closedResourceIdentityLookup(world.resources,owner)).toBeUndefined();captureResourceJournal(world.resources);
 const before=world.resources;world.resources=[first,{...first}];withJournalTerrainReadScope(owner,()=>markResourceArrayChanged(world,before,[world.resources[1]!],[before[1]!]));
 expect(closedResourceIdentityLookup(world.resources,owner)).toBeUndefined();
 world.resources=[first,Object.create(first) as Resource];captureResourceJournal(world.resources);expect(closedResourceIdentityLookup(world.resources,owner)).toBeUndefined();
 world.resources=[first,,] as Resource[];captureResourceJournal(world.resources);expect(closedResourceIdentityLookup(world.resources,owner)).toBeUndefined();
 world.resources=[first];expect(closedResourceIdentityLookup(world.resources,owner)).toBeUndefined();
});

test('sparse animal meal joins equal public dependency capture, including first duplicate and target removal',()=>{
 const world=fixture(),owner={};enableWildlife(world,0);const target=world.resources[0]!;
 world.wildlife!.animals.push({id:world.nextId++,species:'hare',sex:'female',x:target.x,z:target.z,ageTicks:1000,food:1,rest:1,state:'eating',path:[],nextDecision:1,meal:{kind:'plant',id:target.id,quantity:1,progress:0}});
 captureResourceJournal(world.resources);
 const compare=()=>expect(captureActorPhaseDependenciesWithResourceJoin297(world,undefined,closedResourceIdentityLookup(world.resources,owner)).data).toStrictEqual(captureActorPhaseDependencies297(world).data);
 compare();target.x++;markResourceChanged(world,target);compare();
 const before=world.resources;world.resources=before.filter(row=>row!==target);withJournalTerrainReadScope(owner,()=>markResourceArrayChanged(world,before,[],[target]));compare();
 const without=world.resources,duplicate={...target,x:target.x+3};world.resources=[target,duplicate,...without];markResourceArrayChanged(world,without);compare();
});

test('checking mode catches unmarked identity replacement and generic writes rebuild the exact current directory',()=>{
 const world=fixture(),owner={};captureResourceJournal(world.resources);closedResourceIdentityLookup(world.resources,owner);
 world.resources[0]={...world.resources[0]!};setResourceJournalVerification(true);
 expect(()=>closedResourceIdentityLookup(world.resources,owner)).toThrow('Unmarked resource identity membership write');
 invalidateResourceJournal(world);expect(closedResourceIdentityLookup(world.resources,owner)?.(world.resources[0]!.id)).toBe(world.resources[0]);
 const before=world.resources,added={...before[0]!,id:world.nextId++};world.resources=before.concat(added);markResourceArrayChanged(world,before,[added],[]);
 expect(closedResourceIdentityLookup(world.resources,owner)?.(added.id)).toBe(added);
});
