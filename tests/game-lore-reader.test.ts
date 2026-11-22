// The reader of the installed game's lore texts, on a hand-made folder with
// invented words, read through a fake browser directory handle.
import {describe,expect,it} from 'vitest';
import {gameLanguageNamesFromHandle,gameVersionFromHandle,locateGameContent,readGameFolderFromHandle} from '../src/import/rimworld/game-files-browser';
import {gameLoreFileSelection,normalizedHandle,readGameLore} from '../src/lore/game-lore-reader';
import {NOT_A_GAME_FOLDER,readGameLoreFromHandle} from '../src/lore/game-lore-browser';
import {gameLoreTargets} from '../src/lore/game-lore-mapping';
import {fakeDirectory,handMadeRimWorld,type HandMadeTree} from './helpers/hand-made-rimworld';

const byId=(entries:readonly {id:string}[],id:string)=>entries.find(entry=>entry.id===id) as Record<string,unknown>|undefined;

describe('game lore reader',()=>{
 it('normalizes list handles as the game does',()=>{
  expect(normalizedHandle('very glum')).toBe('very_glum');
  expect(normalizedHandle(' Kind-hearted. {PAWN_x} ')).toBe('Kindhearted');
  expect(normalizedHandle('42')).toBe('_42');
  expect(normalizedHandle('a  b__c')).toBe('a_b_c');
 });

 it('finds the base content from the install folder, its Data folder or Core itself, and lists languages and version',async()=>{
  const tree=handMadeRimWorld(),root=fakeDirectory('RimWorld',tree);
  const fromRoot=await locateGameContent(root);expect(fromRoot?.path).toBe('Data/Core');
  expect(await gameVersionFromHandle(fromRoot!.install)).toBe('9.9.9 rev1');
  const data=fakeDirectory('Data',tree.Data as HandMadeTree);expect((await locateGameContent(data))?.path).toBe('Core');
  const core=fakeDirectory('Core',(tree.Data as HandMadeTree).Core as HandMadeTree);expect((await locateGameContent(core))?.path).toBe('');
  expect(await locateGameContent(fakeDirectory('Documents',{'notes.txt':'x'}))).toBeUndefined();
  expect(await gameLanguageNamesFromHandle(fromRoot!.core)).toEqual(['English','Other (Autre)','Zorgish (Zorg)']);
 });

 it('reads only the definitions, the chosen language and English Keyed strings',async()=>{
  const root=fakeDirectory('RimWorld',handMadeRimWorld()),core=(await locateGameContent(root))!.core;
  await readGameFolderFromHandle(core,gameLoreFileSelection('Zorgish (Zorg)'));
  const reads=(root as {reads:string[]}).reads;
  expect(reads.some(path=>path.startsWith('Data/Core/Defs/'))).toBe(true);
  expect(reads).toContain('Data/Core/Languages/Zorgish (Zorg).tar');
  expect(reads).toContain('Data/Core/Languages/English/Keyed/Pronouns.xml');
  expect(reads.filter(path=>path.includes('Other (Autre)')||path.includes('Strings')||path.includes('resources.assets'))).toEqual([]);
 });

 it('applies injections, TODO, list handles and indexes, inheritance and baseDesc, and reports what the game lacks',async()=>{
  const result=await readGameLoreFromHandle(fakeDirectory('RimWorld',handMadeRimWorld()),'Zorgish (Zorg)');
  expect(result.language).toEqual({folderName:'Zorgish (Zorg)',source:'Languages/Zorgish (Zorg).tar',worker:'LanguageWorker_French',workerClass:'LanguageWorker_French'});
  expect(result.version).toBe('9.9.9 rev1');expect(result.corePath).toBe('Data/Core');expect(result.problems).toEqual([]);
  const sewer=byId(result.entries,'histoires/enfance-base/SewerKid57')!;
  expect(sewer).toMatchObject({origin:'installed',category:'histoires',group:'enfance-base',key:'SewerKid57',title:'gamin zorpe',titleFemale:'gamine zorpe',shortTitle:'zorpling',reference:'BackstoryDef SewerKid57'});
  expect(sewer.description).toBe('[PAWN_nameDef] a grandi parmi les cuves {PAWN_gender ? du blim : de la blam : du blom}.\n\n[PAWN_pronoun] aimait [PAWN_possessive] quibs. de il');
  expect(sewer.source).toEqual({file:'Data/Core/Defs/BackstoryDefs/Zorp.xml',symbol:'BackstoryDef SewerKid57'});
  // TODO keeps the definition's text.
  expect(byId(result.entries,'histoires/adulte-base/NavyScientist52')).toMatchObject({title:'quib scholar',shortTitle:'scholar',description:'[PAWN_nameDef] studied quibs as a [PAWN_title].'});
  // Degrees by handle and by index; untranslated items keep the definition.
  expect(byId(result.entries,'traits/traits/optimist')).toMatchObject({title:'radieux',titleFemale:'radieuse',description:'[PAWN_nameDef] sourit à {PAWN_objective}, zorp{PAWN_gender ? in : ine : in(e)}.'});
  expect(byId(result.entries,'traits/traits/depressive')).toMatchObject({title:'très morose',description:'[PAWN_nameDef] frowns a lot.'});
  expect(byId(result.entries,'traits/traits/pessimist')).toMatchObject({title:'glum'});
  expect(byId(result.entries,'traits/traits/kind')).toMatchObject({title:'zib'});
  // Faction: injected label (folder « FactionDefs » accepted), inherited description, leader titles.
  expect(byId(result.entries,'factions/types/OutlanderCivil')).toMatchObject({title:'union des flarns',description:'Flarns of the plain.'});
  expect(byId(result.entries,'factions/titres-de-chef/OutlanderCivil')).toMatchObject({title:'grand flarn',titleFemale:'grande flarne'});
  expect(byId(result.entries,'descriptions/objets/wood')).toMatchObject({title:'planche zorpe',description:'Plonk from trees.'});
  expect(byId(result.entries,'descriptions/animaux/muffalo')).toMatchObject({title:'muffo'});
  expect(byId(result.entries,'descriptions/plantes-sauvages/oak')).toMatchObject({title:'oakle'});
  expect(byId(result.entries,'descriptions/cultures/rice')).toMatchObject({title:'ricel'});
  expect(byId(result.entries,'descriptions/batiments/wall')).toMatchObject({title:'wallo'});
  expect(byId(result.entries,'lieux/milieux/temperate-forest')).toMatchObject({title:'zorg woods',description:'Woods of zorg.'});
  expect(byId(result.entries,'recits/scenarios/crashlanded')).toMatchObject({title:'Zorp crash',description:'Three zorps fall.'});
  expect(byId(result.entries,'personnes/roles/caravane-outlander-bulk')).toMatchObject({title:'bulk zorp trader'});
  expect(byId(result.entries,'personnes/roles/garde-town-guard')).toMatchObject({title:'zorp guard'});
  // Every entry is one of the mapped ids; the others are reported missing.
  const targets=new Set(gameLoreTargets().map(target=>target.id));
  for(const entry of result.entries)expect(targets.has(entry.id),entry.id).toBe(true);
  expect(result.entries.length+result.missing.length).toBe(targets.size);
  expect(result.missing).toContain('histoires/enfance-base/MedievalSlave49');
  // Pronoun words: the language's, then English's.
  expect(result.keyed).toMatchObject({Prohe:'ilz',Proshe:'ellz',Proit:'it-z',Prohis:'sonz',ProhimObj:'luiz',ProitObj:'it-z'});
 });

 it('reads English from its folder, without injections',async()=>{
  const result=await readGameLoreFromHandle(fakeDirectory('RimWorld',handMadeRimWorld()),'English');
  expect(result.language.worker).toBe('LanguageWorker_English');
  expect(byId(result.entries,'histoires/enfance-base/SewerKid57')).toMatchObject({title:'zorp kid',titleFemale:'zorp lass',description:'[PAWN_nameDef] grew among the vats of {PAWN_gender ? blim : blam : blom}.\n\n[PAWN_pronoun] liked [PAWN_possessive] quibs.'});
  expect(result.keyed.Prohe).toBe('he-z');
 });

 it('refuses a folder without the game and an unknown language, in French',async()=>{
  await expect(readGameLoreFromHandle(fakeDirectory('Documents',{'a.txt':'x'}),'English')).rejects.toThrow(NOT_A_GAME_FOLDER);
  await expect(readGameLoreFromHandle(fakeDirectory('RimWorld',handMadeRimWorld()),'Klingon')).rejects.toThrow('Langue introuvable dans le jeu : Klingon.');
 });

 it('maps every registry group it can, by Core defName or the importer tables',()=>{
  const ids=gameLoreTargets().map(target=>target.id),groups=new Set(ids.map(id=>id.split('/').slice(0,2).join('/')));
  expect([...groups].sort()).toEqual(['descriptions/animaux','descriptions/batiments','descriptions/cultures','descriptions/objets','descriptions/plantes-sauvages',
   'factions/titres-de-chef','factions/types','histoires/adulte-base','histoires/enfance-base','lieux/milieux','personnes/roles','recits/scenarios','traits/traits']);
  expect(new Set(ids).size).toBe(ids.length);
  // Adapted mappings (a goat that becomes an ibex) never lend the game's text: the ibex reads Core's Ibex.
  expect(gameLoreTargets().find(target=>target.id==='descriptions/animaux/ibex')?.defName).toBe('Ibex');
  expect(gameLoreTargets().some(target=>target.defName==='Goat')).toBe(false);
 });

 it('reads the same folder held in memory (Node tools), as readGameLore',()=>{
  // The whole tree under Data/Core, as nodeGameFolder would list it.
  const entries:[string,Uint8Array][]=[];const enc=new TextEncoder();
  const walk=(tree:HandMadeTree,path:string)=>{for(const [name,value] of Object.entries(tree)){const at=path?`${path}/${name}`:name;if(typeof value==='string')entries.push([at,enc.encode(value)]);else if(value instanceof Uint8Array)entries.push([at,value]);else walk(value,at);}};
  walk(((handMadeRimWorld().Data as HandMadeTree).Core) as HandMadeTree,'');
  return import('../src/import/rimworld/game-files').then(({memoryGameFolder})=>{
   const result=readGameLore(memoryGameFolder(entries),'Zorgish');
   expect(byId(result.entries,'traits/traits/optimist')?.title).toBe('radieux');
  });
 });
});
