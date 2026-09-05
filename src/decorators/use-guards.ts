import { injectable } from '../ioc/decorators/injectable.ts';
import type { Newable } from '../ioc/decorators/types.ts';
import type { CanActivate } from '../types.ts';
import { composeClassDecorators } from './helpers.ts';

export const GUARDS_METADATA_TOKEN = Symbol.for('guards:metadata');

const setControllerGuards = (...guards: CanActivate[]): ClassDecorator => {
  return target => {
    Reflect.defineMetadata(GUARDS_METADATA_TOKEN, guards, target);
  };
};

export function UseGuards(...guards: CanActivate[]) {
  return composeClassDecorators(injectable(), setControllerGuards(...guards));
}

export const getGuardsMetadata = (target: Newable): CanActivate[] => {
  return (Reflect.getMetadata(GUARDS_METADATA_TOKEN, target) ?? []) as CanActivate[];
};
