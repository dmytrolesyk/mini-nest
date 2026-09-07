import 'reflect-metadata';

export { Container } from './ioc/container.ts';
export { inject } from './ioc/decorators/inject.ts';
export { injectable } from './ioc/decorators/injectable.ts';
export type {
  BindingScope,
  ContainerOptions,
  Dependency,
  EntityIdentifier,
  Newable,
} from './ioc/decorators/types.ts';

export { Controller } from './decorators/controller.ts';
export { Module } from './decorators/module.ts';
export { Delete, Get, Head, Options, Patch, Post, Put } from './decorators/methods.ts';
export { Body, Param, Query } from './decorators/params.ts';
export { ZodValidationPipe } from './pipes/zod-validation.pipe.ts';
export {
  BadRequestError,
  ForbiddenError,
  HttpException,
  InternalServerError,
  NotFoundError,
  ValidationError,
} from './filters/exception-filter.ts';
export type { FieldError } from './filters/exception-filter.ts';
export { Router } from './router.ts';
export { AppFactory } from './app-factory.ts';
export type {
  CallHandler,
  CanActivate,
  HttpExecutionContext,
  HttpMethod,
  Interceptor,
  Middleware,
  MiddlewareConsumer,
  MiniNestModule,
  Path,
  PipeTransform,
  RequestBody,
  RouteHandler,
  MatchedRoute,
} from './types.ts';
export { UseGuards } from './decorators/use-guards.ts';
export { UseInterceptors } from './decorators/use-interceptors.ts';
