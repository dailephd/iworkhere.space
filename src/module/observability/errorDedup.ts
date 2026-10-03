const reportedError = new WeakSet<object>();
const measuredError = new WeakSet<object>();
export function claimMetricError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return true;
    if (measuredError.has(error)) return false;
    measuredError.add(error);
    return true;
}
export function claimError(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return true;
    if (reportedError.has(error)) return false;
    reportedError.add(error);
    return true;
}
