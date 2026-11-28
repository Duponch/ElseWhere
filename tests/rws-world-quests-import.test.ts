import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {ImportContext} from '../src/import/rimworld/convert.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {at,parseXml} from '../src/import/rimworld/xml.ts';
import {importRwsWorldQuests} from '../src/import/rimworld/import-world-quests.ts';
import {validateWorldSites263} from '../src/sim/world-sites-save-263.ts';
import {newQuestCalendar263} from '../src/sim/world-quest-calendar-263.ts';
import type {World} from '../src/sim/types.ts';

const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
const basic=fixture.replace('<def>Pirate</def><name>Les Pillards</name>','<def>OutlanderCivil</def><name>Les Marchands</name><randomKey>984548698</randomKey><colorFromSpectrum>0.261192411</colorFromSpectrum><defeated>True</defeated>').replaceAll('<goodwill>-100</goodwill><kind>Hostile</kind>','<goodwill>-25</goodwill><kind>Neutral</kind>');
function context(){
 const save=readRwsSave(basic),w=createWorld(13,20,20);w.tick=36000;w.phaseCore297=0;
 // Targeted validation context; world-site guard only needs planet tile
 // count, current clock, established faction IDs and a real Thing frontier.
 w.planet={revision:2,tiles:Array.from({length:12},(_,i)=>({id:i})),homeTile:5} as unknown as World['planet'];
 w.worldFactions={factions:[{id:1,def:'OutlanderCivil',name:'old',randomKey:1,colorFromSpectrum:0,hidden:false,leaderOwnerId:null},{id:2,def:'PlayerColony',name:'Les Essais',randomKey:2,colorFromSpectrum:0,hidden:false,leaderOwnerId:null}],playerFactionId:2,relations:[{aId:1,bId:2,goodwill:-25,kind:'hostile'}],settlements:[]} as unknown as World['worldFactions'];
 w.worldSites263={revision:1,nextId:1,entries:[],quest:newQuestCalendar263(w.tick*10,w.seed,w.pawns.map(p=>p.id))};
 const ctx=new ImportContext(save,save.maps[0]!,w,new ImportNotes(),true,new Map([['Faction_0',1],['Faction_1',2]]));return ctx;
}
function addQuest(ctx:ImportContext,id:number,worldId:number,def='OpportunitySite_ItemStash',ended=false){
 const part=`<li><id>${id}</id><name>Récompense ${id}</name><root>${def}</root><appearanceTick>300000</appearanceTick><acceptanceTick>300000</acceptanceTick>${ended?'<ended>True</ended><endOutcome>Success</endOutcome>':''}<parts><li Class="QuestPart_SpawnWorldObject"><worldObject>WorldObject_${worldId}</worldObject></li><li Class="QuestPart_WorldObjectTimeout"><state>Enabled</state><enableTick>300000</enableTick><delayTicks>1380000</delayTicks></li></parts></li>`;
 let quests=at(ctx.save.game,'questManager/quests');if(!quests){ctx.save.game.children.push(parseXml('<questManager><quests/></questManager>'));quests=at(ctx.save.game,'questManager/quests');}
 quests!.children.push(parseXml(part));
}
function addWorldObject(ctx:ImportContext,id:number,tile:number,contents:string,def='ItemStash'){
 at(ctx.save.world!.node,'worldObjects/worldObjects')!.children.push(parseXml(`<li Class="Site"><def>Site</def><tile>${tile},0</tile><ID>${id}</ID><creationGameTicks>300000</creationGameTicks><timeoutEndTick>-1</timeoutEndTick><parts><li><def>${def}</def><things><innerList>${contents}</innerList></things></li><li><def>AmbushEdge</def><hidden>True</hidden><parms><threatPoints>161.14537</threatPoints></parms></li><li><def>PossibleUnknownThreatMarker</def></li></parts></li>`));
}
const medicine='<li Class="Medicine"><def>MedicineUltratech</def><id>MedicineUltratech99</id><health>60</health><stackCount>1</stackCount></li>';

describe('RWS original world quest/site owners',()=>{
 it('restores actual quest tile/expiry/frozen reward and keeps neutral diplomatic hysteresis',()=>{
  const ctx=context();addQuest(ctx,29,476);addWorldObject(ctx,476,9,medicine);
  importRwsWorldQuests(ctx);
  const site=ctx.w.worldSites263!.entries[0]!;
  expect(site).toMatchObject({kind:'item-stash',tile:9,createdAtCore:300000,expiresAtCore:1680000,heldAtCore:360000,threat:{kind:'ambush-edge',points:161.14537},items:[{item:'glitterworld-medicine',quantity:1,owner:{type:'world-site263',siteId:1}}]});
  expect(site.kind==='item-stash'&&ctx.thingIds.get('MedicineUltratech99')===site.items[0]?.id).toBe(true);
  expect(validateWorldSites263(ctx.w.worldSites263,ctx.w,new Set(),ctx.w.tick*10)).toEqual([]);
  expect(ctx.w.worldFactions!.factions[0]).toMatchObject({name:'Les Marchands',randomKey:984548698,colorFromSpectrum:0.261192411,lifecycle259:{defeated:true,temporary:false}});
  expect(ctx.w.worldFactions!.relations[0]).toMatchObject({goodwill:-25,kind:'neutral'});
  expect(ctx.w.worldSites263!.quest).toMatchObject({siteOffers:1,recent:['item-stash'],previousHitInterval:300});
 });
 it('reports unsupported roots and cleaned-up history, never creates false contents or events',()=>{
  const ctx=context();addQuest(ctx,4,500,'OpportunitySite_ItemStash',true);addQuest(ctx,28,475,'OpportunitySite_BanditCamp');addWorldObject(ctx,475,9,'','BanditCamp');
  addQuest(ctx,27,476,'TradeRequest');
  const beforeIds=ctx.w.nextId;importRwsWorldQuests(ctx);
  expect(ctx.w.worldSites263!.entries).toEqual([]);expect(ctx.w.nextId).toBe(beforeIds);
  expect(ctx.notes.summary('history').dropped).toBe(3);expect(ctx.notes.summary('world').dropped).toBe(1);
  expect([...ctx.notes.tallies.get('history')!.values()].find(x=>x.def.startsWith('Quête 4'))?.note).toContain('aucun faux historique');
 });
 it('rejects a cache with a missing content def without allocating or replacing it',()=>{
  const ctx=context();addQuest(ctx,1,2);addWorldObject(ctx,2,9,'<li><def>NonExistant</def><id>Missing</id><stackCount>2</stackCount></li>');
  const before=ctx.w.nextId;importRwsWorldQuests(ctx);expect(ctx.w.worldSites263!.entries).toHaveLength(0);expect(ctx.w.nextId).toBe(before);
  expect(ctx.thingIds.has('Missing')).toBe(false);
 });
});
