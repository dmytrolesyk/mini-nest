import http, { IncomingMessage, Server, STATUS_CODES } from 'node:http';
import type {
  OptionalCallback,
  RequestBody,
  HttpExecutionContext,
  HttpMethod,
  STATUS_CODE,
} from './types.ts';
import { RequestContext } from './context/request-context.ts';
import {
  BadRequestError,
  InternalServerError,
  exceptionFilter,
} from './filters/exception-filter.ts';

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

const REQUEST_ID_HEADER = 'X-Request-Id';

const readIncomingRequestId = (request: IncomingMessage): string | undefined => {
  const value = request.headers[REQUEST_ID_HEADER.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

export type HandlerResponse = { status: STATUS_CODE; payload: unknown };

const INTERNAL_ERROR = new InternalServerError('Something went wrong').toPayload();
const INTERNAL_ERROR_BODY = JSON.stringify(INTERNAL_ERROR.payload);

export class HttpServer {
  private server: Server;
  private _port: number | undefined;
  constructor(onRequest: (context: HttpExecutionContext) => Promise<HandlerResponse>) {
    this.server = http.createServer((req, res) => {
      const store = RequestContext.createStore(readIncomingRequestId(req));
      res.setHeader(REQUEST_ID_HEADER, store.requestId);
      const writeResponse = (status: STATUS_CODE, payload: unknown) => {
        res.statusCode = status;
        if (payload === undefined || payload === null) {
          res.end();
          return;
        }
        let serialised: string;
        try {
          serialised = JSON.stringify(payload);
        } catch (error) {
          console.error(error);
          res.statusCode = INTERNAL_ERROR.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(INTERNAL_ERROR_BODY);
          return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(serialised);
      };
      const handleRequest = async () => {
        try {
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
          const { status, payload } = await onRequest(context);
          writeResponse(status, payload);
        } catch (error) {
          const { status, payload } = exceptionFilter(error);
          writeResponse(status, payload);
        }
      };
      RequestContext.run(store, handleRequest).catch(error => {
        console.error(error);
        if (res.headersSent) {
          res.destroy();
          return;
        }
        res.statusCode = INTERNAL_ERROR.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(INTERNAL_ERROR_BODY);
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
