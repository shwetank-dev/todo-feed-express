import type { Request } from "express";

export function assertParam<K extends string>(
  req: Request,
  name: K,
): asserts req is Request<Record<K, string>> {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new Error(
      `route param "${name}" is missing — check the route pattern includes :${name}`,
    );
  }
}
