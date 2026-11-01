import * as THREE from 'three/webgpu';
import {animalParts} from '../animal-shape';
import {animalCore256,isAnimalSpecies256} from '../../sim/animal-core-v256';
import {CORE_ANIMAL_BODIES_256} from '../../sim/animal-anatomy-data-v256';
import {animalPartId256} from '../../sim/animal-anatomy-v256';
import type {BodyPartId} from '../../sim/body-definition';
import {corpseVisualPartBit} from '../corpse-presentation';
import {bodyBloodRegion} from '../body-blood-word-297';
import {buildOrigamiAnimalReference,type OrigamiAnimalReference,type ReferencePigment} from './animal-reference';

/** Exact existing identities: the reference shepherd is adapted into three
 * actual breeds; its Cape buffalo is adapted into the woolly blue muffalo.
 * No reference identity is added to the simulation or save format. */
export const ORIGAMI_ANIMAL_REFERENCES:Readonly<Record<string,OrigamiAnimalReference>>=Object.freeze({
  'red-fox':'fox',dromedary:'camel',hare:'hare','snow-hare':'hare',
  'labrador-retriever':'dog',husky:'dog','yorkshire-terrier':'dog',
  muffalo:'buffalo',gazelle:'gazelle',deer:'deer',elephant:'elephant',
});
export const ORIGAMI_ANIMAL_SPECIES=Object.freeze(Object.keys(ORIGAMI_ANIMAL_REFERENCES));

type RefMesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
interface CompiledAnimal {vertices:Float32Array;paintUV:Float32Array;bodyCenter:number;reference:OrigamiAnimalReference;parts:number}
const compiledAnimals=new Map<string,CompiledAnimal>();
const ORIGIN=new THREE.Vector3();

/** The resident species rig is unchanged: one draw for the body, the same
 * packed anatomical masks and existing owner/cargo/interpolation attributes.
 * Transient reference meshes are flattened once, never retained per animal. */
export function origamiAnimalGeometry(capacity:number,species:string):THREE.InstancedBufferGeometry|undefined {
  const compiled=compileAnimal(species);if(!compiled)return;
  const g=new THREE.InstancedBufferGeometry(),v=new THREE.InterleavedBuffer(compiled.vertices,16);
  for(const [name,size,offset] of [['position',3,0],['normal',3,3],['color',3,6],['boneId',1,9],['bindPivot',3,13],['corpsePartMask',1,10],['bloodRegion',1,11],['eyeMark',1,12]] as const)g.setAttribute(name,new THREE.InterleavedBufferAttribute(v,size,offset));
  g.setAttribute('animalPart',new THREE.InterleavedBufferAttribute(v,4,9));
  // Same static UV stream as the original animal coat, now local to each real
  // paper primitive face so the shader cannot invent seams across the trunk.
  const paintUV=new THREE.BufferAttribute(compiled.paintUV,2);
  g.setAttribute('animalPaintUv',paintUV);g.setAttribute('uv',paintUV);
  const instances=new THREE.InstancedInterleavedBuffer(new Float32Array(capacity*33),33).setUsage(THREE.StaticDrawUsage);
  for(const [name,size,offset] of [['aFrom',4,0],['aTo',4,4],['aTravel',4,8],['aAnimal',4,12],['aScale',1,16],['aBodyBlood',1,17],['aAbsent',1,18],['aCarrier',4,19],['aCorpseHandoff',2,23],['aCorpseFrom',4,25],['aCorpseTo',4,29]] as const)g.setAttribute(name,new THREE.InterleavedBufferAttribute(instances,size,offset));
  g.setAttribute('aBiology',new THREE.InterleavedBufferAttribute(instances,3,16));
  g.userData.origamiReference=compiled.reference;g.userData.origamiParts=compiled.parts;g.userData.origamiBodyCenter=compiled.bodyCenter;
  g.instanceCount=0;return g;
}

export function origamiAnimalBodyCenter(species:string):number|undefined {return compileAnimal(species)?.bodyCenter;}

function belongsTo(object:THREE.Object3D,ancestor:THREE.Object3D|undefined):boolean {
  if(!ancestor)return false;
  for(let node:THREE.Object3D|null=object;node;node=node.parent)if(node===ancestor)return true;
  return false;
}

function nativeOwner(species:string,part:BodyPartId):BodyPartId {
  if(!isAnimalSpecies256(species))return part;
  const body=animalCore256(species).race.body,rows=CORE_ANIMAL_BODIES_256[body];
  // Some real native bodies (including Elephant) have no independent Tail
  // record. Keep the reference's visible tail as part of the real torso,
  // rather than inventing clinical anatomy or emitting an unmasked bit zero.
  if(part==='tail'&&!rows.some(row=>row.defId==='Tail'))return 'torso';
  const limb=/^(left|right)-(front|rear)-(leg|paw|hoof)$/.exec(part);
  if(limb){
    const legs=rows.filter(row=>row.defId==='Leg'),index=(limb[2]==='rear'?2:0)+(limb[1]==='right'?1:0),leg=legs[index];
    const row=limb[3]==='leg'?leg:leg&&rows.find(row=>row.parent===leg.index&&['Paw','Hoof','Foot'].includes(row.defId));
    return row?animalPartId256(body,row.index):part;
  }
  const sided=/^(left|right)-(eye|ear|tusk)$/.exec(part);
  const defs:Record<string,readonly string[]>={torso:['Torso'],neck:['Neck'],head:['Head','HeadWithEarHoles'],jaw:['AnimalJaw'],nose:['Nose'],tail:['Tail'],trunk:['Trunk'],hump:['Hump']};
  const names=sided?[sided[2][0].toUpperCase()+sided[2].slice(1)]:defs[part];
  const row=names&&(rows.find(row=>names.includes(row.defId)&&(!sided||row.side===sided[1]))
    ??(sided?.[2]==='tusk'?rows.filter(row=>row.defId==='Tusk')[sided[1]==='left'?0:1]:undefined));
  return row?animalPartId256(body,row.index):part;
}

function referenceOwner(mesh:RefMesh,root:THREE.Group,world:THREE.Vector3,leg:THREE.Object3D|undefined):BodyPartId {
  const name=mesh.name.toLowerCase(),side=world.z>0?'left':'right';
  if(leg){
    const at=leg.getWorldPosition(new THREE.Vector3()),end=at.x>0?'front':'rear';
    return `${side}-${end}-${name==='hoofmesh'?'hoof':'leg'}`;
  }
  if(name==='frontleg')return `${side}-front-leg`;
  if(name==='frontfoot')return `${side}-front-paw`;
  if(name==='haunch')return `${side}-rear-leg`;
  if(name==='foot')return `${side}-rear-paw`;
  if(name.includes('eye'))return `${side}-eye`;
  if(name.includes('ear')&&!name.includes('quarters'))return `${side}-ear`;
  if(name.includes('tusk'))return `${side}-tusk` as BodyPartId;
  if(name==='nose')return 'nose';
  if(name==='snout'||name==='muzzle')return 'jaw';
  if(name.includes('neck')||name==='collar')return 'neck';
  if(name.includes('hump'))return 'hump';
  if(belongsTo(mesh,root.userData.trunkGroup))return 'trunk' as BodyPartId;
  if(belongsTo(mesh,root.userData.tailGroup))return 'tail';
  return belongsTo(mesh,root.userData.headGroup)?'head':'torso';
}

function compileAnimal(species:string):CompiledAnimal|undefined {
  const reference=ORIGAMI_ANIMAL_REFERENCES[species];if(!reference)return;
  const cached=compiledAnimals.get(species);if(cached)return cached;
  const root=buildOrigamiAnimalReference(reference);
  adaptPhenotype(root,species);
  if(reference==='hare')splitHareFrontFeet(root);
  if(species==='gazelle')root.traverse(object=>{if(object instanceof THREE.Mesh&&object.name==='torso')paintGazelleFlank(object as RefMesh);});
  root.updateMatrixWorld(true);
  const original=animalParts(species),trunk=original[0],referenceLength={fox:1.32,camel:1.42,hare:.68,dog:1.26,buffalo:1.735,gazelle:1.06,deer:1.32,elephant:1.78}[reference];
  // Scale from the existing adult trunk length, independently of age/health;
  // the resident aBiology.x continues to own growth and body size effects.
  const scale=trunk.size[2]/referenceLength,bounds=new THREE.Box3().setFromObject(root),floor=bounds.min.y;
  const convert=(p:THREE.Vector3)=>p.set(-p.z*scale,(p.y-floor)*scale,p.x*scale);
  const data:number[]=[],paintUV:number[]=[],point=new THREE.Vector3(),normal=new THREE.Vector3(),center=new THREE.Vector3(),matrix=new THREE.Matrix3();
  const legs=root.userData.legs as THREE.Object3D[],head=root.userData.headGroup as THREE.Object3D;
  const headPivot=convert(head.getWorldPosition(new THREE.Vector3()));
  let count=0;
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||!object.visible)return;
    const mesh=object as RefMesh;
    if(mesh.geometry.index){const indexed=mesh.geometry;mesh.geometry=indexed.toNonIndexed();indexed.dispose();}
    const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal'),uv=paperFaceUV(mesh.geometry);
    mesh.getWorldPosition(center);matrix.getNormalMatrix(mesh.matrixWorld);
    // Hare front legs are already meshes in the original builder. Their pivot
    // is the hip, rather than the mesh centre used by the reference demo.
    const leg=legs.find(leg=>belongsTo(mesh,leg));
    let owner=referenceOwner(mesh,root,center,leg);
    const limb=owner.includes('-front-')||owner.includes('-rear-');
    const refPivot=leg?leg.getWorldPosition(new THREE.Vector3()):new THREE.Vector3(center.x,.32,center.z);
    if(reference==='hare'&&limb)refPivot.set(owner.includes('front')?.22:-.16,owner.includes('front')?.35:.27,Math.sign(center.z)*(owner.includes('front')?.13:.19));
    let bone=belongsTo(mesh,head)?3:0,pivot=bone===3?headPivot:ORIGIN;
    if(limb){
      const front=center.x>0?1:-1,side=center.z>0?-1:1;
      bone=front===side?1:2;pivot=convert(refPivot);
      // The reference uses the same dark hoof boxes for fox/dog paws.
      if(['fox','dog'].includes(reference))owner=owner.replace('-hoof','-paw') as BodyPartId;
    }
    const medical=nativeOwner(species,owner),bit=corpseVisualPartBit(medical,species),region=bodyBloodRegion(medical,true),isEye=owner.endsWith('-eye');
    const color=mesh.material.color,pigment=mesh.material.userData.pigment as ReferencePigment|undefined,paint=mesh.geometry.getAttribute('color');
    count++;
    for(let i=0;i<p.count;i++){
      point.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);convert(point);
      normal.fromBufferAttribute(n,i).applyNormalMatrix(matrix);normal.set(-normal.z,normal.y,normal.x);
      const tint=paint?new THREE.Color().fromBufferAttribute(paint,i):vertexPigment(species,mesh,pigment,color,p.getX(i),p.getY(i),p.getZ(i));
      data.push(point.x,point.y,point.z,normal.x,normal.y,normal.z,tint.r,tint.g,tint.b,bone,bit,region,isEye?0:-1,pivot.x,pivot.y,pivot.z);
      paintUV.push(uv[i*2],uv[i*2+1]);
    }
    // Death uses crossed eyes under the same anatomy bit and shader eyeMark
    // state as the existing renderer; the live pupil is not left on corpses.
    if(isEye){
      for(const roll of [-Math.PI/4,Math.PI/4]){
        const cross=new THREE.BoxGeometry(.025,.067,.010).toNonIndexed();
        cross.rotateZ(roll);cross.applyMatrix4(mesh.matrixWorld);
        const cp=cross.getAttribute('position'),cn=cross.getAttribute('normal'),cu=cross.getAttribute('uv');
        for(let i=0;i<cp.count;i++){
          point.fromBufferAttribute(cp,i);convert(point);normal.fromBufferAttribute(cn,i);normal.set(-normal.z,normal.y,normal.x);
          // Bring the cross just outside the original side-facing pupil.
          point.x+=Math.sign(point.x)*.017*scale;
          data.push(point.x,point.y,point.z,normal.x,normal.y,normal.z,color.r,color.g,color.b,bone,bit,region,1,pivot.x,pivot.y,pivot.z);
          paintUV.push(cu.getX(i),cu.getY(i));
        }
        cross.dispose();
      }
    }
  });
  const bodyCenter=({fox:.68,camel:1.24,hare:.42,dog:.74,buffalo:1.04,gazelle:.94,deer:1.08,elephant:1.28}[reference]-floor)*scale;
  root.traverse(object=>{if(object instanceof THREE.Mesh){const mesh=object as RefMesh;mesh.geometry.dispose();if(mesh.material.userData.adapter)mesh.material.dispose();}});
  const compiled={vertices:new Float32Array(data),paintUV:new Float32Array(paintUV),bodyCenter,reference,parts:count};compiledAnimals.set(species,compiled);return compiled;
}

/** Box UVs already delimit their actual faces. The source extrusion uses
 * metric UVs; normalize each coplanar cutout surface once at compilation. */
function paperFaceUV(geometry:THREE.BufferGeometry):Float32Array {
  const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv'),out=new Float32Array(p.count*2);
  if(!geometry.userData.paperCutout){
    for(let i=0;i<p.count;i++){out[i*2]=uv?.getX(i)??0;out[i*2+1]=uv?.getY(i)??0;}
    return out;
  }
  const groups=new Map<string,{indices:number[];minU:number;maxU:number;minV:number;maxV:number}>();
  for(let i=0;i<p.count;i++){
    const key=`${n.getX(i).toFixed(4)},${n.getY(i).toFixed(4)},${n.getZ(i).toFixed(4)}`;
    let group=groups.get(key);if(!group){group={indices:[],minU:Infinity,maxU:-Infinity,minV:Infinity,maxV:-Infinity};groups.set(key,group);}
    const u=uv.getX(i),v=uv.getY(i);group.indices.push(i);group.minU=Math.min(group.minU,u);group.maxU=Math.max(group.maxU,u);group.minV=Math.min(group.minV,v);group.maxV=Math.max(group.maxV,v);
  }
  for(const group of groups.values())for(const i of group.indices){out[i*2]=(uv.getX(i)-group.minU)/(group.maxU-group.minU||1);out[i*2+1]=(uv.getY(i)-group.minV)/(group.maxV-group.minV||1);}
  return out;
}

/** Preserve the characteristic dark flank band at close and distant zoom.
 * Split only the existing torso triangles at its two paint boundaries; no
 * additional material, mesh, instance stream or per-frame work is introduced. */
function paintGazelleFlank(mesh:RefMesh):void {
  const source=mesh.geometry,p=source.getAttribute('position'),n=source.getAttribute('normal'),uv=source.getAttribute('uv');
  type Vertex=number[];
  const positions:number[]=[],normals:number[]=[],coordinates:number[]=[],colors:number[]=[];
  const clip=(polygon:Vertex[],height:number,above:boolean):Vertex[]=>{
    const result:Vertex[]=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=above?a[1]>=height:a[1]<=height,insideB=above?b[1]>=height:b[1]<=height;
      if(insideA)result.push(a);
      if(insideA!==insideB){const t=(height-a[1])/(b[1]-a[1]);result.push(a.map((value,k)=>value+(b[k]-value)*t));}
    }
    return result;
  };
  for(let at=0;at<p.count;at+=3){
    const triangle=Array.from({length:3},(_,i)=>{const v=at+i;return [p.getX(v),p.getY(v),p.getZ(v),n.getX(v),n.getY(v),n.getZ(v),uv.getX(v),uv.getY(v)];});
    const bands=Math.abs(n.getY(at))>.9?[[Number.NEGATIVE_INFINITY,Number.POSITIVE_INFINITY,n.getY(at)<0?0xf0ece1:0xc98e4b]]:[[-Infinity,-.075,0xf0ece1],[-.075,0,0x2b1e16],[0,Infinity,0xc98e4b]];
    for(const [lo,hi,hex] of bands){
      let polygon=triangle;if(Number.isFinite(lo))polygon=clip(polygon,lo,true);if(Number.isFinite(hi))polygon=clip(polygon,hi,false);
      const color=new THREE.Color(hex);
      for(let j=1;j<polygon.length-1;j++)for(const vertex of [polygon[0],polygon[j],polygon[j+1]]){
        positions.push(...vertex.slice(0,3));normals.push(...vertex.slice(3,6));coordinates.push(...vertex.slice(6,8));colors.push(color.r,color.g,color.b);
      }
    }
  }
  mesh.geometry=new THREE.BufferGeometry();mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));mesh.geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));mesh.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(coordinates,2));mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));source.dispose();
}

/** Vertex paint carries the reference's broad colour layout. Fine gouache is
 * provided by the shared material, rather than a texture/draw per paper box. */
function vertexPigment(species:string,mesh:RefMesh,pigment:ReferencePigment|undefined,base:THREE.Color,x:number,y:number,z:number):THREE.Color {
  const color=base.clone();
  if(species==='snow-hare'&&!/eye|earinner/i.test(mesh.name))color.set(0xe3e0d5);
  if(pigment?.gradientTip&&x>0)color.lerp(new THREE.Color(pigment.gradientTip.color),.76);
  if(pigment?.flankStripe){
    if(y<-.04)color.set(pigment.flankStripe.bellyColor);
    else if(y<.04&&Math.abs(z)>.15)color.set(pigment.flankStripe.stripeColor);
  }
  return color;
}

function tintMesh(mesh:RefMesh,color:number):void {
  mesh.material=mesh.material.clone();mesh.material.color.set(color);mesh.material.userData={adapter:true};
}

/** The reference front shin is one box. Split it at the established paw
 * boundary without changing its exterior, so loss of a paw still hides that
 * part independently, just as it does in the default hare renderer. */
function splitHareFrontFeet(root:THREE.Group):void {
  const feet:RefMesh[]=[];
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||object.name!=='frontLeg')return;
    const mesh=object as RefMesh;mesh.geometry.dispose();mesh.geometry=new THREE.BoxGeometry(.12,.25,.12).toNonIndexed();mesh.position.y=.235;
    const foot=new THREE.Mesh(new THREE.BoxGeometry(.12,.11,.12).toNonIndexed(),mesh.material);
    foot.name='frontFoot';foot.position.set(mesh.position.x,.055,mesh.position.z);feet.push(foot);
  });
  root.add(...feet);
}

/** Breed adaptations retain the folded construction, but not a shepherd
 * phenotype on every dog. Sizes are inherited from existing species geometry. */
function adaptPhenotype(root:THREE.Group,species:string):void {
  if(species==='muffalo'){
    root.traverse(object=>{
      if(!(object instanceof THREE.Mesh))return;const mesh=object as RefMesh,name=mesh.name;
      if(/eye/i.test(name))return;
      tintMesh(mesh,/horn|boss/i.test(name)?0xd6c8a5:/tailtuft/i.test(name)?0x6e7b96:/headbox/i.test(name)?0x8795b0:0x95a3bd);
      if(name==='forequarters'){mesh.scale.y=1.22;mesh.position.y+=.10;}
      if(name==='headBox'){mesh.scale.y=1.28;mesh.position.y-=.06;}
    });
    // Broad overlapping paper folds give the actual muffalo its woolly
    // shoulder/head profile, while keeping reference swept horn construction.
    const material=registerAdapterMaterial(0x95a3bd),ruff=new THREE.Mesh(new THREE.BoxGeometry(.70,.30,.88),material);
    ruff.name='shoulderRuff';ruff.position.set(.23,1.48,0);root.add(ruff);
    const head=root.userData.headGroup as THREE.Group;
    for(const side of [-1,1]){
      const fold=new THREE.Mesh(new THREE.BoxGeometry(.44,.34,.12),material);fold.name='headRuff';fold.position.set(.11,-.26,side*.24);fold.rotation.x=side*.15;head.add(fold);
    }
    return;
  }
  if(!['labrador-retriever','husky','yorkshire-terrier'].includes(species))return;
  const husky=species==='husky',yorkie=species==='yorkshire-terrier';
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;const mesh=object as RefMesh,name=mesh.name;
    // No collar state exists in the animal projection; a reference costume
    // must not invent an equipped/owned collar in the real game.
    if(name==='collar'){mesh.visible=false;return;}
    if(name==='eye'||name==='nose')return;
    const pale=/chest|muzzle|sock|hoof|tailseg2/i.test(name);
    const tint=husky?(pale?0xe1e2d9:0x929a9b):yorkie?(/waist|tailseg1/i.test(name)?0x59616a:0xbe914f):(/muzzle|ear/i.test(name)?0xa68b68:0xb6a384);
    tintMesh(mesh,tint);
    if(name==='skull'){mesh.scale.set(husky?.91:yorkie?.84:1.08,husky?.96:yorkie?1.02:1.04,husky?.91:yorkie?.86:1.07);}
    if(name==='muzzle'){mesh.scale.x=husky?1.08:yorkie?.76:1.12;mesh.scale.z=husky?.84:yorkie?.81:1.03;}
    if(name==='earBase'){
      if(!husky&&!yorkie){mesh.scale.y=1.10;mesh.rotation.z=-.12;}
      else{
        mesh.geometry.dispose();mesh.geometry=new THREE.ConeGeometry(yorkie?.09:.10,yorkie?.27:.30,3).toNonIndexed();
        mesh.position.y=.34;mesh.position.z=Math.sign(mesh.position.z)*(yorkie?.15:.16);mesh.rotation.set(0,0,0);
      }
    }
    if(name==='earFlap'){
      if(husky||yorkie)mesh.visible=false;
      else{mesh.scale.y=1.30;mesh.position.y=.08;mesh.rotation.z=-.12;}
    }
    if(name==='tailSeg2'&&husky){mesh.position.y+=.09;mesh.rotation.z=-1.12;}
    if(name==='waist'&&yorkie){mesh.scale.y=1.17;}
  });
}
const adapterMaterials=new Map<number,THREE.MeshBasicMaterial>();
function registerAdapterMaterial(color:number):THREE.MeshBasicMaterial {
  let material=adapterMaterials.get(color);if(!material){material=new THREE.MeshBasicMaterial({color});adapterMaterials.set(color,material);}return material;
}
