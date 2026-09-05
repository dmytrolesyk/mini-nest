import { AsyncLocalStorage } from 'node:async_hooks';
import { v7 as uuidv7 } from 'uuid';

const als = new AsyncLocalStorage<string>();

export class RequestContext {
  private readonly storage: AsyncLocalStorage<string>;
  constructor() {
    this.storage = als;
  }
  get requestId() {
    return this.storage.getStore();
  }
  run(callback: () => Promise<void>) {
    als.run(uuidv7(), async () => {
      await callback();
    });
  }
}
