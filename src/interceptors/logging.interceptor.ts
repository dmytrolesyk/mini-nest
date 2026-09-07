import { injectable } from '../ioc/decorators/injectable.ts';
import { LoggerService } from '../services/logger.service.ts';
import type { Interceptor, HttpExecutionContext, CallHandler } from '../types.ts';

@injectable()
export class LoggingInterceptor implements Interceptor {
  constructor(private readonly logger: LoggerService) {}

  async intercept(context: HttpExecutionContext, next: CallHandler) {
    const { method, url } = context;
    const start = performance.now();
    try {
      return await next.handle();
    } finally {
      // `finally` so a handler that throws is still timed — that is the request
      // you most want a duration for.
      const duration = (performance.now() - start).toFixed(1);
      this.logger.log(`${method} ${url.pathname} — ${duration} ms`);
    }
  }
}
