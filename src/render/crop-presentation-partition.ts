import { readSnapshotChanges } from '../bridge/snapshot-changes';
import { readResidentResourceBaseChanges, type ResidentResourceBaseChanges } from '../bridge/resident-resource-base-changes';
import { isResidentCrop, type ResidentCropKind } from './flora-presentation';
import type { Resource, World } from '../sim/types';

type Partition = Record<ResidentCropKind, Resource[]>;
type ReadonlyPartition = Readonly<Record<ResidentCropKind, readonly Resource[]>>;
const emptyPartition = (): Partition => ({ rice: [], potato: [], corn: [], cotton: [], haygrass: [], hops: [], devilstrand: [] });

/** Only membership is retained. Continuous growth, leaf loss, transforms and
 * upload ranges are still evaluated at every ordinary crop presentation. */
export class CropPresentationPartition {
  private world: World | undefined;
  private partition = emptyPartition();
  private sourceSlots: Array<readonly [ResidentCropKind, number, number] | undefined> = [];
  private cropSources: number[] = [];

  private retainsMembership(world: World, proof: ResidentResourceBaseChanges): boolean {
    const count = this.sourceSlots.length;
    if (count !== world.resources.length) return false;
    for (const edge of proof.edges) {
      // Changing membership/order takes the existing complete reconstruction.
      // Stable ordinals let the ordinary path touch crops and actual upserts.
      if (edge.beforeCount !== count || edge.afterCount !== count || edge.removed.length || edge.added.length) return false;
      for (const { id, afterOrdinal } of edge.updated) {
        const old = this.sourceSlots[afterOrdinal], resource = world.resources[afterOrdinal];
        if (!resource || resource.id !== id || (old ? old[0] !== resource.kind || old[2] !== id : isResidentCrop(resource))) return false;
      }
    }
    for (const source of this.cropSources) {
      const slot = this.sourceSlots[source]!, resource = world.resources[source];
      if (!resource || resource.id !== slot[2] || resource.kind !== slot[0]) return false;
    }
    return true;
  }

  // Borrowed for one synchronous batch update; never an exposed historical view.
  read(world: World, reset = false, immutableSnapshot = false): ReadonlyPartition {
    const prior = immutableSnapshot && !reset ? this.world : undefined;
    this.world = immutableSnapshot ? world : undefined;
    const base = prior && prior !== world ? readResidentResourceBaseChanges(prior, world) : undefined;
    if (base && this.retainsMembership(world, base)) {
      // Every crop borrows the exact target reference, including growth-only,
      // blight and leaf-loss updates. Never present an older World's crop.
      for (const source of this.cropSources) {
        const slot = this.sourceSlots[source]!;
        this.partition[slot[0]][slot[1]] = world.resources[source]!;
      }
      return this.partition;
    }
    const journal = prior ? readSnapshotChanges(prior, world) : undefined;
    const sameResources = prior?.resources === world.resources;
    if (journal && sameResources) return this.partition;
    if (journal && this.sourceSlots.length === world.resources.length &&
      journal.resourceIndices.every(index => {
        const old = this.sourceSlots[index], resource = world.resources[index]!;
        return old ? old[0] === resource.kind : !isResidentCrop(resource);
      })) {
      for (const index of journal.resourceIndices) {
        const slot = this.sourceSlots[index];
        if (slot) {
          const resource = world.resources[index]!;
          this.partition[slot[0]][slot[1]] = resource;
          this.sourceSlots[index] = [slot[0], slot[1], resource.id];
        }
      }
      return this.partition;
    }
    this.partition = emptyPartition();
    this.sourceSlots = new Array(world.resources.length);
    this.cropSources = [];
    for (let index = 0; index < world.resources.length; index++) {
      const resource = world.resources[index]!;
      if (!isResidentCrop(resource)) continue;
      const kind = resource.kind as ResidentCropKind;
      this.sourceSlots[index] = [kind, this.partition[kind].length, resource.id];
      this.cropSources.push(index);
      this.partition[kind].push(resource);
    }
    return this.partition;
  }
}
