import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { reconcileAnimalFeeding } from './animal-feeding.ts';
import { leadRopees } from './animal-leading.ts';
import { penRegion } from './animal-pens.ts';
import { productKind, productReady } from './animal-products.ts';
import { slaughterContact,slaughterHandlerAvailable } from './animal-slaughter.ts';
import { autoSlaughterTargets,slaughterIntent } from './auto-slaughter.ts';
import type { AnimalSpeciesId } from './animal-species.ts';
import { structuresOfKind } from './structure-navigation.ts';
import type { World } from './types.ts';

/** Death, corpse conversion and loss of tameness can precede a travelling
 * worker's turn. Release claims immediately; physical cargo survives. */
export function reconcileDomesticWork(world:World):void {
  reconcileAnimalFeeding(world);
  const slaughterTargets=autoSlaughterTargets(world);
  let penMarkers:Map<number,readonly AnimalSpeciesId[]>|undefined;
  for(const animal of world.wildlife?.animals??[]){
    const id=animal.domestic?.penMarkerId;
    if(id===undefined)continue;
    // Marker assignments alone change in this loop. Capture current structures
    // once per pass, never retaining an index across commands, ticks or maps.
    if(!penMarkers){
      penMarkers=new Map();
      // The shared per-kind list: the pen markers of the array, in its order.
      for(const structure of structuresOfKind(world,'pen-marker'))if(structure.pen)
        penMarkers.set(structure.id,structure.pen.accepted);
    }
    if(!penMarkers.get(id)?.includes(animal.species))delete animal.domestic!.penMarkerId;
  }
  for(const pawn of world.pawns){
    const task=pawn.animalHandling??pawn.animalCare;if(!task)continue;
    if(!allowedAreaServicesAllowed(world,pawn)){interruptWork(world,pawn);continue;}
    const animal=world.wildlife?.animals.find(a=>a.id===task.animalId);
    const h=pawn.animalHandling;
    if(h?.kind==='slaughter'&&(!animal||!slaughterIntent(world,animal,world.schemaVersion,slaughterTargets)||!slaughterHandlerAvailable(pawn))){interruptWork(world,pawn);continue;}
    // A later actor can close a diagonal flank or start a physical segment
    // after the handler's turn. Keep the intent, but never publish stale work.
    if(h?.kind==='slaughter'&&h.phase==='interact'&&animal
      &&(!slaughterContact(world,pawn,animal)||pawn.moveCooldown>0||(pawn.motion?.end??0)>world.tick||(animal.motion?.end??0)>world.tick)){
      h.phase='approach';h.progress=0;
    }
    if(!animal||animal.state==='dead'||(h?h.kind==='tame'?!animal.taming?.designated||!!animal.domestic:h.kind==='lead'?!animal.domestic||h.markerId===undefined||animal.domestic.penMarkerId!==h.markerId||!penRegion(world,h.markerId)?.closed
      ||leadRopees(h).some(id=>!world.wildlife?.animals.some(a=>a.id===id&&!!a.domestic&&a.state!=='dead'&&a.state!=='downed'&&a.domestic.penMarkerId===h.markerId))
      :h.kind==='milk'||h.kind==='shear'?!productReady(animal)||productKind(animal)!==h.kind||animal.state==='downed':!animal.domestic:!animal.domestic||animal.domestic.care==='none'))interruptWork(world,pawn);
  }
}
