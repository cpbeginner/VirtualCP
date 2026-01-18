export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Throttler {
  private nextStartMs = 0;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly minIntervalMs: number) {}

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = async () => {
      const now = Date.now();
      const startAt = Math.max(now, this.nextStartMs);
      const waitMs = startAt - now;
      this.nextStartMs = startAt + this.minIntervalMs;
      if (waitMs > 0) await sleep(waitMs);
      return await fn();
    };

    const result = this.chain.then(run, run) as Promise<T>;
    this.chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

