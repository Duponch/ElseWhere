/** Worker phase snapshots may arrive at every tick. Refresh the management UI
 * at most five times per second (or the owner's slower interval, e.g. while a
 * large page is open), while controls/replacements remain immediate.
 * The callback reads the latest world; no simulation message is dropped.
 *
 * An ordinary (non-immediate) refresh never runs inside the call that
 * requested it: it waits at least `settleMs`. A snapshot is delivered inside
 * the frame that adopts it, and on a large colony that frame and the next one
 * already carry the adoption and the world application; the HUD readers and
 * the repaint of the cards they change then land in a later, ordinary frame. */
export class SnapshotHud {
  private next = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private readonly refresh: () => void, private readonly interval: () => number = () => 200, private readonly settleMs = 0) {}

  request(immediate = false): void {
    const now = performance.now();
    if (immediate || this.settleMs <= 0 && now >= this.next) {
      clearTimeout(this.timer); this.timer = undefined;
      this.next = now + this.interval();
      this.refresh();
    } else if (this.timer === undefined) {
      this.timer = setTimeout(() => this.request(true), Math.max(this.settleMs, this.next - now));
    }
  }
}
