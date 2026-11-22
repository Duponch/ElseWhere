/** Compares the planet of real RimWorld saves with the planet Elsewhere
 * generates from the same seed string and settings, tile by tile.
 *
 *   npx tsx scripts/planet-parity.ts <sauvegarde.rws> [...] [--generator=historique|exact|tous] [--table] [--complet]
 *
 * --complet also generates the whole world (sites, factions, roads, terrain
 * modifiers) and compares roads, foreign settlements and caves.
 *
 * Developer tool: prints numbers only. The saves are only read (never copied
 * nor written); nothing from them is stored. */
import {readFileSync} from 'node:fs';
import {basename} from 'node:path';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {savePlanetSettings,saveColumns,surfaceColumns,comparePlanetColumns,formatPlanetParity,biomeConfusionTable,compareWorldObjects,formatWorldObjectParity,saveFactionSelection} from '../src/import/rimworld/planet-parity.ts';
import {generateGeographicWorldDraft256} from '../src/sim/world-geographic-draft.ts';
import {generateWorldPhysicalSurface,type WorldPhysicalSurface} from '../src/sim/world-surface-geography.ts';

const args=process.argv.slice(2),files=args.filter(a=>!a.startsWith('--'));
const option=(name:string)=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const generator=option('generator')??'tous',table=args.includes('--table'),complete=args.includes('--complet');
if(!files.length){console.error('usage : npx tsx scripts/planet-parity.ts <sauvegarde.rws> [...] [--generator=historique|exact|tous] [--table]');process.exit(2);}
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
   const start=performance.now(),it=generateGeographicWorldDraft256({seed:p.seed,settings:{...p.settings,factions},tick:0,nextThingId:1,playerDef:'PlayerColony',playerName:'Comparaison',terrain:kind==='exact'?'core':'historical'});
   let next=it.next();while(!next.done)next=it.next();const draft=next.value;
   console.log(`monde complet (${((performance.now()-start)/1000).toFixed(1)} s) :`);
   console.log(formatWorldObjectParity(compareWorldObjects(save,tile=>draft.surface.tiles[tile]?.neighbours??[],draft.roads,draft.factions,draft.mutators)));
  }
 }
}
