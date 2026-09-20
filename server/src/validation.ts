// Tiny bean-style checks for the DTO classes: required, not empty,
// not null, must be one of these values. All failures are VALIDATION_ERROR.
import { fail } from "./errors";

function bad(field: string, rule: string): never {
  throw fail("VALIDATION_ERROR", `${field} ${rule}`);
}

export function must(ok: boolean, field: string, rule: string): void {
  if (!ok) bad(field, rule);
}

export function reqObj(v: any, field: string): Record<string, any> {
  if (v === null || v === undefined) bad(field, "is required");
  if (typeof v !== "object" || Array.isArray(v)) bad(field, "must be an object");
  return v;
}

export function reqStr(v: any, field: string): string {
  if (typeof v !== "string" || v.trim() === "") bad(field, "is required and must not be empty");
  return v;
}

export function optStr(v: any, field: string): string | undefined {
  if (v === undefined) return undefined;
  return reqStr(v, field);
}

export function anyStr(v: any, field: string): string {
  if (typeof v !== "string") bad(field, "must be a string");
  return v;
}

export function reqArr(v: any, field: string): any[] {
  if (!Array.isArray(v)) bad(field, "is required and must be an array");
  return v;
}

export function optArr(v: any, field: string): any[] | undefined {
  if (v === undefined) return undefined;
  return reqArr(v, field);
}

export function reqNum(v: any, field: string): number {
  if (typeof v !== "number" || Number.isNaN(v)) bad(field, "is required and must be a number");
  return v;
}

export function intRange(v: any, field: string, min: number, max: number): number {
  const n = reqNum(v, field);
  if (!Number.isInteger(n) || n < min || n > max) bad(field, `must be a whole number from ${min} to ${max}`);
  return n;
}

export function numRange(v: any, field: string, min: number, max: number): number {
  const n = reqNum(v, field);
  if (n < min || n > max) bad(field, `must be between ${min} and ${max}`);
  return n;
}

export function nullableNum(v: any, field: string): number | null {
  if (v === null) return null;
  return reqNum(v, field);
}

export function oneOf<T extends string>(v: any, field: string, values: T[]): T {
  if (!values.includes(v)) bad(field, `must be one of: ${values.join(", ")}`);
  return v;
}
