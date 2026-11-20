import {isSchema256Or257} from './schema-compatibility-257.ts';
import {actors352} from './letter-producers-352.ts';
import {sendLetter352} from './letters-352.ts';
import {isColonist} from './affiliation.ts';
import {foggedCell256,explorationEnabled256} from './exploration-state-256.ts';
import {groupCoreTicks256,groupPawnInterval256} from './group-core-cadence-256.ts';
import {rectCenter256} from './ancient-monument-plan-256.ts';
import type {AncientRect256} from './local-ancient-placement-256.ts';
import type {AncientShrineWarning256} from './ancient-shrine-warning-state-256.ts';
import type {World} from './types.ts';

/** Two actual original Things created after Temple Spawn/FindBiggestRect.
 * No signal-tag counter is introduced: the private pair is its exact link,
 * so its matching string has no independent persisted or gameplay meaning. */
export function spawnAncientShrineWarning256(w:World,wallBounds:AncientRect256):AncientShrineWarning256 {
 if(!isSchema256Or257(w.schemaVersion)||w.site?.revision!==3||w.planet?.revision!==3||w.exploration||!Number.isSafeInteger(w.nextId)||w.nextId<1||!Number.isSafeInteger(w.nextId+2))throw Error('Actual private AncientTemple warning generation frontier required');
 if(![wallBounds.minX,wallBounds.minZ,wallBounds.maxX,wallBounds.maxZ].every(Number.isSafeInteger)||wallBounds.minX<0||wallBounds.minZ<0||wallBounds.maxX>=w.width||wallBounds.maxZ>=w.height||wallBounds.maxX<wallBounds.minX||wallBounds.maxZ<wallBounds.minZ)throw Error('Invalid actual Temple wall bounds');
 const rect={minX:Math.max(0,wallBounds.minX-1),minZ:Math.max(0,wallBounds.minZ-1),maxX:Math.min(w.width-1,wallBounds.maxX+1),maxZ:Math.min(w.height-1,wallBounds.maxZ+1)},center=rectCenter256(wallBounds);
 const pair:AncientShrineWarning256={triggerId:w.nextId,actionId:w.nextId+1,rect,center,triggerAlive:true,actionAlive:true};
 w.nextId+=2;(w.ancientShrineWarnings??={revision:1,pairs:[]}).pairs.push(pair);return pair;
}

/** Called once in the existing local simulation step after physical actors
 * and fog reveal. No real-time/image scanner, load-time activation or RNG.
 * Core PawnTrigger tests Humanlike + player faction ONLY, including downed
 * and mentally broken pawns; animals/guests/foreign prisoners do not qualify. */
export function advanceAncientShrineWarnings256(w:World):void {
 const state=w.ancientShrineWarnings;if(!state||!isSchema256Or257(w.schemaVersion)||!explorationEnabled256(w)||w.tick<1)return;
 let byCell:Map<number,World['pawns']>|undefined;
 for(const pair of state.pairs){if(!pair.triggerAlive)continue;
  const middle=rectCenter256(pair.rect);if(!foggedCell256(w,middle.z*w.width+middle.x)){pair.triggerAlive=false;continue;}
  if(!groupCoreTicks256(w.tick).some(core=>groupPawnInterval256(pair.triggerId,core,60,1)))continue;
  // Source visits spawned Pawn Things only. A carried patient and the Pawn
  // retained behind a corpse are real owners, but are not spawned Pawn Things.
  if(!byCell){byCell=new Map();const carried=new Set(w.pawns.filter(p=>p.rescue?.phase==='carry').map(p=>p.rescue!.patientId));for(const p of w.pawns){if(p.state==='dead'||carried.has(p.id)||!isColonist(p))continue;const key=p.z*w.width+p.x,list=byCell.get(key)??[];list.push(p);byCell.set(key,list);}}
  // Source visits cells z-major, then their actual Thing insertion order.
  let subject:World['pawns'][number]|undefined;
  for(let z=pair.rect.minZ;z<=pair.rect.maxZ&&!subject;z++)for(let x=pair.rect.minX;x<=pair.rect.maxX&&!subject;x++)subject=byCell.get(z*w.width+x)?.[0];
  if(!subject)continue;pair.triggerAlive=false;
  if(pair.actionAlive){pair.actionAlive=false;pair.letter={tick:w.tick,pawnId:subject.id};sendLetter352(w,{cls:'threat-big',title:'Danger ancien',text:`${subject.name} approche d’un bâtiment ancien scellé. Ces ruines abritent souvent des menaces endormies : mécanoïdes, insectes ou pièges. N’y entrez qu’armé et prêt à vous battre.`,targets:actors352([subject.id])});w.events.push({tick:w.tick,type:'command',message:`Danger ancien : ${subject.name} approche d’un bâtiment ancien qui pourrait abriter une menace.`});if(w.events.length>80)w.events.splice(0,w.events.length-80);}
 }
}
