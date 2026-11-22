import {ADULTHOODS,CHILDHOODS} from '../sim/colonist-backgrounds.ts';
import {CORE_BACKSTORY_LIST_370} from '../sim/core-backstories-370.ts';
import {TRAITS} from '../sim/traits.ts';
import {WORLD_FACTION_CHOICES} from '../ui/world-draft-controls.ts';
import {STARTING_CANDIDATE_NAMES} from '../sim/starting-candidates.ts';
import {ARRIVAL_NAMES} from '../sim/arrival-state.ts';
import {STARTING_PET_NAME_FIRST_256,STARTING_PET_NAME_SECOND_256} from '../sim/starting-pet-birth-256.ts';
import {ANCIENT_NAME_SYLLABLES_256} from '../sim/ancient-human-name-256.ts';
import {CARAVAN_GUARDS_332,CARAVAN_TRADERS_332,CARAVAN_TRADER_KINDS_332} from '../sim/trader-caravans-332.ts';
import {BIOME_LABELS} from '../sim/site.ts';
import {SCENARIOS} from '../sim/scenario-definitions.ts';
import {LETTER_CLASSES_352} from '../sim/letters-352.ts';
import {NOVEL_STORIES_295,NOVEL_TITLE_ENDS_295,NOVEL_TITLE_STARTS_295} from '../sim/book-state-295.ts';
import {ITEM_DEFINITIONS} from '../sim/items.ts';
import {ANIMAL_SPECIES} from '../sim/animal-species.ts';
import {FLORA_DEFINITIONS} from '../sim/biome-flora.ts';
import {PLANT_DEFINITIONS} from '../sim/plants.ts';
import {toolDefinitions} from '../ui3d/native-catalog.ts';
import type {LoreCategoryId,LoreCategoryInfo,LoreEntry,LoreSourceRef} from './lore-types.ts';

/** The Architect categories whose tools build a building (orders, zones and
 * floors are left out: actions, areas and surfaces). */
export const LORE_BUILDING_CATEGORIES:readonly string[]=Object.freeze(['structure','furniture','temperature','recreation','power','production','ship']);

type Fields=Partial<Pick<LoreEntry,'title'|'shortTitle'|'titleFemale'|'shortTitleFemale'|'description'|'words'|'reference'|'note'>>;
const src=(file:string,symbol:string):LoreSourceRef=>Object.freeze({file,symbol});
function make(category:LoreCategoryId,group:string,key:string,fields:Fields,source:LoreSourceRef):LoreEntry {
  const out:Record<string,unknown>={id:`${category}/${group}/${key}`,origin:'elsewhere',category,group,key};
  for(const [name,value] of Object.entries(fields))if(value!==undefined&&value!=='')out[name]=Array.isArray(value)?Object.freeze([...value]):value;
  out.source=source;
  return Object.freeze(out) as unknown as LoreEntry;
}

const BACKGROUNDS=src('src/sim/colonist-backgrounds.ts','CHILDHOODS'),ADULT_BACKGROUNDS=src('src/sim/colonist-backgrounds.ts','ADULTHOODS');
const CORE_STORIES=src('src/sim/core-backstory-texts-370.ts','CORE_BACKSTORY_TEXTS_370');

function histories():LoreEntry[] {
  const out:LoreEntry[]=[];
  for(const [key,story] of Object.entries(CHILDHOODS))out.push(make('histoires','enfance-elsewhere',key,{title:story.label,description:story.description},BACKGROUNDS));
  for(const [key,story] of Object.entries(ADULTHOODS))out.push(make('histoires','adulte-elsewhere',key,{title:story.label,description:story.description},ADULT_BACKGROUNDS));
  for(const slot of ['childhood','adulthood'] as const)for(const story of CORE_BACKSTORY_LIST_370)if(story.slot===slot)
    out.push(make('histoires',slot==='childhood'?'enfance-base':'adulte-base',story.id,{title:story.label,shortTitle:story.labelShort,titleFemale:story.labelFemale,shortTitleFemale:story.labelShortFemale,description:story.description,reference:`BackstoryDef ${story.id}`},CORE_STORIES));
  return out;
}
function traits():LoreEntry[] {
  return Object.entries(TRAITS).map(([key,trait])=>make('traits','traits',key,{title:trait.label,description:trait.description,reference:`TraitDef ${trait.def}, degré ${trait.degree}`},src('src/sim/traits.ts','TRAITS')));
}
function factions():LoreEntry[] {
  return WORLD_FACTION_CHOICES.map(choice=>make('factions','types',choice.def,{title:choice.label,reference:`FactionDef ${choice.def}`},src('src/ui/world-draft-controls.ts','WORLD_FACTION_CHOICES')));
}
function people():LoreEntry[] {
  return [
    make('personnes','prenoms','depart',{title:'Prénoms des personnes de départ',words:STARTING_CANDIDATE_NAMES,
      note:'Le prénom de naissance entre dans le hachage qui tire le sexe et l’apparence : changer la liste change les personnes proposées. Ada, Noé et Mina ont aussi une apparence et un portrait écrits pour eux.'},src('src/sim/starting-candidates.ts','STARTING_CANDIDATE_NAMES')),
    make('personnes','prenoms','arrivants',{title:'Prénoms des arrivants et des demandeurs d’asile',words:ARRIVAL_NAMES,
      note:'Un tirage choisit la place dans la liste : sa longueur change le prénom tiré, pas le nombre de tirages.'},src('src/sim/arrival-state.ts','ARRIVAL_NAMES')),
    make('personnes','animaux','premier-mot',{title:'Noms d’animaux de départ : premier mot',words:STARTING_PET_NAME_FIRST_256,
      note:'Le nom est « premier-second » ; il est tiré de nouveau tant qu’il est déjà pris : la longueur des deux listes peut changer le nombre de tirages du monde.'},src('src/sim/starting-pet-birth-256.ts','STARTING_PET_NAME_FIRST_256')),
    make('personnes','animaux','second-mot',{title:'Noms d’animaux de départ : second mot',words:STARTING_PET_NAME_SECOND_256,
      note:'Voir le premier mot.'},src('src/sim/starting-pet-birth-256.ts','STARTING_PET_NAME_SECOND_256')),
    make('personnes','anciens','syllabes',{title:'Syllabes des noms anciens',words:ANCIENT_NAME_SYLLABLES_256,
      note:'Exactement 32 syllabes : chaque mot lit un masque sur 5 bits. Les dormeurs anciens réels portent aujourd’hui un nom fait d’un mot et d’un numéro.'},src('src/sim/ancient-human-name-256.ts','ANCIENT_NAME_SYLLABLES_256')),
    ...Object.entries(CARAVAN_TRADER_KINDS_332).map(([key,kind])=>make('personnes','roles',`caravane-${key}`,{title:kind.label,reference:`TraderKindDef ${kind.core}`,
      note:'Le libellé, avec une majuscule, forme le nom du marchand (« Marchand en gros 3.1 »).'},src('src/sim/trader-caravans-332.ts','CARAVAN_TRADER_KINDS_332'))),
    ...Object.entries(CARAVAN_GUARDS_332).map(([key,guard])=>make('personnes','roles',`garde-${key}`,{title:guard.label,reference:`PawnKindDef ${guard.core}`,
      note:'Le libellé forme le nom du garde de caravane (« Garde 3.2 »).'},src('src/sim/trader-caravans-332.ts','CARAVAN_GUARDS_332'))),
    ...Object.entries(CARAVAN_TRADERS_332).map(([key,trader])=>make('personnes','roles',`marchand-${key}`,{title:trader.label,reference:`PawnKindDef ${trader.core}`},src('src/sim/trader-caravans-332.ts','CARAVAN_TRADERS_332'))),
  ];
}
function places():LoreEntry[] {
  return Object.entries(BIOME_LABELS).map(([key,label])=>make('lieux','milieux',key,{title:label},src('src/sim/site.ts','BIOME_LABELS')));
}
function tales():LoreEntry[] {
  const novels=src('src/sim/book-state-295.ts','NOVEL_TITLE_STARTS_295'),novelNote='Chaque exemplaire tire son texte de sa propre graine, modulo la longueur de la liste ; un roman déjà sauvegardé garde son texte.';
  return [
    ...Object.entries(SCENARIOS).map(([key,scenario])=>make('recits','scenarios',key,{title:scenario.label,description:scenario.description},src('src/sim/scenario-definitions.ts','SCENARIOS'))),
    ...Object.entries(LETTER_CLASSES_352).map(([key,letter])=>make('recits','lettres',key,{title:letter.label,reference:`LetterDef ${letter.def}`},src('src/sim/letters-352.ts','LETTER_CLASSES_352'))),
    make('recits','romans','debuts-de-titre',{title:'Romans : débuts de titre',words:NOVEL_TITLE_STARTS_295,note:novelNote},novels),
    make('recits','romans','fins-de-titre',{title:'Romans : fins de titre',words:NOVEL_TITLE_ENDS_295,note:novelNote},src('src/sim/book-state-295.ts','NOVEL_TITLE_ENDS_295')),
    make('recits','romans','resumes',{title:'Romans : résumés',words:NOVEL_STORIES_295,note:novelNote},src('src/sim/book-state-295.ts','NOVEL_STORIES_295')),
  ];
}
function things():LoreEntry[] {
  return [
    ...Object.entries(ITEM_DEFINITIONS).map(([key,item])=>make('descriptions','objets',key,{title:item.label},src('src/sim/items.ts','ITEM_DEFINITIONS'))),
    ...Object.entries(ANIMAL_SPECIES).map(([key,species])=>make('descriptions','animaux',key,{title:species.label},src('src/sim/animal-species.ts','ANIMAL_SPECIES'))),
    ...Object.entries(FLORA_DEFINITIONS).map(([key,plant])=>make('descriptions','plantes-sauvages',key,{title:plant.label},src('src/sim/biome-flora.ts','FLORA_DEFINITIONS'))),
    ...Object.entries(PLANT_DEFINITIONS).map(([key,plant])=>make('descriptions','cultures',key,{title:plant.label},src('src/sim/plants.ts','PLANT_DEFINITIONS'))),
    ...toolDefinitions.filter(tool=>LORE_BUILDING_CATEGORIES.includes(tool.category)).map(tool=>make('descriptions','batiments',tool.id,{title:tool.title},src('src/ui3d/native-catalog.ts','toolDefinitions'))),
  ];
}

export const LORE_CATEGORIES:readonly LoreCategoryInfo[]=Object.freeze([
  {id:'histoires',label:'Histoires',description:'Les passés des personnes, enfance et âge adulte : ceux écrits pour Elsewhere et les 166 du jeu de base, réécrits en français pour Elsewhere.',
    groups:[{id:'enfance-elsewhere',label:'Enfance · Elsewhere'},{id:'adulte-elsewhere',label:'Âge adulte · Elsewhere'},{id:'enfance-base',label:'Enfance · jeu de base'},{id:'adulte-base',label:'Âge adulte · jeu de base'}],
    pending:[]},
  {id:'traits',label:'Traits',description:'Chaque degré de trait, avec son nom et sa description. La description dit la règle du trait : une autre histoire peut la reformuler, pas la changer.',
    groups:[{id:'traits',label:'Traits'}],pending:[]},
  {id:'factions',label:'Factions',description:'Les types de faction, tels que les nomme l’écran de création du monde.',groups:[{id:'types',label:'Types de faction'}],
    pending:[
      'Noms des factions, des colonies et des chefs : listes non exportées de src/sim/world-faction-generation.ts, dans la génération du monde qu’un autre chantier refait pour tirer les noms comme le jeu ; à lire une fois ce chantier posé.',
      'Libellés « Colonie », « Tribu du joueur », « Anciens » et « Anciens hostiles » : écrits seulement dans des fonctions locales de l’interface (src/ui3d/native-world.ts, en partie répétés dans src/ui3d/native-front.ts) ; à rassembler dans une table avant de les lire.',
      'Titres de chef : aucun en français ; le jeu ne garde que les genres de personne du jeu de base, qui sont une règle de tirage.',
      'Descriptions de faction : aucune n’existe encore.',
    ]},
  {id:'personnes',label:'Personnes',description:'Prénoms, noms d’animaux, syllabes des noms anciens, et rôles qui forment le nom des personnes de passage.',
    groups:[{id:'prenoms',label:'Prénoms'},{id:'animaux',label:'Noms d’animaux'},{id:'anciens',label:'Noms anciens'},{id:'roles',label:'Rôles'}],
    pending:[
      'Noms des chefs de faction : voir Factions.',
      'Rôles des visiteurs « Villageois », « Garde » et « Conseiller » : écrits dans la fonction groupProfiles de src/sim/visitors.ts, où « Garde » est aussi comparé par la logique ; il faudra séparer libellé et identifiant avant de les rendre personnalisables.',
      'Noms faits d’un mot et d’un numéro (« Assaillant », « Naufragé », « Veilleur ancien », « Captif ancien », « Mécanoïde », marchands orbitaux) : écrits dans le code qui crée la personne.',
      'Noms de famille et surnoms : Elsewhere n’en tire pas encore, une personne n’a qu’un prénom.',
    ]},
  {id:'lieux',label:'Lieux',description:'Les milieux de la planète.',groups:[{id:'milieux',label:'Milieux'}],
    pending:[
      'Noms des colonies étrangères : voir Factions.',
      'Nom du monde et grands lieux de la planète : génération de la planète, autre chantier.',
      'Libellés des cartes et des sites (« Foyer », « Camp temporaire », « Site conservé »…) : écrits dans des fonctions de l’interface (src/ui/map-registry-adapter.ts, src/ui/world-target-ui-263.ts).',
      'Descriptions des milieux de l’écran de départ : table locale de src/ui/front-site.ts.',
      'Nom par défaut de la colonie, « Nouvelle colonie » : src/main.ts.',
    ]},
  {id:'recits',label:'Récits',description:'Scénarios de départ, classes de lettres et romans.',
    groups:[{id:'scenarios',label:'Scénarios'},{id:'lettres',label:'Classes de lettres'},{id:'romans',label:'Romans'}],
    pending:[
      'Textes des lettres, des incidents et des quêtes : phrases écrites à l’endroit de l’événement (journal, lettre de décès, demande d’asile…), dans une centaine de fichiers ; il faut d’abord les rassembler en tables.',
      'Pensées et souvenirs (nom et description) : une vingtaine de tables qui mêlent récit et explication de la règle.',
      'Conteurs et difficultés (« Cassandra Classique », « Récit d’aventure »…) : écrits dans l’interface de départ (src/ui/front-menu.ts, src/ui3d/native-front.ts).',
    ]},
  {id:'descriptions',label:'Descriptions',description:'Les noms des choses que le joueur rencontre : objets, animaux, plantes, bâtiments. Elsewhere ne leur donne pas encore de description narrative, seulement un nom.',
    groups:[{id:'objets',label:'Objets'},{id:'animaux',label:'Animaux'},{id:'plantes-sauvages',label:'Plantes sauvages'},{id:'cultures',label:'Cultures'},{id:'batiments',label:'Bâtiments'}],
    pending:[
      'Sols et tapis de l’Architecte, pierres, météo, maladies et blessures : noms de règles plus que de récit, non repris.',
      'Le texte d’aide des bâtiments donne leur coût et leur taille : c’est une règle, non repris.',
    ]},
].map(category=>Object.freeze({...category,groups:Object.freeze(category.groups.map(group=>Object.freeze(group))),pending:Object.freeze(category.pending)})) as LoreCategoryInfo[]);

/** Every lore entry of Elsewhere, in category, group and source order. */
export const LORE_ENTRIES:readonly LoreEntry[]=Object.freeze([...histories(),...traits(),...factions(),...people(),...places(),...tales(),...things()]
  .sort((a,b)=>categoryRank(a)-categoryRank(b)||groupRank(a)-groupRank(b)));
function categoryRank(entry:LoreEntry):number {return LORE_CATEGORIES.findIndex(c=>c.id===entry.category);}
function groupRank(entry:LoreEntry):number {return LORE_CATEGORIES.find(c=>c.id===entry.category)!.groups.findIndex(g=>g.id===entry.group);}

export const loreCategory=(id:LoreCategoryId):LoreCategoryInfo=>LORE_CATEGORIES.find(c=>c.id===id)!;
