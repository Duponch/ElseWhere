/** PRIVATE owner/budget contracts. Author does not run tests or Native. */
import {test,expect,vi} from 'vitest';
import {AtlasCache,AtlasSlot,AtlasBuildQuarantineError,exactAtlasKey,type AtlasKey,type AtlasResource} from '../src/render/origami/baked/atlas-cache';
const key=(form='poplar',settings:AtlasKey['settings']={width:1.7,irregularity:.15,fill:.6}):AtlasKey=>({recipe:'poplar/source-sha-exact',form,palette:'source-43/green-exact',settings});
const bytes=(cpuBytes=16,gpuBytes=16)=>({cpuBytes,gpuBytes});
function resource(cpuBytes=16,gpuBytes=16){return{cpuBytes,gpuBytes,dispose:vi.fn()};}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}

test('explicit recipe/form/palette/settings keys are exact, order independent, and never silently quantised',()=>{
 expect(exactAtlasKey(key('poplar',{fill:.6,width:1.7}))).toBe(exactAtlasKey(key('poplar',{width:1.7,fill:.6})));
 expect(exactAtlasKey(key('poplar',{fill:.6}))).not.toBe(exactAtlasKey(key('poplar',{fill:.6000000000000001})));
 expect(exactAtlasKey(key('poplar',{fill:-0}))).not.toBe(exactAtlasKey(key('poplar',{fill:0})));
 expect(exactAtlasKey(key('poplar',{fill:'0'}))).not.toBe(exactAtlasKey(key('poplar',{fill:0})));
 expect(exactAtlasKey(key('poplar-branch-shape2'))).not.toBe(exactAtlasKey(key()));
 expect(()=>exactAtlasKey(key('poplar',{fill:Infinity}))).toThrow(/finite/);
});

test('400 copies share one pending build and one owned atlas; double releases and repeated disposal never dispose it twice',async()=>{
 const cache=new AtlasCache<AtlasResource>(bytes(64,64)),wait=deferred<AtlasResource>(),build=vi.fn(()=>wait.promise),atlas=resource();
 const requests=Array.from({length:400},()=>cache.acquire(key(),bytes(32,24),build));
 expect(cache.snapshot()).toMatchObject({cpuBytes:32,gpuBytes:24,pending:1,leases:400});expect(()=>cache.dispose()).toThrow(/owners/);
 await Promise.resolve();expect(build).toHaveBeenCalledTimes(1);wait.resolve(atlas);const leases=await Promise.all(requests);
 expect(leases.every(lease=>lease.resource===atlas)).toBe(true);expect(cache.snapshot()).toMatchObject({cpuBytes:16,gpuBytes:16,ready:1,pending:0,leases:400});
 for(const lease of leases){lease.release();lease.release();}expect(atlas.dispose).not.toHaveBeenCalled();expect(cache.evictUnused()).toBe(1);expect(atlas.dispose).toHaveBeenCalledTimes(1);
 cache.dispose();cache.dispose();expect(atlas.dispose).toHaveBeenCalledTimes(1);await expect(cache.acquire(key(),bytes(),()=>atlas)).rejects.toThrow(/disposed/);
});

test('peak CPU/GPU reservations protect live and pending owners before bake, then only unowned atlases can be evicted',async()=>{
 const cache=new AtlasCache<AtlasResource>(bytes(40,30)),a=resource(20,20),lease=await cache.acquire(key('A'),bytes(24,24),()=>a),build=vi.fn(()=>resource());
 await expect(cache.acquire(key('B'),bytes(21,1),build)).rejects.toThrow(/peak budget/);await expect(cache.acquire(key('B'),bytes(1,11),build)).rejects.toThrow(/peak budget/);expect(build).not.toHaveBeenCalled();expect(a.dispose).not.toHaveBeenCalled();
 const wait=deferred<AtlasResource>(),pending=cache.acquire(key('C'),bytes(20,10),()=>wait.promise);await expect(cache.acquire(key('D'),bytes(1,0),build)).rejects.toThrow(/peak budget/);
 lease.release();expect(cache.evictUnused()).toBe(1);expect(a.dispose).toHaveBeenCalledTimes(1);expect(cache.snapshot()).toMatchObject({cpuBytes:20,gpuBytes:10,pending:1});
 const c=resource(10,8);wait.resolve(c);const owner=await pending;owner.release();const b=resource(32,24),next=await cache.acquire(key('B'),bytes(36,28),()=>b);
 expect(c.dispose).toHaveBeenCalledTimes(1);expect(cache.snapshot()).toMatchObject({cpuBytes:32,gpuBytes:24,leases:1});next.release();cache.dispose();expect(b.dispose).toHaveBeenCalledTimes(1);
});

test('concurrent failure is shared, reservations roll back, and oversized results are disposed without publication',async()=>{
 const cache=new AtlasCache<AtlasResource>(bytes(32,32)),wait=deferred<AtlasResource>(),build=vi.fn(()=>wait.promise);
 const first=cache.acquire(key(),bytes(24,24),build),second=cache.acquire(key(),bytes(24,24),build),settled=Promise.allSettled([first,second]);
 await expect(cache.acquire(key(),bytes(25,24),build)).rejects.toThrow(/Conflicting/);await Promise.resolve();wait.reject(new Error('raster failed'));
 const results=await settled;expect(results.every(value=>value.status==='rejected')).toBe(true);expect(build).toHaveBeenCalledTimes(1);expect(cache.snapshot()).toMatchObject({cpuBytes:0,gpuBytes:0,pending:0,leases:0});
 const huge=resource(25,24);await expect(cache.acquire(key(),bytes(24,24),()=>huge)).rejects.toThrow(/exceeds/);expect(huge.dispose).toHaveBeenCalledTimes(1);expect(cache.snapshot()).toMatchObject({cpuBytes:0,gpuBytes:0,ready:0});
 const good=resource(),lease=await cache.acquire(key(),bytes(),()=>good);lease.release();cache.dispose();expect(good.dispose).toHaveBeenCalledTimes(1);
 const brokenCache=new AtlasCache<AtlasResource>(bytes(32,32)),broken=resource(24,24),nextBuild=vi.fn(()=>resource());broken.dispose.mockImplementation(()=>{throw new Error('driver disposal failed');});
 const owner=await brokenCache.acquire(key('broken'),bytes(24,24),()=>broken);owner.release();
 await expect(brokenCache.acquire(key('next'),bytes(),nextBuild)).rejects.toThrow(/driver disposal/);expect(nextBuild).not.toHaveBeenCalled();expect(brokenCache.snapshot()).toMatchObject({cpuBytes:24,gpuBytes:24,quarantined:1,leases:0});
 await expect(brokenCache.acquire(key('broken'),bytes(24,24),nextBuild)).rejects.toThrow(/quarantined/);expect(brokenCache.evictUnused()).toBe(0);expect(()=>brokenCache.dispose()).toThrow(/quarantined/);expect(()=>brokenCache.dispose()).toThrow(/quarantined/);expect(broken.dispose).toHaveBeenCalledTimes(1);
 const excessCache=new AtlasCache<AtlasResource>(bytes(32,32)),excess=resource(40,40);excess.dispose.mockImplementation(()=>{throw new Error('excess disposal failed');});
 await expect(excessCache.acquire(key(),bytes(24,24),()=>excess)).rejects.toThrow(/rejection and disposal/);expect(excessCache.snapshot()).toMatchObject({cpuBytes:40,gpuBytes:40,quarantined:1});await expect(excessCache.acquire(key('next'),bytes(1,1),nextBuild)).rejects.toThrow(/peak budget/);expect(excess.dispose).toHaveBeenCalledTimes(1);
 const unknownCache=new AtlasCache<AtlasResource>(bytes(32,32)),unknown=resource(NaN,1);unknown.dispose.mockImplementation(()=>{throw new Error('unknown disposal failed');});
 await expect(unknownCache.acquire(key(),bytes(24,24),()=>unknown)).rejects.toThrow(/rejection and disposal/);expect(unknownCache.snapshot()).toMatchObject({cpuBytes:24,gpuBytes:24,quarantined:1,unknownBytes:true});await expect(unknownCache.acquire(key('next'),bytes(0,0),nextBuild)).rejects.toThrow(/unknown/);expect(unknown.dispose).toHaveBeenCalledTimes(1);
 const preparationCache=new AtlasCache<AtlasResource>(bytes(32,32));await expect(preparationCache.acquire(key(),bytes(24,24),()=>{throw new AtlasBuildQuarantineError(new Error('source cleanup failed'));})).rejects.toThrow(/quarantined/);
 expect(preparationCache.snapshot()).toMatchObject({cpuBytes:24,gpuBytes:24,quarantined:1,unknownBytes:true,leases:0});await expect(preparationCache.acquire(key('next'),bytes(0,0),nextBuild)).rejects.toThrow(/unknown/);
});

test('slot publication is atomic across budget refusal, failed preparation, and out-of-order option changes',async()=>{
 const cache=new AtlasCache<AtlasResource>(bytes(64,64)),slot=new AtlasSlot(cache),a=resource(24,24);await slot.replace(key('A'),bytes(24,24),()=>a);
 const never=vi.fn(()=>resource());await expect(slot.replace(key('too-big'),bytes(41,1),never)).rejects.toThrow(/peak budget/);expect(never).not.toHaveBeenCalled();expect(slot.resource).toBe(a);
 await expect(slot.replace(key('bad'),bytes(),()=>{throw new Error('bad paint');})).rejects.toThrow(/bad paint/);expect(slot.resource).toBe(a);expect(a.dispose).not.toHaveBeenCalled();
 const old=deferred<AtlasResource>(),oldRequest=slot.replace(key('older-options'),bytes(),()=>old.promise),oldFailure=expect(oldRequest).rejects.toThrow(/superseded/),b=resource();
 await slot.replace(key('newer-options'),bytes(),()=>b);expect(slot.resource).toBe(b);const stale=resource();old.resolve(stale);await oldFailure;expect(slot.resource).toBe(b);expect(cache.snapshot().leases).toBe(1);
 slot.dispose();slot.dispose();expect(slot.resource).toBeUndefined();cache.dispose();expect([a,b,stale].every(value=>value.dispose.mock.calls.length===1)).toBe(true);
});
