import type { WallboxAdapter } from "./types.js";

export class InMemoryWallboxAdapter implements WallboxAdapter {
  private lastKw: number | null = null;

  async setChargeKw(kw: number): Promise<void> {
    this.lastKw = Math.max(0, kw);
  }

  getLastSetKw(): number | null {
    return this.lastKw;
  }
}
