import {animalCore256,isAnimalSpecies256} from './animal-core-v256.ts';
import type {ArmorCategory} from './armor.ts';
import type {ImpactProtection} from './apparel-protection.ts';
import type {WildAnimal} from './wildlife-state.ts';

/** Schema 321: a creature's natural armor (Core race statBases ArmorRating_*),
 * e.g. tortoise 0.5/0.35, megascarab 0.72/0.18, megaspider 0.27/0.18,
 * spelopede 0.18/0.18. Same roll as worn armor: below half the effective
 * rating the hit is deflected, below the rating it is halved and a sharp hit
 * becomes blunt. Species without armor draw nothing. */
export function naturalArmor321(a:Pick<WildAnimal,'species'>):{sharp:number;blunt:number}|undefined {
  if(!isAnimalSpecies256(a.species))return undefined;
  const s=animalCore256(a.species).stats as {ArmorRating_Sharp?:number;ArmorRating_Blunt?:number};
  const sharp=s.ArmorRating_Sharp??0,blunt=s.ArmorRating_Blunt??0;
  return sharp>0||blunt>0?{sharp,blunt}:undefined;
}
export function naturalArmorProtection321(armor:{sharp:number;blunt:number},category:ArmorCategory,penetration:number,random:()=>number):ImpactProtection {
  if(!Number.isFinite(penetration)||penetration<0)throw new RangeError('Invalid natural armor penetration');
  return (_part,amount)=>{
    const rating=category==='sharp'?armor.sharp:category==='blunt'?armor.blunt:0;
    const effective=Math.max(0,rating-penetration);if(effective<=0)return {amount,converted:false};
    const draw=()=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw new RangeError('Invalid natural armor random');return n;};
    const roll=draw();
    if(roll<effective/2)return {amount:0,converted:false};
    if(roll<effective){const half=amount/2;return {amount:Math.floor(half)+Number(draw()<half%1),converted:category==='sharp'};}
    return {amount,converted:false};
  };
}
