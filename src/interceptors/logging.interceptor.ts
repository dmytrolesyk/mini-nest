import { ForbiddenError } from '../filters/exception-filter.ts';
import { injectable } from '../ioc/decorators/injectable.ts';
import type { Interceptor, HttpExecutionContext, CallHandler } from '../types.ts';

@injectable()
export class LoggingInterceptor implements Interceptor {
  async intercept(context: HttpExecutionContext, next: CallHandler) {
    console.log('BEFORE');
    const res = await next.handle();
    console.log('AFTER');
    return res;
  }
}
