import {SCHEMA_VERSION,type CommandResult,type Job,type StorageSettings,type World} from './types.ts';
import {isShelfKind,newShelfStorage,type ShelfStorageSettings} from './shelf-storage.ts';
import {cloneLinkedShelfPolicy286,patchLinkedShelfPolicy286,validLinkedShelfPolicy286} from './linked-storage-policy-286.ts';

export interface BlueprintStorageCommand380 {type:'blueprint-storage-policy';jobId:number;settings:StorageSettings}

/** No destination cell, contents or group membership exists before the real
 * building is completed. Absence means the ordinary new-building defaults. */
export function blueprintStorageJob380(world:Pick<World,'schemaVersion'|'jobs'>,jobId:number):Job|undefined {
 if(world.schemaVersion<380)return;
 return world.jobs.find(job=>job.id===jobId&&isShelfKind(job.kind));
}
export function blueprintStorageSettings380(world:Pick<World,'schemaVersion'|'jobs'>,jobId:number):ShelfStorageSettings|undefined {
 const job=blueprintStorageJob380(world,jobId);
 return job?cloneLinkedShelfPolicy286(job.storage380??newShelfStorage([],world.schemaVersion).settings):undefined;
}
/** Reuse the completed shelf's exact policy patch contract, including explicit
 * clears and fixed capacity, while leaving construction and logistics alone. */
export function applyBlueprintStorage380(world:World,command:BlueprintStorageCommand380):CommandResult {
 if(world.schemaVersion<380||!command||typeof command!=='object'||Object.getPrototypeOf(command)!==Object.prototype
  ||Reflect.ownKeys(command).length!==3||!['type','jobId','settings'].every(key=>{const d=Object.getOwnPropertyDescriptor(command,key);return !!d&&d.enumerable&&Object.hasOwn(d,'value');})
  ||command.type!=='blueprint-storage-policy'||!Number.isSafeInteger(command.jobId))return {ok:false,code:'invalid-command',reason:'Commande de stockage du plan invalide.'};
 const job=blueprintStorageJob380(world,command.jobId),base=blueprintStorageSettings380(world,command.jobId);
 if(!job||!base)return {ok:false,code:'missing-target',reason:'Ce plan de stockage n’existe plus.'};
 const next=patchLinkedShelfPolicy286(base,command.settings,world.schemaVersion);
 if(!next)return {ok:false,code:'invalid-storage',reason:'Réglages de stockage invalides.'};
 job.storage380=next;return {ok:true};
}

/** Role-aware original-descriptor check, called by the shared construction
 * traversal before any save migration or snapshot clone can erase markers. */
export function validBlueprintStorageField380(value:object,version:number,isJob:boolean):boolean {
 if(!('storage380'in value))return true;
 const field=Object.getOwnPropertyDescriptor(value,'storage380'),kind=Object.getOwnPropertyDescriptor(value,'kind');
 return version>=380&&version<=SCHEMA_VERSION&&isJob&&Object.getPrototypeOf(value)===Object.prototype
  &&!!field&&field.enumerable===true&&Object.hasOwn(field,'value')
  &&!!kind&&kind.enumerable===true&&Object.hasOwn(kind,'value')&&isShelfKind(kind.value)
  &&validLinkedShelfPolicy286(field.value,version);
}
