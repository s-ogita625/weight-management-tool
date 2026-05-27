declare module '@neondatabase/serverless' {
  export type NeonQueryFunction = <T = unknown>(
    strings: TemplateStringsArray,
    ...params: unknown[]
  ) => Promise<T[]>;

  export function neon(connectionString: string): NeonQueryFunction;
}
