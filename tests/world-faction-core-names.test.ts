// Lot 3 of « même planète, même graine »: faction and settlement names drawn
// with the game's grammar on the step-500 stream, only when the game's data
// is given. Without it, step 500 is exactly as before (pinned on Elsewhere's
// own invented names). With hand-made rule packs (invented words), the first
// faction's draws are replayed by hand in the game's order: key, colour,
// ideology seeds, ten names, settlement tile, settlement name, then the leader.
import {describe,expect,it} from 'vitest';
import {generateForeignWorldFactions256} from '../src/sim/world-faction-generation';
import {WorldGenerationRandom} from '../src/sim/world-generation-random';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {pickWorldSettlementTile,type SettlementTile} from '../src/sim/world-settlement-placement';
import {grammarRandomOf,type CoreFactionNames,type CoreFactionNaming} from '../src/sim/world-faction-core-names';
import {GrammarDatabase,parseGrammarRuleString,grammarFileRule} from '../src/sim/verse-grammar';
import {generateFactionName,generateSettlementName} from '../src/sim/verse-name-generator';
import {VerseRand} from '../src/sim/verse-rand';
import {SCHEMA_VERSION} from '../src/sim/types';

const tiles:SettlementTile[]=Array.from({length:400},(_,i)=>({biome:i%7===0?'ocean':i%5===0?'desert':'temperate-forest',hilliness:i%11===0?'impassable':'flat',neighbours:[(i+1)%400,(i+399)%400]}));
const input=(random:WorldGenerationRandom)=>({version:SCHEMA_VERSION,tick:0,tiles,selection:defaultWorldGenerationSettings().factions,population:3 as const,nextFactionId:1,nextSettlementId:1,nextThingId:1,random});

describe('step 500 without the game\'s data',()=>{
 it('keeps Elsewhere\'s names, tiles and draws exactly',()=>{
  // Values of the generator before lot 3 (origin/main 33bcebfd), same inputs.
  for(const extra of [{},{names:undefined}]){
   const random=new WorldGenerationRandom(4242),r=generateForeignWorldFactions256({...input(random),...extra});
   if(!r.ok)throw Error(r.reason);
   expect(r.draft.factions.map(f=>f.name)).toEqual(['Alliance de Roseau','Pacte de Brume','Union de Brume','Veille de Sillon','Ligue de Sillon','Alliance de Sillon','Ligue de Rive','Présence 8','Présence 9','Présence 10']);
   expect(r.draft.settlements.map(s=>[s.tile,s.name])).toEqual([[32,'Sillon-Brume'],[159,'Cime-Cime'],[41,'Rive-Sillon'],[309,'Orbe-Orbe'],[193,'Orbe-Cime'],[3,'Sillon-Argile']]);
   expect(random.state.counter).toBe(1686);
  }
 });
});

const rule=parseGrammarRuleString;
const grammar=new GrammarDatabase([
 {defName:'NamerFactionZol',include:[],rulePack:{rules:[rule('r_name->[w] [w]'),rule('r_name(p=2)->le [w]'),grammarFileRule('w',['kru','vex','plo','averyveryverylongzolword'])],untranslatedRules:[],include:[]}},
 {defName:'NamerSettlementZol',include:[],rulePack:{rules:[rule('r_name->[s][e]'),grammarFileRule('s',['mib','dor','tal']),grammarFileRule('e',['ville','mont'])],untranslatedRules:[],include:[]}},
],{worker:'LanguageWorker_French',isDefault:false});
const drawn:CoreFactionNaming={factionNameMaker:'NamerFactionZol',settlementNameMaker:'NamerSettlementZol',fixedName:null};
const fixed=(name:string):CoreFactionNaming=>({factionNameMaker:null,settlementNameMaker:null,fixedName:name});
const names:CoreFactionNames={grammar,factions:new Map<string,CoreFactionNaming>([
 ...['OutlanderCivil','OutlanderRough','TribeCivil','TribeRough','TribeSavage','Pirate'].map(d=>[d,drawn] as const),
 ['Mechanoid',fixed('nid zol')],['Insect',fixed('Zols')],['Ancients',fixed('Anciens zol')],['AncientsHostile',fixed('Anciens vex')],
])};

describe('step 500 with the game\'s name data',()=>{
 it('draws the first faction\'s name, settlement tile and settlement name where the game draws them',()=>{
  const random=new WorldGenerationRandom(4242),starts:number[]=[];
  const r=generateForeignWorldFactions256({...input(random),names,onLeaderStart:(_f,i,state)=>{starts[i]=state.counter;}});
  if(!r.ok)throw Error(r.reason);
  // Hand replay of the first faction (OutlanderCivil, human, fixed culture).
  const ref=new WorldGenerationRandom(4242);
  ref.integer(0,2147483647);for(let i=0;i<20;i++)ref.value();for(let i=0;i<11;i++)ref.integerValue();
  const name=generateFactionName(grammar,'NamerFactionZol',[],grammarRandomOf(ref));
  const tile=pickWorldSettlementTile(tiles,ref,{settlementTiles:new Set()}).tile;
  const settlement=generateSettlementName(grammar,'NamerSettlementZol',[],grammarRandomOf(ref));
  expect(r.draft.factions[0]!.name).toBe(name);
  expect([r.draft.settlements[0]!.tile,r.draft.settlements[0]!.name]).toEqual([tile,settlement]);
  expect(starts[0]).toBe(ref.state.counter);
  // Fixed names draw nothing; every name comes from the packs.
  expect(r.draft.factions.slice(6).map(f=>f.name)).toEqual(['nid zol','Zols','Anciens zol','Anciens vex']);
  for(const f of r.draft.factions.slice(0,6))expect(f.name).toMatch(/^(Le )?(Kru|Vex|Plo|Le)( (kru|vex|plo))?$/);
  for(const s of r.draft.settlements)expect(s.name).toMatch(/^(Mib|Dor|Tal)(ville|mont)( \d+)?$/);
  expect(new Set(r.draft.settlements.map(s=>s.name)).size).toBe(r.draft.settlements.length);
 });
 it('refuses a faction the game data does not describe',()=>{
  const partial:CoreFactionNames={grammar,factions:new Map([['OutlanderCivil',drawn]])};
  expect(()=>generateForeignWorldFactions256({...input(new WorldGenerationRandom(1)),names:partial})).toThrow(/absente des données du jeu/);
 });
 it('sees the world generation stream as Verse.Rand',()=>{
  const a=grammarRandomOf(new WorldGenerationRandom(987)),b=new VerseRand(987);
  for(let i=0;i<50;i++){
   expect(a.value).toBe(b.value);expect(a.range(3,17)).toBe(b.range(3,17));expect(a.rangeInclusive(0,9)).toBe(b.rangeInclusive(0,9));
   expect(a.rangeFloat(0,Math.fround(123.4))).toBe(b.rangeFloat(0,Math.fround(123.4)));expect(a.rangeFloat(2,5)).toBe(b.rangeFloat(2,5));
  }
 });
});
