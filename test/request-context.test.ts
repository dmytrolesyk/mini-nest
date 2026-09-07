import 'reflect-metadata';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AppFactory, Controller, Get, Module, Query, injectable } from '../src/index.ts';
import { RequestContext } from '../src/context/request-context.ts';
import { freePort } from './helpers.ts';

/**
 * Two levels below the handler. Neither service takes a request id as an
 * argument — it is read out of async local storage wherever it is needed.
 */
@injectable()
class DeepService {
  async currentRequestId() {
    // An await, so concurrent requests genuinely interleave here. A module-level
    // variable would be overwritten by the next request during this gap.
    await new Promise(resolve => setTimeout(resolve, 20));
    return RequestContext.requestId;
  }
}

@injectable()
class MiddleService {
  constructor(private readonly deep: DeepService) {}

  trace() {
    return this.deep.currentRequestId();
  }
}

@Controller('trace')
class TraceController {
  constructor(private readonly middle: MiddleService) {}

  @Get()
  async read(@Query('tag') tag: string) {
    return { tag, seenTwoLevelsDeep: await this.middle.trace() };
  }
}

@Module({ controllers: [TraceController] })
class TraceModule {}

const app = AppFactory.create(TraceModule);
let baseUrl = '';

before(async () => {
  const port = await freePort();
  await new Promise<void>(resolve => app.listen(port, resolve));
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await app.close();
});

describe('request id', () => {
  it('generates one and returns it in the response header', async () => {
    const response = await fetch(`${baseUrl}/trace`);

    assert.match(response.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
  });

  it('reuses the id the client sent', async () => {
    const response = await fetch(`${baseUrl}/trace`, {
      headers: { 'X-Request-Id': 'client-supplied-42' },
    });

    assert.equal(response.headers.get('x-request-id'), 'client-supplied-42');
  });

  it('returns the id even when no route matches', async () => {
    const response = await fetch(`${baseUrl}/no-such-route`);

    assert.equal(response.status, 404);
    assert.ok(response.headers.get('x-request-id'));
  });
});

describe('async local storage', () => {
  it('reaches a service two levels below the handler', async () => {
    const response = await fetch(`${baseUrl}/trace`, {
      headers: { 'X-Request-Id': 'deep-read' },
    });
    const body = (await response.json()) as { seenTwoLevelsDeep: string };

    assert.equal(body.seenTwoLevelsDeep, 'deep-read');
  });

  it('keeps ten concurrent requests from seeing each other’s id', async () => {
    const ids = Array.from({ length: 10 }, (_, index) => `concurrent-${index}`);

    const results = await Promise.all(
      ids.map(async id => {
        const response = await fetch(`${baseUrl}/trace?tag=${id}`, {
          headers: { 'X-Request-Id': id },
        });
        const body = (await response.json()) as { tag: string; seenTwoLevelsDeep: string };
        return { id, header: response.headers.get('x-request-id'), body };
      }),
    );

    for (const { id, header, body } of results) {
      assert.equal(header, id, `response header leaked: ${header} !== ${id}`);
      assert.equal(body.seenTwoLevelsDeep, id, `storage leaked: ${body.seenTwoLevelsDeep} !== ${id}`);
      assert.equal(body.tag, id);
    }
  });
});
