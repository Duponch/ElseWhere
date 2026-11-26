import {expect,test} from 'vitest';
import {readColonyGraphicsPreferences} from '../src/render/colony-graphics-preferences';
import type {SceneRequest} from '../src/render/worker-scene/protocol';

test('the renderer-open settings preserve normalized client preferences across the structured clone',()=>{
  const stored=new Map(Object.entries({
    'lisiere.presentation.textures.v1':'false','lisiere.presentation.ground-grass.v1':'false',
    'lisiere.presentation.room.v1':'false','lisiere.presentation.diorama.v1':'false',
    'lisiere.presentation.cloud-mask-radius.v1':'0','lisiere.presentation.room-mask-radius.v1':'0',
    'lisiere.presentation.shadows.v1':'{"resolution":512,"frequency":30}',
    'lisiere.presentation.lighting.v1':'{"sun":0.5,"moon":0.25,"ambient":1.2}',
    'lisiere.presentation.animation-detail.v1':'{"enabled":false,"nearPixels":36,"farPixels":4,"middleHz":20}',
    'elsewhere.graphics-style.v1':'{"style":"origami","impasto":1.5,"blackEdges":0.4}',
    'lisiere.presentation.designations.min-cell-pixels.v1':'200','lisiere.presentation.item-labels.min-cell-pixels.v1':'0',
  }));
  const graphics=readColonyGraphicsPreferences(key=>stored.get(key)??null);
  const packet:Pick<Extract<SceneRequest,{type:'open'}>,'graphics'>={graphics};
  const copy=structuredClone(packet);
  expect(copy.graphics).toEqual(graphics);
  expect(copy.graphics).toMatchObject({texturesEnabled:false,groundGrassEnabled:false,roomEnabled:false,dioramaEnabled:false,decorOcclusion:false,
    shadows:{resolution:512,frequency:30},lighting:{sun:.5,moon:.25,ambient:1.2},animation:{enabled:false,nearPixels:36,farPixels:4,middleHz:20},
    style:{style:'origami',impasto:1.5,blackEdges:.4},designationMinCellPixels:96,itemLabelMinCellPixels:0});
  expect(readColonyGraphicsPreferences(()=>{throw Error('storage disabled');})).toEqual(readColonyGraphicsPreferences(()=>null));
});
