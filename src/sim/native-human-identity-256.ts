import {isSchema256Or257} from './schema-compatibility-257.ts';
import type {AncientHumanNameTriple256} from './ancient-human-bio-types-256.ts';
import {ancientHumanNameLabel256} from './ancient-human-name-256.ts';
import {validHumanAge} from './human-age.ts';
import {validNativeHumanClinicalScale256} from './native-human-clinical-scale-256.ts';
/** Owned by the SAME original Pawn, never by a roster or relation projection.
 * No producer installs it until its complete native birth is actually ready. */
export interface NativeHumanIdentity256 {
 readonly revision:1;
 readonly gender:'None'|'Male'|'Female';
 readonly name:AncientHumanNameTriple256;
 /** Actual birth biologicalCore%10, not a clock or inferred old-age value. */
 readonly biologicalCoreRemainder:number;
 /** Positive Core ThingIDNumber read from an actual RWS, not the local id. */
 readonly sourceThingId382?:number;
}
function data(v:unknown,keys:readonly string[]):v is Record<string,unknown>{
 if(!v||typeof v!=='object'||Object.getPrototypeOf(v)!==Object.prototype)return false;
 return Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable===true&&Object.hasOwn(d,'value');});
}
const word=(v:unknown):v is string=>typeof v==='string'&&v.length<=80&&!/[\u0000-\u001f\u007f]/.test(v);
const HUMAN_IDENTITY_FIELDS_256=['revision','gender','name','biologicalCoreRemainder'] as const;
const HUMAN_IDENTITY_FIELDS_382=[...HUMAN_IDENTITY_FIELDS_256,'sourceThingId382'] as const;
const HUMAN_NAME_FIELDS_256=['first','nick','last','nickSet'] as const;
export function validNativeHumanIdentity256(value:unknown):value is NativeHumanIdentity256 {
 const source=!!value&&typeof value==='object'&&Object.hasOwn(value,'sourceThingId382');
 if(!data(value,source?HUMAN_IDENTITY_FIELDS_382:HUMAN_IDENTITY_FIELDS_256)||value.revision!==1||value.gender!=='None'&&value.gender!=='Male'&&value.gender!=='Female'||typeof value.biologicalCoreRemainder!=='number'||!Number.isInteger(value.biologicalCoreRemainder)||value.biologicalCoreRemainder<0||value.biologicalCoreRemainder>9)return false;
 if(source&&(!Number.isInteger(value.sourceThingId382)||Number(value.sourceThingId382)<1||Number(value.sourceThingId382)>2147483647))return false;
 const n=value.name;return data(n,HUMAN_NAME_FIELDS_256)&&word(n.first)&&word(n.nick)&&word(n.last)&&typeof n.nickSet==='boolean'&&!!(n.first||n.nick||n.last);
}
/** Same biological owner in map, caravan, suspension and terminal records.
 * No fallback for an old Pawn and no use of health.tick/chronological age. */
export function nativeHumanBiologicalCore256(pawn:{age?:{biologicalTicks:number};nativeHuman?:NativeHumanIdentity256}):number {
 if(!pawn.age||!Number.isSafeInteger(pawn.age.biologicalTicks)||pawn.age.biologicalTicks<0||!validNativeHumanIdentity256(pawn.nativeHuman))throw Error('Actual native biological owner is absent');
 const core=pawn.age.biologicalTicks*10+pawn.nativeHuman.biologicalCoreRemainder;if(!Number.isSafeInteger(core))throw Error('Native biological age exhausted');return core;
}
/** Absence is literal under every schema. An inherited property, accessor or
 * ownundefined is never absence, and <=255 refuses all future presence. */
export function validNativeHumanField256(raw:unknown,version:number):boolean {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return false;
 const d=Object.getOwnPropertyDescriptor(raw,'nativeHuman');if(!d)return !('nativeHuman'in raw);
 if(!isSchema256Or257(version)||!d.enumerable||!Object.hasOwn(d,'value')||!validNativeHumanIdentity256(d.value)||version<382&&Object.hasOwn(d.value,'sourceThingId382')||'mechKind'in raw)return false;
 const label=Object.getOwnPropertyDescriptor(raw,'name');return !!label&&label.enumerable===true&&Object.hasOwn(label,'value')&&typeof label.value==='string'&&label.value.length>0&&label.value.length<=80&&label.value===ancientHumanNameLabel256(d.value.name);
}
/** Contextual gate; the third argument is accepted by River's coordinated
 * human-age window only after this real physical header was validated. */
export function validHumanAgeForPawn256(raw:unknown,version:number):boolean {
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!validNativeHumanField256(raw,version))return false;
 const a=Object.getOwnPropertyDescriptor(raw,'age');if(a&&(!a.enumerable||!Object.hasOwn(a,'value')))return false;
 const h=Object.getOwnPropertyDescriptor(raw,'nativeHuman'),health=Object.getOwnPropertyDescriptor(raw,'health');if(health&&(!health.enumerable||!Object.hasOwn(health,'value')))return false;
 if(!h)return validHumanAge(a?.value,version)&&validNativeHumanClinicalScale256(health?.value,version);
 if(!validHumanAge(a?.value,version,h.value as NativeHumanIdentity256))return false;
 try{return validNativeHumanClinicalScale256(health?.value,version,nativeHumanBiologicalCore256({age:a?.value,nativeHuman:h.value}));}catch{return false;}
}
/** Actual native held/unspawned Position. Never used for spawned navigation,
 * contact or footprint admission, and never used to widen historical guards.
 * DeSpawn/ThingOwner keep a real previous Position; only never-Spawn is Invalid. */
export function validNativeHumanNonSpatialPosition256(raw:unknown,version:number):boolean {
 if(!validNativeHumanField256(raw,version)||!raw||typeof raw!=='object'||!Object.hasOwn(raw,'nativeHuman'))return false;
 for(const k of ['x','z']){const d=Object.getOwnPropertyDescriptor(raw,k);if(!d||!d.enumerable||!Object.hasOwn(d,'value')||!Number.isInteger(d.value)||d.value< -2147483648||d.value>2147483647)return false;}return true;
}
