import type {WorldFactionDef256} from '../sim/world-faction-catalog';

/** Visible Core faction definitions, including inherited spectrum endpoints.
 * Numeric colour samples only; Elsewhere's own flag pictogram is used. */
type RGB=readonly [number,number,number];
const spectrum:Partial<Record<WorldFactionDef256,readonly [RGB,RGB]>>={
  OutlanderCivil:[[.35,.30,.60],[.45,.40,.90]],
  OutlanderRough:[[0,.4,.94],[.64,.8,1]],
  TribeCivil:[[.85,.75,.37],[.94,.61,.06]],
  TribeRough:[[.03,.47,.16],[.49,.96,.51]],
  TribeSavage:[[.85,0,0],[.85,.7,.7]],
  Pirate:[[.78,0,.27],[1,.74,.83]],
  PlayerColony:[[0,.737,.847],[0,.737,.847]],
  PlayerTribe:[[0,.737,.847],[0,.737,.847]],
};
export function nativeFactionColor(def:WorldFactionDef256,value:number):string{
  const ends=spectrum[def];if(!ends)return '#ffffff';
  const t=Math.max(0,Math.min(1,value)),[a,b]=ends;
  return '#'+a.map((v,i)=>Math.round((v+(b[i]!-v)*t)*255).toString(16).padStart(2,'0')).join('');
}
