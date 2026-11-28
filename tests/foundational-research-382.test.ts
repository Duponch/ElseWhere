import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {canDesignate} from '../src/sim/engine.ts';
import {researchCost,researchPrerequisite,researchUnlocked,selectResearch} from '../src/sim/research.ts';
import {validateResearch} from '../src/sim/research-save.ts';
import {architectCategoryAvailable,architectToolAvailable} from '../src/ui/architect-availability.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {convertRwsSave} from '../src/import/rimworld/convert.ts';
import {asOldSchema} from './scenarios/old-schema.ts';

it('uses the real Core costs, visibility and command gates before either completed project',()=>{
 const w=deconstructionCamp();w.research={project:null,points:0,electricity:{points:0},passiveCooler:{points:0}};
 const command={type:'designate',kind:'power-conduit',x:12,z:12,material:'steel',orientation:0} as const;
 const cooler={type:'designate',kind:'passive-cooler',x:12,z:12,material:'wood',orientation:0} as const;
 expect(researchCost('electricity')).toBe(1_600_000_000);expect(researchCost('passive-cooler')).toBe(400_000_000);
 expect(researchPrerequisite(w,'batteries')).toBe('Électricité');expect(selectResearch(w,'batteries').ok).toBe(false);
 expect(architectCategoryAvailable(w,'power')).toBe(false);expect(architectToolAvailable(w,'power-conduit')).toBe(false);expect(architectToolAvailable(w,'hidden-conduit')).toBe(false);expect(architectToolAvailable(w,'passive-cooler')).toBe(false);
 expect(canDesignate(w,command)).toMatchObject({ok:false,reason:expect.stringContaining('Électricité')});expect(canDesignate(w,cooler)).toMatchObject({ok:false,reason:expect.stringContaining('Refroidisseur passif')});
 expect(selectResearch(w,'electricity').ok).toBe(true);expect(validateResearch(w,382)).toEqual([]);
 // Simulate just the persisted completion for the independent prerequisite
 // contract; real research progression uses the common research engine.
 w.research!.electricity={points:researchCost('electricity'),completedAt:w.tick};w.research!.project=null;
 expect(researchPrerequisite(w,'batteries')).toBeUndefined();expect(architectCategoryAvailable(w,'power')).toBe(true);expect(architectToolAvailable(w,'power-conduit')).toBe(true);expect(canDesignate(w,command).ok).toBe(true);
 expect(architectToolAvailable(w,'passive-cooler')).toBe(false);expect(selectResearch(w,'passive-cooler').ok).toBe(true);
});

it('cold source keeps its actual incomplete electricity and complete passive cooler, never synthetic progress',()=>{
 const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
 const w=convertRwsSave(readRwsSave(fixture),{planet:false}).world;
 expect(w.research?.electricity).toEqual({points:0});expect(w.research?.passiveCooler).toEqual({points:400_000_000,completedAt:w.tick});
 expect(researchUnlocked(w,'electricity')).toBe(false);expect(researchUnlocked(w,'passive-cooler')).toBe(true);
 expect(validateWorld(w)).toEqual([]);const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
});

it('migrates the actual old entitlement to build freely without inventing any other project and grants ClassicStart in a new game',()=>{
 const w=deconstructionCamp();w.research={project:null,points:123};
 const old=JSON.parse(asOldSchema(serializeWorld(w),381));
 const migrated=deserializeWorld(JSON.stringify(old));
 expect(migrated.research).toEqual({project:null,points:123,electricity:{points:1_600_000_000,completedAt:0},passiveCooler:{points:400_000_000,completedAt:0}});
 expect(validateWorld(migrated)).toEqual([]);
 const classic=createScenarioWorld(42,32,'crashlanded');expect(classic.research?.electricity).toMatchObject({points:1_600_000_000,completedAt:0});expect(classic.research?.passiveCooler).toMatchObject({points:400_000_000,completedAt:0});
});
