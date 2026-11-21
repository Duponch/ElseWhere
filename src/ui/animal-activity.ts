import { animalSpecies } from '../sim/animal-species';
import type { WildAnimal } from '../sim/wildlife-state';
import type { World } from '../sim/types';
import {autoSlaughterTargets} from '../sim/auto-slaughter';

const labels:Readonly<Record<WildAnimal['state'],string>>={idle:'Se repose',moving:'Se déplace',eating:'Mange',sleeping:'Dort',hungry:'Cherche à manger',downed:'À terre',dead:'Mort'};
/** Shared activity for the list and inspector, published from confirmed state. */
export function animalActivity(world:World,animal:WildAnimal,quotaTargets?:ReadonlySet<number>):string {
  if(animal.state==='dead')return labels[animal.state];
  const rescuer=world.pawns.find(p=>p.animalRescue?.animalId===animal.id);
  if(rescuer)return `${rescuer.animalRescue!.phase==='carry'?'Porté vers un couchage':'Secours en approche'} · ${rescuer.name}`;
  if(animal.domestic?.release364){
    const handler=world.pawns.find(p=>p.animalHandling?.kind==='release'&&p.animalHandling.animalId===animal.id);
    return handler?`${handler.animalHandling!.phase==='carry'?'Porté hors de la colonie':handler.animalHandling!.phase==='interact'?'Remise en liberté':'Soigneur en approche'} · ${handler.name}`:'Désigné pour être relâché';
  }
  const automatic=!!animal.domestic&&(quotaTargets??autoSlaughterTargets(world)).has(animal.id);
  if(animal.domestic?.slaughter||automatic){
    const worker=world.pawns.find(p=>p.animalHandling?.kind==='slaughter'&&p.animalHandling.animalId===animal.id);
    const activity=worker?`${worker.animalHandling!.phase==='interact'?'Abattage':'Dresseur en approche'} · ${worker.name}`:'Désigné pour abattage';
    return automatic?`${activity} · quota du troupeau${animal.domestic?.slaughter?' + ordre manuel':''}`:activity;
  }
  if(animal.state==='downed')return animal.animalRest?.phase==='sleep'?'À terre · au couchage':labels[animal.state];
  if(animal.flee)return 'Fuit';
  if(animal.stun)return 'Étourdi';
  if(animal.manhunter){
    if(animal.manhunter.door)return 'En rage · frappe une porte';
    const target=world.pawns.find(pawn=>pawn.id===animal.manhunter!.targetId);
    return target?`En rage · ${animal.strike?'attaque':'poursuit'} ${target.name}`:'En rage · cherche un humain';
  }
  if(animal.meal?.kind==='pile'&&world.piles.some(p=>p.id===animal.meal!.id&&p.corpse))return animal.state==='eating'?'Mange une dépouille':'Rejoint une dépouille';
  if(animal.predation){
    const prey=world.wildlife?.animals.find(a=>a.id===animal.predation!.targetId);
    const target=prey?`${animalSpecies(prey.species).label} ${prey.id}`:'sa proie';
    return `${animal.strike?'Attaque':'Poursuit'} ${target}`;
  }
  if(animal.strike)return 'Riposte';
  if(animal.threat)return 'Se défend';
  if(animal.exiting)return 'Quitte la carte faute de nourriture';
  if(animal.animalThermalRefuge288)return animal.animalThermalRefuge288.phase==='travel'?'Refuge thermique · rejoint l’abri choisi':'Refuge thermique · attend éveillé';
  if(animal.animalRest)return animal.animalRest.phase==='travel'?'Rejoint son couchage':'Dort au couchage';
  if(animal.training){
    const trainer=world.pawns.find(p=>p.animalHandling?.kind==='train'&&p.animalHandling.animalId===animal.id),task=trainer?.animalHandling;
    if(task)return `${task.phase==='pickup'?'Dresseur collecte la nourriture':task.phase==='approach'?'Dresseur en approche':task.finalStartedCore!==undefined?'Termine la tentative':task.step===2||task.step===4?'Reçoit sa nourriture':'Leçon de dressage'} · ${trainer!.name}`;
  }
  if(animal.haul)return animal.haul.phase==='pickup'?'Rejoint une pile à transporter':animal.haul.phase==='holding'?`Conserve un objet · ${labels[animal.state]}`:'Transporte un objet vers le stockage';
  const state=animal.state==='moving'&&!animal.path.length&&!animal.meal&&(!animal.motion||animal.motion.end<=world.tick)?'idle':animal.state;
  return `${labels[state]}${animal.meal&&state==='moving'?' vers sa nourriture':''}`;
}
