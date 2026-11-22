/** Read-only view of an installed RimWorld's files, as the game reads them.
 *
 * The user's decision (22 November 2026): the game's own text data (rule
 * packs, word lists, name lists, translations) is read from the installed
 * game at run time and never copied into the repository. This module is the
 * data source's file layer: a folder of files addressed by forward-slash paths,
 * whatever really holds them — the game folder on disk (Node tools and opt-in
 * tests, `game-files-node.ts`), files a player picks in the browser (a later
 * lot), or a test's hand-made map.
 *
 * Facts read in the game (decompiled `AbstractFilesystem`, `TarDirectory`,
 * `LoadedLanguage`, `LanguageDatabase`; no code copied): a language is a folder
 * `Data/Core/Languages/<nom>` or an archive `<nom>.tar` beside it, the archive
 * winning when both exist; a folder named « French (Français) » is also found
 * by its short name « French »; text files are UTF-8, a byte-order mark is
 * dropped. Pure TypeScript. */
import {readTarEntries} from './tar.ts';

/** A read-only folder: paths relative to its root, forward slashes. */
export interface GameFolder {
 /** Names of the direct subfolders of `folder` ('' is the root). */
 folders(folder:string):string[];
 /** Paths, relative to the root, of every file under `folder`, recursively. */
 files(folder:string):string[];
 /** Contents of a file, or undefined when absent. */
 read(path:string):Uint8Array|undefined;
}

const join=(folder:string,name:string)=>folder?`${folder}/${name}`:name;
const clean=(path:string)=>path.replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');

/** A folder held in memory: an archive's contents, files a player picked, a
 * test's fixture. Order of `files` is the order given. */
export function memoryGameFolder(entries:Iterable<readonly [string,Uint8Array]>):GameFolder {
 const files=new Map<string,Uint8Array>();
 for(const [path,data] of entries)files.set(clean(path),data);
 const under=(folder:string)=>{folder=clean(folder);return folder?folder+'/':'';};
 return {
  folders(folder){
   const prefix=under(folder),names:string[]=[];
   for(const path of files.keys())if(path.startsWith(prefix)){const rest=path.slice(prefix.length),slash=rest.indexOf('/');if(slash>0&&!names.includes(rest.slice(0,slash)))names.push(rest.slice(0,slash));}
   return names;
  },
  files(folder){const prefix=under(folder);return [...files.keys()].filter(p=>p.startsWith(prefix));},
  read(path){return files.get(clean(path));},
 };
}
/** The files of a `.tar` archive as a folder. */
export function tarGameFolder(bytes:Uint8Array):GameFolder {
 return memoryGameFolder(readTarEntries(bytes).filter(e=>!e.directory).map(e=>[e.path,e.data] as const));
}
/** A subfolder seen as a folder of its own. */
export function gameSubfolder(parent:GameFolder,folder:string):GameFolder {
 folder=clean(folder);const strip=(path:string)=>path.slice(folder.length+1);
 return {
  folders:sub=>parent.folders(join(folder,clean(sub))),
  files:sub=>parent.files(join(folder,clean(sub))).map(strip),
  read:path=>parent.read(join(folder,clean(path))),
 };
}

const utf8=new TextDecoder('utf-8');
/** UTF-8 text without its byte-order mark (`StreamReader` with BOM detection). */
export function gameText(bytes:Uint8Array):string {
 const text=utf8.decode(bytes);return text.charCodeAt(0)===0xfeff?text.slice(1):text;
}

/** `LoadedLanguage` constructor: « French (Français) » → « French ». */
export function legacyLanguageName(folderName:string):string {
 const open=folderName.indexOf('(');return (open>=0?folderName.slice(0,Math.max(0,open-1)):folderName).trim();
}
/** Language folder names under `Languages` of a content folder (`Data/Core`):
 * folders and `.tar` archives, an archive and a folder of the same name once. */
export function gameLanguageNames(content:GameFolder):string[] {
 const names=content.folders('Languages');
 for(const path of content.files('Languages')){const name=path.slice('Languages/'.length);if(!name.includes('/')&&name.endsWith('.tar')&&!names.includes(name.slice(0,-4)))names.push(name.slice(0,-4));}
 return names;
}
export interface GameLanguageFolder {
 /** Folder name as the game knows the language (« French (Français) »). */
 readonly folderName:string;
 /** Where its files came from, relative to the content folder. */
 readonly source:string;
 readonly folder:GameFolder;
}
/** Opens a language of a content folder (`Data/Core`) by its folder name or its
 * short name, case-insensitively for the short name. The archive wins over a
 * folder of the same name (`AbstractFilesystem.GetDirectory`). Undefined when
 * the language is absent. */
export function openGameLanguage(content:GameFolder,language:string):GameLanguageFolder|undefined {
 const names=gameLanguageNames(content);
 const folderName=names.find(n=>n===language)??names.find(n=>legacyLanguageName(n).toLowerCase()===language.trim().toLowerCase());
 if(folderName===undefined)return undefined;
 for(const name of [folderName,legacyLanguageName(folderName)]){
  const archive=content.read(`Languages/${name}.tar`);
  if(archive)return {folderName,source:`Languages/${name}.tar`,folder:tarGameFolder(archive)};
  if(content.files(`Languages/${name}`).length)return {folderName,source:`Languages/${name}`,folder:gameSubfolder(content,`Languages/${name}`)};
 }
 return undefined;
}
