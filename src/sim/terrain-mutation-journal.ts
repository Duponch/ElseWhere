import type {Tile} from './types.ts';

/** Derived transport bookkeeping only. No World, Tile object, value witness,
 * simulation clock, RNG or save field is owned here. Only the closed Worker
 * encoder enrolls an actual physical Tile[] after a complete codec capture. */
export const TERRAIN_JOURNAL_CAPACITY=8192;
interface Journal {readonly length:number;readonly cells:Uint32Array;version:number;fullVersion:number;poisoned:boolean}
const journals=new WeakMap<readonly Tile[],Journal>();
declare const cursorBrand:unique symbol;
export interface TerrainJournalCursor {readonly [cursorBrand]:true;readonly journal:Journal;readonly version:number}
export interface TerrainJournalRead {readonly cursor:TerrainJournalCursor;readonly indices:readonly number[]}
const cursor=(journal:Journal):TerrainJournalCursor=>({journal,version:journal.version}) as TerrainJournalCursor;
function advance(journal:Journal):boolean {
 if(journal.version===Number.MAX_SAFE_INTEGER){journal.poisoned=true;return false;}
 journal.version++;return true;
}
/** Physical write count of one actual Tile[], counted by every mark and bulk
 * invalidation whether or not an encoder enrolled the array. Derived and never
 * saved. Every in-place physical cell write must already mark the cell (see
 * AGENTS.md), so the same Tile[] with the same count proves that no tile was
 * replaced and no floor/bridge/snow/terrain field changed: simulation caches
 * may skip a full tile scan on that proof. A replaced Tile[] starts at zero
 * and fails the identity check. */
const writeCounts=new WeakMap<readonly Tile[],number>();
export function terrainWriteCount(tiles:readonly Tile[]):number {return writeCounts.get(tiles)??0;}
const countWrite=(tiles:readonly Tile[])=>{writeCounts.set(tiles,(writeCounts.get(tiles)??0)+1);};
/** Test/bench switch: caches relying on terrainWriteCount recompute and throw
 * on any difference, which exposes a writer that forgot its mark. */
export let verifyTerrainWriteCaches=false;
export function setTerrainWriteCacheVerification(on:boolean):void {verifyTerrainWriteCaches=on;}
/** Writers do nothing until a closed encoder owns a complete initial capture.
 * A mark is independent of tick and never consumes another reader's changes. */
export function markTerrainCellChanged(tiles:readonly Tile[],index:number):void {
 countWrite(tiles);
 const journal=journals.get(tiles);if(!journal||!advance(journal))return;
 if(tiles.length!==journal.length||!Number.isSafeInteger(index)||index<0||index>=journal.length){journal.fullVersion=journal.version;return;}
 journal.cells[journal.version%TERRAIN_JOURNAL_CAPACITY]=index;
}
/** Bulk transactions cannot claim coverage of their internal speculative writes.
 * Call only at the actual commit; the next capture uses the complete codec. */
export function invalidateTerrainJournal(tiles:readonly Tile[]):void {
 countWrite(tiles);
 const journal=journals.get(tiles);if(journal&&advance(journal))journal.fullVersion=journal.version;
}
/** @internal Closed encoder boundary. Capture this BEFORE the full codec pass;
 * commit the returned cursor only after that pass succeeds. */
export function captureTerrainJournal(tiles:readonly Tile[]):TerrainJournalCursor {
 let journal=journals.get(tiles);
 if(!journal||journal.length!==tiles.length||journal.poisoned){journal={length:tiles.length,cells:new Uint32Array(TERRAIN_JOURNAL_CAPACITY),version:0,fullVersion:0,poisoned:false};journals.set(tiles,journal);}
 return cursor(journal);
}
/** Missing owner, replacement, bulk invalidation and bounded history overflow
 * all require a full value diff. No partial stamp is accepted on a gap. */
export function readTerrainJournal(tiles:readonly Tile[],before:TerrainJournalCursor):TerrainJournalRead|undefined {
 const journal=journals.get(tiles);
 if(!journal||journal!==before.journal||journal.poisoned||journal.length!==tiles.length||before.version>journal.version
  ||journal.fullVersion>before.version||journal.version-before.version>TERRAIN_JOURNAL_CAPACITY)return;
 const indices=new Set<number>();
 for(let version=before.version+1;version<=journal.version;version++)indices.add(journal.cells[version%TERRAIN_JOURNAL_CAPACITY]!);
 return {cursor:cursor(journal),indices:[...indices].sort((a,b)=>a-b)};
}

/** Read-only transport observation. Unlike captureTerrainJournal this NEVER
 * enrolls, resets or repairs a journal. An unknown owner remains unknown;
 * the actor publisher must use a genuine complete capture on any gap.
 * A cursor conveys no simulation, Native or renderer capability. */
export function peekTerrainJournalCursor(tiles:readonly Tile[]):TerrainJournalCursor|undefined {
 const journal=journals.get(tiles);
 if(!journal||journal.poisoned||journal.length!==tiles.length)return;
 return cursor(journal);
}
