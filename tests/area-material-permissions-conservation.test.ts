import {expect,test} from 'vitest';
import {generateWorld} from '../src/sim/generation';
import {addGroundMaterial} from '../src/sim/materials';
import {applyCommand} from '../src/sim/engine';
import {serializeWorld,deserializeWorld} from '../src/sim/serialization';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots';
import {materialAllowedForPlayer256} from '../src/sim/material-permission-256';

test('a real permission rectangle survives exact save, fresh Full and delta without changing its actual piles or clocks',()=>{
 // Prepared ordinary32 fixture, not a campaign or Core generation assertion.
 const w=generateWorld(81874,32,32);w.resources=[];w.structures=[];w.piles=[];w.tiles=w.tiles.map(()=>({terrain:'soil'}));
 addGroundMaterial(w,'steel',10,{x:12,z:12},'steel');addGroundMaterial(w,'wood',13,{x:13,z:12},'wood');
 const piles=[...w.piles],actual=piles.map(p=>({id:p.id,quantity:p.quantity,owner:structuredClone(p.owner)})),clocks=[w.tick,w.rng,w.nextId],baseline=serializeWorld(w);
 expect(piles).toHaveLength(2);expect(piles.map(p=>p.owner)).toEqual([{type:'ground',x:12,z:12},{type:'ground',x:13,z:12}]);
 const encoder=new SnapshotEncoder(),decoder=new SnapshotDecoder(),baseMessage=structuredClone(encoder.encode(w,0,0));expect(baseMessage.kind).toBe('checkpoint');const base=decoder.adopt(baseMessage);
 expect(base.status).toBe('applied');if(base.status!=='applied')throw Error('Prepared initial Full refused');
 const beforeDelta=structuredClone(base.world);
 expect(applyCommand(w,{type:'area',action:'forbid',from:{x:12,z:12},to:{x:13,z:12}})).toEqual({ok:true,affected:2,skipped:0});
 expect(w.piles.every((p,i)=>p===piles[i])).toBe(true);expect(w.piles.map(p=>({id:p.id,quantity:p.quantity,owner:p.owner}))).toEqual(actual);expect([w.tick,w.rng,w.nextId]).toEqual(clocks);
 const forbidden=serializeWorld(w),loaded=deserializeWorld(forbidden);expect(serializeWorld(loaded)).toBe(forbidden);expect(loaded.piles.every(p=>!materialAllowedForPlayer256(p))).toBe(true);
 const fullMessage=structuredClone(new SnapshotEncoder().encode(loaded,0,0));expect(fullMessage.kind).toBe('checkpoint');const freshFull=new SnapshotDecoder().adopt(fullMessage);
 expect(freshFull.status).toBe('applied');if(freshFull.status!=='applied')throw Error('Prepared forbidden Full refused');
 expect(freshFull.world.piles.map(p=>({id:p.id,quantity:p.quantity,forbidden:p.forbidden}))).toEqual(actual.map(p=>({id:p.id,quantity:p.quantity,forbidden:true})));
 const deltaMessage=structuredClone(encoder.encode(w,0,0));expect(deltaMessage.kind).toBe('delta');const delta=decoder.adopt(deltaMessage);expect(delta.status).toBe('applied');if(delta.status!=='applied')throw Error('Prepared permission delta refused');
 expect(beforeDelta.piles.every(p=>p.forbidden===undefined)).toBe(true);expect(delta.world.piles.every(p=>p.forbidden===true)).toBe(true);
 expect(applyCommand(w,{type:'area',action:'allow',from:{x:13,z:12},to:{x:12,z:12}})).toEqual({ok:true,affected:2,skipped:0});
 expect(w.piles.every((p,i)=>p===piles[i])).toBe(true);expect([w.tick,w.rng,w.nextId]).toEqual(clocks);expect(serializeWorld(w)).toBe(baseline);
 const allowedMessage=structuredClone(encoder.encode(w,0,0));expect(allowedMessage.kind).toBe('delta');const allowed=decoder.adopt(allowedMessage);expect(allowed.status).toBe('applied');if(allowed.status!=='applied')throw Error('Prepared allow delta refused');
 expect(allowed.world.piles.every(p=>p.forbidden===undefined)).toBe(true);expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(baseline);
});
