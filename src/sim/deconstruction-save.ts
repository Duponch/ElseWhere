import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {isSchema271OrLater} from './schema-compatibility-257.ts';
import {isLocalRoadProp256} from './local-road-props-256.ts';
import {isProspectiveFurnitureTextile256} from './bedroll-textiles-256.ts';
import { STRUCTURE_DEFINITIONS } from './definitions.ts';
import { isBlockMaterial,isUpholsteryMaterial } from './building-materials.ts';
import { validConstructionMaterial } from './construction-materials.ts';
import { deconstructionAvailable, deconstructionTarget } from './deconstruction-rules.ts';
import type { World } from './types.ts';

export function validateDeconstruction(world: World, version: number, shapesOnly=false): string[] {
  const errors: string[] = [], ledger = world.deconstructed;
  if (version < 24) {
    if (ledger !== undefined || world.jobs.some(j => j.deconstruction !== undefined)) errors.push('Legacy save contains deconstruction fields.');
    return errors;
  }
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)
    || ![ledger.count, ledger.lostWood, ledger.fuelTicks].every(n => Number.isSafeInteger(n) && n >= 0)
    || ledger.lostComponents!==undefined&&(version<42||!Number.isSafeInteger(ledger.lostComponents)||ledger.lostComponents<0)
    || ledger.lostSteel!==undefined&&(version<30||!Number.isSafeInteger(ledger.lostSteel)||ledger.lostSteel<0)
    || ledger.lostSilver!==undefined&&(version<211||!Number.isSafeInteger(ledger.lostSilver)||ledger.lostSilver<0)
    || ledger.lostBlocks!==undefined&&(version<33||!ledger.lostBlocks||typeof ledger.lostBlocks!=='object'||Array.isArray(ledger.lostBlocks)||Object.entries(ledger.lostBlocks).some(([item,n])=>!isBlockMaterial(item)||!Number.isSafeInteger(n)||n<0))
    || ledger.lostTextiles!==undefined&&(version<189||!ledger.lostTextiles||typeof ledger.lostTextiles!=='object'||Array.isArray(ledger.lostTextiles)||!Object.keys(ledger.lostTextiles).length||Object.entries(ledger.lostTextiles).some(([item,n])=>!isUpholsteryMaterial(item)||version<256&&isProspectiveFurnitureTextile256(item)||!Number.isSafeInteger(n)||n<=0))
    || Object.keys(ledger).some(k => !['count', 'lostWood', 'fuelTicks',...(isSchema298OrLater(version)?['lostAiCores298','lostGold298']:[]),...(version>=42?['lostComponents']:[]),...(version>=30?['lostSteel']:[]),...(version>=211?['lostSilver']:[]),...(version>=256?['lostUranium']:[]),...(isSchema271OrLater(version)?['lostAdvancedComponents271']:[]),...(isSchema275OrLater(version)?['lostPlasteel275']:[]),...(version>=265?['lostWort','lostBeer']:[]),...(version>=33?['lostBlocks']:[]),...(version>=189?['lostTextiles']:[])].includes(k))) errors.push('Invalid deconstruction ledger.');
  if(ledger&&typeof ledger==='object'&&'lostGold298'in ledger){const d=Object.getOwnPropertyDescriptor(ledger,'lostGold298');if(!isSchema298OrLater(version)||!d||!('value'in d)||!d.enumerable||!Number.isSafeInteger(d.value)||d.value<=0)errors.push('Invalid or future deconstructed ship gold loss.');}
  if(ledger&&typeof ledger==='object'&&'lostAiCores298'in ledger){const d=Object.getOwnPropertyDescriptor(ledger,'lostAiCores298');if(!isSchema298OrLater(version)||!d||!('value'in d)||!d.enumerable||!Number.isSafeInteger(d.value)||d.value<=0)errors.push('Invalid or future deconstructed AI-core loss.');}
  if(ledger&&typeof ledger==='object'&&'lostUranium'in ledger){const d=Object.getOwnPropertyDescriptor(ledger,'lostUranium');if(version<256||!d||!('value'in d)||!d.enumerable||!Number.isSafeInteger(d.value)||d.value<=0)errors.push('Invalid or future deconstructed uranium loss.');}
  if(ledger&&typeof ledger==='object'&&'lostAdvancedComponents271'in ledger){const d=Object.getOwnPropertyDescriptor(ledger,'lostAdvancedComponents271');if(!isSchema271OrLater(version)||!d||!('value'in d)||!d.enumerable||!Number.isSafeInteger(d.value)||d.value<=0)errors.push('Invalid or future deconstructed advanced-component loss.');}
  if(ledger&&typeof ledger==='object'&&'lostPlasteel275'in ledger){const d=Object.getOwnPropertyDescriptor(ledger,'lostPlasteel275');if(!isSchema275OrLater(version)||!d||!('value'in d)||!d.enumerable||!Number.isSafeInteger(d.value)||d.value<=0)errors.push('Invalid or future deconstructed ship-part plasteel loss.');}
  for (const j of world.jobs) {
    const d = j.deconstruction;
    if (j.kind !== 'deconstruct') { if (d !== undefined) errors.push('Unexpected deconstruction target.'); continue; }
    if (!d || typeof d !== 'object' || Array.isArray(d) || !Number.isSafeInteger(d.structureId)
      || version<256&&(isLocalRoadProp256(d.kind)||d.kind==='ship-chunk') || version<224&&d.kind==='double-bed' || !Object.hasOwn(STRUCTURE_DEFINITIONS, d.kind) || !validConstructionMaterial(d.kind,d.material,version) || d.material!==undefined&&version<30 || Object.keys(d).some(k => !['structureId', 'kind',...(version>=30?['material']:[])].includes(k))) {
      errors.push('Invalid deconstruction target.'); continue;
    }
    const s = deconstructionTarget(world, j);
    if (!s || s.kind !== d.kind || s.material!==d.material || s.x !== j.x || s.z !== j.z || s.orientation !== j.orientation || s.footprint !== j.footprint
      || j.construction !== undefined || j.clearance !== undefined || j.growingZoneId !== undefined || j.escrow.wood || j.escrow.food) errors.push('Deconstruction does not match its building.');
    const pawn = world.pawns.find(p => p.jobId === j.id);
    if (j.progress > 0 && !pawn) errors.push('Interrupted deconstruction retained work.');
    if (!shapesOnly && j.reservedBy !== null && !deconstructionAvailable(world, j, j.reservedBy)) errors.push('Deconstruction conflicts with a building user.');
  }
  return errors;
}
