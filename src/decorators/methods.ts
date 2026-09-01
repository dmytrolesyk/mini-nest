import type { HttpMethod, Path } from '../types.ts';

const CONTROLLER_ROUTES = Symbol.for('controller:routes');

export const getRoutesMetadata = (target: Object): Route[] => {
  return Reflect.getMetadata(CONTROLLER_ROUTES, target) ?? [];
};

const setRoutesMetadata = (target: Object, routes: Route[]) => {
  Reflect.defineMetadata(CONTROLLER_ROUTES, routes, target);
};

export type Route = {
  handler: string | symbol;
  path: Path;
  method: HttpMethod;
};

function Route(method: HttpMethod, path: Path = ''): MethodDecorator {
  return function (target, handler) {
    const routes = getRoutesMetadata(target);
    routes.push({ handler, method, path });
    setRoutesMetadata(target, routes);
  };
}

type HandlerDecorator = (path?: Path) => MethodDecorator;

export const Get: HandlerDecorator = path => Route('GET', path);
export const Post: HandlerDecorator = path => Route('POST', path);
export const Put: HandlerDecorator = path => Route('PUT', path);
export const Patch: HandlerDecorator = path => Route('PATCH', path);
export const Delete: HandlerDecorator = path => Route('DELETE', path);
export const Head: HandlerDecorator = path => Route('HEAD', path);
export const Options: HandlerDecorator = path => Route('OPTIONS', path);
