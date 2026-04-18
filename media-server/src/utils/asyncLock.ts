type Task<T> = () => Promise<T>;

export class AsyncLock {
  private readonly tails = new Map<string, Promise<void>>();

  public async withLock<T>(key: string, task: Task<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();

    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.tails.set(key, previous.then(() => current));

    await previous;

    try {
      return await task();
    } finally {
      release();

      const tail = this.tails.get(key);
      if (tail === current) {
        this.tails.delete(key);
      }
    }
  }
}
