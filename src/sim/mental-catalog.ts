export type MentalCrisisKind='sad-wander'|'food-binge'|'drug-binge'|'tantrum'|'berserk'|'murderous-rage'|'psychotic-wander'|'wander-own-room'|'insulting-spree'|'targeted-insulting-spree';
export const MENTAL_CRISIS_CATALOG={
  'confused-wander':{label:'Errance confuse',intensity:0,weight:0,minCore:3500,maxCore:120000,recoveryMtb:.2},
  'sad-wander':{label:'Errance triste',intensity:0,weight:.5,minCore:40000,maxCore:60000,recoveryMtb:.166},
  'food-binge':{label:'Frénésie alimentaire',intensity:0,weight:.8,minCore:25000,maxCore:45000,recoveryMtb:.166},
  'drug-binge':{label:'Frénésie alcoolique',intensity:1,weight:1,minCore:40000,maxCore:60000,recoveryMtb:.133},
  tantrum:{label:'Crise de destruction',intensity:1,weight:.333,minCore:8000,maxCore:12000,recoveryMtb:.033},
  berserk:{label:'Fureur violente',intensity:2,weight:1,minCore:40000,maxCore:60000,recoveryMtb:.166},
  'murderous-rage':{label:'Colère meurtrière',intensity:2,weight:1,minCore:100000,maxCore:100000,recoveryMtb:0},
  // Schema 350 (MentalStates_Mood.xml), see mental-breaks-350.
  'psychotic-wander':{label:'Errance psychotique',intensity:1,weight:1,minCore:70000,maxCore:90000,recoveryMtb:.166},
  'wander-own-room':{label:'Retraite dans sa chambre',intensity:0,weight:.5,minCore:40000,maxCore:60000,recoveryMtb:.166},
  'insulting-spree':{label:'Série d’insultes',intensity:0,weight:.5,minCore:25000,maxCore:45000,recoveryMtb:.166},
  'targeted-insulting-spree':{label:'Série d’insultes ciblée',intensity:0,weight:.5,minCore:25000,maxCore:45000,recoveryMtb:.166},
} as const;
export const mentalCrisisLabel=(kind:MentalCrisisKind|'confused-wander'):string=>MENTAL_CRISIS_CATALOG[kind].label;
/** Core population curve; local population is living free colonists on this map. */
export const murderousRageWeight=(population:number):number=>Math.max(.1,Math.min(1,.1+(population-2)*.18));
