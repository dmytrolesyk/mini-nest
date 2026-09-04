import { getControllerPrefix } from './decorators/controller.ts';
import { getRoutesMetadata } from './decorators/methods.ts';
import { getModuleMetadata } from './decorators/module.ts';
import { getParamsMetadata } from './decorators/params.ts';
import type { ParamMetadata } from './decorators/params.ts';
import { PARAM_TYPES_METADATA } from './ioc/decorators/tokens.ts';
import type { Container } from './ioc/container.ts';
import type { Newable } from './ioc/decorators/types.ts';
import type { HttpMethod, Path } from './types.ts';

type ControllerInstance = Record<string | symbol, (...args: unknown[]) => unknown>;

export type RouteEntry = {
  method: HttpMethod;
  pattern: URLPattern;
  instance: ControllerInstance;
  handler: string | symbol;
  params: Map<number, ParamMetadata>;
  paramTypes: Newable<object>[];
};

export type MatchedRoute = { route: RouteEntry; pathParams: Record<string, string | undefined> };

const toPathname = (...paths: Path[]): string => {
  const segments = paths
    .flatMap(path => (Array.isArray(path) ? path : [path]))
    .flatMap(path => path.split('/'))
    .filter(Boolean);
  return `/${segments.join('/')}`;
};

export class Router {
  private readonly routes: RouteEntry[] = [];

  constructor(modules: Newable[], container: Container) {
    const controllers = modules.flatMap(module => getModuleMetadata(module).controllers);
    for (const controller of controllers) {
      const prefix = getControllerPrefix(controller) ?? '';
      const instance = container.get(controller) as ControllerInstance;
      const params = getParamsMetadata(controller.prototype);
      for (const route of getRoutesMetadata(controller.prototype)) {
        this.routes.push({
          method: route.method,
          pattern: new URLPattern({ pathname: toPathname(prefix, route.path) }),
          instance,
          handler: route.handler,
          params: params.get(route.handler) ?? new Map(),
          paramTypes:
            Reflect.getMetadata(PARAM_TYPES_METADATA, controller.prototype, route.handler) ?? [],
        });
      }
    }
  }

  match(method: string, pathname: string): MatchedRoute | undefined {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const matched = route.pattern.exec({ pathname });
      if (matched) return { route, pathParams: matched.pathname.groups };
    }
  }
}
