import * as THREE from 'three/webgpu';
import { pawnGeometry,FLAK_HELMET_DYE,PLATE_ARMOR_DYE,SIMPLE_HELMET_DYE,TUQUE_DYE,RECON_HELMET_DYE,PAWN_EYE_OPEN,PAWN_EYE_CLOSED,PAWN_EYE_CROSS } from '../render/pawn-geometry';
import { BODY_PROPORTIONS, appearanceShape } from '../render/pawn-appearance-shape';
import type { apparelAppearance } from '../render/character-apparel';
import type { PawnAppearance } from '../sim/pawn-appearance';
import type { Pawn } from '../sim/types';
import { weaponVisual,RESIDENT_WEAPON_VISUALS269 } from '../render/weapon-shape';
import {HUMAN_REFERENCE_SCALE,ORIGAMI_DUSTER_DYE,ORIGAMI_PARKA_DYE,ORIGAMI_RECON_ARMOR_DYE} from '../render/origami/human-geometry';
import {origamiEquipmentPoint,ORIGAMI_EQUIPMENT_HAND,ORIGAMI_EQUIPMENT_BELT,ORIGAMI_EQUIPMENT_SLING,ORIGAMI_WEAPON_BIND} from '../render/origami/equipment-pose';
import { humanBoneAbsent } from '../render/human-anatomy-presentation';
import { anestheticStage } from '../sim/anesthetic';
import {LONGSWORD_DYE270} from '../render/longsword-parts270';
import {SPEAR_DYE272} from '../render/spear-parts272';
import {isSpearItem272,spearColor272} from '../sim/spear-content-272';
import {isLongswordItem270,longswordColor270} from '../sim/longsword-content-270';
import {MACE_DYE269} from '../render/mace-parts269';
import {isMaceItem269,maceColor269} from '../sim/mace-content-269';

type ApparelLook = ReturnType<typeof apparelAppearance>;
export type PortraitExpression = 'awake' | 'sleep' | 'dead';
export function portraitExpressionOf(pawn:Pick<Pawn,'state'|'medicalSleep'|'health'>):PortraitExpression {
  // Reuse the shut-eye geometry for true clinical sedation, without creating
  // a sleeping task or changing the patient's authoritative life state.
  return pawn.state==='dead'?'dead':pawn.state==='sleeping'||pawn.medicalSleep||anestheticStage(pawn.health?.anesthetic?.severity??0)==='sedated'?'sleep':'awake';
}
type Vertex = readonly [number, number, number];
type Face = { points: readonly [Vertex, Vertex, Vertex]; color: number; bone: number; dye: number };
const CACHE_LIMIT = 256;
const cache = new Map<string, string>();
let sourceFaces: Face[] | undefined;

// A fixed orthographic view of the actual authored pawn mesh. Extract once;
// changing a 3D hair, beard, head or garment part changes the portrait too.
function faces(): readonly Face[] {
  if (sourceFaces) return sourceFaces;
  const geometry = pawnGeometry(true,true,true,true);
  const pos = geometry.getAttribute('position');
  const color = geometry.getAttribute('color'), bone = geometry.getAttribute('boneId'), dye = geometry.getAttribute('dye');
  const result: Face[] = [];
  // The common reference rig includes independent triangles and tapered
  // prisms. Read the actual index stream without assuming pairs form quads.
  const draw=geometry.index;
  const at=(i:number)=>draw?draw.getX(i):i;
  for (let i = 0; i + 2 < (draw?.count ?? pos.count); i += 3) {
    const points = [0, 1, 2].map(j => {
      const v=at(i+j);return [pos.getX(v), pos.getY(v), pos.getZ(v)] as Vertex;
    });
    const first=at(i);
    const linear = new THREE.Color().setRGB(color.getX(first), color.getY(first), color.getZ(first));
    result.push({ points: points as [Vertex, Vertex, Vertex],
      color: linear.getHex(), bone: bone.getX(first), dye: dye.getX(first) });
  }
  // A portrait requested inside an Origami construction scope may have caused
  // the shared factory to make optional companions; none is adopted here.
  for(const key of ['origamiLines','origamiWear']){const companion:unknown=geometry.userData[key];if(companion instanceof THREE.BufferGeometry)companion.dispose();}
  geometry.dispose();
  sourceFaces = result;
  return result;
}

function visible(face: Face, variant: readonly [number, number, number, number], look: ApparelLook, weaponDye: number | undefined, expression:PortraitExpression,limbMask:number): boolean {
  if(humanBoneAbsent(limbMask,face.bone))return false;
  const dye = face.dye;
  if (dye === PAWN_EYE_OPEN) return !look.reconHelmet && expression==='awake';
  if (dye === PAWN_EYE_CLOSED) return !look.reconHelmet && expression==='sleep';
  if (dye === PAWN_EYE_CROSS) return !look.reconHelmet && expression==='dead';
  if (dye >= 200) return !look.reconHelmet && !!(variant[3] & (1 << (dye - 200)));
  if (dye >= 100) return !look.helmet && !look.tuque && !!(variant[2] & (1 << (dye - 100)));
  if (dye === -2) return look.vest;
  if (dye === -3) return look.silhouette === 2;
  if (dye === ORIGAMI_DUSTER_DYE) return look.silhouette === 3;
  if (dye === ORIGAMI_PARKA_DYE) return look.silhouette === 4;
  if (dye === -6) return look.silhouette === 4 && !look.helmet && !look.tuque;
  if (dye === TUQUE_DYE) return !!look.tuque;
  if (dye === FLAK_HELMET_DYE) return look.helmet && !look.reconHelmet && !look.simpleHelmet;
  if (dye === PLATE_ARMOR_DYE) return look.plateArmor;
  if (dye === SIMPLE_HELMET_DYE) return look.simpleHelmet;
  if (dye === ORIGAMI_RECON_ARMOR_DYE) return look.silhouette === 5;
  if (dye === RECON_HELMET_DYE) return look.reconHelmet;
  if (RESIDENT_WEAPON_VISUALS269.some(weapon=>weapon.dye===dye)) return dye === weaponDye;
  if (dye <= -30 && dye >= -32) return false; // No work activity in a still portrait.
  return dye >= 0;
}

function colorOf(face: Face, appearance: PawnAppearance, look: ApparelLook): number {
  if(face.dye===PLATE_ARMOR_DYE)return look.color??face.color;
  if(face.dye===SIMPLE_HELMET_DYE)return look.simpleHelmetColor??face.color;
  if(face.dye===-2&&look.vestTintColor!==undefined)return look.vestTintColor;
  if(face.dye===FLAK_HELMET_DYE&&look.plasteelHelmet)return 0xa0b2b5;
  if (face.dye === TUQUE_DYE) return look.tuque===2?0xb3c0ba:0xd8c8a2;
  if (face.dye === ORIGAMI_RECON_ARMOR_DYE) return face.color;
  if (face.dye >= 100) return appearance.hairColor;
  if (face.dye === 2 || look.silhouette === 2 && (face.bone === 2 || face.bone === 3)) return appearance.skinColor;
  if (face.dye === 1 || face.dye === -3 || face.dye === -6 || face.dye===ORIGAMI_DUSTER_DYE || face.dye===ORIGAMI_PARKA_DYE) return look.color ?? 0x789082;
  if (face.bone >= 4 && face.dye===0 && look.pants) return [0, 0xd8c8a2, 0xad8a61, 0xa88b63, 0x839ac5, 0xc3a375,0xb3c0ba,0xb26422,0x707070,0xcecece,0xb1b1b1][look.pants] ?? face.color;
  return face.color;
}

/** Same common-rig dimensions and jaw/torso regions as pawnMorph(...,true).
 * A still portrait keeps its neutral pose and has no cosmetic clock. */
function morph(point: Vertex, bone: number, variant: readonly [number, number, number, number]): Vertex {
  const [x, y, z] = point;
  if (bone === 1) {
    const head = variant[1], jaw = head % 3;
    const width = (head % 6 >= 3 ? .87 : 1) * (head >= 6 ? .97 : 1)
      * (y < (1.23+(1.18-1.04)/.30*.38)*HUMAN_REFERENCE_SCALE ? jaw === 1 ? .84 : jaw === 2 ? 1.12 : 1 : 1);
    return [x * width, y, z];
  }
  const [shoulder, waist, hip, depth] = BODY_PROPORTIONS[variant[0]]!;
  const torso = waist + (shoulder - waist) * Math.max(0, Math.min(1, (y - .76*HUMAN_REFERENCE_SCALE) / (.44*HUMAN_REFERENCE_SCALE)));
  const factor = bone >= 4 ? hip : bone >= 2 ? shoulder : torso;
  return [x * factor, y, z * depth];
}

/** The portrait projects the same weapon parts at the shader's resting pose.
 * No extra scene or animated portrait render is created. */
function posedPoint(point: Vertex, bone: number, variant: readonly [number, number, number, number], dye: number): Vertex {
  const weapon=RESIDENT_WEAPON_VISUALS269.find(weapon=>weapon.dye===dye);
  if(weapon){const bind=ORIGAMI_WEAPON_BIND[weapon.item],hand=morph(ORIGAMI_EQUIPMENT_HAND,3,variant),stowed=morph(bind.sling?ORIGAMI_EQUIPMENT_SLING:ORIGAMI_EQUIPMENT_BELT,0,variant);return origamiEquipmentPoint(weapon.item,point,hand,stowed,{pose:0,activity:0,equipment:weapon.equipment,cargo:0,reach:0,recoil:0});}
  return morph(point, bone, variant);
}

function triangleNormal(points:readonly Vertex[]):Vertex {
  const a=points[0]!,b=points[1]!,c=points[2]!,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
  const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx,length=Math.hypot(x,y,z)||1;return[x/length,y/length,z/length];
}

const yaw = .24, pitch = .18;
const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
const eye: Vertex = [sy * cp, sp, cy * cp];
function project(point: Vertex): readonly [number, number, number] {
  const [x, y, z] = point;
  const depth = x * eye[0] + y * eye[1] + z * eye[2];
  return [48 + (x * cy - z * sy) * 91, 9 + (1.52 - (y * cp - (x * sy + z * cy) * sp)) * 89, depth];
}
const round = (n: number) => Number(n.toFixed(2));
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

function makeSvg(appearance: PawnAppearance, look: ApparelLook, weaponItem: string | undefined, expression:PortraitExpression,limbMask:number): string {
  const variant = appearanceShape(appearance);
  const weaponDye = weaponVisual(weaponItem)?.dye;
  const polygons: { z: number; art: string }[] = [];
  const shaded = new Map<string, string>();
  for (const face of faces()) {
    if (!visible(face, variant, look, weaponDye, expression,limbMask)) continue;
    const placed = face.points.map(p => posedPoint(p, face.bone, variant, face.dye));
    if (placed.every(p => p[1] < .54)) continue;
    const normal = triangleNormal(placed);
    const dot = normal[0] * eye[0] + normal[1] * eye[1] + normal[2] * eye[2];
    if (dot <= 0) continue;
    const points = placed.map(project);
    const light = .76 + .24 * Math.max(0, normal[0] * .3 + normal[1] * .65 + normal[2] * .75);
    const base = face.dye===SPEAR_DYE272&&isSpearItem272(weaponItem)?new THREE.Color(face.color).multiply(new THREE.Color(spearColor272(weaponItem))).getHex():face.dye===MACE_DYE269&&isMaceItem269(weaponItem)?new THREE.Color(face.color).multiply(new THREE.Color(maceColor269(weaponItem))).getHex():face.dye===LONGSWORD_DYE270&&isLongswordItem270(weaponItem)?new THREE.Color(face.color).multiply(new THREE.Color(longswordColor270(weaponItem))).getHex():colorOf(face, appearance, look);
    const key = `${base}|${round(light)}`;
    let fill = shaded.get(key);
    if (!fill) { fill = '#' + new THREE.Color(base).multiplyScalar(light).getHexString(); shaded.set(key, fill); }
    polygons.push({ z: (points[0]![2] + points[1]![2] + points[2]![2]) / 3,
      art: `<polygon points="${points.map(p => `${round(p[0])},${round(p[1])}`).join(' ')}" fill="${fill}" stroke="${fill}" stroke-width=".2"/>` });
  }
  polygons.sort((a, b) => a.z - b.z);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" data-source="pawn-geometry" data-head="${appearance.headType}" data-hair="${appearance.hair}" data-beard="${appearance.beard}" data-skin="${hex(appearance.skinColor)}" data-hair-color="${hex(appearance.hairColor)}" data-helmet="${look.helmet}" data-recon-helmet="${look.reconHelmet}"${look.simpleHelmet?` data-simple-helmet="true" data-helmet-color="${hex(look.simpleHelmetColor!)}"`:""}${look.plateArmor?` data-plate-armor="true"`:""} data-tuque="${look.tuque}" data-weapon="${weaponVisual(weaponItem)?.item ?? ''}" data-expression="${expression}"${limbMask?` data-limb-mask="${limbMask}"`:''}>
  <defs><linearGradient id="paper" x2="0" y2="1"><stop stop-color="#f4eee0"/><stop offset="1" stop-color="#d9d0b9"/></linearGradient><clipPath id="crop"><rect width="96" height="96" rx="6"/></clipPath></defs>
  <rect width="96" height="96" rx="6" fill="url(#paper)"/>
  <g clip-path="url(#crop)">${polygons.map(p => p.art).join('')}</g>
  </svg>`;
}

/** Regenerate only for identity, apparel, equipment, anatomy or life state. */
export function portraitDataUrl(appearance: PawnAppearance, look: ApparelLook, weaponItem?: string, expression:PortraitExpression='awake',limbMask=0): string {
  const key = [appearance.version, appearance.sex, appearance.bodyType, appearance.headType,
    appearance.hair, appearance.beard, appearance.skinColor, appearance.hairColor,
    look.signature, look.color ?? '', look.vest, look.helmet, look.reconHelmet,look.tuque, look.silhouette, look.pants, weaponVisual(weaponItem)?.item ?? '',expression,limbMask].join('|');
  const cached = cache.get(key);
  if (cached) return cached;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(makeSvg(appearance, look, weaponItem, expression,limbMask))}`;
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  cache.set(key, url);
  return url;
}

export function portraitCacheSize(): number { return cache.size; }
