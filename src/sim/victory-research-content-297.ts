/** Prospective factual research definitions, not a completed record or unlock.
 * Existing research runtime/save guards must explicitly admit the future data.
 * The long-range scanner's operational service is NOT qualified by this leaf. */
export const VICTORY_RESEARCH_SCHEMA_297=297 as const;
export const isVictoryResearchSchema297=(value:unknown):value is typeof VICTORY_RESEARCH_SCHEMA_297=>value===VICTORY_RESEARCH_SCHEMA_297;
export const VICTORY_RESEARCH_SCALE_297=1_000_000;

/** Distinct from the existing ground-scanner. Machining is a real hidden
 * prerequisite; the absence of an analyzer requirement is intentional. */
export const LONG_RANGE_MINERAL_SCANNER_RESEARCH_297=Object.freeze({
 project:'long-range-mineral-scanner' as const,recordKey:'longRangeMineralScanner' as const,
 label:'Scanner minéral longue portée',nativeDef:'LongRangeMineralScanner',
 points:2000,scale:VICTORY_RESEARCH_SCALE_297,scaledCost:2000*VICTORY_RESEARCH_SCALE_297,
 prerequisites:Object.freeze(['microelectronics'] as const),hiddenPrerequisites:Object.freeze(['machining'] as const),
 requiresHighTechBench:true,requiresAnalyzer:false,techLevel:'Industrial' as const,
});

export const SHIP_COMPUTER_RESEARCH_297=Object.freeze({
 project:'ship-computer' as const,recordKey:'shipComputer' as const,
 label:'Ordinateur de vaisseau',nativeDef:'ShipComputerCore',
 points:3000,scale:VICTORY_RESEARCH_SCALE_297,scaledCost:3000*VICTORY_RESEARCH_SCALE_297,
 prerequisites:Object.freeze(['ship-basics'] as const),hiddenPrerequisites:Object.freeze([] as const),
 requiresHighTechBench:true,requiresAnalyzer:true,techLevel:'Spacer' as const,
});

export const SHIP_SENSORS_RESEARCH_297=Object.freeze({
 project:'ship-sensors' as const,recordKey:'shipSensors' as const,
 label:'Ensemble de capteurs',nativeDef:'ShipSensorCluster',
 points:4000,scale:VICTORY_RESEARCH_SCALE_297,scaledCost:4000*VICTORY_RESEARCH_SCALE_297,
 prerequisites:Object.freeze(['ship-basics'] as const),hiddenPrerequisites:Object.freeze(['long-range-mineral-scanner'] as const),
 requiresHighTechBench:true,requiresAnalyzer:true,techLevel:'Spacer' as const,
});

export const VICTORY_RESEARCH_CONTENT_297=Object.freeze({
 'long-range-mineral-scanner':LONG_RANGE_MINERAL_SCANNER_RESEARCH_297,
 'ship-computer':SHIP_COMPUTER_RESEARCH_297,'ship-sensors':SHIP_SENSORS_RESEARCH_297,
});
export type VictoryResearchProject297=keyof typeof VICTORY_RESEARCH_CONTENT_297;
export type VictoryResearchRecordKey297=typeof VICTORY_RESEARCH_CONTENT_297[VictoryResearchProject297]['recordKey'];
export const isVictoryResearchProject297=(value:unknown):value is VictoryResearchProject297=>value==='long-range-mineral-scanner'||value==='ship-computer'||value==='ship-sensors';
