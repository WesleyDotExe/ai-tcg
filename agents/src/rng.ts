/** Small deterministic PRNG (mulberry32), duplicated from the engine's own
 * rather than imported — a real external agent would bring its own RNG, not
 * import ours, and this package deliberately has no runtime dependency on
 * @ai-tcg/engine at all (see package.json description). */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  pick<T>(items: T[]): T {
    const item = items[this.int(items.length)];
    if (item === undefined) throw new Error("Rng.pick: empty array");
    return item;
  }
}
