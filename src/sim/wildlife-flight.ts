import type { Cell,World } from './types.ts';
import {markActorPathCreated297} from './actor-path-source-297.ts';
import type { WildAnimal } from './wildlife-state.ts';
import type { animalNavigation } from './wildlife-navigation.ts';

/** Bounded local escape search, separate from food acquisition. Routes retain
 * real corners/doors and may initially approach danger to escape an enclosure.
 * Full ecological exit-map behaviour remains a separate ownership contract. */
export function animalEscape(w:World,a:WildAnimal,nav:ReturnType<typeof animalNavigation>):Cell[]|undefined {
  if(!a.flee)return;
  const start={x:a.x,z:a.z},danger=a.flee.danger,queue=[start],seen=new Set([a.z*w.width+a.x]);
  const parents=new Map<number,Cell>(),distance=(c:Cell)=>(c.x-danger.x)**2+(c.z-danger.z)**2;
  let best=start;
  for(let i=0;i<queue.length&&i<4096;i++){
    const c=queue[i]!;
    if(nav.free(c)&&distance(c)>distance(best))best=c;
    for(const [dx,dz] of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]]){
      const n={x:c.x+dx!,z:c.z+dz!},id=n.z*w.width+n.x;
      if(n.x<0||n.z<0||n.x>=w.width||n.z>=w.height||Math.hypot(n.x-start.x,n.z-start.z)>28||seen.has(id)||!nav.step(c,n))continue;
      seen.add(id);parents.set(id,c);queue.push(n);
    }
  }
  if(best===start)return;
  const path:Cell[]=[];for(let c=best;c!==start;c=parents.get(c.z*w.width+c.x)!)path.push(c);
  return markActorPathCreated297(path.reverse());
}
