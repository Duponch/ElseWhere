/** Wave 1 of the user's feedback of 22 November, lot 3 (items 9, 10, 11, 12, 14
 * and 16): presentation and selection only, no World change. */
import {afterEach,describe,expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import type {Resource,Structure,World} from '../src/sim/types';
import {pawnShortName} from '../src/ui/pawn-short-name';
import {animalStageDrawScale,animalStageIndex} from '../src/render/animal-stage-scale';
import {WildlifeBodyScale} from '../src/render/wildlife-frame-state';
import {ANIMAL_SPECIES_IDS} from '../src/sim/animal-species';
import {adultAgeTicks,juvenileAgeTicks} from '../src/sim/animal-life';
import {ReferenceFloraLibrary} from '../src/render/origami/resource-flora';
import {appendFlora,type FloraParts} from '../src/render/flora-presentation';
import {pileSurfaces} from '../src/render/pile-surfaces';
import {pileParts} from '../src/render/pile-parts';
import {buildOrigamiAnimalPresentation} from '../src/render/origami/animal-presentation';
import {buildOrigamiAnimalReference} from '../src/render/origami/animal-reference';
import {origamiAnimalPresentationGeometry} from '../src/render/origami/animal-geometry';
import {bestiaryPaintProfile} from '../src/render/origami/reference-profiles';
import {GAME_REQUIRED_VIRTUAL_IDS78} from '../src/render/origami/game-paint-residency';
import {mapObjectsAt,nextMapObject,wallAttachmentsDrawnAt} from '../src/ui/map-object-selection';
import {WORLD_SCALE} from '../src/world/scale';
import {NativeStage} from '../src/ui3d/NativeStage';
vi.mock('../src/ui/native-cardboard-cursors',()=>({setNativeCursor:vi.fn()}));
afterEach(()=>{vi.unstubAllGlobals();});

function bareWorld(seed:number):World {
  const world=createWorld(seed,16,16);
  world.tiles=world.tiles.map(()=>({terrain:'grass'}));
  world.resources=[];world.structures=[];world.jobs=[];world.piles=[];world.stockpiles=[];world.packed=[];world.growingZones=[];
  return world;
}
function structure(world:World,kind:Structure['kind'],x:number,z:number,orientation:Structure['orientation']=0):Structure {
  const s:Structure={id:world.nextId++,kind,x,z,orientation,footprint:'standard'};world.structures.push(s);return s;
}
type Mesh=THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
function meshes(root:THREE.Object3D):Mesh[]{const found:Mesh[]=[];root.traverse(o=>{if(o instanceof THREE.Mesh)found.push(o as Mesh);});return found;}

describe('item 16 · colonist bar short name (Core NameTriple.ToStringShort)',()=>{
  test('the nickname is shown, a single or unquoted name keeps its first word',()=>{
    expect(pawnShortName('Umbre « LeSombre » Nighthawk')).toBe('LeSombre');
    expect(pawnShortName('Ada \'Ace\' Lovelace')).toBe('Ace');
    expect(pawnShortName('Soline')).toBe('Soline');
    expect(pawnShortName('Jean Dupont')).toBe('Jean');
    // An apostrophe inside a word is not a nickname quote.
    expect(pawnShortName('N\'Golo Kanté')).toBe('N\'Golo');
    expect(pawnShortName('  Mina  ')).toBe('Mina');
  });
});

describe('item 9 · baby animals use Core drawSize per life stage',()=>{
  test('a muffalo calf is half the adult and a juvenile three quarters (drawSize 1.5, 2.25, 3)',()=>{
    expect(animalStageDrawScale('muffalo',0)).toBe(.5);
    expect(animalStageDrawScale('muffalo',juvenileAgeTicks('muffalo'))).toBe(.75);
    expect(animalStageDrawScale('muffalo',adultAgeTicks('muffalo'))).toBe(1);
    expect(animalStageDrawScale('duck',0)).toBeCloseTo(.45/.87,12);
  });
  test('every species keeps baby < juvenile < adult, including the smaller Core goat and pig babies',()=>{
    expect(ANIMAL_SPECIES_IDS).toHaveLength(56);
    for(const species of ANIMAL_SPECIES_IDS){
      const baby=animalStageDrawScale(species,0),juvenile=animalStageDrawScale(species,juvenileAgeTicks(species)),adult=animalStageDrawScale(species,adultAgeTicks(species));
      expect(adult,species).toBe(1);expect(baby,species).toBeLessThan(juvenile);expect(juvenile,species).toBeLessThan(1);
      if(species==='goat'){expect(baby).toBeCloseTo(.6/1.42,12);expect(juvenile).toBeCloseTo(1.15/1.42,12);}
      else if(species==='pig'){expect(baby).toBeCloseTo(.6/1.6,12);expect(juvenile).toBeCloseTo(1.15/1.6,12);}
      else if(species==='thrumbo'){expect(baby).toBeCloseTo(2.5/4.8,12);expect(juvenile).toBeCloseTo(4/4.8,12);}
      else expect(baby,species).toBeGreaterThanOrEqual(.45);
      expect(animalStageIndex(species,0)).toBe(0);
    }
  });
  test('a persisted growth tracker decides the stage, and the wildlife layer reads the drawn scale',()=>{
    expect(animalStageIndex('alpaca',0,0)).toBe(0);expect(animalStageIndex('alpaca',0,1)).toBe(2);
    const scale=new WildlifeBodyScale(),calf={species:'muffalo' as const,ageTicks:0};
    expect(scale.read(calf)).toBe(.5);calf.ageTicks=adultAgeTicks('muffalo');expect(scale.read(calf)).toBe(1);
  });
});

describe('item 11 · bushes keep the shrub drawn before the Gouache/Origami redesign',()=>{
  test('bush and berry bush are not taken by the reference flora batch and draw the faceted shrub',()=>{
    const world=bareWorld(11),library=new ReferenceFloraLibrary(false,false),batch=library.createBatch();
    try{
      const bush:Resource={id:1,kind:'wild-plant',species:'bush',x:3,z:3,amount:1,growth:1},berries:Resource={id:2,kind:'berries',species:'berry-bush',x:4,z:3,amount:1,growth:1};
      const oak:Resource={id:3,kind:'tree',species:'oak',x:6,z:3,amount:1,growth:1};
      expect(batch.append(world,bush,0,1)).toBe(false);expect(batch.append(world,berries,0,1)).toBe(false);expect(batch.append(world,oak,0,1)).toBe(true);
      const parts:FloraParts={trunks:[],crowns:[],cones:[],bushes:[],blades:[],cacti:[],fruit:[]};
      appendFlora(parts,world,bush,0,1);
      expect(parts.bushes).toHaveLength(1);expect(parts.fruit).toHaveLength(0);
      expect(parts.bushes[0]).toMatchObject({y:.3,sx:.43,sy:.37,sz:.41});
      appendFlora(parts,world,berries,0,1);
      expect(parts.bushes).toHaveLength(2);expect(parts.fruit).toHaveLength(5);
    }finally{library.dispose();}
  });
});

describe('item 12 · an item lying on a seat is drawn on the seat',()=>{
  test('chair, armchair, couch and end table cells lift the pile to their top, in front of the backrest',()=>{
    const world=bareWorld(12);
    const chair=structure(world,'dining-chair',2,2,0),turned=structure(world,'dining-chair',4,2,1),armchair=structure(world,'armchair',6,2,2),table=structure(world,'end-table',8,2,0);
    const surfaces=pileSurfaces(world),at=(s:Structure)=>surfaces.get(s.z*world.width+s.x)!;
    expect(at(chair)).toMatchObject({y:WORLD_SCALE.stoolHeight+.08,scaleHeight:true});expect(at(chair).z).toBeCloseTo(.03,12);expect(at(chair).x).toBeCloseTo(0,12);
    expect(at(turned).x).toBeCloseTo(.03,12);expect(at(turned).z).toBeCloseTo(0,12);
    expect(at(armchair).y).toBe(.44);expect(at(armchair).z).toBeCloseTo(-.08,12);
    expect(at(table).y).toBe(WORLD_SCALE.tableHeight);
    // The chunk's lowest part now starts on the seat top instead of the floor.
    const placed=pileParts([{x:2,z:2,kind:'chunk',item:'limestone-chunk',quantity:1,supplied:false,surface:at(chair)}]);
    const ground=pileParts([{x:2,z:2,kind:'chunk',item:'limestone-chunk',quantity:1,supplied:false}]);
    const bottom=(parts:typeof placed)=>Math.min(...parts.map(p=>p.y-(p.sy??1)/2));
    expect(placed.length).toBeGreaterThan(0);expect(bottom(placed)).toBeGreaterThan(bottom(ground)+.4);
  });
});

describe('item 10 · the muffalo coat is RimWorld\'s pale blue-grey in both styles',()=>{
  test('the product muffalo replaces only the dark buffalo coat, with a resident pigment',()=>{
    const source=buildOrigamiAnimalReference('buffalo'),product=buildOrigamiAnimalPresentation('buffalo');
    try{
      const keys=(root:THREE.Object3D)=>new Set(meshes(root).map(m=>m.material.userData.referencePaintKey as string));
      expect(keys(source).has('matBuffaloDark')).toBe(true);expect(keys(product).has('matBuffaloDark')).toBe(false);
      expect(keys(product).has('matBuffaloHorn')).toBe(true);
      const coat=meshes(product).find(m=>m.name==='forequarters')!.material,silver=bestiaryPaintProfile('matChinchillaSilver');
      expect(coat.color.getHexString()).toBe('97a9ac');expect(coat.userData.referencePaintIndex).toBe(silver);
      expect(GAME_REQUIRED_VIRTUAL_IDS78).toContain(silver);
      expect(product.userData.presentationCorrections).toEqual(['muffalo-blue-grey-coat']);
      expect(meshes(product).length).toBe(meshes(source).length);
      // The compiled game rig carries the same profile on its coat vertices.
      const g=origamiAnimalPresentationGeometry(1,'muffalo',false)!,paint=g.getAttribute('animalPaint');
      const profiles=new Set<number>();for(let i=0;i<paint.count;i++)profiles.add(paint.getW(i));
      expect(profiles.has(silver)).toBe(true);g.dispose();
    }finally{for(const root of [source,product])for(const m of meshes(root))m.geometry.dispose();}
  });
});

describe('item 14 · selection picks the most relevant thing on a cell and cycles',()=>{
  test('a wall lamp is found on the wall it hangs on, before the wall, and clicks cycle lamp, wall, lamp',()=>{
    const world=bareWorld(14),wall=structure(world,'wall',5,6),lamp=structure(world,'wall-lamp',5,5,0);
    expect(wallAttachmentsDrawnAt(world,{x:5,z:6})).toEqual([lamp]);
    const objects=mapObjectsAt(world,{x:5,z:6});
    expect(objects).toEqual([{kind:'structure',id:lamp.id},{kind:'structure',id:wall.id}]);
    expect(nextMapObject(world,{x:5,z:6},undefined)).toEqual(objects[0]);
    expect(nextMapObject(world,{x:5,z:6},objects[0])).toEqual(objects[1]);
    expect(nextMapObject(world,{x:5,z:6},objects[1])).toEqual(objects[0]);
    expect(mapObjectsAt(world,{x:5,z:5})).toEqual([{kind:'structure',id:lamp.id}]);
    // A lamp turned away from that wall is not drawn on it.
    lamp.orientation=2;expect(mapObjectsAt(world,{x:5,z:6})).toEqual([{kind:'structure',id:wall.id}]);
  });
  test('a shelf comes before its items (Core sorts Building_Storage first) and a conduit stays last',()=>{
    const world=bareWorld(15),shelf=structure(world,'shelf',3,3,0),cell={x:3,z:3};
    const pile={id:world.nextId++,kind:'wood' as const,item:'wood' as const,quantity:5,owner:{type:'ground' as const,...cell}};world.piles.push(pile);
    const objects=mapObjectsAt(world,cell);
    expect(objects[0]).toEqual({kind:'structure',id:shelf.id});expect(objects).toContainEqual({kind:'pile',id:pile.id});
    const table=structure(world,'table',8,8,0),conduit=structure(world,'power-conduit',8,8,0);
    world.structures.reverse();
    expect(mapObjectsAt(world,{x:8,z:8})).toEqual([{kind:'structure',id:table.id},{kind:'structure',id:conduit.id}]);
  });
});

describe('item 14 · the selection inspector does not swallow map clicks',()=>{
  type StageAccess={[key:string]:unknown;pointerDown(event:PointerEvent):void;dismissPage:ReturnType<typeof vi.fn>;worldPress?:{pointerId:number;button:number}};
  const stage=(page:{id:string;modal:boolean;layout?:string})=>{
    vi.stubGlobal('document',{documentElement:{}});
    return Object.assign(Object.create(NativeStage.prototype),{worldVisible:true,frontVisible:false,page,pageBox:{x:20,y:100,width:600,height:400},displayScale:1,height:1000,bottomDockHeight:96,bottomOffset:0,bottomOpen:false,options:{},
      hit:vi.fn(()=>undefined),globeHit:vi.fn(()=>null),clearHint:vi.fn(),hover:vi.fn(),setPointerOverUi:vi.fn(),invalidate:vi.fn(),dismissPage:vi.fn()}) as StageAccess;
  };
  const left=()=>({button:0,buttons:1,clientX:900,clientY:600,pointerId:7,target:null,isPrimary:true,preventDefault:vi.fn(),stopImmediatePropagation:vi.fn()}) as unknown as PointerEvent&{preventDefault:ReturnType<typeof vi.fn>};
  test('a left click in the map while an inspector is open reaches the renderer (Core: clicks select through the inspect pane)',()=>{
    const s=stage({id:'inspect-structure',modal:false,layout:'inspector'}),event=left();s.pointerDown(event);
    expect(s.dismissPage).not.toHaveBeenCalled();expect(event.preventDefault).not.toHaveBeenCalled();expect(s.worldPress).toEqual({pointerId:7,button:0});
  });
  test('other game pages keep their outside-click closing',()=>{
    for(const page of [{id:'factions',modal:true},{id:'work',modal:false,layout:'table'}]){
      const s=stage(page),event=left();s.pointerDown(event);expect(s.dismissPage).toHaveBeenCalledOnce();expect(s.worldPress).toBeUndefined();
    }
  });
});
