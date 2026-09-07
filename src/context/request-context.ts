import { AsyncLocalStorage } from 'node:async_hooks';
import { v7 as uuidv7 } from 'uuid';

export type RequestStore = { requestId: string };

const als = new AsyncLocalStorage<RequestStore>();

export class RequestContext {
  static createStore(incomingRequestId?: string): RequestStore {
    return { requestId: incomingRequestId?.trim() || uuidv7() };
  }

  static run<T>(store: RequestStore, callback: () => Promise<T>): Promise<T> {
    return als.run(store, callback);
  }

  static get store(): RequestStore | undefined {
    return als.getStore();
  }

  static get requestId(): string | undefined {
    return als.getStore()?.requestId;
  }
}
