import 'reflect-metadata';
import {
  BindingScope,
  ContainerOptions,
  Dependency,
  EntityIdentifier,
  isNewable,
  Newable,
} from './types.ts';

const INJECTABLE = Symbol.for('injectable_service');

const PARAM_TYPES_METADATA = 'design:paramtypes';
const CUSTOM_PARAM_TYPES_METADATA = 'custom:design:paramtypes';

class ResolutionError extends Error {
  constructor(type: 'circular_deps' | 'missing_binding', deps?: EntityIdentifier[]) {
    const message =
      type === 'missing_binding'
        ? '[ResolutionError] binding does not exist, use `container.bind().to()` first or auto binding option in the constructor'
        : `[ResolutionError] circular dependencies detected ${deps?.map(entityIdToString).join(' -> ')}`;
    super(message);
  }
}

class InjectableError extends Error {
  constructor(entityName: string) {
    super(`Target ${entityName} is not marked as @injectable`);
  }
}

export function injectable(): ClassDecorator {
  return target => {
    Reflect.defineMetadata(INJECTABLE, true, target);
  };
}

function isInjectable(target: EntityIdentifier) {
  return Reflect.hasOwnMetadata(INJECTABLE, target);
}

export function inject(entityIdentifer: EntityIdentifier): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    const existingCustomMetadata = Reflect.getOwnMetadata(CUSTOM_PARAM_TYPES_METADATA, target);
    Reflect.defineMetadata(
      CUSTOM_PARAM_TYPES_METADATA,
      Object.assign({}, existingCustomMetadata, { [parameterIndex]: entityIdentifer }),
      target,
    );
  };
}

const getParamTypes = (entity: Newable): EntityIdentifier[] => {
  const paramTypes = Reflect.getMetadata(PARAM_TYPES_METADATA, entity) as
    | EntityIdentifier[]
    | undefined;
  const customParamTypes = Reflect.getMetadata(CUSTOM_PARAM_TYPES_METADATA, entity) as
    | Record<number, EntityIdentifier>
    | undefined;

  return (
    paramTypes?.map((paramType, i) => {
      if (customParamTypes && customParamTypes[i]) {
        return customParamTypes[i];
      }
      return paramType;
    }) ?? []
  );
};

class DependencyBinding<T = unknown> {
  readonly entityIdentifier: EntityIdentifier<T>;
  readonly dependency: Dependency;
  readonly scope: BindingScope = 'singleton';
  constructor(
    entityIdentifier: EntityIdentifier<T>,
    dependency: Dependency,
    scope: BindingScope = 'singleton',
  ) {
    this.entityIdentifier = entityIdentifier;
    this.dependency = dependency;
    this.scope = scope;
  }
}

class DependencyBindingBuilder<T = unknown> {
  private entityIdentifier: EntityIdentifier<T> | null = null;
  private scope: BindingScope = 'singleton';
  private dependency: Dependency<T> | null = null;
  private readonly onBindingConstructed: (binding: DependencyBinding) => void;
  constructor(onBindingConstructed: (binding: DependencyBinding) => void) {
    this.onBindingConstructed = onBindingConstructed;
  }
  bind(entityIdentifier: EntityIdentifier<T>) {
    this.entityIdentifier = entityIdentifier;
    return this;
  }
  to(entity: Newable<T>) {
    if (!this.entityIdentifier) throw new Error('Dependency identifier is not set');
    this.dependency = {
      entity: entity,
      type: 'newable',
    };
    const binding = new DependencyBinding<T>(this.entityIdentifier, this.dependency, this.scope);
    this.onBindingConstructed(binding);
  }
  toSelf() {
    if (!this.entityIdentifier) throw new Error('Dependency identifier is not set');
    if (typeof this.entityIdentifier === 'string' || typeof this.entityIdentifier === 'symbol') {
      throw new Error('Cannot bind to a primitive value');
    }
    this.dependency = {
      entity: this.entityIdentifier,
      type: 'newable',
    };
    const binding = new DependencyBinding(this.entityIdentifier, this.dependency, this.scope);
    this.onBindingConstructed(binding);
  }
  toConstantValue(value: T) {
    if (!this.entityIdentifier) throw new Error('Dependency identifier is not set');
    this.dependency = {
      entity: value,
      type: 'constant',
    };
    const binding = new DependencyBinding(this.entityIdentifier, this.dependency, this.scope);
    this.onBindingConstructed(binding);
  }
  setScope(scope: BindingScope) {
    this.scope = scope;
    return this;
  }
}

const entityIdToString = (entityId: EntityIdentifier) => {
  if (typeof entityId === 'string') return entityId;
  if (typeof entityId === 'symbol') return entityId.toString();
  return entityId.name;
};

export class Container {
  private options: ContainerOptions;
  private singletons = new Map<EntityIdentifier, unknown>();
  private bindings = new Map<EntityIdentifier, DependencyBinding>();
  constructor(options?: ContainerOptions) {
    const defaultOptions = { autobind: true };
    this.options = options ?? defaultOptions;
  }
  private resolve(entityIdentifier: EntityIdentifier, path: EntityIdentifier[] = []): unknown {
    if (this.singletons.has(entityIdentifier)) {
      return this.singletons.get(entityIdentifier);
    }
    if (path.includes(entityIdentifier)) {
      throw new ResolutionError('circular_deps', [...path, entityIdentifier]);
    }
    if (!this.bindings.has(entityIdentifier)) {
      if (!this.options.autobind) {
        throw new ResolutionError('missing_binding');
      }
      if (!isNewable(entityIdentifier)) {
        throw new ResolutionError('missing_binding');
      }
      if (!isInjectable(entityIdentifier)) {
        throw new InjectableError(entityIdentifier.name);
      }
      this.bind(entityIdentifier).toSelf();
    }

    const binding = this.bindings.get(entityIdentifier);
    if (binding) {
      const { scope, dependency } = binding;
      if (dependency.type === 'constant') {
        return dependency.entity;
      }
      if (!isInjectable(dependency.entity)) {
        throw new InjectableError(dependency.entity.name);
      }
      const paramTypes = getParamTypes(dependency.entity);
      const params = paramTypes.map(pt => this.resolve(pt, [...path, entityIdentifier]));
      const instance = new dependency.entity(...params);
      if (scope === 'singleton') {
        this.singletons.set(entityIdentifier, instance);
      }
      return instance;
    }
    throw new ResolutionError('missing_binding');
  }
  get(entityIdentifier: EntityIdentifier): unknown {
    return this.resolve(entityIdentifier);
  }
  bind<T>(entityIdentifier: EntityIdentifier<T>) {
    if (this.bindings.has(entityIdentifier)) {
      throw new Error('Binding already exists, call unbind first');
    }
    const builder = new DependencyBindingBuilder<T>((binding: DependencyBinding) => {
      this.bindings.set(entityIdentifier, binding);
    });
    return builder.bind(entityIdentifier);
  }
  unbind<T>(entityIdentifier: EntityIdentifier<T>) {
    if (this.bindings.has(entityIdentifier)) {
      this.bindings.delete(entityIdentifier);
    }
    if (this.singletons.has(entityIdentifier)) {
      this.singletons.delete(entityIdentifier);
    }
  }
}
