import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Newable } from './ioc/decorators/types.ts';

export type Path = string | string[];

export const HttpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

export type HttpMethod = (typeof HttpMethods)[number];

export type RequestBody = URLSearchParams | object | string | undefined;
export interface CanActivate extends Newable {
  canActivate(executionContext: HttpExecutionContext): boolean | Promise<boolean>;
}

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
