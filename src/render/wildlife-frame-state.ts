import type {AnimalSpeciesId} from '../sim/animal-species';
import {animalStageDrawScale} from './animal-stage-scale';

type Primitive=number|string|boolean|undefined;
type Stream={getX(i:number):number;getY(i:number):number;getZ(i:number):number;getW(i:number):number};
type Shape={species:AnimalSpeciesId;ageTicks:number;growthTracker?:{value:number}};

/** Renderer-local derived scale: the drawn size of the animal's life stage
 * against its adult (Core drawSize per stage, see animal-stage-scale). All
 * mutable inputs are reread on every call; object identity alone never
 * certifies a live/corpse record. */
export class WildlifeBodyScale {
 private readonly records=new WeakMap<Shape,{species:AnimalSpeciesId;age:number;growth:number|undefined;scale:number}>();
 read(owner:Shape):number {
  const species=owner.species,age=owner.ageTicks,growth=owner.growthTracker?.value,previous=this.records.get(owner);
  if(previous&&previous.species===species&&previous.age===age&&previous.growth===growth)return previous.scale;
  const scale=animalStageDrawScale(species,age,growth);
  this.records.set(owner,{species,age,growth,scale});return scale;
 }
}

/** Same primitive capture as the historical frame keys, without formatting
 * strings or allocating temporary arrays for an unchanged actor. RAW mutable
 * callers still supply every scalar and every carried stream on each frame. */
export class WildlifeFrameState {
 private readonly records=new Map<number,{kind:number;values:Primitive[]}>();
 private values:Primitive[]=[];private cursor=0;private equal=false;private length=0;
 /** Between-frame physical adoption invalidates only this resident actor. */
 invalidate(id:number):void {this.records.delete(id);}
 clear():void {this.records.clear();this.values=[];this.cursor=this.length=0;this.equal=false;}
 begin(id:number,kind:0|1|2):this {
  let record=this.records.get(id);
  if(!record){record={kind,values:[]};this.records.set(id,record);this.equal=false;}
  else {this.equal=record.kind===kind;record.kind=kind;}
  this.values=record.values;this.length=this.values.length;this.cursor=0;return this;
 }
 value(value:Primitive):this {
  const previous=this.values[this.cursor];
  // String keys considered NaN stable and did not distinguish -0 from 0.
  if(previous!==value&&!(previous!==previous&&value!==value))this.equal=false;
  this.values[this.cursor++]=value;return this;
 }
 stream(stream:Stream|undefined,index:number):this {
  if(stream)this.value(stream.getX(index)).value(stream.getY(index)).value(stream.getZ(index)).value(stream.getW(index));
  return this;
 }
 unchanged():boolean {const equal=this.equal&&this.cursor===this.length;this.values.length=this.cursor;return equal;}
}
