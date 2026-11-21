import {isSchema256Or257} from './schema-compatibility-257.ts';
import type {WildAnimal} from './wildlife-state.ts';
/** Actual initial pet name and direct links. This does not copy a human into
 * the animal, or place an animal among campaignPeople. No migration adds it. */
export interface StartingPetState256 {
 revision:1;name:string;
 masterId?:number;bondedPawnId?:number;
 obedience?:{steps:3;wanted:true};
}
export type ActualStartingPet256=WildAnimal&{startingPet:StartingPetState256};
const data=(o:object,key:string)=>{const d=Object.getOwnPropertyDescriptor(o,key);return d&&d.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
const id=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0;
export function validStartingPetHeader256(animal:unknown,version:number):boolean {
 if(!animal||typeof animal!=='object')return false;
 const d=Object.getOwnPropertyDescriptor(animal,'startingPet');if(!d)return !('startingPet'in animal);
 if(!isSchema256Or257(version)||!d.enumerable||!Object.hasOwn(d,'value')||!d.value||typeof d.value!=='object'||Object.getPrototypeOf(d.value)!==Object.prototype)return false;
 const p=d.value,keys=Reflect.ownKeys(p);if(keys.some(k=>typeof k!=='string'||!['revision','name','masterId','bondedPawnId','obedience'].includes(k)||!data(p,k as string)))return false;
 const name=data(p,'name')?.value;if(data(p,'revision')?.value!==1||typeof name!=='string'||!name.length||name.length>80||name.trim()!==name||/[\u0000-\u001f\u007f-\u009f]/.test(name))return false;
 const master=data(p,'masterId'),bond=data(p,'bondedPawnId'),obedience=data(p,'obedience');
 if(!master&&!bond&&!obedience)return keys.length===2;
 if(!bond||!obedience||!id(bond.value)||master&&(!id(master.value)||master.value!==bond.value))return false;
 const o=obedience.value;
 return keys.length===(master?5:4)&&!!o&&typeof o==='object'&&Object.getPrototypeOf(o)===Object.prototype&&Reflect.ownKeys(o).length===2&&data(o,'steps')?.value===3&&data(o,'wanted')?.value===true;
}
/** FK authority is supplied from the actual global actor capture, including
 * retained terminal humans. Absence never means a neutral or dead master. */
export function validateStartingPetLinks256(animal:WildAnimal,version:number,actualHuman:(id:number)=>object|undefined):boolean {
 if(!validStartingPetHeader256(animal,version))return false;
 const p=data(animal,'startingPet')?.value as StartingPetState256|undefined;
 if(!p)return true;
 // Schema 364: a starter released to the wild keeps its name, bond and
 // master as Core data (SetFaction(null) clears no relation).
 return (!!animal.domestic||version>=364)&&(p.bondedPawnId===undefined||!!actualHuman(p.bondedPawnId))&&(p.masterId===undefined||!!actualHuman(p.masterId));
}
export function actualAnimalName256(animal:WildAnimal):string|undefined {
 const d=data(animal,'startingPet');return d&&validStartingPetHeader256(animal,256)?(d.value as StartingPetState256).name:undefined;
}
