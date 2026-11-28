import type {Cell,Orientation,StructureKind,World} from '../../sim/types.ts';
import {footprintCells} from '../../sim/definitions.ts';
import {packRiverWater256,unpackRiverWater256} from '../../sim/river-water-owner-256.ts';

/** RimWorld uses a Unity ground plane: increasing Z is north (up in its
 * map view). Elsewhere draws its X/Z ground in Three's right-handed view:
 * from the ordinary south (+Z) camera increasing Z is down on screen.
 * Convert at the import boundary, never at individual renderers or inputs.
 * All positions, cell indices and directions must use this same isometry.
 * The planet's tile IDs and the raw RWS reader remain in Core coordinates. */
export class RwsLocalCoordinates {
 constructor(readonly width:number,readonly height:number){}
 cell(source:Cell):Cell{return {x:source.x,z:this.height-1-source.z};}
 /** The inverse is identical: this is a reflection, not a translation. */
 index(index:number):number{return (this.height-1-Math.floor(index/this.width))*this.width+index%this.width;}
 /** Rot4 and our cardinal footprint directions are +Z,+X,-Z,-X. */
 rotation(rot:number):Orientation{return ((2-(rot&3)+4)&3) as Orientation;}
 /** Anchor of a fixed rectangle expressed as its minimum corner. */
 minimum(source:Cell,depth:number):Cell{return {x:source.x,z:this.height-depth-source.z};}
 rectangle<T extends {minX:number;minZ:number;maxX:number;maxZ:number}>(source:T):T {
  return {...source,minZ:this.height-1-source.maxZ,maxZ:this.height-1-source.minZ};
 }
 heading(source:number):number{return Math.atan2(Math.sin(source),-Math.cos(source));}
}

/** Cells actually occupied by Core's Thing.Position/Rot4, before changing
 * coordinates. In particular reflecting a centre anchor of an even-sized
 * building and then rotating it is not sufficient to preserve its outline. */
export function coreOccupiedCells(pos:Cell,rot:number,size:readonly [number,number]):Cell[] {
 let [width,depth]=size,cx=pos.x,cz=pos.z;
 if(rot===1||rot===3)[width,depth]=[depth,width];
 const adjust=[[0,0],[0,-1],[-1,-1],[-1,0]] as const,[ax,az]=adjust[rot&3]!;
 if(width%2===0)cx+=ax;if(depth%2===0)cz+=az;
 const minX=cx-Math.floor((width-1)/2),minZ=cz-Math.floor((depth-1)/2),out:Cell[]=[];
 for(let z=0;z<depth;z++)for(let x=0;x<width;x++)out.push({x:minX+x,z:minZ+z});
 return out;
}

/** Owners with a canonical, fixed orientation in Elsewhere (including
 * automatic doors and the non-rotatable members of the power network). A
 * reflected rectangle can still be placed by choosing its correct anchor;
 * never give a non-rotatable structure Rot4.South just because Z changed. */
const FIXED_IMPORT_ORIENTATION=new Set<StructureKind>([
 'wall','door','autodoor','fence','fence-gate','pen-marker','sandbags','animal-sleeping-spot','flower-pot',
 'small-sculpture','large-sculpture','table-large','poker-table','hoopstone-ring','horseshoes',
 'power-conduit','power-switch','wood-generator','chemfuel-generator','solar-generator','geothermal-generator',
 'standing-lamp','sun-lamp','torch-lamp','heater','passive-cooler','firefoam-popper','mini-turret',
 'orbital-beacon','multi-analyzer','spike-trap','ied-high-explosive','ied-incendiary','campfire','hopper','butcher-spot','crafting-spot',
 'egg-box','column','urn','stele-large','stele-grand','ship-chunk','insect-hive','glow-pod','ancient-road-lamp','ship-computer','ship-sensors'
]);
const cellKey=(c:Cell)=>`${c.x},${c.z}`;
/** Match the exact reflected Core footprint, not an approximate transformed
 * anchor. Try the reflected facing first for a directional building. */
export function placeRwsFootprint(coordinates:RwsLocalCoordinates,kind:StructureKind,sourcePos:Cell,rot:number,size:readonly [number,number]):(Cell&{orientation:Orientation;exact:boolean})|undefined {
 const pos=coordinates.cell(sourcePos),fixed=FIXED_IMPORT_ORIENTATION.has(kind),preferred=fixed?0:coordinates.rotation(rot);
 const target=new Set(coreOccupiedCells(sourcePos,rot,size).map(c=>cellKey(coordinates.cell(c))));
 const orientations:Orientation[]=fixed?[0]:[preferred,...([0,1,2,3] as const).filter(o=>o!==preferred)];
 const candidates=[...target].map(k=>{const [x,z]=k.split(',').map(Number);return {x:x!,z:z!};});
 for(const orientation of orientations)for(const c of [pos,...candidates]){
  const cells=footprintCells({kind,x:c.x,z:c.z,orientation,footprint:'standard'});
  if(cells.length===target.size&&cells.every(c=>target.has(cellKey(c))))return {...c,orientation,exact:orientation===preferred};
 }
 return undefined;
}

/** The base map is generated with Core's actual local coordinates. Most
 * of it is cleared immediately and reconstructed from the source RWS.
 * The original converter retains these spatial owners; reflect their
 * positions as well so, e.g., a geyser/road/river never ends up on the
 * opposite side of the imported terrain. No planet or simulation clock is
 * changed. This runs once, before any local source content is inserted. */
export function orientGeneratedImportBase(w:World,coordinates:RwsLocalCoordinates):void {
 const cell=(c:Cell)=>coordinates.cell(c),index=(i:number)=>coordinates.index(i);
 if(w.scenario?.landing)w.scenario={...w.scenario,landing:cell(w.scenario.landing)};
 const arrival=w.startingArrival;
 if(arrival){
  // The geographic import factory drains the starting pods before clearing
  // the generated colonists; a still occupied pod is not an opened map.
  if(arrival.phase!=='opened')throw Error('Arrivée générée non terminée avant la conversion RimWorld.');
  w.startingArrival={...arrival,cells:arrival.cells.map(cell)};
  if('destroyedPods' in arrival&&arrival.destroyedPods&&'destroyedPods' in w.startingArrival)w.startingArrival.destroyedPods=arrival.destroyedPods.map(p=>({...p,cell:cell(p.cell)}));
 }
 if(w.geysers)w.geysers={...w.geysers,items:w.geysers.items.map(g=>({...g,...coordinates.minimum(g,2)}))};
 if(w.roadInfo)w.roadInfo={...w.roadInfo,edgeCells:w.roadInfo.edgeCells.map(index)};
 if(w.riverWater){
  // WaterInfo is x-major (unlike the save's terrain grid) and stores a
  // vector, so reflect the row AND the signed Z component, including -0.
  const old=unpackRiverWater256(w.riverWater,w.width,w.height),out=new Float32Array(old.length);
  for(let x=0;x<w.width;x++)for(let z=0;z<w.height;z++){
   const source=(x*w.height+z)*2,dest=(x*w.height+w.height-1-z)*2;
   out[dest]=old[source]!;out[dest+1]=-old[source+1]!;
  }
  w.riverWater=packRiverWater256(out,w.width,w.height);
 }
 if(w.ancientShrineWarnings)w.ancientShrineWarnings={...w.ancientShrineWarnings,
  pairs:w.ancientShrineWarnings.pairs.map(p=>({...p,rect:coordinates.rectangle(p.rect),center:cell(p.center)}))};
 if(w.mechanoids)w.mechanoids=w.mechanoids.map(m=>({...m,...cell(m),heading:coordinates.heading(m.heading),path:m.path.map(cell),
  ...m.motion?{motion:{...m.motion,from:cell(m.motion.from),to:cell(m.motion.to)}}:{},
  ...m.temple?{temple:{...m.temple,goal:m.temple.goal?cell(m.temple.goal):null}}:{},
  ...m.raid?{raid:{...m.raid,goal:m.raid.goal?cell(m.raid.goal):null}}:{},
  ...m.site263?{site263:{...m.site263,goal:m.site263.goal?cell(m.site263.goal):null}}:{}}));
 if(w.deepResources)w.deepResources={...w.deepResources,cells:w.deepResources.cells.map(c=>({...c,index:index(c.index)})).sort((a,b)=>a.index-b.index)};
 if(w.thermal)w.thermal={regions:w.thermal.regions.map(r=>({...r,cells:r.cells.map(index).sort((a,b)=>a-b)}))};
}
