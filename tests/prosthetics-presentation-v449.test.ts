import {expect,test,vi} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {installArtificialPart} from '../src/sim/artificial-parts.ts';
import {PROSTHETIC_ITEMS_273} from '../src/sim/prosthetic-content-273.ts';
import {itemGeometry,itemCargoKind} from '../src/render/item-presentation';
import {pawnGeometry,cargoGeometry,type CargoGeometryRange} from '../src/render/pawn-geometry';
import {humanLimbVisualMask} from '../src/render/human-anatomy-presentation';
import {itemPortraitDataUrl} from '../src/render/item-portrait';
import {modelIconUrl} from '../src/ui/pictograms';
import {itemInformation} from '../src/ui/item-information';
import {STORAGE_FILTER_TREE,STORAGE_LEAVES,storageNodeLeaves} from '../src/ui/storage-filter-tree';
import {healthSurgeryView,healthInjuryRows,healthPartTooltip,requestInspectedInstallation,requestInspectedProstheticRemoval273} from '../src/ui/health-inspection';
import {researchProjects} from '../src/ui/research-projects';
import {prostheticRecipeDescription273} from '../src/ui/bill-controls';
import {actionProgress} from '../src/render/action-feedback';
import type {MaterialPile} from '../src/sim/types.ts';

test('original prosthetic shapes reuse ground/cargo/portrait geometry and leave the ordinary human rig unchanged',()=>{
 const rig=pawnGeometry(),cargo=cargoGeometry();
 try{
  expect(rig.getAttribute('position').count).toBe(3190);
  const ranges=cargo.userData.cargoRangesByKind as Record<number,CargoGeometryRange>,portraits=[];
  for(const item of [...PROSTHETIC_ITEMS_273,'unfinished-prosthetic'] as const){
   expect(itemGeometry(item)).toHaveLength(6);expect(itemGeometry(item)).toEqual(itemGeometry(item));
   const range=ranges[itemCargoKind(item)]!;expect(range.count).toBeGreaterThan(0);expect(range.count).toBeLessThanOrEqual(512);
   const icon=itemPortraitDataUrl(item);expect(modelIconUrl(`item-${item}`)).toBe(`/assets/ui/elsewhere/pictograms-20261107/item-${item}.svg`);
   const svg=decodeURIComponent(icon.split(',')[1]!);expect(svg).toContain('<path');expect(svg).not.toMatch(/NaN|Infinity/);portraits.push(svg);
  }
  expect(new Set(portraits).size).toBe(3);
 }finally{rig.dispose();cargo.dispose();}
});

test('storage and item information expose one physical prosthesis per item without weapon quality or fictitious clinical effects',()=>{
 const manufactured=STORAGE_FILTER_TREE.find(n=>n.id==='manufactured')!,branch=manufactured.children!.find(n=>n.id==='prostheses')!;
 expect(storageNodeLeaves(branch)).toEqual([...PROSTHETIC_ITEMS_273]);
 for(const item of PROSTHETIC_ITEMS_273){
  expect(STORAGE_LEAVES.filter(i=>i===item)).toHaveLength(1);
  const pile:MaterialPile={id:1,item,kind:'prosthesis',quantity:1,owner:{type:'ground',x:3,z:3}},info=itemInformation(pile);
  expect(info.rows.find(r=>r.label==='Efficacité')?.value).toBe(item==='prosthetic-arm'?'50 %':'85 %');
  expect(info.rows.find(r=>r.label==='Limite de pile')?.value).toBe('1');
  expect(info.rows.some(r=>r.label==='Qualité')).toBe(false);expect(info.rows.find(r=>r.label==='Recette')?.value).toContain('40 acier + 4 composants');
 }
 expect(prostheticRecipeDescription273).toContain('15 000');expect(prostheticRecipeDescription273).toContain('Artisanat 5');
 const project=researchProjects.find(p=>p.id==='prosthetics')!;expect(project.cost).toBe(600);expect(project.detail).toContain('Après Usinage');
});

test.each([['prosthetic-arm','left-shoulder','left-arm',.5],['prosthetic-leg','left-leg','left-foot',.85]] as const)('%s installation and removal controls use the real anatomy guard, keep the restored limb visible and expose replaced descendants once',(kind,part,child,efficiency)=>{
 const world=createWorld(449,16,16),pawn=world.pawns[0]!;pawn.health=createMedicalRecord(world.tick);
 const actions={request:vi.fn(),install:vi.fn(),remove:vi.fn(),cancel:vi.fn()},before=JSON.stringify(world);
 const choice=healthSurgeryView(pawn,world).installations.find(c=>c.implant===kind&&c.part===part)!;
 expect(choice.reason).toBeUndefined();expect(choice.guidance).toContain('2 médicaments');expect(choice.guidance).toContain('Médecine 4');
 expect(requestInspectedInstallation(pawn,part,kind,actions)).toBeUndefined();expect(actions.install.mock.calls).toEqual([[pawn.id,part,kind]]);expect(JSON.stringify(world)).toBe(before);
 expect(installArtificialPart(pawn.health,part,kind)).toBe(true);
 expect(humanLimbVisualMask(pawn)).toBe(0);expect(healthInjuryRows(pawn).filter(r=>r.description.includes('prothétique'))).toHaveLength(1);
 expect(healthPartTooltip(pawn,child).rows).toContainEqual({label:'Efficacité de la prothèse',value:`${efficiency*100} %`});
 expect(healthPartTooltip(pawn,child).rows.some(r=>r.label==='Points de vie')).toBe(false);
 const removal=healthSurgeryView(pawn,world).removals.find(c=>c.kind===kind&&c.part===part)!;expect(removal.reason).toBeUndefined();
 const installed=JSON.stringify(world);expect(requestInspectedProstheticRemoval273(pawn,part,kind,actions)).toBeUndefined();expect(actions.remove.mock.calls).toEqual([[pawn.id,part]]);expect(JSON.stringify(world)).toBe(installed);
 pawn.surgeryRequest={part,removeArtificial273:kind,requestedAt:world.tick};expect(healthSurgeryView(pawn,world).status).toContain('Retrait demandé');expect(requestInspectedProstheticRemoval273(pawn,part,kind,actions)).toContain('déjà');
});

test('confirmed surgical progress uses each actual installation and removal threshold',()=>{
 const world=createWorld(449,16,16),doctor=world.pawns[0]!;doctor.state='working';
 doctor.surgery={patientId:world.pawns[1]!.id,part:'left-shoulder',implant:'prosthetic-arm',bedId:100,spot:{x:3,z:3},phase:'work',progress:1250,workCore:1250};
 expect(actionProgress(world,doctor)).toMatchObject({kind:'surgery',total:2500,fraction:.5});
 delete doctor.surgery.implant;doctor.surgery.removeArtificial273='prosthetic-arm';doctor.surgery.progress=1000;
 expect(actionProgress(world,doctor)).toMatchObject({kind:'surgery',total:2000,fraction:.5});
});
