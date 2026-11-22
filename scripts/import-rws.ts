/** Imports a RimWorld 1.6 save (.rws, Core only) into an Elsewhere save.
 * node --experimental-transform-types scripts/import-rws.ts <file.rws> <out.json> [--ticks 300] [--no-planet] [--report path.md]
 * The source save is only read. The output is the user's game: keep it under
 * tmp/, never in the repository. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,basename,join,resolve} from 'node:path';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {analyzeRwsSave} from '../src/import/rimworld/analyze.ts';
import {convertRwsSave} from '../src/import/rimworld/convert.ts';
import {frenchReport} from '../src/import/rimworld/report-fr.ts';
import {validateWorld,serializeWorld,deserializeWorld} from '../src/sim/serialization.ts';
import {stepWorld} from '../src/sim/engine.ts';

const args=process.argv.slice(2),flag=(name:string)=>args.includes(name),option=(name:string)=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
const positional=args.filter((a,i)=>!a.startsWith('--')&&!(i>0&&['--ticks','--report'].includes(args[i-1]!)));
const [input,output]=positional;
if(!input||!output){console.error('Usage : import-rws.ts <sauvegarde.rws> <sortie.json> [--ticks 300] [--no-planet] [--report rapport.md]');process.exit(2);}
const ticks=Number(option('--ticks')??300),reportPath=option('--report')??join(dirname(resolve(output)),`${basename(input).replace(/\.rws$/i,'')}-rapport.md`);
const started=performance.now();
const save=readRwsSave(readFileSync(input,'utf8'));
const analysis=analyzeRwsSave(save);
if(!analysis.compatible){
 mkdirSync(dirname(resolve(reportPath)),{recursive:true});writeFileSync(reportPath,frenchReport({title:`Import de ${basename(input)} : refusé`,analysis}));
 console.error(analysis.refusals.join('\n'));process.exit(1);
}
const conversion=convertRwsSave(save,{planet:!flag('--no-planet')}),w=conversion.world;
const errors=validateWorld(w);
let raw='',roundTrip=false,validAfter=false,ran=0;
if(!errors.length){
 raw=serializeWorld(w);roundTrip=serializeWorld(deserializeWorld(raw))===raw;
 const running=deserializeWorld(raw);validAfter=true;
 for(let i=0;i<ticks;i++){stepWorld(running);ran++;if(i%60===59||i===ticks-1){const e=validateWorld(running);if(e.length){validAfter=false;console.error(`Monde invalide après ${ran} ticks : ${e.slice(0,3).join(' ; ')}`);break;}}}
 mkdirSync(dirname(resolve(output)),{recursive:true});writeFileSync(output,raw);
}
const checks={valid:errors.length===0,errors,roundTrip,ticksRun:ran,validAfterTicks:validAfter,bytes:raw.length,planetMode:conversion.planetMode,elapsedMs:performance.now()-started};
mkdirSync(dirname(resolve(reportPath)),{recursive:true});
writeFileSync(reportPath,frenchReport({title:`Import de ${basename(input)} dans Elsewhere`,analysis,conversion,checks}));
console.log(JSON.stringify({output:errors.length?null:resolve(output),report:resolve(reportPath),...checks,errors:errors.slice(0,5),pawns:w.pawns.length,animals:w.wildlife?.animals.length??0,structures:w.structures.length,plants:w.resources.length,piles:w.piles.length}));
if(errors.length||!roundTrip||!validAfter)process.exit(1);
