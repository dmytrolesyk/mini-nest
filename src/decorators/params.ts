export const PARAMS_METADATA_TOKEN = Symbol.for('metadata:params');

type MethodName = string | symbol;

type ParameterIndex = number;

export type ParamType = 'param' | 'body' | 'query';

export type ParamMetadata = { type: ParamType; key?: string };

export type ParamsMetadata = Map<MethodName, Map<ParameterIndex, ParamMetadata>>;

export const getParamsMetadata = (target: Object): ParamsMetadata => {
  return Reflect.getMetadata(PARAMS_METADATA_TOKEN, target) ?? new Map();
};

function ControllerMethodParameter(type: ParamType, key?: string): ParameterDecorator {
  return (target, methodName, parameterIndex) => {
    if (!methodName) return;
    const params = getParamsMetadata(target);
    const methodParams = params.get(methodName) ?? new Map();
    methodParams.set(parameterIndex, { type, key });
    params.set(methodName, methodParams);
    Reflect.defineMetadata(PARAMS_METADATA_TOKEN, params, target);
  };
}

export const Param = (key: string) => ControllerMethodParameter('param', key);
export const Query = (key: string) => ControllerMethodParameter('query', key);
export const Body = () => ControllerMethodParameter('body');
