import type {Resource,World} from '../sim/types';

/** The admitted resources are immutable for a Full and all its pose views.
 * Scan their original order only as far as the furthest requested cell.
 * An overlapping plant/rock therefore resolves exactly as Array.find would. */
export class ActionBarResourceCells {
  private resources:readonly Resource[]|undefined;
  private width=0;
  private size=0;
  private cursor=0;
  private reset=true;
  private slots=new Uint32Array(0);

  bind(world:World):void {
    const size=world.width*world.height;
    if(this.resources===world.resources&&this.width===world.width&&this.size===size)return;
    this.resources=world.resources;this.width=world.width;this.size=size;this.cursor=0;this.reset=true;
  }

  at(cell:number):Resource|undefined {
    const resources=this.resources;
    if(!resources||!Number.isSafeInteger(cell)||cell<0||cell>=this.size)return;
    if(this.reset){
      if(this.slots.length<this.size)this.slots=new Uint32Array(this.size);
      else this.slots.fill(0,0,this.size);
      this.reset=false;
    }
    const found=this.slots[cell]!;
    if(found)return resources[found-1];
    while(this.cursor<resources.length){
      const index=this.cursor++,row=resources[index]!,key=row.z*this.width+row.x;
      if(!this.slots[key])this.slots[key]=index+1;
      if(key===cell)return row;
    }
    return undefined;
  }
}
