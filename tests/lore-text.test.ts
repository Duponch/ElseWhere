// The lore lookup: the installed game's text when loaded, Elsewhere's
// otherwise, per category; the game's person texts resolved for the person.
// Hand-made texts with invented words only.
import {afterEach,describe,expect,it} from 'vitest';
import {readGameLoreFromHandle} from '../src/lore/game-lore-browser';
import {animalDescription,animalTitle,backstoryLoreId,biomeDescription,biomeTitle,buildingDescription,buildingTitle,cropTitle,factionDescription,factionLeaderTitle,factionTypeLabel,
 gameLoreText,gameLoreTexts,gameLoreTextsOf,itemDescription,itemTitle,loreText,loreTextsRevision,onLoreTextsChange,resolveGamePersonText,roleTitle,setGameLoreTexts,
 storyDescription,storyShortTitle,storyTitle,traitLabel,traitTexts,traitTooltip,wildPlantTitle} from '../src/lore/lore-text';
import {CHILDHOODS} from '../src/sim/colonist-backgrounds';
import {CORE_BACKSTORIES_370} from '../src/sim/core-backstories-370';
import {TRAITS} from '../src/sim/traits';
import {ITEM_DEFINITIONS} from '../src/sim/items';
import {ANIMAL_SPECIES} from '../src/sim/animal-species';
import {BIOME_LABELS} from '../src/sim/site';
import {CARAVAN_GUARDS_332} from '../src/sim/trader-caravans-332';
import {fakeDirectory,handMadeRimWorld} from './helpers/hand-made-rimworld';
import type {LoreEntry} from '../src/lore/lore-types';

async function loadZorgish(language='Zorgish (Zorg)'){
 const result=await readGameLoreFromHandle(fakeDirectory('RimWorld',handMadeRimWorld()),language);
 setGameLoreTexts(gameLoreTextsOf('RimWorld 9.9.9 · '+language,result.language.folderName,result.language.worker,result.entries,result.keyed));
 return result;
}
afterEach(()=>setGameLoreTexts(undefined));
const ada={name:'Ada',sex:'female' as const},noe={name:'Noé',sex:'male' as const};

describe('without the installed game',()=>{
 it('every lookup returns Elsewhere’s own text',()=>{
  expect(gameLoreTexts()).toBeUndefined();
  const core=CORE_BACKSTORIES_370.SewerKid57;
  expect(storyTitle('childhood','SewerKid57','female')).toBe(core.labelFemale);expect(storyTitle('childhood','SewerKid57','male')).toBe(core.label);
  expect(storyShortTitle('childhood','SewerKid57','male')).toBe(core.labelShort);
  expect(storyDescription('childhood','SewerKid57',ada)).toBe(core.description);
  expect(storyTitle('childhood','settlement-child')).toBe(CHILDHOODS['settlement-child'].label);
  expect(traitLabel('optimist','female')).toBe(TRAITS.optimist.label);
  expect(traitTexts('optimist',ada)).toEqual({label:TRAITS.optimist.label,description:TRAITS.optimist.description,rule:undefined});
  expect(traitTooltip('optimist',ada)).toBe(TRAITS.optimist.description);
  expect(factionTypeLabel('OutlanderCivil','Union civile')).toBe('Union civile');expect(factionDescription('OutlanderCivil')).toBeUndefined();
  expect(factionLeaderTitle('OutlanderCivil','Dirigeant','female')).toBe('Dirigeant');
  expect(itemTitle('wood',ITEM_DEFINITIONS.wood.label)).toBe(ITEM_DEFINITIONS.wood.label);expect(itemDescription('wood')).toBeUndefined();
  expect(animalTitle('muffalo',ANIMAL_SPECIES.muffalo.label)).toBe(ANIMAL_SPECIES.muffalo.label);expect(animalDescription('muffalo')).toBeUndefined();
  expect(biomeTitle('temperate-forest',BIOME_LABELS['temperate-forest'])).toBe(BIOME_LABELS['temperate-forest']);
  expect(resolveGamePersonText('[PAWN_nameDef] {PAWN_pronoun}',ada)).toBe('[PAWN_nameDef] {PAWN_pronoun}');
 });
});

describe('with the installed game loaded',()=>{
 it('stories: titles by sex (TitleFor, TitleShortFor) and the text resolved for the person',async()=>{
  await loadZorgish();
  expect(backstoryLoreId('childhood','SewerKid57')).toBe('histoires/enfance-base/SewerKid57');
  expect(backstoryLoreId('adulthood','builder')).toBe('histoires/adulte-elsewhere/builder');
  expect(storyTitle('childhood','SewerKid57','male')).toBe('gamin zorpe');expect(storyTitle('childhood','SewerKid57','female')).toBe('gamine zorpe');
  expect(storyTitle('childhood','SewerKid57')).toBe('gamin zorpe');
  expect(storyShortTitle('childhood','SewerKid57','female')).toBe('zorpling');
  // French post-processing (« de il » → « d'il »), capitalized sentences, gendered forms, pronouns.
  expect(storyDescription('childhood','SewerKid57',ada)).toBe('Ada a grandi parmi les cuves de la blam.\n\nEllz aimait saz quibs. D\'il');
  expect(storyDescription('childhood','SewerKid57',noe)).toBe('Noé a grandi parmi les cuves du blim.\n\nIlz aimait sonz quibs. D\'il');
  expect(storyDescription('childhood','SewerKid57',{name:'Lou'})).toBe('Lou a grandi parmi les cuves du blom.\n\nIt-z aimait its-z quibs. D\'il');
  // [PAWN_title]: the person's title.
  expect(storyDescription('adulthood','NavyScientist52',{...noe,title:'quib scholar'})).toBe('Noé studied quibs as a quib scholar.');
  // Elsewhere's own stories have no game counterpart.
  expect(storyTitle('childhood','settlement-child')).toBe(CHILDHOODS['settlement-child'].label);
  // A story the game lacks keeps Elsewhere's text.
  expect(storyTitle('childhood','MedievalSlave49')).toBe(CORE_BACKSTORIES_370.MedievalSlave49.label);
 });

 it('traits: label by sex in Elsewhere’s case, the game’s text then Elsewhere’s rule',async()=>{
  await loadZorgish();
  expect(traitLabel('optimist','male')).toBe('Radieux');expect(traitLabel('optimist','female')).toBe('Radieuse');
  expect(traitLabel('depressive')).toBe('Très morose');
  const texts=traitTexts('optimist',ada);
  expect(texts).toEqual({label:'Radieuse',description:'Ada sourit à laz, zorpine.',rule:TRAITS.optimist.description});
  expect(traitTooltip('optimist',noe)).toBe(`Noé sourit à luiz, zorpin.\n\n${TRAITS.optimist.description}`);
  expect(traitTooltip('kind',noe)).toBe(`Noé is zib to luiz.\n\n${TRAITS.kind.description}`);
  // A trait the game lacks keeps Elsewhere's.
  expect(traitLabel('bloodlust')).toBe(TRAITS.bloodlust.label);
 });

 it('factions, places, things and roles',async()=>{
  await loadZorgish();
  expect(factionTypeLabel('OutlanderCivil','Union civile')).toBe('Union des flarns');
  expect(factionDescription('OutlanderCivil')).toBe('Flarns of the plain.');
  expect(factionLeaderTitle('OutlanderCivil','Dirigeant','male')).toBe('Grand flarn');expect(factionLeaderTitle('OutlanderCivil','Dirigeant','female')).toBe('Grande flarne');
  expect(factionTypeLabel('Pirate','Pirates')).toBe('Pirates');
  expect(itemTitle('wood','Bois')).toBe('Planche zorpe');expect(itemDescription('wood')).toBe('Plonk from trees.');
  expect(itemTitle('steel','Acier')).toBe('Acier');
  expect(animalTitle('muffalo','Muffalo')).toBe('Muffo');expect(animalDescription('muffalo')).toBe('A woolly muffo.');
  expect(wildPlantTitle('oak','Chêne')).toBe('Oakle');expect(cropTitle('rice','Riz')).toBe('Ricel');
  expect(buildingTitle('wall','Mur')).toBe('Wallo');expect(buildingDescription('wall')).toBe('A wallo.');
  expect(biomeTitle('temperate-forest','Forêt tempérée')).toBe('Zorg woods');expect(biomeDescription('temperate-forest')).toBe('Woods of zorg.');
  expect(roleTitle('garde-town-guard',CARAVAN_GUARDS_332['town-guard'].label)).toBe('Zorp guard');
  // A fallback in lower case keeps the game's case.
  expect(loreText('descriptions/objets/wood','title','bois')).toBe('planche zorpe');
  expect(gameLoreText('descriptions/objets/wood','description')).toBe('Plonk from trees.');
 });

 it('falls back again once unloaded, and tells listeners each change',async()=>{
  const seen:number[]=[],stop=onLoreTextsChange(()=>seen.push(loreTextsRevision()));
  const before=loreTextsRevision();await loadZorgish();
  expect(itemTitle('wood','Bois')).toBe('Planche zorpe');
  setGameLoreTexts(undefined);expect(itemTitle('wood','Bois')).toBe('Bois');
  stop();setGameLoreTexts(gameLoreTextsOf('x','English','LanguageWorker_English',[],{}));
  expect(seen).toEqual([before+1,before+2]);
 });

 it('resolves the game’s person symbols as GrammarResolverSimple and AdjustedFor do',()=>{
  const entries:LoreEntry[]=[];
  setGameLoreTexts(gameLoreTextsOf('x','English','LanguageWorker_English',entries,{Prohe:'he',Proshe:'she',Proit:'it',Prohis:'his',Proher:'her',Proits:'its',ProhimObj:'him',ProherObj:'her',ProitObj:'it',Male:'male',Female:'female',NoneLower:'none'}));
  // Two forms: none takes the male one; three forms: none takes the third.
  expect(resolveGamePersonText('{PAWN_gender ? a : b}|{PAWN_gender ? a : b : c}',{name:'X'})).toBe('A|c');
  expect(resolveGamePersonText('x {PAWN_gender ? a : b}|{PAWN_gender ? a : b : c}|{PAWN_gender}',{name:'X',sex:'female'})).toBe('X b|b|female');
  // Symbols of another argument vanish (spaces merged as the language worker does); an unknown bracket symbol stays.
  expect(resolveGamePersonText('[PAWN_nameDef] met {OTHER_name} and [PAWN_mystery].',{name:'Mina',sex:'female'})).toBe('Mina met and [PAWN_mystery].');
  expect(resolveGamePersonText('{PAWN_nameDef} told {PAWN_objective}: [PAWN_possessive] turn. a apple',{name:'Mina',sex:'female'})).toBe('Mina told her: Her turn. An apple');
 });
});
