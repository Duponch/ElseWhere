import {describe,expect,it} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {LORE_BUILDING_CATEGORIES,LORE_CATEGORIES,LORE_ENTRIES} from '../src/lore/lore-registry.ts';
import {LORE_ENTRY_FIELDS,LORE_TEXT_FIELDS,type LoreEntry} from '../src/lore/lore-types.ts';
import {buildLoreExport,filterLoreEntries,foldLoreText,loreCategoryCounts,loreExportFileName,loreTextCount,LORE_EXPORT_FORMAT} from '../src/lore/lore-view.ts';
import {installedLoreSources,registerInstalledLoreSource} from '../src/lore/lore-installed.ts';
import {ADULTHOODS,CHILDHOODS} from '../src/sim/colonist-backgrounds.ts';
import {CORE_BACKSTORY_LIST_370} from '../src/sim/core-backstories-370.ts';
import {CORE_BACKSTORY_TEXTS_370} from '../src/sim/core-backstory-texts-370.ts';
import {TRAITS} from '../src/sim/traits.ts';
import {WORLD_FACTION_CHOICES} from '../src/ui/world-draft-controls.ts';
import {STARTING_CANDIDATE_NAMES} from '../src/sim/starting-candidates.ts';
import {ARRIVAL_NAMES} from '../src/sim/arrival-state.ts';
import {STARTING_PET_NAME_FIRST_256,STARTING_PET_NAME_SECOND_256} from '../src/sim/starting-pet-birth-256.ts';
import {ANCIENT_NAME_SYLLABLES_256} from '../src/sim/ancient-human-name-256.ts';
import {CARAVAN_GUARDS_332,CARAVAN_TRADERS_332,CARAVAN_TRADER_KINDS_332} from '../src/sim/trader-caravans-332.ts';
import {BIOME_LABELS} from '../src/sim/site.ts';
import {SCENARIOS} from '../src/sim/scenario-definitions.ts';
import {LETTER_CLASSES_352} from '../src/sim/letters-352.ts';
import {NOVEL_STORIES_295,NOVEL_TITLE_ENDS_295,NOVEL_TITLE_STARTS_295} from '../src/sim/book-state-295.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {ANIMAL_SPECIES} from '../src/sim/animal-species.ts';
import {FLORA_DEFINITIONS} from '../src/sim/biome-flora.ts';
import {PLANT_DEFINITIONS} from '../src/sim/plants.ts';
import {toolDefinitions} from '../src/ui3d/native-catalog.ts';

const root=fileURLToPath(new URL('..',import.meta.url));
const inGroup=(category:string,group:string):LoreEntry[]=>LORE_ENTRIES.filter(e=>e.category===category&&e.group===group);
const byId=(id:string):LoreEntry=>{const entry=LORE_ENTRIES.find(e=>e.id===id);if(!entry)throw Error(`missing ${id}`);return entry;};
const count=(o:object)=>Object.keys(o).length;

describe('lore registry coverage: every entry of every source',()=>{
  it('counts match each source table',()=>{
    const expected:[string,string,number][]=[
      ['histoires','enfance-elsewhere',count(CHILDHOODS)],['histoires','adulte-elsewhere',count(ADULTHOODS)],
      ['histoires','enfance-base',CORE_BACKSTORY_LIST_370.filter(s=>s.slot==='childhood').length],
      ['histoires','adulte-base',CORE_BACKSTORY_LIST_370.filter(s=>s.slot==='adulthood').length],
      ['traits','traits',count(TRAITS)],['factions','types',WORLD_FACTION_CHOICES.length],
      ['personnes','prenoms',2],['personnes','animaux',2],['personnes','anciens',1],
      ['personnes','roles',count(CARAVAN_TRADER_KINDS_332)+count(CARAVAN_GUARDS_332)+count(CARAVAN_TRADERS_332)],
      ['lieux','milieux',count(BIOME_LABELS)],['recits','scenarios',count(SCENARIOS)],['recits','lettres',count(LETTER_CLASSES_352)],['recits','romans',3],
      ['descriptions','objets',count(ITEM_DEFINITIONS)],['descriptions','animaux',count(ANIMAL_SPECIES)],
      ['descriptions','plantes-sauvages',count(FLORA_DEFINITIONS)],['descriptions','cultures',count(PLANT_DEFINITIONS)],
      ['descriptions','batiments',toolDefinitions.filter(t=>LORE_BUILDING_CATEGORIES.includes(t.category)).length],
    ];
    for(const [category,group,n] of expected)expect(inGroup(category,group).length,`${category}/${group}`).toBe(n);
    expect(LORE_ENTRIES.length).toBe(expected.reduce((sum,[, ,n])=>sum+n,0));
    // The 166 Core shuffled backstories, each with its text record.
    expect(inGroup('histoires','enfance-base').length+inGroup('histoires','adulte-base').length).toBe(166);
    expect(count(CORE_BACKSTORY_TEXTS_370)).toBe(166);
  });
  it('word lists carry every word of their source, in order',()=>{
    const lists:[string,readonly string[]][]=[
      ['personnes/prenoms/depart',STARTING_CANDIDATE_NAMES],['personnes/prenoms/arrivants',ARRIVAL_NAMES],
      ['personnes/animaux/premier-mot',STARTING_PET_NAME_FIRST_256],['personnes/animaux/second-mot',STARTING_PET_NAME_SECOND_256],
      ['personnes/anciens/syllabes',ANCIENT_NAME_SYLLABLES_256],['recits/romans/debuts-de-titre',NOVEL_TITLE_STARTS_295],
      ['recits/romans/fins-de-titre',NOVEL_TITLE_ENDS_295],['recits/romans/resumes',NOVEL_STORIES_295],
    ];
    for(const [id,words] of lists)expect(byId(id).words,id).toEqual([...words]);
  });
  it('texts are read where they live, never rewritten',()=>{
    for(const [id,text] of Object.entries(CORE_BACKSTORY_TEXTS_370)){
      const story=CORE_BACKSTORY_LIST_370.find(s=>s.id===id)!,entry=byId(`histoires/${story.slot==='childhood'?'enfance':'adulte'}-base/${id}`);
      expect([entry.title,entry.shortTitle,entry.description,entry.titleFemale,entry.shortTitleFemale]).toEqual([text[0],text[1],text[2],text[3],text[4]]);
    }
    for(const [key,story] of Object.entries(CHILDHOODS))expect([byId(`histoires/enfance-elsewhere/${key}`).title,byId(`histoires/enfance-elsewhere/${key}`).description]).toEqual([story.label,story.description]);
    for(const [key,trait] of Object.entries(TRAITS))expect([byId(`traits/traits/${key}`).title,byId(`traits/traits/${key}`).description]).toEqual([trait.label,trait.description]);
    for(const [key,item] of Object.entries(ITEM_DEFINITIONS))expect(byId(`descriptions/objets/${key}`).title).toBe(item.label);
    for(const choice of WORLD_FACTION_CHOICES)expect(byId(`factions/types/${choice.def}`).title).toBe(choice.label);
  });
  it('every declared group holds entries and every entry belongs to a declared group',()=>{
    for(const category of LORE_CATEGORIES)for(const group of category.groups)expect(inGroup(category.id,group.id).length,`${category.id}/${group.id}`).toBeGreaterThan(0);
    for(const entry of LORE_ENTRIES)expect(LORE_CATEGORIES.find(c=>c.id===entry.category)?.groups.some(g=>g.id===entry.group),entry.id).toBe(true);
  });
});

describe('lore ids',()=>{
  it('are unique and built from the source key only',()=>{
    const ids=LORE_ENTRIES.map(e=>e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for(const entry of LORE_ENTRIES){
      expect(entry.id).toBe(`${entry.category}/${entry.group}/${entry.key}`);
      expect(entry.id).toMatch(/^[a-z]+\/[a-z-]+\/[A-Za-z0-9_-]+$/);
    }
  });
  it('stay stable for known entries',()=>{
    for(const id of ['histoires/enfance-elsewhere/settlement-child','histoires/adulte-elsewhere/hermit','histoires/enfance-base/SewerKid57','histoires/adulte-base/NavyScientist52',
      'traits/traits/optimist','traits/traits/pyromaniac','factions/types/OutlanderCivil','personnes/prenoms/depart','personnes/roles/garde-town-guard',
      'lieux/milieux/temperate-forest','recits/scenarios/crashlanded','recits/lettres/threat-big','descriptions/objets/steel','descriptions/animaux/muffalo',
      'descriptions/plantes-sauvages/oak','descriptions/cultures/rice','descriptions/batiments/ship-reactor'])expect(byId(id).id).toBe(id);
  });
});

describe('lore entries carry no rule',()=>{
  it('only narrative fields, all plain text',()=>{
    const allowed=new Set<string>(LORE_ENTRY_FIELDS);
    for(const entry of LORE_ENTRIES){
      for(const key of Object.keys(entry))expect(allowed.has(key),`${entry.id}: ${key}`).toBe(true);
      expect(entry.origin).toBe('elsewhere');
      for(const field of [...LORE_TEXT_FIELDS,'reference','note','key','id'] as const){
        const value=entry[field];if(value===undefined)continue;
        if(field==='words'){expect(Array.isArray(value)).toBe(true);for(const word of value as readonly string[])expect(typeof word==='string'&&word.length>0,entry.id).toBe(true);}
        else expect(typeof value==='string'&&value.length>0,`${entry.id}: ${field}`).toBe(true);
      }
      expect(Object.keys(entry.source).sort()).toEqual(['file','symbol']);
      expect(entry.title!==undefined||entry.words!==undefined,entry.id).toBe(true);
    }
    // Mechanical fields of the source tables never travel with the text.
    for(const forbidden of ['gains','disables','requires','forcedTraits','disallowedTraits','categories','possessions','body','mood','breakOffset','learning','weight','cost','stock','color','growDays'])
      expect(LORE_ENTRIES.some(e=>Object.hasOwn(e,forbidden)),forbidden).toBe(false);
  });
  it('points at a real file that defines the symbol',()=>{
    for(const {file,symbol} of new Map(LORE_ENTRIES.map(e=>[`${e.source.file}#${e.source.symbol}`,e.source])).values()){
      const path=root+file;expect(existsSync(path),file).toBe(true);
      expect(readFileSync(path,'utf8').includes(symbol),`${file} ${symbol}`).toBe(true);
    }
  });
});

describe('lore export and page helpers',()=>{
  it('exports the whole registry as JSON',()=>{
    const date=new Date(2026,10,22,15,30),data=buildLoreExport(LORE_CATEGORIES,LORE_ENTRIES,date);
    expect(loreExportFileName(date)).toBe('lore-elsewhere-2026-11-22.json');
    expect(data.format).toBe(LORE_EXPORT_FORMAT);expect(data.version).toBe(1);expect(data.exportedOn).toBe('2026-11-22');
    expect(data.entries.length).toBe(LORE_ENTRIES.length);
    expect(data.categories.map(c=>c.id)).toEqual(['histoires','traits','factions','personnes','lieux','recits','descriptions']);
    expect(data.categories.reduce((n,c)=>n+c.count,0)).toBe(LORE_ENTRIES.length);
    const parsed=JSON.parse(JSON.stringify(data));
    expect(parsed.entries).toEqual(JSON.parse(JSON.stringify(LORE_ENTRIES)));
    expect(parsed.entries[0]).toEqual({id:'histoires/enfance-elsewhere/settlement-child',origin:'elsewhere',category:'histoires',group:'enfance-elsewhere',key:'settlement-child',
      title:CHILDHOODS['settlement-child'].label,description:CHILDHOODS['settlement-child'].description,source:{file:'src/sim/colonist-backgrounds.ts',symbol:'CHILDHOODS'}});
  });
  it('filters by category and by every word, without accents',()=>{
    expect(foldLoreText('Éleveur')).toBe('eleveur');
    expect(filterLoreEntries(LORE_ENTRIES,{query:'eleveur solitaire'}).map(e=>e.id)).toContain('histoires/adulte-elsewhere/hermit');
    expect(filterLoreEntries(LORE_ENTRIES,{category:'traits'}).length).toBe(count(TRAITS));
    expect(filterLoreEntries(LORE_ENTRIES,{category:'traits',query:'égouts'})).toEqual([]);
    expect(filterLoreEntries(LORE_ENTRIES,{query:'SewerKid57'}).map(e=>e.id)).toEqual(['histoires/enfance-base/SewerKid57']);
    const counts=loreCategoryCounts(LORE_ENTRIES);expect(Object.values(counts).reduce((a,b)=>a+b,0)).toBe(LORE_ENTRIES.length);
    expect(loreTextCount(LORE_ENTRIES)).toBeGreaterThan(LORE_ENTRIES.length);
  });
  it('leaves a place for the installed game, empty until its reader exists',async()=>{
    expect(installedLoreSources()).toEqual([]);
    const source={label:'essai',load:async()=>[]};registerInstalledLoreSource(source);registerInstalledLoreSource(source);
    expect(installedLoreSources()).toEqual([source]);
  });
});
