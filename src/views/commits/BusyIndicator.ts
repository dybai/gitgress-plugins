export type BusyRelease = () => void;

export type BusyListener = (active: boolean) => void;

/**
 * Reference-counted aggregator for the shared busy indicator.
 *
 * Producers call {@link acquire} when their work starts and invoke the
 * returned handle exactly when it ends (the handle is idempotent, so a
 * double release is harmless). The indicator is active while any handle is
 * outstanding, and listeners are notified only when the active boolean
 * flips — never on intermediate count changes — so a fast producer ending
 * cannot hide a slow producer that is still running.
 */
export class BusyIndicator {
  private readonly holders = new Set<BusyRelease>();
  private readonly listeners = new Set<BusyListener>();

  getActive(): boolean {
    return this.holders.size > 0;
  }

  acquire(): BusyRelease {
    const release: BusyRelease = () => {
      if (!this.holders.delete(release)) {
        return;
      }
      if (this.holders.size === 0) {
        this.notify(false);
      }
    };
    this.holders.add(release);
    if (this.holders.size === 1) {
      this.notify(true);
    }
    return release;
  }

  subscribe(listener: BusyListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(active: boolean): void {
    for (const listener of this.listeners) {
      listener(active);
    }
  }
}
