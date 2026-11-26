import {appendPileEntries} from './pile-identity-directory.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
/** Creation-only GenStep970 join. The ORIGINAL physical result supplies its
 * elevation and rock identities; every mask below is captured from its SAME
 * current World after750/875/900/950, never from a terrain-only replacement. */
import type {prepareGeographicPhysicalMap256} from './geographic-map-physical-256.ts';
import {captureActualLocalDistricts256} from './actual-local-districts-256.ts';
import {generateLocalRockChunks256,type LocalChunkInputs256} from './local-rock-chunks-256.ts';
import {geyserCells256} from './local-geyser-state-256.ts';
import {footprintCells} from './definitions.ts';
import {terrainAcceptsFilth256} from './natural-terrain-runtime-256.ts';
import {isFloorKind} from './flooring.ts';
import {ensureFilth,filthCheckPeriod,type FilthRecord} from './filth-rules.ts';
import {refreshStock} from './materials.ts';
import type {MaterialPile} from './types.ts';
import type {WorldGenerationRandom} from './world-generation-random.ts';
export const ROCK_CHUNKS_SEED_PART_256=1898758716;
type PhysicalResult256=ReturnType<typeof prepareGeographicPhysicalMap256>;
/** This list is the ACTUAL prior shared adjacent permutation. Its provenance
 * belongs to the generation context; there is deliberately no0..7 fallback. */
export function populateGeographicRockChunks256(physical:PhysicalResult256,context:{adjacentPermutation:readonly number[]},random:WorldGenerationRandom){
 const {world,description,composition}=physical,{width,height}=world,n=width*height;
 if(!isSchema256Or257(world.schemaVersion)||world.site?.revision!==3||world.planet?.revision!==3||world.site.tileId!==description.tileId||world.seed!==(description.mapSeed>>>0)||composition.elevation.length!==n||world.jobs.length||world.exploration||world.snow)throw Error('RockChunks requires its actual unpublished970 map and retained physical result');
 const capture=captureActualLocalDistricts256(world),edifices=new Uint8Array(n),items=new Uint8Array(n),doors=new Uint8Array(n),heavy=new Uint8Array(n),rubbleBlocked=new Uint8Array(n),walkableByAny=new Uint8Array(n),vacuum=new Uint8Array(n),acceptsUnnaturalFilth=new Uint8Array(n),filthMultiplier=new Float32Array(n);
 // Admitted Core-only SURFACE definitions expose no vacuum. All currently
 // supported generated floors have inherited FilthMultiplier1; StrawMatting
 // (.05) is absent, never silently treated as an existing floor here.
 for(let cell=0;cell<n;cell++){
  const tile=world.tiles[cell]!;if(tile.floor&&!isFloorKind(tile.floor))throw Error('Unresolved real generated floor');
  edifices[cell]=Number(capture.edifice(cell));heavy[cell]=Number(capture.heavy(cell));walkableByAny[cell]=Number(capture.normalWalkable(cell));
  rubbleBlocked[cell]=edifices[cell]!;acceptsUnnaturalFilth[cell]=Number(terrainAcceptsFilth256(tile));filthMultiplier[cell]=1;
 }
 for(const pile of world.piles)if(pile.owner.type==='ground')items[pile.owner.z*width+pile.owner.x]=1;
 for(const pack of world.packed)if(pack.owner.type==='ground')items[pack.owner.z*width+pack.owner.x]=1;
 for(const structure of world.structures)for(const c of footprintCells(structure)){
  const cell=c.z*width+c.x;rubbleBlocked[cell]=1;if(structure.kind==='door'||structure.kind==='autodoor')doors[cell]=1;
 }
 for(const geyser of world.geysers?.items??[])for(const cell of geyserCells256(width,geyser))rubbleBlocked[cell]=1;
 const arrival=world.startingArrival;if(arrival&&arrival.phase!=='opened')for(const pod of arrival.pods)rubbleBlocked[pod.cell.z*width+pod.cell.x]=1;
 const originals=new Map<number,FilthRecord>();
 for(const filth of world.filth?.items??[]){const cell=filth.z*width+filth.x;rubbleBlocked[cell]=1;if(filth.kind==='rock-rubble')originals.set(filth.id,filth);}
 const input:LocalChunkInputs256={width,height,elevation:composition.elevation,waterCovered:description.waterCovered,underground:false,
  // Mountain/Caves/River/Coast inherit chunkDensityMultiplier1. This is the
  // closed current four-modifier set, not a default for unknown future ones.
  chunkDensityFactors:[],rocks:description.naturalRocks,rockHasChunk:{sandstone:true,granite:true,limestone:true,slate:true,marble:true},nextId:world.nextId,atCore:world.tick*10,
  physical:{edifices,items,doors,heavy,rubbleBlocked,walkableByAny,vacuum,acceptsUnnaturalFilth,filthMultiplier},
  rubble:[...originals.values()].map(row=>({id:row.id,cell:row.z*width+row.x,thickness:row.thickness,grownCore:row.grownCore,expiresAfterCore:row.expiresAfterCore})),adjacentPermutation:context.adjacentPermutation};
 const plan=generateLocalRockChunks256(input,random);
 if(world.piles.length+plan.chunks.length>32768)throw Error('Actual generated chunks exceed current pile capacity');
 const newPiles:MaterialPile[]=plan.chunks.map(row=>({id:row.id,kind:'chunk',item:row.item,quantity:1,owner:{type:'ground',x:row.cell%width,z:Math.floor(row.cell/width)}}));
 const period=filthCheckPeriod(world),now=world.tick*10,newFilth:FilthRecord[]=plan.rubble.filter(row=>!originals.has(row.id)).map(row=>{
  const phase=(Math.imul(row.cell,1103515245)>>>0)%period,nextCheckCore=now+((phase-now%period+period)%period||period);
  return {id:row.id,kind:'rock-rubble',x:row.cell%width,z:Math.floor(row.cell/width),thickness:row.thickness,grownCore:row.grownCore,expiresAfterCore:row.expiresAfterCore,nextCheckCore};
 });
 if((world.filth?.items.length??0)+newFilth.length>n*8)throw Error('Actual generated rubble exceeds current filth capacity');
 // The plan already allocated CHUNKS AND RUBBLE in their true interleaved
 // spawn order. Never call addMaterial/addFilth here to allocate a second ID
 // or consume an unrelated runtime RNG. All checks precede these commits.
 appendPileEntries(world.piles,...newPiles);
 if(plan.rubble.length){const filth=ensureFilth(world);for(const row of plan.rubble){const original=originals.get(row.id);if(original){original.thickness=row.thickness;original.grownCore=row.grownCore;}}filth.items.push(...newFilth);}
 world.nextId=plan.nextId;refreshStock(world);
 return {chunkIds:plan.chunks.map(row=>row.id),rubbleIds:plan.rubble.map(row=>row.id),adjacentPermutation:plan.adjacentPermutation,adjacentUses:plan.adjacentUses,random:plan.random,noiseSeed:plan.noiseSeed};
}
