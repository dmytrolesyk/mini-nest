import { AsyncLocalStorage } from 'node:async_hooks';
import { v7 as uuidv7 } from 'uuid';

export type RequestStore = { requestId: string };

// Module-level on purpose: one storage per process, shared by every request. The
// per-request value is the *store*, which `run` binds for the duration of a call
// and every async continuation spawned inside it.
const als = new AsyncLocalStorage<RequestStore>();

export class RequestContext {
  /** Reuses the id the client sent, or mints one when there is none. */
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
