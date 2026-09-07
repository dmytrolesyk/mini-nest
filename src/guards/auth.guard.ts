import { ForbiddenError } from '../filters/exception-filter.ts';
import { injectable } from '../ioc/decorators/injectable.ts';
import { LoggerService } from '../services/logger.service.ts';
import type { CanActivate, HttpExecutionContext } from '../types.ts';

@injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly logger: LoggerService) {}

  canActivate(executionContext: HttpExecutionContext): boolean {
    const { headers } = executionContext.request;
    if (headers.authorization === 'authorized') {
      this.logger.log('authorized');
      return true;
    }
    this.logger.log('rejected: missing or invalid Authorization header');
    throw new ForbiddenError('Not authorized to perform this action');
  }
}
