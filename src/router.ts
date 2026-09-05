import { getControllerPrefix } from './decorators/controller.ts';
import { getRoutesMetadata } from './decorators/methods.ts';
import { getModuleMetadata } from './decorators/module.ts';
import { getParamsMetadata } from './decorators/params.ts';
import type { ParameterIndex, ParamMetadata } from './decorators/params.ts';
import { PARAM_TYPES_METADATA } from './ioc/decorators/tokens.ts';
import type { Container } from './ioc/container.ts';
import type { Newable } from './ioc/decorators/types.ts';
import type { HttpMethod, Path, CanActivate, HttpExecutionContext, PathParams } from './types.ts';
import { getGuardsMetadata } from './decorators/use-guards.ts';
import { needsValidation, ValidationPipe } from './pipes/validation.pipe.ts';

type ControllerInstance = Record<string | symbol, (...args: unknown[]) => unknown>;

type RouteEntry = {
  controllerClass: Newable;
  method: HttpMethod;
  pattern: URLPattern;
  instance: ControllerInstance;
  handler: string | symbol;
  params: Map<ParameterIndex, ParamMetadata>;
  paramTypes: Newable<object>[];
};

export type Route = {
  handler: (ctx: HttpExecutionContext) => unknown;
  pattern: URLPattern;
  method: HttpMethod;
};

export type MatchedRoute = { route: Route; pathParams: PathParams };

type ArgExtractor = (context: HttpExecutionContext) => unknown;

const createExtractor = (
  { type, key }: ParamMetadata,
  paramType: Newable<object>,
): ArgExtractor => {
  if (type === 'body') {
    if (!needsValidation(paramType)) return context => context.body;
    return async context => {
      const { instance, errors } = await ValidationPipe.transform(paramType, context.body);
      if (errors.length > 0) {
        // will be refactored to proper error class
        throw new Error(
          errors.map(({ field, constraints }) => `${field}: ${constraints.join(', ')}`).join('\n'),
        );
      }
      return instance;
    };
  }
  const paramKey = key ?? '';
  if (type === 'param') return context => context.pathParams[paramKey];
  return context => context.url.searchParams.get(paramKey);
};

const toPathname = (...paths: Path[]): string => {
  const segments = paths
    .flatMap(path => (Array.isArray(path) ? path : [path]))
    .flatMap(path => path.split('/'))
    .filter(Boolean);
  return `/${segments.join('/')}`;
};

export class Router {
  private readonly routes: Route[] = [];

  constructor(routes: Route[]) {
    this.routes = routes;
  }

  match(method: string, pathname: string): MatchedRoute | undefined {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const matched = route.pattern.exec({ pathname });
      if (matched) return { route, pathParams: matched.pathname.groups };
    }
  }
}

export class RouteExplorer {
  private readonly container: Container;
  constructor(container: Container) {
    this.container = container;
  }
  private computeRouteHandler(routeEntry: RouteEntry) {
    const guards = getGuardsMetadata(routeEntry.controllerClass).map(
      guard => this.container.get(guard) as CanActivate,
    );
    const runGuards = async (context: HttpExecutionContext) => {
      for (const guard of guards) {
        const canActivate = await guard.canActivate(context);
        if (!canActivate) {
          throw new Error('401'); // will be refactored to proper error class
        }
      }
    };
    const extractors: ArgExtractor[] = [];
    for (const [index, paramMetadata] of routeEntry.params) {
      extractors[index] = createExtractor(paramMetadata, routeEntry.paramTypes[index]);
    }
    const buildArgs = (context: HttpExecutionContext) =>
      Promise.all(extractors.map(extract => extract(context)));
    const controllerHandler = routeEntry.instance[routeEntry.handler].bind(routeEntry.instance);
    return async (context: HttpExecutionContext) => {
      await runGuards(context);
      const args = await buildArgs(context);
      return await controllerHandler(...args);
    };
  }
  initRoutes(modules: Newable[]) {
    const controllers = modules.flatMap(module => getModuleMetadata(module).controllers);
    return controllers.flatMap(controller => {
      const prefix = getControllerPrefix(controller) ?? '';
      const instance = this.container.get(controller) as ControllerInstance;
      const params = getParamsMetadata(controller.prototype);
      return getRoutesMetadata(controller.prototype).map(route => {
        const pattern = new URLPattern({ pathname: toPathname(prefix, route.path) });
        const { handler, method } = route;
        const routeEntry = {
          controllerClass: controller,
          method,
          pattern,
          instance,
          handler,
          params: (params.get(route.handler) ?? new Map()) as Map<ParameterIndex, ParamMetadata>,
          paramTypes:
            Reflect.getMetadata(PARAM_TYPES_METADATA, controller.prototype, route.handler) ?? [],
        };
        return {
          pattern,
          method,
          handler: this.computeRouteHandler(routeEntry),
        };
      });
    });
  }
}
