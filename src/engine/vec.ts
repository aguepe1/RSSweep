// Utilidades vectoriales 2D.
import type { Vec2 } from "../types";

export function vsub(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}
export function vadd(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]];
}
export function vscale(a: Vec2, k: number): Vec2 {
  return [a[0] * k, a[1] * k];
}
export function vlen(a: Vec2): number {
  return Math.hypot(a[0], a[1]);
}
export function vdot(a: Vec2, b: Vec2): number {
  return a[0] * b[0] + a[1] * b[1];
}
export function unit(th: number): Vec2 {
  return [Math.cos(th), Math.sin(th)];
}
