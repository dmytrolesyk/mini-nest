export function composeClassDecorators(...decorators: ClassDecorator[]): ClassDecorator {
  return target => {
    for (const decorator of decorators) {
      decorator(target);
    }
  };
}
