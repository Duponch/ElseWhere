import {expect,test} from 'vitest';
import {MotionTimeline} from '../src/render/MotionTimeline';

// Numeric clock transitions only: these cases grant no World/Native authority.
test('semantic speed timestamps, immediate Pause and new-owner reset survive adaptive pacing',()=>{
 const t=new MotionTimeline();t.adopt(100,6,[],0,true,true,true);
 t.adopt(101.44,6,[],40,false,true,true);t.advance(50);
 // A receipt may be later than a pending RAF. A semantic change can refill the
 // confirmed reserve, but its new rate cannot run before its timestamp.
 // A running speed change no longer seeks: the playhead keeps its place, a
 // stale RAF before the timestamp still plays at the OLD rate (x6), and after
 // it the change plays at the mean rate (x3.5) until the history meets the
 // new reserve (contract of 10 November 2026, previously a seek to it).
 t.adopt(101.8,1,[],60,false,true,true);const one=t.tick;
 expect(one).toBeCloseTo(100.504,12);
 expect(t.advance(58)-one).toBeCloseTo(.008*36,12);
 expect(t.advance(62)-one).toBeCloseTo(.010*36+.002*21,12);
 t.adopt(103,6,[],80,false,true,true);const six=t.tick;
 expect(six).toBe(t.tick);
 // Up to the new timestamp the slowdown's mean rate still applies; after it,
 // the speed-up plays at the mean of that rate and x6 (28.5 ticks/s).
 expect(t.advance(79)-six).toBeCloseTo(.017*21,12);
 expect(t.advance(82)-six).toBeCloseTo(.018*21+.002*28.5,12);
 t.adopt(103,0,[],83,false,true,true);
 expect(t.tick).toBe(103);expect(t.advance(100000)).toBe(103);
 // A load/new owner can legitimately restart at an earlier Core. Old rate,
 // backlog and future events cannot leak into that replacement history.
 t.adopt(10,6,[],100001,true,true,true);
 expect(t.tick).toBe(10);expect(t.advance(100020)).toBe(10);
 t.adopt(11.44,6,[],100041,false,true,true);const fresh=t.tick;
 expect(fresh).toBeCloseTo(10.144,12);
 expect(t.advance(100051)-fresh).toBeCloseTo(.36,12);
 expect(t.tick).toBeLessThanOrEqual(11.44);
});

test('duplicate receipts never renew a genuine no-progress silence or invent a Core',()=>{
 const t=new MotionTimeline();t.adopt(100,6,[],0,true,true,true);
 t.adopt(100.1,6,[],20,false,true,true);
 for(const now of [40,60,80,100]){
  t.adopt(100.1,6,[],now,false,true,true);expect(t.advance(now)).toBe(100);
 }
 // The last actual advance was at20, not the last duplicate at100.
 expect(t.advance(121)).toBe(100.1);expect(t.advance(200)).toBe(100.1);
 const before=t.tick;t.adopt(104,6,[],300,false,true,true);
 expect(t.tick).toBeGreaterThan(before);expect(t.tick).toBeLessThanOrEqual(104);
 expect((104-t.tick)/36).toBeCloseTo(.036,12);
 const joined=t.tick;
 t.adopt(104.72,6,[],320,false,true,true);expect(t.tick).toBe(joined);
 // A short nominal receipt must not erase the slower supply observed before
 // this late join. It can advance confirmed history, without forcing36/s.
 const shown=t.advance(320),delta=shown-joined,nominalDelta=36*.020;
 expect(delta).toBeGreaterThan(0);expect(shown).toBeLessThanOrEqual(104.72);
 expect(delta).toBeLessThan(nominalDelta);expect(delta).not.toBeCloseTo(nominalDelta,12);
 t.adopt(104.72,0,[],321,false,true,true);
 expect(t.advance(100000)).toBe(104.72);
});

test('post-drain host time crosses a real receipt that lies after the RAF timestamp',()=>{
 const t=new MotionTimeline();t.adopt(100,6,[],100,true,true,true);
 t.adopt(101.44,6,[],140,false,true,true);const joined=t.tick;
 // These are caller clock inputs, not a fake Main renderer or source-text test.
 expect(t.advance(120)).toBe(joined);
 const postDrainHost=142,staleRaf=120;
 expect(t.advance(Math.max(staleRaf,postDrainHost))-joined).toBeCloseTo(.072,12);
 expect(t.tick).toBeLessThanOrEqual(101.44);
});

test('the historical two-tick clock retains its original startup and rate',()=>{
 const t=new MotionTimeline();t.adopt(100,6,[],0,true,true,false);
 t.adopt(101.9,6,[],40,false,true,false);expect(t.advance(50)).toBe(100);
 t.adopt(102,6,[],60,false,true,false);expect(t.tick).toBe(100);
 expect(t.advance(70)).toBeCloseTo(100.36,12);
 t.adopt(102,0,[],71,false,true,false);expect(t.advance(100000)).toBe(102);
});
