// Type definitions for Deno

declare namespace Deno {
  export interface ServeOptions {
    port?: number;
    hostname?: string;
    handler?: (request: Request) => Response | Promise<Response>;
    onError?: (error: unknown) => Response | Promise<Response>;
    onListen?: (params: { hostname: string; port: number }) => void;
  }

  export function serve(
    handler: (request: Request) => Response | Promise<Response>,
    options?: ServeOptions
  ): void;

  export function serve(options: ServeOptions): void;

  export interface Env {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): boolean;
    toObject(): { [key: string]: string };
  }

  export const env: Env;
}
