import { ForbiddenError } from '../filters/exception-filter.ts';
import { injectable } from '../ioc/decorators/injectable.ts';
import type { CanActivate, HttpExecutionContext } from '../types.ts';

@injectable()
export class AuthGuard implements CanActivate {
  canActivate(executionContext: HttpExecutionContext): boolean | Promise<boolean> {
    const { request } = executionContext;
    const { headers } = request;
    console.log('guard');
    if (headers.authorization === 'authorized') return true;
    throw new ForbiddenError('Not authorized to perform this action');
  }
}
