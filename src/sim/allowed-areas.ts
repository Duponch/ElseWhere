import {interruptIdleForArea300} from './idle-wander-300.ts';
import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {planCurrentMapArea,rememberCurrentMapArea,forgetMapArea} from './pawn-map-areas.ts';
import { captureHumanOwners } from './human-owners.ts';
import { validAllowedAreaCell,validAllowedAreaLabel } from './allowed-area-save.ts';
import type { AllowedArea,AllowedAreaCommand,CommandResult,Pawn,World } from './types.ts';

export const ALLOWED_AREA_LIMIT=10;
/** Local deterministic defaults; area creation never draws the simulation RNG. */
export const ALLOWED_AREA_COLORS=[0x55b8a9,0xe3a655,0x7999d1,0xc886b2,0x9bb66b,0xd47769,0xa594cd,0x72b7d0,0xd0be68,0x99a5b5] as const;
export interface AllowedAreaCommandHooks {
  /** Originals own the physical cargo. Read future assignments through next. */
  preflight?(next:World,affected:readonly Pawn[]):false|unknown;
  reconcile?(world:World,affected:readonly Pawn[],plan:unknown):void;
  /** Prospective extra owners are admitted before any definition/human write. */
  prepareDelete?(world:World,areaId:number):false|unknown;
  commitDelete?(world:World,plan:unknown):void;
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,lo=1,hi=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=lo&&Number(v)<=hi;
const keys=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k)));
const label=(v:unknown):string|undefined=>typeof v==='string'&&validAllowedAreaLabel(v.trim().normalize('NFC'))?v.trim().normalize('NFC'):undefined;
const refusal=(reason:string,code:CommandResult['code']='invalid-command'):CommandResult=>({ok:false,code,reason});
const TYPES=['allowed-area-create','allowed-area-settings','allowed-area-paint','allowed-area-delete','assign-allowed-area'];

/** Only definitions and assignments are committed here. Runtime releases use
 * the caller's physical drop preflight, without importing engine or navigation. */
export function applyAllowedAreaCommand(world:World,input:unknown,hooks:AllowedAreaCommandHooks={}):CommandResult|undefined {
  if(!object(input)||!TYPES.includes(String(input.type)))return undefined;
  const command=input as unknown as AllowedAreaCommand;
  if(world.schemaVersion<223)return refusal('Les zones autorisées nécessitent le schéma 223.');
  const c=command as unknown as Record<string,unknown>,areas=world.allowedAreas??[];
  if(command.type==='allowed-area-create'){
    if(!keys(c,['type'],['label'])||Object.hasOwn(c,'label')&&label(c.label)===undefined)return refusal('Nom de zone invalide.');
    if(areas.length>=ALLOWED_AREA_LIMIT)return refusal('Dix zones autorisées au maximum.');
    if(!int(world.nextId)||!int(world.nextId+1))return refusal('Limite des identités atteinte.');
    const area:AllowedArea={id:world.nextId++,label:label(c.label)??`Zone ${areas.length+1}`,color:ALLOWED_AREA_COLORS[areas.length]!,cells:[]};
    world.allowedAreas=[...areas,area];return {ok:true,affected:1};
  }
  if(command.type==='assign-allowed-area'){
    if(!keys(c,['type','pawnId','areaId'])||!int(c.pawnId)||(c.areaId!==null&&!int(c.areaId)))return refusal('Affectation de zone invalide.');
    const pawn=world.pawns.find(p=>p.id===command.pawnId),area=areas.find(a=>a.id===command.areaId);
    if(!pawn||(pawn.faction??'colony')!=='colony'||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue||pawn.state==='dead'||pawn.health?.death)return refusal('Aucun colon libre ici.','missing-target');
    if(command.areaId!==null&&!area)return refusal('Zone autorisée introuvable.','missing-target');
    if(pawn.allowedAreaId===command.areaId||command.areaId===null&&!Object.hasOwn(pawn,'allowedAreaId'))return {ok:true,affected:0};
    const future={...pawn};if(command.areaId===null)delete future.allowedAreaId;else future.allowedAreaId=command.areaId;
    delete future.allowedAreaReturn;
    if(world.schemaVersion>=256)future.mapAreas=planCurrentMapArea(world,pawn,command.areaId);
    const next={...world,pawns:world.pawns.map(p=>p===pawn?future:p)},affected=[pawn],plan=hooks.preflight?.(next,affected);
    if(plan===false)return refusal('Pas de place pour conserver le chargement interrompu.','occupied');
    if(world.schemaVersion>=256)rememberCurrentMapArea(world,pawn,command.areaId);
    if(command.areaId===null)delete pawn.allowedAreaId;else pawn.allowedAreaId=command.areaId;
    clearReturn(pawn);interruptIdleForArea300(world,pawn);hooks.reconcile?.(world,affected,plan);return {ok:true,affected:1};
  }
  if(!int(c.areaId))return refusal('Identité de zone invalide.');
  const area=areas.find(a=>a.id===c.areaId);if(!area)return refusal('Zone autorisée introuvable.','missing-target');
  if(command.type==='allowed-area-settings'){
    if(!keys(c,['type','areaId'],['label','color'])||!Object.hasOwn(c,'label')&&!Object.hasOwn(c,'color')
      ||Object.hasOwn(c,'label')&&label(c.label)===undefined||Object.hasOwn(c,'color')&&!int(c.color,0,0xffffff))return refusal('Nom ou couleur de zone invalide.');
    world.allowedAreas=areas.map(a=>a===area?{...a,...Object.hasOwn(c,'label')?{label:label(c.label)!}:{},...Object.hasOwn(c,'color')?{color:Number(c.color)}:{}}:a);
    return {ok:true,affected:1};
  }
  if(command.type==='allowed-area-paint'){
    if(!keys(c,['type','areaId','enabled','from','to'])||typeof c.enabled!=='boolean'||!validAllowedAreaCell(c.from,world)||!validAllowedAreaCell(c.to,world))return refusal('Rectangle de zone invalide.');
    const cells=new Set(area.cells),from=command.from,to=command.to;
    for(let z=Math.min(from.z,to.z);z<=Math.max(from.z,to.z);z++)for(let x=Math.min(from.x,to.x);x<=Math.max(from.x,to.x);x++){
      const n=z*world.width+x;if(command.enabled)cells.add(n);else cells.delete(n);
    }
    const replacement={...area,cells:[...cells].sort((a,b)=>a-b)},nextAreas=areas.map(a=>a===area?replacement:a);
    if(isSchema287OrLater(world.schemaVersion)&&replacement.cells.length===area.cells.length&&replacement.cells.every((n,i)=>n===area.cells[i]))return {ok:true,affected:0};
    const affected=world.pawns.filter(p=>p.allowedAreaId===area.id),next={...world,allowedAreas:nextAreas,pawns:world.pawns.map(p=>affected.includes(p)?withoutReturn(p):p)};
    const plan=hooks.preflight?.(next,affected);if(plan===false)return refusal('Pas de place pour conserver le chargement interrompu.','occupied');
    world.allowedAreas=nextAreas;for(const p of affected)clearReturn(p);hooks.reconcile?.(world,affected,plan);return {ok:true,affected:replacement.cells.length};
  }
  if(!keys(c,['type','areaId']))return refusal('Suppression de zone invalide.');
  const deletePlan=hooks.prepareDelete?.(world,area.id);if(deletePlan===false)return refusal('Les détenteurs ne peuvent pas libérer cette zone.','occupied');
  const owners=captureHumanOwners(world).pawnOwners,affected=owners.filter(s=>s.pawn!.allowedAreaId===area.id).map(s=>s.pawn!);
  const nextAreas=areas.filter(a=>a!==area);
  // Deletion removes only this real map/area reference, including off-map owners.
  if(world.schemaVersion>=256)forgetMapArea(world,area.id);
  // Deletion makes every affected owner unlimited; no work becomes forbidden.
  if(nextAreas.length)world.allowedAreas=nextAreas;else delete world.allowedAreas;
  for(const p of affected){delete p.allowedAreaId;clearReturn(p);}
  hooks.reconcile?.(world,affected,undefined);hooks.commitDelete?.(world,deletePlan);return {ok:true,affected:affected.length};
}
const withoutReturn=(p:Pawn):Pawn=>{const next={...p};delete next.allowedAreaReturn;return next;};
function clearReturn(p:Pawn):void {
  if(!Object.hasOwn(p,'allowedAreaReturn'))return;
  delete p.allowedAreaReturn;p.path=[];p.planCooldown=0;
  if(p.state==='moving')p.state='idle';
}
