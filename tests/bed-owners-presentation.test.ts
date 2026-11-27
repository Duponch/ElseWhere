import {expect,test,vi} from 'vitest';
import {OrthographicCamera,Group} from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import {BED_SHEET_COLORS,bedSheetColor} from '../src/render/bed-sheet-color';
import {buildFurniture} from '../src/render/FurnitureLayer';
import type {BoxBatches} from '../src/render/BoxBatches';
import type {Placement} from '../src/render/primitives';
import type {Structure,World} from '../src/sim/types';
import {bedOwnerLabelEntries,captureBedOwners} from '../src/render/bed-owner-labels';
import {bedSlotBodyCenter} from '../src/sim/bed-slots';
import {MapLabelsOverlay} from '../src/render/MapLabelsOverlay';
import {reorganizationCamp256} from './helpers/group-reorganization-v256';
import {SnapshotDecoder,SnapshotEncoder} from '../src/bridge/snapshots';
import {nativeSpecialRows} from '../src/ui3d/native-special-inspection';
import type {NativeUiState,NativeUiActions} from '../src/ui3d/native-contract';

function fixture(){const world=createWorld(427,32);world.structures=[];world.piles=[];world.packed=[];world.jobs=[];world.resources=[];return world;}
function bed(world:World,kind:Structure['kind']='bed',orientation:Structure['orientation']=0):Structure {
  const value:Structure={id:world.nextId++,kind,x:12,z:12,orientation,footprint:'standard',material:kind.includes('bedroll')?'cloth':'wood'};world.structures.push(value);return value;
}

test('all bed models use the four exact Core 1.6 sheet RGBs on their existing authored parts, and roles do not add geometry',()=>{
  expect(BED_SHEET_COLORS).toEqual({normal:0xa1d5b4,medical:0x639fe2,prisoner:0xffb721,medicalPrisoner:0xa76027});
  for(const kind of ['bed','hospital-bed','double-bed','bedroll','double-bedroll','sleeping-spot','double-sleeping-spot','animal-sleeping-spot']as const){
    const world=fixture(),value=bed(world,kind);let count:number|undefined;
    for(const[medical,prisoner,color]of [[false,false,0xa1d5b4],[true,false,0x639fe2],[false,true,0xffb721],[true,true,0xa76027]]as const){
      if(medical)value.medical=true;else delete value.medical;if(prisoner)value.prisoner=true;else delete value.prisoner;let parts:Placement[]=[];
      const batches={set(_group:Group,key:string,items:Placement[]){if(key==='furniture')parts=items;}};
      buildFurniture(world,new Group(),false,batches as unknown as BoxBatches);
      expect(bedSheetColor(value)).toBe(color);expect(parts.some(part=>part.targetId===value.id&&part.color===color),kind).toBe(true);
      // A medical cross on an existing floor marker remains its own model feature.
      if(!kind.includes('spot')){count??=parts.length;expect(parts.length,kind).toBe(count);}
    }
  }
});

test.each([0,1,2,3]as const)('owner labels follow durable double slots at orientation %i, omit medical and already lying owners, and label unowned beds',orientation=>{
  const world=fixture(),value=bed(world,'double-bed',orientation),[a,b]=world.pawns;
  a!.bedId=b!.bedId=value.id;a!.bedSlot=0;b!.bedSlot=1;world.pawns=[a!,b!];
  const before=JSON.stringify(world),entries=bedOwnerLabelEntries(world);
  expect(entries.map(entry=>entry.label)).toEqual([a!.name,b!.name]);
  for(const slot of [0,1]as const){const center=bedSlotBodyCenter(value,slot)!;expect(entries[slot]).toMatchObject({...center,offsetY:slot*14});}
  expect(JSON.stringify(world)).toBe(before);
  a!.state='sleeping';a!.need={kind:'sleep',phase:'sleep',bedId:value.id,target:{x:value.x,z:value.z}};
  expect(bedOwnerLabelEntries(world).map(entry=>entry.label)).toEqual([b!.name]);
  value.medical=true;expect(bedOwnerLabelEntries(world)).toEqual([]);delete value.medical;
  a!.bedId=b!.bedId=null;expect(bedOwnerLabelEntries(world).map(entry=>entry.label)).toEqual(['Non attribué']);
});

test('a real away original retains its owner name on the actual map and on the joined MAIN publication',()=>{
  const f=reorganizationCamp256(),value=f.map.structures.find(s=>s.kind==='bed')!,away=f.members[0]!;
  away.mapBed={revision:1,mapId:f.record.originMapId,bedId:value.id};away.bedId=null;
  expect(captureBedOwners(f.map).get(value.id)?.some(owner=>owner.pawn.id===away.id)).toBe(true);
  const packet=structuredClone(new SnapshotEncoder().encode(f.w,0,0)),adopted=new SnapshotDecoder().adopt(packet);
  if(adopted.status!=='applied')throw Error(adopted.status==='resync'?adopted.reason:'Initial publication was stale');
  expect(captureBedOwners(adopted.world).get(value.id)?.some(owner=>owner.pawn.id===away.id)).toBe(true);
});

test('bed-owner HUD toggle reuses the inventory glyph draw and atlas, while camera frames do not recapture owners',()=>{
  const world=fixture(),value=bed(world),pawn=world.pawns[0]!;pawn.bedId=value.id;
  world.piles=[{id:world.nextId++,item:'wood',kind:'wood',quantity:12,owner:{type:'ground',x:8,z:8}}];
  const overlay=new MapLabelsOverlay(),camera=new OrthographicCamera(-10,10,10,-10,.1,100);camera.position.set(12,16,16);camera.lookAt(12,0,12);camera.updateMatrixWorld();
  try{
    overlay.draw(world,camera,120,800,600);const material=overlay.mesh.material,geometry=overlay.mesh.geometry,version=Reflect.get(geometry.getAttribute('labelAnchor'),'version'),count=geometry.instanceCount;
    const getter=vi.spyOn(world.structures,Symbol.iterator);overlay.draw(world,camera,120,800,600);expect(getter).not.toHaveBeenCalled();getter.mockRestore();
    expect(Reflect.get(geometry.getAttribute('labelAnchor'),'version')).toBe(version);
    overlay.setBedOwnerLabelsVisible(false);overlay.draw(world,camera,120,800,600);expect(overlay.mesh.geometry.instanceCount).toBe(2);
    expect(overlay['chunks'].flatMap(chunk=>chunk.entries).map(entry=>entry.label)).toEqual(['12']);
    overlay.setBedOwnerLabelsVisible(true);overlay.draw(world,camera,120,800,600);expect(overlay.mesh.geometry.instanceCount).toBe(count);expect(overlay.mesh.material).toBe(material);expect(overlay.mesh.geometry).toBe(geometry);
  }finally{overlay.dispose();}
});

test('native inspection reports a prisoner owner without offering civil assignment and separates a medical patient from ownership',()=>{
  const world=fixture(),value=bed(world),pawn=world.pawns[0]!;pawn.bedId=value.id;value.prisoner=true;
  const state:NativeUiState={world,epoch:1,panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[{kind:'structure',id:value.id}],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
  const actions={readState:()=>state,command:vi.fn(),showPage:vi.fn(),refresh:vi.fn()}as unknown as NativeUiActions;
  let rows=nativeSpecialRows(state,actions);expect(rows.find(row=>row.id==='special-bed-prison-owner')?.value).toBe(pawn.name);
  expect(rows.some(row=>row.id==='special-bed-slot-0')).toBe(false);
  delete value.prisoner;value.medical=true;pawn.bedId=null;pawn.state='resting';pawn.need={kind:'sleep',phase:'sleep',bedId:value.id,target:{x:value.x,z:value.z}};
  rows=nativeSpecialRows(state,actions);expect(rows.find(row=>row.id==='special-bed-medical-owner')?.value).toBe('Aucun — lit médical');expect(rows.find(row=>row.id==='special-bed-patient')?.value).toBe(pawn.name);
  expect(actions.command).not.toHaveBeenCalled();
});
