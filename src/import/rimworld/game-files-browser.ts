/** The installed game's folders as a browser gives them: a directory the
 * player picked (File System Access API, `showDirectoryPicker`), read into a
 * `GameFolder` held in memory. Works in a page and in a Worker (a directory
 * handle can be posted to a Worker). Nothing is written, uploaded or stored:
 * the files read live in memory only (user's decision of 22 November 2026).
 *
 * The handle types are structural (`kind`, `name`, `values()`, `getFile()`),
 * the part of `FileSystemDirectoryHandle` and `FileSystemFileHandle` this
 * module uses, so a test can hand over a fake folder. */
import {memoryGameFolder,type GameFolder} from './game-files.ts';

export interface GameFileHandle {
 readonly kind:'file';
 readonly name:string;
 getFile():Promise<{arrayBuffer():Promise<ArrayBuffer>}>;
}
export interface GameDirectoryHandle {
 readonly kind:'directory';
 readonly name:string;
 values():AsyncIterable<GameDirectoryHandle|GameFileHandle>;
}

/** The direct children of a folder, sorted by name (as `nodeGameFolder`). */
export async function directoryChildren(dir:GameDirectoryHandle):Promise<(GameDirectoryHandle|GameFileHandle)[]> {
 const out:(GameDirectoryHandle|GameFileHandle)[]=[];
 for await(const entry of dir.values())out.push(entry);
 return out.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
}
/** A subfolder by name; the exact name first, then ignoring case (Windows and
 * macOS folders are not case-sensitive). */
export async function childDirectory(dir:GameDirectoryHandle,name:string):Promise<GameDirectoryHandle|undefined> {
 const children=(await directoryChildren(dir)).filter((c):c is GameDirectoryHandle=>c.kind==='directory');
 return children.find(c=>c.name===name)??children.find(c=>c.name.toLowerCase()===name.toLowerCase());
}
async function childFile(dir:GameDirectoryHandle,name:string):Promise<GameFileHandle|undefined> {
 const children=(await directoryChildren(dir)).filter((c):c is GameFileHandle=>c.kind==='file');
 return children.find(c=>c.name===name)??children.find(c=>c.name.toLowerCase()===name.toLowerCase());
}

export interface GameContentLocation {
 /** The `Data/Core` folder (holds `Defs` and `Languages`). */
 readonly core:GameDirectoryHandle;
 /** Where it was found from the picked folder: 'Data/Core', 'Core' or ''. */
 readonly path:string;
 /** The installation folder, when the player picked it (for `Version.txt`). */
 readonly install:GameDirectoryHandle|undefined;
}
/** Finds the game's base content from the folder the player picked: the
 * RimWorld folder itself (`Data/Core`), its `Data` folder (`Core`) or `Core`
 * directly. Undefined when none of them holds `Defs`. */
export async function locateGameContent(picked:GameDirectoryHandle):Promise<GameContentLocation|undefined> {
 const hasDefs=async(dir:GameDirectoryHandle|undefined)=>!!dir&&!!await childDirectory(dir,'Defs');
 const data=await childDirectory(picked,'Data'),core=data&&await childDirectory(data,'Core');
 if(core&&await hasDefs(core))return {core,path:'Data/Core',install:picked};
 const direct=await childDirectory(picked,'Core');
 if(direct&&await hasDefs(direct))return {core:direct,path:'Core',install:undefined};
 if(await hasDefs(picked))return {core:picked,path:'',install:undefined};
 return undefined;
}
/** Language folder names of a content folder, as `gameLanguageNames` lists
 * them: subfolders of `Languages` and `.tar` archives, each name once. */
export async function gameLanguageNamesFromHandle(core:GameDirectoryHandle):Promise<string[]> {
 const languages=await childDirectory(core,'Languages');if(!languages)return [];
 const names:string[]=[];
 for(const entry of await directoryChildren(languages)){
  const name=entry.kind==='directory'?entry.name:entry.name.toLowerCase().endsWith('.tar')?entry.name.slice(0,-4):undefined;
  if(name!==undefined&&!names.includes(name))names.push(name);
 }
 return names;
}
/** The first line of the installation's `Version.txt` (« 1.6.4871 rev590 »). */
export async function gameVersionFromHandle(install:GameDirectoryHandle|undefined):Promise<string|undefined> {
 const file=install&&await childFile(install,'Version.txt');if(!file)return undefined;
 const text=new TextDecoder('utf-8').decode(await (await file.getFile()).arrayBuffer()).replace(/^﻿/,'');
 const line=text.split(/\r?\n/)[0]?.trim();return line||undefined;
}

/** Which folders to walk and which files to read, by path relative to the
 * folder being read (forward slashes). */
export interface GameFileSelection {
 enter(folder:string):boolean;
 take(path:string):boolean;
}
/** Reads the selected files of a folder into memory, as a `GameFolder`.
 * `onFile` is told each file read (for progress). */
export async function readGameFolderFromHandle(dir:GameDirectoryHandle,selection:GameFileSelection,onFile?:(path:string,bytes:number)=>void):Promise<GameFolder> {
 const files:[string,Uint8Array][]=[];
 const walk=async(handle:GameDirectoryHandle,folder:string):Promise<void>=>{
  for(const entry of await directoryChildren(handle)){
   const path=folder?`${folder}/${entry.name}`:entry.name;
   if(entry.kind==='directory'){if(selection.enter(path))await walk(entry,path);}
   else if(selection.take(path)){
    const bytes=new Uint8Array(await (await entry.getFile()).arrayBuffer());
    files.push([path,bytes]);onFile?.(path,bytes.length);
   }
  }
 };
 await walk(dir,'');
 return memoryGameFolder(files);
}
