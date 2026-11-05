import {it,expect} from 'vitest';
import {SharedSurfacePreparationRegistry,type SharedSurfacePreparationSnapshot} from '../src/render/surfaces/SharedSurfacePreparation';
it('stages the nominal-budget consumer after producers and rolls back in reverse dependency order',async()=>{
 const registry=new SharedSurfacePreparationRegistry(),events:string[]=[];let held=0;
 const owner=(key:string,priority:number)=>({key,preparationPriority:priority,needsPreparation:()=>true,stage:()=>{
  events.push('stage:'+key);if(key==='producer')held=64;else expect(held).toBe(64);
  return{publish(){events.push('publish:'+key);},commit(){events.push('commit:'+key);},rollback(){events.push('rollback:'+key);},dispose(){events.push('dispose:'+key);}};
 }});
 registry.register(owner('ledger',1000));registry.register(owner('producer',0));
 const batch=await registry.stage({preferences:{style:'default'}}as unknown as SharedSurfacePreparationSnapshot,()=>{});
 batch.publish();batch.rollback();batch.dispose();
 expect(events.slice(0,6)).toEqual(['stage:producer','stage:ledger','publish:producer','publish:ledger','rollback:ledger','rollback:producer']);
 registry.dispose();
});
