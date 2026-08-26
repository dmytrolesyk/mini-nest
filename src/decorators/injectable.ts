import { INJECTABLE } from '../tokens.js';
import { EntityIdentifier } from '../types.js';

export function injectable(): ClassDecorator {
  return target => {
    Reflect.defineMetadata(INJECTABLE, true, target);
  };
}

export function isInjectable(target: EntityIdentifier) {
  return Reflect.hasOwnMetadata(INJECTABLE, target);
}
