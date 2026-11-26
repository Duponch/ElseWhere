import type {AnimalFood} from './wildlife-food.ts';
import type {Cell,World} from './types.ts';

const offsets=[[0,0],[-1,0],[1,0],[0,-1],[0,1]] as const;
const contact=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=1;
/** Compile one real food decision. Goal occurrence order and duplicates stay
 * literal: they break equal path-cost ties later. Preferred food uses the
 * source Manhattan score, shared by its five contact cells. Construct each
 * contact once, instead of allocating a second forest of identical Cells for
 * the preference map. No candidate, path frontier or result is retained. */
export function foodRouting379(world:Pick<World,'width'|'height'>,animal:Cell,food:AnimalFood[]) {
 const goals:Cell[]=[],preferred=food.some(source=>source.preference),ranks=new Map<number,number>();
 const score=(source:AnimalFood)=>Math.abs(animal.x-source.x)+Math.abs(animal.z-source.z)-(source.preference??0);
 for(const source of food){
  const priority=preferred?score(source):0;
  for(const [dx,dz] of offsets){
   const cell={x:dx===-1?source.x-1:dx===1?source.x+1:source.x,z:dz===-1?source.z-1:dz===1?source.z+1:source.z};goals.push(cell);
   if(!preferred||cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height)continue;
   const index=cell.z*world.width+cell.x,previous=ranks.get(index);
   if(previous===undefined||priority<previous)ranks.set(index,priority);
  }
 }
 return {goals,rank:preferred?(cell:Cell)=>ranks.get(cell.z*world.width+cell.x)!:undefined,
  target:(end:Cell)=>preferred?food.filter(source=>contact(end,source)).sort((a,b)=>score(a)-score(b))[0]!:food.find(source=>contact(end,source))!};
}
