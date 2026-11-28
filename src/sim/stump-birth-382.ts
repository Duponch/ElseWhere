import type {Resource,World} from './types.ts';
import {FLORA_DEFINITIONS} from './biome-flora.ts';
import {createPlantLife} from './plant-life.ts';
import type {DeadStumpSpecies382} from './native-special-plants-382.ts';

/** Plant.TrySpawnStump only for a *harvestable* living TreeBase and copies
 * its actual Growth. A dead stump never recursively produces another stump.
 * The caller checks actual capacity first and commits only on destruction. */
export function treeLeavesStump382(world:World,tree:Resource,growth:number):boolean {
 return world.schemaVersion>=382&&(world.flora!==undefined||world.site?.revision===3)&&tree.kind==='tree'&&tree.species!==undefined&&growth>FLORA_DEFINITIONS[tree.species].harvestMinGrowth;
}
export function treeStump382(world:World,tree:Resource,growth:number,species:DeadStumpSpecies382):Resource {
 const id=world.nextId++,r:Resource={id,x:tree.x,z:tree.z,kind:'wild-plant',species,amount:4,growth,growthTick:world.tick};
 // Def.startingHpRange [.5,1], rounded to integer. Use the real gameplay
 // stream on actual birth (not on previews nor import).
 let n=world.rng;n^=n<<13;n^=n>>>17;n^=n<<5;world.rng=n>>>0;
 const value=50+world.rng/0x100000000*50,lower=Math.floor(value),hp=value-lower===.5?lower+lower%2:Math.round(value);
 if(hp<100)r.damage=100-hp;
 if(world.climate)r.plantLife=createPlantLife(world,r,true);
 return r;
}
