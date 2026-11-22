/** Reads the lore texts from a RimWorld folder the player picked in the
 * browser (src/import/rimworld/game-files-browser.ts), in a page or in the
 * lore Worker. Only the definitions, the chosen language and English's
 * `Keyed` strings are read; nothing is written anywhere. */
import {gameVersionFromHandle,locateGameContent,readGameFolderFromHandle,type GameDirectoryHandle} from '../import/rimworld/game-files-browser.ts';
import {gameLoreFileSelection,readGameLore,type GameLoreResult} from './game-lore-reader.ts';

export interface GameLoreBrowserResult extends GameLoreResult {
 /** First line of `Version.txt`, when the RimWorld folder itself was picked. */
 readonly version:string|undefined;
 /** Where the base content was found from the picked folder. */
 readonly corePath:string;
 /** Bytes read from the folder. */
 readonly bytesRead:number;
}
export const NOT_A_GAME_FOLDER='Ce dossier ne contient pas le jeu : choisissez le dossier de RimWorld (celui qui contient « Data »).';

export async function readGameLoreFromHandle(picked:GameDirectoryHandle,languageFolder:string):Promise<GameLoreBrowserResult> {
 const location=await locateGameContent(picked);if(!location)throw Error(NOT_A_GAME_FOLDER);
 let bytesRead=0;
 const folder=await readGameFolderFromHandle(location.core,gameLoreFileSelection(languageFolder),(_path,bytes)=>{bytesRead+=bytes;});
 const result=readGameLore(folder,languageFolder,{corePath:location.path||'.'});
 return {...result,version:await gameVersionFromHandle(location.install),corePath:location.path,bytesRead};
}
