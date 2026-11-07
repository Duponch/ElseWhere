import { REVISION, WebGPURenderer, type Camera, type Object3D } from 'three/webgpu';

// Three 0.186 does not scope this field across nested render() calls. A shadow
// bundle resets it while the landscape bundle is still being recorded. Its
// remaining draws then disappear from the uniform-update list on replay.
type BundleContext = { _currentRenderBundle: unknown };
type PipelineRouting = { getForRender(renderObject: unknown, promises?: { push(promise: Promise<void>): unknown } | null): unknown };
type CompileContext = { _initialized: boolean; _pipelines?: PipelineRouting };

/** Keep shadow recording separate from the suspended main-pass recording.
 * Local compatibility adapter for pinned Three 0.186.0; no vendor files patched.
 * Re-audit this private field and the native motion oracle when upgrading Three.
 */
export class ReentrantRenderer extends WebGPURenderer {
  constructor(parameters?: ConstructorParameters<typeof WebGPURenderer>[0]) {
    super(parameters);
    if (REVISION !== '186' || !('_currentRenderBundle' in this)) {
      throw new Error('Render-bundle context adapter requires an audit for this Three version.');
    }
  }

  /** Pipelines requested by compileAsync, settled or not. */
  private readonly pendingPipelines = new Set<Promise<void>>();
  private pipelineRoutingInstalled = false;
  /** Set only inside renderWarmingPipelines. */
  private warmingRender = false;

  /** Three 0.186 builds one object's program, then awaits that object's GPU
   * pipeline before building the next program: CPU program building and GPU
   * compilation never overlap. Same traversal, order, programs and pipelines;
   * the pipeline promises are only gathered and awaited once, at the end. */
  override async compileAsync(scene: Object3D, camera: Camera, targetScene: Object3D | null = null, onProgress: ((event: ProgressEvent) => void) | null = null): Promise<void> {
    const context = this as unknown as CompileContext;
    if (!context._initialized) await this.init();
    this.installPipelineGathering(context._pipelines);
    try {
      await (super.compileAsync as (scene: Object3D, camera: Camera, targetScene: Object3D | null, onProgress: ((event: ProgressEvent) => void) | null) => Promise<void>)(scene, camera, targetScene, onProgress);
    } finally {
      // Every gathered creation resolves, even on failure (Three's own guarantee).
      await Promise.all([...this.pendingPipelines]);
    }
  }

  /** Hidden warm-up render whose new pipelines are created asynchronously,
   * in parallel: objects whose pipeline is not ready yet are simply not drawn
   * (Three's own readiness check). Never for a visible frame, and the caller
   * must re-record retained bundles afterwards with an ordinary render. */
  async renderWarmingPipelines(scene: Object3D, camera: Camera): Promise<void> {
    const context = this as unknown as CompileContext;
    if (!context._initialized) await this.init();
    this.installPipelineGathering(context._pipelines);
    this.warmingRender = true;
    try { this.render(scene, camera); }
    finally { this.warmingRender = false; }
    await Promise.all([...this.pendingPipelines]);
  }

  /** Only compileAsync passes a promise list; ordinary renders pass null and
   * keep their synchronous creation unchanged. */
  private installPipelineGathering(pipelines: PipelineRouting | undefined): void {
    if (this.pipelineRoutingInstalled || !pipelines || typeof pipelines.getForRender !== 'function') return;
    this.pipelineRoutingInstalled = true;
    const original = pipelines.getForRender, pending = this.pendingPipelines, owner = this;
    const sink = { push(promise: Promise<void>) { pending.add(promise); void promise.finally(() => pending.delete(promise)); return pending.size; } };
    pipelines.getForRender = function (this: PipelineRouting, renderObject: unknown, promises: { push(promise: Promise<void>): unknown } | null = null) {
      return original.call(this, renderObject, promises === null && !owner.warmingRender ? null : sink);
    };
  }

  override render(scene: Object3D, camera: Camera): void {
    const context = this as this & BundleContext;
    const outerBundle = context._currentRenderBundle;
    context._currentRenderBundle = null;
    try {
      super.render(scene, camera);
    } finally {
      context._currentRenderBundle = outerBundle;
    }
  }
}
