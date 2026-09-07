import type { MatchedRoute, Route } from './types.ts';

export class Router {
  private readonly routes: Route[] = [];

  constructor(routes: Route[]) {
    this.routes = routes;
  }

  match(method: string, pathname: string): MatchedRoute | undefined {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const matched = route.pattern.exec({ pathname });
      if (matched) return { route, pathParams: matched.pathname.groups };
    }
  }
}
