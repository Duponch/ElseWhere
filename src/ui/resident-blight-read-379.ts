import type {Resource,World} from '../sim/types';
import {readResidentCollectionChanges379,readResidentCollectionDirectory379} from '../bridge/resident-collection-changes-379';
import {readResidentResourceBaseChanges} from '../bridge/resident-resource-base-changes';
import {knownPosition256} from './exploration-readers-256';

/** The native alert reader follows accepted immutable Worlds. Blight is a
 * resource BASE field, so growth/life-only transport cannot change this
 * membership. Keep *all* affected IDs (including hidden plants), then test
 * their visibility against the current map. This is not a simulation cache.
 * A replacement, missing proof, order change, or public mutable World uses
 * the literal exhaustive reader. */
export class ResidentBlightRead379 {
 private previous?:World;
 private ids=new Set<number>();
 readonly stats={fullReads:0,deltaReads:0,resourceVisits:0};
 reset():void{this.previous=undefined;this.ids.clear();}
 read(world:World):Resource[]{
  const directory=readResidentCollectionDirectory379(world,'resources');
  const full=():Resource[]=>{
   this.stats.fullReads++;this.reset();const rows:Resource[]=[];let retain=!!directory;
   for(const resource of world.resources){this.stats.resourceVisits++;if(!resource.blight)continue;
    if(this.ids.has(resource.id))retain=false;this.ids.add(resource.id);
    if(knownPosition256(world,resource))rows.push(resource);
   }
   if(retain)this.previous=world;else this.reset();return rows;
  };
  if(!directory||!this.previous)return full();
  if(this.previous!==world){
   const proof=readResidentCollectionChanges379(this.previous,world,'resources'),base=proof&&readResidentResourceBaseChanges(this.previous,world);
   if(!proof||!base)return full();
   const affected=new Map<number,boolean>();
   for(const edge of base.edges){for(const row of edge.removed)affected.set(row.id,false);for(const row of edge.added)affected.set(row.id,true);for(const row of edge.updated)affected.set(row.id,true);}
   for(const [id,present] of affected){
    const source=directory.source(id),resource=source===undefined?undefined:world.resources[source];
    if(present!==!!resource||resource&&resource.id!==id)return full();
    if(resource)this.stats.resourceVisits++;
    if(resource?.blight)this.ids.add(id);else this.ids.delete(id);
   }
  }
  // Set iteration order is not a rendering or first-target authority. Restore
  // the exact current resource ordinal order for alert focus cycling.
  const rows:{source:number;resource:Resource}[]=[];
  for(const id of this.ids){const source=directory.source(id);if(source===undefined)return full();const resource=world.resources[source];this.stats.resourceVisits++;
   if(!resource||resource.id!==id||!resource.blight)return full();
   if(knownPosition256(world,resource))rows.push({source,resource});
  }
  this.previous=world;this.stats.deltaReads++;rows.sort((a,b)=>a.source-b.source);return rows.map(row=>row.resource);
 }
}
