# @dmytrolesyk/custom-nest

A minimal IoC container with decorator-driven constructor injection — the part
of NestJS that reads `design:paramtypes` and assembles your object graph, built
from scratch.

## Install

```sh
pnpm add @dmytrolesyk/custom-nest reflect-metadata
```

`reflect-metadata` is a peer dependency: the metadata registry must be a single
global instance, so the container cannot bring its own copy.

Your `tsconfig.json` needs both decorator flags:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Quick start

```ts
import 'reflect-metadata';
import { Container, injectable } from '@dmytrolesyk/custom-nest';

@injectable()
class Engine {}

@injectable()
class Car {
  constructor(readonly engine: Engine) {}
}

const car = new Container().get(Car) as Car;
car.engine instanceof Engine; // true
```

Classes marked `@injectable()` are auto-bound on first resolve, so a graph of
concrete classes needs no registration at all.

## Tokens

TypeScript erases interfaces, so an interface-typed parameter emits `Object`
and cannot be resolved by type. Give it an explicit token instead:

```ts
const LOGGER = Symbol.for('logger');

@injectable()
class Repo {
  constructor(@inject(LOGGER) private logger: Logger) {}
}

container.bind(LOGGER).to(ConsoleLogger);
```

The same applies to primitives — `damage: number` emits `Number`, which the
container refuses to construct.

## Binding

```ts
container.bind(Token).to(Implementation);        // construct this class
container.bind(Token).toConstantValue(value);    // hand back a fixed value
container.bind(SomeClass).toSelf();              // construct the identifier itself
container.bind(Token).setScope('transient').to(Impl);
container.unbind(Token);                         // also drops the cached singleton
```

`bind()` returns a builder; the terminal call registers the binding. Set the
scope before choosing a target.

## Scopes

| scope | behaviour |
| --- | --- |
| `singleton` | default — one instance per container |
| `transient` | a new instance on every resolve |

Singletons are cached per container, not globally.

## Circular dependencies

A cycle throws with the full chain rather than overflowing the stack:

```
[ResolutionError] circular dependencies detected A -> B -> A
```

Diamonds are not cycles — a dependency reached twice by different paths
resolves normally.

## Options

```ts
new Container({ autobind: false });
```

With `autobind` disabled, every identifier must be bound explicitly before it
can be resolved.

## License

ISC
