import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {detectFirefoam290,advanceFirefoamWick290} from './firefoam-290.ts';
import {mechRaidGroups261} from './mechanical-raid-groups-261.ts';
import { advanceMechanoidCombat } from './mechanoid-combat.ts';
import { mechanoidRangedQueries,reconcileMechanoidRanged } from './mechanoid-ranged.ts';
import { advanceMechanoidRaid } from './mechanoid-raids.ts';
import { advanceAnimalMelee } from './wildlife-melee.ts';
import { isAnimalTarget,isMechanoidTarget,isPawnTarget } from './combat-target.ts';
import { disturbanceEvents } from './disturbance.ts';
import { advanceMelee } from './melee.ts';
import { blockedCells } from './pathfinding.ts';
import {createCoreProjectileStepper297,type CoreProjectileEvents297,type CoreShotAudio297} from './core-projectile-system-297.ts';
import { advanceShooter,shootingQueries } from './shooting.ts';
import { combatShotBatch } from './combat-shot-batch.ts';
import type { World } from './types.ts';
import { advanceBombWick } from './bomb-system.ts';
import { advanceTurretOwner,captureTurretTargets,turretOperational,turretHashDue,type TurretAcquisitionBudget } from './mini-turret.ts';
import { advanceEmp } from './emp-effects.ts';
import type { SpikeTrapWindow } from './spike-traps.ts';
import {spikeTrapWindow297} from './spike-traps-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {filteredStructures,structuresOfKind} from './structure-navigation.ts';


export type CorePhysicsInvalidation297='macro'|'command'|'movement'|'impact';
export interface CoreStrikeAudio297 {
  actorId:number;atCore:number;x:number;z:number;kind:'human'|'animal'|'mechanical';
}
export interface CoreObserverEffects297 {threatsChanged:boolean;audioChanged:boolean}
export interface CoreStepResult297 {
  core:number; actorsChanged:readonly number[]; projectileEvents:CoreProjectileEvents297; requiresFull:boolean;
  observerEffects297:CoreObserverEffects297;strikeAudio297:readonly CoreStrikeAudio297[];shotAudio297:readonly CoreShotAudio297[];
  /** Set by the Engine map step: changes a calm Full may publish (see AdvancedCoreMap297). */
  deferredChange297?:boolean;
  /** Set by the Engine map step: doors that opened or closed (ids). */
  doorsMoved297?:readonly number[];
}
/** Created at the last committed Core. Engine changes the real World phase and
 * advances movement BEFORE calling this synchronous physical owner. */
const isWickCasket=(s:World['structures'][number]):boolean=>s.kind==='ancient-cryptosleep-casket'||s.kind==='cryptosleep-casket'||s.kind==='ship-cryptosleep-casket';
export function createCorePhysics297(world:World) {
  if(!isCorePhysicalSchema297(Number(world.schemaVersion)))throw new RangeError('Core297 owner requires schema297');
  let lastCore=effectiveCore297(world),dirty=true;
  const projectiles=createCoreProjectileStepper297(world);
  const captureOwners=()=>{
    const people=world.pawns.filter(p=>p.shooting||p.melee),targets=new Set(people.map(p=>p.melee?.order?.targetId));
    const animalTargets=new Set(world.wildlife?.animals.flatMap(a=>a.predation?[a.predation.targetId]:[])??[]);
    const shooters=[...people,...(world.mechanoids?.filter(m=>m.melee||m.ranged||m.stun||m.emp||m.stagger)??[]),...(world.wildlife?.animals.filter(a=>a.predation||a.manhunter||a.threat||a.strike||a.retaliation||a.stun||targets.has(a.id)||animalTargets.has(a.id))??[])];
    // Shared kind index (array order kept); the live fields are filtered here.
    const poppers=structuresOfKind(world,'firefoam-popper').filter(s=>s.firefoam290),turrets=structuresOfKind(world,'mini-turret').filter(s=>s.turret);
    const caskets=filteredStructures(world,'core-wick-caskets',isWickCasket).filter(s=>s.casketWick);
    return {turrets,owners:[...shooters.map(pawn=>({id:pawn.id,pawn})),...[...turrets,...caskets,...poppers].map(structure=>({id:structure.id,structure}))].sort((a,b)=>a.id-b.id)};
  };
  let captured:ReturnType<typeof captureOwners>|undefined;
  let batch:ReturnType<typeof combatShotBatch>|undefined,physical:Uint8Array|undefined;
  // undefined: not captured; null: no trap at the last structure/barrier capture.
  // Movement cannot create a trap. Macro/command/impact revoke only an absence;
  // a present owner keeps the existing live refresh and ordered contact queue.
  let disturbance=disturbanceEvents(world),ownContacts:SpikeTrapWindow|null|undefined,lastUsedExternal=false;
  let absentStructures:World['structures']|undefined,absentStructureCount=-1;
  const contactGrid=()=>physical??=blockedCells(world,true);
  const captureQueries=()=>{let index:ReturnType<typeof captureTurretTargets>|undefined;
    batch??=combatShotBatch(world);
    const common=shootingQueries(world,batch.read),mechanical=mechanoidRangedQueries(world,batch.read,contactGrid);
    return {...common,turretTargets:()=>index??=captureTurretTargets(world),mechanoid:{...mechanical,targets:common.targets,stands:common.stands}};
  };
  let queries:ReturnType<typeof captureQueries>|undefined;
  const invalidate=(reason:CorePhysicsInvalidation297)=>{dirty=true;batch=undefined;physical=undefined;queries=undefined;projectiles.invalidate();
    if(ownContacts===null&&reason!=='movement')ownContacts=undefined;
  };
  return {invalidate,advance(core:number,externalContacts?:SpikeTrapWindow):CoreStepResult297 {
    // These guards precede pruning, chance draws, owner counters or capture adoption.
    if(!Number.isSafeInteger(core)||core!==lastCore+1||core!==effectiveCore297(world)||!isCorePhysicalSchema297(Number(world.schemaVersion)))throw new RangeError('Invalid next physical Core');
    const contactsDirty=dirty;
    if(dirty){captured=captureOwners();disturbance=disturbanceEvents(world);
      dirty=false;
    }
    if(!externalContacts){
      if(ownContacts===undefined||lastUsedExternal||ownContacts===null&&(absentStructures!==world.structures||absentStructureCount!==world.structures.length)){
        ownContacts=spikeTrapWindow297(world,lastCore)??null;
        if(ownContacts===null){absentStructures=world.structures;absentStructureCount=world.structures.length;}
      }else if(contactsDirty)ownContacts?.refresh();
    }
    const contacts=externalContacts??ownContacts??undefined;lastUsedExternal=externalContacts!==undefined;
    queries??=captureQueries();
    const changedActors=new Set<number>(),strikeAudio297:CoreStrikeAudio297[]=[];
    let requiresFull=false,threatsChanged=false,audioChanged=false;
    const impact=()=>{requiresFull=true;threatsChanged=true;audioChanged=true;invalidate('impact');contacts?.refresh();
      // Reconcile against the actual Core, never a fractional civil World.
      queries=captureQueries();for(const m of world.mechanoids??[])if(m.ranged){reconcileMechanoidRanged(world,m,core,queries.mechanoid);changedActors.add(m.id);}
    };
    const projectileResult=projectiles.advance(core,()=>{
      const foamRng=world.firefoam290?.rng;detectFirefoam290(world,core);if(foamRng!==world.firefoam290?.rng)requiresFull=true;
      const trapChanged=contacts?.advance(core)??false;if(trapChanged)impact();
      const empChanged=advanceEmp(world,core);if(empChanged){requiresFull=true;for(const m of world.mechanoids??[])changedActors.add(m.id);}
      const groups=mechRaidGroups261(world),before=groups.map(g=>({group:g,phase:g.phase}));
      const completed=world.raids?.completed;
      advanceMechanoidRaid(world,core);
      if(completed!==world.raids?.completed||before.some(row=>row.group.phase!==row.phase))impact();
      // Birth/retirement from traps/EMP/raid transitions expires captures before
      // admitting the next persistent-ID owner. The current ordered row stays
      // fixed just as in one historical Core owner transaction.
      const contactsDirty=dirty;
    if(dirty){captured=captureOwners();queries=captureQueries();dirty=false;}
      const {owners,turrets}=captured!;
      const due=turrets.filter(s=>{const t=s.turret!;return turretOperational(world,s,core)&&!t.holdFire&&!t.warmup&&!t.burst&&t.cooldownCore<=1&&t.ammoQ>=4&&turretHashDue(s,core);}).sort((a,b)=>a.id-b.id);
      const admitted=new Set<number>(),offset=due.length?Math.floor(core/15)%due.length:0;
      for(let n=offset;n<Math.min(offset+8,due.length);n++)admitted.add(due[n]!.id);
      const budget:TurretAcquisitionBudget={remaining:8,pairs:32768};
      for(const owner of owners){
        if('structure' in owner){const s=owner.structure;
          if(!world.structures.includes(s))continue;
          if(advanceFirefoamWick290(world,s,core)||advanceBombWick(world,s,core)){impact();continue;}
          if(s.kind==='mini-turret'){
            const result=advanceTurretOwner(world,s,core,queries!,admitted.has(s.id)?budget:{remaining:0,pairs:0});
            if(result.changed)requiresFull=true;
          }
          continue;
        }
        const pawn=owner.pawn;changedActors.add(pawn.id);
        const previousStrike=isAnimalTarget(pawn)?pawn.strike?.atCore:pawn.melee?.strike?.atCore;
        const combatChanged=isMechanoidTarget(pawn)?advanceMechanoidCombat(world,pawn,core,{blocked:contactGrid,grid:queries!.grid,ranged:queries!.mechanoid}):isAnimalTarget(pawn)?advanceAnimalMelee(world,pawn,core,contactGrid,queries!.grid,disturbance):advanceMelee(world,pawn,core,contactGrid,queries!,disturbance);
        const strike=isAnimalTarget(pawn)?pawn.strike:pawn.melee?.strike;
        if(strike&&strike.atCore===core&&strike.atCore!==previousStrike){
          const mechanical=isMechanoidTarget(pawn);
          strikeAudio297.push({actorId:pawn.id,atCore:core,x:pawn.x+(mechanical?.5:0),z:pawn.z+(mechanical?.5:0),kind:mechanical?'mechanical':isAnimalTarget(pawn)?'animal':'human'});
          audioChanged=true;
        }
        if(combatChanged)impact();
        if(isPawnTarget(pawn)){const attack=pawn.lastAttack;advanceShooter(world,pawn,core,queries!,'core');
          // An emission can also award skill XP, outside the actor allowlist.
          if(attack!==pawn.lastAttack)requiresFull=true;}
      }
      return trapChanged||empChanged;
    },impact,disturbance);
    lastCore=core;
    audioChanged||=projectileResult.projectileEvents.upserted.length>0||projectileResult.shotAudio297.length>0;
    return {core,actorsChanged:[...changedActors],projectileEvents:projectileResult.projectileEvents,requiresFull:requiresFull||projectileResult.requiresFull,
      observerEffects297:{threatsChanged,audioChanged},strikeAudio297,shotAudio297:projectileResult.shotAudio297};
  }};
}
