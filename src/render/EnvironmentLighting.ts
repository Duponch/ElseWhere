import {ExplorationMask256} from './ExplorationMask256';
import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType, Vector2, Vector4, type NodeMaterial, type Node } from 'three/webgpu';
import { Fn, If, diffuseColor, float, mix, normalWorldGeometry, output, positionWorld, renderGroup, smoothstep, texture, uniform, vec2, vec3, vec4 } from 'three/tsl';
import type { World } from '../sim/types';
import { WORLD_SCALE } from '../world/scale';
import { EnvironmentLightField } from './EnvironmentLightField';

/** One shared spatial texture, no lights/shadows/draw calls per emitter.
 * Materials sample the final GPU pose, including animated pawns and cargo.
 * These artistic coefficients never feed back into simulation light levels. */
export class EnvironmentLighting {
  readonly exploration = new ExplorationMask256();
  readonly map = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1, RGBAFormat, UnsignedByteType);
  private readonly size = uniform(new Vector2(1, 1)).setGroup(renderGroup);
  private readonly bounds = uniform(new Vector4(1, 1, 0, 0)).setGroup(renderGroup);
  private readonly sample = texture(this.map);
  private readonly configured = new WeakSet<NodeMaterial>();
  private readonly shade = this.createShade(positionWorld, normalWorldGeometry);
  private readonly rockShade = this.createShade(positionWorld, normalWorldGeometry,true);
  private readonly groundShade = this.createShade(positionWorld,normalWorldGeometry,false,true);
  private createShade(position:Node,normal:Node,exteriorRock=false,ground=false):Node {return Fn(() => {
    const p = vec3(position as ReturnType<typeof vec3>).toVar(), n = vec3(normal as ReturnType<typeof vec3>).toVar(), result = output.toVar();
    // Most forest fragments have no local source/roof, or lie above its height.
    // Keep this a uniform-driven branch: no new material/pipeline on ignition.
    If(p.x.greaterThanEqual(this.bounds.x).and(p.z.greaterThanEqual(this.bounds.y))
      .and(p.x.lessThanEqual(this.bounds.z)).and(p.z.lessThanEqual(this.bounds.w))
      .and(p.y.lessThan(WORLD_SCALE.wallHeight + .02)).and(ground?this.exploration.knownGround:float(1).equal(1)), () => {
      const centre = p.xz.add(.5).floor().add(.5).div(this.size);
      const opaque = this.sample.sample(centre).level(float(0)).b;
      // Wall/door sides read the exposed adjacent cell, not the opaque centre.
      const q = p.xz.add(n.xz.mul(mix(.025, .55, opaque))).toVar();
      const cellUV = q.add(.5).floor().add(.5).div(this.size);
      const roof = this.sample.sample(cellUV).level(float(0)).g;
      const glow = this.sample.sample(q.add(.5).div(this.size)).level(float(0)).r;
      const within = q.x.greaterThanEqual(-.5).and(q.y.greaterThanEqual(-.5))
        .and(q.x.lessThan(this.size.x.sub(.5))).and(q.y.lessThan(this.size.y.sub(.5)));
      // Roof tops and canopies above house height retain the outdoor lighting.
      const below = float(1).sub(smoothstep(WORLD_SCALE.wallHeight - .1, WORLD_SCALE.wallHeight + .02, p.y)).mul(within.select(1, 0));
      // A solid massif is the exterior of its natural roof, even where its
      // authored facets dip below house height. Keep local lamps and ordinary
      // scene shadows, but never shade its surface as an interior below itself.
      const covered = exteriorRock?float(0):roof.mul(below), warm = glow.mul(below);
      const facets = n.y.abs().mul(.3).add(.7);
      const fill = vec3(.11, .13, .18).mul(covered).add(vec3(1.35, .76, .32).mul(warm)).mul(facets);
      result.assign(vec4(output.rgb.mul(mix(1, .12, covered)).add(diffuseColor.rgb.mul(fill)), output.a));
    });
    return result;
  })();}

  constructor(readonly field = new EnvironmentLightField()) {
    this.map.minFilter = this.map.magFilter = LinearFilter;
    this.map.generateMipmaps = false; this.map.needsUpdate = true;
  }
  readonly configure = (material: NodeMaterial): void => {
    this.exploration.configure(material);
    if (this.configured.has(material)) return;
    // Crease lines have an explicit ink/kraft pigment. Surface normals and
    // room-light fill belong to the faces, not this unlit line overlay.
    if(material.userData.origamiUnlitContour){this.configured.add(material);return;}
    if (material.outputNode) throw new Error('Environment lighting requires an unclaimed material output.');
    material.outputNode = material.userData.explorationOpaqueRock?this.rockShade:material.userData.explorationOpaqueGround?this.groundShade:this.shade; this.configured.add(material);
  };
  /** Decorative blades borrow the horizontal surface's local-light response.
   * Their authored root precedes sway; geometric blade faces must not attenuate
   * the lamp fill or shift the source/roof sample into a neighbouring cell. */
  readonly configureGrounded = (material:NodeMaterial,root:Node):void => {
    this.exploration.configure(material);
    if(this.configured.has(material))return;
    if(material.outputNode)throw new Error('Environment lighting requires an unclaimed material output.');
    const p=vec2(root as ReturnType<typeof vec2>);
    material.outputNode=this.createShade(vec3(p.x,.021,p.y),vec3(0,1,0));
    this.configured.add(material);
  };
  update(world: World): void {
    if (!this.field.update(world)) return;
    const { data, width, height } = this.field;
    // Texture identity and node graph stay stable across checkpoint dimensions.
    if (this.map.image.width !== width || this.map.image.height !== height) this.map.dispose();
    this.map.image = { data, width, height }; this.size.value.set(width, height);
    const b = this.field.bounds; this.bounds.value.set(b.minX, b.minZ, b.maxX, b.maxZ);
    this.map.needsUpdate = true;
  }
  dispose(): void { this.map.dispose();this.exploration.dispose(); }
}
