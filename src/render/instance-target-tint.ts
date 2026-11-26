import type * as THREE from 'three/webgpu';
import { ResourceTargetTint } from './resource-target-tint';

/** Authored IDs identify exact instance slots. Build their lookup only while a
 * preview is active; normal rendering performs no selection scan per frame. */
export class InstanceTargetTint {
  constructor(private readonly changed435?:()=>void,private readonly residentRanges=false){}
  private readonly tint = new ResourceTargetTint();
  private attribute: THREE.BufferAttribute | undefined;
  private targets: readonly (number | undefined)[] = [];
  private index: Map<number, number[]> | undefined;
  private selected = new Set<number>();

  /** Restore before the producer overwrites or replaces its RGB buffer. */
  restore(): void {const attribute=this.attribute,version=attribute?.version;this.tint.restore();if(attribute&&attribute.version!==version)this.changed435?.();}

  /** Called after the producer wrote its current unselected colours. */
  setInstances(attribute: THREE.BufferAttribute, targets: readonly (number | undefined)[]): void {
    this.attribute = attribute; this.targets = targets; this.index = undefined;
    // These producers historically publish the whole RGB buffer. A pending
    // restore or a new sparse tint must not turn that full upload into K-only.
    if (!this.residentRanges&&(attribute.updateRanges.length || this.selected.size)) {
      attribute.clearUpdateRanges(); attribute.addUpdateRange(0, attribute.array.length);
    }
    this.apply();
  }

  setTargets(ids: ReadonlySet<number>): void {
    if (ids.size === this.selected.size && [...ids].every(id => this.selected.has(id))) return;
    this.restore(); this.selected = new Set(ids); this.apply();
  }

  private apply(): void {
    if (!this.attribute || this.selected.size === 0) return;
    if (!this.index) {
      this.index = new Map();
      for (let i = 0; i < this.targets.length; i++) {
        const id = this.targets[i]; if (id === undefined) continue;
        const slots = this.index.get(id);
        if (slots) slots.push(i); else this.index.set(id, [i]);
      }
    }
    const slots: number[] = [];
    for (const id of this.selected) slots.push(...(this.index.get(id) ?? []));
    const version=this.attribute.version;this.tint.applySlots(this.attribute, slots);if(this.attribute.version!==version)this.changed435?.();
  }

  clear(): void { this.restore(); this.selected.clear(); }
  dispose(): void { this.clear(); this.attribute = undefined; this.targets = []; this.index = undefined; }
}
