import {isSchema256Or257} from './schema-compatibility-257.ts';
import {captureRandomClosewalk256,randomClosewalkCellNear256} from './random-closewalk-256.ts';
import {claimCoreStartingScatterFrontier256} from './starting-pod-birth-256.ts';
import {divideStartingScatterCount256} from './starting-scatter-stacks-256.ts';
import {captureStartingGeneratedPlacement256} from './starting-generated-placement-256.ts';
import {STARTING_PLACE_STRUCTURES_256} from './starting-place-facts-256.ts';
import {captureActualLocalDistricts256} from './actual-local-districts-256.ts';
import {terrainSupportsAffordance256} from './natural-terrain-runtime-256.ts';
import {roofCells} from './roof-rules.ts';
import {footprintCells} from './definitions.ts';
import {createShipChunk256} from './ship-chunk-256.ts';
import {removeFilth} from './filth.ts';
import {setMaterialForbidden256} from './material-permission-256.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {refreshStock} from './materials.ts';
import type {CoreStartingArrivalPending256} from './starting-pod-state-256.ts';
import type {WorldGenerationRandom} from './world-generation-random.ts';
import type {World,Cell,MaterialPile} from './types.ts';

export interface StartingScatterRectangle256 {readonly minX:number;readonly maxX:number;readonly minZ:number;readonly maxZ:number}
const SCATTER=Object.freeze([
 {item:'steel',count:450,near:true,roof:true},{item:'wood',count:300,near:true,roof:true},
 {item:'ship-chunk',count:3,near:false,roof:false},{item:'steel',count:720,near:false,roof:true},
 {item:'survival-meal',count:7,near:false,roof:true},
] as const);
/** Schema 347, scenario Tutorial (child of Crashlanded): its one extra part,
 * ScenPart_ScatterThingsNearPlayerStart Cloth x300, after the inherited ones. */
const TUTORIAL_SCATTER_347=Object.freeze({item:'cloth',count:300,near:true,roof:true} as const);
const inside=(r:StartingScatterRectangle256,c:Readonly<Cell>)=>c.x>=r.minX&&c.x<=r.maxX&&c.z>=r.minZ&&c.z<=r.maxZ;
/** Actual five ScenParts in XML order, on the same875 stream AFTER pods.
 * No state reset per embedded scatterer: their SeedPart is not pushed by the
 * ScenPart caller. Failure discards this unpublished creation candidate. */
export function applyCoreStartingScatter256(world:World,arrival:CoreStartingArrivalPending256,start850:number,layoutRects:readonly StartingScatterRectangle256[],random:WorldGenerationRandom){
 if(world.startingArrival!==arrival||!isSchema256Or257(world.schemaVersion)||world.tick!==0||world.site?.revision!==3||world.pawns.length||world.jobs.length||!Number.isInteger(start850)||start850<0||start850>=world.tiles.length||!Array.isArray(layoutRects)||layoutRects.some(r=>![r.minX,r.maxX,r.minZ,r.maxZ].every(Number.isInteger)||r.minX>r.maxX||r.minZ>r.maxZ))throw Error('Missing actual875 scatter frontier');
 claimCoreStartingScatterFrontier256(arrival,random);
 const width=world.width,height=world.height,start={x:start850%width,z:Math.floor(start850/width)},roofs=roofCells(world),report:{item:string;requested:number;placed:number}[]=[];
 for(const spec of world.gameProfile?.tutorial347?[...SCATTER,TUTORIAL_SCATTER_347]:SCATTER){
  const building=spec.item==='ship-chunk',definition=building?undefined:ITEM_DEFINITIONS[spec.item],counts=divideStartingScatterCount256(spec.count,building?1:definition!.stackLimit,spec.item==='survival-meal',random),used:Cell[]=[];
  let cluster=-1,left=0,placed=0;
  // Steel/Wood/Meal stacks do not alter regions. A ShipChunk does, so its
  // capture is refreshed only after a successful physical building spawn.
  let close=captureRandomClosewalk256(world),physical=captureActualLocalDistricts256(world);
  const inBounds=(c:Readonly<Cell>)=>c.x>=0&&c.z>=0&&c.x<width&&c.z<height;
  const point=(i:number)=>({x:i%width,z:Math.floor(i/width)});
  const rectAt=(c:Readonly<Cell>):StartingScatterRectangle256=>({minX:c.x,maxX:c.x+(building?1:0),minZ:c.z,maxZ:c.z+(building?1:0)});
  const interactionBlocked=(rect:StartingScatterRectangle256)=>world.structures.some(s=>{
   const f=STARTING_PLACE_STRUCTURES_256[s.kind as keyof typeof STARTING_PLACE_STRUCTURES_256];if(!f)throw Error('Unknown actual scatter interaction flags: '+s.kind);
   if(f.multipleInteractionOffsets)throw Error('Actual multiple interaction offsets are not represented for875 scatter');
   if(!f.hasInteractionCell)return false;
   // GenConstruct visits only cardinally adjacent footprints.
   const cells=footprintCells(s),adjacent=cells.some(c=>(c.x===rect.minX-1||c.x===rect.maxX+1)&&c.z>=rect.minZ&&c.z<=rect.maxZ||(c.z===rect.minZ-1||c.z===rect.maxZ+1)&&c.x>=rect.minX&&c.x<=rect.maxX);if(!adjacent)return false;
   const match=/^\((-?\d+),\s*-?\d+,\s*(-?\d+)\)$/.exec(f.interactionOffset);if(!match)throw Error('Unresolved actual interaction offset');
   let x=Number(match[1]),z=Number(match[2]);for(let n=0;n<(s.orientation??0);n++){const old=x;x=z;z=-old;}return inside(rect,{x:s.x+x,z:s.z+z});
  });
  const rotationValid=(c:Readonly<Cell>)=>{
   const box=rectAt(c);if(!inBounds(c)||box.maxX>=width||box.maxZ>=height)return false;
   if(!building)return true; // Items wipe no edifice/plant and have no interaction cell.
   for(let z=box.minZ;z<=box.maxZ;z++)for(let x=box.minX;x<=box.maxX;x++)if(world.tiles[z*width+x]!.mineable||world.tiles[z*width+x]!.collapsedRock)return false;
   if(world.structures.some(s=>{const cells=footprintCells(s);return cells.some(c=>inside(box,c));}))return false;
   return true;
  };
  const chooseRotation=(c:Readonly<Cell>)=>{if(!rotationValid(c))return false;random.integer(0,1);return true;}; // Nonrotatable, but TryRandomElement uses exclusive Range.
  const canScatter=(c:Readonly<Cell>)=>{
   if(!inBounds(c)||layoutRects.some(r=>inside(r,c))||used.some(p=>(p.x-c.x)**2+(p.z-c.z)**2<=25)||!physical.standable(c.z*width+c.x)||spec.near&&world.tiles[c.z*width+c.x]!.fogged===true||!spec.roof&&roofs.has(c.z*width+c.x))return false;
   if(building){const box=rectAt(c);if(box.maxX>=width||box.maxZ>=height||interactionBlocked(box))return false;for(let z=box.minZ;z<=box.maxZ;z++)for(let x=box.minX;x<=box.maxX;x++)if(!terrainSupportsAffordance256(world.tiles[z*width+x]!,'Light',world))return false;}
   return chooseRotation(c);
  };
  const baseCell=():number|null=>{
   if(spec.near)return randomClosewalkCellNear256(close,start850,20,random,i=>canScatter(point(i)));
   if(5>width/2||5>height/2)return null;
   for(let n=0;n<1000;n++){const c={x:random.integer(5,width-5),z:random.integer(5,height-5)};if(canScatter(c))return c.z*width+c.x;}return null;
  };
  for(const quantity of counts){
   let cell:number|null;
   if(building)cell=baseCell();else {
    if(left<=0){const selected=baseCell();if(selected===null)throw Error('Actual875 cluster-center search exhausted before closewalk');cluster=selected;left=4;}
    left--;cell=randomClosewalkCellNear256(close,cluster,4,random,i=>chooseRotation(point(i)));
   }
   if(cell===null)break;
   const loc=point(cell);if(!chooseRotation(loc)){used.push(loc);continue;}
   if(!Number.isSafeInteger(world.nextId+1))throw Error('Starting scatter namespace exhausted');
   if(building){
    const original=createShipChunk256(world.nextId++,loc),box=rectAt(loc);
    // Default GenSpawn WipeMode.Vanish: pass-through ShipChunk wipes plants
    // and filth, never relocates Item owners and offers no harvest/refund.
    world.resources=world.resources.filter(r=>!inside(box,r));
    for(const f of [...world.filth?.items??[]])if(inside(box,f))removeFilth(world,f);
    world.structures.push(original);close=captureRandomClosewalk256(world);physical=captureActualLocalDistricts256(world);
   }else {
    const source:MaterialPile={id:world.nextId++,item:spec.item,kind:definition!.kind,quantity,owner:{type:'ground',...loc}};setMaterialForbidden256(source,true);
    captureStartingGeneratedPlacement256(world,arrival,loc)(source);
   }
   placed+=quantity;used.push(loc);
  }
  report.push({item:spec.item,requested:spec.count,placed});
 }
 refreshStock(world);return report;
}
