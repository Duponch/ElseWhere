/// <reference lib="webworker" />
import {readGameLoreFromHandle} from './game-lore-browser.ts';
import type {GameLoreWorkerReply,GameLoreWorkerRequest} from './rimworld-texts.ts';

/* Dedicated Worker of « Textes de RimWorld » (Options): the page posts the
 * folder the player picked (a directory handle) and the language folder; the
 * Worker reads and parses the files and posts the entries back, so the page
 * thread never parses the game's files. */
const scope=self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage=async(event:MessageEvent<GameLoreWorkerRequest>)=>{
 const {id,handle,language}=event.data;
 let reply:GameLoreWorkerReply;
 try{reply={id,ok:true,result:await readGameLoreFromHandle(handle,language)};}
 catch(error){reply={id,ok:false,message:error instanceof Error?error.message:String(error)};}
 scope.postMessage(reply);
};
