import {isConduitKind} from './conduit-kinds-382.ts';
import {animalNavigation} from './wildlife-navigation.ts';
import {duckMapHasWater256} from './duck-water-256.ts';
import {naturalTerrainCosts256} from './natural-terrain-movement-256.ts';
import {isRoofed} from './roof-rules.ts';
import {footprintCells} from './definitions.ts';
import type {Cell,World} from './types.ts';
/** One incident connectivity capture, never one flood for each random sample. */
export function selectDuckFlyerArrival256(w:World,random:()=>number):Cell|undefined {
 if(w.schemaVersion<256)return;
 const nav=animalNavigation(w,false,true),width=w.width,height=w.height,seen=new Uint8Array(w.tiles.length),queue=new Int32Array(w.tiles.length);let head=0,tail=0;
 const add=(c:Cell)=>{if(c.x<0||c.z<0||c.x>=width||c.z>=height)return;const i=c.z*width+c.x;if(seen[i]||!nav.occupy(c))return;seen[i]=1;queue[tail++]=i;};
 for(let x=0;x<width;x++){add({x,z:0});add({x,z:height-1});}for(let z=1;z<height-1;z++){add({x:0,z});add({x:width-1,z});}
 while(head<tail){const i=queue[head++]!,x=i%width,z=Math.floor(i/width);for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){const c={x:x+dx!,z:z+dz!};if(nav.step({x,z},c))add(c);}}
 const edifices=new Set<number>();for(const s of w.structures)if(!isConduitKind(s.kind))for(const c of footprintCells(s))edifices.add(c.z*width+c.x);
 const seekWater=duckMapHasWater256(w);
 for(let i=0;i<1000;i++){const c={x:Math.floor(random()*width),z:Math.floor(random()*height)},index=c.z*width+c.x,t=w.tiles[index]!;if(seen[index]&&!isRoofed(w,index)&&!edifices.has(index)&&(!seekWater||!t.floor&&!t.bridge&&!!naturalTerrainCosts256(t.terrain)?.water))return c;}
 return;
}
