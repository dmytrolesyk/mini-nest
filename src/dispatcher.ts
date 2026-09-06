import { NotFoundError } from './filters/exception-filter.ts';
import { Router } from './router.ts';
import type { HandlerResponse } from './server.ts';
import type { HttpExecutionContext, Middleware } from './types.ts';

async function runMiddleware(context: HttpExecutionContext, middleware: Middleware[]) {
  let i = -1;
  const next = async () => {
    i += 1;
    if (i >= middleware.length) return;
    const fn = middleware[i];
    await fn(context, next);
  };
  await next();
}

export const createDispatch = (router: Router, middleware: Middleware[]) => {
  return async (context: HttpExecutionContext): Promise<HandlerResponse> => {
    const { method, url } = context;
    const matchedRoute = router.match(method, url.pathname);
    if (!matchedRoute) {
      throw new NotFoundError('Route does not exist');
    }
    await runMiddleware(context, middleware);
    context.pathParams = matchedRoute.pathParams;
    const result = await matchedRoute.route.handler(context);
    return { status: context.method === 'POST' ? 201 : 200, payload: result };
  };
};
