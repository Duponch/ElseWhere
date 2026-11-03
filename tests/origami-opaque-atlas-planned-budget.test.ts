/** Ownership/admission only. No GPU allocation or performance measurement. */
import {expect,test,vi} from 'vitest';
import {AtlasCache,AtlasBuildQuarantineError,type AtlasKey,type AtlasResource,type AtlasPreparationReservation} from '../src/render/origami/baked/atlas-cache';
const key=(name:string):AtlasKey=>({recipe:name,form:'exact',palette:'exact',settings:{}});
const bytes=(cpuBytes:number,gpuBytes:number)=>({cpuBytes,gpuBytes});
const resource=(cpu:number,gpu:number)=>({...bytes(cpu,gpu),dispose:vi.fn()});

test('exact preparation peaks admit a small atlas beside live owners when a maximum-size reservation would refuse it',async()=>{
 const cache=new AtlasCache<AtlasResource>(bytes(128,512)),resident=resource(8,300),owner=await cache.acquire(key('resident'),bytes(8,300),()=>resident);
 const never=vi.fn(()=>resource(4,22));
 await expect(cache.acquire(key('fixed'),bytes(64,256),never)).rejects.toThrow(/peak budget/);expect(never).not.toHaveBeenCalled();
 let reservation:AtlasPreparationReservation|undefined;
 const small=resource(4,22),build=vi.fn((r:AtlasPreparationReservation)=>{
  reservation=r;expect(cache.snapshot()).toMatchObject({cpuBytes:72,gpuBytes:300,pending:1});
  r.reservePeak(bytes(32,76));expect(cache.snapshot()).toMatchObject({cpuBytes:72,gpuBytes:376});
  r.reservePeak(bytes(12,60));expect(cache.snapshot().gpuBytes).toBe(376); // never shrink a live peak
  return small;
 });
 const [a,b]=await Promise.all([cache.acquire(key('planned'),bytes(64,256),build,bytes(64,0)),cache.acquire(key('planned'),bytes(64,256),build,bytes(64,0))]);
 expect(build).toHaveBeenCalledTimes(1);expect(a.resource).toBe(b.resource);expect(cache.snapshot()).toMatchObject({cpuBytes:12,gpuBytes:322,leases:3});
 expect(()=>reservation!.reservePeak(bytes(1,1))).toThrow(/no longer pending/);
 a.release();b.release();owner.release();cache.dispose();expect(small.dispose).toHaveBeenCalledTimes(1);expect(resident.dispose).toHaveBeenCalledTimes(1);
});

test('late admission protects all live owners, refuses before allocation, and cleans only unused victims',async()=>{
 const cache=new AtlasCache<AtlasResource>(bytes(128,100)),resident=resource(8,60),owner=await cache.acquire(key('resident'),bytes(8,60),()=>resident),allocation=vi.fn();
 await expect(cache.acquire(key('no-room'),bytes(64,80),r=>{r.reservePeak(bytes(32,41));allocation();return resource(4,30);},bytes(64,0))).rejects.toThrow(/peak budget/);
 expect(allocation).not.toHaveBeenCalled();expect(cache.snapshot()).toMatchObject({cpuBytes:8,gpuBytes:60,ready:1,pending:0});expect(resident.dispose).not.toHaveBeenCalled();
 await expect(cache.acquire(key('above-ceiling'),bytes(64,40),r=>{r.reservePeak(bytes(32,41));allocation();return resource(4,30);},bytes(64,0))).rejects.toThrow(/ceiling/);
 owner.release();const atlas=resource(8,50),next=await cache.acquire(key('evicts-unused'),bytes(64,80),r=>{r.reservePeak(bytes(32,80));allocation();return atlas;},bytes(64,0));
 expect(resident.dispose).toHaveBeenCalledTimes(1);expect(allocation).toHaveBeenCalledTimes(1);expect(cache.snapshot()).toMatchObject({cpuBytes:8,gpuBytes:50,leases:1});next.release();cache.dispose();
});

test('unadmitted output is rejected and uncertain cleanup quarantines the actual admitted peak, never silently releases it',async()=>{
 const cache=new AtlasCache<AtlasResource>(bytes(128,100)),bad=resource(8,20);
 await expect(cache.acquire(key('forgot-admission'),bytes(64,80),()=>bad,bytes(64,0))).rejects.toThrow(/admitted peak/);
 expect(bad.dispose).toHaveBeenCalledTimes(1);expect(cache.snapshot()).toMatchObject({cpuBytes:0,gpuBytes:0,pending:0});
 let late:AtlasPreparationReservation|undefined;
 await expect(cache.acquire(key('uncertain'),bytes(64,80),r=>{late=r;r.reservePeak(bytes(32,50));throw new AtlasBuildQuarantineError(Error('TEST cleanup uncertain'));},bytes(64,0))).rejects.toThrow(/quarantined/);
 expect(cache.snapshot()).toMatchObject({cpuBytes:64,gpuBytes:50,quarantined:1,unknownBytes:true,leases:0});
 expect(()=>late!.reservePeak(bytes(32,60))).toThrow(/no longer pending/);
 await expect(cache.acquire(key('next'),bytes(0,0),()=>resource(0,0),bytes(0,0))).rejects.toThrow(/unknown/);expect(()=>cache.dispose()).toThrow(/quarantined/);
});
