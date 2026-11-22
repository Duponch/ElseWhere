/** The Elsewhere world the import starts from: a real geographic new game on
 * the save's own planet and tile (or, when that is impossible, a seed-based
 * planet, or a plain local map), whose local content is then emptied and
 * replaced by the save's. */
import type {World} from '../../sim/types.ts';
import type {RwsSave} from './rws-save.ts';
import type {ImportNotes} from './notes.ts';
import {rebuildPlanet,type PlanetImport} from './planet.ts';
import {captureGeneratedGeography256} from '../../sim/world-geography-owner-256.ts';
import {createGeographicNewGame256} from '../../sim/geographic-new-game-256.ts';
import {ACTUAL_SHRINES_750_256} from '../../sim/ancient-temple-orchestration-256.ts';
import {createStartingCandidateRoster} from '../../sim/starting-candidates.ts';
import {startingOriginalRequestFromRoster256} from '../../sim/starting-original-request-256.ts';
import {validGeographicCreationSize262} from '../../sim/geographic-creation-options-262.ts';
import {stableWorldSeedHash} from '../../sim/world-climate-settings.ts';
import {createWorld,stepWorld} from '../../sim/engine.ts';

export interface BaseWorld {world:World;planetMode:'save'|'none';planet?:PlanetImport}
const drain=<Y,T>(it:Generator<Y,T,void>):T=>{let s=it.next();while(!s.done)s=it.next();return s.value;};

export function createBaseWorld(save:RwsSave,notes:ImportNotes,options:{planet:boolean}):BaseWorld {
 const map=save.maps[0]!,seed=(stableWorldSeedHash(save.world?.seed??'')>>>0)||1;
 if(options.planet){
  const size=map.width;
  if(map.width!==map.height||!validGeographicCreationSize262(size))notes.lost('world',`Carte de ${map.width}×${map.height} : Elsewhere crée les colonies géographiques en carré de 200 à 325 cases ; la carte est importée sans planète.`);
  else{
   const planet=rebuildPlanet(save,notes);
   if(planet)try{
    const geography=captureGeneratedGeography256(planet.draft),roster=createStartingCandidateRoster(seed);
    const w=drain(createGeographicNewGame256({draft:planet.draft,geography,tile:planet.homeTile,size,scenario:'crashlanded',startingParty:startingOriginalRequestFromRoster256(seed,roster)},{shrines750:ACTUAL_SHRINES_750_256}));
    // The starting pods open after a few ticks; the import replaces their people afterwards.
    for(let i=0;i<600&&(w.startingArrival as {phase?:string}|undefined)?.phase!=='opened';i++)stepWorld(w);
    notes.mapped('world',`Colonie placée sur la même case de la planète (${planet.homeTile}).`);
    return {world:w,planetMode:'save',planet};
   }catch(error){notes.lost('world',`Création de la colonie sur la planète refusée (${error instanceof Error?error.message.slice(0,200):String(error)}) : carte importée sans planète.`);}
  }
 }
 const w=createWorld(seed,map.width,map.height);
 notes.adapted('world','Carte importée sans planète (monde local seul).');
 return {world:w,planetMode:'none'};
}
