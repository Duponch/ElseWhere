import {isTextileApparelItem308,isTextileMaterial308} from '../../src/sim/textile-apparel-308.ts';
import {isGarmentItem312} from '../../src/sim/apparel-definitions.ts';

/** A current save relabelled as an older schema must first drop the content
 * that the older schema could not hold; strict validation still refuses it.
 * Schema 308: the new leather and wool garments in apparel policies; schema
 * 312: the T-shirts and jackets. */
export function asOldSchema(json:string,version:number):string {
  const raw=JSON.parse(json) as Record<string,unknown>;
  raw.schemaVersion=version;
  if(version<312)strip(raw,version);
  return JSON.stringify(raw);
}
function strip(value:unknown,version:number):void {
  if(Array.isArray(value)){for(const v of value)strip(v,version);return;}
  if(!value||typeof value!=='object')return;
  const o=value as Record<string,unknown>;
  if(Array.isArray(o.allowedItems)&&Array.isArray(o.allowedMaterials)){
    o.allowedItems=(o.allowedItems as unknown[]).filter(i=>!isGarmentItem312(i)&&(version>=308||!isTextileApparelItem308(i)));
    if(version<308)o.allowedMaterials=(o.allowedMaterials as unknown[]).filter(m=>!isTextileMaterial308(m));
  }
  for(const v of Object.values(o))if(v&&typeof v==='object')strip(v,version);
}
/** Same as asOldSchema on a parsed save or an in-memory world (mutated). */
export function stripFutureContent(value:unknown,version:number):void {
  if(version<312)strip(value,version);
}
