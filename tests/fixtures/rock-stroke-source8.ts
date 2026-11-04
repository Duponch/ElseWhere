/** Frozen eight-page Source oracle for storage/row/geometry contracts only.
 * Original runtime Source SHA256 3ab59ce426f2045ff8d76e8703099a064f5c8e30a530fb7d692486d724dfadf8.
 * Imports rebased for this test fixture; scalar allocation/records unchanged.
 * Runtime modules must never import this reference owner. */
/** Sparse mutable cliff strokes, using the exact Source stock producer. One
 * small initial page and at most seven bounded pages serve the same material;
 * neither texture changes nor ordinary frames prepare or repack this data. */
import * as THREE from 'three/webgpu';
import {Fn,If,int,storage,uniform,vec4} from 'three/tsl';
import {MAX_EXTENDED_MAP_SIZE} from '../../src/sim/map-config';
import {createOrigamiBrushGeometry} from '../../src/render/origami/brush-geometry';
import {RockSurfaceModel,ROCK_SURFACE_UV,ROCK_SURFACE_FACES,ROCK_SLAB_FACES,ROCK_SLAB_INDICES} from '../../src/render/models/RockSurfaceModel';
import {FACE_STROKE_EDGE_ROWS,FACE_STROKE_EDGE_FLOATS,classifyFaceStrokeGate,writeFaceStrokeEdgeRecord,type FaceStrokeData} from '../../src/render/surfaces/FaceStrokeTable';

const PAGES=8,FIRST_PAGE_ROWS=65536,MAX_PAGE_ROWS=8388608,FACE_ROWS=4,EDGE_CAPACITY=4,EDGE_BLOCK_ROWS=EDGE_CAPACITY*FACE_STROKE_EDGE_ROWS;
interface Page {attribute:THREE.StorageBufferAttribute;allocated:boolean;rows:number}
export interface RockStrokePatch {readonly faces:readonly number[];readonly records:ReadonlyMap<number,Float32Array>}
export interface RockStrokeNeighbour {readonly slot:number;readonly count:number}
const power2=(value:number)=>2**Math.ceil(Math.log2(Math.max(1,value)));

export class RockStrokeTable implements FaceStrokeData {
 private pages:Page[]=Array.from({length:PAGES},()=>({attribute:new THREE.StorageBufferAttribute(new Float32Array(4),4),allocated:false,rows:1}));
 private readonly nodes=this.pages.map(page=>storage(page.attribute,'vec4',0).toReadOnly());
 private readonly starts=Array.from({length:PAGES},()=>uniform(0));private readonly ends=Array.from({length:PAGES},()=>uniform(0));
 private readonly retired:THREE.StorageBufferAttribute[]=[];
 private readonly faceIds=new Map<number,readonly number[]>();private readonly reservedFaces=new Set<number>();private readonly blocks=new Map<number,{row:number;count:number}>();private readonly free:number[]=[];
 private slabFaces:readonly number[]=[];private cursor=0;private facesSpan=0;private edges=0;private closed=false;private width=0;private height=0;private readonly dirty=new Set<number>();
 readonly stats={preparedCells:0,preparedSlabs:0,patches:0,pageAllocations:0,changedRows:0};
 readonly node=this.nodes[0]!;
 get buffer():THREE.StorageBufferAttribute{return this.pages[0]!.attribute;}
 get faceCount():number{return this.facesSpan;}
 get edgeCount():number{return this.edges;}
 readonly maxEdgesPerFace=EDGE_CAPACITY;
 get cpuBytes():number{return[...this.pages.map(page=>page.attribute),...this.retired].reduce((n,a)=>n+a.array.byteLength,0);}
 /** Inspection only: material/frames never assemble a contiguous copy. */
 get values():Float32Array{this.assertCurrent();const result=new Float32Array(this.cursor*4);for(let page=0;page<PAGES;page++){const first=this.starts[page]!.value,last=Math.min(this.cursor,this.ends[page]!.value),data=this.pages[page]!;if(data.allocated&&last>first)result.set(data.attribute.array.subarray(0,(last-first)*4),first*4);}return result;}
 readonly readRow=(row:THREE.Node<'int'>):THREE.Node<'vec4'>=>Fn(()=>{const result=vec4(0).toVar(),select=If(row.lessThan(int(this.ends[0]!)),()=>{result.assign(this.nodes[0]!.element(row));});for(let page=1;page<PAGES;page++)select.ElseIf(row.lessThan(int(this.ends[page]!)),()=>{result.assign(this.nodes[page]!.element(row.sub(int(this.starts[page]!))));});return result;})();
 assertCurrent():void{if(this.closed)throw Error('Rock stroke owner retired');}
 reset(width:number,height:number):void{
  this.assertCurrent();if(!Number.isSafeInteger(width)||width<1||width>MAX_EXTENDED_MAP_SIZE||!Number.isSafeInteger(height)||height<1||height>MAX_EXTENDED_MAP_SIZE)throw Error('Actual supported map bounds required');
  // For N occupied cells, exposed cardinal sides S <= min(4N,
  // 4(cells-N)+mapBoundary). At most2N+3S faces carry edges. All possible
  // cell headers + four-edge blocks therefore fit308*cells+108*boundary rows.
  // The larger325 coefficient leaves explicit headroom without truncation.
  const upperRows=325*width*height+216*(width+height)+1024,laterRows=Math.max(FIRST_PAGE_ROWS,power2(Math.ceil((upperRows-FIRST_PAGE_ROWS)/(PAGES-1))));
  if(laterRows>MAX_PAGE_ROWS)throw Error('Supported map exceeded its derived rock storage page bound');
  this.width=width;this.height=height;let offset=0;
  for(let page=0;page<PAGES;page++){
   const required=page===0?FIRST_PAGE_ROWS:laterRows,old=this.pages[page]!,rows=Math.max(required,old.rows);this.starts[page]!.value=offset;this.ends[page]!.value=offset+rows;offset+=rows;
   // Capacity is a per-renderer high-water mark, independent of map shape.
   // Reusing larger pages prevents32→64→32 or repeated save loads from
   // retaining another complete allocation at every world reset. Growth is
   // geometric and bounded; small worlds never allocate the maximum page.
   if(old.rows>=required){if(old.allocated){old.attribute.array.fill(0);old.attribute.clearUpdateRanges();old.attribute.addUpdateRange(0,old.attribute.array.length);this.dirty.add(page);}continue;}
   this.retired.push(old.attribute);const attribute=new THREE.StorageBufferAttribute(new Float32Array(4),4);this.pages[page]={attribute,allocated:false,rows};this.nodes[page]!.value=attribute;
  }
  this.faceIds.clear();this.reservedFaces.clear();this.blocks.clear();this.free.length=0;this.cursor=0;this.facesSpan=0;this.edges=0;this.slabFaces=this.reserveFaces(ROCK_SLAB_FACES);
 }
 private reserveRows(rows:number):number{const first=Math.ceil(this.cursor/4)*4,end=first+rows;if(!Number.isSafeInteger(end)||end>this.ends[PAGES-1]!.value||end>=2**26)throw Error('Rock sparse storage exceeded its actual map admission bound');this.cursor=end;return first;}
 private reserveFaces(count:number):readonly number[]{const first=this.reserveRows(count*FACE_ROWS),ids=Array.from({length:count},(_,i)=>(first+i*FACE_ROWS)/2);for(const id of ids){if(Math.fround(id)!==id)throw Error('Rock face address lost exact Float32 representation');this.reservedFaces.add(id);}this.facesSpan=Math.max(this.facesSpan,ids.at(-1)!+1);return Object.freeze(ids);}
 bindModel(model:RockSurfaceModel):void{this.assertCurrent();if(model.width!==this.width||model.height!==this.height)throw Error('Actual rock model/map bounds disagree');model.setSlabPaintFaces(this.slabFaces);for(const[slot,ids]of this.faceIds)if(slot<model.capacity)model.setPaintFaces(slot,ids);}
 bindCell(model:RockSurfaceModel,slot:number):void{this.assertCurrent();let ids=this.faceIds.get(slot);if(!ids){ids=this.reserveFaces(ROCK_SURFACE_FACES);this.faceIds.set(slot,ids);}model.setPaintFaces(slot,ids);}
 private pageAt(row:number):number{for(let page=0;page<PAGES;page++)if(row>=this.starts[page]!.value&&row<this.ends[page]!.value)return page;throw Error('Rock scalar row outside its admitted pages');}
 private data(page:number):Float32Array{const entry=this.pages[page]!;if(!entry.allocated){this.retired.push(entry.attribute);entry.attribute=new THREE.StorageBufferAttribute(new Float32Array(entry.rows*4),4);entry.allocated=true;this.nodes[page]!.value=entry.attribute;this.stats.pageAllocations++;}return entry.attribute.array as Float32Array;}
 private write(firstRow:number,values:Float32Array):void{
  let source=0,row=firstRow;while(source<values.length){const page=this.pageAt(row),first=row-this.starts[page]!.value,data=this.data(page),length=Math.min(values.length-source,data.length-first*4);let changed=false;for(let i=0;i<length;i++)if(!Object.is(data[first*4+i],values[source+i])){changed=true;break;}if(changed){data.set(values.subarray(source,source+length),first*4);const attribute=this.pages[page]!.attribute;attribute.addUpdateRange(first*4,length);this.dirty.add(page);this.stats.changedRows+=length/4;}source+=length;row+=length/4;}
 }
 prepareSlab(model:RockSurfaceModel):RockStrokePatch{model.stock.clearGroups();model.stock.addGroup(0,ROCK_SLAB_INDICES,0);this.stats.preparedSlabs++;return this.collect(model,this.slabFaces,local=>local);}
 prepareCell(model:RockSurfaceModel,slot:number,neighbours:readonly RockStrokeNeighbour[]):RockStrokePatch{
  const ids=this.faceIds.get(slot);if(!ids)throw Error('Rock slot must be admitted before its dirty writer');model.stock.clearGroups();for(const neighbour of [...neighbours].sort((a,b)=>a.slot-b.slot))if(neighbour.count)model.stock.addGroup(model.stockOffset(neighbour.slot),neighbour.count,0);this.stats.preparedCells++;
  // Source's empty group list means the WHOLE index. A completely removed
  // neighbourhood instead publishes zero edges without inspecting old slots.
  return model.stock.groups.length?this.collect(model,ids,local=>model.face(slot)+local):{faces:ids,records:new Map()};
 }
 private collect(model:RockSurfaceModel,faces:readonly number[],logicalFace:(local:number)=>number):RockStrokePatch{
  const stock=createOrigamiBrushGeometry(model.stock),records=new Map<number,number[]>(),lookup=new Map(faces.map((id,local)=>[id,local]));
  try{
   const tag=stock.getAttribute(ROCK_SURFACE_UV),base=stock.userData.referenceBrushBasePositions as Float32Array;
   for(let first=0;first<tag.count;first+=6){const id=tag.getZ(first),local=lookup.get(id);if(local===undefined)continue;if(Array.from({length:6},(_,i)=>tag.getZ(first+i)).some(value=>value!==id))throw Error('Source rock strip crossed a real face');const endpoints=[new THREE.Vector3().fromArray(base,first*3),new THREE.Vector3().fromArray(base,(first+4)*3)]as const,project=model.projector(logicalFace(local),endpoints),values=new Float32Array(FACE_STROKE_EDGE_FLOATS);writeFaceStrokeEdgeRecord(values,0,stock,first,project);const destination=records.get(id)??[];destination.push(...values);records.set(id,destination);}
   return{faces,records:new Map([...records].map(([id,values])=>[id,new Float32Array(values)]))};
  }finally{stock.dispose();}
 }
 commit(patches:readonly RockStrokePatch[]):void{
  this.assertCurrent();const touched=new Map<number,Float32Array>();for(const patch of patches)for(const face of patch.faces){if(!this.reservedFaces.has(face)||touched.has(face))throw Error('Rock patch has an unowned/duplicate face');const records=patch.records.get(face)??new Float32Array(0);if(records.length%FACE_STROKE_EDGE_FLOATS||records.length>EDGE_CAPACITY*FACE_STROKE_EDGE_FLOATS||records.some(value=>!Number.isFinite(value)))throw Error('Source rock face exceeded its actual four-edge bound');touched.set(face,records);}
  // Retire vanished faces before admitting new ones, avoiding a temporary
  // whole-map doubling during excavation/restoration of disjoint regions.
  for(const[face,records]of touched)if(!records.length){const previous=this.blocks.get(face);if(previous){this.edges-=previous.count;this.free.push(previous.row);this.blocks.delete(face);}}
  for(const[face,records]of touched){
   const count=records.length/FACE_STROKE_EDGE_FLOATS;let block=this.blocks.get(face);if(count&&!block){block={row:this.free.pop()??this.reserveRows(EDGE_BLOCK_ROWS),count:0};this.blocks.set(face,block);}if(block){this.edges+=count-block.count;block.count=count;if(Math.fround(block.row)!==block.row)throw Error('Rock edge address lost exact Float32 representation');this.write(block.row,records);}
   const gate=classifyFaceStrokeGate(records,[0,0,1,1]);let inset=0;for(let edge=0;edge<count;edge++)for(let v=0;v<6;v++){const p=edge*FACE_STROKE_EDGE_FLOATS+v*6;inset=Math.max(inset,5*(Math.abs(records[p+2]!)+Math.abs(records[p+4]!)),5*(Math.abs(records[p+3]!)+Math.abs(records[p+5]!)));}
   // Keep the original maximum5x-width/rough1 bound. Its existing epsilon is
   // enlarged, never consumed, by any measured Source base-line deviation.
   this.write(face*2,new Float32Array([block?.row??0,count,0,0,1,1,inset+gate.deviation+2e-5,gate.kind]));
  }
  for(const page of this.dirty)this.pages[page]!.attribute.needsUpdate=true;this.dirty.clear();this.stats.patches+=patches.length;
 }
 snapshot(){return{faceSpan:this.facesSpan,actualFaces:this.reservedFaces.size,edges:this.edges,rows:this.cursor,pages:this.pages.filter(page=>page.allocated).map(page=>page.attribute.array.byteLength),cpuBytes:this.cpuBytes,retiredBuffers:this.retired.length};}
 /** Terminal ownership only, with real rendered geometry candidates supplied
  * by the producer AND its435 owner before either disposes those geometries. */
 attachGpuRetirement(geometries:Iterable<THREE.BufferGeometry>):void{this.assertCurrent();const candidates=[...new Set(geometries)];for(const attribute of new Set([...this.pages.map(page=>page.attribute),...this.retired]))for(const geometry of candidates)geometry.setAttribute(`uvRockStrokeGpuRetirement${attribute.id}`,attribute);}
 dispose():void{if(this.closed)return;this.closed=true;for(const node of this.nodes)node.dispose();this.faceIds.clear();this.reservedFaces.clear();this.blocks.clear();this.free.length=0;this.retired.length=0;}
}
