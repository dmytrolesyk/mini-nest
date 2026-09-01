import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { Newable } from '../ioc/decorators/types.ts';

export type ValidationError = { field: string; constraints: string[] };

export type ValidationResult<T> = { instance: T; errors: ValidationError[] };

const BUILT_IN_TYPES: unknown[] = [String, Number, Boolean, Array, Object];

export const needsValidation = (type: unknown): boolean => {
  return typeof type === 'function' && !BUILT_IN_TYPES.includes(type);
};

export class ValidationPipe {
  static async transform<T extends object>(
    Dto: Newable<T>,
    value: unknown,
  ): Promise<ValidationResult<T>> {
    const instance = plainToInstance(Dto, value ?? {});
    const errors = await validate(instance);
    return {
      instance,
      errors: errors.map(error => ({
        field: error.property,
        constraints: Object.values(error.constraints ?? {}),
      })),
    };
  }
}
