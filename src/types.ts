export type Path = string | string[];

export const HttpMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

export type HttpMethod = (typeof HttpMethods)[number];

export type RequestBody = URLSearchParams | object | string | undefined;
