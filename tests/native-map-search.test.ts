import {describe,expect,it,vi} from 'vitest';
import {createWorld} from '../src/sim/index';
import type {MaterialPile,World} from '../src/sim/types';
import type {NativePage} from '../src/ui3d/native-contract';
import {createNativeMapSearch,nativeMapSearchMatches,searchNativeMap,type NativeMapSearchState} from '../src/ui3d/native-map-search';
import {layoutNativePage} from '../src/ui3d/native-layout';

/** Small prepared presentation fixture: no gameplay acquisition claim. */
function fixture():World {
 const world=createWorld(918,16,16);world.resources=[];world.structures=[];world.jobs=[];world.piles=[];world.packed=[];
 world.wildlife=undefined;world.mechanoids=undefined;world.geysers=undefined;
 for(const tile of world.tiles){tile.terrain='soil';delete tile.ore;delete tile.stone;delete tile.fogged;}
 world.pawns[0]!.name='Émile';world.pawns[0]!.x=2;world.pawns[0]!.z=2;return world;
}
function pile(world:World,id:number,item:MaterialPile['item'],owner:MaterialPile['owner']):MaterialPile {
 const result:MaterialPile={id,kind:'steel',item,quantity:12,owner};world.piles.push(result);return result;
}
function exploring(world:World){world.site={revision:3,tileId:0,mapSeed:world.seed,biome:'temperate-forest',hilliness:'flat',river:'none',stones:['granite','marble'],coastAngle:null,mutatorCode:0};world.exploration={revision:1};}
const measure=(text:string,size:number)=>text.length*size*.52;
function ui(world=fixture()){
 const state:NativeMapSearchState={world,epoch:1,mapId:1,mapVisible:true,publicationRevision:1};let page:NativePage|undefined;let clock=0;
 const focus=vi.fn(),preview=vi.fn(),closed=vi.fn();
 const controller=createNativeMapSearch({readState:()=>state,showPage:p=>{page=p;},isCurrentPage:p=>p===page,focus,preview,close:()=>{closed();page=undefined;},now:()=>clock});
 const edit=(value:string)=>page!.rows.find(row=>row.id==='map-search-input')!.input!.onChange!(value);
 const control=(key:string)=>page!.rows.find(row=>row.id===`map-search-${key}`)!.controls![0]!;
 return{state,controller,focus,preview,closed,edit,control,set clock(value:number){clock=value;},get page(){return page!;},replace(){page={id:'other',title:'Autre',rows:[]};}};
}

describe('Core 1.6 map search: real objects and player knowledge',()=>{
 it('matches one case-insensitive substring of a name or definition, strips tags, and keeps duplicate physical stacks',()=>{
  expect(nativeMapSearchMatches('<color=red>Émile</color>','Humain','ÉM')).toBe(true);
  expect(nativeMapSearchMatches('Émile','Humain','humain')).toBe(true);
  expect(nativeMapSearchMatches('Fusil de chasse','Arme','fusil chasse')).toBe(false);
  expect(nativeMapSearchMatches('Émile','Humain','')).toBe(false);
  const w=fixture();pile(w,800,'steel',{type:'ground',x:3,z:3});pile(w,801,'steel',{type:'ground',x:4,z:3});
  const before=JSON.stringify(w),results=searchNativeMap(w,'acier');expect(results.map(row=>row.key)).toEqual(['pile:800','pile:801']);
  expect(results.every(row=>row.label.includes('×12'))).toBe(true);expect(searchNativeMap(w,'12')).toEqual([]);expect(JSON.stringify(w)).toBe(before);
 });
 it('enumerates buildings, selectable plants, rocks, construction plans and real geysers without zones or bare cells',()=>{
  const w=fixture();w.structures.push({id:810,kind:'bed',x:2,z:3,orientation:0,footprint:'standard'});
  w.jobs.push({id:814,kind:'bed',x:8,z:8,orientation:0,footprint:'standard',construction:'blueprint',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
  w.resources.push({id:811,kind:'rice',x:3,z:3,amount:1,growth:.4},{id:812,kind:'wild-plant',species:'grass',x:4,z:3,amount:1});
  w.tiles[85]!.terrain='rock';w.tiles[85]!.ore='steel';w.geysers={revision:1,atTick:0,items:[{id:813,x:6,z:6,ticksUntilSpray:0,sprayTicksLeft:0}]};
  expect(searchNativeMap(w,'lit').map(row=>row.key)).toContain('structure:810');expect(searchNativeMap(w,'riz').map(row=>row.key)).toContain('resource:811');
  expect(searchNativeMap(w,'herbe').map(row=>row.key)).not.toContain('resource:812');expect(searchNativeMap(w,'acier').map(row=>row.key)).toContain('rock:85');
  expect(searchNativeMap(w,'lit').find(row=>row.key==='job:814')?.target).toEqual({kind:'object',object:{kind:'job',id:814},cell:{x:8,z:8}});
  expect(searchNativeMap(w,'geyser')[0]!.target).toEqual({kind:'object',object:{kind:'geyser',id:813},cell:{x:6,z:6}});
  expect(searchNativeMap(w,'zone')).toEqual([]);expect(searchNativeMap(w,'sol')).toEqual([]);
 });
 it('finds player equipment and carried goods through their true holder, and excludes foreign possessions and remote owners',()=>{
  const w=fixture(),p=w.pawns[0]!,foreign=w.pawns[1]!;foreign.faction='outlaws';foreign.x=4;foreign.z=4;
  pile(w,820,'steel',{type:'inventory',pawnId:p.id});pile(w,821,'steel',{type:'equipment',pawnId:p.id});
  pile(w,822,'steel',{type:'inventory',pawnId:foreign.id});pile(w,823,'steel',{type:'world-site263',siteId:1});
  const results=searchNativeMap(w,'acier');expect(results.map(row=>row.key)).toEqual(['pile:820','pile:821']);
  expect(results.every(row=>row.holder==='inventory')).toBe(true);expect(results[0]!.target).toEqual({kind:'pawn',id:p.id,cell:{x:2,z:2}});
 });
 it('keeps a named animal searchable by its species and follows domestic inventory ownership',()=>{
  const w=fixture();w.wildlife={profile:'temperate-hares-v1',rng:1,eatenPlants:0,eatenNutrition:0,eatenItems:0,animals:[{id:830,species:'hare',sex:'female',x:3,z:4,ageTicks:10000,state:'idle',food:1,rest:1,path:[],nextDecision:0,startingPet:{revision:1,name:'Nuage'},domestic:{tameness:5,care:'industrial',since:0,nextDecay:0}}]};
  pile(w,831,'steel',{type:'inventory',pawnId:830});
  expect(searchNativeMap(w,'lièvre')[0]?.label).toBe('Nuage');expect(searchNativeMap(w,'nuage')[0]?.key).toBe('animal:830');
  expect(searchNativeMap(w,'acier')[0]?.target).toEqual({kind:'animal',id:830,cell:{x:3,z:4}});
 });
 it('does not disclose fogged minerals, pawns or their belongings, including colonist-owned inventory',()=>{
  const w=fixture();exploring(w);const p=w.pawns[0]!;
  w.tiles[p.z*w.width+p.x]!.fogged=true;w.tiles[85]!.terrain='rock';w.tiles[85]!.ore='steel';w.tiles[85]!.fogged=true;
  pile(w,840,'steel',{type:'ground',x:5,z:5});pile(w,841,'steel',{type:'inventory',pawnId:p.id});
  expect(searchNativeMap(w,'acier')).toEqual([]);expect(searchNativeMap(w,'Émile')).toEqual([]);
 });
 it('shows contents of player containers, focuses their container, and never inspects an ancient closed casket',()=>{
  const w=fixture();w.structures.push({id:850,kind:'egg-box',x:4,z:4,orientation:0,footprint:'standard'},{id:851,kind:'ancient-cryptosleep-casket',x:6,z:6,orientation:0,footprint:'standard'});
  pile(w,852,'steel',{type:'egg-box374',structureId:850});const result=searchNativeMap(w,'acier')[0]!;
  expect(result.holder).toBe('container');expect(result.target).toEqual({kind:'object',object:{kind:'structure',id:850},cell:{x:4,z:4}});
  expect(searchNativeMap(w,'ancien')).toHaveLength(1);
 });
 it('finds a foreign corpse and its actual possessions through the loose body, then through its grave',()=>{
  const w=fixture(),p=w.pawns[0]!;p.faction='outlaws';p.state='dead';p.body={observedAt:0,pileId:853};
  const body:MaterialPile={id:853,kind:'corpse',item:'human-corpse',quantity:1,owner:{type:'ground',x:7,z:7},humanCorpse:{pawnId:p.id}};w.piles.push(body);
  pile(w,854,'steel',{type:'inventory',pawnId:p.id});let found=searchNativeMap(w,'acier')[0]!;
  expect(found.target).toEqual({kind:'object',object:{kind:'pile',id:853},cell:{x:7,z:7}});expect(searchNativeMap(w,'Émile').map(row=>row.key)).toEqual(['pile:853']);
  w.structures.push({id:855,kind:'grave',x:8,z:8,orientation:0,footprint:'standard'});body.owner={type:'grave',graveId:855};found=searchNativeMap(w,'acier')[0]!;
  expect(found.target).toEqual({kind:'object',object:{kind:'structure',id:855},cell:{x:8,z:8}});
 });
 it('finds real player casket contents and packed originals without duplicating their physical owner',()=>{
  const w=fixture(),p=w.pawns.shift()!,held:MaterialPile={id:856,kind:'steel',item:'steel',quantity:1,owner:{type:'inventory',pawnId:p.id}};
  w.structures.push({id:857,kind:'cryptosleep-casket',x:8,z:8,orientation:0,footprint:'standard',cryptosleep:{revision:1,heldAt:0,human:p,items:[held],packed:[]}});
  w.packed.push({building:{id:858,kind:'bed',x:0,z:0,orientation:0,footprint:'standard'},owner:{type:'ground',x:9,z:9}});
  expect(searchNativeMap(w,'Émile')[0]!.target).toEqual({kind:'object',object:{kind:'structure',id:857},cell:{x:8,z:8}});
  expect(searchNativeMap(w,'acier').map(row=>row.key)).toEqual(['pile:856']);expect(searchNativeMap(w,'lit')[0]!.target).toEqual({kind:'object',object:{kind:'packed',id:858},cell:{x:9,z:9}});
 });
});

describe('modeless map search lifecycle and bounded publication refresh',()=>{
 it('updates onChange, leaves the window open on selection, and resolves the current owner at click time',()=>{
  const u=ui(),w=u.state.world!,p=w.pawns[0]!,item=pile(w,860,'steel',{type:'ground',x:3,z:3});
  expect(u.controller.open()).toBe(true);expect(u.controller.results).toEqual([]);expect(u.edit('acier')).toBe(true);
  const old=u.control('pile:860');item.owner={type:'inventory',pawnId:p.id};old.onActivate();
  expect(u.focus).toHaveBeenLastCalledWith({kind:'pawn',id:p.id,cell:{x:2,z:2}});expect(u.controller.isOpen).toBe(true);expect(u.closed).not.toHaveBeenCalled();
  w.piles=[];old.onActivate();expect(u.focus).toHaveBeenCalledTimes(1);expect(u.controller.results).toEqual([]);
 });
 it('revalidates a hovered pile without scanning the terrain or flora',()=>{
  const u=ui(),w=u.state.world!;pile(w,865,'steel',{type:'ground',x:3,z:3});u.controller.open();u.edit('acier');
  const flora=vi.spyOn(w.resources,Symbol.iterator),terrain=vi.fn(()=>'soil' as const);Object.defineProperty(w.tiles[0]!,'terrain',{get:terrain,configurable:true});
  u.control('pile:865').onHover!(true);expect(u.preview).toHaveBeenLastCalledWith({kind:'object',object:{kind:'pile',id:865},cell:{x:3,z:3}});
  expect(flora).not.toHaveBeenCalled();expect(terrain).not.toHaveBeenCalled();
 });
 it('only recaptures changed accepted publications at the interval, and catches same-tick revisions',()=>{
  const u=ui(),w=u.state.world!;pile(w,870,'steel',{type:'ground',x:3,z:3});const iterations=vi.spyOn(w.resources,Symbol.iterator);
  u.controller.open();u.edit('acier');expect(iterations).toHaveBeenCalledTimes(1);
  for(let now=1;now<1000;now++)u.controller.refresh(now);expect(iterations).toHaveBeenCalledTimes(1);
  u.state.publicationRevision=2;w.piles=[];expect(u.controller.refresh(1000)).toBe(true);expect(iterations).toHaveBeenCalledTimes(2);expect(u.controller.results).toEqual([]);
  pile(w,871,'steel',{type:'ground',x:3,z:3});u.state.publicationRevision=3;expect(u.controller.refresh(1200)).toBe(false);expect(u.controller.refresh(1500)).toBe(true);expect(u.controller.results).toHaveLength(1);
  const page=u.controller.page;u.state.publicationRevision=4;expect(u.controller.refresh(2000)).toBe(true);expect(u.controller.page).toBe(page);
 });
 it('rejects stale actions after replacement and reopening and closes immediately on map/visibility changes',()=>{
  const u=ui(),p=u.state.world!.pawns[0]!;u.controller.open();u.edit('Émile');const old=u.control(`pawn:${p.id}`),input=u.page.rows.find(row=>row.input)!.input!;
  u.replace();old.onActivate();expect(input.onChange!('ancien')).toBe(false);expect(u.focus).not.toHaveBeenCalled();u.controller.refresh(1);expect(u.closed).not.toHaveBeenCalled();
  u.controller.open();u.edit('Émile');old.onActivate();expect(u.focus).not.toHaveBeenCalled();
  u.state.mapVisible=false;u.controller.refresh(2);expect(u.controller.isOpen).toBe(false);expect(u.closed).toHaveBeenCalledTimes(1);
  u.state.mapVisible=true;u.controller.open();u.state.mapId=2;u.controller.refresh(3);expect(u.closed).toHaveBeenCalledTimes(2);
 });
 it('rejects a clicked result that became fogged before the next scheduled refresh',()=>{
  const u=ui(),w=u.state.world!;exploring(w);pile(w,880,'steel',{type:'ground',x:5,z:5});u.controller.open();u.edit('acier');
  const target=u.control('pile:880');w.tiles[85]!.fogged=true;target.onActivate();expect(u.focus).not.toHaveBeenCalled();expect(u.controller.results).toEqual([]);
 });
});

describe('Dialog_MapSearch geometry',()=>{
 it('uses Core 350 × (100 + 26 per result), bottom-right, independent fixed search footer and full-row hit targets',()=>{
  const u=ui(),w=u.state.world!;pile(w,890,'steel',{type:'ground',x:3,z:3});u.controller.open();
  let box=layoutNativePage(u.page,{width:1440,height:900},false,measure);expect([box.width,box.height,box.x,box.y,box.header]).toEqual([350,100,1090,765,0]);
  u.edit('acier');box=layoutNativePage(u.page,{width:1440,height:900},false,measure);
  expect([box.height,box.y]).toEqual([126,739]);const row=box.rows.find(row=>row.row.mapSearchEntry)!;
  expect(row.height).toBe(26);expect(row.controls[0]).toMatchObject({height:26,hitOnly:true,x:row.x,y:row.top,width:row.width});
  const field=box.rows.find(row=>row.row.input)!.inputRect!;expect(field.y+field.height).toBe(box.height-18);expect(box.regions.catalogue!.y+box.regions.catalogue!.height).toBeLessThanOrEqual(box.regions.toolbar!.y);
 });
 it.each([{width:1440,height:900},{width:320,height:240}])('limits tall lists to half the screen and keeps the field outside the scrolled results at $width × $height',viewport=>{
  const u=ui(),w=u.state.world!;for(let i=0;i<40;i++)pile(w,900+i,'steel',{type:'ground',x:3,z:3});u.controller.open();u.edit('acier');
  const box=layoutNativePage(u.page,viewport,false,measure),field=box.rows.find(row=>row.row.input)!.inputRect!;
  expect(box.height).toBe(viewport.height/2);expect(box.contentHeight).toBe(40*26);expect(box.regions.catalogue!.height).toBeLessThan(box.contentHeight);
  expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);expect(field.y+field.height).toBeLessThanOrEqual(box.height);expect(field.width).toBeGreaterThan(0);
  const tail=layoutNativePage(u.page,viewport,false,measure,40*26),visible=tail.rows.filter(row=>row.row.mapSearchEntry);
  expect(visible.length).toBeLessThan(40);expect(visible.at(-1)?.row.mapSearchEntry?.index).toBe(39);expect(tail.contentHeight).toBe(40*26);expect(tail.rows.find(row=>row.row.input)?.inputRect).toEqual(field);
 });
});
