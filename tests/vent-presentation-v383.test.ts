import {expect,test} from 'vitest';
import {ventParts} from '../src/render/vent-parts';
import {ConfirmedStructurePresentationSignature} from '../src/render/ConfirmedStructurePresentationSignature';
import {architectToolAvailable} from '../src/ui/architect-availability';
import {placementMaterial} from '../src/ui/construction-controls';
import {modelIconUrl} from '../src/ui/pictograms';
import {ventRoomWitnessV383} from './scenarios/vent-v383';

test('real aperture changes original resident parts and confirmed signature at the same tick',()=>{
  const w=ventRoomWitnessV383(),vent=w.structures.find(s=>s.kind==='vent')!,signature=new ConfirmedStructurePresentationSignature();
  const before=signature.read(w.structures,'',''),open=ventParts(w);vent.vent!.open=false;const closed=ventParts(w);
  expect(closed.length).toBe(open.length);expect(closed).not.toEqual(open);expect(signature.read(w.structures,'','')).not.toBe(before);
  expect(architectToolAvailable(w,'vent')).toBe(true);expect(placementMaterial('vent','wood')).toBe('steel');
  expect(modelIconUrl('vent')).toBe('/assets/ui/elsewhere/pictograms-20261107/vent.svg');
  expect(ventParts(w,true).every(p=>p.y+(p.sy??1)/2<=.7200001)).toBe(true);
});
