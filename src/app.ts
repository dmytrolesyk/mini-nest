import 'reflect-metadata';
import { injectable } from './ioc/decorators/injectable.ts';
import { Controller } from './decorators/controller.ts';
import { Get, Post } from './decorators/methods.ts';
import { Module } from './decorators/module.ts';
import { Body, Param, Query } from './decorators/params.ts';
import { CreateUserDto } from './dto/create-user.dto.ts';
import { Factory } from './dispatcher.ts';

type User = { id: number } & CreateUserDto;

@injectable()
class UsersService {
  private readonly users: User[] = [
    { id: 1, name: 'Harry Styles', email: 'harry@example.com', age: 31 },
    { id: 2, name: 'Ceaseless Discharge', email: 'ceaseless@example.com', age: 44 },
  ];

  findAll(limit?: number) {
    return limit ? this.users.slice(0, limit) : this.users;
  }

  findOne(id: number) {
    return this.users.find(user => user.id === id);
  }

  create(dto: CreateUserDto) {
    const user = { id: this.users.length + 1, ...dto };
    this.users.push(user);
    return user;
  }
}

@Controller('users')
class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getAllUsers(@Query('limit') limit: string) {
    return this.usersService.findAll(limit ? Number(limit) : undefined);
  }

  @Get(':id')
  getUser(@Param('id') id: string) {
    return this.usersService.findOne(Number(id));
  }

  @Post()
  createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}

@Module({ controllers: [UsersController] })
class AppModule {}

Factory.create([AppModule]).listen(3000);
