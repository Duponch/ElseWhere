import {isSchema298OrLater} from './schema-compatibility-257.ts';
/** Prospective factual research definitions, not a completed record or unlock.
 * Existing research runtime/save guards must explicitly admit the future data.
 * The long-range scanner's operational service is NOT qualified by this leaf. */
export const VICTORY_RESEARCH_SCHEMA_298=298 as const;
export const isVictoryResearchSchema298=(value:unknown):value is typeof VICTORY_RESEARCH_SCHEMA_298|299|300|301|302|303|304|305|306|307|308|309|310|311|312|313|314|315|316|317|318|319|320|321|322|323|324|325=>isSchema298OrLater(value);
export const VICTORY_RESEARCH_SCALE_298=1_000_000;

/** Distinct from the existing ground-scanner. Machining is a real hidden
 * prerequisite; the absence of an analyzer requirement is intentional. */
export const LONG_RANGE_MINERAL_SCANNER_RESEARCH_298=Object.freeze({
 project:'long-range-mineral-scanner' as const,recordKey:'longRangeMineralScanner' as const,
 label:'Scanner minéral longue portée',nativeDef:'LongRangeMineralScanner',
 points:2000,scale:VICTORY_RESEARCH_SCALE_298,scaledCost:2000*VICTORY_RESEARCH_SCALE_298,
 prerequisites:Object.freeze(['microelectronics'] as const),hiddenPrerequisites:Object.freeze(['machining'] as const),
 requiresHighTechBench:true,requiresAnalyzer:false,techLevel:'Industrial' as const,
});

export const SHIP_COMPUTER_RESEARCH_298=Object.freeze({
 project:'ship-computer' as const,recordKey:'shipComputer' as const,
 label:'Ordinateur de vaisseau',nativeDef:'ShipComputerCore',
 points:3000,scale:VICTORY_RESEARCH_SCALE_298,scaledCost:3000*VICTORY_RESEARCH_SCALE_298,
 prerequisites:Object.freeze(['ship-basics'] as const),hiddenPrerequisites:Object.freeze([] as const),
 requiresHighTechBench:true,requiresAnalyzer:true,techLevel:'Spacer' as const,
});

export const SHIP_SENSORS_RESEARCH_298=Object.freeze({
 project:'ship-sensors' as const,recordKey:'shipSensors' as const,
 label:'Ensemble de capteurs',nativeDef:'ShipSensorCluster',
 points:4000,scale:VICTORY_RESEARCH_SCALE_298,scaledCost:4000*VICTORY_RESEARCH_SCALE_298,
 prerequisites:Object.freeze(['ship-basics'] as const),hiddenPrerequisites:Object.freeze(['long-range-mineral-scanner'] as const),
 requiresHighTechBench:true,requiresAnalyzer:true,techLevel:'Spacer' as const,
});

export const VICTORY_RESEARCH_CONTENT_298=Object.freeze({
 'long-range-mineral-scanner':LONG_RANGE_MINERAL_SCANNER_RESEARCH_298,
 'ship-computer':SHIP_COMPUTER_RESEARCH_298,'ship-sensors':SHIP_SENSORS_RESEARCH_298,
});
export type VictoryResearchProject298=keyof typeof VICTORY_RESEARCH_CONTENT_298;
export type VictoryResearchRecordKey298=typeof VICTORY_RESEARCH_CONTENT_298[VictoryResearchProject298]['recordKey'];
export const isVictoryResearchProject298=(value:unknown):value is VictoryResearchProject298=>value==='long-range-mineral-scanner'||value==='ship-computer'||value==='ship-sensors';
