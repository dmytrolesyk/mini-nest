import 'reflect-metadata';
import { createDispatch } from './dispatcher.ts';
import { Container } from './ioc/container.ts';
import { RouteExplorer, Router } from './router.ts';
import { HttpServer } from './server.ts';
import type { Middleware, MiniNestModule, OptionalCallback } from './types.ts';
import type { Newable } from './ioc/decorators/types.ts';

type App = {
  listen: (port: number, callback: OptionalCallback) => void;
  close: (callback?: () => void) => void;
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
      close: (callback: OptionalCallback) => server.close(callback),
    };
  }
}
