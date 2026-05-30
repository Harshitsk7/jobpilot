type Task<T> = () => Promise<T>;

interface QueueItem<T> {
  task: Task<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

class BackgroundQueue {
  private queue: QueueItem<unknown>[] = [];
  private running = false;
  private concurrency: number;

  constructor(concurrency = 2) {
    this.concurrency = concurrency;
  }

  enqueue<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve: resolve as (v: unknown) => void, reject });
      void this.process();
    });
  }

  get pending(): number {
    return this.queue.length;
  }

  private async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.concurrency);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const result = await item.task();
            item.resolve(result);
          } catch (err) {
            item.reject(err);
          }
        })
      );
    }
    this.running = false;
    if (this.queue.length > 0) {
      void this.process();
    }
  }
}

export const aiQueue = new BackgroundQueue(2);
export const applyQueue = new BackgroundQueue(1);

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((r) => setTimeout(r, ms));
}
