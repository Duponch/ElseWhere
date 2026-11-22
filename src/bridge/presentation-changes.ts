import {isSchema285OrLater} from '../sim/schema-compatibility-257.ts';
// Affiliation and flight are discrete gameplay presentation phases.
import type { World } from '../sim/types.ts';
import { anestheticStage } from '../sim/anesthetic.ts';

/** Publish discrete phase changes at their own tick. Continuous walking,
 * hunger, work progress and food age still use the periodic snapshots. This
 * transport observer never changes the simulation or enters a save. */
export class PresentationChanges {
  private signature:string|undefined;
  private relationshipLinks:NonNullable<World['relationships']>['links']|undefined;
  private relationshipSignature:string|undefined;
  protected readStructures(world:World):unknown {
    return world.structures.map(s=>[s.id,s.x,s.z,s.casketWick,s.firefoam290?.wick,s.medical,s.prisoner,s.emp,s.fuel? s.fuel.ticks>0:undefined,s.door?.changedAt,s.door?.open,s.power?.on,s.power?.parentId,s.power?.switchOn,
        s.turret?[s.turret.ammoQ,s.turret.autoReload,s.turret.holdFire,s.turret.targetKey,!!s.turret.warmup,
          s.turret.burst?.targetKey,!!s.turret.burst,s.turret.cooldownCore>0,s.turret.wick]:undefined]);
  }
  capture(world:World):boolean {
    // Canonical producers replace the links array. Serialize a new graph once,
    // while retaining value equality for a cloned immutable World.
    if(world.relationships?.links!==this.relationshipLinks){
      this.relationshipLinks=world.relationships?.links;
      this.relationshipSignature=JSON.stringify(world.relationships?.links);
    }
    const signature=JSON.stringify([
      world.seed,world.width,world.height,world.events.at(-1),
      this.relationshipSignature,
      // Countdown is continuous; real impact and discharge are discrete.
      world.startingArrival?[world.startingArrival.phase,world.startingArrival.phase==='opened'
        ?[world.startingArrival.openedAt,world.startingArrival.cells]
        :world.startingArrival.pods.map(p=>[p.id,'phase' in p?p.phase:undefined])]:undefined,
      world.worldIncidents?.active,
      world.campaignMap?.incidents,
      world.podRescues?.pending,world.podRescues?.incidents,world.pawns.map(p=>p.podRescue),
      world.wildlife?.animals.map(a=>[a.id,a.state,a.burning?.phase,a.meal?.id,a.flee,a.stagger,a.stun,a.threat,a.strike,a.health?.nextInjuryId,a.exiting?.destination,a.manhunter?[a.manhunter.startedAtCore,a.manhunter.targetId,a.manhunter.door]:undefined]),world.wildlife?.eatenNutrition,world.wildlife?.exitedAnimals,
      world.fires?.items.map(f=>[f.id,f.attachedPawnId,f.attachedAnimalId]),world.weather?.current,
      world.visitors?.groups.map(g=>[g.id,g.phase,g.hostile,g.reason]),world.trade?.count,
      world.commercialTrip?('pawnId' in world.commercialTrip
        ?[world.commercialTrip.phase,world.commercialTrip.pawnId,world.commercialTrip.phase==='loading'?world.commercialTrip.cursor:world.commercialTrip.phase==='unloading'?world.commercialTrip.pendingPileIds:world.commercialTrip.exit]
        :[world.commercialTrip.phase,world.commercialTrip.pawn.id,world.commercialTrip.consumed,world.commercialTrip.silverPaid,world.commercialTrip.bought,world.commercialTrip.silverEarned,world.commercialTrip.sold]):undefined,
      world.civilianPost?[world.civilianPost.generation,world.civilianPost.transactions,world.civilianPost.stock.map(p=>[p.id,p.item,p.quantity,p.damage])]:undefined,
      world.projectiles?.map(p=>[p.id,p.emittedAtCore,p.arrival]),
      world.bombWaves?.map(w=>w.emp?[w.id,w.sourceId,w.startedAtCore,w.emp]:w.shortCircuit?[w.id,w.sourceId,w.startedAtCore,w.shortCircuit]:[w.id,w.sourceId,w.startedAtCore]),
      world.firefoam290?.waves.map(w=>[w.id,w.sourceId,w.startedAtCore,w.nextCell]),
      world.raids?.mechActive,world.raids?.extraMechActive261,
      world.mechanoids?.map(m=>[m.id,m.mechKind,m.state,m.melee,m.stun,m.emp,m.raid?.goal,m.temple,m.health?.nextInjuryId,m.health?.missing,
        // Busy clocks decrease continuously; only real admissions, phase/focus
        // changes and suspension boundaries request an immediate publication.
        m.ranged?.order,m.ranged?.stance?[m.ranged.stance.phase,m.ranged.stance.targetKey,m.ranged.stance.startedAtCore]:undefined]),
      world.strip351,
      // Schema 352: a new letter is shown (and sounds) at its own tick.
      world.letters352?.next,
      world.pawns.map(p=>[p.id,p.state,p.burning?.phase,p.firefighting?.phase,p.firefighting?.fireId,p.raid?.exiting,p.mental?.crisis?.kind,p.mental?.crisis?.target,
        p.mental?.crisis&&'targetId' in p.mental.crisis?p.mental.crisis.targetId:undefined,
        p.mental?.crisis?.kind==='tantrum'?p.mental.crisis.attempted:undefined,
        p.mental?.crisis?.kind==='fire-starting-spree'?[p.mental.crisis.igniteId,p.mental.crisis.stanceCore!==null,p.mental.crisis.cast]:undefined,
        p.meleeThreat,p.bombRefuge,p.bedId,p.social?.last,p.romanceMemories,p.familyBereavement,p.deathThoughts,
        isSchema285OrLater(world.schemaVersion)&&p.coupleTask285?[p.coupleTask285.otherId,p.coupleTask285.bedId,p.coupleTask285.slot,p.bedSlot,p.coupleTask285.enteredAtCore,p.coupleTask285.endsAtCore]:undefined,
        p.firefoamTask290?[p.firefoamTask290.structureId,p.firefoamTask290.phase]:undefined,!!p.health?.coveredInFirefoam290,
        p.strip351?[p.strip351.targetId,p.strip351.phase]:undefined,
        p.jobId,p.faction,p.worldAffiliation259,p.prisonerHistory259?.capturedAt,p.prisoner?.capturedAt,p.prisoner?.mode,p.prisoner?.lastChatTick,p.prisoner?.escape,p.ward?.kind,p.ward?.patientId,p.ward?.phase,p.hostilityResponse,p.draft?.holdFire,p.tactics?.targetId,p.tactics?.post,p.flee,p.melee,p.stun,
        // Human Busy clocks pay every Core. Publish real orders/phases and
        // stun boundaries, leaving continuous watermarks to periodic snapshots.
        p.shooting?[p.shooting.order,p.shooting.stance?[p.shooting.stance.phase,p.shooting.stance.startedAtCore,p.shooting.stance.weaponItem,p.shooting.stance.phase==='aim'?p.shooting.stance.targetStartedDowned:undefined]:null]:undefined,
        p.stagger,!!p.draft,p.draft?.target,p.draft?.queue,p.equipmentTask?.itemId,p.equipmentTask?.action,p.equipmentDropPending,p.rescue,p.raid?.kidnap261,p.tend?.patientId,p.tend?.phase,p.feed?.patientId,p.feed?.phase,p.medicalSleep,p.interruptedCargo,p.need?.phase,p.need?.kind==='sleep'?p.need.bedId:undefined,
        p.surgeryRequest,p.surgery?[p.surgery.patientId,p.surgery.part,p.surgery.bedId,p.surgery.spot,p.surgery.phase,p.surgery.consumedMedicine,p.surgery.implant,p.surgery.ingredients]:undefined,
        // Medical topology/results and anesthetic stage boundaries are
        // discrete. Severity decay and surgical work keep periodic snapshots.
        p.health?.nextInjuryId,p.health?.missing,p.health?.anesthetic?[p.health.anesthetic.bornAt,p.health.anesthetic.expiresAtCore,anestheticStage(p.health.anesthetic.severity)]:undefined,
        p.burial?.phase,p.burial?.corpseId,p.cleaning?.phase,p.cleaning?.targets[0],p.health?.foodPoisoning?.vomit?.remainingCore!==undefined,p.health?.flu?.vomit?.remainingCore!==undefined,p.health?.immuneDiseases?.malaria?.vomit?.remainingCore!==undefined,p.body?.pileId,p.body?.lostAt,p.hunting?.animalId,p.hunting?.phase,p.research?.stationId,p.haul?.phase,p.haul?.carryPileId,p.cooking?.phase,p.cooking?.productId,
        p.recreation.task?.activity,p.recreation.task?.buildingId,p.visitor?.group,p.visitor?.role,p.visitor?.phase,p.trade?.traderId,p.trade?.phase]),
      world.piles.map(p=>[p.id,p.item,p.quantity,p.owner]),
      this.readStructures(world),
      (world.packed??[]).map(p=>[p.building.id,p.owner]),
      [world.roofing?.constructed,world.roofing?.natural?.thin,world.roofing?.natural?.thick],
    ]);
    // Value comparison also works on immutable worlds decoded across a worker.
    const changed=this.signature!==signature;this.signature=signature;return changed;
  }
}
