import {TREE_CARGO_MODELS} from './tree-presentation';
import { HAIR_PARTS,BEARD_PARTS } from './pawn-appearance-shape';
import * as THREE from 'three/webgpu';
import { PAWN_MODEL_SCALE } from '../world/scale';
import { APPAREL } from '../sim/apparel-rules';
import {ITEM_VISUAL_IDS,itemCargoKind,itemGeometry,centreItemParts} from './item-presentation';
import {placementGeometry} from './item-portrait';
import { RESIDENT_WEAPON_VISUALS269 } from './weapon-shape';
import {currentGraphicsStyle} from './graphics-style';
import {origamiHumanGeometry} from './origami/human-geometry';

// Disjoint from weapon tags; -4 is the bolt-action rifle, not the parka hood.
export const PARKA_HOOD_DYE = -6;
export const FLAK_HELMET_DYE = -7;
export const RECON_HELMET_DYE = -8;
export const RECON_ARMOR_DYE = -9;
export const TUQUE_DYE = -10;
export const PLATE_ARMOR_DYE = -11;
export const SIMPLE_HELMET_DYE = -12;
// Face variants are resident in the same pawn batch. The vertex shader shows
// exactly one of them; portraits project the open-eye variant at rest.
export const PAWN_EYE_OPEN = 60;
export const PAWN_EYE_CLOSED = 61;
export const PAWN_EYE_CROSS = 62;
/** Presentation-only resident work props; never equipment or inventory. */
export const WORK_AXE_DYE = -30;
export const WORK_PICKAXE_DYE = -31;
export const WORK_SICKLE_DYE = -32;

/** Eight rigid bones, authored entirely in code. Each vertex has one bone influence.
 * The bind position/pivot and animation state are evaluated in the vertex shader.
 * There is no per-pawn AnimationMixer, bone Object3D tree or CPU bone update.
 * This deliberately small prototype rig is not yet the future glTF atlas importer.
 */
export function pawnGeometry(includeSmithing=false,includeMace=false,includeLongsword=false,includeSpear=false): THREE.InstancedBufferGeometry {
  const origami=currentGraphicsStyle()?.origami===true;
  if(origami)return origamiHumanGeometry(includeSmithing,includeMace,includeLongsword,includeSpear);
  const positions: number[] = [], normals: number[] = [], colors: number[] = [];
  const bones: number[] = [], pivots: number[] = [], dyes: number[] = [];
  const paperUV:number[]=[];
  const indices:number[]=[];
  // Small accessories retain their hard-edged shapes. The anatomical body is
  // authored as continuous exterior shells below, rather than overlapping
  // boxes whose internal caps remain visible around joints.
  const addPart = (size: number[], center: number[], bone: number, pivot: number[], color: number, dye = 0, roll = 0,
    taper?: readonly [topX:number,bottomX:number,topZ:number,bottomZ:number]) => {
    const box = new THREE.BoxGeometry(size[0], size[1], size[2]).toNonIndexed();
    if (taper) {
      const points=box.getAttribute('position');
      for(let i=0;i<points.count;i++) {
        const top=points.getY(i)>0;
        points.setX(i,points.getX(i)*(top?taper[0]:taper[1]));
        points.setZ(i,points.getZ(i)*(top?taper[2]:taper[3]));
      }
      box.computeVertexNormals();
    }
    if (roll) box.rotateZ(roll);
    const pos = box.getAttribute('position'), normal = box.getAttribute('normal'),uv=box.getAttribute('uv');
    const col = new THREE.Color(color);
    const base=bones.length;
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i) + center[0], pos.getY(i) + center[1], pos.getZ(i) + center[2]);
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      colors.push(col.r, col.g, col.b);
      bones.push(bone); pivots.push(...pivot); dyes.push(dye);
      if(origami)paperUV.push(uv.getX(i),uv.getY(i));
      indices.push(base+i);
    }
    box.dispose();
  };
  type Ring = { y:number; x:number; z:number; halfX:number; halfZ:number; corner:number };
  const addShell = (rings:readonly Ring[],bone:number,pivot:readonly [number,number,number],color:number,dye=0) => {
    if(origami){
      // Keep the authored silhouettes and medical/appearance identities, but
      // fold each envelope into four paper faces with sharp shared creases.
      // Vertices are duplicated per actual face for stable face-local paint.
      const tint=new THREE.Color(color),bottom=rings[0],top=rings[rings.length-1];
      const point=(r:Ring,side:number):number[]=>[r.x+([ -1,1,1,-1 ][side])*r.halfX,r.y,r.z+([ -1,-1,1,1 ][side])*r.halfZ];
      const emit=(points:readonly number[][],uvs:readonly number[][]):void=>{
        const a=new THREE.Vector3().fromArray(points[0]),b=new THREE.Vector3().fromArray(points[1]),c=new THREE.Vector3().fromArray(points[2]);
        const normal=b.sub(a).cross(c.sub(a)).normalize(),base=bones.length;
        for(let i=0;i<points.length;i++){
          positions.push(...points[i]);normals.push(normal.x,normal.y,normal.z);colors.push(tint.r,tint.g,tint.b);bones.push(bone);pivots.push(...pivot);dyes.push(dye);paperUV.push(...uvs[i]);
        }
        indices.push(base,base+1,base+2,base,base+2,base+3);
      };
      for(let band=0;band<rings.length-1;band++)for(let side=0;side<4;side++){
        const lower=rings[band],upper=rings[band+1],next=(side+1)%4;
        // A new paint sheet for each planar prism face, rather than seams at
        // arbitrary UV grid lines through the body or the exposed face.
        emit([point(lower,side),point(upper,side),point(upper,next),point(lower,next)],[[0,0],[0,1],[1,1],[1,0]]);
      }
      emit([point(bottom,0),point(bottom,1),point(bottom,2),point(bottom,3)],[[0,0],[1,0],[1,1],[0,1]]);
      emit([point(top,3),point(top,2),point(top,1),point(top,0)],[[0,0],[1,0],[1,1],[0,1]]);
      return;
    }
    const tint=new THREE.Color(color),sides=8;
    const contour=(ring:Ring,i:number):readonly [number,number,number] => {
      const {x,z,halfX:a,halfZ:b,corner:c,y}=ring;
      switch(i%sides) {
        case 0:return [x-a+c,y,z-b];case 1:return [x+a-c,y,z-b];
        case 2:return [x+a,y,z-b+c];case 3:return [x+a,y,z+b-c];
        case 4:return [x+a-c,y,z+b];case 5:return [x-a+c,y,z+b];
        case 6:return [x-a,y,z+b-c];default:return [x-a,y,z-b+c];
      }
    };
    const vertex=(v:readonly number[],n:THREE.Vector3):number=>{
      const index=bones.length;
      positions.push(v[0]!,v[1]!,v[2]!);normals.push(n.x,n.y,n.z);
      colors.push(tint.r,tint.g,tint.b);bones.push(bone);pivots.push(...pivot);dyes.push(dye);
      return index;
    };
    const points=rings.map(r=>Array.from({length:sides},(_,i)=>contour(r,i)));
    // The same contour points and averaged normals serve both adjoining bands.
    // This removes the waist's lighting seam without flattening all normals to
    // (0,1,0) as the rock surface does.
    const sideNormals=points.map((row,j)=>row.map((p,i)=>{
      const below=points[Math.max(0,j-1)]![i]!,above=points[Math.min(points.length-1,j+1)]![i]!;
      const left=row[(i+sides-1)%sides]!,right=row[(i+1)%sides]!;
      const vertical=new THREE.Vector3(above[0]-below[0],above[1]-below[1],above[2]-below[2]);
      const around=new THREE.Vector3(right[0]-left[0],right[1]-left[1],right[2]-left[2]);
      return vertical.cross(around).normalize();
    }));
    const sideIndex=points.map((row,j)=>row.map((p,i)=>vertex(p,sideNormals[j]![i]!)));
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<sides;i++){
      const next=(i+1)%sides;
      const a=sideIndex[j]![i]!,b=sideIndex[j]![next]!,c=sideIndex[j+1]![next]!,d=sideIndex[j+1]![i]!;
      // Exterior only: no face is emitted at any intermediate ring.
      indices.push(a,d,b,d,c,b);
    }
    const bottom=rings[0]!,top=rings[rings.length-1]!;
    const down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0);
    const bc=vertex([bottom.x,bottom.y,bottom.z],down),tc=vertex([top.x,top.y,top.z],up);
    const bCap=points[0]!.map(p=>vertex(p,down));
    const tCap=points[points.length-1]!.map(p=>vertex(p,up));
    for(let i=0;i<sides;i+=2){
      const a=bCap[i]!,b=bCap[i+1]!,c=bCap[(i+2)%sides]!;
      indices.push(bc,a,c,a,b,c);
      const ta=tCap[i]!,tb=tCap[i+1]!,tNext=tCap[(i+2)%sides]!;
      indices.push(tc,tNext,ta,tNext,tb,ta);
    }
  };
  const ring=(y:number,x:number,z:number,halfX:number,halfZ:number,corner:number):Ring=>({y,x,z,halfX,halfZ,corner});
  // A single closed jacket/pelvis envelope: the waist is just another contour
  // ring. It has no internal wall or second cap to expose when crouching.
  addShell([
    ring(.51,0,.035,.135,.112,.022),ring(.64,0,.025,.151,.125,.027),
    ring(.78,0,0,.158,.117,.026),ring(.965,0,0,.198,.133,.035),
    ring(1.035,0,0,.147,.105,.032),
  ],0,[0,.61,0],0xffffff,1);
  addShell([
    ring(1.04,0,.01,.112,.105,.021),ring(1.105,0,.01,.142,.13,.029),
    ring(1.295,0,.01,.151,.139,.031),ring(1.34,0,.01,.128,.118,.026),
  ],1,[0,1.04,0],0xe2b899,2);
  HAIR_PARTS.forEach((p,i)=>addPart([...p.size],[...p.center],1,[0,1.04,0],0xffffff,100+i));
  BEARD_PARTS.forEach((p,i)=>addPart([...p.size],[...p.center],1,[0,1.04,0],0xffffff,200+i));
  for (const side of [-1, 1]) {
    const arm = side < 0 ? 2 : 3, leg = side < 0 ? 4 : 5, calf = side < 0 ? 6 : 7;
    const shoulder=side*.226,hip=side*.105;
    addShell([
      ring(.70,side*.23,0,.052,.064,.014),ring(.79,shoulder,0,.059,.071,.017),
      ring(.94,shoulder,0,.067,.08,.019),ring(1.025,side*.219,0,.075,.086,.021),
    ],arm,[side*.23,1.01,0],0xffffff,1);
    addShell([ring(.59,side*.23,0,.051,.061,.012),ring(.71,side*.23,0,.057,.068,.014)],
      arm,[side*.23,1.01,0],0xe2b899,2);
    addShell([ring(.35,hip,0,.086,.113,.019),ring(.50,hip,0,.103,.128,.025),
      ring(.67,hip,0,.103,.132,.026)],leg,[hip,.61,0],APPAREL['cloth-tribalwear'].color,-3);
    addShell([ring(.39,hip,0,.060,.075,.014),ring(.50,hip,0,.067,.082,.017),
      ring(.655,hip,0,.076,.089,.018)],leg,[hip,.61,0],0x495052);
    addShell([ring(.16,hip,0,.061,.074,.013),ring(.28,hip,0,.067,.081,.016),
      ring(.405,hip,0,.071,.084,.017)],calf,[hip,.61,0],0x495052);
    addPart([0.145, 0.12, 0.23], [side * 0.105, 0.11, 0.03], calf, [side * 0.105, 0.61, 0], 0x443e37);
    addPart([.035,.035,.014],[side*.07,1.2,.157],1,[0,1.04,0],0x433e39,PAWN_EYE_OPEN);
    addPart([.068,.016,.016],[side*.07,1.2,.159],1,[0,1.04,0],0x433e39,PAWN_EYE_CLOSED);
    for(const [index,angle] of [-Math.PI/4,Math.PI/4].entries())
      addPart([.068,.015,.016],[side*.07,1.2,.160+index*.002],1,[0,1.04,0],0x433e39,PAWN_EYE_CROSS,angle);
  }
  addShell([ring(.68,0,0,.165,.13,.029),ring(.83,0,0,.191,.148,.034),
    ring(1.015,0,0,.205,.148,.039)],0,[0,.61,0],APPAREL['flak-vest'].color,-2);
  addPart([.12,.18,.025],[0,.86,.145],0,[0,.61,0],0x404c44,-2);
  // One resident faceted helmet follows the head bone in every pose. The
  // upper-head shell leaves eyes, jaw and beard exposed; no actor owns a mesh.
  addShell([ring(1.285,0,0,.170,.149,.032),ring(1.33,0,0,.188,.168,.039),
    ring(1.415,0,0,.171,.151,.035),ring(1.468,0,0,.103,.103,.025)],
  1,[0,1.04,0],APPAREL['flak-helmet'].color,FLAK_HELMET_DYE);
  addPart([.405,.026,.34],[0,1.304,.018],1,[0,1.04,0],0x424e51,FLAK_HELMET_DYE);
  // Original soft cap and folded cuff, one continuous resident head shell.
  addShell([ring(1.285,0,0,.180,.158,.036),ring(1.335,0,0,.184,.163,.038),
    ring(1.365,0,0,.173,.153,.036),ring(1.445,0,0,.149,.136,.032),
    ring(1.49,0,0,.072,.073,.020)],1,[0,1.04,0],APPAREL['cloth-tuque'].color,TUQUE_DYE);
  // The enclosed recon shell shares the head bone and the resident pawn rig.
  // Its low visor and cheek guards make it distinct from the open flak helmet.
  addShell([ring(1.065,0,0,.166,.145,.030),ring(1.16,0,0,.180,.162,.036),
    ring(1.35,0,0,.190,.169,.040),ring(1.425,0,0,.163,.150,.034),
    ring(1.48,0,0,.095,.096,.024)],
  1,[0,1.04,0],APPAREL['recon-helmet'].color,RECON_HELMET_DYE);
  addPart([.30,.075,.03],[0,1.208,.183],1,[0,1.04,0],0x344a57,RECON_HELMET_DYE);
  addPart([.155,.105,.036],[0,1.115,.176],1,[0,1.04,0],0x536a74,RECON_HELMET_DYE);
  for(const side of [-1,1])addPart([.052,.17,.22],[side*.167,1.14,.02],1,[0,1.04,0],0x637c84,RECON_HELMET_DYE);
  // Resident original recon plates follow the existing body/limb bones.
  addShell([ring(.67,0,0,.17,.14,.03),ring(.84,0,0,.205,.16,.04),ring(1.02,0,0,.22,.155,.04)],0,[0,.61,0],APPAREL['recon-armor'].color,RECON_ARMOR_DYE);
  addPart([.16,.21,.035],[0,.87,.17],0,[0,.61,0],0x536a74,RECON_ARMOR_DYE);
  addPart([.18,.12,.13],[0,.99,-.17],0,[0,.61,0],0x657c84,RECON_ARMOR_DYE);
  for(const side of [-1,1]){
    const arm=side<0?2:3,leg=side<0?4:5,calf=side<0?6:7,hip=side*.105;
    addShell([ring(.73,side*.23,0,.065,.076,.018),ring(.9,side*.23,0,.077,.09,.023),ring(1.04,side*.23,0,.10,.10,.025)],arm,[side*.23,1.01,0],APPAREL['recon-armor'].color,RECON_ARMOR_DYE);
    addShell([ring(.59,side*.23,0,.064,.075,.017),ring(.75,side*.23,0,.070,.082,.019)],arm,[side*.23,1.01,0],0x657c84,RECON_ARMOR_DYE);
    addShell([ring(.40,hip,0,.076,.092,.022),ring(.65,hip,0,.09,.106,.026)],leg,[hip,.61,0],APPAREL['recon-armor'].color,RECON_ARMOR_DYE);
    addShell([ring(.18,hip,0,.071,.085,.018),ring(.40,hip,0,.078,.096,.022)],calf,[hip,.61,0],0x657c84,RECON_ARMOR_DYE);
  }
  if(includeSmithing){
  // Original articulated plate harness, not a scaled copy of the recon suit.
  // Breast/plackart, collar, shoulders and limb plates follow the same eight
  // rigid bones, so every working/sleeping/carried pose and shadow agrees.
  addShell([ring(.63,0,0,.178,.146,.032),ring(.77,0,0,.181,.155,.035),
    ring(.94,0,0,.218,.168,.042),ring(1.025,0,0,.184,.141,.034)],0,[0,.61,0],0xffffff,PLATE_ARMOR_DYE);
  addPart([.11,.24,.035],[0,.86,.174],0,[0,.61,0],0xffffff,PLATE_ARMOR_DYE);
  addShell([ring(1.018,0,0,.13,.12,.025),ring(1.075,0,0,.118,.11,.023)],0,[0,.61,0],0xffffff,PLATE_ARMOR_DYE);
  for(const side of [-1,1]){
    const arm=side<0?2:3,leg=side<0?4:5,calf=side<0?6:7,hip=side*.105;
    addShell([ring(.86,side*.235,0,.076,.090,.022),ring(.99,side*.235,0,.112,.112,.030),ring(1.07,side*.226,0,.095,.104,.025)],arm,[side*.23,1.01,0],0xffffff,PLATE_ARMOR_DYE);
    addShell([ring(.60,side*.23,0,.060,.073,.015),ring(.79,side*.23,0,.075,.085,.020)],arm,[side*.23,1.01,0],0xffffff,PLATE_ARMOR_DYE);
    addShell([ring(.40,hip,0,.083,.102,.023),ring(.65,hip,0,.096,.113,.025)],leg,[hip,.61,0],0xffffff,PLATE_ARMOR_DYE);
    addShell([ring(.19,hip,0,.067,.083,.018),ring(.40,hip,0,.080,.102,.023)],calf,[hip,.61,0],0xffffff,PLATE_ARMOR_DYE);
  }
  // A pointed open-face cap, narrow rim and raised central reinforcement.
  // Eyes and beard remain exposed; only hair is masked by this headgear.
  addShell([ring(1.285,0,0,.176,.154,.030),ring(1.34,0,0,.186,.163,.035),
    ring(1.425,0,0,.142,.135,.031),ring(1.50,0,0,.040,.065,.017)],1,[0,1.04,0],0xffffff,SIMPLE_HELMET_DYE);
  addPart([.392,.028,.348],[0,1.302,.015],1,[0,1.04,0],0xffffff,SIMPLE_HELMET_DYE);
  addPart([.045,.055,.22],[0,1.445,-.008],1,[0,1.04,0],0xffffff,SIMPLE_HELMET_DYE);
  }
  // Resident parka hood; its visibility follows the outfit attribute.
  addPart([.34,.34,.14],[0,1.17,-.12],1,[0,1.04,0],0xffffff,PARKA_HOOD_DYE);
  // Ground weapon shapes run along X. Rifle barrel rises on its sling; the
  // revolver/knife point down at the hip, grip up against the belt.
  for(const variant of RESIDENT_WEAPON_VISUALS269)if((variant.item!=='mace-family'||includeMace)&&(variant.item!=='longsword-family'||includeLongsword)&&(variant.item!=='spear-family'||includeSpear))for(const part of variant.parts)addPart(
    [part.size[2],part.size[0],part.size[1]].map(n=>n/PAWN_MODEL_SCALE),
    [.205+part.center[2]/PAWN_MODEL_SCALE,.68+(variant.item==='bolt-action-rifle'||variant.item==='emp-launcher'||variant.item==='mace-family'||variant.item==='longsword-family'||variant.item==='spear-family'?1:-1)*part.center[0]/PAWN_MODEL_SCALE,part.center[1]/PAWN_MODEL_SCALE],0,[0,.61,0],part.color,variant.dye);
  if(origami){
    const hand=[.23,.62,.05],pivot=[.23,1.01,0],wood=0x8c623e,steel=0x85969a;
    const tool=(size:number[],at:number[],dye:number,color=steel,roll=0,taper?:readonly [number,number,number,number])=>addPart(size,[hand[0]+at[0],hand[1]+at[1],hand[2]+at[2]],3,pivot,color,dye,roll,taper);
    // These three rigid props share the actual right-arm bone and its bind
    // pivot. Confirmed job presentation alone chooses which one is visible.
    tool([.038,.61,.040],[0,.12,0],WORK_AXE_DYE,wood);
    tool([.22,.17,.045],[.09,.365,0],WORK_AXE_DYE,steel,0,[1.15,.78,1,1]);
    tool([.075,.10,.06],[-.045,.36,0],WORK_AXE_DYE,0x667478);
    tool([.038,.61,.040],[0,.12,0],WORK_PICKAXE_DYE,wood);
    tool([.25,.055,.055],[-.07,.365,0],WORK_PICKAXE_DYE,steel,-.12,[.9,1,.8,1]);
    tool([.22,.046,.046],[.155,.345,0],WORK_PICKAXE_DYE,steel,-.26,[.48,1,.55,1]);
    tool([.042,.38,.044],[0,.055,0],WORK_SICKLE_DYE,wood);
    // A short angular crescent made of connected paper-steel facets.
    tool([.16,.045,.032],[.055,.24,0],WORK_SICKLE_DYE,steel,.20);
    tool([.12,.04,.030],[.175,.285,0],WORK_SICKLE_DYE,steel,.55);
    tool([.09,.035,.028],[.235,.355,0],WORK_SICKLE_DYE,steel,1.03);
    tool([.07,.028,.024],[.235,.42,0],WORK_SICKLE_DYE,steel,1.75,[.35,1,.5,1]);
  }
  const geometry = new THREE.InstancedBufferGeometry();
  // WebGPU guarantees only eight vertex-buffer slots. Keeping authored attributes
  // interleaved leaves room for the seven independent per-instance attributes.
  const stride=origami?16:14;
  const vertexData = new Float32Array(bones.length * stride);
  for (let i = 0; i < bones.length; i++) {
    vertexData.set(positions.slice(i * 3, i * 3 + 3), i * stride);
    vertexData.set(normals.slice(i * 3, i * 3 + 3), i * stride + 3);
    vertexData.set(colors.slice(i * 3, i * 3 + 3), i * stride + 6);
    vertexData[i * stride + 9] = bones[i];
    if(origami){
      vertexData[i*stride+10]=dyes[i];
      vertexData.set(pivots.slice(i*3,i*3+3),i*stride+11);
      vertexData[i*stride+14]=paperUV[i*2];vertexData[i*stride+15]=paperUV[i*2+1];
    }else{
      vertexData.set(pivots.slice(i * 3, i * 3 + 3), i * stride + 10);
      vertexData[i * stride + 13] = dyes[i];
    }
  }
  const vertices = new THREE.InterleavedBuffer(vertexData, stride);
  geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(vertices, 3, 0));
  geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(vertices, 3, 3));
  geometry.setAttribute('color', new THREE.InterleavedBufferAttribute(vertices, 3, 6));
  geometry.setAttribute('boneId', new THREE.InterleavedBufferAttribute(vertices, 1, 9));
  geometry.setAttribute('bindPivot', new THREE.InterleavedBufferAttribute(vertices, 3, origami?11:10));
  geometry.setAttribute('dye', new THREE.InterleavedBufferAttribute(vertices, 1, origami?10:13));
  if(origami){
    // One shader input replaces separate bone/dye locations, leaving room
    // for actual face UVs within WebGPU's sixteen-attribute minimum.
    geometry.setAttribute('pawnRigTraits',new THREE.InterleavedBufferAttribute(vertices,2,9));
    const uv=new THREE.InterleavedBufferAttribute(vertices,2,14);
    geometry.setAttribute('origamiPaintUv',uv);geometry.setAttribute('uv',uv);geometry.userData.origami=true;
  }
  geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(indices),1));
  geometry.instanceCount = 0;
  return geometry;
}

/** Cargo is a second instanced batch sharing the pawn pose attributes. Its
 * attachment and interpolation stay on the GPU, including during camera motion.
 * Parts share the ground model. Individual logs are not individual items.
 */
export function cargoGeometry(): THREE.InstancedBufferGeometry {
  const data: number[] = [];
  const ranges:CargoGeometryRange[]=[],byKind:Record<number,CargoGeometryRange>={};
  const begin=(kind:number)=>({kind,start:data.length/11,count:0,materialIndex:0});
  const finish=(range:CargoGeometryRange)=>{range.count=data.length/11-range.start;Object.freeze(range);ranges.push(range);byKind[range.kind]=range;};
  const part = (size: number[], center: number[], kind: number, color: number,corpsePartMask=0) => {
    const box = new THREE.BoxGeometry(size[0], size[1], size[2]).toNonIndexed();
    const positions = box.getAttribute('position'), normals = box.getAttribute('normal');
    const tint = new THREE.Color(color);
    for (let i = 0; i < positions.count; i++) data.push(
      positions.getX(i) + center[0], positions.getY(i) + center[1], positions.getZ(i) + center[2],
      normals.getX(i), normals.getY(i), normals.getZ(i), tint.r, tint.g, tint.b, kind,corpsePartMask,
    );
    box.dispose();
  };
  // Packed furniture keeps its historical attachment and shader kind.
  const packedRange=begin(4);
  part([0.60,0.44,0.46],[0,0,0],4,0xb6996c);
  part([0.12,0.46,0.48],[0,0,0],4,0x6f634e);
  finish(packedRange);
  // Immutable all-item geometry is built once for the two resident cargo
  // batches. No meshes, selection, or portrait work is performed per frame.
  const transform=new THREE.Matrix4(),rotation=new THREE.Quaternion(),point=new THREE.Vector3(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
  for(const model of [...ITEM_VISUAL_IDS.filter(item=>item!=='minified-tree').map(item=>({item,kind:itemCargoKind(item),traits:undefined})),...TREE_CARGO_MODELS.map(model=>({item:'minified-tree' as const,kind:model.kind,traits:model.traits}))]){
    const {item,traits}=model;
    const kind=model.kind;
    const range=begin(kind);
    for(const p of centreItemParts(itemGeometry(item,undefined,undefined,traits),true)){
      const source=placementGeometry(p),positions=source.getAttribute('position'),normals=source.getAttribute('normal'),index=source.getIndex(),tint=new THREE.Color(p.color??0xb8ac96);
      rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),p.ry??0);
      transform.compose(new THREE.Vector3(p.x,p.y,p.z),rotation,new THREE.Vector3(p.sx??1,p.sy??1,p.sz??1));normalMatrix.getNormalMatrix(transform);
      for(let i=0;i<(index?.count??positions.count);i++){
        const vertex=index?index.getX(i):i;
        point.fromBufferAttribute(positions,vertex).applyMatrix4(transform);normal.fromBufferAttribute(normals,vertex).applyMatrix3(normalMatrix).normalize();
        data.push(point.x,point.y,point.z,normal.x,normal.y,normal.z,tint.r,tint.g,tint.b,kind,0);
      }
    }
    finish(range);
  }
  const vertices = new THREE.InterleavedBuffer(new Float32Array(data), 11);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(vertices, 3, 0));
  geometry.setAttribute('normal', new THREE.InterleavedBufferAttribute(vertices, 3, 3));
  geometry.setAttribute('color', new THREE.InterleavedBufferAttribute(vertices, 3, 6));
  geometry.setAttribute('cargoKind', new THREE.InterleavedBufferAttribute(vertices, 1, 9));
  geometry.setAttribute('corpsePartMask', new THREE.InterleavedBufferAttribute(vertices, 1, 10));
  geometry.userData.cargoRanges=Object.freeze(ranges);
  geometry.userData.cargoRangesByKind=Object.freeze(byKind);
  geometry.instanceCount = 0;
  return geometry;
}

export interface CargoGeometryRange {kind:number;start:number;count:number;materialIndex:number}
const activeCargoKinds=new WeakMap<THREE.BufferGeometry,string>();

type CargoGroups=THREE.BufferGeometry['groups'];
interface CargoCompilePreparation {
  groups:CargoGroups;saved:CargoGroups;override:CargoGroups[number]|undefined;
  count:number;warmCount:number;
}
const cargoCompilePreparations=new WeakMap<THREE.InstancedBufferGeometry,CargoCompilePreparation>();
function ownsCargoCompileGroups(geometry:THREE.InstancedBufferGeometry,state:CargoCompilePreparation):boolean {
  const expected=state.override?[state.override]:state.saved;
  return geometry.groups===state.groups&&geometry.groups.length===expected.length&&
    geometry.groups.every((group,index)=>group===expected[index]);
}
/** The producer has already written its new instanceCount before selection.
 * Retire only the temporary groups, even on an unchanged-kind cache hit. */
function releaseCargoCompileGroups(geometry:THREE.InstancedBufferGeometry):void {
  const state=cargoCompilePreparations.get(geometry);
  if(!state)return;
  cargoCompilePreparations.delete(geometry);
  if(state.override&&ownsCargoCompileGroups(geometry,state))
    geometry.groups.splice(0,geometry.groups.length,...state.saved);
}
/** One real packed range warms the existing material/attributes, including its
 * shadow pass. A later producer selection owns the new groups and count. */
export function prepareCargoGeometryForCompile(geometry:THREE.InstancedBufferGeometry):(stillOwned?:boolean)=>void {
  if(cargoCompilePreparations.has(geometry))throw new Error('Cargo geometry is already preparing');
  const groups=geometry.groups,saved=[...groups],count=geometry.instanceCount;
  const packed=(geometry.userData.cargoRangesByKind as Record<number,CargoGeometryRange>|undefined)?.[4];
  if(!groups.length&&(!packed||!Number.isInteger(packed.count)||packed.count<=0))throw new Error('Packed cargo preparation range is missing');
  // A unique immutable copy distinguishes the override from a real selection.
  const override=groups.length?undefined:Object.freeze({...packed!});
  const state:CargoCompilePreparation={groups,saved,override,count,warmCount:Math.max(1,count)};
  if(override)groups.splice(0,groups.length,override);
  geometry.instanceCount=state.warmCount;
  cargoCompilePreparations.set(geometry,state);
  return(stillOwned=true)=>{
    if(cargoCompilePreparations.get(geometry)!==state)return;
    cargoCompilePreparations.delete(geometry);
    if(!stillOwned||!ownsCargoCompileGroups(geometry,state))return;
    if(override)groups.splice(0,groups.length,...saved);
    if(geometry.instanceCount===state.warmCount)geometry.instanceCount=count;
  };
}

/** Groups only change where the producer changes cargo kinds. A single-entry
 * material array makes Three submit these ranges with the same shader/material.
 * Source vertices and the actor instance order never change. Immutable range
 * metadata survives the population-growth clone; selection is geometry-local
 * because Three's clone shares userData but copies the groups array. */
export function selectCargoGeometryKinds(geometry:THREE.InstancedBufferGeometry,kinds:ReadonlySet<number>):void {
  releaseCargoCompileGroups(geometry);
  const byKind=geometry.userData.cargoRangesByKind as Record<number,CargoGeometryRange>|undefined;
  if(!byKind)throw new Error('Cargo geometry ranges are missing');
  const selected:CargoGeometryRange[]=[];
  for(const kind of kinds){const range=byKind[kind];if(range&&range.count)selected.push(range);}
  selected.sort((a,b)=>a.start-b.start);
  const signature=selected.map(range=>range.kind).join(',');
  if(activeCargoKinds.get(geometry)===signature)return;
  geometry.groups.splice(0,geometry.groups.length,...selected);
  activeCargoKinds.set(geometry,signature);
}

/** Owns GPU actor/cargo batches; receives snapshots, never simulates gameplay. */
