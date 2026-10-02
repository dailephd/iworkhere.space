export const RANGE = ["24h", "7d", "30d", "90d", "180d", "1y", "all"] as const;
export type Range = typeof RANGE[number];
export type Granularity = "hour" | "day" | "week" | "month";
export interface RangePlan {
    range: Range;
    source: "raw" | "daily";
    granularity: Granularity;
    start: string;
    end: string;
    today: string;
}
export function parseRange(value: unknown): Range {
    return typeof value === "string" && RANGE.some(range => range === value) ? value as Range : "24h";
}
export function rangePlan(range: Range, now: Date): RangePlan {
    const end = now.toISOString();
    const today = new Date(`${end.slice(0, 10)}T00:00:00.000Z`);
    const source = ["180d", "1y", "all"].includes(range) ? "daily" : "raw";
    let start = new Date(source === "daily" ? today : now);
    if (range === "all") start = new Date("1970-01-01T00:00:00.000Z");
    else if (range === "1y") {
        // Calendar year with explicit leap-day clamping.
        const month = start.getUTCMonth();
        start.setUTCFullYear(start.getUTCFullYear() - 1);
        if (start.getUTCMonth() !== month) start.setUTCDate(0);
    } else {
        const dayCount = range === "24h" ? 1 : Number(range.slice(0, -1));
        start = new Date(start.getTime() - dayCount * 86_400_000);
    }
    const granularity = range === "24h" ? "hour" : range === "1y" ? "week" : range === "all" ? "month" : "day";
    return { range, source, granularity, start: start.toISOString(), end, today: today.toISOString() };
}
export function binTime(iso: string, granularity: Granularity): string {
    const date = new Date(iso);
    date.setUTCMinutes(0, 0, 0);
    if (granularity !== "hour") date.setUTCHours(0);
    if (granularity === "week") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    if (granularity === "month") date.setUTCDate(1);
    return date.toISOString();
}
