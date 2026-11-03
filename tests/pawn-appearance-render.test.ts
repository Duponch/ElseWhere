import {test,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {PawnLayer} from '../src/render/PawnLayer';
import {pawnGeometry,PAWN_EYE_OPEN,PAWN_EYE_CLOSED,PAWN_EYE_CROSS} from '../src/render/pawn-geometry';
import {createWorld} from '../src/sim/index';
import {startingPawn} from '../src/sim/starting-pawns';
import {appearanceOf} from '../src/sim/pawn-appearance';
import {appearanceShape} from '../src/render/pawn-appearance-shape';
import {HAIR_PARTS,BEARD_PARTS,HAIR_MASKS} from '../src/render/pawn-appearance-shape';
import {portraitDataUrl,portraitExpressionOf,portraitCacheSize} from '../src/ui/pawn-portrait';
import {apparelAppearance} from '../src/render/character-apparel';
import {HUMAN_REFERENCE_SCALE} from '../src/render/origami/human-geometry';

test('resident appearance survives actor growth, reordering and restored legacy identity without mutating gameplay',()=>{
  const world=createWorld(42,32,32),layer=new PawnLayer();
  const old=world.pawns[0]!;delete old.appearance;
  const before=JSON.stringify(world);layer.update(world,1,true);
  const geometry=layer.feedbackSource!,material=(layer.group.children[0] as THREE.Mesh).material;
  expect(JSON.stringify(world)).toBe(before);
  const instances=geometry.getAttribute('aShape') as THREE.InterleavedBufferAttribute;
  const expected=appearanceShape(appearanceOf(old,world.seed));
  expect(Array.from({length:4},(_,i)=>instances.getComponent(0,i))).toEqual(expected);
  const identities=world.pawns.map(p=>({...p}));
  for(let i=0;i<100;i++)world.pawns.push(startingPawn(world.nextId++,`Test ${i}`,12,12,0,55,world.seed));
  layer.update(world,1,false);
  const grown=layer.feedbackSource!,shape=grown.getAttribute('aShape') as THREE.InterleavedBufferAttribute;
  expect((layer.group.children[0] as THREE.Mesh).material).toBe(material);
  expect(shape.count).toBeGreaterThanOrEqual(world.pawns.length);
  expect(shape.data).toBe((grown.getAttribute('aSkin') as THREE.InterleavedBufferAttribute).data);
  expect(shape.data).toBe((grown.getAttribute('aEquipment') as THREE.InterleavedBufferAttribute).data);
  expect(Array.from({length:4},(_,i)=>shape.getComponent(0,i))).toEqual(expected);
  world.pawns.reverse();layer.update(world,1,false);
  const index=world.pawns.findIndex(p=>p.id===old.id);
  expect(Array.from({length:4},(_,i)=>shape.getComponent(index,i))).toEqual(expected);
  expect(world.pawns.find(p=>p.id===old.id)).toEqual(identities[0]);
  // WebGPU guarantees eight buffer slots and sixteen attributes. Unused fire/selection
  // attributes live on the geometry but are not requested by the human shader.
  const names=['position','normal','color','boneId','bindPivot','dye','aFrom','aTo','aMotion','aTravel','aCargo','aTint','aEquipment','aSkin','aHairBlood','aShape'];
  const buffers=new Set(names.map(n=>{const a=grown.getAttribute(n);return a instanceof THREE.InterleavedBufferAttribute?a.data:a;}));
  expect(buffers.size).toBeLessThanOrEqual(8);expect(names.length).toBeLessThanOrEqual(16);
});

test('hairlines and beard cheeks wrap the actual head without coplanar front faces; portraits project the same mesh',()=>{
  // The face occupies z = .15 and y = 1.04..1.34 before the V109 morph.
  const crown=HAIR_PARTS[0]!,nape=HAIR_PARTS[1]!;
  expect(crown.center[2]+crown.size[2]/2).toBeGreaterThan(.15);
  for(const index of [2,3]){
    const fringe=HAIR_PARTS[index]!;
    expect(fringe.center[2]-fringe.size[2]/2).toBeGreaterThan(.15);
    expect(fringe.center[1]+fringe.size[1]/2).toBeGreaterThan(crown.center[1]-crown.size[1]/2);
  }
  const napeBase=nape.center[1]-nape.size[1]/2;
  for(const index of [4,5]){
    const side=HAIR_PARTS[index]!;
    expect(side.center[1]-side.size[1]/2).toBeGreaterThan(napeBase);
    expect(side.center[1]-side.size[1]/2).toBeLessThan(1.24);
    expect(side.center[2]+side.size[2]/2).toBeGreaterThan(.15);
  }
  for(const style of ['long','wavy','tails'] as const){
    for(const index of [1,6,8,9])expect(HAIR_MASKS[style] & 2**index).not.toBe(0);
    for(const index of [4,5])expect(HAIR_MASKS[style] & 2**index).toBe(0);
  }
  for(const index of [8,9])expect(HAIR_PARTS[index]!.center[1]-HAIR_PARTS[index]!.size[1]/2).toBeLessThan(napeBase);
  expect(HAIR_PARTS[6]!.center[1]-HAIR_PARTS[6]!.size[1]/2).toBeLessThan(HAIR_PARTS[8]!.center[1]-HAIR_PARTS[8]!.size[1]/2);
  expect(HAIR_PARTS).toHaveLength(15);
  for(const index of [3,4]){
    const cheek=BEARD_PARTS[index]!;
    expect(cheek.center[1]-cheek.size[1]/2).toBeLessThanOrEqual(1.04);
    expect(cheek.center[2]+cheek.size[2]/2).toBeGreaterThan(.18);
  }
  for(const style of ['afro','curly'] as const)for(const index of [0,4,5,11,12,13])expect(HAIR_MASKS[style] & 2**index).not.toBe(0);
  const pawn=createWorld(42,32,32).pawns[0]!,appearance=appearanceOf(pawn,42);
  const svg=decodeURIComponent(portraitDataUrl(appearance,apparelAppearance()).split(',')[1]!);
  expect(svg).toContain('data-source="pawn-geometry"');
  expect((svg.match(/<polygon /g)??[]).length).toBeGreaterThan(30);
  expect(svg).not.toContain('<path'); // no independent cartoon head/hair shapes
});

test('one resident head contains open, shut and crossed eye geometry without a new vertex stream',()=>{
  const geometry=pawnGeometry(),dye=geometry.getAttribute('dye'),position=geometry.getAttribute('position');
  expect(geometry.userData.origamiHumanReference).toBe(true);
  const counts=new Map<number,number>(),front=new Map<number,number>();
  for(let i=0;i<dye.count;i++){
    const tag=dye.getX(i);
    if(tag!==PAWN_EYE_OPEN&&tag!==PAWN_EYE_CLOSED&&tag!==PAWN_EYE_CROSS)continue;
    counts.set(tag,(counts.get(tag)??0)+1);
    front.set(tag,Math.max(front.get(tag)??0,position.getZ(i)));
  }
  expect(counts.get(PAWN_EYE_OPEN)).toBe(72);
  expect(counts.get(PAWN_EYE_CLOSED)).toBe(72);
  expect(counts.get(PAWN_EYE_CROSS)).toBe(144);
  // Actual reference eye boxes: unchanged triangle counts, authored depth
  // converted once by the common model scale (including the crossed offset).
  expect(front.get(PAWN_EYE_OPEN)).toBeCloseTo((.18+.03/2)*HUMAN_REFERENCE_SCALE,6);
  expect(front.get(PAWN_EYE_CLOSED)).toBeCloseTo((.181+.03/2)*HUMAN_REFERENCE_SCALE,6);
  expect(front.get(PAWN_EYE_CROSS)).toBeCloseTo((.183+.03/2)*HUMAN_REFERENCE_SCALE,6);
  expect(geometry.getAttribute('dye')).toBeInstanceOf(THREE.InterleavedBufferAttribute);
  geometry.dispose();
});

test('HUD and Bio portraits cache distinct awake, sleeping and dead eyes only on state changes',()=>{
  const world=createWorld(82,32,32),pawn=world.pawns[0]!,appearance=appearanceOf(pawn,world.seed);
  const look={...apparelAppearance(),signature:'expression-test'};
  const before=portraitCacheSize();
  const awake=portraitDataUrl(appearance,look,undefined,portraitExpressionOf(pawn));
  pawn.state='sleeping';
  const asleep=portraitDataUrl(appearance,look,undefined,portraitExpressionOf(pawn));
  pawn.state='dead';
  const dead=portraitDataUrl(appearance,look,undefined,portraitExpressionOf(pawn));
  expect(new Set([awake,asleep,dead]).size).toBe(3);
  expect(portraitCacheSize()).toBe(before+3);
  for(const [expression,url] of [['awake',awake],['sleep',asleep],['dead',dead]] as const){
    const svg=decodeURIComponent(url.split(',')[1]!);
    expect(svg).toContain(`data-expression="${expression}"`);
    expect(portraitDataUrl(appearance,look,undefined,expression)).toBe(url);
  }
  const art=(url:string)=>decodeURIComponent(url.split(',')[1]!).replace(/ data-expression="(?:awake|sleep|dead)"/,'');
  expect(art(awake)).not.toBe(art(asleep));
  expect(art(asleep)).not.toBe(art(dead));
  expect(portraitExpressionOf({...pawn,state:'downed',medicalSleep:true})).toBe('sleep');
});

test('the cached mesh portrait follows the physical primary weapon and removes it on drop',()=>{
  const geometry=pawnGeometry(),position=geometry.getAttribute('position'),dye=geometry.getAttribute('dye');
  const rifleBounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};
  for(let i=0;i<position.count;i++)if(dye.getX(i)===-4){
    rifleBounds.minX=Math.min(rifleBounds.minX,position.getX(i));rifleBounds.maxX=Math.max(rifleBounds.maxX,position.getX(i));
    rifleBounds.minY=Math.min(rifleBounds.minY,position.getY(i));rifleBounds.maxY=Math.max(rifleBounds.maxY,position.getY(i));
  }
  expect(rifleBounds.maxY-rifleBounds.minY).toBeGreaterThan((rifleBounds.maxX-rifleBounds.minX)*4);
  geometry.dispose();
  const world=createWorld(42,32,32),appearance=appearanceOf(world.pawns[0]!,world.seed),look=apparelAppearance();
  const decode=(weapon?:string)=>decodeURIComponent(portraitDataUrl(appearance,look,weapon).split(',')[1]!);
  const empty=decode(),rifleSvg=decode('bolt-action-rifle'),revolver=decode('revolver'),knife=decode('plasteel-knife');
  expect(empty).toContain('data-weapon=""');
  for(const [weapon,svg] of [['bolt-action-rifle',rifleSvg],['revolver',revolver],['plasteel-knife',knife]] as const){
    expect(svg).toContain(`data-weapon="${weapon}"`);
    expect((svg.match(/<polygon /g)??[]).length).toBeGreaterThan((empty.match(/<polygon /g)??[]).length);
    expect(svg).not.toBe(empty);
  }
  expect(portraitDataUrl(appearance,look,'bolt-action-rifle')).toBe(portraitDataUrl(appearance,look,'bolt-action-rifle'));
  expect(decode()).toBe(empty);
});
