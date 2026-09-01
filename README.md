# @dmytrolesyk/custom-nest

A minimal IoC container with decorator-driven constructor injection — the part
of NestJS that reads `design:paramtypes` and assembles your object graph, built
from scratch.

## Install

```sh
pnpm add @dmytrolesyk/custom-nest reflect-metadata
```

`reflect-metadata` is a peer dependency: the metadata registry has to be a
single global instance, so the container cannot bring its own copy.

Both decorator flags are required in the consuming project:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## Run

```sh
pnpm install
pnpm test              # compile to dist-test/ and run the tests
pnpm build             # compile the publishable library to dist/
pnpm typecheck
```

`pnpm test` compiles first, so it works on a fresh clone. `npm test` does the
same thing.

In Docker:

```sh
docker compose run --rm api npm test
```

The image is built in two stages: a builder that installs dependencies and
compiles TypeScript, and a test stage that runs the suite.

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

Classes marked `@injectable()` are auto-bound the first time they are resolved,
so a graph of concrete classes needs no registration at all.

## Scopes

| scope | behaviour |
| --- | --- |
| `singleton` | default — one instance per container |
| `transient` | a new instance on every resolve |

Declare the scope on the class:

```ts
@injectable({ scope: 'transient' })
class RequestContext {}
```

That scope is used whether the class is auto-bound or bound explicitly. A
binding can still override it:

```ts
container.bind(RequestContext).setScope('singleton').toSelf();
```

Singletons are cached per container, not globally.

## Як це працює

Контейнер нічого не вгадує — він читає метадані, які **TypeScript сам** кладе
на клас під час компіляції.

Коли до класу застосовано будь-який декоратор і увімкнено
`emitDecoratorMetadata`, компілятор дописує до емітованого коду виклик
`Reflect.metadata('design:paramtypes', [...])` зі списком типів параметрів
конструктора. Тобто для

```ts
@injectable()
class Car {
  constructor(engine: Engine) {}
}
```

у JavaScript опиняється `design:paramtypes = [Engine]` — посилання на **сам
конструктор** `Engine`, а не на рядок з назвою типу. Контейнер дістає цей масив
через `Reflect.getMetadata('design:paramtypes', Car)`, рекурсивно резолвить
кожен елемент і викликає `new Car(...залежності)`.

Два наслідки, які пояснюють решту API:

**Без `emitDecoratorMetadata` не працює нічого.** Прапорець вимкнено —
компілятор не емітує `design:paramtypes`, `Reflect.getMetadata` повертає
`undefined`, контейнер бачить порожній список залежностей і викликає
`new Car()` без аргументів. Помилки не буде: ви просто отримаєте об'єкт, у
якого всі залежності `undefined`. Так само й з класом **без жодного
декоратора** — метадані емітуються тільки для декорованих класів, тому
`@injectable()` потрібен ще й як тригер емісії.

**Не кожен тип переживає компіляцію.** Інтерфейси в рантаймі не існують, і
замість інтерфейсу компілятор запише `Object`; примітиви стають `String`,
`Number`, `Boolean`. Резолвити такі «типи» немає сенсу, тому для них потрібен
явний токен через `@inject(token)` — див. нижче.

Сам `@injectable()` — це буквально два рядки:

```ts
export function injectable(options: InjectableOptions = {}): ClassDecorator {
  return target => {
    Reflect.defineMetadata(INJECTABLE, options, target);
  };
}
```

Аргумент декоратора зберігається там само, тож `@injectable({ scope:
'transient' })` читається контейнером у момент створення біндингу.

Перевіряється він через `hasOwnMetadata`, а не `hasMetadata`: позначення має
бути явним, інакше недекорований нащадок успадкував би прапорець від батька.
`design:paramtypes`, навпаки, читається успадковано — нащадок без власного
конструктора справді використовує батьківський.

## HTTP-шар

`Factory.create([AppModule])` піднімає `node:http`-сервер поверх контейнера з частини 1.

Маршрути збирає `src/router.ts`: він проходить модулі, читає `@Controller(prefix)` з класу
та список маршрутів із прототипу, просить контейнер створити екземпляр контролера і склеює
повний шлях із префікса контролера та шляху методу. Зіставлення робить `URLPattern`, тому
`:id` у шляху стає іменованою групою. Роутер нічого не знає про `req`/`res` — його можна
тестувати без сервера.

`src/dispatcher.ts` відповідає лише за HTTP: парсить тіло, питає роутер про збіг, збирає
масив аргументів, проганяє DTO через `ValidationPipe` і серіалізує результат у JSON.

### Як параметр-декоратор знає, куди підставити значення

Параметр-декоратор отримує `(target, propertyKey, parameterIndex)` — і саме `parameterIndex`
є ключем. `@Param('id')`, `@Query('limit')` та `@Body()` нічого не витягують самі: вони лише
записують у метадані прототипу контролера мапу
`{ [methodName]: { [parameterIndex]: { type, key } } }`.

Під час запиту диспетчер бере цю мапу для знайденого обробника і будує масив аргументів за
індексами: для `param` — значення з груп `URLPattern`, для `query` — з `searchParams`, для
`body` — розпарсене тіло. Який саме клас DTO очікує метод, диспетчер дізнається з
`design:paramtypes`, що його `emitDecoratorMetadata` записує для цього методу. Тому
`@Body() dto: CreateUserDto` спершу проходить через `plainToInstance`, а потім через
`class-validator`; якщо є помилки — відповідь `400` зі списком `[{ field, constraints }]`,
інакше в метод приходить уже екземпляр DTO.

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

`@inject` stores a map of parameter index to identifier under its own metadata
key, which the container layers over `design:paramtypes` when resolving.

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

`bind()` returns a builder; the terminal call registers the binding. `setScope`
overrides whatever the class declared, so call it before choosing a target.

## Circular dependencies

A cycle throws with the full chain rather than overflowing the stack:

```
[ResolutionError] circular dependencies detected A -> B -> A
```

Diamonds are not cycles — a dependency reached twice along different paths
resolves normally.

## Options

```ts
new Container({ autobind: false });
```

With `autobind` disabled every identifier must be bound explicitly before it
can be resolved.

## Project layout

```
src/ioc/                       the IoC container from part 1
src/decorators/controller.ts   @Controller(prefix)
src/decorators/methods.ts      @Get / @Post / ...
src/decorators/params.ts       @Body, @Param, @Query
src/decorators/module.ts       @Module({ controllers })
src/decorators/helpers.ts      composeClassDecorators
src/router.ts                  route table and URLPattern matching
src/dispatcher.ts              node:http layer
src/pipes/validation.pipe.ts   DTO validation
src/dto/create-user.dto.ts     DTO with class-validator rules
src/types.ts                   shared types
test/                          tests
```

## License

ISC
