import { z } from 'zod';

export const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  age: z.number().int(),
});

export type CreateUserDto = z.infer<typeof CreateUserSchema>;
