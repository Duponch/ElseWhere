/** Independent canonical Full expansion. Deliberately imports no product
 * decoder, private source lease or prepared/adopted object. The replay hashes
 * the complete original graph after removing the wire-only section. */
export function createFullRetainedCanonicalExpander379(){
 let epoch=-1,revision=-1,tick=-1,jobs:any[]|undefined,thermal:any|undefined;
 const clear=()=>{epoch=revision=tick=-1;jobs=thermal=undefined;};
 const own=Object.hasOwn;
 const need=(v:unknown,reason:string)=>{if(!v)throw Error('Retained Full canonical expansion: '+reason);};
 return (message:any):any=>{
  if(message?.type!=='resident-publication')return message;
  const packet=message.publication;
  if(packet?.type==='campaign-only'){clear();return message;}
  if(packet?.type!=='snapshot')return message;
  const section=message.auxiliary?.retained379;if(!section){clear();return message;}
  const checkpoint=packet.kind==='checkpoint',world={...packet.world};
  need(section.epoch===packet.epoch&&section.revision===packet.revision&&section.tick===world.tick&&section.checkpoint===checkpoint,'header');
  if(checkpoint)clear();else need(packet.epoch===epoch&&packet.baseRevision===revision&&section.baseRevision===revision&&packet.revision===revision+1&&world.tick>=tick,'missing predecessor');
  const j=section.jobs;
  if(j.mode==='literal'){need(world.jobs!==0,'literal jobs marker');jobs=undefined;}
  else{
   need(j.mode==='rows'&&world.jobs===0&&j.reset===!jobs,'jobs marker/reset');
   const byId=new Map<number,any>((jobs??[]).map(row=>[row.id,row])),touched=new Set<number>();
   for(const id of j.removed){need(!touched.has(id)&&byId.delete(id),'jobs removal');touched.add(id);}
   for(const row of j.upserted){need(!touched.has(row.id),'jobs duplicate upsert');touched.add(row.id);byId.set(row.id,row);}
   const rows: any[]=own(j,'order')?j.order.map((id:number)=>byId.get(id)):[...byId.values()];
   need(rows.length===byId.size&&rows.length===j.count&&rows.every(Boolean)&&new Set(rows.map(r=>r.id)).size===rows.length,'jobs order/count');
   jobs=structuredClone(rows);world.jobs=rows;
  }
  const t=section.thermal;
  if(t.mode==='literal'){need(world.thermal!==0,'literal thermal marker');thermal=undefined;}
  else{
   need(t.mode==='regions'&&own(world,'thermal')&&world.thermal===0,'thermal marker');
   let value:any;
   if(t.reset){need(t.value?.regions?.length===t.count,'thermal reset');value=t.value;}
   else{
    need(thermal?.regions?.length===t.count&&t.temperatures instanceof Float64Array&&t.temperatures.length%2===0,'thermal predecessor/column');
    const regions=thermal.regions.slice();let last=-1;
    for(let i=0;i<t.temperatures.length;i+=2){const index=t.temperatures[i],temperature=t.temperatures[i+1];need(Number.isSafeInteger(index)&&index>last&&index<regions.length&&Number.isFinite(temperature),'thermal slot');last=index;regions[index]={...regions[index],temperature};}
    value={...thermal,regions};
   }
   thermal=structuredClone(value);world.thermal=value;
  }
  epoch=packet.epoch;revision=packet.revision;tick=world.tick;
  const {retained379:_retained,...auxiliary}=message.auxiliary;
  return {...message,publication:{...packet,world},auxiliary};
 };
}
