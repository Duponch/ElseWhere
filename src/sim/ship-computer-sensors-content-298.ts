import {isSchema298OrLater} from './schema-compatibility-257.ts';
/** Prospective original definitions. Geometry, research admission, material
 * delivery, power topology and launch remain separate, unimplemented services. */
export const SHIP_COMPUTER_SENSORS_SCHEMA_298=298 as const;
export const isShipComputerSensorsSchema298=(value:unknown):value is typeof SHIP_COMPUTER_SENSORS_SCHEMA_298|299|300|301|302|303|304|305|306|307|308|309|310|311|312|313|314|315|316|317|318|319|320|321|322|323|324|325|326|327|328|329|330=>isSchema298OrLater(value);
export const SHIP_COMPUTER_SENSORS_KINDS_298=Object.freeze(['ship-computer','ship-sensors'] as const);
export type ShipComputerSensorsKind298=typeof SHIP_COMPUTER_SENSORS_KINDS_298[number];
export const isShipComputerSensorsKind298=(value:unknown):value is ShipComputerSensorsKind298=>value==='ship-computer'||value==='ship-sensors';

const physical=Object.freeze({
 width:2,depth:2,rotatable:false,support:'Heavy' as const,roof:false,
 constructionSkill:8,quality:false,minifiable:false,flammability:0,
 blocksMovement:true,blocksLight:true,blocksWind:true,fill:1,
 shipPart:true,transmitsPower:true,powerRole:'transmitter' as const,powerWatts:0,
 fuel:false,flick:false,breakdown:false,
});

export const SHIP_COMPUTER_CONTENT_298=Object.freeze({
 kind:'ship-computer' as const,label:'Ordinateur de vaisseau',nativeDef:'Ship_ComputerCore',
 researchProject:'ship-computer' as const,...physical,maxHitPoints:150,work:1600,coreWork:16000,
 ingredients:Object.freeze([
  Object.freeze({item:'steel' as const,quantity:150}),Object.freeze({item:'gold' as const,quantity:70}),
  Object.freeze({item:'advanced-component' as const,quantity:4}),Object.freeze({item:'ai-core' as const,quantity:1}),
 ]),
});

export const SHIP_SENSORS_CONTENT_298=Object.freeze({
 kind:'ship-sensors' as const,label:'Ensemble de capteurs',nativeDef:'Ship_SensorCluster',
 researchProject:'ship-sensors' as const,...physical,maxHitPoints:100,work:3000,coreWork:30000,
 ingredients:Object.freeze([
  Object.freeze({item:'steel' as const,quantity:140}),Object.freeze({item:'gold' as const,quantity:4}),
  Object.freeze({item:'component' as const,quantity:6}),Object.freeze({item:'advanced-component' as const,quantity:6}),
 ]),
});

export const SHIP_COMPUTER_SENSORS_CONTENT_298=Object.freeze({
 'ship-computer':SHIP_COMPUTER_CONTENT_298,'ship-sensors':SHIP_SENSORS_CONTENT_298,
});
