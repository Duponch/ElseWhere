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
import {TERRAIN_MAP,ROCK_MAP,ROOF_MAP} from '../src/import/rimworld/map-terrain.ts';
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
 it('maps backstories to the Elsewhere story with the closest mechanical effects',()=>{
  expect(coreBackstoryEffect('AccursedChild88')).toMatchObject({slot:'childhood',gains:{construction:-1,intellectual:5,medicine:4}});
  const choice=closestBackgrounds('CaveChild30','Hunter74',true);
  expect(choice).toMatchObject({childhood:'workshop-child',adulthood:'mercenary'});
  // A pacifist childhood never pairs with an adulthood that requires violence.
  const pacifist=closestBackgrounds('AccursedChild88','StarKnight5',true);
  expect(pacifist.adulthood==='mercenary'&&pacifist.childhood==='quiet-child').toBe(false);
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
  expect(rows('traits').find(r=>r.def==='Pyromaniac')?.status).toBe('dropped');
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
  expect(w.tiles[5*20+5]).toMatchObject({terrain:'soil-natural',floor:'wood-planks'});
  expect(w.tiles[17*20+16]).toMatchObject({terrain:'rock',stone:'granite'});expect(w.tiles[18*20+18]).toMatchObject({terrain:'rock',ore:'steel'});
  expect(w.tiles[12*20+3]?.terrain).toBe('water-shallow');expect(w.tiles[0]?.terrain).toBe('gravel');
  expect(w.roofing?.constructed).toHaveLength(25);
  expect(w.structures.filter(s=>s.kind==='wall')).toHaveLength(23);expect(w.structures.every(s=>s.kind!=='wall'||s.material==='granite-blocks')).toBe(true);
  const door=w.structures.find(s=>s.kind==='door')!;expect(door).toMatchObject({x:5,z:2,material:'wood',orientation:0});expect(door.door).toBeDefined();
  const bed=w.structures.find(s=>s.kind==='bed')!;expect(bed).toMatchObject({quality:'good',material:'wood'});
  expect(footprintCells(bed).map(c=>`${c.x},${c.z}`).sort()).toEqual(['4,4','4,5']);
  expect(w.structures.find(s=>s.kind==='table')).toMatchObject({quality:'normal'});
 });
 it('imports colonists with identity, traits, closest backstories, skills, priorities, health and gear',()=>{
  expect(w.pawns).toHaveLength(2);
  const alma=w.pawns.find(p=>p.name.startsWith('Alma'))!,bruno=w.pawns.find(p=>p.name.startsWith('Bruno'))!;
  expect(alma.name).toBe('Alma « Fourmi » Rivière');expect(bruno.name).toBe('Bruno Sable');
  expect(alma.appearance).toMatchObject({sex:'female',bodyType:'Thin',headType:'Female_AverageWide',hair:'Flowy'});
  expect(alma.age?.biologicalTicks).toBe(10_800_000);
  expect(alma.traits).toEqual(['kind','jogger']);expect(bruno.traits).toEqual(['brawler','nervous']);
  const choice=closestBackgrounds('MedicalAssistant12','Gardener99',true);
  expect(alma.background).toEqual({childhood:choice.childhood,adulthood:choice.adulthood});
  expect(alma.skills.plants).toMatchObject({level:12,passion:2});expect(alma.skills.medicine).toMatchObject({level:8,passion:1,xp:120500});
  expect(alma.priorities).toMatchObject({firefight:1,patient:1,doctor:2,bedrest:3,basic:3,grow:1,haul:3,clean:3});
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
 it('names every loss in the French report',()=>{
  const report=frenchReport({title:'Petite colonie',conversion});
  for(const lost of ['Télescope : absent','Pyromane : trait absent','Ceinture bouclier','Thrumbo','Lucifèrium','Laine de mouton','sans planète'])expect(report).toContain(lost);
 });
 it('runs a few hundred ticks and stays valid',()=>{
  const copy=deserializeWorld(serializeWorld(w));
  for(let i=0;i<240;i++)stepWorld(copy);
  expect(validateWorld(copy)).toEqual([]);expect(copy.pawns.filter(p=>p.state!=='dead')).toHaveLength(2);
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
