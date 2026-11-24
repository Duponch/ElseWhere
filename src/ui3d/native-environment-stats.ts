import {captureWorldBeauty,worldFog} from '../sim/beauty-need.ts';
import {BEAUTY_BAND_LABEL,beautyBand,BeautyMapCache,RoomBeautyCapture,type BeautyMap} from '../sim/room-beauty.ts';
import {IMPRESSION_LABELS,impressionStage} from '../sim/room-impressiveness.ts';
import {RoomQualityCapture,type RoomQuality} from '../sim/room-quality.ts';
import {ROOM_ROLE_LABEL,WorkEnvironmentCache,type WorkEnvironment,type WorkRoomRole} from '../sim/work-environment.ts';
import type {Cell,World} from '../sim/types.ts';

export interface NativeEnvironmentModes {room:boolean;beauty:boolean}
export interface NativeEnvironmentStat {id:string;label:string;value:string;stage:string;related:boolean}
export interface NativeEnvironmentStats {
  cell:Cell;
  room?:{title:string;stats:readonly NativeEnvironmentStat[];cells:readonly number[]};
  beauty?:{average:number;cells:readonly {x:number;z:number;value:number}[]};
}

const wealthThresholds=[500,700,2000,4000,10000,40000,100000,1000000];
const wealthLabels=['Démunie','Pauvre','Médiocre','Aisée','Riche','Luxueuse','Très luxueuse','Extrêmement luxueuse','D’un luxe exceptionnel'];
const spaceThresholds=[12.5,29,55,70,130,349.5];
const spaceLabels=['Exiguë','Étroite','Taille moyenne','Assez spacieuse','Spacieuse','Très spacieuse','Extrêmement spacieuse'];
const cleanThresholds=[-1.1,-.4,-.05,.4];
const cleanLabels=['Très sale','Sale','Un peu sale','Propre','Stérile'];
const stage=(value:number,thresholds:readonly number[],labels:readonly string[]):string=>labels[thresholds.filter(t=>value>=t).length]!;
const capital=(text:string)=>text.charAt(0).toUpperCase()+text.slice(1);
/** Unity Mathf.RoundToInt uses ties to even, including negative scores. */
const rounded=(value:number):string=>{const lower=Math.floor(value);return String(value-lower===.5?(lower%2===0?lower:lower+1):Math.round(value));};
const decimal=(value:number):string=>(Math.abs(value)<.005?0:value).toFixed(2);

function roomStats(q:RoomQuality,role:WorkRoomRole):NativeEnvironmentStat[] {
  const all=role==='bedroom'||role==='barracks'||role==='dining'||role==='recreation';
  const cleanliness=all||role==='laboratory'||role==='kitchen';
  return [
    {id:'impressiveness',label:'Impression',value:rounded(q.impressiveness),stage:capital(IMPRESSION_LABELS[impressionStage(q.impressiveness)]!),related:all},
    {id:'wealth',label:'Richesse',value:rounded(q.wealth),stage:stage(q.wealth,wealthThresholds,wealthLabels),related:all},
    {id:'space',label:'Espace',value:rounded(q.space),stage:stage(q.space,spaceThresholds,spaceLabels),related:all},
    {id:'beauty',label:'Beauté',value:decimal(q.beauty),stage:capital(BEAUTY_BAND_LABEL[beautyBand(q.beauty)]),related:all},
    {id:'cleanliness',label:'Propreté',value:decimal(q.cleanliness),stage:stage(q.cleanliness,cleanThresholds,cleanLabels),related:cleanliness},
  ];
}

interface Capture {
  world:World;revision:number|undefined;environment:WorkEnvironment;quality:RoomQualityCapture;
  fogged:((index:number)=>boolean)|undefined;beauty?:RoomBeautyCapture;
  rooms:Map<number,NativeEnvironmentStats['room']|null>;
  results:Map<number,NativeEnvironmentStats|null>;
}

/** Observe only the values actually read by the simulation's perception walk.
 * The local facade shares the immutable field; it never patches that field or
 * duplicates its radius, doorway, boundary or historical-schema rules. */
function perceivedBeauty(capture:Capture,cell:Cell,cache:BeautyMapCache):NonNullable<NativeEnvironmentStats['beauty']> {
  const source=capture.beauty??=captureWorldBeauty(capture.world,capture.environment.topology,cache);
  const map=source.map,cells:NonNullable<NativeEnvironmentStats['beauty']>['cells'][number][]=[];
  const record=(index:number,value:number):number=>{
    if(value!==0&&Number.isFinite(value))cells.push({x:index%map.width,z:Math.floor(index/map.width),value});
    return value;
  };
  const observed=Object.create(map) as BeautyMap;
  observed.atIndex=(index,outdoors=false)=>record(index,map.atIndex(index,outdoors));
  observed.thingsAtIndex=(index,outdoors=false)=>record(index,map.thingsAtIndex(index,outdoors));
  observed.at=(target,outdoors=false)=>record(map.index(target),map.at(target,outdoors));
  const view=new RoomBeautyCapture(observed,source.topology,capture.fogged);
  // Historical perception also observes player knowledge, even before 373.
  const average=view.perceived(cell,capture.fogged?(_,target)=>!capture.fogged!(map.index(target)):undefined);
  return {average,cells};
}

/** A renderer supplies its accepted publication revision. Pointer movement
 * reuses that capture and visits at most the perception radius. Without a
 * revision each call takes a fresh capture, including in-place world edits. */
export class NativeEnvironmentStatsReader {
  private capture:Capture|undefined;
  private environment=new WorkEnvironmentCache();
  private beautyMap=new BeautyMapCache();
  clear():void {this.capture=undefined;this.environment=new WorkEnvironmentCache();this.beautyMap=new BeautyMapCache();}
  read(world:World,cell:Cell,modes:NativeEnvironmentModes,revision?:number):NativeEnvironmentStats|null {
    if(!modes.room&&!modes.beauty)return null;
    if(!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height)return null;
    const index=cell.z*world.width+cell.x;
    if(!world.tiles[index])return null;
    const fogged=worldFog(world);if(fogged?.(index))return null;
    let capture=this.capture;
    if(revision===undefined||!capture||capture.world!==world||capture.revision!==revision){
      // Without the publication contract even a terrain object may have been
      // edited in place, outside the simulation's replace-on-write invariant.
      if(revision===undefined)this.environment=new WorkEnvironmentCache();
      const environment=this.environment.read(world);this.beautyMap.invalidateAll();
      capture={world,revision,environment,quality:new RoomQualityCapture(world,environment.topology),fogged,rooms:new Map(),results:new Map()};
      this.capture=capture;
    }
    if(capture.fogged?.(index))return null;
    const key=index*4+Number(modes.room)+Number(modes.beauty)*2;
    if(capture.results.has(key))return capture.results.get(key)!;
    const result:NativeEnvironmentStats={cell:{x:cell.x,z:cell.z}};
    const space=capture.environment.topology.at(cell.x,cell.z);
    if(modes.room&&space?.kind==='space'){
      if(!capture.rooms.has(space.id)){
        const room=capture.environment.room(cell);
        const q=room&&!room.psychologicallyOutdoors?capture.quality.room(cell):null;
        const known=q&&![...q.cells,...q.adjacent].some(i=>capture.fogged?.(i));
        capture.rooms.set(space.id,known?{title:room!.role==='none'?'Pièce générique':ROOM_ROLE_LABEL[room!.role],stats:roomStats(q!,room!.role),cells:[...q!.cells]}:null);
      }
      result.room=capture.rooms.get(space.id)??undefined;
    }
    if(modes.beauty&&space&&space.kind!=='solid')result.beauty=perceivedBeauty(capture,cell,this.beautyMap);
    const visible=result.room||result.beauty?result:null;
    // A paused exploration must not retain one perception array per map cell.
    if(capture.results.size>=96)capture.results.delete(capture.results.keys().next().value!);
    capture.results.set(key,visible);return visible;
  }
}

interface Rect {x:number;y:number;width:number;height:number}
export interface NativeEnvironmentLayout extends Rect {
  pad:number;beauty?:Rect;divider?:number;title?:Rect;
  rows:readonly {y:number;height:number;gutter:{x:number;width:number};label:{x:number;width:number};value:{x:number;width:number};stage:{x:number;width:number}}[];
  note?:Rect;
}

/** Core EnvironmentStatsDrawer coordinates, local to the floating window.
 * Narrow viewports scale columns; short viewports scale vertical rectangles. */
export function layoutNativeEnvironmentStats(stats:NativeEnvironmentStats,viewport:{width:number;height:number},pointer:{x:number;y:number}):NativeEnvironmentLayout {
  const screenW=Math.max(0,viewport.width),screenH=Math.max(0,viewport.height);
  const width=Math.min(424,screenW),naturalHeight=stats.room?(stats.beauty?233:195):stats.beauty?49:0;
  const height=Math.min(naturalHeight,screenH),sx=width/424,sy=naturalHeight?height/naturalHeight:1,pad=12*sx;
  let x=pointer.x+26,y=pointer.y+26;
  if(x+width>screenW)x=pointer.x-width-26;
  if(y+height>screenH)y=pointer.y-height-26;
  x=Math.max(0,Math.min(screenW-width,x));y=Math.max(0,Math.min(screenH-height,y));
  const rect=(rx:number,ry:number,rw:number,rh:number):Rect=>({x:rx*sx,y:ry*sy,width:rw*sx,height:rh*sy});
  const layout:NativeEnvironmentLayout={x,y,width,height,pad,rows:[]};let curY=12;
  if(stats.beauty){layout.beauty=rect(22,curY,390,23);curY+=25;}
  if(stats.room){
    if(stats.beauty){curY+=5;layout.divider=curY*sy;curY+=8;}
    layout.title=rect(22,curY,390,30);curY+=30;
    layout.rows=stats.room.stats.map(()=>{
      const row={y:curY*sy,height:23*sy,gutter:{x:12*sx,width:10*sx},label:{x:22*sx,width:110*sx},value:{x:167*sx,width:50*sx},stage:{x:252*sx,width:160*sx}};
      curY+=25;return row;
    });
    if(stats.room.stats.some(s=>s.related))layout.note=rect(12,curY,400,23);
  }
  return layout;
}
