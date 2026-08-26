import 'reflect-metadata';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Container, injectable, inject } from './index.ts';

describe('resolving a simple graph', () => {
  @injectable()
  class Engine {
    readonly kind = 'v8';
  }

  @injectable()
  class Wheels {
    readonly count = 4;
  }

  @injectable()
  class Car {
    constructor(
      readonly engine: Engine,
      readonly wheels: Wheels,
    ) {}
  }

  it('autobinds and constructs the whole graph from design:paramtypes', () => {
    const car = new Container().get(Car) as Car;

    assert.ok(car instanceof Car);
    assert.ok(car.engine instanceof Engine);
    assert.ok(car.wheels instanceof Wheels);
    assert.equal(car.engine.kind, 'v8');
  });

  it('refuses to construct a class that is not marked @injectable', () => {
    class NotMarked {}

    assert.throws(() => new Container().get(NotMarked), /not marked as @injectable/);
  });

  it('refuses to autobind when the option is disabled', () => {
    const container = new Container({ autobind: false });

    assert.throws(() => container.get(Engine), /binding does not exist/);
  });
});

describe('scopes', () => {
  @injectable()
  class Service {}

  it('is singleton by default: the same instance every time', () => {
    const container = new Container();

    assert.equal(container.get(Service), container.get(Service));
  });

  it('shares one singleton between every dependent', () => {
    @injectable()
    class Left {
      constructor(readonly service: Service) {}
    }

    @injectable()
    class Right {
      constructor(readonly service: Service) {}
    }

    const container = new Container();

    assert.equal((container.get(Left) as Left).service, (container.get(Right) as Right).service);
  });

  it('returns a new instance every time when transient', () => {
    const container = new Container();
    container.bind(Service).setScope('transient').toSelf();

    assert.notEqual(container.get(Service), container.get(Service));
  });

  it('keeps singletons scoped per container, not globally', () => {
    assert.notEqual(new Container().get(Service), new Container().get(Service));
  });
});

describe('@inject with a token', () => {
  interface Weapon {
    damage: number;
  }

  const WEAPON = Symbol.for('weapon');

  @injectable()
  class Katana implements Weapon {
    readonly damage = 50;
  }

  @injectable()
  class Ninja {
    constructor(@inject(WEAPON) readonly weapon: Weapon) {}
  }

  it('resolves an interface-typed parameter through its token', () => {
    const container = new Container();
    container.bind(WEAPON).to(Katana);

    const ninja = container.get(Ninja) as Ninja;

    assert.ok(ninja.weapon instanceof Katana);
    assert.equal(ninja.weapon.damage, 50);
  });

  it('resolves a token bound to a constant value', () => {
    const container = new Container();
    container.bind<Weapon>(WEAPON).toConstantValue({ damage: 1 });

    assert.deepEqual((container.get(Ninja) as Ninja).weapon, { damage: 1 });
  });

  it('fails with a missing-binding error when the token was never bound', () => {
    assert.throws(() => new Container().get(Ninja), /binding does not exist/);
  });
});

describe('circular dependencies', () => {
  // Both sides are declared with interface-typed parameters and resolved by
  // token. A direct `constructor(b: B)` / `constructor(a: A)` pair cannot be
  // written: emitDecoratorMetadata evaluates the class reference when the
  // decorator runs, so whichever class is declared first would hit a TDZ
  // ReferenceError before the container ever sees it.
  interface IServiceA {}
  interface IServiceB {}

  const TOKEN_A = Symbol('ServiceA');
  const TOKEN_B = Symbol('ServiceB');

  @injectable()
  class ServiceA {
    constructor(@inject(TOKEN_B) readonly b: IServiceB) {}
  }

  @injectable()
  class ServiceB {
    constructor(@inject(TOKEN_A) readonly a: IServiceA) {}
  }

  const bindBoth = () => {
    const container = new Container();
    container.bind(TOKEN_A).to(ServiceA);
    container.bind(TOKEN_B).to(ServiceB);
    return container;
  };

  it('throws instead of overflowing the stack', () => {
    assert.throws(() => bindBoth().get(TOKEN_A), /circular dependencies detected/);
  });

  it('names the whole chain in the message', () => {
    assert.throws(
      () => bindBoth().get(TOKEN_A),
      (error: Error) => {
        assert.match(error.message, /Symbol\(ServiceA\) -> Symbol\(ServiceB\) -> Symbol\(ServiceA\)/);
        return true;
      },
    );
  });

  it('detects a class depending on itself', () => {
    interface ISelf {}
    const SELF = Symbol('Selfie');

    @injectable()
    class Selfie {
      constructor(@inject(SELF) readonly me: ISelf) {}
    }

    const container = new Container();
    container.bind(SELF).to(Selfie);

    assert.throws(() => container.get(SELF), /Symbol\(Selfie\) -> Symbol\(Selfie\)/);
  });

  it('does not mistake a diamond for a cycle', () => {
    @injectable()
    class Shared {}

    @injectable()
    class Left {
      constructor(readonly shared: Shared) {}
    }

    @injectable()
    class Right {
      constructor(readonly shared: Shared) {}
    }

    @injectable()
    class Top {
      constructor(
        readonly left: Left,
        readonly right: Right,
      ) {}
    }

    assert.doesNotThrow(() => new Container().get(Top));
  });
});

describe('binding management', () => {
  @injectable()
  class Service {}

  it('rejects a second binding for the same identifier', () => {
    const container = new Container();
    container.bind(Service).toSelf();

    assert.throws(() => container.bind(Service), /Binding already exists/);
  });

  it('allows rebinding after unbind, and drops the cached singleton', () => {
    const container = new Container();
    const first = container.get(Service);

    container.unbind(Service);
    container.bind(Service).toSelf();

    assert.notEqual(container.get(Service), first);
  });

  it('refuses to bind a token to itself', () => {
    assert.throws(() => new Container().bind(Symbol('token')).toSelf(), /Cannot bind to a primitive/);
  });
});

describe('inheritance', () => {
  @injectable()
  class Dependency {}

  @injectable()
  class Base {
    constructor(readonly dependency: Dependency) {}
  }

  it('resolves a decorated subclass that has no constructor of its own', () => {
    @injectable()
    class Child extends Base {}

    const child = new Container().get(Child) as Child;

    assert.ok(child instanceof Child);
    assert.ok(child.dependency instanceof Dependency);
  });

  it('does not treat @injectable as inherited', () => {
    class Undecorated extends Base {}

    assert.throws(() => new Container().get(Undecorated), /not marked as @injectable/);
  });
});
