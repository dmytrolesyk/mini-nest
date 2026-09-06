import { NotFoundError } from './filters/exception-filter.ts';
import { Router } from './router.ts';
import type { HandlerResponse } from './server.ts';
import type { HttpExecutionContext, Middleware } from './types.ts';

const SHORT_CIRCUITED: HandlerResponse = { status: 200, payload: undefined };

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
    let response: HandlerResponse | undefined;
    const handleRoute: Middleware = async context => {
      const matchedRoute = router.match(context.method, context.url.pathname);
      if (!matchedRoute) {
        throw new NotFoundError('Route does not exist');
      }
      context.pathParams = matchedRoute.pathParams;
      const payload = await matchedRoute.route.handler(context);
      response = { status: context.method === 'POST' ? 201 : 200, payload };
    };

    await runMiddleware(context, [...middleware, handleRoute]);
    return response ?? SHORT_CIRCUITED;
  };
};
