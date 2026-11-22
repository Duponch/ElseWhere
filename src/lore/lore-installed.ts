import type {LoreEntry} from './lore-types.ts';

/** The installed game's lore, for a later lot. The player's own RimWorld
 * install is read at run time (Defs and language files, src/import/rimworld)
 * and nothing is stored in the repository or in a save. A source turns what
 * it reads into lore entries of origin 'installed', with ids of the form
 * `category/group/defName` and `source.file` the path inside the install. */
export interface InstalledLoreSource {
  /** Shown above the entries, for example « RimWorld 1.6, jeu de base (français) ». */
  readonly label:string;
  /** Reads the install; may ask the player to choose its folder. */
  load():Promise<readonly LoreEntry[]>;
}

const sources:InstalledLoreSource[]=[];
/** Called by the installed-game reader once it exists. */
export function registerInstalledLoreSource(source:InstalledLoreSource):void {
  if(!sources.includes(source))sources.push(source);
}
export const installedLoreSources=():readonly InstalledLoreSource[]=>[...sources];
