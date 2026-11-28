import { AUTO_SLAUGHTER_SPECIES,LEGACY_AUTO_SLAUGHTER_SPECIES,isAutoSlaughterSpecies,type AutoSlaughterConfig } from './auto-slaughter-state.ts';
import type { World } from './types.ts';

const species=AUTO_SLAUGHTER_SPECIES;
const limits=['maxTotal','maxMales','maxMalesYoung','maxFemales','maxFemalesYoung'] as const;
const fields=['species',...limits,'allowPregnant'] as const;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);

/** Configurations carry only prospective limits, never cached animal IDs. */
export function validAutoSlaughterConfig(value:unknown,version:number=382):value is AutoSlaughterConfig {
  return object(value)&&Object.keys(value).length===fields.length+Number(Object.hasOwn(value,'allowBonded382'))
    &&fields.every(key=>Object.hasOwn(value,key))&&Object.keys(value).every(key=>(fields as readonly string[]).includes(key)||key==='allowBonded382'&&version>=382&&value.allowBonded382===true)
    &&isAutoSlaughterSpecies(value.species,version)&&typeof value.allowPregnant==='boolean'
    &&limits.every(key=>Number.isSafeInteger(value[key])&&Number(value[key])>=-1);
}

/** File and Decoder use the same sparse, version-aware policy admission. */
export function validAutoSlaughterTransport(world:World,version:number=world.schemaVersion):boolean {
  try {
    if(!Object.hasOwn(world,'autoSlaughter'))return true;
    const configs:unknown=world.autoSlaughter;
    return version>=228&&Array.isArray(configs)&&configs.length<=(version>=382?species:LEGACY_AUTO_SLAUGHTER_SPECIES).length
      &&configs.every(config=>validAutoSlaughterConfig(config,version))&&new Set(configs.map(config=>config.species)).size===configs.length;
  }catch{return false;}
}
