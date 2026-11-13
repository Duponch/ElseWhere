import { describe,it,expect } from 'vitest';
import {FURNITURE_DEFINITIONS,roundCoreBeauty311} from '../src/sim/furniture-stats.ts';
import { roomCamp } from './scenarios/rooms.ts';
import { RoomTopologyCache } from '../src/sim/room-topology.ts';
import { RoomQualityCapture } from '../src/sim/room-quality.ts';
import { captureWorldBeauty } from '../src/sim/beauty-need.ts';
import { captureCleanliness } from '../src/sim/filth-room.ts';
import { RoomBeautyInspection } from '../src/ui/room-beauty-inspection.ts';
import { addFilth } from '../src/sim/filth.ts';
import { daylilyBeauty,sowDaylily } from '../src/sim/flower-pot.ts';

const cell={x:13,z:13};
describe('qualité physique des pièces V103',()=>{
  it('rejette extérieur et seuil, conserve les oracles beauté/propreté et ne modifie jamais la colonie',()=>{
    const w=roomCamp();w.resources=[];
    const topology=new RoomTopologyCache().read(w),before=JSON.stringify(w),capture=new RoomQualityCapture(w,topology);
    expect(capture.room({x:0,z:0})).toBeNull();expect(capture.room({x:15,z:15})).toBeNull();
    const room=capture.room(cell)!;expect(room.cells.size).toBe(36);expect(capture.room({x:12,z:14})).toBe(room);
    expect(room.beauty).toBe(captureWorldBeauty(w,topology).room(cell)!.beauty);
    expect(room.cleanliness).toBe(captureCleanliness(w).room(cell)!.cleanliness);
    expect(JSON.stringify(w)).toBe(before);
  });
  it('les piles changent la beauté sans fabriquer de richesse de pièce, les sols et meubles ont leurs effets propres',()=>{
    const w=roomCamp();w.resources=[];const topology=new RoomTopologyCache().read(w),read=()=>new RoomQualityCapture(w,topology).room(cell)!;
    const empty=read();
    w.piles.push({id:w.nextId++,item:'silver',kind:'silver',quantity:500,owner:{type:'ground',...cell}});
    const stock=read();expect(stock.wealth).toBe(empty.wealth);expect(stock.total).toBe(empty.total-4);
    w.structures.push({id:w.nextId++,kind:'table',x:12,z:13,orientation:0,footprint:'standard',material:'wood',quality:'normal'});
    const table=read();expect(table.wealth).toBeGreaterThan(stock.wealth);expect(table.space).toBeCloseTo(stock.space-1.8,8);
    w.tiles=w.tiles.map((t,i)=>empty.cells.has(i)?{...t,floor:'marble-tile' as const}:t);
    const floor=read();expect(floor.wealth).toBeGreaterThan(table.wealth);expect(floor.beauty).toBeGreaterThan(table.beauty);expect(floor.cleanliness).toBeGreaterThan(table.cleanliness);
    expect(floor.impressiveness).toBeGreaterThan(table.impressiveness);
  });
  it('fleur, saleté et dégâts sont capturés même à tick constant, puis la brèche retire toute statistique de pièce',()=>{
    const w=roomCamp();w.resources=[];const cache=new RoomTopologyCache(),ui=new RoomBeautyInspection(),read=()=>ui.read(w,cache.read(w),cell)!;
    const first=read();w.structures.push({id:w.nextId++,kind:'flower-pot',...cell,orientation:0,footprint:'standard',material:'marble-blocks',quality:'good',flower:{allowSow:true,plant:sowDaylily(w.tick)}});
    // Schema 311 Core Beauty: marble factor 1.35, quality after the stuff offset, then rounding.
    const flower=read();expect(flower.total-first.total).toBe(roundCoreBeauty311((FURNITURE_DEFINITIONS['flower-pot'].beauty*1.35+1)*2)+daylilyBeauty(sowDaylily(w.tick)));expect(flower.wealth).toBeGreaterThan(first.wealth);
    addFilth(w,cell,'blood');const dirty=read();expect(dirty.cleanliness).toBeLessThan(flower.cleanliness);expect(dirty.impressiveness).toBeLessThan(flower.impressiveness);
    const pot=w.structures.at(-1)!;pot.damage=70;expect(read().wealth).toBeLessThan(dirty.wealth);
    const count=ui.rebuilds;w.tick++;
    expect(read()).toBe(read());expect(ui.rebuilds).toBe(count);
    const reference=captureWorldBeauty(w,cache.read(w)).room(cell)!;expect(read().total).toBe(reference.total);
    expect(read().cleanliness).toBe(captureCleanliness(w).room(cell)!.cleanliness);
    w.structures=w.structures.filter(s=>!(s.x===11&&s.z===10));expect(read()).toBeNull();
  });
});
