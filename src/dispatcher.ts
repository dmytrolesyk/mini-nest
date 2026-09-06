import { getModuleMetadata } from './decorators/module.ts';
import { NotFoundError } from './filters/exception-filter.ts';
import { Router } from './router.ts';
import type { HandlerResponse } from './server.ts';
import type { HttpExecutionContext, Middleware } from './types.ts';

export const createDispatch = (router: Router, middleware: Middleware[]) => {
  return async (context: HttpExecutionContext): Promise<HandlerResponse> => {
    const { method, url } = context;
    const matchedRoute = router.match(method, url.pathname);
    if (!matchedRoute) {
      throw new NotFoundError('Route does not exist');
    }
    context.pathParams = matchedRoute.pathParams;
    const handler = matchedRoute.route.handler;
    const stack = [...middleware, handler];
    const run = async (context: HttpExecutionContext) => {
      let i = -1;
      const next = async () => {
        i += 1;
        const fn = stack[i];
        return await fn(context, next);
      };
      return next();
    };
    const result = await run(context);
    return { status: context.method === 'POST' ? 201 : 200, payload: result };
  };
};
