import 'reflect-metadata';
import { createDispatch } from './dispatcher.ts';
import { Container } from './ioc/container.ts';
import { Router } from './router.ts';
import { HttpServer } from './server.ts';
import type { Middleware, MiniNestModule, OptionalCallback } from './types.ts';
import type { Newable } from './ioc/decorators/types.ts';
import { RouteExplorer } from './route-explorer.ts';

type App = {
  listen: (port: number, callback: OptionalCallback) => void;
  close: (gracePeriodMs?: number) => Promise<void>;
  enableShutdownHooks: () => void;
};

function collectMiddleware(module: Partial<MiniNestModule>) {
  const middlewareCollection: Middleware[] = [];
  if (typeof module.configure === 'function') {
    module.configure({
      apply: middleware => {
        middlewareCollection.push(...middleware);
      },
    });
  }
  return middlewareCollection;
}
export class AppFactory {
  static create(AppModule: Newable<Partial<MiniNestModule>>): App {
    const container = new Container();
    const routeExplorer = new RouteExplorer(container);
    const module = container.get(AppModule);
    const middleware = collectMiddleware(module);
    const routes = routeExplorer.initRoutes(AppModule);
    const router = new Router(routes);
    const dispatch = createDispatch(router, middleware);
    const server = new HttpServer(dispatch);
    return {
      listen: (port: number, callback: OptionalCallback) => server.listen(port, callback),
      close: (gracePeriodMs?: number) => server.close(gracePeriodMs),
      enableShutdownHooks: () => {
        const APP_SHUTDOWN_GRACE_PERIOD = 7500;
        let shuttingDown = false;

        for (const sig of ['SIGTERM', 'SIGINT']) {
          process.on(sig, async () => {
            if (shuttingDown) return;
            shuttingDown = true;
            const forceExit = setTimeout(() => {
              console.error('graceful shutdown timed out, forcing exit');
              process.exit(1);
            }, APP_SHUTDOWN_GRACE_PERIOD);
            forceExit.unref();
            console.log(`\n[${sig}] shutting down...`);
            await server.close();
            process.exit(0);
          });
        }
      },
    };
  }
}
