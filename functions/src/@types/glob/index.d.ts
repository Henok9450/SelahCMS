/* eslint-disable */
declare module 'glob' {
  export interface IOptions {
    cwd?: string;
    dot?: boolean;
  }
  
  export class IMinimatch {
    constructor(pattern: string, options?: IOptions);
    match(path: string): boolean;
  }
}
/* eslint-enable */