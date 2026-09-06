import type { IncomingMessage, ServerResponse } from 'node:http';

export type Path = string | string[];

export const HttpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

export type HttpMethod = (typeof HttpMethods)[number];

export type RequestBody = URLSearchParams | object | string | undefined;
export interface CanActivate {
  canActivate(executionContext: HttpExecutionContext): boolean | Promise<boolean>;
}

export interface MiddlewareConsumer {
  apply(middleware: Middleware[]): void;
}

export interface MiniNestModule {
  configure(consumer: MiddlewareConsumer): void;
}

export type Middleware = (
  context: HttpExecutionContext,
  next: () => Promise<void>,
) => void | Promise<void>;

export type CallHandler<T = any> = {
  handle(): Promise<T>;
};

export interface Interceptor {
  intercept(context: HttpExecutionContext, next: CallHandler): Promise<unknown>;
}

export interface PipeTransform<TIn = unknown, TOut = unknown> {
  transform(value: TIn): TOut | Promise<TOut>;
}

export type RouteHandler = (context: HttpExecutionContext) => Promise<unknown>;

export type OptionalCallback = (() => void) | undefined;

export type PathParams = Record<string, string | undefined>;

export type HttpExecutionContext = {
  method: HttpMethod;
  url: URL;
  body: RequestBody;
  pathParams: PathParams;
  request: IncomingMessage;
  response: ServerResponse;
};

export const STATUS_CODES = {
  100: 'Continue',
  101: 'Switching Protocols',
  102: 'Processing',
  103: 'Early Hints',
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  203: 'Non-Authoritative Information',
  204: 'No Content',
  205: 'Reset Content',
  206: 'Partial Content',
  207: 'Multi-Status',
  208: 'Already Reported',
  226: 'IM Used',
  300: 'Multiple Choices',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  304: 'Not Modified',
  305: 'Use Proxy',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  406: 'Not Acceptable',
  407: 'Proxy Authentication Required',
  408: 'Request Timeout',
  409: 'Conflict',
  410: 'Gone',
  411: 'Length Required',
  412: 'Precondition Failed',
  413: 'Payload Too Large',
  414: 'URI Too Long',
  415: 'Unsupported Media Type',
  416: 'Range Not Satisfiable',
  417: 'Expectation Failed',
  418: "I'm a Teapot",
  421: 'Misdirected Request',
  422: 'Unprocessable Entity',
  423: 'Locked',
  424: 'Failed Dependency',
  425: 'Too Early',
  426: 'Upgrade Required',
  428: 'Precondition Required',
  429: 'Too Many Requests',
  431: 'Request Header Fields Too Large',
  451: 'Unavailable For Legal Reasons',
  500: 'Internal Server Error',
  501: 'Not Implemented',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
  505: 'HTTP Version Not Supported',
  506: 'Variant Also Negotiates',
  507: 'Insufficient Storage',
  508: 'Loop Detected',
  509: 'Bandwidth Limit Exceeded',
  510: 'Not Extended',
  511: 'Network Authentication Required',
} as const;

export type STATUS_CODE = keyof typeof STATUS_CODES;
export type STATUS_MESSAGE = (typeof STATUS_CODES)[STATUS_CODE];
