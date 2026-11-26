import {Group,Matrix4,type Object3D} from 'three/webgpu';

/** A container supplied only to producers whose child LOCAL transforms are
 * fixed. Placements/motion belong to vertex or instance attributes instead.
 * Producers construct every mutable child container with the same capability;
 * additions (including deferred resource chunks) settle their matrices here.
 * No scene observer or traversal runs on a clean render frame. */
export class WorldCoordinateGroup extends Group {
 private prepared=false;
 private preparedParent:Object3D|null=null;
 private readonly beforeWorldUpdate=new Matrix4();
 private readonly counts={nativeTraversals:0,reusedTraversals:0,admissions:0,removed:0};
 constructor(){super();this.matrixAutoUpdate=false;}

 override add(...objects:Object3D[]):this {
  for(const object of objects)super.add(object);
  // Bring ancestors/current container up to date without scanning siblings.
  // If this actually moves the container, its existing children still need
  // the next complete native propagation as well as the new admissions.
  this.updateWorldMatrix(true,false);
  for(const object of objects)if(object.parent===this){object.updateMatrixWorld(true);this.counts.admissions++;}
  return this;
 }
 override remove(...objects:Object3D[]):this {
  const previous=objects.filter(object=>object.parent===this);
  for(const object of objects)super.remove(object);
  for(const object of previous){object.matrixWorldNeedsUpdate=true;this.counts.removed++;}
  return this;
 }
 /** Explicit escape hatch if an owner ever introduces a CPU-local pose.
  * Such a producer must invalidate the containing branch at the write. */
 invalidateWorldMatrices():void{for(let object:Object3D|null=this;object;object=object.parent)if(object instanceof WorldCoordinateGroup)object.matrixWorldNeedsUpdate=true;}
 override updateMatrixWorld(force?:boolean):void {
  if(this.prepared&&!force&&!this.matrixAutoUpdate&&!this.matrixWorldNeedsUpdate&&this.parent===this.preparedParent){this.counts.reusedTraversals++;return;}
  this.counts.nativeTraversals++;
  // Reparenting a prepared branch is a real transform invalidation even when
  // the receiving parent has already settled its own world matrix.
  super.updateMatrixWorld(force||!this.prepared||this.parent!==this.preparedParent);
  this.preparedParent=this.parent;this.prepared=true;
 }
 override updateWorldMatrix(updateParents:boolean,updateChildren:boolean,force=false):void {
  const pending=this.matrixWorldNeedsUpdate;
  this.beforeWorldUpdate.copy(this.matrixWorld);
  // A direct query may settle an ancestor's move before the next scene pass.
  // Recompute this branch root too, and remember whether its existing leaves
  // still require propagation; clearing Three's flag must not lose that work.
  super.updateWorldMatrix(updateParents,updateChildren,force||updateParents);
  if(updateChildren){this.preparedParent=this.parent;this.prepared=true;}
  else if(pending||this.parent!==this.preparedParent||!this.beforeWorldUpdate.equals(this.matrixWorld))this.prepared=false;
 }
 matrixMetrics(){return{...this.counts,name:this.name,children:this.children.length};}
}

/** Public/non-game producers retain ordinary THREE.Group semantics. */
export function worldCoordinateChild(parent:Group):Group{return parent instanceof WorldCoordinateGroup?new WorldCoordinateGroup():new Group();}
