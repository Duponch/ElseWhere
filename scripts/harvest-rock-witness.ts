type IndexProbe={array:ArrayLike<number>;version?:number};
type MeshProbe={name?:string;visible:boolean;parent?:MeshProbe|null;layers?:{mask:number};geometry:{index:IndexProbe|null;drawRange:{start:number;count:number}}};
interface RockProbe {
 tiles?:readonly {terrain:string}[];rockMask:ArrayLike<number>;slots:ReadonlyMap<number,{slot:number;indices:readonly number[]}>;
 model?:{capacity:number;vertex(slot:number):number;geometry:{getAttribute(name:string):{count:number}}};
 mesh:MeshProbe;chunks:ReadonlyMap<string,{cells:ReadonlySet<number>;mesh:MeshProbe;bodyMesh:MeshProbe}>;
 distantPrepared?:MeshProbe;distantBody?:MeshProbe;distant:boolean;finalPublication:{route:string};
}
interface CompilerProbe {pages:ReadonlyMap<string,{mesh:MeshProbe;choices:readonly {source:MeshProbe;sourceKey:string}[];sources:ReadonlyMap<string,{block:{remap:ArrayLike<number>};offset:number;indices:ArrayLike<number>}>}>}

/** Diagnostic only. Read the actual cell's retained vertex span and active
 * draw indices, including a compiler's remapped page. An obsolete index past
 * drawRange does not count; removed cells can still expose stale geometry,
 * because the span is obtained independently of the current active indices.
 * Injected with toString(), so every runtime dependency is local. */
export function captureRockCellDiagnostic(rocks:RockProbe,cell:number,cameraLayers:number,compiler?:CompilerProbe){
 const record=rocks.slots.get(cell),model=rocks.model;
 const first=record&&model?model.vertex(record.slot):-1;
 const span=model?(model.geometry.getAttribute('position').count-model.vertex(0))/model.capacity:0;
 const belongs=(index:number)=>first>=0&&index>=first&&index<first+span;
 const visible=(mesh:MeshProbe)=>{for(let at:Pick<MeshProbe,'visible'|'parent'>|null|undefined=mesh;at;at=at.parent)if(!at.visible)return false;return true;};
 const retainedCount=(mesh:MeshProbe,contains:(v:number)=>boolean)=>{
  if(!mesh.geometry.index)return 0;
  const {array}=mesh.geometry.index,{start,count}=mesh.geometry.drawRange,end=Math.min(array.length,start+count);let active=0;
  for(let i=start;i<end;i++)if(contains(array[i]!))active++;
  return active;
 };
 const activeCount=(mesh:MeshProbe,contains:(v:number)=>boolean)=>!visible(mesh)||!((mesh.layers?.mask??1)&cameraLayers)?0:retainedCount(mesh,contains);
 const sources:MeshProbe[]=[rocks.mesh,...rocks.distantPrepared?[rocks.distantPrepared]:[],...rocks.distantBody?[rocks.distantBody]:[]];
 for(const chunk of rocks.chunks.values())if(chunk.cells.has(cell)){sources.push(chunk.mesh,chunk.bodyMesh);break;}
 // Three's legitimate Infinity means all remaining indices. JSON would turn
 // it into null and lose that distinction from an invalid/missing witness.
 const direct=sources.map(mesh=>({name:mesh.name,visible:visible(mesh),layers:mesh.layers?.mask??1,retainedCellIndices:retainedCount(mesh,belongs),activeCellIndices:activeCount(mesh,belongs),indexVersion:mesh.geometry.index?.version,
  drawRange:{start:mesh.geometry.drawRange.start,count:mesh.geometry.drawRange.count===Infinity?Math.max(0,(mesh.geometry.index?.array.length??0)-mesh.geometry.drawRange.start):mesh.geometry.drawRange.count,allIndices:mesh.geometry.drawRange.count===Infinity}}));
 const compiledSources=new Set<MeshProbe>();
 const compiled:{name:string|undefined;source:string|undefined;activeCellIndices:number;sourceCellIndices:number;indexVersion:number|undefined}[]=[];
 for(const page of compiler?.pages.values()??[])for(const choice of page.choices)if(sources.includes(choice.source)){
  const held=page.sources.get(choice.sourceKey);if(!held)continue;
  compiledSources.add(choice.source);
  const mapped=new Set<number>();for(let vertex=first;first>=0&&vertex<first+span;vertex++){const target=held.block.remap[vertex];if(target!==undefined&&target>=0)mapped.add(held.offset+target);}
  let sourceCellIndices=0;for(let i=0;i<held.indices.length;i++)if(mapped.has(held.indices[i]!))sourceCellIndices++;
  compiled.push({name:page.mesh.name,source:choice.source.name,activeCellIndices:activeCount(page.mesh,v=>mapped.has(v)),sourceCellIndices,indexVersion:page.mesh.geometry.index?.version});
 }
 const inventoryComplete=sources.every((mesh,i)=>!direct[i]!.visible||direct[i]!.layers!==0||direct[i]!.retainedCellIndices===0||compiledSources.has(mesh));
 return {cell,terrain:rocks.tiles?.[cell]?.terrain,mask:rocks.rockMask[cell],slot:record?.slot,vertexFirst:first,vertexSpan:span,canonicalActiveIndices:record?.indices.length??0,inventoryComplete,
  distant:rocks.distant,route:rocks.finalPublication.route,direct,compiled,activeSubmittedCellIndices:direct.reduce((n,m)=>n+m.activeCellIndices,0)+compiled.reduce((n,m)=>n+m.activeCellIndices,0)};
}
