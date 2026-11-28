import { expect,test,vi } from 'vitest';
import { GameSession,SAVE_KEY,PREVIOUS_KEY } from '../src/ui/game-session';
import { decodeStoredSave,SAVE_COMPRESSION_THRESHOLD } from '../src/ui/save-storage-codec';
import {createStartingCandidateRoster,startingPartyFromRoster} from '../src/sim/starting-candidates';
import {resolveStartingSite} from '../src/sim/starting-world';

function fixture(active=false) {
  const data=new Map<string,string>([[SAVE_KEY,'manual'],[PREVIOUS_KEY,'older']]);
  const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}};
  const client={init:vi.fn(async()=>{}),load:vi.fn(async(_data:string)=>{}),save:vi.fn(async()=> 'active')};
  const prepare=vi.fn(async()=>{}),session=new GameSession(client,()=>storage,prepare);session.hasWorld=active;
  return {data,storage,client,prepare,session};
}
test('prepared party and selected globe descriptor reach the exclusive init operation unchanged',async()=>{
  const f=fixture(),party=startingPartyFromRoster(333,createStartingCandidateRoster(333));
  const choice={version:1 as const,seed:42,tile:0},site=resolveStartingSite(choice);
  await f.session.create(site.seed,250,'crashlanded',site.site,party,choice);
  expect(f.client.init).toHaveBeenCalledExactlyOnceWith(site.seed,250,'crashlanded',true,site.site,party,choice,'snow-phased-v1');
  expect(f.session.hasWorld).toBe(true);expect(f.session.busy).toBe(false);expect(f.prepare).toHaveBeenCalledOnce();
});
test('cold load uses the chosen data without initializing a temporary world; recovery remains distinct',async()=>{
  const f=fixture();await f.session.load(SAVE_KEY);
  expect(f.client.init).not.toHaveBeenCalled();expect(f.client.save).not.toHaveBeenCalled();
  expect(f.client.load).toHaveBeenCalledWith('manual');expect(f.prepare).toHaveBeenCalledOnce();
  expect(f.session.hasWorld).toBe(true);expect(f.data.get(PREVIOUS_KEY)).toBe('older');
  await f.session.load(PREVIOUS_KEY);
  expect(f.client.load).toHaveBeenLastCalledWith('older');expect(f.data.get(PREVIOUS_KEY)).toBe('active');expect(f.data.get(SAVE_KEY)).toBe('manual');
});
test('refused replacement restores prior recovery and active world; accepted world survives graphics failure',async()=>{
  const f=fixture(true);f.client.init.mockRejectedValueOnce(new Error('invalid world'));
  await expect(f.session.create(42,32,'sentry')).rejects.toThrow('invalid world');
  expect(f.data.get(PREVIOUS_KEY)).toBe('older');expect(f.data.get(SAVE_KEY)).toBe('manual');expect(f.prepare).not.toHaveBeenCalled();expect(f.session.busy).toBe(false);
  f.prepare.mockRejectedValueOnce(new Error('GPU unavailable'));
  await expect(f.session.create(42,250,'crashlanded')).rejects.toThrow('GPU unavailable');
  expect(f.client.init).toHaveBeenLastCalledWith(42,250,'crashlanded',true,undefined,undefined,undefined,'snow-phased-v1');
  expect(f.session.hasWorld).toBe(true);expect(f.data.get(PREVIOUS_KEY)).toBe('active');expect(f.data.get(SAVE_KEY)).toBe('manual');
});
test('unavailable storage prevents destructive replacement; concurrent operations are rejected until preparation ends',async()=>{
  const f=fixture(true);f.storage.setItem=()=>{throw Error('Quota exceeded');};
  await expect(f.session.create(42,250,'crashlanded')).rejects.toThrow('Quota');expect(f.client.init).not.toHaveBeenCalled();
  expect(f.data.get(PREVIOUS_KEY)).toBe('older');
  const g=fixture();let release!:()=>void;
  g.prepare.mockImplementationOnce(()=>new Promise<void>(r=>{release=r;}));
  const first=g.session.load(SAVE_KEY);await vi.waitFor(()=>expect(g.prepare).toHaveBeenCalled());
  await expect(g.session.create(42,250,'crashlanded')).rejects.toThrow('en cours');await expect(g.session.save()).rejects.toThrow('en cours');
  expect(g.client.init).not.toHaveBeenCalled();release();await first;expect(g.session.busy).toBe(false);
});
test('metadata uses civil date and corrupt slots remain visible without trusting their contents',()=>{
  const f=fixture();f.data.set(SAVE_KEY,JSON.stringify({tick:4500,width:250,height:250,schemaVersion:82,gameProfile:{revision:1},scenario:{id:'crashlanded'}}));
  const saves=f.session.saves();expect(saves[0]!.detail).toContain('jour 2');expect(saves[0]!.detail).toContain('format 82');expect(saves[1]!.detail).toContain('illisibles');
  expect(f.client.load).not.toHaveBeenCalled();
});
test('large manual and recovery saves are compressed transparently while replacement rollback keeps exact slots',async()=>{
  const f=fixture(true),raw=JSON.stringify({schemaVersion:91,tick:291,width:250,height:250,scenario:{id:'crashlanded'},gameProfile:{revision:1},tiles:'x'.repeat(SAVE_COMPRESSION_THRESHOLD+1)});
  f.client.save.mockResolvedValue(raw);
  await f.session.save();
  const manual=f.data.get(SAVE_KEY)!;expect(manual).not.toBe(raw);expect(await decodeStoredSave(manual)).toBe(raw);
  f.client.init.mockRejectedValueOnce(new Error('invalid world'));
  await expect(f.session.create(42,250,'crashlanded')).rejects.toThrow('invalid world');
  expect(f.data.get(PREVIOUS_KEY)).toBe('older');expect(await decodeStoredSave(f.data.get(SAVE_KEY)!)).toBe(raw);
  await f.session.load(SAVE_KEY);expect(f.client.load).toHaveBeenLastCalledWith(raw);
  expect(await decodeStoredSave(f.data.get(PREVIOUS_KEY)!)).toBe(raw);
});
test('an invalid compressed slot is refused before the active recovery is touched',async()=>{
  const f=fixture(true);f.data.set(SAVE_KEY,JSON.stringify({format:'lisiere-save',version:1}));
  await expect(f.session.load(SAVE_KEY)).rejects.toThrow('invalide');
  expect(f.client.save).not.toHaveBeenCalled();expect(f.client.load).not.toHaveBeenCalled();
  expect(f.data.get(PREVIOUS_KEY)).toBe('older');expect(f.session.hasWorld).toBe(true);
});

test('external test copies preserve manual saves, reject failed fetches and retain recovery on worker refusal',async()=>{
  const f=fixture(true);
  await expect(f.session.loadExternal(async()=>{throw Error('network');})).rejects.toThrow('network');
  expect(f.client.save).not.toHaveBeenCalled();expect(f.client.load).not.toHaveBeenCalled();
  expect(f.data.get(PREVIOUS_KEY)).toBe('older');
  f.client.load.mockRejectedValueOnce(Error('invalid colony'));
  await expect(f.session.loadExternal(async()=> 'bad')).rejects.toThrow('invalid colony');
  expect(f.data.get(PREVIOUS_KEY)).toBe('older');expect(f.data.get(SAVE_KEY)).toBe('manual');
  await f.session.loadExternal(async()=> 'test colony');
  expect(f.client.load).toHaveBeenLastCalledWith('test colony');expect(f.client.init).not.toHaveBeenCalled();
  expect(f.data.get(PREVIOUS_KEY)).toBe('active');expect(f.data.get(SAVE_KEY)).toBe('manual');
  expect(f.session.busy).toBe(false);expect(f.prepare).toHaveBeenCalledOnce();
});

test('external downloads reserve the session before network completion',async()=>{
  const f=fixture();let resolve!: (data:string)=>void;
  const load=f.session.loadExternal(()=>new Promise<string>(done=>{resolve=done;}));
  await expect(f.session.load(SAVE_KEY)).rejects.toThrow('en cours');
  expect(f.client.load).not.toHaveBeenCalled();resolve('external');await load;
  expect(f.client.load).toHaveBeenCalledWith('external');expect(f.session.busy).toBe(false);
});

test('the confirmed draft advances the accepted generation even when its renderer fails, not when the worker refuses',async()=>{
  const f=fixture();
  const refused=vi.fn(async()=>{throw Error('invalid map');});
  await expect(f.session.createConfirmedDraft(refused)).rejects.toThrow('invalid map');
  expect(f.session.generation).toBe(0);expect(f.session.hasWorld).toBe(false);
  expect(f.prepare).not.toHaveBeenCalled();
  const start=vi.fn(async()=>{});f.prepare.mockRejectedValueOnce(Error('No shared actual animal model'));
  await expect(f.session.createConfirmedDraft(start)).rejects.toThrow('No shared actual animal model');
  expect(f.session.generation).toBe(1);expect(f.session.hasWorld).toBe(true);
  expect(f.session.busy).toBe(false);expect(start).toHaveBeenCalledOnce();
  expect(f.prepare).toHaveBeenCalledOnce();
});
