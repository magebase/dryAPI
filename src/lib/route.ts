import type { Route } from "next"

export function toRoute(path: string): Route {
  return path as Route
}