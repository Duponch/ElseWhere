/** PRIVATE component draft; intended src/render/models/FixedTreeCohort.ts.
 * Prospective metadata only. No SceneResourceIndex, World, geometry or pixels
 * are mutated before the actual presentation World is admitted by Core. */
import type {World,Resource} from '../../sim/types';
import {readSnapshotChanges} from '../../bridge/snapshot-changes';
import {composeFinalResourceStructure} from '../natural-presentation-events';
import type {TreeBakeDemand} from '../origami/TreeBakeOwner';
import {TREE_MODEL_SPECIES,isTreeModelSpecies,treeModelVariant,type TreeModels,type TreeModelSpecies,type TreeModelVariant} from './TreeModels';

export interface FixedTreeCohortPlan extends TreeBakeDemand {
 readonly world:World;
 readonly traversal:'full'|'certified-journal';
 readonly inspectedResources:number;
 readonly counts:readonly number[];
 readonly variant:TreeModelVariant;
}
type Pending={generation:number;world:World;byId:ReadonlyMap<number,TreeModelSpecies>;counts:readonly number[]};
const slots=new Map(TREE_MODEL_SPECIES.map((species,index)=>[species,index]));
function named(r:Resource):TreeModelSpecies|undefined{
 if(r.kind!=='tree'||r.species===undefined)return;
 if(!isTreeModelSpecies(r.species))throw Error('Unknown actual named tree species');
 return r.species;
}

/** The only fast-lane witnesses are existing private decoder journal readers.
 * The immutable option enables trying them; it cannot certify a shortcut by
 * itself. Uncertified, self, mutable and reset inputs receive a full scan.
 * Neither this class nor its owner is called by stable render frames. */
export class FixedTreeCohorts {
 private world:World|undefined;
 private byId:ReadonlyMap<number,TreeModelSpecies>=new Map();
 private counts:readonly number[]=Object.freeze(TREE_MODEL_SPECIES.map(()=>0));
 private generation=0;private closed=false;
 private readonly plans=new WeakMap<FixedTreeCohortPlan,Pending>();
 constructor(private readonly models:Pick<TreeModels,'get'>){}
 inspect(world:World,options:{reset?:boolean;immutableSnapshot?:boolean}={}):FixedTreeCohortPlan{
  if(this.closed)throw Error('Tree cohort projection closed');
  const from=this.world,proof=options.immutableSnapshot&&!options.reset&&from&&from!==world&&from.seed===world.seed&&from.width===world.width&&from.height===world.height
   ?composeFinalResourceStructure(from,world):undefined;
  let byId:ReadonlyMap<number,TreeModelSpecies>,counts:readonly number[],inspectedResources=0,traversal:FixedTreeCohortPlan['traversal']='full';
  if(proof&&proof.beforeCount===from!.resources.length&&proof.afterCount===world.resources.length&&readSnapshotChanges(from!,from!)&&readSnapshotChanges(world,world)){
   traversal='certified-journal';let edited:Map<number,TreeModelSpecies>|undefined,nextCounts:number[]|undefined;
   const replace=(id:number,value:TreeModelSpecies|undefined)=>{const old=(edited??this.byId).get(id);if(old===value)return;edited??=new Map(this.byId);nextCounts??=[...this.counts];if(old!==undefined){const at=slots.get(old)!;nextCounts[at]=nextCounts[at]!-1;edited.delete(id);}if(value!==undefined){const at=slots.get(value)!;nextCounts[at]=nextCounts[at]!+1;edited.set(id,value);}};
   for(const id of proof.removed)replace(id,undefined);
   for(const[id,source]of proof.present){const r=world.resources[source];if(!r||r.id!==id)throw Error('Certified tree cohort final ordinal mismatch');inspectedResources++;replace(id,named(r));}
   byId=edited??this.byId;counts=nextCounts?Object.freeze(nextCounts):this.counts;
  }else{
   const ids=new Set<number>(),all=new Map<number,TreeModelSpecies>(),tally=TREE_MODEL_SPECIES.map(()=>0);
   for(const r of world.resources){inspectedResources++;if(!Number.isSafeInteger(r.id)||r.id<=0||ids.has(r.id))throw Error('Unique actual resource IDs required');ids.add(r.id);const species=named(r);if(species!==undefined){all.set(r.id,species);const at=slots.get(species)!;tally[at]=tally[at]!+1;}}
   byId=all;counts=Object.freeze(tally);
  }
  if(counts.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('Invalid named tree cohort balance');
  const variant=treeModelVariant(world),models=Object.freeze(TREE_MODEL_SPECIES.filter((_,i)=>counts[i]!>0).map(species=>this.models.get(species,variant)).sort((a,b)=>a.surfaceSlot-b.surfaceSlot));
  for(const model of models)model.assertCurrent();
  const generation=this.generation,key=JSON.stringify(models.map(model=>model.key)),resources=world.resources,seed=world.seed,width=world.width,height=world.height,certifiedImmutable=options.immutableSnapshot===true&&readSnapshotChanges(world,world)!==undefined;
  const isCurrent=()=>{if(this.closed||generation!==this.generation||world.resources!==resources||world.seed!==seed||world.width!==width||world.height!==height||treeModelVariant(world)!==variant)return false;if(certifiedImmutable)return true;
   // Only unknown/mutable callers pay this conservative revalidation at an
   // async admission boundary. A public boolean cannot certify immutability.
   let actual=0;const seen=new Set<number>();for(const r of resources){if(!Number.isSafeInteger(r.id)||r.id<=0||seen.has(r.id))return false;seen.add(r.id);if(r.kind!=='tree'||r.species===undefined)continue;if(!isTreeModelSpecies(r.species)||byId.get(r.id)!==r.species)return false;actual++;}return actual===byId.size;
  };
  const plan:FixedTreeCohortPlan=Object.freeze({world,key,species:Object.freeze(models.map(model=>model.species!)),models,counts,variant,traversal,inspectedResources,isCurrent});
  this.plans.set(plan,{generation,world,byId,counts});return plan;
 }
 /** Invoke only after that exact World has actually updated its scene. A
  * failed/deferred scene update leaves the previous ledger untouched. */
 commit(plan:FixedTreeCohortPlan):void{
  const pending=this.plans.get(plan);if(this.closed||!pending||pending.generation!==this.generation||!plan.isCurrent())throw Error('Stale or foreign tree cohort projection');
  this.world=pending.world;this.byId=pending.byId;this.counts=pending.counts;this.plans.delete(plan);this.generation++;
 }
 snapshot(){return{generation:this.generation,namedTrees:this.counts.reduce((n,v)=>n+v,0),species:this.counts.filter(n=>n>0).length,closed:this.closed};}
 isCommittedWorld(world:World):boolean{return!this.closed&&this.world===world;}
 dispose():void{if(this.closed)return;this.closed=true;this.world=undefined;this.byId=new Map();this.counts=Object.freeze(TREE_MODEL_SPECIES.map(()=>0));this.generation++;}
}
