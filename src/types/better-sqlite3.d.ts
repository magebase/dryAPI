declare module "better-sqlite3" {
  export interface Statement {
    run(...params: unknown[]): unknown
    all<T = unknown>(...params: unknown[]): T[]
    get<T = unknown>(...params: unknown[]): T | undefined
    raw(toggle?: boolean): Statement
  }

  export default class Database {
    constructor(filename: string)
    prepare(query: string): Statement
    exec(query: string): void
    close(): void
  }
}
