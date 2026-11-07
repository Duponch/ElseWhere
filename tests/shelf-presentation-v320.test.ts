import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {MaterialPile,Structure} from '../src/sim/types';
import {footprintCells} from '../src/sim/definitions';
import {newShelfStorage} from '../src/sim/shelf-storage';
import {habitatParts,habitatPartsForStructure} from '../src/render/habitat-parts';
import {constructionPreviewParts} from '../src/render/construction-preview-parts';
import {pileIdentitySurfaces} from '../src/render/pile-surfaces';
import {pileParts} from '../src/render/pile-parts';
import {SHELF_LEVELS,SHELF_ITEM_SCALE} from '../src/render/shelf-presentation';
import {CargoHandoffs} from '../src/render/cargo-handoff';
import {ARCHITECT_ICON_MAPPING,ARCHITECT_ICON_URLS} from '../src/ui/architect-icons';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {createMedicalRecord,reconcileMedicalDeath} from '../src/sim/injury-state';
import {adultAgeTicks} from '../src/sim/animal-life';
import {BLOOD_UNIT} from '../src/sim/injury-rules';
import {Group,Mesh,type InstancedBufferGeometry} from 'three/webgpu';
import type {Placement} from '../src/render/primitives';

const pile=(id:number,quantity:number,owner:MaterialPile['owner']):MaterialPile=>({id,kind:'wood',item:'wood',quantity,owner});
function fixture(kind:Structure['kind']='shelf',orientation:Structure['orientation']=0){
  const w=createWorld(42,32),s:Structure={id:500,kind,x:16,z:16,orientation,footprint:'standard',material:'wood',shelf:newShelfStorage(kind==='shelf'?[501,502]:[501])};
  w.structures=[s];w.piles=[];w.packed=[];w.resources=[];w.jobs=[];return {w,s};
}
const pose=(p:ReturnType<typeof habitatParts>[number])=>({x:p.x,y:p.y,z:p.z,sx:p.sx,sy:p.sy,sz:p.sz,color:p.color,ry:p.ry??0});

test.each([0,1,2,3] as const)('both shelf ghosts share finished resident geometry and physical supports at orientation %i',orientation=>{
  for(const kind of ['shelf','small-shelf'] as const){
    const {w,s}=fixture(kind,orientation),before=structuredClone(w),finished=habitatPartsForStructure(s),ghost=constructionPreviewParts(w,[{kind,x:s.x,z:s.z,orientation,material:s.material}]);
    expect(finished).toHaveLength(8);expect(habitatParts(w)).toEqual(finished);
    expect([...ghost.boxes,...ghost.rotatedBoxes].map(pose)).toEqual(finished.map(pose));expect(w).toEqual(before);
    finished.slice(0,3).forEach((p,index)=>expect(p.y!+.035).toBeCloseTo(SHELF_LEVELS[index]!));
    expect(ARCHITECT_ICON_MAPPING[kind]).toEqual(ARCHITECT_ICON_MAPPING.dresser);expect(ARCHITECT_ICON_URLS[kind]).toBe(`/assets/ui/elsewhere/pictograms-20261107/${kind}.svg`);
  }
});

test('actual scene pile projection retains three same-item stacks in one resident chunk and patches only changed poses or quantities',()=>{
  const {w}=fixture('small-shelf');w.piles=[pile(600,11,{type:'ground',x:16,z:16}),pile(601,22,{type:'ground',x:16,z:16}),pile(602,33,{type:'ground',x:16,z:16})];
  const writes:{group:Group;name:string;parts:Placement[]}[]=[],facade={pileGroup:new Group(),pileChunks:new Map(),immutableWorlds:new WeakSet<object>(),pawns:{hiddenPileQuantities:()=>new Map()},boxes:{set(group:Group,name:string,parts:Placement[]){writes.push({group,name,parts});}}};
  const update=Reflect.get(SceneRenderCore.prototype,'updatePiles') as (this:typeof facade,world:typeof w,newMap:boolean)=>void;
  update.call(facade,w,true);const first=writes.at(-1)!;expect(first.parts).toHaveLength(27); // three complete nine-part wood assemblies
  const supports=pileIdentitySurfaces(w);for(const [index,real] of w.piles.entries()){
    const support=supports.get(real.id)!;
    expect(first.parts.slice(index*9,index*9+9).every(p=>p.y!>support.y&&p.y!<support.y+.5)).toBe(true);
  }
  const count=writes.length;update.call(facade,{...w,piles:w.piles.map(p=>({...p}))},false);expect(writes).toHaveLength(count);
  const policy={...w,structures:w.structures.map(s=>({...s,shelf:{...s.shelf!,settings:{...s.shelf!.settings,priority:5}}}))};update.call(facade,policy,false);expect(writes).toHaveLength(count);
  const removed={...w,piles:w.piles.slice(1)};update.call(facade,removed,false);expect(writes).toHaveLength(count+1);expect(writes.at(-1)?.group).toBe(first.group);expect(writes.at(-1)?.parts).toHaveLength(18);
});

test('small animal corpses use the shared tiers in the original resident species rig, preserving biology and stable-frame buffers',()=>{
  const {w}=fixture('small-shelf');w.wildlife={profile:'temperate-hares-v1',rng:1,animals:[],eatenPlants:0,eatenNutrition:0,eatenItems:0};
  const body=(id:number)=>{const health=createMedicalRecord(0);health.body='hare';health.bloodLoss=BLOOD_UNIT;reconcileMedicalDeath(health);return {animalId:id,species:'hare' as const,sex:'female' as const,ageTicks:adultAgeTicks('hare'),health};};
  w.piles=[600,601,602].map(id=>({id,kind:'corpse',item:'hare-corpse',quantity:1,owner:{type:'ground',x:16,z:16},corpse:body(id),rot:{progress:0,atTick:w.tick}} as MaterialPile));
  const before=structuredClone(w),layer=new WildlifeLayer();
  try{
    layer.update(w,undefined,true);const mesh=layer.mesh.children.find(m=>m.name==='Wild hare — GPU rig')! as Mesh,geometry=mesh.geometry as InstancedBufferGeometry,from=geometry.getAttribute('aFrom'),supports=pileIdentitySurfaces(w);
    expect(geometry.instanceCount).toBe(3);
    for(const [index,p] of w.piles.entries()){const support=supports.get(p.id)!;expect(from.getX(index)).toBeCloseTo(16+support.x);expect(from.getY(index)).toBeCloseTo(support.y);expect(from.getZ(index)).toBeCloseTo(16+support.z);expect(geometry.getAttribute('aScale').getX(index)).toBe(1);}
    const version=Reflect.get(from,'data')?.version??Reflect.get(from,'version');layer.update(w,undefined);expect(Reflect.get(from,'data')?.version??Reflect.get(from,'version')).toBe(version);
    expect(mesh.geometry).toBe(geometry);expect(w).toEqual(before);
  }finally{layer.dispose();}
});

test.each([0,1,2,3] as const)('six real piles keep separate rotated positions and all quantities, orientation %i',orientation=>{
  const {w,s}=fixture('shelf',orientation),cells=footprintCells(s);
  w.piles=cells.flatMap((cell,index)=>[3,1,2].map(n=>pile(600+index*3+n,10*n,{type:'ground',...cell})));
  const before=structuredClone(w),supports=pileIdentitySurfaces(w);expect(supports.size).toBe(6);
  for(const [index,cell] of cells.entries())for(let level=0;level<3;level++){
    const real=w.piles.find(p=>p.id===601+index*3+level)!,surface=supports.get(real.id)!;
    expect(surface).toMatchObject({y:SHELF_LEVELS[level],scale:SHELF_ITEM_SCALE,shelfId:s.id,level,scaleHeight:true});
    const parts=pileParts([{x:cell.x,z:cell.z,item:real.item,kind:real.kind,quantity:real.quantity,supplied:false,pileId:real.id,surface}]);
    expect(parts.length).toBeGreaterThan(0);expect(Math.min(...parts.map(p=>p.y!))).toBeGreaterThan(surface.y);
    expect(Math.max(...parts.map(p=>Math.abs(p.x-cell.x)))).toBeLessThan(.5);
  }
  expect(new Set([...supports.values()].map(p=>`${p.x}:${p.y}:${p.z}`)).size).toBe(3);
  expect(pileIdentitySurfaces({...w,piles:[...w.piles].reverse()})).toEqual(supports);expect(w).toEqual(before);
  expect(pileIdentitySurfaces({...w,structures:[]})).toEqual(new Map());
});

test('pickup and merged delivery use the exact actual pile tier and physical shelf storage identity',()=>{
  const {w}=fixture('small-shelf'),pawn=w.pawns[0]!,owner={type:'ground' as const,x:16,z:16},hand=()=>({x:15,y:1,z:16,yaw:0});
  w.piles=[pile(600,10,owner),pile(601,20,owner),pile(602,30,owner)];
  const carried={...w,piles:[w.piles[0]!,w.piles[1]!,pile(602,30,{type:'pawn',pawnId:pawn.id})]},ledger=new CargoHandoffs();
  ledger.adopt(w,carried,1,true,hand);const original=pileIdentitySurfaces(w).get(602)!;
  expect(ledger.active.get(pawn.id)?.from).toEqual({x:16+original.x,y:original.y+.15,z:16+original.z,yaw:0});
  expect(ledger.active.get(pawn.id)?.groundScale).toBeCloseTo(SHELF_ITEM_SCALE*.8);
  ledger.clear();const previous=structuredClone(w);previous.pawns[0]!.haul={sourcePileId:603,carryPileId:604,quantity:5,phase:'deliver',destination:{type:'stockpile',stockpileId:501}};
  previous.piles=[...w.piles,pile(604,5,{type:'pawn',pawnId:pawn.id})];const current={...previous,piles:w.piles.map(p=>p.id===601?{...p,quantity:p.quantity+5}:p)};
  ledger.adopt(previous,current,2,true,hand);const support=pileIdentitySurfaces(current).get(601)!;
  expect(ledger.active.get(pawn.id)).toMatchObject({direction:'drop',targetPileId:601,to:{x:16+support.x,y:support.y+.15,z:16+support.z}});
  expect(ledger.hiddenQuantity(601)).toBe(5);expect(ledger.hiddenQuantity(600)).toBe(0);expect(ledger.hiddenQuantity(602)).toBe(0);
});

test.each(['lower pile leaves','shelf retires'] as const)('an active drop follows its confirmed support when %s',change=>{
  const {w}=fixture('small-shelf'),pawn=w.pawns[0]!,owner={type:'ground' as const,x:16,z:16},hand=()=>({x:15,y:1,z:16,yaw:0});
  w.piles=[pile(600,10,owner),pile(601,20,owner),pile(602,30,{type:'pawn',pawnId:pawn.id})];
  const dropped={...w,piles:w.piles.map(p=>p.id===602?{...p,owner}:p)},ledger=new CargoHandoffs();
  ledger.adopt(w,dropped,2,true,hand);const oldTarget={...ledger.active.get(pawn.id)!.to};
  const changed=change==='lower pile leaves'?{...dropped,piles:dropped.piles.filter(p=>p.id!==600)}:{...dropped,structures:[],piles:[dropped.piles[2]!]};
  const before=structuredClone(changed);ledger.adopt(dropped,changed,2.5,true,hand);
  const active=ledger.active.get(pawn.id)!,support=pileIdentitySurfaces(changed).get(602);
  expect(active.to).toEqual({x:16+(support?.x??0),y:(support?.y??0)+.15,z:16+(support?.z??0),yaw:0});
  expect(active.to.y).toBeLessThan(oldTarget.y);expect(active.groundScale).toBeCloseTo((support?.scale??1)*.8);
  expect(active.start).toBe(2);expect(active.end).toBe(3.5);expect(ledger.hiddenQuantity(602)).toBe(30);expect(changed).toEqual(before);
});
