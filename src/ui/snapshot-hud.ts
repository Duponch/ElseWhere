/** Worker phase snapshots may arrive at every tick. Refresh the management UI
 * at most five times per second (or the owner's slower interval, e.g. while a
 * large page is open), while controls/replacements remain immediate.
 * The callback reads the latest world; no simulation message is dropped. */
export class SnapshotHud {
  private next = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private readonly refresh: () => void, private readonly interval: () => number = () => 200) {}

  request(immediate = false): void {
    const now = performance.now();
    if (immediate || now >= this.next) {
      clearTimeout(this.timer); this.timer = undefined;
      this.next = now + this.interval();
      this.refresh();
    } else if (this.timer === undefined) {
      this.timer = setTimeout(() => this.request(true), this.next - now);
    }
  }
}
