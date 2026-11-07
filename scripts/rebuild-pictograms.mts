import {readdir,writeFile,mkdir} from 'node:fs/promises';
import {join,relative} from 'node:path';
import {ITEM_DEFINITIONS} from '../src/sim/items';
import {toolDefinitions} from '../src/ui3d/native-catalog';
import {researchProjects} from '../src/ui/research-projects';
import {ARCHITECT_ATLAS_IDS} from '../src/ui/architect-icons';
import {PICTOGRAM_IDS} from '../src/ui/pictograms';
import {UI_ICONS} from '../src/ui/tool-cursors';
import {pictoSvg} from '../src/ui/picto-artwork';

// Run from the isolated worktree. No model builders, renderer, GPU or world.
const root=process.cwd(),assets=join(root,'public/assets/ui/elsewhere'),target=join(assets,'pictograms-20261107');
const excluded=new Set(['ui','cursors','architect-1','architect-2']);
const originals=(await readdir(assets,{recursive:true})).filter(path=>path.endsWith('.svg')&&!path.startsWith('pictograms-20261107')).map(path=>({path:join(assets,path),id:path.split(/[\\/]/).at(-1)!.slice(0,-4)})).filter(x=>!excluded.has(x.id));
const controls=['architecte','travail','planning','assignations','animaux','faune','recherches','quetes','monde','historique','factions','menu','ordres','zones','settings','play','pause','speed-double','speed-triple','hourglass','save','load','export','copy','paste','back','rotate-left','rotate-right','information','plus','minus','check','target','sun','moon','eclipse','fog','rain','dry-storm','rain-storm','weather-snow','camera','season-spring','season-summer','season-autumn','season-winter'];
const ids=[...new Set([...toolDefinitions.map(x=>x.id),...researchProjects.map(x=>x.id),...Object.keys(ITEM_DEFINITIONS).map(x=>'item-'+x),...PICTOGRAM_IDS,...controls,...originals.map(x=>x.id)])].sort();
const generated=new Map(ids.map(id=>[id,pictoSvg(id)]));
const missing=ids.filter(id=>!generated.get(id));if(missing.length)throw Error('Missing authored pictograms: '+missing.join(', '));
await mkdir(target,{recursive:true});
for(const[id,svg]of generated)await writeFile(join(target,id+'.svg'),svg!);
// Preserve old file URLs for CSS, saved markers and existing consumers.
for(const entry of originals)await writeFile(entry.path,generated.get(entry.id)!);
function atlas(ids:readonly string[],columns:number,rows:number){return `<svg xmlns="http://www.w3.org/2000/svg" width="${columns*96}" height="${rows*96}" viewBox="0 0 ${columns*96} ${rows*96}">${ids.map((id,i)=>`<g transform="translate(${i%columns*96} ${Math.floor(i/columns)*96}) scale(1.5)">${pictoSvg(id)!.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}</g>`).join('')}</svg>`;}
for(const[i,ids]of ARCHITECT_ATLAS_IDS.entries())await writeFile(join(assets,`v304/architect-${i+1}.svg`),atlas(ids,6,5));
const uiModels:Record<string,string>={wood:'item-wood',steel:'item-steel',component:'item-component',silver:'item-silver',medicine:'item-medicine',blocks:'item-granite-blocks',food:'item-rice',meal:'item-simple-meal'};
await writeFile(join(assets,'v304/ui.svg'),atlas(UI_ICONS.map(id=>uiModels[id]??id),4,5));
const report={baseCommit:'666d598c',style:'adult-hand-20261107',icons:ids.length,legacyUrlsRefreshed:originals.length,atlases:3,ids,paths:originals.map(x=>relative(root,x.path).replaceAll('\\','/'))};
await mkdir(join(root,'tmp'),{recursive:true});await writeFile(join(root,'tmp/pictograms-inventory.json'),JSON.stringify(report,null,2)+'\n');
await mkdir(join(root,'docs/reviews'),{recursive:true});await writeFile(join(root,'docs/reviews/pictograms-inventory.json'),JSON.stringify({style:report.style,icons:ids.length,ids},null,2)+'\n');
console.log(JSON.stringify({icons:ids.length,legacyUrlsRefreshed:originals.length,atlases:3}));
