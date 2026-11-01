import {expect,test} from 'vitest';
import {serializeWorld} from '../src/sim/serialization.ts';
import {initialSkills} from '../src/sim/skills.ts';
import {applyMeleeStun} from '../src/sim/stun.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler.ts';
import {fixture,play} from './wall-fixture301.ts';

test('actual mid-work and retired-busy Full keep strict/resident identity and reject a future driver phase atomically',()=>{
 const {w,p}=fixture();play(w,1);
 const encoder=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),strict=new SnapshotDecoder(),resident=new ResidentPresentationAssembler(),badResident=new ResidentPresentationAssembler();
 const raw=serializeWorld(w),a=structuredClone(encoder.encode(w,0,0,true));
 expect(serializeWorld(w)).toBe(raw);
 const sa=strict.adopt(structuredClone(a)),ra=resident.adopt(structuredClone(a)),ba=badResident.adopt(structuredClone(a));
 expect(sa.status).toBe('applied');expect(ra.status).toBe('applied');expect(ba.status).toBe('applied');
 if(sa.status!=='applied'||ra.status!=='applied'||ba.status!=='applied')throw Error('Actual mid-work Full refused');
 // A presentation World carries its own map/group projection; it is not a
 // RAW/save owner. Preserve its strict/resident data without minting that role.
 expect(ra.world).toStrictEqual(sa.world);
 expect(ra.world.pawns[0]!.frameToil301).toEqual(p.frameToil301);
 expect(ra.world.pawns[0]!.jobTickDelta301).toBe(p.jobTickDelta301);
 expect(ra.world.jobs.find(j=>j.id===p.jobId)!.frameWork301).toEqual(w.jobs.find(j=>j.id===p.jobId)!.frameWork301);
 const first=structuredClone(ra.world),badFirst=structuredClone(ba.world);
 p.skills=initialSkills(3);w.rng=1;applyMeleeStun(w,p,effectiveCore297(w));play(w,1);
 expect(p.frameToil301?.kind).toBe('retired');
 const b=structuredClone(encoder.encode(w,0,0,true)),sb=strict.adopt(structuredClone(b)),rb=resident.adopt(structuredClone(b));
 expect(sb.status).toBe('applied');expect(rb.status).toBe('applied');
 if(sb.status!=='applied'||rb.status!=='applied')throw Error('Retired busy Full refused');
 expect(rb.world).toStrictEqual(sb.world);
 expect(rb.world.pawns[0]!.frameToil301).toEqual(p.frameToil301);
 expect(rb.world.pawns[0]!.jobTickDelta301).toBe(p.jobTickDelta301);
 expect(rb.world.jobs.map(j=>j.id)).toEqual(w.jobs.map(j=>j.id));
 expect(ra.world).toStrictEqual(first);
 const bad=structuredClone(b);bad.world.pawns[0]!.frameToil301={kind:'retired',jobId:p.frameToil301!.jobId,atCore:effectiveCore297(w)+1};
 expect(badResident.adopt(bad).status).toBe('resync');expect(ba.world).toStrictEqual(badFirst);
 expect(badResident.adopt(structuredClone(b)).status).toBe('applied');
});
