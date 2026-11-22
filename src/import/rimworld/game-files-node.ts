/** The installed game's folders on disk, for Node only (tools and opt-in
 * tests; the browser will feed `GameFolder` from files the player picks).
 * Everything is read, nothing is written; nothing read here may be stored in
 * the repository (user's decision of 22 November 2026). */
import {existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import type {GameFolder} from './game-files.ts';

/** Install folder of the opt-in tests and tools when `RIMWORLD_DIR` is unset. */
export const DEFAULT_RIMWORLD_DIR='E:/Steam/steamapps/common/RimWorld';

/** A folder on disk; listings are sorted by name and cached. */
export function nodeGameFolder(root:string):GameFolder {
 const listings=new Map<string,{folders:string[];files:string[]}>();
 const list=(folder:string)=>{
  let entry=listings.get(folder);
  if(!entry){
   entry={folders:[],files:[]};
   const path=join(root,folder);
   if(existsSync(path)&&statSync(path).isDirectory())
    for(const item of readdirSync(path,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0))(item.isDirectory()?entry.folders:entry.files).push(item.name);
   listings.set(folder,entry);
  }
  return entry;
 };
 const walk=(folder:string,out:string[])=>{const l=list(folder);for(const f of l.files)out.push(folder?`${folder}/${f}`:f);for(const d of l.folders)walk(folder?`${folder}/${d}`:d,out);return out;};
 const clean=(path:string)=>path.replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');
 return {
  folders:folder=>[...list(clean(folder)).folders],
  files:folder=>walk(clean(folder),[]),
  read(path){const full=join(root,clean(path));return existsSync(full)&&statSync(full).isFile()?new Uint8Array(readFileSync(full)):undefined;},
 };
}
/** `Data/Core` of an installation, undefined when it is not one. */
export function rimworldCoreFolder(rimworldDir:string):GameFolder|undefined {
 const path=join(rimworldDir,'Data','Core');
 return existsSync(join(path,'Defs'))?nodeGameFolder(path):undefined;
}
/** The game's Unity resources file (`resources.assets`), which holds the
 * person-name lists the grammar's `NamePerson` rules draw from; undefined
 * when not found. */
export function rimworldResourcesBytes(rimworldDir:string):Uint8Array|undefined {
 for(const data of ['RimWorldWin64_Data','RimWorldWin_Data','RimWorldLinux_Data',join('RimWorldMac.app','Contents','Resources','Data')]){
  const path=join(rimworldDir,data,'resources.assets');
  if(existsSync(path))return new Uint8Array(readFileSync(path));
 }
 return undefined;
}
