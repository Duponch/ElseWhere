import {afterEach,describe,expect,it,vi} from 'vitest';
import {NativeEnvironmentStatsReader,layoutNativeEnvironmentStats,type NativeEnvironmentStats} from '../src/ui3d/native-environment-stats.ts';
import {captureWorldBeauty} from '../src/sim/beauty-need.ts';
import {BeautyMapCache} from '../src/sim/room-beauty.ts';
import {RoomTopologyCache} from '../src/sim/room-topology.ts';
import {RoomQualityCapture} from '../src/sim/room-quality.ts';
import {WorkEnvironmentCache} from '../src/sim/work-environment.ts';
import type {Cell,World} from '../src/sim/types.ts';
import {roomCamp} from './scenarios/rooms.ts';
import {fixtureBuilding} from './scenarios/deconstruction.ts';

const origin={x:13,z:13},both={room:true,beauty:true},roomOnly={room:true,beauty:false},beautyOnly={room:false,beauty:true};
const read=(w:World,cell=origin,modes=both)=>new NativeEnvironmentStatsReader().read(w,cell,modes)!;
// Prepared local geometry and furniture, not a naturally played colony.
function fixture():World {const w=roomCamp();w.resources=[];return w;}
function fog(w:World,cell:Cell):void {
  w.site={...w.site,revision:3} as World['site'];w.exploration={revision:1};
  w.tiles[cell.z*w.width+cell.x]={...w.tiles[cell.z*w.width+cell.x]!,fogged:true};
}
afterEach(()=>vi.restoreAllMocks());

describe('native environment reader',()=>{
  it('returns the real five room scores, generic role, and no world writes',()=>{
    const w=fixture(),before=JSON.stringify(w),q=new RoomQualityCapture(w,new RoomTopologyCache().read(w)).room(origin)!;
    const stats=read(w),rows=stats.room!.stats;
    expect(stats.room!.title).toBe('Pièce générique');
    expect(rows.map(r=>r.id)).toEqual(['impressiveness','wealth','space','beauty','cleanliness']);
    expect(rows.map(r=>r.label)).toEqual(['Impression','Richesse','Espace','Beauté','Propreté']);
    expect(rows.map(r=>r.value)).toEqual([String(Math.round(q.impressiveness)),String(Math.round(q.wealth)),String(Math.round(q.space)),q.beauty.toFixed(2),q.cleanliness.toFixed(2)]);
    expect(rows.every(r=>!r.related)).toBe(true);
    expect(new Set(stats.room!.cells)).toEqual(q.cells);
    expect(stats.beauty!.average).toBe(captureWorldBeauty(w,new RoomTopologyCache().read(w)).perceived(origin));
    expect(JSON.stringify(w)).toBe(before);
  });

  it.each([
    ['bed','Chambre',5],['research-bench','Laboratoire',1],['electric-stove','Cuisine',1],['stonecutter','Atelier',0],['table','Salle à manger',5],['horseshoes','Salle de loisirs',5],
  ] as const)('uses the implemented %s role and Core related stats', (kind,title,count)=>{
    const w=fixture();fixtureBuilding(w,kind,12,12);
    const room=read(w).room!;expect(room.title).toBe(title);expect(room.stats.filter(r=>r.related)).toHaveLength(count);
    if(count===1)expect(room.stats.find(r=>r.related)!.id).toBe('cleanliness');
  });

  it('hides disabled modes, invalid/fogged origins, outside rooms and doorways',()=>{
    const w=fixture(),reader=new NativeEnvironmentStatsReader();
    const environment=vi.spyOn(WorkEnvironmentCache.prototype,'read');
    expect(reader.read(w,origin,{room:false,beauty:false})).toBeNull();expect(environment).not.toHaveBeenCalled();
    expect(reader.read(w,{x:-1,z:0},both)).toBeNull();expect(reader.read(w,{x:1.5,z:1},both)).toBeNull();
    expect(reader.read(w,{x:0,z:0},roomOnly)).toBeNull();expect(reader.read(w,{x:15,z:15},roomOnly)).toBeNull();
    expect(reader.read(w,{x:10,z:13},both)).toBeNull();
    fog(w,origin);expect(reader.read(w,origin,both)).toBeNull();
    expect(read(w,{x:12,z:13}).room).toBeUndefined();
  });

  it('retains captures and room geometry per accepted revision; no per-pointer full map scan',()=>{
    const w=fixture(),before=JSON.stringify(w),reader=new NativeEnvironmentStatsReader();
    const environments=vi.spyOn(WorkEnvironmentCache.prototype,'read'),maps=vi.spyOn(BeautyMapCache.prototype,'read'),quality=vi.spyOn(RoomQualityCapture.prototype,'room');
    const a=reader.read(w,origin,both,7)!;
    expect(reader.read(w,origin,both,7)).toBe(a);
    const b=reader.read(w,{x:12,z:13},both,7)!;
    expect(b.room).toBe(a.room);expect(environments).toHaveBeenCalledTimes(1);expect(maps).toHaveBeenCalledTimes(1);expect(quality).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(w)).toBe(before);
    w.tiles[origin.z*w.width+origin.x]={terrain:'grass',floor:'marble-tile'};
    expect(reader.read(w,origin,both,7)).toBe(a);
    const updated=reader.read(w,origin,both,8)!;expect(updated).not.toBe(a);expect(updated.beauty!.average).not.toBe(a.beauty!.average);
    reader.clear();expect(reader.read(w,origin,both,8)).not.toBe(updated);
  });

  it('without a revision observes in-place floor/furniture edits and breaches at the same tick',()=>{
    const w=fixture(),reader=new NativeEnvironmentStatsReader(),first=reader.read(w,origin,both)!;
    w.tiles[origin.z*w.width+origin.x]!.floor='marble-tile';fixtureBuilding(w,'bed',12,12);
    const updated=reader.read(w,origin,both)!;expect(updated.room!.title).toBe('Chambre');expect(updated.beauty!.average).not.toBe(first.beauty!.average);
    w.structures=w.structures.filter(s=>s.x!==11||s.z!==10);
    expect(reader.read(w,origin,roomOnly)).toBeNull();
  });

  it('bounds retained pointer samples to 96 entries and releases them on clear',()=>{
    const w=fixture(),reader=new NativeEnvironmentStatsReader(),first=reader.read(w,{x:0,z:0},beautyOnly,1)!;
    for(let i=1;i<96;i++)reader.read(w,{x:i%w.width,z:Math.floor(i/w.width)},beautyOnly,1);
    expect(reader.read(w,{x:0,z:0},beautyOnly,1)).toBe(first);
    reader.read(w,{x:0,z:3},beautyOnly,1);
    const fresh=reader.read(w,{x:0,z:0},beautyOnly,1)!;expect(fresh).not.toBe(first);
    reader.clear();expect(reader.read(w,{x:0,z:0},beautyOnly,1)).not.toBe(fresh);
  });

  it('labels exactly nonzero perceived cells, including walls/doors, and skips unknown cells',()=>{
    const w=fixture();w.tiles[13*w.width+12]!.floor='marble-tile';
    w.structures.find(s=>s.x===10&&s.z===13)!.material='marble-blocks';
    w.structures.find(s=>s.kind==='door')!.material='marble-blocks';
    fixtureBuilding(w,'flower-pot',17,13);
    for(const cell of [origin,{x:15,z:15},{x:0,z:0}]){
      const topology=new RoomTopologyCache().read(w),capture=captureWorldBeauty(w,topology),stats=read(w,cell,beautyOnly).beauty!;
      expect(stats.average).toBe(capture.perceived(cell));
      if(cell.x>0)expect(stats.cells.length).toBeGreaterThan(0);
      expect(new Set(stats.cells.map(c=>c.z*w.width+c.x)).size).toBe(stats.cells.length);
      for(const c of stats.cells){
        expect((c.x-cell.x)**2+(c.z-cell.z)**2).toBeLessThanOrEqual(8.9**2);
        const space=topology.at(c.x,c.z),index=c.z*w.width+c.x;
        expect(c.value).not.toBe(0);expect(c.value).toBe(space?.kind==='space'?capture.map.atIndex(index,space.touchesMapEdge):capture.map.thingsAtIndex(index));
      }
    }
    const full=read(w).beauty!;expect(full.cells.some(c=>c.x===10)).toBe(true);
    fog(w,{x:12,z:13});const known=read(w).beauty!;
    expect(known.cells.some(c=>c.x===12&&c.z===13)).toBe(false);
    expect(known.average).toBe(captureWorldBeauty(w,new RoomTopologyCache().read(w)).perceived(origin));
  });

  it('historical schemas retain their perception rules while keeping fog private',()=>{
    const w=fixture();w.schemaVersion=372 as World['schemaVersion'];
    const stats=read(w).beauty!,topology=new RoomTopologyCache().read(w);
    expect(stats.average).toBe(captureWorldBeauty(w,topology).perceived(origin));
    expect(stats.cells.every(c=>topology.at(c.x,c.z)?.kind==='space')).toBe(true);
    fog(w,{x:12,z:13});const known=read(w).beauty!;
    expect(known.cells.some(c=>c.x===12&&c.z===13)).toBe(false);
    expect(known.average).toBe(captureWorldBeauty(w,topology).perceived(origin,(_,c)=>!w.tiles[c.z*w.width+c.x]!.fogged));
  });

  it('uses the 8.9 radius at the map edge and omits zero labels',()=>{
    const w=fixture();w.tiles[2*w.width+8]!.floor='marble-tile';w.tiles[9]!.floor='marble-tile';
    const stats=read(w,{x:0,z:0},beautyOnly).beauty!;
    expect(stats.cells).toEqual([{x:8,z:2,value:captureWorldBeauty(w,new RoomTopologyCache().read(w)).map.at({x:8,z:2},true)}]);
    expect(stats.average).toBeGreaterThan(0);
  });

  it('suppresses room stats over 60 regions even under a complete roof',()=>{
    const w=fixture();w.width=w.height=120;w.tiles=Array.from({length:14400},(_,i)=>({terrain:i%120===0||i%120===119||i<120||i>=14280?'rock':'grass'}));
    w.structures=[];w.roofing={constructed:Array.from({length:14400},(_,i)=>i),build:[],remove:[],cursor:0};
    const topology=new RoomTopologyCache().read(w),space=topology.at(13,13)!;
    expect(space.kind).toBe('space');if(space.kind==='space')expect(topology.regionCount(space.id)).toBeGreaterThan(60);
    expect(read(w,origin,roomOnly)).toBeNull();expect(read(w).beauty).toBeDefined();
  });
});

describe('native environment geometry',()=>{
  const stats:NativeEnvironmentStats={cell:origin,room:{title:'Chambre',cells:[],stats:Array.from({length:5},(_,i)=>({id:String(i),label:'Stat',value:'1',stage:'État',related:true}))},beauty:{average:0,cells:[]}};
  it('matches Core 424 wide windows, 26 pointer offset, local rows and divider',()=>{
    const layout=layoutNativeEnvironmentStats(stats,{width:1400,height:900},{x:100,y:100});
    expect(layout).toMatchObject({x:126,y:126,width:424,height:233,pad:12,divider:42,beauty:{x:22,y:12,width:390,height:23},title:{x:22,y:50,width:390,height:30},note:{x:12,y:205,width:400,height:23}});
    expect(layout.rows[0]).toEqual({y:80,height:23,gutter:{x:12,width:10},label:{x:22,width:110},value:{x:167,width:50},stage:{x:252,width:160}});
    expect(layout.rows.map(r=>r.y)).toEqual([80,105,130,155,180]);
    const room=layoutNativeEnvironmentStats({...stats,beauty:undefined},{width:1400,height:900},{x:100,y:100});
    expect(room.height).toBe(195);expect(room.title!.y).toBe(12);expect(room.divider).toBeUndefined();expect(room.rows[0]!.y).toBe(42);
    const beauty=layoutNativeEnvironmentStats({...stats,room:undefined},{width:1400,height:900},{x:100,y:100});
    expect(beauty.height).toBe(49);expect(beauty.rows).toEqual([]);expect(beauty.note).toBeUndefined();
  });

  it('flips beside the pointer and clamps/scales into small screens',()=>{
    expect(layoutNativeEnvironmentStats(stats,{width:1000,height:700},{x:950,y:650})).toMatchObject({x:500,y:391,width:424,height:233});
    const layout=layoutNativeEnvironmentStats(stats,{width:260,height:150},{x:250,y:140});
    expect(layout).toMatchObject({x:0,y:0,width:260,height:150});
    for(const rect of [layout.beauty!,layout.title!,layout.note!]){
      expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(260);expect(rect.y+rect.height).toBeLessThanOrEqual(150);
    }
    for(const row of layout.rows){expect(row.stage.x+row.stage.width).toBeLessThanOrEqual(260);expect(row.y+row.height).toBeLessThanOrEqual(150);}
  });
});
