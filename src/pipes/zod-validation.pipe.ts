import type { ZodError, ZodType } from 'zod';
import { ValidationError } from '../filters/exception-filter.ts';
import type { FieldError } from '../filters/exception-filter.ts';
import type { PipeTransform } from '../types.ts';

const toFieldErrors = (error: ZodError): FieldError[] => {
  const byField = new Map<string, string[]>();
  for (const issue of error.issues) {
    const field = issue.path.map(String).join('.') || '(root)';
    const constraints = byField.get(field) ?? [];
    constraints.push(issue.message);
    byField.set(field, constraints);
  }
  return [...byField].map(([field, constraints]) => ({ field, constraints }));
};

export class ZodValidationPipe<TOut> implements PipeTransform<unknown, TOut> {
  private readonly schema: ZodType<TOut>;
  constructor(schema: ZodType<TOut>) {
    this.schema = schema;
  }
  transform(value: unknown): TOut {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new ValidationError('Validation failed', toFieldErrors(result.error));
    }
    return result.data;
  }
}
