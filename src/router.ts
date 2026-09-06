import { getControllerPrefix } from './decorators/controller.ts';
import { getRoutesMetadata } from './decorators/methods.ts';
import { getModuleMetadata } from './decorators/module.ts';
import { getParamsMetadata } from './decorators/params.ts';
import type { ParameterIndex, ParamMetadata } from './decorators/params.ts';
import type { Container } from './ioc/container.ts';
import type { Newable } from './ioc/decorators/types.ts';
import type {
  HttpMethod,
  Path,
  CanActivate,
  HttpExecutionContext,
  PathParams,
  RequestBody,
  Interceptor,
  RouteHandler,
  MiniNestModule,
} from './types.ts';
import { getGuardsMetadata } from './decorators/use-guards.ts';
import { ForbiddenError } from './filters/exception-filter.ts';
import { getInterceptorsMetadata } from './decorators/use-interceptors.ts';
import { compose } from './helpers/compose.ts';

type ControllerInstance = Record<string | symbol, (...args: unknown[]) => unknown>;

type RouteEntry = {
  controllerClass: Newable;
  method: HttpMethod;
  pattern: URLPattern;
  instance: ControllerInstance;
  handler: string | symbol;
  params: Map<ParameterIndex, ParamMetadata>;
};

export type Route = {
  handler: (ctx: HttpExecutionContext) => unknown;
  pattern: URLPattern;
  method: HttpMethod;
};

export type MatchedRoute = { route: Route; pathParams: PathParams };

type ArgExtractor = (context: HttpExecutionContext) => unknown;

const readBodyKey = (body: RequestBody, key: string): unknown => {
  if (body instanceof URLSearchParams) return body.get(key);
  if (body !== null && typeof body === 'object') return (body as Record<string, unknown>)[key];
  return undefined;
};

/** Where the raw argument comes from, before any pipe touches it. */
const createReader = ({ type, key }: ParamMetadata): ArgExtractor => {
  switch (type) {
    case 'param':
      return context => context.pathParams[key ?? ''];
    case 'query':
      return context => context.url.searchParams.get(key ?? '');
    case 'body':
      // `@Body()` takes the whole body, `@Body('name')` plucks one key.
      return key ? context => readBodyKey(context.body, key) : context => context.body;
  }
};

const createExtractor = (paramMetadata: ParamMetadata): ArgExtractor => {
  const read = createReader(paramMetadata);
  const { pipe } = paramMetadata;
  return pipe ? context => pipe.transform(read(context)) : read;
};

const createBuildArgs = (routeEntry: RouteEntry) => {
  const extractors: ArgExtractor[] = [];
  for (const [index, paramMetadata] of routeEntry.params) {
    extractors[index] = createExtractor(paramMetadata);
  }
  const buildArgs = (context: HttpExecutionContext) =>
    Promise.all(extractors.map(extract => extract(context)));

  return buildArgs;
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

const runGuards = async (context: HttpExecutionContext, guards: CanActivate[]) => {
  for (const guard of guards) {
    const canActivate = await guard.canActivate(context);
    if (!canActivate) {
      throw new ForbiddenError('Cannot process this request');
    }
  }
};

type Wrapper = (handler: RouteHandler) => RouteHandler;

const toInterceptedWrapper = (interceptor: Interceptor): Wrapper => {
  return (handler: RouteHandler): RouteHandler => {
    return context => interceptor.intercept(context, { handle: () => handler(context) });
  };
};

const composeInterceptors = (interceptors: Interceptor[]) => {
  const interceptedWrappers = interceptors.map(toInterceptedWrapper);
  return compose(...interceptedWrappers);
};

export class RouteExplorer {
  private readonly container: Container;
  constructor(container: Container) {
    this.container = container;
  }
  private computeRouteHandler(routeEntry: RouteEntry) {
    const guards = getGuardsMetadata(routeEntry.controllerClass).map(guard =>
      this.container.get(guard),
    );
    const interceptors = getInterceptorsMetadata(routeEntry.controllerClass).map(interceptor =>
      this.container.get(interceptor),
    );
    const composedInterceptor = composeInterceptors(interceptors);
    const buildArgs = createBuildArgs(routeEntry);
    const controllerHandler: RouteHandler = async context => {
      const args = await buildArgs(context);
      return await routeEntry.instance[routeEntry.handler](...args);
    };
    const interceptedHandler = composedInterceptor(controllerHandler);
    const composedHandler: RouteHandler = async context => {
      await runGuards(context, guards);
      return await interceptedHandler(context);
    };
    return composedHandler;
  }
  initRoutes(module: Newable<Partial<MiniNestModule>>) {
    const controllers = getModuleMetadata(module).controllers;
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
