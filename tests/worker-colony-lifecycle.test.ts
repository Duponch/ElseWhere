import {expect,test,vi} from 'vitest';
import {applySceneTexture} from '../src/render/worker-scene/apply-texture';
import {SceneSimulation} from '../src/render/worker-scene/simulation';
import {ResidentVegetationAssembler} from '../src/bridge/resident-vegetation-assembler';
import type {World} from '../src/sim/types';

test('an unavailable texture uses its layer fallback while an invalid renderer callback still fails',async()=>{
  const fallback=vi.fn(),loaded=vi.fn();
  await applySceneTexture(Promise.reject(Error('missing atlas')),()=>false,loaded,fallback);
  expect(fallback).toHaveBeenCalledTimes(1);expect(loaded).not.toHaveBeenCalled();
  const image={close:vi.fn()} as unknown as ImageBitmap;
  await expect(applySceneTexture(Promise.resolve(image),()=>false,()=>{throw Error('upload failed');},fallback)).rejects.toThrow('upload failed');
  expect(image.close).toHaveBeenCalledTimes(1);expect(fallback).toHaveBeenCalledTimes(1);
  await applySceneTexture(Promise.resolve(image),()=>true,loaded,fallback);
  expect(image.close).toHaveBeenCalledTimes(2);expect(loaded).not.toHaveBeenCalled();
});

test('a campaign-only delivery retires the last rendered map before notifying the host',()=>{
  class TestScene extends SceneSimulation {
    protected override createDecoder(){return new ResidentVegetationAssembler();}
    protected override createWorker(){return {terminate(){}} as Worker;}
    protected override bindWorkerOutput(){}
    campaignOnly(){this.deliverCampaignOnly();}
  }
  const client=new TestScene();
  try {
    client.full={world:{} as World,replaced:false,speed:6,defer:false,owner:{}};
    client.lastPhase={};client.speed=6;client.core=1234;
    const report=vi.fn(()=>{expect(client.full).toBeUndefined();expect(client.lastPhase).toBeUndefined();expect(client.core).toBe(0);expect(client.speed).toBe(0);});
    client.onError=report;client.campaignOnly();
    expect(report).toHaveBeenCalledExactlyOnceWith('Cette campagne ne contient plus de carte de colonie active.');
  } finally {client.dispose();}
});
