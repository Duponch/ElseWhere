/** Optional representation refusal, issued only by a pure capacity planner
 * before any GPU allocation/submission. Renderer/WGSL errors never use it. */
export class TreeAtlasAdmissionRefusal extends Error {readonly beforeGpuAllocation=true;}
