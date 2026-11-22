/** Reads the lore texts of an installed RimWorld (user's decision of 22
 * November 2026: read from the player's install at run time, never copied
 * into the repository nor kept in a save or in the browser's storage).
 *
 * What the game reads, and in which order (decompiled `DefInjectionPackage`,
 * `TranslationHandleUtility`, `BackstoryDef`, `TraitDegreeData`,
 * `ScenarioDef`, `GenderUtility`; no code copied):
 * 1. the definitions under `Data/Core/Defs` (`ParentName` inheritance for a
 *    field the definition leaves out); a written « \n » is a line break;
 * 2. the active language's `DefInjected/<Type>` files replace a field
 *    (`<defName>.<champ>`, field names ignoring case), `TODO` keeps the
 *    original; an item of a list is named by its index or by its handle: the
 *    untranslated label normalized (`NormalizedHandle`), suffixed « -n » when
 *    several items share it;
 * 3. a backstory without `description` uses `baseDesc`, the end trimmed and
 *    « \r » removed (`BackstoryDef.PostLoad`);
 * 4. the pronoun words of `[PAWN_pronoun]` and the like are `Keyed` strings
 *    of the language, English when it lacks one (`Translator`).
 * Pure TypeScript: the caller hands the files over (`GameFolder`). */
import {gameText,openGameLanguage,type GameFolder,type GameLanguageFolder} from '../import/rimworld/game-files.ts';
import {readInjections,injectedFiles,languageWorkerOf,DEFAULT_LANGUAGE_FOLDER,type DefInjection} from '../import/rimworld/game-grammar.ts';
import {parseXml,child,type XmlNode} from '../import/rimworld/xml.ts';
import {isLanguageWorkerKind,type LanguageWorkerKind} from '../sim/verse-text.ts';
import {gameLoreTargets,type GameLoreDefType,type GameLoreTarget} from './game-lore-mapping.ts';
import type {LoreCategoryId,LoreEntry} from './lore-types.ts';

/** The `Keyed` strings the pawn texts need (`GenderUtility`). */
export const GAME_LORE_KEYED=['Prohe','Proshe','Proit','Prohis','Proher','Proits','ProhimObj','ProherObj','ProitObj','ProHeNoun','ProSheNoun','ProItNoun','Male','Female','NoneLower','MaleAnimal','FemaleAnimal'] as const;
export type GameLoreKeyed=Partial<Record<typeof GAME_LORE_KEYED[number],string>>;

export interface GameLoreLanguage {
 /** Folder name of the language (« French (Français) »). */
 readonly folderName:string;
 /** Where its files came from, relative to the content folder. */
 readonly source:string;
 /** The language's text worker, as this port knows it (others read as the default). */
 readonly worker:LanguageWorkerKind;
 /** The class named by `LanguageInfo.xml`. */
 readonly workerClass:string;
}
export interface GameLoreResult {
 readonly language:GameLoreLanguage;
 /** Entries of origin 'installed', with the lore ids of Elsewhere's registry. */
 readonly entries:readonly LoreEntry[];
 readonly keyed:GameLoreKeyed;
 /** Lore ids whose definition the game does not have. */
 readonly missing:readonly string[];
 readonly counts:{readonly defFiles:number;readonly defs:number;readonly injectedFiles:number;readonly targets:number};
 readonly problems:readonly string[];
}

/** The definition types read, in the order of `GameLoreDefType`. */
export const GAME_LORE_DEF_TYPES:readonly GameLoreDefType[]=['BackstoryDef','TraitDef','FactionDef','ThingDef','PawnKindDef','BiomeDef','ScenarioDef','TraderKindDef'];

interface RawDef {readonly type:string;readonly defName:string|undefined;readonly name:string|undefined;readonly parent:string|undefined;readonly node:XmlNode;readonly file:string}

/** `TranslationHandleUtility.NormalizedHandle`. */
export function normalizedHandle(handle:string):string {
 let h=handle.trim().replace(/ /g,'_').replace(/\n/g,'_').replace(/\r/g,'').replace(/\t/g,'_').replace(/\./g,'').replace(/-/g,'').replace(/\{.*?\}/g,'');
 h=[...h].filter(c=>/[A-Za-z0-9_-]/.test(c)).join('');
 h=h.replace(/__+/g,'_').replace(/^_+|_+$/g,'');
 return h&&/^\d+$/.test(h)?'_'+h:h;
}
/** `ParseHelper.ParseString`: a written « \n » becomes a line break. */
const parseString=(s:string)=>s.replace(/\\n/g,'\n');
const nodeText=(node:XmlNode|undefined):string|undefined=>{if(!node)return undefined;const t=parseString(node.text).trim();return t&&t!=='null'?t:undefined;};
const sameName=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
const childIgnoringCase=(node:XmlNode|undefined,name:string)=>node?.children.find(c=>sameName(c.name,name));

export function readGameLore(core:GameFolder,languageName:string,options:{corePath?:string;targets?:readonly GameLoreTarget[]}={}):GameLoreResult {
 const problems:string[]=[];
 const active=openGameLanguage(core,languageName);if(!active)throw Error(`Langue introuvable dans le jeu : ${languageName}.`);
 const english=active.folderName===DEFAULT_LANGUAGE_FOLDER?active:openGameLanguage(core,DEFAULT_LANGUAGE_FOLDER);
 const workerClass=languageWorkerOf(active),worker:LanguageWorkerKind=isLanguageWorkerKind(workerClass)?workerClass:'LanguageWorker_Default';
 const prefix=options.corePath?`${options.corePath}/`:'';

 // 1. Definitions.
 const types=new Set<string>(GAME_LORE_DEF_TYPES),byDefName=new Map<string,Map<string,RawDef>>(),byName=new Map<string,RawDef>();let defFiles=0,defs=0;
 for(const path of core.files('Defs')){
  if(!path.toLowerCase().endsWith('.xml'))continue;
  const bytes=core.read(path);if(!bytes)continue;
  const source=gameText(bytes);if(!GAME_LORE_DEF_TYPES.some(t=>source.includes(`<${t}`)))continue;
  let root:XmlNode;try{root=parseXml(source);}catch(error){problems.push(`${path} : ${(error as Error).message}`);continue;}
  defFiles++;
  for(const node of root.children){
   if(!types.has(node.name))continue;
   const def:RawDef={type:node.name,defName:nodeText(child(node,'defName')),name:node.attrs?.Name,parent:node.attrs?.ParentName,node,file:path};
   if(def.name)byName.set(`${def.type}:${def.name}`,def);
   if(def.defName&&node.attrs?.Abstract?.toLowerCase()!=='true'){let m=byDefName.get(def.type);if(!m)byDefName.set(def.type,m=new Map());m.set(def.defName,def);defs++;}
  }
 }
 /** A field (dotted path) of a definition or, failing that, of its parents. */
 const fieldNode=(def:RawDef,path:readonly string[]):XmlNode|undefined=>{
  for(let d:RawDef|undefined=def,depth=0;d&&depth<32;d=d.parent?byName.get(`${d.type}:${d.parent}`):undefined,depth++){
   let node:XmlNode|undefined=d.node;for(const part of path)node=childIgnoringCase(node,part);
   if(node)return node;
  }
  return undefined;
 };

 // 2. Injections of the active language, by type then « defName.champ » (field ignoring case).
 const injected=new Map<string,Map<string,string|null>>();let injectedCount=0;
 const languageFiles=(language:GameLanguageFolder|undefined,type:string)=>language?injectedFiles(language,type):[];
 for(const type of GAME_LORE_DEF_TYPES){
  const into=new Map<string,DefInjection>();
  for(const path of languageFiles(active,type)){const bytes=active.folder.read(path);if(!bytes)continue;injectedCount++;readInjections(gameText(bytes),path,into,problems);}
  const keyed=new Map<string,string|null>();
  for(const [key,injection] of into){if(injection.list)continue;const dot=key.indexOf('.');keyed.set(key.slice(0,dot)+'.'+key.slice(dot+1).toLowerCase(),injection.value);}
  injected.set(type,keyed);
 }
 const injection=(type:string,defName:string,path:string):string|undefined=>{const value=injected.get(type)?.get(`${defName}.${path.toLowerCase()}`);return value===null||value===undefined?undefined:value;};
 const read=(def:RawDef,path:string):string|undefined=>injection(def.type,def.defName!,path)??nodeText(fieldNode(def,path.split('.')));

 // Lists: the injected fields of each item of `degreeDatas`, by index.
 const listItemTexts=(def:RawDef,list:string,fields:readonly string[]):Map<number,Record<string,string>>=>{
  const items=(fieldNode(def,[list])?.children??[]).filter(c=>c.name==='li'),handles=items.map(li=>normalizedHandle(nodeText(child(li,'label'))??'').toLowerCase());
  const out=new Map<number,Record<string,string>>();
  const indexOf=(part:string):number|undefined=>{
   if(/^\d+$/.test(part))return Number(part)<items.length?Number(part):undefined;
   const match=/^(.*)-(\d+)$/.exec(part),handle=normalizedHandle(match?match[1]!:part).toLowerCase(),occurrence=match?Number(match[2]):0;
   let seen=0;for(let i=0;i<items.length;i++)if(handles[i]===handle&&handle){if(seen===occurrence)return i;seen++;}
   return undefined;
  };
  const prefixKey=`${def.defName}.${list.toLowerCase()}.`;
  for(const [key,value] of injected.get(def.type)??[]){
   if(!key.startsWith(prefixKey)||value===null)continue;
   const rest=key.slice(prefixKey.length),dot=rest.lastIndexOf('.');if(dot<0)continue;
   const field=fields.find(f=>sameName(f,rest.slice(dot+1)));if(!field)continue;
   // Keys are kept in lower case after the defName: handles compare in lower case.
   const index=indexOf(rest.slice(0,dot));if(index===undefined){problems.push(`${def.defName} : élément ${rest.slice(0,dot)} introuvable`);continue;}
   const record=out.get(index)??{};record[field]=value;out.set(index,record);
  }
  return out;
 };

 // 3. Entries.
 const entries:LoreEntry[]=[],missing:string[]=[];
 const targets=options.targets??gameLoreTargets();
 for(const target of targets){
  const def=byDefName.get(target.type)?.get(target.defName);
  if(!def){missing.push(target.id);continue;}
  const fields:Record<string,string|undefined>={};
  switch(target.read.kind){
   case 'backstory':{
    fields.title=read(def,'title');fields.shortTitle=read(def,'titleShort');fields.titleFemale=read(def,'titleFemale');fields.shortTitleFemale=read(def,'titleShortFemale');
    const description=read(def,'description')??read(def,'baseDesc');fields.description=description?.replace(/\r/g,'').trimEnd();
    break;
   }
   case 'trait':{
    const degree=(target.read as {degree:number}).degree;
    const items=(fieldNode(def,['degreeDatas'])?.children??[]).filter(c=>c.name==='li');
    const index=items.findIndex(li=>Number(nodeText(child(li,'degree'))??0)===degree);if(index<0){missing.push(target.id);continue;}
    const own=listItemTexts(def,'degreeDatas',['label','labelFemale','labelMale','description']).get(index)??{};
    const li=items[index]!,text=(f:string)=>own[f]??nodeText(childIgnoringCase(li,f));
    fields.title=text('label');fields.titleFemale=text('labelFemale');fields.description=text('description');
    break;
   }
   case 'faction':fields.title=read(def,'label');fields.description=read(def,'description');break;
   case 'leader':fields.title=read(def,'leaderTitle');fields.titleFemale=read(def,'leaderTitleFemale');break;
   case 'label':fields.title=read(def,'label');break;
   case 'label-description':fields.title=read(def,'label');fields.description=read(def,'description');break;
   case 'scenario':fields.title=read(def,'scenario.name')??read(def,'label');fields.description=read(def,'scenario.description')??read(def,'description');break;
  }
  if(!fields.title&&!fields.description){missing.push(target.id);continue;}
  const [category,group,...key]=target.id.split('/');
  const entry:Record<string,unknown>={id:target.id,origin:'installed',category:category as LoreCategoryId,group,key:key.join('/')};
  for(const name of ['title','shortTitle','titleFemale','shortTitleFemale','description'])if(fields[name])entry[name]=fields[name];
  entry.reference=`${target.type} ${target.defName}`;
  entry.source=Object.freeze({file:prefix+def.file,symbol:`${target.type} ${target.defName}`});
  entries.push(Object.freeze(entry) as unknown as LoreEntry);
 }

 // 4. Keyed words, the active language first, then English.
 const keyed:GameLoreKeyed={};
 for(const language of [active,english])if(language)for(const path of language.folder.files('Keyed')){
  if(!path.toLowerCase().endsWith('.xml'))continue;const bytes=language.folder.read(path);if(!bytes)continue;
  let root:XmlNode;try{root=parseXml(gameText(bytes));}catch{continue;}
  for(const node of root.children)if((GAME_LORE_KEYED as readonly string[]).includes(node.name)&&keyed[node.name as keyof GameLoreKeyed]===undefined)keyed[node.name as keyof GameLoreKeyed]=parseString(node.text);
 }

 return {language:{folderName:active.folderName,source:active.source,worker,workerClass},entries,keyed,missing,
  counts:{defFiles,defs,injectedFiles:injectedCount,targets:targets.length},problems};
}

/** Files of a content folder (`Data/Core`) the reader needs for a language:
 * the definitions, the language (folder or archive) and English's `Keyed`
 * strings (the fallback of the pronoun words). For `readGameFolderFromHandle`. */
export function gameLoreFileSelection(languageFolderName:string):{enter(folder:string):boolean;take(path:string):boolean} {
 const lang=`Languages/${languageFolderName}`,english=`Languages/${DEFAULT_LANGUAGE_FOLDER}`;
 const wantedLanguagePart=(rest:string)=>rest===''||rest==='Keyed'||rest.startsWith('Keyed/')||rest==='DefInjected'||GAME_LORE_DEF_TYPES.some(t=>rest===`DefInjected/${t}`||rest===`DefInjected/${t}s`||rest.startsWith(`DefInjected/${t}/`)||rest.startsWith(`DefInjected/${t}s/`))||rest==='LanguageInfo.xml';
 const under=(path:string,root:string)=>path===root?'':path.startsWith(root+'/')?path.slice(root.length+1):undefined;
 return {
  enter(folder){
   if(folder==='Defs'||folder.startsWith('Defs/')||folder==='Languages')return true;
   for(const root of [lang,english]){const rest=under(folder,root);if(rest!==undefined&&(rest===''||wantedLanguagePart(rest)))return true;}
   return false;
  },
  take(path){
   if(path.startsWith('Defs/'))return path.toLowerCase().endsWith('.xml');
   if(path===`${lang}.tar`)return true;
   const own=under(path,lang);if(own!==undefined)return wantedLanguagePart(own)&&(own.toLowerCase().endsWith('.xml'));
   const fallback=under(path,english);if(fallback!==undefined)return (fallback.startsWith('Keyed/')||fallback==='LanguageInfo.xml')&&fallback.toLowerCase().endsWith('.xml');
   return false;
  },
 };
}
