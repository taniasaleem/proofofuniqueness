declare module '@nodeutils/defaults-deep' {
  function defaultsDeep<T, U>(target: T, source: U): T & U;
  export default defaultsDeep;
}