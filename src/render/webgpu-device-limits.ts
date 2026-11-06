/// <reference types="@webgpu/types" />
/** WebGPU device requests receive the specification minimum (16 inter-stage
 * variables) unless a higher limit is requested, even when the adapter supports
 * more. Some actor material variants need 16 user varyings plus front_facing and
 * otherwise fail pipeline creation ("Total fragment input variables count (17)").
 * Request only the ceiling that the same adapter reports; never a guessed value. */
export const SPEC_MIN_INTER_STAGE_SHADER_VARIABLES = 16;

export type RendererDeviceLimits = Record<string, number>;

export async function adapterRendererLimits(
  gpu: Pick<GPU, 'requestAdapter'> | undefined = globalThis.navigator?.gpu,
  powerPreference: GPUPowerPreference = 'high-performance',
): Promise<RendererDeviceLimits | undefined> {
  if (!gpu) return undefined;
  try {
    const adapter = await gpu.requestAdapter({ powerPreference });
    const max = adapter?.limits.maxInterStageShaderVariables;
    return typeof max === 'number' && Number.isSafeInteger(max) && max > SPEC_MIN_INTER_STAGE_SHADER_VARIABLES
      ? { maxInterStageShaderVariables: max }
      : undefined;
  } catch {
    // The renderer performs its own adapter request and reports real failures.
    return undefined;
  }
}
