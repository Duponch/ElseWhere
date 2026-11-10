import {assignPileOwner} from './pile-index.ts';
import { newTactics } from './tactics-state.ts';
import { startingPawn } from './starting-pawns.ts';
import { generatePawnBackground } from './background-generation.ts';
import { newWeaponState } from './equipment-rules.ts';
import { blockedCells } from './pathfinding.ts';
import { candidateAccess } from './candidate-access.ts';
import { captureStandability } from './furniture-travel.ts';
import { distanceSquared } from './affiliation.ts';
import type { World } from './types.ts';

export type { ScenarioId } from './scenario-definitions.ts';
/** New-world setup only. Never inject actors or equipment when loading a save. */
export function setupEncounter(world:World):void {
  if(world.tick!==0||world.width<64||world.height<64)throw new Error('La rencontre armée exige une nouvelle carte d’au moins 64 × 64.');
  const leader=world.pawns[0]!,stands=captureStandability(world),reach=candidateAccess(world,leader,blockedCells(world),new Set());
  const resources=new Set(world.resources.map(r=>r.z*world.width+r.x));
  const candidates=[];
  for(let z=1;z<world.height-1;z++)for(let x=1;x<world.width-1;x++) {
    const cell={x,z},d=distanceSquared(leader,cell);
    if(d>=28**2&&d<=40**2&&stands(cell)&&!resources.has(z*world.width+x)&&world.pawns.every(p=>distanceSquared(p,cell)>27**2))candidates.push(cell);
  }
  candidates.sort((a,b)=>distanceSquared(leader,a)-distanceSquared(leader,b)||a.z-b.z||a.x-b.x);
  const site=candidates.find(c=>reach.has(c.z*world.width+c.x));
  if(!site)throw new Error('Aucun emplacement accessible pour la sentinelle sur cette graine.');
  const enemy=startingPawn(world.nextId++,'Sentinelle',site.x,site.z,0,55,world.seed,world.tick,world.schemaVersion);enemy.faction='outlaws';enemy.tactics=newTactics();
  if(world.schemaVersion>=191)generatePawnBackground(enemy,world.seed,true);
  world.pawns.push(enemy);
  world.piles.push({id:world.nextId++,kind:'weapon',item:'revolver',quantity:1,owner:{type:'equipment',pawnId:enemy.id},weapon:newWeaponState()});
  const weapon=world.piles.find(p=>p.item==='revolver'&&p.owner.type==='ground');
  if(weapon)assignPileOwner(weapon,{type:'equipment',pawnId:leader.id});
  world.events.push({tick:0,type:'command',message:`Rencontre armée : hostile en ${site.x}, ${site.z}. ${leader.name} porte le revolver. Préparez soins et couchages : l’adversaire approche les cibles visibles, cherche une position de tir et riposte au contact.`});
}
