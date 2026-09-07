import type { PipeTransform } from '../types.ts';

export const PARAMS_METADATA_TOKEN = Symbol.for('metadata:params');

type MethodName = string | symbol;

export type ParameterIndex = number;

export type ParamType = 'param' | 'body' | 'query';

export type ParamMetadata = { type: ParamType; key?: string; pipe?: PipeTransform };

export type ParamsMetadata = Map<MethodName, Map<ParameterIndex, ParamMetadata>>;

export const getParamsMetadata = (target: Object): ParamsMetadata => {
  return Reflect.getMetadata(PARAMS_METADATA_TOKEN, target) ?? new Map();
};

function ControllerMethodParameter(
  type: ParamType,
  key?: string,
  pipe?: PipeTransform,
): ParameterDecorator {
  return (target, methodName, parameterIndex) => {
    if (!methodName) return;
    const params = getParamsMetadata(target);
    const methodParams = params.get(methodName) ?? new Map();
    methodParams.set(parameterIndex, { type, key, pipe });
    params.set(methodName, methodParams);
    Reflect.defineMetadata(PARAMS_METADATA_TOKEN, params, target);
  };
}

export const Param = (key: string, pipe?: PipeTransform) =>
  ControllerMethodParameter('param', key, pipe);
export const Query = (key: string, pipe?: PipeTransform) =>
  ControllerMethodParameter('query', key, pipe);

export function Body(): ParameterDecorator;
export function Body(pipe: PipeTransform): ParameterDecorator;
export function Body(key: string, pipe?: PipeTransform): ParameterDecorator;
export function Body(keyOrPipe?: string | PipeTransform, pipe?: PipeTransform): ParameterDecorator {
  return typeof keyOrPipe === 'string'
    ? ControllerMethodParameter('body', keyOrPipe, pipe)
    : ControllerMethodParameter('body', undefined, keyOrPipe);
}
