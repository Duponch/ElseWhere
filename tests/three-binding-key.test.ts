import {readFileSync,mkdtempSync,mkdirSync,rmSync,rmdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {describe,expect,it,vi} from 'vitest';
import {threeBindingKey,transformThreeBindingKey} from '../scripts/vite-three-binding-key.ts';

const file=createRequire(import.meta.url).resolve('three/webgpu');
const original=readFileSync(file,'utf8');
const plugin=threeBindingKey();
const transformed=plugin.transform(original,file)!.code;
type Group={name:string;bindings:object[]};
type Update=(this:object,group:Group,all:Group[])=>void;

function distributedMethod(source:string):Update {
  const classIndex=source.indexOf('class Bindings extends DataMap {');
  const start=source.indexOf('_update( bindGroup, bindings ) {',classIndex);
  const end=source.indexOf('\n\t}\n\n}',start);
  const helperStart=source.indexOf('let elsewhereFreeBindingIds');
  const helpers=helperStart<0?'':source.slice(helperStart,classIndex);
  return Function('AttributeType',helpers+'\nreturn ({'+source.slice(start,end+3)+'})._update;')({STORAGE:1,INDIRECT:2}) as Update;
}
const native=distributedMethod(original);
const optimized=distributedMethod(transformed);

type Scenario='stable'|'dynamic'|'external'|'default'|'nested'|'coercion'|'throw'|'symbol'|'bigint'|'null'|'undefined';

function observe(update:Update,size:number,scenario:Scenario){
  const events:unknown[]=[];
  const outer:Group={name:'outer',bindings:[]},inner:Group={name:'inner',bindings:[]};
  const bindingData=new Map<object,object>(), textureState=new Map<object,object>();
  let nesting=false;
  let sequence=1000;
  const host={
    backend:{get:(object:object)=>bindingData.get(object),
      updateBindings:(group:Group,all:Group[],key:string,version:number)=>events.push([group.name,group===all[0],key,version]),
      updateBinding:()=>events.push('uniform'),generateMipmaps:()=>events.push('mipmap')},
    attributes:{update:(_:object,type:number)=>events.push(['attribute',type])},
    nodes:{updateGroup:(binding:{skip?:boolean})=>!binding.skip},
    textures:{get:(object:object)=>textureState.get(object),updateTexture:()=>events.push('texture'),
      updateSampler:()=>17,needsMipmaps:()=>true},
    get:()=>({needsMipmap:true})
  };
  function nested() {
    nesting=true;
    try{update.call(host,inner,[inner]);}finally{nesting=false;}
    sequence+=77;
  }
  function id(i:number):unknown {
    events.push(['id',nesting,i,sequence]);
    if(!nesting&&i===7){
      if(scenario==='nested')nested();
      if(scenario==='throw')throw Error('interrupted getter');
      if(scenario==='coercion')return {[Symbol.toPrimitive](hint:string){events.push(hint);nested();return 'a,b';}};
      if(scenario==='symbol')return Symbol('texture');
      if(scenario==='bigint')return 2n**55n;
      if(scenario==='null')return null;
      if(scenario==='undefined')return undefined;
    }
    return [sequence+(nesting?2**40:0),-0,NaN,-23.125,Infinity][i%5];
  }
  function fill(group:Group,count:number) {
    const stable=scenario==='stable';
    for(let i=0;i<count;i++){
      if(i%3===0){
        const attribute={get id(){return id(i);},isIndirectStorageBufferAttribute:true};
        const binding={isStorageBuffer:true,attribute,skip:scenario==='dynamic'&&i%4===0};
        bindingData.set(binding,{attribute:stable?attribute:undefined});group.bindings.push(binding);
      }else{
        const texture={get id(){return id(i);},get version(){events.push('version');sequence++;return i+1;},
          isStorageTexture:true,mipmapsAutoUpdate:true};
        const binding={isSampledTexture:true,texture,generation:stable?7:0,store:i%2===0,update:()=>!stable};
        bindingData.set(texture,{externalTexture:scenario==='external'&&i===1?null:undefined});
        textureState.set(texture,{generation:7,isDefaultTexture:scenario==='default'&&i===2,bindGroups:new Set()});
        group.bindings.push(binding);
      }
    }
    group.bindings.push({isUniformBuffer:true,isBuffer:true,update:()=>true,updateRanges:[1],clearUpdateRanges:()=>events.push('clear')});
    group.bindings.push({isSampler:true,update:()=>true,samplerKey:stable?17:undefined});
  }
  fill(outer,size);fill(inner,135);
  try{update.call(host,outer,[outer]);}catch(error){events.push((error as Error).message);}
  return events;
}

describe('Three WebGPU binding keys',()=>{
  it('retains the distributed update call order, data and errors as the scene changes',()=>{
    for(const size of [0,1,2,3,5,16,129,130,131]) {
      for(const scenario of ['stable','dynamic','external','default','nested','coercion','throw','symbol','bigint','null','undefined'] as const){
        expect(observe(optimized,size,scenario),size+' '+scenario).toEqual(observe(native,size,scenario));
      }
    }
  });
  it('rejects unknown package versions and any change to the pinned method',()=>{
    expect(()=>transformThreeBindingKey(original,file,'0.187.0')).toThrow('Review the distributed Bindings._update');
    const changed=original.replace("cacheKey += texture.id + ',';","cacheKey += texture.uuid + ',';");
    expect(()=>transformThreeBindingKey(changed,file,'0.186.0')).toThrow('Review the distributed Bindings._update');
    expect(()=>transformThreeBindingKey(original+'\n',file,'0.186.0')).toThrow('distribution SHA-256');
    expect(plugin.transform(original,file+'?raw')).toBeUndefined();
    expect(plugin.transform(original,file.replace('three.webgpu.js','three.module.js'))).toBeUndefined();
  });
  it('uses the same measured implementation for the resolved module and its Vite file URLs',()=>{
    expect(createHash('sha256').update(transformed).digest('hex')).toBe('b482d4be146783ece1ce6234cbe62c3219382fddebf376f83cd3fed3993e83ed');
    const pathname=file.replaceAll('\\','/');
    const ids=[pathname,'/@fs/'+pathname+'?v=Ab0c23'];
    if(process.platform==='win32')ids.push('/'+pathname,pathname.toUpperCase(),file);
    for(const id of ids){
      const result=plugin.transform(original,id)!;
      expect(result.code===transformed).toBe(true);
      expect(result.map.sources).toEqual([id]);
    }
    expect(plugin.transform(transformed,file)).toBeUndefined();
    for(const suffix of ['?raw','?url','?v=123&raw','#worker'])expect(plugin.transform(original,file+suffix)).toBeUndefined();
  });
  it('leaves unknown distributions and source untouched and warns once across plugin instances',()=>{
    const warn=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const directory=mkdtempSync(join(tmpdir(),'elsewhere-three-'));
    try{
      const entry=join(directory,'build','three.webgpu.js'),manifest=join(directory,'package.json');
      mkdirSync(join(directory,'build'));
      // A changed package entry, unparseable or missing manifest, unexpected
      // version and the two digest mismatches all leave Vite's input unchanged.
      expect(threeBindingKey(()=>join(directory,'next.js')).transform(original,entry)).toBeUndefined();
      expect(threeBindingKey(()=>entry).transform(original,entry)).toBeUndefined();
      for(const json of ['not json','{"name":"another","version":"0.186.0"}','{"name":"three","version":"0.187.0"}']){
        writeFileSync(manifest,json);
        expect(threeBindingKey(()=>entry).transform(original,entry)).toBeUndefined();
      }
      for(const source of [original+'\n',original.replace("cacheKey += texture.id + ',';","cacheKey += texture.uuid + ',';")]){
        expect(plugin.transform(source,file)).toBeUndefined();
      }
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain('Using Three.js unchanged');
    }finally{
      warn.mockRestore();
      rmSync(join(directory,'package.json'),{force:true});
      rmdirSync(join(directory,'build'));rmdirSync(directory);
    }
  });
});
