import 'reflect-metadata';

export { Container } from './container.js';
export { inject } from './decorators/inject.js';
export { injectable } from './decorators/injectable.js';
export type {
  BindingScope,
  ContainerOptions,
  Dependency,
  EntityIdentifier,
  Newable,
} from './types.js';
