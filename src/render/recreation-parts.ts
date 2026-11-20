import type { World } from '../sim/types';
import { buildingMaterialColor } from './building-material-color';
import type { Placement } from './primitives';
import { WORLD_SCALE } from '../world/scale';
import { tvActive } from '../sim/television-recreation';
import { joyTableParts354 } from './joy-table-parts354';

const BOARD_STEP=.078;
const BOARD_TOP=WORLD_SCALE.tableHeight+.025;
const DARK_SQUARES=Array.from({length:8},(_,row)=>Array.from({length:8},(_,column)=>({row,column})))
  .flat().filter(({row,column})=>(row+column)%2===1);
const CHESS_PIECES=Array.from({length:8},(_,column)=>({column,row:column%3===0?1:0,light:true}))
  .concat(Array.from({length:8},(_,column)=>({column,row:column%3===0?6:7,light:false})));

/** Fixed coloured boxes share the prepared furniture material and geometry.
 * Orientation zero shows the screen towards +z. No image, light or video feed. */
export function televisionParts(world:World):Placement[] {
  const parts:Placement[]=[];
  for(const tv of world.structures)if(tv.kind==='tube-television'){
    const ry=tv.orientation*Math.PI/2,c=Math.cos(ry),s=Math.sin(ry);
    const part=(x:number,z:number,y:number,sx:number,sy:number,sz:number,color:number)=>
      parts.push({targetId:tv.id,key:tv.id,x:tv.x+x*c+z*s,z:tv.z+z*c-x*s,y,sx,sy,sz,ry,color});
    part(0,0,.18,.62,.36,.48,0x8e8372);
    part(0,0,.58,.84,.46,.66,0xa8a08f);
    part(-.065,.337,.59,.61,.34,.025,0x444c4a);
    part(-.065,.354,.59,.53,.26,.013,tvActive(tv)?0xa8cec5:0x555f60);
    part(.325,.345,.65,.045,.055,.035,0xd4c7aa);
    part(.325,.345,.52,.045,.055,.035,0xd4c7aa);
    for(const x of [-.23,.23])part(x,0,.025,.07,.05,.34,0x635e53);
  }
  return parts;
}

/** All details join the resident furniture batch when structure content changes. */
export function recreationParts(world: World): Placement[] {
  const parts: Placement[]=televisionParts(world);
  parts.push(...joyTableParts354(world.structures));
  for(const pin of world.structures)if(pin.kind==='chess-table') {
    const {x,z}=pin,color=buildingMaterialColor(pin.material,0xa98559);
    parts.push({targetId:pin.id,x,z,y:WORLD_SCALE.tableHeight-.035,sx:.84,sy:.07,sz:.84,color},
      {targetId:pin.id,x,z,y:BOARD_TOP-.012,sx:.69,sy:.024,sz:.69,color:0xdacda8});
    for(const dx of [-.33,.33])for(const dz of [-.33,.33])
      parts.push({targetId:pin.id,x:x+dx,z:z+dz,y:(WORLD_SCALE.tableHeight-.07)/2,sx:.09,sy:WORLD_SCALE.tableHeight-.07,sz:.09,color});
    for(const {row,column} of DARK_SQUARES)
      parts.push({targetId:pin.id,x:x+(column-3.5)*BOARD_STEP,z:z+(row-3.5)*BOARD_STEP,y:BOARD_TOP+.002,sx:BOARD_STEP,sy:.006,sz:BOARD_STEP,color:0x496659});
    for(const {row,column,light} of CHESS_PIECES)
      parts.push({targetId:pin.id,x:x+(column-3.5)*BOARD_STEP,z:z+(row-3.5)*BOARD_STEP,y:BOARD_TOP+.035,sx:.038,sy:.06,sz:.038,color:light?0xf0e4c6:0x35443f});
  }else if(pin.kind==='horseshoes') {
    const {x,z}=pin;
    parts.push({targetId:pin.id,x,z,y:.025,sx:.72,sy:.05,sz:.72,color:0x887252},
      {targetId:pin.id,x,z,y:WORLD_SCALE.horseshoeHeight/2,sx:.09,sy:WORLD_SCALE.horseshoeHeight,sz:.09,color:buildingMaterialColor(pin.material,0xc9a875)});
    for(const [dx,dz,sx,sz] of [[-.19,.12,.045,.23],[-.01,.12,.045,.23],[-.1,.215,.22,.045]])
      parts.push({targetId:pin.id,x:x+dx!,z:z+dz!,y:.07,sx:sx!,sy:.04,sz:sz!,color:0x727b7d});
  }
  return parts;
}
