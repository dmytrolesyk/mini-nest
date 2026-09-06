import type { STATUS_CODE } from '../types.ts';

export type FieldError = { field: string; constraints: string[] };

export class HttpException extends Error {
  private readonly statusCode: STATUS_CODE;
  constructor(message: string, statusCode: STATUS_CODE) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
  }
  getStatus() {
    return this.statusCode;
  }
  toPayload() {
    return {
      status: this.statusCode,
      payload: { message: this.message },
    };
  }
}

export class BadRequestError extends HttpException {
  constructor(message: string) {
    super(message, 400);
  }
}

export class ValidationError extends BadRequestError {
  private readonly errors: FieldError[];
  constructor(message: string, errors: FieldError[] = []) {
    super(message);
    this.errors = errors;
  }
  getErrors() {
    return this.errors;
  }
  override toPayload() {
    return {
      status: this.getStatus(),
      payload: { message: this.message, errors: this.errors },
    };
  }
}

export class NotFoundError extends HttpException {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ForbiddenError extends HttpException {
  constructor(message: string) {
    super(message, 403);
  }
}

export class InternalServerError extends HttpException {
  constructor(message: string) {
    super(message, 500);
  }
}

export const exceptionFilter = (error: unknown) => {
  console.error(error);
  if (error instanceof HttpException) {
    return error.toPayload();
  }
  const genericError = new InternalServerError('Something went wrong');
  return genericError.toPayload();
};
