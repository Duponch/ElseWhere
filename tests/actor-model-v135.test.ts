import { expect,test } from 'vitest';
import { pawnGeometry } from '../src/render/pawn-geometry';
import { animalParts } from '../src/render/animal-shape';
import { graveParts } from '../src/render/grave-parts';
import { createWorld } from '../src/sim/index';
import { initialGrave } from '../src/sim/burial';
import {HUMAN_REFERENCE_SCALE} from '../src/render/origami/human-geometry';

test('the shared human rig joins the authored torso and trousers, overlaps shoulders and retains the revolver bind direction',()=>{
  const geometry=pawnGeometry(),point=geometry.getAttribute('position'),bone=geometry.getAttribute('boneId'),dye=geometry.getAttribute('dye');
  expect(geometry.userData.origamiHumanReference).toBe(true);
  const parts=geometry.userData.origamiHumanParts as readonly {id:string;start:number;count:number}[],index=geometry.index;
  const vertices=(ids:readonly string[])=>ids.flatMap(id=>{const part=parts.find(part=>part.id===id);expect(part,'Source part '+id).toBeDefined();if(!part)throw Error('Missing actual Source part '+id);return Array.from({length:part.count},(_,i)=>index?.getX(part.start+i)??part.start+i);});
  const bounds=(ids:readonly string[])=>{
    const result={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
    for(const i of vertices(ids)){
      result.minX=Math.min(result.minX,point.getX(i));result.maxX=Math.max(result.maxX,point.getX(i));
      result.minY=Math.min(result.minY,point.getY(i));result.maxY=Math.max(result.maxY,point.getY(i));
    }
    return result;
  };
  const trunk=bounds(['reference-torso']);
  const legs=bounds(['reference-left-trouser-upper','reference-right-trouser-upper']);
  const arms=bounds(['reference-right-upper-arm']);
  expect(trunk.minY).toBeCloseTo(.56*HUMAN_REFERENCE_SCALE,6);
  expect(trunk.minY).toBeCloseTo(legs.maxY,6);
  expect(trunk.maxY).toBeGreaterThan(arms.minY+.08);
  expect(trunk.maxX).toBeGreaterThan(arms.minX);
  const gunCenters:number[]=[];
  for(const id of ['weapon-revolver-0','weapon-revolver-1','weapon-revolver-2']){
    const corners=vertices([id]);expect(corners.every(i=>bone.getX(i)===0&&dye.getX(i)===-1)).toBe(true);
    gunCenters.push(corners.reduce((sum,i)=>sum+point.getY(i),0)/corners.length);
  }
  expect(gunCenters).toHaveLength(3);
  expect(gunCenters[0]).toBeLessThan(gunCenters[2]!); // barrel below grip
  geometry.dispose();
});

test('every quadruped keeps upper legs inside its body proxy',()=>{
  for(const species of ['hare','snow-hare','deer','muffalo','gazelle','dromedary']){
    const parts=animalParts(species),body=parts[0]!;
    const bodyBottom=body.center[1]-body.size[1]/2;
    const legs=parts.filter(p=>p.bone===1||p.bone===2);
    expect(legs.length).toBeGreaterThanOrEqual(2);
    expect(legs.some(p=>p.center[1]+p.size[1]/2>bodyBottom+.07)).toBe(true);
  }
});

test('the grave marker is a planted upright cross for every orientation',()=>{
  const world=createWorld(17,32,32);
  for(const orientation of [0,1,2,3] as const){
    world.structures=[{id:world.nextId++,kind:'grave',x:12,z:12,orientation,footprint:'standard',grave:initialGrave()}];
    const [soil,shaft,beam]=graveParts(world);
    expect(soil).toBeDefined();expect(shaft).toBeDefined();expect(beam).toBeDefined();
    expect(shaft!.sy).toBeGreaterThan(shaft!.sx!*5);
    expect(beam!.sx).toBeGreaterThan(beam!.sy!*3);
    expect(beam!.y).toBeGreaterThan(shaft!.y);
    expect(shaft!.x).toBe(beam!.x);expect(shaft!.z).toBe(beam!.z);
    expect(shaft!.ry).toBe(soil!.ry);
  }
});
