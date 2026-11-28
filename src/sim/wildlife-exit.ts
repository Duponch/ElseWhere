import { cancelHunting } from './hunting-state.ts';
import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { animalSpecies } from './animal-species.ts';
import { cancelAnimalPredation } from './wildlife-predation.ts';
import type { Cell,World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';

export const WILDLIFE_EXIT_FOOD_CHECK=100;
export const atMapEdge=(w:Pick<World,'width'|'height'>,a:Cell)=>a.x===0||a.z===0||a.x===w.width-1||a.z===w.height-1;
export function cancelAnimalExit(w:World,a:WildAnimal):void {
  const exit=a.exiting;if(!exit)return;
  const last=a.path.at(-1);
  if(last&&last.x===exit.destination.x&&last.z===exit.destination.z)a.path=[];
  delete a.exiting;
  if(a.state==='moving'&&!a.path.length&&(a.motion?.end??0)<=w.tick)a.state='idle';
  a.nextDecision=Math.min(a.nextDecision,w.tick);
}
export const timedThrumboExit382=(a:WildAnimal,tick:number):boolean=>a.exitAtCore382!==undefined&&tick*10>=a.exitAtCore382;
export const exitSuppressed=(a:WildAnimal,tick=0)=>!!(a.domestic||a.meal||a.predation||a.manhunter||a.confusion||a.burning||a.flee||a.threat||a.retaliation||a.strike||a.stun)
  ||a.food>0&&!timedThrumboExit382(a,tick)||['downed','dead','sleeping','eating'].includes(a.state);

/** Stop targeting without deleting an already committed recovery. */
export function stopExitTargeting(w:World,id:number):boolean {
  let recovering=false;
  if(w.hunting)w.hunting.targets=w.hunting.targets.filter(target=>target!==id);
  for(const p of w.pawns){
    const hunting=p.hunting?.animalId===id,shooting=p.shooting?.order?.targetId===id,melee=p.melee?.order?.targetId===id;
    if(hunting)cancelHunting(p);
    if(shooting)cancelShooting(p);
    if(melee)cancelMelee(p);
    if(hunting||shooting||melee){
      p.path=[];p.planCooldown=0;p.state=(p.motion?.end??0)>w.tick?'moving':'idle';
    }
    if(p.melee?.strike?.targetId===id)recovering=true;
  }
  for(const animal of w.wildlife?.animals??[]){
    if(animal.predation?.targetId===id)cancelAnimalPredation(w,animal);
    if(animal.threat?.targetId===id)delete animal.threat;
    if(animal.retaliation?.targetId===id)delete animal.retaliation;
    if(animal.strike?.targetId===id)recovering=true;
  }
  return recovering;
}

/** Commit only identities whose physical arrival and last food check passed.
 * Called after the rotating wildlife loop so removal cannot skip actors. */
export function finishAnimalExits(w:World,departures:ReadonlySet<number>):void {
  const s=w.wildlife;if(!s||!departures.size)return;
  const count=s.exitedAnimals??0;
  if(!Number.isSafeInteger(count+departures.size))return;
  const actual=s.animals.filter(a=>departures.has(a.id)&&a.exiting&&!exitSuppressed(a,w.tick)
    &&atMapEdge(w,a)&&!a.path.length&&(a.motion?.end??0)<=w.tick);
  if(!actual.length)return;
  const ids=new Set(actual.map(a=>a.id));
  if(w.hunting)w.hunting.targets=w.hunting.targets.filter(id=>!ids.has(id));
  s.animals=s.animals.filter(a=>!ids.has(a.id));s.exitedAnimals=count+actual.length;
  for(const p of w.pawns)if(p.animalHandling&&ids.has(p.animalHandling.animalId)||p.animalCare&&ids.has(p.animalCare.animalId)||p.animalFeed&&ids.has(p.animalFeed.animalId)||p.animalRescue&&ids.has(p.animalRescue.animalId))interruptWork(w,p);
  for(const a of actual)w.events.push({tick:w.tick,type:'need',message:`${animalSpecies(a.species).label} ${a.id} a quitté la carte faute de nourriture.`});
  if(w.events.length>80)w.events.splice(0,w.events.length-80);
}
