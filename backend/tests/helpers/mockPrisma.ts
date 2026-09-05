import { vi } from "vitest";

/**
 * A permissive Proxy-based Prisma mock: any `mockPrisma.someModel.someMethod` access
 * lazily becomes a `vi.fn()`, so tests only need to configure the calls they actually
 * care about via `.mockResolvedValue(...)` without pre-declaring every model/method.
 * `$transaction` invokes its callback with the same mock (so `tx.*` calls inside a
 * transaction are visible/configurable the same way), and `$queryRaw`/`$executeRaw`
 * resolve to an empty result by default (used only for advisory row locking in this codebase).
 */
export const createMockPrisma = () => {
  const modelHandler: ProxyHandler<Record<string, unknown>> = {
    get: (target, prop: string) => {
      if (!(prop in target)) target[prop] = vi.fn();
      return target[prop];
    },
  };

  const root: Record<string, unknown> = {};
  let proxy: any;

  const rootHandler: ProxyHandler<Record<string, unknown>> = {
    get: (target, prop: string) => {
      if (prop === "$transaction") {
        if (!target.$transaction) {
          target.$transaction = vi.fn(async (arg: unknown) =>
            typeof arg === "function" ? (arg as (tx: unknown) => unknown)(proxy) : Promise.all(arg as Promise<unknown>[]),
          );
        }
        return target.$transaction;
      }
      if (prop === "$queryRaw" || prop === "$executeRaw" || prop === "$queryRawUnsafe" || prop === "$executeRawUnsafe") {
        if (!target[prop]) target[prop] = vi.fn(async () => []);
        return target[prop];
      }
      if (!(prop in target)) target[prop] = new Proxy({}, modelHandler);
      return target[prop];
    },
  };

  proxy = new Proxy(root, rootHandler);
  return proxy;
};
