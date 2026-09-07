export const compose = <T>(...fns: Array<(a: T) => T>): ((a: T) => T) =>
  fns.reduce(
    (prev, next) => value => prev(next(value)),
    (value: T) => value,
  );
