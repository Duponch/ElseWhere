/** Compares the planet of real RimWorld saves with the planet Elsewhere
 * generates from the same seed string and settings, tile by tile.
 *
 *   npx tsx scripts/planet-parity.ts <sauvegarde.rws> [...] [--generator=historique|exact|tous] [--table] [--complet] [--langue=French [--jeu=<dossier du jeu>]]
 *
 * --complet also generates the whole world (sites, factions, roads, terrain
 * modifiers) and compares roads, foreign settlements and caves.
 * --langue (with --complet): faction and settlement names drawn with the
 * game's own rule packs, read at run time from the installed game (--jeu,
 * else RIMWORLD_DIR, else the default Steam folder) in that language — the
 * language the save was made in; adds the « factions » section.
 *
 * Developer tool: prints numbers only. The saves and the game are only read
 * (never copied nor written); nothing from them is stored. */
import {readFileSync} from 'node:fs';
import {basename} from 'node:path';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {savePlanetSettings,saveColumns,surfaceColumns,comparePlanetColumns,formatPlanetParity,biomeConfusionTable,compareWorldObjects,formatWorldObjectParity,saveFactionSelection,compareFactionNames,formatFactionNameParity} from '../src/import/rimworld/planet-parity.ts';
import {generateGeographicWorldDraft256} from '../src/sim/world-geographic-draft.ts';
import {generateWorldPhysicalSurface,type WorldPhysicalSurface} from '../src/sim/world-surface-geography.ts';
import {rimworldCoreFolder,rimworldResourcesBytes,DEFAULT_RIMWORLD_DIR} from '../src/import/rimworld/game-files-node.ts';
import {loadGameGrammar,type GameGrammar} from '../src/import/rimworld/game-grammar.ts';

const args=process.argv.slice(2),files=args.filter(a=>!a.startsWith('--'));
const option=(name:string)=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const generator=option('generator')??'tous',table=args.includes('--table'),complete=args.includes('--complet'),language=option('langue');
if(!files.length){console.error('usage : npx tsx scripts/planet-parity.ts <sauvegarde.rws> [...] [--generator=historique|exact|tous] [--table] [--complet] [--langue=French [--jeu=<dossier>]]');process.exit(2);}
let game:GameGrammar|undefined;
if(language){
 const dir=option('jeu')??process.env.RIMWORLD_DIR??DEFAULT_RIMWORLD_DIR,core=rimworldCoreFolder(dir);
 if(!core){console.error(`jeu introuvable : ${dir}`);process.exit(2);}
 const start=performance.now();game=loadGameGrammar(core,language,{resources:rimworldResourcesBytes(dir)});
 console.log(`données du jeu : langue ${game.language.folderName} (${game.language.source}), ${game.counts.rulePacks} paquets de règles dont ${game.counts.injectedPacks} traduits, ${game.counts.activeStringFiles} listes de mots de la langue et ${game.counts.defaultStringFiles} anglaises, ${game.counts.personNames} prénoms ; ${game.problems.length} anomalies (${((performance.now()-start)/1000).toFixed(1)} s)`);
}
function run(seed:string,settings:Parameters<typeof generateWorldPhysicalSurface>[1],exact:boolean):{surface:WorldPhysicalSurface;seconds:number} {
 const start=performance.now(),it=generateWorldPhysicalSurface(seed,settings,exact?{core:true}:undefined);
 let next=it.next();while(!next.done)next=it.next();
 return {surface:next.value,seconds:(performance.now()-start)/1000};
}
for(const file of files){
 const t0=performance.now(),save=readRwsSave(readFileSync(file,'utf8')),grid=save.world?.grid;
 if(!grid){console.log(`${basename(file)} : pas de grille du monde.`);continue;}
 const p=savePlanetSettings(save);
 console.log(`\n=== ${basename(file)} — RimWorld ${p.gameVersion}, graine « ${p.seed} », couverture ${p.rawCoverage}, pluie ${p.rainfallName}, température ${p.temperatureName}, population ${p.populationName}, pollution ${p.pollution} ; ${grid.tiles} cases (lecture ${((performance.now()-t0)/1000).toFixed(1)} s)`);
 for(const kind of generator==='tous'?['historique','exact']:[generator]){
  if(kind!=='historique'&&kind!=='exact'){console.error(`générateur inconnu : ${kind}`);process.exit(2);}
  const {surface,seconds}=run(p.seed,p.settings,kind==="exact");
  const neighbours=(tile:number)=>surface.tiles[tile]?.neighbours??[];
  const report=comparePlanetColumns(saveColumns(grid,neighbours),surfaceColumns(surface.tiles));
  console.log(`\n--- générateur ${kind} (${surface.tiles.length} cases, génération ${seconds.toFixed(1)} s)`);
  console.log(formatPlanetParity(report));
  if(table)console.log(biomeConfusionTable(report));
  if(complete){
   const factions=saveFactionSelection(p.factions);
   if(!factions){console.log(`monde complet : factions non prises en charge (${p.factions.join(', ')})`);continue;}
   // The game's names only on the game's terrain (the names follow step 400).
   const names=kind==='exact'?game:undefined;let leaderStart:number|null=null;
   const start=performance.now(),it=generateGeographicWorldDraft256({seed:p.seed,settings:{...p.settings,factions},tick:0,nextThingId:1,playerDef:'PlayerColony',playerName:'Comparaison',terrain:kind==='exact'?'core':'historical',
    ...names?{names,onLeaderStart:(_faction,index,state)=>{if(index===0)leaderStart=state.counter;}}:{}});
   let next=it.next();while(!next.done)next=it.next();const draft=next.value;
   console.log(`monde complet (${((performance.now()-start)/1000).toFixed(1)} s) :`);
   console.log(formatWorldObjectParity(compareWorldObjects(save,tile=>draft.surface.tiles[tile]?.neighbours??[],draft.roads,draft.factions,draft.mutators)));
   if(names){const fixed=new Set([...names.factions].filter(([,n])=>n.fixedName!==null).map(([d])=>d));console.log(formatFactionNameParity(compareFactionNames(save,draft.factions,fixed,leaderStart),names.language.folderName));}
   else if(kind==='exact')console.log('factions : noms d\'Elsewhere (ajouter --langue=<langue de la sauvegarde> pour les noms du jeu)');
  }
 }
}
