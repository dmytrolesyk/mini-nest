import 'reflect-metadata';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import type { AddressInfo } from 'node:net';
import {
  AppFactory,
  Body,
  Container,
  Controller,
  Get,
  Module,
  Param,
  Post,
  Query,
  Router,
  injectable,
} from '../src/index.ts';
import type { ValidationError } from '../src/index.ts';
import { RouteExplorer } from '../src/router.ts';
import { CreateUserDto } from '../src/dto/create-user.dto.ts';

@injectable()
class UsersService {
  findOne(id: number) {
    return { id, name: 'Harry Styles' };
  }
}

@Controller('users')
class UsersController {
  constructor(readonly usersService: UsersService) {}

  @Get()
  getAllUsers(@Query('limit') limit: string) {
    return { limit };
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.usersService.findOne(Number(id));
  }

  @Post()
  createUser(@Body() createUserDto: CreateUserDto) {
    return { isDto: createUserDto instanceof CreateUserDto, name: createUserDto.name };
  }
}

@Module({ controllers: [UsersController] })
class TestModule {}

const freePort = async (): Promise<number> => {
  const probe = net.createServer();
  await new Promise<void>(resolve => probe.listen(0, resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return port;
};

const app = AppFactory.create(TestModule);
let baseUrl = '';

before(async () => {
  const port = await freePort();
  await new Promise<void>(resolve => app.listen(port, resolve));
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => app.close());

const postUser = (body: object) => {
  return fetch(`${baseUrl}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};

describe('router', () => {
  const routes = new RouteExplorer(new Container()).initRoutes(TestModule);

  it('finds a route by method and path, joining controller prefix with method path', () => {
    const matched = new Router(routes).match('GET', '/users/42');

    assert.ok(matched);
    assert.equal(matched.route.method, 'GET');
    assert.deepEqual(matched.pathParams, { id: '42' });
  });

  it('does not match a path that no controller declares', () => {
    const router = new Router(routes);

    assert.equal(router.match('GET', '/unknown'), undefined);
  });
});

describe('dispatcher', () => {
  it('passes @Param into the handler as an argument', async () => {
    const response = await fetch(`${baseUrl}/users/42`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { id: 42, name: 'Harry Styles' });
  });

  it('passes @Query into the handler as an argument', async () => {
    const response = await fetch(`${baseUrl}/users?limit=5`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { limit: '5' });
  });

  it(
    'answers 404 when no route matches',
    { todo: 'dispatch maps every error to 500 until exception filters land' },
    async () => {
      const response = await fetch(`${baseUrl}/unknown`);

      assert.equal(response.status, 404);
    },
  );
});

describe('validation', () => {
  it('passes a DTO instance into the handler when the body is valid', async () => {
    const response = await postUser({ name: 'Solaire', email: 'solaire@example.com', age: 30 });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { isDto: true, name: 'Solaire' });
  });

  it(
    'answers 400 listing every field that failed and why',
    { todo: 'validation errors are swallowed into a generic 500 until exception filters land' },
    async () => {
      const response = await postUser({ name: 'S', email: 'not-an-email', age: 1.5 });
      const body = (await response.json()) as { errors: ValidationError[] };

      assert.equal(response.status, 400);
      assert.match(JSON.stringify(body), /email/);
      assert.deepEqual(
        body.errors.map(error => error.field),
        ['name', 'email', 'age'],
      );
    },
  );
});

describe('request body', () => {
  it('reads a chunked body that carries no Content-Length', async () => {
    const payload = JSON.stringify({ name: 'Solaire', email: 'solaire@example.com', age: 30 });
    const response = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(payload));
          controller.close();
        },
      }),
      duplex: 'half',
    } as RequestInit);

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { isDto: true, name: 'Solaire' });
  });

  it(
    'answers 400 rather than 500 when the JSON body is malformed',
    { skip: 'BadRequestError escapes HttpServer as an unhandled rejection and kills the process' },
    async () => {
      const response = await fetch(`${baseUrl}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"name":"x",,,}',
      });

      assert.equal(response.status, 400);
    },
  );
});

describe('container integration', () => {
  it('injects the singleton the container resolves', () => {
    const container = new Container();
    const controller = container.get(UsersController);

    assert.ok(controller.usersService instanceof UsersService);
    assert.equal(controller.usersService, container.get(UsersService));
  });
});
