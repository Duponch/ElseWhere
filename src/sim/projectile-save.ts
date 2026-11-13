import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297,effectiveLocal297,validationCore297} from './core-phase-297.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import { bulletPosition,validateBulletFlight } from './bullet-flight.ts';
import { CORE_TICKS_PER_LOCAL,projectileProfile } from './ranged-statistics.ts';
import type { WorldProjectile } from './projectile-state.ts';
import type { World } from './types.ts';
import type { NumericMembershipSink } from './numeric-membership.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const identity=(v:unknown,version=67)=>v===null||typeof v==='string'&&(version>=77||!v.startsWith('animal:'))&&(version>=194||!v.startsWith('mech:'))&&(isSchema256Or257(version)||!v.startsWith('starting-pod:'))&&(/^(pawn|animal|mech|structure|frame|resource|pile|packed|starting-pod):[1-9]\d*$/.test(v)&&integer(Number(v.slice(v.indexOf(':')+1)),1)||/^rock:(0|[1-9]\d*)$/.test(v)&&integer(Number(v.slice(5)),0));
const samePoint=(a:{x:number;z:number},b:unknown)=>record(b)&&keys(b,['x','z'])&&b.x===a.x&&b.z===a.z;

/** Unknown JSON is rejected before touching references or calling the resolver. */
export function validWorldProjectile(value:unknown,world:Pick<World,'width'|'height'|'tick'>,version=88,coreNow297?:number):value is WorldProjectile {
  if(!record(value)||!keys(value,['id','quality','emittedAtCore','advancedAtCore','flight','relations','arrival',...(version>=88?['weaponItem']:[])])||value.weaponItem!==undefined&&value.weaponItem!=='bolt-action-rifle'&&!(version>=193&&value.weaponItem==='mini-turret-gun')&&!(version>=197&&(value.weaponItem==='lancer-gun'||value.weaponItem==='pikeman-gun'))&&!(version>=208&&value.weaponItem==='emp-launcher')&&!(version>=316&&value.weaponItem==='short-bow')&&!(version>=322&&value.weaponItem==='pump-shotgun'))return false;
  const end=isCorePhysicalSchema297(version)?validationCore297(version,world.tick,coreNow297):world.tick*CORE_TICKS_PER_LOCAL;
  if(!Number.isSafeInteger(end)||!integer(value.id,1)||!integer(value.emittedAtCore,0,end)||!integer(value.advancedAtCore,value.emittedAtCore,end))return false;
  const f=value.flight,r=value.relations;
  if(!record(f)||!keys(f,['launcherKey','intendedKey','usedKey','flags','preventFriendlyFire','equipmentKey','origin','destination','speedPerCoreTick','remainingCoreTicks','completed'])||!record(f.origin)||!keys(f.origin,['x','z'])||!record(f.destination)||!keys(f.destination,['x','z']))return false;
  const mini=value.weaponItem==='mini-turret-gun';
  const mech=value.weaponItem==='lancer-gun'||value.weaponItem==='pikeman-gun';
  if(typeof f.launcherKey!=='string'||!(mini?/^structure:[1-9]\d*$/:mech?/^mech:[1-9]\d*$/:/^pawn:[1-9]\d*$/).test(f.launcherKey)||!identity(f.launcherKey,version)||!identity(f.intendedKey,version)||!identity(f.usedKey,version)||(mini||mech)&&(f.equipmentKey!==null||value.quality!=='normal')||f.equipmentKey!==null&&(typeof f.equipmentKey!=='string'||!/^pile:[1-9]\d*$/.test(f.equipmentKey)||!identity(f.equipmentKey,version)))return false;
  if(!record(r)||!keys(r,['friendlyPawnIds','friendlyFireFactor',...(version>=197?['friendlyTargetKeys']:[])])||!Array.isArray(r.friendlyPawnIds)||r.friendlyPawnIds.length>world.width*world.height||r.friendlyPawnIds.some((id,i,a)=>!integer(id,1)||i>0&&Number(a[i-1])>=id)||typeof r.friendlyFireFactor!=='number'||!Number.isFinite(r.friendlyFireFactor)||r.friendlyFireFactor<0||r.friendlyFireFactor>1)return false;
  if(r.friendlyTargetKeys!==undefined&&(!Array.isArray(r.friendlyTargetKeys)||r.friendlyTargetKeys.length>world.width*world.height
    ||Object.keys(r.friendlyTargetKeys).length!==r.friendlyTargetKeys.length||r.friendlyTargetKeys.some((key,i,a)=>typeof key!=='string'
      ||!/^(pawn|animal|mech):[1-9]\d*$/.test(key)||!identity(key,version)||i>0&&String(a[i-1])>=key)))return false;
  try {
    const p=value as unknown as WorldProjectile,profile=projectileProfile(p.weaponItem??'revolver',p.quality)!;validateBulletFlight(p.flight);
    if(f.speedPerCoreTick!==profile.projectileTilesPerCoreTick||p.flight.origin.x<0||p.flight.origin.z<0||p.flight.origin.x>=world.width||p.flight.origin.z>=world.height)return false;
    // Ordinary revolver + wild-miss radius, not an arbitrary long-lived missile.
    const distance=Math.hypot(p.flight.destination.x-p.flight.origin.x,p.flight.destination.z-p.flight.origin.z);
    if(distance>profile.range+12)return false;
    const position=bulletPosition(p.flight);if(position.x<0||position.z<0||position.x>=world.width||position.z>=world.height)return false;
    const total=Math.max(1,Math.ceil(distance/profile.projectileTilesPerCoreTick)),elapsed=p.advancedAtCore-p.emittedAtCore;
    if(!p.flight.completed)return value.arrival===null&&p.advancedAtCore===end&&p.flight.remainingCoreTicks===total-elapsed;
    const a=value.arrival;if(!record(a)||!keys(a,['kind','targetKey','point','coreTick','effect'])||!integer(a.coreTick,1,total)||a.coreTick!==elapsed||!identity(a.targetKey,version)||!samePoint(bulletPosition(p.flight),a.point)||p.advancedAtCore<=(isCorePhysicalSchema297(version)?Math.floor((end-1)/10)*10:(world.tick-1)*CORE_TICKS_PER_LOCAL))return false;
    if(a.kind==='exit')return a.effect==='exit'&&a.targetKey===null&&p.flight.remainingCoreTicks===total-elapsed+1;
    if(a.kind!=='impact'||p.flight.remainingCoreTicks!==total-elapsed)return false;
    return a.targetKey===null?a.effect==='ground':String(a.targetKey).startsWith('pawn:')?a.effect==='pawn':String(a.targetKey).startsWith('animal:')?version>=77&&a.effect==='animal':String(a.targetKey).startsWith('mech:')?version>=194&&a.effect==='mech':a.effect==='unsupported-object'
      ||version>=67&&String(a.targetKey).startsWith('structure:')&&a.effect==='barrier'
      ||isSchema256Or257(version)&&String(a.targetKey).startsWith('starting-pod:')&&a.effect==='starting-pod'
      ||version>=193&&(['structure','pile','resource','packed'] as const).some(kind=>String(a.targetKey).startsWith(`${kind}:`)&&a.effect===kind);
  } catch {return false;}
}

export function validateProjectiles(world:World,version:number,ids:NumericMembershipSink):string[] {
  const value=world.projectiles;if(value===undefined)return [];
  if(version<55||!Array.isArray(value)||!value.length||value.length>world.width*world.height)return ['Invalid projectile collection for schema.'];
  const errors:string[]=[];let previous=0;
  for(const p of value) {
    if(!validWorldProjectile(p,world,version,isCorePhysicalSchema297(version)?effectiveCore297(world):undefined)){errors.push('Invalid persistent projectile.');continue;}
    if(ids.has(p.id)||p.id<=previous||p.id>=world.nextId)errors.push('Invalid projectile identity/order.');
    if(version>=193&&p.weaponItem==='mini-turret-gun'){
      const sourceId=Number(p.flight.launcherKey.slice(10)),source=world.structures.find(s=>s.id===sourceId);
      const occupied=ids.has(sourceId)||[...world.pawns,...world.jobs,...world.resources,...world.piles,...world.packed.map(p=>p.building),...(world.wildlife?.animals??[]),...(world.mechanoids??[]),...(world.projectiles??[]),...(world.bombWaves??[]),...(world.fires?.items??[])].some(t=>t.id===sourceId);
      if(sourceId>=p.id||sourceId>=world.nextId||(source?source.kind!=='mini-turret'||!source.turret||p.flight.origin.x!==source.x+.5||p.flight.origin.z!==source.z+.5:occupied))errors.push('Invalid intrinsic projectile launcher.');
    }
    if(p.weaponItem==='lancer-gun'||p.weaponItem==='pikeman-gun'){
      const sourceId=Number(p.flight.launcherKey.slice(5)),kind=p.weaponItem==='lancer-gun'?'lancer':'pikeman';
      const source=world.mechanoids?.find(m=>m.id===sourceId),corpse=world.piles.find(i=>i.id===sourceId&&i.mechCorpse);
      const occupied=ids.has(sourceId)||[world.pawns,world.jobs,world.resources,world.structures,world.piles,world.wildlife?.animals??[],world.projectiles??[],world.bombWaves??[],world.fires?.items??[]].some(owners=>owners.some(o=>o.id===sourceId))||world.packed.some(p=>p.building.id===sourceId);
      if(sourceId>=p.id||sourceId>=world.nextId||(source?source.mechKind!==kind:corpse?corpse.mechCorpse!.mechKind!==kind:occupied))errors.push('Invalid intrinsic mechanical projectile launcher.');
    }
    if(p.relations.friendlyTargetKeys?.some(key=>Number(key.slice(key.indexOf(':')+1))>=p.id))errors.push('Invalid prospective projectile relation identity.');
    ids.add(p.id);previous=p.id;
  }
  return errors;
}
