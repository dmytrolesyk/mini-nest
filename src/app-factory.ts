import 'reflect-metadata';
import { createDispatch } from './dispatcher.ts';
import { Container } from './ioc/container.ts';
import type { Newable } from './ioc/decorators/types.ts';
import { RouteExplorer, Router } from './router.ts';
import { HttpServer } from './server.ts';
import type { OptionalCallback } from './types.ts';

type App = {
  listen: (port: number, callback: OptionalCallback) => void;
  close: (callback?: () => void) => void;
};

export class AppFactory {
  static create(modules: Newable[]): App {
    const container = new Container();
    const routeExplorer = new RouteExplorer(container);
    const routes = routeExplorer.initRoutes(modules);
    const router = new Router(routes);
    const dispatch = createDispatch(router);
    const server = new HttpServer(async context => {
      const { status, payload } = await dispatch(context);
      context.response.statusCode = status;
      if (payload === undefined || payload === null) {
        context.response.end();
      } else {
        context.response.setHeader('Content-Type', 'application/json');
        context.response.end(JSON.stringify(payload));
      }
    });
    return {
      listen: (port: number, callback: OptionalCallback) => server.listen(port, callback),
      close: (callback: OptionalCallback) => server.close(callback),
    };
  }
}
