/** Resident original globe surface. This module owns copied geometry/pigments,
 * never World. Its CPU index is built once per geometry adoption; frames only
 * submit the resident indexed batch and the tiny camera uniforms. */
export type GlobeVector=readonly [number,number,number];
export interface GlobeSurfaceTile {id:number;center:GlobeVector}
export interface GlobePatch {positions:Float32Array;colors:Uint8Array;indices:Uint32Array}
export interface GlobeSurfaceInput {
 decorations?:readonly GlobePatch[];
 tiles:readonly GlobeSurfaceTile[];
 radius?:1|100;
 corners:(tileId:number)=>readonly GlobeVector[];
 pigment:(tileId:number)=>readonly [number,number,number];
}
interface SearchNode {min:GlobeVector;max:GlobeVector;start:number;end:number;left?:SearchNode;right?:SearchNode}
export interface GlobeGeometry {
 positions:Float32Array;colors:Uint8Array;edges:Uint8Array;indices:Uint32Array;
 ranges:readonly {start:number;count:number;transparent:boolean}[];
 tileIds:Uint32Array;centres:Float64Array;starts:Uint32Array;counts:Uint8Array;
 searchOrder:Uint32Array;search:SearchNode;pickRadiusSq:number;
}
const finiteVector=(v:GlobeVector,radius=1)=>v.length===3&&Number.isFinite(v[0])&&Number.isFinite(v[1])&&Number.isFinite(v[2])&&Math.abs(Math.hypot(v[0],v[1],v[2])-radius)<1e-5*radius;
/** Corners are supplied by the complete canonical graph. In particular a
 * coverage boundary's retained neighbours cannot reconstruct its polygon. */
export function prepareGlobeGeometry(input:GlobeSurfaceInput):GlobeGeometry {
 const radius=input.radius??1;if(radius!==1&&radius!==100)throw Error('Rayon du globe invalide.');
 const size=input.tiles.length;if(!size||size>1_000_000)throw Error('Géométrie du globe hors capacité.');
 const tileIds=new Uint32Array(size),centres=new Float64Array(size*3),starts=new Uint32Array(size),counts=new Uint8Array(size),ids=new Set<number>();
 let vertices=0,triangles=0,pickRadiusSq=0;
 input.tiles.forEach((tile,row)=>{
  const c=tile.center,length=c.length===3?Math.hypot(c[0],c[1],c[2]):NaN;
  if(!Number.isSafeInteger(tile.id)||tile.id<0||tile.id>0xffffffff||ids.has(tile.id)||c.length!==3||!Number.isFinite(c[0])||!Number.isFinite(c[1])||!Number.isFinite(c[2])||length<=0||length>radius*1.00001)throw Error('Centre de case invalide.');ids.add(tile.id);
  const corners=input.corners(tile.id);if(corners.length<3||corners.length>12||corners.some(c=>!finiteVector(c,radius)))throw Error('Polygone de case invalide.');
  for(const corner of corners){const x=corner[0]-tile.center[0],y=corner[1]-tile.center[1],z=corner[2]-tile.center[2];pickRadiusSq=Math.max(pickRadiusSq,(x*x+y*y+z*z)/(radius*radius));}
  tileIds[row]=tile.id;for(let axis=0;axis<3;axis++)centres[row*3+axis]=tile.center[axis]!/radius;starts[row]=vertices;counts[row]=corners.length;vertices+=corners.length+1;triangles+=corners.length;
 });
 const faceVertices=vertices,faceIndices=triangles*3;const decorations=input.decorations??[];
 for(const patch of decorations){if(patch.positions.length%3||patch.colors.length!==patch.positions.length/3*4||patch.indices.length%3)throw Error('Lot du globe incomplet.');vertices+=patch.positions.length/3;triangles+=patch.indices.length/3;}
 const positions=new Float32Array(vertices*3),colors=new Uint8Array(vertices*4),edges=new Uint8Array(vertices),indices=new Uint32Array(triangles*3);let cursor=0;
 input.tiles.forEach((tile,row)=>{
  const start=starts[row]!,corners=input.corners(tile.id),pigment=input.pigment(tile.id);if(corners.length!==counts[row]||pigment.some(value=>!Number.isInteger(value)||value<0||value>255))throw Error('La géométrie du globe a changé pendant sa préparation.');
  for(let axis=0;axis<3;axis++)positions[start*3+axis]=tile.center[axis]!/radius;edges[start]=255;colors.set(pigment,start*4);colors[start*4+3]=255;
  for(let index=0,count=corners.length;index<count;index++){const corner=corners[index]!,vertex=start+index+1;positions[vertex*3]=corner[0]!/radius;positions[vertex*3+1]=corner[1]!/radius;positions[vertex*3+2]=corner[2]!/radius;colors.set(pigment,vertex*4);colors[vertex*4+3]=255;indices[cursor]=start;indices[cursor+1]=vertex;indices[cursor+2]=start+(index+1)%count+1;cursor+=3;}
 });
 const ranges:{start:number;count:number;transparent:boolean}[]=[{start:0,count:faceIndices,transparent:false}];let extraVertex=faceVertices;
 for(const patch of decorations){positions.set(patch.positions,extraVertex*3);colors.set(patch.colors,extraVertex*4);edges.fill(255,extraVertex,extraVertex+patch.positions.length/3);ranges.push({start:cursor,count:patch.indices.length,transparent:true});for(const index of patch.indices){if(index>=patch.positions.length/3)throw Error('Indice décoratif invalide.');indices[cursor++]=extraVertex+index;}extraVertex+=patch.positions.length/3;}
 const searchOrder=Uint32Array.from({length:size},(_,row)=>row);
 function branch(start:number,end:number,depth=0):SearchNode {
  const min:[number,number,number]=[Infinity,Infinity,Infinity],max:[number,number,number]=[-Infinity,-Infinity,-Infinity];
  for(let index=start;index<end;index++){const row=searchOrder[index]!;for(let axis=0;axis<3;axis++){const value=centres[row*3+axis]!;min[axis]=Math.min(min[axis]!,value);max[axis]=Math.max(max[axis]!,value);}}
  const node:SearchNode={min,max,start,end};if(end-start<=24||depth>=24)return node;
  let axis=0;for(let candidate=1;candidate<3;candidate++)if(max[candidate]!-min[candidate]!>max[axis]!-min[axis]!)axis=candidate;
  const middle=(min[axis]!+max[axis]!)/2;let lo=start,hi=end-1;
  while(lo<=hi){if(centres[searchOrder[lo]!*3+axis]!<middle)lo++;else{const swap=searchOrder[lo]!;searchOrder[lo]=searchOrder[hi]!;searchOrder[hi]=swap;hi--;}}
  if(lo>start&&lo<end){node.left=branch(start,lo,depth+1);node.right=branch(lo,end,depth+1);}return node;
 }
 return {positions,colors,edges,indices,ranges,tileIds,centres,starts,counts,searchOrder,search:branch(0,size),pickRadiusSq:pickRadiusSq+1e-8};
}
function boxDistance(point:GlobeVector,node:SearchNode):number {
 let distance=0;for(let axis=0;axis<3;axis++){const delta=Math.max(node.min[axis]!-point[axis]!,0,point[axis]!-node.max[axis]!);distance+=delta*delta;}return distance;
}
function inside(geometry:GlobeGeometry,row:number,point:GlobeVector):boolean {
 const first=geometry.starts[row]!,count=geometry.counts[row]!,p=geometry.positions,c=geometry.centres;
 for(let i=0;i<count;i++){
  const a=(first+i+1)*3,b=(first+(i+1)%count+1)*3;
  const x=p[a+1]!*p[b+2]!-p[a+2]!*p[b+1]!,y=p[a+2]!*p[b]!-p[a]!*p[b+2]!,z=p[a]!*p[b+1]!-p[a+1]!*p[b]!;
  const side=x*c[row*3]!+y*c[row*3+1]!+z*c[row*3+2]!;
  if((x*point[0]+y*point[1]+z*point[2])*(side<0?-1:1)<-1e-10)return false;
 }
 return true;
}
/** A bounded spatial search of prepared centres, then exact polygon admission.
 * Coverage holes are not replaced by their nearest retained edge tile. */
export function pickGlobeTile(geometry:GlobeGeometry,point:GlobeVector):number|null {
 if(!finiteVector(point))return null;
 let nearest=-1,best=geometry.pickRadiusSq;
 function visit(node:SearchNode){
  if(boxDistance(point,node)>best)return;
  if(node.left&&node.right){const a=boxDistance(point,node.left),b=boxDistance(point,node.right);visit(a<=b?node.left:node.right);visit(a<=b?node.right:node.left);return;}
  for(let index=node.start;index<node.end;index++){
   const row=geometry.searchOrder[index]!,offset=row*3,x=geometry.centres[offset]!-point[0],y=geometry.centres[offset+1]!-point[1],z=geometry.centres[offset+2]!-point[2],distance=x*x+y*y+z*z;
   if(distance<best&&inside(geometry,row,point)){nearest=row;best=distance;}
  }
 }
 visit(geometry.search);return nearest<0?null:geometry.tileIds[nearest]!;
}

const vertexSource=`#version 300 es
in vec3 position;
in vec4 pigment;
in float edge;
uniform vec2 rotation;
uniform vec2 scale;
out vec4 color;
out float border;
out float front;
void main(){
 float cy=cos(rotation.x),sy=sin(rotation.x),cp=cos(rotation.y),sp=sin(rotation.y);
 vec3 yaw=vec3(position.x*cy-position.z*sy,position.y,position.x*sy+position.z*cy);
 vec3 p=vec3(yaw.x,yaw.y*cp-yaw.z*sp,yaw.y*sp+yaw.z*cp);
 gl_Position=vec4(p.xy*scale,-p.z*.99,1.0);color=pigment;border=edge;front=p.z;
}`;
const fragmentSource=`#version 300 es
precision highp float;
in vec4 color;
in float border;
in float front;
out vec4 outputColor;
void main(){
 if(front<0.0)discard;
 float boundary=smoothstep(0.0,max(fwidth(border)*0.7,0.00001),border);
 outputColor=vec4(mix(color.rgb*0.71,color.rgb,boundary),color.a);
}`;
export function createResidentGlobeSurface(canvas:HTMLCanvasElement){
 const gl=canvas.getContext('webgl2',{alpha:true,antialias:true,premultipliedAlpha:false});if(!gl)throw Error('Le globe ne peut pas être affiché sur cet appareil. Le choix de case reste accessible.');
 const shaders:WebGLShader[]=[],programs:WebGLProgram[]=[],vaos:WebGLVertexArrayObject[]=[],buffers:WebGLBuffer[]=[];
 try{
 function shader(type:number,source:string){const shader=gl!.createShader(type);if(!shader)throw Error('Préparation du globe indisponible.');shaders.push(shader);gl!.shaderSource(shader,source);gl!.compileShader(shader);if(!gl!.getShaderParameter(shader,gl!.COMPILE_STATUS)){const reason=gl!.getShaderInfoLog(shader);gl!.deleteShader(shader);throw new Error('Le globe ne peut pas être préparé. Le choix de case reste accessible.',{cause:reason});}return shader;}
 const vertex=shader(gl.VERTEX_SHADER,vertexSource),fragment=shader(gl.FRAGMENT_SHADER,fragmentSource),program=gl.createProgram();if(!program)throw Error('Programme du globe indisponible.');
 programs.push(program);gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);throw Error('Le globe ne peut pas être préparé. Le choix de case reste accessible.');}
 const vao=gl.createVertexArray();if(!vao){gl.deleteProgram(program);throw Error('Lot du globe indisponible.');}vaos.push(vao);gl.bindVertexArray(vao);
 function attribute(name:string,size:number,type:number,normalized:boolean){const buffer=gl!.createBuffer();if(!buffer)throw Error('Buffer du globe indisponible.');buffers.push(buffer);gl!.bindBuffer(gl!.ARRAY_BUFFER,buffer);const location=gl!.getAttribLocation(program!,name);gl!.enableVertexAttribArray(location);gl!.vertexAttribPointer(location,size,type,normalized,0,0);return buffer;}
 const positions=attribute('position',3,gl.FLOAT,false),colors=attribute('pigment',4,gl.UNSIGNED_BYTE,true),edges=attribute('edge',1,gl.UNSIGNED_BYTE,true),indices=gl.createBuffer();if(!indices)throw Error('Indices du globe indisponibles.');buffers.push(indices);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bindVertexArray(null);
 const rotation=gl.getUniformLocation(program,'rotation'),scale=gl.getUniformLocation(program,'scale');let geometry:GlobeGeometry|undefined,disposed=false,lost=false;
 const lostContext=(event:Event)=>{event.preventDefault();lost=true;};canvas.addEventListener('webglcontextlost',lostContext);
 return {
  adopt(next:GlobeGeometry){if(disposed||lost)throw Error('Le contexte du globe est indisponible.');geometry=next;for(const [buffer,data] of [[positions,next.positions],[colors,next.colors],[edges,next.edges]] as const){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);}gl.bindVertexArray(vao);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,next.indices,gl.STATIC_DRAW);gl.bindVertexArray(null);},
  paint(yaw:number,pitch:number,zoom:number){if(disposed||lost)throw Error('Le contexte du globe est indisponible.');if(!geometry)return;const ratio=window.devicePixelRatio||1,width=Math.min(4096,Math.max(1,Math.round(canvas.clientWidth*ratio))),height=Math.min(4096,Math.max(1,Math.round(canvas.clientHeight*ratio)));if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}gl.viewport(0,0,width,height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(program);gl.bindVertexArray(vao);gl.uniform2f(rotation,yaw,pitch);gl.uniform2f(scale,.88*zoom,.88*zoom);for(const range of geometry.ranges){if(!range.count)continue;gl.depthMask(!range.transparent);if(range.transparent){gl.disable(gl.POLYGON_OFFSET_FILL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);}else{gl.disable(gl.BLEND);gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(1,1);}gl.drawElements(gl.TRIANGLES,range.count,gl.UNSIGNED_INT,range.start*4);}gl.depthMask(true);gl.disable(gl.BLEND);gl.disable(gl.POLYGON_OFFSET_FILL);gl.bindVertexArray(null);},
  dispose(){if(disposed)return;disposed=true;canvas.removeEventListener('webglcontextlost',lostContext);for(const buffer of buffers)gl.deleteBuffer(buffer);gl.deleteVertexArray(vao);gl.deleteProgram(program);geometry=undefined;},
 };
 }catch(error){for(const buffer of buffers)gl.deleteBuffer(buffer);for(const vao of vaos)gl.deleteVertexArray(vao);for(const program of programs)gl.deleteProgram(program);for(const shader of shaders)gl.deleteShader(shader);throw error;}
}