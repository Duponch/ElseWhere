import{expect,test}from'vitest';
import{SharedSurfacePreparationRegistry,type SharedSurfacePreparationSnapshot}from'../src/render/surfaces/SharedSurfacePreparation';
import{DEFAULT_GRAPHICS_STYLE_PREFERENCES}from'../src/ui3d/native-preferences';

function snapshot(pixels:number,style:'default'|'origami'='origami',positive=false):SharedSurfacePreparationSnapshot{return{preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style,impasto:positive?1:0,wear:0},world:undefined,reset:false,reason:'initial',epoch:0,renderer:{}as SharedSurfacePreparationSnapshot['renderer'],paintRevision:0,density:{mode:'orthographic',physicalCellPixels:pixels}};}
async function seed(registry:SharedSurfacePreparationRegistry,s:SharedSurfacePreparationSnapshot){const batch=await registry.stage(s,()=>{});try{batch.publish();batch.commit();}finally{batch.dispose();}}

test('independent64/56 and128/112 density gates share one stable interval without masking another later crossing',async()=>{
 const registry=new SharedSurfacePreparationRegistry(),calls:string[]=[],reads={small:0,actor:0};
 registry.registerDensityConsumer({key:'small',maxCellPixels:64,returnCellPixels:56,isEligible:()=>{reads.small++;return true;},onCrossing:(_m,_p,t)=>{calls.push('small:'+t);registry.invalidate();}});
 registry.registerDensityConsumer({key:'qualified-actor-adapter',maxCellPixels:128,returnCellPixels:112,isEligible:()=>{reads.actor++;return true;},onCrossing:(_m,_p,t)=>{calls.push('actor:'+t);registry.invalidate();}});
 try{await seed(registry,snapshot(40));expect(registry.hasDensityConsumers).toBe(true);expect(reads).toEqual({small:1,actor:1});
  for(let i=0;i<1000;i++)expect(registry.observeDensity('orthographic',40+i%20)).toBe(false);expect(calls).toEqual([]);expect(reads).toEqual({small:1,actor:1});
  expect(registry.observeDensity('orthographic',70)).toBe(true);expect(calls).toEqual(['small:source']);expect(registry.observeDensity('orthographic',120)).toBe(false);
  expect(registry.observeDensity('orthographic',130)).toBe(true);expect(calls).toEqual(['small:source','actor:source']);
  expect(registry.observeDensity('orthographic',110)).toBe(true);expect(calls.at(-1)).toBe('actor:screen');expect(registry.observeDensity('orthographic',60)).toBe(false);
  expect(registry.observeDensity('orthographic',55)).toBe(true);expect(calls.at(-1)).toBe('small:screen');expect(reads).toEqual({small:1,actor:1});
 }finally{registry.dispose();}
});

test('initial real density seeds a near Source tier without a second preparation after ready; perspective crossings remain conservative',async()=>{
 const registry=new SharedSurfacePreparationRegistry(),calls:string[]=[];registry.registerDensityConsumer({key:'small',maxCellPixels:64,returnCellPixels:56,isEligible:()=>true,onCrossing:(_m,_p,t)=>{calls.push(t);registry.invalidate();}});
 try{await seed(registry,snapshot(100));expect(registry.dirty).toBe(false);expect(registry.observeDensity('orthographic',100)).toBe(false);expect(registry.observeDensity('orthographic',60)).toBe(false);expect(calls).toEqual([]);
  expect(registry.observeDensity('orthographic',55)).toBe(true);expect(calls).toEqual(['screen']);await seed(registry,snapshot(55));expect(registry.dirty).toBe(false);
  expect(registry.observeDensity('perspective',55)).toBe(true);expect(calls).toEqual(['screen','source']);for(let i=0;i<1000;i++)expect(registry.observeDensity('perspective',55+i)).toBe(false);
 }finally{registry.dispose();}
});

test('Pastel, positive effects and zero admitted consumers do no frame callbacks or eligibility census',async()=>{
 const registry=new SharedSurfacePreparationRegistry();let reads=0,calls=0,eligible=true;const release=registry.registerDensityConsumer({key:'one',maxCellPixels:64,returnCellPixels:56,isEligible:()=>{reads++;return eligible;},onCrossing:()=>{calls++;}});
 try{for(const s of[snapshot(40,'default'),snapshot(40,'origami',true)]){await seed(registry,s);expect(registry.hasDensityConsumers).toBe(false);const before=reads;for(let i=0;i<1000;i++)expect(registry.observeDensity('orthographic',i+1)).toBe(false);expect(reads).toBe(before);}
  eligible=false;await seed(registry,snapshot(40));const before=reads;expect(registry.hasDensityConsumers).toBe(false);for(let i=0;i<1000;i++)registry.observeDensity('orthographic',i+1);expect(reads).toBe(before);expect(calls).toBe(0);release();expect(registry.hasDensityConsumers).toBe(false);
 }finally{registry.dispose();release();}
});
