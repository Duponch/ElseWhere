import {footprintCells} from './definitions.ts';
import {adjacent} from './pathfinding.ts';
import {isAncientMonumentKind256} from './ancient-monument-props-256.ts';
import type {World,Job,Pawn,Structure} from './types.ts';
import { structureById } from './structure-navigation.ts';
export const isBurialContainer256=(kind:unknown,version:number)=>kind==='grave'||version>=256&&kind==='sarcophagus';
export const ANCIENT_NEUTRAL_KINDS_256=['wall','door','table','table-square','column','urn','stele-large','stele-grand','sarcophagus'] as const;
export const isAncientNeutralKind256=(kind:unknown):boolean=>typeof kind==='string'&&(ANCIENT_NEUTRAL_KINDS_256 as readonly string[]).includes(kind);
export function ancientRepairTarget256(w:Pick<World,'structures'|'schemaVersion'>,job:Job):Job|Structure {
 if(w.schemaVersion<256||job.kind!=='repair'||!job.repair)return job;
 const actual=structureById(w,job.repair!.structureId);return actual&&isAncientMonumentKind256(actual.kind)?actual:job;
}
export function ancientRepairContact256(w:World,pawn:Pawn,job:Job):boolean {
 const target=ancientRepairTarget256(w,job);if(target===job)return adjacent(pawn,job)&&(pawn.x!==job.x||pawn.z!==job.z);
 const cells=footprintCells(target);return !cells.some(c=>c.x===pawn.x&&c.z===pawn.z)&&cells.some(c=>adjacent(pawn,c));
}
