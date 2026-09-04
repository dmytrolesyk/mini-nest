import { injectable } from '../ioc/decorators/injectable.ts';
import type { Newable } from '../ioc/decorators/types.ts';
import { composeClassDecorators } from './helpers.ts';

type Prefix = string | string[];

export const CONTROLLER_METADATA_TOKEN = Symbol.for('controller:metadata');

const setControllerPrefix = (prefix: Prefix): ClassDecorator => {
  return target => {
    Reflect.defineMetadata(CONTROLLER_METADATA_TOKEN, prefix, target);
  };
};

export function Controller(prefix: Prefix) {
  return composeClassDecorators(injectable(), setControllerPrefix(prefix));
}

export const getControllerPrefix = (target: Newable): Prefix | undefined => {
  return Reflect.getMetadata(CONTROLLER_METADATA_TOKEN, target) as Prefix;
};
