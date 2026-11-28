import {describe,expect,it} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {resolve} from 'node:path';
import {decodeBase64,inflateRaw,readUint16Column} from '../src/import/rimworld/bytes.ts';
import {parseXml,text,at} from '../src/import/rimworld/xml.ts';
import {rawShortHash,shortHashTable} from '../src/import/rimworld/short-hash.ts';
import {readRwsSave,saveCompatibility,decodeDefGrid} from '../src/import/rimworld/rws-save.ts';
import {analyzeRwsSave} from '../src/import/rimworld/analyze.ts';
import {convertRwsSave} from '../src/import/rimworld/convert.ts';
import {frenchReport} from '../src/import/rimworld/report-fr.ts';
import {closestBackgrounds,coreBackstoryEffect,HUMAN_PART_MAP} from '../src/import/rimworld/map-pawns.ts';
import {CORE_BACKSTORIES_370,isCoreBackstoryId370} from '../src/sim/core-backstories-370.ts';
import {elsewhereTargetLabel} from '../src/import/rimworld/labels-fr.ts';
import {TERRAIN_MAP,ROCK_MAP,ROOF_MAP} from '../src/import/rimworld/map-terrain.ts';
import {RwsLocalCoordinates,coreOccupiedCells,placeRwsFootprint,orientGeneratedImportBase} from '../src/import/rimworld/local-coordinates.ts';
import {packRiverWater256,unpackRiverWater256} from '../src/sim/river-water-owner-256.ts';
import {wallLampWallCell363} from '../src/sim/furniture-c-363.ts';
import type {World} from '../src/sim/types.ts';
import {OrthographicCamera,Raycaster,Vector2,Vector3,Plane} from 'three/webgpu';
import {CameraRig} from '../src/render/CameraRig.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {footprintCells} from '../src/sim/definitions.ts';
import {researchCost} from '../src/sim/research.ts';

const fixture=readFileSync(resolve('tests/fixtures/rws/petite-colonie.rws'),'utf8');

describe('RimWorld save reader',()=>{
 it('inflates raw DEFLATE (stored, fixed and dynamic blocks) and decodes base64 like the game writes it',()=>{
  const samples=[new Uint8Array(0),Uint8Array.from({length:70000},(_,i)=>(i*7919)%251),new TextEncoder().encode('abcabcabcabc'.repeat(400))];
  for(const sample of samples)for(const level of [0,1,9]){
   const packed=deflateRawSync(sample,{level}),wrapped=Buffer.from(packed).toString('base64').replace(/(.{100})/g,'$1\n');
   expect(Buffer.from(inflateRaw(decodeBase64(wrapped))).equals(Buffer.from(sample))).toBe(true);
  }
  expect([...readUint16Column(Uint8Array.from([1,0,0,1,255,255]))]).toEqual([1,256,65535]);
 });
 it('computes the game’s definition short hashes (values checked on a real 1.6 save)',()=>{
  expect(rawShortHash('Ocean')).toBe(27374);expect(rawShortHash('TemperateForest')).toBe(54643);
  expect(rawShortHash('River')).toBe(44073);expect(rawShortHash('DirtRoad')).toBe(42996);expect(rawShortHash('CarpetRed')).toBe(4526);
  // A collision is resolved by incrementing in name order.
  const table=shortHashTable(['b','a']);expect([...table.values()].sort()).toEqual(['a','b']);
 });
 it('parses entities, self-closing tags and the save structure',()=>{
  const doc=parseXml('<?xml version="1.0"?><a x="1 &amp; 2"><b IsNull="True" /><c>L&apos;Esclave &#233;</c></a>');
  expect(doc.attrs?.x).toBe('1 & 2');expect(text(doc,'c')).toBe("L'Esclave é");expect(at(doc,'b')?.attrs?.IsNull).toBe('True');
  const save=readRwsSave(fixture),map=save.maps[0]!;
  expect(saveCompatibility(save)).toEqual({ok:true,reasons:[]});
  expect([map.width,map.height]).toEqual([20,20]);expect(save.playerFaction).toBe('Faction_1');
  const top=decodeDefGrid(map.grids.terrainTop,Object.keys(TERRAIN_MAP)),under=decodeDefGrid(map.grids.terrainUnder,Object.keys(TERRAIN_MAP));
  expect(top.unknown.size).toBe(0);expect(top.values[5*20+5]).toBe('WoodPlankFloor');expect(under.values[5*20+5]).toBe('Soil');expect(top.values[12*20+3]).toBe('WaterShallow');
  const rocks=decodeDefGrid(map.grids.compressedThings,Object.keys(ROCK_MAP));expect(rocks.values[18*20+18]).toBe('MineableSteel');expect(rocks.values[17*20+16]).toBe('Granite');
  expect(decodeDefGrid(map.grids.roofs,Object.keys(ROOF_MAP)).values[4*20+4]).toBe('RoofConstructed');
  expect(map.grids.fog![19*20+19]).toBe(1);expect(map.grids.fog![0]).toBe(0);
 });
 it('refuses a save with an expansion or a mod, with a French reason',()=>{
  const dlc=fixture.replace('<li>ludeon.rimworld</li></modIds>','<li>ludeon.rimworld</li><li>ludeon.rimworld.biotech</li></modIds>').replace('<li>Core</li></modNames>','<li>Core</li><li>Biotech</li></modNames>');
  const save=readRwsSave(dlc),result=saveCompatibility(save);
  expect(result.ok).toBe(false);expect(result.reasons.join(' ')).toContain('Biotech');
  expect(()=>convertRwsSave(save,{planet:false})).toThrow(/Biotech/);
  expect(()=>readRwsSave('<notasave/>')).toThrow(/sauvegarde RimWorld/);
 });
});

describe('Mapping tables',()=>{
 it('keeps Core’s shuffled backstories under their own defName',()=>{
  expect(coreBackstoryEffect('AccursedChild88')).toMatchObject({slot:'childhood',gains:{construction:-1,intellectual:5,medicine:4}});
  expect(closestBackgrounds('CaveChild30','Hunter74',true)).toEqual({childhood:'CaveChild30',adulthood:'Hunter74',childhoodDistance:0,adulthoodDistance:0});
  // Below twenty only the childhood is kept.
  expect(closestBackgrounds('CaveChild30','Hunter74',false)).toEqual({childhood:'CaveChild30',childhoodDistance:0});
 });
 it('maps a named character’s backstory to the closest shuffled one of its slot',()=>{
  const solid=closestBackgrounds('AccursedChild88','StarKnight5',true);
  expect(isCoreBackstoryId370(solid.childhood)&&CORE_BACKSTORIES_370[solid.childhood].slot).toBe('childhood');
  expect(isCoreBackstoryId370(solid.adulthood)&&CORE_BACKSTORIES_370[solid.adulthood].slot).toBe('adulthood');
  expect(solid.childhoodDistance).toBeGreaterThan(0);expect(solid.adulthoodDistance).toBeGreaterThan(0);
  // A chosen adulthood never requires a tag the (pacifist) childhood disables.
  const pacifist=closestBackgrounds('ConventChild16','StarKnight5',true);
  expect(pacifist.childhood).toBe('ConventChild16');
  expect(CORE_BACKSTORIES_370[pacifist.adulthood as 'Hunter74'].requires).not.toContain('violent');
 });
 it('names Elsewhere targets in French in the report, keeping a detail',()=>{
  expect(elsewhereTargetLabel('buildings','wall')).toBe('Mur');
  expect(elsewhereTargetLabel('items','simple-meal')).not.toBe('simple-meal');
  expect(elsewhereTargetLabel('terrain','soil-natural')).toBe('Terre fertile');
  expect(elsewhereTargetLabel('traits','jogger')).not.toBe('jogger');
  expect(elsewhereTargetLabel('animals','muffalo')).toBe('Mufalo');
  expect(elsewhereTargetLabel('terrain','rough-stone (marble)').endsWith(' (marble)')).toBe(true);
  // An unknown id, or a family without a name table, is shown as it is.
  expect(elsewhereTargetLabel('items','not-an-item')).toBe('not-an-item');
  expect(elsewhereTargetLabel('zones','zone de stockage')).toBe('zone de stockage');
 });
 it('numbers human body parts in the game’s save order',()=>{
  expect(HUMAN_PART_MAP[0]).toBe('torso');expect(HUMAN_PART_MAP[29]).toBe('left-pinky');expect(HUMAN_PART_MAP[46]).toBe('left-leg');expect(HUMAN_PART_MAP[58]).toBe('right-foot');
 });
});

describe('Analysis and report',()=>{
 it('reports each family with exact, adapted and dropped definitions',()=>{
  const analysis=analyzeRwsSave(readRwsSave(fixture)),n=analysis.notes;
  expect(analysis.compatible).toBe(true);
  expect(analysis.summary).toMatchObject({mapSize:'20×20',colonists:2,days:6,scenario:'Petite colonie'});
  const rows=(family:Parameters<typeof n.tallies.get>[0])=>[...(n.tallies.get(family)?.values()??[])];
  expect(rows('animals').find(r=>r.def.startsWith('Thrumbo'))?.status).toBe('dropped');
  expect(rows('animals').find(r=>r.def==='Husky (colonie)')?.status).toBe('exact');
  expect(rows('buildings').find(r=>r.def==='Wall')).toMatchObject({status:'exact',to:'wall',count:23});
  expect(rows('traits').find(r=>r.def==='Pyromaniac')).toMatchObject({status:'exact',to:'pyromaniac'});
  expect(rows('traits').find(r=>r.def==='SpeedOffset (2)')).toMatchObject({status:'exact',to:'jogger'});
  expect(rows('research').find(r=>r.def==='Electricity')).toBeUndefined();
  const report=frenchReport({title:'Essai',analysis});
  expect(report).toContain('## Bilan par famille (analyse)');expect(report).toContain('Thrumbo : espèce absente');expect(report).toContain('Compatibilité : importable');
 });
});

describe('Conversion of the small colony',()=>{
 const conversion=convertRwsSave(readRwsSave(fixture),{planet:false}),w=conversion.world;
 it('builds a valid world at the current schema that reloads exactly',()=>{
  expect(validateWorld(w)).toEqual([]);
  const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
  expect([w.width,w.height]).toEqual([20,20]);expect(conversion.planetMode).toBe('none');
 });
 it('keeps terrain, rock, ore, roofs, walls, door, bed and furniture with their stuff and quality',()=>{
  // Core's positive Z points north. The same features must be on the
  // north/upper side of the ordinary Three.js view, not a mirror image.
  expect(w.tiles[14*20+5]).toMatchObject({terrain:'soil-natural',floor:'wood-planks'});
  expect(w.tiles[2*20+16]).toMatchObject({terrain:'rock',stone:'granite'});expect(w.tiles[1*20+18]).toMatchObject({terrain:'rock',ore:'steel'});
  expect(w.tiles[7*20+3]?.terrain).toBe('water-shallow');expect(w.tiles[19*20]?.terrain).toBe('gravel');
  expect(w.roofing?.constructed).toHaveLength(25);
  expect(w.structures.filter(s=>s.kind==='wall')).toHaveLength(23);expect(w.structures.every(s=>s.kind!=='wall'||s.material==='granite-blocks')).toBe(true);
  const door=w.structures.find(s=>s.kind==='door')!;expect(door).toMatchObject({x:5,z:17,material:'wood',orientation:0});expect(door.door).toBeDefined();
  const bed=w.structures.find(s=>s.kind==='bed')!;expect(bed).toMatchObject({quality:'good',material:'wood'});
  expect(footprintCells(bed).map(c=>`${c.x},${c.z}`).sort()).toEqual(['4,14','4,15']);
  expect(w.structures.find(s=>s.kind==='table')).toMatchObject({quality:'normal'});
 });
 it('imports colonists with identity, traits, Core backstories, skills, priorities, health and gear',()=>{
  expect(w.pawns).toHaveLength(2);
  const alma=w.pawns.find(p=>p.name.startsWith('Alma'))!,bruno=w.pawns.find(p=>p.name.startsWith('Bruno'))!;
  expect(alma.name).toBe("Alma 'Fourmi' Rivière");expect(bruno.name).toBe('Bruno Sable');
  expect(alma.appearance).toMatchObject({sex:'female',bodyType:'Thin',headType:'Female_AverageWide',hair:'Flowy'});
  expect(alma.age?.biologicalTicks).toBe(10_800_000);
  expect(alma.traits).toEqual(['kind','jogger','pyromaniac']);expect(bruno.traits).toEqual(['brawler','nervous']);
  expect(alma.background).toEqual({childhood:'MedicalAssistant12',adulthood:'Gardener99'});
  expect(alma.skills.plants).toMatchObject({level:12,passion:2});expect(alma.skills.medicine).toMatchObject({level:8,passion:1,xp:120500});
  // MedicalAssistant12 disables Firefighting in Core: the save's priority 1 cannot be kept.
  expect(alma.priorities).toMatchObject({firefight:0,patient:1,doctor:2,bedrest:3,basic:3,grow:1,haul:3,clean:3});
  expect(alma.bedId).toBe(w.structures.find(s=>s.kind==='bed')!.id);
  expect(alma.health?.injuries).toEqual([expect.objectContaining({part:'torso',kind:'cut',severity:3000,scar:{threshold:3000,pain:1}})]);
  expect(alma.health?.missing).toEqual([expect.objectContaining({part:'left-pinky'})]);
  expect(bruno.health?.artificialParts).toEqual([expect.objectContaining({part:'left-leg',kind:'peg-leg'})]);
  const gear=(id:number,type:string)=>w.piles.filter(p=>p.owner.type===type&&'pawnId' in p.owner&&p.owner.pawnId===id).map(p=>p.item);
  expect(gear(alma.id,'apparel')).toEqual(['cloth-shirt']);expect(gear(alma.id,'equipment')).toEqual(['revolver']);expect(gear(alma.id,'inventory')).toEqual(['simple-meal']);
  expect(w.piles.find(p=>p.item==='revolver')?.weapon).toMatchObject({quality:'masterwork',hitPoints:80});
  expect(gear(bruno.id,'apparel')).toEqual(['muffalo-wool-pants']);expect(gear(bruno.id,'equipment')).toEqual(['steel-longsword']);
 });
 it('imports the colony animal with its name, master and bond, and the wild animal',()=>{
  const animals=w.wildlife?.animals??[],husky=animals.find(a=>a.species==='husky')!,bruno=w.pawns.find(p=>p.name.startsWith('Bruno'))!;
  expect(husky.domestic).toBeDefined();expect(husky.startingPet).toMatchObject({name:'Neige',masterId:bruno.id,bondedPawnId:bruno.id});
  expect(animals.find(a=>a.species==='hare')?.domestic).toBeUndefined();expect(animals).toHaveLength(2);
 });
 it('keeps items, stockpile, growing zone, home area and research',()=>{
  const ground=(item:string)=>w.piles.filter(p=>p.item===item&&p.owner.type==='ground').reduce((s,p)=>s+p.quantity,0);
  expect(ground('steel')).toBe(50);expect(ground('wood')).toBe(30);expect(ground('simple-meal')).toBe(5);
  expect(w.piles.find(p=>p.item==='simple-meal'&&p.owner.type==='ground')?.forbidden).toBe(true);
  expect(w.piles.find(p=>p.item==='plainleather-parka')?.apparel).toMatchObject({quality:'excellent',hitPoints:90});
  expect(w.stockpiles).toHaveLength(6);expect(new Set(w.stockpiles.map(s=>s.zoneId)).size).toBe(1);expect(w.stockpiles[0]).toMatchObject({priority:4,filters:{steel:true,wood:true,food:true}});
  expect(w.growingZones).toEqual([expect.objectContaining({plant:'potato',allowSow:true})]);
  expect(w.resources.filter(r=>r.kind==='potato').map(r=>r.growth)).toEqual([.4,.4,.4]);
  expect(w.home).toHaveLength(100);
  expect(w.research?.complexFurniture).toMatchObject({points:researchCost('complex-furniture')});
  expect(w.research?.stonecutting?.completedAt).toBeUndefined();expect(w.research?.project).toBe('stonecutting');
 });
 it('uses the same reflected coordinates for every spatial owner in the actual import',()=>{
  const coords=new RwsLocalCoordinates(20,20),map=readRwsSave(fixture).maps[0]!;
  const expectedRoof=decodeDefGrid(map.grids.roofs,Object.keys(ROOF_MAP)).values.flatMap((r,index)=>r==='RoofConstructed'?[coords.index(index)]:[]).sort((a,b)=>a-b);
  expect(w.roofing?.constructed).toEqual(expectedRoof);
  expect(w.pawns.find(p=>p.name.startsWith('Alma'))).toMatchObject({x:4,z:15});
  expect(w.pawns.find(p=>p.name.startsWith('Bruno'))).toMatchObject({x:6,z:14});
  expect(w.wildlife?.animals.find(a=>a.species==='husky')).toMatchObject({x:10,z:13});
  expect(w.wildlife?.animals.find(a=>a.species==='hare')).toMatchObject({x:15,z:15});
  expect(w.piles.find(p=>p.item==='steel')?.owner).toEqual({type:'ground',x:10,z:9});
  expect(w.piles.find(p=>p.item==='wood')?.owner).toEqual({type:'ground',x:11,z:9});
  expect(w.piles.find(p=>p.item==='plainleather-parka')?.owner).toEqual({type:'ground',x:12,z:9});
  expect(w.resources.filter(p=>p.kind==='potato').map(p=>`${p.x},${p.z}`).sort()).toEqual(['13,16','13,17','14,17']);
  expect(w.stockpiles.map(p=>`${p.x},${p.z}`).sort()).toEqual(['10,8','10,9','11,8','11,9','12,8','12,9']);
  expect(w.growingZones[0]?.cells).toEqual([16*20+13,16*20+14,17*20+13,17*20+14]);
  const home=Array.from({length:400},(_,i)=>i).filter(i=>i%20>=1&&i%20<=10&&Math.floor(i/20)>=9&&Math.floor(i/20)<=18);
  expect(w.home).toEqual(home);
 });
 it('names every loss in the French report',()=>{
  const report=frenchReport({title:'Petite colonie',conversion});
  for(const lost of ['Télescope : absent','Ceinture bouclier','Thrumbo','Lucifèrium','Laine de mouton','sans planète'])expect(report).toContain(lost);
  expect(report).not.toContain('Pyromane : trait absent');
 });
 it('runs a few hundred ticks and stays valid',()=>{
  const copy=deserializeWorld(serializeWorld(w));
  for(let i=0;i<240;i++)stepWorld(copy);
  expect(validateWorld(copy)).toEqual([]);expect(copy.pawns.filter(p=>p.state!=='dead')).toHaveLength(2);
 });
});

describe('RimWorld-to-Elsewhere local orientation',()=>{
 it('is a bijection for non-square maps, keeps east and reflects every north-facing cell and direction once',()=>{
  const c=new RwsLocalCoordinates(17,11),indices=Array.from({length:187},(_,i)=>i);
  expect(new Set(indices.map(i=>c.index(i))).size).toBe(187);
  expect(indices.every(i=>c.index(c.index(i))===i)).toBe(true);
  expect(c.cell({x:2,z:0})).toEqual({x:2,z:10});expect(c.cell({x:2,z:10})).toEqual({x:2,z:0});
  expect(c.index(2)).toBe(172);expect(c.index(172)).toBe(2);
  expect([0,1,2,3].map(r=>c.rotation(r))).toEqual([2,1,0,3]);
 });
 it('preserves occupied rectangles for all four facings, not just the anchor, and fixed building orientations',()=>{
  const c=new RwsLocalCoordinates(50,40),pos={x:20,z:18};
  const key=(x:{x:number;z:number})=>`${x.x},${x.z}`;
  for(const [kind,size] of [['bed',[1,2]],['table-long',[2,4]],['shelf',[2,1]],['wind-turbine',[7,2]]] as const)for(const rot of [0,1,2,3]){
   const placed=placeRwsFootprint(c,kind,pos,rot,size)!;
   expect(placed).toBeDefined();expect(placed.orientation).toBe(c.rotation(rot));
   expect(footprintCells({...placed,kind,footprint:'standard'}).map(key).sort()).toEqual(coreOccupiedCells(pos,rot,size).map(p=>key(c.cell(p))).sort());
  }
  const fixed=placeRwsFootprint(c,'solar-generator',pos,0,[4,4])!;
  expect(fixed.orientation).toBe(0);expect(footprintCells({...fixed,kind:'solar-generator',footprint:'standard'}).map(key).sort()).toEqual(coreOccupiedCells(pos,0,[4,4]).map(p=>key(c.cell(p))).sort());
  for(const rot of [0,1,2,3]){
   const lamp=placeRwsFootprint(c,'wall-lamp',pos,rot,[1,1])!;
   expect(wallLampWallCell363(lamp)).toEqual(c.cell(wallLampWallCell363({...pos,orientation:rot})));
  }
 });
 it('puts Core north above south in the normal nonmirrored camera and keeps projected picking exact',()=>{
  const c=new RwsLocalCoordinates(20,20),camera=new OrthographicCamera(-20,20,20,-20,.1,150);
  camera.position.set(9.5,35,44.5);camera.lookAt(9.5,0,9.5);camera.updateMatrixWorld();
  const projected=(source:{x:number;z:number})=>{const local=c.cell(source);return new Vector3(local.x,0,local.z).project(camera);};
  const west=projected({x:2,z:5}),east=projected({x:17,z:5}),north=projected({x:2,z:15});
  expect(east.x).toBeGreaterThan(west.x);expect(north.y).toBeGreaterThan(west.y);
  const raycaster=new Raycaster();raycaster.setFromCamera(new Vector2(north.x,north.y),camera);
  const hit=raycaster.ray.intersectPlane(new Plane(new Vector3(0,1,0),0),new Vector3())!;
  expect(hit.x).toBeCloseTo(2);expect(hit.z).toBeCloseTo(4);
  expect(c.cell({x:Math.round(hit.x),z:Math.round(hit.z)})).toEqual({x:2,z:15});
 });
 it('also matches the actual camera rig on adoption, in both projection modes',()=>{
  const coords=new RwsLocalCoordinates(20,20),rig=new CameraRig(null);
  rig.configureMap(20,20);rig.resize(1280,800);
  try{
   for(const mode of ['orthographic','perspective'] as const){
    rig.setMode(mode);
    const camera=rig.camera;camera.updateMatrixWorld();
    const projected=(source:{x:number;z:number})=>{const local=coords.cell(source);return new Vector3(local.x,0,local.z).project(camera);};
    const west=projected({x:2,z:5}),east=projected({x:17,z:5}),north=projected({x:2,z:15});
    expect(east.x).toBeGreaterThan(west.x);expect(north.y).toBeGreaterThan(west.y);
    const raycaster=new Raycaster();raycaster.setFromCamera(new Vector2(north.x,north.y),camera);
    const hit=raycaster.ray.intersectPlane(new Plane(new Vector3(0,1,0),0),new Vector3())!;
    expect(hit.x).toBeCloseTo(2);expect(hit.z).toBeCloseTo(4);
   }
  }finally{rig.dispose();}
 });
 it('also reflects generated local owners retained by the import, including x-major river vectors and their direction',()=>{
  const width=8,height=9,c=new RwsLocalCoordinates(width,height),values=new Float32Array(width*height*2),river=(x:number,z:number)=>(x*height+z)*2;
  values[river(2,1)]=.25;values[river(2,1)+1]=-.5;values[river(3,7)+1]=-0;
  const planet={homeTile:451},w={width,height,planet,scenario:{landing:{x:1,z:2}},startingArrival:{phase:'opened',cells:[{x:3,z:3}]},geysers:{revision:1,atTick:0,items:[{id:1,x:2,z:1,ticksUntilSpray:20,sprayTicksLeft:0}]},roadInfo:{revision:1,edgeCells:[0,8*8+4]},riverWater:packRiverWater256(values,width,height),ancientShrineWarnings:{revision:1,pairs:[{rect:{minX:1,minZ:1,maxX:3,maxZ:4},center:{x:2,z:2}}]},mechanoids:[{x:3,z:2,heading:0,path:[{x:3,z:3}],temple:{goal:{x:4,z:2}}}],deepResources:{cells:[{index:2*8+2,item:'steel',count:10},{index:8*8+1,item:'gold',count:20}]},thermal:{regions:[{cells:[1,9],temperature:12}]}} as unknown as World;
  orientGeneratedImportBase(w,c);
  expect(w.planet).toBe(planet);expect(w.scenario?.landing).toEqual({x:1,z:6});
  expect(w.startingArrival).toMatchObject({cells:[{x:3,z:5}]});
  expect(w.geysers?.items[0]).toMatchObject({x:2,z:6,id:1});expect(w.roadInfo?.edgeCells).toEqual([64,4]);
  const flow=unpackRiverWater256(w.riverWater,width,height);expect(flow[river(2,7)]).toBe(.25);expect(flow[river(2,7)+1]).toBe(.5);expect(Object.is(flow[river(3,1)+1],0)).toBe(true);
  expect(w.ancientShrineWarnings?.pairs[0]).toMatchObject({rect:{minX:1,minZ:4,maxX:3,maxZ:7},center:{x:2,z:6}});
  expect(w.mechanoids?.[0]).toMatchObject({x:3,z:6,heading:Math.PI,path:[{x:3,z:5}],temple:{goal:{x:4,z:6}}});
  expect(w.deepResources?.cells.map(x=>x.index)).toEqual([1,50]);expect(w.thermal?.regions[0]?.cells).toEqual([57,65]);
 });
});

// Opt-in: RWS_IMPORT_SAVE=path/to/save.rws imports a real save (read only).
const real=process.env.RWS_IMPORT_SAVE;
describe.skipIf(!real||!existsSync(real))('Real RimWorld save (opt-in)',()=>{
 it('converts on its own planet, validates, reloads exactly and runs',()=>{
  const save=readRwsSave(readFileSync(real!,'utf8'));
  expect(saveCompatibility(save).ok).toBe(true);
  const {world,planetMode}=convertRwsSave(save);
  expect(planetMode).toBe('save');expect(validateWorld(world)).toEqual([]);
  const raw=serializeWorld(world);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
  for(let i=0;i<120;i++)stepWorld(world);
  expect(validateWorld(world)).toEqual([]);
 },600_000);
});
