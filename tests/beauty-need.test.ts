import { describe,expect,it } from 'vitest';
import { advanceBeautyNeeds,BEAUTY_NEED_INTERVAL,captureWorldBeauty } from '../src/sim/beauty-need.ts';
import { BEAUTY_BAND_LABEL } from '../src/sim/room-beauty.ts';
import { RoomTopologyCache } from '../src/sim/room-topology.ts';
import { createWorld } from '../src/sim/engine.ts';
import { roomCamp } from './scenarios/rooms.ts';
import { sowDaylily } from '../src/sim/flower-pot.ts';
import { furnitureBeauty } from '../src/sim/furniture-stats.ts';
import { RoomBeautyInspection } from '../src/ui/room-beauty-inspection';

describe('besoin de beauté V90',()=>{
  it('échantillonne ensemble et laisse le sommeil figer le besoin',()=>{
    const w=createWorld(90,32,32);w.tick=BEAUTY_NEED_INTERVAL;
    // Schema 373: outdoors, the pawn also sees the faces of the nearby rough
    // massif (Core BeautyUtility, -2 each): the target is now just under 40
    // (about 39.6 with the chair), so the level starts at 39, below it.
    const pawn=w.pawns[0]!;pawn.beauty=39;w.piles=[];
    const bare=captureWorldBeauty(w,new RoomTopologyCache().read(w)).perceived(pawn);
    w.structures.push({id:w.nextId++,kind:'dining-chair',x:pawn.x,z:pawn.z+1,orientation:0,footprint:'standard',material:'wood',quality:'normal'});
    expect(captureWorldBeauty(w,new RoomTopologyCache().read(w)).perceived(pawn)).toBeGreaterThan(bare);
    advanceBeautyNeeds(w,new RoomTopologyCache().read(w));expect(pawn.beauty).toBeGreaterThan(39);
    const value=pawn.beauty;pawn.state='sleeping';w.tick+=BEAUTY_NEED_INTERVAL;advanceBeautyNeeds(w,new RoomTopologyCache().read(w));expect(pawn.beauty).toBe(value);
  });
  it('partage les contributeurs physiques et les libellés avec l’inspection',()=>{
    const w=roomCamp(),topology=new RoomTopologyCache().read(w),pawn={x:13,z:13};
    const room=captureWorldBeauty(w,topology).room(pawn);
    expect(room).not.toBeNull();
    expect(BEAUTY_BAND_LABEL[room!.band]).toMatch(/hideuse|laide|neutre|jolie|belle/);
    w.piles.push({id:w.nextId++,item:'wood',kind:'wood',quantity:1,owner:{type:'ground',x:pawn.x,z:pawn.z}});
    expect(captureWorldBeauty(w,topology).room(pawn)!.total).toBe(room!.total-4);
  });
  it('additionne le pot matériel et sa fleur vivante, puis retire seulement la fleur morte',()=>{
    const w=roomCamp(),topology=new RoomTopologyCache().read(w),cell={x:13,z:13};
    const original=captureWorldBeauty(w,topology).room(cell)!.total;
    const pot={id:w.nextId++,kind:'flower-pot' as const,x:13,z:13,orientation:0 as const,footprint:'standard' as const,material:'marble-blocks' as const,quality:'good' as const,flower:{allowSow:true,plant:sowDaylily(w.tick)}};
    w.structures.push(pot);
    expect(captureWorldBeauty(w,topology).room(cell)!.total-original).toBe(furnitureBeauty(pot)+18);
    pot.flower.plant={...pot.flower.plant,hitPoints:0};
    expect(captureWorldBeauty(w,topology).room(cell)!.total-original).toBe(furnitureBeauty(pot));
  });
  it('réutilise la capture UI et invalide les seules entrées pertinentes sans score extérieur',()=>{
    const w=roomCamp(),rooms=new RoomTopologyCache(),topology=rooms.read(w),cell={x:13,z:13},ui=new RoomBeautyInspection();
    expect(ui.read(w,topology,{x:0,z:0})).toBeNull();
    expect(ui.read(w,topology,{x:11,z:10})).toBeNull();
    expect(ui.read(w,topology,{x:15,z:15})).toBeNull();expect(ui.rebuilds).toBe(0);
    const first=ui.read(w,topology,cell)!;
    for(let n=0;n<50;n++)expect(ui.read({...w,tick:w.tick+n,structures:structuredClone(w.structures)},topology,cell)).toBe(first);
    expect(ui.rebuilds).toBe(1);
    w.piles.push({id:w.nextId++,item:'wood',kind:'wood',quantity:1,owner:{type:'ground',...cell}});
    expect(ui.read(w,topology,cell)!.total).toBe(first.total-4);expect(ui.rebuilds).toBe(2);
    // SnapshotDecoder replaces the tile array for a floor delta, even paused.
    w.tiles=w.tiles.slice();w.tiles[cell.z*w.width+cell.x]={terrain:'grass',floor:'marble-tile'};
    expect(ui.read(w,topology,cell)!.total).toBe(first.total);
    const saved=structuredClone(w);expect(ui.read(saved,rooms.read(saved),cell)!.total).toBe(first.total);
    w.structures=w.structures.filter(s=>s.x!==11||s.z!==10);
    expect(ui.read(w,rooms.read(w),cell)).toBeNull();
  });
  it('possède exactement un libellé pour chacune des huit bandes',()=>{
    expect(Object.values(BEAUTY_BAND_LABEL)).toEqual(['hideuse','laide','neutre','jolie','belle','très belle','extrêmement belle','incroyablement belle']);
  });
});
