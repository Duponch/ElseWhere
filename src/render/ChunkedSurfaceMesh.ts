import * as THREE from 'three/webgpu';
import {MutableFaceStrokeBank,type FaceStrokeBankRegion} from './surfaces/MutableFaceStrokeBank';
import {SURFACE_STROKE_UV} from './surfaces/NaturalSurfaceModels';
import {compileWorldSurfaceStrokes} from './surfaces/WorldSurfaceStrokes';

/** Non-indexed triangle soup of one region: one entry per corner. */
export interface SurfaceSoup {
  triangles:number;
  readonly position:number[];
  /** Planar face coordinates of the contour table (two per corner). */
  readonly faceUv:number[];
  /** Contour discriminant (one per corner): a change draws a line. */
  readonly partition:number[];
  /** Other vertex fields, by attribute name. */
  readonly fields:Readonly<Record<string,number[]>>;
}
export const emptySurfaceSoup=(fields:readonly string[]):SurfaceSoup=>({triangles:0,position:[],faceUv:[],partition:[],fields:Object.fromEntries(fields.map(name=>[name,[]]))});

type Chunk={key:number;triangles:number;data:Record<string,Float32Array>;region:FaceStrokeBankRegion|undefined;start:number;capacity:number};
const capacityFor=(triangles:number)=>Math.max(triangles+16,Math.ceil(triangles*1.25));

/** A whole-map surface (linked walls, roofs) drawn as ONE resident mesh.
 * Each region owns a reserved range of the shared buffers and a region of
 * the contour bank; replacing a region rewrites only its range, and the
 * buffers are laid out again only when a region outgrows its reservation.
 * Unused reserved corners collapse to a point below the map: zero area, never
 * rasterised, in colour or shadow passes. Nothing runs per frame. */
export class ChunkedSurfaceMesh {
  readonly bank=new MutableFaceStrokeBank();
  geometry:THREE.BufferGeometry;
  private readonly chunks=new Map<number,Chunk>();
  private relayout=false;
  readonly stats={rewritten:0,layouts:0};

  /** `fields`: vertex attribute name -> item size (position and the stroke
   * address are implicit). `bounds`: the drawn extent, for culling. */
  constructor(private readonly fields:Readonly<Record<string,number>>,private bounds:THREE.Sphere=new THREE.Sphere()){this.geometry=this.allocate(0);}

  private allocate(triangles:number):THREE.BufferGeometry {
    const geometry=new THREE.BufferGeometry(),vertices=triangles*3;
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(vertices*3),3));
    for(const [name,size] of Object.entries(this.fields))geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(vertices*size),size));
    geometry.setAttribute(SURFACE_STROKE_UV,new THREE.BufferAttribute(new Float32Array(vertices*3),3));
    geometry.setDrawRange(0,vertices);geometry.boundingSphere=this.bounds.clone();
    return geometry;
  }
  setBounds(bounds:THREE.Sphere):void {this.bounds=bounds.clone();this.geometry.boundingSphere=bounds.clone();}

  get triangles():number {let n=0;for(const chunk of this.chunks.values())n+=chunk.triangles;return n;}
  get reservedTriangles():number {return this.geometry.getAttribute('position').count/3;}
  get regions():number {return this.chunks.size;}
  has(key:number):boolean {return this.chunks.has(key);}
  keys():number[] {return [...this.chunks.keys()];}

  /** Corner data with contour addresses, for a soup and its bank offset. */
  static data(soup:SurfaceSoup,fields:Readonly<Record<string,number>>,faceOffset:number):Record<string,Float32Array> {
    const n=soup.triangles*3,address=new Float32Array(n*3);
    for(let v=0;v<n;v++){address[v*3]=soup.faceUv[v*2]!;address[v*3+1]=soup.faceUv[v*2+1]!;address[v*3+2]=faceOffset+Math.floor(v/3);}
    const data:Record<string,Float32Array>={position:Float32Array.from(soup.position),[SURFACE_STROKE_UV]:address};
    for(const name of Object.keys(fields))data[name]=Float32Array.from(soup.fields[name]!);
    return data;
  }

  /** Replace one region. The context soup takes part in contour detection
   * only (the ring around the region), so runs crossing a border keep one
   * continuous contour. An empty drawn soup removes the region. */
  set(key:number,drawn:SurfaceSoup,context?:SurfaceSoup):void {
    const old=this.chunks.get(key);
    if(!drawn.triangles){if(old){this.chunks.delete(key);old.region?.release();this.write({...old,triangles:0,data:{}});}return;}
    const join=(a:number[],b:number[]|undefined)=>{const out=new Float32Array(a.length+(b?.length??0));out.set(a);if(b)out.set(b,a.length);return out;};
    const table=compileWorldSurfaceStrokes({position:join(drawn.position,context?.position),faceUv:join(drawn.faceUv,context?.faceUv),partition:join(drawn.partition,context?.partition),drawnTriangles:drawn.triangles});
    const region=this.bank.publish(table);
    const next:Chunk={key,triangles:drawn.triangles,data:ChunkedSurfaceMesh.data(drawn,this.fields,region.faceOffset),region,start:0,capacity:capacityFor(drawn.triangles)};
    if(old&&next.triangles<=old.capacity&&!this.relayout){next.start=old.start;next.capacity=old.capacity;this.chunks.set(key,next);this.write(next);}
    else{this.chunks.set(key,next);this.relayout=true;}
    old?.region?.release();this.stats.rewritten++;
  }
  /** Lay every region out again on the next commit (map or cutaway change). */
  invalidateLayout():void {if(this.chunks.size)this.relayout=true;}
  clear():void {for(const chunk of this.chunks.values())chunk.region?.release();this.chunks.clear();this.relayout=true;}

  /** Returns true when the geometry object was replaced. */
  commit():boolean {
    if(!this.relayout)return false;
    this.relayout=false;
    const chunks=[...this.chunks.values()].sort((a,b)=>a.key-b.key);let triangles=0;
    for(const chunk of chunks){chunk.start=triangles;chunk.capacity=capacityFor(chunk.triangles);triangles+=chunk.capacity;}
    const old=this.geometry;this.geometry=this.allocate(triangles);
    for(const chunk of chunks)this.write(chunk,false);
    old.dispose();this.stats.layouts++;return true;
  }

  private write(chunk:Chunk,ranged=true):void {
    for(const [name,attribute] of Object.entries(this.geometry.attributes) as [string,THREE.BufferAttribute][]){
      const size=attribute.itemSize,array=attribute.array as Float32Array,first=chunk.start*3*size,end=(chunk.start+chunk.capacity)*3*size,values=chunk.data[name];
      if(end>array.length)continue; // A region not yet laid out: next commit.
      const used=values?Math.min(values.length,end-first):0;
      if(values&&used)array.set(values.subarray(0,used),first);
      if(name==='position')for(let i=first+used;i<end;i+=3){array[i]=0;array[i+1]=-50;array[i+2]=0;}
      else array.fill(0,first+used,end);
      if(ranged)attribute.addUpdateRange(first,end-first);
      attribute.needsUpdate=true;
    }
  }

  dispose():void {for(const chunk of this.chunks.values())chunk.region?.release();this.chunks.clear();this.geometry.dispose();this.bank.dispose();}
}

/** Regions of a width x height map at a given region size. */
export const regionGrid=(width:number,height:number,size:number)=>({columns:Math.ceil(width/size),rows:Math.ceil(height/size)});
