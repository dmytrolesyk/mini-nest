import { CUSTOM_PARAM_TYPES_METADATA, PARAM_TYPES_METADATA } from './tokens.ts';
import type { EntityIdentifier, Newable } from './types.ts';

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

export const getParamTypes = (entity: Newable): EntityIdentifier[] => {
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
