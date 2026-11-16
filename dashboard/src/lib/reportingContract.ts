/** Fail closed with fixed codes; never attach an untrusted value or error cause. */
export class ReportingUnavailable extends Error {
    constructor(public readonly code: "invalid_request" | "invalid_result" | "size_limit" | "database" | "timeout") {
        super("Reporting unavailable: " + code);
    }
}
export function invalid(): never { throw new ReportingUnavailable("invalid_result"); }
export function object(value: unknown, key: readonly string[]): Record<string, unknown> {
    if (typeof value !== "object" || value === null || Object.getPrototypeOf(value) !== Object.prototype) return invalid();
    const actual = Reflect.ownKeys(value);
    if (actual.length !== key.length || actual.some(item => typeof item !== "string" || !key.includes(item))) return invalid();
    for (const name of key) {
        const descriptor = Object.getOwnPropertyDescriptor(value, name);
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return invalid();
    }
    return value as Record<string, unknown>;
}
export function array(value: unknown, maximum: number): unknown[] {
    if (!Array.isArray(value) || value.length > maximum || Object.getPrototypeOf(value) !== Array.prototype) return invalid();
    // Reject extra properties, sparse slots, accessors and serialization hooks.
    if (Reflect.ownKeys(value).length !== value.length + 1) return invalid();
    for (let i = 0; i < value.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor || !("value" in descriptor)) return invalid();
    }
    return value;
}
export function member<T extends string>(value: unknown, choices: readonly T[]): T {
    if (typeof value !== "string" || !choices.includes(value as T)) return invalid();
    return value as T;
}
export function count(value: unknown): number {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) return invalid();
    return value;
}
export function databaseCount(value: unknown): number {
    if (typeof value === "string" && /^(0|[1-9][0-9]{0,15})$/.test(value)) return count(Number(value));
    return count(value);
}
export function measurement(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return invalid();
    return value;
}
export function timestamp(value: unknown): string {
    if (typeof value !== "string" || value.length !== 24 || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
        || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) return invalid();
    return value;
}
export function nullableTimestamp(value: unknown): string | null { return value === null ? null : timestamp(value); }
