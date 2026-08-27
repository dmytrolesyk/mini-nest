import { INJECTABLE } from '../tokens.js';
import { BindingScope, EntityIdentifier, InjectableOptions } from '../types.js';

export function injectable(options: InjectableOptions = {}): ClassDecorator {
  return target => {
    Reflect.defineMetadata(INJECTABLE, options, target);
  };
}

export function isInjectable(target: EntityIdentifier) {
  return Reflect.hasOwnMetadata(INJECTABLE, target);
}

export function getDeclaredScope(target: EntityIdentifier): BindingScope | undefined {
  const options = Reflect.getOwnMetadata(INJECTABLE, target) as InjectableOptions | undefined;
  return options?.scope;
}
