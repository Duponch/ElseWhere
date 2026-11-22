// Opt-in: the lore texts of the real installed RimWorld (RIMWORLD_DIR, the
// game folder; RIMWORLD_LANGUAGE, default French). Nothing read is printed or
// stored: only counts and checks on the shape of the texts.
import {describe,expect,it} from 'vitest';
import {rimworldCoreFolder} from '../src/import/rimworld/game-files-node';
import {readGameLore} from '../src/lore/game-lore-reader';
import {gameLoreTextsOf,resolveGamePersonText,setGameLoreTexts,storyDescription,traitTooltip} from '../src/lore/lore-text';
import {gameLoreCoverage} from '../src/lore/game-lore-coverage';
import {LORE_CATEGORIES,LORE_ENTRIES} from '../src/lore/lore-registry';
import {CORE_BACKSTORY_LIST_370} from '../src/sim/core-backstories-370';
import {TRAITS,type TraitId} from '../src/sim/traits';

const dir=process.env.RIMWORLD_DIR,core=dir?rimworldCoreFolder(dir):undefined,language=process.env.RIMWORLD_LANGUAGE??'French';

describe.skipIf(!core)('the installed game’s lore texts (opt-in, RIMWORLD_DIR)',()=>{
 it('reads every Core backstory and trait, and the other mapped groups, without a loader problem',()=>{
  const started=performance.now(),result=readGameLore(core!,language,{corePath:'Data/Core'}),ms=performance.now()-started;
  expect(result.problems).toEqual([]);
  const ids=new Set(result.entries.map(entry=>entry.id));
  for(const story of CORE_BACKSTORY_LIST_370)expect(ids.has(`histoires/${story.slot==='childhood'?'enfance':'adulte'}-base/${story.id}`),story.id).toBe(true);
  for(const key of Object.keys(TRAITS))expect(ids.has(`traits/traits/${key}`),key).toBe(true);
  const coverage=gameLoreCoverage(LORE_CATEGORIES,LORE_ENTRIES,new Map(result.entries.map(entry=>[entry.id,entry])));
  const group=(id:string)=>coverage.groups.find(g=>g.id===id)!;
  for(const id of ['factions/types','personnes/roles','lieux/milieux','descriptions/animaux','descriptions/plantes-sauvages'])expect(group(id).matched,id).toBe(group(id).total);
  expect(group('descriptions/objets').matched).toBeGreaterThan(50);expect(group('descriptions/batiments').matched).toBeGreaterThan(50);
  // Counts only, never a text.
  console.info(`Textes du jeu (${result.language.folderName}) : ${result.entries.length} lus, ${result.missing.length} sans définition, ${coverage.matched} / ${coverage.total} entrées du registre, ${Math.round(ms)} ms.`);
 });
 it('resolves every person symbol of the stories and traits for a man, a woman and an unknown sex',()=>{
  const result=readGameLore(core!,language);
  setGameLoreTexts(gameLoreTextsOf('opt-in',result.language.folderName,result.language.worker,result.entries,result.keyed));
  try{
   for(const sex of ['male','female',undefined] as const){
    const person={name:'Zorp',sex,title:'zorpeur'};
    // Booleans only, so that a failure never prints the game's text.
    for(const story of CORE_BACKSTORY_LIST_370)expect(/\[PAWN_|\{PAWN_/.test(storyDescription(story.slot,story.id,person)),story.id).toBe(false);
    for(const key of Object.keys(TRAITS) as TraitId[])expect(/\[PAWN_|\{PAWN_/.test(traitTooltip(key,person)),key).toBe(false);
   }
   expect(resolveGamePersonText('[PAWN_pronoun]',{name:'Zorp',sex:'female'})==='[PAWN_pronoun]').toBe(false);
  }finally{setGameLoreTexts(undefined);}
 });
});
