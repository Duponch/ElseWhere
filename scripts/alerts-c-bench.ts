// Alerts lot C reader cost on a real save (CPU only). Bundle with esbuild
// (no --keep-names) and run with node: see docs/gameplay/alerts-core-c.md.
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {gunzipSync} from 'node:zlib';
import {deserializeWorld} from '../src/sim/serialization';
import type {World} from '../src/sim/types';
import {readStatusAlerts} from '../src/ui/status-alerts';
import {freeColonistsSpawned} from '../src/ui/core-colony-alerts';
import {readAwaitingMedicalOperation,readCaravanIdle,readImmobileCaravan,readNeedDoctor,readNeedMiner,readNeedResearchBench,readPasteDispenserNeedsHopper} from '../src/ui/core-occasional-alerts';
import {readQuestExpiresSoon} from '../src/ui3d/native-domain-alerts';

const path=process.argv[2]??'public/test-saves/v432/les-forges-crash-test.json',runs=Number(process.argv[3]??300);
const text=(()=>{const t=readFileSync(path,'utf8'),raw=JSON.parse(t);return raw.format==='lisiere-save'?gunzipSync(Buffer.from(raw.payload,'base64')).toString('utf8'):t;})();
const base=deserializeWorld(text) as World;
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]!;};
const p95=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(s.length*.95)]!;};
function time(label:string,make:()=>World,read:(w:World)=>unknown){
  for(let i=0;i<20;i++)read(make());
  const xs:number[]=[];
  for(let i=0;i<runs;i++){const w=make();const t=performance.now();read(w);xs.push(performance.now()-t);}
  console.log(JSON.stringify({label,median:+median(xs).toFixed(4),p95:+p95(xs).toFixed(4)}));
}
// A new World object sharing the arrays: the published state is unchanged.
const shared=()=>({...base}) as World;
const lotC=(w:World)=>{const free=freeColonistsSpawned(w);readImmobileCaravan(w);readNeedDoctor(w,free);readNeedMiner(w,free);readPasteDispenserNeedsHopper(w);readAwaitingMedicalOperation(w);readNeedResearchBench(w);readCaravanIdle(w);readQuestExpiresSoon(w);};
console.log(JSON.stringify({save:path,tick:base.tick,pawns:base.pawns.length,structures:base.structures.length,jobs:base.jobs.length,piles:base.piles.length,
  dispensers:base.structures.filter(s=>s.kind==='nutrient-paste-dispenser').length,mineJobs:base.jobs.filter(j=>j.kind==='mine').length,project:base.research?.project??null,
  surgery:base.pawns.filter(p=>p.surgeryRequest).length,groups:base.worldGroups?.groups.length??(base.group?1:0)}));
time('full list',shared,w=>readStatusAlerts(w));
const free0=freeColonistsSpawned(base);
time('freeColonistsSpawned (already computed once by the list)',shared,w=>freeColonistsSpawned(w));
for(const [label,read] of [['immobile caravan',readImmobileCaravan],['need doctor',(w:World)=>readNeedDoctor(w,free0)],['need miner',(w:World)=>readNeedMiner(w,free0)],
  ['paste dispenser',readPasteDispenserNeedsHopper],['awaiting operation',readAwaitingMedicalOperation],['research bench',readNeedResearchBench],['caravan idle',readCaravanIdle],['quest expires soon',readQuestExpiresSoon]] as const)
  time(label,shared,read as (w:World)=>unknown);
time('lot C readers',shared,lotC);
// Worst case for the readers: every doctor and miner disabled (the patients
// and the first mine order are searched), a hi-tech project without its bench
// (the whole building list is walked) and one operation request.
const worst=structuredClone(base);
for(const p of worst.pawns){p.priorities.doctor=0;p.priorities.mine=0;}
worst.structures=worst.structures.filter(s=>s.kind!=='hi-tech-research-bench');
worst.research={...(worst.research??{points:0}),project:'multi-analyzer'} as World['research'];
const patient=worst.pawns.find(p=>!p.prisoner&&p.state!=='dead');if(patient)patient.surgeryRequest={part:'left-arm',requestedAt:worst.tick};
time('lot C readers, worst case',()=>({...worst}) as World,lotC);
time('full list, worst case',()=>({...worst}) as World,w=>readStatusAlerts(w));
