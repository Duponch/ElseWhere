import type { AreaAction } from '../sim/types';

export const ZONE_FILL_OPACITY=.2;
export const ZONE_SELECTION_COLOR=0xfff5d6;
export const ZONE_SELECTION_WIDTH=.07;
export const ZONE_TOOLS=new Set<string>(['snow-clear','remove-snow-clear','stockpile','remove-stockpile','growing','remove-growing','home','remove-home','build-roof','remove-roof','ignore-roof']);
export function areaPreviewColor(action:AreaAction,eligible:number,skipped:number):number {
  if(!ZONE_TOOLS.has(action)&&action!=='allow'&&action!=='forbid')return 0x8bcef0;
  return eligible===0?0xe46f58:skipped>0?0xe4bb68:0x9dd9ca;
}

/** Identity owns the preferred hue. Only touching zones whose colours collide
 * choose another hue; stable ID order makes rebuilding/reordering deterministic.
 * This is a visual extension to Core's finite cycling palettes. No World write,
 * random draw, per-frame work or persistent colour state is involved. */
export function adjacentZoneColors(width:number,cells:readonly {zoneId:number;cell:number}[],palette:readonly number[]):Map<number,number> {
  const owners=new Map<number,number>(),neighbours=new Map<number,Set<number>>(),colors=new Map<number,number>();
  for(const {zoneId,cell}of cells){owners.set(cell,zoneId);if(!neighbours.has(zoneId))neighbours.set(zoneId,new Set());}
  for(const [cell,id]of owners){
    const x=cell%width;
    for(const near of [x>0?cell-1:-1,x<width-1?cell+1:-1,cell-width,cell+width]){
      if(near<0)continue;
      const other=owners.get(near);
      if(other!==undefined&&other!==id){neighbours.get(id)!.add(other);neighbours.get(other)!.add(id);}
    }
  }
  for(const id of [...neighbours.keys()].sort((a,b)=>a-b)){
    const used=new Set<number>();for(const other of neighbours.get(id)!)if(colors.has(other))used.add(colors.get(other)!);
    const start=(id-1)%palette.length;
    let color:number|undefined;
    for(let offset=0;offset<palette.length;offset++){
      const candidate=palette[(start+offset)%palette.length]!;
      if(!used.has(candidate)){color=candidate;break;}
    }
    // Disjoint legacy regions can have more neighbours than the Core palette.
    // Extend the palette locally instead of reusing an already adjacent colour.
    for(let extra=1;color===undefined;extra++){
      const candidate=((Math.imul(id,0x45d9f3b)+Math.imul(extra,0x9e3779))&0x7f7f7f)+0x404040;
      if(!used.has(candidate))color=candidate;
    }
    colors.set(id,color);
  }
  return colors;
}

/** Exact cell contour, including holes. Bits are west/east/north/south. */
export function zoneBoundaryEdges(width:number,cells:readonly number[]):Map<number,number> {
  const present=new Set(cells),out=new Map<number,number>();
  for(const i of present){
    const x=i%width;
    const mask=(x===0||!present.has(i-1)?1:0)|(x===width-1||!present.has(i+1)?2:0)
      |(!present.has(i-width)?4:0)|(!present.has(i+width)?8:0);
    if(mask)out.set(i,mask);
  }
  return out;
}
export function zoneBoundaryVertices(width:number,cells:readonly number[],y=.14):number[] {
  const vertices:number[]=[],t=ZONE_SELECTION_WIDTH;
  const rect=(x0:number,z0:number,x1:number,z1:number)=>vertices.push(x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z0,x1,y,z1,x0,y,z1);
  for(const [i,mask]of zoneBoundaryEdges(width,cells)){
    const x=i%width,z=Math.floor(i/width),w=x-.5,e=x+.5,n=z-.5,s=z+.5;
    if(mask&1)rect(w,n,w+t,s);if(mask&2)rect(e-t,n,e,s);
    if(mask&4)rect(w,n,e,n+t);if(mask&8)rect(w,s-t,e,s);
  }
  return vertices;
}
