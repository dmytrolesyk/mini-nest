import { injectable } from '../ioc/decorators/injectable.ts';
import type { Interceptor, HttpExecutionContext, CallHandler } from '../types.ts';

@injectable()
export class LoggingInterceptor implements Interceptor {
  async intercept(context: HttpExecutionContext, next: CallHandler) {
    const { method, url } = context;
    const start = performance.now();
    console.log(`${method} ${url.pathname} - start measuring`);
    try {
      return await next.handle();
    } finally {
      // `finally` so a handler that throws is still timed — that is the request
      // you most want a duration for.
      const duration = (performance.now() - start).toFixed(1);
      console.log(`${method} ${url.pathname} — ${duration} ms`);
    }
  }
}
