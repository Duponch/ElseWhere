import type { World } from '../sim/types';
import { noise } from './StaticGeometry';

export const ROCK_VERTICES = 12;
export const ROCK_INDICES = 54; // top + four exposed, bevelled sides; no hidden faces
export const isRock = (world:World,x:number,z:number):boolean => x>=0&&z>=0&&x<world.width&&z<world.height&&world.tiles[z*world.width+x]?.terrain==='rock';
const corners=[[-1,-1],[-1,1],[1,1],[1,-1]] as const;
const SMOOTH_TOP=2.7,SMOOTH_CHAMFER=.06;
const sides=[[-1,0],[0,1],[1,0],[0,-1]] as const;

/** Shared grid-corner profile. A removal affects only the surrounding 3x3 cells.
 * A boundary corner moves into the occupied union; interior corners can wander.
 * The base keeps the exact collision footprint, including newly exposed cuts. */
export function rockCorner(world:World,gx:number,gz:number):{x:number;z:number;top:number;shoulder:number} {
  let count=0,sx=0,sz=0,smoothed=false;
  // One read per neighbour, as isRock: the tile also tells a smoothed wall.
  for(const dx of [-1,0])for(const dz of [-1,0]) {
    const x=gx+dx,z=gz+dz;if(x<0||z<0||x>=world.width||z>=world.height)continue;
    const tile=world.tiles[z*world.width+x];if(tile?.terrain!=='rock')continue;
    count++;sx+=dx*2+1;sz+=dz*2+1;if(tile.smoothedWall367)smoothed=true;
  }
  // Schema 367: a corner touching a smoothed wall is cut flat and almost
  // plumb: a level top, no wander, a thin chamfer instead of the broken bevel.
  if(smoothed){const ix=count===4?0:sx/count*SMOOTH_CHAMFER,iz=count===4?0:sz/count*SMOOTH_CHAMFER;return {x:gx-.5+ix,z:gz-.5+iz,top:SMOOTH_TOP,shoulder:SMOOTH_TOP-.22};}
  const n=noise(gx,gz,world.seed+281);
  const driftX=count===4?(n-.5)*.36:sx/Math.max(1,count)*.28;
  const driftZ=count===4?(noise(gx,gz,world.seed+317)-.5)*.36:sz/Math.max(1,count)*.28;
  const top=2.15+noise(Math.floor(gx/3),Math.floor(gz/3),world.seed+211)*1.1+n*.26-(count<4?.3:0);
  return {x:gx-.5+driftX,z:gz-.5+driftZ,top,shoulder:top*(.58+n*.16)};
}

/** Write a stable cell slot. Flat-shaded indexed vertices share the three rings. */
export function writeRockCell(world:World,x:number,z:number,positions:Float32Array,vertex:number):number[] {
  if(!isRock(world,x,z))return [];
  for(let i=0;i<4;i++) {
    const [dx,dz]=corners[i]!,gx=x+(dx+1)/2,gz=z+(dz+1)/2,c=rockCorner(world,gx,gz);
    positions.set([c.x,c.top,c.z],(vertex+i)*3);
    positions.set([gx-.5,c.shoulder,gz-.5],(vertex+4+i)*3);
    positions.set([gx-.5,0,gz-.5],(vertex+8+i)*3);
  }
  const result:number[]=[];
  const quad=(a:number,b:number,c:number,d:number)=>result.push(vertex+a,vertex+b,vertex+c,vertex+a,vertex+c,vertex+d);
  if(noise(x,z,world.seed+601)>.5)quad(0,1,2,3);else quad(1,2,3,0);
  for(let i=0;i<4;i++) {
    const [dx,dz]=sides[i]!,j=(i+1)%4;
    if(isRock(world,x+dx,z+dz))continue;
    quad(i,i+4,j+4,j);quad(i+4,i+8,j+8,j+4);
  }
  return result;
}
