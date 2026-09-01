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
export { ValidationPipe, needsValidation } from './pipes/validation.pipe.ts';
export type { ValidationError, ValidationResult } from './pipes/validation.pipe.ts';
export { Router } from './router.ts';
export type { MatchedRoute, RouteEntry } from './router.ts';
export { Factory } from './dispatcher.ts';
export type { HttpMethod, Path, RequestBody } from './types.ts';
