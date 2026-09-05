import http, { IncomingMessage, Server, STATUS_CODES } from 'node:http';
import type { OptionalCallback, RequestBody, HttpExecutionContext, HttpMethod } from './types.ts';
import { RequestContext } from './context/request-context.ts';

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

export type HandlerResponse = { status: number; payload: unknown };

export class HttpServer {
  private server: Server;
  private _port: number | undefined;
  constructor(onRequest: (context: HttpExecutionContext) => Promise<void>) {
    this.server = http.createServer((req, res) => {
      const requestContext = new RequestContext();
      requestContext.run(async () => {
        const { url = '/' } = req;
        const method = (req.method ?? 'GET') as HttpMethod;
        const body = await this.parseBody(req);
        const context: HttpExecutionContext = {
          method,
          url: new URL(url, 'http://localhost'),
          request: req,
          response: res,
          body,
          pathParams: {},
        };
        await onRequest(context);
      });
    });
  }
  get port() {
    return this._port;
  }
  listen(port: number, callback: OptionalCallback) {
    this._port = port;
    this.server.listen(port, callback);
  }
  close(callback: OptionalCallback) {
    this.server.close(callback);
  }
  private async parseBody(request: IncomingMessage): Promise<RequestBody> {
    if (BODYLESS_METHODS.includes(request.method ?? 'GET')) return;
    const rawBody = await this.readRawBody(request);
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
  private async readRawBody(request: IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
}
