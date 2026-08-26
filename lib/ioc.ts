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
  constructor(type: 'circular_deps' | 'missing_binding') {
    const message =
      type === 'missing_binding'
        ? '[ResolutionError] binding does not exist, use `container.bind().to()` first or auto binding option in the constructor'
        : '[ResolutionError] circular dependecies detected';
    super(message);
  }
}

export function injectable(): ClassDecorator {
  return target => {
    Reflect.defineMetadata(INJECTABLE, true, target);
  };
}

function isInjectable(target: EntityIdentifier) {
  return Reflect.hasMetadata(INJECTABLE, target);
}

export function inject(entityIdentifer: EntityIdentifier): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    const existingCustomMetadata = Reflect.getMetadata(CUSTOM_PARAM_TYPES_METADATA, target);
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
  readonly scope: BindingScope = 'transient';
  readonly dependency: Dependency;
  constructor(
    entityIdentifier: EntityIdentifier<T>,
    scope: BindingScope = 'transient',
    dependency: Dependency,
  ) {
    this.entityIdentifier = entityIdentifier;
    this.dependency = dependency;
    this.scope = scope;
  }
}

class DependencyBindingBuilder<T = unknown> {
  private entityIdentifier: EntityIdentifier<T> | null = null;
  private scope: BindingScope = 'transient';
  private dependency: Dependency | null = null;
  onBindingConstructed: (binding: DependencyBinding) => void;
  constructor(onBindingConstructed: (binding: DependencyBinding) => void) {
    this.onBindingConstructed = onBindingConstructed;
  }
  private reset() {
    this.entityIdentifier = null;
    this.scope = 'transient';
    this.dependency = null;
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
    const binding = new DependencyBinding(this.entityIdentifier, this.scope, this.dependency);
    this.onBindingConstructed(binding);
    this.reset();
    return binding;
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
    const binding = new DependencyBinding(this.entityIdentifier, this.scope, this.dependency);
    this.onBindingConstructed(binding);
    this.reset();
  }
  toConstantValue(value: T) {
    if (!this.entityIdentifier) throw new Error('Dependency identifier is not set');
    this.dependency = {
      entity: value,
      type: 'constant',
    };
    const binding = new DependencyBinding(this.entityIdentifier, this.scope, this.dependency);
    this.onBindingConstructed(binding);
    this.reset();
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
  get(entityIdentifier: EntityIdentifier, path: string[] = []): unknown {
    if (this.singletons.has(entityIdentifier)) {
      return this.singletons.get(entityIdentifier);
    }
    if (path.includes(entityIdToString(entityIdentifier))) {
      throw new ResolutionError('circular_deps');
    }
    if (!this.bindings.has(entityIdentifier)) {
      if (!this.options.autobind) {
        throw new ResolutionError('missing_binding');
      }
      if (!isNewable(entityIdentifier)) {
        throw new ResolutionError('missing_binding');
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
        throw new Error(`Target ${dependency.entity.name} is not marked as @injectable`);
      }
      const paramTypes = getParamTypes(dependency.entity);
      const params = paramTypes.map(pt =>
        this.get(pt, [...path, entityIdToString(entityIdentifier)]),
      );
      const instance = new dependency.entity(...params);
      if (scope === 'singleton') {
        this.singletons.set(entityIdentifier, instance);
      }
      return instance;
    }
    throw new ResolutionError('missing_binding');
  }
  bind<T>(entityIdentifier: EntityIdentifier<T>) {
    if (this.bindings.has(entityIdentifier)) {
      throw new Error('Binding already exists, call unbind first');
    }
    const builder = new DependencyBindingBuilder((binding: DependencyBinding) => {
      this.bindings.set(entityIdentifier, binding);
    });
    return builder.bind(entityIdentifier);
  }
}
