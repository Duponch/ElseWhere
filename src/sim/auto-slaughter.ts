import { animalLifeStage } from './animal-life.ts';
import { autoSlaughterOrder,isAutoSlaughterSpecies,defaultAutoSlaughterConfig,type AutoSlaughterCommand,type AutoSlaughterConfig,type AutoSlaughterSpecies } from './auto-slaughter-state.ts';
import { validAutoSlaughterConfig } from './auto-slaughter-save.ts';
import type { CommandResult,World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';

export interface AutoSlaughterCounts {total:number;males:number;malesYoung:number;females:number;femalesYoung:number;pregnant:number}
const EMPTY_TARGETS:ReadonlySet<number>=new Set<number>();
const cache=new WeakMap<World,{signature:string;targets:ReadonlySet<number>}>();
const limited=(c:AutoSlaughterConfig):boolean=>c.maxTotal!==-1||c.maxMales!==-1||c.maxMalesYoung!==-1||c.maxFemales!==-1||c.maxFemalesYoung!==-1;
const aliveOwned=(a:WildAnimal):boolean=>!!a.domestic&&a.state!=='dead'&&!a.health?.death;
const older=(a:WildAnimal,b:WildAnimal):number=>b.ageTicks-a.ageTicks||a.id-b.id;

/** Population and physical availability are deliberately separate. Reservations,
 * carriage, danger, routes and a handler's area never manufacture replacements.
 * Batch callers capture this set once and pass it to slaughterIntent below. */
export function autoSlaughterTargets(w:World,version:number=w.schemaVersion):ReadonlySet<number> {
  if(version<228||!w.autoSlaughter?.some(limited))return EMPTY_TARGETS;
  const configs=w.autoSlaughter!.filter(c=>limited(c)&&(version>=382||isAutoSlaughterSpecies(c.species,version))).sort((a,b)=>autoSlaughterOrder(a.species,b.species));
  const species=new Map(configs.map(c=>[c.species,c]));
  const animals=(w.wildlife?.animals??[]).filter(a=>aliveOwned(a)&&species.has(a.species)&&(version<382||a.startingPet?.bondedPawnId===undefined||species.get(a.species)?.allowBonded382===true));
  // Immutable scalar captures see mutations within the same tick. Age minus
  // tick remains stable under ordinary biological ageing; stage transitions
  // and relative ages still change the signature. No mutable witness escapes.
  const signature=JSON.stringify([configs.map(c=>[c.species,c.maxTotal,c.maxMales,c.maxMalesYoung,c.maxFemales,c.maxFemalesYoung,c.allowPregnant]),
    animals.map(a=>[a.id,a.species,a.sex,animalLifeStage(a),a.ageTicks-w.tick,a.pregnancy?.progress??null])]);
  const previous=cache.get(w);if(previous?.signature===signature)return previous.targets;
  const targets=new Set<number>();
  for(const c of configs){
    const all:WildAnimal[]=[],males:WildAnimal[]=[],maleYoung:WildAnimal[]=[],females:WildAnimal[]=[],femaleYoung:WildAnimal[]=[],pregnant:WildAnimal[]=[];
    for(const a of animals){
      if(a.species!==c.species)continue;
      const adult=animalLifeStage(a)==='adult';
      if(a.sex==='female'&&adult&&a.pregnancy){if(c.allowPregnant)pregnant.push(a);continue;}
      all.push(a);
      (a.sex==='male'?adult?males:maleYoung:adult?females:femaleYoung).push(a);
    }
    for(const list of [all,males,maleYoung,females,femaleYoung])list.sort(older);
    pregnant.sort((a,b)=>b.pregnancy!.progress-a.pregnancy!.progress||a.id-b.id);
    // Core appends pregnancies after every non-pregnant in both lists.
    all.push(...pregnant);females.push(...pregnant);
    const take=(list:WildAnimal[],max:number):void=>{
      if(max===-1)return;
      for(let i=0;i<list.length-max;i++)targets.add(list[i]!.id);
    };
    take(females,c.maxFemales);take(femaleYoung,c.maxFemalesYoung);
    take(males,c.maxMales);take(maleYoung,c.maxMalesYoung);
    take(all.filter(a=>!targets.has(a.id)),c.maxTotal);
  }
  cache.set(w,{signature,targets});return targets;
}

/** Manual intent survives protections and quota changes. Automatic intent
 * never writes the durable manual designation or owns a second job family. */
export function slaughterIntent(w:World,a:WildAnimal,version:number=w.schemaVersion,targets?:ReadonlySet<number>):boolean {
  return !!a.domestic&&(a.domestic.slaughter===true||version>=228&&(targets??autoSlaughterTargets(w,version)).has(a.id));
}

/** Same eligible denominator as selection; pregnancies remain visible in the
 * separate count even while their protection excludes them from the maxima. */
export function autoSlaughterCounts(w:World,species:AutoSlaughterSpecies):AutoSlaughterCounts {
  const config=w.schemaVersion>=228?w.autoSlaughter?.find(c=>c.species===species):undefined;
  const counts:AutoSlaughterCounts={total:0,males:0,malesYoung:0,females:0,femalesYoung:0,pregnant:0};
  for(const a of w.wildlife?.animals??[]){
    if(a.species!==species||!aliveOwned(a)||w.schemaVersion>=382&&!config?.allowBonded382&&a.startingPet?.bondedPawnId!==undefined)continue;
    const adult=animalLifeStage(a)==='adult';
    if(a.sex==='female'&&adult&&a.pregnancy){counts.pregnant++;if(!config?.allowPregnant)continue;}
    counts.total++;
    if(a.sex==='male'){if(adult)counts.males++;else counts.malesYoung++;}
    else if(adult)counts.females++;else counts.femalesYoung++;
  }
  return counts;
}

/** The engine reconciles ongoing work after a successful policy command,
 * including while paused. Sparse defaults add no historical herd mandate. */
export function setAutoSlaughterPolicy(w:World,cmd:AutoSlaughterCommand):CommandResult {
  if(w.schemaVersion<228||!cmd||cmd.type!=='auto-slaughter-policy'||!validAutoSlaughterConfig(cmd.config,w.schemaVersion))
    return {ok:false,code:'invalid-command',reason:'Politique d’abattage automatique invalide.'};
  const config={...cmd.config},policies=(w.autoSlaughter??[]).filter(c=>c.species!==config.species);
  const defaults=defaultAutoSlaughterConfig(config.species);
  if(limited(config)||config.allowPregnant!==defaults.allowPregnant||config.allowBonded382)policies.push(config);
  policies.sort((a,b)=>autoSlaughterOrder(a.species,b.species));
  if(policies.length)w.autoSlaughter=policies;else delete w.autoSlaughter;
  for(const pawn of w.pawns)pawn.planCooldown=0;
  return {ok:true};
}
