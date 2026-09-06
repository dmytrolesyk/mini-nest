import 'reflect-metadata';
import { injectable } from './ioc/decorators/injectable.ts';
import { Controller } from './decorators/controller.ts';
import { Get, Post } from './decorators/methods.ts';
import { Body, Param, Query } from './decorators/params.ts';
import { CreateUserSchema } from './dto/create-user.dto.ts';
import type { CreateUserDto } from './dto/create-user.dto.ts';
import { ZodValidationPipe } from './pipes/zod-validation.pipe.ts';
import { AppFactory } from './app-factory.ts';
import { NotFoundError } from './filters/exception-filter.ts';
import { UseGuards } from './decorators/use-guards.ts';
import { AuthGuard } from './guards/auth.guard.ts';
import { UseInterceptors } from './decorators/use-interceptors.ts';
import { LoggingInterceptor } from './interceptors/logging.interceptor.ts';
import type { MiddlewareConsumer, MiniNestModule } from './types.ts';
import { Module } from './decorators/module.ts';
import { LoggerService } from './services/logger.service.ts';

type User = { id: number } & CreateUserDto;

@injectable()
class UsersService {
  constructor(private readonly logger: LoggerService) {}

  private readonly users: User[] = [
    { id: 1, name: 'Harry Styles', email: 'harry@example.com', age: 31 },
    { id: 2, name: 'Ceaseless Discharge', email: 'ceaseless@example.com', age: 44 },
  ];

  findAll(limit?: number) {
    this.logger.log(`listing users (limit: ${limit ?? 'none'})`);
    return limit ? this.users.slice(0, limit) : this.users;
  }

  findOne(id: number) {
    this.logger.log(`looking up user ${id}`);
    const user = this.users.find(user => user.id === id);
    if (!user) {
      throw new NotFoundError('User with this id not found');
    }
    return user;
  }

  create(dto: CreateUserDto) {
    this.logger.log(`creating user ${dto.email}`);
    const user = { id: this.users.length + 1, ...dto };
    this.users.push(user);
    return user;
  }
}

@Controller('users')
@UseGuards(AuthGuard)
@UseInterceptors(LoggingInterceptor)
class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getAllUsers(@Query('limit') limit: string) {
    console.log('controller');
    return this.usersService.findAll(limit ? Number(limit) : undefined);
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.usersService.findOne(Number(id));
  }

  @Post()
  createUser(@Body(new ZodValidationPipe(CreateUserSchema)) createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}

@Module({ controllers: [UsersController] })
class AppModule implements MiniNestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply([
      (context, next) => {
        console.log('middleware in');
        context.response.appendHeader('x-middleware-header', 'oh-hi-mark');
        context.response.on('finish', () => console.log('middleware out'));
        next();
      },
    ]);
  }
}

AppFactory.create(AppModule).listen(3000, () => {
  console.log('app started');
});
