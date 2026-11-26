import {expect,test} from 'vitest';
import {captureRockCellDiagnostic} from '../scripts/harvest-rock-witness';

function fixture(){
 const mesh=(name:string,indices:number[],count=indices.length)=>({name,visible:true,layers:{mask:1},geometry:{index:{array:Uint32Array.from(indices),version:1},drawRange:{start:0,count}}});
 const source=mesh('rock cell',[24,25,26]),hidden=mesh('hidden rock',[]);hidden.visible=false;
 const rocks={tiles:[{terrain:'rock'}],rockMask:new Uint8Array([1]),slots:new Map([[0,{slot:0,indices:[24,25,26]}]]),
  model:{capacity:1,vertex:(_slot:number)=>24,geometry:{getAttribute:(_name:string)=>({count:70})}},
  mesh:hidden,chunks:new Map([['0:0',{cells:new Set([0]),mesh:source,bodyMesh:hidden}]]),distant:false,finalPublication:{route:'source'}};
 return {rocks,source,mesh};
}

test('rock occupancy witness reads active cell geometry and ignores stale indices outside the draw range',()=>{
 const {rocks,source}=fixture();expect(captureRockCellDiagnostic(rocks,0,1).activeSubmittedCellIndices).toBe(3);
 source.geometry.drawRange.count=Infinity;const full=captureRockCellDiagnostic(rocks,0,1);expect(full.activeSubmittedCellIndices).toBe(3);expect(full.direct.find(row=>row.name==='rock cell')!.drawRange).toEqual({start:0,count:3,allIndices:true});
 source.geometry.drawRange.count=0;expect(captureRockCellDiagnostic(rocks,0,1).activeSubmittedCellIndices).toBe(0);
 source.geometry.drawRange.count=3;expect(captureRockCellDiagnostic(rocks,0,2).activeSubmittedCellIndices).toBe(0);
 source.visible=false;expect(captureRockCellDiagnostic(rocks,0,1).activeSubmittedCellIndices).toBe(0);
});

test('a removed cell cannot hide stale submitted geometry by clearing its canonical active list',()=>{
 const {rocks}=fixture();rocks.tiles[0]!.terrain='rough-stone';rocks.rockMask[0]=0;rocks.slots.get(0)!.indices=[];
 const witness=captureRockCellDiagnostic(rocks,0,1);
 expect(witness.canonicalActiveIndices).toBe(0);expect(witness.terrain).toBe('rough-stone');expect(witness.activeSubmittedCellIndices).toBe(3);
});

test('compiler-suppressed sources are witnessed through actual remapped page indices',()=>{
 const {rocks,source,mesh}=fixture();source.layers.mask=0;
 expect(captureRockCellDiagnostic(rocks,0,1).inventoryComplete).toBe(false);
 const remap=new Int32Array(70).fill(-1);remap[24]=4;remap[25]=5;remap[26]=6;
 const page=mesh('compiled rock',[104,105,106,999,999,999],3);
 const compiler={pages:new Map([['p',{mesh:page,choices:[{source,sourceKey:'cell'}],sources:new Map([['cell',{block:{remap},offset:100,indices:Uint32Array.from([104,105,106])}]])}]])};
 const witness=captureRockCellDiagnostic(rocks,0,1,compiler);
 expect(witness.inventoryComplete).toBe(true);
 expect(witness.direct.every(row=>row.activeCellIndices===0)).toBe(true);expect(witness.compiled[0]!.sourceCellIndices).toBe(3);expect(witness.activeSubmittedCellIndices).toBe(3);
 page.geometry.drawRange.count=0;expect(captureRockCellDiagnostic(rocks,0,1,compiler).activeSubmittedCellIndices).toBe(0);
});
