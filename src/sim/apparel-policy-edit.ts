import {validApparelPolicy,APPAREL_POLICY_MATERIALS267,type ApparelPolicy,type ApparelPolicyMaterial} from './apparel-policy.ts';
import {APPAREL,type ApparelItem} from './apparel-rules.ts';
import {SCHEMA_VERSION,type World,type CommandResult} from './types.ts';
import type {WeaponQuality} from './equipment-rules.ts';

export interface ApparelPolicyUpdateCommand {
  type:'apparel-policy-update';policyId:number;
  allowedItems:readonly ApparelItem[];allowedMaterials:readonly ApparelPolicyMaterial[];
  minQuality:WeaponQuality;maxQuality:WeaponQuality;
  minHitPointsPercent:number;maxHitPointsPercent:number;
  /** Schema 374: "allow tainted apparel"; absent keeps the policy's setting. */
  allowTainted374?:boolean;
}
const FIELDS=['type','policyId','allowedItems','allowedMaterials','minQuality','maxQuality','minHitPointsPercent','maxHitPointsPercent'];
const fail=():CommandResult=>({ok:false,code:'invalid-command',reason:'Filtres de tenue invalides ou politique inconnue.'});
function denseStrings(value:unknown,max:number):value is string[]{
  return Array.isArray(value)&&value.length<=max&&Reflect.ownKeys(value).length===value.length+1
    &&Array.from({length:value.length},(_,i)=>i).every(i=>Object.hasOwn(value,i)&&typeof value[i]==='string')
    &&new Set(value).size===value.length;
}
const same=(a:readonly string[],b:readonly string[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);

/** No persistent state is introduced. Actual saves migrate to the current
 * schema before commands; historical simulation keeps its literal catalogue.
 * Commit only copied filters, preserving identity, label and every owner/task. */
export function applyApparelPolicyUpdate(world:World,command:ApparelPolicyUpdateCommand):CommandResult {
  try{
    const tainted=!!command&&typeof command==='object'&&Object.hasOwn(command,'allowTainted374');
    if(world.schemaVersion!==SCHEMA_VERSION||!command||typeof command!=='object'||Reflect.ownKeys(command).length!==FIELDS.length+(tainted?1:0)
      ||!FIELDS.every(key=>Object.hasOwn(command,key))||tainted&&(world.schemaVersion<374||typeof command.allowTainted374!=='boolean'))return fail();
    const {type,policyId,allowedItems,allowedMaterials,minQuality,maxQuality,minHitPointsPercent,maxHitPointsPercent}=command;
    if(type!=='apparel-policy-update'||!Number.isSafeInteger(policyId)||policyId<=0)return fail();
    const registry=world.apparelPolicies,index=registry?.findIndex(policy=>policy.id===policyId)??-1;
    if(!registry||index<0||!denseStrings(allowedItems,Object.keys(APPAREL).length)||!denseStrings(allowedMaterials,APPAREL_POLICY_MATERIALS267.length))return fail();
    const previous=registry[index]!;
    const {taintedAllowed374:_,...rest}=previous,refuse=tainted?command.allowTainted374===false:previous.taintedAllowed374===false;
    const next:ApparelPolicy={...rest,allowedItems:[...allowedItems],allowedMaterials:[...allowedMaterials],minQuality,maxQuality,minHitPointsPercent,maxHitPointsPercent,...refuse?{taintedAllowed374:false as const}:{}};
    if(!validApparelPolicy(next,world.schemaVersion))return fail();
    if(same(previous.allowedItems,next.allowedItems)&&same(previous.allowedMaterials,next.allowedMaterials)
      &&previous.minQuality===minQuality&&previous.maxQuality===maxQuality
      &&previous.minHitPointsPercent===minHitPointsPercent&&previous.maxHitPointsPercent===maxHitPointsPercent
      &&(previous.taintedAllowed374===false)===refuse)return {ok:true};
    world.apparelPolicies=registry.map((policy,i)=>i===index?next:policy);
    return {ok:true};
  }catch{return fail();}
}


export interface ApparelPolicyCopyCommand {type:'apparel-policy-copy';policyId:number;label:string}
export interface ApparelPolicyRenameCommand {type:'apparel-policy-rename';policyId:number;label:string}
export type ApparelPolicyNameCommand=ApparelPolicyCopyCommand|ApparelPolicyRenameCommand;
/** Local command rule only: existing saved labels remain literal. Length uses
 * the same UTF-16 bound as the persistent registry; duplicate labels are legal. */
export function normalizeApparelPolicyName(value:unknown):string|null {
  if(typeof value!=='string'||/[\u0000-\u001f\u007f-\u009f]/.test(value))return null;
  const label=value.trim();return label.length>=1&&label.length<=60?label:null;
}
const nameFields=['type','policyId','label'] as const;
/** Campaign metadata only. Both commands finish all admission and allocation
 * checks before commit; no actor, Auto/forced flag, task or due check is touched. */
export function applyApparelPolicyName(world:World,command:ApparelPolicyNameCommand):CommandResult {
  const refuse=(reason:string,code:CommandResult['code']='invalid-command'):CommandResult=>({ok:false,code,reason});
  try{
    if(world.schemaVersion!==SCHEMA_VERSION||!command||typeof command!=='object'
      ||Reflect.ownKeys(command).length!==nameFields.length||!nameFields.every(k=>{
        const d=Object.getOwnPropertyDescriptor(command,k);return !!d&&d.enumerable&&Object.hasOwn(d,'value');
      }))return refuse('Commande de politique de tenue invalide.');
    const {type,policyId}=command,label=normalizeApparelPolicyName(command.label);
    if((type!=='apparel-policy-copy'&&type!=='apparel-policy-rename')||!Number.isSafeInteger(policyId)||policyId<=0||label===null)
      return refuse('Donnez un nom de 1 à 60 caractères, sans caractère de contrôle.');
    const registry=world.apparelPolicies,nextId=world.nextApparelPolicyId;
    if(!Array.isArray(registry)||registry.length<1||registry.length>32||typeof nextId!=='number'||!Number.isSafeInteger(nextId)||nextId<=0
      ||registry.some(p=>!validApparelPolicy(p)||p.label.length>60)||new Set(registry.map(p=>p.id)).size!==registry.length
      ||registry.some(p=>p.id>=nextId))return refuse('Registre des politiques de tenue invalide.');
    const index=registry.findIndex(p=>p.id===policyId);if(index<0)return refuse('Cette politique de tenue n’existe plus.','missing-target');
    const source=registry[index]!;
    if(type==='apparel-policy-rename'){
      if(source.label===label)return {ok:true};
      const renamed:ApparelPolicy={...source,label};
      world.apparelPolicies=registry.map((p,i)=>i===index?renamed:p);
      return {ok:true};
    }
    if(registry.length>=32)return refuse('Le registre contient déjà 32 politiques de tenue.');
    if(!Number.isSafeInteger(nextId+1))return refuse('Les identifiants de politique de tenue sont épuisés.');
    // Whitelist confirmed filters: identity/name and any future metadata are
    // never copied from an editor draft, pawn, equipment task or source object.
    const copy:ApparelPolicy={id:nextId,label,allowedItems:[...source.allowedItems],allowedMaterials:[...source.allowedMaterials],
      minQuality:source.minQuality,maxQuality:source.maxQuality,minHitPointsPercent:source.minHitPointsPercent,maxHitPointsPercent:source.maxHitPointsPercent,
      ...source.taintedAllowed374===false?{taintedAllowed374:false as const}:{}};
    const updated=[...registry,copy],nextCounter=nextId+1;
    world.apparelPolicies=updated;world.nextApparelPolicyId=nextCounter;
    return {ok:true};
  }catch{return refuse('Commande de politique de tenue invalide.');}
}
