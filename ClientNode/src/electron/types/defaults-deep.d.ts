declare module '@nodeutils/defaults-deep' {
    function defaultsDeep<T>(target: T, ...sources: any[]): T;
    export default defaultsDeep;
} 