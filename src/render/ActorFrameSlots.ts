/** Slots are dense indices in one render group's adopted roster. */
export class ActorSlotMask {
  private words = new Uint32Array(0);

  reserve(count: number): void {
    const needed = Math.ceil(count / 32);
    if (needed <= this.words.length) return;
    const words = new Uint32Array(Math.max(needed, this.words.length * 2));
    words.set(this.words);
    this.words = words;
  }

  add(slot: number): void {
    const i = slot >>> 5;
    this.words[i] = this.words[i]! | (1 << (slot & 31));
  }

  delete(slot: number): void {
    const i = slot >>> 5;
    this.words[i] = this.words[i]! & ~(1 << (slot & 31));
  }

  word(index: number): number { return this.words[index]!; }
  clear(): void { this.words.fill(0); }
}

/** One synchronous frame borrows this snapshot. Endpoint writers may wake or
 * retire springs during iteration; those writes must only affect later frames.
 * Dense words enumerate the snapshot in the same ascending order as the GPU
 * slot layout, including when the roster crosses a 32-slot boundary. */
export class ActorFrameSlots {
  private endpoints = new Uint32Array(0);
  private visits = new Uint32Array(0);
  private count = 0;
  endpointCount = 0;

  capture(ready: ActorSlotMask, dependent: ActorSlotMask, count: number): void {
    const size = Math.ceil(count / 32);
    if (this.endpoints.length < size) {
      this.endpoints = new Uint32Array(size);
      this.visits = new Uint32Array(size);
    }
    this.count = count;
    this.endpointCount = 0;
    for (let i = 0; i < size; i++) {
      let bits = ready.word(i) | dependent.word(i);
      this.endpoints[i] = this.visits[i] = bits;
      while (bits) {
        bits &= bits - 1;
        this.endpointCount++;
      }
    }
  }

  private readonly include = (slot: number): void => {
    if (slot >= this.count) return;
    const i = slot >>> 5;
    this.visits[i] = this.visits[i]! | (1 << (slot & 31));
  };

  includeSprings(active: ReadonlySet<number>): void { active.forEach(this.include); }
  isEndpoint(slot: number): boolean { return !!(this.endpoints[slot >>> 5]! & (1 << (slot & 31))); }

  next(start: number): number {
    if (start >= this.count) return -1;
    let i = start >>> 5;
    let bits = this.visits[i]! & (-1 << (start & 31));
    while (!bits) {
      if (++i * 32 >= this.count) return -1;
      bits = this.visits[i]!;
    }
    return i * 32 + 31 - Math.clz32(bits & -bits);
  }
}
