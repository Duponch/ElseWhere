/** « Textes de RimWorld » (Options): the player points the game to their
 * RimWorld folder once; the game then shows RimWorld's own texts (stories,
 * traits, factions, names of things) instead of Elsewhere's, which stay the
 * fallback. Only the folder handle is kept (IndexedDB) so the choice survives
 * a reload, with the chosen language (local preference). The texts are read
 * into memory at each opening, off the page thread, and never stored,
 * uploaded or copied (user's decision of 22 November 2026).
 *
 * Browser facts: `showDirectoryPicker` and handle permissions belong to the
 * File System Access API (Chrome, Edge, Opera); a handle kept in IndexedDB
 * usually needs the reading permission asked again, from a click, after the
 * browser restarts. */
import {gameLanguageNamesFromHandle,locateGameContent,type GameDirectoryHandle} from '../import/rimworld/game-files-browser.ts';
import {legacyLanguageName} from '../import/rimworld/game-files.ts';
import {DEFAULT_LANGUAGE_FOLDER} from '../import/rimworld/game-grammar.ts';
import {NOT_A_GAME_FOLDER,readGameLoreFromHandle,type GameLoreBrowserResult} from './game-lore-browser.ts';
import {gameLoreTexts,gameLoreTextsOf,setGameLoreTexts} from './lore-text.ts';
import {registerInstalledLoreSource} from './lore-installed.ts';

type Permission='granted'|'denied'|'prompt';
/** A picked folder: a directory handle with the permission methods of the API. */
export interface RimWorldFolderHandle extends GameDirectoryHandle {
 queryPermission?(descriptor:{mode:'read'}):Promise<Permission>;
 requestPermission?(descriptor:{mode:'read'}):Promise<Permission>;
}
export interface RimWorldTextsHandleStore {
 load():Promise<RimWorldFolderHandle|undefined>;
 save(handle:RimWorldFolderHandle):Promise<void>;
 clear():Promise<void>;
}
export interface RimWorldTextsPreferences {get(key:string):string|null;set(key:string,value:string):void;remove(key:string):void}
export interface RimWorldTextsDependencies {
 /** `showDirectoryPicker`; undefined when the browser lacks it. */
 readonly picker:(()=>Promise<RimWorldFolderHandle>)|undefined;
 readonly store:RimWorldTextsHandleStore;
 readonly preferences?:RimWorldTextsPreferences|undefined;
 /** Reads the texts (the lore Worker in the browser). */
 readonly read?:((handle:RimWorldFolderHandle,language:string)=>Promise<GameLoreBrowserResult>)|undefined;
 readonly now?:(()=>number)|undefined;
}

export type RimWorldTextsStatus='unsupported'|'none'|'permission'|'denied'|'reading'|'loaded'|'error';
export interface RimWorldTextsState {
 readonly status:RimWorldTextsStatus;
 /** Name of the picked folder. */
 readonly folder:string|undefined;
 readonly languages:readonly string[];
 readonly language:string|undefined;
 readonly version:string|undefined;
 /** Texts of the game shown (lore entries read). */
 readonly loaded:number;
 /** Lore entries whose definition the game lacks. */
 readonly missing:number;
 /** One line for the player, in French. */
 readonly message:string;
 /** Reading time of the last load, in milliseconds. */
 readonly durationMs:number|undefined;
}
export interface RimWorldTextsController {
 state():RimWorldTextsState;
 subscribe(listener:()=>void):()=>void;
 /** At start: the kept folder is read when the browser still allows it. */
 restore():Promise<void>;
 /** From a click: opens the folder picker, then reads the texts. */
 choose():Promise<void>;
 /** From a click: asks the browser again for the permission to read. */
 allow():Promise<void>;
 setLanguage(language:string):Promise<void>;
 /** Forgets the folder: Elsewhere's texts come back. */
 forget():Promise<void>;
}

export const RIMWORLD_TEXTS_LANGUAGE_KEY='elsewhere.rimworldTexts.language';
export const UNSUPPORTED_MESSAGE='Ce navigateur ne permet pas de choisir un dossier (il faut un navigateur récent comme Chrome, Edge ou Opera). Les textes d’Elsewhere restent affichés.';

/** The language read by default: the saved choice when the game still has
 * it, else French when the game has it, else English, else the first. */
export function defaultGameLanguage(names:readonly string[],saved?:string|null):string|undefined {
 if(saved&&names.includes(saved))return saved;
 return names.find(n=>legacyLanguageName(n)==='French')??names.find(n=>n===DEFAULT_LANGUAGE_FOLDER)??names[0];
}
const isAbort=(error:unknown)=>error instanceof Error&&error.name==='AbortError'||typeof error==='object'&&error!==null&&(error as {name?:unknown}).name==='AbortError';

export function createRimWorldTexts(deps:RimWorldTextsDependencies):RimWorldTextsController {
 const read=deps.read??((handle,language)=>readGameLoreFromHandle(handle,language));
 const now=deps.now??(()=>performance.now());
 const listeners=new Set<()=>void>();
 let state:RimWorldTextsState={status:deps.picker?'none':'unsupported',folder:undefined,languages:[],language:undefined,version:undefined,loaded:0,missing:0,
  message:deps.picker?'Aucun dossier choisi : les textes d’Elsewhere sont affichés.':UNSUPPORTED_MESSAGE,durationMs:undefined};
 let handle:RimWorldFolderHandle|undefined,generation=0;
 const set=(patch:Partial<RimWorldTextsState>)=>{state={...state,...patch};for(const listener of [...listeners])listener();};
 const savedLanguage=()=>{try{return deps.preferences?.get(RIMWORLD_TEXTS_LANGUAGE_KEY)??null;}catch{return null;}};

 async function open(picked:RimWorldFolderHandle):Promise<void> {
  const mine=++generation;
  const location=await locateGameContent(picked);
  if(mine!==generation)return;
  if(!location){setGameLoreTexts(undefined);set({status:'error',languages:[],language:undefined,loaded:0,missing:0,message:NOT_A_GAME_FOLDER});return;}
  const languages=await gameLanguageNamesFromHandle(location.core);
  if(mine!==generation)return;
  const language=defaultGameLanguage(languages,savedLanguage());
  if(!language){setGameLoreTexts(undefined);set({status:'error',languages,language:undefined,message:'Aucune langue trouvée dans le dossier du jeu (Data/Core/Languages).'});return;}
  await load(picked,language,languages,mine);
 }
 async function load(picked:RimWorldFolderHandle,language:string,languages:readonly string[],mine=++generation):Promise<void> {
  set({status:'reading',languages,language,message:'Lecture des textes de RimWorld…'});
  const started=now();
  try{
   const result=await read(picked,language);
   if(mine!==generation)return;
   const label=`RimWorld${result.version?` ${result.version}`:''} · ${result.language.folderName}`;
   setGameLoreTexts(gameLoreTextsOf(label,result.language.folderName,result.language.worker,result.entries,result.keyed));
   set({status:'loaded',version:result.version,loaded:result.entries.length,missing:result.missing.length,durationMs:Math.round(now()-started),
    message:`${result.entries.length} textes du jeu affichés à la place de ceux d’Elsewhere (${result.language.folderName}).`});
  }catch(error){
   if(mine!==generation)return;
   setGameLoreTexts(undefined);
   set({status:'error',loaded:0,missing:0,message:`Lecture impossible : ${error instanceof Error?error.message:String(error)} Les textes d’Elsewhere restent affichés.`});
  }
 }
 async function permitted(picked:RimWorldFolderHandle):Promise<Permission> {
  try{return await picked.queryPermission?.({mode:'read'})??'granted';}catch{return 'prompt';}
 }

 const controller:RimWorldTextsController={
  state:()=>state,
  subscribe(listener){listeners.add(listener);return ()=>{listeners.delete(listener);};},
  async restore(){
   if(!deps.picker)return;
   let kept:RimWorldFolderHandle|undefined;
   try{kept=await deps.store.load();}catch{kept=undefined;}
   if(!kept){set({status:'none'});return;}
   handle=kept;set({folder:kept.name});
   const permission=await permitted(kept);
   if(permission==='granted')await open(kept);
   else if(permission==='prompt')set({status:'permission',message:`Le navigateur demande de nouveau l’autorisation de lire le dossier « ${kept.name} ». En attendant, les textes d’Elsewhere sont affichés.`});
   else set({status:'denied',message:`Lecture du dossier « ${kept.name} » refusée par le navigateur : les textes d’Elsewhere sont affichés.`});
  },
  async choose(){
   if(!deps.picker){set({status:'unsupported',message:UNSUPPORTED_MESSAGE});return;}
   // The picker opens synchronously, inside the player's click.
   const picking=deps.picker();
   let picked:RimWorldFolderHandle;
   try{picked=await picking;}catch(error){if(isAbort(error))return;set({status:'error',message:`Choix du dossier impossible : ${error instanceof Error?error.message:String(error)}`});return;}
   const location=await locateGameContent(picked);
   // A wrong folder changes nothing: the texts shown and the kept folder stay.
   if(!location){set({status:state.status==='loaded'?'loaded':'error',message:`${NOT_A_GAME_FOLDER}${state.status==='loaded'?' Les textes déjà lus restent affichés.':''}`});return;}
   handle=picked;set({folder:picked.name});
   try{await deps.store.save(picked);}catch{/* The choice still applies now; it will be asked again next time. */}
   await open(picked);
  },
  async allow(){
   if(!handle)return;
   const picked=handle;
   // Asked synchronously, inside the player's click.
   const asking=picked.requestPermission?.({mode:'read'})??Promise.resolve<Permission>('granted');
   let permission:Permission;try{permission=await asking;}catch{permission='denied';}
   if(permission==='granted')await open(picked);
   else set({status:'denied',message:`Lecture du dossier « ${picked.name} » refusée par le navigateur : les textes d’Elsewhere sont affichés.`});
  },
  async setLanguage(language){
   if(!state.languages.includes(language)||!handle)return;
   try{deps.preferences?.set(RIMWORLD_TEXTS_LANGUAGE_KEY,language);}catch{/* Applies now, not kept. */}
   await load(handle,language,state.languages);
  },
  async forget(){
   generation++;handle=undefined;
   try{await deps.store.clear();}catch{/* Nothing kept to clear. */}
   setGameLoreTexts(undefined);
   set({status:deps.picker?'none':'unsupported',folder:undefined,languages:[],language:undefined,version:undefined,loaded:0,missing:0,durationMs:undefined,
    message:deps.picker?'Dossier oublié : les textes d’Elsewhere sont affichés.':UNSUPPORTED_MESSAGE});
  },
 };
 // The lore page's « Jeu installé » reads the same texts (lore-installed.ts).
 registerInstalledLoreSource({get label(){return gameLoreTexts()?.label??'RimWorld (aucun dossier lu)';},load:async()=>[...gameLoreTexts()?.entries.values()??[]]});
 return controller;
}

// ---- Browser wiring --------------------------------------------------------------
export interface GameLoreWorkerRequest {readonly id:number;readonly handle:RimWorldFolderHandle;readonly language:string}
export type GameLoreWorkerReply={readonly id:number;readonly ok:true;readonly result:GameLoreBrowserResult}|{readonly id:number;readonly ok:false;readonly message:string};

/** Reads in a fresh Worker, ended after each read (reads are rare). Without
 * Workers, reads on the page thread. */
export function workerGameLoreReader(createWorker:()=>Worker|undefined):(handle:RimWorldFolderHandle,language:string)=>Promise<GameLoreBrowserResult> {
 let next=0;
 return (handle,language)=>{
  let worker:Worker|undefined;try{worker=createWorker();}catch{worker=undefined;}
  if(!worker)return readGameLoreFromHandle(handle,language);
  const id=++next,own=worker;
  return new Promise<GameLoreBrowserResult>((resolve,reject)=>{
   own.onmessage=(event:MessageEvent<GameLoreWorkerReply>)=>{
    const reply=event.data;if(!reply||reply.id!==id)return;
    own.terminate();
    if(reply.ok)resolve(reply.result);else reject(Error(reply.message));
   };
   own.onerror=event=>{own.terminate();reject(Error(event.message||'Lecture interrompue.'));};
   own.postMessage({id,handle,language} satisfies GameLoreWorkerRequest);
  });
 };
}

const DB='elsewhere-rimworld-texts',STORE='handles',KEY='rimworld';
function request<T>(r:IDBRequest<T>):Promise<T> {return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function database():Promise<IDBDatabase> {
 const open=indexedDB.open(DB,1);
 open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains(STORE))open.result.createObjectStore(STORE);};
 return request(open);
}
/** The picked folder's handle in IndexedDB (only the handle: no file, no text). */
export function indexedDbFolderStore():RimWorldTextsHandleStore {
 const run=async<T>(mode:IDBTransactionMode,body:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>=>{
  const db=await database();
  try{return await request(body(db.transaction(STORE,mode).objectStore(STORE)));}finally{db.close();}
 };
 return {
  load:async()=>(await run('readonly',store=>store.get(KEY))) as RimWorldFolderHandle|undefined??undefined,
  save:async handle=>{await run('readwrite',store=>store.put(handle,KEY));},
  clear:async()=>{await run('readwrite',store=>store.delete(KEY));},
 };
}
const localPreferences:RimWorldTextsPreferences={get:key=>localStorage.getItem(key),set:(key,value)=>localStorage.setItem(key,value),remove:key=>localStorage.removeItem(key)};

/** The controller of a page (the game or the lore page). */
type PickerScope={showDirectoryPicker?:(options?:{id?:string;mode?:'read'|'readwrite'})=>Promise<RimWorldFolderHandle>};
export function browserRimWorldTexts(createWorker:()=>Worker|undefined):RimWorldTextsController {
 const available=typeof (globalThis as PickerScope).showDirectoryPicker==='function'&&typeof indexedDB!=='undefined';
 return createRimWorldTexts({
  // Looked up at each click (the browser's own function, synchronously in the gesture).
  picker:available?()=>(globalThis as PickerScope).showDirectoryPicker!({id:'rimworld',mode:'read'}):undefined,
  store:indexedDbFolderStore(),preferences:localPreferences,read:workerGameLoreReader(createWorker),
 });
}
