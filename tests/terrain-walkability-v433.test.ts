import {expect,test} from 'vitest';
import {NATURAL_TERRAIN_DEFINITIONS_256} from '../src/sim/local-terrain-definitions-256';
import {naturalTerrainWalkable256,naturalTerrainCosts256} from '../src/sim/natural-terrain-movement-256';
import {createWorld} from '../src/sim/index';
import {blockedCells} from '../src/sim/pathfinding';

test('compiled walkability preserves all immutable definitions and rejects non-terrain/prototype values',()=>{
 for(const [terrain,facts]of Object.entries(NATURAL_TERRAIN_DEFINITIONS_256))expect(naturalTerrainWalkable256(terrain),terrain).toBe(facts.affordances.includes('Walkable'));
 for(const terrain of ['grass','soil','packed-dirt'])expect(naturalTerrainWalkable256(terrain)).toBe(true);
 for(const terrain of [undefined,null,0,true,{},new String('soil'),'water','rock','constructor','__proto__','toString','future-ground'])expect(naturalTerrainWalkable256(terrain)).toBe(false);
 expect(naturalTerrainCosts256('soil-natural')).toBe(NATURAL_TERRAIN_DEFINITIONS_256['soil-natural']);
});
// Tile contract: a terrain edit replaces the Tile object (it is never mutated
// in place), and the navigation grid sees it immediately, within the same tick.
test('same-tick terrain edits still change the actual navigation grid immediately',()=>{
 const w=createWorld(431,16,16);w.resources=[];w.structures=[];const i=4+4*w.width;w.tiles[i]={terrain:'water-deep'};
 expect(blockedCells(w)[i]).toBe(1);w.tiles[i]={terrain:'soil-natural'};expect(blockedCells(w)[i]).toBe(0);
 w.tiles[i]={terrain:'water'};expect(blockedCells(w)[i]).toBe(1);w.tiles[i]={terrain:'rough-stone'};expect(blockedCells(w)[i]).toBe(0);
 w.tiles[i]={terrain:'ocean-deep'};expect(blockedCells(w)[i]).toBe(1);
});
