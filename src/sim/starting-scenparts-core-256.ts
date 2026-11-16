import {applyCoreStartingPodBirth256} from './starting-pod-birth-256.ts';
import {applyCoreStartingScatter256,type StartingScatterRectangle256} from './starting-scenario-scatter-256.ts';
import {requireOriginalStartingRoster256,type StartingOriginalRoster256} from './starting-original-roster-256.ts';
import {adoptDeliveredStartingSystems256} from './starting-scenparts-256.ts';
import {validGameProfile} from './game-profile-save.ts';
import type {WorldGenerationRandom} from './world-generation-random.ts';
import type {World} from './types.ts';
/** Factory's real875 consumer. Constructor8 belongs BEFORE the map;1200
 * belongs AFTER this phase. PostMapGenerate forced hediff receives the OUTER
 * weather stream separately through applyCoreStartingPostMap256, not this one.
 * No old World, descriptor regeneration, alternative RNG or reroll is used. */
export function applyCoreStartingScenParts256(world:World,input:{roster:StartingOriginalRoster256;start850:number;layoutRects:readonly StartingScatterRectangle256[]},random:WorldGenerationRandom){
 requireOriginalStartingRoster256(world,input.roster);
 // Creation choices precede terrain/temples. The same confirmed profile may
 // already exist; other starting systems still belong exclusively to875.
 if(Object.hasOwn(world,'gameProfile')&&!validGameProfile(world.gameProfile,Math.max(256,Number(world.schemaVersion)),{id:'crashlanded'}))throw Error('Unconfirmed creation profile before875');
 if(['scenario','research','raids','visitors','fluIncidents','miscIncidents','economy'].some(k=>Object.hasOwn(world,k)))throw Error('Starting systems already owned before875');
 const arrival=applyCoreStartingPodBirth256(world,input.roster,input.start850,random);
 const scattered=applyCoreStartingScatter256(world,arrival,input.start850,input.layoutRects,random);
 adoptDeliveredStartingSystems256(world,{x:input.start850%world.width,z:Math.floor(input.start850/world.width)});
 return Object.freeze({profile:arrival.profile,start850:input.start850,pawnIds:Object.freeze(input.roster.selected.map(e=>e.pawn.id)),podIds:Object.freeze(arrival.pods.map(p=>p.id)),petIds:Object.freeze(arrival.pods.flatMap(p=>p.animals.map(a=>a.id))),scattered:Object.freeze(scattered),random:random.state});
}
