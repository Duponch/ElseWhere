import * as THREE from 'three/webgpu';

/** The common human construction from buildRimWorldColonist in the supplied
 * atelier...(6).html. Dimensions and local placements below are the author's,
 * before the single uniform conversion into the game's model coordinates.
 * Roles, invented equipment, scene clocks and per-person meshes are excluded. */
export const HUMAN_PAINT_PROFILES = {
  skin:0,shirt:1,outerwear:2,pants:3,hair:4,hat:5,charcoal:6,wood:7,steel:8,
} as const;
export type HumanPaintProfile=typeof HUMAN_PAINT_PROFILES[keyof typeof HUMAN_PAINT_PROFILES];
export const HUMAN_REFERENCE_PIGMENTS=Object.freeze([
  {baseColor:'#e0b18d',secondaryColor:'#c99773',strokeStyle:'directional',strokeCount:220},
  {baseColor:'#3b6e8c',secondaryColor:'#2c556e',strokeStyle:'wavy',strokeCount:320},
  {baseColor:'#70482c',secondaryColor:'#57361f',strokeStyle:'coarse',strokeCount:360},
  {baseColor:'#3c424a',secondaryColor:'#2b3036',strokeStyle:'directional',strokeCount:260},
  {baseColor:'#4a3222',secondaryColor:'#332115',strokeStyle:'wavy',strokeCount:240},
  {baseColor:'#8c5832',secondaryColor:'#6e4323',strokeStyle:'directional',strokeCount:260},
  {baseColor:'#1a1917',secondaryColor:'#2c2926',strokeStyle:'coarse',strokeCount:180},
  {baseColor:'#7d4e2d',secondaryColor:'#5c371e',strokeStyle:'directional',strokeCount:180},
  {baseColor:'#6c767d',secondaryColor:'#4c5459',accentColor:'#909ca3',strokeStyle:'directional',strokeCount:220},
] as const);
export type HumanPoint=readonly [number,number,number];
export interface OrigamiHumanPart {
  id:string;geometry:THREE.BufferGeometry;at:HumanPoint;bone:number;pivot:HumanPoint;
  dye:number;profile:HumanPaintProfile;color:number;roll?:number;
}
export const HUMAN_REFERENCE_BIND=Object.freeze({
  hipY:.56,headY:1.22,shoulderY:1.12,shoulderX:.32,hipX:.13,
  handY:.82,handZ:0,kneeY:.35,footY:.08,
});

/** Literal createVerticalPrismGeometry algorithm from the reference. It starts
 * with one box and changes only the top/bottom extents, then recomputes the
 * six flat face normals. There is no old anatomical ring-shell involved. */
export function humanVerticalPrism(topX:number,topZ:number,bottomX:number,bottomZ:number,heightY:number,shearX=0,shearZ=0):THREE.BufferGeometry {
  const source=new THREE.BoxGeometry(1,heightY,1),position=source.getAttribute('position');
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    position.setX(i,x*(y>0?topX:bottomX)+(y>0?shearX:0));
    position.setZ(i,z*(y>0?topZ:bottomZ)+(y>0?shearZ:0));
  }
  const geometry=source.toNonIndexed();source.dispose();geometry.computeVertexNormals();return geometry;
}

export function humanBox(x:number,y:number,z:number):THREE.BufferGeometry {
  const source=new THREE.BoxGeometry(x,y,z),geometry=source.toNonIndexed();source.dispose();return geometry;
}

function trouserHalf(topX:number,topZ:number,bottomX:number,bottomZ:number,upper:boolean):THREE.BufferGeometry {
  const geometry=humanVerticalPrism(topX,topZ,bottomX,bottomZ,.21),normal=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
  // The original pants are painted as one .42-high object. Splitting their
  // rig must not repeat/stretch the authored paint on either half.
  for(let i=0;i<uv.count;i++)if(Math.abs(normal.getY(i))<.9)uv.setY(i,uv.getY(i)*.5+(upper?.5:0));
  return geometry;
}

/** Unposed reference anatomy. The reference's one-piece trousers are split
 * exactly along their existing linear faces at the knee, with the same outer
 * surface, to follow the game's existing calf bones during sitting. */
export function buildOrigamiHumanReference():OrigamiHumanPart[] {
  const parts:OrigamiHumanPart[]=[],profile=HUMAN_PAINT_PROFILES;
  const add=(id:string,geometry:THREE.BufferGeometry,at:HumanPoint,bone:number,pivot:HumanPoint,dye:number,paint:HumanPaintProfile,color=0xffffff,roll?:number)=>parts.push({id,geometry,at,bone,pivot,dye,profile:paint,color,roll});
  const head:HumanPoint=[0,1.22,0],hip:HumanPoint=[0,.56,0];
  add('reference-torso',humanVerticalPrism(.46,.30,.52,.34,.64),[0,.88,0],0,hip,1,profile.shirt);
  add('reference-head',humanVerticalPrism(.36,.36,.33,.33,.38),[0,1.42,0],1,head,2,profile.skin);
  add('reference-nose',humanBox(.06,.08,.06),[0,1.41,.19],1,head,2,profile.skin);
  for(const side of [-1,1]){
    const name=side<0?'left':'right',arm=side<0?2:3,leg=side<0?4:5,calf=side<0?6:7;
    const shoulder:HumanPoint=[side*.32,1.12,0],legPivot:HumanPoint=[side*.13,.56,0];
    add(`reference-${name}-eye`,humanBox(.05,.05,.03),[side*.09,1.44,.18],1,head,60,profile.charcoal,0x1a1917);
    add(`reference-${name}-ear`,humanBox(.05,.10,.07),[side*.19,1.42,0],1,head,2,profile.skin);
    add(`reference-${name}-upper-arm`,humanVerticalPrism(.15,.15,.13,.13,.28),[side*.32,1.00,0],arm,shoulder,1,profile.shirt);
    add(`reference-${name}-hand`,humanBox(.12,.12,.12),[side*.32,.82,0],arm,shoulder,2,profile.skin);
    // Original trousers: height .42, top .20×.22, bottom .17×.19.
    // Cutting halfway produces .185×.205 at the existing linear midpoint.
    add(`reference-${name}-trouser-upper`,trouserHalf(.20,.22,.185,.205,true),[side*.13,.455,0],leg,legPivot,0,profile.pants,0x3c424a);
    add(`reference-${name}-trouser-lower`,trouserHalf(.185,.205,.17,.19,false),[side*.13,.245,0],calf,legPivot,0,profile.pants,0x3c424a);
    add(`reference-${name}-boot`,humanBox(.18,.15,.25),[side*.13,.08,.03],calf,legPivot,3,profile.charcoal,0x1a1917);
  }
  return parts;
}
