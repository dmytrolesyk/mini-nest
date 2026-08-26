export type Newable<TInstance = unknown, TArgs extends unknown[] = any[]> = new (
  ...args: TArgs
) => TInstance;

export type EntityIdentifier<TInstance = unknown> = string | symbol | Newable<TInstance>;

export type BindingScope = 'singleton' | 'transient';

export type EntityType = 'newable' | 'constant';

export type ContainerOptions = { autobind: boolean };

export function isNewable(entity: EntityIdentifier): entity is Newable {
  return typeof entity !== 'symbol' && typeof entity !== 'string';
}

export type Dependency<T = unknown> =
  | { entity: Newable<T>; type: 'newable' }
  | { entity: T; type: 'constant' };
