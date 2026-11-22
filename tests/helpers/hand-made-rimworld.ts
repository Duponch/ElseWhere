// A hand-made « RimWorld » folder for the lore-text tests: definitions and
// language files written for the tests with invented words only (nothing of
// the game is ever stored in the repository; the real install is read by the
// opt-in test of game-lore-installed.test.ts). The definition names are the
// game's identifiers (SewerKid57, NaturalMood…), the texts are not.
import type {GameDirectoryHandle,GameFileHandle} from '../../src/import/rimworld/game-files-browser';
import {handMadeTar} from './hand-made-tar';

export type HandMadeTree={readonly [name:string]:string|Uint8Array|HandMadeTree};
const encoder=new TextEncoder();

/** A directory handle over a tree; `reads` lists every file read, in order. */
export function fakeDirectory(name:string,tree:HandMadeTree,reads:string[]=[],path=''):GameDirectoryHandle&{reads:string[]} {
 return {kind:'directory',name,reads,
  async *values(){
   for(const [child,value] of Object.entries(tree)){
    const at=path?`${path}/${child}`:child;
    if(typeof value==='string'||value instanceof Uint8Array){
     const file:GameFileHandle={kind:'file',name:child,getFile:async()=>{reads.push(at);const bytes=typeof value==='string'?encoder.encode(value):value;
      return {arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer};}};
     yield file;
    }else yield fakeDirectory(child,value,reads,at);
   }
  }};
}

const defs=(body:string)=>`<?xml version="1.0" encoding="utf-8"?>\n<Defs>\n${body}\n</Defs>\n`;
const language=(body:string)=>`<?xml version="1.0" encoding="utf-8"?>\n<LanguageData>\n${body}\n</LanguageData>\n`;

/** Invented definitions: two backstories (one through an abstract parent,
 * `baseDesc`), the natural-mood trait (four degrees) and the « kind » trait,
 * a faction type (description inherited), things, a biome, the Crashlanded
 * scenario, a caravan trader kind and a guard kind. */
export const HAND_MADE_DEFS:HandMadeTree={
 BackstoryDefs:{'Zorp.xml':defs(`
 <BackstoryDef Name="ZorpBase" Abstract="True"><slot>Childhood</slot><titleShort>zorpling</titleShort></BackstoryDef>
 <BackstoryDef ParentName="ZorpBase"><defName>SewerKid57</defName><title>zorp kid</title><titleFemale>zorp lass</titleFemale>
  <baseDesc>[PAWN_nameDef] grew among the vats of {PAWN_gender ? blim : blam : blom}.\\n\\n[PAWN_pronoun] liked [PAWN_possessive] quibs.</baseDesc></BackstoryDef>
 <BackstoryDef><defName>NavyScientist52</defName><slot>Adulthood</slot><title>quib scholar</title><titleShort>scholar</titleShort>
  <description>[PAWN_nameDef] studied quibs as a [PAWN_title].</description></BackstoryDef>`)},
 TraitDefs:{'Mood.xml':defs(`
 <TraitDef><defName>NaturalMood</defName><degreeDatas>
  <li><label>very glum</label><description>[PAWN_nameDef] frowns a lot.</description><degree>-2</degree></li>
  <li><label>glum</label><description>[PAWN_nameDef] frowns.</description><degree>-1</degree></li>
  <li><label>sunny</label><description>[PAWN_nameDef] smiles at {PAWN_objective}.</description><degree>1</degree></li>
  <li><label>very sunny</label><description>[PAWN_nameDef] beams.</description><degree>2</degree></li>
 </degreeDatas></TraitDef>
 <TraitDef><defName>Kind</defName><degreeDatas><li><label>zib</label><description>[PAWN_nameDef] is zib to [PAWN_objective].</description></li></degreeDatas></TraitDef>`)},
 FactionDefs:{'Factions.xml':defs(`
 <FactionDef Name="ZorpFactionBase" Abstract="True"><description>Flarns of the plain.</description></FactionDef>
 <FactionDef ParentName="ZorpFactionBase"><defName>OutlanderCivil</defName><label>flarn union</label><leaderTitle>grand flarn</leaderTitle></FactionDef>`)},
 ThingDefs_Items:{'Items.xml':defs(`<ThingDef><defName>WoodLog</defName><label>plonk</label><description>Plonk from trees.</description></ThingDef>`)},
 ThingDefs_Races:{'Races.xml':defs(`<ThingDef><defName>Muffalo</defName><label>muffo</label><description>A woolly muffo.</description></ThingDef>`)},
 ThingDefs_Plants:{'Plants.xml':defs(`<ThingDef><defName>Plant_TreeOak</defName><label>oakle</label></ThingDef><ThingDef><defName>Plant_Rice</defName><label>ricel</label></ThingDef>`)},
 ThingDefs_Buildings:{'Buildings.xml':defs(`<ThingDef><defName>Wall</defName><label>wallo</label><description>A wallo.</description></ThingDef>`)},
 BiomeDefs:{'Biomes.xml':defs(`<BiomeDef><defName>TemperateForest</defName><label>zorg woods</label><description>Woods of zorg.</description></BiomeDef>`)},
 Scenarios:{'Scenarios.xml':defs(`<ScenarioDef><defName>Crashlanded</defName><label>crash</label><scenario><name>Zorp crash</name><description>Three zorps fall.</description></scenario></ScenarioDef>`)},
 TraderKindDefs:{'Traders.xml':defs(`<TraderKindDef><defName>Caravan_Outlander_BulkGoods</defName><label>bulk zorp trader</label></TraderKindDef>`)},
 PawnKinds:{'Kinds.xml':defs(`<PawnKindDef><defName>Town_Guard</defName><label>zorp guard</label></PawnKindDef>`)},
 // A definition type the reader ignores.
 Misc:{'Other.xml':defs(`<SoundDef><defName>Bleep</defName><label>bleep</label></SoundDef>`)},
};

/** « Zorgish (Zorg) »: a language archive with the French text worker, its
 * injections (whole fields, a `TODO`, list items by handle and by index) and
 * pronoun words; English has only `Keyed` fallbacks. */
export function handMadeZorgishTar():Uint8Array {
 return handMadeTar([
  {name:'LanguageInfo.xml',text:'<?xml version="1.0" encoding="utf-8"?>\n<LanguageInfo><languageWorkerClass>LanguageWorker_French</languageWorkerClass></LanguageInfo>\n'},
  {name:'DefInjected/BackstoryDef/Zorp.xml',text:language(`
  <SewerKid57.title>gamin zorpe</SewerKid57.title>
  <SewerKid57.titleFemale>gamine zorpe</SewerKid57.titleFemale>
  <SewerKid57.description>[PAWN_nameDef] a grandi parmi les cuves {PAWN_gender ? du blim : de la blam : du blom}.\\n\\n[PAWN_pronoun] aimait [PAWN_possessive] quibs. de il</SewerKid57.description>
  <NavyScientist52.title>TODO</NavyScientist52.title>`)},
  {name:'DefInjected/TraitDef/Mood.xml',text:language(`
  <NaturalMood.degreeDatas.sunny.label>radieux</NaturalMood.degreeDatas.sunny.label>
  <NaturalMood.degreeDatas.sunny.labelFemale>radieuse</NaturalMood.degreeDatas.sunny.labelFemale>
  <NaturalMood.degreeDatas.sunny.description>[PAWN_nameDef] sourit à {PAWN_objective}, zorp{PAWN_gender ? in : ine : in(e)}.</NaturalMood.degreeDatas.sunny.description>
  <NaturalMood.degreeDatas.0.label>très morose</NaturalMood.degreeDatas.0.label>`)},
  {name:'DefInjected/FactionDefs/Factions.xml',text:language(`<OutlanderCivil.label>union des flarns</OutlanderCivil.label><OutlanderCivil.leaderTitle>grand flarn</OutlanderCivil.leaderTitle><OutlanderCivil.leaderTitleFemale>grande flarne</OutlanderCivil.leaderTitleFemale>`)},
  {name:'DefInjected/ThingDef/Items.xml',text:language(`<WoodLog.label>planche zorpe</WoodLog.label>`)},
  {name:'DefInjected/SoundDef/Other.xml',text:language(`<Bleep.label>blip</Bleep.label>`)},
  {name:'Keyed/Pronouns.xml',text:language(`<Prohe>ilz</Prohe><Proshe>ellz</Proshe><Prohis>sonz</Prohis><Proher>saz</Proher><ProhimObj>luiz</ProhimObj><ProherObj>laz</ProherObj>`)},
  {name:'Strings/Names/Unused.txt',text:'vex\n'},
 ]);
}
/** The install folder: `Data/Core` with its definitions and languages, and `Version.txt`. */
export function handMadeRimWorld(extra:HandMadeTree={}):HandMadeTree {
 return {
  'Version.txt':'9.9.9 rev1\n',
  Data:{Core:{
   Defs:HAND_MADE_DEFS,
   Languages:{
    English:{'LanguageInfo.xml':'<LanguageInfo><languageWorkerClass>LanguageWorker_English</languageWorkerClass></LanguageInfo>',
     Keyed:{'Pronouns.xml':language(`<Prohe>he-z</Prohe><Proshe>she-z</Proshe><Proit>it-z</Proit><Prohis>his-z</Prohis><Proher>her-z</Proher><Proits>its-z</Proits><ProhimObj>him-z</ProhimObj><ProherObj>her-z</ProherObj><ProitObj>it-z</ProitObj>`)},
     Strings:{'Unused.txt':'vex\n'}},
    'Zorgish (Zorg).tar':handMadeZorgishTar(),
    'Other (Autre).tar':handMadeTar([{name:'Keyed/X.xml',text:language('<Prohe>nope</Prohe>')}]),
   },
  }},
  RimWorldWin64_Data:{'resources.assets':'not read'},
  ...extra,
 };
}
