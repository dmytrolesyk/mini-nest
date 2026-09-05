import { Router } from './router.ts';
import type { HandlerResponse } from './server.ts';
import type { HttpExecutionContext } from './types.ts';

export const createDispatch =
  (router: Router) =>
  async (context: HttpExecutionContext): Promise<HandlerResponse> => {
    const { method, url } = context;
    try {
      const matchedRoute = router.match(method, url.pathname);
      if (matchedRoute) {
        context.pathParams = matchedRoute.pathParams;
      }
      if (!matchedRoute) {
        throw new Error('404'); // will be refactored
      }
      const result = await matchedRoute.route.handler(context);
      return { status: context.method === 'GET' ? 200 : 201, payload: result };
    } catch (e) {
      return { status: 500, payload: { message: 'Something went wrong' } };
    }
  };
