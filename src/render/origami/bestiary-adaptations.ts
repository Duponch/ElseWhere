// Explicit authored adaptations. None of these seven species has a literal
// model in the supplied HTML. Parent recipes/materials remain unchanged.
// Only construction-time geometry; no renderer, World, rule, RNG or animation.
import type * as Three from 'three/webgpu';
import type {ThreeAPI,Triple,BestiaryMesh,BestiaryMaterial,BestiaryGroup,PartOptions,RegisterMaterial,CreatePart,BestiaryFactory} from './bestiary-types';
import {createBestiaryReference} from './bestiary-reference.literal';
import {addSurfaceEyes,referenceSurfaceHit} from './bestiary-presentation';
export {ADAPTATION_SOURCE_KEYS,ADAPTATION_PAINT_DESCRIPTORS} from './bestiary-adaptation-paint';

export const BESTIARY_ADAPTATION_MANIFEST=Object.freeze({
 status:'PRODUCT_AUTHORED_ADAPTATIONS',literalCopies:false,productionIntegrated:true,
 source:'Authored adaptations of the supplied bestiary; complete source palettes reused without modifying shared materials',
 sourceSha256:'2f64fb66c94e4fc92262ed73d8021c1ee8f88ebac5f21f14303223e0990a86ed',
 protectedExistingIdentitiesModified:false,simulationModified:false,
 species:Object.freeze({
  cat:{parent:'cougar',label:'Chat',changes:['compact feline proportions','short muzzle and cream whisker pads','triangular closed ears','slender rising articulated tail','surface-anchored eyes'],legs:4,antlers:0,bodyLength:.6732},
  megascarab:{parent:'spelopede',label:'Mégascarabée',changes:['short broad beetle body','paired closed wing covers','shortened mandibles','six source leg pivots retained','two surface-anchored source amber eyes'],legs:6,antlers:0},
  elk:{parent:'caribou',label:'Wapiti',changes:['larger chest and longer legs','longer neck and head','two attached branched antlers','source auburn/mane/antler palettes','surface-anchored eyes'],legs:4,antlers:2,bodyLength:1.472},
  'arctic-fox':{parent:'fennec',label:'Renard arctique',changes:['snow source palette','shorter muzzle and compact body','short closed triangular ears replacing oversized fennec ears','fuller source tail','surface-anchored eyes'],legs:4,antlers:0,bodyLength:1.1616},
  monkey:{parent:'raccoon',label:'Singe',changes:['upright leaning trunk','long front arms and separate palms','short rear legs and feet','short muzzle and front-facing eyes','rounded closed ears','curved narrow tail'],legs:4,antlers:0,bodyLength:.56},
  rat:{parent:'guinea_pig',label:'Rat',changes:['long low trunk','tapered muzzle and pink nose','rounded closed ears','long narrow bare tail','four existing small-mammal leg pivots','surface-anchored eyes'],legs:4,antlers:0,bodyLength:.6665},
  'arctic-wolf':{parent:'timber_wolf',label:'Loup arctique',changes:['snow source palette','broader taller chest and longer legs','blunter long muzzle','closed triangular ears','full tail','surface-anchored eyes'],legs:4,antlers:0,bodyLength:1.518},
 }),
 bounds:'Each build records its actual full transformed Box3, head/leg/tail pivots and measured trunk X span. Nominal bodyLength values above describe the authored recipe, not gameplay size.',
 anatomy:'Visual ownership hints only. Insect six-leg order and monkey front-arm roles require mapping to existing clinical records during integration; no clinical member is added here.',
});

export type BestiaryAdaptationId=keyof typeof BESTIARY_ADAPTATION_MANIFEST.species;
export interface BestiaryAdaptationFactory extends BestiaryFactory {readonly manifest:typeof BESTIARY_ADAPTATION_MANIFEST}

export function createBestiaryAdaptations(THREE:ThreeAPI,registerMaterial?:RegisterMaterial,createPart?:CreatePart,reference?:BestiaryFactory):BestiaryAdaptationFactory{
 const canonical=reference??createBestiaryReference(THREE,registerMaterial,createPart);
 const pigments=new Map(canonical.materialRecords.map(row=>[row.key,row.material]));
 const pigment=(key:string):BestiaryMaterial=>{const value=pigments.get(key);if(!value)throw Error('Missing adaptation source pigment: '+key);return value;};
 const part:CreatePart=createPart??((geometry,material,options={})=>{
  const prepared=geometry.index?geometry.toNonIndexed():geometry.clone();prepared.computeVertexNormals();
  const mesh=new THREE.Mesh(prepared,material),rotation=options.rot??[0,0,0];mesh.position.fromArray(options.pos??[0,0,0]);mesh.rotation.set(rotation[0]!,rotation[1]!,rotation[2]!);mesh.scale.fromArray(options.scale??[1,1,1]);
  mesh.castShadow=options.castShadow??true;mesh.receiveShadow=options.receiveShadow??true;mesh.userData.referenceEdgeAngle=options.edgeAngle??22;return mesh;
 });
 const charcoal=pigment('matCharcoalGouache'),cream=pigment('matCreamWhiteGouache'),pink=pigment('matPinkEarGouache'),snow=pigment('matSnowWhiteGouache');
 function isMesh(object:Three.Object3D):object is BestiaryMesh{return object instanceof THREE.Mesh;}
 function requireMesh(object:Three.Object3D|undefined):BestiaryMesh{if(!object||!isMesh(object))throw Error('Expected a parent source mesh');return object;}
 function tailOf(root:BestiaryGroup):Three.Group{const value=root.userData.tailGroup;if(!value)throw Error('Missing parent tail group');return value;}
 function mesh(geometry:Three.BufferGeometry,material:BestiaryMaterial,options:PartOptions|undefined,name:string,role?:string):BestiaryMesh{
  const value=part(geometry,material,options??{});value.name=name;value.userData.referenceAnatomyRole=role??name;value.userData.referenceAuthoredAdaptation=true;return value;
 }
 function box(size:Triple,material:BestiaryMaterial,pos:Triple,name:string,role?:string,rot?:Triple):BestiaryMesh{return mesh(new THREE.BoxGeometry(size[0],size[1],size[2]),material,{pos,rot},name,role);}
 function remove(object:Three.Object3D):void{object.removeFromParent();object.traverse(child=>{if(isMesh(child))child.geometry.dispose();});}
 function clear(group:Three.Object3D):void{for(const child of group.children.slice())remove(child);}
 function replaceGeometry(target:BestiaryMesh,geometry:Three.BufferGeometry):void{const old=target.geometry;target.geometry=geometry.index?geometry.toNonIndexed():geometry.clone();target.geometry.computeVertexNormals();old.dispose();}
 function cutout(points:readonly (readonly [number,number])[],thickness:number):Three.BufferGeometry{
  const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false,steps:1});geometry.translate(0,0,-thickness*.5);return geometry;
 }
 function tapered(length:number,height:number,depth:number,frontY=.6,frontZ=.6,drop=0):Three.BufferGeometry{
  const geometry=new THREE.BoxGeometry(length,height,depth),p=geometry.getAttribute('position');
  for(let i=0;i<p.count;i++)if(p.getX(i)>length*.1){p.setY(i,p.getY(i)*frontY+drop);p.setZ(i,p.getZ(i)*frontZ);}
  geometry.computeVertexNormals();return geometry;
 }
 function segment(group:Three.Object3D,a:readonly number[],b:readonly number[],width:number,depth:number,material:BestiaryMaterial,name:string,role:string):BestiaryMesh{
  const start=new THREE.Vector3().fromArray(a),end=new THREE.Vector3().fromArray(b),direction=end.clone().sub(start),piece=mesh(new THREE.BoxGeometry(direction.length(),width,depth),material,{pos:start.clone().add(end).multiplyScalar(.5).toArray()},name,role);
  piece.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),direction.normalize());group.add(piece);return piece;
 }
 function chain(group:Three.Object3D,points:readonly (readonly number[])[],width:number,material:BestiaryMaterial,name:string,role:string):void{for(let i=1;i<points.length;i++)segment(group,points[i-1],points[i],width*(1-.12*(i-1)),width*(1-.12*(i-1)),material,`${name}-${i}`,role);}
 function recolor(root:Three.Object3D,from:BestiaryMaterial,to:BestiaryMaterial):void{root.traverse(object=>{if(isMesh(object)&&object.material===from)object.material=to;});}
 function head(root:BestiaryGroup):Three.Group{const value=root.userData.headGroup;if(!(value instanceof THREE.Group))throw Error('Missing parent head group');return value;}
 function body(root:BestiaryGroup):BestiaryMesh{const value=root.children.find(isMesh);if(!value)throw Error('Missing parent trunk');value.name='torso';value.userData.referenceAnatomyRole='torso';return value;}
 function eyes(root:BestiaryGroup,target:BestiaryMesh,material:BestiaryMaterial=charcoal):BestiaryMesh[]{
  const result=addSurfaceEyes(THREE,target,material);
  for(const eye of result){eye.userData.referenceEyeMark=0;eye.userData.referenceAuthoredAdaptation=true;}
  root.userData.referenceEyeMeshes=result;return result;
 }
 function frontEyes(root:BestiaryGroup,target:BestiaryMesh):void{
  const result:BestiaryMesh[]=[];
  for(const side of [-1,1]){
   const surface=referenceSurfaceHit(THREE,target.geometry,0,1,new THREE.Vector3(0,.07,side*.085));
   const eye=mesh(new THREE.BoxGeometry(.042,.045,.016),charcoal,{},side>0?'left-eye':'right-eye');
   target.add(eye);eye.position.copy(surface.point).addScaledVector(surface.normal,.009);eye.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),surface.normal);
   eye.userData.referenceEyeMark=0;eye.userData.referenceEyeSurface={point:surface.point.toArray(),normal:surface.normal.toArray(),clearance:.001};result.push(eye);
  }
  root.userData.referenceEyeMeshes=result;
 }
 function ears(group:Three.Object3D,coat:BestiaryMaterial,{x=0,y=.16,z=.13,width=.14,height=.18,thickness=.055}:{x?:number;y?:number;z?:number;width?:number;height?:number;thickness?:number}={}):void{
  for(const side of [-1,1]){
   const name=side>0?'left-ear':'right-ear';
   group.add(mesh(cutout([[-width*.5,0],[width*.5,0],[width*.08,height]],thickness),coat,{pos:[x,y,side*z],rot:[side*.10,0,-.10]},name,name));
   group.add(mesh(cutout([[-width*.30,.025],[width*.30,.025],[width*.06,height*.78]],thickness*.35),pink,{pos:[x,y,side*(z+thickness*.53)],rot:[side*.10,0,-.10]},`${name}-inner`,name));
  }
 }
 function roundEars(group:Three.Object3D,coat:BestiaryMaterial,x:number,y:number,z:number,radius:number):void{
  const points:[number,number][]=Array.from({length:8},(_,i)=>[Math.cos(i*Math.PI/4)*radius,Math.sin(i*Math.PI/4)*radius]);
  for(const side of [-1,1]){
   const role=side>0?'left-ear':'right-ear';
   group.add(mesh(cutout(points,.025),coat,{pos:[x,y,side*z]},role,role));
   group.add(mesh(cutout(points.map(([a,b]):[number,number]=>[a*.64,b*.64]),.012),pink,{pos:[x,y,side*(z+.015)]},`${role}-inner`,role));
  }
 }
 function cat():BestiaryGroup{
  const root=canonical.build('cougar'),coat=pigment('matChinchillaSilver'),sourceCoat=root.userData.primaryMaterial;
  recolor(root,sourceCoat,coat);const trunk=body(root);trunk.scale.set(.9,1.05,.9);root.scale.setScalar(.55);
  const h=head(root);clear(h);h.scale.setScalar(1.13);
  const skull=box([.38,.34,.36],coat,[.08,0,0],'head','head');h.add(skull);
  for(const side of [-1,1])h.add(box([.17,.14,.14],cream,[.24,-.065,side*.065],'muzzle','jaw'));
  h.add(box([.035,.035,.055],pink,[.335,-.025,0],'nose','nose'));
  ears(h,coat,{x:.015,y:.15,z:.13,width:.15,height:.17});eyes(root,skull,pigment('matBoomSacAmber'));
  const tail=tailOf(root);clear(tail);chain(tail,[[0,0,0],[-.23,-.06,0],[-.48,0,0],[-.65,.18,0],[-.63,.39,0]],.075,coat,'tail','tail');
  for(const leg of root.userData.legs){leg.scale.set(.95,1,.95);requireMesh(leg.children.at(-1)).material=cream;}
  root.userData.primaryMaterial=coat;return root;
 }
 function megascarab():BestiaryGroup{
  const root=canonical.build('spelopede'),coat=root.userData.primaryMaterial,trunk=body(root),abdomen=requireMesh(root.children.filter(isMesh)[1]);
  root.scale.set(.82,1.08,1.12);trunk.scale.set(.83,1.08,1.04);trunk.position.x=.16;
  replaceGeometry(abdomen,tapered(.62,.44,.30,.86,1));abdomen.position.set(-.30,.49,.15);abdomen.rotation.set(0,0,0);abdomen.name='left-wing-cover';abdomen.userData.referenceAnatomyRole='torso';
  root.add(mesh(tapered(.62,.44,.30,.86,1),coat,{pos:[-.30,.49,-.15]},'right-wing-cover','torso'));
  // The dark centre seam is an authored beetle shell detail, not a baked fill
  // border. Both covers are closed geometry attached to the same abdomen.
  segment(root,[-.61,.715,0],[.01,.6842,0],.014,.012,charcoal,'wing-cover-seam','torso');
  const h=head(root);const old=h.children.slice(),skull=requireMesh(old[0]);skull.name='head';skull.userData.referenceAnatomyRole='head';
  const mandibles=old.filter(isMesh).filter(child=>child!==skull&&child.material===charcoal);
  if(mandibles.length!==2)throw Error('Source beetle parent mandible topology changed');
  for(const mandible of mandibles){mandible.scale.x=.58;mandible.position.x=.24;mandible.name='mandible';mandible.userData.referenceAnatomyRole='jaw';}
  const existing=root.userData.referenceEyeMeshes??old.filter(isMesh).filter(child=>child.material===pigment('matBoomSacAmber'));
  if(existing.length!==2)throw Error('Source beetle parent eye topology changed');
  const installed=addSurfaceEyes(THREE,skull,charcoal,existing);for(const eye of installed)eye.userData.referenceEyeMark=0;root.userData.referenceEyeMeshes=installed;
  for(const [index,leg]of root.userData.legs.entries()){leg.scale.set(.90,.95,.95);leg.userData.referenceLimbOrdinal=index;leg.userData.referenceLimbKind='insect-leg';}
  return root;
 }
 function elk():BestiaryGroup{
  const root=canonical.build('caribou'),trunk=body(root);trunk.scale.set(1.15,1.12,1.12);trunk.position.y+=.12;
  for(const leg of root.userData.legs){leg.position.y+=.18;leg.position.x*=1.10;leg.scale.y=1.20;}
  const h=head(root),sourceNeck=requireMesh(h.children[0]),sourceMuzzle=requireMesh(h.children[1]).geometry.clone();
  for(const child of h.children.slice())if(child!==sourceNeck)remove(child);sourceNeck.name='neck';sourceNeck.userData.referenceAnatomyRole='neck';sourceNeck.scale.y=1.08;
  h.position.set(.64,1.35,0);sourceMuzzle.scale(.52/.46,.29/.26,.30/.26);
  const muzzle=mesh(sourceMuzzle,pigment('matDeerAuburn'),{pos:[.31,.56,0],rot:[0,0,-.08]},'muzzle','jaw');h.add(muzzle);
  h.add(box([.07,.065,.08],charcoal,[.59,.545,0],'nose','nose'));eyes(root,muzzle);
  for(const side of [-1,1]){
   h.add(box([.22,.10,.06],pigment('matDeerAuburn'),[.10,.66,side*.19],side>0?'left-ear':'right-ear',undefined,[side*.32,-side*.14,.28]));
   const antler=new THREE.Group();antler.name=side>0?'left-antler':'right-antler';antler.position.set(.10,.68,side*.12);antler.userData.referenceAnatomyRole='head';h.add(antler);
   const a=[0,0,0],b=[-.12,.30,side*.10],c=[-.30,.60,side*.18],d=[-.42,.84,side*.24];
   chain(antler,[a,b,c,d],.065,pigment('matAntlerCream'),'antler-beam','head');
   segment(antler,b,[.14,.48,side*.13],.045,.045,pigment('matAntlerCream'),'antler-tine-low','head');
   segment(antler,c,[-.02,.77,side*.22],.04,.04,pigment('matAntlerCream'),'antler-tine-high','head');
   segment(antler,d,[-.27,1.01,side*.27],.032,.032,pigment('matAntlerCream'),'antler-tip','head');
   antler.userData.referenceHornAnchor=antler.position.toArray();
  }
  const tail=tailOf(root);tail.position.set(-.73,1.36,0);tail.scale.set(.85,.8,.85);return root;
 }
 function arcticFox():BestiaryGroup{
  const root=canonical.build('fennec'),oldCoat=root.userData.primaryMaterial;recolor(root,oldCoat,snow);root.scale.set(.88,.86,1.04);
  for(const leg of root.userData.legs)leg.traverse(object=>{if(isMesh(object)&&object.material!==charcoal)object.material=snow;});
  const h=head(root),skullGeometry=requireMesh(h.children[0]).geometry.clone();clear(h);h.scale.set(1.02,1.04,1.08);
  const skull=mesh(skullGeometry,snow,{pos:[.08,0,0]},'head','head');h.add(skull);
  h.add(mesh(tapered(.40,.30,.34,.48,.45,-.03),snow,{pos:[.34,-.03,0]},'muzzle','jaw'),box([.075,.07,.075],charcoal,[.56,-.055,0],'nose','nose'));
  ears(h,snow,{x:.015,y:.17,z:.15,width:.17,height:.17,thickness:.06});eyes(root,skull);
  const tail=tailOf(root);tail.scale.set(1,1.18,1.18);for(const child of tail.children)requireMesh(child).material=snow;
  root.userData.primaryMaterial=snow;return root;
 }
 function monkey():BestiaryGroup{
  const root=canonical.build('raccoon'),coat=pigment('matSlothEarth'),skin=pigment('matCamelMuzzle'),trunk=body(root);
  replaceGeometry(trunk,new THREE.BoxGeometry(.56,.58,.34));trunk.material=coat;trunk.position.set(-.04,.58,0);trunk.rotation.z=.18;
  const h=head(root);clear(h);h.position.set(.30,.88,0);
  const skull=box([.34,.34,.32],coat,[.04,0,0],'head','head');h.add(skull,box([.22,.18,.27],skin,[.27,-.06,0],'muzzle','jaw'),box([.025,.04,.055],charcoal,[.385,-.045,0],'nose','nose'));
  frontEyes(root,skull);roundEars(h,coat,.01,.015,.17,.085);
  for(const leg of root.userData.legs)remove(leg);const legs:Three.Group[]=[];
  for(const front of [true,false])for(const side of [-1,1]){
   const limb=new THREE.Group();limb.position.set(front ? .10 : -.20,front ? .74 : .45,side*.15);limb.userData.referenceLimbKind=front?'front-arm':'rear-leg';limb.userData.referenceLimbOrdinal=legs.length;
   if(front)limb.add(box([.12,.30,.13],coat,[-.025,-.14,0],'upper-arm','front-limb',[0,0,-.14]),box([.10,.26,.10],coat,[.01,-.39,0],'forearm','front-limb',[0,0,.20]),box([.15,.08,.13],skin,[.08,-.55,0],'hand','front-paw'));
   else limb.add(box([.20,.26,.18],coat,[0,-.12,0],'thigh','rear-limb'),box([.12,.18,.13],coat,[.06,-.31,0],'lower-leg','rear-limb'),box([.24,.09,.16],skin,[.14,-.40,0],'foot','rear-paw'));
   root.add(limb);legs.push(limb);
  }
  root.userData.legs=legs;const tail=tailOf(root);clear(tail);tail.position.set(-.31,.50,0);chain(tail,[[0,0,0],[-.22,-.03,0],[-.45,.05,0],[-.59,.24,0],[-.52,.40,0]],.052,coat,'tail','tail');
  root.userData.primaryMaterial=coat;return root;
 }
 function rat():BestiaryGroup{
  const root=canonical.build('guinea_pig'),coat=pigment('matDonkeyDun'),trunk=body(root);replaceGeometry(trunk,new THREE.BoxGeometry(.6665,.2083,.2381));trunk.material=coat;trunk.position.y=.24;
  const h=head(root);clear(h);h.position.set(.37,.26,0);
  const skull=mesh(tapered(.30,.23,.23,.62,.45,-.015),coat,{pos:[.10,0,0]},'head','head');h.add(skull,box([.035,.035,.04],pink,[.26,-.025,0],'nose','nose'));
  roundEars(h,coat,.015,.13,.10,.085);eyes(root,skull);
  for(const leg of root.userData.legs){requireMesh(leg).material=coat;leg.userData.referenceAnatomyRole=leg.position.x>0?'front-limb':'rear-limb';leg.scale.set(1,.65,.8);leg.position.set(Math.sign(leg.position.x)*.24,.10,Math.sign(leg.position.z)*.10);}
  const tail=tailOf(root);clear(tail);
  // The corrected guinea-pig parent may attach its tiny native tail to the
  // torso mesh. This authored rat tail uses root-space points, so restore that
  // frame before placing it; otherwise the torso height is applied twice.
  if(tail.parent!==root)root.add(tail);
  tail.position.set(-.36,.24,0);chain(tail,[[0,0,0],[-.20,-.05,0],[-.44,-.10,.05],[-.62,-.13,.14]],.035,pink,'tail','tail');
  root.userData.primaryMaterial=coat;return root;
 }
 function arcticWolf():BestiaryGroup{
  const root=canonical.build('timber_wolf'),oldCoat=root.userData.primaryMaterial;recolor(root,oldCoat,snow);
  const trunk=body(root);trunk.scale.set(1.15,1.10,1.12);trunk.position.y+=.10;
  for(const leg of root.userData.legs){leg.position.set(Math.sign(leg.position.x)*.48,.60,Math.sign(leg.position.z)*.19);leg.scale.set(1.10,1.22,1.06);leg.traverse(object=>{if(isMesh(object)&&object.material!==charcoal)object.material=snow;});}
  const h=head(root);clear(h);h.position.set(.75,.95,0);
  const skull=box([.46,.42,.48],snow,[.08,0,0],'head','head');h.add(skull,mesh(tapered(.50,.32,.36,.68,.65,-.025),snow,{pos:[.40,-.04,0]},'muzzle','jaw'),box([.09,.08,.09],charcoal,[.65,-.055,0],'nose','nose'));
  ears(h,snow,{x:.005,y:.18,z:.17,width:.17,height:.23,thickness:.065});eyes(root,skull);
  root.add(box([.34,.42,.42],snow,[.53,.89,0],'neck','neck'));
  const tail=tailOf(root);tail.position.set(-.74,.78,0);tail.scale.set(1.02,1.10,1.10);for(const child of tail.children)requireMesh(child).material=snow;
  root.userData.primaryMaterial=snow;return root;
 }
 const builders:Readonly<Record<BestiaryAdaptationId,()=>BestiaryGroup>>=Object.freeze({cat,megascarab,elk,'arctic-fox':arcticFox,monkey,rat,'arctic-wolf':arcticWolf});
 const admitted=(id:string):id is BestiaryAdaptationId=>Object.hasOwn(builders,id);
 return Object.freeze({ids:Object.freeze(Object.keys(builders)),materialRecords:canonical.materialRecords,manifest:BESTIARY_ADAPTATION_MANIFEST,
  build(id:string):BestiaryGroup{
   if(!admitted(id))throw Error('Not one of the seven declared adaptations: '+id);
   const root=builders[id]();root.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root),trunk=body(root),trunkBounds=new THREE.Box3().setFromObject(trunk);
   // Pronotum plus both wing covers form one scarab torso. Head/tail/limbs
   // never inflate the adult body conversion anchor. Decorative source fur
   // plates may extend the torso bound; they remain rigid body-owned pieces.
   const limbs=new Set(root.userData.legs);
   for(const child of root.children)if(isMesh(child)&&!limbs.has(child)&&child.userData.referenceAnatomyRole!=='neck')trunkBounds.union(new THREE.Box3().setFromObject(child));
   if(bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))throw Error('Invalid authored adaptation bounds: '+id);
   let ordinal=0;root.traverse(object=>{if(isMesh(object)){if(!object.name)object.name=`adaptation-${id}-${ordinal}`;object.userData.referenceAdaptationPartOrdinal=ordinal++;}});
   const point=(object:Three.Object3D|undefined):number[]|null=>object?.getWorldPosition(new THREE.Vector3()).toArray()??null;
   root.userData.referenceAdaptation={id,parent:BESTIARY_ADAPTATION_MANIFEST.species[id].parent,literalCopy:false,productionIntegrated:true,changes:BESTIARY_ADAPTATION_MANIFEST.species[id].changes,
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray(),size:bounds.getSize(new THREE.Vector3()).toArray()},torsoBounds:{min:trunkBounds.min.toArray(),max:trunkBounds.max.toArray()},trunkLengthX:trunkBounds.max.x-trunkBounds.min.x,
    headPivot:point(root.userData.headGroup),legPivots:root.userData.legs.map(point),tailPivot:point(root.userData.tailGroup),meshCount:ordinal};
   if(root.userData.legs.length!==BESTIARY_ADAPTATION_MANIFEST.species[id].legs||root.userData.referenceEyeMeshes?.length!==2)throw Error('Adaptation anatomy metadata mismatch: '+id);
   return root;
  }
 });
}
