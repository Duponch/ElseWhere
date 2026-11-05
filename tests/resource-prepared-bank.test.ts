/** Copy/address/lifetime orchestration only; fixture bytes are not pixels. */
import{expect,test,vi}from'vitest';
import * as THREE from'three/webgpu';
import{resourceBankAddresses,prepareResourceBank}from'../src/render/surfaces/ResourcePreparedBank';
import{compilePreparedSurfaceAddresses}from'../src/render/origami/baked/surfaces/PreparedSurfaceAddressBook';
import type{PreparedSurfacePlan}from'../src/render/origami/baked/surfaces/PreparedSurfaceTypes';
import type{TreeAssetCatalog}from'../src/render/origami/baked/trees/types';

function tree(){const texture=new THREE.DataArrayTexture(new Uint8Array(0),2048,2048,2);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;let valid=true;const catalog:TreeAssetCatalog={revision:7,paintKey:'TEST-paint',texture,pageCount:2,modelKeys:['TEST-actual-model'],slots:Array.from({length:64},(_,i)=>({layer:i===3?1:0,paletteBaked:i===3})),assertCurrent(){if(!valid)throw Error('TEST tree lease retired');}};return{catalog,texture,expire(){valid=false;}};}
test('common lookup keeps every generic rectangle bit and offsets only layers before appending the64 actual tree slots',()=>{
 const bank=tree(),plan={variants:[{}],tiles:[{variant:0,face:9,page:0,rawBounds:[0,0,1,1],content:{x:16,y:24,width:64,height:48}}],pages:[{format:'bi',bodyLayer:0,inkLayer:1}],size:2048,assertCurrent(){}}as unknown as PreparedSurfacePlan;
 try{const original=compilePreparedSurfaceAddresses(plan,[7]).data,next=resourceBankAddresses(original,bank.catalog);expect(next[0]).toBe(original[0]);expect(next[1]).toBe(original.length/4);for(let row=1;row<original.length/4;row+=2)if(original[row*4]!>0){expect([...next.subarray(row*4,row*4+6)]).toEqual([...original.subarray(row*4,row*4+6)]);expect(next[(row+1)*4+2]).toBe(original[(row+1)*4+2]!+2);expect(next[(row+1)*4+3]).toBe(original[(row+1)*4+3]!+2);}const at=(original.length/4+3)*4;expect([...next.subarray(at,at+4)]).toEqual([1,1,0,0]);}
 finally{bank.texture.dispose();}
});
test('tree-only demand borrows the real ready bank without preparation/allocation/retirement and retains its lifetime guard',async()=>{
 const bank=tree(),retired=vi.fn(),prepare=vi.fn(async()=>{throw Error('Tree-only must not prepare generic pages');}),renderer={}as THREE.WebGPURenderer,plan={size:2048,layers:0,pages:[]}as unknown as PreparedSurfacePlan;bank.texture.addEventListener('dispose',retired);
 const result=await prepareResourceBank(renderer,plan,bank.catalog,()=>{},prepare,()=>{throw Error('No failed cleanup can occur here');});
 try{expect(result.texture).toBe(bank.texture);expect(result.gpuBytes).toBe(0);expect(result.stats).toMatchObject({borrowedExistingTreeBank:true,extraAllocation:0});expect(prepare).not.toHaveBeenCalled();expect(()=>result.assertCurrent()).not.toThrow();bank.expire();expect(()=>result.assertCurrent()).toThrow('TEST tree lease retired');result.dispose();expect(retired).not.toHaveBeenCalled();}
 finally{result.dispose();bank.texture.dispose();}
});
