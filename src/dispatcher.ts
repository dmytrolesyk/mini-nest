import http, { IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { RequestBody } from './types.ts';
import { Container } from './ioc/container.ts';
import type { Newable } from './ioc/decorators/types.ts';
import { ValidationPipe, needsValidation } from './pipes/validation.pipe.ts';
import type { ValidationError } from './pipes/validation.pipe.ts';
import { Router } from './router.ts';
import type { MatchedRoute } from './router.ts';

type App = {
  listen: (port: number, callback?: () => void) => Server;
  close: (callback?: () => void) => void;
  container: Container;
  router: Router;
};

const CONTENT_TYPES_MAP = {
  txt: 'text/plain',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  json: 'application/json',
  xml: 'application/xml',
  urlEncoded: 'application/x-www-form-urlencode',
  csv: 'text/csv',
  md: 'text/markdown',

  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',

  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',

  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',

  pdf: 'application/pdf',
  zip: 'application/zip',
  wasm: 'application/wasm',
  bin: 'application/octet-stream',
} as const;

const BODYLESS_METHODS = ['GET', 'HEAD'];

export class BadRequestError extends Error {}

async function readRawBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function parseBody(request: IncomingMessage): Promise<RequestBody> {
  if (BODYLESS_METHODS.includes(request.method ?? 'GET')) return;
  const rawBody = await readRawBody(request);
  if (rawBody.length === 0) return;
  const contentType = request.headers['content-type'] ?? '';
  if (contentType.startsWith(CONTENT_TYPES_MAP.json)) {
    try {
      return JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestError('Malformed JSON body');
    }
  }
  if (contentType.startsWith(CONTENT_TYPES_MAP.urlEncoded)) {
    return new URLSearchParams(rawBody.toString('utf8'));
  }
  return rawBody.toString('utf8');
}

const send = (res: ServerResponse, status: number, payload: unknown) => {
  res.writeHead(status, { 'Content-Type': CONTENT_TYPES_MAP.json });
  res.end(JSON.stringify(payload ?? null));
};

const buildArguments = async (matched: MatchedRoute, query: URLSearchParams, body: RequestBody) => {
  const { route, pathParams } = matched;
  const args: unknown[] = [];
  const errors: ValidationError[] = [];
  for (const [index, param] of route.params) {
    if (param.type === 'param') {
      args[index] = pathParams[param.key ?? ''];
    }
    if (param.type === 'query') {
      args[index] = query.get(param.key ?? '');
    }
    if (param.type === 'body') {
      const Dto = route.paramTypes[index];
      if (needsValidation(Dto)) {
        const validated = await ValidationPipe.transform(Dto, body);
        errors.push(...validated.errors);
        args[index] = validated.instance;
      } else {
        args[index] = body;
      }
    }
  }
  return { args, errors };
};

type RequestContext = {
  method: string;
  url: URL;
  request: IncomingMessage;
  router: Router;
};

type HandlerResponse = { status: number; payload: unknown };

const execute = async (context: RequestContext): Promise<HandlerResponse> => {
  const { method, url, request, router } = context;
  const matched = router.match(method, url.pathname);
  if (!matched) {
    return { status: 404, payload: { message: `Cannot ${method} ${url.pathname}` } };
  }
  const body = await parseBody(request);
  const { args, errors } = await buildArguments(matched, url.searchParams, body);
  if (errors.length > 0) {
    return { status: 400, payload: { message: 'Validation failed', errors } };
  }
  const result = await matched.route.instance[matched.route.handler](...args);
  return { status: method === 'POST' ? 201 : 200, payload: result };
};

export class Factory {
  static create(modules: Newable[]): App {
    const container = new Container();
    const router = new Router(modules, container);
    const server = http.createServer(async (req, res) => {
      const { method = 'GET', url = '/' } = req;
      const context = { method, url: new URL(url, 'http://localhost'), request: req, router };
      try {
        const { status, payload } = await execute(context);
        send(res, status, payload);
      } catch (error) {
        if (error instanceof BadRequestError) {
          return send(res, 400, { message: error.message });
        }
        console.error(error);
        send(res, 500, { message: 'Internal Server Error' });
      }
    });
    return {
      listen: (port, callback) => server.listen(port, callback),
      close: callback => server.close(callback),
      container,
      router,
    };
  }
}
