import * as THREE from 'three/webgpu';
import type {Resource,World} from '../../sim/types';
import {BLIGHT_COLOR,floraTreeHeight,hydroponicFloraHeight} from '../flora-presentation';
import type {Placement} from '../primitives';
import {compileOrigamiFloraReference,disposeOrigamiFloraReferenceParts,type OrigamiFloraReference,type OrigamiFloraReferencePart} from './flora-reference';
import {createPhysicalEdgeWearGeometry} from './reference-edges';

type BatchInput={geometry:THREE.BufferGeometry;items:Placement[]};
type DecoratedPart=OrigamiFloraReferencePart&{lines:THREE.BufferGeometry|null;wear:THREE.BufferGeometry|null};
type CanopyGroup={key:string;center:THREE.Vector3;width:number;depth:number};
type Recipe={parts:DecoratedPart[];height:number;canopies:Map<DecoratedPart,CanopyGroup>};
const references:Readonly<Record<string,OrigamiFloraReference>>={poplar:'poplar',oak:'oak',pine:'pine',saguaro:'cactus',bush:'bush','berry-bush':'bush'};
function variation(seed:number,id:number,salt:number):number {
  let word=Math.imul(seed^salt,374761393)^Math.imul(id,668265263);
  word=Math.imul(word^word>>>13,1274126177);
  return ((word^word>>>16)>>>0)/4294967296;
}
function groupSalt(key:string):number{let word=2166136261;for(let i=0;i<key.length;i++)word=Math.imul(word^key.charCodeAt(i),16777619);return word;}

/** A renderer owns one compiled source vocabulary. Every chunk consumes clones
 * into its existing body/canopy submissions, never scene objects per plant. */
export class ReferenceFloraLibrary {
  constructor(private readonly includeWear=true,private readonly includeContours=true){}
  private readonly recipes=new Map<OrigamiFloraReference,Recipe>();
  recipe(name:OrigamiFloraReference):Recipe {
    let recipe=this.recipes.get(name);if(recipe)return recipe;
    const source=compileOrigamiFloraReference(name);
    const parts:DecoratedPart[]=source.map(part=>{
      // Shared Default silhouettes borrow only the authored body vocabulary.
      // Neither edge extraction nor wear is prepared for that appearance.
      if(!this.includeContours)return {...part,lines:null,wear:null};
      const lines=new THREE.EdgesGeometry(part.sourceGeometry,part.edgeAngle);
      const wear=this.includeWear?createPhysicalEdgeWearGeometry(part.sourceGeometry,lines,0):null;
      lines.applyMatrix4(part.partMatrix);
      const normals=new Float32Array(lines.getAttribute('position').count*3);
      for(let i=1;i<normals.length;i+=3)normals[i]=1;
      lines.setAttribute('normal',new THREE.BufferAttribute(normals,3));
      lines.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(normals.length/3*2),2));
      if(wear){
        const expansion=wear.userData.expandDirArray as Float32Array;
        const directions=new Float32Array(expansion.length),linear=new THREE.Matrix3().setFromMatrix4(part.partMatrix),vector=new THREE.Vector3();
        for(let i=0;i<expansion.length;i+=3){vector.fromArray(expansion,i).applyMatrix3(linear);directions.set(vector.toArray(),i);}
        wear.applyMatrix4(part.partMatrix);
        wear.setAttribute('origamiWearExpand',new THREE.BufferAttribute(directions,3));
      }
      return {...part,lines,wear};
    });
    let height=0;
    for(const part of parts){part.geometry.computeBoundingBox();height=Math.max(height,part.geometry.boundingBox!.max.y);}
    const grouped=new Map<string,{center:THREE.Vector3;bounds:THREE.Box3;parts:DecoratedPart[]}>();
    for(const part of parts)if(part.canopy){
      const center=new THREE.Vector3().setFromMatrixPosition(part.partMatrix);
      // The four poplar fins form one source crown. Their radial offsets are
      // kept coherent; paired bush crests share their source center naturally.
      const fins=name==='poplar'&&part.sourceGeometry.type==='ExtrudeGeometry';
      if(fins){center.x=0;center.z=0;}
      const key=`${part.profileKey}:${fins?'fins:':''}${center.x.toFixed(3)}:${center.y.toFixed(3)}:${center.z.toFixed(3)}`;
      const previous=grouped.get(key);
      if(previous){previous.parts.push(part);previous.bounds.union(part.geometry.boundingBox!);}
      else grouped.set(key,{center,bounds:part.geometry.boundingBox!.clone(),parts:[part]});
    }
    const canopies=new Map<DecoratedPart,CanopyGroup>();
    for(const [key,group]of grouped){
      const canopy={key,center:group.center,width:group.bounds.max.x-group.bounds.min.x,depth:group.bounds.max.z-group.bounds.min.z};
      for(const part of group.parts)canopies.set(part,canopy);
    }
    recipe={parts,height,canopies};this.recipes.set(name,recipe);return recipe;
  }
  createBatch():ReferenceFloraBatch{return new ReferenceFloraBatch(this);}
  dispose():void {
    for(const {parts}of this.recipes.values()){
      disposeOrigamiFloraReferenceParts(parts);
      for(const part of parts){part.lines?.dispose();part.wear?.dispose();}
    }
    this.recipes.clear();
  }
}

export class ReferenceFloraBatch {
  private readonly placements=new Map<DecoratedPart,Placement[]>();
  constructor(private readonly library:ReferenceFloraLibrary){}
  append(world:World,resource:Resource,turn:number,size:number):boolean {
    const reference=resource.species?references[resource.species]:undefined;
    if(!reference||(resource.kind!=='tree'&&resource.species!=='bush'&&resource.species!=='berry-bush'))return false;
    const recipe=this.library.recipe(reference);
    const scale=size*(resource.kind==='tree'?floraTreeHeight(resource)/recipe.height:.83);
    const height=.94+variation(world.seed,resource.id,103)*.12;
    const width=.92+variation(world.seed,resource.id,229)*.16;
    const support=hydroponicFloraHeight(world,resource);
    for(const part of recipe.parts){
      if(part.fruit&&resource.kind!=='berries')continue;
      const key=part.fruit?-resource.id*2-1:part.canopy?-resource.id*2:resource.id;
      const item:Placement={key,targetId:resource.id,x:resource.x,y:support,z:resource.z,
        sx:scale*width,sy:scale*height,sz:scale*width,ry:turn,
        color:resource.blight?BLIGHT_COLOR:part.baseColor,referenceColor:part.baseColor,
        profile:part.profileId,rawGeometry:true};
      const canopy=resource.kind==='tree'?recipe.canopies.get(part):undefined;
      if(canopy){
        const salt=groupSalt(canopy.key),stretch=.94+variation(world.seed,resource.id,salt^613)*.12;
        const turnDelta=(variation(world.seed,resource.id,salt^719)-.5)*.16;
        const dx=(variation(world.seed,resource.id,salt^827)-.5)*.10*canopy.width;
        const dz=(variation(world.seed,resource.id,salt^941)-.5)*.10*canopy.depth;
        const {x:cx,y:cy,z:cz}=canopy.center,c=Math.cos(turnDelta),s=Math.sin(turnDelta);
        // A centered affine placement changes the crown, rather than scaling
        // its source offset away from the trunk. Wood remains unaltered.
        const tx=cx+dx-stretch*(cx*c+cz*s),tz=cz+dz-stretch*(cz*c-cx*s);
        const outerC=Math.cos(turn),outerS=Math.sin(turn),horizontal=scale*width;
        item.x+=horizontal*(tx*outerC+tz*outerS);item.z+=horizontal*(tz*outerC-tx*outerS);
        item.y+=scale*height*cy*(1-stretch);
        item.sx=item.sz=horizontal*stretch;item.sy=scale*height*stretch;item.ry=turn+turnDelta;
      }
      const items=this.placements.get(part);if(items)items.push(item);else this.placements.set(part,[item]);
    }
    return true;
  }
  parts(canopy:boolean,kind:'surface'|'lines'|'wear'='surface'):BatchInput[] {
    const result:BatchInput[]=[];
    for(const [part,items]of this.placements){
      if(part.canopy!==canopy)continue;
      const geometry=kind==='surface'?part.geometry:kind==='lines'?part.lines:part.wear;
      if(geometry)result.push({geometry:geometry.clone(),items});
    }
    return result;
  }
}
