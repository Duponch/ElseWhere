import * as THREE from 'three/webgpu';
import {MapLabelBatch,type MapLabelEntry} from './MapLabelBatch';
import {environmentBeautyColor} from '../ui3d/native-environment-ink';
import type {NativeEnvironmentStats} from '../ui3d/native-environment-stats';
import type {Cell} from '../sim/types';

type Strip=readonly [x0:number,z0:number,x1:number,z1:number];
const lift=.13,edge=.075;

/** A real room union's boundary, not its bounding rectangle. No internal
 * edges, so L-shaped and furnished rooms stay legible. */
export function environmentRoomEdges(width:number,height:number,cells:readonly number[]):Strip[]{
  if(width<=0||height<=0)return [];
  const known=new Set(cells.filter(i=>Number.isInteger(i)&&i>=0&&i<width*height)),out:Strip[]=[];
  for(const i of known){
    const x=i%width,z=Math.floor(i/width),w=x-.5,e=x+.5,n=z-.5,s=z+.5;
    if(x===0||!known.has(i-1))out.push([w,n,w+edge,s]);
    if(x===width-1||!known.has(i+1))out.push([e-edge,n,e,s]);
    if(z===0||!known.has(i-width))out.push([w,n,e,n+edge]);
    if(z===height-1||!known.has(i+width))out.push([w,s-edge,e,s]);
  }
  return out;
}
/** Four corners around the actually hovered (known) cell. */
export function environmentBeautyBracket(cell:Cell):Strip[]{
  const x=cell.x,z=cell.z,w=x-.5,e=x+.5,n=z-.5,s=z+.5,l=.22,t=.065;
  return [[w,n,w+l,n+t],[w,n,w+t,n+l],[e-l,n,e,n+t],[e-t,n,e,n+l],[w,s-t,w+l,s],[w,s-l,w+t,s],[e-l,s-t,e,s],[e-t,s-l,e,s]];
}
const roundEven=(value:number)=>{const floor=Math.floor(value);return value-floor===.5?(floor%2===0?floor:floor+1):Math.round(value);};
export function environmentBeautyLabels(stats:NativeEnvironmentStats):MapLabelEntry[]{
  return (stats.beauty?.cells??[]).filter(cell=>Number.isFinite(cell.value)&&cell.value!==0).map(cell=>({x:cell.x,y:lift,z:cell.z,label:String(roundEven(cell.value)),color:environmentBeautyColor(cell.value,8,true)}));
}

/** Resident flat edge geometry. Its capacity grows only for a larger room;
 * moving between two cells of that room doesn't touch the room buffer. */
class Edges {
  private readonly material=new THREE.MeshBasicNodeMaterial({color:0xffffff,transparent:true,opacity:.91,depthTest:false,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,toneMapped:false});
  readonly mesh=new THREE.Mesh(new THREE.BufferGeometry(),this.material);
  private capacity=0;
  constructor(name:string){this.material.userData.explorationIntent=true;this.mesh.name=name;this.mesh.frustumCulled=false;this.mesh.renderOrder=8;this.mesh.visible=false;}
  update(strips:readonly Strip[]):void{
    const vertices=strips.length*6;
    if(vertices>this.capacity){this.capacity=2**Math.ceil(Math.log2(vertices));this.mesh.geometry.dispose();this.mesh.geometry=new THREE.BufferGeometry();this.mesh.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(this.capacity*3),3).setUsage(THREE.DynamicDrawUsage));}
    if(!vertices){this.hide();return;}
    const position=this.mesh.geometry.getAttribute('position'),array=position.array as Float32Array;let at=0;
    for(const [x0,z0,x1,z1]of strips){for(const [x,z]of [[x0,z0],[x1,z0],[x1,z1],[x0,z0],[x1,z1],[x0,z1]]){array[at++]=x!;array[at++]=lift;array[at++]=z!;}}
    position.needsUpdate=true;this.mesh.geometry.setDrawRange(0,vertices);this.mesh.visible=true;
  }
  hide():void{this.mesh.visible=false;this.mesh.geometry.setDrawRange(0,0);}
  dispose():void{this.mesh.removeFromParent();this.mesh.geometry.dispose();this.material.dispose();}
}

/** Created on the first use of the two modes. A single glyph batch and two
 * small edge meshes; no textures or model objects per cell, no map scan at RAF. */
export class EnvironmentStatsOverlay {
  readonly group=new THREE.Group();
  private readonly room=new Edges('environment-room-edges');
  private readonly bracket=new Edges('environment-beauty-bracket');
  private labels:MapLabelBatch|undefined;
  private lastRoom:readonly number[]|undefined;
  private lastBeauty:NativeEnvironmentStats['beauty'];
  private lastCell:Cell|undefined;
  private mapSize='';
  constructor(){this.group.name='environment-stats-overlays';this.group.add(this.room.mesh,this.bracket.mesh);this.group.visible=false;}
  update(width:number,height:number,stats:NativeEnvironmentStats|null):void {
    const size=`${width}:${height}`;
    if(size!==this.mapSize){this.mapSize=size;this.lastRoom=this.lastBeauty=this.lastCell=undefined;this.room.hide();this.bracket.hide();this.labels?.update([]);}
    if(!stats){this.group.visible=false;return;}
    this.group.visible=true;
    const cells=stats.room?.cells;
    if(cells!==this.lastRoom){const same=!!cells&&!!this.lastRoom&&cells.length===this.lastRoom.length&&cells.every((i,index)=>i===this.lastRoom![index]);if(!same)this.room.update(cells?environmentRoomEdges(width,height,cells):[]);this.lastRoom=cells;}
    if(stats.beauty){
      if(!this.lastCell||this.lastCell.x!==stats.cell.x||this.lastCell.z!==stats.cell.z){this.bracket.update(environmentBeautyBracket(stats.cell));this.lastCell={...stats.cell};}
      if(!this.labels){this.labels=new MapLabelBatch({tinted:true,aboveWorld:true});this.labels.mesh.name='environment-beauty-glyphs';this.labels.mesh.renderOrder=9;this.group.add(this.labels.mesh);}
      if(stats.beauty!==this.lastBeauty){this.labels.update(environmentBeautyLabels(stats));this.lastBeauty=stats.beauty;}
    }else if(this.lastBeauty){this.labels?.update([]);this.bracket.hide();this.lastBeauty=this.lastCell=undefined;}
  }
  present(camera:THREE.OrthographicCamera|THREE.PerspectiveCamera,height:number,cellPixels:number):void{
    if(this.group.visible)this.labels?.present(camera,height,cellPixels,0);
  }
  prepareForCompile():()=>void{return this.labels?.prepareForCompile()??(()=>{});}
  dispose():void{this.group.removeFromParent();this.room.dispose();this.bracket.dispose();this.labels?.dispose();this.group.clear();}
}
