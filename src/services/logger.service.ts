import { injectable } from '../ioc/decorators/injectable.ts';
import { RequestContext } from '../context/request-context.ts';

@injectable()
export class LoggerService {
  log(message: string) {
    console.log(`[${RequestContext.requestId ?? 'no-request-context'}] ${message}`);
  }
}
