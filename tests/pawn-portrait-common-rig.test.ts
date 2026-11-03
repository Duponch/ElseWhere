/** CPU portrait adapter: actual shared rig triangles, apparel/anatomy masks,
 * common morph and existing numerical equipment placement. No device/pixels. */
import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {pawnGeometry} from '../src/render/pawn-geometry';
import {portraitDataUrl} from '../src/ui/pawn-portrait';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {apparelAppearance} from '../src/render/character-apparel';
import {HUMAN_REFERENCE_SCALE} from '../src/render/origami/human-geometry';
import {ORIGAMI_EQUIPMENT_HAND,ORIGAMI_EQUIPMENT_SLING,origamiEquipmentPoint} from '../src/render/origami/equipment-pose';
import type {PawnAppearance} from '../src/sim/pawn-appearance';
import {BEARD_STYLES} from '../src/sim/pawn-appearance';
import {newApparelState,type ApparelItem} from '../src/sim/apparel-rules';
import type {MaterialPile} from '../src/sim/types';

type V=readonly[number,number,number];
function points(svg:string){return new Set([...svg.matchAll(/<polygon points="([^"]+)"/g)].map(m=>m[1]!));}
const decode=(url:string)=>decodeURIComponent(url.slice(url.indexOf(',')+1));
const identity:PawnAppearance={version:1,sex:'male',bodyType:'Hulk',headType:'Male_AverageWide',hair:'Lackland',beard:BEARD_STYLES.find(style=>style.shape==='none')!.id,skinColor:0xc28e68,hairColor:0x3b271b};
const worn=(item:ApparelItem)=>{const pile:MaterialPile={id:7,kind:'apparel',item,quantity:1,owner:{type:'apparel',pawnId:1},apparel:newApparelState(item)};return apparelAppearance([pile]);};

test('portraits project true common-rig triangles with Source nose/jaw/torso, distinct apparel/eyes and the real stowed EMP attachment in both styles',()=>{
 const source=pawnGeometry(true,true,true,true),position=source.getAttribute('position'),draw=source.index;
 const ranges=source.userData.origamiHumanParts as readonly {id:string;start:number;count:number}[];
 expect(Array.isArray(ranges)).toBe(true);
 // Independent scalar oracle for this explicit Hulk / average-wide identity.
 // Jaw affects only Source lower-head region; each eye remains a rigid block.
 const shape=(p:V,bone:number):V=>{if(bone===1)return[p[0]*(p[1]<(1.23+(1.18-1.04)/.30*.38)*HUMAN_REFERENCE_SCALE?1.12:1),p[1],p[2]];const t=Math.max(0,Math.min(1,(p[1]-.76*HUMAN_REFERENCE_SCALE)/(.44*HUMAN_REFERENCE_SCALE))),width=bone>=4?1.12:bone>=2?1.38:1.15+(1.38-1.15)*t;return[p[0]*width,p[1],p[2]*1.22];};
 const yaw=.24,pitch=.18,eye=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)),project=(p:V)=>[48+(p[0]*Math.cos(yaw)-p[2]*Math.sin(yaw))*91,9+(1.52-(p[1]*Math.cos(pitch)-(p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw))*Math.sin(pitch)))*89].map(n=>Number(n.toFixed(2))).join(',');
 const triangles=(name:string,bone:number,place:(p:V)=>V=p=>shape(p,bone))=>{const part=ranges.find(p=>p.id===name);if(!part)throw Error('Actual part missing: '+name);const result:string[]=[];for(let at=part.start;at<part.start+part.count;at+=3){const p=[0,1,2].map(c=>{const v=draw?.getX(at+c)??at+c;return place([position.getX(v),position.getY(v),position.getZ(v)]);});if(p.every(v=>v[1]<.54))continue;const a=new THREE.Vector3(...p[0]!),b=new THREE.Vector3(...p[1]!),c=new THREE.Vector3(...p[2]!);if(new THREE.Triangle(a,b,c).getNormal(new THREE.Vector3()).dot(eye)>0)result.push(p.map(project).join(' '));}expect(result.length,'No visible actual triangles for '+name).toBeGreaterThan(0);return result;};
 const basic=apparelAppearance(),defaultContext=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default'}),origamiContext=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0});
 try{
  const normal=decode(withGraphicsStyle(defaultContext,()=>portraitDataUrl(identity,basic))),normalPoints=points(normal);
  expect(withGraphicsStyle(origamiContext,()=>portraitDataUrl(identity,basic))).toBe(withGraphicsStyle(defaultContext,()=>portraitDataUrl(identity,basic)));
  expect(normalPoints.size).toBeGreaterThan(30);for(const polygon of normalPoints)expect(polygon.split(' ')).toHaveLength(3);expect(normal).not.toMatch(/NaN|Infinity/);
  for(const name of ['reference-head','reference-nose','reference-torso','reference-left-eye'])for(const triangle of triangles(name,name==='reference-torso'?0:1))expect(normalPoints.has(triangle),name).toBe(true);
  const closed=points(decode(portraitDataUrl(identity,basic,undefined,'sleep'))),dead=points(decode(portraitDataUrl(identity,basic,undefined,'dead')));
  for(const triangle of triangles('reference-left-eye',1)){expect(closed.has(triangle)).toBe(false);expect(dead.has(triangle)).toBe(false);}for(const triangle of triangles('identity-left-closed-eye',1))expect(closed.has(triangle)).toBe(true);
  const absent=points(decode(portraitDataUrl(identity,basic,undefined,'awake',2)));for(const triangle of triangles('reference-right-hand',3))expect(absent.has(triangle)).toBe(false);
  for(const [item,name]of [['cloth-duster','apparel-duster-right'],['cloth-parka','apparel-parka-coat'],['recon-armor','apparel-recon-body']] as const){const actual=points(decode(portraitDataUrl(identity,worn(item))));for(const triangle of triangles(name,0)){expect(normalPoints.has(triangle),item+' must be absent when unequipped').toBe(false);expect(actual.has(triangle),item+' must retain its real resident model').toBe(true);}}
  for(const triangle of triangles('work-axe-blade',3))expect(normalPoints.has(triangle)).toBe(false);
  const emp=points(decode(portraitDataUrl(identity,basic,'emp-launcher'))),hand=shape(ORIGAMI_EQUIPMENT_HAND,3),sling=shape(ORIGAMI_EQUIPMENT_SLING,0),place=(p:V)=>origamiEquipmentPoint('emp-launcher',p,hand,sling,{pose:0,activity:0,equipment:4,cargo:0,reach:0,recoil:0});
  for(const triangle of triangles('weapon-emp-launcher-0',0,place)){expect(normalPoints.has(triangle)).toBe(false);expect(emp.has(triangle)).toBe(true);}
 }finally{source.dispose();defaultContext.dispose();origamiContext.dispose();}
});
