import {isSchema256Or257} from './schema-compatibility-257.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {materialAllowedForPlayer256,materialPermissionRefusal256,setMaterialForbidden256} from './material-permission-256.ts';
import type {AreaQuery} from './designation.ts';
import type {AreaCommand,CommandResult,MaterialPile,World} from './types.ts';

type PermissionPlan=Extract<AreaQuery,{ok:false}>|(Extract<AreaQuery,{ok:true}>&{piles:MaterialPile[]});
function ownData(value:unknown,keys:readonly string[]):value is Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const own=Reflect.ownKeys(value);return own.length===keys.length&&own.every(key=>typeof key==='string'&&keys.includes(key)&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,key)!,'value')&&Object.getOwnPropertyDescriptor(value,key)!.enumerable);
}
const invalid=():Extract<AreaQuery,{ok:false}>=>({ok:false,code:'invalid-command',reason:'Réglage de rectangle invalide.'});
/** A transient plan over actual current ground owners, never a copied World,
 * selection cap, screen hit list or per-cell command queue. */
function plan(world:World,command:AreaCommand):PermissionPlan {
 if(!ownData(command,['type','action','from','to'])||command.type!=='area'||(command.action!=='allow'&&command.action!=='forbid')||!isSchema256Or257(world.schemaVersion))return invalid();
 if(!ownData(command.from,['x','z'])||!ownData(command.to,['x','z']))return invalid();
 const from=command.from,to=command.to;
 if(![from.x,from.z,to.x,to.z].every(Number.isSafeInteger))return invalid();
 if(from.x<0||from.z<0||to.x<0||to.z<0||from.x>=world.width||to.x>=world.width||from.z>=world.height||to.z>=world.height)return{ok:false,code:'out-of-bounds',reason:'Rectangle hors de la carte.'};
 const bounds={minX:Math.min(from.x,to.x),maxX:Math.max(from.x,to.x),minZ:Math.min(from.z,to.z),maxZ:Math.max(from.z,to.z)},forbidden=command.action==='forbid',cells=new Set<number>(),piles:MaterialPile[]=[];
 for(const pile of world.piles){
  const owner=pile.owner;if(owner.type!=='ground'||owner.x<bounds.minX||owner.x>bounds.maxX||owner.z<bounds.minZ||owner.z>bounds.maxZ||!Number.isSafeInteger(owner.x)||!Number.isSafeInteger(owner.z))continue;
  const cell=owner.z*world.width+owner.x,currentForbidden=!materialAllowedForPlayer256(pile);
  if(foggedCell256(world,cell)||currentForbidden===forbidden||materialPermissionRefusal256(world,pile,forbidden))continue;
  cells.add(cell);piles.push(pile);
 }
 const selected=(bounds.maxX-bounds.minX+1)*(bounds.maxZ-bounds.minZ+1);
 return{ok:true,bounds,cells:[...cells].sort((a,b)=>a-b),selected,skipped:selected-cells.size,piles};
}
/** Same eligibility as commit; no area index or mutation while previewing. */
export function queryAreaMaterialPermission256(world:World,command:AreaCommand):AreaQuery {
 const value=plan(world,command);if(!value.ok)return value;const{piles,...selection}=value;return selection;
}
/** One command, all eligible Items in each known cell. The existing permission
 * owner/forced checks are shared before any write; existing canonical fields
 * are committed synchronously with the same setter as the single-item path. */
export function applyAreaMaterialPermission256(world:World,command:AreaCommand):CommandResult {
 const value=plan(world,command);if(!value.ok)return value;
 if(!value.piles.length)return{ok:false,code:'missing-target',reason:'Aucune case compatible dans ce rectangle.'};
 const forbidden=command.action==='forbid';for(const pile of value.piles)setMaterialForbidden256(pile,forbidden);
 return{ok:true,affected:value.piles.length,skipped:value.skipped};
}
