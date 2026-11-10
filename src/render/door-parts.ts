import { doorOrientations, isRoomDoor } from '../sim/door-rules';
import type { World } from '../sim/types';
import type { Placement } from './primitives';
import { buildingMaterialColor } from './building-material-color';
import { WORLD_SCALE } from '../world/scale';
import { penBoundaryAxes } from './pen-parts';

/** The lintel meets the wall above a human-height opening. Cutaway retains
 * short leaves/jambs and removes every horizontal piece spanning the opening. */
export const doorLeafTop=(cutaway:boolean):number=>Math.min(WORLD_SCALE.futureDoorClearance,(cutaway?WORLD_SCALE.wallCutawayHeight:WORLD_SCALE.wallHeight)-.14);
export const DOOR_LEAF_BOTTOM=.035;
export const doorLeafColor=(material:World['structures'][number]['material']):number=>buildingMaterialColor(material,0x9b744b)??0x9b744b;

/** Closed leaves meet at the center and the frame's inner face. Their animated
 * sliding displacement remains the responsibility of the retained DoorLayer. */
export function doorLeafPartsForStructure(s:World['structures'][number],cutaway:boolean,axis:0|1):Placement[] {
  const gate=s.kind==='fence-gate',top=gate?.94:doorLeafTop(cutaway),bottom=gate?.08:DOOR_LEAF_BOTTOM;
  const halfWidth=gate?.37:.42,angle=axis*Math.PI/2;
  return [-1,1].map(side=>({targetId:s.id,key:s.id,x:s.x+side*halfWidth/2*Math.cos(angle),y:(top+bottom)/2,
    z:s.z-side*halfWidth/2*Math.sin(angle),sx:halfWidth,sy:top-bottom,sz:gate?.085:.14,ry:angle,color:doorLeafColor(s.material)}));
}

export function doorLeafParts(world:World,cutaway:boolean,subjects:readonly World['structures'][number][]=world.structures):Placement[] {
  const axes=doorOrientations(world),gateAxes=penBoundaryAxes(world),parts:Placement[]=[];
  for(const s of subjects)if(isRoomDoor(s.kind)||s.kind==='fence-gate')parts.push(...doorLeafPartsForStructure(s,cutaway,
    (s.kind==='fence-gate'?gateAxes:axes).get(s.z*world.width+s.x)??0));
  return parts;
}

/** A door can be steel or stone while the room around it is timber. The
 * material above its opening belongs to the surrounding wall, not the leaf. */
type WallIndex=ReadonlyMap<number,World['structures'][number]>;
function indexWalls(world:World):Map<number,World['structures'][number]> {
  const walls=new Map<number,World['structures'][number]>();
  for(const structure of world.structures)if(structure.kind==='wall')walls.set(structure.z*world.width+structure.x,structure);
  return walls;
}
export function doorSurroundMaterial(world:World,x:number,z:number,axis:0|1,walls:WallIndex=indexWalls(world)):World['structures'][number]['material']|undefined {
  const directions=axis===0?[[1,0],[-1,0]]:[[0,1],[0,-1]];
  const neighbors=directions.map(([dx,dz])=>walls.get((z+dz!)*world.width+x+dx!));
  if(neighbors[0]?.material===neighbors[1]?.material)return neighbors[0]?.material;
  return neighbors[0]?.material??neighbors[1]?.material;
}
export function doorHasTimberSpan(world:World,x:number,z:number,woodWalls?:ReadonlySet<number>):boolean {
  const indexed=woodWalls??new Set([...indexWalls(world)].filter(([,wall])=>wall.material==='wood').map(([key])=>key));
  const wood=(atX:number,atZ:number)=>indexed.has(atZ*world.width+atX);
  return wood(x-1,z)&&wood(x+1,z)||wood(x,z-1)&&wood(x,z+1);
}

function shade(color:number,amount:number):number {
  const channel=(shift:number)=>Math.round(((color>>shift)&255)*amount);
  return (channel(16)<<16)|(channel(8)<<8)|channel(0);
}

export function doorParts(world:World,cutaway:boolean,subjects:readonly World['structures'][number][]=world.structures):Placement[] {
  const parts:Placement[]=[],height=cutaway?WORLD_SCALE.wallCutawayHeight:WORLD_SCALE.wallHeight;
  const openingTop=doorLeafTop(cutaway),lintelTop=cutaway?height:openingTop+.11;
  const axes=doorOrientations(world);
  const walls=indexWalls(world);
  const woodWalls=new Set([...walls].filter(([,wall])=>wall.material==='wood').map(([key])=>key));
  for(const s of subjects)if(isRoomDoor(s.kind)) {
    const axis=axes.get(s.z*world.width+s.x)??0;
    const ry=axis*Math.PI/2;
    const timber=doorHasTimberSpan(world,s.x,s.z,woodWalls);
    const frameColor=s.material==='wood'?0x9e9e94:shade(doorLeafColor(s.material),.76);
    // The wall above the opening (timber from the leaf top, masonry above
    // this frame lintel) is the linked wall network's lintel, see WallLayer.
    if(timber)for(const face of [-1,1]) {
      const dx=face*.49*Math.sin(ry),dz=face*.49*Math.cos(ry);
      if(!cutaway)parts.push({targetId:s.id,x:s.x+dx,z:s.z+dz,y:(openingTop+lintelTop)/2,sx:.92,sy:lintelTop-openingTop,sz:.09,ry,color:frameColor});
      for(const side of [-1,1])parts.push({targetId:s.id,x:s.x+dx+side*.46*Math.cos(ry),z:s.z+dz-side*.46*Math.sin(ry),y:openingTop/2,sx:.08,sy:openingTop,sz:.09,ry,color:frameColor});
    } else {
      if(!cutaway)parts.push({targetId:s.id,x:s.x,z:s.z,y:(openingTop+lintelTop)/2,sx:.92,sy:lintelTop-openingTop,sz:.34,ry,color:frameColor});
      for(const side of [-1,1])parts.push({targetId:s.id,x:s.x+side*.46*Math.cos(ry),z:s.z-side*.46*Math.sin(ry),y:openingTop/2,sx:.08,sy:openingTop,sz:.34,ry,color:frameColor});
    }
  }
  return parts;
}
