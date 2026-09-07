import { injectable } from '../ioc/decorators/injectable.ts';
import type { Newable } from '../ioc/decorators/types.ts';
import type { Interceptor } from '../types.ts';
import { composeClassDecorators } from './helpers.ts';

export const INTERCEPTORS_METADATA_TOKEN = Symbol.for('interceptors:metadata');

const setControllerInterceptors = (...guards: Newable<Interceptor>[]): ClassDecorator => {
  return target => {
    Reflect.defineMetadata(INTERCEPTORS_METADATA_TOKEN, guards, target);
  };
};

export function UseInterceptors(...interceptors: Newable<Interceptor>[]) {
  return composeClassDecorators(injectable(), setControllerInterceptors(...interceptors));
}

export const getInterceptorsMetadata = (target: Newable): Newable<Interceptor>[] => {
  return (Reflect.getMetadata(INTERCEPTORS_METADATA_TOKEN, target) ?? []) as Newable<Interceptor>[];
};
