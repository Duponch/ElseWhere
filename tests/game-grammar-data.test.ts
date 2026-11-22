// Lot 3 of « même planète, même graine »: the game data source. The tar
// reader, the file folders and the grammar loader are checked on hand-made
// archives and folders with invented words only (nothing of the game is ever
// stored in the repository; the real install is read by the opt-in tests of
// planet-parity.test.ts).
import {describe,expect,it} from 'vitest';
import {readTarEntries} from '../src/import/rimworld/tar';
import {memoryGameFolder,openGameLanguage,gameLanguageNames,legacyLanguageName,gameText,gameSubfolder} from '../src/import/rimworld/game-files';
import {loadGameGrammar,unityTextAsset,nameFilesReachable} from '../src/import/rimworld/game-grammar';
import {handMadeTar,paxPathRecord} from './helpers/hand-made-tar';

const enc=new TextEncoder(),bytes=(s:string)=>enc.encode(s);
const text=(b:Uint8Array|undefined)=>b?gameText(b):undefined;

describe('tar reader',()=>{
 it('reads files and directories of the old format, ustar prefixes, GNU long names and pax paths',()=>{
  const long='Strings/'+'Mots/'.repeat(25)+'Long.txt';
  const archive=handMadeTar([
   {name:'Strings/'},
   {name:'Strings/Words/Nouns.txt',text:'zol\nkru\n'},
   {name:'Liste.txt',prefix:'DefInjected/RulePackDef',text:'<LanguageData/>'},
   {name:'././@LongLink',type:'L',text:long+'\0'},
   {name:'ignored-short-name.txt',text:'vex'},
   {name:'PaxHeader',type:'x',text:paxPathRecord('Strings/Pax/Ébène.txt')},
   {name:'pax-short.txt',text:'plo'},
   {name:'Strings/Old/',type:'0'},
  ]);
  const entries=readTarEntries(archive);
  expect(entries.map(e=>[e.path,e.directory,new TextDecoder().decode(e.data)])).toEqual([
   ['Strings',true,''],
   ['Strings/Words/Nouns.txt',false,'zol\nkru\n'],
   ['DefInjected/RulePackDef/Liste.txt',false,'<LanguageData/>'],
   [long,false,'vex'],
   ['Strings/Pax/Ébène.txt',false,'plo'],
   ['Strings/Old',true,''],
  ]);
 });
 it('stops at the first zero block and refuses a truncated archive',()=>{
  const archive=handMadeTar([{name:'a.txt',text:'x'.repeat(700)}]);
  expect(readTarEntries(archive)).toHaveLength(1);
  expect(()=>readTarEntries(archive.subarray(0,512+100))).toThrow(/tronquée/);
  expect(readTarEntries(new Uint8Array(1024))).toEqual([]);
 });
});

describe('game folders',()=>{
 it('lists subfolders and files, reads, and opens a sub-folder',()=>{
  const folder=memoryGameFolder([['A/b.txt',bytes('1')],['A/C/d.txt',bytes('2')],['e.txt',bytes('﻿3')]]);
  expect(folder.folders('')).toEqual(['A']);expect(folder.folders('A')).toEqual(['C']);
  expect(folder.files('A')).toEqual(['A/b.txt','A/C/d.txt']);
  expect(text(folder.read('e.txt'))).toBe('3');
  const sub=gameSubfolder(folder,'A');
  expect(sub.files('')).toEqual(['b.txt','C/d.txt']);expect(sub.folders('')).toEqual(['C']);expect(text(sub.read('C/d.txt'))).toBe('2');
 });
 it('finds a language by folder or short name; the archive wins over a folder of the same name',()=>{
  expect(legacyLanguageName('Testish (Testé)')).toBe('Testish');expect(legacyLanguageName('Plain')).toBe('Plain');
  const archive=handMadeTar([{name:'LanguageInfo.xml',text:'<LanguageInfo><languageWorkerClass>LanguageWorker_French</languageWorkerClass></LanguageInfo>'}]);
  const core=memoryGameFolder([
   ['Languages/English/LanguageInfo.xml',bytes('<LanguageInfo/>')],
   ['Languages/Testish (Testé)/LanguageInfo.xml',bytes('<LanguageInfo/>')],
   ['Languages/Testish (Testé).tar',archive],
   ['Languages/Other.tar',handMadeTar([{name:'x.txt',text:'y'}])],
  ]);
  expect(gameLanguageNames(core).sort()).toEqual(['English','Other','Testish (Testé)']);
  const lang=openGameLanguage(core,'testish')!;
  expect([lang.folderName,lang.source]).toEqual(['Testish (Testé)','Languages/Testish (Testé).tar']);
  expect(text(lang.folder.read('LanguageInfo.xml'))).toContain('French');
  expect(openGameLanguage(core,'English')!.source).toBe('Languages/English');
  expect(openGameLanguage(core,'Absent')).toBeUndefined();
 });
});

// A hand-made « Data/Core »: invented packs, words and factions.
const DEFS=`<?xml version="1.0" encoding="utf-8" ?>
<Defs>
 <RulePackDef>
  <defName>NamerTest</defName>
  <include><li>UtilTest</li></include>
  <rulePack>
   <rulesStrings><li>r_name->[thing] [Digit]</li></rulesStrings>
   <rulesFiles><li>thing->Words/Nouns/Things</li></rulesFiles>
  </rulePack>
 </RulePackDef>
 <RulePackDef>
  <defName>UtilTest</defName>
  <rulePack>
   <rulesStrings><li>util->kept</li><li>util2->also kept</li><li>util3->line\\nbreak</li></rulesStrings>
   <rulesFiles><li>only->Words/Nouns/Only</li><li>none->Words/Nouns/Absent</li><li>broken</li></rulesFiles>
  </rulePack>
 </RulePackDef>
 <RulePackDef>
  <defName>GlobalUtility</defName>
  <rulePack>
   <rulesRaw>
    <li Class="Rule_Number"><keyword>Digit</keyword><range>0~9</range></li>
    <li Class="Rule_NamePerson"><keyword>NamePerson</keyword></li>
    <li Class="Rule_NamePerson"><keyword>NamePersonFemale</keyword><gender>Female</gender></li>
   </rulesRaw>
  </rulePack>
 </RulePackDef>
</Defs>`;
const FACTIONS=`<Defs>
 <FactionDef Name="BaseTest" Abstract="True"><factionNameMaker>NamerTest</factionNameMaker><settlementNameMaker>UtilTest</settlementNameMaker></FactionDef>
 <FactionDef ParentName="BaseTest"><defName>ChildTest</defName></FactionDef>
 <FactionDef ParentName="BaseTest"><defName>OverrideTest</defName><settlementNameMaker>NamerTest</settlementNameMaker></FactionDef>
 <FactionDef><defName>FixedTest</defName><fixedName>Old name</fixedName></FactionDef>
 <FactionDef><defName>InjectedFixed</defName><factionNameMaker>NamerTest</factionNameMaker></FactionDef>
</Defs>`;
const INJECTED=`<?xml version="1.0" encoding="UTF-8"?>
<LanguageData>
 <!-- EN: ignored comment -->
 <NamerTest.rulePack.rulesStrings>
  <li>r_name->[thing] du [only]</li>
  <li>r_name(p=2)->[thing]</li>
 </NamerTest.rulePack.rulesStrings>
 <UtilTest.rulePack.rulesStrings.0>remplace->oui</UtilTest.rulePack.rulesStrings.0>
 <UtilTest.rulePack.rulesStrings.1>TODO</UtilTest.rulePack.rulesStrings.1>
 <UtilTest.rulePack.rulesStrings.9>hors->liste</UtilTest.rulePack.rulesStrings.9>
 <Missing.rulePack.rulesStrings><li>x->y</li></Missing.rulePack.rulesStrings>
</LanguageData>`;
function handMadeCore() {
 const language=handMadeTar([
  {name:'LanguageInfo.xml',text:'<LanguageInfo><languageWorkerClass>LanguageWorker_French</languageWorkerClass></LanguageInfo>'},
  {name:'DefInjected/'},{name:'DefInjected/RulePackDef/'},
  {name:'DefInjected/RulePackDef/Namers.xml',text:'﻿'+INJECTED},
  {name:'DefInjected/FactionDefs/F.xml',text:'<LanguageData><FixedTest.fixedName>Nom fixe</FixedTest.fixedName><InjectedFixed.fixedName>Nid zol</InjectedFixed.fixedName></LanguageData>'},
  {name:'Strings/Words/Nouns/Things.txt',text:'// commentaire\r\nbrume\r\n  galet  \r\n\r\nrive // fin\n'},
 ]);
 return memoryGameFolder([
  ['Defs/RulePackDefs/Namers.xml',bytes(DEFS)],
  ['Defs/FactionDefs/Factions.xml',bytes(FACTIONS)],
  ['Defs/Other/Unrelated.xml',bytes('<Defs><ThingDef><defName>X</defName></ThingDef></Defs>')],
  ['Languages/English/LanguageInfo.xml',bytes('<LanguageInfo><languageWorkerClass>LanguageWorker_English</languageWorkerClass></LanguageInfo>')],
  ['Languages/English/Strings/Words/Nouns/Things.txt',bytes('fog\nstone\n')],
  ['Languages/English/Strings/Words/Nouns/Only.txt',bytes('only-english\n')],
  ['Languages/English/Strings/Top.txt',bytes('ignored at the top of Strings\n')],
  ['Languages/Testish (Testé).tar',language],
 ]);
}
const rulesText=(rules:readonly {kind:string;keyword:string|null;output?:string|null;strings?:readonly string[]}[])=>rules.map(r=>r.kind==='file'?`${r.keyword}<${r.strings!.join('|')}>`:r.kind==='string'?`${r.keyword}->${r.output}`:`${r.keyword}:${r.kind}`);

describe('grammar loader on a hand-made game',()=>{
 it('applies the active language: whole lists, single items, TODO kept, word lists with English fallback',()=>{
  const g=loadGameGrammar(handMadeCore(),'Testish');
  expect(g.language).toEqual({folderName:'Testish (Testé)',source:'Languages/Testish (Testé).tar',worker:'LanguageWorker_French',isDefault:false});
  const db=g.grammar;
  expect(rulesText(db.rulesImmediate('NamerTest',false)!)).toEqual(['r_name->[thing] du [only]','r_name->[thing]','thing<brume|galet|rive >']);
  expect(rulesText(db.rulesImmediate('NamerTest',true)!)).toEqual(['r_name->[thing] [Digit]','thing<brume|galet|rive >']);
  expect(rulesText(db.rulesImmediate('UtilTest',false)!)).toEqual(['remplace->oui','util2->also kept','util3->line\nbreak','only<only-english>','none<>']);
  expect(rulesText(db.rulesPlusIncludes('NamerTest',false)).slice(3)).toEqual(['remplace->oui','util2->also kept','util3->line\nbreak','only<only-english>','none<>']);
  expect(db.firstRuleKeyword('NamerTest',false)).toBe('r_name');expect(db.firstRuleKeyword('GlobalUtility',false)).toBe('Digit');
  const weights=db.rulesImmediate('NamerTest',false)!.map(r=>r.kind==='string'?r.weight:-1);expect(weights).toEqual([1,2,-1]);
  expect(rulesText(db.rulesImmediate('GlobalUtility',false)!)).toEqual(['Digit:number','NamePerson:person','NamePersonFemale:person']);
  expect(g.counts).toMatchObject({rulePacks:3,injectedPacks:2,activeStringFiles:1,defaultStringFiles:2,personNames:0});
  expect(g.problems.some(p=>p.includes('Words/Nouns/Absent'))).toBe(true);
  expect(g.problems.some(p=>p.includes('hors de la liste'))).toBe(true);
  expect(g.problems.some(p=>p.includes('liste de mots illisible'))).toBe(true);
  expect(nameFilesReachable(db,'NamerTest')).toEqual([{path:'Words/Nouns/Things',language:'Testish (Testé)'},{path:'Words/Nouns/Only',language:'English'}]);
 });
 it('resolves faction name packs through inheritance and translated fixed names',()=>{
  const g=loadGameGrammar(handMadeCore(),'Testish (Testé)');
  expect(Object.fromEntries(g.factions)).toEqual({
   ChildTest:{factionNameMaker:'NamerTest',settlementNameMaker:'UtilTest',fixedName:null},
   OverrideTest:{factionNameMaker:'NamerTest',settlementNameMaker:'NamerTest',fixedName:null},
   FixedTest:{factionNameMaker:null,settlementNameMaker:null,fixedName:'Nom fixe'},
   // An injected fixed name applies even without an English one.
   InjectedFixed:{factionNameMaker:'NamerTest',settlementNameMaker:null,fixedName:'Nid zol'},
  });
 });
 it('in English nothing is injected and the word lists are English',()=>{
  const g=loadGameGrammar(handMadeCore(),'English');
  expect(g.language).toMatchObject({worker:'LanguageWorker_English',isDefault:true});
  expect(rulesText(g.grammar.rulesImmediate('NamerTest',false)!)).toEqual(['r_name->[thing] [Digit]','thing<fog|stone>']);
  expect(g.factions.get('FixedTest')!.fixedName).toBe('Old name');
  expect(g.counts).toMatchObject({injectedPacks:0,activeStringFiles:2,defaultStringFiles:0});
 });
 it('refuses an unknown language and a language worker it does not reproduce',()=>{
  expect(()=>loadGameGrammar(handMadeCore(),'Absent')).toThrow(/introuvable/);
  const core=memoryGameFolder([['Defs/a.xml',bytes('<Defs/>')],['Languages/English/LanguageInfo.xml',bytes('<LanguageInfo/>')],['Languages/Polski/LanguageInfo.xml',bytes('<LanguageInfo><languageWorkerClass>LanguageWorker_Polish</languageWorkerClass></LanguageInfo>')]]);
  expect(()=>loadGameGrammar(core,'Polski')).toThrow(/non prise en charge/);
 });
 it('reads a Unity text asset by name and the first names for person rules',()=>{
  // Serialized object: name length, name, padding to 4, text length, text.
  const asset=(name:string,body:string)=>{const n=bytes(name),b=bytes(body),pad=(4-n.length%4)%4,out=new Uint8Array(4+n.length+pad+4+b.length),v=new DataView(out.buffer);
   v.setInt32(0,n.length,true);out.set(n,4);v.setInt32(4+n.length+pad,b.length,true);out.set(b,8+n.length+pad);return out;};
  const parts=[new Uint8Array([1,2,3,4,5]),asset('First_Male','Zolan\nKrumo\n'),asset('Other','x'),asset('First_Female','﻿Vexa\n')];
  const file=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let at=0;for(const p of parts){file.set(p,at);at+=p.length;}
  expect(unityTextAsset(file,'First_Male')).toBe('Zolan\nKrumo\n');expect(unityTextAsset(file,'First_Female')).toBe('Vexa\n');expect(unityTextAsset(file,'Missing')).toBeUndefined();
  const g=loadGameGrammar(handMadeCore(),'English',{resources:file});
  expect(g.grammar.personNames).toEqual({male:['Zolan','Krumo'],female:['Vexa']});expect(g.counts.personNames).toBe(3);
 });
});
