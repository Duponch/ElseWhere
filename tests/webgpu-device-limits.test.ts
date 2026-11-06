import { expect, test } from 'vitest';
import { adapterRendererLimits } from '../src/render/webgpu-device-limits';

const gpu = (limit: number | undefined, fail = false) => ({
  requestAdapter: async () => { if (fail) throw Error('adapter failed'); return limit === undefined ? null : { limits: { maxInterStageShaderVariables: limit } }; },
}) as unknown as Pick<GPU, 'requestAdapter'>;

test('requests only the adapter-reported inter-stage ceiling above the WebGPU default', async () => {
  expect(await adapterRendererLimits(gpu(28))).toEqual({ maxInterStageShaderVariables: 28 });
  expect(await adapterRendererLimits(gpu(16))).toBeUndefined();
  expect(await adapterRendererLimits(gpu(undefined))).toBeUndefined();
  expect(await adapterRendererLimits(gpu(28, true))).toBeUndefined();
  expect(await adapterRendererLimits(undefined)).toBeUndefined();
});
