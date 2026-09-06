import 'reflect-metadata';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import {
  AppFactory,
  Body,
  Controller,
  Module,
  Post,
  UseGuards,
  UseInterceptors,
  injectable,
} from '../src/index.ts';
import type {
  CallHandler,
  CanActivate,
  HttpExecutionContext,
  Middleware,
  NestInterceptor,
  PipeTransform,
} from '../src/index.ts';

/**
 * The lifecycle every request walks, in order:
 *
 *   Middleware -> Guard -> Interceptor(before) -> Pipe -> Handler -> Interceptor(after)
 *
 * Each stage appends its own label to `calls`, and the test asserts the exact
 * sequence. A stage that runs in the wrong position fails loudly instead of
 * quietly appearing to work.
 */
const EXPECTED_ORDER = [
  'middleware',
  'guard',
  'interceptor:before',
  'pipe',
  'handler',
  'interceptor:after',
];

let calls: string[] = [];

const recordingMiddleware: Middleware = async (_context, next) => {
  calls.push('middleware');
  await next();
};

@injectable()
class RecordingGuard implements CanActivate {
  canActivate(_context: HttpExecutionContext): boolean {
    calls.push('guard');
    return true;
  }
}

@injectable()
class RecordingInterceptor implements NestInterceptor {
  async intercept(_context: HttpExecutionContext, next: CallHandler): Promise<unknown> {
    calls.push('interceptor:before');
    const result = await next.handle();
    calls.push('interceptor:after');
    return result;
  }
}

const recordingPipe: PipeTransform = {
  transform(value: unknown) {
    calls.push('pipe');
    return value;
  },
};

@Controller('lifecycle')
@UseGuards(RecordingGuard)
@UseInterceptors(RecordingInterceptor)
class LifecycleController {
  @Post()
  run(@Body(recordingPipe) body: unknown) {
    calls.push('handler');
    return { received: body };
  }
}

@Module({ controllers: [LifecycleController] })
class LifecycleModule {}

const freePort = async (): Promise<number> => {
  const probe = net.createServer();
  await new Promise<void>(resolve => probe.listen(0, resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return port;
};

const app = AppFactory.create([LifecycleModule], { middleware: [recordingMiddleware] });
let baseUrl = '';

before(async () => {
  const port = await freePort();
  await new Promise<void>(resolve => app.listen(port, resolve));
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => app.close());

beforeEach(() => {
  calls = [];
});

const post = (body: object) =>
  fetch(`${baseUrl}/lifecycle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('request lifecycle', () => {
  it('runs every stage exactly once, in the documented order', async () => {
    const response = await post({ hello: 'world' });

    assert.equal(response.status, 201);
    assert.deepEqual(calls, EXPECTED_ORDER);
  });

  it('hands the piped value to the handler', async () => {
    const response = await post({ hello: 'world' });

    assert.deepEqual(await response.json(), { received: { hello: 'world' } });
  });

  it('runs the guard before the handler, not after', async () => {
    await post({ hello: 'world' });

    assert.ok(calls.indexOf('guard') < calls.indexOf('handler'));
  });

  it('closes the interceptor around the pipe and the handler', async () => {
    await post({ hello: 'world' });

    assert.ok(calls.indexOf('interceptor:before') < calls.indexOf('pipe'));
    assert.ok(calls.indexOf('handler') < calls.indexOf('interceptor:after'));
  });
});
