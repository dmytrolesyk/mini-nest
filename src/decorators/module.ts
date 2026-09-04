import { injectable } from '../ioc/decorators/injectable.ts';
import type { Newable } from '../ioc/decorators/types.ts';
import { composeClassDecorators } from './helpers.ts';

export const MODULE_METADATA_TOKEN = Symbol.for('metadata:module');

type ModuleMetadata = { controllers: Newable[] };

const setModuleMetadata = (metadata: ModuleMetadata): ClassDecorator => {
  return target => {
    Reflect.defineMetadata(MODULE_METADATA_TOKEN, metadata, target);
  };
};

export function Module(metadata: ModuleMetadata) {
  return composeClassDecorators(injectable(), setModuleMetadata(metadata));
}

export const getModuleMetadata = (target: Newable) => {
  return Reflect.getMetadata(MODULE_METADATA_TOKEN, target) as ModuleMetadata;
};
