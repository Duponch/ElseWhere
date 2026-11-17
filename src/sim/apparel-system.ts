import {isStrip351} from './strip-state-351.ts';
import { storageAt,storageCellAccepts } from './shelf-storage.ts';
import { isColonist } from './affiliation.ts';
import { allowedAreaAllows,captureAllowedArea } from './allowed-area-state.ts';
import { chooseApparelReplacement,type ApparelPolicyCandidate,type ApparelPolicyGarment } from './apparel-policy.ts';
import { advanceApparelWear,APPAREL_POLICY_INTERVAL } from './apparel-renewal.ts';
import { wornApparel } from './apparel-rules.ts';
import { beginAutomaticEquipment } from './equipment.ts';
import { reservedSource } from './materials.ts';
import type { MaterialPile } from './types.ts';
import type { Reachability } from './pathfinding.ts';
import { routeToJob } from './pathfinding.ts';
import { releaseAssignments } from './work-release.ts';
import { groundFire } from './fire-rules.ts';
import { comfortableTemperature } from './heat-rules.ts';
import { TemperatureView,thermalLayout } from './temperature.ts';
import type { CommandResult,Pawn,World } from './types.ts';

export type ApparelPolicyAssignmentCommand={type:'apparel-policy-assign';pawnId:number;policyId:number;automatic:boolean};
export type ClearForcedApparelCommand={type:'apparel-clear-forced';pawnId:number};
const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
const report=(world:World,message:string)=>{world.events.push({tick:world.tick,type:'job',message});if(world.events.length>80)world.events.splice(0,world.events.length-80);};

export function applyApparelPolicyAssignment(world:World,command:ApparelPolicyAssignmentCommand):CommandResult {
  const pawn=world.pawns.find(p=>p.id===command.pawnId),policy=world.apparelPolicies?.find(p=>p.id===command.policyId);
  if(!pawn||!isColonist(pawn)||pawn.state==='dead'||pawn.prisoner||pawn.visitor||!policy||typeof command.automatic!=='boolean')return fail('Affectation vestimentaire invalide.');
  pawn.apparelPolicyId=policy.id;pawn.apparelAutomation=command.automatic;pawn.nextApparelCheckAt=world.tick;
  if(!command.automatic&&pawn.equipmentTask?.automatic)releaseAssignments(world,pawn);
  return {ok:true};
}

/** Release only currently worn manual choices. A pending manual wear retains
 * its intent and will mark its garment forced at real contact completion. */
export function applyClearForcedApparel(world:World,command:ClearForcedApparelCommand):CommandResult {
  if(world.schemaVersion<90||Reflect.ownKeys(command).length!==2||!Object.hasOwn(command,'type')||!Object.hasOwn(command,'pawnId')
    ||command.type!=='apparel-clear-forced'||!Number.isSafeInteger(command.pawnId)||command.pawnId<=0)return fail('Commande de port forcé invalide.');
  const pawn=world.pawns.find(p=>p.id===command.pawnId);
  if(!pawn||!isColonist(pawn)||pawn.state==='dead'||pawn.prisoner||pawn.visitor)return fail('Colon indisponible pour effacer le port forcé.');
  const forced=wornApparel(world,pawn).filter(p=>p.kind==='apparel'&&p.apparel?.forced===true);
  for(const pile of forced)delete pile.apparel!.forced;
  if(forced.length)pawn.nextApparelCheckAt=world.tick;
  return {ok:true};
}

/** Daily deterioration is replayed from its private saved stream. Destruction
 * removes only the worn identity whose hit points reached zero. */
export function advanceWorldApparelWear(world:World):void {
  if(world.schemaVersion<90||!world.apparelWear||world.tick<world.apparelWear.nextWearAt)return;
  const living=new Set(world.pawns.filter(p=>p.state!=='dead').map(p=>p.id));
  const worn=world.piles.filter(p=>p.owner.type==='apparel'&&living.has(p.owner.pawnId)&&p.apparel).map(p=>({id:p.id,apparel:p.apparel!}));
  const result=advanceApparelWear(world.apparelWear,world.tick,worn);world.apparelWear=result.calendar;
  for(const change of result.changes){const pile=world.piles.find(p=>p.id===change.id&&p.owner.type==='apparel'&&p.apparel);if(!pile)continue;
    pile.apparel!.hitPoints=change.remaining;if(!change.destroyed)continue;
    const wearer=world.pawns.find(p=>pile.owner.type==='apparel'&&p.id===pile.owner.pawnId);if(wearer?.equipmentTask?.itemId===pile.id)releaseAssignments(world,wearer);
    world.piles.splice(world.piles.indexOf(pile),1);if(wearer)report(world,`${wearer.name} a usé un vêtement jusqu’à sa destruction.`);
  }
}

const nextInterval=(world:World,pawn:Pawn):number=>{
  let value=(world.seed^pawn.id^world.tick)>>>0;value=Math.imul(value^value>>>16,0x45d9f3b)>>>0;
  return APPAREL_POLICY_INTERVAL.min+value%(APPAREL_POLICY_INTERVAL.max-APPAREL_POLICY_INTERVAL.min+1);
};
const stored=(world:World,x:number,z:number,pile:MaterialPile):boolean=>{const cell=storageAt(world,{x,z});return !!cell&&storageCellAccepts(world,cell,pile);};
const busy=(pawn:Pawn):boolean=>pawn.state!=='idle'||pawn.orders.active!==null||pawn.orders.queue.length>0||pawn.jobId!==null||!!(pawn.haul||pawn.cooking||pawn.need||pawn.recreation.task||pawn.research||pawn.hunting||pawn.burial||pawn.cleaning||pawn.orbitalTrade||pawn.trade||pawn.firefighting||pawn.ward||pawn.feed||pawn.tend||pawn.rescue||pawn.equipmentTask||pawn.draft||pawn.flee||pawn.mental?.crisis);

/** Attempts one physical policy action after urgent needs and remembered weapon
 * recovery. A due check stays due while the pawn is busy. */
export function considerApparelPolicy(world:World,pawn:Pawn,search:()=>Reachability|null):boolean {
  if(world.schemaVersion<90||!isColonist(pawn)||pawn.prisoner||pawn.visitor||pawn.state==='dead'||!pawn.apparelAutomation||(pawn.nextApparelCheckAt??Number.MAX_SAFE_INTEGER)>world.tick||busy(pawn))return false;
  const policy=world.apparelPolicies?.find(p=>p.id===pawn.apparelPolicyId);if(!policy){pawn.nextApparelCheckAt=world.tick+nextInterval(world,pawn);return false;}
  const reach=search();if(!reach)return true;
  const worn:ApparelPolicyGarment[]=wornApparel(world,pawn).map(p=>({id:p.id,item:p.item as ApparelPolicyGarment['item'],apparel:p.apparel!}));
  const area=captureAllowedArea(world,pawn);
  const candidates:ApparelPolicyCandidate[]=world.piles.filter(p=>p.kind==='apparel'&&p.apparel&&!p.apparel.forbidden&&p.owner.type==='ground'&&(!area||allowedAreaAllows(world,pawn,p.owner,area))&&stored(world,p.owner.x,p.owner.z,p)).map(p=>({
    id:p.id,item:p.item as ApparelPolicyCandidate['item'],apparel:p.apparel!,stored:stored(world,p.owner.type==='ground'?p.owner.x:0,p.owner.type==='ground'?p.owner.z:0,p),
    reachable:p.owner.type==='ground'&&routeToJob(world,p.owner,reach,true)!==null,reserved:reservedSource(world,p.id,pawn.id)>0,
    burning:world.fires?.items.some(f=>groundFire(f)&&p.owner.type==='ground'&&f.x===p.owner.x&&f.z===p.owner.z),
  }));
  const range=comfortableTemperature(world,pawn),temperature=new TemperatureView(world,thermalLayout(world)).at(world,pawn);
  const choice=chooseApparelReplacement(policy,worn,candidates,temperature<range.min?'cold':'neutral',undefined,isStrip351(world.schemaVersion)&&!pawn.traits?.includes('bloodlust'));pawn.nextApparelCheckAt=world.tick+nextInterval(world,pawn);
  if(!choice)return false;
  return beginAutomaticEquipment(world,pawn,choice.action==='remove'?choice.wornId:choice.candidateId,choice.action,reach);
}
