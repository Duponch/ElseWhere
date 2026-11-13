import type {Node} from 'three/webgpu';
import {attribute,float,vec3} from 'three/tsl';
import type {Pawn} from '../../sim/types';
import {PAWN_MODEL_SCALE} from '../../world/scale';
import {RESIDENT_WEAPON_VISUALS269} from '../weapon-shape';
import {HUMAN_REFERENCE_SCALE,ORIGAMI_HUMAN_BIND} from './human-geometry';

export type OrigamiWeaponKind=typeof RESIDENT_WEAPON_VISUALS269[number]['item'];
type Point=readonly [number,number,number];
type Triple<T>=readonly [T,T,T];
export const ORIGAMI_EQUIPMENT_HAND:Point=[ORIGAMI_HUMAN_BIND.shoulderX,ORIGAMI_HUMAN_BIND.handY,ORIGAMI_HUMAN_BIND.handZ];
export const ORIGAMI_EQUIPMENT_BELT:Point=[.34*HUMAN_REFERENCE_SCALE,.70*HUMAN_REFERENCE_SCALE,.02*HUMAN_REFERENCE_SCALE];
export const ORIGAMI_EQUIPMENT_SLING:Point=[.18*HUMAN_REFERENCE_SCALE,.94*HUMAN_REFERENCE_SCALE,-.24*HUMAN_REFERENCE_SCALE];
export const ORIGAMI_WEAPON_BIND:Readonly<Record<OrigamiWeaponKind,{grip:Point;sign:number;ranged:boolean;sling:boolean;stowedAxis:Point}>>=Object.freeze({
 'revolver':{grip:[-.105,-.055,0],sign:-1,ranged:true,sling:false,stowedAxis:[0,-.95,-Math.sqrt(1-.95**2)]},
 'bolt-action-rifle':{grip:[-.12,.01,0],sign:1,ranged:true,sling:true,stowedAxis:[-.6,.8,0]},
 'emp-launcher':{grip:[-.12,-.085,0],sign:1,ranged:true,sling:true,stowedAxis:[-.6,.8,0]},
 // Aimed: string toward the archer, stave upright; stowed across the back.
 'short-bow':{grip:[0,0,0],sign:1,ranged:true,sling:true,stowedAxis:[-.6,.8,0]},
 'pump-shotgun':{grip:[-.12,-.045,0],sign:1,ranged:true,sling:true,stowedAxis:[-.6,.8,0]},
 'plasteel-knife':{grip:[-.11,0,0],sign:-1,ranged:false,sling:false,stowedAxis:[0,-.95,-Math.sqrt(1-.95**2)]},
 'mace-family':{grip:[-.235,0,0],sign:1,ranged:false,sling:false,stowedAxis:[0,-.9,-Math.sqrt(1-.9**2)]},
 'longsword-family':{grip:[-.385,0,0],sign:1,ranged:false,sling:false,stowedAxis:[0,-.6,-.8]},
 'spear-family':{grip:[-.17,0,0],sign:1,ranged:false,sling:true,stowedAxis:[0,.95,-Math.sqrt(1-.95**2)]},
});

/** Low render bits stay below half of the existing 1/8 material step. Both
 * floor(type) and round(fract*8) retain their previous meaning. Never saved. */
export function encodeOrigamiEquipment(code:number,ready:boolean,strike=false):number {
 const clean=Math.floor(code)+Math.round((code-Math.floor(code))*8)/8;
 return clean+((ready?2:0)+(strike?1:0))/64;
}
export function origamiWeaponVisualSignal(pawn:Pick<Pawn,'draft'|'shooting'|'melee'|'state'|'stun'>,item:string|undefined):{ready:boolean;strike:boolean} {
 if(!item||pawn.stun||['dead','downed','sleeping','resting'].includes(pawn.state))return {ready:false,strike:false};
 const tool=pawn.melee?.strike?.tool;
 const strike=!!tool&&(tool.startsWith(item+'-')||(item==='plasteel-knife'&&tool.startsWith('knife-'))||(['revolver','bolt-action-rifle','emp-launcher','short-bow','pump-shotgun'].includes(item)&&['grip','barrel','barrel-poke'].includes(tool)));
 return {ready:!!pawn.draft||!!pawn.shooting?.stance||strike,strike};
}
export interface OrigamiEquipmentState {pose:number;activity:number;equipment:number;cargo:number;limbMask?:number;reach:number;recoil:number}
interface Flags<T>{held:T;attack:T;shooting:T;handle:T;sweep:T;reach:T;recoil:T}
export function origamiEquipmentFlags(state:OrigamiEquipmentState):Flags<number> {
 const bits=Math.floor((state.equipment-Math.floor(state.equipment))*64+.00001)%8;
 const shooting=state.pose===7||state.pose===15;
 const held=[0,7,8,15,17].includes(state.pose)&&Math.abs(state.cargo)<=.5&&state.activity>=0&&state.activity!==14&&Math.floor((state.limbMask??0)/2)%2===0&&(bits>=2||shooting);
 return {held:Number(held),attack:Number(held&&(state.pose===8||state.pose===17)&&bits%2===1),shooting:Number(shooting),handle:Number([7,8,12].includes(state.activity)),sweep:Number([10,11].includes(state.activity)),reach:state.reach,recoil:state.recoil};
}
function nodeFlags(pose:Node<'float'>,activity:Node<'float'>,equipment:Node<'float'>,cargo:Node<'float'>,reach:Node<'float'>,recoil:Node<'float'>):Flags<Node<'float'>> {
 const bits=equipment.fract().mul(64).floor().mod(8),shooting=pose.equal(7).or(pose.equal(15));
 const allowed=[0,7,8,15,17].reduce((yes,id)=>yes.or(pose.equal(id)),pose.equal(-999));
 const rightPresent=attribute('aShape','vec4').x.div(100).floor().div(2).floor().mod(2).lessThan(.5);
 const held=allowed.and(cargo.abs().lessThanEqual(.5)).and(activity.greaterThanEqual(0)).and(activity.notEqual(14)).and(rightPresent).and(bits.greaterThanEqual(2).or(shooting));
 const asFloat=(value:Node<'bool'>)=>value.select(float(1),float(0));
 return {held:asFloat(held),attack:asFloat(held.and(pose.equal(8).or(pose.equal(17))).and(bits.mod(2).equal(1))),shooting:asFloat(shooting),handle:asFloat(activity.equal(7).or(activity.equal(8)).or(activity.equal(12))),sweep:asFloat(activity.equal(10).or(activity.equal(11))),reach,recoil};
}

interface Arithmetic<T>{n(value:number):T;add(a:T,b:T):T;sub(a:T,b:T):T;mul(a:T,b:T):T;div(a:T,b:T):T;sin(a:T):T;cos(a:T):T;sqrt(a:T):T;abs(a:T):T;gt(a:T,b:T):T}
/** One rigid placement kernel serves actual TSL and numerical geometry
 * contracts. The grip subtraction is authored once; no separate strike path
 * can move it away from the supplied real hand anchor. */
function place<T>(m:Arithmetic<T>,kind:OrigamiWeaponKind,point:Triple<T>,hand:Triple<T>,stowed:Triple<T>,f:Flags<T>):Triple<T> {
 const {n,add,sub,mul,div,sin,cos,sqrt}=m,config=ORIGAMI_WEAPON_BIND[kind];
 const mix=(a:T,b:T,t:T)=>add(a,mul(sub(b,a),t));
 const cross=(a:Triple<T>,b:Triple<T>):Triple<T>=>[sub(mul(a[1],b[2]),mul(a[2],b[1])),sub(mul(a[2],b[0]),mul(a[0],b[2])),sub(mul(a[0],b[1]),mul(a[1],b[0]))];
 const normalize=(a:Triple<T>):Triple<T>=>{const length=sqrt(add(add(mul(a[0],a[0]),mul(a[1],a[1])),mul(a[2],a[2])));return a.map(value=>div(value,length)) as unknown as Triple<T>;};
 let drawn:Triple<T>;
 if(config.ranged){const angle=mix(n(-.62),mul(f.recoil,n(.16)),f.shooting);drawn=[n(0),sin(angle),cos(angle)];}
 else{
  const angle=mul(mul(f.reach,f.attack),n(Math.PI*.44)),yaw=mul(mul(f.sweep,f.attack),sub(mul(f.reach,n(.9)),n(.45))),forward=sub(n(1),mul(f.handle,n(2)));
  drawn=[mul(sin(angle),sin(yaw)),cos(angle),mul(mul(sin(angle),cos(yaw)),forward)];
 }
 const axis=config.stowedAxis.map((value,i)=>mix(n(value),drawn[i]!,f.held)) as unknown as Triple<T>;
 // A fixed transverse reference avoids a 90-degree roll when a sword passes
 // through vertical. None of these authored motion cones meets its reference.
 const hint:Triple<T>=config.ranged?[n(0),n(1),n(0)]:[n(1),n(0),n(0)];
 const side=normalize(cross(axis,hint)),up=cross(side,axis);
 // Concrete pistols/knives have a reversed bind Y. Reverse the transverse
 // coordinate too, retaining handedness and outward triangle winding.
 const local:Triple<T>=[sub(mul(sub(point[1],n(.68)),n(config.sign)),n(config.grip[0]/PAWN_MODEL_SCALE)),sub(point[2],n(config.grip[1]/PAWN_MODEL_SCALE)),sub(mul(sub(point[0],n(.205)),n(config.sign)),n(config.grip[2]/PAWN_MODEL_SCALE))];
 return [0,1,2].map(i=>add(mix(stowed[i]!,hand[i]!,f.held),add(add(mul(axis[i]!,local[0]),mul(up[i]!,local[1])),mul(side[i]!,local[2])))) as unknown as Triple<T>;
}
const numbers:Arithmetic<number>={n:x=>x,add:(a,b)=>a+b,sub:(a,b)=>a-b,mul:(a,b)=>a*b,div:(a,b)=>a/b,sin:Math.sin,cos:Math.cos,sqrt:Math.sqrt,abs:Math.abs,gt:(a,b)=>Number(a>b)};
const nodes:Arithmetic<Node<'float'>>={n:value=>float(value),add:(a,b)=>a.add(b),sub:(a,b)=>a.sub(b),mul:(a,b)=>a.mul(b),div:(a,b)=>a.div(b),sin:a=>a.sin(),cos:a=>a.cos(),sqrt:a=>a.sqrt(),abs:a=>a.abs(),gt:(a,b)=>a.greaterThan(b).select(float(1),float(0))};
export function origamiEquipmentPoint(kind:OrigamiWeaponKind,point:Point,hand:Point,stowed:Point,state:OrigamiEquipmentState):Point{return place(numbers,kind,point,hand,stowed,origamiEquipmentFlags(state));}
export function origamiEquipmentPositionNode(kind:OrigamiWeaponKind,point:Node<'vec3'>,hand:Node<'vec3'>,stowed:Node<'vec3'>,pose:Node<'float'>,activity:Node<'float'>,reach:Node<'float'>,recoil:Node<'float'>):Node<'vec3'> {
 const tuple=(value:Node<'vec3'>):Triple<Node<'float'>>=>[value.x,value.y,value.z];
 return vec3(...place(nodes,kind,tuple(point),tuple(hand),tuple(stowed),nodeFlags(pose,activity,attribute('aEquipment','vec4').x,attribute('aCargo','vec4').x,reach,recoil)));
}
