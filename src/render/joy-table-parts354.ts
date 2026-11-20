import { footprintCells } from '../sim/definitions';
import { isJoyTableKind354, type JoyTableKind354 } from '../sim/joy-tables-354';
import type { Structure } from '../sim/types';
import { WORLD_SCALE } from '../world/scale';
import { buildingMaterialColor } from './building-material-color';
import type { Placement } from './primitives';

/** Schema 354 joy buildings drawn with the shared opaque furniture boxes:
 * no light, texture, animation or per-frame work; parts are rebuilt only
 * when the structure list changes, as the chess table. */
type Bounds={readonly width:number;readonly depth:number;readonly height:number};
const TABLE=WORLD_SCALE.tableHeight;
export const JOY_TABLE_MODEL_BOUNDS_354:Readonly<Record<JoyTableKind354,Bounds>>=Object.freeze({
  'hoopstone-ring':Object.freeze({width:.62,depth:.62,height:.95}),
  'billiards-table':Object.freeze({width:1.88,depth:2.88,height:TABLE+.05}),
  'game-of-ur-board':Object.freeze({width:.86,depth:.5,height:.2}),
  'poker-table':Object.freeze({width:1.88,depth:1.88,height:TABLE+.04}),
});
export const joyTableModelBounds354=(kind:unknown):Bounds|undefined=>isJoyTableKind354(kind)?JOY_TABLE_MODEL_BOUNDS_354[kind]:undefined;

const FELT=0x4f7a55,FELT_DARK=0x3d5f43,POCKET=0x2f2a26,CREAM=0xe9dcc0,RED=0xb4513c,OCHRE=0xcf9f4e,BLUE=0x597f95,STONE=0x9d978b,INK=0x3a332b;

export function joyTableParts354(structures:readonly Structure[]):Placement[] {
  const parts:Placement[]=[];
  for(const s of structures){
    if(!isJoyTableKind354(s.kind))continue;
    const cells=footprintCells(s);
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    for(const c of cells){minX=Math.min(minX,c.x);maxX=Math.max(maxX,c.x);minZ=Math.min(minZ,c.z);maxZ=Math.max(maxZ,c.z);}
    const cx=(minX+maxX)/2,cz=(minZ+maxZ)/2,w=maxX-minX+1,d=maxZ-minZ+1;
    const box=(x:number,z:number,y:number,sx:number,sy:number,sz:number,color:number)=>parts.push({targetId:s.id,x:cx+x,z:cz+z,y,sx,sy,sz,color});
    const material=buildingMaterialColor(s.material,0x9b7651)??0x9b7651;
    if(s.kind==='billiards-table'||s.kind==='poker-table'){
      const W=w-.12,D=d-.12;
      box(0,0,TABLE-.07,W,.12,D,material);
      box(0,0,TABLE,W-.2,.03,D-.2,s.kind==='billiards-table'?FELT:FELT_DARK);
      // Cushion rails, then legs at the corners (and mid-length on the long table).
      for(const sign of [-1,1]){box(sign*(W/2-.05),0,TABLE+.025,.1,.06,D,material);box(0,sign*(D/2-.05),TABLE+.025,W,.06,.1,material);}
      const legs:[number,number][]=[];
      for(const lx of [-(W/2-.12),W/2-.12])for(const lz of [-(D/2-.12),D/2-.12])legs.push([lx,lz]);
      if(s.kind==='billiards-table'){if(d>w)legs.push([-(W/2-.12),0],[W/2-.12,0]);else legs.push([0,-(D/2-.12)],[0,D/2-.12]);}
      for(const [lx,lz] of legs)box(lx,lz,(TABLE-.13)/2,.13,TABLE-.13,.13,material);
      if(s.kind==='billiards-table'){
        const long=d>=w,half=long?D/2-.12:W/2-.12,side=long?W/2-.12:D/2-.12;
        for(const along of [-half,0,half])for(const across of [-side,side])box(long?across:along,long?along:across,TABLE+.02,.1,.03,.1,POCKET);
        const balls:readonly [number,number,number][]=[[-.18,.35,RED],[.12,.48,OCHRE],[.02,.62,BLUE],[0,-.55,CREAM]];
        for(const [a,b,color] of balls)box(long?a:b,long?b:a,TABLE+.04,.07,.07,.07,color);
        box(long?.3:-.2,long?-.2:.3,TABLE+.05,long?.03:1.1,.025,long?1.1:.03,0xb48a60);
      }else{
        for(const [x,z] of [[-.2,-.08],[.16,.1],[-.05,.3]] as const)box(x,z,TABLE+.025,.13,.006,.19,CREAM);
        for(const [x,z,color] of [[.3,-.3,RED],[-.32,.28,BLUE],[.05,-.36,INK]] as const)box(x,z,TABLE+.03,.07,.035,.07,color);
      }
    }else if(s.kind==='hoopstone-ring'){
      box(0,0,.025,.62,.05,.62,STONE);
      box(0,0,.42,.09,.75,.09,material);
      // A square-cut ring of four short beams, face on to the throwing lanes.
      for(const sign of [-1,1]){box(sign*.21,0,.78,.07,.42,.07,material);box(0,0,.78+sign*.21,.49,.07,.07,material);}
      for(const [x,z] of [[.22,.24],[-.25,.18],[.2,-.27]] as const)box(x,z,.04,.08,.06,.07,STONE);
    }else{
      // Game of Ur: a low board, long axis across the facing direction, 20 squares.
      const across=s.orientation===1||s.orientation===3;
      const step=.095,top=.12;
      box(0,0,.05,across?.5:.86,.1,across?.86:.5,material);
      for(let col=0;col<8;col++)for(let row=-1;row<=1;row++){
        if(row!==0&&(col===4||col===5))continue;
        const a=(col-3.5)*step,b=row*step*1.05,rosette=(col===0||col===6)&&row!==0||col===3&&row===0;
        box(across?b:a,across?a:b,top,step*.86,.008,step*.86,rosette?RED:(col+row)%2?CREAM:OCHRE);
      }
      for(const [a,b,color] of [[-.36,.2,INK],[.3,-.2,CREAM]] as const)box(across?b:a,across?a:b,top+.02,.04,.03,.04,color);
    }
  }
  return parts;
}
