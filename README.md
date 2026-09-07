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

| scope       | behaviour                            |
| ----------- | ------------------------------------ |
| `singleton` | default — one instance per container |
| `transient` | a new instance on every resolve      |

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

`AppFactory.create(AppModule)` піднімає `node:http`-сервер поверх контейнера з частини 1.

Маршрути збирає `src/route-explorer.ts`: він проходить модулі, читає `@Controller(prefix)` з
класу та список маршрутів із прототипу, просить контейнер створити екземпляр контролера і
склеює повний шлях із префікса контролера та шляху методу. Зіставлення робить `URLPattern`,
тому `:id` у шляху стає іменованою групою. `src/router.ts` — це вже просто таблиця
`(method, pathname) → handler`: він нічого не знає ні про декоратори, ні про контейнер, ні
про `req`/`res`, тож його можна тестувати без сервера.

Ключова ідея: увесь ланцюг збирається **один раз під час старту**, а не на кожен запит.
`computeRouteHandler` розв'язує гварди й інтерсептори з контейнера, компілює екстрактори
параметрів у замикання і згортає все у **одну** функцію `RouteHandler`. На гарячому шляху
залишаються тільки виклики.

## Життєвий цикл запиту

Кожен HTTP-виклик проходить ті самі стадії, у тому самому порядку. Порядок зафіксовано
тестом `test/lifecycle.test.ts`, який збирає масив міток і порівнює його з очікуваною
послідовністю — не «щось викликалось», а точний порядок.

```
request
  │
  ├─ HttpServer                  X-Request-Id, ALS-скоуп, parseBody
  │   │
  │   ├─ Middleware              consumer.apply() у Module.configure()
  │   │   │
  │   │   ├─ Guard               canActivate() → false / throw → 403
  │   │   │   │
  │   │   │   ├─ Interceptor     код «до»: старт таймера
  │   │   │   │   │
  │   │   │   │   ├─ Pipe        ZodValidationPipe → 400 зі списком полів
  │   │   │   │   └─ Handler     метод контролера
  │   │   │   │
  │   │   │   └─ Interceptor     код «після»: бачить і час, і результат
  │   │   │
  │   │   └─ Middleware          продовження після `await next()`
  │   │
  │   └─ Exception filter        ловить усе, що кинуто вище
  │
response
```

Відступи — це не оформлення, а буквальна вкладеність: кожна стадія обгортає наступну.
Тому інтерсептор трапляється в трасуванні двічі (вниз і вгору), а гвард — лише раз.

| Стадія           | Файл                                   | Що може                                                                        | Чого не може                  |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------- |
| Middleware       | `src/dispatcher.ts`                    | обірвати запит, не викликавши `next()`; працює навіть коли маршрут не знайдено | повернути тіло відповіді      |
| Guard            | `src/guards/`, `src/route-explorer.ts` | пустити або ні (`boolean` / `throw`)                                           | побачити чи змінити результат |
| Interceptor      | `src/interceptors/`                    | обгорнути виклик, зміряти час, підмінити результат                             | вирішувати «пускати чи ні»    |
| Pipe             | `src/pipes/`                           | перетворити й перевірити один аргумент                                         | бачити інші аргументи         |
| Exception filter | `src/filters/`                         | перетворити будь-яку помилку на відповідь                                      | втрутитися до помилки         |

Різниця між гвардом та інтерсептором зводиться до однієї сигнатури: гвард не отримує
`next`, тому структурно не може виконати код після обробника і не бачить результату.
Інтерсептор отримує `next` — звідси і «до», і «після», і можливість підмінити відповідь.

Обробник маршруту — це **остання ланка** ланцюга middleware, як в Express. Тому
`await next()` обов'язковий: без нього відповідь піде до того, як обробник відпрацює.

### Чому AsyncLocalStorage, а не глобальна змінна

`requestId` потрібен усюди — сервісу, репозиторію, логеру — але тягнути його параметром
через кожен виклик означає засмітити всі сигнатури заради однієї наскрізної потреби.
Спокуса — покласти його в модульну змінну:

```ts
let currentRequestId = ''; // так робити не можна
```

Це ламається на першому ж `await`. Node обробляє запити конкурентно в одному потоці: поки
запит A чекає на базу, event loop встигає прийняти запит B і перезаписати `currentRequestId`.
Коли A прокидається і йде логувати — там уже чужий id. Помилка не детермінована: під
навантаженням логи тихо перемішуються, і саме тоді, коли вони найпотрібніші.

`AsyncLocalStorage` прив'язує сховище не до модуля, а до **асинхронного контексту
виконання**. `als.run(store, callback)` робить `store` видимим для `callback` і для всіх
асинхронних продовжень, породжених усередині нього — на будь-якій глибині стека, скільки б
запитів не виконувалось паралельно.

```ts
// src/context/request-context.ts
static run<T>(store: RequestStore, callback: () => Promise<T>): Promise<T> {
  return als.run(store, callback);
}
```

Скоуп відкривається в `HttpServer` і охоплює весь запит — розбір тіла, диспетчеризацію,
exception filter і запис відповіді. Тому `X-Request-Id` повертається навіть на 404 та на
зламаному JSON, а `LoggerService` читає id без жодного параметра:

```ts
// src/services/logger.service.ts
log(message: string) {
  console.log(`[${RequestContext.requestId ?? 'no-request-context'}] ${message}`);
}
```

Тест `test/request-context.test.ts` шле 10 одночасних запитів із різними `X-Request-Id` і
перевіряє, що кожен бачить свій — і в заголовку відповіді, і двома рівнями глибше в стеку.
Усередині сервісу стоїть `await`, щоб запити справді перемежовувалися: саме на цьому місці
глобальна змінна б і зламалась.

### Як параметр-декоратор знає, куди підставити значення

Параметр-декоратор отримує `(target, propertyKey, parameterIndex)` — і саме `parameterIndex`
є ключем. `@Param('id')`, `@Query('limit')` та `@Body()` нічого не витягують самі: вони лише
записують у метадані прототипу контролера мапу
`{ [methodName]: { [parameterIndex]: { type, key, pipe } } }`.

Під час старту `createExtractor` перетворює цю мапу на масив замикань, індексований за
позицією параметра: для `param` — читання з груп `URLPattern`, для `query` — з
`searchParams`, для `body` — тіло цілком або один ключ (`@Body('name')`). Якщо до параметра
прикріплено pipe, він теж прив'язується на цьому етапі. На запиті лишається виконати масив.

Валідація — це pipe на Zod. Схема передається явно (`@Body(new ZodValidationPipe(schema))`),
бо Zod-схема це значення, а не клас: `design:paramtypes` для типу-аліаса віддає `Object`, і
відновити схему з анотації неможливо. Помилки групуються за шляхом поля і летять як
`ValidationError` — фільтр перетворює її на `400` зі списком `[{ field, constraints }]`.

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
container.bind(Token).to(Implementation); // construct this class
container.bind(Token).toConstantValue(value); // hand back a fixed value
container.bind(SomeClass).toSelf(); // construct the identifier itself
container.bind(Token).setScope('transient').to(Impl);
container.unbind(Token); // also drops the cached singleton
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
src/ioc/                          the IoC container from part 1
src/decorators/controller.ts      @Controller(prefix)
src/decorators/methods.ts         @Get / @Post / ...
src/decorators/params.ts          @Body, @Param, @Query (+ pipes)
src/decorators/module.ts          @Module({ controllers })
src/decorators/use-guards.ts      @UseGuards
src/decorators/use-interceptors.ts @UseInterceptors
src/app-factory.ts                AppFactory.create, shutdown hooks
src/server.ts                     node:http layer, ALS scope, response writing
src/dispatcher.ts                 middleware chain + route terminal
src/route-explorer.ts             builds one RouteHandler per route at boot
src/router.ts                     route table and URLPattern matching
src/guards/                       AuthGuard
src/interceptors/                 LoggingInterceptor
src/pipes/zod-validation.pipe.ts  Zod pipe
src/filters/exception-filter.ts   HttpException hierarchy + filter
src/context/request-context.ts    AsyncLocalStorage request scope
src/services/logger.service.ts    reads requestId out of storage
src/dto/create-user.dto.ts        Zod schema + inferred type
src/types.ts                      shared types
test/                             tests
```

## License

ISC
