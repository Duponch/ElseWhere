import { AlwaysDepth, Color, DepthTexture, HalfFloatType, LinearFilter, Matrix4, MeshBasicNodeMaterial,
  QuadMesh, RenderTarget, Vector2, Vector4, type Camera, type PerspectiveCamera, type Scene,
  type WebGPURenderer } from 'three/webgpu';
import { texture, uniform, uv, vec2, vec3 } from 'three/tsl';

/** Room-only depth of field. The colony never enters this reduced-resolution
 * target: its normal full-resolution draw follows the background composite.
 * Copying the original depth keeps the suspended installation spatially real. */
export class RoomBackdrop {
  readonly target = new RenderTarget(1, 1, { type: HalfFloatType, depthBuffer: true, samples: 0,
    minFilter: LinearFilter, magFilter: LinearFilter });
  private readonly blurred = new RenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false, samples: 0,
    minFilter: LinearFilter, magFilter: LinearFilter });
  private readonly quad: QuadMesh;
  private readonly blurQuad: QuadMesh;
  private readonly optics = uniform(new Vector4()); // near, far, perspective, focus
  private readonly blur = uniform(new Vector4()); // inverse width/height, focus band, range
  private readonly size = new Vector2();
  private readonly lastView = new Matrix4();
  private readonly lastProjection = new Matrix4();
  private version = -1;
  private ready = false;
  private readonly clear = new Color();
  private readonly material = new MeshBasicNodeMaterial({ depthWrite: true, depthTest: true, depthFunc: AlwaysDepth });
  private readonly blurMaterial = new MeshBasicNodeMaterial({ depthWrite: false, depthTest: false });
  readonly stats = { roomRenders: 0, composites: 0 };

  constructor() {
    this.target.texture.name = 'room-color';
    this.target.depthTexture = new DepthTexture(1, 1);
    this.target.depthTexture.name = 'room-depth';
    const coords = uv(), depth = texture(this.target.depthTexture, coords).r;
    const perspectiveZ = this.optics.x.mul(this.optics.y)
      .div(this.optics.y.sub(this.optics.x).mul(depth).sub(this.optics.y));
    const orthographicZ = depth.mul(this.optics.x.sub(this.optics.y)).sub(this.optics.x);
    const viewZ = this.optics.z.greaterThan(.5).select(perspectiveZ, orthographicZ);
    const radius = viewZ.negate().sub(this.optics.w).abs().sub(this.blur.z).max(0)
      .div(this.blur.w).clamp(0, 1).mul(7);
    const step = vec2(this.blur.x, this.blur.y).mul(radius);
    const source = texture(this.target.texture, coords);
    let result = source.rgb.mul(.2);
    // A fixed disk kernel, bilinear reads, no CoC texture, no full-game postpass.
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1], [.707, .707], [-.707, .707], [.707, -.707], [-.707, -.707]]) {
      result = result.add(source.sample(coords.add(step.mul(vec2(x!, y!))).clamp(vec2(0), vec2(1))).rgb.mul(.1));
    }
    this.blurMaterial.colorNode = vec3(result);
    this.blurQuad = new QuadMesh(this.blurMaterial);
    this.blurred.texture.name = 'room-blurred-color';
    this.material.colorNode = texture(this.blurred.texture, coords).rgb;
    this.material.depthNode = depth;
    this.quad = new QuadMesh(this.material);
  }

  invalidate(): void { this.ready = false; }

  /** Renderer state is restored even if a backend throws while creating a pass. */
  render(renderer: WebGPURenderer, scene: Scene, camera: Camera, version: number,
    focusDistance: number, span: number, compose = true): void {
    camera.updateMatrixWorld();
    renderer.getDrawingBufferSize(this.size);
    const width = Math.max(1, Math.ceil(this.size.x * .5)), height = Math.max(1, Math.ceil(this.size.y * .5));
    if (this.target.width !== width || this.target.height !== height) {
      this.target.setSize(width, height); this.blurred.setSize(width, height); this.ready = false;
    }
    const view = camera as PerspectiveCamera;
    this.optics.value.set(view.near, view.far, view.isPerspectiveCamera ? 1 : 0, focusDistance);
    this.blur.value.set(1 / this.size.x, 1 / this.size.y, span * .07, span * .38);
    const refresh = !this.ready || this.version !== version || !this.lastView.equals(camera.matrixWorld)
      || !this.lastProjection.equals(camera.projectionMatrix);
    // A cached prepare-only call changes no renderer state. Keep optics/size
    // updates above, then leave the foreground's active target untouched.
    if (!refresh && !compose) return;
    const previousTarget = renderer.getRenderTarget(), previousAutoClear = renderer.autoClear;
    renderer.getClearColor(this.clear); const previousAlpha = renderer.getClearAlpha();
    try {
      if (refresh) {
        renderer.autoClear = true;
        renderer.setRenderTarget(this.target);
        renderer.render(scene, camera);
        // Blur only the quarter-pixel backdrop, and reuse it while paused. The
        // full-resolution composite needs just one colour and one depth read.
        renderer.setRenderTarget(this.blurred);
        this.blurQuad.render(renderer);
        this.lastView.copy(camera.matrixWorld); this.lastProjection.copy(camera.projectionMatrix);
        this.version = version; this.ready = true; this.stats.roomRenders++;
      }
      if (compose) {
        renderer.setRenderTarget(previousTarget);
        this.compose(renderer);
      }
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.autoClear = previousAutoClear;
      renderer.setClearColor(this.clear, previousAlpha);
    }
  }

  /** Draw into the caller's current HDR/MSAA target. During an ordinary frame
   * the main scene has already selected this target but has not begun its pass.
   * Its final output transform therefore serves both the room and the colony. */
  compose(renderer: WebGPURenderer): void {
    const previousTarget = renderer.getRenderTarget(), previousAutoClear = renderer.autoClear;
    try {
      renderer.autoClear = true;
      this.quad.render(renderer); this.stats.composites++;
    } finally {
      renderer.setRenderTarget(previousTarget);
      renderer.autoClear = previousAutoClear;
    }
  }

  dispose(): void { this.target.dispose(); this.blurred.dispose(); this.material.dispose(); this.blurMaterial.dispose(); }
}
