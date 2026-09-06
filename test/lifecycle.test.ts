import 'reflect-metadata';
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AppFactory,
  Body,
  Controller,
  Get,
  Module,
  NotFoundError,
  Post,
  UseGuards,
  UseInterceptors,
  injectable,
} from '../src/index.ts';
import type {
  CallHandler,
  CanActivate,
  HttpExecutionContext,
  Interceptor,
  Middleware,
  MiddlewareConsumer,
  MiniNestModule,
  PipeTransform,
} from '../src/index.ts';
import { AuthGuard } from '../src/guards/auth.guard.ts';
import { LoggingInterceptor } from '../src/interceptors/logging.interceptor.ts';
import { captureLog, freePort } from './helpers.ts';

/**
 * The lifecycle every request walks, in order:
 *
 *   Middleware -> Guard -> Interceptor(before) -> Pipe -> Handler -> Interceptor(after)
 *
 * Each stage appends its own label to `calls`, and the test asserts the exact
 * sequence. A stage running in the wrong position fails loudly rather than
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
let handlerHits = 0;

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
class RecordingInterceptor implements Interceptor {
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
    handlerHits += 1;
    return { received: body };
  }
}

/** Guarded by the real AuthGuard, so the 403 test exercises shipped code. */
@Controller('secure')
@UseGuards(AuthGuard)
class SecureController {
  @Get()
  read() {
    handlerHits += 1;
    return { secret: 'sunlight' };
  }
}

@Controller('failures')
@UseInterceptors(LoggingInterceptor)
class FailureController {
  @Get('boom')
  boom() {
    throw new Error('boom');
  }

  @Get('missing')
  missing() {
    throw new NotFoundError('User with this id not found');
  }

  @Get('ok')
  ok() {
    return { ok: true };
  }
}

@Module({ controllers: [LifecycleController, SecureController, FailureController] })
class LifecycleModule implements MiniNestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply([recordingMiddleware]);
  }
}

const app = AppFactory.create(LifecycleModule);
let baseUrl = '';

before(async () => {
  const port = await freePort();
  await new Promise<void>(resolve => app.listen(port, resolve));
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => app.close());

beforeEach(() => {
  calls = [];
  handlerHits = 0;
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

  it('closes the interceptor around both the pipe and the handler', async () => {
    await post({ hello: 'world' });

    assert.ok(calls.indexOf('interceptor:before') < calls.indexOf('pipe'));
    assert.ok(calls.indexOf('handler') < calls.indexOf('interceptor:after'));
  });
});

describe('guard', () => {
  it('answers 403 when the Authorization header is missing', async () => {
    const response = await fetch(`${baseUrl}/secure`);

    assert.equal(response.status, 403);
  });

  it('does not reach the handler when it denies', async () => {
    await fetch(`${baseUrl}/secure`);

    assert.equal(handlerHits, 0);
  });

  it('lets an authorized request through', async () => {
    const response = await fetch(`${baseUrl}/secure`, {
      headers: { Authorization: 'authorized' },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { secret: 'sunlight' });
    assert.equal(handlerHits, 1);
  });
});

describe('interceptor', () => {
  it('logs the route and how long it took', async () => {
    const lines = await captureLog(async () => {
      await fetch(`${baseUrl}/failures/ok`);
    });
    const timed = lines.find(line => /[0-9]+(\.[0-9]+)? ?ms/.test(line));

    assert.ok(timed, `no timing line in: ${JSON.stringify(lines)}`);
    assert.match(timed, /GET \/failures\/ok/);
  });

  it('still logs a duration when the handler throws', async () => {
    const lines = await captureLog(async () => {
      await fetch(`${baseUrl}/failures/boom`);
    });

    assert.ok(lines.some(line => /[0-9]+(\.[0-9]+)? ?ms/.test(line)));
  });
});

describe('exception filter', () => {
  it('turns an unexpected error into a 500 that leaks nothing', async () => {
    const response = await fetch(`${baseUrl}/failures/boom`);
    const text = await response.text();

    assert.equal(response.status, 500);
    assert.doesNotMatch(text, /boom|at .*\.ts:/);
  });

  it('maps a domain error to its status and keeps the message', async () => {
    const response = await fetch(`${baseUrl}/failures/missing`);
    const body = (await response.json()) as { message: string };

    assert.equal(response.status, 404);
    assert.equal(body.message, 'User with this id not found');
  });
});
