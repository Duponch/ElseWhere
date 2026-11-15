import type { Cell } from './types.ts';

export const SCENARIO_REVISION=1 as const;
/** Prepared candidates and a chosen world tile, without changing old starts. */
export const PREPARED_CRASHLANDED_REVISION=9 as const;
export const ARRIVING_CRASHLANDED_REVISION=10 as const;
export const SCENARIOS=Object.freeze({
  crashlanded:Object.freeze({label:'Atterrissage forcé',revision:8 as const,minSize:32,description:'Adaptation partielle : trois personnes, 300 bois, 450 acier, 30 composants, 50 repas de survie, 30 médicaments, 800 argent, un fusil à verrou, un revolver, un couteau en plastacier, trois chemises et un gilet. Taille de pierre, Mobilier complexe et Pâte nutritive connus ; Cassandra et Récit d’aventure restent partiels.'}),
  survivors:Object.freeze({label:'Trois survivants',revision:SCENARIO_REVISION,minSize:32,description:'Forêt tempérée : 300 bois, 450 acier, 30 composants, 50 repas de survie, 30 médicaments, un revolver, trois chemises portées et un gilet. Vêtements complexes et Climatisation connus. Départ Elsewhere inspiré de Crashlanded ; contenu et difficulté encore partiels.'}),
  camp:Object.freeze({label:'Camp pédagogique',revision:SCENARIO_REVISION,minSize:32,description:'Le camp historique : clairière centrale, ressources proches et recherches à découvrir. Adapté aux essais des boucles de colonie.'}),
  sentry:Object.freeze({label:'Rencontre armée',revision:SCENARIO_REVISION,minSize:64,description:'Scène de combat contrôlée avec une sentinelle hostile et un revolver équipé. Ce n’est pas un départ de survie ordinaire.'}),
});
export type ScenarioId=keyof typeof SCENARIOS;
export interface ScenarioStamp {id:ScenarioId;revision:1|2|3|4|5|6|7|8|9|10;landing:Cell}
export const DEFAULT_SCENARIO:ScenarioId='survivors';
export const isScenarioId=(value:unknown):value is ScenarioId=>typeof value==='string'&&Object.hasOwn(SCENARIOS,value);
