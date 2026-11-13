import { expect,test } from 'vitest';
import { createMedicalRecord } from '../src/sim/injury-state';
import { FLU_UNIT } from '../src/sim/flu-rules';
import { tendFlu } from '../src/sim/flu-state';
import { moodTarget,moodThoughts } from '../src/sim/mood';
import { fluInspection } from '../src/ui/flu-inspection';
import { healthStatusText } from '../src/ui/health-inspection';
import { medicalCamp } from './scenarios/health';

function patient(){
  const world=medicalCamp(),pawn=world.pawns[0]!;
  pawn.health=createMedicalRecord(world.tick);
  pawn.health.flu={bornAt:world.tick,severity:700_000_000,immunity:100_000_000,luck:1_000_000};
  return {world,pawn,record:pawn.health};
}

test('flu card states severity, immunity, care quality and the exact renewal gate',()=>{
  const {record}=patient();
  expect(fluInspection(record)).toMatchObject({stage:'major',summary:'Grippe majeure · gravité 70.0 % · immunité 10.0 %.',care:'Aucun soin actif.',guidance:'Nouveau soin possible maintenant.'});
  expect(tendFlu(record,800,316)).toBe(true);
  expect(fluInspection(record)).toMatchObject({care:'Soin actif · qualité 80.0 % · effet restant 12.0 h.',guidance:'Renouvellement dans 9.6 h.'});
  record.tick=5400;expect(fluInspection(record)?.guidance).toBe('Renouvellement dans < 0,1 h.');
  record.tick=5401;expect(fluInspection(record)?.guidance).toBe('Nouveau soin possible maintenant.');
  record.flu!.immunity=FLU_UNIT-1;expect(fluInspection(record)?.summary).toContain('immunité 99.9 %');
  record.flu!.immunity=FLU_UNIT;expect(fluInspection(record)?.guidance).toBe('Immunité acquise · convalescence en cours.');
  record.flu!.severity=0;expect(fluInspection(record)).toMatchObject({stage:'none',summary:'Grippe résolue · immunité résiduelle 100.0 %.'});
  delete record.flu;expect(fluInspection(record)).toBeNull();
});

test('illness-only health status is explicit and Sick is one temporary -5 thought',()=>{
  const {world,pawn,record}=patient();
  expect(healthStatusText(pawn)).toContain('Malade · Douleur');
  expect(healthStatusText(pawn)).not.toContain('Aucune lésion');
  const baseline=moodTarget(moodThoughts(world,{...pawn,health:undefined}));
  expect(moodThoughts(world,pawn).filter(t=>t.id==='sick')).toEqual([expect.objectContaining({label:'Malade',offset:-5,kind:'situation'})]);
  expect(moodTarget(moodThoughts(world,pawn))).toBe(baseline-5);
  record.flu!.severity=900_000_000;
  const thoughts=moodThoughts(world,pawn);
  expect(thoughts.filter(t=>t.id==='sick')).toHaveLength(1);
  expect(thoughts.filter(t=>t.id==='minor-pain')).toHaveLength(1);
  record.flu!.severity=0;expect(moodThoughts(world,pawn).some(t=>t.id==='sick')).toBe(false);
});
